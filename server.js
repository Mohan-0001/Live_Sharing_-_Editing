// server.js
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const http = createServer(app);

const io = new Server(http, {
  cors: { origin: "*" },
  transports: ["polling", "websocket"],
});

const NAMESPACE = "/remote-ctrl";
const rooms = {}; // roomId -> { host: socketId|null, viewers: Set }

io.of(NAMESPACE).on("connection", (socket) => {
  console.log("Signal connected:", socket.id);

  socket.on("join-room", ({ roomId, isHost }) => {
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = { host: null, viewers: new Set() };

    if (isHost) {
      rooms[roomId].host = socket.id;
      console.log(`Host ${socket.id} joined ${roomId}`);
      // notify viewers waiting (optional)
      io.of(NAMESPACE).to(roomId).emit("host-ready");
    } else {
      rooms[roomId].viewers.add(socket.id);
      console.log(`Viewer ${socket.id} joined ${roomId}`);
      // inform host that a viewer joined
      const hostId = rooms[roomId].host;
      if (hostId) socket.to(hostId).emit("new-viewer", socket.id);
    }
  });

  socket.on("offer", ({ target, sdp }) => {
    if (target) socket.to(target).emit("offer", { sdp, sender: socket.id });
  });

  socket.on("answer", ({ target, sdp }) => {
    if (target) socket.to(target).emit("answer", { sdp, sender: socket.id });
  });

  socket.on("ice-candidate", ({ target, candidate }) => {
    if (target) socket.to(target).emit("ice-candidate", { candidate, sender: socket.id });
  });

  socket.on("chat-message", ({ roomId, message }) => {
    io.of(NAMESPACE).to(roomId).emit("chat-message", { sender: socket.id, message });
  });

  socket.on("disconnect", () => {
    console.log("Signal disconnect:", socket.id);
    // remove from rooms
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (!room) continue;
      if (room.host === socket.id) {
        room.host = null;
        // inform viewers
        room.viewers.forEach(v => socket.to(v).emit("host-left"));
      }
      if (room.viewers.has(socket.id)) room.viewers.delete(socket.id);
      if (!room.host && room.viewers.size === 0) delete rooms[roomId];
    }
  });
});

const PORT = process.env.PORT || 5000;
http.listen(PORT, "0.0.0.0", () => {
  console.log(`Signaling server listening on http://0.0.0.0:${PORT}${NAMESPACE}`);
});
