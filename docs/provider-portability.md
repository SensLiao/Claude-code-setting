# Provider Portability — 换模型（含非-Claude / 中国模型）可移植性指南

> **Date**: 2026-05-29 · **Sibling of** [`native-capabilities.md`](native-capabilities.md)（平台事实单一真相源）。
> **一句话**：整套 harness 绑的是 **Claude Code（运行时 / CLI）**，**不是 Claude（模型）**。模型选择全程委托给 Claude Code —— 换掉 Claude Code 背后的脑子，整套跟着换。
> **不改 tier 策略**：三层能力分层（决策/执行/工具 = opus/sonnet/haiku 别名）本身是 provider-agnostic 的，user-locked。本文只讲"别名→具体模型"的解析层怎么换 provider。

---

## 0. 先分三层 —— 不分清没法答"能不能用中国模型"

| 层 | 是什么 | 换中国模型？ |
|---|---|---|
| **L1 你做的产品** | 用本 harness 开发出的 app/服务的运行时 | ✅ **零改动**。harness 管开发流程治理（QA/AppSec/规划/编排），与产品调哪个模型 API 无关。唯一 Claude-specific 的是 `claude-api` skill（opt-in，不激活不碰你）。 |
| **L2 harness 的 agent/orchestrator 自己跑在哪** | subagent / Workflow / skill 的底层推理 | ⚠️ 可行，但要先有网关（见 §2），按需补 §4。 |
| **L3 中国模型当外部协作者** | 上游设计师 / 下游 reviewer | ✅ 已有模式（`rules/common/task-execution-protocol.md §3.2` 协作回路 + Codex 官方 plugin `codex@openai-codex`），加桥接即可。 |

**结论先行**：只想让产品用中国模型 → 今天就能用，什么都不改。真正有耦合、需要动手的是 **L2**。

---

## 1. 核心原理 —— 模型选择"到处都有"，但只有一处硬墙

- harness 里 **每次 spawn agent 都带 `model`**（opus/sonnet/haiku 别名）：SKILL-direct 编排、`~/.claude/agents/*.md` 每个 agent 定义、Workflow 的 `agent({model})` —— 不是 workflow 专属。
- 但**所有这些都是 Claude Code 的"模型选择器"字符串，自由透传**，没有正则拦截。
- **唯一会主动拒绝非-Claude 名字的硬墙**：`orchestrator-runtime/shared/orchestrator-spec.v1.json` 的 `model` 字段正则
  - `model`: `^(haiku|sonnet|opus)(-[0-9][a-z0-9.-]*)?$`
  - `resolved_model`: `^(haiku|sonnet|opus|inherit)(-[0-9][a-z0-9.-]*)?$`
  - 它**只作用于 workflow-spec 路径**（appsec/qa 的 preset 规格）。`deepseek-r1` 这种 id 会被 schema 校验拒掉。

> 所以："所有地方都绑 Claude Code、不绑模型；只有 workflow-spec 的 schema 多一道会拒非-Claude 名字的墙。"

---

## 2. 真正的地基：网关（ANTHROPIC_BASE_URL）—— 全局，非 workflow 专属

让**任何东西**跑在非-Claude 模型上的前提，是把 Claude Code 指向一个 **Anthropic-API-兼容网关**：

- 机制：设 `ANTHROPIC_BASE_URL`（+ key）指向一个把目标模型暴露成 Anthropic Messages API 的代理。
- 社区常见代理（需各自验证对目标模型的兼容性）：LiteLLM、one-api / new-api、claude-code-router 一类。
- 官方原生支持的非默认后端：Amazon Bedrock、Google Vertex（仍是 Anthropic 模型）。中国模型需经上述兼容层。
- **关键**：Claude Code 的 hooks / Workflow tool / subagent / skill 系统是**运行时特性，不是模型给的**。只要还在 Claude Code 里跑、仅把后端推理经网关换成中国模型 → 这套全都还能用，只是底层换了脑子。

### 两种路由策略

