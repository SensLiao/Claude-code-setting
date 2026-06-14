# L12 Discoverability Harness v1.0 — Ground-Truth Contract

> **Authoritative contract for the GSD-lite execution harness.** All SDK,
> agents, hooks, orchestrator, and project runners MUST conform to this
> document. Where this document and any other doc disagree, this document
> wins until v1.1.

Version: 1.0.0
Created: 2026-05-25
Layer: L12 (UIUX subordinate)
Mission: 让 discoverability 不再是"prompt + 文档建议"，而是有 orchestrator
self-dispatch + named agents + deterministic SDK + project-level hooks +
state directory + gate-result.yaml + 可被 CI / GSD / QA 消费的 evidence。

---

## 0. Why harness, not full GSD

L12 Discoverability 本质是 reactive capability（被触发跑 audit + 输出
evidence），不是 stateful project workflow。所以**不引入** `.planning/`
phase 状态机、30+ slash commands、跨 session 项目管理。

但**纯 prompt 不可靠，纯 script 没人调用就等于不存在**。harness 思想是：
orchestrator self-dispatch + named agents + SDK + hooks + state + artifact
contract — 提供"执行外壳、状态、门禁、证据"，不提供"项目生命周期"。

---

## 1. 全景架构

```
<project-root>/
├── .claude/
│   ├── settings.json                # project-level hooks 配置
│   ├── agents/                      # 项目可选，全局 ~/.claude/agents/ 也行
│   │   ├── disc-scope-classifier.md
│   │   ├── disc-evidence-validator.md
│   │   └── disc-remediation-planner.md
│   └── hooks/                       # 5 个 disc-* hooks（从 template 复制）
│       ├── _disc-common.js
│       ├── disc-session-context.js
│       ├── disc-mark-stale.js
│       ├── disc-robots-sitemap-guard.js
│       ├── disc-deploy-gate.js
│       └── disc-evidence-required.js
│
├── scripts/
│   └── discoverability-sdk.py       # 单文件 Python，无外部依赖
│
├── discoverability.config.yaml      # project-level config + harness 段
│
├── .discoverability/
│   ├── state.json                   # active_run_tag, gate_status, stale_reasons
│   ├── runs/
│   │   └── <tag>/
│   │       ├── dispatch-log.json    # orchestrator 自记录的 8 步执行轨迹
│   │       ├── stale-reasons.json   # 历史 stale 记录
│   │       └── failures.log         # 各 step 失败 (空 ok)
│   └── cache/                       # SDK 缓存（可清理）
│
└── evidence/
    └── discoverability/
        └── <tag>/                   # 同一 tag 一次完整 audit 的产物
            ├── 00-scope.yaml        # scope-classifier 输出
            ├── seo.json
            ├── ai-search.json       # canonical channel key (web-aeo 域)
            ├── local.json           # canonical channel key (web-local-seo 域)
            ├── aso.json
            ├── evidence-validation.yaml
            ├── remediation-plan.yaml
            ├── gate-result.yaml
            └── report.md            # human-readable
```

**Tag dimension 是 v1.0 harness 新增**。`<tag>` 来源 = release tag /
commit short SHA / 显式传入。同一项目可有多个 tag 并存，state.json 指向
当前 active_run_tag。

**Canonical channel keys**:
- `seo` (web-seo)
- `ai-search` (web-aeo) — 不再用 `aeo` 作 evidence channel key 避免与
  "GEO=Generative Engine Optimization" 概念混淆；config 端仍叫 `aeo` 兼容
- `local` (web-local-seo) — config 端 `geo` block 兼容历史
- `aso` (app-aso)

---

## 2. SDK 命令契约

`scripts/discoverability-sdk.py` 单文件 Python，stdlib only（不依赖 PyYAML
等外部包；yaml 用简易 emitter + json 互转）。所有命令支持 `--config <path>`
（默认 `discoverability.config.yaml`）和 `--project-root <path>`（默认
cwd）。

### 2.1 命令清单

