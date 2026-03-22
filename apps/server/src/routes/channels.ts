import type { SaveGmailPayload } from '@murmur/types'
import { Router } from 'express'

import { getDb } from '../db/index'
import { testGmail } from '../services/gmail'
import {
  initWhatsApp,
  disconnectWhatsApp,
  resetWhatsAppSession,
  retryWhatsApp,
  getStatus,
} from '../services/whatsapp'

const router = Router()

router.get('/status', (_req, res) => {
  const db = getDb()
  const gmailUser = db.prepare("SELECT value FROM settings WHERE key = 'gmail_user'").get() as
    | { value: string }
    | undefined
  const gmailPass = db.prepare("SELECT value FROM settings WHERE key = 'gmail_pass'").get() as
    | { value: string }
    | undefined

  res.json({
    gmail: { connected: !!(gmailUser && gmailPass), user: gmailUser?.value ?? null },
    whatsapp: getStatus(),
  })
})

router.post('/gmail/save', async (req, res) => {
  const { user, pass, name } = req.body as SaveGmailPayload
  if (!user || !pass) {
    res.status(400).json({ error: 'Email and app password are required' })
    return
  }
  // Google App Passwords are displayed as "xxxx xxxx xxxx xxxx" — strip spaces so
  // copy-paste from the Google account page works without manual cleanup.
  const cleanPass = pass.replace(/\s+/g, '')
  const cleanUser = user.trim().toLowerCase()
  try {
    await testGmail(cleanUser, cleanPass)
    const db = getDb()
    const upsert = db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    upsert.run('gmail_user', cleanUser)
    upsert.run('gmail_pass', cleanPass)
    upsert.run('gmail_name', name?.trim() ?? cleanUser)
    res.json({ success: true })
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Connection failed' })
  }
})

router.delete('/gmail', (_req, res) => {
  getDb()
    .prepare("DELETE FROM settings WHERE key IN ('gmail_user','gmail_pass','gmail_name')")
    .run()
  res.json({ success: true })
})

router.post('/whatsapp/connect', (_req, res) => {
  if (process.env['MURMUR_NO_CHROME'] === '1') {
    res.status(400).json({
      error:
        'No Chrome browser found on this machine. Install Google Chrome from https://www.google.com/chrome and restart Murmur.',
    })
    return
  }
  initWhatsApp()
  res.json({ success: true })
})

router.get('/whatsapp/status', (_req, res) => {
  res.json(getStatus())
})

router.post('/whatsapp/disconnect', async (_req, res) => {
  await disconnectWhatsApp()
  res.json({ success: true })
})

// Retry connection without deleting session files (no QR rescan)
router.post('/whatsapp/retry', async (_req, res) => {
  await retryWhatsApp()
  res.json({ success: true })
})

// Delete saved session files so the user can scan QR fresh
router.post('/whatsapp/reset-session', async (_req, res) => {
  await resetWhatsAppSession()
  res.json({ success: true })
})

export default router
