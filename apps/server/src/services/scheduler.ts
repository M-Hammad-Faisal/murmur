import cron from 'node-cron'

import { getDb } from '../db/index'

type RunnerFn = (broadcastId: number) => Promise<void>
let runner: RunnerFn | null = null

export function setRunner(fn: RunnerFn): void {
  runner = fn
}

export function startScheduler(): void {
  cron.schedule('* * * * *', () => {
    checkDue().catch((err) => console.error('[Scheduler]', err))
  })
  console.info('[Murmur] Scheduler started')
}

async function checkDue(): Promise<void> {
  if (!runner) return
  const db = getDb()
  const now = new Date().toISOString()
  const due = db
    .prepare(
      `SELECT id FROM broadcasts
       WHERE status = 'pending'
         AND scheduled_at IS NOT NULL
         AND scheduled_at <= ?`,
    )
    .all(now) as { id: number }[]

  for (const row of due) {
    console.info(`[Scheduler] Firing broadcast #${row.id}`)
    await runner(row.id).catch((err) =>
      console.error(`[Scheduler] Broadcast #${row.id} failed:`, err),
    )
  }
}
