import { randomUUID } from 'crypto'
import { ALL_CHAINS } from '../lib/chains'
import { buysFor, insiders, tokensFor } from '../data/fixtures'

/** The token watchlist, in memory. Metrics come from the synthetic dataset. */

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
  /** The token is not in the synthetic dataset, so the metrics above are placeholders. */
  analyticsUnavailable?: boolean
}

let tokens: WatchlistToken[] = []

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

function withMetrics(token: WatchlistToken): WatchlistToken {
  const listed = tokensFor(token.chain).find((t) => same(t.contract, token.contract))
  if (listed) {
    return {
      ...token,
      price: listed.price,
      marketCap: listed.marketCap,
      changePct: listed.changePct,
      volume: listed.volume,
      liquidity: listed.liquidity,
      churn: listed.churn,
      launchedAt: listed.launchedAt,
      ageDays: listed.ageDays,
      analyticsUnavailable: false,
    }
  }
  const bought = buysFor(token.chain).find((t) => same(t.contract, token.contract))
  const insider = token.chain === 'solana' ? insiders().find((t) => same(t.contract, token.contract)) : undefined
  const market = bought ?? insider
  if (market) {
    return {
      ...token,
      price: market.price,
      marketCap: market.marketCap,
      changePct: market.priceChange24h,
      volume: market.volume24h,
      liquidity: market.liquidity,
      analyticsUnavailable: false,
    }
  }
  return { ...token, analyticsUnavailable: true }
}

/** `chain` is one chain, or 'all' for every chain. */
export async function listWatchlistTokens(chain: string): Promise<WatchlistToken[]> {
  return tokens.filter((t) => chain === ALL_CHAINS || t.chain === chain).map(withMetrics)
}

/** Adding a token already on the list returns the existing entry. */
export async function addWatchlistToken(input: {
  contract: string
  name: string
  symbol: string
  chain: string
}): Promise<WatchlistToken> {
  const existing = tokens.find((t) => t.contract === input.contract && t.chain === input.chain)
  if (existing) return withMetrics(existing)
  const token: WatchlistToken = {
    id: randomUUID(),
    ...input,
    price: 0,
    marketCap: 0,
    changePct: 0,
    volume: 0,
    liquidity: 0,
    churn: 0,
  }
  tokens = [...tokens, token]
  return withMetrics(token)
}

export async function removeWatchlistToken(tokenId: string, chain: string): Promise<void> {
  tokens = tokens.filter((t) => !(t.id === tokenId && t.chain === chain))
}
