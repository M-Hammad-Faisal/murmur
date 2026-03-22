// Root page — redirect to /setup
// Using meta refresh because Next.js redirect() is incompatible with static export (output: 'export')
export default function RootPage() {
  return (
    <html>
      <head>
        <meta httpEquiv="refresh" content="0;url=/setup/" />
      </head>
      <body />
    </html>
  )
}
