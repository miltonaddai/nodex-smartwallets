import { insiderStatus } from '../lib/insider-detection'
import { assessRisk, type RiskReport, type ScanFacts } from '../lib/token-risk'
import {
  addressFor,
  buysFor,
  createRng,
  hashString,
  insiders,
  solanaAddress,
  tokensFor,
  tradersFor,
  type Rng,
} from '../data/fixtures'
import { config } from '../config'

/**
 * Token scanner over the synthetic dataset. A contract from the fixtures is scanned with its
 * listed figures; any other well-formed address gets a reproducible synthetic token (seeded from
 * the address), so the scanner works for whatever is typed in. The verdict comes from the real
 * risk rules in lib/token-risk.
 */

export type ScanChain = 'solana'

export interface ScanHolder {
  rank: number
  address: string
  amount: number
  pctOfSupply: number
  valueUsd: number
  nativeBalance: number | null
  netWorthUsd: number | null
  isPool: boolean
  label: string | null
  fomoHandle: string | null
  isInsider: boolean
}

export interface ScanBundle {
  launchBuyers: number
  insiderWallets: string[]
  insiderAcquiredPct: number
  insiderHoldingPct: number | null
  insiderStatus: string
  linkedWallets: number
  clusters: Array<{ wallets: string[]; boughtPct: number; linkKinds: string[] }>
  creationBlockSupplyPct: number
  launchScore: number
  evidence: string[]
  launchedAt: string
}

export interface ScanResult {
  chain: ScanChain
  address: string
  name: string
  symbol: string
  imageUrl: string
  priceUsd: number | null
  marketCapUsd: number | null
  liquidityUsd: number | null
  volume24hUsd: number | null
  priceChange24h: number | null
  ageHours: number | null
  poolCount: number
  primaryDex: string | null
  links: Array<{ label: string; url: string }>
  security: {
    mintAuthority: string | null
    freezeAuthority: string | null
    transferFeeBps: number | null
    transferFeeAuthority: string | null
    permanentDelegate: string | null
    contractVerified: boolean | null
    honeypot: boolean | null
  }
  holders: {
    count: number | null
    top10Pct: number | null
    largestHolderPct: number | null
    list: ScanHolder[]
  }
  trading: {
    buys24h: number | null
    sells24h: number | null
    uniqueWallets24h: number | null
    churn: number | null
  }
  smartMoney: Array<{ handle: string; displayName: string; netBuyUsd: number }>
  bundle: ScanBundle | null
  bundleAvailable: boolean
  risk: RiskReport
  scannedAt: string
}

const SUPPLY = 1_000_000_000
const between = (rng: Rng, min: number, max: number) => min + rng() * (max - min)
const round = (value: number, places = 2) => Math.round(value * 10 ** places) / 10 ** places
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

interface TokenBasics {
  name: string
  symbol: string
  marketCap: number
  liquidity: number
  volume24h: number
  priceChange24h: number
  ageHours: number
  holders: number
  churn: number
}

/** The token's listed figures, or synthetic ones seeded from the address. */
function basicsFor(chain: ScanChain, address: string, rng: Rng): TokenBasics {
  const listed = tokensFor(chain).find((t) => same(t.contract, address))
  if (listed) {
    return {
      name: listed.name,
      symbol: listed.symbol,
      marketCap: listed.marketCap,
      liquidity: listed.liquidity,
      volume24h: listed.volume,
      priceChange24h: listed.changePct,
      ageHours: listed.ageDays * 24,
      holders: listed.holders,
      churn: listed.churn,
    }
  }
  const insider = chain === 'solana' ? insiders().find((t) => same(t.contract, address)) : undefined
  if (insider) {
    return {
      name: insider.name,
      symbol: insider.symbol,
      marketCap: insider.marketCap,
      liquidity: insider.liquidity,
      volume24h: insider.volume24h,
      priceChange24h: insider.priceChange24h,
      ageHours: (Date.now() - Date.parse(insider.launchedAt)) / 3_600_000,
      holders: insider.holders,
      churn: round(between(rng, 0.6, 1.3)),
    }
  }
  const marketCap = Math.round(Math.exp(between(rng, Math.log(20_000), Math.log(5_000_000))))
  return {
    name: `Unlisted Token ${address.slice(-4).toUpperCase()}`,
    symbol: address.slice(0, 4).toUpperCase(),
    marketCap,
    liquidity: Math.round(marketCap * between(rng, 0.02, 0.3)),
    volume24h: Math.round(marketCap * between(rng, 0.05, 3)),
    priceChange24h: round(between(rng, -70, 300), 1),
    ageHours: round(between(rng, 0.5, 900), 1),
    holders: Math.round(between(rng, 40, 6000)),
    churn: round(between(rng, 0.5, 5)),
  }
}

