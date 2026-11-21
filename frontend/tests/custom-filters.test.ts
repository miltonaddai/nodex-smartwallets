import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'
import { installMemoryStorage } from './memory-storage.ts'
import {
  describeRule,
  FIELD_BY_ID,
  FILTER_FIELDS,
  FILTER_GROUPS,
  formatFilterValue,
  formatFullValue,
  loadSavedFilters,
  parseFilterValue,
  sameRules,
  storeSavedFilters,
} from '../src/lib/custom-filters.ts'

describe('parseFilterValue', () => {
  test('reads plain numbers, decimals and negatives', () => {
    assert.equal(parseFilterValue('250'), 250)
    assert.equal(parseFilterValue('1.5'), 1.5)
    assert.equal(parseFilterValue('-20'), -20)
    assert.equal(parseFilterValue('.5'), 0.5)
  })

  test('reads K, M and B suffixes in any case', () => {
    assert.equal(parseFilterValue('100k'), 100_000)
    assert.equal(parseFilterValue('1.5M'), 1_500_000)
    assert.equal(parseFilterValue('2b'), 2_000_000_000)
  })

  test('ignores dollar signs, commas, percent signs, spaces and a trailing x', () => {
    assert.equal(parseFilterValue('$250,000'), 250_000)
    assert.equal(parseFilterValue(' 30 % '), 30)
    assert.equal(parseFilterValue('3x'), 3)
  })

  test('returns null for anything that is not a number', () => {
    for (const input of ['', 'abc', '1..2', '10q', 'k', '--5']) assert.equal(parseFilterValue(input), null, input)
  })
})

describe('formatFilterValue', () => {
  test('shortens money with K, M and B', () => {
    assert.equal(formatFilterValue(100_000, 'usd'), '100K')
    assert.equal(formatFilterValue(1_500_000, 'usd'), '1.5M')
    assert.equal(formatFilterValue(2_000_000_000, 'usd'), '2B')
    assert.equal(formatFilterValue(950, 'usd'), '950')
  })

  test('counts use M and B but never K', () => {
    assert.equal(formatFilterValue(5_000, 'count'), '5000')
    assert.equal(formatFilterValue(3_000_000, 'count'), '3M')
  })

  test('other units are written as plain numbers', () => {
    assert.equal(formatFilterValue(30, 'pct'), '30')
    assert.equal(formatFilterValue(2.5, 'multiple'), '2.5')
    assert.equal(formatFilterValue(6, 'hours'), '6')
  })

  test('round-trips through parseFilterValue', () => {
    for (const value of [1_000, 50_000, 1_500_000, 7_250_000_000]) {
      assert.equal(parseFilterValue(formatFilterValue(value, 'usd')), value)
    }
  })
})

describe('formatFullValue', () => {
  test('writes each unit out in full', () => {
    assert.equal(formatFullValue(1_000_000, 'usd'), '$1,000,000')
    assert.equal(formatFullValue(-2_500, 'usd'), '-$2,500')
    assert.equal(formatFullValue(30, 'pct'), '30%')
    assert.equal(formatFullValue(2, 'multiple'), '2×')
    assert.equal(formatFullValue(1, 'hours'), '1 hour')
    assert.equal(formatFullValue(6, 'hours'), '6 hours')
    assert.equal(formatFullValue(1234, 'count'), '1,234')
  })
})

describe('describeRule', () => {
  test('describes rules for chips', () => {
    assert.equal(describeRule({ field: 'marketCap', op: 'lte', value: 1_000_000 }), 'Market cap ≤ $1M')
    assert.equal(describeRule({ field: 'walletCount', op: 'gte', value: 3 }), 'Top traders buying ≥ 3')
    assert.equal(describeRule({ field: 'soldPct', op: 'lte', value: 30 }), 'Traders sold (% of bought) ≤ 30%')
    assert.equal(describeRule({ field: 'lastBuyHours', op: 'lte', value: 6 }), 'Latest buy (hours ago) ≤ 6h')
  })

  test('returns an empty string for an unknown field', () => {
    assert.equal(describeRule({ field: 'nope', op: 'gte', value: 1 } as never), '')
  })
})

describe('filter fields', () => {
  test('every field has a unique id, a known group and presets', () => {
    assert.equal(FIELD_BY_ID.size, FILTER_FIELDS.length)
    for (const field of FILTER_FIELDS) {
      assert.ok(FILTER_GROUPS.includes(field.group), field.id)
      assert.ok(field.presets.length > 0, field.id)
    }
  })
})

describe('sameRules', () => {
  test('compares rule lists by value', () => {
    const a = [{ field: 'marketCap', op: 'lte' as const, value: 1 }]
    assert.equal(sameRules(a, [{ field: 'marketCap', op: 'lte', value: 1 }]), true)
    assert.equal(sameRules(a, [{ field: 'marketCap', op: 'gte', value: 1 }]), false)
    assert.equal(sameRules(a, []), false)
  })
})

describe('saved filters in the browser', () => {
  beforeEach(() => {
    installMemoryStorage()
  })

  test('are empty to start with', () => {
    assert.deepEqual(loadSavedFilters(), [])
  })

  test('store and load back', () => {
    const filters = [{ id: '1', name: 'Small caps', rules: [{ field: 'marketCap', op: 'lte' as const, value: 100_000 }] }]
    storeSavedFilters(filters)
    assert.deepEqual(loadSavedFilters(), filters)
  })

  test('skip damaged entries and survive bad JSON', () => {
    localStorage.setItem('nodex_saved_filters_v1', JSON.stringify([{ name: 'ok', rules: [] }, { name: 5 }, null]))
    assert.deepEqual(loadSavedFilters(), [{ name: 'ok', rules: [] }])
    localStorage.setItem('nodex_saved_filters_v1', '{not json')
    assert.deepEqual(loadSavedFilters(), [])
  })
})
