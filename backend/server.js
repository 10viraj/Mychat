const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const path = require("path");
const multer = require("multer");

const Message = require("./models/Message");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const messageRoutes = require("./routes/messageRoutes");
const callRoutes = require("./routes/callRoutes");
const Call = require("./models/Call");

const app = express();

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

mongoose.connect("mongodb://127.0.0.1:27017/mychat")
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log(err));

const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" }
});

const onlineUsers = new Map(); // userId -> socketId

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/calls", callRoutes);

// File Upload Route
app.post("/api/upload", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const fileUrl = `http://localhost:5000/uploads/${req.file.filename}`;
    res.json({ fileUrl, messageType: req.file.mimetype.startsWith("image/") ? "image" : "file" });
});

// 🔥 Socket Logic
io.on("connection", (socket) => {
    console.log("User Connected:", socket.id);

    // Join a private room named after the user ID
    socket.on("join", (userId) => {
        socket.join(userId);
        onlineUsers.set(userId, socket.id);
        console.log(`User ${userId} joined room`);

        // When a user joins, any messages sent to them should be marked as delivered
        const markDelivered = async () => {
            await Message.updateMany(
                { receiver: userId, status: "sent" },
                { status: "delivered" }
            );
            // We could notify senders here, but for simplicity we'll let it sync on refresh or next msg
        };
        markDelivered();
    });

    socket.on("sendMessage", async (data) => {
        const { sender, receiver, text, messageType, fileUrl, contactData, pollData, locationData } = data;
        
        const isReceiverOnline = onlineUsers.has(receiver);
        const status = isReceiverOnline ? "delivered" : "sent";

        // Save to DB
        const newMessage = await Message.create({ 
            sender, 
            receiver, 
            text, 
            messageType: messageType || "text", 
            fileUrl,
            contactData,
            pollData,
            locationData,
            status
        });
        
        // Emit to both sender and receiver rooms
        io.to(sender).to(receiver).emit("receiveMessage", newMessage);

        // If delivered, notify sender immediately
        if (isReceiverOnline) {
            io.to(sender).emit("messageStatusUpdate", { 
                messageId: newMessage._id, 
                status: "delivered",
                receiverId: receiver
            });
        }
    });

    socket.on("votePoll", async (data) => {
        const { messageId, optionIndex, userId } = data;
        try {
            const message = await Message.findById(messageId);
            if (message && message.messageType === 'poll') {
                const option = message.pollData.options[optionIndex];
                
                if (!message.pollData.multipleAnswers) {
                    message.pollData.options.forEach(opt => {
                        opt.votes = opt.votes.filter(id => id.toString() !== userId);
                    });
                }

                const hasVoted = option.votes.some(id => id.toString() === userId);
                if (hasVoted) {
                    option.votes = option.votes.filter(id => id.toString() !== userId);
                } else {
                    option.votes.push(userId);
                }

                await message.save();
                io.to(message.sender.toString()).to(message.receiver.toString()).emit("pollUpdated", message);
            }
        } catch (err) {
            console.error(err);
        }
    });

    socket.on("markAsRead", async ({ senderId, receiverId }) => {
        await Message.updateMany(
            { sender: senderId, receiver: receiverId, status: { $ne: "read" } },
            { status: "read" }
        );
        // Notify the sender that their messages were read
        io.to(senderId).emit("messagesRead", { readerId: receiverId });
    });

    socket.on("typing", (data) => {
        const { sender, receiver, isTyping } = data;
        io.to(receiver).emit("typing", { sender, isTyping });
    });

    socket.on("messageDeleted", (data) => {
        const { messageId, type, receiverId } = data;
        if (type === 'everyone' && receiverId) {
            io.to(receiverId).emit("messageDeleted", { messageId, type });
        }
    });

    // WebRTC Calling Signaling
    socket.on("callUser", async (data) => {
        const { userToCall, signalData, from, name, callType } = data;
        
        try {
            const newCall = await Call.create({
                caller: from,
                receiver: userToCall,
                callType: callType || "video",
                status: "missed"
            });
            io.to(userToCall).emit("callUser", { signal: signalData, from, name, callType, callId: newCall._id });
        } catch (err) {
            console.error("Error creating call record:", err);
        }
    });

    socket.on("answerCall", async (data) => {
        try {
            await Call.findByIdAndUpdate(data.callId, { status: "completed" });
            io.to(data.to).emit("callAccepted", data.signal);
        } catch (err) {
            console.error("Error updating call:", err);
        }
    });

    socket.on("endCall", async (data) => {
        if (data.callId) {
            try {
                await Call.findByIdAndUpdate(data.callId, { endTime: Date.now() });
            } catch(e) {}
        }
        io.to(data.to).emit("callEnded");
    });

    socket.on("disconnect", () => {
        for (const [userId, socketId] of onlineUsers.entries()) {
            if (socketId === socket.id) {
                onlineUsers.delete(userId);
                break;
            }
        }
        console.log("User Disconnected");
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));