| Command | 副作用 | 退出码 |
|---|---|---|
| `init <tag>` | 创建 `.discoverability/runs/<tag>/`、`evidence/discoverability/<tag>/`；写 `state.json` (active_run_tag=tag, active_run=true, gate_status=PENDING) | 0 / 1 |
| `classify <tag>` | 读 config，根据 `project.type` + activation-rules 写 `evidence/discoverability/<tag>/00-scope.yaml`（active_channels / disabled_channels with reasons） | 0 / 1 |
| `audit <tag> --channel {seo\|ai-search\|local\|aso}` | scaffold：发起 channel 检查（实际 deterministic check 由项目 runner 或 narrow skill 实施）；记录 dispatch-log entry | 0 / 1 |
| `evidence.append <tag> <channel> <file>` | 把 `<file>` 内容合并/写入 `evidence/discoverability/<tag>/<channel>.json`；自动加 `source`/`schema_version` 字段 | 0 / 1 |
| `evidence.validate <tag>` | 读所有 active channel evidence，验证 source / schema / blockers；写 `evidence-validation.yaml` | 0 / 1 |
| `gate.check <tag>` | 读 config / scope / validation；写 `gate-result.yaml`；更新 `state.json.gate_status` + `last_gate_at` + `last_gate_result` | 0 PASS / 0 WARN / 1 FAIL / 2 BLOCKED / 3 STALE |
| `report <tag>` | 生成 `report.md`（human narrative，引用 evidence-validation + gate-result） | 0 / 1 |
| `mark-stale --reason "<reason>" [--file <path>]` | 更新 `state.json.gate_status=STALE`；append 到 `stale_reasons[]` 和 `.discoverability/runs/<tag>/stale-reasons.json` | 0 |
| `explain <tag> [--finding <id>]` | 输出 evidence 摘要供 AI synthesis；SDK 本身不调 LLM，只准备 input | 0 / 1 |
| `status [--tag <tag>]` | 打印 state.json + (可选) 指定 tag 的 gate-result 概要；机器可读 JSON | 0 |
| `measure.pull <tag> --provider {gsc\|ga4\|bing\|aso} <raw-export>` | **measurement-only, NOT gate inputs** — 把某 provider 的真实指标 raw export 归一化合并进 `evidence/discoverability/<tag>/measurement.json`（自动盖 `measurement_only: true`）；script-first，无指标即记 `status: skipped`，绝不编造 | 0 / 1 |
| `measure.compare <tag> --baseline-tag <baseline>` | **measurement-only, NOT gate inputs** — 对 `<tag>` vs `<baseline>` 的 measurement.json 做 per-metric 算术 delta，写 `measurement-compare.json`（`avg_position` 自动 lower-is-better）；纯算术，无 AI 解读 | 0 / 1 |

### 2.2 退出码语义（gate.check 专用）

| Code | 含义 |
|---|---|
| 0 + stdout decision=PASS | 全部 required channel 通过 |
| 0 + stdout decision=WARN | 仅 warn-only finding |
| 1 | FAIL（required channel 有 blocker，evidence 完整） |
| 2 | BLOCKED（evidence 缺失 / schema 无效 / required channel 无 deterministic source） |
| 3 | STALE（state.json gate_status=STALE，需要 rerun） |

CI 把 `fail-on=blocker` 时映射为：`exit 0`/`1`/`2`/`3` 全部为非 PASS，
build 失败；hook deploy-gate 把 1/2/3 全部当作 block。

### 2.3 stdout 契约（机器可读）

每个命令最后一行输出严格的 JSON 单行（其他行可以是 human log 到
stderr），CI / hook 可以 `tail -1` 取结果：

```json
{"command":"gate.check","tag":"v1.0.0-rc1","decision":"PASS","exit_code":0,"channels":{"seo":"PASS","ai-search":"WARN","local":"SKIPPED","aso":"SKIPPED"}}
```

### 2.4 Post-launch measurement 产物（measurement-only，**不进 gate.check**）

