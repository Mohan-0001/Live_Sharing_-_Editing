## 🔍 Remote Control Debugging Guide

Follow these steps to identify where the remote control is failing:

### Step 1: Check Viewer (Browser Console)

Open browser DevTools (F12) on the viewer side. You should see:

```
[Viewer] Calculated coords: X, Y (percent: XX%, YY%)
[Viewer] Sending remote-mouse-click: {x: XX, y: YY, button: "left"}
```

**If you DON'T see these logs:**
- Problem: Events not being captured
- Check: Is "Active" toggle ON?
- Check: Are permissions granted? (Mouse Control: ✓)
- Fix: Click on the video element to focus it

### Step 2: Check Signaling Server (Terminal 1)

In the signaling server terminal, you should see:

```
[TIMESTAMP] Received ICE candidate from client: SOCKET_ID
```

**If you DON'T see permission grants:**
- Problem: Permissions not being sent
- Check: Did host click "Allow" on permission modal?

### Step 3: Check Host (Electron Console)

In Electron DevTools, you should see:

```
[Host] Received remote-mouse-click from: VIEWER_ID
[Remote Control] Mouse click: left at XX, YY
[Remote Control] Execution error: (if any)
```

**If you DON'T see "Received remote" logs:**
- Problem: Events not reaching host
- Check: Is WebRTC connection established?
- Check: Server logs for forwarding

**If you see "Execution error":**
- Problem: nut.js failing
- Check: Error message
- Common: Permission issues, screen locked

### Step 4: Check Permissions

Browser console should show after host grants:
```
[Viewer] Permissions granted: {mouseControl: true, keyboardControl: true, fileAccess: false}
```

### Common Issues:

1. **"Active" toggle is OFF**
   - Viewer must toggle it ON after permissions granted
   
2. **Video element not focused**
   - Click on the video before trying to control
   
3. **Wrong coordinates**
   - Coordinates should match video resolution
   
4. **nut.js not installed**
   - Check: `@nut-tree-fork/nut-js` in package.json

5. **Screen locked or permission denied**
   - macOS: Grant Accessibility permissions
   - Windows: Run as Administrator if needed

### Quick Test:

1. **Viewer browser console, run:**
   ```javascript
   console.log("Permissions:", window.location.href);
   ```

2. **Check if socket is connected:**
   ```javascript
   // Should show connected socket
   ```

3. **Manual event send test:**
   ```javascript
   // In browser console (viewer):
   // This will be available if you expose it for debugging
   ```

### Next Steps:

Run through each step and tell me:
1. What logs do you see in browser console?
2. What logs do you see in Electron console?
3. What logs do you see in server console?
4. Is the "Active" toggle ON?
5. Did you grant permissions?

This will help me identify exactly where the issue is.
