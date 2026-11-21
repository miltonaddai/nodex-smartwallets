import { config } from '../config'
import { SUPPORTED_CHAINS } from '../lib/chains'
import { insiderScore, insiderStatus } from '../lib/insider-detection'
import { advanceSighting, peakMultiple, type Sighting } from '../lib/sightings'
import {
  between,
  buysFor,
  createRng,
  DAY,
  hashString,
  HOUR,
  insiders,
  int,
  logBetween,
  makeInsider,
  makeToken,
  pick,
  pipelineStatus,
  round,
  SUPPLY,
  tokenNames,
  tokensFor,
  tradersFor,
  walletsFor,
  type BuyItem,
  type InsiderItem,
  type Rng,
  type SightingFields,
  type TokenItem,
} from '../data/fixtures'

/**
 * Simulated data pipeline. It stands in for the original worker, which pulled market data,
 * trader swaps and launch transactions from external providers. Here every step is a local
 * random process over the synthetic dataset, mutated in place, so the dashboards change from run
 * to run the way they did with live data:
 *
 *   market-health  prices random-walk; liquidity follows; a few pools are pulled (rugs)
 *   discovery      new launches are listed; rugged and aged-out tokens are dropped
 *   smart-money    tracked traders open, add to and trim positions
 *   insiders       insiders distribute; new bundled launches are analyzed
 *   wallets        smart-wallet profit and activity drift
 *   sightings      first-seen and peak-since figures are advanced (lib/sightings)
 *
 * Runs are deterministic for a given FIXTURE_SEED and run number. Nothing touches the network.
 */

export interface StepResult {
  step: string
  chain?: string
  detail: string
}

export interface RunResult {
  run: number
  startedAt: string
  durationMs: number
  steps: StepResult[]
}

const MIN_LIQUIDITY = 5_000
const TOKEN_TARGET = 60
const TOKEN_MAX_AGE_DAYS = 30
const INSIDER_TARGET = 32
const INSIDER_MAX_AGE_DAYS = 14
const BUY_TARGET = 40

/** First-seen/peak state per chain and contract, the same state the real sightings table held. */
const sightingState = new Map<string, Sighting>()

/** Lognormal step: mostly small moves, occasionally a large one, slight upward drift. */
function priceStep(rng: Rng, volatility: number): number {
  const shock = rng() < 0.05 ? between(rng, -1.2, 1.6) : 0
  // Sum of uniforms approximates a normal draw.
  const normal = (rng() + rng() + rng() + rng() - 2) * 1.7
  return Math.exp(normal * volatility + shock * volatility * 3 + 0.002)
}

/** Moves a market by `factor`. Liquidity grows with the square root of price, like an AMM pool. */
function moveMarket<T extends { price: number; marketCap: number; liquidity: number }>(item: T, factor: number): T {
  item.marketCap = Math.max(1_000, Math.round(item.marketCap * factor))
  item.price = item.marketCap / SUPPLY
  item.liquidity = Math.max(0, Math.round(item.liquidity * Math.sqrt(factor)))
  return item
}

function ageDaysOf(launchedAt: string, now: number): number {
  return round((now - Date.parse(launchedAt)) / DAY, 1)
}

// --- Steps ------------------------------------------------------------------------------------

function syncMarketHealth(chain: string, rng: Rng, now: number): StepResult {
  let rugged = 0
  // A price move belongs to the contract, so the smart-money row for the same token moves with it.
  const buyByContract = new Map(buysFor(chain).map((b) => [b.contract, b]))
  for (const token of tokensFor(chain)) {
    const before = token.price
    const factor = priceStep(rng, 0.06)
    const buy = buyByContract.get(token.contract)
    moveMarket(token, factor)
    if (buy) moveMarket(buy, factor)
    if (rng() < 0.004) {
      // A pulled pool keeps dust, well under the listing floor.
      token.liquidity = Math.round(between(rng, 0, MIN_LIQUIDITY * 0.4))
      if (buy) buy.liquidity = token.liquidity
      rugged++
    }
    if (buy) buy.volume24h = Math.max(0, Math.round(buy.volume24h * between(rng, 0.85, 1.15)))
    token.volume = Math.max(0, Math.round(token.marketCap * between(rng, 0.08, 2.5)))
    token.changePct = round(token.changePct * 0.9 + ((token.price - before) / before) * 100, 1)
    token.holders = Math.max(50, token.holders + int(rng, -20, 60))
    token.uniqueWallet24h = Math.round(token.holders * token.churn)
    token.ageDays = ageDaysOf(token.launchedAt, now)
  }
  return { step: 'market-health', chain, detail: `${tokensFor(chain).length} tokens refreshed, ${rugged} liquidity pulled` }
}

