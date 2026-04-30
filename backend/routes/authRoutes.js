// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Register
router.post("/register", async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
        if (existingUser) return res.status(400).json({ message: "User with this email or phone already exists" });

        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, phone, password: hashed });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "secret", { expiresIn: "7d" });
        res.json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone } });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Login
router.post("/login", async (req, res) => {
    try {
        const { identifier, password } = req.body; // identifier can be email or phone
        const user = await User.findOne({ $or: [{ email: identifier }, { phone: identifier }] });

        if (!user) return res.status(400).json({ message: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid password" });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "secret", { expiresIn: "7d" });
        res.json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone } });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;