'use client'

import type { ChannelStatusResponse } from '@murmur/types'
import { useEffect, useRef, useState } from 'react'

import { channels } from '../../lib/api'

function ChannelHeader({
  icon,
  name,
  sub,
  connected,
}: {
  icon: React.ReactNode
  name: string
  sub: string
  connected?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        paddingBottom: 14,
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'var(--surface-raised, var(--surface))',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{name}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{sub}</div>
      </div>
      {connected !== undefined && (
        <span className={`badge ${connected ? 'badge-green' : 'badge-muted'}`}>
          {connected ? '● Connected' : '○ Not connected'}
        </span>
      )}
    </div>
  )
}

function StepItem({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'var(--accent)',
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {n}
      </span>
      <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{children}</span>
    </div>
  )
}

export default function SetupPage() {
  const [status, setStatus] = useState<ChannelStatusResponse | null>(null)
  const [gmailUser, setGmailUser] = useState('')
  const [gmailPass, setGmailPass] = useState('')
  const [gmailName, setGmailName] = useState('')
  const [gmailMsg, setGmailMsg] = useState('')
  const [gmailLoading, setGmailLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = async () => {
    try {
      const s = await channels.status()
      setStatus(s)
    } catch (_) {
      /* server may not be ready yet */
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    const waStatus = status?.whatsapp.status
    if (waStatus === 'qr' || waStatus === 'connecting') {
      pollRef.current = setInterval(() => {
        void load()
      }, 2000)
    } else {
      if (pollRef.current) clearInterval(pollRef.current)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [status?.whatsapp.status])

  const saveGmail = async () => {
    setGmailLoading(true)
    setGmailMsg('')
    try {
      await channels.saveGmail({ user: gmailUser, pass: gmailPass, name: gmailName })
      setGmailMsg('Gmail connected successfully!')
      void load()
    } catch (err) {
      setGmailMsg(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setGmailLoading(false)
    }
  }

  const disconnectGmail = async () => {
    await channels.disconnectGmail()
    setGmailUser('')
    setGmailPass('')
    setGmailName('')
    setGmailMsg('')
    void load()
  }

  const connectWA = async () => {
    await channels.connectWhatsApp()
    void load()
  }

  const disconnectWA = async () => {
    await channels.disconnectWhatsApp()
    void load()
  }

  const retryWA = async () => {
    await channels.retryWhatsApp()
    void load()
  }

  const resetWA = async () => {
    if (
      !confirm(
        'This will DELETE your saved WhatsApp session and force a new QR scan.\n\nYou will need to re-link the device in WhatsApp → Linked Devices.\n\nOnly do this if Retry connection failed.',
      )
    )
      return
    await channels.resetWhatsApp()
    void load()
  }

  const wa = status?.whatsapp
  const gm = status?.gmail

  const waIcon = (
    <svg viewBox="0 0 24 24" fill="none" style={{ width: 20, height: 20 }}>
      <path
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"
        fill="currentColor"
        style={{ color: '#25d366' }}
      />
      <path
        d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.402A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"
        stroke="#25d366"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  const gmailIcon = (
    <svg viewBox="0 0 24 24" fill="none" style={{ width: 20, height: 20 }}>
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="var(--muted)" strokeWidth="1.4" />
      <path
        d="M2 7l10 7 10-7"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Connect channels</h1>
        <p className="page-sub">
          Your credentials stay only on this machine — nothing is sent to any server.
        </p>
      </div>

      {/* WhatsApp */}
      <div className="card">
        <ChannelHeader
          icon={waIcon}
          name="WhatsApp"
          sub="Scan once · session saved locally · no repeat scans"
          connected={wa?.status === 'ready'}
        />

        {!wa || wa.status === 'disconnected' ? (
          <button className="btn btn-primary" onClick={() => void connectWA()}>
            Connect WhatsApp
          </button>
        ) : wa.status === 'error' ? (
          <>
            <div className="alert alert-error" style={{ marginBottom: 14 }}>
              {wa.message}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={() => void retryWA()}>
                Retry connection
              </button>
              <button className="btn btn-sm" onClick={() => void connectWA()}>
                Connect fresh
              </button>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => void resetWA()}
                title="Deletes saved session — you will need to rescan QR"
              >
                Reset &amp; rescan
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--hint)', marginTop: 10 }}>
              <strong style={{ color: 'var(--muted)' }}>Retry</strong> — reconnects with saved
              session, no QR needed.&ensp;
              <strong style={{ color: 'var(--muted)' }}>Reset &amp; rescan</strong> — deletes
              session and shows a new QR (last resort).
            </p>
          </>
        ) : wa.status === 'qr' && wa.qrDataUrl ? (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 24,
                background: 'var(--bg)',
                borderRadius: 10,
                padding: 16,
                border: '1px solid var(--border)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={wa.qrDataUrl}
                alt="WhatsApp QR Code"
                width={160}
                height={160}
                style={{ borderRadius: 8, border: '1px solid var(--border)', flexShrink: 0 }}
              />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
                  Scan with your phone
                </p>
                <StepItem n={1}>Open WhatsApp on your phone</StepItem>
                <StepItem n={2}>Tap Menu ··· or Settings</StepItem>
                <StepItem n={3}>Tap Linked Devices</StepItem>
                <StepItem n={4}>Tap Link a Device</StepItem>
                <StepItem n={5}>Point your camera at this code</StepItem>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-sm btn-outline-danger" onClick={() => void resetWA()}>
                Cancel &amp; reset
              </button>
            </div>
          </>
        ) : wa.status === 'connecting' ? (
          <>
            {/* Status box */}
            <div
              style={{
                background: 'var(--amber-bg)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span className="dot dot-amber" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--amber-tx, var(--text))' }}>
                  {wa.message || 'Connecting…'}
                </span>
              </div>
              {/* Show indeterminate bar when at 0% (unknown progress), actual bar when > 0% */}
              {(() => {
                const pct = (wa as { loadingPercent?: number }).loadingPercent
                if (pct === undefined) return null
                return (
                  <div className="progress-wrap" style={{ marginBottom: 0 }}>
                    {pct > 0 ? (
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    ) : (
                      <div className="progress-fill-indeterminate" />
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Explanation */}
            <div
              style={{
                fontSize: 12,
                color: 'var(--muted)',
                marginBottom: 14,
                lineHeight: 1.6,
              }}
            >
              WhatsApp is syncing your chats in the background — this is normal and can take 1–5
              minutes. The animated bar means it&apos;s working, not stuck.
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-sm btn-primary" onClick={() => void retryWA()}>
                Retry connection
              </button>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => void resetWA()}
                title="Deletes saved session — you will need to rescan QR"
              >
                Reset &amp; rescan
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--hint)', marginTop: 8 }}>
              <strong style={{ color: 'var(--muted)' }}>Retry</strong> — restarts without deleting
              your session.&ensp;
              <strong style={{ color: 'var(--muted)' }}>Reset &amp; rescan</strong> — clears session
              and shows a new QR (use if Retry keeps failing).
            </p>
          </>
        ) : wa.status === 'ready' ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span className="dot dot-green" />
              <strong>Connected</strong>
              {wa.message && <span style={{ color: 'var(--muted)' }}>· {wa.message}</span>}
            </div>
            <button className="btn btn-sm btn-outline-danger" onClick={() => void disconnectWA()}>
              Disconnect
            </button>
          </div>
        ) : null}
      </div>

      {/* Gmail */}
      <div className="card">
        <ChannelHeader
          icon={gmailIcon}
          name="Gmail"
          sub="App password only — your real password is never stored"
          connected={gm?.connected}
        />

        {gm?.connected ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span className="dot dot-green" />
              <strong>Connected</strong>
              <span style={{ color: 'var(--muted)' }}>· {gm.user}</span>
            </div>
            <button
              className="btn btn-sm btn-outline-danger"
              onClick={() => void disconnectGmail()}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <>
            {gmailMsg && (
              <div
                className={`alert ${gmailMsg.includes('success') ? 'alert-success' : 'alert-error'}`}
              >
                {gmailMsg}
              </div>
            )}
            <div className="row" style={{ marginBottom: 12 }}>
              <div className="field">
                <label className="label">Gmail address</label>
                <input
                  className="input"
                  type="email"
                  placeholder="you@gmail.com"
                  value={gmailUser}
                  onChange={(e) => setGmailUser(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="label">Display name (optional)</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Your Name"
                  value={gmailName}
                  onChange={(e) => setGmailName(e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label className="label">App password</label>
              <input
                className="input"
                type="password"
                placeholder="xxxx xxxx xxxx xxxx — paste directly from Google, spaces are fine"
                value={gmailPass}
                onChange={(e) => setGmailPass(e.target.value)}
                style={{ fontFamily: 'monospace' }}
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={() => void saveGmail()}
              disabled={gmailLoading || !gmailUser || !gmailPass}
            >
              {gmailLoading ? 'Verifying...' : 'Save & Connect'}
            </button>
          </>
        )}
      </div>

      {/* How to get App Password */}
      {!gm?.connected && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>🔑</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>How to get a Gmail App Password</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                One-time setup · takes about 2 minutes
              </div>
            </div>
          </div>
          <StepItem n={1}>
            Go to <strong style={{ color: 'var(--text)' }}>myaccount.google.com → Security</strong>
          </StepItem>
          <StepItem n={2}>
            Enable <strong style={{ color: 'var(--text)' }}>2-Step Verification</strong> if not
            already on
          </StepItem>
          <StepItem n={3}>
            Search for <strong style={{ color: 'var(--text)' }}>&quot;App passwords&quot;</strong>
          </StepItem>
          <StepItem n={4}>
            Create one for <strong style={{ color: 'var(--text)' }}>Mail</strong>
          </StepItem>
          <StepItem n={5}>Copy the 16-character password and paste it above</StepItem>
        </div>
      )}
    </>
  )
}
