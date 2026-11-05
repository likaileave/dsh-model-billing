/**
 * The usage route reads billing facts from a session projection instead of the
 * deprecated synchronous `session.ownEvents()`. Trimming an event must not change
 * what the fold reports, so every case below compares the fold over the raw
 * events with the fold over the projection's samples.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { __test } from '../host.js'

const { billingSample, billingSamplesProjection, computeSessionUsage, defaultPricing, modelKey } = __test

const qwenPricing = { cacheHit: 0.5, cacheMiss: 2, output: 8 }
const keyOf = (provider, model) => modelKey(provider, model)

function assistant(turn, step, seq, provider, model, usage, time) {
  return {
    type: 'assistant/message',
    seq,
    time,
    data: {
      turn,
      step,
      message: {
        id: `m${seq}`,
        role: 'assistant',
        source: { kind: 'model', provider, model },
        content: [{ type: 'text', text: 'ok' }],
      },
      stream: [
        { type: 'text-chunks', time0: time, index: 0, dt: [1, 2], texts: ['o', 'k'] },
        { type: 'chunk', time, chunk: { type: 'usage', usage } },
        { type: 'chunk', time, chunk: { type: 'finish', reason: { kind: 'stop' } } },
      ],
      usage,
    },
  }
}

const events = [
  { type: 'turn/start', seq: 1, time: 1_000, data: { turn: 1 } },
  {
    type: 'user/message',
    seq: 2,
    time: 1_002,
    data: { id: 'u1', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '第一轮\n问题' }, { type: 'image', attachment: { attachmentId: 'a1' } }] },
  },
  { type: 'request/header', seq: 3, time: 1_003, data: { header: { config: { provider: 'qwen', model: 'qwen3.8-flash' } }, reason: 'initial' } },
  assistant(1, 1, 4, 'qwen', 'qwen3.8-flash', { inputTokens: 1_000_000, cacheReadTokens: 2_000_000, outputTokens: 500_000, totalTokens: 3_500_000 }, 1_100),
  { type: 'step/start', seq: 5, time: 1_150, data: { turn: 1, step: 2 } },
  {
    type: 'assistant/attempt',
    seq: 6,
    time: 1_200,
    data: { turn: 1, step: 2, stream: [{ type: 'chunk', time: 1_200, chunk: { type: 'usage', usage: { inputTokens: 10_000, outputTokens: 5_000, totalTokens: 15_000 } } }] },
  },
  { type: 'tool/call', seq: 7, time: 1_300, data: { turn: 1, step: 2, callId: 'c1', name: 'web_search', arguments: '{"q":"x"}' } },
  { type: 'tool/result', seq: 8, time: 1_400, data: { turn: 1, step: 2, message: { role: 'tool', toolCallId: 'c1' }, meta: { sources: [{ title: 'a' }], statusCode: 200 } } },
  { type: 'tool/call', seq: 9, time: 1_500, data: { turn: 1, step: 2, callId: 'c2', name: 'web_fetch', arguments: '{"url":"https://e"} ' } },
  { type: 'tool/result', seq: 10, time: 1_600, data: { turn: 1, step: 2, message: { role: 'tool', toolCallId: 'c2', isError: true }, error: { name: 'ToolError', code: 'failed' } } },
  { type: 'turn/end', seq: 11, time: 1_700, data: { turn: 1, reason: { kind: 'completed' } } },
]

const pricing = new Map([[keyOf('qwen', 'qwen3.8-flash'), qwenPricing]])
const billing = { search: 0.005, fetch: 0.005, start: 0 }

test('the samples projection folds to the same usage as the raw events', () => {
  const raw = computeSessionUsage(events, pricing, new Map(), null, billing)
  const samples = events.map((event) => billingSample(event)).filter((sample) => sample !== undefined)
  const trimmed = computeSessionUsage(samples, pricing, new Map(), null, billing)
  assert.deepEqual(trimmed, raw)
  // The trim is what makes the projection cheap: streams keep only the usage chunk.
  const assistantSample = samples.find((sample) => sample.type === 'assistant/message')
  assert.equal(assistantSample.data.stream.length, 1)
  assert.equal(assistantSample.data.stream[0].chunk.type, 'usage')
  assert.equal(assistantSample.data.message.content, undefined)
})

test('ignored event types produce no sample', () => {
  assert.equal(billingSample({ type: 'step/start', seq: 1, time: 1, data: {} }), undefined)
  assert.equal(billingSample({ type: 'session/end-seed', seq: 1, time: 1, data: {} }), undefined)
  // A user message keeps only its text blocks; the preview must not change.
  const sample = billingSample({
    type: 'user/message',
    seq: 2,
    time: 2,
    data: { content: [{ type: 'text', text: '只留文本' }, { type: 'image', attachment: {} }] },
  })
  assert.deepEqual(sample.data.content, [{ type: 'text', text: '只留文本' }])
})

test('the projection skips the fork-inherited prefix', () => {
  const projection = billingSamplesProjection
  let state = projection.init({}, 5)
  assert.equal(state.inheritedCut, 5)
  // Events below the cut were billed in the parent session.
  state = projection.apply(state, events[0])
  assert.equal(state.samples.length, 0)
  state = projection.apply(state, { ...events[0], seq: 6 })
  assert.equal(state.samples.length, 1)
  // Immutability keeps the registry's Object.is change detection honest.
  assert.notEqual(projection.apply(state, { ...events[1], seq: 7 }), state)
})

test('an empty session folds to zero cost', () => {
  const empty = computeSessionUsage([], pricing, new Map(), null, billing)
  assert.equal(empty.totals.cost, 0)
  assert.deepEqual(computeSessionUsage(events.map(billingSample).filter(Boolean).slice(0, 0), pricing), empty)
})

test('default pricing stays reachable for an unknown route', () => {
  const unpriced = billingSample(assistant(9, 1, 40, 'unknown', 'mystery', { inputTokens: 10, outputTokens: 5 }, 1_000))
  const result = computeSessionUsage([unpriced], new Map())
  assert.equal(result.totals.unpricedAttempts, 1)
  assert.deepEqual(defaultPricing(), { cacheHit: null, cacheMiss: null, output: null })
})
