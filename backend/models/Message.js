// models/Message.js
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String },
    messageType: { type: String, enum: ["text", "image", "file"], default: "text" },
    fileUrl: { type: String },
    status: { type: String, enum: ["sent", "delivered", "read"], default: "sent" },
}, { timestamps: true });

module.exports = mongoose.model("Message", messageSchema);
