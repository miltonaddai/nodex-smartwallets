import { Router, Request, Response } from 'express'
import { isValidPeriod, periodToDays } from '../lib/periods'
import { PaginatedResult, parseNumericFilters, parsePagination, parseSortOrder, pickSortColumn } from '../lib/pagination'
import { pageRows, sortRows } from '../lib/sort-rows'
import { isValidSolanaAddress } from '../lib/validation'
import { formatLastActive } from '../lib/format'
import { pipelineStatus, positionsFor, walletFor, walletsFor, type WalletItem } from '../data/fixtures'

const router = Router()

const WALLET_SORT_MAP = {
  qualifiedTokens: 'qualifiedTokens',
  qualifiedProfit: 'qualifiedProfitUsd',
  smartScore: 'smartScore',
  totalProfit: 'totalProfit',
  balance: 'balance',
  winRate: 'winRate',
  trades: 'trades',
  volume: 'volume',
  tokensHeld: 'tokensHeld',
  lastActive: 'lastActive',
} as const

const WALLET_FILTER_FIELDS = {
  minBalance: 'balance',
  maxBalance: 'balance',
  minTotalProfit: 'totalProfit',
  maxTotalProfit: 'totalProfit',
  minWinRate: 'winRate',
  maxWinRate: 'winRate',
  minTrades: 'trades',
  maxTrades: 'trades',
  minTokensHeld: 'tokensHeld',
  maxTokensHeld: 'tokensHeld',
  minVolume: 'volume',
  maxVolume: 'volume',
  minQualifiedTokens: 'qualifiedTokens',
  maxQualifiedTokens: 'qualifiedTokens',
  minQualifiedWins: 'qualifiedWins',
  maxQualifiedWins: 'qualifiedWins',
  minQualifiedProfit: 'qualifiedProfitUsd',
  maxQualifiedProfit: 'qualifiedProfitUsd',
  activeWithinDays: 'lastActive',
} as const

const WALLET_FILTER_KEYS = Object.keys(WALLET_FILTER_FIELDS) as Array<keyof typeof WALLET_FILTER_FIELDS>

function matchesWalletFilters(row: WalletItem, filters: Record<string, number>): boolean {
  return Object.entries(filters).every(([key, limit]) => {
    const field = WALLET_FILTER_FIELDS[key as keyof typeof WALLET_FILTER_FIELDS]
    if (!field) return true
    if (key === 'activeWithinDays') return (Date.now() - Date.parse(row.lastActive)) / 86_400_000 <= limit
    const value = Number(row[field]) || 0
    return key.startsWith('min') ? value >= limit : value <= limit
  })
}

const present = (row: WalletItem & { rank: number }) => ({ ...row, lastActive: formatLastActive(row.lastActive) })

router.get('/top', (req: Request, res: Response) => {
  const chain = (req.query.chain as string) || 'solana'
  const period = String(req.query.period ?? '7D')
  const { page, pageSize, offset } = parsePagination(req.query as Record<string, unknown>)
  const sortBy = pickSortColumn(req.query.sortBy, WALLET_SORT_MAP, 'qualifiedTokens') as keyof WalletItem
  const sortOrder = parseSortOrder(req.query.sortOrder)
  const filters = parseNumericFilters(req.query as Record<string, unknown>, WALLET_FILTER_KEYS) as Record<string, number>

  if (chain !== 'solana') {
    return res.json({
      items: [],
      page,
      pageSize,
      total: 0,
      lastUpdated: null,
      message: 'Only Solana is supported for wallet rankings.',
    } satisfies PaginatedResult<never>)
  }

  const periodDays = isValidPeriod(period) ? periodToDays(period) : 7
  const rows = walletsFor(periodDays).filter((row) => matchesWalletFilters(row, filters))
  const sorted = sortRows(rows, [
    { key: sortBy, order: sortOrder },
    { key: 'smartScore', order: 'desc' },
  ])
  res.json({
    items: pageRows(sorted, offset, pageSize).map(present),
    page,
    pageSize,
    total: rows.length,
    lastUpdated: pipelineStatus.lastUpdated,
    nextUpdate: pipelineStatus.nextUpdate,
  })
})

router.get('/:address', (req: Request, res: Response) => {
  const address = String(req.params.address)
  const chain = (req.query.chain as string) || 'solana'
  const period = isValidPeriod(String(req.query.period)) ? String(req.query.period) : '7D'

  if (chain !== 'solana') {
    return res.status(400).json({ message: 'Only Solana wallet analysis is currently supported.' })
  }
  if (!isValidSolanaAddress(address)) {
    return res.status(400).json({ message: 'Invalid Solana wallet address.' })
  }

  const periodDays = periodToDays(period)
  const summary = walletFor(address, periodDays)
  const rank = walletsFor(periodDays).filter((w) => w.smartScore > summary.smartScore).length + 1

  res.json({
    address,
    chain,
    period,
    lastUpdated: pipelineStatus.lastUpdated,
    summary: { ...present({ ...summary, rank }), dataCoverage: 'full' },
    periods: [1, 7, 30, 365].map((days) => {
      const item = walletFor(address, days)
      return {
        periodDays: days,
        smartScore: item.smartScore,
        totalProfit: item.totalProfit,
        realizedProfit: item.realizedProfit,
        unrealizedProfit: item.unrealizedProfit,
        winRate: item.winRate,
        trades: item.trades,
      }
    }),
    positions: positionsFor(address, periodDays),
  })
})

export default router
