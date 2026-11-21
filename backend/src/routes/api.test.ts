import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import app from '../index'
import { buysFor, tokensFor, walletsFor } from '../data/fixtures'

/**
 * End-to-end checks of the HTTP API against the synthetic dataset. The app is started on a
 * random local port; nothing leaves the machine.
 */

let server: Server
let base = ''
const json = { 'Content-Type': 'application/json' }

before(async () => {
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
})

after(() => server.close())

async function get<T = any>(path: string): Promise<{ status: number; body: T }> {
  const res = await fetch(base + path)
  return { status: res.status, body: (await res.json()) as T }
}

async function send<T = any>(method: string, path: string, body?: unknown): Promise<{ status: number; body: T }> {
  const res = await fetch(base + path, { method, headers: json, body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: res.status, body: (await res.json()) as T }
}

describe('health', () => {
  test('reports ok with the simulated pipeline status', async () => {
    const { status, body } = await get('/health')
    assert.equal(status, 200)
    assert.ok(body.pipeline, 'pipeline status is included')
  })

  test('unknown routes return 404', async () => {
    assert.equal((await fetch(`${base}/nope`)).status, 404)
  })
})

describe('smart wallets', () => {
  test('top wallets are paginated', async () => {
    const { status, body } = await get('/wallets/top?page=1&pageSize=10')
    assert.equal(status, 200)
    assert.equal(body.items.length, 10)
    assert.equal(body.page, 1)
    assert.ok(body.total >= 10)
  })

  test('wallet analysis returns a summary and every period', async () => {
    const address = walletsFor(7)[0].address
    const { status, body } = await get(`/wallets/${address}?period=7D`)
    assert.equal(status, 200)
    assert.equal(body.address, address)
    assert.equal(body.chain, 'solana')
    assert.ok(body.summary.rank >= 1)
    assert.deepEqual(body.periods.map((p: { periodDays: number }) => p.periodDays), [1, 7, 30, 365])
  })

  test('wallet analysis rejects a malformed address or another chain', async () => {
    assert.equal((await get('/wallets/not-a-wallet')).status, 400)
    assert.equal((await get(`/wallets/${walletsFor(7)[0].address}?chain=bsc`)).status, 400)
  })
})

describe('tokens being bought', () => {
  test('lists buys with the tracked trader count', async () => {
    const { status, body } = await get('/smart-money/buys?chain=solana')
    assert.equal(status, 200)
    assert.ok(body.items.length > 0)
    assert.ok(body.trackedWallets > 0)
    assert.equal('earlySignalCount' in body, false, 'early signals were removed')
  })

  test('sorts by wallet count, highest first, by default', async () => {
    const { body } = await get('/smart-money/buys?pageSize=50')
    const counts = body.items.map((item: { walletCount: number }) => item.walletCount)
    assert.deepEqual(counts, [...counts].sort((a, b) => b - a))
  })

  test('max market cap and min trader filters narrow the list', async () => {
    const { body } = await get('/smart-money/buys?pageSize=100&maxMarketCap=500000&minWalletCount=3')
    for (const item of body.items) {
      assert.ok(item.marketCap <= 500_000)
      assert.ok(item.walletCount >= 3)
    }
    assert.ok(body.total < buysFor('solana').length)
  })

  test('custom rules filter the list', async () => {
    const rules = JSON.stringify([{ field: 'walletCount', op: 'gte', value: 5 }])
    const { body } = await get(`/smart-money/buys?pageSize=100&rules=${encodeURIComponent(rules)}`)
    assert.ok(body.items.every((item: { walletCount: number }) => item.walletCount >= 5))
  })

  test('other chains return an empty list with a Solana-only message', async () => {
    const { status, body } = await get('/smart-money/buys?chain=bsc')
    assert.equal(status, 200)
    assert.equal(body.items.length, 0)
    assert.match(body.message, /Solana/)
  })

  test('tracked traders are listed', async () => {
    const { status, body } = await get('/smart-money/wallets')
    assert.equal(status, 200)
    assert.ok(body.items.length > 0)
  })
})

describe('token scanner', () => {
  test('scans a listed token and returns a verdict', async () => {
    const contract = tokensFor('solana')[0].contract
    const { status, body } = await get(`/scanner/solana/${contract}`)
    assert.equal(status, 200)
    assert.equal(body.address, contract)
    assert.ok(['avoid', 'caution', 'favorable'].includes(body.risk.verdict))
  })

  test('gives the same result for the same unlisted address', async () => {
    const address = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
    const first = await get(`/scanner/solana/${address}`)
    const second = await get(`/scanner/solana/${address}`)
    assert.equal(first.status, 200)
    assert.equal(first.body.name, second.body.name)
    assert.equal(first.body.risk.verdict, second.body.risk.verdict)
  })

  test('rejects bad addresses and unsupported chains', async () => {
    assert.equal((await get('/scanner/solana/xyz')).status, 400)
    assert.equal((await get(`/scanner/robinhood/0x${'b'.repeat(40)}`)).status, 400)
  })
})

describe('insiders', () => {
  test('lists insider plays', async () => {
    const { status, body } = await get('/insiders')
    assert.equal(status, 200)
    assert.ok(body.items.length > 0)
  })
})

describe('wallet watchlist', () => {
  const address = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'

  test('add, rename and remove a wallet', async () => {
    const added = await send('POST', '/watchlist', { address, name: 'Test wallet', chain: 'solana' })
    assert.equal(added.status, 201)
    const id = added.body.id as string

    const renamed = await send('PATCH', `/watchlist/${id}`, { name: 'Renamed', chain: 'solana' })
    assert.equal(renamed.status, 200)
    assert.equal(renamed.body.name, 'Renamed')

    assert.equal((await send('DELETE', `/watchlist/${id}`)).status, 200)
    const list = await get('/watchlist?chain=solana')
    assert.equal(list.body.some((wallet: { id: string }) => wallet.id === id), false)
  })

  test('rejects missing fields, bad ids and bad names', async () => {
    assert.equal((await send('POST', '/watchlist', { name: 'No address' })).status, 400)
    assert.equal((await send('PATCH', '/watchlist/not-a-uuid', { name: 'x' })).status, 400)
    const added = await send('POST', '/watchlist', { address, name: 'Temp', chain: 'solana' })
    assert.equal((await send('PATCH', `/watchlist/${added.body.id}`, { name: 'x'.repeat(65) })).status, 400)
    await send('DELETE', `/watchlist/${added.body.id}`)
  })
})

describe('token watchlist', () => {
  test('add and remove a token', async () => {
    const contract = tokensFor('solana')[1].contract
    const added = await send('POST', '/watchlist/tokens', { contract, name: 'Token', symbol: 'TKN', chain: 'solana' })
    assert.equal(added.status, 201)
    const listed = await get('/watchlist/tokens?chain=solana')
    assert.ok(listed.body.some((token: { contract: string }) => token.contract === contract))

    assert.equal((await send('DELETE', `/watchlist/tokens/${added.body.id}`)).status, 200)
    const after = await get('/watchlist/tokens?chain=solana')
    assert.equal(after.body.some((token: { id: string }) => token.id === added.body.id), false)
  })

  test('rejects a token without a contract', async () => {
    assert.equal((await send('POST', '/watchlist/tokens', { name: 'Token', symbol: 'TKN' })).status, 400)
  })
})

describe('saved filters', () => {
  const rules = [{ field: 'marketCap', op: 'lte', value: 1_000_000 }]

  test('save, list and delete a filter', async () => {
    const saved = await send('POST', '/filters', { name: 'Small caps', rules })
    assert.equal(saved.status, 201)
    assert.equal(saved.body.name, 'Small caps')
    assert.ok((await get('/filters')).body.some((filter: { id: string }) => filter.id === saved.body.id))

    assert.equal((await send('DELETE', `/filters/${saved.body.id}`)).status, 200)
    assert.equal((await get('/filters')).body.some((filter: { id: string }) => filter.id === saved.body.id), false)
  })

  test('saving under an existing name replaces that filter', async () => {
    const first = await send('POST', '/filters', { name: 'Replace me', rules })
    const second = await send('POST', '/filters', { name: 'replace ME', rules: [{ field: 'walletCount', op: 'gte', value: 3 }] })
    const named = (await get('/filters')).body.filter((filter: { name: string }) => filter.name.toLowerCase() === 'replace me')
    assert.equal(named.length, 1)
    await send('DELETE', `/filters/${second.body.id}`)
    if (first.body.id !== second.body.id) await send('DELETE', `/filters/${first.body.id}`)
  })

  test('rejects a filter with no name or no conditions', async () => {
    assert.equal((await send('POST', '/filters', { name: '', rules })).status, 400)
    assert.equal((await send('POST', '/filters', { name: 'Empty', rules: [] })).status, 400)
  })
})