> 加入 2026-06-15（additive，不破坏现有 schema）。L12 的 audit 侧是 **pre-launch**（站点是否有对的 robots/metadata/llms.txt/citability 形状）；measurement 侧是 **post-launch**（上线后真实发生了什么）。两者严格分离。

- `measure.pull` / `measure.compare`（§2.1）产出 `measurement.json` / `measurement-compare.json`，**与 audit evidence 同住** `evidence/discoverability/<tag>/` 下的同一 `<tag>` 目录（raw export 落 `<tag>/raw/`）。
- 两个文件都带顶层 `measurement_only: true` 标记，**被 `gate.check` 完全忽略**——它们 **不是** gate input、**不**参与 `gate-result.yaml` 的 decision、**不**触发 `state.json.gate_status` 变更。
- 不引入任何新的 gate-result 词表（PASS/WARN/FAIL/BLOCKED/STALE 不变），**不**引入新的 channel key（seo/ai-search/local/aso 不变）。measurement 是 audit gate 之外的并行只读数据流。
- 真实指标 100% 来自官方免费 API/CLI（GSC / GA4 / Bing Webmaster / App Store Connect Analytics），由 `disc-measurement-puller` agent 拉取；无凭证 → `status: skipped`，绝不编造数值（详 agent 定义 + §8.2 script-first 红线）。

---

## 3. state.json schema

路径：`<project-root>/.discoverability/state.json`

```json
{
  "_schema_version": "1.0.0",
  "active_run_tag": "v1.0.0-rc1",
  "active_run": true,
  "gate_status": "PENDING",
  "stale_reasons": [
    {
      "reason": "metadata.ts changed after last gate",
      "file_path": "app/metadata.ts",
      "marked_at": "2026-05-25T15:00:00Z",
      "marked_by": "disc-mark-stale-hook"
    }
  ],
  "last_gate_at": "2026-05-25T14:30:00Z",
  "last_gate_result": "PASS",
  "last_gate_evidence_hash": "sha256:...",
  "config_path": "discoverability.config.yaml",
  "config_hash": "sha256:...",
  "harness_version": "1.0.0"
}
```

**字段说明**：

| Field | Type | 说明 |
|---|---|---|
| `_schema_version` | string | semver；harness 本身的契约版本 |
| `active_run_tag` | string \| null | 当前 active run tag；`null` = 无 active run |
| `active_run` | bool | 是否有 active run（false 时 stop hook 不触发 evidence-required） |
| `gate_status` | enum | `PENDING` \| `STALE` \| `PASS` \| `WARN` \| `FAIL` \| `BLOCKED` |
| `stale_reasons[]` | array | append-only；list of stale events |
| `last_gate_at` | ISO8601 | 上次 gate.check 时间 |
| `last_gate_result` | enum | 同 gate_status |
| `last_gate_evidence_hash` | string | evidence/discoverability/<tag>/ 内容 SHA256，用于 stale 检测 |
| `config_path` | string | config 文件相对路径 |
| `config_hash` | string | config 文件 SHA256，config 变更 → mark stale |

---

## 4. gate-result.yaml schema

路径：`evidence/discoverability/<tag>/gate-result.yaml`

