import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

/**
 * Model order, token prices and session cost estimation.
 *
 * The browser half is a build-free plain-JavaScript Client module, so it cannot
 * declare a generated `ctx.remote` namespace. It talks to this half over
 * same-origin routes on `ctx.webServer`, the same transport other community
 * plugins use. Prices and the user's order live in a small JSON file under the
 * Harness home; usage is always folded from the durable session log.
 */

export const inject = ['webServer']

const CATALOG_PATH = '/model-billing/catalog'
const USAGE_PATH = '/model-billing/usage'
const SAVE_PATH = '/model-billing/save'
const SELECT_PATH = '/model-billing/select'

const STATE_VERSION = 1
const MAX_MODELS = 500
const MAX_STORED_PRICES = 2000
const MAX_BODY_BYTES = 256 * 1024
const PRICE_FIELDS = ['cacheHit', 'cacheMiss', 'output']
const KEY_SEPARATOR = '\u0000'
const DEEPSEEK_PRICING_SCHEDULE = '北京时间周一至周五 9:00–12:00、14:00–18:00（法定节假日除外）'
const DEEPSEEK_PRICES = {
  'deepseek-flash': {
    peak: { cacheHit: 0.04, cacheMiss: 2, output: 8 },
    offPeak: { cacheHit: 0.02, cacheMiss: 1, output: 4 },
  },
  'deepseek-v4-flash': {
    peak: { cacheHit: 0.04, cacheMiss: 2, output: 8 },
    offPeak: { cacheHit: 0.02, cacheMiss: 1, output: 4 },
  },
  'deepseek-v4-flash-vision-exp': {
    peak: { cacheHit: 0.04, cacheMiss: 2, output: 8 },
    offPeak: { cacheHit: 0.02, cacheMiss: 1, output: 4 },
  },
  'deepseek-v4-pro': {
    peak: { cacheHit: 0.3, cacheMiss: 9, output: 27 },
    offPeak: { cacheHit: 0.15, cacheMiss: 4.5, output: 13.5 },
  },
}

// Chinese statutory holidays (2026). Weekends are always off-peak; these dates
// are the extra weekday closures that must not be billed at peak rates.
const DEEPSEEK_HOLIDAYS = new Set([
  '2026-01-01', '2026-01-02', '2026-01-03',
  '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19',
  '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23',
  '2026-04-04', '2026-04-05', '2026-04-06',
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
  '2026-06-19', '2026-06-20', '2026-06-21',
  '2026-09-25', '2026-09-26', '2026-09-27',
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
  '2026-10-05', '2026-10-06', '2026-10-07',
])
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

/** A refusal that carries the HTTP status and stable code the Client reports. */
class BillingRefusal extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = 'BillingRefusal'
    this.status = status
    this.code = code
  }
}

/** The durable state path; `DSH_HOME` wins over the conventional home. */
function statePath() {
  const home = typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME.trim() !== ''
    ? process.env.DSH_HOME.trim()
    : join(homedir(), '.dsh')
  return join(home, 'model-billing.json')
}

