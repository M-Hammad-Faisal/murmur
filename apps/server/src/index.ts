import cors from 'cors'
import express from 'express'

import broadcastsRouter from './routes/broadcasts'
import channelsRouter from './routes/channels'
import contactsRouter from './routes/contacts'
import logsRouter from './routes/logs'
import { startScheduler } from './services/scheduler'

const PORT = Number(process.env['PORT'] ?? 4000)

export function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const app = express()

    app.use(
      cors({
        origin: ['http://localhost:3000', 'http://localhost:5173', 'file://', 'app://localhost'],
      }),
    )
    app.use(express.json())
    app.use(express.urlencoded({ extended: true }))

    app.get('/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0' }))

    app.use('/channels', channelsRouter)
    app.use('/contacts', contactsRouter)
    app.use('/broadcasts', broadcastsRouter)
    app.use('/logs', logsRouter)

    app.use(
      (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        console.error('[Server Error]', err)
        res.status(500).json({ error: err.message ?? 'Internal server error' })
      },
    )

    const server = app.listen(PORT, '127.0.0.1', () => {
      console.info(`[Murmur] API server running at http://localhost:${PORT}`)
      startScheduler()
      resolve()
    })

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[Murmur] Port ${PORT} already in use`)
        resolve()
      } else {
        reject(err)
      }
    })
  })
}
