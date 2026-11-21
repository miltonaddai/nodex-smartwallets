import dotenv from 'dotenv'

dotenv.config()

/**
 * Local-only configuration. The app runs fully offline: every dataset is synthetic and generated
 * in memory (see src/data/fixtures.ts), there are no accounts or logins, and there are no external
 * services, API keys or blockchain connections.
 */
export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  /** Seed for the synthetic dataset. Change it to get a different, still reproducible, dataset. */
  fixtureSeed: parseInt(process.env.FIXTURE_SEED || '1337', 10),

  worker: {
    // The simulated pipeline (src/workers) runs inside the API on this interval.
    enabled: process.env.WORKER_ENABLED !== 'false',
    intervalSeconds: Math.max(5, parseInt(process.env.WORKER_INTERVAL_SECONDS || '60', 10) || 60),
    // Scoring thresholds read by the pure helpers in src/lib.
    alphaFreshWalletDays: parseInt(process.env.ALPHA_FRESH_WALLET_DAYS || '7', 10),
    // The look-back window the smart money table describes.
    smartMoneyBuyWindowHours: parseInt(process.env.SMART_MONEY_BUY_WINDOW_HOURS || '72', 10),
  },
}
