<p align="center">
  <img src="https://unpkg.com/dsh-model-billing@latest/icon.svg" width="72" height="72" alt="dsh-model-billing icon">
</p>

<h1 align="center">dsh-model-billing</h1>

<p align="center">为 DeepSeek Harness Web GUI 调整模型顺序，并按轮次估算模型费用。</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-model-billing"><img alt="npm version" src="https://img.shields.io/npm/v/dsh-model-billing.svg"></a>
  <a href="https://github.com/likaileave/dsh-model-billing/releases"><img alt="GitHub release" src="https://img.shields.io/github/v/release/likaileave/dsh-model-billing"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/github/license/likaileave/dsh-model-billing"></a>
  <a href="https://github.com/topics/dsh-plugin"><img alt="DeepSeek Harness plugin" src="https://img.shields.io/badge/DeepSeek%20Harness-dsh--plugin-4D6BFE"></a>
  <a href="https://awesome-dsh-plugin.com"><img alt="Awesome DSH Plugin" src="https://awesome-dsh-plugin.com/badge.svg"></a>
</p>

<p align="center">
  <a href="#中文">中文</a> · <a href="#english">English</a> · <a href="CHANGELOG.md">Changelog</a>
</p>

> **AI 生成声明**：本项目的代码、文档和图标由 AI 辅助生成，并经人工审核、修改和测试；发布者对最终发布内容负责。
>
> **AI-generated notice**: The code, documentation, and icon in this project were generated with AI assistance, then reviewed, modified, and tested by a human; the publisher is responsible for the released content.

## 中文

`dsh-model-billing` 是一个 DSH Web 客户端插件。它可以接管输入框右下角的模型选择器，让你按自己的顺序排列模型，并为每个模型维护三档 token 价格；会话过程中按实际 usage 估算每一轮和整个会话的费用。

### 功能

- **自定义模型顺序**：在“设置 → 模型与费用”中排列已配置模型。每行左侧的位次是输入框，填入目标位次后按回车或离开输入框即移动；「插入方式」决定排在该位次还是该位次之后，与模型原来在第几位无关，↑ / ↓ 仍可微调。模型选择器按这个顺序展示，跨提供方也保持你排的顺序，并用提供方名称分组。
- **隐藏模型**：每个模型行有隐藏开关。隐藏后该模型不再出现在模型选择器中，价格与费用估算照旧；正在使用的模型仍会保留在选择器里。隐藏不会删除配置。
- **设置自动保存**：改动停止约 0.7 秒后自动提交，页首标注会自动保存，不再有手动保存与撤销按钮。
- **三档 token 价格**：每个模型可填写每百万 tokens 的缓存命中输入、缓存未命中输入、输出价格。`0` 是有效价格，留空表示未设置。
- **DeepSeek 官方价内置**：`deepseek-flash`（含 `deepseek-v4-flash`、`deepseek-v4-flash-vision-exp` 等同价别名）和 `deepseek-v4-pro` 默认使用 DeepSeek 官网的峰谷价，并在设置页标明“官方价”；填入完整的三档自定义价即可覆盖官方价，标为“自定义”。
- **逐轮费用与使用模型**：每轮结束后在轮尾显示这一轮使用的模型，以及该轮费用和缓存命中率。
- **可配置轮尾**：在设置中总开关轮尾显示，并可分别开关使用模型、模型提供商、费用、token、缓存命中率、文字标签，调整字号、间距和字重；也可以关闭选择器接管，恢复 DSH 内置模型选择器。输入框下方的费用估算另有独立开关。
- **选择器里的团队协作开关**：接管选择器时，推理强度下方保留 DSH 的「启用智能体团队协作」开关，行为与内置开关一致（子代理会话隐藏、关闭前弹同一份警告确认、失败提示同文），旁边的 ⓘ 显示原生说明。
- **本会话费用**：输入框下方显示本会话累计估算、最近一轮费用和缓存命中率；展开后可查看按轮次和按模型的明细。模型在回合内自行联网搜索的次数单独列出——DeepSeek 把它并入上下文按 token 计费，日志里没有该辅助请求的用量，所以只计次数、不计金额。
- **DeepSeek Search/Fetch 按次费**：只对 DeepSeek 独立的 Search / Fetch API（`deepseek-search-api` / `deepseek-fetch-api`）按官方 ¥5 / 1,000 次成功请求计入合计，并在费用明细里单独列出搜索、抓取的计费次数。模型回合内的联网搜索（`deepseek-official`）自 2026-11-18 12:00 北京时间起不再单独收费，结果并入上下文按 token 计费，因此这里不重复收。
- **历史价格与未定价路由**：设置页的“历史价格”区可以为已移出配置的模型补价、改价或删除，不必把模型加回列表；从模型列表删除模型不会删除它的价格，历史调用仍按保存的价格计算，查不到名称时显示原始模型 id。缺价时显示统一提示，可在设置里关闭这条提示。“全部清空”可一次删掉整本历史价格，删掉的行刷新后不会回弹。
- **DeepSeek 也计入金额**：每条 usage 按事件发生时的北京时间自动选择高峰或空闲价，与第三方模型一起进入统计。

