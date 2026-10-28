import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
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
const DISPLAY_DEFAULTS = Object.freeze({
  showTurnTail: true,
  showDock: true,
  showModels: true,
  showProvider: false,
  showCost: true,
  showTokens: false,
  showCacheHit: false,
  showLabels: true,
  showUnpricedNotice: true,
  takeoverPicker: true,
  fontSize: 'normal',
  density: 'comfortable',
  fontWeight: 'normal',
})
const DISPLAY_FLAGS = ['showTurnTail', 'showDock', 'showModels', 'showProvider', 'showCost', 'showTokens', 'showCacheHit', 'showLabels', 'showUnpricedNotice', 'takeoverPicker']
const DISPLAY_FONT_SIZES = new Set(['small', 'normal', 'large'])
const DISPLAY_DENSITIES = new Set(['compact', 'comfortable'])
const DISPLAY_FONT_WEIGHTS = new Set(['normal', 'bold'])
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

/** How long a provider's model list stays fresh. */
const CATALOG_TTL_MS = 60_000
let providerListCache = { at: 0, value: null }
const modelListCache = new Map()
const reasoningCache = new Map()

/** Drop every catalog cache so the next lookup hits the adapters again. */
function invalidateCatalogCache() {
  providerListCache = { at: 0, value: null }
  modelListCache.clear()
  reasoningCache.clear()
}

