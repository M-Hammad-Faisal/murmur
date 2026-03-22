import type { Contact } from '@murmur/types'
import { parse } from 'csv-parse/sync'
import { Router } from 'express'
import multer from 'multer'

import { getDb } from '../db/index'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const KNOWN_COLS = new Set(['name', 'phone', 'email', 'tag', 'birthday'])

router.get('/', (req, res) => {
  const db = getDb()
  const { tag } = req.query as { tag?: string }
  const rows =
    tag && tag !== 'all'
      ? (db.prepare('SELECT * FROM contacts WHERE tag = ? ORDER BY name').all(tag) as Contact[])
      : (db.prepare('SELECT * FROM contacts ORDER BY name').all() as Contact[])

  res.json(
    rows.map((c) => ({
      ...c,
      extra_data: JSON.parse((c.extra_data as unknown as string) || '{}') as Record<string, string>,
    })),
  )
})

router.get('/groups', (_req, res) => {
  const db = getDb()
  const total = (db.prepare('SELECT COUNT(*) as count FROM contacts').get() as { count: number })
    .count
  const tags = db
    .prepare(
      `SELECT tag, COUNT(*) as count FROM contacts
       WHERE tag IS NOT NULL AND tag != '' GROUP BY tag`,
    )
    .all() as { tag: string; count: number }[]
  res.json({ total, groups: [{ tag: 'all', count: total }, ...tags] })
})

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' })
    return
  }
  let records: Record<string, string>[]
  try {
    records = parse(req.file.buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Record<string, string>[]
  } catch (err) {
    res.status(400).json({ error: `CSV parse error: ${err instanceof Error ? err.message : err}` })
    return
  }

  if (!records.length) {
    res.status(400).json({ error: 'CSV is empty' })
    return
  }

  const columns = Object.keys(records[0] ?? {}).map((k) => k.toLowerCase().trim())

  if ((req.query as { preview?: string }).preview === 'true') {
    res.json({ columns, preview: records.slice(0, 5), total: records.length })
    return
  }

  const db = getDb()
  if ((req.query as { replace?: string }).replace === 'true') {
    db.prepare('DELETE FROM contacts').run()
  }

  const insert = db.prepare(
    `INSERT INTO contacts (name, phone, email, tag, birthday, extra_data)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )

  const importMany = db.transaction((rows: Record<string, string>[]) => {
    let imported = 0
    let skipped = 0
    for (const row of rows) {
      const norm: Record<string, string> = {}
      for (const [k, v] of Object.entries(row)) norm[k.toLowerCase().trim()] = v
      if (!norm['name']) {
        skipped++
        continue
      }
      const extra: Record<string, string> = {}
      for (const [k, v] of Object.entries(norm)) {
        if (!KNOWN_COLS.has(k)) extra[k] = v
      }
      insert.run(
        norm['name'] ?? '',
        norm['phone'] ?? null,
        norm['email'] ?? null,
        norm['tag'] ?? null,
        norm['birthday'] ?? null,
        JSON.stringify(extra),
      )
      imported++
    }
    return { imported, skipped }
  })

  const result = importMany(records) as { imported: number; skipped: number }
  res.json({ success: true, ...result, columns })
})

router.delete('/all', (_req, res) => {
  getDb().prepare('DELETE FROM contacts').run()
  res.json({ success: true })
})

router.patch('/:id', (req, res) => {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params['id']) as
    | Contact
    | undefined
  if (!existing) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  const { name, phone, email, tag, birthday } = req.body as Partial<Contact>
  db.prepare(
    'UPDATE contacts SET name = ?, phone = ?, email = ?, tag = ?, birthday = ? WHERE id = ?',
  ).run(
    name ?? existing.name,
    phone !== undefined ? phone || null : existing.phone,
    email !== undefined ? email || null : existing.email,
    tag !== undefined ? tag || null : existing.tag,
    birthday !== undefined ? birthday || null : existing.birthday,
    req.params['id'],
  )
  res.json({ success: true })
})

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM contacts WHERE id = ?').run(req.params['id'])
  res.json({ success: true })
})

export default router
