const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pickerAPI', {
  onSources: (callback) => ipcRenderer.on('sources', (_event, list) => callback(list)),
  select: (id) => ipcRenderer.send('picker-select', id),
  cancel: () => ipcRenderer.send('picker-cancel'),
});
