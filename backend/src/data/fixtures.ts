import { config } from '../config'
import { SUPPORTED_CHAINS } from '../lib/chains'
import { insiderScore, insiderStatus } from '../lib/insider-detection'
import { peakMultiple } from '../lib/sightings'

/**
 * Synthetic, offline dataset for every screen in the app.
 *
 * Nothing here comes from a real person, wallet, token or API. Names are built from word lists,
 * addresses are random strings in the right format, and every number comes from a seeded PRNG, so
 * the same FIXTURE_SEED always produces the same data. Timestamps are relative to server start so
 * the data always looks recent.
 */

// --- Seeded randomness -----------------------------------------------------------------------

export type Rng = () => number

/** mulberry32: small, fast, deterministic. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A stable 32-bit hash, used to seed per-address generators. */
export function hashString(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const between = (rng: Rng, min: number, max: number) => min + rng() * (max - min)
export const int = (rng: Rng, min: number, max: number) => Math.floor(between(rng, min, max + 1))
export const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)]
/** Log-uniform, for heavy-tailed values like market cap. */
export const logBetween = (rng: Rng, min: number, max: number) => Math.exp(between(rng, Math.log(min), Math.log(max)))
export const round = (value: number, places = 2) => Math.round(value * 10 ** places) / 10 ** places

/** Every synthetic token has this supply, so price = market cap / SUPPLY. */
export const SUPPLY = 1_000_000_000

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export function solanaAddress(rng: Rng): string {
  return Array.from({ length: 44 }, () => BASE58[Math.floor(rng() * BASE58.length)]).join('')
}

export function addressFor(_chain: string, rng: Rng): string {
  return solanaAddress(rng)
}

// --- Time --------------------------------------------------------------------------------------

const STARTED_AT = Date.now()
export const HOUR = 3_600_000
export const DAY = 24 * HOUR

/**
 * State of the simulated pipeline (src/workers). The dataset below is its starting point; each
 * run mutates it in place, and these fields say when that last happened.
 */
export interface PipelineStatus {
  lastUpdated: string
  nextUpdate: string | null
  running: boolean
  runs: number
  lastRunMs: number | null
  lastError: string | null
}

export const pipelineStatus: PipelineStatus = {
  lastUpdated: new Date(STARTED_AT - 20 * 60_000).toISOString(),
  nextUpdate: null,
  running: false,
  runs: 0,
  lastRunMs: null,
  lastError: null,
}

const isoAgo = (ms: number, now = STARTED_AT) => new Date(now - ms).toISOString()

// --- Word lists --------------------------------------------------------------------------------

const ADJECTIVES = [
  'Nyan', 'Moon', 'Pixel', 'Turbo', 'Rocket', 'Chain', 'Degen', 'Solar', 'Neon', 'Cosmic', 'Lucky',
  'Frosty', 'Hyper', 'Quantum', 'Velvet', 'Atomic', 'Golden', 'Sleepy', 'Brave', 'Tiny',
] as const
const NOUNS = [
  'Frog', 'Cat', 'Dog', 'Owl', 'Fox', 'Bear', 'Fish', 'Ape', 'Wizard', 'Ghost', 'Panda', 'Otter',
  'Shark', 'Duck', 'Goat', 'Llama', 'Crab', 'Moth',
] as const
const ALIAS_FIRST = [
  'quiet', 'amber', 'north', 'river', 'paper', 'cedar', 'lunar', 'copper', 'misty', 'swift', 'hollow',
  'violet', 'stone', 'ember', 'polar', 'sable',
] as const
const ALIAS_SECOND = [
  'heron', 'lynx', 'falcon', 'badger', 'marten', 'wren', 'tern', 'ibis', 'stoat', 'kestrel', 'vole',
  'egret', 'finch', 'plover',
] as const

// --- Shared types ------------------------------------------------------------------------------

export interface SightingFields {
  firstSeenAt: string | null
  firstSeenMc: number | null
  peakMc: number | null
  peakMultiple: number | null
}

