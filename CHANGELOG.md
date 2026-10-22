# Changelog

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
