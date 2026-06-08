const express = require("express");
const Call = require("../models/Call");
const router = express.Router();

// Get call history for a user
router.get("/:userId", async (req, res) => {
    try {
        const calls = await Call.find({
            $or: [{ caller: req.params.userId }, { receiver: req.params.userId }]
        })
        .populate("caller", "name profilePic email")
        .populate("receiver", "name profilePic email")
        .sort({ startTime: -1 })
        .limit(50);
        res.json(calls);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