export interface TokenItem extends SightingFields {
  rank: number
  name: string
  symbol: string
  imageUrl?: string
  contract: string
  price: number
  marketCap: number
  changePct: number
  volume: number
  holders: number
  liquidity: number
  launchedAt: string
  ageDays: number
  alphaScore: number
  smartWalletBuyers: number
  smartMoneyNetFlow: number
  buyAcceleration: number
  qualifiedWalletBuyers: number
  freshWalletBuyers: number
  freshWalletShare: number
  evidenceTier: 'verified' | 'partial' | 'unverified'
  realBuyers: number
  independentBuyers: number
  netInflowUsd: number
  retentionRate: number
  demandPersistence: number
  sniperShare: number
  topBuyerShare: number
  washRatio: number
  churn: number
  uniqueWallet24h: number
  buySellRatio: number
  wealthyHolders: number
  medianHolderWealthUsd: number
  enrichedHolders: number
  riskFlags: string[]
}

export interface WalletItem {
  rank: number
  address: string
  balance: number
  totalProfit: number
  winRate: number
  trades: number
  volume: number
  tokensHeld: number
  /** ISO timestamp; routes format it as "3h ago". */
  lastActive: string
  smartScore: number
  qualifiedTokens: number
  qualifiedWins: number
  qualifiedProfitUsd: number
  qualifiedWinRate: number
  youngTokenTrades: number
  youngTokenWins: number
  medianRoiPct: number
  avgEntryDelayMinutes: number
  realizedProfit: number
  unrealizedProfit: number
  concentrationPct: number
  riskFlags: string[]
}

export interface WalletPosition {
  contract: string
  name: string
  symbol: string
  launchedAt: string
  firstBuyAt: string
  lastTradeAt: string
  entryDelayMinutes: number
  buyUsd: number
  sellUsd: number
  boughtAmount: number
  soldAmount: number
  remainingAmount: number
  realizedPnl: number
  unrealizedPnl: number
  roiPct: number
  tradeCount: number
  suspiciousTradeCount: number
  currentPrice: number
  marketCap: number
  liquidity: number
  alphaScore: number
  isOpen: boolean
}

export interface TrackedTrader {
  address: string
  rank: number
  pnl30d: number
  realizedPnl30d: number
  volume30d: number
  trades30d: number
  handle: string
  displayName: string
  avatarUrl: string | null
  followers: number
}

export interface BuyWallet {
  address: string
  netBuyUsd: number
  lastBuyAt: string | null
  rank: number | null
  realizedPnl30d: number | null
  handle: string | null
  displayName: string | null
  avatarUrl: string | null
}

export interface BuyItem extends SightingFields {
  rank: number
  contract: string
  symbol: string
  name: string
  imageUrl: string
  walletCount: number
  buyUsd: number
  sellUsd: number
  netBuyUsd: number
  buyCount: number
  firstBuyAt: string
  lastBuyAt: string
  price: number
  marketCap: number
  liquidity: number
  volume24h: number
  priceChange24h: number
  buyerRealizedPnl30d: number
  wallets: BuyWallet[]
}

export interface InsiderItem extends SightingFields {
  rank: number
  contract: string
  name: string
  symbol: string
  imageUrl: string
  launchedAt: string
  launchBuyers: number
  creationBlockSupplyPct: number
  linkedWallets: number
  linkedSupplyPct: number
  clusters: number
  largestClusterSupplyPct: number
  insiderWallets: string[]
  insiderAcquiredPct: number
  insiderHoldingPct: number
  insiderStatus: string
  launchScore: number
  insiderScore: number
  evidence: string[]
  price: number
  marketCap: number
  liquidity: number
  volume24h: number
  priceChange24h: number
  holders: number
  launchHighMc: number
  postLaunchLowMc: number
  athMc: number
  pricePattern: string
}

export interface WatchlistWallet {
  id: string
  name: string
  address: string
  balance: number | null
  pnl7d: number | null
  winRate: number | null
  lastActive: string | null
  chain: string
  handle?: string | null
  displayName?: string | null
  avatarUrl?: string | null
  analyticsUnavailable?: boolean
}

