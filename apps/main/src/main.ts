import fs from 'fs'
import os from 'os'
import path from 'path'

import { BrowserWindow, app, dialog, ipcMain, net, protocol } from 'electron'

import { createTray } from './tray'
import { createMainWindow } from './window'

// Register before app is ready — must be top-level
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

let isQuitting = false

async function startServer(): Promise<void> {
  // Set user data path into env so the server can find the DB
  process.env['MURMUR_USER_DATA'] = app.getPath('userData')
  process.env['MURMUR_SESSIONS'] = path.join(app.getPath('userData'), 'sessions')

  // Help Puppeteer (used by whatsapp-web.js) find Chrome in the packaged app.
  // Check common macOS / Linux locations; also check puppeteer's own cache.
  if (!process.env['PUPPETEER_EXECUTABLE_PATH']) {
    const homeDir = os.homedir()
    const puppeteerCacheDir = path.join(homeDir, '.cache', 'puppeteer')

    // Point puppeteer at its cache so it finds its own downloaded Chrome
    process.env['PUPPETEER_CACHE_DIR'] = puppeteerCacheDir

    // Also check well-known system Chrome locations (macOS, Windows, Linux)
    const candidates: string[] = [
      // macOS
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      path.join(homeDir, 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
      // Windows — Program Files (x64 and x86), and per-user AppData
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(homeDir, 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      // Linux
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ]
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        process.env['PUPPETEER_EXECUTABLE_PATH'] = c
        break
      }
    }

    // Check if puppeteer's own cached Chrome exists as well
    const puppeteerChromePath = (() => {
      if (!fs.existsSync(puppeteerCacheDir)) return null
      // e.g. ~/.cache/puppeteer/chrome/mac_arm-X/chrome-mac-arm64/Google Chrome for Testing.app/...
      try {
        const dirs = fs.readdirSync(path.join(puppeteerCacheDir, 'chrome'))
        for (const d of dirs) {
          const candidates2 = [
            path.join(
              puppeteerCacheDir,
              'chrome',
              d,
              'chrome-mac-arm64',
              'Google Chrome for Testing.app',
              'Contents',
              'MacOS',
              'Google Chrome for Testing',
            ),
            path.join(
              puppeteerCacheDir,
              'chrome',
              d,
              'chrome-mac',
              'Google Chrome for Testing.app',
              'Contents',
              'MacOS',
              'Google Chrome for Testing',
            ),
            path.join(puppeteerCacheDir, 'chrome', d, 'chrome-linux64', 'chrome'),
            // Windows
            path.join(puppeteerCacheDir, 'chrome', d, 'chrome-win64', 'chrome.exe'),
            path.join(puppeteerCacheDir, 'chrome', d, 'chrome-win32', 'chrome.exe'),
          ]
          for (const p of candidates2) {
            if (fs.existsSync(p)) return p
          }
        }
      } catch {
        /* ignore */
      }
      return null
    })()

    if (puppeteerChromePath && !process.env['PUPPETEER_EXECUTABLE_PATH']) {
      process.env['PUPPETEER_EXECUTABLE_PATH'] = puppeteerChromePath
    }

    // Warn if no Chrome found anywhere — WhatsApp QR will not work
    if (!process.env['PUPPETEER_EXECUTABLE_PATH'] && !puppeteerChromePath) {
      console.warn('[Murmur] No Chrome found — WhatsApp QR will not work')
      process.env['MURMUR_NO_CHROME'] = '1'
    }
  }

  const isDev = !app.isPackaged

  if (isDev) {
    // Dev: server lives as a workspace package
    const { startServer: start } = await import('@murmur/server')
    await start()
  } else {
    // Prod: server was compiled and placed in resources/server/
    const serverPath = path.join(process.resourcesPath, 'server', 'index.js')
    const logPath = path.join(app.getPath('userData'), 'server-error.log')

    try {
      const { startServer: start } = require(serverPath) as { startServer: () => Promise<void> }
      await start()
    } catch (err) {
      const msg = err instanceof Error ? `${err.message}\n\n${err.stack ?? ''}` : String(err)
      fs.writeFileSync(
        logPath,
        `[${new Date().toISOString()}]\n${msg}\n\nserverPath: ${serverPath}\n`,
      )
      throw err
    }
  }
}

async function bootstrap(): Promise<void> {
  // In prod, serve renderer files via app:// so Next.js routing works from file://
  if (app.isPackaged) {
    const rendererDir = path.join(process.resourcesPath, 'renderer')
    protocol.handle('app', (request) => {
      const { pathname } = new URL(request.url)
      const filePath = path.extname(pathname)
        ? path.join(rendererDir, pathname)
        : path.join(rendererDir, pathname, 'index.html')
      return net.fetch(`file://${filePath}`)
    })
  }

  try {
    await startServer()
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n\n${err.stack ?? ''}` : String(err)
    console.error('[Murmur] Server failed to start:', err)
    dialog.showErrorBox('Murmur — Server Error', msg)
  }

  const win = createMainWindow()
  createTray(win, () => {
    isQuitting = true
  })

  // Hide to tray on close — keeps the scheduler running
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      win.hide()
      if (process.platform === 'darwin') app.dock?.hide()
    }
  })

  ipcMain.handle('get-version', () => app.getVersion())
  ipcMain.handle('get-app-path', () => app.getPath('userData'))
}

app.whenReady().then(bootstrap).catch(console.error)

app.on('window-all-closed', () => {
  // Keep alive in tray so scheduled sends can fire
  if (process.platform === 'darwin') app.dock?.hide()
})

app.on('activate', () => {
  // macOS: re-open window on dock click
  const wins = BrowserWindow.getAllWindows()
  if (wins.length > 0) {
    wins[0]?.show()
    app.dock?.show()
  }
})

app.on('before-quit', () => {
  isQuitting = true
})