function syncDiscovery(chain: string, rng: Rng, now: number): StepResult {
  const tokens = tokensFor(chain)
  const before = tokens.length
  // Drop pulled pools and tokens past the discovery window, in place so readers see the same array.
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].liquidity < MIN_LIQUIDITY || tokens[i].ageDays > TOKEN_MAX_AGE_DAYS) tokens.splice(i, 1)
  }
  // Refill to the target, sometimes one more, then retire the oldest so the list stays bounded.
  const wanted = Math.max(0, TOKEN_TARGET - tokens.length) + (rng() < 0.5 ? 1 : 0)
  const names = tokenNames(rng, wanted, tokens.map((t) => t.symbol))
  for (const { name, symbol } of names) {
    tokens.push(makeToken(chain, rng, name, symbol, { ageDays: round(between(rng, 0.1, 1.5), 1), now }))
  }
  while (tokens.length > TOKEN_TARGET + 5) {
    const oldest = tokens.reduce((a, b) => (b.ageDays > a.ageDays ? b : a))
    tokens.splice(tokens.indexOf(oldest), 1)
  }
  const dropped = before + names.length - tokens.length
  return { step: 'discovery', chain, detail: `${names.length} listed, ${dropped} dropped, ${tokens.length} tracked` }
}

function syncSmartMoney(chain: string, rng: Rng, now: number): StepResult {
  const buys = buysFor(chain)
  const traders = tradersFor(chain)
  const tokens = new Map(tokensFor(chain).map((t) => [t.contract, t]))
  const windowMs = config.worker.smartMoneyBuyWindowHours * HOUR
  let added = 0
  let trimmed = 0

  for (const buy of buys) {
    // Market-health already moved buys whose token is still listed; the rest move on their own.
    if (!tokens.has(buy.contract)) {
      moveMarket(buy, priceStep(rng, 0.08))
      buy.volume24h = Math.round(buy.volume24h * between(rng, 0.8, 1.2))
    }
    buy.priceChange24h = round(buy.priceChange24h * 0.7 + between(rng, -15, 20), 1)

    // A tracked trader opens a position.
    if (rng() < 0.15 && buy.wallets.length < traders.length) {
      const trader = pick(rng, traders.filter((t) => !buy.wallets.some((w) => w.address === t.address)))
      const usd = Math.round(logBetween(rng, 300, 20_000))
      buy.wallets.push({
        address: trader.address,
        netBuyUsd: usd,
        lastBuyAt: new Date(now).toISOString(),
        rank: trader.rank,
        realizedPnl30d: trader.realizedPnl30d,
        handle: trader.handle,
        displayName: trader.displayName,
        avatarUrl: trader.avatarUrl,
      })
      buy.buyUsd += usd
      buy.buyCount++
      buy.lastBuyAt = new Date(now).toISOString()
      added++
    }
    // A trader takes profit.
    if (rng() < 0.12 && buy.wallets.length > 0) {
      const wallet = pick(rng, buy.wallets)
      const sold = Math.round(wallet.netBuyUsd * between(rng, 0.2, 1))
      wallet.netBuyUsd -= sold
      buy.sellUsd += sold
      if (wallet.netBuyUsd < 250) buy.wallets.splice(buy.wallets.indexOf(wallet), 1)
      trimmed++
    }
    buy.walletCount = buy.wallets.length
    buy.netBuyUsd = buy.wallets.reduce((sum, w) => sum + w.netBuyUsd, 0)
    buy.buyerRealizedPnl30d = buy.wallets.reduce((sum, w) => sum + (w.realizedPnl30d ?? 0), 0)
  }

  // Tokens nobody holds any more, or whose last buy left the window, fall off the list.
  const before = buys.length
  for (let i = buys.length - 1; i >= 0; i--) {
    const stale = now - Date.parse(buys[i].lastBuyAt) > windowMs
    if (buys[i].walletCount === 0 || buys[i].liquidity < MIN_LIQUIDITY || stale) buys.splice(i, 1)
  }
  const dropped = before - buys.length

  // Traders pile into tokens they were not holding.
  const held = new Set(buys.map((b) => b.contract))
  const candidates = [...tokens.values()].filter((t) => !held.has(t.contract))
  let opened = 0
  while (buys.length < BUY_TARGET && candidates.length > 0) {
    const token = candidates.splice(Math.floor(rng() * candidates.length), 1)[0]
    buys.push(newBuy(token, traders, rng, now))
    opened++
  }
  return {
    step: 'smart-money',
    chain,
    detail: `${added} new positions, ${trimmed} trims, ${opened} tokens added, ${dropped} dropped, ${buys.length} listed`,
  }
}

