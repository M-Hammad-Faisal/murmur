'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const NAV = [
  {
    section: 'Setup',
    items: [{ href: '/setup', label: 'Channels' }],
  },
  {
    section: 'Broadcast',
    items: [
      { href: '/contacts', label: 'Contacts' },
      { href: '/compose', label: 'Compose' },
      { href: '/schedule', label: 'Schedule' },
      { href: '/review', label: 'Review & Send' },
    ],
  },
  {
    section: 'History',
    items: [{ href: '/logs', label: 'Send Logs' }],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('murmur-theme') as 'dark' | 'light' | null
    const initial = saved ?? 'dark'
    setTheme(initial)
    document.documentElement.dataset.theme = initial
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.dataset.theme = next
    localStorage.setItem('murmur-theme', next)
  }

  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-icon-row">
          <svg
            className="logo-icon"
            width="22"
            height="22"
            viewBox="0 0 22 22"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="2.8" fill="currentColor" />
            <path
              d="M7 15a6 6 0 0 1 0-8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="M15 7a6 6 0 0 1 0 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="M4.5 17.5a10 10 0 0 1 0-13"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              opacity="0.4"
            />
            <path
              d="M17.5 4.5a10 10 0 0 1 0 13"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              opacity="0.4"
            />
          </svg>
          <div className="logo-name">Murmur</div>
        </div>
        <div className="logo-tag">personal broadcaster</div>
      </div>

      {NAV.map(({ section, items }) => (
        <div key={section} className="nav-group">
          <div className="nav-section-label">{section}</div>
          {items.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={'nav-link' + (pathname.startsWith(href) ? ' active' : '')}
            >
              <span className="nav-dot" />
              {label}
            </Link>
          ))}
        </div>
      ))}

      <div className="sidebar-footer">
        <div className="sidebar-footer-row">
          <span className="footer-version">v1.0.0</span>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            type="button"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
        <span className="footer-tagline">open source · free forever</span>
      </div>
    </aside>
  )
}
