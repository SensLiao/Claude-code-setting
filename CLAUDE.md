# 全局 Claude 配置

> 重构日期：2026-05-23 v4 — 三主线 + 6 Orchestrator（+I2R 需求前端，GSD 上游）+ AppSec 边界化
> 回滚通道：GitHub `SensLiao/Claude-code-setting`（按 commit 粒度）+ `~/.claude/backups/`
> 配套：[SKILLS-INDEX.md](SKILLS-INDEX.md)（13-Layer + 20-Route + 消歧表） / [rules/security-appsec.md](rules/security-appsec.md)（path-scoped AppSec 详规则） / [docs/ORCHESTRATOR-MAP.md](docs/ORCHESTRATOR-MAP.md)
> L12 Discoverability（UIUX 下游 release gate）：[docs/L12-DISCOVERABILITY.md](docs/L12-DISCOVERABILITY.md) / [rules/discoverability-l12.md](rules/discoverability-l12.md) / 入口 skill `discoverability-orchestrator`
> 第一性原理 / 为什么这套 harness 长这样（judgment=稀缺资源 + self-sunset 约定 + 准入 rubric）：[docs/OPERATING-PRINCIPLES.md](docs/OPERATING-PRINCIPLES.md)

---

## 0. 沟通语言（Communication Language）

> 加入 2026-05-29（user lock）。适用所有 project、所有 session、每一条面向用户的回复——优先级高于一切默认输出习惯。

- **默认中文汇报**：所有面向用户的叙述（解释 / 汇报 / 总结 / 提问 / 方案 / 结论 / 报错说明）一律用中文。
- **关键词保留英文**：technical terms / 工具名 / API / 命令 / 文件名 / 标识符 / 专有名词 保持英文原文，不翻译（如 `PreToolUse` hook、`manifest.json`、selector engine、Fluid Compute、RLS、ASVS、`spec_hash`、Server Action 等）。
- **不生造译名**：英文术语没有公认且无歧义的中文译名时，直接用英文。
- **代码 / 路径 / 命令 / 日志 / diff** 保持原样，不翻译。
- 这是**沟通层**约束，**不改变**文档、代码、注释、commit message 本身的语言——那些仍跟随各仓库既有约定（commit 仍用英文 conventional commits，rules / skills 文档保持原语言）。

---

## 0.5 汇报方式（Reporting Style）

> 加入 2026-06-01（user lock）。与 §0 同属**沟通层**，适用所有面向用户的进度 / 状态 / 成果汇报——尤其交付型项目（demo / 客户 / 投标 / PoC）。

默认以**领导 / 业务方视角**汇报，不是技术视角。用户要看的是"做出来的东西能干嘛、做到什么程度、现在能不能亲眼看到"，技术细节是**我**去实现的，不该让用户承担理解成本。

- **先答三件事且放最前**：① 这功能能用来干嘛（业务价值，一句话）② 完成进度（几成 / 几个子系统 / 能不能演示）③ 用户**现在能亲眼看到、点到**什么。
- **大白话优先**：默认不抛 schema 名 / verdict 名（CONDITIONAL_PASS 之类）/ CVE 号 / hash / 测试用例名 / ASVS 标识 / commit hash。要提就翻成后果（"改一条审计记录会被当场抓出来"而非"hash-chain verify GREEN"）。
- **技术细节降级到末尾**：确需保留的放回复末尾「技术附录」小段，或仅在用户**追问**时展开。
- **诚实分三类，绝不混淆**：「真能跑的功能」≠「样片 / 原型 / mockup」≠「看不见的后端引擎」。让用户误以为样片=成品是红线。看不见、没做完、被 BLOCK 的，照实标。
- **进度给绝对值**：用"7 大块完成 0 块 / 地基做了 2/3"这种用户能换算的口径，不要只报"67%"这种无锚点百分比。
- 本规则**不改变** §0 语言约定，也**不降低**任何 governance gate 的内部严谨度——只改**对外叙述的语言层**。内部该跑的 verdict / evidence / spec_hash 一样跑、一样严。

---

## 0.6 执行前计划预览卡（坎）— Plan-Preview Card

> 加入 2026-06-14（user lock）。与 §0 / §0.5 同属**沟通层**硬规则。起因：用户反馈"skill / workflow 执行前从不把计划用**表 + 点线图**给我看——我只知道它跑了，不知道它的计划长什么样、派了哪些 agent、用了哪些 tool、流程是什么"。既有的 gate / hook 只校验 `spec_hash` / sentinel（审批凭证），**不渲染人类可读的计划**。本节补这道**渲染坎**。

**铁律**：任何**中等 / 复杂**任务，在 fan-out 多 agent、启动 Workflow、或拉起重 orchestrator / 重 skill **之前**，必须先渲染**计划预览卡**并**等用户确认**，然后才全面执行。

- **卡片单一真相源**：`~/.claude/orchestrator-runtime/shared/preview-template.md`（"Default user-facing card"）。所有 orchestrator（GSD / UIUX / AppSec / QA）+ ad-hoc 多 agent / Workflow 派发都复用它，不各写各的。
- **卡片必含四件**：① 业务三行（目标 / 用到的能力 / 做完得到 + 规模成本）② **Agents 调度表**（`# · 阶段/Agent · 模型 · 干什么 · 用的工具=作用`，**工具列必填**）③ **点线流程图**（dots & lines，图例编码 串行 / parallel×N / gate / loop / 纯代码）④ **确认坎**（OK/批准/跑 → 执行；改 → 调整；cancel → 停）。
- **复杂度分档**（沿用 [task-execution-protocol.md](rules/common/task-execution-protocol.md) 的 简单/中等/复杂）：
  - **简单**（1 文件 / 无设计决策 / 单 agent / 无 fan-out / 无 Workflow）→ **跳过本卡**，一句"我在做 X"即可。
  - **中等**（2-3 文件 / 单功能 / 或 2 agent 派发）→ 出**精简卡**（表为主，节点 ≤3 时图可选）。
  - **复杂**（4+ 文件 / 多步 / 架构 / 跨模块 / 或任何 Workflow 启动 / 或 ≥3 agent fan-out / 含只读 audit·review 大 fan-out）→ 出**完整卡**（表 + 图 + 成本）并等确认。
