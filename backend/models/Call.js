const mongoose = require("mongoose");

const callSchema = new mongoose.Schema({
    caller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    callType: { type: String, enum: ["voice", "video"], required: true },
    status: { type: String, enum: ["missed", "completed", "rejected"], required: true },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model("Call", callSchema);
