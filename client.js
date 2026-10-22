window.__ModuleLoader__.load({
  id: 'dsh-model-billing',
  factory(require) {
    const React = require('react')
    const ReactDOM = require('react-dom')
    const h = React.createElement
    const {
      Fragment,
      useEffect,
      useId,
      useLayoutEffect,
      useMemo,
      useRef,
      useState,
      useSyncExternalStore,
    } = React

    // ---------------------------------------------------------------------
    // Locale
    // ---------------------------------------------------------------------

    const STRINGS = {
      zh: {
        nav: '模型与费用',
        title: '模型与费用',
        intro: '调整已配置模型的顺序，并填写每百万 tokens 的价格。金额根据会话日志估算所有模型；DeepSeek 使用内置峰谷价。',
        loading: '正在加载模型目录…',
        loadFailed: '模型目录加载失败',
        retry: '重试',
        modelsCount: '{count} 个模型',
        save: '保存',
        saving: '保存中…',
        saved: '已保存',
        unsaved: '有未保存的修改',
        undo: '撤销修改',
        orderHint: '用 ↑ / ↓ 调整顺序；顺序直接决定对话框右下角模型选择器中的排列，也用于费用明细。',
        noModels: '当前没有可用的已配置模型。',
        up: '上移',
        down: '下移',
        cacheHitPrice: '输入 · 缓存命中',
        cacheMissPrice: '输入 · 缓存未命中',
        outputPrice: '输出',
        perMillion: '元 / 百万 tokens',
        deepseekTag: 'DeepSeek',
        deepseekNote: '官方峰谷价只读；DeepSeek 已按事件发生时间自动计入估算。',
        officialPrice: '官方定价（只读）',
        peak: '高峰',
        offPeak: '空闲',
        deepseekSchedule: '高峰为北京时间周一至周五 9:00–12:00、14:00–18:00（法定节假日除外）；其余时段为空闲。',
        pricePlaceholder: '未设置',
        priceUnset: '未定价',
        priceHitShort: '命中',
        priceMissShort: '未命中',
        priceOutShort: '输出',
        priceUnit: '元/M',
        invalidPrice: '价格必须是非负数字，或留空表示未设置。',
        saveFailed: '保存失败：{message}',
        savedAt: '已保存于 {time}',
        formula: '估算公式：缓存命中输入 × 命中价 +（未缓存输入 + 缓存写入）× 未命中价 + 输出 × 输出价。',
        formulaNote: '价格按每百万 tokens 计。缓存写入按缓存未命中价计算；未配置价格的模型不产生金额。',
        singlePrice: '价格',
        settingsOpen: '在设置中编辑',
        costEstimate: '费用估算',
        costDetails: '费用明细',
        close: '关闭',
        thisTurn: '本轮',
        sessionTotal: '本会话',
        cacheHit: '缓存命中率',
        tokens: '输入 / 输出',
        turn: '轮次',
        content: '内容',
        time: '时间',
        model: '使用模型',
        cost: '费用',
        byModel: '按模型',
        excludedShort: '不计入',
        partial: '部分未定价',
        partialShort: '部分未定价',
        partialNote: '有非 DeepSeek 调用尚未配置完整价格，合计只包含已定价部分。',
        estimateNote: '金额由会话日志中的 token 用量和缓存命中估算；DeepSeek 按事件时间使用内置峰谷价，实际账单以提供方为准。',
        listSep: '、',
        turnCost: '费用',
        turnTokens: '本轮 Token',
        displaySection: '轮尾显示',
        displayHint: '控制每轮结束后在对话尾部显示的内容；修改后点“保存”生效。',
        displayModels: '使用模型',
        displayProvider: '模型提供商',
        displayCost: '本轮费用',
        displayTokens: 'Token 用量',
        displayCacheHit: '缓存命中率',
        displayLabels: '显示文字标签',
        displayFontSize: '字号',
        displayDensity: '间距',
        displayWeight: '字重',
        fontSizeSmall: '小',
        fontSizeNormal: '标准',
        fontSizeLarge: '大',
        densityCompact: '紧凑',
        densityComfortable: '舒适',
        weightNormal: '常规',
        weightBold: '加粗',
        pickerSection: '模型选择器',
        takeoverPicker: '接管模型选择器',
        takeoverHint: '开启后使用本插件按自定义顺序排列的模型选择器；关闭后恢复 DSH 内置选择器。',
        chooseModel: '选择模型',
        loadingModels: '加载模型…',
        searchModel: '搜索模型',
        noMatch: '没有匹配的模型',
        pickerEmpty: '暂无可用模型',
        reasoningEffort: '推理强度',
        providerDefault: '提供方默认',
        switching: '切换中…',
        pickerRetry: '重新加载',
        pickerAria: '选择模型与推理强度',
        pickerUnavailable: '模型目录尚未就绪，请刷新页面',
      },
      en: {
        nav: 'Models & Cost',
        title: 'Models & Cost',
        intro: 'Reorder configured models and enter prices per million tokens. Amounts estimate every model from the session log; DeepSeek uses its built-in peak/off-peak prices.',
        loading: 'Loading the model catalog…',
        loadFailed: 'Could not load the model catalog',
        retry: 'Retry',
        modelsCount: '{count} models',
        save: 'Save',
        saving: 'Saving…',
        saved: 'Saved',
        unsaved: 'Unsaved changes',
        undo: 'Discard changes',
        orderHint: 'Use ↑ / ↓ to reorder. This order is used directly by the model picker at the bottom-right of the composer, and by the cost details.',
        noModels: 'No configured models are available.',
        up: 'Move up',
        down: 'Move down',
        cacheHitPrice: 'Input · cache hit',
        cacheMissPrice: 'Input · cache miss',
        outputPrice: 'Output',
        perMillion: 'CNY / million tokens',
        deepseekTag: 'DeepSeek',
        deepseekNote: 'Official peak/off-peak prices are read-only; DeepSeek is now billed automatically at the event time.',
        officialPrice: 'Official prices (read-only)',
        peak: 'Peak',
        offPeak: 'Off-peak',
        deepseekSchedule: 'Peak: Beijing time Mon–Fri 09:00–12:00 and 14:00–18:00, excluding Chinese statutory holidays; all other times are off-peak.',
        pricePlaceholder: 'Not set',
        priceUnset: 'Not priced',
        priceHitShort: 'hit',
        priceMissShort: 'miss',
        priceOutShort: 'out',
        priceUnit: 'CNY/M',
        invalidPrice: 'Prices must be non-negative numbers, or blank when unset.',
        saveFailed: 'Save failed: {message}',
        savedAt: 'Saved at {time}',
        formula: 'Estimate: cached input × hit price + (uncached input + cache write) × miss price + output × output price.',
        formulaNote: 'Prices are per million tokens. Cache writes use the cache-miss price; models without a full price set produce no amount.',
        singlePrice: 'Prices',
        settingsOpen: 'Edit in Settings',
        costEstimate: 'Cost estimate',
        costDetails: 'Cost details',
        close: 'Close',
        thisTurn: 'Turn',
        sessionTotal: 'Session',
        cacheHit: 'Cache hit rate',
        tokens: 'Input / output',
        turn: 'Turn',
        content: 'Content',
        time: 'Time',
        model: 'Model',
        cost: 'Cost',
        byModel: 'By model',
        excludedShort: 'Excluded',
        partial: 'partly unpriced',
        partialShort: 'partly unpriced',
        partialNote: 'Some non-DeepSeek calls do not have a complete price set; the total includes only priced calls.',
        estimateNote: 'Amounts are estimated from token usage and cache hits in the session log; DeepSeek uses built-in peak/off-peak prices at the event time, and the provider bill is authoritative.',
        listSep: ', ',
        turnCost: 'Cost',
        turnTokens: 'Turn tokens',
        displaySection: 'Turn-tail display',
        displayHint: 'Choose what appears below each completed turn; click Save to apply.',
        displayModels: 'Models used',
        displayProvider: 'Model provider',
        displayCost: 'Turn cost',
        displayTokens: 'Token usage',
        displayCacheHit: 'Cache hit rate',
        displayLabels: 'Show text labels',
        displayFontSize: 'Font size',
        displayDensity: 'Spacing',
        displayWeight: 'Font weight',
        fontSizeSmall: 'Small',
        fontSizeNormal: 'Normal',
        fontSizeLarge: 'Large',
        densityCompact: 'Compact',
        densityComfortable: 'Comfortable',
        weightNormal: 'Regular',
        weightBold: 'Bold',
        pickerSection: 'Model picker',
        takeoverPicker: 'Take over the model picker',
        takeoverHint: 'On: use this plugin’s picker with your custom model order. Off: restore the built-in DSH picker.',
        chooseModel: 'Select model',
        loadingModels: 'Loading models…',
        searchModel: 'Search models',
        noMatch: 'No matching model',
        pickerEmpty: 'No model available',
        reasoningEffort: 'Reasoning effort',
        providerDefault: 'Provider default',
        switching: 'Switching…',
        pickerRetry: 'Reload',
        pickerAria: 'Select model and reasoning effort',
        pickerUnavailable: 'The model directory is not ready; reload the page',
      },
    }

    const t = (key, values) => {
      const active = localeService?.getSnapshot?.().active ?? 'zh'
      const dict = active.toLowerCase().startsWith('en') ? STRINGS.en : STRINGS.zh
      const template = dict[key] ?? STRINGS.zh[key] ?? key
      return values === undefined
        ? template
        : template.replace(/\{(\w+)\}/g, (match, name) => values[name] === undefined ? match : String(values[name]))
    }

    let localeService
    let modelDirectories
    let modelDirectoryRevision = 0
    const modelDirectoryListeners = new Set()

    function publishModelDirectories(next) {
      if (next === undefined || next === modelDirectories) return
      modelDirectories = next
      modelDirectoryRevision += 1
      for (const listener of [...modelDirectoryListeners]) listener()
    }

    function subscribeModelDirectories(listener) {
      modelDirectoryListeners.add(listener)
      return () => modelDirectoryListeners.delete(listener)
    }

    function useModelDirectoriesRevision() {
      return useSyncExternalStore(
        subscribeModelDirectories,
        () => modelDirectoryRevision,
        () => 0,
      )
    }

    function subscribeLocale(listener) {
      return localeService?.subscribe?.(listener) ?? (() => {})
    }

    function localeRevision() {
      return localeService?.getSnapshot?.().revision ?? 0
    }

    function useT() {
      useSyncExternalStore(subscribeLocale, localeRevision, () => 0)
      return t
    }

    const DISPLAY_DEFAULTS = Object.freeze({
      showModels: true,
      showProvider: false,
      showCost: true,
      showTokens: false,
      showCacheHit: false,
      showLabels: true,
      takeoverPicker: true,
      fontSize: 'normal',
      density: 'comfortable',
      fontWeight: 'normal',
    })

    const DISPLAY_STORAGE_KEY = 'dsh-model-billing.display'

    function readStoredDisplay() {
      try {
        const raw = localStorage.getItem(DISPLAY_STORAGE_KEY)
        if (raw === null) return null
        const parsed = JSON.parse(raw)
        return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
      } catch {
        return null
      }
    }

    function writeStoredDisplay(value) {
      try {
        localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(value))
      } catch {
        // Storage may be unavailable in restricted browser contexts.
      }
    }

    function clearStoredDisplay() {
      try {
        localStorage.removeItem(DISPLAY_STORAGE_KEY)
      } catch {
        // Ignore unavailable storage.
      }
    }

    function readDisplay(data) {
      const source = data?.display
      const server = source !== null && typeof source === 'object' && !Array.isArray(source)
        ? { ...DISPLAY_DEFAULTS, ...source }
        : { ...DISPLAY_DEFAULTS }
      const stored = readStoredDisplay()
      return stored === null ? server : { ...server, ...stored }
    }

    // ---------------------------------------------------------------------
    // Shared catalog state
    // ---------------------------------------------------------------------

    const catalog = {
      snap: { status: 'idle', data: null, error: null },
      listeners: new Set(),
      inflight: null,
      generation: 0,
    }

    async function requestJson(url, options) {
      const response = await fetch(url, {
        credentials: 'same-origin',
        cache: 'no-store',
        ...options,
        headers: {
          accept: 'application/json',
          ...(options?.headers ?? {}),
        },
      })
      let body
      try {
        body = await response.json()
      } catch {
        throw new Error(`HTTP ${response.status}`)
      }
      if (!response.ok || body?.ok === false) {
        throw new Error(body?.message ?? `HTTP ${response.status}`)
      }
      return body
    }

    function emitCatalog() {
      for (const listener of [...catalog.listeners]) listener()
    }

    function setCatalog(draft) {
      catalog.snap = { ...catalog.snap, ...draft }
      emitCatalog()
    }

    async function ensureCatalog(force = false) {
      if (!force && catalog.snap.status === 'ready') return catalog.snap.data
      if (catalog.inflight !== null && !force) return catalog.inflight
      catalog.generation += 1
      const generation = catalog.generation
      setCatalog({ status: 'loading', error: null })
      const operation = requestJson('/model-billing/catalog')
        .then((data) => {
          if (generation !== catalog.generation) return data
          setCatalog({ status: 'ready', data, error: null })
          return data
        })
        .catch((error) => {
          if (generation === catalog.generation) {
            setCatalog({ status: 'error', error: error instanceof Error ? error.message : String(error) })
          }
          return null
        })
        .finally(() => {
          if (catalog.inflight === operation) catalog.inflight = null
        })
      catalog.inflight = operation
      return operation
    }

    function subscribeCatalog(listener) {
      catalog.listeners.add(listener)
      if (catalog.snap.status === 'idle') void ensureCatalog()
      return () => catalog.listeners.delete(listener)
    }

    function catalogSnapshot() {
      return catalog.snap
    }

    function useCatalog() {
      return useSyncExternalStore(subscribeCatalog, catalogSnapshot, catalogSnapshot)
    }

    // ---------------------------------------------------------------------
    // Shared session usage state
    // ---------------------------------------------------------------------

    const usageSlots = new Map()

    function usageSlot(sessionId) {
      let slot = usageSlots.get(sessionId)
      if (slot === undefined) {
        slot = {
          snap: { status: 'idle', data: null, error: null },
          listeners: new Set(),
          inflight: null,
          generation: 0,
          revision: null,
        }
        usageSlots.set(sessionId, slot)
      }
      return slot
    }

    function emitUsage(slot) {
      for (const listener of [...slot.listeners]) listener()
    }

    function ensureUsage(sessionId, revision, force = false) {
      const slot = usageSlot(sessionId)
      if (!force && slot.revision === revision && slot.snap.status !== 'error') return
      if (slot.inflight !== null && slot.inflight === revision && !force) return
      slot.revision = revision
      slot.generation += 1
      const generation = slot.generation
      slot.snap = { ...slot.snap, status: 'loading', error: null }
      emitUsage(slot)
      const operation = requestJson(`/model-billing/usage?sessionId=${encodeURIComponent(sessionId)}`)
        .then((data) => {
          if (generation !== slot.generation) return
          slot.snap = { status: 'ready', data, error: null }
          emitUsage(slot)
        })
        .catch((error) => {
          if (generation !== slot.generation) return
          slot.snap = {
            status: 'error',
            data: slot.snap.data,
            error: error instanceof Error ? error.message : String(error),
          }
          emitUsage(slot)
        })
        .finally(() => {
          if (slot.inflight === operation) slot.inflight = null
        })
      slot.inflight = operation
      return operation
    }

    function useSessionUsage(sessionId, revision) {
      const slot = usageSlot(sessionId)
      const snap = useSyncExternalStore(
        (listener) => {
          slot.listeners.add(listener)
          return () => slot.listeners.delete(listener)
        },
        () => slot.snap,
        () => slot.snap,
      )
      useEffect(() => {
        if (sessionId !== undefined && revision !== null) ensureUsage(sessionId, revision)
      }, [sessionId, revision])
      return snap
    }

    function tokenUsageRevision(tokenUsage) {
      if (tokenUsage === undefined || tokenUsage === null) return 'none'
      return [
        tokenUsage.uncachedInputTokens ?? '',
        tokenUsage.outputTokens ?? '',
        tokenUsage.cacheReadTokens ?? '',
        tokenUsage.cacheWriteTokens ?? '',
      ].join(':')
    }

    // ---------------------------------------------------------------------
    // Formatting
    // ---------------------------------------------------------------------

    function formatMoney(value) {
      if (value === null || value === undefined || !Number.isFinite(value)) return '—'
      if (value === 0) return '¥0'
      const fixed = value.toFixed(2)
      return fixed === '0.00' ? '<¥0.01' : `¥${fixed}`
    }

    function formatTokens(value) {
      if (!Number.isFinite(value)) return '—'
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
      if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
      return String(Math.round(value))
    }

    function formatPercent(value) {
      return value === null || value === undefined ? '—' : `${(value * 100).toFixed(1)}%`
    }

    function formatPrice(value) {
      if (value === null || value === undefined) return '—'
      return String(Number(value.toFixed(6)))
    }

    function PriceLines({ pricing, translate }) {
      if (pricing?.builtin === true) {
        const line = (label, prices) =>
          `${label} ${translate('priceHitShort')} ${formatPrice(prices?.cacheHit)} · ${translate('priceMissShort')} ${formatPrice(prices?.cacheMiss)} · ${translate('priceOutShort')} ${formatPrice(prices?.output)} ${translate('priceUnit')}`
        return h('div', { className: 'mb-picker-prices' },
          h('div', { className: 'mb-picker-price-line' }, line(translate('peak'), pricing.peak)),
          h('div', { className: 'mb-picker-price-line' }, line(translate('offPeak'), pricing.offPeak)))
      }
      const hasAny = pricing !== null && pricing !== undefined
        && [pricing.cacheHit, pricing.cacheMiss, pricing.output].some((value) => typeof value === 'number')
      if (!hasAny) {
        return h('div', { className: 'mb-picker-prices' }, translate('priceUnset'))
      }
      return h('div', { className: 'mb-picker-prices' },
        h('div', { className: 'mb-picker-price-line' },
          `${translate('priceHitShort')} ${formatPrice(pricing.cacheHit)} · ${translate('priceMissShort')} ${formatPrice(pricing.cacheMiss)} · ${translate('priceOutShort')} ${formatPrice(pricing.output)} ${translate('priceUnit')}`))
    }

    function timeText(timestamp) {
      if (!Number.isFinite(timestamp) || timestamp <= 0) return ''
      try {
        return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      } catch {
        return ''
      }
    }

    // ---------------------------------------------------------------------
    // Styles
    // ---------------------------------------------------------------------

    const CSS = `
      .mb-page { color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 1.5; padding: 4px 0 28px; }
      .mb-page * { box-sizing: border-box; }
      .mb-title { margin: 0 0 4px; font-size: 18px; font-weight: 600; }
      .mb-intro { margin: 0 0 14px; color: var(--dsw-alias-label-secondary); max-width: 760px; }
      .mb-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 14px 0; }
      .mb-muted { color: var(--dsw-alias-label-secondary); }
      .mb-spacer { flex: 1; }
      .mb-btn { appearance: none; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); border-radius: 7px; height: 30px; padding: 0 12px; font: inherit; cursor: pointer; }
      .mb-btn:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); }
      .mb-btn:disabled { opacity: .45; cursor: default; }
      .mb-btn-primary { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); font-weight: 600; }
      .mb-btn-primary:hover:not(:disabled) { background: var(--dsw-alias-brand-primary); opacity: .9; }
      .mb-btn-icon { width: 28px; height: 28px; padding: 0; font-size: 13px; }
      .mb-status { color: var(--dsw-alias-label-secondary); min-height: 18px; }
      .mb-status[data-tone="error"] { color: var(--dsw-alias-state-error-primary); }
      .mb-status[data-tone="success"] { color: var(--dsw-alias-state-success-primary); }
      .mb-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; max-width: 980px; }
      .mb-card { border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); border-radius: 10px; padding: 12px 14px; }
      .mb-card-head { display: flex; align-items: flex-start; gap: 12px; }
      .mb-index { width: 26px; height: 26px; border-radius: 7px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); display: grid; place-items: center; font-variant-numeric: tabular-nums; flex: none; }
      .mb-name { font-weight: 600; font-size: 14px; }
      .mb-sub { color: var(--dsw-alias-label-secondary); font-size: 12px; overflow-wrap: anywhere; }
      .mb-head-actions { margin-left: auto; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
      .mb-tag { display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: 11px; font-weight: 500; vertical-align: 1px; }
      .mb-tag-excluded { color: var(--dsw-alias-state-warn-primary); }
      .mb-prices { display: grid; gap: 10px; margin-top: 12px; }
      .mb-price-group { border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 10px 12px 12px; }
      .mb-price-group-title { display: flex; gap: 8px; align-items: baseline; margin-bottom: 8px; font-weight: 600; }
      .mb-price-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
      .mb-field { display: grid; gap: 4px; min-width: 0; }
      .mb-field-label { color: var(--dsw-alias-label-secondary); font-size: 11px; }
      .mb-input { width: 100%; height: 30px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); padding: 0 8px; font: inherit; font-variant-numeric: tabular-nums; }
      .mb-input:focus { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -1px; }
      .mb-note { margin: 8px 0 0; color: var(--dsw-alias-label-secondary); font-size: 12px; }
      .mb-warn { margin: 6px 0 0; color: var(--dsw-alias-state-warn-primary); font-size: 12px; }
      .mb-empty { border: 1px dashed var(--dsw-alias-border-l2); border-radius: 10px; padding: 28px; text-align: center; color: var(--dsw-alias-label-secondary); }
      .mb-footer-note { max-width: 980px; margin-top: 14px; color: var(--dsw-alias-label-secondary); font-size: 12px; }
      .mb-dock { align-self: center; display: flex; flex-direction: column; align-items: flex-start; color: var(--dsw-alias-label-tertiary); font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px); line-height: calc(20px + var(--dsh-content-font-delta-secondary, 0px)); }
      .mb-dock-trigger { appearance: none; border: 0; background: transparent; color: inherit; font: inherit; line-height: inherit; padding: 1px 8px; border-radius: var(--dsw-radius-sm); display: inline-flex; align-items: center; gap: 6px; cursor: pointer; text-align: left; max-width: 100%; flex-wrap: nowrap; }
      .mb-dock-trigger:hover, .mb-dock-trigger[aria-expanded="true"] { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-secondary); }
      .mb-dock-amount { color: var(--dsw-alias-label-secondary); font-weight: 500; font-variant-numeric: tabular-nums; }
      .mb-dock-sep { opacity: .55; }
      .mb-dock-icon { flex: none; width: 14px; height: 14px; }
      .mb-dock-caret { font-size: 10px; opacity: .7; }
      .mb-panel { box-sizing: border-box; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-menu-surface-fill, var(--dsw-alias-bg-layer-1)); border-radius: var(--dsw-radius-lg, 10px); padding: 10px 12px; color: var(--dsw-alias-label-primary); }
      .mb-panel-floating { position: fixed; z-index: 1200; max-width: calc(100vw - 24px); max-height: min(430px, calc(100vh - 96px)); overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--dsw-alias-scrollbar-bg-l2, var(--dsw-alias-border-l2)) transparent; box-shadow: var(--dsw-elevation-prominent); backdrop-filter: var(--dsw-menu-backdrop-filter, none); }
      .mb-panel-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
      .mb-panel-title { font-weight: 600; }
      .mb-panel-close { margin-left: auto; width: 24px; height: 24px; border: 0; border-radius: var(--dsw-radius-sm); background: 0 0; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 18px; line-height: 20px; cursor: pointer; }
      .mb-panel-close:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
      .mb-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 10px; }
      .mb-summary-item { background: var(--dsw-alias-bg-layer-2); border-radius: 7px; padding: 7px 9px; min-width: 0; }
      .mb-summary-key { color: var(--dsw-alias-label-secondary); font-size: 11px; }
      .mb-summary-value { font-variant-numeric: tabular-nums; font-weight: 600; overflow-wrap: anywhere; }
      .mb-table { width: 100%; border-collapse: collapse; font-size: 12px; }
      .mb-table th, .mb-table td { text-align: left; padding: 4px 5px; border-bottom: 1px solid var(--dsw-alias-border-l1); vertical-align: top; }
      .mb-table th { color: var(--dsw-alias-label-secondary); font-weight: 500; font-size: 11px; }
      .mb-table td.num, .mb-table th.num { text-align: right; font-variant-numeric: tabular-nums; }
      .mb-table tr:last-child td { border-bottom: 0; }
      .mb-turn-table { table-layout: fixed; }
      .mb-turn-table th, .mb-turn-table td, .mb-turn-table th.num, .mb-turn-table td.num { text-align: left; }
      .mb-turn-table th:nth-child(1), .mb-turn-table td:nth-child(1) { width: 5%; }
      .mb-turn-table th:nth-child(2), .mb-turn-table td:nth-child(2) { width: 25.5%; }
      .mb-turn-table th:nth-child(3), .mb-turn-table td:nth-child(3) { width: 12.5%; }
      .mb-turn-table th:nth-child(4), .mb-turn-table td:nth-child(4) { width: 21%; }
      .mb-turn-table th:nth-child(5), .mb-turn-table td:nth-child(5) { width: 10%; }
      .mb-turn-table th:nth-child(6), .mb-turn-table td:nth-child(6) { width: 16%; }
      .mb-turn-table th:nth-child(7), .mb-turn-table td:nth-child(7) { width: 10%; }
      .mb-turn-preview, .mb-turn-model { color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .mb-turn-model { color: var(--dsw-alias-label-primary); }
      .mb-panel-note { margin: 9px 0 0; color: var(--dsw-alias-label-secondary); font-size: 11px; }
      .mb-turn { color: var(--dsw-alias-label-secondary); font-size: 12px; font-variant-numeric: tabular-nums; display: inline-flex; flex-wrap: wrap; align-items: baseline; column-gap: 10px; row-gap: 2px; max-width: 100%; }
      .mb-turn[data-size="small"] { font-size: 11px; }
      .mb-turn[data-size="large"] { font-size: 13px; }
      .mb-turn[data-density="compact"] { column-gap: 6px; }
      .mb-turn-item { white-space: nowrap; }
      .mb-turn strong { color: inherit; font-weight: 600; }
      .mb-turn[data-weight="normal"] { font-weight: 400; }
      .mb-turn[data-weight="normal"] strong { font-weight: 400; }
      .mb-turn[data-weight="bold"] { font-weight: 600; }
      .mb-turn[data-weight="bold"] strong { font-weight: 600; }
      .mb-turn-partial { color: var(--dsw-alias-state-warn-primary); }
      .mb-display { border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; padding: 12px 14px; margin: 10px 0 14px; background: var(--dsw-alias-bg-layer-2); }
      .mb-display-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
      .mb-display-title { font-weight: 600; }
      .mb-display-hint { color: var(--dsw-alias-label-secondary); font-size: 12px; }
      .mb-check-grid { display: flex; flex-wrap: wrap; gap: 8px 18px; }
      .mb-check { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
      .mb-check.is-disabled { opacity: .55; cursor: default; }
      .mb-check input { width: 15px; height: 15px; accent-color: var(--dsw-alias-brand-primary); }
      .mb-display-controls { display: flex; flex-wrap: wrap; gap: 10px 18px; margin-top: 12px; }
      .mb-select { height: 30px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); padding: 0 8px; font: inherit; }
      .mb-select:focus { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -1px; }
      .mb-picker { position: relative; display: flex; min-width: 0; }
      .mb-picker-trigger { border-radius: var(--dsw-radius-sm); min-width: 0; max-width: min(360px, 45cqw); height: 28px; color: var(--dsw-alias-label-secondary); cursor: pointer; background: 0 0; border: none; outline: none; align-items: center; gap: 4px; padding: 0 4px 0 8px; font-size: 13px; font-weight: 400; line-height: 20px; display: flex; }
      .mb-picker-trigger:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
      .mb-picker-trigger:focus-visible { box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); }
      .mb-picker-trigger:disabled { color: var(--dsw-alias-label-dimmed, var(--dsw-alias-label-secondary)); cursor: default; }
      .mb-picker-icon { display: var(--dsh-composer-model-icon-display, none); flex: none; }
      .mb-picker-name { color: inherit; text-overflow: ellipsis; white-space: nowrap; min-width: 0; overflow: hidden; display: var(--dsh-composer-model-text-display, block); }
      .mb-picker-trigger-effort { text-overflow: ellipsis; white-space: nowrap; min-width: 0; color: var(--dsw-alias-label-caption, var(--dsw-alias-label-secondary)); flex-shrink: 1000; overflow: hidden; display: var(--dsh-composer-model-text-display, block); }
      .mb-picker-chevron { color: var(--dsw-alias-label-caption, var(--dsw-alias-label-secondary)); flex: none; transition: transform .12s; }
      .mb-picker-chevron-open { transform: rotate(180deg); }
      .mb-picker-menu { box-sizing: border-box; z-index: 1100; width: min(360px, calc(100vw - 32px)); max-width: min(360px, calc(100vw - 32px)); max-height: min(480px, calc(100vh - 96px)); box-shadow: var(--dsw-elevation-prominent); background: var(--dsw-menu-surface-fill, var(--dsw-alias-bg-layer-1)); backdrop-filter: var(--dsw-menu-backdrop-filter, none); color: var(--dsw-alias-label-primary); border: 0; border-radius: var(--dsw-radius-lg, 10px); flex-direction: column; padding: 10px; display: flex; position: fixed; overflow: hidden; }
      .mb-picker-search { box-sizing: border-box; border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1); height: 32px; margin: 0 0 6px; padding: 0 9px; font: inherit; font-size: 13px; color: var(--dsw-alias-label-primary); width: 100%; flex: none; }
      .mb-picker-search::placeholder { color: var(--dsw-alias-label-caption, var(--dsw-alias-label-secondary)); }
      .mb-picker-search:focus { border-color: var(--dsw-alias-state-business-primary); outline: none; }
      .mb-picker-list { min-height: 0; overflow-y: auto; padding: 0 2px; display: flex; flex-direction: column; }
      .mb-picker-group { color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); background: var(--dsw-alias-menu-group-header-fill, var(--dsw-menu-surface-fill, var(--dsw-alias-bg-layer-1))); position: sticky; top: 0; z-index: 1; margin-top: 2px; padding: 10px 10px 6px; font-size: 11px; font-weight: 500; line-height: 16px; }
      .mb-picker-row { box-sizing: border-box; border-radius: var(--dsw-radius-md); width: auto; min-width: 100%; color: inherit; text-align: left; cursor: pointer; background: 0 0; border: none; outline: none; align-items: center; gap: 8px; padding: 10px; font: inherit; display: flex; }
      .mb-picker-row + .mb-picker-row { margin-top: 2px; }
      .mb-picker-row:hover:not(:disabled), .mb-picker-row:focus-visible { background: var(--dsw-alias-interactive-bg-hover); }
      .mb-picker-row:disabled { color: var(--dsw-alias-label-dimmed, var(--dsw-alias-label-secondary)); cursor: default; }
      .mb-picker-option-copy { flex-direction: column; flex: 1; min-width: 0; gap: 4px; display: flex; }
      .mb-picker-model { color: inherit; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 400; line-height: 20px; overflow: hidden; }
      .mb-picker-prices { color: var(--dsw-alias-label-caption, var(--dsw-alias-label-secondary)); font-size: 11px; line-height: 17px; font-variant-numeric: tabular-nums; }
      .mb-picker-price-line { white-space: normal; overflow-wrap: anywhere; }
      .mb-picker-check { color: var(--dsw-alias-label-primary); flex: 0 0 14px; place-items: center; display: grid; font-size: 12px; }
      .mb-picker-check svg { width: 14px; height: 14px; }
      .mb-picker-empty { color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); padding: 8px; font-size: 12px; line-height: 18px; }
      .mb-picker-divider { border-top: 1px solid var(--dsw-alias-border-l1); margin: 3px 0; }
      .mb-picker-efforts { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; padding: 2px 4px 4px; }
      .mb-picker-efforts-label { color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); font-size: 11px; margin-right: 2px; }
      .mb-picker-chip { appearance: none; border: 0; background: 0 0; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 11px; height: 24px; padding: 0 7px; border-radius: var(--dsw-radius-sm); cursor: pointer; }
      .mb-picker-chip:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
      .mb-picker-chip[aria-pressed="true"] { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
      .mb-picker-error { border-radius: var(--dsw-radius-md); background: var(--dsw-alias-interactive-bg-hover-danger); color: var(--dsw-alias-state-error-primary); margin-bottom: 3px; padding: 6px 7px; font-size: 11px; line-height: 16px; }
      .mb-picker-retry { align-self: flex-start; margin: 0 4px 2px; }
      .mb-picker-status { color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); padding: 4px 7px; font-size: 11px; line-height: 16px; }
      .mb-fatal { border: 1px solid var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); border-radius: 8px; padding: 12px; }
      @media (max-width: 720px) {
        .mb-price-grid { grid-template-columns: 1fr; }
        .mb-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .mb-head-actions { width: 100%; margin-left: 38px; justify-content: flex-start; }
      }
    `

    function Style() {
      return h('style', null, CSS)
    }

    // ---------------------------------------------------------------------
    // Settings section
    // ---------------------------------------------------------------------

    const PRICE_FIELDS = ['cacheHit', 'cacheMiss', 'output']
    const PRICE_LABEL_KEYS = {
      cacheHit: 'cacheHitPrice',
      cacheMiss: 'cacheMissPrice',
      output: 'outputPrice',
    }

    function toDraftPricing(pricing) {
      if (pricing?.builtin === true) return { ...pricing, peak: { ...pricing.peak }, offPeak: { ...pricing.offPeak } }
      const source = pricing ?? {}
      return Object.fromEntries(PRICE_FIELDS.map((field) => [
        field,
        source[field] === null || source[field] === undefined ? '' : String(source[field]),
      ]))
    }

    function toDraft(models) {
      return models.map((model) => ({
        provider: model.provider,
        providerName: model.providerName,
        model: model.model,
        name: model.name,
        isDeepSeek: model.isDeepSeek,
        pricing: toDraftPricing(model.pricing),
      }))
    }

    function parsePriceInput(value) {
      if (typeof value === 'string' && value.trim() === '') return null
      const number = Number(value)
      if (!Number.isFinite(number) || number < 0 || number > 1e12) return undefined
      return Math.round(number * 1e8) / 1e8
    }

    function SettingsSection() {
      const translate = useT()
      const snap = useCatalog()
      const [draft, setDraft] = useState(null)
      const [display, setDisplay] = useState(null)
      const [dirty, setDirty] = useState(false)
      const [saving, setSaving] = useState(false)
      const [status, setStatus] = useState(null)

      useEffect(() => {
        if (snap.data === null) return
        setDraft(toDraft(snap.data.models))
        setDisplay(readDisplay(snap.data))
        setDirty(false)
      }, [snap.data])

      const models = draft ?? []
      const update = (index, change) => {
        setDraft((current) => current === null ? current : current.map((entry, at) => at === index ? change(entry) : entry))
        setDirty(true)
        setStatus(null)
      }

      const updatePrice = (index, field, value) => {
        update(index, (entry) => ({
          ...entry,
          pricing: { ...entry.pricing, [field]: value },
        }))
      }

      const move = (index, delta) => {
        const target = index + delta
        if (target < 0 || target >= models.length) return
        setDraft((current) => {
          if (current === null) return current
          const next = [...current]
          const [item] = next.splice(index, 1)
          next.splice(target, 0, item)
          return next
        })
        setDirty(true)
        setStatus(null)
      }

      const reset = () => {
        clearStoredDisplay()
        emitCatalog()
        if (snap.data !== null) {
          setDraft(toDraft(snap.data.models))
          setDisplay(readDisplay(snap.data))
        }
        setDirty(false)
        setStatus(null)
      }

      const displayValue = display ?? readDisplay(snap.data)

      const updateDisplay = (change) => {
        setDisplay((current) => ({ ...(current ?? readDisplay(snap.data)), ...change }))
        setDirty(true)
        setStatus(null)
      }

      const renderDisplaySettings = () => h(Fragment, null,
        h('div', { className: 'mb-display' },
          h('div', { className: 'mb-display-head' },
            h('div', { className: 'mb-display-title' }, translate('displaySection')),
            h('div', { className: 'mb-display-hint' }, translate('displayHint'))),
          h('div', { className: 'mb-check-grid' },
            [
              ['showProvider', 'displayProvider'],
              ['showModels', 'displayModels'],
              ['showCost', 'displayCost'],
              ['showTokens', 'displayTokens'],
              ['showCacheHit', 'displayCacheHit'],
              ['showLabels', 'displayLabels'],
            ].map(([field, label]) => h('label', {
              className: `mb-check${field === 'showProvider' && displayValue.showModels !== true ? ' is-disabled' : ''}`,
              key: field,
            },
              h('input', {
                type: 'checkbox',
                checked: displayValue[field] === true,
                disabled: field === 'showProvider' && displayValue.showModels !== true,
                onChange: (event) => updateDisplay({ [field]: event.target.checked }),
              }),
              h('span', null, translate(label))))),
          h('div', { className: 'mb-display-controls' },
            h('label', { className: 'mb-field' },
              h('span', { className: 'mb-field-label' }, translate('displayFontSize')),
              h('select', {
                className: 'mb-select',
                value: displayValue.fontSize,
                onChange: (event) => updateDisplay({ fontSize: event.target.value }),
              },
                h('option', { value: 'small' }, translate('fontSizeSmall')),
                h('option', { value: 'normal' }, translate('fontSizeNormal')),
                h('option', { value: 'large' }, translate('fontSizeLarge')))),
            h('label', { className: 'mb-field' },
              h('span', { className: 'mb-field-label' }, translate('displayDensity')),
              h('select', {
                className: 'mb-select',
                value: displayValue.density,
                onChange: (event) => updateDisplay({ density: event.target.value }),
              },
                h('option', { value: 'compact' }, translate('densityCompact')),
                h('option', { value: 'comfortable' }, translate('densityComfortable')))),
            h('label', { className: 'mb-field' },
              h('span', { className: 'mb-field-label' }, translate('displayWeight')),
              h('select', {
                className: 'mb-select',
                value: displayValue.fontWeight,
                onChange: (event) => updateDisplay({ fontWeight: event.target.value }),
              },
                h('option', { value: 'normal' }, translate('weightNormal')),
                h('option', { value: 'bold' }, translate('weightBold')))))),
        h('div', { className: 'mb-display' },
          h('div', { className: 'mb-display-head' },
            h('div', { className: 'mb-display-title' }, translate('pickerSection')),
            h('div', { className: 'mb-display-hint' }, translate('takeoverHint'))),
          h('label', { className: 'mb-check' },
            h('input', {
              type: 'checkbox',
              checked: displayValue.takeoverPicker === true,
              onChange: (event) => updateDisplay({ takeoverPicker: event.target.checked }),
            }),
            h('span', null, translate('takeoverPicker')))))

      const save = async () => {
        if (draft === null) return
        const payload = []
        for (const entry of draft) {
          if (entry.pricing.builtin === true) {
            payload.push({ provider: entry.provider, model: entry.model, pricing: {} })
            continue
          }
          const pricing = {}
          for (const field of PRICE_FIELDS) {
            const parsed = parsePriceInput(entry.pricing[field])
            if (parsed === undefined) {
              setStatus({ tone: 'error', text: translate('invalidPrice') })
              return
            }
            pricing[field] = parsed
          }
          payload.push({ provider: entry.provider, model: entry.model, pricing })
        }
        setSaving(true)
        setStatus(null)
        try {
          await requestJson('/model-billing/save', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ models: payload, display: displayValue }),
          })
          writeStoredDisplay(displayValue)
          setDirty(false)
          setStatus({ tone: 'success', text: translate('saved') })
          await ensureCatalog(true)
        } catch (error) {
          setStatus({ tone: 'error', text: translate('saveFailed', { message: error instanceof Error ? error.message : String(error) }) })
        } finally {
          setSaving(false)
        }
      }

      if (snap.data === null) {
        return h(Fragment, null,
          h(Style),
          h('section', { className: 'mb-page' },
            h('h2', { className: 'mb-title' }, translate('title')),
            snap.status === 'error'
              ? h('div', { className: 'mb-fatal' },
                h('div', null, translate('loadFailed')),
                h('p', { className: 'mb-note' }, snap.error),
                h('button', { type: 'button', className: 'mb-btn', onClick: () => void ensureCatalog(true) }, translate('retry')))
              : h('p', { className: 'mb-muted' }, translate('loading'))))
      }

      if (draft === null) {
        return h(Fragment, null,
          h(Style),
          h('section', { className: 'mb-page' },
            h('h2', { className: 'mb-title' }, translate('title')),
            h('p', { className: 'mb-muted' }, translate('loading'))))
      }

      if (models.length === 0) {
        return h(Fragment, null,
          h(Style),
          h('section', { className: 'mb-page' },
            h('h2', { className: 'mb-title' }, translate('title')),
            h('p', { className: 'mb-intro' }, translate('intro')),
            renderDisplaySettings(),
            h('div', { className: 'mb-empty' }, translate('noModels'))))
      }

      return h(Fragment, null,
        h(Style),
        h('section', { className: 'mb-page' },
          h('h2', { className: 'mb-title' }, translate('title')),
          h('p', { className: 'mb-intro' }, translate('intro')),
          h('div', { className: 'mb-toolbar' },
            h('span', { className: 'mb-muted' }, translate('modelsCount', { count: models.length })),
            h('span', { className: 'mb-spacer' }),
            dirty ? h('span', { className: 'mb-muted' }, translate('unsaved')) : null,
            h('button', { type: 'button', className: 'mb-btn', disabled: !dirty || saving, onClick: reset }, translate('undo')),
            h('button', { type: 'button', className: 'mb-btn mb-btn-primary', disabled: !dirty || saving, onClick: () => void save() }, saving ? translate('saving') : translate('save'))),
          status === null ? null : h('div', { className: 'mb-status', 'data-tone': status.tone, role: 'status' }, status.text),
          renderDisplaySettings(),
          h('p', { className: 'mb-note' }, translate('orderHint')),
          h('ul', { className: 'mb-list' },
            models.map((entry, index) => h(SettingsModelCard, {
              key: `${entry.provider}\u0000${entry.model}`,
              entry,
              index,
              count: models.length,
              translate,
              onMove: move,
              onUpdatePrice: updatePrice,
            }))),
          h('p', { className: 'mb-footer-note' }, translate('formula')),
          h('p', { className: 'mb-footer-note' }, translate('formulaNote'))))
    }

    function SettingsModelCard({ entry, index, count, translate, onMove, onUpdatePrice }) {
      const id = useId()
      const pricing = entry.pricing
      const builtin = pricing.builtin === true
      const fields = builtin ? null : PRICE_FIELDS.map((field) => {
        const inputId = `${id}-${field}`
        return h('label', { className: 'mb-field', htmlFor: inputId, key: field },
          h('span', { className: 'mb-field-label' }, translate(PRICE_LABEL_KEYS[field])),
          h('input', {
            id: inputId,
            className: 'mb-input',
            type: 'text',
            inputMode: 'decimal',
            autoComplete: 'off',
            placeholder: translate('pricePlaceholder'),
            value: pricing[field],
            onChange: (event) => onUpdatePrice(index, field, event.target.value),
          }))
      })

      return h('li', { className: 'mb-card' },
        h('div', { className: 'mb-card-head' },
          h('div', { className: 'mb-index' }, index + 1),
          h('div', { style: { minWidth: 0 } },
            h('div', { className: 'mb-name' },
              entry.name,
              entry.isDeepSeek ? h('span', { className: 'mb-tag' }, translate('deepseekTag')) : null),
            h('div', { className: 'mb-sub' }, `${entry.providerName} · ${entry.provider} / ${entry.model}`)),
          h('div', { className: 'mb-head-actions' },
            h('button', {
              type: 'button',
              className: 'mb-btn mb-btn-icon',
              disabled: index === 0,
              title: translate('up'),
              'aria-label': translate('up'),
              onClick: () => onMove(index, -1),
            }, '↑'),
            h('button', {
              type: 'button',
              className: 'mb-btn mb-btn-icon',
              disabled: index === count - 1,
              title: translate('down'),
              'aria-label': translate('down'),
              onClick: () => onMove(index, 1),
            }, '↓'))),
        entry.isDeepSeek ? h('p', { className: 'mb-note' }, translate('deepseekNote')) : null,
        h('div', { className: 'mb-prices' },
          h('div', { className: 'mb-price-group' },
            h('div', { className: 'mb-price-group-title' },
              h('span', null, builtin ? translate('officialPrice') : translate('singlePrice')),
              h('span', { className: 'mb-muted', style: { fontWeight: 400, fontSize: '11px' } }, translate('perMillion'))),
            builtin
              ? h(Fragment, null,
                h(PriceLines, { pricing, translate }),
                h('p', { className: 'mb-note' }, translate('deepseekSchedule')))
              : h('div', { className: 'mb-price-grid' }, fields))))
    }

    // ---------------------------------------------------------------------
    // Composer dock cost summary
    // ---------------------------------------------------------------------

    function CostDock({ sessionId, useProjection }) {
      const translate = useT()
      const tokenUsage = useProjection('tokenUsage')
      const revision = tokenUsageRevision(tokenUsage)
      const usage = useSessionUsage(sessionId, revision)
      const catalogSnap = useCatalog()
      const [open, setOpen] = useState(false)
      const [panelPos, setPanelPos] = useState(null)
      const triggerRef = useRef(null)
      const panelRef = useRef(null)

      useLayoutEffect(() => {
        if (!open) {
          setPanelPos(null)
          return undefined
        }
        const place = () => {
          const rect = triggerRef.current?.getBoundingClientRect()
          if (rect === undefined) return
          const width = Math.min(660, window.innerWidth - 24)
          const naturalLeft = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
          // The dock sits near the right edge; shift the whole detail panel left so
          // the bottom-right whale widget cannot cover it.
          const left = Math.max(12, naturalLeft - 120)
          const spaceAbove = rect.top - 12
          const spaceBelow = window.innerHeight - rect.bottom - 12
          const above = spaceAbove > spaceBelow
          const maxHeight = Math.min(430, Math.max(180, above ? spaceAbove : spaceBelow))
          setPanelPos(above
            ? { left, width, bottom: window.innerHeight - rect.top + 8, maxHeight }
            : { left, width, top: rect.bottom + 8, maxHeight })
        }
        place()
        window.addEventListener('resize', place)
        window.addEventListener('scroll', place, true)
        return () => {
          window.removeEventListener('resize', place)
          window.removeEventListener('scroll', place, true)
        }
      }, [open])

      useEffect(() => {
        if (!open) return undefined
        const closeOutside = (event) => {
          if (triggerRef.current?.contains(event.target) === true) return
          if (panelRef.current?.contains(event.target) === true) return
          setOpen(false)
        }
        const closeOnEscape = (event) => {
          if (event.key !== 'Escape') return
          event.preventDefault()
          setOpen(false)
          triggerRef.current?.focus()
        }
        document.addEventListener('mousedown', closeOutside)
        document.addEventListener('keydown', closeOnEscape)
        return () => {
          document.removeEventListener('mousedown', closeOutside)
          document.removeEventListener('keydown', closeOnEscape)
        }
      }, [open])

      const data = usage.data
      if (data === null || data === undefined || data.totals?.hasBillable !== true) {
        return null
      }
      const totals = data.totals
      const last = [...(data.turns ?? [])].reverse().find((entry) => entry.hasBillable) ?? null
      const totalText = totals.costKnown
        ? `≈ ${formatMoney(totals.cost)}`
        : totals.pricedAttempts > 0 ? `≈ ${formatMoney(totals.cost)}*` : translate('pricePlaceholder')
      const lastText = last === null || last === undefined || !last.hasBillable
        ? null
        : last.costKnown ? `≈ ${formatMoney(last.cost)}` : last.pricedAttempts > 0 ? `≈ ${formatMoney(last.cost)}*` : translate('pricePlaceholder')
      const orderIndex = new Map((catalogSnap.data?.models ?? []).map((model) => [`${model.provider}\u0000${model.model}`, model.order]))
      const byModel = [...(data.byModel ?? [])].sort((left, right) => {
        const leftKey = left.provider === null ? '' : `${left.provider}\u0000${left.model}`
        const rightKey = right.provider === null ? '' : `${right.provider}\u0000${right.model}`
        return (orderIndex.get(leftKey) ?? Number.MAX_SAFE_INTEGER) - (orderIndex.get(rightKey) ?? Number.MAX_SAFE_INTEGER)
      })

      const modelNameOf = (model) => {
        const catalogRow = catalogSnap.data?.models?.find((entry) => entry.provider === model?.provider && entry.model === model?.model)
        return catalogRow?.name ?? model?.name ?? model?.model ?? '—'
      }
      const turnModelNames = (turn) => {
        const names = []
        for (const model of turn.models ?? []) {
          const name = modelNameOf(model)
          if (!names.includes(name)) names.push(name)
        }
        return names
      }

      const header = h('thead', null,
        h('tr', null,
          h('th', null, translate('turn')),
          h('th', null, translate('content')),
          h('th', null, translate('time')),
          h('th', null, translate('model')),
          h('th', { className: 'num' }, translate('cost')),
          h('th', { className: 'num' }, translate('tokens')),
          h('th', { className: 'num' }, translate('cacheHit'))))

      const turnRows = [...(data.turns ?? [])].reverse().slice(0, 20).map((turn) => {
        const costText = turn.costKnown
          ? `≈ ${formatMoney(turn.cost)}`
          : turn.pricedAttempts > 0 ? `≈ ${formatMoney(turn.cost)}*` : translate('pricePlaceholder')
        const modelNames = turnModelNames(turn)
        const modelText = modelNames.length === 0
          ? '—'
          : modelNames.length === 1 ? modelNames[0] : `${modelNames[0]} +${modelNames.length - 1}`
        return h('tr', { key: turn.turn },
          h('td', null, `#${turn.turn}`),
          h('td', { className: 'mb-turn-preview', title: turn.preview }, turn.preview || '—'),
          h('td', null, `${timeText(turn.startTime)}–${timeText(turn.endTime)}`),
          h('td', { className: 'mb-turn-model', title: modelNames.join(' / ') }, modelText),
          h('td', { className: 'num' }, costText),
          h('td', { className: 'num' }, `${formatTokens(turn.promptTokens)} / ${formatTokens(turn.outputTokens)}`),
          h('td', { className: 'num' }, formatPercent(turn.cacheHit)))
      })

      const turnTable = h('div', { style: { overflowX: 'auto' } },
        h('table', { className: 'mb-table mb-turn-table' }, header, h('tbody', null, turnRows)))

      const modelRows = byModel.map((model) => {
        const catalogRow = catalogSnap.data?.models?.find((entry) => entry.provider === model.provider && entry.model === model.model)
        const modelName = catalogRow === undefined ? model.name : `${catalogRow.providerName} / ${catalogRow.name}`
        return h('tr', { key: `${model.provider}\u0000${model.model}\u0000${model.name}` },
          h('td', null,
            modelName,
            model.isDeepSeek ? h('span', { className: 'mb-tag' }, translate('deepseekTag')) : null),
          h('td', { className: 'num' },
            model.pricedAttempts > 0 ? `≈ ${formatMoney(model.cost)}` : translate('pricePlaceholder')),
          h('td', { className: 'num', style: { color: 'var(--dsw-alias-label-secondary)' } },
            `${formatTokens(model.promptTokens)} / ${formatTokens(model.outputTokens)}`))
      })

      const modelTable = byModel.length === 0
        ? null
        : h('div', { style: { marginTop: '10px' } },
          h('div', { className: 'mb-panel-title', style: { fontSize: '12px', marginBottom: '4px' } }, translate('byModel')),
          h('div', { style: { overflowX: 'auto' } },
            h('table', { className: 'mb-table' }, h('tbody', null, modelRows))))

      const panelStyle = panelPos === null
        ? { left: 0, top: 0, width: 660, visibility: 'hidden' }
        : {
          left: panelPos.left,
          width: panelPos.width,
          maxHeight: panelPos.maxHeight,
          ...panelPos.top === undefined ? { bottom: panelPos.bottom } : { top: panelPos.top },
        }

      const panel = h('div', {
        ref: panelRef,
        className: 'mb-panel mb-panel-floating',
        style: panelStyle,
        role: 'dialog',
        'aria-label': translate('costDetails'),
        tabIndex: -1,
      },
        h('div', { className: 'mb-panel-head' },
          h('span', { className: 'mb-panel-title' }, translate('costDetails')),
          h('span', { className: 'mb-muted' }, translate('sessionTotal')),
          usage.status === 'error'
            ? h('button', {
              type: 'button',
              className: 'mb-btn',
              onClick: () => void ensureUsage(sessionId, revision, true),
            }, translate('retry'))
            : null,
          h('button', {
            type: 'button',
            className: 'mb-panel-close',
            'aria-label': translate('close'),
            title: translate('close'),
            onClick: () => {
              setOpen(false)
              triggerRef.current?.focus()
            },
          }, '×')),
        h('div', { className: 'mb-summary' },
          summaryItem(translate('sessionTotal'), totalText),
          summaryItem(translate('thisTurn'), lastText ?? '—'),
          summaryItem(translate('cacheHit'), formatPercent(totals.cacheHit)),
          summaryItem(translate('tokens'), `${formatTokens(totals.promptTokens)} / ${formatTokens(totals.outputTokens)}`)),
        turnTable,
        modelTable,
        h('p', { className: 'mb-panel-note' }, translate('estimateNote')),
        totals.partial ? h('p', { className: 'mb-warn' }, translate('partialNote')) : null)

      return h('div', { className: 'mb-dock' },
        h(Style),
        h('button', {
          ref: triggerRef,
          type: 'button',
          className: 'mb-dock-trigger',
          'aria-expanded': open ? 'true' : 'false',
          'aria-haspopup': 'dialog',
          onClick: () => setOpen((value) => !value),
          title: translate('costEstimate'),
        },
          h('svg', {
            className: 'mb-dock-icon',
            viewBox: '0 0 16 16',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.2,
            'aria-hidden': true,
          },
            h('circle', { cx: 8, cy: 8, r: 5.5 }),
            h('path', { d: 'M8 5v6M6.2 6.8h3.6M6.2 9.2h3.6' })),
          h('span', null, translate('costEstimate')),
          h('span', { className: 'mb-dock-amount' }, totalText),
          lastText === null ? null : h(Fragment, null,
            h('span', { className: 'mb-dock-sep' }, '·'),
            h('span', null, `${translate('thisTurn')} ${lastText}`)),
          totals.partial ? h('span', { className: 'mb-warn', style: { margin: 0 } }, translate('partial')) : null),
        open ? ReactDOM.createPortal(panel, document.body) : null)
    }

    function summaryItem(label, value) {
      return h('div', { className: 'mb-summary-item', key: label },
        h('div', { className: 'mb-summary-key' }, label),
        h('div', { className: 'mb-summary-value' }, value))
    }

    // ---------------------------------------------------------------------
    // Per-turn cost chip
    // ---------------------------------------------------------------------

    function turnModelText(models, translate, showProvider, catalogModels) {
      const findModel = (entry) => {
        if (entry.provider === undefined || entry.model === undefined) return undefined
        return (catalogModels ?? []).find((candidate) => candidate.provider === entry.provider && candidate.model === entry.model)
      }
      const names = (models ?? []).map((entry) => {
        if (entry === undefined || entry === null) return null
        const matched = findModel(entry)
        const modelName = typeof matched?.name === 'string' && matched.name !== ''
          ? matched.name
          : typeof entry.name === 'string' && entry.name !== ''
            ? entry.name
            : typeof entry.model === 'string' && entry.model !== '' ? entry.model : null
        if (modelName === null) return null
        if (!showProvider) return modelName
        const providerName = typeof matched?.providerName === 'string' && matched.providerName !== ''
          ? matched.providerName
          : typeof entry.providerName === 'string' && entry.providerName !== ''
            ? entry.providerName
            : typeof entry.provider === 'string' && entry.provider !== '' ? entry.provider : null
        return providerName === null ? modelName : `${providerName} / ${modelName}`
      }).filter((name) => name !== null)
      if (names.length === 0) return null
      return names.join(translate('listSep'))
    }

    function TurnCost(props) {
      const { turn } = props
      // The turnTail owner hands over the whole folded turn life cycle, not just its number.
      const turnNumber = turn === null || turn === undefined
        ? undefined
        : typeof turn === 'number' ? turn : turn.turn
      const sessionId = props.sessionId
      const useProjection = props.useProjection
      const translate = useT()
      const catalogSnap = useCatalog()
      const display = readDisplay(catalogSnap.data)
      const tokenUsage = typeof useProjection === 'function' ? useProjection('tokenUsage') : undefined
      const revision = tokenUsageRevision(tokenUsage)
      const usage = useSessionUsage(sessionId, revision)
      const rows = usage.data?.turns
      const row = rows?.find((entry) => entry.turn === turnNumber)
      if (row === undefined) return null
      const costText = row.costKnown
        ? `≈ ${formatMoney(row.cost)}`
        : row.pricedAttempts > 0 ? `≈ ${formatMoney(row.cost)}*` : translate('pricePlaceholder')
      const modelText = turnModelText(row.models, translate, display.showProvider === true, catalogSnap.data?.models)
      const label = (key) => display.showLabels ? `${translate(key)} ` : ''
      const parts = []
      if (display.showModels && modelText !== null) {
        parts.push(h('span', { className: 'mb-turn-item', key: 'model' },
          label('model'), h('strong', null, modelText)))
      }
      if (display.showCost) {
        parts.push(h('span', { className: 'mb-turn-item', key: 'cost' },
          label('turnCost'), h('strong', null, costText)))
      }
      const promptTokens = Number.isFinite(row.promptTokens) ? row.promptTokens : 0
      const outputTokens = Number.isFinite(row.outputTokens) ? row.outputTokens : 0
      if (display.showTokens && (promptTokens > 0 || outputTokens > 0)) {
        parts.push(h('span', { className: 'mb-turn-item', key: 'tokens' },
          label('turnTokens'), h('strong', null, `${formatTokens(promptTokens)} / ${formatTokens(outputTokens)}`)))
      }
      if (display.showCacheHit && row.cacheHit !== null && row.cacheHit !== undefined) {
        parts.push(h('span', { className: 'mb-turn-item', key: 'cache' },
          label('cacheHit'), h('strong', null, formatPercent(row.cacheHit))))
      }
      if (row.partial) {
        parts.push(h('span', { className: 'mb-turn-item mb-turn-partial', key: 'partial' }, translate('partialShort')))
      }
      if (parts.length === 0) return null
      return h('span', {
        className: 'mb-turn',
        'data-size': display.fontSize,
        'data-density': display.density,
        'data-weight': display.fontWeight,
      }, parts)
    }

    // ---------------------------------------------------------------------
    // Custom-ordered model picker in the composer seat
    // ---------------------------------------------------------------------

    const MODEL_KEY_SEPARATOR = '\u0000'

    function OrderedModelPicker({ locked, sessionId, useProjection }) {
      const translate = useT()
      const catalogSnap = useCatalog()
      const selectionProjection = useProjection('modelSelection')
      const directoryRevision = useModelDirectoriesRevision()
      const [directoryTick, setDirectoryTick] = useState(0)
      const directory = useMemo(() => {
        if (modelDirectories === undefined || sessionId === undefined) return null
        try {
          return modelDirectories.directoryFor(sessionId)
        } catch {
          return null
        }
      }, [sessionId, directoryRevision, directoryTick])

      const [state, setState] = useState(null)
      const [open, setOpen] = useState(false)
      const [query, setQuery] = useState('')
      const [selecting, setSelecting] = useState(false)
      const [failure, setFailure] = useState(null)
      const [menuPos, setMenuPos] = useState(null)
      const rootRef = useRef(null)
      const triggerRef = useRef(null)
      const menuRef = useRef(null)
      const searchRef = useRef(null)
      const id = useId()

      useEffect(() => {
        if (directory === null) {
          setState(null)
          return undefined
        }
        const sync = () => setState(directory.store.getSnapshot())
        sync()
        const unsubscribe = directory.store.subscribe(sync)
        directory.load().catch(() => {})
        return unsubscribe
      }, [directory])

      useEffect(() => {
        if (directory !== null || directoryTick >= 20) return undefined
        const timer = setTimeout(() => setDirectoryTick((value) => value + 1), 300)
        return () => clearTimeout(timer)
      }, [directory, directoryTick])

      useEffect(() => {
        if (!open) return undefined
        const closeOutside = (event) => {
          if (rootRef.current?.contains(event.target) === true) return
          if (menuRef.current?.contains(event.target) === true) return
          setOpen(false)
        }
        document.addEventListener('mousedown', closeOutside)
        return () => document.removeEventListener('mousedown', closeOutside)
      }, [open])

      useEffect(() => {
        if (!open) {
          setQuery('')
          return undefined
        }
        const closeOnEscape = (event) => {
          if (event.key !== 'Escape') return
          event.preventDefault()
          setOpen(false)
          queueMicrotask(() => triggerRef.current?.focus())
        }
        document.addEventListener('keydown', closeOnEscape)
        return () => document.removeEventListener('keydown', closeOnEscape)
      }, [open])

      useEffect(() => {
        if (locked && open) setOpen(false)
      }, [locked, open])

      const rank = useMemo(() => {
        const map = new Map()
        for (const model of catalogSnap.data?.models ?? []) {
          map.set(`${model.provider}${MODEL_KEY_SEPARATOR}${model.model}`, model.order)
        }
        return map
      }, [catalogSnap.data])

      const priceByKey = useMemo(() => {
        const map = new Map()
        for (const model of catalogSnap.data?.models ?? []) {
          map.set(`${model.provider}${MODEL_KEY_SEPARATOR}${model.model}`, model.pricing)
        }
        return map
      }, [catalogSnap.data])

      const groups = state?.groups
      const catalogModels = catalogSnap.data?.models
      const entries = useMemo(() => {
        if (Array.isArray(groups) && groups.length > 0) {
          const list = []
          for (const [groupIndex, group] of groups.entries()) {
            for (const [modelIndex, model] of group.models.entries()) {
              list.push({ group, model, groupIndex, modelIndex })
            }
          }
          list.sort((left, right) => {
            const leftRank = rank.get(`${left.group.id}${MODEL_KEY_SEPARATOR}${left.model.id}`) ?? Number.MAX_SAFE_INTEGER
            const rightRank = rank.get(`${right.group.id}${MODEL_KEY_SEPARATOR}${right.model.id}`) ?? Number.MAX_SAFE_INTEGER
            return leftRank - rightRank || left.groupIndex - right.groupIndex || left.modelIndex - right.modelIndex
          })
          return list
        }
        return (catalogModels ?? []).map((model, index) => ({
          group: { id: model.provider, name: model.providerName },
          model: {
            id: model.model,
            name: model.name,
            ...(model.reasoning === undefined ? {} : { reasoning: model.reasoning }),
          },
          groupIndex: model.order ?? index,
          modelIndex: index,
        }))
      }, [groups, catalogModels, rank])

      const projected = selectionProjection?.next ?? selectionProjection?.lastUsed ?? null
      const current = state?.current ?? projected
      const currentEntry = current === null
        ? undefined
        : entries.find((entry) => entry.group.id === current.provider && entry.model.id === current.model)
      const currentCatalog = current === null
        ? undefined
        : (catalogModels ?? []).find((model) => model.provider === current.provider && model.model === current.model)
      const currentReasoning = currentEntry?.model.reasoning
      const effectiveEffort = current?.reasoningEffort ?? currentReasoning?.defaultEffort
      const effortLabel = current === null
        ? undefined
        : currentReasoning === undefined
          ? state?.retainedEffort
          : effectiveEffort === undefined
            ? translate('providerDefault')
            : currentReasoning.efforts.find((effort) => effort.id === effectiveEffort)?.name ?? effectiveEffort
      const effortChoices = currentReasoning === undefined
        ? []
        : [
          ...(currentReasoning.defaultEffort === undefined
            ? [{ key: 'provider-default', effort: undefined, label: translate('providerDefault') }]
            : []),
          ...currentReasoning.efforts.map((effort) => ({
            key: `effort:${effort.id}`,
            effort: effort.id,
            label: effort.name,
          })),
        ]

      const showSearch = entries.length > 4
      const term = query.trim().toLowerCase()
      const filtered = useMemo(() => {
        if (term === '') return entries
        return entries.filter((entry) => `${entry.model.name} ${entry.group.name}`.toLowerCase().includes(term))
      }, [entries, term])

      useLayoutEffect(() => {
        if (!open) {
          setMenuPos(null)
          return undefined
        }
        const place = () => {
          const rect = triggerRef.current?.getBoundingClientRect()
          if (rect === undefined) return
          const width = Math.min(360, window.innerWidth - 24)
          const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
          const spaceAbove = rect.top - 12
          const spaceBelow = window.innerHeight - rect.bottom - 12
          const openBelow = spaceBelow > spaceAbove
          const maxHeight = Math.min(480, Math.max(160, openBelow ? spaceBelow : spaceAbove))
          setMenuPos(openBelow
            ? { left, top: rect.bottom + 8, width, maxHeight }
            : { left, bottom: window.innerHeight - rect.top + 8, width, maxHeight })
        }
        place()
        window.addEventListener('scroll', place, true)
        window.addEventListener('resize', place)
        return () => {
          window.removeEventListener('scroll', place, true)
          window.removeEventListener('resize', place)
        }
      }, [open, filtered.length, state?.status])

      useEffect(() => {
        if (!open) return undefined
        const timer = setTimeout(() => {
          if (showSearch) {
            searchRef.current?.focus()
            return
          }
          const first = menuRef.current?.querySelector('.mb-picker-row:not(:disabled)')
          if (first instanceof HTMLElement) first.focus()
        }, 0)
        return () => clearTimeout(timer)
      }, [open, showSearch])

      const loading = catalogSnap.data === null && (state === null || state.status === 'loading')
      const busy = selecting || state?.status === 'selecting'
      const currentName = currentEntry?.model.name ?? currentCatalog?.name
      const triggerModel = currentName ?? (loading ? translate('loadingModels') : translate('chooseModel'))
      const triggerAria = effortLabel === undefined ? triggerModel : `${triggerModel} · ${effortLabel}`

      const close = (restoreFocus) => {
        setOpen(false)
        setQuery('')
        setFailure(null)
        if (restoreFocus) queueMicrotask(() => triggerRef.current?.focus())
      }

      const submit = async (selection) => {
        if (busy) return
        setSelecting(true)
        setFailure(null)
        try {
          const result = directory !== null
            ? await directory.select(selection)
            : await requestJson('/model-billing/select', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ sessionId, ...selection }),
            })
          if (result?.ok === false) {
            setFailure(result.error?.message ?? translate('pickerEmpty'))
            return
          }
          close(true)
        } catch (error) {
          setFailure(error instanceof Error ? error.message : String(error))
        } finally {
          setSelecting(false)
        }
      }

      const chooseModel = (entry) => {
        if (current?.provider === entry.group.id && current?.model === entry.model.id) {
          close(true)
          return
        }
        void submit({ provider: entry.group.id, model: entry.model.id })
      }

      const chooseEffort = (effort) => {
        if (current === null) return
        if (effectiveEffort === effort) {
          close(true)
          return
        }
        void submit({
          provider: current.provider,
          model: current.model,
          ...effort === undefined ? {} : { reasoningEffort: effort },
        })
      }

      const toggle = () => {
        if (open) {
          close(true)
          return
        }
        setFailure(null)
        setOpen(true)
        if (directory !== null) directory.load().catch(() => {})
      }

      const menuStyle = menuPos === null
        ? { left: 0, top: 0, width: 360, visibility: 'hidden' }
        : {
          left: menuPos.left,
          width: menuPos.width,
          maxHeight: menuPos.maxHeight,
          ...menuPos.top === undefined ? { bottom: menuPos.bottom } : { top: menuPos.top },
        }
      const errorText = failure ?? (state?.status === 'error' ? state.error : null)

      const menu = h('div', {
        ref: menuRef,
        id: `${id}-menu`,
        className: 'mb-picker-menu',
        style: menuStyle,
        role: 'dialog',
        'aria-label': translate('pickerAria'),
      },
        showSearch ? h('input', {
          ref: searchRef,
          className: 'mb-picker-search',
          type: 'search',
          value: query,
          placeholder: translate('searchModel'),
          'aria-label': translate('searchModel'),
          onChange: (event) => setQuery(event.target.value),
          onKeyDown: (event) => {
            if (event.key !== 'Enter' || filtered.length === 0 || busy) return
            event.preventDefault()
            chooseModel(filtered[0])
          },
        }) : null,
        h('div', { className: 'mb-picker-list', role: 'menu' },
          filtered.length === 0
            ? h('div', { className: 'mb-picker-empty' }, term === '' ? translate('pickerEmpty') : translate('noMatch'))
            : filtered.map((entry, index) => {
              const selected = current?.provider === entry.group.id && current?.model === entry.model.id
              const previous = filtered[index - 1]
              const showGroup = previous === undefined || previous.group.id !== entry.group.id
              const price = priceByKey.get(`${entry.group.id}${MODEL_KEY_SEPARATOR}${entry.model.id}`)
              return h(Fragment, { key: `${entry.group.id}${MODEL_KEY_SEPARATOR}${entry.model.id}` },
                showGroup ? h('div', { className: 'mb-picker-group' }, entry.group.name) : null,
                h('button', {
                  type: 'button',
                  role: 'menuitemradio',
                  className: 'mb-picker-row',
                  'aria-checked': selected ? 'true' : 'false',
                  title: entry.model.name,
                  disabled: busy,
                  onClick: () => chooseModel(entry),
                },
                  h('span', { className: 'mb-picker-option-copy' },
                    h('span', { className: 'mb-picker-model' }, entry.model.name),
                    h(PriceLines, { pricing: price, translate })),
                  h('span', { className: 'mb-picker-check' },
                    selected
                      ? h('svg', {
                        viewBox: '0 0 16 16',
                        width: 14,
                        height: 14,
                        fill: 'none',
                        stroke: 'currentColor',
                        strokeWidth: 1.7,
                        'aria-hidden': true,
                      },
                        h('path', { d: 'M3.5 8.5l3 3 6-7' }))
                      : null)))
            })),
        effortChoices.length === 0 ? null : h(Fragment, null,
          h('div', { className: 'mb-picker-divider' }),
          h('div', { className: 'mb-picker-efforts' },
            h('span', { className: 'mb-picker-efforts-label' }, translate('reasoningEffort')),
            effortChoices.map((choice) => h('button', {
              type: 'button',
              key: choice.key,
              className: 'mb-picker-chip',
              'aria-pressed': effectiveEffort === choice.effort ? 'true' : 'false',
              disabled: busy,
              onClick: () => chooseEffort(choice.effort),
            }, choice.label)))),
        busy ? h('div', { className: 'mb-picker-status' }, translate('switching')) : null,
        errorText === null ? null : h('div', { className: 'mb-picker-error' }, errorText),
        state?.status === 'error'
          ? h('button', {
            type: 'button',
            className: 'mb-btn mb-picker-retry',
            onClick: () => {
              setFailure(null)
              directory.load().catch(() => {})
            },
          }, translate('pickerRetry'))
          : null)

      return h('div', {
        className: 'mb-picker',
        ref: rootRef,
      },
        h(Style),
        h('button', {
          ref: triggerRef,
          type: 'button',
          className: 'mb-picker-trigger',
          disabled: locked,
          'aria-label': triggerAria,
          'aria-haspopup': 'menu',
          'aria-controls': open ? `${id}-menu` : undefined,
          'aria-expanded': open ? 'true' : 'false',
          'aria-busy': busy ? 'true' : undefined,
          title: triggerAria,
          onClick: toggle,
        },
          h('svg', {
            viewBox: '0 0 16 16',
            width: 14,
            height: 14,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.3,
            'aria-hidden': true,
            className: 'mb-picker-icon',
          },
            h('rect', { x: 2, y: 3, width: 12, height: 10, rx: 2 }),
            h('path', { d: 'M2 6.5h12M6 6.5V13' })),
          h('span', { className: 'mb-picker-name' }, triggerModel),
          effortLabel === undefined ? null : h('span', { className: 'mb-picker-trigger-effort' }, effortLabel),
          h('svg', {
            className: open ? 'mb-picker-chevron mb-picker-chevron-open' : 'mb-picker-chevron',
            viewBox: '0 0 16 16',
            width: 14,
            height: 14,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.5,
            'aria-hidden': true,
          },
            h('path', { d: 'M4 6l4 4 4-4' }))),
        open ? ReactDOM.createPortal(menu, document.body) : null)
    }

    function ModelPickerSeat(props) {
      const catalogSnap = useCatalog()
      const display = readDisplay(catalogSnap.data)
      if (!display.takeoverPicker) return null
      return h(OrderedModelPicker, props)
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        localeService = ctx.get('locale')
        publishModelDirectories(ctx.get('modelDirectories'))
        ctx.inject(['modelDirectories'], (scope) => {
          publishModelDirectories(scope.modelDirectories)
          let seat = null
          const takeoverEnabled = () => readDisplay(catalog.snap.data).takeoverPicker !== false
          const syncSeat = () => {
            if (takeoverEnabled()) {
              if (seat === null) {
                seat = scope.slots.register({
                  name: 'conversation.input.model',
                  priority: -1,
                }, ModelPickerSeat)
              }
              return
            }
            if (seat !== null) {
              seat()
              seat = null
            }
          }
          scope.slots.inject('conversation.input.model', () => {
            const unsubscribe = subscribeCatalog(syncSeat)
            syncSeat()
            return () => {
              unsubscribe()
              if (seat !== null) {
                seat()
                seat = null
              }
            }
          })
        })

        void ensureCatalog()

        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'model-billing',
          order: 12,
          label: () => t('nav'),
        }, SettingsSection))

        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'model-billing-cost',
          order: 2,
        }, CostDock))

        ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
          name: 'conversation.chat.turnTail',
          id: 'model-billing-turn',
          order: 30,
        }, TurnCost))
      },
    }
  },
})