/** Bundle analysis: the stored insider record for listed launches, otherwise a synthetic one. */
function bundleFor(address: string, ageHours: number): ScanBundle {
  const insider = insiders().find((t) => same(t.contract, address))
  if (insider) {
    return {
      launchBuyers: insider.launchBuyers,
      insiderWallets: insider.insiderWallets,
      insiderAcquiredPct: insider.insiderAcquiredPct,
      insiderHoldingPct: insider.insiderHoldingPct,
      insiderStatus: insider.insiderStatus,
      linkedWallets: insider.linkedWallets,
      clusters: [
        {
          wallets: insider.insiderWallets.slice(0, 4),
          boughtPct: insider.largestClusterSupplyPct,
          linkKinds: ['shared_funder', 'fee_paid'],
        },
      ],
      creationBlockSupplyPct: insider.creationBlockSupplyPct,
      launchScore: insider.launchScore,
      evidence: insider.evidence,
      launchedAt: insider.launchedAt,
    }
  }
  const rng = createRng(config.fixtureSeed ^ hashString(`bundle:${address}`))
  const linked = Math.round(between(rng, 0, 12))
  const acquired = linked ? round(between(rng, 0.5, 20)) : 0
  const holding = round(acquired * between(rng, 0, 1))
  const wallets = Array.from({ length: linked }, () => solanaAddress(rng))
  return {
    launchBuyers: Math.round(between(rng, 10, 150)),
    insiderWallets: wallets,
    insiderAcquiredPct: acquired,
    insiderHoldingPct: holding,
    insiderStatus: insiderStatus(holding, acquired),
    linkedWallets: linked,
    clusters: linked ? [{ wallets: wallets.slice(0, 3), boughtPct: round(acquired * 0.6), linkKinds: ['shared_funder'] }] : [],
    creationBlockSupplyPct: round(between(rng, 0, 8)),
    launchScore: linked ? round(between(rng, 10, 80), 1) : 0,
    evidence: linked ? [`${linked} launch buyers share a funding wallet`] : [],
    launchedAt: new Date(Date.now() - ageHours * 3_600_000).toISOString(),
  }
}

function factsFor(result: Omit<ScanResult, 'risk'>): ScanFacts {
  const { security } = result
  return {
    liquidityUsd: result.liquidityUsd,
    marketCapUsd: result.marketCapUsd,
    ageHours: result.ageHours,
    mintAuthorityActive: Boolean(security.mintAuthority),
    freezeAuthorityActive: Boolean(security.freezeAuthority),
    transferFeeBps: security.transferFeeBps,
    transferFeeChangeable: Boolean(security.transferFeeAuthority),
    honeypot: security.honeypot,
    permanentDelegate: Boolean(security.permanentDelegate),
    contractVerified: security.contractVerified,
    holders: result.holders.count,
    uniqueWallets24h: result.trading.uniqueWallets24h,
    buys24h: result.trading.buys24h,
    sells24h: result.trading.sells24h,
    top10Pct: result.holders.top10Pct,
    largestHolderPct: result.holders.largestHolderPct,
    bundle: result.bundle
      ? {
          insiderAcquiredPct: result.bundle.insiderAcquiredPct,
          insiderHoldingPct: result.bundle.insiderHoldingPct,
          linkedWallets: result.bundle.linkedWallets,
        }
      : null,
    smartMoneyBuyers: result.smartMoney.length,
  }
}

