import { Router, Request, Response } from 'express'
import { coveredChainsText } from '../lib/chains'
import { isValidPeriod } from '../lib/periods'
import { pageRows, sortRows } from '../lib/sort-rows'
import { parseNumericFilters, parsePagination, parseSortOrder, pickSortColumn } from '../lib/pagination'
import { isFixtureChain, pipelineStatus, tokensFor, type TokenItem } from '../data/fixtures'

const router = Router()

const TOKEN_SORT_MAP = {
  churn: 'churn',
  alphaScore: 'alphaScore',
  marketCap: 'marketCap',
  price: 'price',
  changePct: 'changePct',
  volume: 'volume',
  holders: 'holders',
  liquidity: 'liquidity',
  launchedAt: 'launchedAt',
  name: 'name',
  firstSeenAt: 'firstSeenAt',
  peakMultiple: 'peakMultiple',
} as const

const TOKEN_FILTER_FIELDS = {
  minChurn: 'churn',
  maxChurn: 'churn',
  minPrice: 'price',
  maxPrice: 'price',
  minMarketCap: 'marketCap',
  maxMarketCap: 'marketCap',
  minChangePct: 'changePct',
  maxChangePct: 'changePct',
  minVolume: 'volume',
  maxVolume: 'volume',
  minLiquidity: 'liquidity',
  maxLiquidity: 'liquidity',
  minAgeDays: 'ageDays',
  maxAgeDays: 'ageDays',
  minHolders: 'holders',
  maxHolders: 'holders',
} as const

const TOKEN_FILTER_KEYS = Object.keys(TOKEN_FILTER_FIELDS) as Array<keyof typeof TOKEN_FILTER_FIELDS>

function matchesTokenFilters(row: TokenItem, filters: Record<string, number>): boolean {
  return Object.entries(filters).every(([key, limit]) => {
    const field = TOKEN_FILTER_FIELDS[key as keyof typeof TOKEN_FILTER_FIELDS]
    if (!field) return true
    const value = Number(row[field]) || 0
    return key.startsWith('min') ? value >= limit : value <= limit
  })
}

function changeColumnLabel(period: string): string {
  if (period === '24H') return '24H Change'
  if (period === '7D') return '7D Change'
  if (period === '30D') return '30D Change'
  return 'Change'
}

const CHANGE_SCALE: Record<string, number> = { '24H': 0.25, '7D': 1, '30D': 1.6, All: 2.2 }

router.get('/top', (req: Request, res: Response) => {
  const chain = (req.query.chain as string) || 'solana'
  const period = isValidPeriod(String(req.query.period)) ? String(req.query.period) : '7D'
  const { page, pageSize, offset } = parsePagination(req.query as Record<string, unknown>)
  const sortBy = pickSortColumn(req.query.sortBy, TOKEN_SORT_MAP, 'churn') as keyof TokenItem
  const sortOrder = parseSortOrder(req.query.sortOrder)
  const filters = parseNumericFilters(req.query as Record<string, unknown>, TOKEN_FILTER_KEYS) as Record<string, number>

  if (!isFixtureChain(chain)) {
    return res.json({
      items: [],
      page,
      pageSize,
      total: 0,
      lastUpdated: null,
      changeColumnLabel: changeColumnLabel(period),
      message: `Token rankings cover ${coveredChainsText()}.`,
    })
  }

  const scale = CHANGE_SCALE[period] ?? 1
  const rows = tokensFor(chain)
    .map((token) => ({ ...token, changePct: Math.round(token.changePct * scale * 10) / 10 }))
    .filter((token) => matchesTokenFilters(token, filters))
  const sorted = sortRows(rows, [
    { key: sortBy, order: sortOrder },
    { key: 'independentBuyers', order: 'desc' },
    { key: 'volume', order: 'desc' },
  ])
  res.json({
    items: pageRows(sorted, offset, pageSize),
    page,
    pageSize,
    total: rows.length,
    lastUpdated: pipelineStatus.lastUpdated,
    nextUpdate: pipelineStatus.nextUpdate,
    changeColumnLabel: changeColumnLabel(period),
  })
})

export default router