// --- Generators --------------------------------------------------------------------------------

export function tokenNames(rng: Rng, count: number, taken: Iterable<string> = []): Array<{ name: string; symbol: string }> {
  const seen = new Set<string>(taken)
  const out: Array<{ name: string; symbol: string }> = []
  while (out.length < count) {
    const adjective = pick(rng, ADJECTIVES)
    const noun = pick(rng, NOUNS)
    let symbol = `${adjective[0]}${noun}`.toUpperCase().slice(0, 6)
    let name = `${adjective} ${noun}`
    if (seen.has(symbol)) {
      const n = int(rng, 2, 999)
      symbol = `${symbol.slice(0, 4)}${n}`
      name = `${name} ${n}`
      if (seen.has(symbol)) continue
    }
    seen.add(symbol)
    out.push({ name, symbol })
  }
  return out
}

function sightings(rng: Rng, marketCap: number, price: number, ageDays: number, now = STARTED_AT): SightingFields {
  const multiple = round(logBetween(rng, 1, 14), 2)
  // Somewhere between first sighting and the peak, the token now trades at `marketCap`.
  const firstMc = marketCap / between(rng, 0.35, Math.max(0.36, multiple))
  const firstPrice = price * (firstMc / marketCap)
  return {
    firstSeenAt: isoAgo(between(rng, Math.min(0.1, ageDays), Math.min(ageDays, 10)) * DAY, now),
    firstSeenMc: Math.round(firstMc),
    peakMc: Math.round(firstMc * multiple),
    peakMultiple: peakMultiple(firstPrice, firstPrice * multiple),
  }
}

function buildTokens(chain: string): TokenItem[] {
  const rng = createRng(config.fixtureSeed ^ hashString(`tokens:${chain}`))
  return tokenNames(rng, 60).map(({ name, symbol }) => makeToken(chain, rng, name, symbol))
}

/** One synthetic token. The pipeline's discovery step calls this with a fresh age and `now`. */
export function makeToken(
  chain: string,
  rng: Rng,
  name: string,
  symbol: string,
  opts: { ageDays?: number; now?: number } = {}
): TokenItem {
  {
    const now = opts.now ?? STARTED_AT
    const ageDays = opts.ageDays ?? round(between(rng, 1, 30), 1)
    const marketCap = Math.round(logBetween(rng, 60_000, 9_000_000))
    const price = marketCap / SUPPLY
    const holders = int(rng, 150, 9000)
    const churn = round(rng() < 0.85 ? between(rng, 1.5, 6) : between(rng, 6, 14), 2)
    const realBuyers = int(rng, 30, Math.min(600, holders))
    const independentBuyers = Math.round(realBuyers * between(rng, 0.45, 1))
    const freshWalletBuyers = Math.round(realBuyers * between(rng, 0.02, 0.4))
    const riskFlags: string[] = []
    if (freshWalletBuyers / realBuyers > 0.3) riskFlags.push('fresh_wallet_heavy')
    if (independentBuyers / realBuyers < 0.55) riskFlags.push('low_independence')
    if (rng() < 0.1) riskFlags.push('net_outflow')
    return {
      rank: 0,
      name,
      symbol,
      imageUrl: undefined,
      contract: addressFor(chain, rng),
      price,
      marketCap,
      changePct: round(between(rng, -60, 420), 1),
      volume: Math.round(marketCap * between(rng, 0.08, 2.5)),
      holders,
      liquidity: Math.round(marketCap * between(rng, 0.05, 0.3)),
      launchedAt: isoAgo(ageDays * DAY, now),
      ageDays,
      alphaScore: round(between(rng, 18, 96), 1),
      smartWalletBuyers: int(rng, 0, 14),
      smartMoneyNetFlow: Math.round(between(rng, -20_000, 140_000)),
      buyAcceleration: round(between(rng, 0.4, 3.5), 2),
      qualifiedWalletBuyers: int(rng, 0, 30),
      freshWalletBuyers,
      freshWalletShare: round(freshWalletBuyers / realBuyers, 3),
      evidenceTier: pick(rng, ['verified', 'verified', 'partial', 'unverified'] as const),
      realBuyers,
      independentBuyers,
      netInflowUsd: Math.round(between(rng, -15_000, 250_000)),
      retentionRate: round(between(rng, 0.2, 0.9), 3),
      demandPersistence: round(between(rng, 0.1, 1), 3),
      sniperShare: round(between(rng, 0, 0.35), 3),
      topBuyerShare: round(between(rng, 0.02, 0.3), 3),
      washRatio: round(between(rng, 0, 0.25), 3),
      churn,
      uniqueWallet24h: Math.round(holders * churn),
      buySellRatio: round(between(rng, 0.6, 1.9), 2),
      wealthyHolders: int(rng, 0, 10),
      medianHolderWealthUsd: Math.round(logBetween(rng, 300, 90_000)),
      enrichedHolders: 10,
      riskFlags,
      ...sightings(rng, marketCap, price, ageDays, now),
    }
  }
}

