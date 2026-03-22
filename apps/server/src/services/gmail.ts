import type { Broadcast, Contact } from '@murmur/types'
import { replaceVars } from '@murmur/utils'
import nodemailer from 'nodemailer'

import { getDb } from '../db/index'

function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

function buildTransporter(): nodemailer.Transporter {
  const user = getSetting('gmail_user')
  const pass = getSetting('gmail_pass')
  if (!user || !pass) {
    throw new Error('Gmail not configured. Add your App Password in Setup.')
  }
  return nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
}

export async function testGmail(user: string, pass: string): Promise<void> {
  const t = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
  await t.verify()
}

interface ProgressEvent {
  contact: Contact
  channel: 'gmail'
  status: 'sent' | 'failed'
  error?: string
}

export async function sendGmailBroadcast({
  broadcast,
  contacts,
  onProgress,
}: {
  broadcast: Broadcast
  contacts: Contact[]
  onProgress: (e: ProgressEvent) => void
}): Promise<void> {
  const transporter = buildTransporter()
  const fromEmail = getSetting('gmail_user') ?? ''
  const fromName = getSetting('gmail_name') ?? fromEmail

  for (const contact of contacts) {
    if (!contact.email) {
      onProgress({ contact, channel: 'gmail', status: 'failed', error: 'No email address' })
      continue
    }
    try {
      const subject = replaceVars(broadcast.subject ?? '', contact)
      const text = replaceVars(broadcast.message, contact)
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: contact.email,
        subject,
        text,
      })
      onProgress({ contact, channel: 'gmail', status: 'sent' })
      await sleep(1200)
    } catch (err) {
      onProgress({
        contact,
        channel: 'gmail',
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
