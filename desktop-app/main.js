const { app, BrowserWindow, desktopCapturer, session, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;
let pickerWindow = null;
let pendingCallback = null;
let currentSources = [];

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    title: 'ScreenShare',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // permite getUserMedia (microfone) sem prompt extra do SO em alguns casos
      backgroundThrottling: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createMainWindow();

  // Intercepta o pedido de getDisplayMedia() do client.js e mostra
  // um seletor de telas/janelas próprio (o navegador normal já faz
  // isso automaticamente, mas dentro do Electron precisamos fazer manualmente).
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    pendingCallback = callback;
    openPicker();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

async function openPicker() {
  currentSources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 300, height: 200 },
  });

  pickerWindow = new BrowserWindow({
    width: 680,
    height: 520,
    parent: mainWindow,
    modal: true,
    resizable: false,
    title: 'Escolha o que compartilhar',
    webPreferences: {
      preload: path.join(__dirname, 'picker-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  pickerWindow.setMenuBarVisibility(false);
  pickerWindow.loadFile(path.join(__dirname, 'picker.html'));

  pickerWindow.webContents.once('did-finish-load', () => {
    const list = currentSources.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL(),
    }));
    pickerWindow.webContents.send('sources', list);
  });

  pickerWindow.on('closed', () => {
    pickerWindow = null;
    // se a janela foi fechada sem escolher nada, cancela o compartilhamento
    if (pendingCallback) {
      pendingCallback({});
      pendingCallback = null;
    }
  });
}

ipcMain.on('picker-select', (_event, sourceId) => {
  const source = currentSources.find((s) => s.id === sourceId);
  if (pendingCallback) {
    if (source) {
      // 'loopback' tenta capturar o áudio do sistema (funciona bem no Windows)
      pendingCallback({ video: source, audio: 'loopback' });
    } else {
      pendingCallback({});
    }
    pendingCallback = null;
  }
  if (pickerWindow) {
    pickerWindow.removeAllListeners('closed');
    pickerWindow.close();
    pickerWindow = null;
  }
});

ipcMain.on('picker-cancel', () => {
  if (pendingCallback) {
    pendingCallback({});
    pendingCallback = null;
  }
  if (pickerWindow) {
    pickerWindow.removeAllListeners('closed');
    pickerWindow.close();
    pickerWindow = null;
  }
});
