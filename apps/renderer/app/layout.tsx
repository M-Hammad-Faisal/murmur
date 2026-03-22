import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import '../styles/globals.css'
import NavButtons from '../components/layout/NavButtons'
import Sidebar from '../components/layout/Sidebar'

export const metadata: Metadata = {
  title: 'Murmur — Personal Broadcaster',
  description: 'Send bulk WhatsApp and Gmail messages from your own accounts.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <div className="shell">
          <Sidebar />
          <main className="main">
            {children}
            <NavButtons />
          </main>
        </div>
      </body>
    </html>
  )
}