| 策略 | 怎么做 | 要改 schema/spec 吗 | 适用 |
|---|---|---|---|
| **(a) 别名映射（最小路，推荐）** | spec/agent 里**继续写 `opus/sonnet/haiku`**；在**网关侧**把这三个别名映射到 DeepSeek/Qwen/GLM 等 | **不用** —— 名字仍是 opus/sonnet/haiku，过得了正则 | 快速切换、试水、整体换 provider |
| **(b) 显式模型 id** | spec 里明文写 `deepseek:r1` / `qwen:max` | **要** —— 见 §4 Point 1+2 | 要审计可追溯、多 provider 混用 |

> **走 (a)，连 schema 都不用碰，workflow 和非-workflow 一起跟着走。** 只改一处：网关配置 + `ANTHROPIC_BASE_URL`。

---

## 3. 能力降级表 —— Claude 专属特性在非-Claude 上消失（不报错，但降级）

以下来自 [`native-capabilities.md`](native-capabilities.md)，均为 Claude 模型 / Claude Code 平台能力。换 provider 后**大多不存在**：

| Claude 专属能力 | 非-Claude 上 | harness 如何降级 |
|---|---|---|
| **Dynamic Workflow**（模型现场写 workflow JS，research preview，2.1.154+） | 通常无 / 质量不可控 | **不影响 governed gate** —— 我们用**确定性脚本** `appsec-orchestrator.js` / `qa-orchestrator.js`（固定 phases）。§3.7 本来就禁止 Dynamic Workflow 出 gate verdict。只是"DW 当侦察兵"那块没了。 |
| **effort levels**（low/medium/high/xhigh/max）+ **ultracode** | 无 | spec 的 `_execution_profile.effort` 本来就是审计字段，Workflow body 忽略（native agent() 无 effort 参数）→ 无影响。 |
| **fast mode**（Opus 同权重加速） | 无 | `_execution_profile.speed` 同上，纯审计 → 无影响。 |
| **adaptive thinking / 手动 budget_tokens** | 各模型自有方式 | 按目标模型的思考控制方式走；harness 不强依赖。 |
| **prompt caching 最小 token**（Opus 4.8=1024 等） | 各模型不同 | 缓存命中率变化，功能不破。 |
| **resumeFromRunId**（same-session resume） | 取决于平台 | harness 的跨 session 续跑靠自己的 `previous_results`/`phase_outputs_fingerprinted`，不依赖原生 resume。 |

> **要点**：确定性 runner 本质是"一段 JS 循环调 N 次 agent()"，**底层模型是谁都照跑**；降级的只是 Claude 平台的高级糖。但 **gate verdict 质量取决于所选模型的推理能力** —— 用弱模型跑 release/security gate，请相应提高人工复核。

---

## 4. 补充改造清单（L2，按必要性排序）

| # | 改什么 | 何时需要 | 文件 |
|---|---|---|---|
| **P4** | **搭 Anthropic-兼容网关 + 设 `ANTHROPIC_BASE_URL`**（地基，最先做） | 想让 harness 跑在任何非默认后端上 → **必做** | 环境变量 / 网关配置（harness 外） |
| **P1** | 放宽 spec 的 `model`/`resolved_model` 正则，允许带 provider 前缀的 id（如 `deepseek:r1`），保留三别名为首选 | 仅当走策略 (b)：spec 里明文写中国模型名 | `orchestrator-runtime/shared/orchestrator-spec.v1.json` + `validate-spec.js` |
| **P2** | 把 `model_policy_overrides` 升级成「provider profile」：`{provider, tier_map:{cheap_fast,balanced,strongest_available}}`。**别名层 + 三层 tier 策略一字不动**，只换解析映射 | 配合 P1，或想多 provider 切换 | `orchestrator-runtime/shared/model-policy.md` + 各 `.{appsec,qa,uiux,gsd}/config.json` |
| **P3** | （认知补充）本表已是 P3 —— 换 provider 时照此判断哪些能力失效 | 任何换 provider 时 | 本文件 + `native-capabilities.md` 标 `provider: anthropic` |

**最小可用 = P4 only（走策略 a 别名映射）。** P1+P2 仅为策略 (b)。P3 是认知，不改也能跑。

---

## 5. 不用动的地方（已经 provider-agnostic）

- 三层 tier 策略（决策/执行/工具）—— 能力分层，本就不绑厂商。
- `model-policy.md` 的别名 `cheap_fast/balanced/strongest_available/inherit` + override 机制 —— 设计意图就是"换模型改 1 行配置"。
- 所有 SKILL-direct 的 `model:` 透传（无正则墙）。
- hooks / skill / agent 定义结构 —— 是 Claude Code 运行时，模型无关。