```yaml
_schema_version: "1.0.0"
tag: "v1.0.0-rc1"
generated_at: "2026-05-25T15:30:00Z"
generated_by: "discoverability-sdk gate.check v1.0.0"

# Final verdict
decision: PASS                # PASS | WARN | FAIL | BLOCKED | STALE
hard_block_reasons: []        # populated when BLOCKED
fail_reasons: []              # populated when FAIL (required channel blocker)
warn_reasons: []              # populated when WARN (advisory)

# Per-channel breakdown
channels:
  seo:
    state: required           # required | optional | disabled | warn_only | conditional_local
    enabled: true
    decision: PASS            # PASS | WARN | FAIL | BLOCKED | SKIPPED
    blockers: []
    warnings: []
    evidence_path: "evidence/discoverability/v1.0.0-rc1/seo.json"
    source: script            # script | api | framework_adapter | manual_ai_scan
    deterministic_source_present: true
    finding_count:
      blocker: 0
      warn: 2
      info: 5

  ai-search:
    state: warn_only
    enabled: true
    decision: WARN
    blockers: []
    warnings:
      - id: aeo-llms-txt-missing
        detail: "Project type 'b2b_saas_marketing' — llms.txt is optional warn_only."
    evidence_path: "evidence/discoverability/v1.0.0-rc1/ai-search.json"
    source: manual_ai_scan    # ⚠ flagged in evidence-validation
    deterministic_source_present: false   # ⚠
    finding_count:
      blocker: 0
      warn: 3
      info: 1

  local:
    state: disabled
    enabled: false
    decision: SKIPPED
    skipped_reason: "conditional_local trigger evaluated FALSE (no physical_locations and no service_areas)"

  aso:
    state: disabled
    enabled: false
    decision: SKIPPED
    skipped_reason: "project type is b2b_saas_marketing, no mobile app"

# Where to route findings (filled by remediation-planner agent)
remediation_handoff:
  frontend: [seo-canonical-loop-fix]
  uiux: []
  growth: [ai-search-content-clarity]
  mobile: []
  appsec: []                  # ⚠ populated only when private-leak found
  qa: [include-gate-result-in-release-bundle]

# Stale detection
config_hash: "sha256:..."
evidence_hashes:
  seo: "sha256:..."
  ai-search: "sha256:..."
  local: null
  aso: null

# Reference
config_path: "discoverability.config.yaml"
scope_path: "evidence/discoverability/v1.0.0-rc1/00-scope.yaml"
validation_path: "evidence/discoverability/v1.0.0-rc1/evidence-validation.yaml"
```

### 4.1 Decision 决策算法

```
1. 如果 state.json.gate_status == STALE → decision = STALE, exit 3
2. 对每个 channels[c].state == required:
   - 如果 evidence_path 不存在或 evidence 全部 source=manual_ai_scan
     → decision = BLOCKED, append "channel <c>: no deterministic evidence"
   - 如果 evidence 包含 blockers[]
     → decision = FAIL, append blockers
3. 任何 warn → 累计到 warn_reasons[]
4. 如果 decision 还是 PASS 且 warn_reasons 非空 → decision = WARN, exit 0
5. 没有 reason → decision = PASS, exit 0
```

### 4.2 严禁

- 任何 `ai-search` 域的 `citability_score` / `aeo_score` / `geo_score`
  数值类 finding **不得**作为 blocker，只能 warn_only / info（AI search
  生态官方 ranking factor 未公开）
- `llms.txt` missing 仅 `api_with_public_docs` / 显式 docs-heavy 项目 →
  blocker；其他项目 → warn_only（与 rules/discoverability-l12.md §llms.txt
  grading 表对齐）
- Local SEO 合规红线（fake address / review gating / NAP conflict） →
  blocker
- ASO listing required field（icon / screenshots / privacy policy） →
  blocker

---

## 5. discoverability.config.yaml 新增 harness 段

在现有 v1.1.0 config 之上扩展（不破坏旧 schema）：

```yaml
_schema_version: "1.0.0"
version: 1

# ... 已有 project / public_surfaces / channels / crawler_policy / ... 不变

# ----- NEW v1.0 harness section -----
harness:
  _schema_version: "1.0.0"
  enabled: true                # 关闭则全部 hooks silent exit
  strict_mode: true            # false → 所有 hook 降级 advisory
  required_channels: []        # 空 = 从 channels.*.state==required 自动导出
  evidence_freshness_hours: 24 # evidence 超过此时长视为 stale
  block_on_stale_in_deploy: true
  active_release_tag_source: "git-describe"  # git-describe | manual | env:VAR

  # Hook 行为粒度（每个 hook 单独可关）
  hook_modes:
    session_context: advisory  # off | advisory
    mark_stale: state-update   # off | state-update
    robots_sitemap_guard: block-obvious  # off | block-obvious | block-all-changes
    deploy_gate: block         # off | warn | block
    evidence_required: block   # off | warn | block

  # deploy 命令白名单（哪些 Bash 命令触发 deploy_gate）
  deploy_commands:
    - "vercel deploy"
    - "vercel --prod"
    - "netlify deploy --prod"
    - "wrangler deploy"
    - "firebase deploy"
    - "pnpm release"
    - "npm run deploy"
    - "gsd-ship"
```

