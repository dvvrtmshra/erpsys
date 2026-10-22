const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setTitlebarTheme: (theme) => ipcRenderer.send('titlebar-theme', theme),
});
