// src/pages/ChatPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import { useTheme } from '../context/ThemeContext';
import CallManager from '../components/CallManager';

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
    const [showChatMenu, setShowChatMenu] = useState(false);
    const [showChatMoreMenu, setShowChatMoreMenu] = useState(false);
    const [showContactInfo, setShowContactInfo] = useState(false);
    const [showSearchPanel, setShowSearchPanel] = useState(false);
    const [chatSearchQuery, setChatSearchQuery] = useState('');
    const [contactInfoTab, setContactInfoTab] = useState('info');
    const [isBlocked, setIsBlocked] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showCalls, setShowCalls] = useState(false);
    const [callsList, setCallsList] = useState([]);
    const [showNewChat, setShowNewChat] = useState(false);
    const [chatWallpaper, setChatWallpaper] = useState(localStorage.getItem('chatWallpaper') || 'default');
    const [notificationsEnabled, setNotificationsEnabled] = useState(localStorage.getItem('notificationsEnabled') !== 'false');
    const [newChatSearch, setNewChatSearch] = useState('');
    const [showContactModal, setShowContactModal] = useState(false);
    const [showPollModal, setShowPollModal] = useState(false);
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState(['', '']);
    const [activeMessageMenu, setActiveMessageMenu] = useState(null);
    const [messageToDelete, setMessageToDelete] = useState(null);
    const isResizing = useRef(false);
    const socket = useRef();
    const scrollRef = useRef();
    const fileInputRef = useRef();
    const profileInputRef = useRef();
    const emojiPickerRef = useRef();
    const attachMenuRef = useRef();
    const userMenuRef = useRef();
    const chatMenuRef = useRef();
    const searchInputRef = useRef();
    const notificationsRef = useRef(notificationsEnabled);

    useEffect(() => {
        localStorage.setItem('chatWallpaper', chatWallpaper);
    }, [chatWallpaper]);

    useEffect(() => {
        localStorage.setItem('notificationsEnabled', notificationsEnabled);
        notificationsRef.current = notificationsEnabled;
    }, [notificationsEnabled]);

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
                        }).catch(e => { });
                    } else {
                        if (notificationsRef.current) {
                            new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3').play().catch(e => { });
                            if ('Notification' in window && Notification.permission === 'granted') {
                                const body = msg.messageType === 'text' ? msg.text : `Sent a ${msg.messageType}`;
                                new Notification('New Message', { body });
                            }
                        }
                    }
                }
            });
            socket.current.on('typing', (data) => {
                if (data.sender === selectedUser?._id) setIsOtherUserTyping(data.isTyping);
            });
            socket.current.on('pollUpdated', (updatedMessage) => {
                setMessages((prev) => prev.map(m => m._id === updatedMessage._id ? updatedMessage : m));
            });
            socket.current.on('messageStatusUpdate', (data) => {
                setMessages((prev) => prev.map(m => m._id === data.messageId ? { ...m, status: data.status } : m));
            });
            socket.current.on('messagesRead', (data) => {
                if (data.readerId === selectedUser?._id) {
                    setMessages((prev) => prev.map(m => m.sender === user.user.id ? { ...m, status: 'read' } : m));
                }
            });
            socket.current.on('messageDeleted', (data) => {
                if (data.type === 'everyone') {
                    setMessages((prev) => prev.filter(m => m._id !== data.messageId));
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
            if (chatMenuRef.current && !chatMenuRef.current.contains(event.target) && !event.target.closest('.chat-menu-trigger')) {
                setShowChatMenu(false);
                setShowChatMoreMenu(false);
            }
            if (!event.target.closest('.msg-dropdown-arrow') && !event.target.closest('.msg-options-menu')) {
                setActiveMessageMenu(null);
            }
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

    const fetchCalls = async () => {
        try {
            const res = await axios.get(`http://localhost:5000/api/calls/${user.user.id}`);
            setCallsList(res.data);
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        if (showCalls) fetchCalls();
    }, [showCalls]);

    const fetchMessages = async () => {
        const res = await axios.get(`http://localhost:5000/api/messages/${user.user.id}/${selectedUser._id}`);
        setMessages(res.data);
    };

    const markAsRead = async () => {
        try {
            await axios.put(`http://localhost:5000/api/messages/read/${selectedUser._id}/${user.user.id}`);
            socket.current.emit('markAsRead', { senderId: selectedUser._id, receiverId: user.user.id });
            fetchUsers();
        } catch (err) { }
    };

    useEffect(() => {
        if (showSearchPanel) setTimeout(() => searchInputRef.current?.focus(), 100);
        else setChatSearchQuery('');
    }, [showSearchPanel]);

    const exportChat = () => {
        if (!messages || messages.length === 0) { alert('No messages to export'); return; }
        let chatText = `Chat with ${selectedUser.name}\n\n`;
        messages.forEach(m => {
            const time = new Date(m.createdAt).toLocaleString();
            const senderName = m.sender === user.user.id ? 'You' : selectedUser.name;
            let content = m.text;
            if (m.messageType === 'image') content = '[Image Attached]';
            if (m.messageType === 'file') content = '[File Attached]';
            chatText += `[${time}] ${senderName}: ${content}\n`;
        });
        const blob = new Blob([chatText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `WhatsApp_Chat_${selectedUser.name}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    useEffect(() => {
        if (selectedUser && user?.user?.blockedUsers) {
            setIsBlocked(user.user.blockedUsers.includes(selectedUser._id));
        } else {
            setIsBlocked(false);
        }
    }, [selectedUser, user]);

    const handleBlock = async () => {
        try {
            const res = await axios.put(`http://localhost:5000/api/users/block/${selectedUser._id}`, { currentUserId: user.user.id });
            const updatedUser = { ...user, user: { ...user.user, blockedUsers: res.data.blockedUsers } };
            setUser(updatedUser);
            sessionStorage.setItem('user', JSON.stringify(updatedUser));
            setIsBlocked(res.data.blockedUsers.includes(selectedUser._id));
            setShowChatMenu(false);
        } catch (err) { alert("Failed to block/unblock: " + (err.response?.data?.message || err.message)); }
    };

    const handleReport = async () => {
        try {
            await axios.post(`http://localhost:5000/api/users/report/${selectedUser._id}`, { currentUserId: user.user.id });
            setShowChatMenu(false);
            alert("User reported");
        } catch (err) { alert("Failed to report: " + (err.response?.data?.message || err.message)); }
    };

    const handleClearChat = async () => {
        if (!window.confirm("Are you sure you want to clear this chat? This action cannot be undone.")) return;
        try {
            await axios.delete(`http://localhost:5000/api/messages/clear/${user.user.id}/${selectedUser._id}`);
            setMessages([]);
            setShowChatMenu(false);
        } catch (err) { alert("Failed to clear chat: " + (err.response?.data?.message || err.message)); }
    };

    const handleAddShortcut = () => {
        alert("To add a shortcut, tap your browser menu and select 'Add to Home screen' or 'Create Shortcut'");
        setShowChatMenu(false);
    };

    const handleSendLocation = () => {
        setShowAttachMenu(false);
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }
        navigator.geolocation.getCurrentPosition((position) => {
            const newMsg = {
                sender: user.user.id,
                receiver: selectedUser._id,
                messageType: 'location',
                locationData: {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                }
            };
            socket.current.emit('sendMessage', newMsg);
        }, () => {
            alert('Unable to retrieve your location');
        });
    };

    const handleSendContact = (contact) => {
        const newMsg = {
            sender: user.user.id,
            receiver: selectedUser._id,
            messageType: 'contact',
            contactData: {
                name: contact.name,
                email: contact.email,
                profilePic: contact.profilePic
            }
        };
        socket.current.emit('sendMessage', newMsg);
        setShowContactModal(false);
    };

    const handleSendPoll = () => {
        if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) {
            alert('Please enter a question and at least two options.');
            return;
        }
        const newMsg = {
            sender: user.user.id,
            receiver: selectedUser._id,
            messageType: 'poll',
            pollData: {
                question: pollQuestion,
                options: pollOptions.filter(o => o.trim()).map(o => ({ option: o, votes: [] }))
            }
        };
        socket.current.emit('sendMessage', newMsg);
        setShowPollModal(false);
        setPollQuestion('');
        setPollOptions(['', '']);
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
            <CallManager user={user} socket={socket.current} selectedUser={selectedUser} />
            <div className="sidebar" style={{ width: `${sidebarWidth}px` }}>
                {/* Profile Panel */}
                <div className={`profile-panel ${showProfile ? 'show' : ''}`}>
                    <div className="profile-header">
                        <button className="back-btn" onClick={() => setShowProfile(false)}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
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
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
                        </button>
                        <span>New chat</span>
                    </div>
                    <div className="search-bar">
                        <div className="search-input-container">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#667781" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
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

                {/* Settings Panel */}
                <div className={`profile-panel ${showSettings ? 'show' : ''}`}>
                    <div className="profile-header">
                        <button className="back-btn" onClick={() => setShowSettings(false)}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
                        </button>
                        <span>Settings</span>
                    </div>
                    <div className="profile-content settings-content">
                        <div className="profile-info-item setting-item">
                            <label>Theme</label>
                            <select className="settings-select" value={theme} onChange={(e) => setTheme(e.target.value)}>
                                <option value="light">Light</option>
                                <option value="dark">Dark</option>
                                <option value="system">Default</option>
                            </select>
                        </div>
                        <div className="profile-info-item setting-item">
                            <label>Chat Wallpaper</label>
                            <div className="wallpaper-options">
                                <div className={`wallpaper-opt ${chatWallpaper === 'default' ? 'selected' : ''}`} onClick={() => setChatWallpaper('default')}>Default</div>
                                <div className={`wallpaper-opt ${chatWallpaper === 'dark' ? 'selected' : ''}`} onClick={() => setChatWallpaper('dark')} style={{ background: '#0b141a', color: 'white' }}>Dark</div>
                                <div className={`wallpaper-opt ${chatWallpaper === 'light' ? 'selected' : ''}`} onClick={() => setChatWallpaper('light')} style={{ background: '#efeae2', color: 'black' }}>Light</div>
                                <div className={`wallpaper-opt ${chatWallpaper === 'doodle' ? 'selected' : ''}`} onClick={() => setChatWallpaper('doodle')} style={{ backgroundImage: 'url(https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png)' }}>Doodle</div>
                            </div>
                        </div>
                        <div className="profile-info-item setting-item">
                            <label>Notifications</label>
                            <div className="toggle-switch-container">
                                <span>Desktop Alerts & Sounds</span>
                                <label className="toggle-switch">
                                    <input type="checkbox" checked={notificationsEnabled} onChange={(e) => setNotificationsEnabled(e.target.checked)} />
                                    <span className="slider round"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Calls Panel */}
                <div className={`profile-panel ${showCalls ? 'show' : ''}`}>
                    <div className="profile-header">
                        <button className="back-btn" onClick={() => setShowCalls(false)}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
                        </button>
                        <span>Call Logs</span>
                    </div>
                    <div className="user-list">
                        {callsList.length === 0 && (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#667781', fontSize: '14px' }}>No calls yet</div>
                        )}
                        {callsList.map(c => {
                            const isIncoming = c.receiver._id === user.user.id;
                            const otherUser = isIncoming ? c.caller : c.receiver;
                            if (!otherUser) return null;
                            const isMissed = c.status === 'missed';
                            return (
                                <div key={c._id} className="user-item" onClick={() => { setSelectedUser(otherUser); setShowCalls(false); }}>
                                    {otherUser.profilePic ? (
                                        <img src={otherUser.profilePic} alt="user" className="avatar" />
                                    ) : (
                                        <div className="avatar" style={{ backgroundColor: AVATAR_COLORS[otherUser.name?.length % AVATAR_COLORS.length || 0] }}>{otherUser.name?.[0]}</div>
                                    )}
                                    <div className="user-info-web">
                                        <div className="user-header-web">
                                            <strong style={{ color: isMissed && isIncoming ? '#ea0038' : 'var(--wa-text-primary)' }}>
                                                {otherUser.name}
                                            </strong>
                                            <span className="time-web">{new Date(c.startTime).toLocaleDateString()}</span>
                                        </div>
                                        <div className="user-footer-web">
                                            <small className="last-msg-web" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{ color: isIncoming ? (isMissed ? '#ea0038' : '#00a884') : '#667781' }}>
                                                    {isIncoming ? '↙' : '↗'}
                                                </span>
                                                {c.callType === 'video' ? '📹 Video' : '📞 Voice'}
                                            </small>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="sidebar-header">
                    <div className="my-profile" onClick={() => setShowProfile(true)} style={{ cursor: 'pointer' }}>
                        {user.user.profilePic ? (
                            <img src={user.user.profilePic} alt="me" className="avatar" />
                        ) : (
                            <div className="avatar" style={{ backgroundColor: AVATAR_COLORS[user.user.name.length % AVATAR_COLORS.length] }}>{user.user.name[0]}</div>
                        )}
                    </div>
                    <div className="header-actions">
                        <button className="menu-trigger action-btn" onClick={() => setShowUserMenu(!showUserMenu)}>
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 4.001A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 4.001A2 2 0 0 0 12 15z" /></svg>
                        </button>
                        {showUserMenu && (
                            <div className="dropdown-menu" ref={userMenuRef}>
                                <div className="menu-item" onClick={() => { setShowUserMenu(false); setShowProfile(true); }}>Profile</div>
                                <div className="menu-item" onClick={() => { setShowUserMenu(false); setShowSettings(true); }}>Settings</div>
                                <div className="menu-item" onClick={() => { setShowUserMenu(false); setShowCalls(true); }}>Call Logs</div>
                                <div className="menu-separator"></div>
                                <div className="menu-item" onClick={logout}>Logout</div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="search-bar">
                    <div className="search-input-container">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#667781" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                        <input type="text" placeholder="Search or start new chat" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                </div>
                <div className="user-list">
                    {users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#667781', fontSize: '14px' }}>
                            {users.length === 0 ? 'No contacts available' : 'No chats found'}
                        </div>
                    )}
                    {users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())).map(u => (
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
                        <path d="M19.005 3.175H4.674C3.642 3.175 3 3.789 3 4.821V21.02l3.544-3.514h12.461c1.033 0 2.064-1.06 2.064-2.093V4.821c-.001-1.032-1.032-1.646-2.064-1.646zm-4.989 9.869H7.041V11.1h6.975v1.944zm3-4H7.041V7.1h9.975v1.944z" />
                    </svg>
                </button>
            </div>
            <div className="resizer" onMouseDown={startResizing}></div>
            <div className="main-chat" style={
                chatWallpaper === 'dark' ? { background: '#0b141a', backgroundImage: 'none' } :
                    chatWallpaper === 'light' ? { background: '#efeae2', backgroundImage: 'none' } :
                        chatWallpaper === 'doodle' ? { background: '#efeae2', backgroundImage: 'url(https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png)' } :
                            {}
            }>
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
                            <div className="header-actions" style={{ position: 'relative' }}>
                                <button className="action-btn" onClick={() => window.dispatchEvent(new CustomEvent('start-call', { detail: { type: 'video' } }))}>
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" /></svg>
                                </button>
                                <button className="action-btn" onClick={() => window.dispatchEvent(new CustomEvent('start-call', { detail: { type: 'voice' } }))}>
                                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
                                </button>
                                <button className="action-btn chat-menu-trigger" onClick={() => { setShowChatMenu(!showChatMenu); setShowChatMoreMenu(false); }}>
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 15z" /></svg>
                                </button>
                                {showChatMenu && (
                                    <div className="dropdown-menu" ref={chatMenuRef} style={{ top: '100%', right: '10px', minWidth: '180px' }}>
                                        {!showChatMoreMenu ? (
                                            <>
                                                <div className="menu-item" onClick={() => { setShowContactInfo(true); setShowSearchPanel(false); setContactInfoTab('info'); setShowChatMenu(false); }}>View contact</div>
                                                <div className="menu-item" onClick={() => { setShowSearchPanel(true); setShowContactInfo(false); setShowChatMenu(false); }}>Search</div>
                                                <div className="menu-item" onClick={() => { setShowContactInfo(true); setShowSearchPanel(false); setContactInfoTab('media'); setShowChatMenu(false); }}>Media, links, and docs</div>
                                                <div className="menu-item" onClick={() => { setShowSettings(true); setShowChatMenu(false); }}>Chat theme</div>
                                                <div className="menu-separator"></div>
                                                <div className="menu-item" onClick={(e) => { e.stopPropagation(); setShowChatMoreMenu(true); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    More <span>▶</span>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="menu-item" onClick={(e) => { e.stopPropagation(); setShowChatMoreMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span>◀</span> Back
                                                </div>
                                                <div className="menu-separator"></div>
                                                <div className="menu-item" onClick={(e) => { e.stopPropagation(); handleReport(); }}>Report</div>
                                                <div className="menu-item" onClick={(e) => { e.stopPropagation(); handleBlock(); }}>{isBlocked ? 'Unblock' : 'Block'}</div>
                                                <div className="menu-item" onClick={(e) => { e.stopPropagation(); handleClearChat(); }}>Clear chat</div>
                                                <div className="menu-item" onClick={(e) => { e.stopPropagation(); exportChat(); setShowChatMenu(false); }}>Export chat</div>
                                                <div className="menu-item" onClick={(e) => { e.stopPropagation(); handleAddShortcut(); }}>Add shortcut</div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="messages">
                            {messages.filter(m => chatSearchQuery ? m.text?.toLowerCase().includes(chatSearchQuery.toLowerCase()) : true).map((m, i) => (
                                <div key={i} className={`message ${m.sender === user.user.id ? 'my-msg' : 'their-msg'} ${m.messageType === 'image' ? 'image-message' : ''}`}>
                                    <div className={`msg-bubble ${m.messageType === 'image' ? 'image-bubble' : ''}`}>
                                        <div className="msg-dropdown-arrow" onClick={(e) => { e.stopPropagation(); setActiveMessageMenu(activeMessageMenu === (m._id || i) ? null : (m._id || i)); }}>
                                            <svg viewBox="0 0 19 20" width="19" height="20" fill="currentColor"><path d="M3.8 6.7l5.7 5.7 5.7-5.7 1.6 1.6-7.3 7.2-7.3-7.2 1.6-1.6z"></path></svg>
                                        </div>
                                        {activeMessageMenu === (m._id || i) && (
                                            <div className="msg-options-menu dropdown-menu" style={{ top: '25px', right: '10px', minWidth: '160px', zIndex: 1000 }}>
                                                <div className="menu-item" onClick={(e) => { e.stopPropagation(); setActiveMessageMenu(null); alert(`Deliver Time: ${new Date(m.createdAt).toLocaleString()}\nStatus: ${m.status}`); }}>Message Info</div>
                                                <div className="menu-item" onClick={(e) => { e.stopPropagation(); setActiveMessageMenu(null); alert('Reply'); }}>Reply</div>
                                                <div className="menu-item" onClick={(e) => { e.stopPropagation(); setActiveMessageMenu(null); if (m.text) { navigator.clipboard.writeText(m.text); alert('Copied!'); } }}>Copy</div>
                                                {m.messageType === 'image' && (
                                                    <div className="menu-item" onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveMessageMenu(null);
                                                        fetch(m.fileUrl)
                                                            .then(response => response.blob())
                                                            .then(blob => {
                                                                const url = window.URL.createObjectURL(blob);
                                                                const a = document.createElement('a');
                                                                a.style.display = 'none';
                                                                a.href = url;
                                                                a.download = m.text || 'downloaded_image.jpg';
                                                                document.body.appendChild(a);
                                                                a.click();
                                                                window.URL.revokeObjectURL(url);
                                                                document.body.removeChild(a);
                                                            })
                                                            .catch(() => alert('Failed to download image'));
                                                    }}>Download</div>
                                                )}
                                                <div className="menu-item" onClick={(e) => { e.stopPropagation(); setActiveMessageMenu(null); alert('React'); }}>React</div>
                                                <div className="menu-item" onClick={(e) => { e.stopPropagation(); setActiveMessageMenu(null); alert('Pin'); }}>Pin</div>
                                                <div className="menu-item" onClick={(e) => { e.stopPropagation(); setActiveMessageMenu(null); setMessageToDelete(m); }}>Delete</div>
                                            </div>
                                        )}
                                        {m.messageType === 'image' ? <img src={m.fileUrl} alt="sent" className="chat-img" /> :
                                            m.messageType === 'file' ? <a href={m.fileUrl} target="_blank" rel="noreferrer" className="file-link">📄 {m.text}</a> :
                                                m.messageType === 'contact' ? (
                                                    <div className="contact-msg-card" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--wa-input-bg)', padding: '10px', borderRadius: '5px' }}>
                                                        {m.contactData?.profilePic ? <img src={m.contactData.profilePic} style={{ width: '40px', height: '40px', borderRadius: '50%' }} /> : <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '18px' }}>{m.contactData?.name[0]}</div>}
                                                        <div style={{ flex: 1 }}><strong>{m.contactData?.name}</strong></div>
                                                        <button style={{ background: 'var(--wa-green)', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }}>Message</button>
                                                    </div>
                                                ) :
                                                    m.messageType === 'location' ? (
                                                        <a href={`https://maps.google.com/maps?q=${m.locationData?.lat},${m.locationData?.lng}&z=15`} target="_blank" rel="noreferrer" style={{ display: 'block', background: 'var(--wa-input-bg)', padding: '10px', borderRadius: '5px', textDecoration: 'none', color: 'var(--wa-text-primary)' }}>
                                                            <div style={{ width: '100%', height: '100px', background: 'var(--wa-bg)', borderRadius: '5px', marginBottom: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--wa-text-secondary)', border: '1px solid var(--wa-border)' }}>🗺️ View Map</div>
                                                            <div>Location Shared📍</div>
                                                        </a>
                                                    ) :
                                                        m.messageType === 'poll' ? (
                                                            <div className="poll-msg-card" style={{ background: 'var(--wa-input-bg)', padding: '15px', borderRadius: '5px', minWidth: '260px' }}>
                                                                <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '15px' }}>📊 {m.pollData?.question}</div>
                                                                {m.pollData?.options.map((opt, optIdx) => {
                                                                    const totalVotes = m.pollData.options.reduce((sum, o) => sum + o.votes.length, 0);
                                                                    const percent = totalVotes === 0 ? 0 : Math.round((opt.votes.length / totalVotes) * 100);
                                                                    const hasVoted = opt.votes.includes(user.user.id);
                                                                    return (
                                                                        <div key={optIdx} onClick={() => {
                                                                            socket.current.emit('votePoll', { messageId: m._id, optionIndex: optIdx, userId: user.user.id });
                                                                        }} style={{ position: 'relative', background: 'var(--wa-bg)', borderRadius: '4px', padding: '10px', marginBottom: '8px', cursor: 'pointer', overflow: 'hidden' }}>
                                                                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${percent}%`, background: 'rgba(0,168,132,0.3)', transition: 'width 0.3s' }} />
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1, alignItems: 'center' }}>
                                                                                <span>{hasVoted ? '☑ ' : '☐ '}{opt.option}</span>
                                                                                {opt.votes.length > 0 && (
                                                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                                        {opt.votes.slice(0, 3).map((voterId, i) => {
                                                                                            const pic = voterId === user.user.id ? user.user.profilePic : users.find(u => u._id === voterId)?.profilePic;
                                                                                            return (
                                                                                                <div key={i} style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--wa-bg)', marginLeft: i > 0 ? '-8px' : '0', border: '1.5px solid var(--wa-input-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', zIndex: 3 - i }}>
                                                                                                    {pic ? <img src={pic} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <svg viewBox="0 0 24 24" width="14" height="14" fill="var(--wa-text-secondary)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" /></svg>}
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                        <span style={{ fontSize: '15px', color: 'var(--wa-text-primary)', marginLeft: '8px' }}>
                                                                                            {opt.votes.length}
                                                                                        </span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })}
                                                                <div style={{ fontSize: '12px', color: 'var(--wa-text-secondary)', marginTop: '10px', textAlign: 'right' }}>
                                                                    {m.pollData?.options.reduce((sum, o) => sum + o.votes.length, 0)} votes
                                                                </div>
                                                            </div>
                                                        ) :
                                                            <p>{m.text}</p>}
                                        <div className="msg-footer">
                                            <span className="time">{formatTime(m.createdAt)}</span>
                                            {m.sender === user.user.id && (
                                                <span className={`checks ${m.status === 'read' ? 'read' : ''}`}>
                                                    {m.status === 'sent' ? (
                                                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 12 9 16 18 7" /></svg>
                                                    ) : (
                                                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="2 12 6 16 15 7" />
                                                            <polyline points="10 12 14 16 23 7" />
                                                        </svg>
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </div><div ref={scrollRef}></div>
                                </div>
                            ))}
                        </div>
                        {isBlocked ? (
                            <div style={{ textAlign: 'center', padding: '15px', background: 'var(--wa-header)', color: 'var(--wa-text-secondary)' }}>
                                You have blocked this contact. Tap to unblock.
                            </div>
                        ) : (
                            <form className="chat-input" onSubmit={handleSend}>
                                <div className="input-actions">
                                    <button type="button" className="action-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5s.67 1.5 1.5 1.5zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" /></svg>
                                    </button>
                                    <button type="button" className="action-btn attach-trigger" onClick={() => setShowAttachMenu(!showAttachMenu)}>
                                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M11 11V6h2v5h5v2h-5v5h-2v-5H6v-2h5z" /></svg>
                                    </button>
                                </div>
                                {showEmojiPicker && <div className="emoji-container" ref={emojiPickerRef}><EmojiPicker onEmojiClick={(e) => setText(prev => prev + e.emoji)} /></div>}
                                {showAttachMenu && (
                                    <div className="attach-menu" ref={attachMenuRef}>
                                        <div className="attach-item" onClick={() => fileInputRef.current.click()}><div className="attach-icon" style={{ backgroundColor: '#7f66ff' }}>📄</div><span>Document</span></div>
                                        <div className="attach-item" onClick={() => fileInputRef.current.click()}><div className="attach-icon" style={{ backgroundColor: '#007bfc' }}>🖼️</div><span>Photos & videos</span></div>
                                        <div className="attach-item" onClick={() => fileInputRef.current.click()}><div className="attach-icon" style={{ backgroundColor: '#ff2e74' }}>📷</div><span>Camera</span></div>
                                        <div className="attach-item" onClick={() => { setShowContactModal(true); setShowAttachMenu(false); }}><div className="attach-icon" style={{ backgroundColor: '#009de2' }}>👤</div><span>Contact</span></div>
                                        <div className="attach-item" onClick={() => { setShowPollModal(true); setShowAttachMenu(false); }}><div className="attach-icon" style={{ backgroundColor: '#ffbc38' }}>📊</div><span>Poll</span></div>
                                        <div className="attach-item" onClick={handleSendLocation}><div className="attach-icon" style={{ backgroundColor: '#00a884' }}>📍</div><span>Location</span></div>
                                    </div>
                                )}
                                <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
                                <input type="text" placeholder="Type a message" value={text} onChange={(e) => setText(e.target.value)} onFocus={() => { setShowEmojiPicker(false); setShowAttachMenu(false); }} />
                                <button type="submit" style={{ display: 'none' }}></button>
                            </form>
                        )}
                    </>
                ) : (
                    <div className="no-chat">
                        <div className="welcome-box">
                            <img src="https://static.whatsapp.net/rsrc.php/v3/y6/r/wa669ae5fa9.png" alt="welcome" width="250" />
                            <h2>Mychat Web</h2>
                            <p>Send and receive messages without keeping your phone online.<br />Use Mychat on up to 4 linked devices and 1 phone at the same time.</p>
                        </div>
                    </div>
                )}
            </div>
            {(showSearchPanel || showContactInfo) && selectedUser && (
                <div className="right-sidebar">
                    <div className="right-sidebar-header">
                        <button onClick={() => { setShowSearchPanel(false); setShowContactInfo(false); }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" /></svg>
                        </button>
                        <span>{showSearchPanel ? 'Search messages' : (contactInfoTab === 'media' ? 'Media, links and docs' : 'Contact info')}</span>
                    </div>
                    <div className="right-sidebar-content">
                        {showSearchPanel && (
                            <div className="search-bar" style={{ padding: '10px 20px', borderBottom: '1px solid var(--wa-border)' }}>
                                <div className="search-input-container">
                                    <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--wa-text-secondary)"><path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 0 0 1.256-3.386 5.207 5.207 0 1 0-5.207 5.208 5.183 5.183 0 0 0 3.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.007zm-4.608 0a3.606 3.606 0 1 1 0-7.212 3.606 3.606 0 0 1 0 7.212z" /></svg>
                                    <input type="text" placeholder="Search..." value={chatSearchQuery} onChange={(e) => setChatSearchQuery(e.target.value)} ref={searchInputRef} />
                                </div>
                            </div>
                        )}
                        {showContactInfo && (
                            <div className="contact-info-panel">
                                {contactInfoTab === 'info' && (
                                    <>
                                        <div className="contact-info-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px', background: 'var(--wa-sidebar)', marginBottom: '10px' }}>
                                            {selectedUser.profilePic ? (
                                                <img src={selectedUser.profilePic} alt="user" className="profile-avatar-big" style={{ width: '200px', height: '200px' }} />
                                            ) : (
                                                <div className="profile-avatar-big" style={{ width: '200px', height: '200px', backgroundColor: AVATAR_COLORS[selectedUser.name.length % AVATAR_COLORS.length] }}>{selectedUser.name[0]}</div>
                                            )}
                                            <h2 style={{ marginTop: '20px', fontSize: '24px', color: 'var(--wa-text-primary)' }}>{selectedUser.name}</h2>
                                        </div>
                                        <div className="contact-info-section" style={{ background: 'var(--wa-sidebar)', padding: '20px 30px', marginBottom: '10px', textAlign: 'left' }}>
                                            <span style={{ color: 'var(--wa-text-secondary)', fontSize: '14px', fontWeight: '500' }}>About and phone number</span>
                                            <div style={{ marginTop: '10px', fontSize: '16px', color: 'var(--wa-text-primary)' }}>Available</div>
                                        </div>
                                    </>
                                )}
                                {(contactInfoTab === 'media' || contactInfoTab === 'info') && (
                                    <div className="contact-info-section" style={{ background: 'var(--wa-sidebar)', padding: '20px 30px', cursor: contactInfoTab === 'info' ? 'pointer' : 'default', textAlign: 'left' }} onClick={() => { if (contactInfoTab === 'info') setContactInfoTab('media'); }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--wa-text-secondary)', fontSize: '14px', fontWeight: '500' }}>
                                            <span>Media, links and docs</span>
                                            {contactInfoTab === 'info' && <span>▶</span>}
                                        </div>
                                        <div className="media-grid" style={{ display: 'flex', gap: '8px', marginTop: '15px', flexWrap: 'wrap' }}>
                                            {messages.filter(m => m.messageType === 'image' || m.messageType === 'file').length === 0 && <span style={{ fontSize: '14px', color: 'var(--wa-text-secondary)' }}>No media in this chat</span>}
                                            {messages.filter(m => m.messageType === 'image' || m.messageType === 'file').map((m, i) => (
                                                m.messageType === 'image' ? <img key={i} src={m.fileUrl} style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '4px' }} /> : <a key={i} href={m.fileUrl} target="_blank" rel="noreferrer" style={{ width: '90px', height: '90px', background: 'var(--wa-input-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--wa-green)', textDecoration: 'none', borderRadius: '4px' }}>📄 File</a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showContactModal && (
                <div className="modal-overlay" onClick={() => setShowContactModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(11,20,26,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--wa-sidebar)', borderRadius: '8px', width: '400px', overflow: 'hidden' }}>
                        <div style={{ padding: '20px', background: 'var(--wa-header)', color: 'var(--wa-text-primary)', fontWeight: 'bold', fontSize: '18px' }}>Send Contact</div>
                        <div className="user-list" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                            {users.filter(u => u._id !== selectedUser._id && u._id !== user.user.id).map(u => (
                                <div key={u._id} className="user-item" onClick={() => handleSendContact(u)}>
                                    {u.profilePic ? <img src={u.profilePic} className="avatar" /> : <div className="avatar" style={{ backgroundColor: '#00a884' }}>{u.name[0]}</div>}
                                    <div className="user-info-web"><strong>{u.name}</strong></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showPollModal && (
                <div className="modal-overlay" onClick={() => setShowPollModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(11,20,26,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '20px', background: 'var(--wa-sidebar)', borderRadius: '8px', width: '400px' }}>
                        <h3 style={{ marginBottom: '20px', color: 'var(--wa-text-primary)' }}>Create Poll</h3>
                        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--wa-text-secondary)', fontSize: '15px', marginBottom: '15px' }}>
                            <svg viewBox="0 0 24 24" width="18" height="18" style={{ marginRight: '8px' }}>
                                <circle cx="12" cy="12" r="10" fill="#8696a0" />
                                <path d="M10.5 15.5l-3.5-3.5 1.5-1.5 2 2 5-5 1.5 1.5-6.5 6.5z" fill="var(--wa-sidebar)" />
                            </svg>
                            Select one
                        </div>
                        <input type="text" placeholder="Ask a question" value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '20px', background: 'var(--wa-input-bg)', color: 'var(--wa-text-primary)', border: 'none', borderRadius: '5px', fontSize: '15px' }} />
                        <div className="poll-options">
                            {pollOptions.map((opt, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', gap: '10px' }}>
                                    <input type="text" placeholder={`Option ${idx + 1}`} value={opt} onChange={e => {
                                        const newOpts = [...pollOptions];
                                        newOpts[idx] = e.target.value;
                                        setPollOptions(newOpts);
                                    }} style={{ flex: 1, padding: '10px', background: 'var(--wa-input-bg)', color: 'var(--wa-text-primary)', border: 'none', borderRadius: '5px', fontSize: '15px' }} />
                                    {pollOptions.length > 2 && (
                                        <button onClick={() => {
                                            const newOpts = [...pollOptions];
                                            newOpts.splice(idx, 1);
                                            setPollOptions(newOpts);
                                        }} style={{ background: 'none', border: 'none', color: 'var(--wa-text-secondary)', cursor: 'pointer', padding: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button onClick={() => setPollOptions([...pollOptions, ''])} style={{ background: 'none', border: 'none', color: 'var(--wa-green)', cursor: 'pointer', marginBottom: '20px', fontWeight: 'bold' }}>+ Add option</button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
                            <button onClick={() => setShowPollModal(false)} style={{ padding: '10px 20px', background: 'transparent', color: 'var(--wa-text-primary)', border: 'none', cursor: 'pointer', borderRadius: '5px' }}>Cancel</button>
                            <button onClick={handleSendPoll} style={{ padding: '10px 20px', background: 'var(--wa-green)', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Send</button>
                        </div>
                    </div>
                </div>
            )}

            {messageToDelete && (
                <div className="modal-overlay" onClick={() => setMessageToDelete(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(11,20,26,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '20px', background: 'var(--wa-sidebar)', borderRadius: '8px', width: '380px' }}>
                        <h3 style={{ marginBottom: '20px', color: 'var(--wa-text-primary)', fontWeight: 'normal', fontSize: '20px' }}>Delete message?</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '15px', marginTop: '20px' }}>
                            {messageToDelete.sender === user.user.id && (
                                <button onClick={async () => {
                                    try {
                                        await axios.delete(`http://localhost:5000/api/messages/${messageToDelete._id}`);
                                        if (socket.current) {
                                            const receiverId = messageToDelete.sender === user.user.id ? messageToDelete.receiver : messageToDelete.sender;
                                            socket.current.emit('messageDeleted', { messageId: messageToDelete._id, type: 'everyone', receiverId });
                                        }
                                        setMessages(prev => prev.filter(msg => msg._id !== messageToDelete._id));
                                        setMessageToDelete(null);
                                    } catch (e) { alert("Failed to delete message"); }
                                }} style={{ padding: '10px', background: 'transparent', color: 'var(--wa-green)', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', transition: 'opacity 0.2s' }} onMouseOver={(e) => e.target.style.opacity = 0.8} onMouseOut={(e) => e.target.style.opacity = 1}>Delete for everyone</button>
                            )}
                            <button onClick={() => {
                                setMessages(prev => prev.filter(msg => msg._id !== messageToDelete._id));
                                setMessageToDelete(null);
                            }} style={{ padding: '10px', background: 'transparent', color: 'var(--wa-green)', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', transition: 'opacity 0.2s' }} onMouseOver={(e) => e.target.style.opacity = 0.8} onMouseOut={(e) => e.target.style.opacity = 1}>Delete for me</button>
                            <button onClick={() => setMessageToDelete(null)} style={{ padding: '10px', background: 'transparent', color: 'var(--wa-green)', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', transition: 'opacity 0.2s' }} onMouseOver={(e) => e.target.style.opacity = 0.8} onMouseOut={(e) => e.target.style.opacity = 1}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
