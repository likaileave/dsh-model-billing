import test from 'node:test'
import assert from 'node:assert/strict'

import { __test } from '../host.js'

const {
  catalogPricing,
  computeSessionUsage,
  deepseekPeakAt,
  modelKey,
  resolveRoutePricing,
} = __test

const key = (provider, model) => `${provider}\u0000${model}`

// 2026-10-26T02:00:00Z = Beijing 10:00 on a Monday, inside the peak window and
// outside the 2026 holiday table. (2026-10-24 is a Saturday — do not reuse it.)
const PEAK_TIME = Date.parse('2026-10-26T02:00:00Z')

/** One assistant message carrying exactly one bucket of usage. */
function attempt(provider, model, usage, time = PEAK_TIME) {
  return {
    type: 'assistant/message',
    seq: 1,
    time,
    data: {
      turn: 1,
      step: 1,
      message: { role: 'assistant', source: { kind: 'model', provider, model } },
      stream: [],
      usage,
    },
  }
}

const M = 1_000_000

/** Bill a single bucket alone so two wrong numbers cannot cancel out. */
function billOneBucket(provider, model, saved, usage, time) {
  const priced = new Map()
  if (saved !== undefined) priced.set(key(provider, model), saved)
  const result = computeSessionUsage([attempt(provider, model, usage, time)], priced)
  return result.totals.cost
}

// The routes a real catalog can surface. `deepseek/deepseek-chat` is served by
// DeepSeek but is NOT an official route, so user prices must win.
const CASES = [
  {
    label: 'official DeepSeek flash (built-in, peak)',
    provider: 'deepseek-account',
    model: 'deepseek-flash',
    expected: { cacheHit: 0.04, cacheMiss: 2, output: 8 },
  },
  {
    label: 'official DeepSeek v4-pro (built-in, peak)',
    provider: 'deepseek-account',
    model: 'deepseek-v4-pro',
    expected: { cacheHit: 0.3, cacheMiss: 9, output: 27 },
  },
  {
    label: 'official DeepSeek flash with a user price (override wins)',
    provider: 'deepseek-account',
    model: 'deepseek-flash',
    saved: { cacheHit: 1.5, cacheMiss: 6, output: 18 },
    expected: { cacheHit: 1.5, cacheMiss: 6, output: 18 },
  },
  {
    label: 'DeepSeek model behind a third-party provider (user price)',
    provider: 'openrouter',
    model: 'deepseek/deepseek-chat',
    saved: { cacheHit: 1.5, cacheMiss: 6, output: 18 },
    expected: { cacheHit: 1.5, cacheMiss: 6, output: 18 },
  },
  {
    label: 'provider merely containing "deepseek" (user price)',
    provider: 'deepseek-gateway',
    model: 'gpt-5',
    saved: { cacheHit: 1, cacheMiss: 10, output: 30 },
    expected: { cacheHit: 1, cacheMiss: 10, output: 30 },
  },
  {
    label: 'official provider but unlisted model (user price)',
    provider: 'deepseek-account',
    model: 'deepseek-reasoner',
    saved: { cacheHit: 0.5, cacheMiss: 2, output: 8 },
    expected: { cacheHit: 0.5, cacheMiss: 2, output: 8 },
  },
]

test('every catalog price is billed identically, one bucket at a time', () => {
  for (const item of CASES) {
    const rows = []
    const priced = new Map([[key(item.provider, item.model), item.saved]])
    // Catalog and usage must agree on what the route resolves to.
    const shown = catalogPricing(item.provider, item.model, item.saved)
    rows.push(['cacheHit', { cacheReadTokens: M, inputTokens: 0, outputTokens: 0 }])
    rows.push(['cacheMiss', { inputTokens: M, outputTokens: 0 }])
    rows.push(['output', { inputTokens: 0, outputTokens: M }])
    for (const [field, usage] of rows) {
      const billed = computeSessionUsage([attempt(item.provider, item.model, usage)], priced).totals.cost
      assert.ok(
        Math.abs(billed - item.expected[field]) < 1e-9,
        `${item.label}: ${field} billed ${billed}, expected ${item.expected[field]}`,
      )
    }
    if (shown.peak === undefined) {
      // Flat routes present the saved prices directly.
      for (const field of ['cacheHit', 'cacheMiss', 'output']) {
        assert.equal(shown[field], item.expected[field], `${item.label}: catalog ${field}`)
      }
    }
  }
})

