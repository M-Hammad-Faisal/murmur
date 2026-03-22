import { execSync } from 'child_process'
import { existsSync, readdirSync, readlinkSync, rmSync } from 'fs'
import path from 'path'

import type { Contact, Broadcast, WhatsAppStatus } from '@murmur/types'
import { replaceVars, formatPhone } from '@murmur/utils'
import qrcode from 'qrcode'
import { Client, LocalAuth } from 'whatsapp-web.js'

type WaStatus = WhatsAppStatus

interface StatusState {
  status: WaStatus
  qrDataUrl: string | null
  message: string
  loadingPercent?: number
}

let client: Client | null = null
let state: StatusState = { status: 'disconnected', qrDataUrl: null, message: '' }
let authTimeoutId: ReturnType<typeof setTimeout> | null = null

function getSessionPath(): string {
  const userDataPath = process.env['MURMUR_USER_DATA']
  if (userDataPath) return path.join(userDataPath, 'whatsapp-session')
  return path.join(process.cwd(), 'data', 'whatsapp-session')
}

/**
 * Kill any lingering Puppeteer/Chrome process that has our session directory
 * in its command line, then delete the SingletonLock files it left behind.
 *
 * This fixes "The browser is already running for <path>" when Puppeteer
 * crashes or is destroyed without fully cleaning up its lock file.
 */
