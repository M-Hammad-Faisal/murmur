'use client'

import type { ContactGroupsResponse } from '@murmur/types'
import { extractVars } from '@murmur/utils'
import { useCallback, useEffect, useRef, useState } from 'react'

import { channels as channelsApi, contacts as contactsApi } from '../../lib/api'

const KNOWN_VARS = ['{{name}}', '{{phone}}', '{{email}}', '{{tag}}', '{{birthday}}']

/** Capitalise first letter, lowercase the rest */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

interface Draft {
  subject: string
  message: string
  channelWA: boolean
  channelGmail: boolean
  waDelay: number
  recipientGroup: string
}

function ChannelToggle({
  icon,
  label,
  active,
  locked,
  lockedMsg,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  locked: boolean
  lockedMsg: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={locked ? lockedMsg : label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        borderRadius: 8,
        border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'var(--accent-bg)' : 'var(--surface)',
        color: active ? 'var(--accent-tx)' : locked ? 'var(--hint)' : 'var(--text)',
        fontWeight: 600,
        fontSize: 13,
        cursor: locked ? 'not-allowed' : 'pointer',
        opacity: locked ? 0.55 : 1,
        transition: 'all .12s',
        outline: 'none',
      }}
    >
      {icon}
      <span>{label}</span>
      {locked && (
        <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--hint)' }}>✕ not connected</span>
      )}
      {active && !locked && <span style={{ fontSize: 10, marginLeft: 2, opacity: 0.7 }}>✓</span>}
    </button>
  )
}

