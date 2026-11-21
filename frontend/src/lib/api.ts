import type { FilterRule, SavedFilter } from './custom-filters'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

/** An error response from the API, with its HTTP status. */
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function send(path: string, options?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    })
  } catch {
    throw new Error(
      'Unable to reach the server. Make sure the backend is running (npm run dev in /backend).'
    )
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await send(path, options)
  const data = await res.json().catch(() => ({ message: res.statusText }))
  if (!res.ok) throw new ApiError(data.message || 'Request failed', res.status)
  return data as T
}

export const api = {
  wallets: {
    top: (params: {
      chain?: string
      period?: string
      page?: number
      pageSize?: number
      sortBy?: string
      sortOrder?: 'asc' | 'desc'
    } & WalletTableFilters) => {
      const q = new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      ).toString()
      return request<PaginatedResponse<WalletRow>>(`/wallets/top?${q}`)
    },
    detail: (address: string, params: { chain?: string; period?: string }) => {
      const q = new URLSearchParams(
        Object.entries(params)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      ).toString()
      return request<WalletDetailResponse>(`/wallets/${encodeURIComponent(address)}?${q}`)
    },
  },
  tokens: {
    top: (params: {
      chain?: string
      period?: string
      page?: number
      pageSize?: number
      sortBy?: string
      sortOrder?: 'asc' | 'desc'
    } & TokenTableFilters) => {
      const q = new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      ).toString()
      return request<PaginatedTokensResponse>(`/tokens/top?${q}`)
    },
  },
  scanner: {
    scan: (chain: ScanChain, address: string) =>
      request<ScanResult>(`/scanner/${chain}/${encodeURIComponent(address)}`),
    /** Solana only. Takes up to a minute the first time a token is analyzed. */
    bundle: (chain: ScanChain, address: string) =>
      request<ScanResult>(`/scanner/${chain}/${encodeURIComponent(address)}/bundle`),
  },
  smartMoney: {
    buys: (params: {
      chain?: string
      page?: number
      pageSize?: number
      sortBy?: SmartMoneySortKey
      sortOrder?: 'asc' | 'desc'
      maxMarketCap?: number | null
      minWalletCount?: number | null
      /** Custom filter rules as JSON (see lib/custom-filters). */
      rules?: string
    }) => {
      const q = new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => [k, String(v)])
      ).toString()
      return request<SmartMoneyBuysResponse>(`/smart-money/buys?${q}`)
    },
    wallets: (chain = 'solana') =>
      request<{ items: SmartMoneyWallet[]; lastUpdated: string | null }>(`/smart-money/wallets?chain=${chain}`),
  },
  insiders: {
    list: (params: {
      chain?: string
      page?: number
      pageSize?: number
      sortBy?: InsiderSortKey
      sortOrder?: 'asc' | 'desc'
      status?: InsiderStatus
      pattern?: InsiderPricePattern
    }) => {
      const q = new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, String(v)])
      ).toString()
      return request<PaginatedResponse<InsiderPlay>>(`/insiders?${q}`)
    },
  },
  /** Saved custom filters for the Smart Wallets table, kept by the local server. */
  filters: {
    list: () => request<SavedFilter[]>('/filters'),
    save: (name: string, rules: FilterRule[]) =>
      request<SavedFilter>('/filters', { method: 'POST', body: JSON.stringify({ name, rules }) }),
    remove: (id: string) => request<{ success: boolean }>(`/filters/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  watchlist: {
    list: (chain?: string) => {
      const q = chain ? `?chain=${chain}` : ''
      return request<WatchlistWallet[]>(`/watchlist${q}`)
    },
    add: (address: string, name: string, chain: string) =>
      request<WatchlistWallet>('/watchlist', {
        method: 'POST',
        body: JSON.stringify({ address, name, chain }),
      }),
    rename: (id: string, name: string, chain: string) =>
      request<{ id: string; name: string }>(`/watchlist/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, chain }),
      }),
    remove: (id: string, chain: string) =>
      request<{ success: boolean }>(`/watchlist/${id}?chain=${chain}`, { method: 'DELETE' }),

    tokens: {
      list: (chain?: string) => {
        const q = chain ? `?chain=${chain}` : ''
        return request<WatchlistToken[]>(`/watchlist/tokens${q}`)
      },
      add: (token: { contract: string; name: string; symbol: string; chain: string }) =>
        request<WatchlistToken>('/watchlist/tokens', {
          method: 'POST',
          body: JSON.stringify(token),
        }),
      remove: (id: string, chain: string) =>
        request<{ success: boolean }>(`/watchlist/tokens/${id}?chain=${chain}`, {
          method: 'DELETE',
        }),
    },
  },
}

