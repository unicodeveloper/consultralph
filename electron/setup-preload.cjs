const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("setupBridge", {
  validateAndSaveKey: (key) =>
    ipcRenderer.invoke("setup:validate-and-save-key", key),
  openExternal: (url) => ipcRenderer.send("setup:open-external", url),
});