---

## 6. Agent IO 契约

### 6.1 disc-scope-classifier

**Input**:
- `discoverability.config.yaml` path
- `tag`

**Output** (写到 `evidence/discoverability/<tag>/00-scope.yaml`):

```yaml
_schema_version: "1.0.0"
tag: "v1.0.0-rc1"
classified_at: "2026-05-25T15:00:00Z"
classified_by: "disc-scope-classifier"

project_type: b2b_saas_marketing
public_surfaces:
  - url: "https://example.com"
    type: marketing_landing
    owner: frontend
  - url: "https://example.com/docs"
    type: docs
    owner: frontend

active_channels:
  seo: required
  ai-search: warn_only
  local: not_applicable
  aso: not_applicable

geo_resolution:
  input_term_observed: null   # 用户消息里出现的 "GEO" 字面，无则 null
  resolved_to: null           # ai-search | local | null
  reason: null

disabled_reasons:
  local: "conditional_local trigger evaluated FALSE (no physical_locations and no service_areas)"
  aso: "project_type b2b_saas_marketing has no mobile app"
```

### 6.2 disc-evidence-validator

**Input**:
- `evidence/discoverability/<tag>/00-scope.yaml`
- `evidence/discoverability/<tag>/{seo,ai-search,local,aso}.json`
- `discoverability.config.yaml`

**Output** (`evidence-validation.yaml`):

```yaml
_schema_version: "1.0.0"
tag: "v1.0.0-rc1"
validated_at: "2026-05-25T15:20:00Z"
validated_by: "disc-evidence-validator"

by_channel:
  seo:
    status: PASS
    schema_match: true
    deterministic_source_present: true
    command_evidence_present: true
    findings_count: {blocker: 0, warn: 2, info: 5}
    hard_rule_violations: []
    notes: ""
  ai-search:
    status: WARN
    schema_match: true
    deterministic_source_present: false
    command_evidence_present: false
    findings_count: {blocker: 0, warn: 3, info: 1}
    hard_rule_violations:
      - "all_evidence_manual_ai_scan_no_deterministic_fallback"
    notes: "All AEO findings came from manual_ai_scan; should add at least one framework_adapter or script-based evidence."
  local:
    status: SKIPPED
    skipped_reason: "channel disabled in scope"
  aso:
    status: SKIPPED
    skipped_reason: "channel disabled in scope"

overall_evidence_confidence: medium
release_decision_input: WARN  # PASS | WARN | FAIL | BLOCKED
appsec_handoff:
  required: false
  findings: []
```

### 6.3 disc-remediation-planner

**Input**:
- `evidence/discoverability/<tag>/{seo,ai-search,local,aso}.json`
- `evidence-validation.yaml`

**Output** (`remediation-plan.yaml`):

```yaml
_schema_version: "1.0.0"
tag: "v1.0.0-rc1"
generated_at: "2026-05-25T15:25:00Z"
generated_by: "disc-remediation-planner"

tasks:
  frontend:
    - id: seo-canonical-loop-fix
      severity: warn
      domain: seo
      title: "Fix canonical chain on /pricing → /pricing/ → /pricing"
      evidence_ref: "seo.json#/findings/3"
      suggested_fix: "Remove trailing-slash redirect or set canonical to non-slash variant"

  uiux:
    - id: aeo-answer-block-clarity
      severity: warn
      domain: ai-search
      title: "Lead paragraph on /docs/quickstart should answer 'what is X' in <100 words"
      evidence_ref: "ai-search.json#/findings/1"

  growth: []

  mobile: []

  appsec: []           # populated only on private-content-indexed / llms.txt-leaks-secret
  qa:
    - id: qa-bundle-attach
      title: "Reference gate-result.yaml in release evidence bundle"
      handoff_to: "enterprise-qa-testing/qa-evidence-bundle"

priority_order:
  - {id: seo-canonical-loop-fix, owner: frontend, severity: warn}
  - {id: aeo-answer-block-clarity, owner: uiux, severity: warn}
```