---

## 6. 硬警告 —— 区分"换模型"与"换运行时"

- **换模型（仍在 Claude Code 里，经网关换后端推理）** → 上述全适用，绝大部分照跑。
- **换运行时（彻底脱离 Claude Code，自己拿 DeepSeek 搭 agent 框架）** → hooks / Workflow tool / subagent / skill 这套**全是 Claude Code 的，得整体重写**。harness 是**建在 Claude Code 之上**的，这是它的地基，不是模型。

---

## 7. 决策树（速查）

```
我想用模型 X 做……
├─ 做产品（app 调 X 的 API）            → 零改动，直接做（L1）
├─ 让 X 当设计/审查协作者               → L3，task-execution-protocol §3.2（Codex 走官方 plugin codex@openai-codex；非-Codex 模型经 §3.2 协作回路）
└─ 让 harness 的 agent/workflow 跑在 X 上（L2）
     ├─ 还在 Claude Code 里？
     │    ├─ 是 → P4 搭网关（必做）
     │    │        ├─ spec 里继续写 opus/sonnet/haiku，网关映射 X → 完成（策略 a，最小）
     │    │        └─ spec 里要明文写 X 的 id        → 再做 P1+P2（策略 b）
     │    │        └─ 无论哪种：查 §3 能力降级表，gate 用弱模型时加人工复核
     │    └─ 否（自建框架）→ 这套不适用，需重写运行时层
     └─ 完成后：重跑 governed-gate-guard / appsec-routing / harness run-all 验证未破
```

---

## 8. P4 实现 — CC Switch 作 provider 切换 GUI（2026-05-29 落地 + DeepSeek/GLM/Kimi 验证）

P4（网关 + `ANTHROPIC_BASE_URL`）的 GUI 实现选 **CC Switch**（`ccswitch.io`，user-global desktop app）。它只当 **provider/model 切换层**，治理面（hooks/permissions/gates）**绝不交给它**。

### 8.1 边界（红线）

| | 范围 |
|---|---|
| ✅ 允许 | provider presets / 切换 · 必要时 local routing 做协议转换 · `haiku/sonnet/opus` role-based model mapping · 延迟/用量可见性 |
| ❌ 禁止 | `hooks` / `permissions` / `statusLine` / governed gates · 项目级 `.claude` 所有权 · skills / prompts / MCP sync（除非单独评审）· tool-call-heavy live session 里跨 provider 热切 |

### 8.2 硬前置条件 —— protected-key 守卫（已落地）

CC Switch 切 provider 时会重写 `~/.claude/settings.json`，有吞掉非-provider 键的历史（cc-switch issue #1907/#2109：从 provider DB 抽 common config 而非 live settings.json）。本 harness 整个 GSD 治理层在 `settings.json.hooks` 里 → clobber = 治理丢失。

**方案**（未上 managed-settings 时的等效保护）：`~/.claude/tools/ccswitch-guard/ccswitch-guard.js`
- `--capture`：在 known-good 状态（Claude Official、hooks 完整）抓快照 `protected-keys.snapshot.json`（protected 顶层键 + 非-`ANTHROPIC_*` 的 env_preserve）。
- `--check`：dry-run，报 protected-key drift；有 drift exit 1 = **"protected-key diff 必须为空"验收门**。
- `--restore`：切完 provider 后把治理键合并回去（先备份）；`env` 是**合并**不是覆盖 —— 重新断言 `DISABLE_TELEMETRY` / `CLAUDE_CODE_*` 等治理 env，同时保留 switch 写入的 `ANTHROPIC_*` payload。

protected 顶层键：`hooks` `permissions` `statusLine` `enabledPlugins` `skillOverrides` `disableSkillShellExecution` `extraKnownMarketplaces` `mcpServers`。
**自测已通过**：模拟最坏 clobber（删 hooks/statusLine、env 洗到只剩 ANTHROPIC_*）→ `--check` 准确报 drift → `--restore` 全恢复 + 保留 ANTHROPIC_* → 复检 EMPTY。

