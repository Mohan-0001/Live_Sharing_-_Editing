# 🖥️ Remote Desktop Streaming App

An Electron-based application for real-time screen sharing using WebRTC. Users can host their screen/window for others to view remotely through a simple room-based system.

## ✨ Features

- 🎥 **Host Mode**: Share your entire screen or specific windows
- 👁️ **Viewer Mode**: Watch live streams from hosts
- 🏠 **Room-based**: Simple room ID system for connecting
- 💬 **Chat**: Built-in text chat between participants
- 🔒 **Secure**: Peer-to-peer WebRTC connections
- 🌐 **Cross-platform**: Works on Windows, macOS, and Linux

## 🏗️ Architecture

The application consists of two main components:

1. **Client Application** (Electron + React): The desktop/browser app that users interact with
2. **Signaling Server** (Node.js + Socket.IO): Handles WebRTC signaling and room management

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Host Client   │◄───────►│ Signaling Server │◄───────►│  Viewer Client  │
│  (Electron/Web) │  Socket │  (Node.js)       │ Socket  │  (Electron/Web) │
└─────────────────┘   .IO    └──────────────────┘  .IO    └─────────────────┘
        │                                                          │
        └──────────────────────WebRTC P2P────────────────────────┘
                          (Video/Audio Stream)
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### 1. Install Dependencies

```bash
# Install client dependencies
npm install

# Install signaling server dependencies
cd signaling-server
npm install
cd ..
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` to set your signaling server URL:
```env
VITE_SIGNALING_SERVER=https://live-sharing-editing.onrender.com/
```

### 3. Start the Signaling Server

In a **separate terminal**:

```bash
cd signaling-server
npm start
```

You should see:
```
╔════════════════════════════════════════════════════════════╗
║  Video Streaming Signaling Server                          ║
╠════════════════════════════════════════════════════════════╣
║  Status:     RUNNING                                       ║
║  URL:        http://0.0.0.0:5000/remote-ctrl               ║
╚════════════════════════════════════════════════════════════╝
```

### 4. Start the Client Application

In your **main terminal**:

```bash
# Start Vite dev server
npm run dev

# In another terminal, start Electron
npm start
```

The Electron app will open automatically.

## 📖 Usage Guide

### As a Host (Screen Sharer)

1. Enter your name
2. Enter a Room ID (e.g., "meeting123")
3. Select "Host" role
4. Click "Join Room"
5. Select which screen/window to share (Electron) or choose from browser prompt
6. Share the Room ID with viewers

### As a Viewer

1. Enter your name
2. Enter the same Room ID as the host
3. Select "Viewer" role
4. Click "Join Room"
5. You'll see the host's screen once they start streaming

## 🌍 Deployment

### Deploying the Signaling Server

See [`signaling-server/README.md`](signaling-server/README.md) for detailed deployment guides for:

- **Railway** (recommended - free tier)
- **Render**
- **Heroku**
- **VPS** (DigitalOcean, AWS, etc.)
- **Local Network** (LAN)
- **Ngrok** (testing only)

**Example: Railway Deployment**

1. Push code to GitHub
2. Create account on [Railway.app](https://railway.app)
3. Deploy from GitHub repository
4. Railway will auto-detect and deploy the server
5. Copy your Railway URL (e.g., `https://your-app.railway.app`)
6. Update your client `.env`:
   ```env
   VITE_SIGNALING_SERVER=https://live-sharing-editing.onrender.com/
   ```

### Building the Electron App

To create a distributable package:

```bash
npm run build
# Then use electron-builder to package
npx electron-builder
```

## 📁 Project Structure

```
video-calling-app/
├── signaling-server/           # Standalone signaling server
│   ├── server.js              # Main server file
│   ├── config.js              # Configuration management
│   ├── package.json           # Server dependencies
│   └── README.md              # Server documentation
├── src/                       # Client application source
│   ├── App.jsx               # Main React component
│   ├── config.js             # Client configuration
│   └── main.jsx              # React entry point
├── main.js                   # Electron main process
├── preload.js                # Electron preload script
├── .env.example              # Environment template
├── package.json              # Client dependencies
└── README.md                 # This file
```

## 🔧 Configuration

### Client Configuration

Edit `.env` file:

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SIGNALING_SERVER` | Signaling server URL | `https://live-sharing-editing.onrender.com/` |

### Server Configuration

Edit `signaling-server/.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `CORS_ORIGIN` | `*` | CORS policy |
| `NAMESPACE` | `/remote-ctrl` | Socket.IO namespace |

See [`signaling-server/README.md`](signaling-server/README.md) for all options.

## 🐛 Troubleshooting

### Connection Issues

**Problem**: "Failed to connect to signaling server"

**Solutions**:
1. Verify the signaling server is running
2. Check the server URL in `.env` matches the server address
3. Ensure no firewall is blocking the port
4. Check browser console for detailed errors

### Video Not Showing for Viewer

**Problem**: Viewer joined but sees black screen

**Solutions**:
1. Host must share their screen first
2. Check browser console for WebRTC errors
3. Verify both host and viewer can reach the signaling server
4. Try using STUN/TURN servers for NAT traversal (add to `src/config.js`)

### Screen Capture Permission (macOS)

On macOS, you may need to grant screen recording permissions:
1. System Preferences → Security & Privacy → Privacy → Screen Recording
2. Enable permission for your Electron app

### Port Already in Use

If port 5000 is occupied:

**Server side:**
```bash
# Change PORT in signaling-server/.env
PORT=8080
```

**Client side:**
```bash
# Update VITE_SIGNALING_SERVER in .env
VITE_SIGNALING_SERVER=https://live-sharing-editing.onrender.com/
```

## 🛡️ Security Considerations

For production deployments:

1. **Use HTTPS**: Deploy server behind SSL/TLS
2. **Restrict CORS**: Set specific origins instead of `*`
3. **Add Authentication**: Implement room passwords or JWT tokens
4. **Rate Limiting**: Add rate limiters to prevent abuse
5. **TURN Servers**: For reliable connections behind NAT

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- [React](https://react.dev/) for the UI
- [Socket.IO](https://socket.io/) for signaling
- [WebRTC](https://webrtc.org/) for peer-to-peer communication

## 📞 Support

For issues and questions:
- Check the [Troubleshooting](#-troubleshooting) section
- Review [signaling-server/README.md](signaling-server/README.md)
- Open an issue on GitHub

---

**Happy Streaming! 🎉**
