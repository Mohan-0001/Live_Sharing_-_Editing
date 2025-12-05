// config.js - Configuration management for signaling server
require('dotenv').config();

module.exports = {
  // Server port - can be set via environment variable
  PORT: process.env.PORT || 5000,
  
  // Host - 0.0.0.0 allows external connections
  HOST: process.env.HOST || '0.0.0.0',
  
  // CORS origin - '*' allows all origins (change for production)
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  
  // Socket.IO namespace for room management
  NAMESPACE: process.env.NAMESPACE || '/remote-ctrl',
  
  // Enable detailed logging
  ENABLE_LOGGING: process.env.ENABLE_LOGGING === 'true' || true,
  
  // Max rooms (0 = unlimited)
  MAX_ROOMS: parseInt(process.env.MAX_ROOMS) || 0,
  
  // Room timeout in ms (0 = no timeout)
  ROOM_TIMEOUT: parseInt(process.env.ROOM_TIMEOUT) || 0,
};