**更强的替代**（推荐长期）：把 hooks/permissions 迁到 managed-settings（Windows: `C:\Program Files\ClaudeCode\managed-settings.json`，优先级高于 user settings，CC Switch 改不到）。当前用守卫脚本作等效保护。

### 8.3 DeepSeek 接入（验证结论）

- 端点：`https://api.deepseek.com/anthropic`（Anthropic Messages API 兼容）。
- **服务端 auto-map**（curl 实测）：`claude-opus-*` → `deepseek-v4-pro`；`claude-sonnet-*` / `claude-haiku-*` → `deepseek-v4-flash`。即 **策略 (a) 别名映射** 在 raw API 层成立，spec/agent 继续写 opus/sonnet/haiku，无需碰 schema。tier 实际坍缩为 2 档（决策→pro，执行/工具→flash），符合 DeepSeek 现有 coding 档位。
- ⛔ **已知阻断（2026-05-29 实测复现）：DeepSeek 端点在 Claude Code v2.1.154 里无法用于真实 session。** 报错 `400 ... messages[1].role: unknown variant \`system\``。根因是 **Claude Code v2.1.154 的回归 bug**（非 DeepSeek、非本配置）：2.1.154 起把注入上下文（SessionStart summary 等）当成 `role:"system"` 的消息塞进 `messages[]`，DeepSeek 严格的 Anthropic-spec 校验器只认 `user`/`assistant` → 每个 session 必 400。**v2.1.153 正常**。curl 实测：正确形状（system 顶层）HTTP 200；system 当 message role → HTTP 400（与官方 issue 一字不差）。本 harness 每 session 都注入 SessionStart context → DeepSeek-direct 在此 harness 下基本必失败。出处：[deepseek-ai/awesome-deepseek-agent#167](https://github.com/deepseek-ai/awesome-deepseek-agent/issues/167)（OPEN，无官方修复）、[anthropics/claude-code#61412](https://github.com/anthropics/claude-code/issues/61412)。前 §8.3 旧表述"开箱即用"仅基于 raw-API curl（未走真实 session 注入路径）→ 已更正。修复路径见 §8.6。
- auth：`ANTHROPIC_AUTH_TOKEN`(Bearer) 与 `ANTHROPIC_API_KEY`(x-api-key) **都被接受**；provider 配 `ANTHROPIC_AUTH_TOKEN`（CC Switch 标准）。
- 安装器：`~/.claude/tools/ccswitch-guard/add-deepseek-provider.py`（克隆 `claude-official` 行 schema、备份 DB、`INSERT OR REPLACE`、`is_current=0` 不抢激活、app 运行时拒写[fail-safe]）。已装：DB 有 `deepseek-v4` provider（未激活）。

### 8.4 激活流程（用户操作）

```
1. 打开 CC Switch → 列表里看到 "DeepSeek (V4 · Anthropic-compat)"
2. 想用时点它（CC Switch 把 ANTHROPIC_* 写进 settings.json env）
3. node ~/.claude/tools/ccswitch-guard/ccswitch-guard.js --check    # protected-key diff 须为空
4. 若报 drift → ... --restore                                      # 把治理键 + 治理 env 合并回来
5. 新开 Claude Code session 生效（env 改动对新 session 起效）
6. 切回 Claude：CC Switch 选 Claude Official；Windows 下若 401，关掉 CC Switch 开的 terminal 再重开（清 env 残留）
```

### 8.5 已知风险（reviewer grounding，写入备忘）

- **不要**在已有 tool-call 历史的 live session 跨 provider 热切（非-Anthropic ↔ Anthropic 的 `tool_use.id` 格式不兼容，compaction 会 400）。只在新 session 前切。
- Windows env 残留：切回 official 后 CC Switch proxy 注入的 `ANTHROPIC_*` 可能留在 shell 继承链 → 关旧 terminal、重开再验。
- 弱模型跑 governed gate（release/security/commercial-cert）：只允许降级 + **人工复核加重**，不允许因 provider 能力差就跳 gate（§3 能力降级表 + CLAUDE.md §3.7）。
- ⚠ **本对话明文出现过 DeepSeek key** → 测试完到 DeepSeek 控制台 **rotate**。
- **guard 误报已修（2026-05-29）**：`ccswitch-guard.js` 原 `deepEqual` 用顺序敏感 `JSON.stringify` 比对，而 CC Switch 每次切换都会重排 settings.json 的 object key 顺序 → `--check` 每次都误报全键 drift（cry-wolf，真 clobber 反被忽略）。已改为 `canonicalize()` 递归排序 object key 后比对（数组顺序保留）。验证：真 settings `--check` 报 EMPTY ✓；篡改副本（删 `hooks.Stop`+加假权限）仍精确报 drift ✓。

### 8.6 DeepSeek-in-Claude-Code 修复路径（v2.1.154 回归）

按"风险最低 → 折腾最多"排：

| 方案 | 做什么 | 代价 / 风险 |
|---|---|---|
| **A. 不让 Claude Code 后端跑 DeepSeek（推荐）** | provider 留着（已装、未激活），等上游修；Claude Code 用官方，DeepSeek 经 §L1/L3 用在产品 API / 外部协作者（`task-execution-protocol §3.2`） | 零风险。本 harness 本就为 Claude 设计 |
| **B. claude-code-router 代理 + transformer** | `ANTHROPIC_BASE_URL` 指向本地 CCR，由 transformer 把 `system`-role 折进顶层 `system` | 要装/常驻服务；且 **V4 Pro + thinking + tools 仍有 400**（[ccr#1378](https://github.com/musistudio/claude-code-router/issues/1378)），非银弹 |
| **C. 降级 Claude Code 到 2.1.153** | `npm i -g @anthropic-ai/claude-code@2.1.153` | 直接修好 DeepSeek；**但丢 2.1.154+ 特性**（Dynamic Workflows / ultracode，CLAUDE.md §3.7 刚围绕它加固）→ 与本 harness 现状冲突，**不建议** |
| **D. 等上游修** | 盯 issue #167 / #61412；升级到 >2.1.154 后用 curl 复测 system-role 形状再激活 | 被动，但最干净 |

### 8.7 GLM + Kimi 接入（2026-05-29 实测可用，DeepSeek 的反例）

与 DeepSeek 不同，**GLM 和 Kimi 在 Claude Code v2.1.154 下可正常用于真实 session** —— 它们的 Anthropic-compat 层更宽松，容忍 2.1.154 注入的 `role:"system"` 消息。

**三层验证**（均本机实测，非厂商自报）：

| 验证层 | GLM | Kimi |
|---|---|---|
| ① curl 正确形状（system 顶层）| HTTP 200 | HTTP 200 |
| ② curl system-role 进 `messages[]`（即 2.1.154 那条）| **HTTP 200 容忍** | **HTTP 200 容忍** |
| ③ E2E `claude -p` 子进程（全 CLAUDE.md/hooks 加载）| exit 0 ✓ | exit 0 ✓ |

**端点 / key / 模型**：

- **GLM（智谱 Z.ai）**：端点 `https://api.z.ai/api/anthropic`（本次 key 为**国际 z.ai** key）。⚠ 服务端 auto-map 把 opus/sonnet/haiku **全压到 `glm-4.7`**（连 `claude-opus-4-8`→glm-4.7）；旗舰 `glm-5` / `glm-5.1` 须**显式按名请求**。已 **pin `glm-5`**（避开 `glm-5.1` —— 一项 Rails 实测发现 5.1 反而退步到 Tier C vs glm-5 Tier B）。
- **Kimi（Moonshot）**：端点 `https://api.moonshot.cn/anthropic`。⚠ 本次 key 为**国内站** key（国际 `api.moonshot.ai` 返回 401）→ 装时用 `--cn`。Moonshot 不 auto-map claude 名 → 须 pin 模型；已 **pin `kimi-k2.6`**（旗舰，> k2.5）。
- **MiniMax**：用户本轮**未装**（主动放弃）。

**安装器（已泛化）**：`~/.claude/tools/ccswitch-guard/add-anthropic-provider.py` —— 预设 `glm`/`kimi`/`minimax`/`deepseek`/`custom`；`--from-file` 批量；`--cn` 切国内端点；`--model` pin/override；继承 DeepSeek 安装器全部安全性（CC Switch 运行时拒写 / 备份 DB / 克隆 schema / `is_current=0`）。原 `add-deepseek-provider.py` 保留（向后兼容），新工作统一走泛化版。DB 现有 `glm-zai`(glm-5) + `kimi-moonshot`(kimi-k2.6) + `deepseek-v4`，均 `is_current=0`。

**性能定位（2026-05，SWE-Bench Pro 主轴；多为厂商自报+三方博客，非完全独立复核）**：

| 模型 | SWE-Bench Pro | 定位 | ~价格(in/out /1M) |
|---|---|---|---|
| Claude Opus 4.8 | **69.2%** | 当前综合最强（7 项赢 6 项）| $5 / $25 |
| GPT-5.5 | 58.6% | Terminal-Bench 赢（78.2%）| ~$5 / $25–30 |
| Kimi K2.6 | 58.6% | 开源最强 agentic；长程稳定 | ~$0.95 / $4.00 |
| GLM-5.1 | 58.4% | 开源 MIT；前端/web dev 强 | ~$0.95–1.4 / $3.15–4.4 |

要点：**GLM-5.1 / K2.6 已追平 GPT-5.5，但仍落后 Opus 4.8 约 10 分**；中国旗舰便宜约 5–6×。

**使用策略（落地约束）**：governed gate（release/security/commercial-cert）+ 高风险/最终交付 **留 Opus 4.8**；GLM-5 / K2.6 跑省钱粗活（样板 / 测试 / 初稿 / 批量改），**按 session 切**，遵守 §8.5 热切禁令。GLM-5 实测**指令服从性弱于 Claude/Kimi**（要求逐字回显时它会改写）→ 严格格式任务慎用。

⚠ **本对话明文出现过 GLM + Kimi key（外加 DeepSeek）** → 方便时各控制台 rotate，再用 `add-anthropic-provider.py --preset <p> --model <m> --key <新key>`（Kimi 加 `--cn`）同 id 覆盖。

---

## 9. Codex 协作通道 — 官方 plugin（2026-06-10 迁移，取代旧 `codex-dispatch` skill）

L3「外部协作者」里 **Codex（GPT-5.x）** 这一路，从手写的 `codex-dispatch` local skill（裸 `codex exec` shell 拼接）迁到 **官方 plugin `codex@openai-codex`**（marketplace `openai-codex`，来源 `github openai/codex-plugin-cc`）。本机已装 v1.0.4，codex-cli 0.133.0 在 PATH。

### 9.1 命令面

| 命令 | 用途 | 关键 flag |
|---|---|---|
| `/codex:review` | 只读跨模型 review | `--base` / `--wait` / `--background` |
| `/codex:adversarial-review` | 对抗式 review（santa-loop 双盲第二评审员） | 可加 `focus` |
| `/codex:rescue` | 委派执行（施工） | `--model` / `--effort` / `--resume` / `--background` |
| `/codex:status` `/codex:result` `/codex:cancel` | 后台任务管理 | — |
| `/codex:setup` | 安装/配置 | `--enable-review-gate`（实验性，**默认关**） |

施工单模板（喂给 `/codex:rescue`）见 `rules/common/task-execution-protocol.md §3.1`。

### 9.2 ⚠ review-gate 默认关闭（不要开）

`/codex:setup --enable-review-gate` 会把 Codex review 挂成每次自动触发的 gate，**会持续烧 Codex 限额**。**保持关闭**；按需手动调 `/codex:review` / `/codex:adversarial-review` 即可。

### 9.3 Windows 说明（plugin vs 旧 raw CLI）

- 官方 plugin 走 **app-server 通道**与 codex-cli 通信，**不再走旧 skill 的 shell 字符串拼接** → 旧 `codex-dispatch` 在 Windows 上的两类 workaround 对 plugin **不再需要**：
  - `--skip-git-repo-check`（非 git 根目录 "Not inside a trusted directory" 规避）
  - GBK / `Get-Content -Encoding utf8` 中文乱码规避（沙箱隔离注册表导致 PowerShell 回退 Restricted）
- 上述 workaround **仅在你直接手敲 raw `codex exec` 时**仍需要；经 plugin 命令则不涉及。

### 9.4 额度 fallback（策略不变）

Codex 额度耗尽（rate limit / quota / 402）→ **fallback 到 Claude subagent**（`Agent` tool，按模型路由选 `sonnet`/`opus`）。这条与旧 skill 一致，迁移后保留。
