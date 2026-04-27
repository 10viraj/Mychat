const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect("mongodb://127.0.0.1:27017/vibechat");

const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" }
});

// 🔥 Socket Logic
io.on("connection", (socket) => {
    console.log("User Connected:", socket.id);

    socket.on("sendMessage", (data) => {
        io.emit("receiveMessage", data);
    });

    socket.on("disconnect", () => {
        console.log("User Disconnected");
    });
});

server.listen(5000, () => console.log("Server running on 5000"));