- **与 spec_hash gate 组合，不替代**：workflow-spec 模式下，本卡就是 §16.13 / §18.5 Step 10 渲染的那张卡；`spec_hash` + sentinel + `<domain>-preview-gate.js` 照旧 enforce（卡是更丰富的 *render*，hook 是 *enforcement*）。prompt-only / ad-hoc 模式下没有 sentinel——卡是 instruction-layer 的坎：渲染 → 等确认 → 跑。
- **覆盖默认路径**：本卡在 **prompt-only 默认路径**（含 Windows）也要出——这正是以前"什么都不显示"的缺口。
- **例外**：用户已在本 session explicit 说"直接做 / 不用预览 / 自主推进到完成"时，可省去**等待**（仍建议先把卡渲染出来让用户事后可追溯），与 task-execution-protocol §例外 一致。
- **确定性背书（2026-06-15）**：prompt-only 默认路径上本卡过去纯靠 instruction（模型可能漏渲染）。现由**全局 hook `plan-card-reminder.js`**（PreToolUse[Agent|Workflow]，注册于 `~/.claude/settings.json`）背书：≥3 个 agent fan-out 或任意 Workflow 启动而本轮未渲染计划卡时，**确定性注入提醒**（软提醒、不阻断——"卡是坎但不卡死流程"）。诚实边界：hook 只强制"提醒触发"，不强制卡的质量；格式仍按本节 prompt。登记见 `manifests/hook-registry.json` global_live。

---

## 0.7 执行中实时 ToDo + 持久进度账本 + 收尾坎 — Live-ToDo / Durable-Ledger / Completion-Gate

> 加入 2026-06-14（user lock）。与 §0.6 配成一对：§0.6 预览卡 = **开工前**给用户看的*计划*；本节 = **执行中 / 收尾**你我都看的*进度*。起因：内置 todo（`Task` 工具）是 session 内的，`/clear` / context 压缩一来就丢，导致"跑一半忘了 / 中途不跑了"。本节补这道**执行期的坎**。

**铁律**：任何**中等 / 复杂**任务（复杂度分档沿用 §0.6 / [task-execution-protocol.md](rules/common/task-execution-protocol.md)），执行期必须维护下面三层，缺一不可：

1. **实时 ToDo（in-session，给你也给我）** — 一开工就用内置 Task 工具（`TaskCreate` / `TaskUpdate` / `TaskList`）把步骤拆成可勾选清单；**开始一步设 `in_progress`、做完设 `completed`**，不一次性补勾。作用：用户实时看进度 + 随时纠偏；我不跳步、不漏步。简单档任务可免。

2. **持久进度账本（durable，跨 session 的命根子）** — 凡**跨 session / 多阶段 / >1 工作块**的工程（capability 大建、多 phase 交付、长链路迁移），必须**额外**落一个**仓库内 markdown 账本**（每项：待办/进行中/完成/卡住 + 证据/commit + 「当前指针」下一步），不能只靠 session 内 Task（`/clear` 会冲掉它）。**新 session 第一件事读账本** → 知断点 → 接着干。复用现有件、不另造：人看的进度走该工程的 `*-LEDGER.md` / 计划自带 §checklist；机器审计走 `orchestrator-runtime/shared/run-ledger.js` 黑匣子（append `RECORDED` 行）。

3. **收尾坎（completion gate）** — 声称"完成 / done"**之前**，对账本 + ToDo 核一遍：有无未勾步骤 / 未验证产物 / 被 BLOCK 没标的。没核完不许说完成（呼应 §4 第 5 条"先验证再声称完成" + §4.5 验证纪律）。

**诚实边界**：不承诺物理上永不中断（context 上限 / 报错 / 用户打断都会发生）；目标是让中断永远**可见、可续**——账本一摆，断点 + 下一步一目了然，新 session 秒接。这才是"完整走一趟"能兑现的版本。

**例外 / 边界**：简单档免；用户说"直接做"也仍维护实时 ToDo（它是进度窗口、不是审批坎，不触发等待）。本节**不新增任何 gate / 治理**，是纯执行纪律（instruction-layer），与任何 governed gate 的内部严谨度无关。

**确定性背书（2026-06-15，更新上一句）**：第 3 层「收尾坎 / 必须汇报」现已从纯 instruction 升级为 hook 背书——**全局 hook `report-gate.js`**（Stop，注册于 `~/.claude/settings.json`）：非平凡轮次（用了 Agent/Task/Workflow 或 ≥3 文件改动）收尾若无汇报（closing 文本 < 阈值，默认 200 字符）即 `decision:block` 硬拦，逼模型补出 §0.5 汇报。loop-safe（`stop_hook_active`）+ fail-open（productivity gate 非 safety gate，绝不因报错断 session）。**它是面向"必须汇报"的轻量 productivity gate，仍非 governed verdict gate**——强制汇报"存在"、不强制质量，格式仍按 §0.5；与 §0.6 的 `plan-card-reminder.js` 配成一对。登记见 `manifests/hook-registry.json` global_live。

---

## 1. Operating Charter

这是 commercial delivery 的操作宪法。所有 routing 决策按"主线 → orchestrator → narrower skill"分层，默认不无脑堆叠同层 skill。**例外（2026-06-10）**：UIUX 主线的 create/optimize 任务走**质量组合调度引擎**——刻意跨层组合多个 skill（接地 → 探索 → 风格 → 生成 → 统一 → 评审，详 `uiux-product-orchestrator` references/combination-policy.md）。"不一次性激活多 skill"指"不让同层竞争 skill 抢活 / 不无脑堆叠"，**不**禁止跨层的刻意质量组合；其余主线（GSD / AppSec / QA）仍 narrower-skill-wins。

- **三主线**：Project setup / PM 交付 / UIUX / QA / AppSec，由 6 个 primary orchestrator 统管
- **详细路由表**（13-Layer / 20-Route / 触发消歧 / Skill 状态边界）：见 [SKILLS-INDEX.md](SKILLS-INDEX.md)
- **详细规则**（coding-style / testing / security / hooks / patterns / git）：见 `.claude/rules/`
- **CLAUDE.md 只保留**：宪法级硬规则 + 主线短路由 + AppSec 短规则 + 反模式 + 模型路由 + 回滚

