import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'
import { installMemoryStorage } from './memory-storage.ts'
import type { ScanResult } from '../src/lib/api.ts'
import { clearScanHistory, findScan, forgetScan, loadScanHistory, rememberScan } from '../src/lib/scan-history.ts'

const KEY = 'nodex_scan_history_v1'

/** Just the fields the history reads. */
function scan(address: string, verdict: 'avoid' | 'caution' | 'favorable' = 'caution'): ScanResult {
  return {
    chain: 'solana',
    address,
    name: `Token ${address}`,
    symbol: address.slice(0, 3).toUpperCase(),
    imageUrl: '',
    scannedAt: '2026-11-01T00:00:00.000Z',
    risk: { verdict, riskScore: 50 },
  } as unknown as ScanResult
}

describe('scan history', () => {
  beforeEach(() => {
    installMemoryStorage()
  })

  test('starts empty', () => {
    assert.deepEqual(loadScanHistory(), [])
  })

  test('remembers scans newest first', () => {
    rememberScan(scan('aaa'))
    const entries = rememberScan(scan('bbb'))
    assert.deepEqual(entries.map((e) => e.address), ['bbb', 'aaa'])
    assert.deepEqual(loadScanHistory().map((e) => e.address), ['bbb', 'aaa'])
  })

  test('scanning a token again replaces its entry and moves it to the top', () => {
    rememberScan(scan('aaa', 'caution'))
    rememberScan(scan('bbb'))
    const entries = rememberScan(scan('aaa', 'avoid'))
    assert.deepEqual(entries.map((e) => e.address), ['aaa', 'bbb'])
    assert.equal(entries[0].verdict, 'avoid')
  })

  test('keeps at most 25 scans', () => {
    for (let i = 0; i < 30; i++) rememberScan(scan(`token${i}`))
    const entries = loadScanHistory()
    assert.equal(entries.length, 25)
    assert.equal(entries[0].address, 'token29')
  })

  test('finds a scan by chain and address, ignoring address case', () => {
    rememberScan(scan('AbC'))
    assert.equal(findScan('solana', 'abc')?.address, 'AbC')
    assert.equal(findScan('solana', 'zzz'), undefined)
  })

  test('forgets one scan, or clears them all', () => {
    rememberScan(scan('aaa'))
    rememberScan(scan('bbb'))
    assert.deepEqual(forgetScan('solana', 'aaa').map((e) => e.address), ['bbb'])
    assert.deepEqual(clearScanHistory(), [])
    assert.deepEqual(loadScanHistory(), [])
  })

  test('drops scans from chains that are no longer covered', () => {
    const old = { ...rememberScan(scan('aaa'))[0], chain: 'bsc' }
    localStorage.setItem(KEY, JSON.stringify([old]))
    assert.deepEqual(loadScanHistory(), [])
  })

  test('survives damaged storage', () => {
    localStorage.setItem(KEY, '{broken')
    assert.deepEqual(loadScanHistory(), [])
    localStorage.setItem(KEY, JSON.stringify({ not: 'a list' }))
    assert.deepEqual(loadScanHistory(), [])
  })
})