const PERIOD_SCALE: Record<number, number> = { 1: 0.3, 7: 1, 30: 2.4, 365: 4.2 }

function buildWallets(periodDays: number): WalletItem[] {
  // Same addresses for every period; only the period's metrics change.
  const addressRng = createRng(config.fixtureSeed ^ hashString('wallets:addresses'))
  const rng = createRng(config.fixtureSeed ^ hashString(`wallets:${periodDays}`))
  const scale = PERIOD_SCALE[periodDays] ?? 1
  return Array.from({ length: 80 }, (_, i) => {
    const address = solanaAddress(addressRng)
    const trades = Math.max(5, Math.round(int(rng, 12, 260) * scale))
    const winRate = round(between(rng, 38, 86), 1)
    const qualifiedTokens = Math.max(2, Math.round(int(rng, 2, 14) * Math.sqrt(scale)))
    const qualifiedWins = Math.min(qualifiedTokens, Math.round(qualifiedTokens * between(rng, 0.4, 1)))
    const totalProfit = Math.round(logBetween(rng, 1_500, 380_000) * scale)
    const realizedShare = between(rng, 0.4, 0.95)
    const smartScore = round(between(rng, 50, 98) - i * 0.15, 1)
    const concentrationPct = round(between(rng, 8, 85), 1)
    const riskFlags: string[] = []
    if (concentrationPct > 75) riskFlags.push('high_concentration')
    if (rng() < 0.08) riskFlags.push('suspicious_activity')
    return {
      rank: 0,
      address,
      balance: Math.round(logBetween(rng, 2_000, 900_000)),
      totalProfit,
      winRate,
      trades,
      volume: Math.round(totalProfit * between(rng, 2.5, 12)),
      tokensHeld: int(rng, 2, 40),
      lastActive: isoAgo(logBetween(rng, 2 * 60_000, Math.min(periodDays, 6) * DAY)),
      smartScore,
      qualifiedTokens,
      qualifiedWins,
      qualifiedProfitUsd: Math.round(totalProfit * between(rng, 0.3, 0.9)),
      qualifiedWinRate: round((qualifiedWins / qualifiedTokens) * 100, 1),
      youngTokenTrades: Math.round(trades * between(rng, 0.2, 0.7)),
      youngTokenWins: Math.round(trades * between(rng, 0.1, 0.4)),
      medianRoiPct: round(between(rng, -10, 220), 1),
      avgEntryDelayMinutes: round(logBetween(rng, 2, 2_400), 1),
      realizedProfit: Math.round(totalProfit * realizedShare),
      unrealizedProfit: Math.round(totalProfit * (1 - realizedShare)),
      concentrationPct,
      riskFlags,
    }
  })
}

