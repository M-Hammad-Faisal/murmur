import path from 'path'

import { Tray, Menu, nativeImage, app } from 'electron'
import type { BrowserWindow } from 'electron'

let tray: Tray | null = null

export function createTray(win: BrowserWindow, onQuit: () => void): Tray {
  const iconPath = path.join(__dirname, '../resources/icons/tray.png')
  let icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty()) icon = nativeImage.createEmpty()
  // macOS menu bar icons should be 16×16 pt (32×32 looks oversized)
  if (process.platform === 'darwin') icon = icon.resize({ width: 16, height: 16 })

  tray = new Tray(icon)

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Murmur',
      click: () => {
        win.show()
        if (process.platform === 'darwin') app.dock?.show()
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Murmur',
      click: () => {
        onQuit()
        app.quit()
      },
    },
  ])

  tray.setToolTip('Murmur — Personal Broadcaster')
  tray.setContextMenu(menu)

  tray.on('click', () => {
    if (win.isVisible()) win.focus()
    else win.show()
    if (process.platform === 'darwin') app.dock?.show()
  })

  return tray
}
