import { config } from '../config'
import { buysFor, insiders, tokensFor } from '../data/fixtures'
import { runPipeline } from './pipeline'

/**
 * Standalone runner for the simulated pipeline, for inspecting what each run does:
 *
 *   npm run worker              one run
 *   npm run worker -- --runs 10 ten runs, the clock advancing one interval per run
 *
 * It works on its own copy of the dataset. The API runs the same pipeline in-process
 * (src/workers/scheduler.ts), which is what the dashboards show.
 */

function argRuns(): number {
  const i = process.argv.indexOf('--runs')
  const n = i >= 0 ? Number(process.argv[i + 1]) : 1
  return Number.isInteger(n) && n > 0 ? n : 1
}

const runs = argRuns()
const intervalMs = config.worker.intervalSeconds * 1000
const start = Date.now()

for (let i = 0; i < runs; i++) {
  const result = runPipeline(start + i * intervalMs)
  console.log(`run ${result.run} (${result.durationMs}ms)`)
  for (const step of result.steps) console.log(`  ${step.step}${step.chain ? ` (${step.chain})` : ''}: ${step.detail}`)
}

console.log(
  `\nafter ${runs} run(s): solana ${tokensFor('solana').length} tokens, ` +
    `${buysFor('solana').length} smart-money buys, ${insiders().length} insider plays`
)