function buildPositions(address: string, periodDays: number): WalletPosition[] {
  const rng = createRng(config.fixtureSeed ^ hashString(`positions:${address}:${periodDays}`))
  const tokens = tokensFor('solana')
  const count = int(rng, 4, 12)
  const used = new Set<number>()
  const positions: WalletPosition[] = []
  while (positions.length < count) {
    const index = Math.floor(rng() * tokens.length)
    if (used.has(index)) continue
    used.add(index)
    const token = tokens[index]
    const buyUsd = Math.round(logBetween(rng, 150, 40_000))
    const roiPct = round(between(rng, -70, 600), 1)
    const soldShare = rng() < 0.6 ? between(rng, 0.3, 1) : 0
    const boughtAmount = Math.round(buyUsd / (token.price * between(rng, 0.2, 1.5)))
    const soldAmount = Math.round(boughtAmount * soldShare)
    const remainingAmount = boughtAmount - soldAmount
    const pnl = buyUsd * (roiPct / 100)
    const realizedPnl = Math.round(pnl * soldShare)
    const firstBuyMs = between(rng, 0.05, Math.min(token.ageDays, periodDays)) * DAY
    positions.push({
      contract: token.contract,
      name: token.name,
      symbol: token.symbol,
      launchedAt: token.launchedAt,
      firstBuyAt: isoAgo(firstBuyMs),
      lastTradeAt: isoAgo(firstBuyMs * between(rng, 0, 0.9)),
      entryDelayMinutes: round(logBetween(rng, 1, 3_000), 1),
      buyUsd,
      sellUsd: Math.round((buyUsd + pnl) * soldShare),
      boughtAmount,
      soldAmount,
      remainingAmount,
      realizedPnl,
      unrealizedPnl: Math.round(pnl - realizedPnl),
      roiPct,
      tradeCount: int(rng, 1, 18),
      suspiciousTradeCount: rng() < 0.1 ? 1 : 0,
      currentPrice: token.price,
      marketCap: token.marketCap,
      liquidity: token.liquidity,
      alphaScore: token.alphaScore,
      isOpen: remainingAmount > 0,
    })
  }
  return positions.sort((a, b) => b.lastTradeAt.localeCompare(a.lastTradeAt))
}

function buildTraders(chain: string): TrackedTrader[] {
  // One synthetic trader roster, each with a Solana wallet.
  const rng = createRng(config.fixtureSeed ^ hashString('traders'))
  const walletRng = createRng(config.fixtureSeed ^ hashString('traders:solana'))
  const seen = new Set<string>()
  const traders: TrackedTrader[] = []
  while (traders.length < 30) {
    const handle = `${pick(rng, ALIAS_FIRST)}_${pick(rng, ALIAS_SECOND)}`
    if (seen.has(handle)) continue
    seen.add(handle)
    const pnl30d = Math.round(logBetween(rng, 8_000, 450_000))
    traders.push({
      address: addressFor(chain, walletRng),
      rank: 0,
      pnl30d,
      realizedPnl30d: Math.round(pnl30d * between(rng, 0.5, 1)),
      volume30d: Math.round(pnl30d * between(rng, 4, 40)),
      trades30d: int(rng, 20, 2_500),
      handle,
      displayName: handle
        .split('_')
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join(' '),
      avatarUrl: null,
      followers: int(rng, 50, 40_000),
    })
  }
  return traders
    .sort((a, b) => b.realizedPnl30d - a.realizedPnl30d)
    .map((trader, i) => ({ ...trader, rank: i + 1 }))
}

