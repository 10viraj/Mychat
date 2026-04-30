// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");

const Message = require("../models/Message");

// Get all users with their last message
router.get("/", async (req, res) => {
    try {
        const currentUserId = req.query.currentUserId;
        const users = await User.find({ _id: { $ne: currentUserId } }).select("-password");

        // Attach last message to each user
        const usersWithLastMsg = await Promise.all(users.map(async (u) => {
            const lastMsg = await Message.findOne({
                $or: [
                    { sender: currentUserId, receiver: u._id },
                    { sender: u._id, receiver: currentUserId }
                ]
            }).sort({ createdAt: -1 });

            const unreadCount = await Message.countDocuments({
                sender: u._id,
                receiver: currentUserId,
                isRead: false
            });

            return {
                ...u._doc,
                lastMessage: lastMsg ? lastMsg.text : "Tap to chat",
                lastMessageTime: lastMsg ? lastMsg.createdAt : null,
                unreadCount: unreadCount
            };
        }));

        // Sort by most recent message
        usersWithLastMsg.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

        res.json(usersWithLastMsg);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update Profile Picture
router.post("/update-profile", async (req, res) => {
    const { userId, profilePic } = req.body;
    console.log("Updating profile for user:", userId);
    try {
        if (!userId) return res.status(400).json({ message: "User ID is required" });
        const user = await User.findByIdAndUpdate(userId, { profilePic }, { returnDocument: 'after' });
        res.json(user);
    } catch (err) {
        console.error("Profile Update Error:", err);
        res.status(500).json({ message: "Update failed", error: err.message });
    }
});

module.exports = router;
