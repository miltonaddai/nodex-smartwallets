/** Nodex covers Solana only. */
export const SUPPORTED_CHAINS = ['solana'] as const

export type SupportedChain = (typeof SUPPORTED_CHAINS)[number]

const LABELS: Record<SupportedChain, string> = {
  solana: 'Solana',
}

/** Watchlist filter value meaning every chain. */
export const ALL_CHAINS = 'all'

export function isSupportedChain(chain: string): chain is SupportedChain {
  return (SUPPORTED_CHAINS as readonly string[]).includes(chain)
}

export function chainLabel(chain: string): string {
  return isSupportedChain(chain) ? LABELS[chain] : chain
}

/** "Solana", for coverage messages. */
export function coveredChainsText(): string {
  return SUPPORTED_CHAINS.map((chain) => LABELS[chain]).join(', ')
}