---

## 2. 项目启动协议

### 第 0 步：环境装配检测（SessionStart hook + manual-first）

每个 session 启动时，`~/.claude/hooks/detect-bootstrap-needed.js` 检测 cwd。**SessionStart context 出现 `[BOOTSTRAP_HINT]` 时**：

1. 第一轮用户消息开始前，主动问一次："检测到这个项目还没 `.claude/` 环境（stack: {hint}）。要不要 `/claude-env-bootstrap` 装一下？"
2. 用户答 **是** → 用户必须 explicit 调 `/claude-env-bootstrap`（**manual-first / disable-model-invocation: true，不会被自动触发**）
3. 用户答 **否 / 忽略** → 本 session 不再问
4. 没有 `[BOOTSTRAP_HINT]` → 不主动提

**铁律**：`claude-env-bootstrap` 现在是 manual-first，hook 只负责"提示一次"，触发由用户 explicit slash command 完成。绝不静默自启。

### 第 1 步：任何 non-trivial 工作 → `Skill("gsd-pipeline-orchestrator")` 入口

新项目 / 新 phase / 跨模块改造 / continue 上次 / milestone boundary —— 一律先调 PM 总编排器。

### 跳过 GSD 的场景

1-3 行 bugfix / 回答问题 / 读代码 / 用户明确说"不用 GSD"。

---

## 3. 三主线 + 6 Primary Orchestrator

| 主线 | Orchestrator | 何时触发 | 自动/手动 | 执行模式 |
|---|---|---|---|---|
| Project setup | `claude-env-bootstrap` | 用户说 "init / bootstrap / 装环境" | manual-first（disable-model-invocation: true）| SKILL-direct only（manual, no workflow） |
| 需求前端（GSD 上游） | `idea-to-requirements-orchestrator`（I2R） | raw idea / 想法转需求 / 定义需求 / functional·non-functional requirements / acceptance criteria / scope / 写 PRD / prepare for GSD（**不**触发：实现 / coding / debug / UI / roadmap）| auto | **SKILL-direct only**（all-opus；9 个 i2r-* agent + 10 个 mode subskill；不迁 workflow-spec 见 §3.5）。把一个 raw idea 变成 GSD-ready PRD（只产 WHAT/WHY，绝不产 HOW/tasks/architecture/UI），经 `/gsd:ingest-docs` 或 `/gsd:plan-phase --prd PRD.md` 交棒 GSD |
| PM 交付主线 | `gsd-pipeline-orchestrator` | 任何 non-trivial 工作 | auto | **SKILL-direct only**（33 个 gsd-* agent + slash command 派发；不迁 workflow-spec 见 §3.5）|
| UIUX 主线 | `uiux-product-orchestrator` | UI/UX design / visual / style / reference / audit UI | auto | **SKILL-direct only**（L3 互斥 + collection / workflow skill 边界；不迁 workflow-spec 见 §3.5）|
| QA 主线 | `enterprise-qa-testing` v3.2 | testing / QA / E2E / release readiness / CI gate | auto | **dual-mode**：prompt-only（默认）+ workflow-spec（显式 `/qa-quick-check` `/qa-focused-gate` `/qa-release-readiness` `/qa-commercial-cert`，§18.5 14-step launch contract）|
| AppSec 主线 | `appsec-security-orchestrator` v3.0 | backend / API / auth / user-data / file-upload / payment / admin / production + 威胁建模 / SAST / SCA / secrets / IaC / 云配置 / CSF 2.0 / 事件响应 / 恢复（**完整 trigger 词表见 `manifests/skill-routing-policy.json` appsec_defensive；narrow routing 见 appsec_narrow_***）| auto when triggers present | **dual-mode**：prompt-only（默认）+ workflow-spec（`.appsec/config.json.execution_mode = "workflow-spec"`，§16.11 14-step authoring contract）|

