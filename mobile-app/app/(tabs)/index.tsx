// app/(tabs)/index.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { getUsers } from '../../services/api';

const AVATAR_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F06292', '#AED581', '#FFD54F'];

export default function ChatListScreen() {
    const [users, setUsers] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const { user } = useAuth();
    const router = useRouter();

    useFocusEffect(
        useCallback(() => {
            if (user) fetchUsers();
        }, [user])
    );

    const fetchUsers = async () => {
        try {
            // @ts-ignore
            const res = await getUsers(user.user.id);
            setUsers(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchUsers();
        setRefreshing(false);
    };

    const getAvatarColor = (name: string) => {
        const index = name.length % AVATAR_COLORS.length;
        return AVATAR_COLORS[index];
    };

    const formatTime = (time: string) => {
        if (!time) return '';
        const date = new Date(time);
        const now = new Date();
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const renderUser = ({ item }: { item: any }) => (
        <TouchableOpacity 
            style={styles.userItem} 
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item._id, name: item.name } })}
        >
            <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.name) }]}>
                <Text style={styles.avatarText}>{item.name[0].toUpperCase()}</Text>
            </View>
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.time}>{formatTime(item.lastMessageTime)}</Text>
                </View>
                <View style={styles.footer}>
                    <Text style={styles.lastMsg} numberOfLines={1}>
                        {item.lastMessage}
                    </Text>
                    {item.unreadCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{item.unreadCount}</Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );

    if (!user) {
        return (
            <View style={styles.centered}>
                <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
                    <Text style={styles.loginLink}>Please Login to Chat</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList 
                data={users}
                keyExtractor={(item) => item._id}
                renderItem={renderUser}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#075E54']} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No chats yet. Start a conversation!</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    userItem: { 
        flexDirection: 'row', 
        paddingHorizontal: 15, 
        paddingVertical: 12, 
        alignItems: 'center',
    },
    avatar: { 
        width: 55, 
        height: 55, 
        borderRadius: 27.5, 
        justifyContent: 'center', 
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    avatarText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
    content: { flex: 1, marginLeft: 15, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0', paddingBottom: 12 },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    userName: { fontSize: 17, fontWeight: '700', color: '#000', flex: 1 },
    time: { fontSize: 12, color: '#666' },
    footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    lastMsg: { fontSize: 14, color: '#666', flex: 1, marginRight: 10 },
    badge: { backgroundColor: '#25D366', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loginLink: { color: '#075E54', fontSize: 18, fontWeight: 'bold' },
    emptyContainer: { marginTop: 100, alignItems: 'center' },
    emptyText: { color: '#999', fontSize: 16 }
});