export interface PaginatedResponse<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  lastUpdated: string | null
  nextUpdate?: string | null
  message?: string
}

export type ScanChain = 'solana'
export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low'

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

/** Everything the scanner found about one token, with a buy-or-avoid verdict. */
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
    /** Contract audit: the token cannot be sold. Null where not checked. */
    honeypot: boolean | null
  }
  holders: { count: number | null; top10Pct: number | null; largestHolderPct: number | null; list: ScanHolder[] }
  trading: { buys24h: number | null; sells24h: number | null; uniqueWallets24h: number | null; churn: number | null }
  smartMoney: Array<{ handle: string; displayName: string; netBuyUsd: number }>
  bundle: ScanBundle | null
  bundleAvailable: boolean
  risk: {
    verdict: 'avoid' | 'caution' | 'favorable'
    riskScore: number
    flags: Array<{ severity: RiskSeverity; title: string; detail: string }>
    positives: Array<{ title: string; detail: string }>
  }
  scannedAt: string
}

/** Added to every token row by the API: when Nodex first listed it and its peak multiple since. */
export interface SightingFields {
  firstSeenAt?: string | null
  firstSeenMc?: number | null
  peakMc?: number | null
  peakMultiple?: number | null
}

export type SmartMoneySortKey =
  | 'walletCount'
  | 'netBuyUsd'
  | 'marketCap'
  | 'lastBuyAt'
  | 'priceChange24h'
  | 'buyerProfit'
  | 'firstSeenAt'
  | 'peakMultiple'

/** A top FOMO trader's wallet that the smart money feed follows. */
export interface SmartMoneyWallet {
  address: string
  rank: number
  /** FOMO's 30-day PnL. Zero for traders listed from the 7-day, all-time or 24-hour boards. */
  pnl30d: number
  realizedPnl30d: number
  volume30d: number
  trades30d: number
  handle: string | null
  displayName: string | null
  avatarUrl: string | null
  followers: number
}

/** A token the tracked wallets are net buying. */
export interface SmartMoneyBuy extends SightingFields {
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
  /** Combined 30-day realized profit of the wallets buying. */
  buyerRealizedPnl30d: number
  wallets: Array<{
    address: string
    netBuyUsd: number
    lastBuyAt: string | null
    rank: number | null
    realizedPnl30d: number | null
    handle: string | null
    displayName: string | null
    avatarUrl: string | null
  }>
}

export interface SmartMoneyBuysResponse extends PaginatedResponse<SmartMoneyBuy> {
  trackedWallets: number
  windowHours: number
}

export type InsiderStatus = 'holding' | 'distributing' | 'exited' | 'unknown'
export type InsiderPricePattern = 'reclaiming' | 'retracing' | 'new_highs' | 'ranging' | 'unknown'
export type InsiderSortKey =
  | 'insiderScore'
  | 'launchScore'
  | 'insiderHolding'
  | 'insiderAcquired'
  | 'marketCap'
  | 'launchedAt'
  | 'firstSeenAt'
  | 'peakMultiple'

/** A token whose launch was bought by wallets under common control. */
export interface InsiderPlay extends SightingFields {
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
  /** Share of supply the insider wallets held at the end of the launch window. */
  insiderAcquiredPct: number
  /** Share of supply the same wallets hold now. */
  insiderHoldingPct: number
  insiderStatus: InsiderStatus
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
  pricePattern: InsiderPricePattern
}

