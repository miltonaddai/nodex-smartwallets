import { randomUUID } from 'crypto'
import { ALL_CHAINS } from '../lib/chains'
import { formatLastActive } from '../lib/format'
import { isValidSolanaAddress } from '../lib/validation'
import { starterWatchlist, tradersFor, walletFor, type WatchlistWallet } from '../data/fixtures'

/**
 * The wallet watchlist, in memory. Each chain starts with a few synthetic wallets the first time
 * it is opened; after that edits are authoritative. Metrics come from the synthetic dataset.
 */

let wallets: WatchlistWallet[] = []
const seeded = new Set<string>()

function seed(chain: string): void {
  if (seeded.has(chain)) return
  seeded.add(chain)
  wallets = [...wallets, ...starterWatchlist(chain).map((wallet) => ({ ...wallet, id: randomUUID() }))]
}

function withMetrics(wallet: WatchlistWallet): WatchlistWallet {
  const trader = tradersFor(wallet.chain).find((t) => t.address.toLowerCase() === wallet.address.toLowerCase())
  const identity = {
    handle: trader?.handle ?? null,
    displayName: trader?.displayName ?? null,
    avatarUrl: trader?.avatarUrl ?? null,
  }
  if (wallet.chain === 'solana' && isValidSolanaAddress(wallet.address)) {
    const metrics = walletFor(wallet.address, 7)
    return {
      ...wallet,
      ...identity,
      balance: metrics.balance,
      pnl7d: metrics.totalProfit,
      winRate: metrics.winRate,
      lastActive: formatLastActive(metrics.lastActive),
      analyticsUnavailable: false,
    }
  }
  if (trader) {
    // A tracked trader with no wallet history: the trader's PnL is the only measured figure.
    return { ...wallet, ...identity, balance: null, pnl7d: Math.round(trader.pnl30d / 4), winRate: null, lastActive: null, analyticsUnavailable: false }
  }
  return { ...wallet, ...identity, balance: null, pnl7d: null, winRate: null, lastActive: null, analyticsUnavailable: true }
}

/** `chain` is one chain, or 'all' for every chain. */
export async function listWatchlist(chain: string): Promise<WatchlistWallet[]> {
  seed(chain === ALL_CHAINS ? 'solana' : chain)
  return wallets.filter((w) => chain === ALL_CHAINS || w.chain === chain).map(withMetrics)
}

export async function addWatchlistWallet(input: { name: string; address: string; chain: string }): Promise<WatchlistWallet> {
  seed(input.chain)
  const wallet: WatchlistWallet = {
    id: randomUUID(),
    name: input.name,
    address: input.address,
    chain: input.chain,
    balance: null,
    pnl7d: null,
    winRate: null,
    lastActive: null,
  }
  wallets = [...wallets, wallet]
  return withMetrics(wallet)
}

export async function renameWatchlistWallet(walletId: string, name: string, chain: string): Promise<{ id: string; name: string }> {
  seed(chain)
  const wallet = wallets.find((item) => item.id === walletId)
  if (!wallet) throw new Error('Watchlist wallet not found')
  wallet.name = name
  return { id: wallet.id, name: wallet.name }
}

export async function removeWatchlistWallet(walletId: string, chain: string): Promise<void> {
  seed(chain)
  wallets = wallets.filter((w) => w.id !== walletId)
}
