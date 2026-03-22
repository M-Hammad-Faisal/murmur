'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const STEPS = [
  { href: '/setup', label: 'Channels' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/compose', label: 'Compose' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/review', label: 'Review & Send' },
]

export default function NavButtons() {
  const pathname = usePathname()
  // Match by prefix so trailing slashes don't break matching
  const idx = STEPS.findIndex((s) => pathname === s.href || pathname.startsWith(s.href + '/'))

  if (idx === -1) return null

  const prev = idx > 0 ? STEPS[idx - 1] : null
  const next = idx < STEPS.length - 1 ? STEPS[idx + 1] : null
  const current = STEPS[idx]!

  return (
    <div className="nav-buttons-bar">
      {/* Back */}
      <div style={{ minWidth: 130 }}>
        {prev ? (
          <Link href={prev.href} className="btn btn-ghost">
            ← {prev.label}
          </Link>
        ) : (
          <span />
        )}
      </div>

      {/* Step indicator */}
      <div className="nav-step-indicator">
        <div className="nav-step-dots">
          {STEPS.map((step, i) => (
            <Link
              key={step.href}
              href={step.href}
              className={`nav-step-dot${i === idx ? 'active' : i < idx ? 'done' : ''}`}
              title={step.label}
            />
          ))}
        </div>
        <span className="nav-step-label">
          {idx + 1} / {STEPS.length} — {current.label}
        </span>
      </div>

      {/* Next */}
      <div style={{ minWidth: 130, textAlign: 'right' }}>
        {next ? (
          <Link href={next.href} className="btn btn-primary">
            {next.label} →
          </Link>
        ) : (
          <Link href="/logs" className="btn btn-ghost">
            View logs →
          </Link>
        )}
      </div>
    </div>
  )
}
