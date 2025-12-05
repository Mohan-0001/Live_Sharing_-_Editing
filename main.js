// main.js - Electron main process with remote control support
const { app, BrowserWindow, ipcMain, desktopCapturer } = require("electron");
const path = require("path");

let mainWindow;

// Create the Electron browser window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the React dev server in development
  mainWindow.loadURL("http://localhost:3000");

  // Open DevTools in development
  mainWindow.webContents.openDevTools({ mode: "detach" });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// App ready event
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC handler for desktop capturer
ipcMain.handle("get-screen-sources", async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 500, height: 300 },
      fetchWindowIcons: true,
    });

    return sources.map((source) => ({
      id: source.id,
      name: source.name || "Unknown",
      thumb: source.thumbnail.toDataURL(),
    }));
  } catch (err) {
    console.error("Desktop capturer error:", err);
    return [];
  }
});

// ========== REMOTE CONTROL IPC HANDLERS (using nut.js) ==========

const { mouse, Button, keyboard, Key } = require("@nut-tree-fork/nut-js");

// Configure nut.js for better performance
mouse.config.autoDelayMs = 0; // No delay for mouse movements
mouse.config.mouseSpeed = 10000; // Faster mouse movement

// Execute mouse movement
ipcMain.handle("execute-mouse-move", async (event, x, y) => {
  try {
    console.log(`[Remote Control] Mouse move to: ${x}, ${y}`);
    await mouse.setPosition({ x: Math.round(x), y: Math.round(y) });
    return { success: true };
  } catch (err) {
    console.error("Mouse move error:", err);
    return { success: false, error: err.message };
  }
});

// Execute mouse click
ipcMain.handle("execute-mouse-click", async (event, button, x, y) => {
  try {
    console.log(`[Remote Control] Mouse click: ${button} at ${x}, ${y}`);

    // Move to position first if coordinates provided
    if (x !== undefined && y !== undefined) {
      await mouse.setPosition({ x: Math.round(x), y: Math.round(y) });
    }

    // Determine button
    let mouseButton = Button.LEFT;
    if (button === "right" || button === 2) {
      mouseButton = Button.RIGHT;
    } else if (button === "middle" || button === 1) {
      mouseButton = Button.MIDDLE;
    }

    await mouse.click(mouseButton);
    return { success: true };
  } catch (err) {
    console.error("Mouse click error:", err);
    return { success: false, error: err.message };
  }
});

// Execute mouse double click
ipcMain.handle("execute-mouse-dblclick", async (event, x, y) => {
  try {
    console.log(`[Remote Control] Double click at ${x}, ${y}`);
    if (x !== undefined && y !== undefined) {
      await mouse.setPosition({ x: Math.round(x), y: Math.round(y) });
    }
    await mouse.doubleClick(Button.LEFT);
    return { success: true };
  } catch (err) {
    console.error("Mouse double click error:", err);
    return { success: false, error: err.message };
  }
});

// Execute mouse scroll
ipcMain.handle("execute-mouse-scroll", async (event, deltaX, deltaY) => {
  try {
    console.log(`[Remote Control] Scroll: deltaY=${deltaY}`);

    // Convert browser delta to scroll amount
    // Positive deltaY = scroll down, negative = scroll up
    const scrollAmount = Math.round(Math.abs(deltaY) / 50);

    if (scrollAmount > 0) {
      if (deltaY > 0) {
        // Scroll down
        await mouse.scrollDown(scrollAmount);
      } else {
        // Scroll up
        await mouse.scrollUp(scrollAmount);
      }
    }

    return { success: true };
  } catch (err) {
    console.error("Mouse scroll error:", err);
    return { success: false, error: err.message };
  }
});

// Execute keyboard input
ipcMain.handle("execute-keyboard", async (event, key, action) => {
  try {
    console.log(`[Remote Control] Keyboard: ${action} key=${key}`);

    if (action === "type") {
      // Type a string
      await keyboard.type(key);
    } else if (action === "press") {
      // Press a special key
      const nutKey = mapKeyToNutKey(key);
      if (nutKey) {
        await keyboard.type(nutKey);
      } else {
        // If not a special key, just type it
        await keyboard.type(key);
      }
    }
    return { success: true };
  } catch (err) {
    console.error("Keyboard input error:", err);
    return { success: false, error: err.message };
  }
});

// Helper function to map browser keys to nut.js keys
function mapKeyToNutKey(key) {
  const keyMap = {
    "Enter": Key.Enter,
    "Backspace": Key.Backspace,
    "Delete": Key.Delete,
    "Tab": Key.Tab,
    "Escape": Key.Escape,
    "ArrowUp": Key.Up,
    "ArrowDown": Key.Down,
    "ArrowLeft": Key.Left,
    "ArrowRight": Key.Right,
    "Home": Key.Home,
    "End": Key.End,
    "PageUp": Key.PageUp,
    "PageDown": Key.PageDown,
    "Space": Key.Space,
    " ": Key.Space,
    "Control": Key.LeftControl,
    "Shift": Key.LeftShift,
    "Alt": Key.LeftAlt,
    "Meta": Key.LeftCmd,
  };

  return keyMap[key] || null;
}

// ========== END REMOTE CONTROL HANDLERS ==========

console.log("Electron app initialized with remote control support");
