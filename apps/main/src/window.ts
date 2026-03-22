import path from 'path'

import { BrowserWindow, app } from 'electron'

const isDev = !app.isPackaged

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1120,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0d1b2a',
    show: false,
  })

  if (isDev) {
    void win.loadURL('http://localhost:3000')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    // Use custom app:// protocol so absolute paths like /setup/ resolve correctly
    void win.loadURL('app://localhost/setup/')
  }

  win.once('ready-to-show', () => win.show())

  return win
}