/** Look up the model catalog and merge the saved order/prices into it. */
async function buildCatalog(ctx) {
  const state = await loadState(ctx)
  const llm = ctx.get('llm')
  if (llm === undefined) {
    return {
      ok: true,
      models: [],
      failures: [{ provider: 'llm', message: 'the llm service is not mounted' }],
      ...stateEnvelope(state),
    }
  }

  const listed = typeof llm.listProviders === 'function' ? llm.listProviders() : []
  const providers = Array.isArray(listed) ? listed : []
  const settled = await Promise.allSettled(providers.map(async (provider) => {
    const models = await llm.listModels(provider.id)
    if (!Array.isArray(models)) throw new Error('the provider returned no model list')
    const entries = models.filter((model) => typeof model?.id === 'string' && model.id !== '')
    return Promise.all(entries.map(async (model) => {
      let reasoning
      if (typeof llm.resolveModelInfo === 'function') {
        try {
          const resolved = await llm.resolveModelInfo(provider.id, model.id)
          reasoning = publicReasoning(resolved?.reasoning)
        } catch {
          // Reasoning metadata is optional; an unavailable adapter must not hide the model.
        }
      }
      return {
        provider: provider.id,
        providerName: provider.name || provider.id,
        model: model.id,
        name: model.name || model.id,
        isDeepSeek: isDeepSeekRoute(provider.id, model.id),
        ...reasoning === undefined ? {} : { reasoning },
      }
    }))
  }))

  const rows = []
  const failures = []
  const seen = new Set()
  settled.forEach((result, index) => {
    const provider = providers[index]
    if (result.status === 'rejected') {
      failures.push({
        provider: provider?.id ?? 'unknown',
        providerName: provider?.name ?? provider?.id ?? 'unknown',
        message: messageOf(result.reason),
      })
      return
    }
    for (const row of result.value) {
      const key = modelKey(row.provider, row.model)
      if (seen.has(key)) continue
      seen.add(key)
      rows.push(row)
    }
  })

  const ranked = applySavedOrder(rows, state)
  return {
    ok: true,
    models: ranked.map((row, index) => ({
      ...row,
      order: index,
      pricing: catalogPricing(row.provider, row.model, state.pricing[modelKey(row.provider, row.model)]),
    })),
    failures,
    ...stateEnvelope(state),
  }
}

/** Put saved routes first, keeping new routes in provider/catalog order behind them. */
function applySavedOrder(rows, state) {
  const rank = new Map()
  for (const entry of state.order) {
    const key = modelKey(entry.provider, entry.model)
    if (!rank.has(key)) rank.set(key, rank.size)
  }
  return rows
    .map((row, index) => ({ row, index, rank: rank.get(modelKey(row.provider, row.model)) ?? Number.MAX_SAFE_INTEGER }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map((entry) => entry.row)
}

/** The pricing/order metadata every catalog response carries. */
function stateEnvelope(state) {
  return {
    stateVersion: STATE_VERSION,
    savedAt: state.savedAt,
    order: state.order.map((entry) => ({ provider: entry.provider, model: entry.model })),
  }
}

/** Whether a route is one of the official DeepSeek routes. */
function isDeepSeekRoute(provider, model) {
  return String(provider).toLowerCase().includes('deepseek')
    || String(model).toLowerCase().startsWith('deepseek')
}

/** Whether one instant falls in DeepSeek's Beijing peak window. */
function deepseekPeakAt(time) {
  const stamp = Number(time)
  if (!Number.isFinite(stamp)) return false
  const beijing = new Date(stamp + 8 * 60 * 60 * 1000)
  const day = beijing.getUTCDay()
  if (day === 0 || day === 6) return false
  if (DEEPSEEK_HOLIDAYS.has(beijing.toISOString().slice(0, 10))) return false
  const hour = beijing.getUTCHours()
  return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18)
}

/** The built-in price set for a DeepSeek model at one instant. */
function deepseekPricingAt(model, time) {
  const id = String(model ?? '').toLowerCase()
  const rates = id.includes('pro')
    ? DEEPSEEK_PRICES['deepseek-v4-pro']
    : DEEPSEEK_PRICES['deepseek-flash']
  return deepseekPeakAt(time) ? rates.peak : rates.offPeak
}

/** Keep only the reasoning metadata the Client needs for its effort menu. */
function publicReasoning(value) {
  if (value === null || typeof value !== 'object' || !Array.isArray(value.efforts)) return undefined
  const efforts = value.efforts
    .filter((effort) => typeof effort?.id === 'string' && effort.id !== '')
    .map((effort) => ({
      id: effort.id,
      name: typeof effort.name === 'string' && effort.name !== '' ? effort.name : effort.id,
      ...(typeof effort.description === 'string' && effort.description !== '' ? { description: effort.description } : {}),
    }))
  if (efforts.length === 0) return undefined
  return {
    efforts,
    ...(typeof value.defaultEffort === 'string' && value.defaultEffort !== '' ? { defaultEffort: value.defaultEffort } : {}),
  }
}

/** A stable map key that cannot collide across provider/model strings. */
function modelKey(provider, model) {
  return `${provider}${KEY_SEPARATOR}${model}`
}

/** Default prices: unset values stay `null`, zero is a real free price. */
function defaultPricing() {
  return { cacheHit: null, cacheMiss: null, output: null }
}

/** The public form of one model's three prices. */
function publicPricing(value) {
  const source = value?.base ?? value
  const fallback = defaultPricing()
  if (source === null || typeof source !== 'object') return fallback
  const result = {}
  for (const field of PRICE_FIELDS) result[field] = priceOrNull(source[field])
  return result
}

/** Official DeepSeek peak/off-peak prices, built in rather than user-edited. */
function deepseekBuiltinPricing(provider, model) {
  if (!String(provider).toLowerCase().includes('deepseek')) return null
  const prices = DEEPSEEK_PRICES[model]
  if (prices === undefined) return null
  return {
    builtin: true,
    peakEnabled: true,
    peak: { ...prices.peak },
    offPeak: { ...prices.offPeak },
    schedule: DEEPSEEK_PRICING_SCHEDULE,
  }
}

/** Pricing as presented to the Client: built-in official table or the saved flat prices. */
function catalogPricing(provider, model, value) {
  return deepseekBuiltinPricing(provider, model) ?? publicPricing(value)
}

/** A finite non-negative number, or null for "not set". */
function priceOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number) || number < 0 || number > 1e12) return null
  return Math.round(number * 1e8) / 1e8
}

