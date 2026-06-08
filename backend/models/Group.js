const mongoose = require("mongoose");

const GroupSchema = new mongoose.Schema({
    name: { type: String, required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isGroup: { type: Boolean, default: true },
    profilePic: { type: String, default: "" }
}, { timestamps: true });

module.exports = mongoose.model("Group", GroupSchema);