---

## 7. Hook 行为契约

所有 hook 必须遵守：

1. **第一步检查 `discoverability.config.yaml` 是否存在** — 不存在则
   silent exit 0；存在但 `harness.enabled=false` 也 silent exit 0
2. **第二步检查 `harness.strict_mode`**：
   - `true` → 按下方 blocking 行为
   - `false` → 全部降级 stderr 警告 + exit 0
3. **`stop_hook_active=true` 时立即 exit 0**（避免 Stop loop）
4. **stdin JSON parse 失败时 fail-closed**（block hook 输出 block，其他
   exit 0 + stderr 警告）
5. **绝不读 `.env*` / secrets / credentials** — settings.json deny list
   已覆盖

### 7.1 disc-session-context (SessionStart, advisory)

```text
Event: SessionStart
Check: discoverability.config.yaml exists
Action:
  - exit 0 with additionalContext via JSON:
    {
      "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": "L12 Discoverability harness enabled in this repo.
          Active tag: <tag from state.json or 'none'>.
          Gate status: <gate_status>.
          If you change public surface / metadata / robots / sitemap / store
          listing, run `python scripts/discoverability-sdk.py gate.check <tag>`
          before claiming done."
      }
    }
Never blocks.
```

### 7.2 disc-mark-stale (PostToolUse Edit/Write, state-update)

```text
Event: PostToolUse, matcher: Edit|Write
Check: discoverability.config.yaml exists
Trigger files (regex any match):
  - robots.txt$ | sitemap.*.xml$
  - app/robots.ts | app/sitemap.ts | app/sitemap/.*
  - app/metadata.ts | pages/metadata.ts
  - app/layout.tsx | app/.*/layout.tsx
  - app/head.tsx | app/.*/head.tsx
  - llms.txt | llms-full.txt
  - app/structured-data/.* | schema.org/.*\.json
  - **/jsonld.*
  - public/robots.txt | public/sitemap.xml | public/llms.txt
  - fastlane/metadata/.*
  - app-store/.*\.(json|md|yaml|yml)
  - google-play/.*\.(json|md|yaml|yml)
  - store-listing/.*
  - discoverability.config.yaml
Action:
  - Update .discoverability/state.json:
    - gate_status: "STALE"
    - append stale_reasons[]: {reason, file_path, marked_at: now, marked_by: "disc-mark-stale-hook"}
  - exit 0 with brief stderr advisory: "[disc-mark-stale] marked gate as STALE due to <file>; rerun audit + gate.check before deploy."
Never blocks (PostToolUse cannot undo).
```

### 7.3 disc-robots-sitemap-guard (PreToolUse Edit/Write, block-obvious)

```text
Event: PreToolUse, matcher: Edit|Write
Check: discoverability.config.yaml exists
Targets: robots.txt | sitemap.xml | app/robots.ts | app/sitemap.ts | llms.txt
Hard-block scenarios (only these — do NOT block all changes):
  1. Production robots.txt being written with "Disallow: /" applied to
     User-agent: * (full-site deny) AND production_url matches canonical_url
     AND no "// allow-prod-deny" sentinel comment in content
  2. sitemap.xml content cannot be parsed as valid XML
  3. sitemap.xml writes a URL that matches denied-private-route patterns
     (e.g. /admin, /api/internal, /auth/, /preview/, /staging)
  4. llms.txt content contains URLs matching denied-private-route patterns
     or token-bearing query strings (?token=, ?key=, ?api_key=)
  5. robots.txt User-agent: * Disallow: targets paths under
     /admin /api/internal /preview / private patterns (handoff to AppSec —
     robots is NOT access control)
Block action:
  - stderr [disc-robots-sitemap-guard] BLOCKED: <reason>
  - exit 2 (PreToolUse block)
Otherwise pass through (exit 0).
```

