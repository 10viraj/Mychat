import React, { useState, useEffect, useRef } from 'react';
import Peer from 'simple-peer/simplepeer.min.js';
import './CallManager.css';

export default function CallManager({ user, socket, selectedUser }) {
    const [receivingCall, setReceivingCall] = useState(false);
    const [caller, setCaller] = useState('');
    const [callerName, setCallerName] = useState('');
    const [callerSignal, setCallerSignal] = useState();
    const [callAccepted, setCallAccepted] = useState(false);
    const [callEnded, setCallEnded] = useState(false);
    const [stream, setStream] = useState(null);
    const [callType, setCallType] = useState('video'); // voice or video
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [callId, setCallId] = useState(null);

    const myVideo = useRef();
    const userVideo = useRef();
    const connectionRef = useRef();

    useEffect(() => {
        if (!socket) return;
        
        const handleCallUser = (data) => {
            setReceivingCall(true);
            setCaller(data.from);
            setCallerName(data.name);
            setCallerSignal(data.signal);
            setCallType(data.callType);
            setCallId(data.callId);
        };

        socket.on('callUser', handleCallUser);
        
        return () => {
            socket.off('callUser', handleCallUser);
        };
    }, [socket]);

    const getStream = async (type) => {
        try {
            const currentStream = await navigator.mediaDevices.getUserMedia({ 
                video: type === 'video', 
                audio: true 
            });
            setStream(currentStream);
            if (myVideo.current) myVideo.current.srcObject = currentStream;
            return currentStream;
        } catch (err) {
            console.error('Failed to get local stream', err);
            return null;
        }
    };

    const callUser = async (userToCall, type) => {
        const mediaStream = await getStream(type);
        if (!mediaStream) return;

        setCallType(type);
        const peer = new Peer({
            initiator: true,
            trickle: false,
            stream: mediaStream
        });

        peer.on('signal', (data) => {
            socket.emit('callUser', {
                userToCall: userToCall,
                signalData: data,
                from: user.user.id,
                name: user.user.name,
                callType: type
            });
        });

        peer.on('stream', (currentStream) => {
            if (userVideo.current) userVideo.current.srcObject = currentStream;
        });

        socket.on('callAccepted', (signal) => {
            setCallAccepted(true);
            peer.signal(signal);
        });

        socket.on('callEnded', () => {
            leaveCall();
        });

        connectionRef.current = peer;
    };

    const answerCall = async () => {
        setCallAccepted(true);
        const mediaStream = await getStream(callType);
        
        const peer = new Peer({
            initiator: false,
            trickle: false,
            stream: mediaStream
        });

        peer.on('signal', (data) => {
            socket.emit('answerCall', { signal: data, to: caller, callId });
        });

        peer.on('stream', (currentStream) => {
            if (userVideo.current) userVideo.current.srcObject = currentStream;
        });

        peer.signal(callerSignal);

        socket.on('callEnded', () => {
            leaveCall();
        });

        connectionRef.current = peer;
    };

    const declineCall = () => {
        socket.emit('endCall', { to: caller, callId });
        setReceivingCall(false);
    };

    const leaveCall = () => {
        setCallEnded(true);
        if (connectionRef.current) connectionRef.current.destroy();
        if (stream) stream.getTracks().forEach(track => track.stop());
        socket.emit('endCall', { to: caller || selectedUser?._id, callId });
        
        // Reset state
        setCallAccepted(false);
        setReceivingCall(false);
        setStream(null);
        setCaller('');
        setCallerSignal(null);
    };

    const toggleScreenShare = async () => {
        if (!isScreenSharing) {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ cursor: true });
                const videoTrack = screenStream.getVideoTracks()[0];
                const sender = connectionRef.current._pc.getSenders().find(s => s.track.kind === videoTrack.kind);
                sender.replaceTrack(videoTrack);
                
                videoTrack.onended = () => {
                    toggleScreenShare(); // Revert back
                };
                
                if (myVideo.current) myVideo.current.srcObject = screenStream;
                setIsScreenSharing(true);
            } catch (error) {
                console.error("Screen sharing failed", error);
            }
        } else {
            // Revert to camera
            const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const videoTrack = cameraStream.getVideoTracks()[0];
            const sender = connectionRef.current._pc.getSenders().find(s => s.track.kind === videoTrack.kind);
            sender.replaceTrack(videoTrack);
            
            if (myVideo.current) myVideo.current.srcObject = cameraStream;
            setIsScreenSharing(false);
        }
    };

    useEffect(() => {
        const handleStartCall = (e) => {
            if (e.detail.type && selectedUser) {
                callUser(selectedUser._id, e.detail.type);
            }
        };
        window.addEventListener('start-call', handleStartCall);
        return () => window.removeEventListener('start-call', handleStartCall);
    }, [selectedUser]);

    if (!receivingCall && !stream) return null;

    return (
        <div className="call-overlay">
            {receivingCall && !callAccepted ? (
                <div className="incoming-call-box glass">
                    <div className="avatar call-avatar">{callerName[0]}</div>
                    <h2>{callerName} is calling...</h2>
                    <p>{callType === 'video' ? '📹 Incoming Video Call' : '📞 Incoming Voice Call'}</p>
                    <div className="call-actions">
                        <button className="btn-reject" onClick={declineCall}>Decline</button>
                        <button className="btn-accept" onClick={answerCall}>Accept</button>
                    </div>
                </div>
            ) : null}

            {stream && (
                <div className={`active-call-box ${callType} glass`}>
                    <div className="videos-container">
                        {callAccepted && !callEnded ? (
                            <div className="user-video-wrapper">
                                <video playsInline ref={userVideo} autoPlay className="user-video" />
                            </div>
                        ) : (
                            <div className="calling-state">
                                <h2>Calling {selectedUser?.name}...</h2>
                            </div>
                        )}
                        <div className="my-video-wrapper">
                            <video playsInline muted ref={myVideo} autoPlay className="my-video" />
                        </div>
                    </div>
                    <div className="call-controls">
                        {callType === 'video' && (
                            <button className="control-btn" onClick={toggleScreenShare}>
                                {isScreenSharing ? 'Stop Share' : 'Share Screen'}
                            </button>
                        )}
                        <button className="control-btn end-call" onClick={leaveCall}>
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
