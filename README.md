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

- **自定义模型顺序**：在“设置 → 模型与费用”中用 ↑ / ↓ 调整已配置模型的顺序。模型选择器按这个顺序展示，跨提供方也保持你排的顺序，并用提供方名称分组。
- **三档 token 价格**：每个模型可填写每百万 tokens 的缓存命中输入、缓存未命中输入、输出价格。`0` 是有效价格，留空表示未设置。
- **DeepSeek 官方价内置**：`deepseek-flash` 和 `deepseek-v4-pro` 默认使用 DeepSeek 官网的峰谷价，并在设置页标明“官方价”；填入完整的三档自定义价即可覆盖官方价，标为“自定义”。
- **逐轮费用与使用模型**：每轮结束后在轮尾显示这一轮使用的模型，以及该轮费用和缓存命中率。
- **可配置轮尾**：在设置中总开关轮尾显示，并可分别开关使用模型、模型提供商、费用、token、缓存命中率、文字标签，调整字号、间距和字重；也可以关闭选择器接管，恢复 DSH 内置模型选择器。输入框下方的费用估算另有独立开关。
- **本会话费用**：输入框下方显示本会话累计估算、最近一轮费用和缓存命中率；展开后可查看按轮次和按模型的明细。
- **历史价格与未定价路由**：设置页的“历史价格”区可以为已移出配置的模型补价、改价或删除，不必把模型加回列表；从模型列表删除模型不会删除它的价格，历史调用仍按保存的价格计算，查不到名称时显示原始模型 id。缺价时显示统一提示，可在设置里关闭这条提示。
- **DeepSeek 也计入金额**：每条 usage 按事件发生时的北京时间自动选择高峰或空闲价，与第三方模型一起进入统计。

### 估算口径

```text
缓存命中输入 × 命中价
+（未缓存输入 + 缓存写入）× 未命中价
+ 输出 × 输出价
```

价格单位是“元 / 百万 tokens”。缓存写入按缓存未命中价计算，这是三档价格模型下的近似处理。金额来自会话日志中的 provider usage，实际账单以 provider 为准。

### DeepSeek 官方价

以下价格内置在 [`host.js`](host.js) 的 `DEEPSEEK_PRICES` 中，单位“元 / 百万 tokens”。来源：[DeepSeek 模型 & 价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)（查询于 2026-10-19）。

| 模型 | 时段 | 缓存命中 | 缓存未命中 | 输出 |
|---|---|---:|---:|---:|
| deepseek-flash | 高峰 | 0.04 | 2 | 8 |
| deepseek-flash | 空闲 | 0.02 | 1 | 4 |
| deepseek-v4-pro | 高峰 | 0.30 | 9 | 27 |
| deepseek-v4-pro | 空闲 | 0.15 | 4.5 | 13.5 |

高峰时段为北京时间周一至周五 `9:00–12:00`、`14:00–18:00`（中国法定节假日除外）；其余时间、周末和法定节假日全天为空闲时段。空闲价是高峰价的一半。

DeepSeek 价格默认只读展示；如需按其他渠道或折扣价计费，可在设置页点“自定义价格”填入完整三档价格，保存后以自定义价为准并标为“自定义”；三项清空后保存即可恢复官方价。官网调价或节假日安排变化后，需要更新 `host.js` 中的 `DEEPSEEK_PRICES` 和 `DEEPSEEK_HOLIDAYS`；目前内置的是 2026 年节假日。

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

安装或更新后刷新 Web 页面。设置页位于“模型与费用”。

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
- 第三方价格是静态配置，不会自动跟随官网调价；内置节假日表目前只覆盖 2026 年，2027 年起需更新 `DEEPSEEK_HOLIDAYS`。

### 开发

```sh
node --check host.js
node --check client.js
node --test test/*.test.mjs
```

当前 25 个测试通过。插件没有运行时 npm 依赖。

### License

[MIT](LICENSE) © 2026 likaileave

---

## English

`dsh-model-billing` is a DSH Web GUI plugin that can take over the composer's model picker, lets you order configured models yourself, stores three per-million-token prices per model, and estimates per-turn and session cost from provider usage.

### Features

- **Custom model order** in Settings → Models & Cost; the composer picker follows that order across providers and groups models by provider.
- **Three prices per model**: cache-hit input, cache-miss input, and output, in CNY per million tokens. `0` is a valid price; blank means unset.
- **Built-in official DeepSeek pricing** for `deepseek-flash` and `deepseek-v4-pro`, selected per usage event between peak and off-peak Beijing time. A complete set of custom prices overrides the table and is labelled "Custom".
- **Per-turn model and amount** at the end of each turn, together with the turn's cache-hit rate.
- **Configurable turn tail**: a master switch for the turn tail, plus individual toggles for models, provider names, cost, tokens, cache-hit rate, and text labels; adjust font size, spacing, and weight; or disable the picker takeover to restore the built-in DSH picker. The composer cost estimate has its own switch.
- **Session summary** below the composer plus a detail panel grouped by turn and by model.
- **Historical prices and unpriced routes**: the "Historical prices" section in Settings lets you add, edit, or remove prices for models no longer in your order without re-adding them. Removing a model from the list keeps its price, so historical calls still bill correctly; when the name is unknown, the raw model id is shown. Unpriced calls share one notice that can be switched off.
- **DeepSeek is billed too**, using the same three-price formula and the event's timestamp.

### Cost formula

```text
cache-hit input × hit price
+ (uncached input + cache write) × miss price
+ output × output price
```

Prices are CNY per million tokens. Cache writes are approximated at the cache-miss price. Figures come from provider usage in the session log; the provider's invoice is authoritative.

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

Refresh the Web page after installing or updating.

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
- Third-party prices are static and are not refreshed automatically. The bundled holiday table covers 2026 only; update `DEEPSEEK_HOLIDAYS` for 2027 onward.

### Development

```sh
node --check host.js
node --check client.js
node --test test/*.test.mjs
```

25 tests currently pass. The plugin has no runtime npm dependencies.

### License

[MIT](LICENSE) © 2026 likaileave