export function scanToken(chain: ScanChain, address: string): ScanResult {
  const rng = createRng(config.fixtureSeed ^ hashString(`scan:${chain}:${address.toLowerCase()}`))
  const basics = basicsFor(chain, address, rng)
  const priceUsd = basics.marketCap / SUPPLY
  const bundle = chain === 'solana' && insiders().some((t) => same(t.contract, address)) ? bundleFor(address, basics.ageHours) : null
  const insiderSet = new Set((bundle?.insiderWallets ?? []).map((w) => w.toLowerCase()))

  // Holders: the pool first, then wallets with a decaying share of supply.
  const traders = tradersFor(chain)
  const list: ScanHolder[] = []
  const poolPct = round(between(rng, 5, 25))
  list.push({
    rank: 1,
    address: addressFor(chain, rng),
    amount: Math.round((poolPct / 100) * SUPPLY),
    pctOfSupply: poolPct,
    valueUsd: Math.round((poolPct / 100) * SUPPLY * priceUsd),
    nativeBalance: null,
    netWorthUsd: null,
    isPool: true,
    label: 'Liquidity pool',
    fomoHandle: null,
    isInsider: false,
  })
  let share = between(rng, 1.5, 9)
  for (let i = 0; i < 19; i++) {
    const insiderWallet = bundle && i < 3 ? bundle.insiderWallets[i] : undefined
    const trader = !insiderWallet && rng() < 0.08 ? traders[Math.floor(rng() * traders.length)] : undefined
    const holderAddress = insiderWallet ?? trader?.address ?? addressFor(chain, rng)
    const pct = round(share)
    list.push({
      rank: i + 2,
      address: holderAddress,
      amount: Math.round((pct / 100) * SUPPLY),
      pctOfSupply: pct,
      valueUsd: Math.round((pct / 100) * SUPPLY * priceUsd),
      nativeBalance: round(between(rng, 0.05, 400), 3),
      netWorthUsd: chain === 'solana' ? Math.round(Math.exp(between(rng, Math.log(200), Math.log(2_000_000)))) : null,
      isPool: false,
      label: null,
      fomoHandle: trader?.handle ?? null,
      isInsider: insiderSet.has(holderAddress.toLowerCase()),
    })
    share *= between(rng, 0.7, 0.95)
  }
  const realHolders = list.filter((h) => !h.isPool)
  const buys24h = Math.round(basics.volume24h / between(rng, 80, 600))
  const sells24h = Math.round(buys24h * between(rng, 0.4, 1.3))
  const smartMoney = (buysFor(chain).find((b) => same(b.contract, address))?.wallets ?? []).map((w) => ({
    handle: w.handle ?? '',
    displayName: w.displayName ?? '',
    netBuyUsd: w.netBuyUsd,
  }))
  const mintActive = rng() < 0.15
  const freezeActive = chain === 'solana' && rng() < 0.1

  const base: Omit<ScanResult, 'risk'> = {
    chain,
    address,
    name: basics.name,
    symbol: basics.symbol,
    imageUrl: '',
    priceUsd,
    marketCapUsd: basics.marketCap,
    liquidityUsd: basics.liquidity,
    volume24hUsd: basics.volume24h,
    priceChange24h: basics.priceChange24h,
    ageHours: basics.ageHours,
    poolCount: 1 + Math.floor(rng() * 3),
    primaryDex: 'sample-amm',
    links: [],
    security: {
      mintAuthority: mintActive ? addressFor(chain, rng) : null,
      freezeAuthority: freezeActive ? addressFor(chain, rng) : null,
      transferFeeBps: rng() < 0.1 ? Math.round(between(rng, 100, 800)) : 0,
      transferFeeAuthority: null,
      permanentDelegate: null,
      contractVerified: null,
      honeypot: null,
    },
    holders: {
      count: basics.holders,
      top10Pct: round(realHolders.slice(0, 10).reduce((sum, h) => sum + h.pctOfSupply, 0)),
      largestHolderPct: realHolders[0]?.pctOfSupply ?? null,
      list,
    },
    trading: {
      buys24h,
      sells24h,
      uniqueWallets24h: Math.round(basics.holders * basics.churn),
      churn: basics.churn,
    },
    smartMoney,
    bundle,
    bundleAvailable: chain === 'solana',
    scannedAt: new Date().toISOString(),
  }
  return { ...base, risk: assessRisk(factsFor(base)) }
}

/** The scan with launch bundle analysis merged in (Solana only) and the verdict re-run. */
export function scanWithBundle(address: string): ScanResult {
  const scan = scanToken('solana', address)
  const bundle = scan.bundle ?? bundleFor(address, scan.ageHours ?? 24)
  const insiderSet = new Set(bundle.insiderWallets.map((w) => w.toLowerCase()))
  const list = scan.holders.list.map((h) => ({ ...h, isInsider: h.isInsider || insiderSet.has(h.address.toLowerCase()) }))
  const base = { ...scan, bundle, holders: { ...scan.holders, list } }
  return { ...base, risk: assessRisk(factsFor(base)) }
}
