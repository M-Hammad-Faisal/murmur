import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV === 'development'

const nextConfig: NextConfig = {
  // Static export for production (loaded by Electron from disk).
  // In dev we run the Next.js dev server with proxy rewrites — rewrites()
  // is incompatible with output:'export' so we switch it off in dev.
  ...(isDev
    ? {
        async rewrites() {
          return [{ source: '/api/:path*', destination: 'http://localhost:4000/:path*' }]
        },
      }
    : {
        output: 'export',
        trailingSlash: true,
      }),
  images: { unoptimized: true },
}

export default nextConfig
