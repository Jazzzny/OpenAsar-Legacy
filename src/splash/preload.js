const { contextBridge, ipcRenderer } = require('electron');


contextBridge.exposeInMainWorld('Splash', {
  onState: callback => ipcRenderer.on('DISCORD_SPLASH_UPDATE_STATE', (_, state) => callback(state)),
  quit: () => ipcRenderer.send('DISCORD_SPLASH_SCREEN_QUIT'),
  skip: () => ipcRenderer.send('DISCORD_SPLASH_SCREEN_READY')
});

