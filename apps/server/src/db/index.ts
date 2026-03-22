import fs from 'fs'
import path from 'path'

import Database from 'better-sqlite3'

let db: Database.Database | null = null

function getDbPath(): string {
  // In Electron context the userData path is injected via env
  const userDataPath = process.env['MURMUR_USER_DATA']
  if (userDataPath) {
    return path.join(userDataPath, 'murmur.db')
  }
  // Fallback for standalone dev
  const dataDir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  return path.join(dataDir, 'murmur.db')
}

export function getDb(): Database.Database {
  if (db) return db

  const dbPath = getDbPath()
  console.info('[Murmur DB] Using database at:', dbPath)

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  initSchema(db)
  runMigrations(db)
  return db
}

/** Non-destructive schema migrations — safe to run on every startup */
function runMigrations(database: Database.Database): void {
  // v1.1 — contact_ids: JSON array of specific contact IDs for custom recipient selection
  try {
    database.exec('ALTER TABLE broadcasts ADD COLUMN contact_ids TEXT NULL')
    console.info('[Murmur DB] Migration: added broadcasts.contact_ids')
  } catch (_err) {
    // Column already exists on existing installs — ignore
  }
}

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      phone       TEXT,
      email       TEXT,
      tag         TEXT,
      birthday    TEXT,
      extra_data  TEXT    NOT NULL DEFAULT '{}',
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS broadcasts (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      subject         TEXT,
      message         TEXT    NOT NULL,
      channels        TEXT    NOT NULL DEFAULT '[]',
      recipient_group TEXT    NOT NULL DEFAULT 'all',
      wa_delay        INTEGER NOT NULL DEFAULT 5,
      scheduled_at    DATETIME,
      is_recurring    INTEGER NOT NULL DEFAULT 0,
      recur_type      TEXT,
      status          TEXT    NOT NULL DEFAULT 'pending',
      total           INTEGER NOT NULL DEFAULT 0,
      sent_count      INTEGER NOT NULL DEFAULT 0,
      failed_count    INTEGER NOT NULL DEFAULT 0,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS send_logs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      broadcast_id INTEGER NOT NULL,
      contact_id   INTEGER NOT NULL,
      contact_name TEXT    NOT NULL,
      channel      TEXT    NOT NULL,
      status       TEXT    NOT NULL DEFAULT 'pending',
      error        TEXT,
      sent_at      DATETIME,
      FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id),
      FOREIGN KEY (contact_id)   REFERENCES contacts(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
  console.info('[Murmur DB] Schema ready')
}
