// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = sessionStorage.getItem('user');
        if (storedUser) setUser(JSON.parse(storedUser));
        setLoading(false);
    }, []);

    const login = (userData) => {
        setUser(userData);
        sessionStorage.setItem('user', JSON.stringify(userData));
    };

    const logout = () => {
        setUser(null);
        sessionStorage.removeItem('user');
    };

    return (
        <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
