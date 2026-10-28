# Changelog

## [0.2.0] - 2026-10-28

### Added

- Historical price book under Settings → Models & Cost: add, edit, or remove three-price entries for models that are no longer in the configured list. Removing a model keeps its price, so past turns keep their cost and fall back to the raw model id when no display name exists.
- Price-source labels and one-click restore: a complete custom price overrides the built-in DeepSeek table and is marked “Custom”; the official peak/off-peak table can be restored without another request.
- Unpriced-route list in the cost panel, plus a switch to hide unpriced notices.
- Separate settings sections for the turn tail and the composer cost estimate, each with a larger master switch and indented sub-switches. The composer summary now has its own `showDock` switch and the turn tail has `showTurnTail`.
- LAN and reverse-proxy access: besides loopback, a request is trusted when its Host header matches the address the socket actually listens on. A forged Host is still rejected.
- Keyboard access: the cost panel is a modal dialog that takes focus on open; the picker supports ↑/↓/Home/End with a roving tabindex.
- Regression tests for pricing consistency, arrival-time peak/off-peak, catalog and usage caches, concurrent saves, 413 preservation, archive pricing, historical billing after model removal, and trusted authorities.

### Changed

- Peak/off-peak is now chosen from the `request/header` arrival time instead of the completion time.
- A `totalTokens` that disagrees with the three usage buckets keeps the buckets and marks the attempt partial instead of dropping it.
- Catalog and usage reads are cached; catalog caching can be bypassed with `?refresh=1`.
- The composer summary and detail panel are labelled “Composer cost estimate” (输入框下方费用估算), avoiding the “费用明细” name used by another plugin.
- Cost figures no longer carry a trailing asterisk; partial state is shown by the notice instead.
- Historical price rows use a two-row layout so provider, model, and all three prices stay readable; the remove button reads “删除”.
- Requires DSH `^0.2.1-rc.3`.

### Fixed

- Saves that arrive together are serialized so one cannot overwrite the other; oversized bodies keep their 413 status on both `/save` and `/select`.
- Stale temporary state files are removed on load; state written by a newer plugin version is read-only instead of being overwritten.
- The picker no longer takes over when the catalog is unavailable, so the built-in picker remains usable.
- Display settings have a single source of truth in Host state; legacy localStorage values are cleared once.
- Turn-tail and detail-panel amounts share one formatter, and the settings save button is present even with no models configured.

## [0.1.2] - 2026-10-22

### Added

- Turn-tail display settings under Settings → Models & Cost: choose models, model provider, cost, tokens, cache-hit rate, and text labels; adjust font size, spacing, and weight.
- A switch to let another picker take over the composer model selector; turning it off restores the built-in DSH picker.
- Declared the supported DSH host range in `peerDependencies` so dsh-market can show host compatibility.

### Changed

- Turn-tail values now use the same secondary text color as the surrounding chat metadata instead of bright white.
- Turn-tail fields are separated by spacing rather than middle dots, and the hover explanation has been removed.
- The model column in the cost details panel is wide enough to show `DeepSeek-V4.1-Flash` without truncation.

## [0.1.1] - 2026-10-21

### Added

- Show the model or models used by each turn at the end of that turn, next to the per-turn cost.

## [0.1.0] - 2026-10-20

### Added

- Custom ordering for configured models in the composer model picker.
- Three editable per-million-token prices per model: cache-hit input, cache-miss input, and output.
- Built-in official DeepSeek peak/off-peak prices for `deepseek-flash` and `deepseek-v4-pro`, selected from each usage event's Beijing time.
- Per-turn and session cost estimates with a composer summary, turn-tail amount, and a detail panel grouped by turn and model.
- Local persistence at `~/.dsh/model-billing.json` with atomic writes.