### 7.4 disc-deploy-gate (PreToolUse Bash, block)

```text
Event: PreToolUse, matcher: Bash
Check: discoverability.config.yaml exists AND harness.hook_modes.deploy_gate != "off"
Match command against harness.deploy_commands[]:
  - "vercel deploy" | "vercel --prod" | "netlify deploy --prod"
  - "wrangler deploy" | "firebase deploy" | "pnpm release"
  - "npm run deploy" | "gsd-ship"
  - (project can add via config)
If not a deploy command → exit 0 pass.

If deploy command detected:
  1. Read .discoverability/state.json
  2. Read evidence/discoverability/<active_run_tag>/gate-result.yaml
  3. Block iff ANY:
     - state.gate_status == STALE
     - gate_status == BLOCKED
     - gate_status == FAIL
     - gate-result.yaml not present
     - last_gate_at older than harness.evidence_freshness_hours
     - any required channel has no evidence file
  4. In warn mode: stderr warning + exit 0
  5. In block mode: stderr block reason + exit 2
```

### 7.5 disc-evidence-required (Stop, block)

```text
Event: Stop
Check:
  - discoverability.config.yaml exists
  - state.json.active_run == true
  - stop_hook_active != true
Scan assistant text for claim patterns:
  - "discoverability done" / "discoverability complete"
  - "L12 done" / "L12 audit complete"
  - "SEO audit done" / "AEO audit done" / "ASO audit done"
  - "release ready" (only if discoverability is a release prerequisite)
  - 中文: "可发现性审查通过" / "L12 完成" / "SEO 审查完成"
If claimed but:
  - gate-result.yaml missing OR
  - gate.decision not in {PASS, WARN} OR
  - state.gate_status == STALE
Then:
  - emit Stop block JSON: {"decision":"block","reason":"..."}
  - exit 0 (Stop hook block semantics)
```

---

## 8. Orchestrator self-dispatch contract

`discoverability-orchestrator` SKILL.md v1.2 必须实现 8 步 workflow：

```
Step 0  Load discoverability.config.yaml
        if missing → enter setup mode (ask user for project_type + dump
        template); do NOT silently fabricate config
        if exists → continue

Step 1  Skill calls Agent(disc-scope-classifier)
        → writes 00-scope.yaml
        On failure → write .discoverability/runs/<tag>/failures.log,
        decision=BLOCKED

Step 2  Skill calls Bash: discoverability-sdk init <tag>
        On failure → halt + report

Step 3  Per active_channel in scope, dispatch narrow skill:
        - seo:        Skill(web-seo)
        - ai-search:  Skill(web-aeo)
        - local:      Skill(web-local-seo)
        - aso:        Skill(app-aso)
        Each narrow skill is expected to:
          - run deterministic scripts / API / framework adapter
          - write its evidence JSON to evidence/discoverability/<tag>/<channel>.json
          - never invent "AI-only" findings without script fallback

Step 4  After each narrow skill returns, run:
        discoverability-sdk evidence.append <tag> <channel> <evidence-file>
        (this normalizes / merges into canonical schema)

Step 5  Agent(disc-evidence-validator)
        reads all channel evidence + scope
        writes evidence-validation.yaml

Step 6  Agent(disc-remediation-planner)
        reads evidence + validation
        writes remediation-plan.yaml

Step 7  Bash: discoverability-sdk gate.check <tag>
        writes gate-result.yaml + updates state.json
        exit code propagates to caller

Step 8  Handoff phase:
        - if validation.appsec_handoff.required:
          escalate to appsec-security-orchestrator with payload
          {affected_urls, severity, evidence_ref}
        - if QA bundle in progress (enterprise-qa-testing active):
          emit reference {gate_result_path, report_path}
        - if GSD release-readiness phase: feed exit_code to phase verifier
```

