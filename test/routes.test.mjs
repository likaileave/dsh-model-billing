import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { apply } from '../host.js'

const KEY = '\u0000'

function assistant(turn, provider, model, usage, time) {
  return {
    type: 'assistant/message',
    seq: 1,
    time,
    data: {
      turn,
      step: 1,
      message: { role: 'assistant', source: { kind: 'model', provider, model } },
      stream: [],
      usage,
    },
  }
}

function fakeRequest({ method = 'GET', url = '/', headers = {}, body = null }) {
  return {
    method,
    url,
    headers: { host: '127.0.0.1:13180', ...headers },
    async *[Symbol.asyncIterator]() {
      if (body !== null) yield Buffer.from(body, 'utf8')
    },
  }
}

function callRoute(handler, request) {
  return new Promise((resolve) => {
    const response = {
      status: 0,
      headers: null,
      headersSent: false,
      writeHead(status, headers) {
        this.status = status
        this.headers = headers
        this.headersSent = true
      },
      end(body) {
        resolve({ status: this.status, headers: this.headers, body: JSON.parse(body) })
      },
    }
    handler(request, response)
  })
}

test('registers catalog, save and usage routes and serves one consistent state', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-model-billing-routes-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = directory
  const routes = new Map()
  const selected = []
  const sessionController = {
    async selectModel(request) {
      selected.push(request)
      return { provider: request.provider, model: request.model }
    },
  }
  const events = [
    assistant(1, 'qwen', 'flash', { inputTokens: 1_000_000, cacheReadTokens: 2_000_000, outputTokens: 500_000, totalTokens: 3_500_000 }, 1_790_000_000_000),
  ]
  const llm = {
    listProviders: () => [{ id: 'qwen', name: 'Qwen' }, { id: 'deepseek-account', name: 'DeepSeek Account' }],
    listModels: async (provider) => provider === 'qwen'
      ? [{ id: 'flash', name: 'Qwen Flash' }, { id: 'max', name: 'Qwen Max' }]
      : [{ id: 'deepseek-flash', name: 'DeepSeek Flash' }],
    resolveModelInfo: async () => ({
      reasoning: {
        efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }],
        defaultEffort: 'low',
      },
    }),
  }
  const ctx = {
    webServer: {
      register({ path, handler }) {
        routes.set(path, handler)
        return () => routes.delete(path)
      },
    },
    effect(callback) {
      return callback()
    },
    logger: { info() {}, warn() {} },
    get(name) {
      if (name === 'llm') return llm
      if (name === 'sessions') {
        return {
          get(id) {
            return id === 'session-1' ? { ownEvents: () => events } : undefined
          },
        }
      }
      if (name === 'sessionController') return sessionController
      return undefined
    },
  }
  try {
    apply(ctx)
    assert.equal(routes.size, 4)

    const catalog = await callRoute(routes.get('/model-billing/catalog'), fakeRequest({ url: '/model-billing/catalog' }))
    assert.equal(catalog.status, 200)
    assert.deepEqual(catalog.body.models.map((model) => model.model), ['flash', 'max', 'deepseek-flash'])
    assert.deepEqual(catalog.body.models[0].reasoning.efforts.map((effort) => effort.id), ['low', 'high'])
    assert.equal(catalog.body.models[0].reasoning.defaultEffort, 'low')
    assert.equal(catalog.body.models[0].pricing.output, null)

    const save = await callRoute(routes.get('/model-billing/save'), fakeRequest({
      method: 'POST',
      url: '/model-billing/save',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        models: [
          { provider: 'qwen', model: 'max', pricing: { cacheHit: 0.5, cacheMiss: 2, output: 8 } },
          { provider: 'qwen', model: 'flash', pricing: { cacheHit: 0.5, cacheMiss: 2, output: 8 } },
          { provider: 'deepseek-account', model: 'deepseek-flash', pricing: {} },
        ],
      }),
    }))
    assert.equal(save.status, 200)
    assert.equal(save.body.ok, true)

    const afterSave = await callRoute(routes.get('/model-billing/catalog'), fakeRequest({ url: '/model-billing/catalog' }))
    assert.deepEqual(afterSave.body.models.map((model) => model.model), ['max', 'flash', 'deepseek-flash'])
    assert.equal(afterSave.body.models[0].pricing.output, 8)
    assert.equal(afterSave.body.models[2].pricing.builtin, true)
    assert.equal(afterSave.body.models[2].pricing.peak.output, 8)

    const usage = await callRoute(routes.get('/model-billing/usage'), fakeRequest({
      url: '/model-billing/usage?sessionId=session-1',
    }))
    assert.equal(usage.status, 200)
    assert.equal(usage.body.totals.cost, 7)
    assert.equal(usage.body.turns[0].cacheHit, 2_000_000 / 3_000_000)

    const select = await callRoute(routes.get('/model-billing/select'), fakeRequest({
      method: 'POST',
      url: '/model-billing/select',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session-1', provider: 'qwen', model: 'flash' }),
    }))
    assert.equal(select.status, 200)
    assert.equal(select.body.ok, true)
    assert.deepEqual(selected, [{ sessionId: 'session-1', provider: 'qwen', model: 'flash' }])

    const untrusted = await callRoute(routes.get('/model-billing/catalog'), fakeRequest({
      url: '/model-billing/catalog',
      headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
    }))
    assert.equal(untrusted.status, 403)
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    await rm(directory, { recursive: true, force: true })
  }
})
