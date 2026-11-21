import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { config } from './config'
import walletRoutes from './routes/wallets'
import tokenRoutes from './routes/tokens'
import insiderRoutes from './routes/insiders'
import smartMoneyRoutes from './routes/smart-money'
import scannerRoutes from './routes/scanner'
import watchlistRoutes from './routes/watchlist'
import filterRoutes from './routes/filters'
import { pipelineStatus } from './data/fixtures'
import { startWorker } from './workers/scheduler'

/**
 * Local, offline API. Every response is built from the synthetic dataset in src/data/fixtures.ts;
 * the server makes no outbound network calls.
 */
const app = express()

app.use(helmet())
// Local development only: the Vite dev server proxies /api here, so any localhost origin is fine.
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/], credentials: true }))
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', mode: 'offline-fixtures', timestamp: new Date().toISOString(), pipeline: pipelineStatus })
})

app.use('/api/wallets', walletRoutes)
app.use('/api/tokens', tokenRoutes)
app.use('/api/insiders', insiderRoutes)
app.use('/api/smart-money', smartMoneyRoutes)
app.use('/api/scanner', scannerRoutes)
app.use('/api/watchlist', watchlistRoutes)
app.use('/api/filters', filterRoutes)

app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' })
})

if (require.main === module) {
  app.listen(config.port, '127.0.0.1', () => {
    console.log(`Nodex API (offline, synthetic data) on http://localhost:${config.port}`)
    startWorker()
  })
}

export default app
