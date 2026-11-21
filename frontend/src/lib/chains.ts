/** Nodex covers Solana only. Where a token or wallet can be looked at outside Nodex. */

export const CHAIN_IDS = ['solana'] as const

export type Chain = (typeof CHAIN_IDS)[number]
/** A chain, or every chain at once (the watchlist lists). */
export type ChainFilter = Chain | 'all'

export function isChainId(value: string | null | undefined): value is Chain {
  return (CHAIN_IDS as readonly string[]).includes(value ?? '')
}

export function tokenUrl(chain: string, contract: string): string {
  return `https://dexscreener.com/${encodeURIComponent(chain)}/${encodeURIComponent(contract)}`
}

export function walletUrl(_chain: string, address: string): string {
  return `https://solscan.io/account/${encodeURIComponent(address)}`
}

export function chainLabel(_chain: string): string {
  return 'Solana'
}
