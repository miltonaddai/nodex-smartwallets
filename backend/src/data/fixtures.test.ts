import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { buysFor, insiders, tokensFor, tradersFor, walletsFor } from './fixtures'
import { isValidSolanaAddress } from '../lib/validation'
import app from '../index'

test('fixtures are deterministic and well-formed', () => {
  assert.deepEqual(tokensFor('solana').map((t) => t.contract), tokensFor('solana').map((t) => t.contract))
  assert.ok(tokensFor('solana').every((t) => isValidSolanaAddress(t.contract)))
  assert.equal(tokensFor('bsc').length, 0)
  assert.ok(walletsFor(7).every((w) => isValidSolanaAddress(w.address)))
  assert.equal(insiders().length, 32)
  assert.equal(tradersFor('solana').length, 30)
  assert.ok(buysFor('solana').length > 0)
})

test('synthetic traders carry no avatars or external links', () => {
  for (const trader of tradersFor('solana')) {
    assert.equal(trader.avatarUrl, null)
    assert.match(trader.handle, /^[a-z]+_[a-z]+$/)
  }
})

let server: Server
let base = ''

before(async () => {
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
})

after(() => server.close())

test('public endpoints serve fixture data', async () => {
  for (const path of ['/wallets/top', '/tokens/top', '/insiders', '/smart-money/buys', '/smart-money/wallets']) {
    const res = await fetch(base + path)
    assert.equal(res.status, 200, path)
    const body = (await res.json()) as { items: unknown[] }
    assert.ok(body.items.length > 0, path)
  }
})

test('scanner, watchlist and filters work without any login', async () => {
  const json = { 'Content-Type': 'application/json' }
  assert.equal((await fetch(`${base}/auth/login`, { method: 'POST' })).status, 404)

  const contract = tokensFor('solana')[0].contract
  const scan = await fetch(`${base}/scanner/solana/${contract}`)
  assert.equal(scan.status, 200)
  assert.ok(['avoid', 'caution', 'favorable'].includes(((await scan.json()) as { risk: { verdict: string } }).risk.verdict))

  const watchlist = await fetch(`${base}/watchlist?chain=solana`)
  assert.equal(watchlist.status, 200)
  assert.ok(((await watchlist.json()) as unknown[]).length > 0)

  const added = await fetch(`${base}/watchlist/tokens`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ contract, name: 'Test', symbol: 'TST', chain: 'solana' }),
  })
  assert.equal(added.status, 201)

  const rules = [{ field: 'walletCount', op: 'gte', value: 2 }]
  const filter = await fetch(`${base}/filters`, { method: 'POST', headers: json, body: JSON.stringify({ name: 'Busy', rules }) })
  assert.equal(filter.status, 201, await filter.clone().text())
  assert.equal((await fetch(`${base}/alerts`)).status, 404)
  assert.equal((await fetch(`${base}/scanner/bsc/0x${'a'.repeat(40)}`)).status, 400)
})
