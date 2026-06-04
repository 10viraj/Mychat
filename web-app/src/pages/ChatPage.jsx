// src/pages/ChatPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import { useTheme } from '../context/ThemeContext';

const AVATAR_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F06292', '#AED581', '#FFD54F'];

export default function ChatPage() {
    const { user, logout, setUser } = useAuth();
    const { theme, setTheme } = useTheme();
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(380);
    const [isUploading, setIsUploading] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [showNewChat, setShowNewChat] = useState(false);
    const [newChatSearch, setNewChatSearch] = useState('');
    const isResizing = useRef(false);
    const socket = useRef();
    const scrollRef = useRef();
    const fileInputRef = useRef();
    const profileInputRef = useRef();
    const emojiPickerRef = useRef();
    const attachMenuRef = useRef();
    const userMenuRef = useRef();

    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    useEffect(() => {
        if (user) {
            socket.current = io('http://localhost:5000');
            socket.current.emit('join', user.user.id);
            socket.current.on('receiveMessage', (msg) => {
                setMessages((prev) => [...prev, msg]);
                fetchUsers();
                if (msg.sender !== user.user.id) {
                    if (selectedUser && msg.sender === selectedUser._id) {
                        // User is currently viewing this chat, mark it as read!
                        axios.put(`http://localhost:5000/api/messages/read/${msg.sender}/${user.user.id}`).then(() => {
                            socket.current.emit('markAsRead', { senderId: msg.sender, receiverId: user.user.id });
                            fetchUsers();
                        }).catch(e => {});
                    } else {
                        new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3').play().catch(e => {});
                        if ('Notification' in window && Notification.permission === 'granted') {
                            const body = msg.messageType === 'text' ? msg.text : `Sent a ${msg.messageType}`;
                            new Notification('New Message', { body });
                        }
                    }
                }
            });
            socket.current.on('typing', (data) => {
                if (data.sender === selectedUser?._id) setIsOtherUserTyping(data.isTyping);
            });
            socket.current.on('messageStatusUpdate', (data) => {
                setMessages((prev) => prev.map(m => m._id === data.messageId ? { ...m, status: data.status } : m));
            });
            socket.current.on('messagesRead', (data) => {
                if (data.readerId === selectedUser?._id) {
                    setMessages((prev) => prev.map(m => m.sender === user.user.id ? { ...m, status: 'read' } : m));
                }
            });
            fetchUsers();
        }
        return () => socket.current?.disconnect();
    }, [user, selectedUser]);

    useEffect(() => { if (selectedUser) { fetchMessages(); markAsRead(); } }, [selectedUser]);
    useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) setShowEmojiPicker(false);
            if (attachMenuRef.current && !attachMenuRef.current.contains(event.target) && !event.target.closest('.attach-trigger')) setShowAttachMenu(false);
            if (userMenuRef.current && !userMenuRef.current.contains(event.target) && !event.target.closest('.menu-trigger')) setShowUserMenu(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMouseMove = useCallback((e) => {
        if (isResizing.current) {
            if (e.clientX > 250 && e.clientX < 550) setSidebarWidth(e.clientX);
        }
    }, []);

    const startResizing = useCallback(() => {
        isResizing.current = true;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', () => {
            isResizing.current = false;
            document.removeEventListener('mousemove', handleMouseMove);
        });
    }, [handleMouseMove]);

    const fetchUsers = async () => {
        const res = await axios.get(`http://localhost:5000/api/users?currentUserId=${user.user.id}`);
        setUsers(res.data);
    };

    const fetchMessages = async () => {
        const res = await axios.get(`http://localhost:5000/api/messages/${user.user.id}/${selectedUser._id}`);
        setMessages(res.data);
    };

    const markAsRead = async () => {
        try { 
            await axios.put(`http://localhost:5000/api/messages/read/${selectedUser._id}/${user.user.id}`); 
            socket.current.emit('markAsRead', { senderId: selectedUser._id, receiverId: user.user.id });
            fetchUsers(); 
        } catch (err) {}
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsUploading(true); setShowAttachMenu(false);
        const formData = new FormData(); formData.append('file', file);
        try {
            const res = await axios.post('http://localhost:5000/api/upload', formData);
            socket.current.emit('sendMessage', {
                sender: user.user.id, receiver: selectedUser._id,
                messageType: res.data.messageType, fileUrl: res.data.fileUrl, text: file.name
            });
        } catch (err) { alert("Upload failed"); }
        finally { setIsUploading(false); }
    };

    const handleProfilePicUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await axios.post('http://localhost:5000/api/upload', formData);
            const updateRes = await axios.post('http://localhost:5000/api/users/update-profile', {
                userId: user.user.id,
                profilePic: res.data.fileUrl
            });
            // Update local user state
            const newUser = { ...user, user: { ...user.user, profilePic: res.data.fileUrl } };
            setUser(newUser);
            sessionStorage.setItem('user', JSON.stringify(newUser));
            alert("Profile picture updated!");
        } catch (err) { alert("Update failed"); }
    };

    const handleSend = (e) => {
        e.preventDefault();
        if (text.trim() && selectedUser) {
            socket.current.emit('sendMessage', { sender: user.user.id, receiver: selectedUser._id, text: text.trim(), messageType: 'text' });
            setText(''); setShowEmojiPicker(false);
        }
    };

    const formatTime = (time) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="chat-container">
            <div className="sidebar" style={{ width: `${sidebarWidth}px` }}>
                {/* Profile Panel */}
                <div className={`profile-panel ${showProfile ? 'show' : ''}`}>
                    <div className="profile-header">
                        <button className="back-btn" onClick={() => setShowProfile(false)}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                        </button>
                        <span>Profile</span>
                    </div>
                    <div className="profile-content">
                        <div className="avatar-upload-container" onClick={() => profileInputRef.current.click()}>
                            {user.user.profilePic ? (
                                <img src={user.user.profilePic} alt="profile" className="profile-avatar-big" />
                            ) : (
                                <div className="profile-avatar-big" style={{ backgroundColor: AVATAR_COLORS[user.user.name.length % AVATAR_COLORS.length] }}>
                                    {user.user.name[0]}
                                </div>
                            )}
                            <div className="avatar-overlay">CHANGE PROFILE PHOTO</div>
                            <input type="file" ref={profileInputRef} style={{ display: 'none' }} onChange={handleProfilePicUpload} accept="image/*" />
                        </div>
                        <div className="profile-info-item">
                            <label>Your name</label>
                            <div className="info-val">{user.user.name}</div>
                            <small>This is not your username or pin. This name will be visible to your Mychat contacts.</small>
                        </div>
                        <div className="profile-info-item">
                            <label>About</label>
                            <div className="info-val">Available</div>
                        </div>
                        <div className="profile-info-item">
                            <label>Phone</label>
                            <div className="info-val">{user.user.phone}</div>
                        </div>
                    </div>
                </div>

                {/* New Chat Panel */}
                <div className={`profile-panel ${showNewChat ? 'show' : ''}`}>
                    <div className="profile-header">
                        <button className="back-btn" onClick={() => setShowNewChat(false)}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                        </button>
                        <span>New chat</span>
                    </div>
                    <div className="search-bar">
                        <div className="search-input-container">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#667781" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                            <input type="text" placeholder="Search contacts" value={newChatSearch} onChange={(e) => setNewChatSearch(e.target.value)} />
                        </div>
                    </div>
                    <div className="user-list">
                        {users.filter(u => u.name.toLowerCase().includes(newChatSearch.toLowerCase()) || (u.email && u.email.toLowerCase().includes(newChatSearch.toLowerCase()))).map(u => (
                            <div key={u._id} className="user-item" onClick={() => { setSelectedUser(u); setShowNewChat(false); setNewChatSearch(''); }}>
                                {u.profilePic ? (
                                    <img src={u.profilePic} alt="user" className="avatar" />
                                ) : (
                                    <div className="avatar" style={{ backgroundColor: AVATAR_COLORS[u.name.length % AVATAR_COLORS.length] }}>{u.name[0]}</div>
                                )}
                                <div className="user-info-web">
                                    <div className="user-header-web">
                                        <strong>{u.name}</strong>
                                    </div>
                                    <div className="user-footer-web">
                                        <small className="last-msg-web">{u.email}</small>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="sidebar-header">
                    <div className="my-profile" onClick={() => setShowProfile(true)} style={{cursor: 'pointer'}}>
                        {user.user.profilePic ? (
                            <img src={user.user.profilePic} alt="me" className="avatar" />
                        ) : (
                            <div className="avatar" style={{ backgroundColor: AVATAR_COLORS[user.user.name.length % AVATAR_COLORS.length] }}>{user.user.name[0]}</div>
                        )}
                    </div>
                    <div className="header-actions">
                        <button className="menu-trigger action-btn" onClick={() => setShowUserMenu(!showUserMenu)}>
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 4.001A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 4.001A2 2 0 0 0 12 15z"/></svg>
                        </button>
                        {showUserMenu && (
                            <div className="dropdown-menu" ref={userMenuRef}>
                                <div className="menu-item" onClick={() => { setShowUserMenu(false); setShowProfile(true); }}>Profile</div>
                                <div className="menu-separator"></div>
                                <div className="menu-item theme-item">
                                    <span>Theme</span>
                                    <select value={theme} onChange={(e) => setTheme(e.target.value)} onClick={(e) => e.stopPropagation()}>
                                        <option value="light">Light</option>
                                        <option value="dark">Dark</option>
                                        <option value="system">Default</option>
                                    </select>
                                </div>
                                <div className="menu-separator"></div>
                                <div className="menu-item" onClick={logout}>Logout</div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="search-bar">
                    <div className="search-input-container">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#667781" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                        <input type="text" placeholder="Search or start new chat" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                </div>
                <div className="user-list">
                    {users.filter(u => u.lastMessageTime && u.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#667781', fontSize: '14px' }}>
                            {users.length === 0 ? 'No contacts available' : 'No chats found'}
                        </div>
                    )}
                    {users.filter(u => u.lastMessageTime && u.name.toLowerCase().includes(searchQuery.toLowerCase())).map(u => (
                        <div key={u._id} className={`user-item ${selectedUser?._id === u._id ? 'active' : ''}`} onClick={() => setSelectedUser(u)}>
                            {u.profilePic ? (
                                <img src={u.profilePic} alt="user" className="avatar" />
                            ) : (
                                <div className="avatar" style={{ backgroundColor: AVATAR_COLORS[u.name.length % AVATAR_COLORS.length] }}>{u.name[0]}</div>
                            )}
                            <div className="user-info-web">
                                <div className="user-header-web">
                                    <strong>{u.name}</strong>
                                    <span className={`time-web ${u.unreadCount > 0 ? 'unread-time' : ''}`}>{u.lastMessageTime ? formatTime(u.lastMessageTime) : ''}</span>
                                </div>
                                <div className="user-footer-web"><small className="last-msg-web">{u.lastMessage}</small>
                                    {u.unreadCount > 0 && <div className="unread-badge-web">{u.unreadCount}</div>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <button className="new-chat-fab" onClick={() => setShowNewChat(true)}>
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                        <path d="M19.005 3.175H4.674C3.642 3.175 3 3.789 3 4.821V21.02l3.544-3.514h12.461c1.033 0 2.064-1.06 2.064-2.093V4.821c-.001-1.032-1.032-1.646-2.064-1.646zm-4.989 9.869H7.041V11.1h6.975v1.944zm3-4H7.041V7.1h9.975v1.944z"/>
                    </svg>
                </button>
            </div>
            <div className="resizer" onMouseDown={startResizing}></div>
            <div className="main-chat">
                {selectedUser ? (
                    <>
                        <div className="chat-header">
                            <div className="header-info">
                                {selectedUser.profilePic ? (
                                    <img src={selectedUser.profilePic} alt="user" className="avatar" />
                                ) : (
                                    <div className="avatar" style={{ backgroundColor: AVATAR_COLORS[selectedUser.name.length % AVATAR_COLORS.length] }}>{selectedUser.name[0]}</div>
                                )}
                                <div><h3>{selectedUser.name}</h3><p className="status">{isOtherUserTyping ? 'typing...' : 'online'}</p></div>
                            </div>
                        </div>
                        <div className="messages">
                            {messages.map((m, i) => (
                                <div key={i} className={`message ${m.sender === user.user.id ? 'my-msg' : 'their-msg'}`}>
                                    <div className="msg-bubble">
                                        {m.messageType === 'image' ? <img src={m.fileUrl} alt="sent" className="chat-img" /> :
                                         m.messageType === 'file' ? <a href={m.fileUrl} target="_blank" rel="noreferrer" className="file-link">📄 {m.text}</a> :
                                         <p>{m.text}</p>}
                                        <div className="msg-footer">
                                            <span className="time">{formatTime(m.createdAt)}</span>
                                            {m.sender === user.user.id && (
                                                <span className={`checks ${m.status === 'read' ? 'read' : ''}`}>
                                                    {m.status === 'sent' ? '✓' : '✓✓'}
                                                </span>
                                            )}
                                        </div>
                                    </div><div ref={scrollRef}></div>
                                </div>
                            ))}
                        </div>
                        <form className="chat-input" onSubmit={handleSend}>
                            <div className="input-actions">
                                <button type="button" className="action-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5s.67 1.5 1.5 1.5zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>
                                </button>
                                <button type="button" className="action-btn attach-trigger" onClick={() => setShowAttachMenu(!showAttachMenu)}>+</button>
                            </div>
                            {showEmojiPicker && <div className="emoji-container" ref={emojiPickerRef}><EmojiPicker onEmojiClick={(e) => setText(prev => prev + e.emoji)} /></div>}
                            {showAttachMenu && (
                                <div className="attach-menu" ref={attachMenuRef}>
                                    <div className="attach-item" onClick={() => fileInputRef.current.click()}><div className="attach-icon" style={{ backgroundColor: '#7f66ff' }}>📄</div><span>Document</span></div>
                                    <div className="attach-item" onClick={() => fileInputRef.current.click()}><div className="attach-icon" style={{ backgroundColor: '#007bfc' }}>🖼️</div><span>Photos & videos</span></div>
                                    <div className="attach-item" onClick={() => fileInputRef.current.click()}><div className="attach-icon" style={{ backgroundColor: '#ff2e74' }}>📷</div><span>Camera</span></div>
                                </div>
                            )}
                            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
                            <input type="text" placeholder="Type a message" value={text} onChange={(e) => setText(e.target.value)} onFocus={() => { setShowEmojiPicker(false); setShowAttachMenu(false); }} />
                            <button type="submit" style={{ display: 'none' }}></button>
                        </form>
                    </>
                ) : (
                    <div className="no-chat">
                        <div className="welcome-box">
                            <img src="https://static.whatsapp.net/rsrc.php/v3/y6/r/wa669ae5fa9.png" alt="welcome" width="250" />
                            <h2>Mychat Web</h2>
                            <p>Send and receive messages without keeping your phone online.<br/>Use Mychat on up to 4 linked devices and 1 phone at the same time.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
