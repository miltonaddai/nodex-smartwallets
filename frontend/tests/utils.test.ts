import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { cn, formatCurrency, formatPercent, formatPnl, truncateAddress } from '../src/lib/utils.ts'
import { chainLabel, CHAIN_IDS, isChainId, tokenUrl, walletUrl } from '../src/lib/chains.ts'

describe('formatCurrency', () => {
  test('formats whole dollars with separators', () => {
    assert.equal(formatCurrency(1234), '$1,234')
    assert.equal(formatCurrency(0), '$0')
    assert.equal(formatCurrency(-50), '-$50')
  })

  test('compact mode uses K and M', () => {
    assert.equal(formatCurrency(12_345, true), '$12K')
    assert.equal(formatCurrency(2_500_000, true), '$2.5M')
    assert.equal(formatCurrency(-3_000_000, true), '$-3.0M')
    assert.equal(formatCurrency(999, true), '$999')
  })
})

describe('formatPnl and formatPercent', () => {
  test('profits get a plus sign, losses keep their minus', () => {
    assert.equal(formatPnl(50), '+$50')
    assert.equal(formatPnl(0), '+$0')
    assert.equal(formatPnl(-50), '-$50')
    assert.equal(formatPercent(12.5), '+12.5%')
    assert.equal(formatPercent(-3), '-3%')
  })
})

describe('truncateAddress', () => {
  test('shortens long addresses and leaves short ones alone', () => {
    assert.equal(truncateAddress('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'), '7xKX...gAsU')
    assert.equal(truncateAddress('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', 6), '7xKXtg...osgAsU')
    assert.equal(truncateAddress('short'), 'short')
  })
})

describe('cn', () => {
  test('joins classes and lets later Tailwind classes win', () => {
    assert.equal(cn('px-2', false && 'hidden', 'py-1'), 'px-2 py-1')
    assert.equal(cn('px-2', 'px-4'), 'px-4')
  })
})

describe('chains', () => {
  test('Solana is the only chain', () => {
    assert.deepEqual([...CHAIN_IDS], ['solana'])
    assert.equal(isChainId('solana'), true)
    for (const other of ['bsc', 'robinhood', '', null, undefined]) assert.equal(isChainId(other), false)
    assert.equal(chainLabel('solana'), 'Solana')
  })

  test('explorer links are encoded', () => {
    assert.equal(walletUrl('solana', 'abc'), 'https://solscan.io/account/abc')
    assert.equal(tokenUrl('solana', 'a/b'), 'https://dexscreener.com/solana/a%2Fb')
  })
})