/** Whether all three prices of a set are configured. */
function priceSetComplete(value) {
  return PRICE_FIELDS.every((field) => typeof value?.[field] === 'number' && Number.isFinite(value[field]) && value[field] >= 0)
}

function isCount(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function safeSum(values) {
  let total = 0
  for (const value of values) {
    total += value
    if (!Number.isSafeInteger(total)) return undefined
  }
  return total
}

/** The last usage chunk of a durable assistant stream. */
function streamUsage(stream) {
  if (!Array.isArray(stream)) return undefined
  for (let index = stream.length - 1; index >= 0; index -= 1) {
    const record = stream[index]
    if (record?.type === 'chunk' && record.chunk?.type === 'usage') return record.chunk.usage
  }
  return undefined
}

/**
 * Normalize a provider usage sample. `inputTokens` is the uncached input bucket;
 * cache reads and writes sit beside it, matching token-meter's accounting.
 */
function normalizeUsage(usage, stream) {
  const sample = usage ?? streamUsage(stream)
  if (sample === null || typeof sample !== 'object') return undefined
  const { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, reasoningTokens, totalTokens } = sample
  if (!isCount(inputTokens) || !isCount(outputTokens)) return undefined
  if (cacheReadTokens !== undefined && !isCount(cacheReadTokens)) return undefined
  if (cacheWriteTokens !== undefined && !isCount(cacheWriteTokens)) return undefined
  if (reasoningTokens !== undefined && (!isCount(reasoningTokens) || reasoningTokens > outputTokens)) return undefined
  const knownPrompt = safeSum([
    inputTokens,
    ...cacheReadTokens === undefined ? [] : [cacheReadTokens],
    ...cacheWriteTokens === undefined ? [] : [cacheWriteTokens],
  ])
  if (knownPrompt === undefined) return undefined
  if (totalTokens !== undefined) {
    if (!isCount(totalTokens)) return undefined
    const exactPrompt = totalTokens - outputTokens
    if (!isCount(exactPrompt) || exactPrompt < knownPrompt) return undefined
    if (cacheReadTokens !== undefined && cacheWriteTokens !== undefined && exactPrompt !== knownPrompt) return undefined
  }
  return {
    uncachedInputTokens: inputTokens,
    outputTokens,
    ...cacheReadTokens === undefined ? {} : { cacheReadTokens },
    ...cacheWriteTokens === undefined ? {} : { cacheWriteTokens },
    ...reasoningTokens === undefined ? {} : { reasoningTokens },
  }
}

function messageRoute(message) {
  const provider = message?.source?.provider
  const model = message?.source?.model
  return typeof provider === 'string' && typeof model === 'string' && provider !== '' && model !== ''
    ? { provider, model }
    : undefined
}

/** A short, whitespace-collapsed preview of the first user text in one turn. */
function userTextPreview(message) {
  const content = Array.isArray(message?.content) ? message.content : []
  const text = content
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text === '') return '（无文本）'
  const characters = Array.from(text)
  return characters.length > 36 ? `${characters.slice(0, 36).join('')}…` : text
}