function newBuy(token: TokenItem, traders: ReturnType<typeof tradersFor>, rng: Rng, now: number): BuyItem {
  const chosen = [...traders].sort(() => rng() - 0.5).slice(0, int(rng, 1, 4))
  const wallets = chosen.map((trader) => ({
    address: trader.address,
    netBuyUsd: Math.round(logBetween(rng, 300, 20_000)),
    lastBuyAt: new Date(now - between(rng, 0, 2) * HOUR).toISOString(),
    rank: trader.rank,
    realizedPnl30d: trader.realizedPnl30d,
    handle: trader.handle,
    displayName: trader.displayName,
    avatarUrl: trader.avatarUrl,
  }))
  const netBuyUsd = wallets.reduce((sum, w) => sum + w.netBuyUsd, 0)
  return {
    rank: 0,
    contract: token.contract,
    symbol: token.symbol,
    name: token.name,
    imageUrl: '',
    walletCount: wallets.length,
    buyUsd: netBuyUsd,
    sellUsd: 0,
    netBuyUsd,
    buyCount: wallets.length,
    firstBuyAt: wallets.map((w) => w.lastBuyAt).sort()[0],
    lastBuyAt: wallets.map((w) => w.lastBuyAt).sort().reverse()[0],
    price: token.price,
    marketCap: token.marketCap,
    liquidity: token.liquidity,
    volume24h: token.volume,
    priceChange24h: token.changePct,
    buyerRealizedPnl30d: wallets.reduce((sum, w) => sum + w.realizedPnl30d, 0),
    wallets,
    firstSeenAt: token.firstSeenAt,
    firstSeenMc: token.firstSeenMc,
    peakMc: token.peakMc,
    peakMultiple: token.peakMultiple,
  }
}

function pricePattern(item: InsiderItem): string {
  // Same rules as lib/insider-detection classifyPriceShape, on the running figures.
  if (item.postLaunchLowMc <= item.launchHighMc * 0.5 && item.marketCap >= item.postLaunchLowMc * 2) return 'reclaiming'
  if (item.marketCap <= item.launchHighMc * 0.5) return 'retracing'
  if (item.marketCap >= item.launchHighMc) return 'new_highs'
  return 'ranging'
}

function syncInsiders(rng: Rng, now: number): StepResult {
  const list = insiders()
  let distributed = 0
  for (const item of list) {
    moveMarket(item, priceStep(rng, 0.09))
    item.volume24h = Math.round(item.marketCap * between(rng, 0.1, 3))
    item.priceChange24h = round(item.priceChange24h * 0.7 + between(rng, -20, 25), 1)
    item.postLaunchLowMc = Math.min(item.postLaunchLowMc, item.marketCap)
    item.athMc = Math.max(item.athMc, item.marketCap)
    // Insiders sell into strength more than weakness.
    if (item.insiderHoldingPct > 0 && rng() < (item.priceChange24h > 0 ? 0.35 : 0.15)) {
      item.insiderHoldingPct = round(item.insiderHoldingPct * between(rng, 0.6, 0.95), 2)
      distributed++
    }
    item.insiderStatus = insiderStatus(item.insiderHoldingPct, item.insiderAcquiredPct)
    item.insiderScore = insiderScore(item.launchScore, item.insiderHoldingPct, item.insiderAcquiredPct)
    item.pricePattern = pricePattern(item)
  }
  const before = list.length
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].liquidity < MIN_LIQUIDITY || ageDaysOf(list[i].launchedAt, now) > INSIDER_MAX_AGE_DAYS) list.splice(i, 1)
  }
  const dropped = before - list.length
  // At most a few new launches analyzed per run, as the real worker capped its per-run cost.
  const wanted = Math.min(3, Math.max(0, INSIDER_TARGET - list.length) + (rng() < 0.3 ? 1 : 0))
  const names = tokenNames(rng, wanted, list.map((t) => t.symbol))
  for (const { name, symbol } of names) {
    list.push(makeInsider(rng, name, symbol, { ageDays: round(between(rng, 0.05, 0.5), 2), now }))
  }
  return { step: 'insiders', detail: `${distributed} distributing, ${names.length} analyzed, ${dropped} dropped, ${list.length} tracked` }
}