/** Look up the model catalog and merge the saved order/prices into it. */
async function buildCatalog(ctx, options = {}) {
  const state = await loadState(ctx)
  const llm = ctx.get('llm')
  if (llm === undefined) {
    return {
      ok: true,
      models: [],
      failures: [{ provider: 'llm', message: 'the llm service is not mounted' }],
      pricingArchive: pricingArchive(state),
      ...stateEnvelope(state),
    }
  }

  const refresh = options?.refresh === true
  const now = Date.now()

  let providers
  if (!refresh && providerListCache.value !== null && now - providerListCache.at < CATALOG_TTL_MS) {
    providers = providerListCache.value
  } else {
    const listed = typeof llm.listProviders === 'function' ? llm.listProviders() : []
    providers = Array.isArray(listed) ? listed : []
    providerListCache = { at: now, value: providers }
  }

  const settled = await Promise.allSettled(providers.map(async (provider) => {
    let cached = refresh ? undefined : modelListCache.get(provider.id)
    if (cached === undefined || Date.now() - cached.at >= CATALOG_TTL_MS) {
      const models = await llm.listModels(provider.id)
      if (!Array.isArray(models)) throw new Error('the provider returned no model list')
      cached = { at: Date.now(), models }
      modelListCache.set(provider.id, cached)
    }
    const entries = cached.models.filter((model) => typeof model?.id === 'string' && model.id !== '')
    return Promise.all(entries.map(async (model) => {
      let reasoning
      if (typeof llm.resolveModelInfo === 'function') {
        const cacheKey = `${provider.id}\u0000${model.id}`
        if (!refresh && reasoningCache.has(cacheKey)) {
          reasoning = reasoningCache.get(cacheKey)
        } else {
          try {
            const resolved = await llm.resolveModelInfo(provider.id, model.id)
            reasoning = publicReasoning(resolved?.reasoning)
          } catch {
            // Reasoning metadata is optional; an unavailable adapter must not hide the model.
            reasoning = undefined
          }
          // Memoized until the next save; a resolution failure is cached too, so a
          // flapping adapter is not retried on every single catalog request.
          reasoningCache.set(cacheKey, reasoning)
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
    pricingArchive: pricingArchive(state),
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
    display: { ...state.display },
  }
}

/**
 * Prices for routes that are no longer in the configured model list. They stay
 * in the price book so historical calls remain priced; the settings page edits
 * them here instead of forcing the user to re-add a retired model to the picker.
 */
function pricingArchive(state) {
  const current = new Set(state.order.map((entry) => modelKey(entry.provider, entry.model)))
  const rows = []
  for (const [key, value] of Object.entries(state.pricing)) {
    if (current.has(key)) continue
    const at = key.indexOf(KEY_SEPARATOR)
    if (at <= 0) continue
    const provider = key.slice(0, at)
    const model = key.slice(at + KEY_SEPARATOR.length)
    if (!validRoute(provider, model)) continue
    rows.push({ provider, model, pricing: { ...publicPricing(value), source: 'user' } })
  }
  return rows.sort((left, right) =>
    left.provider.localeCompare(right.provider) || left.model.localeCompare(right.model))
}

/**
 * Whether a provider id belongs to DeepSeek itself. Anchored at the start so a
 * relay that merely contains the word (`my-deepseek-relay`) is not captured.
 */
const OFFICIAL_DEEPSEEK_PROVIDER = /^deepseek(?:$|[-_.])/
function isOfficialDeepSeekProvider(provider) {
  return OFFICIAL_DEEPSEEK_PROVIDER.test(String(provider ?? '').trim().toLowerCase())
}

/** The built-in rate table entry for a model, matched case-insensitively. */
function builtinRatesFor(model) {
  const id = String(model ?? '').trim().toLowerCase()
  return Object.prototype.hasOwnProperty.call(DEEPSEEK_PRICES, id) ? DEEPSEEK_PRICES[id] : undefined
}

/** Whether a route is an official DeepSeek route with a built-in rate. */
function isDeepSeekRoute(provider, model) {
  return isOfficialDeepSeekProvider(provider) && builtinRatesFor(model) !== undefined
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

/** The built-in price set for a DeepSeek model at one instant, or undefined. */
function deepseekPricingAt(model, time) {
  const rates = builtinRatesFor(model)
  if (rates === undefined) return undefined
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
  if (!isOfficialDeepSeekProvider(provider)) return null
  const prices = builtinRatesFor(model)
  if (prices === undefined) return null
  return {
    builtin: true,
    peak: { ...prices.peak },
    offPeak: { ...prices.offPeak },
    schedule: DEEPSEEK_PRICING_SCHEDULE,
  }
}

/**
 * The single pricing resolver shared by catalog and usage. A user-supplied price
 * set always wins; otherwise a DeepSeek route falls back to the built-in official
 * table, and every other route stays on its saved flat prices.
 * @returns {{ kind: 'builtin'|'custom'|'flat'|'none', prices: object, complete: boolean, source: 'official'|'user' }}
 */
function resolveRoutePricing(provider, model, savedPricing, time) {
  const saved = publicPricing(savedPricing)
  if (priceSetComplete(saved)) return { kind: 'custom', prices: saved, complete: true, source: 'user' }
  const rates = isOfficialDeepSeekProvider(provider) ? builtinRatesFor(model) : undefined
  if (rates !== undefined) {
    const prices = deepseekPeakAt(time) ? rates.peak : rates.offPeak
    return { kind: 'builtin', prices: { ...prices }, complete: priceSetComplete(prices), source: 'official' }
  }
  const prices = publicPricing(savedPricing)
  const complete = priceSetComplete(prices)
  return { kind: complete ? 'flat' : 'none', prices, complete, source: 'user' }
}

/** Pricing as presented to the Client: the built-in official table or the saved flat prices. */
function catalogPricing(provider, model, value) {
  const resolved = resolveRoutePricing(provider, model, value, Date.now())
  if (resolved.kind === 'builtin') return { ...deepseekBuiltinPricing(provider, model), source: 'official' }
  // Keep the official table alongside a custom DeepSeek price so the settings page
  // can offer "restore official prices" without another round trip.
  const official = isOfficialDeepSeekProvider(provider) ? deepseekBuiltinPricing(provider, model) : null
  return {
    ...resolved.prices,
    source: 'user',
    ...official === null ? {} : { official },
  }
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
  // The three buckets are the authoritative source; a totalTokens that disagrees
  // with them only marks the row partial. Dropping the whole row would under-report
  // the session far more than flagging it uncertain.
  let partial = false
  if (totalTokens !== undefined) {
    if (isCount(totalTokens)) {
      const exactPrompt = totalTokens - outputTokens
      if (!isCount(exactPrompt) || exactPrompt < knownPrompt) partial = true
      else if (cacheReadTokens !== undefined && cacheWriteTokens !== undefined && exactPrompt !== knownPrompt) partial = true
    }
  }
  return {
    uncachedInputTokens: inputTokens,
    outputTokens,
    ...cacheReadTokens === undefined ? {} : { cacheReadTokens },
    ...cacheWriteTokens === undefined ? {} : { cacheWriteTokens },
    ...reasoningTokens === undefined ? {} : { reasoningTokens },
    ...partial ? { partial: true } : {},
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
function computeSessionUsage(events, pricingByKey = new Map(), nameByKey = new Map(), orderKeys = null) {
  const turns = new Map()
  // When the caller knows which routes are still configured, an unpriced call can
  // be split into "needs attention now" and "historical leftovers". Without that
  // set every unpriced call is historical, which keeps older callers unchanged.
  const orderSet = orderKeys instanceof Set ? orderKeys : null
  const unpricedRoutes = new Map()
  let headerRoute
  let headerAt
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
    // Peak/off-peak follows the moment the request reached the server, not when
    // the stream finished — a long request straddling noon stays on its entry rate.
    const pricedAt = headerAt ?? time
    const resolved = provider !== undefined && model !== undefined
      ? resolveRoutePricing(provider, model, key === undefined ? undefined : pricingByKey.get(key), pricedAt)
      : { kind: 'none', prices: defaultPricing(), complete: false }
    const effective = resolved.prices
    const complete = resolved.complete
    const cost = !complete ? 0 : estimateAttemptCost(usage, effective)
    const deepseek = resolved.kind === 'builtin'
    const attempt = {
      seq: event.seq,
      time,
      provider: provider ?? null,
      model: model ?? null,
      name: key === undefined ? null : nameByKey.get(key) ?? null,
      deepseek,
      priced: complete,
      currentOrder: orderSet === null || key === undefined ? null : orderSet.has(key),
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
        headerRoute = undefined
        headerAt = undefined
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
      headerAt = Number(event.time) || headerAt
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
    unpricedCurrentAttempts: 0,
    unpricedHistoricalAttempts: 0,
    cacheReported: false,
    hasBillable: false,
    partial: false,
    partialCurrent: false,
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
      unpricedCurrentAttempts: 0,
      unpricedHistoricalAttempts: 0,
      cacheReported: false,
      hasBillable: false,
      partial: false,
      partialCurrent: false,
      costKnown: false,
      models: [...entry.models.values()].sort((left, right) => left.name.localeCompare(right.name)),
    }
    let usagePartial = false
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
      if (usage.partial === true) usagePartial = true
      if (usage.cacheReadTokens !== undefined || usage.cacheWriteTokens !== undefined) row.cacheReported = true
      row.chargeableAttempts += 1
      row.hasBillable = true
      if (attempt.priced) row.pricedAttempts += 1
      else {
        row.unpricedAttempts += 1
        if (attempt.currentOrder === true) row.unpricedCurrentAttempts += 1
        else row.unpricedHistoricalAttempts += 1
        if (attempt.provider !== null && attempt.model !== null) {
          const routeKey = modelKey(attempt.provider, attempt.model)
          let leftover = unpricedRoutes.get(routeKey)
          if (leftover === undefined) {
            leftover = {
              provider: attempt.provider,
              model: attempt.model,
              name: attempt.name ?? `${attempt.provider} / ${attempt.model}`,
              attempts: 0,
              promptTokens: 0,
              outputTokens: 0,
              cacheReadTokens: 0,
              firstTime: attempt.time,
              lastTime: attempt.time,
              currentOrder: attempt.currentOrder === true,
            }
            unpricedRoutes.set(routeKey, leftover)
          }
          leftover.attempts += 1
          leftover.promptTokens += prompt
          leftover.outputTokens += usage.outputTokens
          leftover.cacheReadTokens += usage.cacheReadTokens ?? 0
          leftover.firstTime = Math.min(leftover.firstTime, attempt.time)
          leftover.lastTime = Math.max(leftover.lastTime, attempt.time)
          leftover.currentOrder = leftover.currentOrder || attempt.currentOrder === true
        }
      }

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
    row.partial = row.unpricedAttempts > 0 || usagePartial
    row.partialCurrent = row.unpricedCurrentAttempts > 0
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
    totals.unpricedCurrentAttempts += row.unpricedCurrentAttempts
    totals.unpricedHistoricalAttempts += row.unpricedHistoricalAttempts
    totals.cacheReported = totals.cacheReported || row.cacheReported
    totals.hasBillable = totals.hasBillable || row.hasBillable
  }

  totals.cacheHit = totals.cacheReported && totals.promptTokens > 0 ? totals.cacheReadTokens / totals.promptTokens : null
  totals.partial = totals.unpricedAttempts > 0 || turnRows.some((row) => row.partial === true)
  totals.partialCurrent = totals.unpricedCurrentAttempts > 0
  totals.costKnown = totals.attempts > 0 && totals.unpricedAttempts === 0

  return {
    turns: turnRows,
    totals,
    byModel: [...byModel.values()].sort((left, right) => left.cost - right.cost || left.name.localeCompare(right.name)),
    unpricedRoutes: [...unpricedRoutes.values()].sort((left, right) => right.attempts - left.attempts || left.name.localeCompare(right.name)),
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
  await removeStaleTemps(dirname(path), path)
  try {
    const text = await readFile(path, 'utf8')
    const raw = JSON.parse(text)
    const state = normalizeState(raw)
    if (isStateTooNew(raw)) {
      // Hand back the readable subset but refuse every write, so an older plugin
      // never clobbers a file it does not understand.
      return { ...state, readOnly: true }
    }
    return state
  } catch (error) {
    if (error?.code !== 'ENOENT') ctx.logger?.warn?.(`[model-billing] ignoring unreadable state: ${messageOf(error)}`)
    return normalizeState(undefined)
  }
}

/** True when the document was written by a newer plugin than this one. */
function isStateTooNew(raw) {
  return typeof raw?.version === 'number' && Number.isFinite(raw.version) && raw.version > STATE_VERSION
}

/**
 * Delete temp files left behind by an older plugin version. The current writer
 * uses a fixed `${path}.tmp` name that is always replaced, so anything else in
 * the directory is debris from the old pid+timestamp naming scheme.
 */
async function removeStaleTemps(directory, path) {
  let entries
  try {
    entries = await readdir(directory)
  } catch {
    return
  }
  for (const entry of entries) {
    if (!entry.startsWith(`${basename(path)}.tmp-`)) continue
    await unlink(join(directory, entry)).catch(() => {})
  }
}

/** Validate persisted turn-tail display settings, keeping unknown keys out. */
function normalizeDisplay(raw) {
  const source = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const display = { ...DISPLAY_DEFAULTS }
  for (const key of DISPLAY_FLAGS) {
    if (typeof source[key] === 'boolean') display[key] = source[key]
  }
  if (DISPLAY_FONT_SIZES.has(source.fontSize)) display.fontSize = source.fontSize
  if (DISPLAY_DENSITIES.has(source.density)) display.density = source.density
  if (DISPLAY_FONT_WEIGHTS.has(source.fontWeight)) display.fontWeight = source.fontWeight
  return display
}

/** Validate a persisted state document into the current shape. */
function normalizeState(raw) {
  const state = {
    version: STATE_VERSION,
    order: [],
    pricing: {},
    display: normalizeDisplay(raw?.display),
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
  const temporary = `${path}.tmp`
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  try {
    await rename(temporary, path)
  } catch (error) {
    // A failed swap must not leave the fixed temp name behind to block the next write.
    await unlink(temporary).catch(() => {})
    throw error
  }
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
  const modelsSupplied = Array.isArray(body?.models)
  const archiveSupplied = Array.isArray(body?.pricingArchive)
  if (!modelsSupplied && !archiveSupplied) {
    throw new BillingRefusal(400, 'bad-request', 'models or pricingArchive must be an array')
  }
  const models = modelsSupplied ? body.models : null
  if (models !== null && models.length > MAX_MODELS) {
    throw new BillingRefusal(400, 'bad-request', `models must be an array of at most ${MAX_MODELS} entries`)
  }
  if (archiveSupplied && body.pricingArchive.length > MAX_STORED_PRICES) {
    throw new BillingRefusal(400, 'bad-request', `pricingArchive must be at most ${MAX_STORED_PRICES} entries`)
  }
  if (body?.display !== undefined && (body.display === null || typeof body.display !== 'object' || Array.isArray(body.display))) {
    throw new BillingRefusal(400, 'bad-request', 'display must be an object')
  }
  // Validate the payload before queueing so a bad request never blocks good ones.
  for (const entry of models ?? []) {
    if (!validRoute(entry?.provider, entry?.model)) {
      throw new BillingRefusal(400, 'bad-request', 'every model needs a non-empty provider and model id')
    }
  }
  for (const entry of body?.pricingArchive ?? []) {
    if (!validRoute(entry?.provider, entry?.model)) {
      throw new BillingRefusal(400, 'bad-request', 'every archived price needs a non-empty provider and model id')
    }
  }
  // Read, merge and write as one queued unit. Doing the read outside the queue
  // lets two quick saves both start from the same stale snapshot, so the later
  // one silently drops the earlier one's prices.
  return enqueueWrite(async () => {
    const state = await loadState(ctx)
    if (state.readOnly === true) {
      throw new BillingRefusal(409, 'state-too-new', 'this state file was written by a newer version of the plugin; upgrade before saving')
    }
    const display = body?.display === undefined ? state.display : normalizeDisplay(body.display)
    const order = []
    const seen = new Set()
    const pricing = { ...state.pricing }
    if (models === null) {
      // An archive-only save must not disturb the configured order.
      for (const entry of state.order) {
        order.push({ provider: entry.provider, model: entry.model })
        seen.add(modelKey(entry.provider, entry.model))
      }
    } else {
      for (const entry of models) {
        const provider = entry.provider.trim()
        const model = entry.model.trim()
        const key = modelKey(provider, model)
        if (seen.has(key)) throw new BillingRefusal(400, 'bad-request', `duplicate model: ${provider}/${model}`)
        seen.add(key)
        order.push({ provider, model })
        pricing[key] = publicPricing(entry.pricing)
      }
    }
    if (archiveSupplied) {
      for (const entry of body.pricingArchive) {
        const provider = entry.provider.trim()
        const model = entry.model.trim()
        const key = modelKey(provider, model)
        if (seen.has(key)) {
          throw new BillingRefusal(400, 'bad-request', `archived price targets a configured model: ${provider}/${model}`)
        }
        const archived = publicPricing(entry.pricing)
        // Three blank fields mean "remove this price-book entry".
        if (PRICE_FIELDS.every((field) => archived[field] === null)) delete pricing[key]
        else pricing[key] = archived
      }
    }
    const capped = capPricing(pricing, order, ctx)
    const next = {
      version: STATE_VERSION,
      order,
      pricing: capped,
      display,
      savedAt: Date.now(),
    }
    await writeState(next)
    // A save can accompany a newly discovered provider/model, so drop the
    // catalog cache so the next catalog request reflects the fresh state.
    invalidateCatalogCache()
    return stateEnvelope(next)
  })
}
/**
 * Trim stored prices to the limit, keeping the routes the user still has in
 * `order` first. Truncating by raw insertion order instead drops exactly the
 * newest prices, which is the opposite of what a user expects.
 */
function capPricing(pricing, order, ctx) {
  const keys = Object.keys(pricing)
  if (keys.length <= MAX_STORED_PRICES) return pricing
  const orderedKeys = new Set(order.map((entry) => modelKey(entry.provider, entry.model)))
  const kept = []
  for (const key of keys) {
    if (orderedKeys.has(key)) kept.push(key)
  }
  for (const key of keys) {
    if (kept.length >= MAX_STORED_PRICES) break
    if (!orderedKeys.has(key)) kept.push(key)
  }
  const trimmed = {}
  for (const key of kept.slice(0, MAX_STORED_PRICES)) trimmed[key] = pricing[key]
  const dropped = keys.length - Object.keys(trimmed).length
  if (dropped > 0) {
    ctx.logger?.warn?.(`[model-billing] dropped ${dropped} price entries to stay under the ${MAX_STORED_PRICES} entry limit`)
  }
  return trimmed
}

/**
 * Serialize state work so two quick saves cannot interleave. The whole
 * read-merge-write runs inside the chain; the previous chain's failures are
 * swallowed with `.then(operation, operation)` so one bad save never wedges the
 * next one.
 */
let writeChain = Promise.resolve()
function enqueueWrite(operation) {
  const run = writeChain.then(operation, operation)
  writeChain = run.catch(() => {})
  return run
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
  sendJson(response, 200, await buildCatalog(ctx, { refresh: wantsRefresh(request) }))
}

/** `?refresh=1` forces the catalog to hit the adapters again instead of the cache. */
function wantsRefresh(request) {
  try {
    return (new URL(request.url ?? '/', 'http://127.0.0.1').searchParams.get('refresh') ?? '') === '1'
  } catch {
    return false
  }
}

const USAGE_CACHE_LIMIT = 50
const usageCache = new Map()

/** Cache one session's folded usage until its event tail or pricing changes. */
function usageCacheKey(sessionId, lastSeq, savedAt) {
  return `${sessionId}\u0000${lastSeq ?? 'none'}\u0000${savedAt ?? 'none'}`
}

function cachedUsage(sessionId, lastSeq, savedAt, fold) {
  const key = usageCacheKey(sessionId, lastSeq, savedAt)
  const hit = usageCache.get(key)
  if (hit !== undefined) {
    usageCache.delete(key)
    usageCache.set(key, hit)
    return hit
  }
  const value = fold()
  usageCache.set(key, value)
  while (usageCache.size > USAGE_CACHE_LIMIT) {
    usageCache.delete(usageCache.keys().next().value)
  }
  return value
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
  const events = session.ownEvents()
  const lastSeq = Array.isArray(events) && events.length > 0 ? events[events.length - 1]?.seq : undefined
  const usage = cachedUsage(sessionId, lastSeq, state.savedAt, () => {
    const pricingByKey = new Map()
    for (const [key, value] of Object.entries(state.pricing)) pricingByKey.set(key, publicPricing(value))
    const orderKeys = new Set(state.order.map((entry) => modelKey(entry.provider, entry.model)))
    return computeSessionUsage(events, pricingByKey, new Map(), orderKeys)
  })
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
    return sendJson(response, error instanceof BillingRefusal ? error.status : 400, {
      ok: false,
      code: error instanceof BillingRefusal ? error.code : 'bad-request',
      message: messageOf(error),
    })
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
    sendJson(response, error instanceof BillingRefusal ? error.status : 400, {
      ok: false,
      code: error instanceof BillingRefusal ? error.code : 'select-failed',
      message: messageOf(error),
    })
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
  if (host !== undefined && !trustedAuthority(request, host)) return false
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

/**
 * Loopback stays the default. A request whose Host header also matches the address
 * this socket is actually listening on is trusted, so a reverse proxy or a LAN
 * address works without letting a forged Host header through.
 */
function trustedAuthority(request, host) {
  if (loopbackAuthority(host)) return true
  const socket = request.socket
  const address = socket?.localAddress
  const port = socket?.localPort
  if (typeof address !== 'string' || address.length === 0) return false
  const local = authorityOf(address, port)
  return local !== null && host.toLowerCase() === local
}

/** Format a socket address the way an HTTP Host header spells it. */
function authorityOf(address, port) {
  const name = address.includes(':') && !address.startsWith('[') ? `[${address}]` : address.toLowerCase()
  return typeof port === 'number' && port > 0 ? `${name}:${port}` : name
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
  authorityOf,
  builtinRatesFor,
  buildCatalog,
  catalogPricing,
  computeSessionUsage,
  deepseekBuiltinPricing,
  deepseekPeakAt,
  deepseekPricingAt,
  defaultPricing,
  estimateAttemptCost,
  isDeepSeekRoute,
  isOfficialDeepSeekProvider,
  isStateTooNew,
  loadState,
  modelKey,
  normalizeDisplay,
  normalizeState,
  normalizeUsage,
  priceSetComplete,
  publicPricing,
  resolveRoutePricing,
  saveOrderAndPrices,
  statePath,
  trustedAuthority,
  validRoute,
}