/**
 * Fold one Session's durable attempts into per-turn and whole-session cost.
 *
 * Only `assistant/message` and `assistant/attempt` samples are billed. A usage
 * sample without a lifecycle route is retained with an unknown route so the UI
 * can report it as unpriced instead of silently dropping tokens.
 */
function computeSessionUsage(events, pricingByKey = new Map(), nameByKey = new Map()) {
  const turns = new Map()
  let headerRoute
  let latestTime = 0
  let currentTurn = null
  let pendingPreview = null

  const ensureTurn = (turn, time) => {
    let entry = turns.get(turn)
    if (entry === undefined) {
      entry = {
        turn,
        startTime: Number(time) || 0,
        endTime: Number(time) || 0,
        preview: '',
        seenUser: false,
        attempts: [],
        models: new Map(),
      }
      turns.set(turn, entry)
    }
    return entry
  }

  const addAttempt = (event, route, usage) => {
    const turn = event?.data?.turn
    if (!Number.isSafeInteger(turn) || usage === undefined) return
    const time = Number(event.time) || latestTime
    latestTime = Math.max(latestTime, time)
    const entry = ensureTurn(turn, time)
    entry.endTime = Math.max(entry.endTime, time)
    const provider = route?.provider
    const model = route?.model
    const key = provider !== undefined && model !== undefined ? modelKey(provider, model) : undefined
    const deepseek = provider !== undefined && model !== undefined && isDeepSeekRoute(provider, model)
    const pricing = deepseek
      ? deepseekPricingAt(model, time)
      : key !== undefined ? pricingByKey.get(key) : undefined
    const effective = pricing ?? defaultPricing()
    const complete = priceSetComplete(effective)
    const cost = !complete ? 0 : estimateAttemptCost(usage, effective)
    const attempt = {
      seq: event.seq,
      time,
      provider: provider ?? null,
      model: model ?? null,
      name: key === undefined ? null : nameByKey.get(key) ?? null,
      deepseek,
      priced: complete,
      cost,
      usage,
    }
    entry.attempts.push(attempt)
    if (provider !== undefined && model !== undefined) {
      const modelName = nameByKey.get(key) ?? `${provider} / ${model}`
      const existing = entry.models.get(key)
      if (existing === undefined) {
        entry.models.set(key, { provider, model, name: modelName, cost: 0, priced: complete, isDeepSeek: deepseek })
      }
      const modelEntry = entry.models.get(key)
      modelEntry.cost += cost
      modelEntry.priced = modelEntry.priced && complete
    }
  }

  for (const event of events) {
    if (event?.type === 'turn/start') {
      const turn = event.data?.turn
      if (Number.isSafeInteger(turn)) {
        currentTurn = turn
        const entry = ensureTurn(turn, event.time)
        if (!entry.seenUser && pendingPreview !== null) {
          entry.preview = pendingPreview
          entry.seenUser = true
          pendingPreview = null
        }
      }
      continue
    }
    if (event?.type === 'user/message') {
      const preview = userTextPreview(event.data)
      if (currentTurn === null) {
        pendingPreview = preview
      } else {
        const entry = ensureTurn(currentTurn, event.time)
        if (!entry.seenUser) {
          entry.preview = preview
          entry.seenUser = true
        }
      }
      continue
    }
    if (event?.type === 'turn/end') {
      currentTurn = null
      continue
    }
    if (event?.type === 'request/header') {
      const config = event.data?.header?.config
      if (typeof config?.provider === 'string' && typeof config?.model === 'string') {
        headerRoute = { provider: config.provider, model: config.model }
      }
      continue
    }
    if (event?.type === 'assistant/message') {
      addAttempt(event, messageRoute(event.data?.message) ?? headerRoute, normalizeUsage(event.data?.usage, event.data?.stream))
      continue
    }
    if (event?.type === 'assistant/attempt') {
      addAttempt(event, headerRoute, normalizeUsage(undefined, event.data?.stream))
    }
  }

  const turnRows = []
  const byModel = new Map()
  const totals = {
    cost: 0,
    promptTokens: 0,
    uncachedInputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
    cacheHit: null,
    attempts: 0,
    chargeableAttempts: 0,
    pricedAttempts: 0,
    unpricedAttempts: 0,
    cacheReported: false,
    hasBillable: false,
    partial: false,
    costKnown: false,
  }

  for (const entry of [...turns.values()].sort((left, right) => left.turn - right.turn)) {
    if (entry.attempts.length === 0) continue
    const row = {
      turn: entry.turn,
      startTime: entry.startTime,
      endTime: entry.endTime,
      preview: entry.preview,
      cost: 0,
      promptTokens: 0,
      uncachedInputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 0,
      cacheHit: null,
      attempts: entry.attempts.length,
      chargeableAttempts: 0,
      pricedAttempts: 0,
      unpricedAttempts: 0,
      cacheReported: false,
      hasBillable: false,
      partial: false,
      costKnown: false,
      models: [...entry.models.values()].sort((left, right) => left.name.localeCompare(right.name)),
    }
    for (const attempt of entry.attempts) {
      const usage = attempt.usage
      const prompt = usage.uncachedInputTokens
        + (usage.cacheReadTokens ?? 0)
        + (usage.cacheWriteTokens ?? 0)
      row.promptTokens += prompt
      row.uncachedInputTokens += usage.uncachedInputTokens
      row.cacheReadTokens += usage.cacheReadTokens ?? 0
      row.cacheWriteTokens += usage.cacheWriteTokens ?? 0
      row.outputTokens += usage.outputTokens
      row.cost += attempt.cost
      if (usage.cacheReadTokens !== undefined || usage.cacheWriteTokens !== undefined) row.cacheReported = true
      row.chargeableAttempts += 1
      row.hasBillable = true
      if (attempt.priced) row.pricedAttempts += 1
      else row.unpricedAttempts += 1

      const key = attempt.provider !== null && attempt.model !== null
        ? modelKey(attempt.provider, attempt.model)
        : undefined
      const aggregateKey = key ?? `unknown${KEY_SEPARATOR}${attempt.name ?? 'unknown'}`
      let aggregate = byModel.get(aggregateKey)
      if (aggregate === undefined) {
        aggregate = {
          provider: attempt.provider,
          model: attempt.model,
          name: attempt.name ?? '未知模型',
          cost: 0,
          promptTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheReported: false,
          attempts: 0,
          pricedAttempts: 0,
          unpricedAttempts: 0,
          isDeepSeek: attempt.deepseek === true,
        }
        byModel.set(aggregateKey, aggregate)
      }
      aggregate.cost += attempt.cost
      aggregate.promptTokens += prompt
      aggregate.outputTokens += usage.outputTokens
      aggregate.cacheReadTokens += usage.cacheReadTokens ?? 0
      aggregate.cacheReported = aggregate.cacheReported || usage.cacheReadTokens !== undefined || usage.cacheWriteTokens !== undefined
      aggregate.attempts += 1
      if (attempt.priced) aggregate.pricedAttempts += 1
      else aggregate.unpricedAttempts += 1
    }
    row.cacheHit = row.cacheReported && row.promptTokens > 0 ? row.cacheReadTokens / row.promptTokens : null
    row.partial = row.unpricedAttempts > 0
    row.costKnown = row.attempts > 0 && row.unpricedAttempts === 0
    turnRows.push(row)

    totals.cost += row.cost
    totals.promptTokens += row.promptTokens
    totals.uncachedInputTokens += row.uncachedInputTokens
    totals.cacheReadTokens += row.cacheReadTokens
    totals.cacheWriteTokens += row.cacheWriteTokens
    totals.outputTokens += row.outputTokens
    totals.attempts += row.attempts
    totals.chargeableAttempts += row.chargeableAttempts
    totals.pricedAttempts += row.pricedAttempts
    totals.unpricedAttempts += row.unpricedAttempts
    totals.cacheReported = totals.cacheReported || row.cacheReported
    totals.hasBillable = totals.hasBillable || row.hasBillable
  }

  totals.cacheHit = totals.cacheReported && totals.promptTokens > 0 ? totals.cacheReadTokens / totals.promptTokens : null
  totals.partial = totals.unpricedAttempts > 0
  totals.costKnown = totals.attempts > 0 && totals.unpricedAttempts === 0

  return {
    turns: turnRows,
    totals,
    byModel: [...byModel.values()].sort((left, right) => left.cost - right.cost || left.name.localeCompare(right.name)),
    lastTurn: turnRows.at(-1) ?? null,
  }
}

