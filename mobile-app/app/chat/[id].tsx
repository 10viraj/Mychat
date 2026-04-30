// app/chat/[id].tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { getMessages, markMessagesAsRead } from '../../services/api';
import { initiateSocket, sendMessage, subscribeToMessages, disconnectSocket, emitTyping, subscribeToTyping, subscribeToStatusUpdates, subscribeToReadStatus, markMessagesAsRead as markAsReadSocket } from '../../services/socket';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

export default function ChatScreen() {
    const { id, name } = useLocalSearchParams();
    const { user } = useAuth();
    const [messages, setMessages] = useState<any[]>([]);
    const [text, setText] = useState('');
    const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        if (user) {
            const userId = (user as any).user.id;
            initiateSocket(userId);
            fetchMessages();
            markAsRead();
            subscribeToMessages((msg: any) => {
                setMessages((prev) => [...prev, msg]);
                markAsRead();
                if (msg.sender !== userId) {
                    Notifications.scheduleNotificationAsync({
                        content: { title: `New Message from ${name}`, body: msg.text, sound: true },
                        trigger: null,
                    });
                }
            });
            subscribeToTyping((data: any) => { if (data.sender === id) setIsOtherUserTyping(data.isTyping); });
            
            subscribeToStatusUpdates((data: any) => {
                setMessages((prev) => prev.map(m => m._id === data.messageId ? { ...m, status: data.status } : m));
            });

            subscribeToReadStatus((data: any) => {
                if (data.readerId === id) {
                    setMessages((prev) => prev.map(m => m.sender === userId ? { ...m, status: 'read' } : m));
                }
            });

            return () => disconnectSocket();
        }
    }, [user, id]);

    const fetchMessages = async () => {
        const res = await getMessages((user as any).user.id, id);
        setMessages(res.data);
    };

    const markAsRead = async () => {
        try { 
            await markMessagesAsRead(id, (user as any).user.id);
            markAsReadSocket(id, (user as any).user.id); // Also notify via socket
        } catch (err) { console.error(err); }
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 1,
        });

        if (!result.canceled) {
            uploadFile(result.assets[0].uri);
        }
    };

    const uploadFile = async (uri: string) => {
        setIsUploading(true);
        const formData = new FormData();
        const filename = uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image`;

        // @ts-ignore
        formData.append('file', { uri, name: filename, type });

        try {
            const res = await axios.post('http://192.168.1.4:5000/api/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const msgData = {
                sender: (user as any).user.id,
                receiver: id,
                messageType: res.data.messageType,
                fileUrl: res.data.fileUrl,
                text: 'Image'
            };
            sendMessage(msgData);
        } catch (err) {
            alert("Upload failed");
        } finally {
            setIsUploading(false);
        }
    };

    const handleSend = () => {
        if (text.trim()) {
            sendMessage({ sender: (user as any).user.id, receiver: id, text: text.trim(), messageType: 'text' });
            setText('');
        }
    };

    const renderMessage = ({ item }: { item: any }) => {
        const isMe = item.sender === (user as any).user.id;
        return (
            <View style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage]}>
                <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
                    {item.messageType === 'image' ? (
                        <Image source={{ uri: item.fileUrl }} style={styles.chatImage} />
                    ) : (
                        <Text style={styles.messageText}>{item.text}</Text>
                    )}
                    <View style={styles.msgFooter}>
                        <Text style={styles.timeText}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                        {isMe && (
                            <Ionicons 
                                name={item.status === 'sent' ? "checkmark" : "checkmark-done"} 
                                size={16} 
                                color={item.status === 'read' ? "#34b7f1" : "#8696a0"} 
                                style={{ marginLeft: 4 }} 
                            />
                        )}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container} keyboardVerticalOffset={90}>
            <Stack.Screen options={{ 
                headerTitle: () => (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={styles.headerAvatar}><Text style={styles.avatarText}>{name ? (name as string)[0] : 'U'}</Text></View>
                        <View style={{ marginLeft: 10 }}>
                            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{name}</Text>
                            <Text style={{ fontSize: 12, color: 'gray' }}>{isOtherUserTyping ? 'typing...' : 'online'}</Text>
                        </View>
                    </View>
                )
            }} />
            <Image source={{ uri: 'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png' }} style={StyleSheet.absoluteFill} />
            
            <FlatList data={messages} keyExtractor={(item, index) => index.toString()} renderItem={renderMessage} contentContainerStyle={{ padding: 10 }} ref={flatListRef} onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })} />

            <View style={styles.inputContainer}>
                <TouchableOpacity style={styles.iconBtn}>
                    <MaterialCommunityIcons name="sticker-emoji" size={26} color="#667781" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={pickImage} disabled={isUploading}>
                    <Ionicons name="add" size={28} color="#667781" />
                </TouchableOpacity>
                <TextInput style={styles.input} placeholder="Type a message" value={text} onChangeText={setText} multiline />
                <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={!text.trim() && !isUploading}>
                    <Ionicons name="send" size={20} color="#fff" />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#efeae2' },
    messageContainer: { marginVertical: 2, flexDirection: 'row', width: '100%' },
    myMessage: { justifyContent: 'flex-end' },
    theirMessage: { justifyContent: 'flex-start' },
    bubble: { padding: 8, borderRadius: 10, maxWidth: '80%', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1 },
    myBubble: { backgroundColor: '#dcf8c6', borderTopRightRadius: 0 },
    theirBubble: { backgroundColor: '#fff', borderTopLeftRadius: 0 },
    messageText: { fontSize: 16, color: '#111' },
    chatImage: { width: 250, height: 250, borderRadius: 8, marginBottom: 5 },
    msgFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 },
    timeText: { fontSize: 10, color: '#666' },
    inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#f0f2f5' },
    input: { flex: 1, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, marginHorizontal: 8, maxHeight: 100, fontSize: 16 },
    iconBtn: { padding: 4 },
    sendBtn: { backgroundColor: '#075E54', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    headerAvatar: { width: 35, height: 35, borderRadius: 17.5, backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontWeight: 'bold', color: '#fff' },
});
