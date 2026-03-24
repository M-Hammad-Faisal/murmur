import type { SendLog, LogStats } from '@murmur/types'
import { Router } from 'express'

import { getDb } from '../db/index'

const router = Router()

router.get('/', (req, res) => {
  const db = getDb()
  const { broadcast_id, status, limit = '200' } = req.query as Record<string, string>

  let query = `SELECT sl.*, b.subject, b.message
               FROM send_logs sl
               LEFT JOIN broadcasts b ON sl.broadcast_id = b.id
               WHERE 1=1`
  const params: (string | number)[] = []

  if (broadcast_id) {
    query += ' AND sl.broadcast_id = ?'
    params.push(broadcast_id)
  }
  if (status) {
    query += ' AND sl.status = ?'
    params.push(status)
  }
  query += ' ORDER BY sl.id DESC LIMIT ?'
  params.push(Number(limit))

  res.json(db.prepare(query).all(...params) as SendLog[])
})

router.get('/stats', (_req, res) => {
  const db = getDb()
  const stats = db
    .prepare(
      `SELECT
         COUNT(*) as total,
         COALESCE(SUM(CASE WHEN status = 'sent'    THEN 1 ELSE 0 END), 0) as sent,
         COALESCE(SUM(CASE WHEN status = 'failed'  THEN 1 ELSE 0 END), 0) as failed,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending
       FROM send_logs`,
    )
    .get() as Omit<LogStats, 'today'>
  const today = (
    db
      .prepare(
        `SELECT COUNT(*) as count FROM send_logs
         WHERE DATE(sent_at) = DATE('now') AND status = 'sent'`,
      )
      .get() as { count: number }
  ).count
  res.json({ ...stats, today } satisfies LogStats)
})

router.post('/:id/retry', (req, res) => {
  const db = getDb()
  const log = db.prepare('SELECT * FROM send_logs WHERE id = ?').get(req.params['id']) as
    | SendLog
    | undefined
  if (!log) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  if (log.status !== 'failed') {
    res.status(400).json({ error: 'Only failed sends can be retried' })
    return
  }
  db.prepare("UPDATE send_logs SET status = 'pending', error = NULL WHERE id = ?").run(
    req.params['id'],
  )
  res.json({ success: true })
})

// Delete a single log entry
router.delete('/by-status', (req, res) => {
  const { status } = req.query as Record<string, string>
  if (!status || !['failed', 'pending', 'sent'].includes(status)) {
    res.status(400).json({ error: 'Valid status required: failed | pending | sent' })
    return
  }
  const db = getDb()
  db.prepare('DELETE FROM send_logs WHERE status = ?').run(status)
  res.json({ success: true })
})

router.delete('/all', (_req, res) => {
  const db = getDb()
  db.prepare('DELETE FROM send_logs').run()
  res.json({ success: true })
})

router.delete('/:id', (req, res) => {
  const db = getDb()
  const log = db.prepare('SELECT id FROM send_logs WHERE id = ?').get(req.params['id'])
  if (!log) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  db.prepare('DELETE FROM send_logs WHERE id = ?').run(req.params['id'])
  res.json({ success: true })
})

export default router
