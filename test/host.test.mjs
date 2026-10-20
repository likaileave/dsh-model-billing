import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { __test } from '../host.js'

const {
  applySavedOrder,
  catalogPricing,
  computeSessionUsage,
  deepseekBuiltinPricing,
  deepseekPeakAt,
  deepseekPricingAt,
  loadState,
  normalizeState,
  normalizeUsage,
  publicPricing,
  saveOrderAndPrices,
  validRoute,
} = __test

const key = (provider, model) => `${provider}\u0000${model}`

const qwenPricing = {
  cacheHit: 0.5,
  cacheMiss: 2,
  output: 8,
}

function assistant(turn, step, seq, provider, model, usage, time = 1_790_000_000_000) {
  return {
    type: 'assistant/message',
    seq,
    time,
    data: {
      turn,
      step,
      message: { role: 'assistant', source: { kind: 'model', provider, model } },
      stream: [],
      usage,
    },
  }
}

test('normalizes an empty or partial state without inventing prices', () => {
  const state = normalizeState({
    order: [
      { provider: 'qwen', model: 'flash' },
      { provider: 'qwen', model: 'flash' },
      { provider: '', model: 'bad' },
    ],
    pricing: {
      [key('qwen', 'flash')]: {
        cacheHit: '0.5',
        cacheMiss: 2,
        output: -1,
      },
    },
  })
  assert.equal(state.order.length, 1)
  const pricing = publicPricing(state.pricing[key('qwen', 'flash')])
  assert.equal(pricing.cacheHit, 0.5)
  assert.equal(pricing.cacheMiss, 2)
  assert.equal(pricing.output, null)
})

test('migrates the old nested base price block', () => {
  const pricing = publicPricing({ base: { cacheHit: 0.5, cacheMiss: 2, output: 8 }, peak: { cacheHit: 9 } })
  assert.deepEqual(pricing, { cacheHit: 0.5, cacheMiss: 2, output: 8 })
})

test('hardcodes the official DeepSeek peak and off-peak prices', () => {
  const flash = deepseekBuiltinPricing('deepseek-account', 'deepseek-flash')
  assert.deepEqual(flash.peak, { cacheHit: 0.04, cacheMiss: 2, output: 8 })
  assert.deepEqual(flash.offPeak, { cacheHit: 0.02, cacheMiss: 1, output: 4 })
  const pro = deepseekBuiltinPricing('deepseek-account', 'deepseek-v4-pro')
  assert.deepEqual(pro.peak, { cacheHit: 0.3, cacheMiss: 9, output: 27 })
  assert.deepEqual(pro.offPeak, { cacheHit: 0.15, cacheMiss: 4.5, output: 13.5 })
  assert.equal(deepseekBuiltinPricing('qwen', 'qwen3.8-flash'), null)
  assert.deepEqual(catalogPricing('qwen', 'qwen3.8-flash', qwenPricing), qwenPricing)
})

test('prices DeepSeek by Beijing peak, lunch, weekend and holiday windows', () => {
  const peak = Date.parse('2026-10-19T02:00:00Z') // Monday 10:00 Beijing
  const lunch = Date.parse('2026-10-19T04:30:00Z') // Monday 12:30 Beijing
  const weekend = Date.parse('2026-10-18T02:00:00Z') // Sunday 10:00 Beijing
  const holiday = Date.parse('2026-10-01T02:00:00Z') // National Day 10:00 Beijing
  assert.equal(deepseekPeakAt(peak), true)
  assert.equal(deepseekPeakAt(lunch), false)
  assert.equal(deepseekPeakAt(weekend), false)
  assert.equal(deepseekPeakAt(holiday), false)
  assert.equal(deepseekPricingAt('deepseek-flash', peak).cacheMiss, 2)
  assert.equal(deepseekPricingAt('deepseek-flash', weekend).cacheMiss, 1)
})