/** Price one normalized attempt using one price set. */
function estimateAttemptCost(usage, prices) {
  const hit = (usage.cacheReadTokens ?? 0) / 1_000_000 * prices.cacheHit
  const miss = ((usage.uncachedInputTokens ?? 0) + (usage.cacheWriteTokens ?? 0)) / 1_000_000 * prices.cacheMiss
  const output = (usage.outputTokens ?? 0) / 1_000_000 * prices.output
  const total = hit + miss + output
  return Number.isFinite(total) ? Math.round(total * 1e10) / 1e10 : 0
}

/** Load and normalize the durable state. A corrupt file degrades to defaults. */
async function loadState(ctx) {
  const path = statePath()
  try {
    const text = await readFile(path, 'utf8')
    return normalizeState(JSON.parse(text))
  } catch (error) {
    if (error?.code !== 'ENOENT') ctx.logger?.warn?.(`[model-billing] ignoring unreadable state: ${messageOf(error)}`)
    return normalizeState(undefined)
  }
}

/** Validate a persisted state document into the current shape. */
function normalizeState(raw) {
  const state = {
    version: STATE_VERSION,
    order: [],
    pricing: {},
    savedAt: typeof raw?.savedAt === 'number' && Number.isFinite(raw.savedAt) ? raw.savedAt : 0,
  }
  const seen = new Set()
  if (Array.isArray(raw?.order)) {
    for (const entry of raw.order) {
      if (state.order.length >= MAX_MODELS) break
      if (!validRoute(entry?.provider, entry?.model)) continue
      const key = modelKey(entry.provider, entry.model)
      if (seen.has(key)) continue
      seen.add(key)
      state.order.push({ provider: entry.provider, model: entry.model })
    }
  }
  if (raw?.pricing !== null && typeof raw?.pricing === 'object' && !Array.isArray(raw.pricing)) {
    let count = 0
    for (const [key, value] of Object.entries(raw.pricing)) {
      if (count >= MAX_STORED_PRICES) break
      if (key.includes(KEY_SEPARATOR)) {
        state.pricing[key] = publicPricing(value)
        count += 1
      }
    }
  }
  return state
}