function buildBuys(chain: string): BuyItem[] {
  const rng = createRng(config.fixtureSeed ^ hashString(`buys:${chain}`))
  const traders = tradersFor(chain)
  const tokens = tokensFor(chain).slice(0, 40)
  const windowMs = config.worker.smartMoneyBuyWindowHours * HOUR
  return tokens.map((token, i) => {
    // Every seventh is a small cap with heavy volume that the traders are still holding.
    const smallCap = i % 7 === 3
    const marketCap = smallCap ? Math.round(between(rng, 30_000, 95_000)) : token.marketCap
    const volume24h = smallCap ? Math.round(marketCap * between(rng, 11, 25)) : token.volume
    const liquidity = smallCap ? Math.round(marketCap * between(rng, 0.1, 0.3)) : token.liquidity
    const walletCount = smallCap ? int(rng, 2, 6) : int(rng, 1, 8)
    const chosen = [...traders].sort(() => rng() - 0.5).slice(0, walletCount)
    const wallets: BuyWallet[] = chosen.map((trader) => ({
      address: trader.address,
      netBuyUsd: Math.round(logBetween(rng, 300, 25_000)),
      lastBuyAt: isoAgo(between(rng, 0.1, 1) * windowMs),
      rank: trader.rank,
      realizedPnl30d: trader.realizedPnl30d,
      handle: trader.handle,
      displayName: trader.displayName,
      avatarUrl: trader.avatarUrl,
    }))
    const netBuyUsd = wallets.reduce((sum, w) => sum + w.netBuyUsd, 0)
    const sellUsd = Math.round(netBuyUsd * (smallCap ? between(rng, 0, 0.25) : between(rng, 0, 0.8)))
    const lastBuy = wallets.map((w) => w.lastBuyAt!).sort().reverse()[0]
    const price = marketCap / 1_000_000_000
    return {
      rank: 0,
      contract: token.contract,
      symbol: token.symbol,
      name: token.name,
      imageUrl: '',
      walletCount,
      buyUsd: netBuyUsd + sellUsd,
      sellUsd,
      netBuyUsd,
      buyCount: walletCount + int(rng, 0, walletCount * 3),
      firstBuyAt: isoAgo(between(rng, 0.6, 1) * windowMs),
      lastBuyAt: lastBuy,
      price,
      marketCap,
      liquidity,
      volume24h,
      priceChange24h: round(between(rng, -45, 260), 1),
      buyerRealizedPnl30d: wallets.reduce((sum, w) => sum + (w.realizedPnl30d ?? 0), 0),
      wallets,
      ...sightings(rng, marketCap, price, token.ageDays),
    }
  })
}

const EVIDENCE_TEMPLATES = [
  (n: number) => `${n} launch buyers were funded from the same source wallet`,
  (n: number) => `${n} wallets bought in the creation block`,
  (n: number) => `${n} buys were fee-paid by another buyer`,
  (n: number) => `${n} wallets co-signed launch transactions`,
  (n: number) => `Supply was split across ${n} fresh wallets right after launch`,
]

function buildInsiders(): InsiderItem[] {
  const rng = createRng(config.fixtureSeed ^ hashString('insiders'))
  return tokenNames(rng, 32).map(({ name, symbol }) => makeInsider(rng, name, symbol))
}

