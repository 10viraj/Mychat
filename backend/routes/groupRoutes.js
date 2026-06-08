const express = require("express");
const router = express.Router();
const Group = require("../models/Group");

// Create a new group
router.post("/create", async (req, res) => {
    try {
        const { name, members, admin } = req.body;
        // Include admin in members if not already there
        const allMembers = members.includes(admin) ? members : [...members, admin];
        
        const newGroup = await Group.create({
            name,
            members: allMembers,
            admin
        });
        res.status(201).json(newGroup);
    } catch (err) {
        res.status(500).json(err);
    }
});

// Get all groups for a user
router.get("/:userId", async (req, res) => {
    try {
        const groups = await Group.find({ members: req.params.userId });
        res.status(200).json(groups);
    } catch (err) {
        res.status(500).json(err);
    }
});

module.exports = router;
