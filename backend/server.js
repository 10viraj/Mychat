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

// File Upload Route
app.post("/api/upload", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const fileUrl = `http://192.168.1.4:5000/uploads/${req.file.filename}`;
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
        const { sender, receiver, text, messageType, fileUrl } = data;
        
        const isReceiverOnline = onlineUsers.has(receiver);
        const status = isReceiverOnline ? "delivered" : "sent";

        // Save to DB
        const newMessage = await Message.create({ 
            sender, 
            receiver, 
            text, 
            messageType: messageType || "text", 
            fileUrl,
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