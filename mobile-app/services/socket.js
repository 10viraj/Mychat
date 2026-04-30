// services/socket.js
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://192.168.1.4:5000'; // Your local IP

let socket;

export const initiateSocket = (userId) => {
    if (!socket || !socket.connected) {
        socket = io(SOCKET_URL, {
            transports: ['websocket'],
            forceNew: true
        });
        console.log("Socket Connected");
    }
    
    if (socket && userId) {
        socket.emit('join', userId);
    }
    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.off('receiveMessage');
        socket.off('typing');
        socket.off('messageStatusUpdate');
        socket.off('messagesRead');
        socket.disconnect();
        socket = null;
    }
};

export const subscribeToMessages = (cb) => {
    if (!socket) return;
    socket.off('receiveMessage'); // Remove old listener first
    socket.on('receiveMessage', (msg) => {
        cb(msg);
    });
};

export const emitTyping = (data) => {
    if (socket) socket.emit('typing', data);
};

export const subscribeToTyping = (cb) => {
    if (!socket) return;
    socket.off('typing'); // Remove old listener first
    socket.on('typing', (data) => {
        cb(data);
    });
};

export const sendMessage = (data) => {
    if (socket) socket.emit('sendMessage', data);
};

export const markMessagesAsRead = (senderId, receiverId) => {
    if (socket) socket.emit('markAsRead', { senderId, receiverId });
};

export const subscribeToStatusUpdates = (cb) => {
    if (!socket) return;
    socket.off('messageStatusUpdate');
    socket.on('messageStatusUpdate', (data) => cb(data));
};

export const subscribeToReadStatus = (cb) => {
    if (!socket) return;
    socket.off('messagesRead');
    socket.on('messagesRead', (data) => cb(data));
};

export default socket;
