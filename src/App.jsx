// App.jsx - Remote Desktop with Permission-Based Control
import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { config } from "./config";

export default function App() {
  // Socket and video refs
  const socket = useRef(null);
  const videoRef = useRef(null);
  const messageRef = useRef();

  // State management
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [isHost, setIsHost] = useState(true);
  const [roomJoined, setRoomJoined] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [sources, setSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState(null);
  const [messages, setMessages] = useState([]);

  // Permission state
  const [pendingPermissionRequest, setPendingPermissionRequest] = useState(null);
  const [myPermissions, setMyPermissions] = useState({
    mouseControl: false,
    keyboardControl: false,
    fileAccess: false
  });
  const [remoteControlActive, setRemoteControlActive] = useState(false);

  // WebRTC refs
  const peers = useRef({}); // peerId -> RTCPeerConnection
  const pendingCandidates = useRef({}); // peerId -> [candidates]
  const previewStream = useRef(null); // host's local stream
  const hostId = useRef(null); // store host ID for viewers

  // Check if running in Electron
  const isElectron = typeof window !== "undefined" && window.electronAPI?.isElectron;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
      previewStream.current?.getTracks().forEach(t => t.stop());
      Object.values(peers.current).forEach(pc => {
        try { pc.close(); } catch (e) { }
      });
    };
  }, []);

  // Safe ICE candidate adder
  async function safeAddIce(pc, candidate) {
    if (!candidate) return;

    if (!pc.remoteDescription || !pc.remoteDescription.type) {
      const id = pc.__peerId;
      if (!pendingCandidates.current[id]) {
        pendingCandidates.current[id] = [];
      }
      pendingCandidates.current[id].push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(candidate);
    } catch (e) {
      console.error("[ICE] Error adding candidate:", e);
    }
  }

  // Flush pending candidates
  async function flushPendingCandidates(peerId) {
    const arr = pendingCandidates.current[peerId] || [];
    const pc = peers.current[peerId];
    if (!pc || arr.length === 0) return;

    for (const c of arr) {
      try {
        await pc.addIceCandidate(c);
      } catch (e) {
        console.warn("[ICE] Failed to add queued candidate:", e);
      }
    }
    pendingCandidates.current[peerId] = [];
  }

  // Load screen sources (Electron only)
  async function loadSourcesIfElectron() {
    if (!isElectron) return;
    try {
      const srcs = await window.electronAPI.getScreenSources();
      setSources(srcs || []);
      if (srcs && srcs.length > 0) {
        setSelectedSource(srcs[0]);
      }
    } catch (e) {
      console.error("[Electron] Failed to load screen sources:", e);
    }
  }

  // Start preview stream for host
  async function startPreviewForHost() {
    previewStream.current?.getTracks().forEach(t => t.stop());

    let stream = null;
    try {
      if (isElectron && selectedSource) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: selectedSource.id,
            },
          },
        });
      } else {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" },
          audio: false,
        });
      }

      previewStream.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      Object.values(peers.current).forEach(pc => {
        pc.getSenders().forEach(sender => pc.removeTrack(sender));
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
      });

    } catch (err) {
      console.error("[Host] Preview failed:", err);
      alert("Failed to start screen capture: " + err.message);
    }
  }

  // Create peer connection
  function createPeerConnection(peerId, isOfferer) {
    const pc = new RTCPeerConnection({ iceServers: config.ICE_SERVERS });
    pc.__peerId = peerId;

    pc.onicecandidate = (e) => {
      if (e.candidate && socket.current) {
        socket.current.emit("ice-candidate", {
          target: peerId,
          candidate: e.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setConnectionStatus("connected");
      } else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        setConnectionStatus("disconnected");
        try { pc.close(); } catch (e) { }
        delete peers.current[peerId];
      }
    };

    return pc;
  }

  // Handle permission request (HOST ONLY)
  function handleGrantPermissions(viewerId, viewerName, permissions) {
    socket.current.emit("grant-permissions", {
      roomId,
      viewerId,
      permissions
    });
    setPendingPermissionRequest(null);
  }

  // Execute remote control command (HOST ONLY)
  async function executeRemoteCommand(type, data) {
    if (!isElectron || !window.electronAPI.remoteControl) {
      console.warn("[Remote Control] Not available in browser mode");
      return;
    }

    try {
      switch (type) {
        case "mouse-move":
          await window.electronAPI.remoteControl.executeMouseMove(data.x, data.y);
          break;
        case "mouse-click":
          await window.electronAPI.remoteControl.executeMouseClick(data.button, data.x, data.y);
          break;
        case "mouse-scroll":
          await window.electronAPI.remoteControl.executeMouseScroll(data.deltaX, data.deltaY);
          break;
        case "keyboard":
          await window.electronAPI.remoteControl.executeKeyboard(data.key, data.action);
          break;
      }
    } catch (err) {
      console.error("[Remote Control] Execution error:", err);
    }
  }

  // Convert video click to screen coordinates
  function getScreenCoordinates(event) {
    const rect = videoRef.current.getBoundingClientRect();
    const xPercent = (event.clientX - rect.left) / rect.width;
    const yPercent = (event.clientY - rect.top) / rect.height;

    // Assume 1920x1080 for now - could be dynamic
    const screenWidth = 1920;
    const screenHeight = 1080;

    return {
      x: Math.round(xPercent * screenWidth),
      y: Math.round(yPercent * screenHeight)
    };
  }

  // Send remote control event (VIEWER ONLY)
  function sendRemoteControl(type, data) {
    if (!hostId.current || !socket.current) return;

    const eventName = `remote-${type}`;
    socket.current.emit(eventName, {
      target: hostId.current,
      ...data
    });
  }

  // Video event handlers for remote control (VIEWER ONLY)
  const handleVideoMouseMove = (e) => {
    if (!myPermissions.mouseControl || !remoteControlActive) return;
    const coords = getScreenCoordinates(e);
    sendRemoteControl("mouse-move", coords);
  };

  const handleVideoClick = (e) => {
    if (!myPermissions.mouseControl || !remoteControlActive) return;
    e.preventDefault();
    const coords = getScreenCoordinates(e);
    const button = e.button === 2 ? "right" : e.button === 1 ? "middle" : "left";
    sendRemoteControl("mouse-click", { ...coords, button });
  };

  const handleVideoWheel = (e) => {
    if (!myPermissions.mouseControl || !remoteControlActive) return;
    e.preventDefault();
    sendRemoteControl("mouse-scroll", { deltaX: e.deltaX, deltaY: e.deltaY });
  };

  const handleVideoKeyDown = (e) => {
    if (!myPermissions.keyboardControl || !remoteControlActive) return;
    e.preventDefault();

    if (e.key.length === 1) {
      // Regular character
      sendRemoteControl("keyboard", { key: e.key, action: "type" });
    } else {
      // Special key
      sendRemoteControl("keyboard", { key: e.key, action: "press" });
    }
  };

  // Join room
  async function joinRoom() {
    if (!roomId.trim()) {
      alert("Please enter a room ID");
      return;
    }

    if (!userName.trim()) {
      alert("Please enter your name");
      return;
    }

    setConnectionStatus("connecting");

    if (!socket.current) {
      socket.current = io(config.SIGNALING_SERVER, config.SOCKET_OPTIONS);
    }

    const s = socket.current;
    s.off();

    // Socket connection events
    s.on("connect", () => {
      console.log("[Socket] Connected:", s.id);
      setConnectionStatus("connected");
    });

    s.on("disconnect", () => {
      setConnectionStatus("disconnected");
    });

    s.on("connect_error", (err) => {
      console.error("[Socket] Error:", err);
      setConnectionStatus("error");
      alert("Failed to connect to server");
    });

    s.on("error", ({ message }) => {
      console.error("[Socket] Error:", message);
      alert("Error: " + message);
    });

    // Chat messages
    s.on("chat-message", ({ sender, senderName, message }) => {
      const name = sender === s.id ? "Me" : (senderName || sender);
      setMessages(prev => [...prev, { sender: name, message }]);
    });

    // ===== PERMISSION EVENTS =====

    // HOST: New viewer joins - show permission request
    s.on("new-viewer", async ({ viewerId, viewerName }) => {
      console.log(`[Host] New viewer: ${viewerName}`);
      setPendingPermissionRequest({ viewerId, viewerName });

      // Create WebRTC connection
      if (!previewStream.current) {
        await startPreviewForHost();
      }

      const pc = createPeerConnection(viewerId, true);
      peers.current[viewerId] = pc;

      previewStream.current.getTracks().forEach(track => {
        pc.addTrack(track, previewStream.current);
      });

      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: false,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        s.emit("offer", { target: viewerId, sdp: offer });
      } catch (err) {
        console.error("[Host] Offer error:", err);
      }
    });

    // VIEWER: Permissions granted
    s.on("permissions-granted", ({ permissions }) => {
      console.log("[Viewer] Permissions granted:", permissions);
      setMyPermissions(permissions);
      alert(`Permissions granted!\nMouse: ${permissions.mouseControl ? '✓' : '✗'}\nKeyboard: ${permissions.keyboardControl ? '✓' : '✗'}\nFile Access: ${permissions.fileAccess ? '✓' : '✗'}`);
    });

    // ===== REMOTE CONTROL EVENTS (HOST RECEIVES) =====

    s.on("remote-mouse-move", ({ x, y, sender }) => {
      executeRemoteCommand("mouse-move", { x, y });
    });

    s.on("remote-mouse-click", ({ button, x, y, sender }) => {
      executeRemoteCommand("mouse-click", { button, x, y });
    });

    s.on("remote-mouse-scroll", ({ deltaX, deltaY, sender }) => {
      executeRemoteCommand("mouse-scroll", { deltaX, deltaY });
    });

    s.on("remote-keyboard", ({ key, action, sender }) => {
      executeRemoteCommand("keyboard", { key, action });
    });

    // ===== WEBRTC SIGNALING =====

    // VIEWER: Receive offer from host
    s.on("offer", async ({ sdp, sender }) => {
      console.log(`[Viewer] Offer from ${sender}`);
      hostId.current = sender; // Store host ID

      const pc = createPeerConnection(sender, false);
      peers.current[sender] = pc;

      pc.ontrack = (event) => {
        console.log("[Viewer] Received track");
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
        }
      };

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushPendingCandidates(sender);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        s.emit("answer", { target: sender, sdp: answer });
      } catch (err) {
        console.error("[Viewer] Offer handling error:", err);
      }
    });

    // HOST: Receive answer from viewer
    s.on("answer", async ({ sdp, sender }) => {
      console.log(`[Host] Answer from ${sender}`);

      const pc = peers.current[sender];
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushPendingCandidates(sender);
      } catch (err) {
        console.error("[Host] Answer handling error:", err);
      }
    });

    // SHARED: ICE candidates
    s.on("ice-candidate", async ({ candidate, sender }) => {
      const pc = peers.current[sender];
      if (pc) {
        await safeAddIce(pc, new RTCIceCandidate(candidate));
      } else {
        if (!pendingCandidates.current[sender]) {
          pendingCandidates.current[sender] = [];
        }
        pendingCandidates.current[sender].push(new RTCIceCandidate(candidate));
      }
    });

    s.on("host-left", ({ message }) => {
      alert(message);
      setConnectionStatus("disconnected");
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    });

    s.on("waiting-for-host", ({ message }) => {
      setConnectionStatus("waiting");
    });

    s.on("host-ready", ({ hostId: hId }) => {
      hostId.current = hId;
      setConnectionStatus("connected");
    });

    // Emit join-room
    s.emit("join-room", { roomId, isHost, userName });

    // If host, load sources and start preview
    if (isHost) {
      await loadSourcesIfElectron();
      await startPreviewForHost();
    }

    setRoomJoined(true);
  }

  // Send chat message
  const sendMessage = () => {
    const msg = messageRef.current?.value?.trim();
    if (!msg) return;

    socket.current.emit("chat-message", { roomId, message: msg });
    setMessages(prev => [...prev, { sender: "Me", message: msg }]);

    if (messageRef.current) {
      messageRef.current.value = "";
    }
  };

  // React to source changes
  useEffect(() => {
    if (isHost && roomJoined && selectedSource) {
      startPreviewForHost();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSource]);

  // Connection status color
  const getStatusColor = () => {
    switch (connectionStatus) {
      case "connected": return "#0f0";
      case "connecting": return "#ff0";
      case "waiting": return "#fa0";
      case "error": return "#f00";
      default: return "#888";
    }
  };

  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", padding: 20 }}>
      {!roomJoined ? (
        <div style={{ maxWidth: 500, margin: "0 auto", paddingTop: 50 }}>
          <h1 style={{ marginBottom: 30 }}>🖥️ Remote Desktop Control</h1>

          <div style={{ marginBottom: 20 }}>
            <input
              placeholder="Your Name"
              value={userName}
              onChange={e => setUserName(e.target.value)}
              style={{
                padding: 12,
                width: "100%",
                fontSize: 16,
                borderRadius: 4,
                border: "1px solid #444",
                background: "#111",
                color: "#fff"
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <input
              placeholder="Room ID"
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              style={{
                padding: 12,
                width: "100%",
                fontSize: 16,
                borderRadius: 4,
                border: "1px solid #444",
                background: "#111",
                color: "#fff"
              }}
            />
          </div>

          <div style={{ margin: "20px 0", display: "flex", gap: 20 }}>
            <label style={{ cursor: "pointer" }}>
              <input
                type="radio"
                checked={isHost}
                onChange={() => setIsHost(true)}
                style={{ marginRight: 8 }}
              />
              <strong>Host</strong> (Share screen)
            </label>
            <label style={{ cursor: "pointer" }}>
              <input
                type="radio"
                checked={!isHost}
                onChange={() => setIsHost(false)}
                style={{ marginRight: 8 }}
              />
              <strong>Viewer</strong> (Control remotely)
            </label>
          </div>

          <div style={{ marginBottom: 20, padding: 10, background: "#222", borderRadius: 4 }}>
            {isElectron ? (
              <span style={{ color: "#6f6" }}>✓ Running in Electron</span>
            ) : (
              <span style={{ color: "#6cf" }}>ℹ Running in Browser</span>
            )}
          </div>

          <button
            onClick={joinRoom}
            disabled={connectionStatus === "connecting"}
            style={{
              padding: 15,
              width: "100%",
              fontSize: 18,
              fontWeight: "bold",
              borderRadius: 4,
              border: "none",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "#fff",
              cursor: "pointer",
              opacity: connectionStatus === "connecting" ? 0.6 : 1
            }}
          >
            {connectionStatus === "connecting" ? "Connecting..." : "Join Room"}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h1 style={{ margin: 0 }}>
                {isHost ? "🎥 Host Control Panel" : "🎮 Remote Control"}
              </h1>
              <p style={{ margin: "5px 0", color: "#888" }}>
                Room: <strong style={{ color: "#fff" }}>{roomId}</strong> •
                User: <strong style={{ color: "#6cf" }}> {userName}</strong>
              </p>
            </div>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              background: "#222",
              borderRadius: 20
            }}>
              <div style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: getStatusColor(),
                boxShadow: `0 0 10px ${getStatusColor()}`
              }} />
              <span style={{ fontSize: 14, textTransform: "capitalize" }}>
                {connectionStatus}
              </span>
            </div>
          </div>

          {/* Permission Modal (Host Only) */}
          {isHost && pendingPermissionRequest && (
            <div style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "#222",
              padding: 30,
              borderRadius: 12,
              boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
              zIndex: 1000,
              minWidth: 400
            }}>
              <h2 style={{ marginTop: 0, color: "#6cf" }}>🔐 Permission Request</h2>
              <p><strong>{pendingPermissionRequest.viewerName}</strong> wants to control this computer.</p>

              <div style={{ margin: "20px 0" }}>
                <label style={{ display: "block", marginBottom: 10, cursor: "pointer" }}>
                  <input type="checkbox" id="mouseControl" style={{ marginRight: 10 }} />
                  <strong>🖱️ Allow Mouse Control</strong>
                  <div style={{ fontSize: 12, color: "#888", marginLeft: 28 }}>Move cursor, click, and scroll</div>
                </label>

                <label style={{ display: "block", marginBottom: 10, cursor: "pointer" }}>
                  <input type="checkbox" id="keyboardControl" style={{ marginRight: 10 }} />
                  <strong>⌨️ Allow Keyboard Control</strong>
                  <div style={{ fontSize: 12, color: "#888", marginLeft: 28 }}>Type and use keyboard shortcuts</div>
                </label>

                <label style={{ display: "block", marginBottom: 10, cursor: "pointer" }}>
                  <input type="checkbox" id="fileAccess" style={{ marginRight: 10 }} />
                  <strong>📁 Allow File Access</strong>
                  <div style={{ fontSize: 12, color: "#888", marginLeft: 28 }}>Create, edit, and delete files</div>
                </label>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => {
                    const permissions = {
                      mouseControl: document.getElementById("mouseControl").checked,
                      keyboardControl: document.getElementById("keyboardControl").checked,
                      fileAccess: document.getElementById("fileAccess").checked
                    };
                    handleGrantPermissions(
                      pendingPermissionRequest.viewerId,
                      pendingPermissionRequest.viewerName,
                      permissions
                    );
                  }}
                  style={{
                    flex: 1,
                    padding: 12,
                    fontSize: 16,
                    fontWeight: "bold",
                    borderRadius: 6,
                    border: "none",
                    background: "#0f0",
                    color: "#000",
                    cursor: "pointer"
                  }}
                >
                  ✓ Allow
                </button>
                <button
                  onClick={() => setPendingPermissionRequest(null)}
                  style={{
                    flex: 1,
                    padding: 12,
                    fontSize: 16,
                    fontWeight: "bold",
                    borderRadius: 6,
                    border: "none",
                    background: "#f00",
                    color: "#fff",
                    cursor: "pointer"
                  }}
                >
                  ✗ Deny
                </button>
              </div>
            </div>
          )}

          {/* Overlay backdrop */}
          {isHost && pendingPermissionRequest && (
            <div style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.7)",
              zIndex: 999
            }} />
          )}

          {/* Viewer: Remote Control Status */}
          {!isHost && (
            <div style={{ marginBottom: 15, padding: 15, background: "#222", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>Remote Control Status:</strong>
                  <div style={{ fontSize: 14, color: "#888", marginTop: 5 }}>
                    Mouse: {myPermissions.mouseControl ? "✓ Enabled" : "✗ Disabled"} •
                    Keyboard: {myPermissions.keyboardControl ? " ✓ Enabled" : " ✗ Disabled"}
                  </div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={remoteControlActive}
                    onChange={e => setRemoteControlActive(e.target.checked)}
                    disabled={!myPermissions.mouseControl && !myPermissions.keyboardControl}
                  />
                  <span style={{ fontWeight: "bold", color: remoteControlActive ? "#0f0" : "#888" }}>
                    {remoteControlActive ? "🎮 Active" : "⏸️ Paused"}
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Host: Source selector */}
          {isHost && isElectron && sources.length > 0 && (
            <div style={{ marginBottom: 15 }}>
              <label style={{ marginRight: 10 }}>Screen/Window:</label>
              <select
                value={selectedSource?.id || ""}
                onChange={e => setSelectedSource(sources.find(s => s.id === e.target.value))}
                style={{
                  padding: 8,
                  fontSize: 14,
                  borderRadius: 4,
                  border: "1px solid #444",
                  background: "#111",
                  color: "#fff"
                }}
              >
                {sources.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Video element with remote control event handlers */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isHost}
            onMouseMove={!isHost ? handleVideoMouseMove : undefined}
            onClick={!isHost ? handleVideoClick : undefined}
            onContextMenu={!isHost ? handleVideoClick : undefined}
            onWheel={!isHost ? handleVideoWheel : undefined}
            onKeyDown={!isHost ? handleVideoKeyDown : undefined}
            tabIndex={!isHost ? 0 : undefined}
            style={{
              width: "100%",
              maxWidth: "1200px",
              background: "#000",
              border: `3px solid ${connectionStatus === "connected" ? "#0f0" : "#444"}`,
              borderRadius: 8,
              display: "block",
              cursor: !isHost && remoteControlActive ? "crosshair" : "default"
            }}
          />

          {/* Chat */}
          <div style={{ marginTop: 30, maxWidth: 800 }}>
            <h3 style={{ marginBottom: 10 }}>💬 Chat</h3>
            <div style={{
              height: 150,
              overflowY: "auto",
              background: "#111",
              padding: 15,
              borderRadius: 8,
              marginBottom: 10
            }}>
              {messages.length === 0 ? (
                <p style={{ color: "#666", margin: 0 }}>No messages yet...</p>
              ) : (
                messages.map((m, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <strong style={{ color: m.sender === "Me" ? "#6cf" : "#f90" }}>
                      {m.sender}:
                    </strong>{" "}
                    <span>{m.message}</span>
                  </div>
                ))
              )}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                ref={messageRef}
                placeholder="Type a message..."
                onKeyPress={e => e.key === "Enter" && sendMessage()}
                style={{
                  flex: 1,
                  padding: 10,
                  fontSize: 14,
                  borderRadius: 4,
                  border: "1px solid #444",
                  background: "#111",
                  color: "#fff"
                }}
              />
              <button
                onClick={sendMessage}
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  borderRadius: 4,
                  border: "none",
                  background: "#667eea",
                  color: "#fff",
                  cursor: "pointer"
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
