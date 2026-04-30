// services/api.js
import axios from 'axios';

const API_URL = 'http://192.168.1.4:5000/api'; // Updated to your local IP

export const registerUser = (data) => axios.post(`${API_URL}/auth/register`, data);
export const loginUser = (data) => axios.post(`${API_URL}/auth/login`, data);
export const getUsers = (currentUserId) => axios.get(`${API_URL}/users?currentUserId=${currentUserId}`);
export const getMessages = (u1, u2) => axios.get(`${API_URL}/messages/${u1}/${u2}`);
export const markMessagesAsRead = (senderId, receiverId) => axios.put(`${API_URL}/messages/read/${senderId}/${receiverId}`);
