import { Router, Request, Response } from 'express'
import { config } from '../config'
import { coveredChainsText } from '../lib/chains'
import { PaginatedResult, parsePagination, parseSortOrder, pickSortColumn } from '../lib/pagination'
import { matchesRules, parseRules } from '../lib/custom-filters'
import { pageRows, sortRows, type SortKey } from '../lib/sort-rows'
import { buysFor, isFixtureChain, pipelineStatus, tradersFor, type BuyItem } from '../data/fixtures'

const router = Router()

const BUY_SORT_MAP = {
  walletCount: 'walletCount',
  netBuyUsd: 'netBuyUsd',
  marketCap: 'marketCap',
  lastBuyAt: 'lastBuyAt',
  priceChange24h: 'priceChange24h',
  buyerProfit: 'buyerRealizedPnl30d',
  firstSeenAt: 'firstSeenAt',
  peakMultiple: 'peakMultiple',
} as const

interface BuysResult extends PaginatedResult<BuyItem> {
  trackedWallets: number
  windowHours: number
}

/** Tokens the tracked traders are net buying. */
router.get('/buys', (req: Request, res: Response) => {
  const chain = (req.query.chain as string) || 'solana'
  const { page, pageSize, offset } = parsePagination(req.query as Record<string, unknown>, 20)
  const sortBy = pickSortColumn(req.query.sortBy, BUY_SORT_MAP, 'walletCount') as keyof BuyItem
  const sortOrder = parseSortOrder(req.query.sortOrder)
  // Optional filters. A missing or invalid value means no limit.
  const positive = (value: unknown) => {
    const n = Number(value)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const maxMarketCap = positive(req.query.maxMarketCap)
  const minWalletCount = positive(req.query.minWalletCount)
  const rules = parseRules(req.query.rules)
  const windowHours = config.worker.smartMoneyBuyWindowHours

  if (!isFixtureChain(chain)) {
    const empty: BuysResult = { items: [], page, pageSize, total: 0, lastUpdated: null, trackedWallets: 0, windowHours }
    return res.json({ ...empty, message: `Smart money tracking covers ${coveredChainsText()}.` })
  }

  // A pool holds at most about twice a token's market cap in liquidity. Far more than that means
  // the market cap figure is wrong, so those rows are left out of a market cap filter.
  const plausibleCap = (item: BuyItem) => item.marketCap > 0 && item.liquidity <= item.marketCap * 3
  const matching = buysFor(chain).filter(
    (item) =>
      (maxMarketCap === null || (plausibleCap(item) && item.marketCap <= maxMarketCap)) &&
      (minWalletCount === null || item.walletCount >= minWalletCount) &&
      (rules.length === 0 || matchesRules(item, rules))
  )
  // Ties on wallet count go to more profitable buyers, then to larger buys.
  const keys: SortKey<BuyItem>[] = [{ key: sortBy, order: sortOrder }]
  if (sortBy === 'walletCount') {
    keys.push({ key: 'buyerRealizedPnl30d', order: sortOrder }, { key: 'netBuyUsd', order: sortOrder })
  }
  const result: BuysResult = {
    items: pageRows(sortRows(matching, keys), offset, pageSize),
    page,
    pageSize,
    total: matching.length,
    lastUpdated: pipelineStatus.lastUpdated,
    nextUpdate: pipelineStatus.nextUpdate,
    trackedWallets: tradersFor(chain).length,
    windowHours,
  }
  res.json(result)
})

/** The synthetic traders being tracked, by realized profit. */
router.get('/wallets', (req: Request, res: Response) => {
  const chain = (req.query.chain as string) || 'solana'
  res.json({ items: tradersFor(chain), lastUpdated: isFixtureChain(chain) ? pipelineStatus.lastUpdated : null })
})

export default router
