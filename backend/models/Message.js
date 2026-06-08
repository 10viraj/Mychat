// models/Message.js
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String },
    messageType: { type: String, enum: ["text", "image", "file", "contact", "poll", "location"], default: "text" },
    fileUrl: { type: String },
    status: { type: String, enum: ["sent", "delivered", "read"], default: "sent" },
    contactData: {
        name: String,
        email: String,
        profilePic: String
    },
    locationData: {
        lat: Number,
        lng: Number,
        address: String
    },
    pollData: {
        question: String,
        options: [{
            option: String,
            votes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
        }],
        multipleAnswers: { type: Boolean, default: false }
    }
}, { timestamps: true });

module.exports = mongoose.model("Message", messageSchema);