### 估算口径

```text
缓存命中输入 × 命中价
+（未缓存输入 + 缓存写入）× 未命中价
+ 输出 × 输出价
+ DeepSeek Search/Fetch 成功请求次数 × 单次价（只算独立的 Search/Fetch API；模型回合内的联网搜索按 token 计）
```

价格单位是“元 / 百万 tokens”；Search/Fetch 按次计费，单次价为 ¥0.005（¥5 / 1,000 次成功请求）。缓存写入按缓存未命中价计算，这是三档价格模型下的近似处理。金额来自会话日志中的 provider usage 与工具结果，实际账单以 provider 为准。

### DeepSeek 官方价

以下价格内置在 [`host.js`](host.js) 的 `DEEPSEEK_PRICES` 中，单位“元 / 百万 tokens”。来源：[DeepSeek 模型 & 价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)（查询于 2026-10-19）。

| 模型 | 时段 | 缓存命中 | 缓存未命中 | 输出 |
|---|---|---:|---:|---:|
| deepseek-flash | 高峰 | 0.04 | 2 | 8 |
| deepseek-flash | 空闲 | 0.02 | 1 | 4 |
| deepseek-v4-pro | 高峰 | 0.30 | 9 | 27 |
| deepseek-v4-pro | 空闲 | 0.15 | 4.5 | 13.5 |

`deepseek-v4-flash` 和 `deepseek-v4-flash-vision-exp` 与 `deepseek-flash` 同价，表里不再重复列出。

高峰时段为北京时间周一至周五 `9:00–12:00`、`14:00–18:00`（中国法定节假日除外）；其余时间、周末和法定节假日全天为空闲时段。空闲价是高峰价的一半。

DeepSeek 价格默认只读展示；如需按其他渠道或折扣价计费，可在设置页点“自定义价格”填入完整三档价格，保存后以自定义价为准并标为“自定义”；三项清空后保存即可恢复官方价。官网调价或节假日安排变化后，需要更新 `host.js` 中的 `DEEPSEEK_PRICES` 和 `DEEPSEEK_HOLIDAYS`；目前内置的是 2026–2027 年节假日。

### 其他模型价格

插件**不预置**第三方模型价格。首次使用时，在“设置 → 模型与费用”中按 provider 的官方价填写三档价格即可；未填完整价格的模型不会产生金额，界面会标记“未定价”或“部分未定价”。

不同平台的缓存折扣、上下文阶梯价和活动价差异较大，建议直接使用你的实际结算价。插件不做自动抓取，也不猜测默认价。

### 安装

需要 DSH `^0.2.1-rc.3`。

**npm**

```sh
dsh plugin --profile desktop add dsh-model-billing
```

**从 dsh-market 安装**

在 dsh-market 中搜索 `dsh-model-billing` 安装。

**从 GitHub Release 手动安装**

