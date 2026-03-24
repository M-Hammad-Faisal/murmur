'use client'

import type { LogStats, SendLog } from '@murmur/types'
import { useEffect, useState } from 'react'

import { logs as logsApi } from '../../lib/api'

export default function LogsPage() {
  const [stats, setStats] = useState<LogStats>({
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0,
    today: 0,
  })
  const [list, setList] = useState<SendLog[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  const load = async (status = 'all') => {
    setLoading(true)
    try {
      const [s, l] = await Promise.all([
        logsApi.stats(),
        logsApi.list({ status: status === 'all' ? undefined : status, limit: 200 }),
      ])
      setStats(s)
      setList(l)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const switchFilter = (f: string) => {
    setFilter(f)
    void load(f)
  }

  const retry = async (id: number) => {
    await logsApi.retry(id)
    void load(filter)
  }

  const deleteOne = async (id: number) => {
    await logsApi.deleteOne(id)
    void load(filter)
  }

  const clearByStatus = async (status: string) => {
    if (!confirm(`Clear all ${status} logs? This cannot be undone.`)) return
    await logsApi.clearByStatus(status)
    void load(filter)
  }

  const clearAll = async () => {
    if (!confirm('Clear all send logs? This cannot be undone.')) return
    await logsApi.clearAll()
    void load()
  }

  const formatTime = (ts: string | null | undefined) => {
    if (!ts) return '—'
    const date = new Date(ts.includes('T') ? ts : ts + 'Z')
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const DOT: Record<string, string> = {
    sent: 'dot-green',
    failed: 'dot-red',
    pending: 'dot-amber',
  }

  const BADGE: Record<string, string> = {
    sent: 'badge-green',
    failed: 'badge-red',
    pending: 'badge-amber',
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Send logs</h1>
        <p className="page-sub">Every message sent from this machine, in order.</p>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-box stat-green">
          <svg viewBox="0 0 20 20" fill="none" style={{ width: 22, height: 22, marginBottom: 6 }}>
            <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.4" opacity=".4" />
            <path
              d="M6.5 10l2.5 2.5 4.5-5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="stat-num">{stats.sent ?? 0}</div>
          <div className="stat-lbl">Sent total</div>
        </div>
        <div className="stat-box stat-red">
          <svg viewBox="0 0 20 20" fill="none" style={{ width: 22, height: 22, marginBottom: 6 }}>
            <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.4" opacity=".4" />
            <path
              d="M7 7l6 6M13 7l-6 6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <div className="stat-num">{stats.failed ?? 0}</div>
          <div className="stat-lbl">Failed</div>
        </div>
        <div className="stat-box stat-blue">
          <svg viewBox="0 0 20 20" fill="none" style={{ width: 22, height: 22, marginBottom: 6 }}>
            <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.4" opacity=".4" />
            <path
              d="M10 6v4.5l2.5 1.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="stat-num">{stats.today ?? 0}</div>
          <div className="stat-lbl">Today</div>
        </div>
      </div>

      {/* Log card with integrated header */}
      <div className="card" style={{ padding: 0 }}>
        {/* Card toolbar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div className="ch-group" style={{ margin: 0 }}>
            {['all', 'sent', 'failed', 'pending'].map((f) => (
              <button
                key={f}
                className={'ch-btn' + (filter === f ? ' on' : '')}
                onClick={() => switchFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== 'all' && (
                  <span style={{ marginLeft: 4, opacity: 0.65, fontWeight: 400, fontSize: 10 }}>
                    {f === 'sent' && stats.sent}
                    {f === 'failed' && stats.failed}
                    {f === 'pending' && stats.pending}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {stats.failed > 0 && (
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => void clearByStatus('failed')}
              >
                Clear failed
              </button>
            )}
            {stats.pending > 0 && (
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => void clearByStatus('pending')}
              >
                Clear pending
              </button>
            )}
            <button className="btn btn-sm" onClick={() => void load(filter)}>
              ↻ Refresh
            </button>
            {stats.total > 0 && (
              <button className="btn btn-sm btn-danger" onClick={() => void clearAll()}>
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Table body */}
        {loading ? (
          <div style={{ padding: '24px 18px', fontSize: 13, color: 'var(--muted)' }}>
            Loading...
          </div>
        ) : list.length === 0 ? (
          <div
            style={{
              padding: '48px 18px',
              fontSize: 13,
              color: 'var(--muted)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.4 }}>📭</div>
            No logs found.{' '}
            {filter !== 'all' ? (
              <button
                className="btn btn-sm"
                style={{ marginLeft: 6 }}
                onClick={() => switchFilter('all')}
              >
                Show all
              </button>
            ) : (
              'Send a broadcast to see results here.'
            )}
          </div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Error</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontWeight: 500 }}>{log.contact_name}</td>
                    <td>
                      <span
                        className={`badge ${log.channel === 'whatsapp' ? 'badge-green' : 'badge-blue'}`}
                      >
                        {log.channel === 'whatsapp' ? 'WA' : 'Gmail'}
                      </span>
                    </td>
                    <td>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        title={
                          log.status === 'pending'
                            ? 'This send was queued but the app was closed before it completed. Clear this entry and send a new broadcast to retry.'
                            : undefined
                        }
                      >
                        <span className={`dot ${DOT[log.status] ?? 'dot-muted'}`} />
                        <span className={`badge ${BADGE[log.status] ?? 'badge-muted'}`}>
                          {log.status}
                        </span>
                        {log.status === 'pending' && (
                          <span
                            style={{ fontSize: 10, color: 'var(--muted)', cursor: 'help' }}
                            title="Queued but never sent — app was closed mid-broadcast"
                          >
                            ?
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {formatTime(log.sent_at)}
                    </td>
                    <td
                      style={{
                        fontSize: 11,
                        color: 'var(--red-tx)',
                        maxWidth: 180,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={log.error ?? ''}
                    >
                      {log.error ?? '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {log.status === 'failed' && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => void retry(log.id)}
                          >
                            Retry
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => void deleteOne(log.id)}
                          title="Delete this log entry"
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