test('bills cache hit, cache miss, output and DeepSeek built-in prices for a turn', () => {
  const pricing = new Map([[key('qwen', 'qwen3.8-flash'), qwenPricing]])
  const names = new Map([[key('qwen', 'qwen3.8-flash'), '百炼 / Qwen3.8 Flash']])
  const events = [
    { type: 'turn/start', seq: 1, time: 1_000, data: { turn: 1 } },
    { type: 'user/message', seq: 2, time: 1_002, data: { id: 'u1', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '第一轮的问题' }] } },
    { type: 'request/header', seq: 3, time: 1_003, data: { header: { config: { provider: 'qwen', model: 'qwen3.8-flash' } }, reason: 'initial' } },
    assistant(1, 1, 3, 'qwen', 'qwen3.8-flash', {
      inputTokens: 1_000_000,
      cacheReadTokens: 2_000_000,
      cacheWriteTokens: 100_000,
      outputTokens: 500_000,
      totalTokens: 3_600_000,
    }, 1_100),
    assistant(1, 2, 4, 'deepseek-account', 'deepseek-flash', {
      inputTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      outputTokens: 1_000_000,
      totalTokens: 3_000_000,
    }, 1_200),
    { type: 'turn/end', seq: 5, time: 1_300, data: { turn: 1, reason: { kind: 'completed' } } },
    { type: 'turn/start', seq: 6, time: 2_000, data: { turn: 2 } },
    assistant(2, 1, 7, 'qwen', 'qwen3.8-max', {
      inputTokens: 10_000,
      outputTokens: 5_000,
      totalTokens: 15_000,
    }, 2_100),
    { type: 'turn/end', seq: 8, time: 2_200, data: { turn: 2, reason: { kind: 'completed' } } },
  ]
  const result = computeSessionUsage(events, pricing, names)
  assert.equal(result.turns.length, 2)
  // Qwen: 2M cache-read * 0.5 + 1.1M miss * 2 + 0.5M output * 8 = 1 + 2.2 + 4 = 7.2
  // DeepSeek flash at 08:00 Beijing (off-peak): 1M hit * 0.02 + 1M miss * 1 + 1M out * 4 = 5.02
  assert.ok(Math.abs(result.turns[0].cost - 12.22) < 1e-9)
  assert.equal(result.turns[0].costKnown, true)
  assert.equal(result.turns[0].chargeableAttempts, 2)
  assert.equal(result.turns[0].hasBillable, true)
  assert.equal(result.turns[0].preview, '第一轮的问题')
  assert.equal(result.turns[0].models.find((model) => model.isDeepSeek).cost, 5.02)
  assert.equal(result.turns[1].costKnown, false)
  assert.equal(result.turns[1].unpricedAttempts, 1)
  assert.ok(Math.abs(result.totals.cost - 12.22) < 1e-9)
  assert.equal(result.totals.partial, true)
  assert.equal(result.totals.hasBillable, true)
  assert.equal(result.totals.cacheReadTokens, 3_000_000)
  assert.equal(result.totals.promptTokens, 5_110_000)
  assert.equal(result.byModel.length, 3)
})

test('normalizes provider usage and rejects contradictory totals', () => {
  assert.deepEqual(normalizeUsage({ inputTokens: 10, outputTokens: 5, cacheReadTokens: 2, cacheWriteTokens: 1, totalTokens: 18 }), {
    uncachedInputTokens: 10,
    outputTokens: 5,
    cacheReadTokens: 2,
    cacheWriteTokens: 1,
  })
  assert.equal(normalizeUsage({ inputTokens: 10, outputTokens: 5, cacheReadTokens: 2, cacheWriteTokens: 1, totalTokens: 99 }), undefined)
  assert.equal(normalizeUsage({ inputTokens: 10, outputTokens: 5, reasoningTokens: 6 }), undefined)
})

test('keeps saved model order and appends newly configured models', () => {
  const rows = [
    { provider: 'zai', model: 'glm-5.3', name: 'GLM-5.3' },
    { provider: 'qwen', model: 'qwen3.8-flash', name: 'Qwen3.8 Flash' },
    { provider: 'xiaomi', model: 'mimo-v2.6-pro', name: 'MiMo-V2.6-Pro' },
  ]
  const ordered = applySavedOrder(rows, {
    order: [
      { provider: 'xiaomi', model: 'mimo-v2.6-pro' },
      { provider: 'qwen', model: 'qwen3.8-flash' },
    ],
  })
  assert.deepEqual(ordered.map((row) => row.model), ['mimo-v2.6-pro', 'qwen3.8-flash', 'glm-5.3'])
})

test('validates route pairs used as durable keys', () => {
  assert.equal(validRoute('qwen', 'qwen3.8-flash'), true)
  assert.equal(validRoute('qwen', ''), false)
  assert.equal(validRoute('qwen', 'bad\nid'), false)
  assert.equal(validRoute('qwen', 'x'.repeat(201)), false)
})

test('persists order and prices atomically, retaining prices for later routes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-model-billing-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = directory
  const ctx = { logger: { warn() {} } }
  try {
    await saveOrderAndPrices(ctx, {
      models: [
        { provider: 'qwen', model: 'qwen3.8-flash', pricing: qwenPricing },
        { provider: 'xiaomi', model: 'mimo-v2.6-pro', pricing: {} },
      ],
    })
    const first = await loadState(ctx)
    assert.deepEqual(first.order, [
      { provider: 'qwen', model: 'qwen3.8-flash' },
      { provider: 'xiaomi', model: 'mimo-v2.6-pro' },
    ])
    assert.equal(publicPricing(first.pricing[key('qwen', 'qwen3.8-flash')]).output, 8)

    await saveOrderAndPrices(ctx, {
      models: [
        { provider: 'xiaomi', model: 'mimo-v2.6-pro', pricing: {} },
      ],
    })
    const second = await loadState(ctx)
    assert.deepEqual(second.order, [{ provider: 'xiaomi', model: 'mimo-v2.6-pro' }])
    assert.equal(publicPricing(second.pricing[key('qwen', 'qwen3.8-flash')]).cacheMiss, 2)
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    await rm(directory, { recursive: true, force: true })
  }
})