/** Persist one normalized state document atomically. */
async function writeState(state) {
  const path = statePath()
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  await rename(temporary, path)
}

/** Validate a route pair used as a map key. */
function validRoute(provider, model) {
  return typeof provider === 'string'
    && typeof model === 'string'
    && provider.trim() !== ''
    && model.trim() !== ''
    && provider.length <= 200
    && model.length <= 200
    && !/[\u0000-\u001f\u007f]/.test(provider)
    && !/[\u0000-\u001f\u007f]/.test(model)
}

/** Merge one save request into the durable state and return the new envelope. */
async function saveOrderAndPrices(ctx, body) {
  const models = Array.isArray(body?.models) ? body.models : null
  if (models === null || models.length > MAX_MODELS) {
    throw new BillingRefusal(400, 'bad-request', `models must be an array of at most ${MAX_MODELS} entries`)
  }
  const state = await loadState(ctx)
  const order = []
  const seen = new Set()
  const pricing = { ...state.pricing }
  for (const entry of models) {
    if (!validRoute(entry?.provider, entry?.model)) {
      throw new BillingRefusal(400, 'bad-request', 'every model needs a non-empty provider and model id')
    }
    const provider = entry.provider.trim()
    const model = entry.model.trim()
    const key = modelKey(provider, model)
    if (seen.has(key)) throw new BillingRefusal(400, 'bad-request', `duplicate model: ${provider}/${model}`)
    seen.add(key)
    order.push({ provider, model })
    if (!isDeepSeekRoute(provider, model)) pricing[key] = publicPricing(entry.pricing)
  }
  const next = {
    version: STATE_VERSION,
    order,
    pricing,
    savedAt: Date.now(),
  }
  await enqueueWrite(ctx, next)
  return stateEnvelope(next)
}

