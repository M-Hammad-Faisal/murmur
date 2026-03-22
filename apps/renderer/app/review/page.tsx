'use client'

import type { BroadcastProgress, ContactGroupsResponse, SendLog } from '@murmur/types'
import { useEffect, useRef, useState } from 'react'

import { broadcasts, contacts as contactsApi, logs as logsApi } from '../../lib/api'

type SendState = 'idle' | 'sending' | 'done' | 'error'

interface DraftState {
  subject: string
  message: string
  channelWA: boolean
  channelGmail: boolean
  waDelay: number
  recipientGroup: string
}

interface ScheduleState {
  scheduleType: 'now' | 'later'
  date: string
  time: string
  recur: string
}

function loadSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/* ── Tiny icons ─────────────────────────────────────── */
function IcoSignal() {
  return (
    <svg viewBox="0 0 14 14" fill="none" style={{ width: 13, height: 13, flexShrink: 0 }}>
      <circle cx="7" cy="7" r="2" fill="currentColor" />
      <path
        d="M3.5 10.5a5 5 0 017 0M1 13a9 9 0 0112 0"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M10.5 3.5a5 5 0 010 7M13 1a9 9 0 010 12"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity=".4"
      />
    </svg>
  )
}

function IcoUsers() {
  return (
    <svg viewBox="0 0 14 14" fill="none" style={{ width: 13, height: 13, flexShrink: 0 }}>
      <circle cx="5.5" cy="4" r="2.2" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M1 12c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="10" cy="4.5" r="1.7" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M12 12c0-1.5-.7-2.7-2-3.3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IcoEnvelope() {
  return (
    <svg viewBox="0 0 14 14" fill="none" style={{ width: 13, height: 13, flexShrink: 0 }}>
      <rect x="1" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M1 5l6 4 6-4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IcoCalendar() {
  return (
    <svg viewBox="0 0 14 14" fill="none" style={{ width: 13, height: 13, flexShrink: 0 }}>
      <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M4.5 1v2.5M9.5 1v2.5M1 6h12"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IcoClock() {
  return (
    <svg viewBox="0 0 14 14" fill="none" style={{ width: 13, height: 13, flexShrink: 0 }}>
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M7 4.5V7.2l1.8 1.3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IcoZap() {
  return (
    <svg viewBox="0 0 14 14" fill="none" style={{ width: 13, height: 13, flexShrink: 0 }}>
      <path
        d="M8.5 1.5L3.5 8h4L5.5 12.5 10.5 6h-4L8.5 1.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    sent: 'badge badge-green',
    failed: 'badge badge-red',
    pending: 'badge badge-muted',
  }
  return <span className={map[status] ?? 'badge badge-muted'}>{status}</span>
}

function ChannelBadge({ channel }: { channel: string }) {
  return (
    <span
      className={`badge ${channel === 'whatsapp' ? 'badge-green' : 'badge-blue'}`}
      style={{ fontSize: 10, textTransform: 'uppercase' }}
    >
      {channel === 'whatsapp' ? 'WA' : 'Gmail'}
    </span>
  )
}

function SummaryRow({
  icon,
  label,
  children,
  last,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div className="review-row" style={{ borderBottom: last ? 'none' : undefined }}>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--muted)',
          fontSize: 13,
          minWidth: 120,
        }}
      >
        {icon}
        {label}
      </span>
      <span className="review-val">{children}</span>
    </div>
  )
}

/** Capitalise first letter, lowercase the rest */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

export default function ReviewPage() {
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [sched, setSched] = useState<ScheduleState | null>(null)
  const [groups, setGroups] = useState<ContactGroupsResponse>({ total: 0, groups: [] })
  const [sendState, setSendState] = useState<SendState>('idle')
  const [progress, setProgress] = useState<BroadcastProgress | null>(null)
  const [broadcastId, setBroadcastId] = useState<number | null>(null)
  const [sendLogs, setSendLogs] = useState<SendLog[]>([])
  const [error, setError] = useState('')
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDraft(loadSession<DraftState>('murmur-draft'))
    setSched(loadSession<ScheduleState>('murmur-schedule'))
    contactsApi
      .groups()
      .then(setGroups)
      .catch(() => null)
    // Load custom selection
    try {
      const raw = sessionStorage.getItem('murmur-selected-contacts')
      if (raw) setSelectedContactIds(JSON.parse(raw) as number[])
    } catch (_) {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sendLogs.length])

  useEffect(() => {
    if ((sendState !== 'sending' && sendState !== 'done') || broadcastId === null) return
    const iv = setInterval(async () => {
      try {
        const [p, logs] = await Promise.all([
          broadcasts.progress(broadcastId),
          logsApi.list({ broadcast_id: broadcastId }),
        ])
        setProgress(p)
        setSendLogs(logs)
        if (p.status === 'done' || p.status === 'failed') {
          setSendState(p.status === 'done' ? 'done' : 'error')
          clearInterval(iv)
        }
      } catch (_) {
        /* retry next tick */
      }
    }, 800)
    return () => clearInterval(iv)
  }, [sendState, broadcastId])

  const send = async () => {
    if (!draft) return
    setSendState('sending')
    setSendLogs([])
    setError('')
    try {
      const chans: ('whatsapp' | 'gmail')[] = []
      if (draft.channelWA) chans.push('whatsapp')
      if (draft.channelGmail) chans.push('gmail')

      let scheduledAt: string | null = null
      if (sched?.scheduleType === 'later' && sched.date && sched.time) {
        scheduledAt = new Date(`${sched.date}T${sched.time}`).toISOString()
      }

      const isCustomSelection = draft.recipientGroup === 'selected'
      const res = await broadcasts.create({
        subject: draft.subject || undefined,
        message: draft.message,
        channels: chans,
        recipient_group: isCustomSelection ? 'all' : (draft.recipientGroup ?? 'all'),
        wa_delay: draft.waDelay ?? 5,
        scheduled_at: scheduledAt,
        is_recurring: sched?.recur !== 'none',
        recur_type:
          sched?.recur === 'none'
            ? null
            : (sched?.recur as 'daily' | 'weekly' | 'monthly' | 'birthday'),
        // Pass specific contact IDs for custom selection
        contact_ids:
          isCustomSelection && selectedContactIds.length > 0 ? selectedContactIds : undefined,
      })

      setBroadcastId(res.broadcastId)

      if (scheduledAt) {
        setSendState('done')
        setProgress({ total: 0, sent: 0, failed: 0, status: 'pending' })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
      setSendState('error')
    }
  }

  if (!draft) {
    return (
      <>
        <div className="page-head">
          <h1 className="page-title">Review &amp; Send</h1>
        </div>
        <div className="card">
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            No draft found. Go to{' '}
            <a href="/compose" style={{ color: 'var(--accent)' }}>
              Compose
            </a>{' '}
            to write a message first.
          </p>
        </div>
      </>
    )
  }

  const chanLabels = [draft.channelWA && 'WhatsApp', draft.channelGmail && 'Gmail']
    .filter(Boolean)
    .join(' + ')
  const isCustomSelection = draft.recipientGroup === 'selected'
  const group = isCustomSelection
    ? null
    : groups.groups.find((g) => g.tag === (draft.recipientGroup ?? 'all'))
  const contactCount = isCustomSelection ? selectedContactIds.length : (group?.count ?? 0)
  const chCount = [draft.channelWA, draft.channelGmail].filter(Boolean).length
  const totalSends = contactCount * chCount
  const estSecs = draft.channelWA ? contactCount * (draft.waDelay ?? 5) : contactCount * 1.2
  const estLabel = estSecs < 60 ? `~${Math.round(estSecs)}s` : `~${Math.round(estSecs / 60)}m`
  const pct =
    progress && progress.total > 0
      ? Math.round(((progress.sent + progress.failed) / progress.total) * 100)
      : 0

  const isSending = sendState === 'sending'
  const isDone = sendState === 'done'
  const sentCount = sendLogs.filter((l) => l.status === 'sent').length
  const failedCount = sendLogs.filter((l) => l.status === 'failed').length
  const pendingCount = sendLogs.filter((l) => l.status === 'pending').length

  const bothChannels = draft.channelWA && draft.channelGmail
  const isScheduled = sched?.scheduleType === 'later'

  // WA message preview (variables shown as-is so user can verify)
  const waPreview = draft.message
  const gmailPreview = draft.message

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Review &amp; Send</h1>
        <p className="page-sub">Last check before your broadcast goes out.</p>
      </div>

      {/* ── Two-column: summary + send LEFT | message preview RIGHT ── */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}
      >
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Summary card */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 4 }}>
              Broadcast summary
            </div>

            <SummaryRow icon={<IcoSignal />} label="Channels">
              {draft.channelWA && (
                <span className="badge badge-green" style={{ marginRight: 4 }}>
                  WhatsApp
                </span>
              )}
              {draft.channelGmail && <span className="badge badge-blue">Gmail</span>}
              {!chanLabels && <span style={{ color: 'var(--muted)' }}>—</span>}
            </SummaryRow>

            <SummaryRow icon={<IcoUsers />} label="Recipients">
              <strong>{contactCount}</strong>&nbsp;contacts
              {isCustomSelection ? (
                <span className="badge badge-amber" style={{ marginLeft: 6 }}>
                  Custom selection
                </span>
              ) : draft.recipientGroup && draft.recipientGroup !== 'all' ? (
                <span className="badge badge-blue" style={{ marginLeft: 6 }}>
                  {cap(draft.recipientGroup)}
                </span>
              ) : (
                <span style={{ color: 'var(--muted)', marginLeft: 4 }}>· all groups</span>
              )}
            </SummaryRow>

            <SummaryRow icon={<IcoEnvelope />} label="Total sends">
              <strong>{totalSends}</strong>&nbsp;messages
            </SummaryRow>

            <SummaryRow icon={<IcoCalendar />} label="Schedule">
              {isScheduled ? `${sched.date ?? ''} at ${sched.time ?? ''}` : 'Send now'}
              {sched?.recur && sched.recur !== 'none' && (
                <span className="badge badge-amber" style={{ marginLeft: 6 }}>
                  {sched.recur}
                </span>
              )}
            </SummaryRow>

            {draft.channelWA && (
              <SummaryRow icon={<IcoClock />} label="WA delay">
                {draft.waDelay}s between messages
              </SummaryRow>
            )}

            <SummaryRow icon={<IcoZap />} label="Est. time" last>
              {estLabel}
            </SummaryRow>
          </div>

          {/* Send / progress card */}
          <div className="card">
            {sendState === 'idle' && (
              <>
                {error && <div className="alert alert-error">{error}</div>}
                <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
                  Messages go out one by one from{' '}
                  <strong style={{ color: 'var(--text)' }}>your</strong> WhatsApp and Gmail
                  accounts.
                </p>
                <button
                  className="btn btn-primary btn-block"
                  onClick={() => void send()}
                  disabled={!chanLabels || contactCount === 0}
                >
                  {isScheduled
                    ? `Schedule for ${sched.date ?? ''} ${sched.time ?? ''}`
                    : 'Send broadcast now'}
                </button>
                {contactCount === 0 && (
                  <p
                    style={{
                      fontSize: 11,
                      color: 'var(--muted)',
                      marginTop: 8,
                      textAlign: 'center',
                    }}
                  >
                    No contacts found.{' '}
                    <a href="/contacts" style={{ color: 'var(--accent)' }}>
                      Upload a CSV first.
                    </a>
                  </p>
                )}
              </>
            )}

            {(isSending || (isDone && sendLogs.length > 0)) && progress && (
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 13,
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      color: isSending ? 'var(--accent-tx)' : 'var(--text)',
                    }}
                  >
                    {isSending ? 'Sending…' : 'Complete'}
                  </span>
                  <span style={{ fontSize: 12, display: 'flex', gap: 10 }}>
                    {sentCount > 0 && (
                      <span style={{ color: 'var(--green, #22c55e)', fontWeight: 600 }}>
                        ✓ {sentCount}
                      </span>
                    )}
                    {failedCount > 0 && (
                      <span style={{ color: 'var(--red, #ef4444)', fontWeight: 600 }}>
                        ✗ {failedCount}
                      </span>
                    )}
                    {pendingCount > 0 && (
                      <span style={{ color: 'var(--muted)' }}>⋯ {pendingCount}</span>
                    )}
                  </span>
                </div>
                <div className="progress-wrap" style={{ marginBottom: 14 }}>
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>

                {/* Live log table */}
                {sendLogs.length > 0 && (
                  <div className="tbl-wrap" style={{ maxHeight: 220, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr
                          style={{
                            color: 'var(--muted)',
                            borderBottom: '1px solid var(--border)',
                            position: 'sticky',
                            top: 0,
                            background: 'var(--surface)',
                          }}
                        >
                          <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>
                            Contact
                          </th>
                          <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>
                            Ch
                          </th>
                          <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>
                            Status
                          </th>
                          <th
                            style={{
                              textAlign: 'left',
                              padding: '4px 8px',
                              fontWeight: 500,
                              maxWidth: 120,
                            }}
                          >
                            Note
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...sendLogs].reverse().map((log) => (
                          <tr
                            key={log.id}
                            style={{ borderBottom: '1px solid var(--border)', lineHeight: 1.6 }}
                          >
                            <td style={{ padding: '4px 8px', fontWeight: 500 }}>
                              {log.contact_name}
                            </td>
                            <td style={{ padding: '4px 8px' }}>
                              <ChannelBadge channel={log.channel} />
                            </td>
                            <td style={{ padding: '4px 8px' }}>
                              <StatusBadge status={log.status} />
                            </td>
                            <td
                              style={{
                                padding: '4px 8px',
                                color: 'var(--muted)',
                                maxWidth: 120,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {log.error ?? ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div ref={logEndRef} />
                  </div>
                )}
              </>
            )}

            {isDone && sendLogs.length === 0 && progress && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{isScheduled ? '🗓' : '✅'}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                  {isScheduled ? 'Broadcast scheduled!' : 'Broadcast complete!'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
                  {isScheduled
                    ? `Fires at ${sched.date ?? ''} ${sched.time ?? ''}`
                    : `${progress.sent} sent · ${progress.failed} failed`}
                </div>
                <a href="/logs" className="btn btn-primary">
                  View send logs →
                </a>
              </div>
            )}

            {isDone && sendLogs.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 14,
                  paddingTop: 14,
                  borderTop: '1px solid var(--border)',
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Broadcast complete</span>
                <a href="/logs" className="btn btn-primary">
                  View full logs →
                </a>
              </div>
            )}

            {sendState === 'error' && sendLogs.length === 0 && (
              <>
                <div className="alert alert-error">
                  {error || 'Broadcast failed. Check logs for details.'}
                </div>
                <button className="btn" onClick={() => setSendState('idle')}>
                  Try again
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right column — message preview */}
        <div className="card" style={{ height: 'fit-content' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              marginBottom: 14,
              paddingBottom: 10,
              borderBottom: '1px solid var(--border)',
            }}
          >
            <IcoEnvelope />
            <div style={{ fontWeight: 600, fontSize: 13 }}>Message template</div>
            <span style={{ fontSize: 11, color: 'var(--hint)', marginLeft: 'auto' }}>
              variables will be substituted per contact
            </span>
          </div>

          {draft.channelGmail && draft.subject && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
              Subject: <strong style={{ color: 'var(--text)' }}>{draft.subject}</strong>
            </div>
          )}

          {/* Channel previews — side by side if both, full width if one */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: bothChannels ? '1fr 1fr' : '1fr',
              gap: 10,
            }}
          >
            {draft.channelWA && (
              <div>
                {bothChannels && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                    <span className="badge badge-green" style={{ fontSize: 10 }}>
                      WhatsApp
                    </span>
                  </div>
                )}
                <div
                  style={{
                    background: 'var(--green-bg)',
                    color: 'var(--green-tx)',
                    padding: '10px 12px',
                    borderRadius: '12px 12px 4px 12px',
                    fontSize: 12,
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {waPreview}
                  <div style={{ fontSize: 10, opacity: 0.55, textAlign: 'right', marginTop: 4 }}>
                    now ✓✓
                  </div>
                </div>
              </div>
            )}

            {draft.channelGmail && (
              <div>
                {bothChannels && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                    <span className="badge badge-blue" style={{ fontSize: 10 }}>
                      Gmail
                    </span>
                  </div>
                )}
                <div
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    padding: '10px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {gmailPreview}
                </div>
              </div>
            )}

            {!draft.channelWA && !draft.channelGmail && (
              <p style={{ fontSize: 12, color: 'var(--hint)' }}>No channels selected.</p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
