// Standalone Signaling Server for WebRTC Video Streaming with Remote Control
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const config = require("./config");

const app = express();
const httpServer = createServer(app);

// CORS middleware
app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        rooms: Object.keys(rooms).length,
        timestamp: new Date().toISOString()
    });
});

// Root endpoint
app.get("/", (req, res) => {
    res.json({
        name: "Video Streaming Signaling Server (Remote Control)",
        version: "1.1.0",
        namespace: config.NAMESPACE,
        activeRooms: Object.keys(rooms).length
    });
});

// Socket.IO server with CORS
const io = new Server(httpServer, {
    cors: {
        origin: config.CORS_ORIGIN,
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ["websocket", "polling"],
    allowEIO3: true
});

// Room management with permissions
// Structure: { roomId: { host: socketId | null, viewers: Set<socketId>, permissions: Map<viewerId, permissions> } }
const rooms = {};

// Create namespace for remote control signaling
const namespace = io.of(config.NAMESPACE);

namespace.on("connection", (socket) => {
    if (config.ENABLE_LOGGING) {
        console.log(`[${new Date().toISOString()}] Client connected: ${socket.id}`);
    }

    // Handle room joining
    socket.on("join-room", ({ roomId, isHost, userName }) => {
        if (!roomId) {
            socket.emit("error", { message: "Room ID is required" });
            return;
        }

        socket.join(roomId);

        // Initialize room if it doesn't exist
        if (!rooms[roomId]) {
            rooms[roomId] = { host: null, viewers: new Set(), permissions: new Map() };
        }

        if (isHost) {
            // Check if host already exists
            if (rooms[roomId].host && rooms[roomId].host !== socket.id) {
                socket.emit("error", { message: "Room already has a host" });
                return;
            }

            rooms[roomId].host = socket.id;
            socket.isHost = true;
            socket.roomId = roomId;
            socket.userName = userName || "Host";

            if (config.ENABLE_LOGGING) {
                console.log(`[${new Date().toISOString()}] Host ${socket.id} (${socket.userName}) joined room: ${roomId}`);
            }

            // Notify all clients in room that host is ready
            namespace.to(roomId).emit("host-ready", { hostId: socket.id });

        } else {
            // Viewer joining
            rooms[roomId].viewers.add(socket.id);
            socket.isHost = false;
            socket.roomId = roomId;
            socket.userName = userName || "Viewer";

            // Initialize permissions as denied
            rooms[roomId].permissions.set(socket.id, {
                mouseControl: false,
                keyboardControl: false,
                fileAccess: false
            });

            if (config.ENABLE_LOGGING) {
                console.log(`[${new Date().toISOString()}] Viewer ${socket.id} (${socket.userName}) joined room: ${roomId}`);
            }

            // Notify host about new viewer with permission request
            const hostId = rooms[roomId].host;
            if (hostId) {
                namespace.to(hostId).emit("new-viewer", {
                    viewerId: socket.id,
                    viewerName: userName || "Viewer"
                });
            } else {
                // No host yet, notify viewer
                socket.emit("waiting-for-host", { message: "Waiting for host to join..." });
            }
        }
    });

    // Handle WebRTC offer (from host to viewer or vice versa)
    socket.on("offer", ({ target, sdp }) => {
        if (!target || !sdp) {
            socket.emit("error", { message: "Invalid offer data" });
            return;
        }

        if (config.ENABLE_LOGGING) {
            console.log(`[${new Date().toISOString()}] Offer from ${socket.id} to ${target}`);
        }

        namespace.to(target).emit("offer", { sdp, sender: socket.id });
    });

    // Handle WebRTC answer
    socket.on("answer", ({ target, sdp }) => {
        if (!target || !sdp) {
            socket.emit("error", { message: "Invalid answer data" });
            return;
        }

        if (config.ENABLE_LOGGING) {
            console.log(`[${new Date().toISOString()}] Answer from ${socket.id} to ${target}`);
        }

        namespace.to(target).emit("answer", { sdp, sender: socket.id });
    });

    // Handle ICE candidates
    socket.on("ice-candidate", ({ target, candidate }) => {
        if (!target || !candidate) {
            socket.emit("error", { message: "Invalid ICE candidate data" });
            return;
        }

        namespace.to(target).emit("ice-candidate", { candidate, sender: socket.id });
    });

    // ========== PERMISSION MANAGEMENT ==========

    // Host grants permissions to viewer
    socket.on("grant-permissions", ({ roomId, viewerId, permissions }) => {
        if (!roomId || !viewerId || !permissions) return;

        const room = rooms[roomId];
        if (!room || room.host !== socket.id) {
            socket.emit("error", { message: "Only host can grant permissions" });
            return;
        }

        // Update permissions
        room.permissions.set(viewerId, permissions);

        if (config.ENABLE_LOGGING) {
            console.log(`[${new Date().toISOString()}] Host granted permissions to ${viewerId}:`, permissions);
        }

        // Notify viewer of granted permissions
        namespace.to(viewerId).emit("permissions-granted", { permissions });
    });

    // Viewer requests permissions
    socket.on("request-permissions", ({ roomId }) => {
        if (!roomId) return;

        const room = rooms[roomId];
        if (!room || !room.host) return;

        if (config.ENABLE_LOGGING) {
            console.log(`[${new Date().toISOString()}] Viewer ${socket.id} requests permissions in room ${roomId}`);
        }

        // Notify host
        namespace.to(room.host).emit("permission-request", {
            viewerId: socket.id,
            viewerName: socket.userName || "Viewer"
        });
    });

    // ========== REMOTE CONTROL EVENTS ==========

    // Mouse movement from viewer to host
    socket.on("remote-mouse-move", ({ target, x, y }) => {
        if (!target) return;

        // Check permissions
        const roomId = socket.roomId;
        if (roomId && rooms[roomId]) {
            const permissions = rooms[roomId].permissions.get(socket.id);
            if (!permissions || !permissions.mouseControl) {
                socket.emit("error", { message: "Mouse control permission denied" });
                return;
            }
        }

        namespace.to(target).emit("remote-mouse-move", { x, y, sender: socket.id });
    });

    // Mouse click from viewer to host
    socket.on("remote-mouse-click", ({ target, button, x, y }) => {
        if (!target) return;

        // Check permissions
        const roomId = socket.roomId;
        if (roomId && rooms[roomId]) {
            const permissions = rooms[roomId].permissions.get(socket.id);
            if (!permissions || !permissions.mouseControl) {
                socket.emit("error", { message: "Mouse control permission denied" });
                return;
            }
        }

        namespace.to(target).emit("remote-mouse-click", { button, x, y, sender: socket.id });
    });

    // Mouse scroll from viewer to host
    socket.on("remote-mouse-scroll", ({ target, deltaX, deltaY }) => {
        if (!target) return;

        // Check permissions
        const roomId = socket.roomId;
        if (roomId && rooms[roomId]) {
            const permissions = rooms[roomId].permissions.get(socket.id);
            if (!permissions || !permissions.mouseControl) {
                socket.emit("error", { message: "Mouse control permission denied" });
                return;
            }
        }

        namespace.to(target).emit("remote-mouse-scroll", { deltaX, deltaY, sender: socket.id });
    });

    // Keyboard input from viewer to host
    socket.on("remote-keyboard", ({ target, key, action }) => {
        if (!target) return;

        // Check permissions
        const roomId = socket.roomId;
        if (roomId && rooms[roomId]) {
            const permissions = rooms[roomId].permissions.get(socket.id);
            if (!permissions || !permissions.keyboardControl) {
                socket.emit("error", { message: "Keyboard control permission denied" });
                return;
            }
        }

        namespace.to(target).emit("remote-keyboard", { key, action, sender: socket.id });
    });

    // ========== END REMOTE CONTROL EVENTS ==========

    // Handle chat messages
    socket.on("chat-message", ({ roomId, message }) => {
        if (!roomId || !message) return;

        namespace.to(roomId).emit("chat-message", {
            sender: socket.id,
            senderName: socket.userName || "Unknown",
            message,
            timestamp: new Date().toISOString()
        });
    });

    // Handle disconnection
    socket.on("disconnect", () => {
        if (config.ENABLE_LOGGING) {
            console.log(`[${new Date().toISOString()}] Client disconnected: ${socket.id}`);
        }

        // Clean up rooms
        for (const roomId in rooms) {
            const room = rooms[roomId];
            if (!room) continue;

            if (room.host === socket.id) {
                // Host left - notify all viewers
                room.host = null;
                room.viewers.forEach(viewerId => {
                    namespace.to(viewerId).emit("host-left", { message: "Host has disconnected" });
                });

                if (config.ENABLE_LOGGING) {
                    console.log(`[${new Date().toISOString()}] Host left room: ${roomId}`);
                }
            }

            // Remove from viewers
            if (room.viewers.has(socket.id)) {
                room.viewers.delete(socket.id);
                room.permissions.delete(socket.id);

                if (config.ENABLE_LOGGING) {
                    console.log(`[${new Date().toISOString()}] Viewer left room: ${roomId}`);
                }
            }

            // Clean up empty rooms
            if (!room.host && room.viewers.size === 0) {
                delete rooms[roomId];

                if (config.ENABLE_LOGGING) {
                    console.log(`[${new Date().toISOString()}] Room deleted: ${roomId}`);
                }
            }
        }
    });

    // Handle errors
    socket.on("error", (error) => {
        console.error(`[${new Date().toISOString()}] Socket error for ${socket.id}:`, error);
    });
});

// Start server
httpServer.listen(config.PORT, config.HOST, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║  Video Streaming Signaling Server (Remote Control)        ║
╠════════════════════════════════════════════════════════════╣
║  Status:     RUNNING                                       ║
║  URL:        http://${config.HOST}:${config.PORT}${config.NAMESPACE.padEnd(30)}║
║  Namespace:  ${config.NAMESPACE.padEnd(46)}║
║  CORS:       ${config.CORS_ORIGIN.padEnd(46)}║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on("SIGTERM", () => {
    console.log("\n[SIGTERM] Shutting down gracefully...");
    httpServer.close(() => {
        console.log("Server closed");
        process.exit(0);
    });
});

process.on("SIGINT", () => {
    console.log("\n[SIGINT] Shutting down gracefully...");
    httpServer.close(() => {
        console.log("Server closed");
        process.exit(0);
    });
});