/** Serialize writes so two quick saves cannot interleave. */
let writeChain = Promise.resolve()
function enqueueWrite(ctx, state) {
  const operation = writeChain.then(() => writeState(state))
  writeChain = operation.catch(() => {})
  return operation
}

/**
 * Register the catalog, usage and save routes.
 * @param {object} ctx Host Cordis context.
 */
export function apply(ctx) {
  const onCatalog = (request, response) => {
    void serveCatalog(ctx, request, response).catch((error) => fail(ctx, response, error))
  }
  const onUsage = (request, response) => {
    void serveUsage(ctx, request, response).catch((error) => fail(ctx, response, error))
  }
  const onSave = (request, response) => {
    void serveSave(ctx, request, response).catch((error) => fail(ctx, response, error))
  }
  const onSelect = (request, response) => {
    void serveSelect(ctx, request, response).catch((error) => fail(ctx, response, error))
  }
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: CATALOG_PATH, handler: onCatalog }), 'model-billing: catalog route')
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: USAGE_PATH, handler: onUsage }), 'model-billing: usage route')
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: SAVE_PATH, handler: onSave }), 'model-billing: save route')
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: SELECT_PATH, handler: onSelect }), 'model-billing: select route')
  ctx.logger?.info?.(`[model-billing] routes mounted at ${CATALOG_PATH}, ${USAGE_PATH}, ${SAVE_PATH}, ${SELECT_PATH}`)
}

async function serveCatalog(ctx, request, response) {
  if (request.method !== 'GET') return sendJson(response, 405, { ok: false, code: 'method-not-allowed', message: 'only GET is accepted' })
  if (!sameOrigin(request)) return sendJson(response, 403, { ok: false, code: 'untrusted-origin', message: 'the request did not come from this Harness page' })
  sendJson(response, 200, await buildCatalog(ctx))
}

async function serveUsage(ctx, request, response) {
  if (request.method !== 'GET') return sendJson(response, 405, { ok: false, code: 'method-not-allowed', message: 'only GET is accepted' })
  if (!sameOrigin(request)) return sendJson(response, 403, { ok: false, code: 'untrusted-origin', message: 'the request did not come from this Harness page' })
  let sessionId = ''
  try {
    sessionId = (new URL(request.url ?? '/', 'http://127.0.0.1').searchParams.get('sessionId') ?? '').trim()
  } catch {
    return sendJson(response, 400, { ok: false, code: 'bad-request', message: 'sessionId is missing or malformed' })
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(sessionId)) {
    return sendJson(response, 400, { ok: false, code: 'bad-request', message: 'sessionId is missing or malformed' })
  }
  const sessions = ctx.get('sessions')
  const session = sessions?.get?.(sessionId)
  if (session === undefined) {
    return sendJson(response, 404, { ok: false, code: 'session-not-found', message: 'this Session is not loaded in the Host' })
  }
  const state = await loadState(ctx)
  const pricingByKey = new Map()
  for (const [key, value] of Object.entries(state.pricing)) pricingByKey.set(key, publicPricing(value))
  const usage = computeSessionUsage(session.ownEvents(), pricingByKey)
  sendJson(response, 200, {
    ok: true,
    sessionId,
    savedAt: state.savedAt,
    stateVersion: STATE_VERSION,
    ...usage,
  })
}

