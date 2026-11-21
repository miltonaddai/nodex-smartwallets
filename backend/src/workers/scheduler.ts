import { config } from '../config'
import { pipelineStatus } from '../data/fixtures'
import { runPipeline, type RunResult } from './pipeline'

/**
 * Runs the simulated pipeline on a timer inside the API process. The dataset lives in this
 * process's memory, so the worker has to run here for the dashboards to see its updates (the
 * original worker shared data with the API through a database instead).
 */

let timer: NodeJS.Timeout | null = null

function log(result: RunResult) {
  console.log(`[worker] run ${result.run} finished in ${result.durationMs}ms`)
  for (const step of result.steps) {
    console.log(`[worker]   ${step.step}${step.chain ? ` (${step.chain})` : ''}: ${step.detail}`)
  }
}

function schedule(delayMs: number) {
  pipelineStatus.nextUpdate = new Date(Date.now() + delayMs).toISOString()
  timer = setTimeout(tick, delayMs)
  // Never keep the process alive just for the worker.
  timer.unref()
}

function tick() {
  if (!pipelineStatus.running) {
    try {
      log(runPipeline())
    } catch (error) {
      console.error('[worker] run failed:', error)
    }
  }
  schedule(config.worker.intervalSeconds * 1000)
}

/** Starts the timer: a first run shortly after boot, then every WORKER_INTERVAL_SECONDS. */
export function startWorker(): void {
  if (timer || !config.worker.enabled) return
  console.log(`[worker] simulated pipeline every ${config.worker.intervalSeconds}s`)
  schedule(5_000)
}

export function stopWorker(): void {
  if (timer) clearTimeout(timer)
  timer = null
  pipelineStatus.nextUpdate = null
}