export default function ComposePage() {
  const [channelWA, setChannelWA] = useState(false)
  const [channelGmail, setChannelGmail] = useState(false)
  const [waReady, setWaReady] = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [selectionCount, setSelectionCount] = useState(0)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState(
    "Hi {{name}}! 👋\n\nHope you're doing well.\n\nBest,\nYour Name",
  )
  const [waDelay, setWaDelay] = useState(5)
  const [groups, setGroups] = useState<ContactGroupsResponse>({ total: 0, groups: [] })
  const [recipientGroup, setRecipientGroup] = useState('all')
  const msgRef = useRef<HTMLTextAreaElement>(null)

  const saveDraft = useCallback(
    (overrides: Partial<Draft> = {}) => {
      const draft: Draft = {
        subject,
        message,
        channelWA,
        channelGmail,
        waDelay,
        recipientGroup,
        ...overrides,
      }
      sessionStorage.setItem('murmur-draft', JSON.stringify(draft))
    },
    [subject, message, channelWA, channelGmail, waDelay, recipientGroup],
  )

  useEffect(() => {
    void contactsApi
      .groups()
      .then(setGroups)
      .catch(() => null)

    // Load custom contact selection count from contacts page
    try {
      const raw = sessionStorage.getItem('murmur-selected-contacts')
      if (raw) {
        const ids = JSON.parse(raw) as number[]
        setSelectionCount(ids.length)
      }
    } catch (_) {
      /* ignore */
    }

    let savedWA = false
    let savedGmail = false
    const raw = sessionStorage.getItem('murmur-draft')
    if (raw) {
      try {
        const d = JSON.parse(raw) as Partial<Draft>
        if (d.subject !== undefined) setSubject(d.subject)
        if (d.message !== undefined) setMessage(d.message)
        if (d.channelWA !== undefined) savedWA = d.channelWA
        if (d.channelGmail !== undefined) savedGmail = d.channelGmail
        if (d.waDelay !== undefined) setWaDelay(d.waDelay)
        if (d.recipientGroup !== undefined) setRecipientGroup(d.recipientGroup)
      } catch (_) {
        /* ignore */
      }
    }

    channelsApi
      .status()
      .then((s) => {
        const wa = s.whatsapp.status === 'ready'
        const gm = s.gmail.connected
        setWaReady(wa)
        setGmailConnected(gm)
        setChannelWA(savedWA && wa)
        setChannelGmail(savedGmail && gm)
      })
      .catch(() => {
        setChannelWA(false)
        setChannelGmail(false)
      })
  }, [])

  useEffect(() => {
    saveDraft()
  }, [saveDraft])

  const insertVar = (v: string) => {
    const ta = msgRef.current
    if (!ta) return
    const start = ta.selectionStart ?? message.length
    const end = ta.selectionEnd ?? message.length
    const next = message.slice(0, start) + v + message.slice(end)
    setMessage(next)
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + v.length, start + v.length)
    }, 0)
  }

  const extraVars = extractVars(message).filter((v) => !KNOWN_VARS.includes(`{{${v}}}`))

  const previewName = 'Ahmed Khan'
  const preview = message
    .replace(/\{\{name\}\}/g, previewName)
    .replace(/\{\{(\w+)\}\}/g, (_, k: string) => `[${k}]`)
  const subjectPreview = subject
    .replace(/\{\{name\}\}/g, previewName)
    .replace(/\{\{(\w+)\}\}/g, (_, k: string) => `[${k}]`)

  const waIcon = (
    <svg viewBox="0 0 20 20" fill="none" style={{ width: 16, height: 16, flexShrink: 0 }}>
      <path
        d="M14.56 11.98c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.55.12-.17.25-.64.8-.78.97-.14.17-.29.19-.54.06-.25-.12-1.04-.38-1.99-1.23-.73-.65-1.23-1.46-1.37-1.71-.14-.25-.02-.38.1-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.43.06-.66.31-.22.24-.87.85-.87 2.06 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.25 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.2-.58.2-1.07.14-1.18-.06-.1-.23-.16-.47-.29z"
        fill="#25d366"
      />
      <path
        d="M10 1.5C5.31 1.5 1.5 5.31 1.5 10c0 1.57.44 3.05 1.2 4.31L1.5 18.5l4.32-1.13A8.45 8.45 0 0010 18.5c4.69 0 8.5-3.81 8.5-8.5S14.69 1.5 10 1.5z"
        stroke="#25d366"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )

  const gmailIcon = (
    <svg viewBox="0 0 20 20" fill="none" style={{ width: 16, height: 16, flexShrink: 0 }}>
      <rect
        x="1.5"
        y="3.5"
        width="17"
        height="13"
        rx="2"
        stroke="var(--accent)"
        strokeWidth="1.2"
      />
      <path
        d="M1.5 6l8.5 6 8.5-6"
        stroke="var(--accent)"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Compose message</h1>
        <p className="page-sub">
          Write once, personalize for everyone using {'{{variable}}'} tokens. Draft is auto-saved.
        </p>
      </div>

      {/* Channel + recipient selector */}
      <div className="card">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: 24,
            flexWrap: 'wrap',
            alignItems: 'start',
          }}
        >
          <div>
            <div className="label" style={{ marginBottom: 8 }}>
              Send via
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <ChannelToggle
                icon={waIcon}
                label="WhatsApp"
                active={channelWA}
                locked={!waReady}
                lockedMsg="WhatsApp not connected — go to Channels to connect"
                onClick={() => waReady && setChannelWA((v) => !v)}
              />
              <ChannelToggle
                icon={gmailIcon}
                label="Gmail"
                active={channelGmail}
                locked={!gmailConnected}
                lockedMsg="Gmail not connected — go to Channels to connect"
                onClick={() => gmailConnected && setChannelGmail((v) => !v)}
              />
            </div>
            {!waReady && !gmailConnected && (
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                No channels connected.{' '}
                <a href="/setup" style={{ color: 'var(--accent)' }}>
                  Go to Channels →
                </a>
              </p>
            )}
          </div>

          <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 24 }}>
            <div className="label" style={{ marginBottom: 8 }}>
              Send to
            </div>
            <div className="ch-group">
              {groups.groups.length === 0 ? (
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  No contacts yet —{' '}
                  <a href="/contacts" style={{ color: 'var(--accent)' }}>
                    upload a CSV first
                  </a>
                </span>
              ) : (
                <>
                  {groups.groups.map((g) => (
                    <button
                      key={g.tag}
                      className={'ch-btn' + (recipientGroup === g.tag ? ' on' : '')}
                      onClick={() => setRecipientGroup(g.tag)}
                    >
                      {g.tag === 'all' ? `All (${g.count})` : `${cap(g.tag)} (${g.count})`}
                    </button>
                  ))}
                  {selectionCount > 0 && (
                    <button
                      className={'ch-btn' + (recipientGroup === 'selected' ? ' on' : '')}
                      onClick={() => setRecipientGroup('selected')}
                      title="Send to your custom contact selection from the Contacts page"
                    >
                      ☑ Selected ({selectionCount})
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 270px', gap: 14 }}>
        {/* Composer */}
        <div>
          <div className="card">
            {channelGmail && (
              <div className="field">
                <label className="label">Email subject</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Hey {{name}} — quick update from me"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
            )}
            <div className="field" style={{ marginBottom: 8 }}>
              <label className="label">Message body</label>
              <textarea
                ref={msgRef}
                className="input"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={10}
              />
            </div>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>
                Insert variable
              </div>
              <div className="var-chips">
                {KNOWN_VARS.map((v) => (
                  <span key={v} className="var-chip" onClick={() => insertVar(v)}>
                    {v}
                  </span>
                ))}
                {extraVars.map((v) => (
                  <span
                    key={v}
                    className="var-chip"
                    style={{ background: 'var(--amber-bg)', color: 'var(--amber-tx)' }}
                    onClick={() => insertVar(`{{${v}}}`)}
                  >
                    {`{{${v}}}`}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {channelWA && (
            <div className="card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 4,
                }}
              >
                <div>
                  <div className="card-title">WhatsApp delay</div>
                  <div className="card-sub">5–10s recommended to avoid being flagged.</div>
                </div>
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: 'var(--accent-tx)',
                    minWidth: 44,
                    textAlign: 'right',
                  }}
                >
                  {waDelay}s
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={15}
                step={1}
                value={waDelay}
                onChange={(e) => setWaDelay(Number(e.target.value))}
                style={{ width: '100%', marginTop: 8 }}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 10,
                  color: 'var(--hint)',
                  marginTop: 4,
                }}
              >
                <span>2s (fast)</span>
                <span>15s (safe)</span>
              </div>
            </div>
          )}
        </div>

        {/* Live preview */}
        <div>
          <div className="card">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                marginBottom: 12,
                paddingBottom: 10,
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: 14 }}>👁</span>
              <div className="card-title" style={{ margin: 0 }}>
                Preview
              </div>
              <span style={{ fontSize: 11, color: 'var(--hint)', marginLeft: 'auto' }}>
                {previewName}
              </span>
            </div>

            {!channelWA && !channelGmail && (
              <p style={{ fontSize: 12, color: 'var(--hint)' }}>
                Select a channel above to preview.
              </p>
            )}

            {channelWA && (
              <>
                <div className="label" style={{ marginBottom: 6 }}>
                  {waIcon}&ensp;WhatsApp
                </div>
                <div
                  style={{
                    background: 'var(--green-bg)',
                    color: 'var(--green-tx)',
                    padding: '10px 12px',
                    borderRadius: '12px 12px 4px 12px',
                    fontSize: 12,
                    lineHeight: 1.7,
                    marginBottom: 14,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    position: 'relative',
                  }}
                >
                  {preview}
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--green-tx)',
                      opacity: 0.55,
                      textAlign: 'right',
                      marginTop: 4,
                    }}
                  >
                    now ✓✓
                  </div>
                </div>
              </>
            )}

            {channelGmail && (
              <>
                <div className="label" style={{ marginBottom: 6 }}>
                  {gmailIcon}&ensp;Gmail
                </div>
                <div
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    padding: '10px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    lineHeight: 1.7,
                  }}
                >
                  {subject && (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--muted)',
                        marginBottom: 6,
                        paddingBottom: 6,
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      Subject: {subjectPreview}
                    </div>
                  )}
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{preview}</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