function clearChromeLock(): void {
  const sessionPath = getSessionPath()
  // Primary fix: kill any process that references our session path.
  // pkill/taskkill is more reliable than reading the PID from the symlink
  // because on some macOS versions SingletonLock is not a proper symlink.
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /FI "MEMUSAGE gt 1" /IM chrome.exe`, { stdio: 'ignore' })
    } else {
      execSync(`pkill -9 -f "${sessionPath}"`, { stdio: 'ignore' })
    }
    console.info('[WA] Sent kill signal to stale Chrome processes')
  } catch (_err) {
    // pkill exits non-zero when no processes matched — that is fine
  }
  // Fallback: also delete any leftover lock files via the PID-in-symlink method
  killLocks(sessionPath)
}

function killLocks(dir: string): void {
  try {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.name === 'SingletonLock') {
        // The lock is a symlink → "{hostname}-{pid}". Kill that PID first.
        try {
          const target = readlinkSync(full)
          const pid = parseInt(target.split('-').pop() ?? '', 10)
          if (!isNaN(pid) && pid > 0) {
            process.kill(pid, 'SIGKILL')
            console.info(`[WA] Killed stale Chrome process PID ${pid}`)
          }
        } catch (_err) {
          // Not a symlink, already dead, or process doesn't exist — that's fine
        }
        rmSync(full, { force: true })
        console.info(`[WA] Deleted SingletonLock: ${full}`)
      } else if (entry.isDirectory() && !entry.isSymbolicLink()) {
        killLocks(full)
      }
    }
  } catch (_err) {
    // Ignore permission errors or races during cleanup
  }
}

function clearAuthTimeout(): void {
  if (authTimeoutId) {
    clearTimeout(authTimeoutId)
    authTimeoutId = null
  }
}

export function getStatus(): StatusState {
  return { ...state }
}

export function initWhatsApp(): void {
  if (client) return

  // Clear any stale Chrome lock from a previous crash before starting
  clearChromeLock()
  state = { status: 'connecting', qrDataUrl: null, message: 'Initializing...' }

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: getSessionPath() }),
    puppeteer: {
      // Explicitly pass the detected Chrome binary (set by Electron main process)
      executablePath: process.env['PUPPETEER_EXECUTABLE_PATH'] || undefined,
      // Set WA_HEADLESS=false to watch the Chrome window while debugging
      headless: process.env['WA_HEADLESS'] !== 'false',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--disable-extensions',
        // Keep background tabs active — prevents WA Web sync from stalling
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        // Stability on macOS without a real display
        '--disable-software-rasterizer',
        '--no-zygote',
      ],
    },
  })

  client.on('qr', async (qr: string) => {
    clearAuthTimeout()
    state.status = 'qr'
    state.message = 'Scan the QR code with your WhatsApp'
    try {
      state.qrDataUrl = await qrcode.toDataURL(qr, { width: 256, margin: 2 })
    } catch (_err) {
      console.warn('[WA] Failed to generate QR data URL')
    }
  })

  client.on('authenticated', () => {
    state = {
      status: 'connecting',
      qrDataUrl: null,
      message: 'Authenticated — syncing your chats…',
      loadingPercent: 0,
    }
    // Safety net: if ready never fires within 5 minutes, surface an error.
    // Slow internet can make this take a long time on first load.
    clearAuthTimeout()
    authTimeoutId = setTimeout(() => {
      if (state.status === 'connecting') {
        console.warn('[WA] Timed out waiting for ready — session may be stale or WA Web updated')
        state = {
          status: 'error',
          qrDataUrl: null,
          message:
            'Sync timed out. Your session may be stale. Use "Reset & rescan" to re-link — this is a one-time fix.',
        }
        client = null
      }
    }, 300_000) // 5 minutes
  })

  // Show loading progress while WhatsApp Web loads chats/contacts
  client.on('loading_screen', (percent: number, _message: string) => {
    if (state.status === 'connecting') {
      state.message = `Loading your chats (${percent}%)…`
      state.loadingPercent = percent
    }
  })

  client.on('ready', () => {
    clearAuthTimeout()
    state = { status: 'ready', qrDataUrl: null, message: 'Connected' }
    console.info('[WA] Ready')
  })

  client.on('disconnected', (reason: string) => {
    clearAuthTimeout()
    state = { status: 'disconnected', qrDataUrl: null, message: `Disconnected: ${reason}` }
    client = null
  })

  client.on('auth_failure', (_msg: string) => {
    clearAuthTimeout()
    state = {
      status: 'error',
      qrDataUrl: null,
      message: 'Auth failed — click "Reset session" to clear saved data and scan again.',
    }
    client = null
  })

  client.initialize().catch((err: unknown) => {
    clearAuthTimeout()
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[WA] initialize() failed:', msg)
    state = {
      status: 'error',
      qrDataUrl: null,
      message: `Failed to start: ${msg.slice(0, 120)}`,
    }
    client = null
  })
}

export async function disconnectWhatsApp(): Promise<void> {
  clearAuthTimeout()
  if (client) {
    try {
      await client.logout()
      await client.destroy()
    } catch (_err) {
      // ignore — may already be disconnected
    }
    client = null
  }
  state = { status: 'disconnected', qrDataUrl: null, message: '' }
}

/**
 * Retry connection — destroys the current client but KEEPS session files.
 * Use when loading timed out but the QR scan was already done.
 */
export async function retryWhatsApp(): Promise<void> {
  clearAuthTimeout()
  if (client) {
    try {
      await client.destroy()
    } catch (_err) {
      // ignore — may already be dead
    }
    client = null
  }
  state = { status: 'disconnected', qrDataUrl: null, message: '' }
  // Give the OS time to fully reclaim the Chrome process before we try to start a new one.
  // 2.5s is conservative but prevents "browser already running" on slow machines.
  await sleep(2500)
  clearChromeLock()
  // Re-initialize with the existing saved session (no QR rescan needed)
  initWhatsApp()
}

/**
 * Full reset — destroys client AND deletes session files.
 * Forces a fresh QR rescan. Use only when the session is truly corrupt.
 */
export async function resetWhatsAppSession(): Promise<void> {
  await disconnectWhatsApp()
  try {
    rmSync(getSessionPath(), { recursive: true, force: true })
    console.info('[WA] Session data cleared')
  } catch (_err) {
    // ignore if path doesn't exist
  }
}

interface ProgressEvent {
  contact: Contact
  channel: 'whatsapp'
  status: 'sent' | 'failed'
  error?: string
}

export async function sendWhatsAppBroadcast({
  broadcast,
  contacts,
  onProgress,
}: {
  broadcast: Broadcast
  contacts: Contact[]
  onProgress: (e: ProgressEvent) => void
}): Promise<void> {
  if (!client || state.status !== 'ready') {
    throw new Error('WhatsApp is not connected. Scan the QR code first.')
  }

  const delayMs = (broadcast.wa_delay ?? 5) * 1000

  for (const contact of contacts) {
    const phone = formatPhone(contact.phone ?? '')
    if (!phone) {
      onProgress({ contact, channel: 'whatsapp', status: 'failed', error: 'No phone number' })
      continue
    }
    try {
      const text = replaceVars(broadcast.message, contact)
      await client.sendMessage(phone, text)
      onProgress({ contact, channel: 'whatsapp', status: 'sent' })
      await sleep(delayMs)
    } catch (err) {
      onProgress({
        contact,
        channel: 'whatsapp',
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
