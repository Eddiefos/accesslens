import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env') })
import express from 'express'
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { runAudit } from './audit.js'

const app = express()
app.use(express.json())

// In-memory job store: auditId → EventEmitter
const jobs = new Map()

app.post('/api/audit', async (req, res) => {
  const { url, html, mode = 'page', componentType = 'auto', model = 'sonnet' } = req.body ?? {}
  if (!url && !html) {
    return res.status(400).json({ error: 'url or html required' })
  }

  const id = randomUUID()
  const emitter = new EventEmitter()
  // Prevent unhandled-error crash if no SSE client has connected yet
  emitter.on('error', () => {})
  jobs.set(id, emitter)

  runAudit({ url, html, mode, componentType, model }, emitter).catch((err) => {
    emitter.emit('error', err.message)
  }).finally(() => {
    setTimeout(() => jobs.delete(id), 60_000)
  })

  res.json({ id })
})

app.get('/api/audit/:id/stream', (req, res) => {
  const emitter = jobs.get(req.params.id)
  if (!emitter) return res.status(404).json({ error: 'audit not found' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  const onProgress = (data) => send('progress', data)
  const onResult = (data) => { send('result', data); res.end() }
  const onError = (msg) => { send('error', { message: msg }); res.end() }

  emitter.on('progress', onProgress)
  emitter.on('result', onResult)
  emitter.on('error', onError)

  req.on('close', () => {
    emitter.off('progress', onProgress)
    emitter.off('result', onResult)
    emitter.off('error', onError)
  })
})

// Serve built client in production
if (process.env.NODE_ENV === 'production') {
  const { default: path } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const distPath = path.join(__dirname, '../client/dist')
  app.use(express.static(distPath))
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')))
}

const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => console.log(`AccessLens server on :${PORT}`))
