import type { Broadcast, CreateBroadcastPayload, BroadcastProgress, Contact } from '@murmur/types'
import { Router } from 'express'

import { getDb } from '../db/index'
import { sendGmailBroadcast } from '../services/gmail'
import { setRunner } from '../services/scheduler'
import { sendWhatsAppBroadcast, getStatus as getWaStatus } from '../services/whatsapp'

const router = Router()
const progressMap = new Map<number, BroadcastProgress>()

export async function runBroadcast(broadcastId: number): Promise<void> {
  const db = getDb()
  const broadcast = db.prepare('SELECT * FROM broadcasts WHERE id = ?').get(broadcastId) as
    | Broadcast
    | undefined
  if (!broadcast) throw new Error(`Broadcast ${broadcastId} not found`)
  if (broadcast.status === 'sending' || broadcast.status === 'done') return

  const channels = JSON.parse(broadcast.channels as unknown as string) as string[]
  const group = broadcast.recipient_group ?? 'all'
  const contactIds = broadcast.contact_ids
    ? (JSON.parse(broadcast.contact_ids as unknown as string) as number[])
    : null

  const rawContacts = (
    contactIds && contactIds.length > 0
      ? db
          .prepare(`SELECT * FROM contacts WHERE id IN (${contactIds.map(() => '?').join(',')})`)
          .all(...contactIds)
      : group === 'all'
        ? db.prepare('SELECT * FROM contacts').all()
        : db.prepare('SELECT * FROM contacts WHERE tag = ?').all(group)
  ) as Contact[]

  const contacts: Contact[] = rawContacts.map((c) => ({
    ...c,
    extra_data: JSON.parse((c.extra_data as unknown as string) || '{}') as Record<string, string>,
  }))

  if (!contacts.length) {
    db.prepare("UPDATE broadcasts SET status = 'done' WHERE id = ?").run(broadcastId)
    return
  }

  const needsWA = channels.includes('whatsapp')
  const needsGmail = channels.includes('gmail')

  // If WhatsApp is requested but not connected, fail those logs immediately
  const waReady = needsWA && getWaStatus().status === 'ready'
  const waNotReady = needsWA && !waReady

  const total = contacts.length * ((needsWA ? 1 : 0) + (needsGmail ? 1 : 0))

  const insertLog = db.prepare(
    `INSERT INTO send_logs (broadcast_id, contact_id, contact_name, channel, status)
     VALUES (?, ?, ?, ?, 'pending')`,
  )
  const insertFailed = db.prepare(
    `INSERT INTO send_logs (broadcast_id, contact_id, contact_name, channel, status, error, sent_at)
     VALUES (?, ?, ?, ?, 'failed', 'WhatsApp is not connected', CURRENT_TIMESTAMP)`,
  )
  db.transaction(() => {
    for (const c of contacts) {
      if (needsWA) {
        if (waNotReady) {
          insertFailed.run(broadcastId, c.id, c.name, 'whatsapp')
        } else {
          insertLog.run(broadcastId, c.id, c.name, 'whatsapp')
        }
      }
      if (needsGmail) insertLog.run(broadcastId, c.id, c.name, 'gmail')
    }
  })()

  const preFailed = waNotReady ? contacts.length : 0
  db.prepare("UPDATE broadcasts SET status = 'sending', total = ? WHERE id = ?").run(
    total,
    broadcastId,
  )
  progressMap.set(broadcastId, { total, sent: 0, failed: preFailed, status: 'sending' })

  const onProgress = ({
    contact,
    channel,
    status,
    error,
  }: {
    contact: Contact
    channel: string
    status: 'sent' | 'failed'
    error?: string
  }) => {
    const p = progressMap.get(broadcastId) ?? {
      total,
      sent: 0,
      failed: 0,
      status: 'sending' as const,
    }
    if (status === 'sent') p.sent++
    else p.failed++
    progressMap.set(broadcastId, p)
    db.prepare(
      `UPDATE send_logs SET status = ?, error = ?, sent_at = CURRENT_TIMESTAMP
       WHERE broadcast_id = ? AND contact_id = ? AND channel = ? AND status = 'pending'`,
    ).run(status, error ?? null, broadcastId, contact.id, channel)
    db.prepare('UPDATE broadcasts SET sent_count = ?, failed_count = ? WHERE id = ?').run(
      p.sent,
      p.failed,
      broadcastId,
    )
  }

  try {
    if (needsWA && waReady) await sendWhatsAppBroadcast({ broadcast, contacts, onProgress })
    if (needsGmail) await sendGmailBroadcast({ broadcast, contacts, onProgress })
    db.prepare("UPDATE broadcasts SET status = 'done' WHERE id = ?").run(broadcastId)
    const p = progressMap.get(broadcastId)
    if (p) p.status = 'done'
  } catch (err) {
    db.prepare("UPDATE broadcasts SET status = 'failed' WHERE id = ?").run(broadcastId)
    const p = progressMap.get(broadcastId)
    if (p) p.status = 'failed'
    throw err
  }
}

setRunner(runBroadcast)

router.post('/', (req, res) => {
  const body = req.body as CreateBroadcastPayload
  if (!body.message || !body.channels?.length) {
    res.status(400).json({ error: 'message and channels are required' })
    return
  }
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO broadcasts
         (subject, message, channels, recipient_group, wa_delay, scheduled_at, is_recurring, recur_type, contact_ids, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    )
    .run(
      body.subject ?? null,
      body.message,
      JSON.stringify(body.channels),
      body.recipient_group ?? 'all',
      body.wa_delay ?? 5,
      body.scheduled_at ?? null,
      body.is_recurring ? 1 : 0,
      body.recur_type ?? null,
      body.contact_ids?.length ? JSON.stringify(body.contact_ids) : null,
    )

  const broadcastId = result.lastInsertRowid as number
  if (!body.scheduled_at) {
    runBroadcast(broadcastId).catch((err) => console.error(`[Broadcast #${broadcastId}]`, err))
  }
  res.json({ success: true, broadcastId })
})

router.get('/', (_req, res) => {
  const db = getDb()
  const list = db
    .prepare('SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT 50')
    .all() as Broadcast[]
  res.json(
    list.map((b) => ({
      ...b,
      channels: JSON.parse(b.channels as unknown as string) as string[],
    })),
  )
})

router.get('/:id/progress', (req, res) => {
  const id = Number(req.params['id'])
  const p = progressMap.get(id)
  if (p) {
    res.json(p)
    return
  }
  const db = getDb()
  const b = db.prepare('SELECT * FROM broadcasts WHERE id = ?').get(id) as Broadcast | undefined
  if (!b) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  res.json({ total: b.total, sent: b.sent_count, failed: b.failed_count, status: b.status })
})

export default router