function syncWallets(rng: Rng, now: number): StepResult {
  let active = 0
  for (const days of [1, 7, 30, 365]) {
    const wallets = walletsFor(days)
    for (let i = 0; i < wallets.length; i++) {
      // The same wallet trades in every period's view; use one decision per wallet and run.
      const trades = createRng(hashString(`${wallets[i].address}:${pipelineStatus.runs}`))
      if (trades() >= 0.25) continue
      const wallet = wallets[i]
      const pnl = Math.round(logBetween(rng, 50, 8_000) * (trades() < 0.62 ? 1 : -1))
      wallet.trades += int(rng, 1, 4)
      wallet.volume += Math.abs(pnl) * int(rng, 3, 10)
      wallet.realizedProfit += pnl
      wallet.totalProfit = wallet.realizedProfit + wallet.unrealizedProfit
      wallet.winRate = round(Math.min(99, Math.max(1, wallet.winRate + (pnl > 0 ? 0.3 : -0.4))), 1)
      wallet.lastActive = new Date(now - between(rng, 0, 30) * 60_000).toISOString()
      if (days === 7) active++
    }
  }
  return { step: 'wallets', detail: `${active} wallets traded` }
}

function syncSightings(chain: string, now: number): StepResult {
  const at = Math.floor(now / 1000)
  const items: Array<{ contract: string; price: number; marketCap: number; liquidity: number } & SightingFields> = [
    ...tokensFor(chain),
    ...buysFor(chain),
    ...(chain === 'solana' ? insiders() : []),
  ]
  let peaks = 0
  for (const item of items) {
    const key = `${chain}:${item.contract}`
    // Seed from the generated figures the first time a contract is seen by the pipeline.
    const previous =
      sightingState.get(key) ??
      (item.firstSeenAt && item.firstSeenMc
        ? {
            firstSeenAt: Math.floor(Date.parse(item.firstSeenAt) / 1000),
            firstPrice: item.firstSeenMc / SUPPLY,
            firstMc: item.firstSeenMc,
            peakPrice: (item.peakMc ?? item.firstSeenMc) / SUPPLY,
            peakMc: item.peakMc ?? item.firstSeenMc,
            peakAt: at,
            lastPrice: item.price,
            lastLiq: item.liquidity,
          }
        : undefined)
    const next = advanceSighting(previous, { at, price: item.price, marketCap: item.marketCap, liquidity: item.liquidity })
    if (previous && next.peakPrice > previous.peakPrice) peaks++
    sightingState.set(key, next)
    item.firstSeenAt = new Date(next.firstSeenAt * 1000).toISOString()
    item.firstSeenMc = next.firstMc || null
    item.peakMc = next.peakMc || null
    item.peakMultiple = peakMultiple(next.firstPrice, next.peakPrice)
  }
  return { step: 'sightings', chain, detail: `${items.length} readings, ${peaks} new peaks` }
}

// --- Run ---------------------------------------------------------------------------------------

/** Runs every step once, in the same order as the original pipeline. */
export function runPipeline(now = Date.now()): RunResult {
  const started = Date.now()
  const run = pipelineStatus.runs + 1
  const rng = createRng(config.fixtureSeed ^ hashString(`pipeline:${run}`))
  pipelineStatus.running = true
  const steps: StepResult[] = []
  try {
    for (const chain of SUPPORTED_CHAINS) {
      steps.push(syncMarketHealth(chain, rng, now))
      steps.push(syncDiscovery(chain, rng, now))
      steps.push(syncSmartMoney(chain, rng, now))
    }
    steps.push(syncInsiders(rng, now))
    steps.push(syncWallets(rng, now))
    for (const chain of SUPPORTED_CHAINS) steps.push(syncSightings(chain, now))
    pipelineStatus.lastUpdated = new Date(now).toISOString()
    pipelineStatus.lastError = null
  } catch (error) {
    pipelineStatus.lastError = error instanceof Error ? error.message : String(error)
    throw error
  } finally {
    pipelineStatus.running = false
    pipelineStatus.runs = run
    pipelineStatus.lastRunMs = Date.now() - started
  }
  return { run, startedAt: new Date(started).toISOString(), durationMs: Date.now() - started, steps }
}
