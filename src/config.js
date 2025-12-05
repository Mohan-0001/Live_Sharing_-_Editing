// src/config.js
// Centralized configuration for the application

export const config = {
    // Signaling server URL - reads from environment variable or defaults to localhost
    SIGNALING_SERVER: import.meta.env.VITE_SIGNALING_SERVER || "https://live-sharing-editing.onrender.com/",

    // ICE servers for WebRTC
    ICE_SERVERS: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        // Add TURN servers here if available for better NAT traversal
        // { urls: "turn:your-turn-server.com", username: "user", credential: "pass" }
    ],

    // Socket.IO connection options
    SOCKET_OPTIONS: {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
    }
};
