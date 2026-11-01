const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tripPlanner', Object.freeze({
  load: () => ipcRenderer.invoke('trip:load'),
  saveTrip: (input) => ipcRenderer.invoke('trip:saveTrip', input),
  saveQuote: (input) => ipcRenderer.invoke('trip:saveQuote', input),
  markAlert: (id) => ipcRenderer.invoke('trip:markAlert', id),
  setSettings: (input) => ipcRenderer.invoke('trip:setSettings', input),
  openSource: (id) => ipcRenderer.invoke('trip:openSource', id),
  copySearch: () => ipcRenderer.invoke('trip:copySearch'),
  testNotification: () => ipcRenderer.invoke('trip:testNotification'),
  exportData: () => ipcRenderer.invoke('trip:exportData'),
  importData: () => ipcRenderer.invoke('trip:importData'),
}));
