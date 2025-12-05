// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getScreenSources: async () => {
    return await ipcRenderer.invoke("get-screen-sources");
  },
  // Expose a flag so renderer knows it's running in Electron
  isElectron: true,

  // Remote control APIs
  remoteControl: {
    executeMouseMove: async (x, y) => {
      return await ipcRenderer.invoke("execute-mouse-move", x, y);
    },
    executeMouseClick: async (button, x, y) => {
      return await ipcRenderer.invoke("execute-mouse-click", button, x, y);
    },
    executeMouseDblClick: async (x, y) => {
      return await ipcRenderer.invoke("execute-mouse-dblclick", x, y);
    },
    executeMouseScroll: async (deltaX, deltaY) => {
      return await ipcRenderer.invoke("execute-mouse-scroll", deltaX, deltaY);
    },
    executeKeyboard: async (key, action, ctrlKey, shiftKey, altKey) => {
      return await ipcRenderer.invoke("execute-keyboard", key, action, ctrlKey, shiftKey, altKey);
    },
  },

  // Clipboard APIs
  clipboard: {
    readText: async () => {
      return await ipcRenderer.invoke("clipboard-read-text");
    },
    writeText: async (text) => {
      return await ipcRenderer.invoke("clipboard-write-text", text);
    },
  },
});