async function serveSave(ctx, request, response) {
  if (request.method !== 'POST') return sendJson(response, 405, { ok: false, code: 'method-not-allowed', message: 'only POST is accepted' })
  if (!sameOrigin(request)) return sendJson(response, 403, { ok: false, code: 'untrusted-origin', message: 'the request did not come from this Harness page' })
  let body
  try {
    body = JSON.parse(await readBody(request))
  } catch (error) {
    return sendJson(response, error instanceof BillingRefusal ? error.status : 400, {
      ok: false,
      code: error instanceof BillingRefusal ? error.code : 'bad-request',
      message: messageOf(error),
    })
  }
  const envelope = await saveOrderAndPrices(ctx, body)
  sendJson(response, 200, { ok: true, ...envelope })
}

/** Select a model for one Session through the official session controller. */
async function serveSelect(ctx, request, response) {
  if (request.method !== 'POST') return sendJson(response, 405, { ok: false, code: 'method-not-allowed', message: 'only POST is accepted' })
  if (!sameOrigin(request)) return sendJson(response, 403, { ok: false, code: 'untrusted-origin', message: 'the request did not come from this Harness page' })
  let body
  try {
    body = JSON.parse(await readBody(request))
  } catch (error) {
    return sendJson(response, 400, { ok: false, code: 'bad-request', message: messageOf(error) })
  }
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : ''
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(sessionId)) {
    return sendJson(response, 400, { ok: false, code: 'bad-request', message: 'sessionId is missing or malformed' })
  }
  if (!validRoute(body?.provider, body?.model)) {
    return sendJson(response, 400, { ok: false, code: 'bad-request', message: 'provider and model are required' })
  }
  const controller = ctx.get('sessionController')
  if (controller === undefined) {
    return sendJson(response, 503, { ok: false, code: 'unavailable', message: 'the session controller is not mounted' })
  }
  const reasoningEffort = typeof body.reasoningEffort === 'string' && body.reasoningEffort !== ''
    ? body.reasoningEffort
    : undefined
  try {
    const selection = await controller.selectModel({
      sessionId,
      provider: body.provider.trim(),
      model: body.model.trim(),
      ...reasoningEffort === undefined ? {} : { reasoningEffort },
    })
    sendJson(response, 200, { ok: true, selection })
  } catch (error) {
    sendJson(response, 400, { ok: false, code: 'select-failed', message: messageOf(error) })
  }
}

function fail(ctx, response, error) {
  const refusal = error instanceof BillingRefusal
    ? error
    : new BillingRefusal(500, 'internal', messageOf(error))
  ctx.logger?.warn?.(`[model-billing] ${refusal.code}: ${refusal.message}`)
  sendJson(response, refusal.status, { ok: false, code: refusal.code, message: refusal.message })
}

function sendJson(response, status, value) {
  if (response.headersSent) return
  response.writeHead(status, JSON_HEADERS)
  response.end(JSON.stringify(value))
}

/** Whether the request came from this Harness page rather than another site. */
function sameOrigin(request) {
  const host = request.headers.host
  if (host !== undefined && !loopbackAuthority(host)) return false
  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = request.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function loopbackAuthority(host) {
  const lower = host.toLowerCase()
  const name = lower.startsWith('[') ? lower.slice(0, lower.indexOf(']') + 1) : lower.split(':')[0]
  return name === '127.0.0.1' || name === 'localhost' || name === '[::1]'
}

/** Read a size-capped JSON request body. */
async function readBody(request) {
  let size = 0
  const chunks = []
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) {
      throw new BillingRefusal(413, 'body-too-large', `the request body exceeds ${MAX_BODY_BYTES} bytes`)
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

/** Pure helpers exported for the Host test run. */
export const __test = {
  applySavedOrder,
  buildCatalog,
  catalogPricing,
  computeSessionUsage,
  deepseekBuiltinPricing,
  deepseekPeakAt,
  deepseekPricingAt,
  defaultPricing,
  estimateAttemptCost,
  isDeepSeekRoute,
  loadState,
  modelKey,
  normalizeState,
  normalizeUsage,
  priceSetComplete,
  publicPricing,
  saveOrderAndPrices,
  statePath,
  validRoute,
}