test('a DeepSeek model behind a third-party provider stays unpriced without a user price', () => {
  const billed = computeSessionUsage([attempt('openrouter', 'deepseek/deepseek-chat', { inputTokens: M, outputTokens: 0 })]).totals
  assert.equal(billed.cost, 0)
  assert.equal(billed.unpricedAttempts, 1)
})

test('resolveRoutePricing names which rule won', () => {
  assert.equal(
    resolveRoutePricing('deepseek-account', 'deepseek-flash', undefined, PEAK_TIME).kind,
    'builtin',
  )
  assert.equal(
    resolveRoutePricing('openrouter', 'deepseek/deepseek-chat', { cacheHit: 1.5, cacheMiss: 6, output: 18 }, PEAK_TIME).kind,
    'custom',
  )
  assert.equal(resolveRoutePricing('openrouter', 'deepseek/deepseek-chat', undefined, PEAK_TIME).kind, 'none')
  // provider substring alone never earns the built-in table.
  assert.equal(resolveRoutePricing('deepseek-gateway', 'gpt-5', { cacheHit: 1, cacheMiss: 10, output: 30 }, PEAK_TIME).kind, 'custom')
})

test('legacy alias models keep Flash pricing', () => {
  for (const model of ['deepseek-v4-flash', 'deepseek-v4-flash-vision-exp']) {
    const resolved = resolveRoutePricing('deepseek-account', model, undefined, PEAK_TIME)
    assert.equal(resolved.kind, 'builtin', model)
    assert.equal(resolved.prices.cacheMiss, 2, model)
  }
})

test('weekends and holidays fall back to off-peak', () => {
  // 2026-10-25 is a Sunday; 2026-10-01 is a statutory holiday.
  assert.equal(deepseekPeakAt(Date.parse('2026-10-25T02:00:00Z')), false)
  assert.equal(deepseekPeakAt(Date.parse('2026-10-01T02:00:00Z')), false)
  const offPeak = resolveRoutePricing('deepseek-account', 'deepseek-flash', undefined, Date.parse('2026-10-25T02:00:00Z'))
  assert.equal(offPeak.prices.cacheMiss, 1)
})

// A request that arrives inside peak and finishes after noon must stay on the
// entry rate: the server prices by arrival, not by completion.
test('a request spanning noon is billed at its arrival rate', () => {
  const arrival = Date.parse('2026-10-19T03:59:30Z') // Beijing 11:59 Monday, peak
  const done = Date.parse('2026-10-19T04:00:30Z') // Beijing 12:00, off-peak
  const events = [
    { type: 'turn/start', time: arrival, data: { turn: 1 } },
    {
      type: 'request/header',
      time: arrival,
      data: { header: { config: { provider: 'deepseek-account', model: 'deepseek-flash' } } },
    },
    attempt('deepseek-account', 'deepseek-flash', { inputTokens: M, outputTokens: 0 }, done),
  ]
  const totals = computeSessionUsage(events).totals
  assert.equal(totals.cost, 2, 'peak cacheMiss (2), not off-peak (1)')
})

// The mirror case guards against pricing by the wrong edge in the other direction.
test('a request arriving off-peak and finishing in peak stays off-peak', () => {
  const arrival = Date.parse('2026-10-19T04:00:30Z') // Beijing 12:00, off-peak
  const done = Date.parse('2026-10-19T06:30:00Z') // Beijing 14:30, peak
  const events = [
    { type: 'turn/start', time: arrival, data: { turn: 1 } },
    {
      type: 'request/header',
      time: arrival,
      data: { header: { config: { provider: 'deepseek-account', model: 'deepseek-flash' } } },
    },
    attempt('deepseek-account', 'deepseek-flash', { inputTokens: M, outputTokens: 0 }, done),
  ]
  const totals = computeSessionUsage(events).totals
  assert.equal(totals.cost, 1, 'off-peak cacheMiss (1), not peak (2)')
})
