# Video Streaming Signaling Server

A standalone WebRTC signaling server for the video streaming application. This server handles room management, WebRTC offer/answer exchange, and ICE candidate relay between hosts and viewers.

## Features

- ✅ Room-based WebRTC signaling
- ✅ Support for multiple concurrent rooms
- ✅ Host and viewer role management
- ✅ Real-time chat messaging
- ✅ Health check endpoint
- ✅ Environment-based configuration
- ✅ CORS support for cross-origin requests
- ✅ Graceful shutdown handling
- ✅ Detailed logging

## Quick Start

### 1. Install Dependencies

```bash
cd signaling-server
npm install
```

### 2. Configure Environment (Optional)

Copy the example environment file and customize:

```bash
cp .env.example .env
```

Edit `.env` to change settings:
- `PORT`: Server port (default: 5000)
- `HOST`: Bind address (default: 0.0.0.0 for external access)
- `CORS_ORIGIN`: CORS policy (default: * allows all origins)
- `NAMESPACE`: Socket.IO namespace (default: /remote-ctrl)

### 3. Start Server

```bash
npm start
```

The server will start on `https://live-sharing-editing.onrender.com/` by default.

## Local Development

For local testing:

```bash
npm run dev
```

Access the health check at: `http://localhost:5000/health`

## Deployment Options

### Option 1: Railway (Recommended - Free Tier)

1. Push your code to GitHub
2. Go to [Railway.app](https://railway.app)
3. Click "New Project" → "Deploy from GitHub"
4. Select your repository
5. Railway will auto-detect Node.js and deploy
6. Set environment variables in Railway dashboard if needed
7. Get your deployment URL (e.g., `https://your-app.railway.app`)

**Configuration:**
- Railway automatically sets `PORT` environment variable
- Set `CORS_ORIGIN=*` in Railway environment variables

### Option 2: Render (Free Tier)

1. Push code to GitHub
2. Go to [Render.com](https://render.com)
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Add variables from `.env.example`
6. Deploy and get URL

### Option 3: Heroku

```bash
# Install Heroku CLI first
heroku login
heroku create your-app-name
git push heroku main
```

Heroku automatically sets the `PORT` variable.

### Option 4: VPS (DigitalOcean, AWS, etc.)

```bash
# SSH into your server
git clone your-repo
cd signaling-server
npm install

# Install PM2 for process management
npm install -g pm2
pm2 start server.js --name "signaling-server"
pm2 save
pm2 startup

# Configure firewall
sudo ufw allow 5000/tcp
```

### Option 5: Local Network (LAN)

For testing on your local network:

1. Start the server:
   ```bash
   npm start
   ```

2. Find your local IP address:
   - Windows: `ipconfig` (look for IPv4 Address)
   - Mac/Linux: `ifconfig` or `ip addr`

3. Use the LAN URL in your client app:
   ```
   http://192.168.1.XX:5000/remote-ctrl
   ```

Devices on the same Wi-Fi can connect using this URL.

### Option 6: Ngrok (For Quick Testing)

Ngrok creates a public URL tunnel to your localhost:

```bash
# In terminal 1: Start server
npm start

# In terminal 2: Start ngrok
ngrok http 5000
```

Use the ngrok HTTPS URL (e.g., `https://abc123.ngrok-free.app/remote-ctrl`).

⚠️ **Note**: Ngrok free tier may have connection limits and WebRTC might not work reliably through tunnels.

## API Endpoints

### Health Check
```
GET /health
```

Returns server status and active room count.

### Root Info
```
GET /
```

Returns server information and configuration.

## Socket.IO Events

### Client → Server

| Event | Data | Description |
|-------|------|-------------|
| `join-room` | `{ roomId, isHost }` | Join a room as host or viewer |
| `offer` | `{ target, sdp }` | Send WebRTC offer to target peer |
| `answer` | `{ target, sdp }` | Send WebRTC answer to target peer |
| `ice-candidate` | `{ target, candidate }` | Send ICE candidate to target peer |
| `chat-message` | `{ roomId, message }` | Send chat message to room |

### Server → Client

| Event | Data | Description |
|-------|------|-------------|
| `host-ready` | `{ hostId }` | Host has joined the room |
| `new-viewer` | `viewerId` | New viewer joined (sent to host) |
| `waiting-for-host` | `{ message }` | Viewer waiting for host |
| `offer` | `{ sdp, sender }` | WebRTC offer from peer |
| `answer` | `{ sdp, sender }` | WebRTC answer from peer |
| `ice-candidate` | `{ candidate, sender }` | ICE candidate from peer |
| `chat-message` | `{ sender, message, timestamp }` | Chat message |
| `host-left` | `{ message }` | Host disconnected |
| `error` | `{ message }` | Error message |

## Configuration Reference

All values can be set via environment variables (`.env` file):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port |
| `HOST` | `0.0.0.0` | Bind address (0.0.0.0 = all interfaces) |
| `CORS_ORIGIN` | `*` | CORS allowed origins |
| `NAMESPACE` | `/remote-ctrl` | Socket.IO namespace |
| `ENABLE_LOGGING` | `true` | Enable detailed console logs |
| `MAX_ROOMS` | `0` | Max concurrent rooms (0 = unlimited) |
| `ROOM_TIMEOUT` | `0` | Room timeout in ms (0 = no timeout) |

## Security Considerations

**For Production:**

1. **Set specific CORS origin**:
   ```env
   CORS_ORIGIN=https://your-app-domain.com
   ```

2. **Use HTTPS**: Deploy behind a reverse proxy (nginx) with SSL

3. **Rate limiting**: Add rate limiting middleware to prevent abuse

4. **Authentication**: Implement room password or token-based auth

5. **Monitoring**: Add logging service (e.g., LogRocket, Sentry)

## Troubleshooting

### Server won't start
- Check if port 5000 is already in use: `netstat -ano | findstr :5000` (Windows) or `lsof -i :5000` (Mac/Linux)
- Try a different port in `.env`

### Clients can't connect
- Check firewall settings
- Verify CORS configuration
- Ensure server URL matches in client app

### WebRTC connection fails
- Check that clients can reach the server
- Verify STUN/TURN server configuration in client
- For production, consider adding a TURN server for NAT traversal

## License

MIT