export interface PaginatedTokensResponse extends PaginatedResponse<TokenRow> {
  changeColumnLabel: string
}

export interface WalletRow {
  rank: number
  address: string
  balance: number
  totalProfit: number
  winRate: number
  trades: number
  volume: number
  tokensHeld: number
  lastActive: string
  smartScore?: number
  qualifiedTokens?: number
  qualifiedWins?: number
  qualifiedProfitUsd?: number
  qualifiedWinRate?: number
  youngTokenTrades?: number
  youngTokenWins?: number
  medianRoiPct?: number
  avgEntryDelayMinutes?: number
  realizedProfit?: number
  unrealizedProfit?: number
  concentrationPct?: number
  riskFlags?: string[]
}

export interface WalletTableFilters {
  minBalance?: number
  maxBalance?: number
  minTotalProfit?: number
  maxTotalProfit?: number
  minWinRate?: number
  maxWinRate?: number
  minTrades?: number
  maxTrades?: number
  minTokensHeld?: number
  maxTokensHeld?: number
  minVolume?: number
  maxVolume?: number
  minQualifiedTokens?: number
  maxQualifiedTokens?: number
  minQualifiedWins?: number
  maxQualifiedWins?: number
  minQualifiedProfit?: number
  maxQualifiedProfit?: number
  activeWithinDays?: number
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

export interface WalletPeriodSummary {
  periodDays: number
  smartScore: number
  totalProfit: number
  realizedProfit: number
  unrealizedProfit: number
  winRate: number
  trades: number
}

export interface WalletDetailResponse {
  address: string
  chain: string
  period: string
  lastUpdated: string | null
  summary: Omit<WalletRow, 'rank'> & {
    rank: number | null
    dataCoverage: 'full' | 'positions_only'
  }
  periods: WalletPeriodSummary[]
  positions: WalletPosition[]
}

export interface TokenRow extends SightingFields {
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
  liquidity?: number
  launchedAt?: string
  ageDays?: number
  alphaScore?: number
  smartWalletBuyers?: number
  smartMoneyNetFlow?: number
  buyAcceleration?: number
  qualifiedWalletBuyers?: number
  freshWalletBuyers?: number
  freshWalletShare?: number
  evidenceTier?: 'verified' | 'partial' | 'unverified'
  realBuyers?: number
  independentBuyers?: number
  netInflowUsd?: number
  retentionRate?: number
  demandPersistence?: number
  sniperShare?: number
  topBuyerShare?: number
  washRatio?: number
  churn?: number
  uniqueWallet24h?: number
  buySellRatio?: number
  wealthyHolders?: number
  medianHolderWealthUsd?: number
  enrichedHolders?: number
  riskFlags?: string[]
}

export interface TokenTableFilters {
  minChurn?: number
  maxChurn?: number
  minPrice?: number
  maxPrice?: number
  minMarketCap?: number
  maxMarketCap?: number
  minChangePct?: number
  maxChangePct?: number
  minVolume?: number
  maxVolume?: number
  minLiquidity?: number
  maxLiquidity?: number
  minAgeDays?: number
  maxAgeDays?: number
  minHolders?: number
  maxHolders?: number
}

export interface WatchlistToken {
  id: string
  contract: string
  name: string
  symbol: string
  imageUrl?: string
  chain: string
  price: number
  marketCap: number
  changePct: number
  volume: number
  liquidity: number
  churn: number
  launchedAt?: string
  ageDays?: number
  /** No token_analytics row backs this token — the metrics above are placeholders. */
  analyticsUnavailable?: boolean
}

export interface WatchlistWallet {
  id: string
  name: string
  address: string
  /** USD. Null when it could not be measured. */
  balance: number | null
  pnl7d: number | null
  /** Percent. Null where per-wallet trade history is unavailable. */
  winRate: number | null
  lastActive: string | null
  chain: string
  /** Set when the wallet belongs to a tracked FOMO trader. */
  handle?: string | null
  displayName?: string | null
  avatarUrl?: string | null
  /** Nothing could be measured for this wallet — the metrics above are empty. */
  analyticsUnavailable?: boolean
}
