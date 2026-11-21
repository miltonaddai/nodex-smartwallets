import { Router, Request, Response } from 'express'
import { PaginatedResult, parsePagination, parseSortOrder, pickSortColumn } from '../lib/pagination'
import { pageRows, sortRows } from '../lib/sort-rows'
import { insiders, pipelineStatus, type InsiderItem } from '../data/fixtures'

const router = Router()

const INSIDER_SORT_MAP = {
  insiderScore: 'insiderScore',
  launchScore: 'launchScore',
  insiderHolding: 'insiderHoldingPct',
  insiderAcquired: 'insiderAcquiredPct',
  marketCap: 'marketCap',
  launchedAt: 'launchedAt',
  firstSeenAt: 'firstSeenAt',
  peakMultiple: 'peakMultiple',
} as const

const STATUSES = new Set(['holding', 'distributing', 'exited'])
const PATTERNS = new Set(['reclaiming', 'retracing', 'new_highs', 'ranging'])

/** Tokens whose launch was bought by wallets under common control, strongest first. */
router.get('/', (req: Request, res: Response) => {
  const chain = (req.query.chain as string) || 'solana'
  const { page, pageSize, offset } = parsePagination(req.query as Record<string, unknown>)
  const sortBy = pickSortColumn(req.query.sortBy, INSIDER_SORT_MAP, 'insiderScore') as keyof InsiderItem
  const sortOrder = parseSortOrder(req.query.sortOrder)
  const status = STATUSES.has(String(req.query.status)) ? String(req.query.status) : ''
  const pattern = PATTERNS.has(String(req.query.pattern)) ? String(req.query.pattern) : ''

  if (chain !== 'solana') {
    const empty: PaginatedResult<InsiderItem> = { items: [], page, pageSize, total: 0, lastUpdated: null }
    return res.json({ ...empty, message: 'Insider detection currently covers Solana only.' })
  }

  const filtered = insiders().filter(
    (item) => (!status || item.insiderStatus === status) && (!pattern || item.pricePattern === pattern)
  )
  const result: PaginatedResult<InsiderItem> = {
    items: pageRows(sortRows(filtered, [{ key: sortBy, order: sortOrder }]), offset, pageSize),
    page,
    pageSize,
    total: filtered.length,
    lastUpdated: pipelineStatus.lastUpdated,
    nextUpdate: pipelineStatus.nextUpdate,
  }
  res.json(result)
})

export default router
