import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { apply, __test } from '../host.js'

const { loadState, modelKey } = __test

function fakeRequest({ method = 'GET', url = '/', headers = {}, body = null }) {
  return {
    method,
    url,
    headers: { host: '127.0.0.1:13280', ...headers },
    async *[Symbol.asyncIterator]() {
      if (body !== null) yield Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8')
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

/** Mount the plugin against a throwaway DSH_HOME and a caller-supplied llm. */
async function withPlugin(llm, routes) {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-model-billing-caching-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = directory
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
      if (name === 'sessions') return { get: () => undefined }
      if (name === 'sessionController') return { async selectModel(request) { return request } }
      return undefined
    },
  }
  apply(ctx)
  return {
    ctx,
    async cleanup() {
      if (previous === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previous
      await rm(directory, { recursive: true, force: true })
    },
  }
}

test('a second catalog read reuses cached model info (TEST-06)', async () => {
  const routes = new Map()
  let resolutions = 0
  const llm = {
    listProviders: () => [{ id: 'qwen', name: 'Qwen' }],
    listModels: async () => [{ id: 'flash', name: 'Qwen Flash' }],
    resolveModelInfo: async () => {
      resolutions += 1
      return { reasoning: { efforts: [{ id: 'low', name: 'Low' }], defaultEffort: 'low' } }
    },
  }
  const { cleanup } = await withPlugin(llm, routes)
  try {
    // The refresh escape hatch makes the first read deterministic even if an
    // earlier test in this file left the shared cache warm.
    const first = await callRoute(routes.get('/model-billing/catalog'), fakeRequest({ url: '/model-billing/catalog?refresh=1' }))
    assert.equal(first.status, 200)
    assert.equal(resolutions, 1)

    const second = await callRoute(routes.get('/model-billing/catalog'), fakeRequest({ url: '/model-billing/catalog' }))
    assert.equal(second.status, 200)
    assert.equal(resolutions, 1, 'the cached read must not call resolveModelInfo again')
    assert.deepEqual(second.body.models.map((row) => row.model), first.body.models.map((row) => row.model))
    assert.equal(second.body.models[0].reasoning.efforts[0].id, 'low')
  } finally {
    await cleanup()
  }
})

test('a failing provider is reported without failing the catalog (TEST-09)', async () => {
  const routes = new Map()
  const llm = {
    listProviders: () => [{ id: 'broken', name: 'Broken' }, { id: 'healthy', name: 'Healthy' }],
    listModels: async (provider) => {
      if (provider === 'broken') throw new Error('the adapter exploded')
      return [{ id: 'ok', name: 'Healthy OK' }]
    },
    resolveModelInfo: async () => undefined,
  }
  const { cleanup } = await withPlugin(llm, routes)
  try {
    const catalog = await callRoute(routes.get('/model-billing/catalog'), fakeRequest({ url: '/model-billing/catalog?refresh=1' }))
    assert.equal(catalog.status, 200)
    assert.equal(catalog.body.ok, true)
    assert.equal(catalog.body.failures.length, 1)
    assert.equal(catalog.body.failures[0].provider, 'broken')
    assert.deepEqual(catalog.body.models.map((row) => row.model), ['ok'])
  } finally {
    await cleanup()
  }
})

test('two concurrent saves both keep their prices (TEST-07)', async () => {
  const routes = new Map()
  const llm = {
    listProviders: () => [{ id: 'qwen', name: 'Qwen' }],
    listModels: async () => [{ id: 'flash', name: 'Qwen Flash' }, { id: 'max', name: 'Qwen Max' }],
    resolveModelInfo: async () => undefined,
  }
  const { ctx, cleanup } = await withPlugin(llm, routes)
  try {
    const save = (model, cacheMiss) => callRoute(routes.get('/model-billing/save'), fakeRequest({
      method: 'POST',
      url: '/model-billing/save',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ models: [{ provider: 'qwen', model, pricing: { cacheHit: 0.5, cacheMiss, output: 8 } }] }),
    }))

    const results = await Promise.all([save('flash', 2), save('max', 20)])
    assert.equal(results[0].status, 200)
    assert.equal(results[1].status, 200)

    const state = await loadState(ctx)
    assert.equal(state.pricing[modelKey('qwen', 'flash')].cacheMiss, 2)
    assert.equal(state.pricing[modelKey('qwen', 'max')].cacheMiss, 20)
  } finally {
    await cleanup()
  }
})

test('an oversized body keeps its 413 on save and select (TEST-08)', async () => {
  const routes = new Map()
  const llm = {
    listProviders: () => [],
    listModels: async () => [],
    resolveModelInfo: async () => undefined,
  }
  const { cleanup } = await withPlugin(llm, routes)
  try {
    const oversized = Buffer.alloc(300 * 1024, 0x61)

    const saved = await callRoute(routes.get('/model-billing/save'), fakeRequest({
      method: 'POST',
      url: '/model-billing/save',
      headers: { 'content-type': 'application/json' },
      body: oversized,
    }))
    assert.equal(saved.status, 413)
    assert.equal(saved.body.code, 'body-too-large')

    const selected = await callRoute(routes.get('/model-billing/select'), fakeRequest({
      method: 'POST',
      url: '/model-billing/select',
      headers: { 'content-type': 'application/json' },
      body: oversized,
    }))
    assert.equal(selected.status, 413)
    assert.equal(selected.body.code, 'body-too-large')
  } finally {
    await cleanup()
  }
})
