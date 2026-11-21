import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SUPPORTED_CHAINS } from '../lib/chains'
import { buysFor, insiders, pipelineStatus, tokensFor, walletsFor } from '../data/fixtures'
import { runPipeline } from './pipeline'

const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n)

test('the simulated pipeline changes the data and keeps it well-formed over many runs', () => {
  const firstPrice = tokensFor('solana')[0].price
  const before = pipelineStatus.lastUpdated
  const start = Date.now()

  for (let i = 0; i < 50; i++) {
    const result = runPipeline(start + i * 60_000)
    assert.equal(result.steps.length, SUPPORTED_CHAINS.length * 4 + 2)
  }

  assert.equal(pipelineStatus.runs, 50)
  assert.notEqual(pipelineStatus.lastUpdated, before)
  assert.equal(pipelineStatus.running, false)
  assert.notEqual(tokensFor('solana')[0]?.price, firstPrice)

  for (const chain of SUPPORTED_CHAINS) {
    const tokens = tokensFor(chain)
    assert.ok(tokens.length >= 50 && tokens.length <= 70, `${chain} token count ${tokens.length}`)
    assert.equal(new Set(tokens.map((t) => t.contract)).size, tokens.length, 'unique contracts')
    for (const t of tokens) {
      assert.ok(finite(t.price) && t.price > 0 && finite(t.marketCap) && finite(t.liquidity))
      assert.ok(t.liquidity >= 5_000 || t.ageDays < 1, 'rugged tokens are dropped by the next run')
      assert.ok(t.peakMultiple === null || t.peakMultiple >= 1)
    }
    const buys = buysFor(chain)
    assert.ok(buys.length > 0)
    for (const b of buys) {
      assert.equal(b.walletCount, b.wallets.length)
      assert.ok(b.walletCount > 0 && b.netBuyUsd > 0 && finite(b.marketCap))
    }
  }

  assert.ok(insiders().length > 0)
  for (const item of insiders()) {
    assert.ok(item.insiderHoldingPct <= item.insiderAcquiredPct)
    assert.ok(['holding', 'distributing', 'exited', 'unknown'].includes(item.insiderStatus))
    assert.ok(item.athMc >= item.marketCap)
  }
  for (const w of walletsFor(7)) assert.equal(w.totalProfit, w.realizedProfit + w.unrealizedProfit)
})
