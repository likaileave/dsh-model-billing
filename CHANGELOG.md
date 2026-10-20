# Changelog

## [0.1.0] - 2026-10-20

### Added

- Custom ordering for configured models in the composer model picker.
- Three editable per-million-token prices per model: cache-hit input, cache-miss input, and output.
- Built-in official DeepSeek peak/off-peak prices for `deepseek-flash` and `deepseek-v4-pro`, selected from each usage event's Beijing time.
- Per-turn and session cost estimates with a composer summary, turn-tail amount, and a detail panel grouped by turn and model.
- Local persistence at `~/.dsh/model-billing.json` with atomic writes.
