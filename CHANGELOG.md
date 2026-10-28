# Changelog

## [0.2.0] - 2026-10-28

### 新增

- 设置 → 模型与费用新增历史价格簿：可为已不在当前配置列表中的模型新增、编辑或删除三档价格。移除模型时会保留其价格，因此历史轮次仍能计算费用；没有显示名时回退显示原始模型 id。
- 价格来源标识与一键恢复：完整的自定义价格会覆盖 DeepSeek 内置价格表并标记为“自定义”；无需再次请求即可恢复官方峰谷价表。
- 费用面板新增未定价路由列表，并提供隐藏未定价提示的开关。
- 轮尾与输入框下方费用估算拆分为独立设置区，各自拥有总开关。
- 局域网与反向代理访问：除回环地址外，当请求的 Host 头与套接字实际监听地址一致时也信任该请求；伪造的 Host 仍会被拒绝。
- 键盘访问：费用面板为模态对话框，打开时获取焦点；模型选择器支持 ↑/↓/Home/End 与 roving tabindex。
- 新增回归测试：计价一致性、按到达时间判断峰谷、catalog 与 usage 缓存、并发保存、413 状态保留、历史价格簿、移除模型后的历史计费、可信地址校验。

### 变更

- 峰谷档位改为按 `request/header` 的到达时间判断，而不是完成时间。
- `totalTokens` 与三档用量不一致时，保留三档并将该次调用标记为 partial，而不是整条丢弃。
- catalog 与 usage 读取增加缓存；catalog 缓存可用 `?refresh=1` 绕过。
- 宿主要求为 DSH `^0.2.1-rc.3`。

### 修复

- 并发到达的保存会串行执行，避免互相覆盖；超大请求体在 `/save` 与 `/select` 上均保留 413 状态。
- 加载时清理残留的临时状态文件；由更高版本插件写入的状态改为只读，不再被覆盖。
- catalog 不可用时选择器不再接管，内置选择器保持可用。
- 显示设置以 Host 状态为唯一来源；旧版 localStorage 值会清理一次。
- 即使没有配置模型，设置页也保留保存按钮。

### Added

- Historical price book under Settings → Models & Cost: add, edit, or remove three-price entries for models that are no longer in the configured list. Removing a model keeps its price, so past turns keep their cost and fall back to the raw model id when no display name exists.
- Price-source labels and one-click restore: a complete custom price overrides the built-in DeepSeek table and is marked “Custom”; the official peak/off-peak table can be restored without another request.
- Unpriced-route list in the cost panel, plus a switch to hide unpriced notices.
- Separate settings sections for the turn tail and the composer cost estimate, each with its own master switch.
- LAN and reverse-proxy access: besides loopback, a request is trusted when its Host header matches the address the socket actually listens on. A forged Host is still rejected.
- Keyboard access: the cost panel is a modal dialog that takes focus on open; the picker supports ↑/↓/Home/End with a roving tabindex.
- Regression tests for pricing consistency, arrival-time peak/off-peak, catalog and usage caches, concurrent saves, 413 preservation, archive pricing, historical billing after model removal, and trusted authorities.

### Changed

- Peak/off-peak is now chosen from the `request/header` arrival time instead of the completion time.
- A `totalTokens` that disagrees with the three usage buckets keeps the buckets and marks the attempt partial instead of dropping it.
- Catalog and usage reads are cached; catalog caching can be bypassed with `?refresh=1`.
- Requires DSH `^0.2.1-rc.3`.

### Fixed

- Saves that arrive together are serialized so one cannot overwrite the other; oversized bodies keep their 413 status on both `/save` and `/select`.
- Stale temporary state files are removed on load; state written by a newer plugin version is read-only instead of being overwritten.
- The picker no longer takes over when the catalog is unavailable, so the built-in picker remains usable.
- Display settings have a single source of truth in Host state; legacy localStorage values are cleared once.
- The settings save button is present even with no models configured.

## [0.1.2] - 2026-10-22

### 新增

- 设置 → 模型与费用新增轮尾显示设置：可选择模型、模型提供商、费用、token、缓存命中率与文字标签，并可调整字号、间距与字重。
- 新增“让其他选择器接管输入框模型选择器”开关；关闭后恢复 DSH 内置选择器。
- 在 `peerDependencies` 中声明支持的 DSH 宿主范围，便于 dsh-market 展示宿主兼容性。

### 变更

- 轮尾数值改用与周围聊天元数据一致的次级文字颜色，不再是亮白色。
- 轮尾字段改用间距分隔，不再使用中点；移除悬停说明。
- 费用详情面板的模型列加宽，可完整显示 `DeepSeek-V4.1-Flash`。

### Added

- Turn-tail display settings under Settings → Models & Cost: choose models, model provider, cost, tokens, cache-hit rate, and text labels; adjust font size, spacing, and weight.
- A switch to let another picker take over the composer model selector; turning it off restores the built-in DSH picker.
- Declared the supported DSH host range in `peerDependencies` so dsh-market can show host compatibility.

### Changed

- Turn-tail values now use the same secondary text color as the surrounding chat metadata instead of bright white.
- Turn-tail fields are separated by spacing rather than middle dots, and the hover explanation has been removed.
- The model column in the cost details panel is wide enough to show `DeepSeek-V4.1-Flash` without truncation.

## [0.1.1] - 2026-10-21

### 新增

- 在每轮末尾、本轮费用旁显示该轮使用的模型。

### Added

- Show the model or models used by each turn at the end of that turn, next to the per-turn cost.

## [0.1.0] - 2026-10-20

### 新增

- 输入框模型选择器支持自定义已配置模型的顺序。
- 每个模型可编辑三档每百万 token 价格：缓存命中输入、缓存未命中输入、输出。
- 为 `deepseek-flash` 与 `deepseek-v4-pro` 内置 DeepSeek 官方峰谷价，按每次用量事件的北京时间选择档位。
- 提供逐轮与会话费用估算：输入框下方摘要、轮尾金额，以及按轮次和模型分组的详情面板。
- 状态本地持久化到 `~/.dsh/model-billing.json`，使用原子写入。

### Added

- Custom ordering for configured models in the composer model picker.
- Three editable per-million-token prices per model: cache-hit input, cache-miss input, and output.
- Built-in official DeepSeek peak/off-peak prices for `deepseek-flash` and `deepseek-v4-pro`, selected from each usage event's Beijing time.
- Per-turn and session cost estimates with a composer summary, turn-tail amount, and a detail panel grouped by turn and model.
- Local persistence at `~/.dsh/model-billing.json` with atomic writes.