> **Subsystem hook scope clarification**：AppSec / QA / UIUX / L12 hooks are **project-installed-only**。各 SDK 的 `init` 是 canonical hook-installer（缺 `<sub>` config 自动建 → 复制 project-local hooks 进 `<project>/.claude/hooks/` → merge `<project>/.claude/settings.json`，全部经唯一 helper `orchestrator-runtime/shared/install-subsystem-hooks.js` 读 `manifests/hook-registry.json` 完成）：`bash ~/.claude/scripts/appsec-sdk.sh init` / `qa-sdk.sh init` / `uiux-sdk.sh init` / `python ~/.claude/skills/discoverability-orchestrator/scripts/discoverability-sdk.py --project-root . init`。`claude-env-bootstrap` EXECUTE §7.1a 在子系统入选时**自动**跑对应 init（2026-05-30 起，hooks 为 project-local 自包含，随 repo clone/commit 走）。Fresh project 无对应 config file 时 **NO subsystem-hook enforcement**，只有 GSD hooks 全局 fire。详 [CANONICALS.md D3](docs/CANONICALS.md#d3--hook-scope-project-installed--clarify-docs)。

### 3.5 Workflow-spec 迁移范围锁定（2026-05-29 user lock）

只有 **AppSec + QA** 两条主线迁移到 workflow-spec 双模式。其余主线保持 SKILL-direct 单模式。决策摘要：

| Orchestrator | workflow-spec? | 为什么 |
|---|---|---|
| `appsec-security-orchestrator` | ✅ dual-mode（F verdict） | 4 个 custom appsec-* agents 全 runtime-PROVEN；7 个 presets + 8 schemas 全产物落地；preview gate + spec_hash + resume 经 P0 实跑验证 |
| `enterprise-qa-testing` | ✅ dual-mode（F with deferred live coverage） | B.1.g 落定 §18.5 14-step launch contract + qa-sdk spec.hash / sentinel.write 命令 + cold-start customs wiring audit；6 presets + 12 schemas + 12 prompts |
| `idea-to-requirements-orchestrator` (I2R) | ❌ stays SKILL-direct | 需求前端、GSD 上游；all-opus 9 个 i2r-* agent + 10 mode subskill + project-local i2r.py SDK（$0）+ 8 个 project hooks + 1 个 shared lib（`_i2r-common.js`）（gate 在 `runs/i2r/` 存在与否，**无 config 文件**——刻意变体）；santa-loop 双评审 + bounded repair loop 是 inherently interactive，单 pass DAG workflow-spec 覆盖不了 |
| `gsd-pipeline-orchestrator` | ❌ stays SKILL-direct | 33 gsd-* agents 已通过 SKILL 主线 + slash command 派发良好；多周期 checkpoint 模式（gsd-debug-session-manager / gsd-ui-checker BLOCK/FLAG）不适合单 pass DAG workflow-spec |
| `uiux-product-orchestrator` | ❌ stays SKILL-direct | L3 风格互斥 + collection skill / workflow skill 边界 + 多风格自动匹配是 inherently interactive 模式，单 pass workflow 无法覆盖 |
| `discoverability-orchestrator` (L12) | ❌ stays own track | 已有 GSD-lite Harness v1.0：discoverability-sdk.py 10 命令 + 3 disc-* agents + 5 项目 hooks + 8-step self-dispatch；equivalent governance properties，无需第二套机制 |
| `claude-env-bootstrap` | ❌ N/A | manual-first，一次性 setup procedure，无 graph 编排需求 |

迁移决策以本节为准（历史详档已随 Desktop/architecture 清理移除；平台事实单一真相源见 [docs/native-capabilities.md](docs/native-capabilities.md)）。

### 3.6 Dual-mode 触发与边界

**AppSec dual-mode**：
- prompt-only（默认）→ SKILL §6 / §16.4 9-step inline dispatch；调用 `appsec-sdk evidence.append` / `gate.check` 持久化
- workflow-spec → SKILL §16.11 14-step authoring contract：classifier → preset pick → inline → spec_hash → preflight → preview → user approval → sentinel.write → `Workflow({scriptPath: "~/.claude/workflows/appsec-orchestrator.js"})`
- 触发条件：`.appsec/config.json.execution_mode == "workflow-spec"` AND `Workflow` 工具可用
- Preview gate：`~/.claude/hooks/appsec-preview-gate.js`（sentinel + spec_hash + ttl）

**QA dual-mode**：
- prompt-only（默认）→ SKILL §6 9-step inline dispatch；调用 `qa-sdk evidence.append` / `gate.check`
- workflow-spec → SKILL §18.5 14-step launch contract：风险分类 → preset pick → inline → resolved_model + spec_hash → preflight → preview → user approval → `qa-sdk sentinel.write` → `Workflow({scriptPath: "~/.claude/workflows/qa-orchestrator.js"})`
- 触发条件：`/qa-quick-check` / `/qa-focused-gate` / `/qa-release-readiness` / `/qa-commercial-cert`（**已落地为真 slash command**：`~/.claude/commands/qa-*.md`，2026-05-29）任一 OR `.qa/config.json.execution_mode == "workflow-spec"` → SKILL 主线响应并走 §18.5。
- Preview gate：`~/.claude/hooks/qa-preview-gate.js`（sentinel + spec_hash + ttl + commercial-cert budget approval）
- **commercial-cert 强制 budget approval**：sentinel 必含 `approved_estimate_high` 数字 + approval-text 含 approved/approve/批准/确认/同意 任一

**Mode-asking 默认行为**：当 mode 不明确时，SKILL 主线问用户："请选 (1) prompt-only 快速 review，(2) workflow-spec 完整 audit + evidence persist；commercial-cert 必须 (2) 且需 budget approval。"

**AppSec v3.0**（2026-05-25 — GSD-lite execution engine + Phase 6 扩展）：
- 对齐 NIST CSF 2.0 六功能（Govern / Identify / Protect / Detect / Respond / **Recover**）
- 路由 6-layer capability map（governance / app / platform / operations / response / compliance）
- 标准升 ASVS 5.0（V1-V17，旧 V2-V13 标识符已 deprecated）
- **25 个 sub-skill 已落地**（28 个 AppSec-family 含 dual pentest gates + GSD adapter；计数按下方实际枚举列表重算——2026-06-15 Wave A 落 +4 后 = 23 sub-skill / 26 family；本次 Wave B +2 new sub-skill（`dast-authenticated` / `security-pentest-exploitation-planning`）= 25 sub-skill / 28 family；2026-06-10 新增 `security-app-api` / `security-platform-supply-chain` / `security-compliance-privacy`；2026-06-14 新增 `security-response-red-purple-team`（红/紫队 ATT&CK 覆盖, planning-only）/ `security-viz`（安全可视化生成器）；2026-06-15 Wave A 新增 4 个、Wave B 新增 2 个见下）：
  - governance: `security-governance-threat-modeling`
  - app: `security-remediation`, `dast-baseline-scanning`, `dast-authenticated`（**RED-LINE** authenticated/登录态 DAST 双 gate，wrapper-only，passive baseline 与 exploitation 之间的中间层；HARD-REQUIRES ROE + 授权 staging/preview/lab target + 时间窗 + 人工授权，绝不 auto-scan、绝不打 production）, `security-app-fuzzing`（coverage-guided 模糊测试）, `security-app-sast-deep`（深度 taint/dataflow SAST）
  - app overlay: `security-app-mobile` / `security-app-llm` / `security-app-multitenant` / `security-app-websocket` / `security-app-file-upload` / `security-app-api`
  - platform: `security-platform-secrets` / `security-platform-iac-cloud`（**deepened** — §4.5 k8s 运行时编排 Kyverno / OPA Gatekeeper / Tetragon / Security Profiles Operator，conditional-k8s，纯 defensive）/ `security-platform-supply-chain`（**deepened** — reachability 降噪 + Prowler CSPM）
  - response: `security-response-incident-response` / `security-response-recovery` / `security-response-red-purple-team`（红/紫队 ATT&CK 覆盖，planning-only，永不执行攻击）/ `pentest-scope-and-roe`（**deepened** — P6：`appsec-sdk retest.append` retest gate + 14 段企业 pentest-report 模板）/ `authorized-pentest-validation`
  - pentest: `security-pentest-recon-scan`（模板化 recon+授权扫描）, `security-pentest-ai-redteam`（AI/agentic 红队）, `security-pentest-exploitation-planning`（exploitation / adversary-sim **planning-only** 参考，Metasploit / Sliver / Caldera / Pacu / BloodHound；Read-only，受双 gate 约束，**绝不**当 authorized-pentest-validation 的桥、绝不自动执行）——**三者均 planning-only，受 pentest-scope-and-roe + authorized-pentest-validation 双 gate 约束，绝不自动执行攻击**
  - compliance: `security-compliance-payment` / `security-compliance-cn-data` / `security-compliance-privacy`
  - visualization: `security-viz`（从 `.appsec/` + manifest 事实源渲染安全图：AI Agent 风险图 / 漏洞看板 / 证据 dashboard / pentest scope map；render-only，**不是** arch-viz 的代码结构图）
- 共享模板库（`templates/`，数量见目录；含 threat-model-STRIDE / vuln-report / risk-register / security-test-plan / incident-response-initial / SECURITY.md / PENTEST-ROE.md，2026-06-14 新增 attack-coverage-template / overlay-checklist.template / security-policy.template / asset-inventory.schema / data-classification.schema / control-matrix.template / authz-matrix.schema / threat-model.schema.json / pentest-report.template）
- **2026-06-14 企业级加固**：①通用**计划预览卡**（§0.6，执行前出 表+点线图 等确认）②渗透测试**主动提醒**（§16.9.5，AppSec 跑完自动弹 pentest 建议卡，调用仍 100% 手动）③7 个新 `appsec-sdk` 命令（`asset.inventory` / `data.classify` / `authz.matrix` / `attack.coverage` / `pentest.recommend` / `control.coverage` / `audit.package`）④企业 fact-source 模板（见上）⑤overlay-checklist BLOCK trap 修复（file-upload/multitenant/websocket/mobile 现可满足 §16.9 gate）⑥pentest 富化（type-matrix / box-selection / AI-Agent pentest / retest gate / 14 段企业报告模板）。参考库（OWASP/NIST/MITRE/工具官方资料）staged 于 `Desktop/harness building/ref/`，按需吸收进 `references/`。
- Standardized finding schema（详 `appsec-security-orchestrator §9`）— 所有下游 security-remediation 必须接此 schema
- **Routing regression test harness** at `~/.claude/tests/appsec-routing/` — 23 个 routing fixture 验证激活 / 拒绝 / 边界 / schema / handoff
- **Hook 范围**：AppSec project hooks（枚举与触发以 `manifests/hook-registry.json` 为准——文档不写死数量，防 drift）通过 `appsec-sdk init` 注册到 `<project>/.claude/settings.json`，**不是 user-global** —— fresh project 无 `.appsec/config.json` 时 0 enforcement（只有 GSD hooks 全局 fire）

**Pentest 双 gate**（security testing 特殊路径，绝不自动）：
- `pentest-scope-and-roe`（visible governance，allowed-tools: Read only，落盘走 `pentest-scope-planner` agent 不自己 Write）：强制起草 ROE
- `authorized-pentest-validation`（manual-only，disable-model-invocation: true）：ROE 完成后用户 explicit `/authorized-pentest-validation` 才调

**禁止改名**（safety-critical skill names 即 control surface）：
- `pentest-scope-and-roe` / `authorized-pentest-validation` / `dast-baseline-scanning` 三个名字写死，重命名 = 打掉 safety gate

**铁律**：
- L3 风格互斥（taste / luxury / brutalist 一次只挂一个；taste 含 §11 三档变体 Editorial/Double-Bezel/GSAP）
- Collection/大而全 skill 永远不抢 narrower skill
- Workflow skills（redesign / image-to-code）永不当 L3 主风格
- 详细 13-Layer + 20-Route + 消歧表 → 见 [SKILLS-INDEX.md](SKILLS-INDEX.md)
- **L12 Discoverability**（SEO/AEO/GEO/ASO）是 UIUX 下游 release gate，入口 `discoverability-orchestrator` → 见 [docs/L12-DISCOVERABILITY.md](docs/L12-DISCOVERABILITY.md)

### 3.7 Governed Gate Mode（2026-05-29 post-4.8 加固 — Dynamic Workflows / ultracode 边界）

> **起因**：Claude Code 2.1.154 引入 Dynamic Workflows（模型现场写 workflow 脚本 + ultracode 自动编排）。它对探索/迁移/研究极有价值，但**不可复现、无 spec_hash、无法被人类按 hash 预先签字** —— 因此**绝不能进 release/安全/合规 gate 的 verdict 路径**。平台机制层（fan-out / subagent / resume / Dynamic Workflows）归平台；治理签字层（spec_hash 审批 / 证据链 / redaction / ROE）永远归我们，且越升级越加固。详 `docs/native-capabilities.md`（platform facts 单一真相源）。

**Governed gate = 以下任一**：`appsec-security-orchestrator` release/commercial gate、`enterprise-qa-testing` release-readiness / commercial-cert、`pentest-scope-and-roe` / `authorized-pentest-validation`、`/gsd-ship` release gate。

在 governed gate 里：

1. **Dynamic Workflows / ultracode 只能当侦察兵**：可产出*候选发现 / 候选迁移草案 / 候选测试矩阵*，**绝不产出 release verdict**。verdict 只能由 deterministic spec-runner（`appsec-orchestrator.js` / `qa-orchestrator.js` 走固定 spec.phases）+ `spec_hash` 人类审批 + evidence bundle + `appsec-sdk gate.check` / `qa-sdk gate.check` 产出。
2. **候选 → 签字回路**：`Dynamic Workflow → 候选 inventory/草案 → deterministic spec builder → spec_hash → preview → 人类 approve → governed runner`。侦察兵的产物必须喂回 spec-runner 走验证/证据/审批，不得直接落地为 gate 结论。
3. **`allow_dynamic_workflow` spec 字段**：默认 `false`（缺省即 false）。governed preset（release-readiness / commercial-cert / l3-payment / incident-response / pentest）**必须** false。该字段进 `spec_hash`，审批即锁定。preview-gate 见 `true` 直接拒。
4. **禁止 "Yes, and don't ask again"**：governed gate session 里 Workflow 审批不得弱化/记忆 consent（4.8 Auto/ultracode/`-p`/SDK 场景下原生审批会被跳过 → 不能依赖它当人类签字）。
5. **主动拦截**：`governed-gate-workflow-guard.js`（PreToolUse[Workflow]，随 `appsec-sdk init` / `qa-sdk init` 项目级安装）—— governed 项目里 active gate 期间，Workflow 工具只允许用已批准的 `scriptPath`/`name` 启动 deterministic runner，**拦截 model 写的 inline `script`**（即 Dynamic Workflow / ultracode 自动编排）。non-governed 项目静默 NO-OP。
6. **Saved workflows review gate**：`~/.claude/workflows/*.js` 存档的 workflow 必须带 governance frontmatter（`reviewed_by` / `reviewed_at` / `allowed_scope: exploration|migration|research` / `release_gate_allowed: false` / `destructive_ops_allowed: false`）。没有 `release_gate_allowed: true` + 人类 review 的 saved workflow 不得用于 gate verdict。

**4.8 honesty/judgment gain — re-tune，不 remove**：模型更诚实 → adversarial 脚手架（santa-loop 双盲、多视角 critique、冗余 verify）可以**减轮次**；但 redaction attestation / spec_hash 审批 / ROE sign-off / evidence-bundle 完整性 / CSF·ASVS coverage 是**契约+监管义务**，不是防模型乱来的对冲 —— 一个更诚实的模型仍然**不能自签人类审批、不能豁免 redaction、不能给自己的 pentest 授权**。**调轮次，留每一道 gate。**

**铁律补充**：spec-injection（bounded/parameterized dynamic over a frozen human-authored menu + preview/approval）是 gate 的正确机制，**不迁 Dynamic Workflows**（决策依据见 [docs/native-capabilities.md](docs/native-capabilities.md)；原 Desktop/architecture 审计档已清理）。

---

## 4. 硬规则（零例外）

1. **不可变性**：创建新对象，不修改现有对象
2. **不硬编码密钥**：API key / 密码 / token 必须用环境变量
3. **测试覆盖 80%+**：新功能必须有测试
4. **文件 <800 行**：超过就拆分
5. **先验证再声称完成**
6. **能自己验证的不要问用户**：curl / 查数据库 / 打开浏览器 — 能自动做就自动做
7. **不要猜测，先查证据**
8. **增量验证**：改完一个 bug 不要重跑全量
9. **检查是对的就不要放宽**：修根因，不降标准
10. **不要机械执行 reviewer 意见**：先评估实际风险
11. **提交前严格检查文件列表**：不要混入无关改动

九条工作准则（不瞎猜接口 / 寻求确认 / 以人类为准 / 复用现有 / 主动验证 / 遵循规范 / 诚实承认无知 / 谨慎重构 / 声明式编程 + 验证循环）：见 [rules/common/principles.md](rules/common/principles.md)。

### AppSec 短规则（server / API / auth / production-facing 项目必读）

- **Security is part of Definition of Done** —— 不是事后审查
- **路由顺序**：`enterprise-qa-testing` → `appsec-security-orchestrator`（defensive） → 必要时 `pentest-scope-and-roe` → `authorized-pentest-validation`（manual hard gate）
- **Active pentest 必须**：手动调用 + 完整 ROE + 11 user-visible sections (validated as 13 internal fields by orchestrator v3 §20.7 — emergency_contact / rollback as separate fields, authorization_proof as anchor) + user explicit sign-off
- **绝不执行**：destructive testing / DoS / persistence / credential theft / exfiltration / stealth / out-of-scope scanning
- **ASVS 引用**：用 ASVS 5.0 版本化标识符（`v5.0.0-<chapter>.<sub>`），不用 4.x V2/V3/V4 旧标签
- **CSF 2.0 六功能**：Govern / Identify / Protect / Detect / Respond / **Recover**（Recover 不可忽略，BCP/DR/backup-validation 是 organizational resilience 核心）
- **OWASP LLM Top 10 不够覆盖 Agentic AI**：agentic 系统需独立设计 tool-perm boundaries / memory poisoning / indirect prompt injection / evals / human override / rollback
- **Secret scan 强制 --redact**：`gitleaks detect --source . --log-opts="--all" --redact --report-format json`，禁止在 chat / log / report 出 raw secret
- 详细 path-scoped rule：见 [rules/security-appsec.md](rules/security-appsec.md)

### Orchestration Hygiene (plan-phase / threat-model 专属) — 2026-05-26 加入

**仅适用** orchestrator 编排 `gsd-plan-phase` / threat-model 阶段时。**跳步 = 漏 bug 的常见根因**——触发起因见本节末。

1. **Platform skill 强制注入（plan 阶段）**：调 `gsd-planner` agent 前必读 `.planning/PROJECT.md` Tech Stack + `.claude/manifest.json`，把对应 skill 注入 planner `<files_to_read>`（Vercel→`vercel-nextjs`+`vercel:vercel-functions`+`vercel:routing-middleware`；Supabase→相关 skill+`rules/web/security.md` RLS 段；Stripe→`security-compliance-payment`；Docker/k8s/IaC→`env-parity-baseline`；Claude API→`claude-api`）。详 `~/.claude/skills/gsd-pipeline-orchestrator/SKILL.md` `<planner_context_discipline>` 段。
2. **Plan-checker 强制启用**：`gsd-plan-phase` workflow Step 10 (`gsd-plan-checker`) 默认必跑。跳过须用户 explicit `--skip-verify` + 写入 `.planning/STATE.md` Blockers/Concerns 段 + 后果说明。**绝不为"省 token"自动跳**。
3. **Reliability & Cost lens 强制叠加（threat model 阶段）**：STRIDE 6 类（attacker-centric）之外必须再跑 6 类 benign failure modes：retry storms / concurrent invocation / unbounded resource / failure cascade / cost runaway / capacity ceiling。详 `~/.claude/skills/security-governance-threat-modeling/SKILL.md` §6.5。

**起因证据**（不可遗忘）：2026-05-26 Agent Atlas Phase 1 跑 `gsd-plan-phase` 时为"省 token"跳了 Step 10 plan-checker 且没注入 `vercel-nextjs` skill → 5 个 PLAN.md 落 4 处 factual/consistency 错误（Cron POST vs GET / 日期语义不一致 / cron 并发烧钱 / Vercel IP allowlist 假阳）。

---

## 4.5. Universal Execution Discipline (适用所有任务，不限 orchestration)

> **2026-05-26 加入。提级原因：这两条不是 plan-phase 专属，是任何 task / 任何 spawn / 任何 tool call 都必须执行的硬纪律。**

任何任务（编码 / 测试 / 文档 / debug / review / planning / 数据处理 / 配置变更）都必须遵守这两条。

### 1. Parallel-vs-Serial 调度纪律

spawn 多个 agent 或发起多个 tool call 前必须先判断依赖关系：

- **能并行（互不依赖、无 write 冲突、无资源争抢）→ 必须并行**：单 message 多 Agent call / 多 Bash call / 多 Read call，最大化 wall-time 吞吐
- **必须串行（输出是下游输入 / 同文件 write race / 同资源 race）→ 必须串行**：等上游 return 再开下游
- 判断模糊不清 → 选串行（默认安全）

适用场景示例：

| 任务 | 默认动作 |
|---|---|
| 读 3 个独立文件做 audit | 并行 Read |
| 跑 3 个独立的 typecheck / lint / test | 并行 Bash |
| spawn 3 个独立 sub-agent 做 cross-AI review | 并行 Agent call |
| 改 file A → 再读改后内容 → 改 file B | 串行 Edit |
| spawn researcher → 等结果 → spawn planner | 串行 Agent call |
| 多 agent 同时改同一文件 | **禁止**（write race） |

详细规则：`~/.claude/rules/common/agents.md`。

### 2. Model Routing 强制 explicit

每次 spawn agent（用 `Agent` tool）必 explicit 指定 `model` 参数，按任务层级选：

| 任务层级 | Model | 适用 |
|---|---|---|
| **决策层** | `opus` | 架构 / 方案选型 / 复杂多步 debug / 安全合规审查 / 高质量客户交付 / 最终签发 / planner / architect |
| **执行层** | `sonnet` | 功能开发 / 测试编写 / 常规 review / 中等复杂度分析 / 大部分日常 agent 执行 / 特定 coding / 特定文件书写（已定好范围的小任务）|
| **工具层** | `haiku` | 格式转换 / 文档更新 / 简单 CRUD / 规则分类 / 字段抽取 / 批量清洗 / 简单 routing 判断 |

判断准则（**按任务复杂度 + 失败代价 + 输出用途，不按任务名字**）：
- 错了代价大、跨模块、需要权衡 → opus
- 范围清晰、已知模式、单文件 / 单功能 → sonnet
- 高频重复、纯转换、纯填表 → haiku

不 explicit 指定 = 继承 parent，可能浪费 token 或低质量。

详细规则：`~/.claude/rules/common/performance.md`。

---

## 5. 反模式

### 反模式（不要这么做）

- ❌ 跳过 `ux-principles` 直接进 production
- ❌ 同时**锁定**多个 L3 主风格（taste / luxury / brutalist 一次只锁一个；taste 含三档变体 Editorial/Double-Bezel/GSAP）—— 注：UIUX 引擎 EXPLORE 阶段出多风格**候选预览**是锁前采样，不算违规（详 `uiux-product-orchestrator` references/combination-policy.md §6）
- ❌ Collection/大而全 skill 抢 narrower skill 的活
- ❌ Workflow skill（redesign / image-to-code）当 L3 主风格用
- ❌ Auto-fire `claude-env-bootstrap` / `authorized-pentest-validation` / `anchor-prototype-wave`（这些都是 manual-first）
- ❌ 在 `ux-principles` foundation 之前强行拉起 `uiux-product-orchestrator`（UIUX 主线必须先过 ux-principles）
- ❌ 找已删除的 `frontend-pipeline` 当编排入口（已于 2026-06-02 删除，统一走 `uiux-product-orchestrator`）
- ❌ 在 governed gate（appsec/qa release / commercial-cert / pentest / ship）里让 Dynamic Workflow / ultracode 出 release verdict（只能 scout；verdict 走 deterministic spec-runner + spec_hash 审批，详 §3.7）
- ❌ AppSec 自动跑 active scan（永远 manual + ROE）
- ❌ 用 visual regression 在 baseline 不稳定时（noise > signal）
- ❌ "测试通过"声明无 terminal evidence
- ❌ 让 AI"凭感觉审计 SEO/AEO"（L12 必须 script-first，evidence 出来再让 AI 解读）
- ❌ 把 robots.txt / noindex / llms.txt 当 access control（它们是 crawler policy，访问控制走 AppSec）
- ❌ 把 `web-local-seo`（Local SEO，原 `web-geo`，2026-05-25 改名）和"GEO=Generative Engine Optimization"混用（后者归 `web-aeo`）
- ❌ 开启 Codex plugin 的 review-gate stop hook（`/codex:setup --enable-review-gate`）——官方明示会快速烧穿用量限额，且"自动循环复审"与 governed gate 人类签字哲学冲突；跨模型 review 一律手动 `/codex:review` / `/codex:adversarial-review`

---

## 6. 应急回滚

- **首选**：GitHub 同步仓库 `SensLiao/Claude-code-setting`（private）按 commit 粒度回滚任意文件；staging 在 `~/claude-config-upload`。
- 本地兜底：`~/.claude/backups/`（按日期目录）+ `settings.json.known-good-*.bak`。
- settings.json 治理键：`node ~/.claude/tools/ccswitch-guard/ccswitch-guard.js --check`（对账）/ `--capture`（重打快照）。`--restore` 会整体覆盖治理键——**先 `--check` 确认快照新鲜再用**。

---

## 7. L12 Discoverability 子层（UIUX 下游 release gate）

> 新增 2026-05-25。UIUX 主线下子层，**不是**第 6 个 primary orchestrator。

公开产物（web / docs / store listing）的"上线后被找到"治理。入口 skill：`discoverability-orchestrator`。

### 4 个 narrow skill

| Skill | 域 | 触发关键词 |
|---|---|---|
| `web-seo` | 标准 Google/Bing search | SEO / robots.txt / sitemap / canonical / structured data / Lighthouse |
| `web-aeo` | AI search / answer engines | AEO / ChatGPT Search / Claude Search / llms.txt / citability / **GEO**（AI search / Generative Engine Optimization） |
| `web-local-seo` | **Local SEO**（2026-05-25 由 `web-geo` 改名） | Local SEO / Google Business Profile / Maps / NAP / near me / 附近 / 本地服务 / 实体店 |
| `app-aso` | App Store / Google Play | ASO / app store / store listing / product page / screenshots / app keywords |

### Post-launch 测量 / CI 扩展（2026-06-15 Wave B 新增 — L12 现覆盖 pre-launch audit + post-launch measurement）

Wave B 给 3 个 narrow skill 加了**上线后**能力，L12 从"只做发布前体检"扩成"发布前 audit + 发布后测量"两段：

- `web-aeo` §20 **AI citation tracking**（AI 引用追踪 / share of voice / 是否被 Perplexity·ChatGPT 引用）—— **measurement-only，永不进 gate**
- `web-seo` §15 **tech-SEO CI gate**（unlighthouse / lighthouse-ci / lhci 整站 SEO 进 CI）—— feeds seo evidence channel
- `app-aso` §16.6 **ASO measurement**（◇mobile：keyword difficulty / install funnel / App Store Connect Analytics）—— **measurement-only**

启发式 / measurement 分数永远不能当 blocker（与既有 L12 铁律一致）；CI gate（web-seo §15）走 deterministic script，evidence 出来才解读。

### Growth-execution skill（2026-06-15 新增 — **不是第 5 个 audit channel**）

- `discoverability-growth`（auto via orchestrator）：growth / 关键词策略 / keyword strategy / content gap / 内容缺口 / 程序化 SEO / 该写什么内容。**它是 growth-execution（写什么内容 / 关键词缺口 / 程序化扩量），不引入新 evidence channel、不引入新 gate**——4 个 audit channel（seo / ai-search / local / aso）+ gate-result.yaml 不变。

### 命名陷阱

- 本体系 **GEO = Generative Engine Optimization**（路由到 `web-aeo`）
- Local SEO 已从 `web-geo` 改名为 `web-local-seo` 以消歧（2026-05-25 改名 web-local-seo）
- 行业里有项目把 AI search 叫 "GEO"——本体系一律按 `web-aeo` 处理

### 执行宪法 — Script-first, AI-last

1. Deterministic script / API / CLI（Lighthouse / curl / Search Console API）
2. Framework adapter（Next.js / Nuxt / Astro / Docusaurus / WordPress）
3. Structured evidence parser
4. AI synthesis from evidence
5. Manual AI scan 仅在无 script / API / adapter 时使用（必标 lower confidence）

### 边界（不重叠声明）

- **AppSec**：robots / noindex / llms.txt 是 crawler policy，**不是** access control。私密内容漏放给搜索引擎是 L12 标识 + escalate 给 AppSec，本子层不实施访问控制修复
- **QA**：L12 evidence 可被 `enterprise-qa-testing` 的 release evidence bundle 引用，不重叠测试策略
- **UI 设计**：L12 是 UIUX **release 下游** gate，不在前期设计阶段触发

### GSD-lite Harness v1.0（2026-05-25 升级 — orchestrator 升 v1.2.0）

L12 从 prompt-only router 升级为 **execution harness**：orchestrator self-dispatches + 3 named agents + deterministic SDK + 5 project-level hooks + tag-scoped evidence + gate-result.yaml。

| 组件 | 位置 | 作用 |
|---|---|---|
| SDK | `~/.claude/skills/discoverability-orchestrator/scripts/discoverability-sdk.py` | 10 core + `measure.pull` / `measure.compare`（measurement-only）: init / classify / audit / evidence.append / evidence.validate / gate.check / report / mark-stale / explain / status（+ measure.pull / measure.compare 不进 gate.check） |
| Agents | `~/.claude/agents/disc-{scope-classifier,evidence-validator,remediation-planner,measurement-puller}.md`（4 个，2026-06-15 加 `disc-measurement-puller` post-launch 真实指标回流） | 8-step workflow Step 1 / Step 5 / Step 6 + post-launch measurement（measurement-only，不进 gate） |
| Hooks (项目) | `~/.claude/templates/discoverability/hooks/disc-*.js` | 复制到 `<project>/.claude/hooks/` |
| Contract | `~/.claude/templates/discoverability/harness-contract.md` | ground truth；SDK / agents / hooks / orchestrator 必须对齐 |
| Config | `<project>/discoverability.config.yaml` 新增 `harness:` 段 | strict_mode / required_channels / evidence_freshness_hours / deploy_commands |

**8-step self-dispatch workflow**（SKILL.md §10）：Config → scope-classifier → SDK init → 4 narrow skills dispatch → evidence.append → evidence-validator → remediation-planner → gate.check → handoff (AppSec / QA / GSD)。

**Gate decisions**：PASS / WARN / FAIL / BLOCKED / STALE。break change vs v1.1：evidence 路径加 `<tag>` 维度（`evidence/discoverability/<tag>/{seo,ai-search,local,aso}.json`）。

**Safety-critical name freeze**（改名 = 打掉 safety gate）：5 skills + 3 agents + 5 hooks + 10 SDK commands。详 SKILL.md §15.1。

**Hook 范围**：5 个 L12 hooks（`disc-deploy-gate` / `disc-evidence-required` / `disc-mark-stale` / `disc-robots-sitemap-guard` / `disc-session-context`）通过 `python ~/.claude/skills/discoverability-orchestrator/scripts/discoverability-sdk.py --project-root . init` 复制进 `<project>/.claude/hooks/` 并注册到 `<project>/.claude/settings.json`，**user-global 不 fire** —— fresh project 无 `discoverability.config.yaml` 时 0 enforcement。详 [CANONICALS.md D3](docs/CANONICALS.md#d3--hook-scope-project-installed--clarify-docs)。

### 参考

- Harness contract: [templates/discoverability/harness-contract.md](templates/discoverability/harness-contract.md)
- 架构总图：[docs/L12-DISCOVERABILITY.md](docs/L12-DISCOVERABILITY.md)
- Path-scoped 规则：[rules/discoverability-l12.md](rules/discoverability-l12.md)
- 项目模板：[templates/discoverability/](templates/discoverability/)