### 8.1 Failure handling

- 任意 step 抛错 → 写 `.discoverability/runs/<tag>/failures.log`
- decision = BLOCKED + hard_block_reason = "step-N failed: <reason>"
- 永远不"伪造 PASS"
- 永远不静默吞错；orchestrator 不写 evidence 就不能宣称完成

### 8.2 反模式

- ❌ 只输出建议而不写 evidence 文件
- ❌ 跳过 Step 1（scope-classifier）直接 dispatch narrow skills
- ❌ Step 7 失败（gate=FAIL/BLOCKED）但 orchestrator 仍宣称"discoverability done"
- ❌ 让 AI "凭感觉" 在 ai-search evidence 里写出"看起来合理的"分数而无任何 script/API 兜底
- ❌ 把 manual_ai_scan 当 deterministic evidence
- ❌ 把 robots.txt / noindex / llms.txt 当 access control

---

## 9. SKILL.md / agents / hooks 名称（**禁止改名 —— safety surface**）

下列名称是 control surface（hook 通过名字识别 skill 调用、agent dispatch、
deploy gate 拦截），改名 = 打掉 safety gate：

- skill: `discoverability-orchestrator`
- skill: `web-seo` / `web-aeo` / `web-local-seo` / `app-aso`
- agent: `disc-scope-classifier`
- agent: `disc-evidence-validator`
- agent: `disc-remediation-planner`
- hook: `disc-session-context`
- hook: `disc-mark-stale`
- hook: `disc-robots-sitemap-guard`
- hook: `disc-deploy-gate`
- hook: `disc-evidence-required`

SDK command 名称（`init` / `classify` / `audit` / `evidence.append` /
`evidence.validate` / `gate.check` / `report` / `mark-stale` / `explain` /
`status`）同样冻结。

---

## 10. Versioning + 兼容性

- harness 版本独立于 orchestrator skill 版本
- 当前 harness = 1.0.0；orchestrator SKILL.md = v1.2.0（首个支持 harness 的版本）
- v1.0 harness 引入 break change：evidence path 加 `<tag>` 维度，旧
  `evidence/discoverability/{seo,aeo,geo,aso}/` 不再使用；新路径
  `evidence/discoverability/<tag>/{seo,ai-search,local,aso}.json`
- migration：旧 evidence 留在原地存档，新 run 全部走新路径

---

## 11. 与其他主线的边界（不变）

| 边界 | 谁负责 |
|---|---|
| 私密内容暴露给搜索引擎 | L12 标识 + escalate AppSec；AppSec 实施访问控制修复 |
| robots / noindex / llms.txt 当 access control | **禁止** — 这些是 crawler policy，不是安全边界 |
| Lighthouse Performance budget | rules/web/performance.md（L12 只 OWN `seo` category） |
| a11y WCAG | qa-a11y-compliance（L12 关注 alt text 仅作 image discoverability） |
| Release evidence bundle | enterprise-qa-testing/qa-evidence-bundle 引用 L12 gate-result，不重复测试 |
| Dev/staging/prod parity (robots drift) | env-parity-baseline |

---

## 12. 验收（v1.0 完成判定）

- [ ] orchestrator self-dispatch 8 步在 SKILL.md 写死
- [ ] required channel 缺 evidence → gate-result = BLOCKED
- [ ] evidence 全部 manual_ai_scan → evidence-validator 标 hard_rule_violation
- [ ] robots / sitemap / metadata 变更 → state.json gate_status=STALE
- [ ] STALE 状态下 deploy 命令 → disc-deploy-gate block
- [ ] AEO/GEO score 类 finding 永远不能成为 blocker
- [ ] llms.txt 缺失只在 `api_with_public_docs` 项目是 blocker
- [ ] Local SEO / ASO 合规红线能 block
- [ ] gate-result.yaml schema 稳定，CI 可解析
- [ ] 非 L12 项目（无 discoverability.config.yaml）→ 所有 hook silent exit
- [ ] safety-critical name list（§9）全部冻结
