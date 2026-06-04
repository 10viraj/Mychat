import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function ResetPassword() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const { token } = useParams();
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (password !== confirmPassword) {
            return setError("Passwords don't match");
        }

        setIsLoading(true);
        try {
            const res = await axios.put(`http://localhost:5000/api/auth/resetpassword/${token}`, { password });
            setSuccessMessage(res.data.message || 'Password updated successfully');
            // Log them in
            if (res.data.token) {
                login(res.data);
                setTimeout(() => navigate('/'), 2000);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to reset password. Token might be invalid or expired.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-background-blobs">
                <div className="blob blob-1"></div>
                <div className="blob blob-2"></div>
                <div className="blob blob-3"></div>
            </div>
            <div className="auth-box glass">
                <div className="auth-header">
                    <h2>Reset Password</h2>
                    <p>Enter your new password below.</p>
                </div>
                {successMessage && <div style={{ color: 'green', marginBottom: '10px' }}>{successMessage}</div>}
                {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="input-group">
                        <label>New Password</label>
                        <input 
                            type="password" 
                            placeholder="••••••••" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            required 
                            minLength={6}
                        />
                    </div>
                    <div className="input-group">
                        <label>Confirm Password</label>
                        <input 
                            type="password" 
                            placeholder="••••••••" 
                            value={confirmPassword} 
                            onChange={(e) => setConfirmPassword(e.target.value)} 
                            required 
                            minLength={6}
                        />
                    </div>
                    <button type="submit" className="auth-btn" disabled={isLoading || successMessage}>
                        {isLoading ? 'Resetting...' : 'Reset Password'}
                    </button>
                </form>
                {error && (
                    <div className="auth-footer">
                        <p>Need to request another link? <Link to="/forgotpassword">Forgot Password</Link></p>
                    </div>
                )}
            </div>
        </div>
    );
}