/** One synthetic insider-bundled launch. The pipeline calls this for newly analyzed launches. */
export function makeInsider(rng: Rng, name: string, symbol: string, opts: { ageDays?: number; now?: number } = {}): InsiderItem {
  {
    const now = opts.now ?? STARTED_AT
    const ageDays = opts.ageDays ?? round(between(rng, 0.2, 14), 1)
    const marketCap = Math.round(logBetween(rng, 40_000, 6_000_000))
    const price = marketCap / SUPPLY
    const linkedWallets = int(rng, 3, 40)
    const insiderAcquiredPct = round(between(rng, 2, 45), 2)
    const insiderHoldingPct = round(Math.min(insiderAcquiredPct, insiderAcquiredPct * between(rng, 0, 1.05)), 2)
    const launchScore = round(between(rng, 22, 96), 1)
    const launchHighMc = Math.round(marketCap * between(rng, 0.6, 3))
    const postLaunchLowMc = Math.round(Math.min(marketCap, launchHighMc) * between(rng, 0.15, 0.8))
    const athMc = Math.round(Math.max(marketCap, launchHighMc) * between(rng, 1, 2.5))
    const evidence = [...EVIDENCE_TEMPLATES]
      .sort(() => rng() - 0.5)
      .slice(0, int(rng, 2, 4))
      .map((template) => template(int(rng, 2, Math.max(3, linkedWallets))))
    return {
      rank: 0,
      contract: solanaAddress(rng),
      name,
      symbol,
      imageUrl: '',
      launchedAt: isoAgo(ageDays * DAY, now),
      launchBuyers: int(rng, 20, 220),
      creationBlockSupplyPct: round(between(rng, 0, 25), 2),
      linkedWallets,
      linkedSupplyPct: round(insiderAcquiredPct * between(rng, 0.8, 1.2), 2),
      clusters: int(rng, 1, 6),
      largestClusterSupplyPct: round(insiderAcquiredPct * between(rng, 0.3, 0.8), 2),
      insiderWallets: Array.from({ length: Math.min(linkedWallets, 20) }, () => solanaAddress(rng)),
      insiderAcquiredPct,
      insiderHoldingPct,
      insiderStatus: insiderStatus(insiderHoldingPct, insiderAcquiredPct),
      launchScore,
      insiderScore: insiderScore(launchScore, insiderHoldingPct, insiderAcquiredPct),
      evidence,
      price,
      marketCap,
      liquidity: Math.round(Math.max(6_000, marketCap * between(rng, 0.05, 0.25))),
      volume24h: Math.round(marketCap * between(rng, 0.1, 3)),
      priceChange24h: round(between(rng, -55, 180), 1),
      holders: int(rng, 200, 6000),
      launchHighMc,
      postLaunchLowMc,
      athMc,
      pricePattern: pick(rng, ['reclaiming', 'retracing', 'new_highs', 'ranging'] as const),
      ...sightings(rng, marketCap, price, ageDays, now),
    }
  }
}

// --- Cached accessors --------------------------------------------------------------------------

function memo<T>(build: (key: string) => T): (key: string) => T {
  const cache = new Map<string, T>()
  return (key) => {
    if (!cache.has(key)) cache.set(key, build(key))
    return cache.get(key)!
  }
}

const tokenCache = memo(buildTokens)
const walletCache = memo((days) => buildWallets(Number(days)))
const traderCache = memo(buildTraders)
const buyCache = memo(buildBuys)
let insiderCache: InsiderItem[] | null = null

export function isFixtureChain(chain: string): boolean {
  return (SUPPORTED_CHAINS as readonly string[]).includes(chain)
}

export const tokensFor = (chain: string): TokenItem[] => (isFixtureChain(chain) ? tokenCache(chain) : [])
export const walletsFor = (periodDays: number): WalletItem[] => walletCache(String(periodDays))
export const tradersFor = (chain: string): TrackedTrader[] => (isFixtureChain(chain) ? traderCache(chain) : [])
export const buysFor = (chain: string): BuyItem[] => (isFixtureChain(chain) ? buyCache(chain) : [])
export const insiders = (): InsiderItem[] => (insiderCache ??= buildInsiders())
export const positionsFor = (address: string, periodDays: number): WalletPosition[] => buildPositions(address, periodDays)

/** A wallet's metrics for a period: the listed wallet if known, else a reproducible synthetic one. */
export function walletFor(address: string, periodDays: number): WalletItem {
  const listed = walletsFor(periodDays).find((wallet) => wallet.address === address)
  if (listed) return listed
  const rng = createRng(config.fixtureSeed ^ hashString(`wallet:${address}`))
  const template = walletsFor(periodDays)[Math.floor(rng() * 80)]
  return { ...template, address, smartScore: round(template.smartScore * between(rng, 0.5, 0.95), 1) }
}

/** Starter watchlist, using listed synthetic wallets. */
export function starterWatchlist(chain: string): WatchlistWallet[] {
  const names = ['Whale Hunter', 'Smart Money #1', 'Alpha Trader', 'Degen King', 'Sol Sniper', 'Moon Walker']
  const wallets = chain === 'solana' ? walletsFor(7) : tradersFor(chain).map((t) => ({ address: t.address }))
  return names.map((name, i) => ({
    id: `starter-${chain}-${i + 1}`,
    name,
    address: wallets[i].address,
    balance: null,
    pnl7d: null,
    winRate: null,
    lastActive: null,
    chain,
  }))
}
