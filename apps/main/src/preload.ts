import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('murmurBridge', {
  getVersion: (): Promise<string> => ipcRenderer.invoke('get-version'),
  getAppPath: (): Promise<string> => ipcRenderer.invoke('get-app-path'),
  platform: process.platform,
})
