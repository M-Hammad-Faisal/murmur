'use client'

import { useEffect, useState } from 'react'

type ScheduleType = 'now' | 'later'
type RecurType = 'none' | 'daily' | 'weekly' | 'monthly' | 'birthday'

interface ScheduleDraft {
  scheduleType: ScheduleType
  date: string
  time: string
  recur: RecurType
}

/* ── Tiny reusable SVG icons ──────────────────────────── */
function IcoZap() {
  return (
    <svg viewBox="0 0 16 16" fill="none" style={{ width: 18, height: 18 }}>
      <path
        d="M9.5 2L4 9h4.5L6.5 14 12 7H7.5L9.5 2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IcoCalendar() {
  return (
    <svg viewBox="0 0 16 16" fill="none" style={{ width: 18, height: 18 }}>
      <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M5 1v3M11 1v3M1.5 7h13"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <rect x="4" y="9.5" width="2" height="2" rx=".4" fill="currentColor" />
      <rect x="7" y="9.5" width="2" height="2" rx=".4" fill="currentColor" />
    </svg>
  )
}

function IcoClock() {
  return (
    <svg viewBox="0 0 16 16" fill="none" style={{ width: 18, height: 18 }}>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 5v3.2l2 1.4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IcoRepeat() {
  return (
    <svg viewBox="0 0 16 16" fill="none" style={{ width: 18, height: 18 }}>
      <path
        d="M2.5 8A5.5 5.5 0 0113 5M13.5 8A5.5 5.5 0 013 11"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M11 3l2 2-2 2M5 9l-2 2 2 2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IcoGift() {
  return (
    <svg viewBox="0 0 16 16" fill="none" style={{ width: 18, height: 18 }}>
      <rect
        x="1.5"
        y="6"
        width="13"
        height="8.5"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <rect x="3" y="3.5" width="10" height="3" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 3.5V14.5M1.5 10h13"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M8 3.5C8 3.5 6 2 6 3.5S8 3.5 8 3.5zM8 3.5C8 3.5 10 2 10 3.5S8 3.5 8 3.5z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  )
}

const TIMING_OPTIONS: {
  value: ScheduleType
  icon: React.ReactNode
  label: string
  desc: string
}[] = [
  {
    value: 'now',
    icon: <IcoZap />,
    label: 'Send now',
    desc: 'Starts immediately after confirming',
  },
  {
    value: 'later',
    icon: <IcoCalendar />,
    label: 'Schedule for later',
    desc: 'Pick a specific date and time',
  },
]

const RECUR_OPTIONS: {
  value: RecurType
  icon: React.ReactNode
  label: string
  desc: string
}[] = [
  { value: 'none', icon: <IcoZap />, label: 'One time', desc: 'Send once only' },
  { value: 'daily', icon: <IcoClock />, label: 'Daily', desc: 'Same time every day' },
  { value: 'weekly', icon: <IcoRepeat />, label: 'Weekly', desc: 'Same day every week' },
  { value: 'monthly', icon: <IcoCalendar />, label: 'Monthly', desc: 'Same date each month' },
  { value: 'birthday', icon: <IcoGift />, label: 'On birthday', desc: 'Reads birthday column' },
]

export default function SchedulePage() {
  const [scheduleType, setScheduleType] = useState<ScheduleType>('now')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [recur, setRecur] = useState<RecurType>('none')

  useEffect(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setDate(tomorrow.toISOString().split('T')[0] ?? '')

    const raw = sessionStorage.getItem('murmur-schedule')
    if (raw) {
      try {
        const s = JSON.parse(raw) as Partial<ScheduleDraft>
        if (s.scheduleType) setScheduleType(s.scheduleType)
        if (s.date) setDate(s.date)
        if (s.time) setTime(s.time)
        if (s.recur) setRecur(s.recur)
      } catch (_) {
        /* ignore */
      }
    }
  }, [])

  useEffect(() => {
    sessionStorage.setItem(
      'murmur-schedule',
      JSON.stringify({ scheduleType, date, time, recur } satisfies ScheduleDraft),
    )
  }, [scheduleType, date, time, recur])

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">When to send</h1>
        <p className="page-sub">
          Send immediately or schedule for any date and time. Murmur runs silently in the system
          tray to fire scheduled sends.
        </p>
      </div>

      {/* Timing */}
      <div className="card">
        <div className="card-title">Timing</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          {TIMING_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              className={'sel-card' + (scheduleType === opt.value ? ' on' : '')}
              onClick={() => setScheduleType(opt.value)}
            >
              <div className="sel-card-check">
                {scheduleType === opt.value && (
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    style={{ width: 10, height: 10, display: 'block', margin: 'auto' }}
                  >
                    <path
                      d="M3 8l3.5 3.5L13 5"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <div className="sel-card-icon">{opt.icon}</div>
              <div className="sel-card-label">{opt.label}</div>
              <div className="sel-card-desc">{opt.desc}</div>
            </div>
          ))}
        </div>

        {scheduleType === 'later' && (
          <>
            <div className="row" style={{ marginTop: 16 }}>
              <div className="field">
                <label className="label">Date</label>
                <input
                  className="input"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="label">Time</label>
                <input
                  className="input"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 8,
                fontSize: 12,
                color: 'var(--muted)',
              }}
            >
              <IcoClock />
              Murmur must be running in the system tray at the scheduled time.
            </div>
          </>
        )}
      </div>

      {/* Repeat */}
      <div className="card">
        <div className="card-title">Repeat</div>
        <div className="card-sub">Optionally repeat this broadcast on a schedule.</div>
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}
        >
          {RECUR_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              className={'sel-card' + (recur === opt.value ? ' on' : '')}
              onClick={() => setRecur(opt.value)}
            >
              <div className="sel-card-check">
                {recur === opt.value && (
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    style={{ width: 10, height: 10, display: 'block', margin: 'auto' }}
                  >
                    <path
                      d="M3 8l3.5 3.5L13 5"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <div className="sel-card-icon">{opt.icon}</div>
              <div className="sel-card-label">{opt.label}</div>
              <div className="sel-card-desc">{opt.desc}</div>
            </div>
          ))}
        </div>

        {recur === 'birthday' && (
          <div className="alert alert-info" style={{ marginTop: 12 }}>
            Birthday mode reads the <code style={{ fontSize: 11 }}>birthday</code> column from your
            CSV and sends on each contact&apos;s birthday at the time set above.
          </div>
        )}
      </div>
    </>
  )
}