1. 从 [Releases](https://github.com/likaileave/dsh-model-billing/releases) 下载 `dsh-model-billing.tgz`。
2. 执行：

```sh
dsh plugin --profile desktop add ./dsh-model-billing.tgz
```

把 `desktop` 换成你实际使用的 profile。

**从源码安装**

```sh
git clone https://github.com/likaileave/dsh-model-billing.git
dsh plugin --profile desktop add ./dsh-model-billing
```

安装或更新后**重启 DSH**（桌面版没有刷新或重载命令，插件代码只在页面启动时从磁盘读取）。设置页位于“模型与费用”。

### 发布

npm 包和 GitHub Release 使用相同版本号，两个渠道分别发布：

- npm：<https://www.npmjs.com/package/dsh-model-billing>
- GitHub Releases：<https://github.com/likaileave/dsh-model-billing/releases>

两个渠道是并列的发布渠道，不承诺自动同步。

### 数据位置

模型顺序和价格保存在：

```text
~/.dsh/model-billing.json
```

若设置了 `DSH_HOME`，则为 `$DSH_HOME/model-billing.json`。保存时先写临时文件再原子替换；文件损坏时回退为空配置，不会在未保存的情况下覆盖原文件。

### 已知限制

- DeepSeek 官方峰谷价只对 `deepseek` 开头的官方 provider（如 `deepseek-account`）且模型名在官方价表内时生效；`openrouter`、`my-deepseek-relay` 这类第三方即使模型名含 `deepseek` 也按普通规则计费，可自行填价。
- 显示设置（轮尾开关、字号、间距、是否接管选择器等）只保存在 Host 的 `model-billing.json` 里，不再镜像到浏览器 localStorage，因此换设备或换浏览器不会不同步；旧版本写入的 localStorage 键会被自动清除。
- 除本机回环地址（`127.0.0.1` / `localhost` / `[::1]`）外，Host 头与该连接实际监听的地址（`socket.localAddress` + `localPort`）一致时也会放行，因此 `--host 0.0.0.0` 后用局域网 IP 访问可用；反向代理若改写了 Host，需要让它保留原 Host 或与实际监听地址一致，否则四个路由返回 403，此时模型选择器回退为 DSH 内置版本（费用与排序功能不可用），不会影响正常聊天。
- 模型选择器由本插件接管，依赖 `ctx.modelDirectories`。该服务不可用或 catalog 尚未加载完成时，插件不会强行覆盖内置选择器，价格和费用统计不受影响。
- `/model` 命令仍由 DSH 自带实现，顺序不保证与右下角选择器一致。
- 一轮里的多次模型尝试（重试、失败等）会分别计入；失败调用如果 provider 没有返回 usage，则无法计入。
- 只统计当前载入 Host 的会话；未打开的历史会话在进入后按需计算。
- provider 返回的 `totalTokens` 与三档明细不一致时，保留三档明细并把该轮标为“部分未定价/不完整”，不再整条丢弃，避免大幅少报。
- 当 DSH 的 Web 搜索或抓取走 DeepSeek 独立的 `deepseek-search-api` / `deepseek-fetch-api` 时，按 DeepSeek 官方价把 **Search/Fetch 按次费**（¥5 / 1,000 次成功请求，2026-11-01 00:00 北京时间起）计入合计。模型回合内的联网搜索（`deepseek-official`）自 2026-11-18 12:00 北京时间起由官方改为并入 token 计费，这里不再按次收费，也不会重复收。DuckDuckGo、Tavily、普通 HTTP 抓取等不收费的 provider 不会被计费。一次 `web_search` 含多个 query 时按一次成功工具调用计。
- 第三方价格是静态配置，不会自动跟随官网调价；内置节假日表覆盖 2026–2027 年，2028 年起需更新 `DEEPSEEK_HOLIDAYS`。

### 开发

```sh
node --check host.js
node --check client.js
node --test test/*.test.mjs
```

插件没有运行时 npm 依赖。

### License

[MIT](LICENSE) © 2026 likaileave

---

## English

`dsh-model-billing` is a DSH Web GUI plugin that can take over the composer's model picker, lets you order configured models yourself, stores three per-million-token prices per model, and estimates per-turn and session cost from provider usage.

### Features

- **Custom model order** in Settings → Models & Cost. The number at the left of each row is an input: type a target position and press Enter (or leave the field) to move the model, and "Insert as" chooses whether it lands at that position or one below, independent of where it came from; the arrows still nudge. The composer picker follows that order across providers and groups models by provider.
- **Hide models**: each row has a hide switch. Hidden models leave the picker while prices and estimates keep counting them, and the model in use stays listed. Hiding never deletes the configuration.
- **Automatic saving**: edits are submitted about 0.7 s after you stop making them, the page says so, and the manual save and discard buttons are gone.
- **Three prices per model**: cache-hit input, cache-miss input, and output, in CNY per million tokens. `0` is a valid price; blank means unset.
- **Built-in official DeepSeek pricing** for `deepseek-flash` (and the same-rate aliases `deepseek-v4-flash` and `deepseek-v4-flash-vision-exp`) and `deepseek-v4-pro`, selected per usage event between peak and off-peak Beijing time. A complete set of custom prices overrides the table and is labelled "Custom".
- **Per-turn model and amount** at the end of each turn, together with the turn's cache-hit rate.
- **Configurable turn tail**: a master switch for the turn tail, plus individual toggles for models, provider names, cost, tokens, cache-hit rate, and text labels; adjust font size, spacing, and weight; or disable the picker takeover to restore the built-in DSH picker. The composer cost estimate has its own switch.
- **Team switch in the picker**: while the plugin owns the picker, DSH's "Enable agent teamwork" switch stays below the reasoning effort rows. It behaves like the built-in switch — hidden for subagent sessions, the same disable warning, the same failure message — and its ⓘ shows the native description on hover or focus.
- **Session summary** below the composer plus a detail panel grouped by turn and by model. The number of in-turn web searches is listed separately: DeepSeek bills them as model tokens and the log carries no usage for that auxiliary request, so they are counted but not priced.
- **DeepSeek Search/Fetch per-request fees**: only DeepSeek's standalone Search / Fetch APIs (`deepseek-search-api` / `deepseek-fetch-api`) are billed at the official ¥5 per 1,000 successful requests, with search and fetch billed counts shown separately in the detail panel. In-turn web search (`deepseek-official`) has been billed as model tokens instead since 2026-11-18 12:00 Beijing time, so it is not charged per request here.
- **Historical prices and unpriced routes**: the "Historical prices" section in Settings lets you add, edit, or remove prices for models no longer in your order without re-adding them. Removing a model from the list keeps its price, so historical calls still bill correctly; when the name is unknown, the raw model id is shown. Unpriced calls share one notice that can be switched off. "Clear all" empties the whole book at once, and a removed row stays removed after reloading.
- **DeepSeek is billed too**, using the same three-price formula and the event's timestamp.

### Cost formula

```text
cache-hit input × hit price
+ (uncached input + cache write) × miss price
+ output × output price
+ DeepSeek Search/Fetch successful requests × per-request price (standalone APIs only; in-turn web search is paid as tokens)
```

Prices are CNY per million tokens; Search/Fetch is billed per request at ¥0.005 (¥5 per 1,000 successful requests). Cache writes are approximated at the cache-miss price. Figures come from provider usage and tool results in the session log; the provider's invoice is authoritative.

### DeepSeek official prices

The built-in table lives in [`host.js`](host.js) as `DEEPSEEK_PRICES`, in CNY per million tokens. Source: [DeepSeek models & pricing](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/) (checked 2026-10-19).

| Model | Window | Cache hit | Cache miss | Output |
|---|---|---:|---:|---:|
| deepseek-flash | peak | 0.04 | 2 | 8 |
| deepseek-flash | off-peak | 0.02 | 1 | 4 |
| deepseek-v4-pro | peak | 0.30 | 9 | 27 |
| deepseek-v4-pro | off-peak | 0.15 | 4.5 | 13.5 |

`deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` share the `deepseek-flash` rate and are not repeated in the table.

Peak windows are Beijing time Monday–Friday 9:00–12:00 and 14:00–18:00, excluding Chinese public holidays; weekends, holidays, and every other hour are off-peak at half the peak rate.

The plugin ships **no third-party price defaults**. Enter your provider's actual rates in Settings → Models & Cost. Models without a complete three-price set are marked as unpriced and contribute no amount. DeepSeek prices come from the built-in official table; enter a complete custom set to override it, or clear all three fields to restore the official rates.

### Install

Requires DSH `^0.2.1-rc.3`.

**npm**

```sh
dsh plugin --profile desktop add dsh-model-billing
```

**From dsh-market**

Search for `dsh-model-billing` in dsh-market.

**From a GitHub Release**

Download `dsh-model-billing.tgz` from [Releases](https://github.com/likaileave/dsh-model-billing/releases), then:

```sh
dsh plugin --profile desktop add ./dsh-model-billing.tgz
```

**From a checkout**

```sh
git clone https://github.com/likaileave/dsh-model-billing.git
dsh plugin --profile desktop add ./dsh-model-billing
```

**Restart DSH** after installing or updating; the desktop build has no reload command and plugin code is read from disk only when the page starts.

### Release channels

The npm package and the GitHub Release use the same version number and are published separately:

- npm: <https://www.npmjs.com/package/dsh-model-billing>
- GitHub Releases: <https://github.com/likaileave/dsh-model-billing/releases>

They are parallel distribution channels, not an automatic mirror.

### Data

Order and prices live in `~/.dsh/model-billing.json` (or `$DSH_HOME/model-billing.json`). Writes use a temporary file plus atomic replace.

### Limitations

- Official DeepSeek peak/off-peak rates apply only to providers whose id starts with `deepseek` (such as `deepseek-account`) and to models present in the official table. A third-party route such as `openrouter` or `my-deepseek-relay` is billed by the normal rules even when the model name contains `deepseek`, and you can price it yourself.
- Display settings (turn-tail switches, font size, spacing, picker takeover) are stored only in the Host's `model-billing.json`; they are no longer mirrored into browser localStorage, so they do not sync across devices or browsers. Any key written by older builds is cleared automatically.
- Besides loopback (`127.0.0.1`, `localhost`, `[::1]`), a request is accepted when its Host header matches the address this socket actually listens on (`socket.localAddress` + `localPort`), so a LAN IP works with `--host 0.0.0.0`. A reverse proxy that rewrites Host must preserve it or match the listening address, otherwise the four routes return 403 and the picker falls back to the DSH built-in one; chat itself keeps working.
- The custom picker depends on `ctx.modelDirectories`; when that service is unavailable or the catalog has not loaded yet, the plugin leaves the built-in picker alone.
- The `/model` command is still implemented by DSH and may not follow the custom order.
- Multiple attempts within a turn are counted separately; failed calls without provider usage cannot be counted.
- Only sessions loaded by the current Host are counted.
- When a provider's `totalTokens` disagrees with its three buckets, the buckets are kept and the turn is marked partial instead of being dropped, which avoids large under-reporting.
- DeepSeek **Search/Fetch per-request fees** apply only to the standalone `deepseek-search-api` / `deepseek-fetch-api` providers (¥5 per 1,000 successful requests, from 2026-11-01 00:00 Beijing time). In-turn web search (`deepseek-official`) has been billed as model tokens since 2026-11-18 12:00 Beijing time, so it adds no per-request fee and is never double-charged. Free providers such as DuckDuckGo, Tavily, and plain HTTP fetch are never charged. A `web_search` call containing several queries is counted as one successful tool call.
- Third-party prices are static and are not refreshed automatically. The bundled holiday table covers 2026–2027; update `DEEPSEEK_HOLIDAYS` for 2028 onward.

### Development

```sh
node --check host.js
node --check client.js
node --test test/*.test.mjs
```

The plugin has no runtime npm dependencies.

### License

[MIT](LICENSE) © 2026 likaileave
