// routes/messageRoutes.js
const express = require("express");
const router = express.Router();
const Message = require("../models/Message");

// Get messages between two users
router.get("/:userId1/:userId2", async (req, res) => {
    try {
        const { userId1, userId2 } = req.params;
        const messages = await Message.find({
            $or: [
                { sender: userId1, receiver: userId2 },
                { sender: userId2, receiver: userId1 }
            ]
        }).sort({ createdAt: 1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Mark messages as read
router.put("/read/:senderId/:receiverId", async (req, res) => {
    try {
        const { senderId, receiverId } = req.params;
        await Message.updateMany(
            { sender: senderId, receiver: receiverId, status: { $ne: "read" } },
            { status: "read" }
        );
        res.json({ message: "Messages marked as read" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Clear chat between two users
router.delete("/clear/:userId1/:userId2", async (req, res) => {
    try {
        const { userId1, userId2 } = req.params;
        await Message.deleteMany({
            $or: [
                { sender: userId1, receiver: userId2 },
                { sender: userId2, receiver: userId1 }
            ]
        });
        res.json({ message: "Chat cleared successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete a specific message
router.delete("/:messageId", async (req, res) => {
    try {
        await Message.findByIdAndDelete(req.params.messageId);
        res.json({ message: "Message deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
