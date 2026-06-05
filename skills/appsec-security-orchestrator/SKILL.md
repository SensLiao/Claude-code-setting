---
name: appsec-security-orchestrator
canonical_id: security.orchestrator
aliases: [appsec, appsec-orchestrator, security-orchestrator, security-appsec-orchestrator, security-appsec]
version: 3.0.0
status: stable
created_date: 2026-05-23
last_updated: 2026-05-25
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
forbidden-tools: WebFetch
manual_gate_required: false
disable-model-invocation: false
standards_versions:
  - OWASP ASVS: 5.0.0
  - OWASP WSTG: latest (passive only)
  - OWASP Top 10: 2025
  - OWASP API Security Top 10: 2023
  - NIST CSF: 2.0
  - NIST SSDF SP 800-218: 1.1
  - NIST SP 800-30 Rev. 1: risk assessment
  - NIST SP 800-40 Rev. 4: patch management
  - NIST SP 800-53A Rev. 5: control assessment
  - NIST SP 800-55 Vol. 1: security metrics
  - NIST SP 800-61 Rev. 3: incident response (CSF 2.0 aligned)
  - NIST SP 800-63B-4: digital identity
  - NIST SP 800-86: forensic integration
  - NIST SP 800-92: log management
  - NIST SP 800-154: threat modeling
  - NIST SP 800-190: container security
  - CIS Controls: v8.1
sensitive_data_rules:
  never_read: [".env*", "secrets/**", "*.pem", "*.key", "credentials.json"]
  never_write: ["production data", "real PII", "real payment data"]
  redact_on_output: ["tokens", "credentials", "PII", "API keys"]
upstream:
  - enterprise-qa-testing  # QA decision tree hits backend/API/auth/data
  - uiux-product-orchestrator  # production UI integrates backend
  - gsd-pipeline-orchestrator  # plan-phase needs AppSec gate
downstream:
  - appsec-reviewer  # agent for code review
  - appsec-risk-classifier  # agent (v3.0): activation + scoping
  - appsec-finding-triager  # agent (v3.0): normalize raw output to schema v1.0
  - appsec-evidence-validator  # agent (v3.0): release decision
  - security-remediation  # for finding → fix → regression test
  - dast-baseline-scanning  # passive DAST baseline
  - pentest-scope-and-roe  # if active validation requested
  - security-governance-threat-modeling  # for STRIDE / risk register
  - security-platform-secrets  # for secrets engineering review
  - security-platform-iac-cloud  # for IaC / cloud posture review
description: >
  Application Security (AppSec) orchestrator for commercial web/server projects.
  Activate immediately when a project has backend / API / auth / user-data /
  file-upload / payment / admin / multi-tenant / GenAI-agent surface, or nears
  production. v3.0 GSD-lite engine: self-dispatches named subagents, an
  appsec-sdk evidence sink, and 6 project hooks. Maps to NIST CSF 2.0 (Govern /
  Identify / Protect / Detect / Respond / Recover) over a 6-layer capability map.
  Use for threat modeling, dependency/supply-chain & SCA/secret/SAST scanning,
  auth & authorization & input-validation & API security review, OWASP ASVS 5.0
  / WSTG / API Top 10 mapping, security headers/cookies/session review,
  remediation routing, DAST baseline planning. Casual: security review / is this
  secure? / check for vulnerabilities / before I deploy. Does NOT perform active
  scans — active validation is gated by `authorized-pentest-validation`.
trigger_phrases:
  - AppSec / 安全审查 / 威胁建模 / OWASP / API 安全
  - dependency audit / SAST / SCA / 安全 baseline
  - security headers / auth review / threat model / risk register
  - secret scan / supply chain / container security / IaC scan
execution_modes:
  - prompt-only:  default; §6 / §16.4 9-step inline dispatch + appsec-sdk persistence
  - workflow-spec: opt-in via .appsec/config.json.execution_mode = "workflow-spec";
                   §16.11 14-step authoring contract;
                   ~/.claude/workflows/appsec-orchestrator.js + appsec-preview-gate.js;
                   F verdict (P0 PROVEN — 4/4 appsec-* customs runtime-tested)
---

# AppSec Security Orchestrator (v3.0)

> **Execution mode: Two-track (2026-05-29 user lock)** — AppSec is **dual-mode**:
> - **prompt-only (default)** → §6 / §16.4 9-step inline dispatch + `appsec-sdk evidence.append` persistence
> - **workflow-spec (opt-in)** → §16.11 14-step authoring contract → `~/.claude/workflows/appsec-orchestrator.js` (preview gate: `~/.claude/hooks/appsec-preview-gate.js`)
> Trigger workflow-spec by setting `.appsec/config.json.execution_mode = "workflow-spec"`. Both tracks live side-by-side; not migrating wholesale. P0 PROVEN — 4/4 appsec-* customs runtime-tested. Scope details in `~/.claude/CLAUDE.md §3.5` and `<project>/.../architecture/ORCHESTRATION-STATUS.md`.

> **v3.0 (2026-05-25) — GSD-lite Execution Engine**
> AppSec orchestrator 从"输出 ASVS/CSF mapping 建议 + 给下游 markdown SECURITY.md"升级成
> "自己 dispatch 3 个 named agents + 自己落 `.appsec/evidence/` + 自己出 `appsec_release_decision.yaml` +
> 6 个项目级 hooks 物理拦 raw secret 泄露 / 未授权 active scan / pentest 越界 / 假通过 / schema 漂移 / secret 读取"。
> §1–§15 substance preserved；§7 marked DEPRECATED → use §16 Dispatch Contract.
> See §16 / §17 / §18 for the executable contracts.

> **v3.0.1 (2026-06-05) — gate.check robustness + prewrite hardening (codex cross-reviewed, additive)**
> 1. `appsec-sdk gate.check` D2 freshness：`epoch_of_iso` 改用 Node `Date.parse` 优先（shell `date` 仅 fallback）→ 跨平台稳，吃下小数秒/数字 offset，消除 macOS/BSD false-BLOCK；`decided_at` 缺失时 fallback 到顶层 `timestamp:`（仅 col-0，防误匹配嵌套键）。
> 2. `appsec-finding-schema-prewrite.js`（§18.5a）：Edit/MultiEdit 在 protected `.appsec/findings|decisions` 路径上**一律 outright block**（堵"marker 塞进 new_string 首行"局部篡改绕过）；matcher 补 `MultiEdit`（hook-registry + snippet + settings 三处 lockstep）；canonical gate-result 校验 `validateVerdict` 加 try/catch → throw/畸形结果 fail-closed exit 2（原会 exit 1 放行）；validator 缺导出时出 NOTE 不静默。
> 3. 顺手修 `dot-appsec-skeleton/hook-fixture-harness.sh` 一个 pre-cd `init` 污染 bug（从非-$T 目录跑会在 cwd 建 `.appsec/.claude`）。
> 验证：现有 fixture harness 38/38 回归 + 独立 E8 真测。

<!-- COMPACTION-SAFE-INDEX: appsec-security-orchestrator v2026-05-29 -->
## ⚑ Compaction-safe critical-contract index

> auto-compaction 后每个 skill 只保留**前 5000 tokens**、老 skill 可能被整段丢弃（Claude Code skills docs）。本 index 刻意放在 body 最前，确保以下 binding 契约即便压缩后也留在上下文。**做 workflow-spec / governed-gate 前必读这些锚点**；若 index 之后的章节正文已不在上下文，**重新 invoke 本 skill** 恢复全文再继续。
>
> - **§12 Hard Rules** — pre-dispatch 适用的不可违反硬规则。
> - **§9 Standardized Finding Schema v1.0** — 每个 finding 的 every-run 输出契约。
> - **§16.10.7 Name Freeze** — 安全关键 skill/agent/hook 名 = control surface，**绝不改名**。
> - **§16.11 Spec Authoring Contract（14-step）** — workflow-spec first action 必须设 `gate_active`，按 14 步骨架走。
> - **§16.13 Execution Preview Contract** — approval whitelist + sentinel shape 是 binding；governed gate 期间不得弱化/记忆 consent。
> - **Governed-gate 铁律（CLAUDE.md §3.7）** — Dynamic Workflow / ultracode 只能当侦察兵；release verdict 只能由 deterministic `appsec-orchestrator.js` + `spec_hash` 人审 + evidence bundle 产出。

## 目录（Table of Contents）

> 1500+ 行 governance 契约，按 §-编号导航。§16 Dispatch Contract 是运行时自-dispatch 核心；§9/§10 schema+SLA、§12 Hard Rules、§16.11/§16.13 + §18 是 keep-guard 保护面。

- §1 Mission · §2 Activation Conditions · §3 NIST CSF 2.0 Function Mapping · §4 Lifecycle Trigger Table
- §5 6-Layer Capability Map（5.1 governance / 5.2 app / 5.3 platform / 5.4 operations / 5.5 response / 5.6 compliance / 5.7 Overlay）
- §6 标准映射 Standards Mapping（6.1 ASVS 5.0 / 6.2 WSTG / 6.3 API Top 10 / 6.4 其他）
- §7 AppSec Standard Workflow（DEPRECATED → §16）· §8 Sub-Orchestrator 路由表
- §9 Standardized Finding Schema v1.0 · §10 风险分级 SLA · §11 与 Enterprise QA 接口
- §12 Hard Rules（不可违反）· §13 AppSec Release Evidence（SECURITY.md 章节）· §14 反模式 · §15 References
- **§16 Dispatch Contract（Self-Dispatching Execution Machine）**
  - §16.0 Bootstrap · §16.1 Classifier · §16.1.5 Mode Selection · §16.2 Init Release Tag · §16.3 Overlay Activation
  - §16.4 Automated Scans+Triage · §16.5 Defensive Code Review · §16.6 Threat Modeling · §16.7 DAST Decision · §16.8 Pentest Decision · §16.9 Evidence Validation + Release Decision
  - §16.10 Workflow Execution Mode · §16.11 Spec Authoring Contract · §16.12 Static→Spec Migration · §16.13 Execution Preview Contract（human-in-the-loop gate）
- §17 SDK Contract `appsec-sdk.sh`（17.1 Commands / 17.2 Exit Codes / 17.3 Safety Idioms）
- §18 Hook Contract — 6 Project-Level Hooks（18.0 Blocking Contract … 18.5 Finding schema gates … 18.7 settings snippet）
- §19 Test Plan · §20 Acceptance Criteria · §21 Risks / Caveats

---

## 1. Mission

AppSec 是 commercial quality 的一部分，**不是上线前可选的加分项**。本 v3.0 在 v2.0 的标准框架基础上（NIST CSF 2.0 六大功能、SSDF、ASVS 5.0、CIS Controls v8.1），把 orchestrator 从"说明书"升级为"执行机"。

**职责边界**：
- **路由 + 治理**：把安全工作分发到 6 个能力层 + 7 个叠加层
- **防御性审查协调**：威胁建模、依赖审计、静态分析、合规映射
- **证据契约**：标准化 finding schema + Release Evidence 输出
- **执行机（v3.0 新增）**：通过 §16/§17/§18 三个契约（Dispatch / SDK / Hook）把流程从"文档约定"变成"可机器验证的 release gate"

**不做的事**：本 skill 本身不执行任何 active scan、exploit、attack。Active validation 永远走 `authorized-pentest-validation` 手动入口，不可绕过。

---

## 2. Activation Conditions（什么项目必须激活）

以下任一条件成立即强制激活本 skill：

| 条件 | 说明 |
|---|---|
| 含 backend / server-side code | Node.js、Python、Go、Java、PHP 等任意后端 |
| 含 API endpoint | REST、GraphQL、gRPC、WebSocket、SSE |
| 含 authentication / authorization | 登录、JWT、OAuth、SSO、RBAC、ABAC |
| 处理 user data | 表单、文件上传、数据库写入、订阅 |
| 含 file upload | 任何 multipart/file 处理（路由叠加层 file_upload）|
| 含 payment | 支付接口、webhook、金额计算（路由叠加层 payment + PCI DSS）|
| 含 admin surface | 后台、elevated privilege 路由 |
| 含 multi-tenant | 租户隔离（路由叠加层 multitenant）|
| 含 GenAI / Agent | LLM 应用（路由叠加层 llm + OWASP LLM Top 10）|
| 处理中国个人信息 / 跨境数据 | 路由叠加层 cn_data（PIPL + 数据出境）|
| iOS / Android app | 路由叠加层 mobile（MASVS / MASTG）|
| 即将 production deployment | release gate 强制触发 |

**v3.0 物理标识**：项目根存在 `.appsec/config.json` 即为 "AppSec-enabled project"。无该文件 → orchestrator 触发 → silent exit + 单行 log，不产生任何噪音也不落任何 evidence。

**判断规则**：不假设"项目很小所以没有 backend"。必须明确判断，不能跳过。

---

## 3. NIST CSF 2.0 Function Mapping  →  references/standards-and-mappings.md
> Relocated (SAFE-A appendix — verbatim, not weakened; not needed to execute a run). Read on demand.

---
## 4. Lifecycle Trigger Table  →  references/standards-and-mappings.md
> Relocated (SAFE-A appendix — verbatim, not weakened; not needed to execute a run). Read on demand.

---
## 5. 6-Layer Capability Map（路由表）

> **状态约定**：✅ EXIST 独立 skill 已存在 / 🟡 PARTIAL 部分覆盖 / ⚪ NOT IMPLEMENTED 计划中

### 5.1 governance 层

| Capability | canonical_id | 当前 skill / 状态 |
|---|---|---|
| inventory | `security.governance.inventory` | ⚪ 未来 wave |
| scope | `security.governance.scope` | 🟡 `pentest-scope-and-roe`（pentest 专用） |
| threat_modeling | `security.governance.threat_modeling` | ✅ `security-governance-threat-modeling` |
| risk_assessment | `security.governance.risk_assessment` | ⚪ 模板 `templates/risk-register.md` 可用 |

### 5.2 app 层

| Capability | canonical_id | 当前 skill / 状态 |
|---|---|---|
| sast | `security.app.sast` | 🟡 §16 Step 4 内（semgrep + appsec-reviewer agent） |
| dast | `security.app.dast` | ✅ `dast-baseline-scanning` |
| iast | `security.app.iast` | ⚪ 高成熟度选项 |
| rasp | `security.app.rasp` | ⚪ 高成熟度选项 |
| sca | `security.app.sca` | 🟡 §16 Step 4 内 |
| sbom_signing | `security.app.sbom_signing` | ⚪ 未来 wave |
| cicd | `security.app.cicd` | ⚪ 未来 wave |
| remediation | `security.app.remediation` | ✅ `security-remediation` |

### 5.3 platform 层

| Capability | canonical_id | 当前 skill / 状态 |
|---|---|---|
| container_k8s | `security.platform.container_k8s` | ⚪ 未来 wave |
| iac_cloud | `security.platform.iac_cloud` | ✅ `security-platform-iac-cloud` |
| network_boundary | `security.platform.network_boundary` | 🟡 §16 Step 5 |
| iam | `security.platform.iam` | 🟡 ASVS 5.0 V6/V8/V9/V10 |
| secrets | `security.platform.secrets` | ✅ `security-platform-secrets` |
| test_environment | `security.platform.test_environment` | 🟡 在 `dast-baseline-scanning` §3 |

### 5.4 operations 层

| Capability | canonical_id | 当前 skill / 状态 |
|---|---|---|
| logging_monitoring | `security.operations.logging_monitoring` | ⚪ 未来 wave |
| vuln_patch | `security.operations.vuln_patch` | ⚪ 未来 wave |
| privacy | `security.operations.privacy` | ⚪ 未来 wave |

### 5.5 response 层

| Capability | canonical_id | 当前 skill / 状态 |
|---|---|---|
| pentest_roe | `security.response.pentest_roe` | ✅ `pentest-scope-and-roe` |
| pentest_validation | `security.response.pentest_validation` | ✅ `authorized-pentest-validation`（manual-only）|
| incident_response | `security.response.incident_response` | ✅ `security-response-incident-response` |
| recovery (CSF RC) | `security.response.recovery` | ✅ `security-response-recovery` |
| forensics | `security.response.forensics` | 🟡 `security-response-incident-response §6` 桥接 |

### 5.6 compliance 层

| Capability | canonical_id | 当前 skill / 状态 |
|---|---|---|
| audit | `security.compliance.audit` | ⚪ 未来 wave |
| metrics | `security.compliance.metrics` | ⚪ 未来 wave |
| reporting | `security.compliance.reporting` | 🟡 §16 Step 9 (appsec_release_decision.yaml) |
| payment (PCI DSS) | `security.compliance.payment` | ✅ `security-compliance-payment` |
| cn_data (PIPL + 出境) | `security.compliance.cn_data` | ✅ `security-compliance-cn-data` |

### 5.7 Overlay Skills（叠加层，按项目类型触发）

| Overlay | canonical_id | 状态 | 触发条件 |
|---|---|---|---|
| mobile | `security.app.mobile` | ✅ `security-app-mobile` | iOS / Android app |
| llm | `security.app.llm` | ✅ `security-app-llm` | GenAI / Agent |
| multitenant | `security.app.multitenant` | ✅ `security-app-multitenant` | 多租户 SaaS |
| websocket | `security.app.websocket` | ✅ `security-app-websocket` | 长连接 / SSE |
| file_upload | `security.app.file_upload` | ✅ `security-app-file-upload` | 文件上传 |
| payment | `security.compliance.payment` | ✅ `security-compliance-payment` | 支付 |
| cn_data | `security.compliance.cn_data` | ✅ `security-compliance-cn-data` | PIPL / 出境 |

---

## 6. 标准映射 Standards Mapping  →  references/standards-and-mappings.md
> Relocated (SAFE-A appendix — verbatim, not weakened; not needed to execute a run). Read on demand.

---
## 7. AppSec Standard Workflow (DEPRECATED)  →  references/deprecated-v2.md
> Relocated (SAFE-A appendix — verbatim, not weakened; not needed to execute a run). Read on demand.

---
## 8. Sub-Orchestrator 路由表

| 任务 | 路由目标 | 触发条件 |
|---|---|---|
| 激活 + scoping | `appsec-risk-classifier` agent (opus) | §16 Step 1 |
| Finding 标准化 | `appsec-finding-triager` agent (opus) | §16 Step 4 raw output normalization |
| Release decision | `appsec-evidence-validator` agent (opus) | §16 Step 9 |
| 防御性代码审查 | `appsec-reviewer` agent (sonnet → opus for L2+) | §16 Step 5 |
| 威胁建模 | `security-governance-threat-modeling` | §16 Step 6 |
| Secrets 工程管理 | `security-platform-secrets` | 含 secrets / OIDC / 凭证轮换 |
| IaC / Cloud 姿态 | `security-platform-iac-cloud` | 含 Terraform / Helm / K8s / 云资源 |
| DAST baseline | `dast-baseline-scanning` | §16 Step 7（含 web/API） |
| 修复 + 回归测试 | `security-remediation` | high+ finding |
| Pentest ROE 起草 | `pentest-scope-and-roe` | §16 Step 8（user 请求 active 验证） |
| Active 验证（手动） | `authorized-pentest-validation` | ROE 完成 + user explicit sign-off + hook 验证通过 |

**模型路由**：classifier / triager / validator / reviewer (L2+) 升 opus；常规整理留 sonnet；格式转换用 haiku。

---

## 9. Standardized Finding Schema v1.0

所有下游 skill 从本 orchestrator 接收的 finding 必须符合此 schema。**写入路径只能是 `appsec-sdk finding.add`**（§17）；其他工具直接 Write 到 `.appsec/findings/**/*.yaml` 会被 PreToolUse hook 拒绝（§18.5）。

```yaml
finding:
  schema_version: 1.0
  id: <YYYY-MM-DD>-<source>-<seq>      # 2026-05-25-sast-001
  source: sast | dast | sca | secret_scan | manual_review | pentest | external_disclosure | threat_model | iac_scan | container_scan | cloud_posture | secrets_engineering
  detector: <tool name + version>       # semgrep@1.x / gitleaks@8.x / appsec-reviewer-agent
  severity: critical | high | medium | low
  confidence: high | medium | low
  asvs_mapping: [v5.0.0-<chapter>.<section>.<requirement>]   # **^v5\.0\.0-\d+\.\d+\.\d+$**
  csf_function: GV | ID | PR | DE | RS | RC
  cwe: [CWE-<n>]
  owasp_top10: [A<n>:2025]   # OWASP Top 10:2025 IDs (2025 replaced 2021 as primary; see references/standards-and-mappings.md §6.5 + standards-crosswalk.json). Legacy A<n>:2021 labels still accepted.
  api_top10: [API<n>]
  affected:
    files: [<path:line>]
    components: [<component>]
    data_classes: [public | internal | confidential | restricted]
  exploit_likelihood: high | medium | low | theoretical
  business_impact: high | medium | low
  computed_risk: critical | high | medium | low   # 见 §10 风险分级 SLA
  description: <一句话描述>
  reproduction_steps: |
    <如适用，复现步骤；不得含 raw secret>
  evidence:
    log_excerpt: <redacted>                         # 必须走 appsec-sdk redact
    screenshot: <path>
    test_output: <path>
  remediation:
    immediate_mitigation: <如有>
    permanent_fix: <代码 / 配置改动>
    regression_test_needed: yes | no
  owner: <name | role>
  sla_due: <YYYY-MM-DD>
  status: open | in_progress | mitigated | resolved | accepted
  verification_status: pending | red_confirmed | fix_applied | green_confirmed | regression_in_ci
  test_commands: [<exact npm/pytest/cargo command used to verify>]
  risk_acceptance:                                  # only when status: accepted
    approver: <name + role>
    approval_date: <YYYY-MM-DD>
    compensating_controls: <description>
    review_date: <YYYY-MM-DD>
```

**Canonical schema rule**：本 schema 是唯一权威。所有 downstream skill / agent / template 引用 schema 字段时，必须使用本 schema 的字段名和取值范围。不允许 fork。

---

## 10. 风险分级 SLA

| 等级 | 判定条件 | 修复 SLA |
|---|---|---|
| **Critical** | 可远程利用；影响核心资产/大量敏感数据；已有活跃利用或无缓解 | **24-72 小时** |
| **High** | 可利用且影响关键业务或高价值接口 | **7-14 天** |
| **Medium** | 需特定条件；影响有限或有有效补偿控制 | **30 天** |
| **Low** | 低可利用性；主要为加固提升项 | **90 天或纳入版本规划** |

---

## 11. 与 Enterprise QA 接口

**来向**：`enterprise-qa-testing` v3.1 orchestrator 在测试矩阵决策树命中 backend / API / auth / user-data → handoff 进入本 skill。

**去向**：AppSec 完成后，`.appsec/decisions/<tag>/appsec_release_decision.yaml`（§13 + §16.9 + §17）作为 release artifact 供下游消费：
- `gsd-verify-work` / `gsd-ship`：通过 `appsec-sdk gate.check <tag> --allow-conditional` 退出码判定
- `enterprise-qa-testing`：在 release evidence bundle 中引用 `appsec_release_decision.yaml` 路径
- `gsd-secure-phase`：GSD phase-level 威胁缓解验证（保留 GSD 命名空间，不合并）

**接口文件约定**：`SECURITY.md` 放在 `.planning/` 或项目根目录（人类可读）；机器可读 release decision 放 `.appsec/decisions/<tag>/appsec_release_decision.yaml`。

---

## 12. Hard Rules（不可违反）

- ❌ **不自动执行 active scan / penetration test**
- ❌ **不读取 .env / secrets / credentials 文件内容**（PreToolUse hook §18.6 物理拦截）
- ❌ **不向第三方传递 source code / target info**（除明确授权 SaaS 且用户知情）
- ❌ **不对未授权目标做 reconnaissance 之外的操作**
- ❌ **不假设"项目无 backend 而跳过 AppSec gate"** —— 必须从 §2 明确判断
- ❌ **不把 `npm audit` 结果为零 high 解读为"安全"**
- ❌ **不改名 safety-critical skill**（`pentest-scope-and-roe` / `authorized-pentest-validation` / `dast-baseline-scanning`）
- ❌ **不在 Phase 集成后才更新路由表**
- ❌ **不把 OWASP LLM Top 10 当成 Agentic AI 安全的全部**
- ❌ **不直接 Write 到 `.appsec/findings/**` 或 `.appsec/decisions/**`** —— 必须走 `appsec-sdk` 命令（hook §18.5 物理拦截）
- ❌ **不在 chat / log / report / SECURITY.md 中输出 raw secret 值** —— Stop hook §18.1 兜底，但前向所有 agent + hook + sdk 都必须先走 `appsec-sdk redact`

---

## 13. AppSec Release Evidence（人类可读 SECURITY.md 章节）

> v3.0 起，本节描述的字段对应 **机器可读** `appsec_release_decision.yaml`（§16.9）的人类摘要视图。
> 唯一权威是 `.appsec/decisions/<tag>/appsec_release_decision.yaml`；SECURITY.md 是它的渲染版。

每次 AppSec review 完成后输出以下结构，作为 release gate 证据存档：

```markdown
# AppSec Release Evidence
项目: <name>
版本: <tag/commit>
日期: <YYYY-MM-DD>
审查者: appsec-evidence-validator@<git_sha>
ASVS Level: L1 / L2 / L3 (ASVS 5.0)
Decision: PASS / FAIL / BLOCKED / CONDITIONAL_PASS
CSF Functions covered: GV / ID / PR / DE / RS / RC

## 1. Threat Model Summary  ## 2. Risk Register  ## 3. Dependency Audit
## 4. Secret Scan (redaction.attested=true)  ## 5. SAST
## 6. Code Review Findings（按 ASVS 5.0 V1-V17）
## 7. API Security（API Top 10）  ## 8. Headers / Cookies / Session
## 9. Platform Layer（Container / IaC / IAM / Secrets）
## 10. DAST Baseline  ## 11. Pentest (如适用)
## 12. 叠加层激活清单（mobile/llm/multitenant/websocket/file_upload/payment/cn_data）
## 13. 剩余风险 + Risk Acceptance
## 14. CSF 2.0 Function Coverage（内部 evidence completeness gate，非 NIST checklist）
## 15. Recovery (CSF RC) Specifics
```

---

## 14. 反模式

- ❌ 把 AppSec 当成"运行 `npm audit` 就完事"
- ❌ 把"没有 high severity SAST 告警"当成"代码安全"
- ❌ 跳过 threat model 直接做 SAST
- ❌ ASVS / WSTG / API Top 10 / CSF 2.0 / SSDF 混用不分场景
- ❌ 把 `authorized-pentest-validation` 当作普通 QA 工具调用
- ❌ secret scan 只扫当前工作目录（需要 git history）
- ❌ 修复了 dependency 但不做回归测试
- ❌ 把 SBOM 当成"生成了文件就够"
- ❌ 把 RASP 当成 SAST/DAST 替代
- ❌ 跳过 Recover 函数（CSF RC）
- ❌ **直接 Write `.appsec/findings/` YAML**（必须走 sdk，否则 hook 拦）
- ❌ **依赖 Stop hook 单一兜底 secret redaction**（必须 PreToolUse Read|Bash 防"读出"，PostToolUse 防"落盘"，Stop 防"chat 兜底"三层叠加，见 §18.1 + §18.6）

---

## 15. References  →  references/external-links.md
> Relocated (SAFE-A appendix — verbatim, not weakened; not needed to execute a run). Read on demand.

---
## 16. Dispatch Contract（v3.0 — Self-Dispatching Execution Machine）

> **超越 §7 文字 workflow**：本节定义 orchestrator 被激活后**必须自己执行**的 10 个 Step。每个 Step 都有：
> (a) 唯一职责 / (b) 输入与输出 artifact 路径 / (c) 落盘契约 / (d) 失败行为。
> 没有 Step 跳过——只能 BLOCKED + 落盘 reason。

### §16.0 Bootstrap

- 读 `<project-root>/.appsec/config.json`
- **不存在 → silent exit**（log "non-appsec project, skipped" 单行，0 副作用，不写任何文件）
- 存在 → 读 `asvs_level` / `csf_targets[]` / `overlays[]` / `strict_mode` / `production_hosts[]` → 进 Step 1

**Capability gate** (R7 / Patch A.1.1, 2026-05-28) — execute INLINE at bootstrap.
The Skill must actually run the snippet. Don't just document it; the gate decides
whether §16.4-§16.9 (prompt-only path) or §16.11 (workflow-spec contract) runs.

```bash
# Default: prompt-only path
mode="prompt-only"; reason="default"

# Read config-declared mode if present
if [[ -f .appsec/config.json ]]; then
  cfg_mode=$(node -e "try{process.stdout.write(JSON.parse(require('fs').readFileSync('.appsec/config.json','utf8')).execution_mode||'')}catch{}")
  case "$cfg_mode" in
    workflow-spec)   mode="workflow-spec"; reason="config.execution_mode=workflow-spec" ;;
    workflow-static) mode="workflow-static"; reason="config.execution_mode=workflow-static (DEPRECATED)" ;;
    prompt|"")       mode="prompt-only"; reason="config.execution_mode=prompt-or-absent" ;;
  esac
fi

# Hard capability gates — behavior depends on whether user EXPLICITLY requested workflow-spec
explicit_workflow_spec=0
[[ "$cfg_mode" == "workflow-spec" ]] && explicit_workflow_spec=1

if [[ "${CLAUDE_CODE_WORKFLOWS:-0}" != "1" ]]; then
  mode="prompt-only"
  reason="CLAUDE_CODE_WORKFLOWS=0 (set to 1 in terminal claude to enable Workflow tool)"
  capability_blocked=1
fi
if [[ "$OS" == "Windows_NT" && "${DISABLE_TELEMETRY:-0}" != "1" ]]; then
  mode="prompt-only"
  reason="Windows requires DISABLE_TELEMETRY=1 to enable Workflow"
  capability_blocked=1
fi

# Log gate decision (single line, not user-visible by default)
mkdir -p .appsec/state
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] mode=$mode reason=$reason" >> .appsec/state/bootstrap.log

# §1.11 correction #4 (2026-05-28): fallback is NOT always silent.
# If user EXPLICITLY asked for workflow-spec but capability is blocked, ASK.
if (( explicit_workflow_spec == 1 && capability_blocked == 1 )); then
  cat <<EOF
workflow-spec mode requested in .appsec/config.json, but Workflow tool is
unavailable in this environment: $reason

Options:
  (a) fall back to prompt-only dispatch (§16.4-§16.9) for this run
  (b) abort so you can fix the env (set CLAUDE_CODE_WORKFLOWS=1 / DISABLE_TELEMETRY=1)

Please reply 'fallback' or 'abort'.
EOF
  # Skill waits for user reply. No silent downgrade on explicit workflow-spec.
fi
```

Outcome routing:
- `mode=prompt-only` (config not workflow-spec)         → §16.4 (silent, safe default)
- `mode=prompt-only` (config workflow-spec, user OK'd)  → §16.4 (after explicit ask)
- `mode=workflow-spec`                                  → §16.11 (Spec Authoring Contract)
- `mode=workflow-static`                                → §16.12 (legacy, DEPRECATED)

**Fallback policy** (§1.11 correction #4, 2026-05-28):
- `execution_mode` absent OR `prompt-only` → silent prompt-only, no warning.
- `execution_mode == workflow-spec` AND Workflow tool unavailable → **ASK** user before falling back to prompt-only.
- `execution_mode == workflow-spec` AND validate-spec / preflight FAIL → **abort** with structured error. Do NOT silently fall back.

The user sees the same evidence + decision shape regardless of dispatch mode;
the only thing they need to know is whether the new rail or the old rail
actually executed.

### §16.1 Classifier

- Invoke `Agent(subagent_type="appsec-risk-classifier", model="opus")`
- 输入：项目 file tree、package manifests、框架标记、deployment surface 线索
- 输出 YAML（直接落到 `.appsec/state.json`）：

```yaml
activate: true | false
asvs_level: L1 | L2 | L3
csf_targets: [GV, ID, PR, DE, RS, RC]
overlays: [mobile?, llm?, multitenant?, websocket?, file_upload?, payment?, cn_data?]
lifecycle_stage: design | code_pr | build_ci | preprod | preprod_release | prod_run | incident | audit
rationale: <short evidence>
```

- 写盘前必须通过 `appsec-sdk redact` —— classifier 输出禁止包含任何 raw secret 痕迹

### §16.1.5 Mode Selection（Patch A.3, 2026-05-28 — only for workflow-spec mode）

After §16.1 Classifier writes `.appsec/state.json`, in **workflow-spec mode**
the Skill picks ONE mode that drives the spec shape + budget + model mix.
The full mode catalog + ranges lives in `~/.claude/orchestrator-runtime/appsec/presets/MODES.md`.

```text
# Evaluate in order. FIRST match wins (short-circuit) — do not continue.
1. if user invokes /authorized-pentest-validation     → OUT OF SCOPE (manual path, §16.8)
2. if .appsec/state.json.lifecycle_stage == "incident" → mode = "incident-response"
3. if user explicitly asks "audit everything" / "deep sweep" /
   "quarterly" / "full audit" / "comprehensive review"  → mode = "deep-sweep"
4. if changed_lines < 100
   AND no auth/payment/user-data touched              → mode = "quick-check"
5. if release_tag matches /^v\d+\.\d+\.\d+/
   AND not pre-release suffix                         → mode = "release-gate"
6. otherwise                                          → mode = "focused-review"   (default)
```

**Cascade discipline (cross-review Item I, 2026-05-28)**:
- **First match wins.** Each rule is a short-circuit. Once a rule fires, do not
  evaluate the rest.
- **Why incident-response is first**: incident is a load-bearing operational fact;
  it overrides verbal user requests (e.g. user saying "deep sweep" during an
  active incident still routes to incident-response, NOT deep-sweep, because the
  declared lifecycle_stage is the system's authoritative signal).
- **User-explicit at rule 3 is itself short-circuiting**: if the user opts into
  deep-sweep at this point, rule 5 (release-gate) does NOT downgrade them.

**Tie-break (only when rules 4-6 produce competing signals at the same level)**:
When changed_lines < 100 (quick-check signal) AND release_tag matches
(release-gate signal), prefer the SAFER mode — `release-gate` > `focused-review`
> `quick-check`. False positive on the heavier mode wastes tokens but catches
more; false negative on the lighter mode lets bugs slip.

The tie-break does NOT apply to rules 1-3 — those always short-circuit.

The picked mode then determines:
- **preset family** (e.g. `l1-default.json` for quick-check, `l2-default.json`
  for focused-review / release-gate, `l3-payment.json` for release-gate with
  payment overlay, `incident-response.json` for incident-response)
- **finder agent count range** (`quick-check`: 1-2, `focused-review`: 2-4,
  `release-gate`: 4-8, `deep-sweep`: 8+)
- **verify vote counts** by severity (`quick-check`: 0, `focused-review`: 0,
  `release-gate`: low=1, med=1, high=3, crit=3, `deep-sweep`: 3-5 everywhere)
- **model mix** per node (cheap_fast / balanced / strongest_available aliases —
  see `shared/model-policy.md`)
- **hard budget cap** (used in preview; abort if estimated upper bound exceeds cap)

**Skill discipline**:
- The mode is shown in the user-facing preview as the human-readable name
  (see `shared/preview-template.md`'s mode-name vocabulary). User can reject
  the preview, ask for a different mode, and the Skill re-renders.
- The Skill MUST NOT auto-promote to `deep-sweep`; that mode requires explicit
  user budget approval.

### §16.2 Init Release Tag

- `appsec-sdk init <release-tag>` → 创建 `.appsec/evidence/<tag>/`、`.appsec/findings/<tag>/`、`.appsec/decisions/<tag>/`
- 写入 `.appsec/state.json.active_release_tag`
- Tag 必须满足 `^[a-zA-Z0-9._-]+$`，无 `..` traversal（与 qa-sdk 同 idiom）

### §16.3 Overlay Activation

- 按 §16.1 输出的 `overlays[]` 路由到对应 sub-skill：
  - mobile → `security-app-mobile`
  - llm → `security-app-llm`
  - multitenant → `security-app-multitenant`
  - websocket → `security-app-websocket`
  - file_upload → `security-app-file-upload`
  - payment → `security-compliance-payment`
  - cn_data → `security-compliance-cn-data`
- 每个 overlay 必须落 `.appsec/evidence/<tag>/overlay-<name>/checklist.yaml`
- 缺一 → Step 9 validator BLOCK

### §16.4 Automated Scans + Triage

顺序固定（**SCA → secret_scan → SAST → headers**，因为 secret 出现的最可能 surface 在依赖与代码混在一起的 audit 阶段）：

1. **SCA**：`npm audit --json` / `pip-audit -f json` / `cargo audit --json` / `trivy fs --format json .` → `.appsec/evidence/<tag>/sca/raw-<tool>.json`
2. **secret_scan**：`gitleaks detect --source . --log-opts="--all" --redact --report-format json --report-path .appsec/evidence/<tag>/secret-scan/gitleaks-redacted.json`
   - **强制 `--redact`**；raw secret 值永不落盘，只存 hash + redacted excerpt
3. **SAST**：`semgrep scan --config=auto --json` → `.appsec/evidence/<tag>/sast/raw.json`
4. **headers**：在 staging/preview URL 上抓 response headers → `.appsec/evidence/<tag>/headers-cookies/snapshot.json`

每步原始输出 → `Agent(subagent_type="appsec-finding-triager", model="opus")` → triager normalize 到 schema v1.0 → 每条 finding 必须通过 `appsec-sdk finding.add <file>` 落盘（PreToolUse hook §18.5 校 schema）。

### §16.5 Defensive Code Review

- `Agent(subagent_type="appsec-reviewer", model="opus")` for L2+ projects（L1 可保持 sonnet）
- 评审范围：auth / input validation / session / API / authz / crypto / logging
- 映射 ASVS 5.0 + WSTG passive + API Top 10
- 每条发现 → `appsec-sdk finding.add`
- 必要时路由 `security-platform-secrets` / `security-platform-iac-cloud`

### §16.6 Threat Modeling

- 路由 `security-governance-threat-modeling`
- 落 `.appsec/evidence/<tag>/threat-model/STRIDE.md` + `.appsec/evidence/<tag>/threat-model/risk-register.yaml`

### §16.7 DAST Baseline Decision

- 含 web app / API → 路由 `dast-baseline-scanning`（passive）
- 否则跳过 → 在 `.appsec/decisions/<tag>/appsec_release_decision.yaml` 注 `dast_skipped_reason`

### §16.8 Pentest Decision

- 含 user data L2+ / payment / admin → 建议起草 ROE → 路由 `pentest-scope-and-roe`
- 用户 explicit `/authorized-pentest-validation` → PreToolUse hook §18.4 验证 ROE 13-item + time window + scope
- **本 orchestrator 永不自动调用 active validation**

### §16.9 Evidence Validation + Release Decision

- `Agent(subagent_type="appsec-evidence-validator", model="opus")`
- 读 `.appsec/evidence/<tag>/` 全部 + `.appsec/findings/<tag>/` 全部
- 校验：
  1. §9 schema 完整性
  2. CSF 2.0 6-function coverage（每个 function PASS / PARTIAL / MISSING）
  3. 每个激活的 overlay 都有 checklist.yaml
  4. SLA freshness（按 §10）
  5. `redaction.attested == true`（**v3.0 P0.1.7 nested 结构**，见下 YAML）
  6. critical 数：strict mode 必须 0；CONDITIONAL_PASS 允许 critical >0 当且仅当每条都有完整 `risk_acceptance{}`
- 写 `.appsec/decisions/<tag>/appsec_release_decision.yaml`：

```yaml
schema_version: 1.0
release_tag: <tag>
decision: PASS | FAIL | BLOCKED | CONDITIONAL_PASS
decided_at: <ISO8601>
decided_by: appsec-evidence-validator@<git_sha>
asvs_level: L1 | L2 | L3
asvs_version: 5.0.0
csf2_coverage:
  note: "Internal evidence completeness gate per §3; not a NIST CSF release checklist claim."
  GV: { status: PASS|PARTIAL|MISSING, evidence_paths: [...] }
  ID: { status: ..., evidence_paths: [...] }
  PR: { status: ..., evidence_paths: [...] }
  DE: { status: ..., evidence_paths: [...] }
  RS: { status: ..., evidence_paths: [...] }
  RC: { status: ..., evidence_paths: [...] }
overlays_activated: [mobile?, llm?, multitenant?, websocket?, file_upload?, payment?, cn_data?]
overlays_evidence:
  llm: { checklist_path: ..., findings_count: <n>, critical: <n>, high: <n> }
  # ... per activated overlay
findings_summary:
  total: <n>
  critical: <n>
  high: <n>
  medium: <n>
  low: <n>
  by_source: { sast: <n>, sca: <n>, secret_scan: <n>, manual_review: <n>, ... }
redaction:                                    # ★ v3.0 P0.1.7 — nested
  attested: true
  method: "gitleaks --redact + appsec-sdk redact"
  proof_path: .appsec/evidence/<tag>/secret-scan/redaction-attestation.txt
pentest_status: not_required | roe_drafted | roe_signed | executed | report_received | skipped_with_reason
dependency_audit:
  tools: [npm-audit@<v>, pip-audit@<v>, trivy@<v>, cargo-audit@<v>]
  ran_at: <ISO8601>
  results_paths: [.appsec/evidence/<tag>/sca/raw-<tool>.json, ...]
risk_acceptance:
  - finding_id: ...
    approver: <name+role>
    approval_date: ...
    review_date: ...
sla_breaches: []
hard_block_reasons: []                        # FAIL / BLOCKED 必填
conditional_reasons: []                       # CONDITIONAL_PASS 必填
downstream_consumers: [gsd-ship, gsd-verify-work, enterprise-qa-testing, ci]
```

- Validator 完成后 orchestrator 返回 `appsec-sdk gate.check <tag>` 的退出码（见 §17）

### §16.10 Workflow Execution Mode（spec-driven dispatch via Claude Code Workflow tool）

> **Status (2026-05-28, v3.0)**: optional, additive. Replaces the v2 hardcoded
> `appsec-full-sweep.js` workflow (DEPRECATED, 30-day P3 window). When the
> Workflow tool is available AND `.appsec/config.json.execution_mode ==
> "workflow-spec"`, §16.4–§16.9 prompt-only dispatch is replaced by a
> **spec-driven** orchestrator: the Skill builds a complete `spec` from a
> preset + project signals + inline prompts/schemas, validates it via
> `validate-spec.js`, renders an Execution Preview, waits for user approval
> (§16.13), persists a sentinel, then launches
> `~/.claude/workflows/appsec-orchestrator.js`.
>
> Same evidence contract, same gate decisions, same SDK calls — only the
> dispatch surface changes from prompt to a deterministic JS fan-out engine.
> **Skill is the brain (builds spec). Workflow is the muscle (executes spec).**
> **Spec is the contract** — every Workflow change is gated on cross-AI review;
> every Skill spec is gated on user-approved Execution Preview.

#### §16.10.1 Mode Selection

| 条件 | mode |
|---|---|
| `.appsec/config.json.execution_mode == "workflow-spec"` AND `CLAUDE_CODE_WORKFLOWS=1` AND platform compat OK | **workflow-spec** (recommended after 2026-06-30) |
| `.appsec/config.json.execution_mode == "workflow-static"` | **workflow-static** (legacy v2 `appsec-full-sweep.js`, DEPRECATED 30 days) |
| `CLAUDE_CODE_WORKFLOWS` unset OR `OS=Windows_NT` AND `DISABLE_TELEMETRY != 1` | **prompt-only** (forced fallback, silent) |
| `.appsec/config.json.execution_mode == "prompt"` or absent | **prompt-only** (safer default) |

> Memory pointer: `memory/workflow-tool-real-switch.md` — `DISABLE_TELEMETRY=1`
> is the real switch in terminal `claude`; `CLAUDE_CODE_WORKFLOWS=1` alone is
> not enough on Windows.

Silent fallback — never warn the user, never block. If capability gates fail,
Skill just continues §16.4–§16.9 prompt-only path. The user sees no difference.

#### §16.10.2–§16.10.6 — relocated (workflow-spec operational elaboration)

> Args Contract (§16.10.2) · Resume Pattern (§16.10.3) · Evidence Mapping → §17 SDK calls (§16.10.4) · Backward Compatibility (§16.10.5) · Failure Modes (§16.10.6) relocated **verbatim** to [`references/workflow-spec-dispatch.md`](references/workflow-spec-dispatch.md) (CONTRACT-SENTINEL `appsec.workflow-spec-dispatch.v2026-05-29`). Operational elaboration — loaded on demand in workflow-spec mode only.
>
> **Stays in-file**: §16.10 intro + §16.10.1 Mode Selection (above, the dispatch decision) and §16.10.7 Name Freeze (below, the always-loaded freeze table).

#### §16.10.7 Name Freeze（safety-critical — renames = broken dispatch contract）

These names are LOAD-BEARING and must NEVER change without coordinated update
of all consumers:

| Surface | Frozen name |
|---|---|
| Workflow registered name | `appsec-orchestrator` (new) — legacy `appsec-full-sweep` kept 30 days |
| Workflow scriptPath | `~/.claude/workflows/appsec-orchestrator.js` |
| Args top-level fields | `spec`, `target`, `run_id`, `severity_floor`, `finders`, `policy`, `oracle`, `previous_results`, `spec_hash` |
| Spec top-level fields | `engine_version` (const `"1.0"`), `orchestrator` (const `"appsec"`), `phases`, `prompts`, `schemas`, `ops_allowed` |
| Canonical phase names | `Scope`, `Plan`, `Find`, `Normalize`, `Dedup`, `Verify`, `Map`, `Gate`, `Synthesize`, `PersistEvidence` (presets may add `PersistCnDataOverlay`, `PersistPaymentOverlay`, `PersistIncidentResponse`, `PersistRecovery`) |
| Deterministic OPS | `fingerprint_cluster`, `appsec_gate_policy`, `compute_recall` |
| Predicate OPS | `no_candidates`, `no_accepted` |
| Invariant OPS | `ensure_csf_coverage`, `prune_below_floor` |
| Prompt v1 ref namespace | `scope.v1`, `plan.v1`, `find.v1`, `normalize.v1`, `verify.v1`, `map.v1`, `synthesize.v1`, `persist-evidence.v1` |
| Schema v1 ref namespace | `SCOPE_SCHEMA.v1`, `PLAN_SCHEMA.v1`, `FIND_SCHEMA.v1`, `NORMALIZE_SCHEMA.v1`, `VOTE_SCHEMA.v1`, `MAP_SCHEMA.v1`, `SYNTH_SCHEMA.v1`, `PERSIST_SCHEMA.v1` |
| Sentinel path | `<project>/.appsec/state/preview-approved/<safe-run_id>.json` |
| Resume evidence layer | `workflow-state` |
| Approval keyword whitelist | (see §16.13) |

Renaming any of these requires synchronous update of:
1. SKILL.md §16.10 / §16.11 / §16.13 / §17.1
2. `~/.claude/workflows/appsec-orchestrator.js` (meta + validators)
3. `~/.claude/hooks/appsec-preview-gate.js` (name/scriptPath matcher)
4. `~/.claude/orchestrator-runtime/appsec/{prompts,schemas,presets,ops.manifest.json}`
5. `~/.claude/orchestrator-runtime/shared/{orchestrator-spec.v1.json,preview-template.md,model-policy.md}`
6. `~/.claude/scripts/appsec-sdk.sh` `evidence.append` layer documentation
7. Routing regression fixtures under `~/.claude/tests/appsec-routing/`

### §16.11 Spec Authoring Contract（Skill → Workflow handshake — workflow-spec mode only）

When `mode == "workflow-spec"` is selected (§16.10.1), Skill main thread executes this 14-step authoring contract BEFORE any `Workflow()` call.

> **READ [`references/workflow-spec-dispatch.md`](references/workflow-spec-dispatch.md) IN FULL before authoring** — it carries the verbatim per-step bodies (exact bash, preset paths, field handling, draft-07 schema constraint, args size limit). CONTRACT-SENTINEL: `appsec.workflow-spec-dispatch.v2026-05-29`.

> **Governed Gate Mode (CLAUDE.md §3.7) — gate_active window**: as the FIRST action of this contract (before Step 1 / preview render), the Skill MUST write `.appsec/state.json` `gate_active: true`, and clear it on terminal verdict/abort. This closes the pre-sentinel window so `governed-gate-workflow-guard.js` blocks inline model-authored Dynamic Workflows for the ENTIRE gate, not just after the approval sentinel is written.

**14 步骨架**（标题 + 约束；逐步 body 见 reference）：

1. Read `.appsec/config.json` → `asvs_level / csf_targets[] / overlays[] / strict_mode / lifecycle_stage`（缺 → silent exit, §16.0）
2. Pick preset under `~/.claude/orchestrator-runtime/appsec/presets/`（l1-default / l2-default / l2-cn-data / l3-payment / incident-response / smoke；可组合，组合后必 re-validate）
3. Load preset JSON → `spec`
4. Walk `spec.phases`（+ pipeline stages）收集 prompt_ref / schema_ref → inline body 进 `spec.prompts[ref]` / `spec.schemas[REF]`。**缺文件 = hard fail**（不 silent skip）
5. Build `ctx.finders` from §16.1 classifier — **不盲传全部 11**；always: sca/secret-scan/sast/code-review/headers；按 `overlays[]` 条件加 mobile/llm/multitenant/websocket/file_upload/payment/cn_data
6. Build `oracle` from `.appsec/findings/<historical-tag>/`（首跑 → `{oracle_findings:[], recall_metric:{minimum_acceptable:0}}`）
7. Build `previous_results` from `.appsec/evidence/<tag>/workflow-state/`（无 → `{}`）
7.5. **Skill-side alias resolution（MANDATORY）** — node.model alias → `node.resolved_model`（来源：config.model_policy_overrides → shared/model-policy.md）；保留 alias 可见；记录 `args.model_policy_version`。Workflow body 不再 resolve
8. Compute `spec_hash = 'sha256:'+sha256Hex(stableStringify(spec))`（canonical algo `shared/spec-hash.js`；与 workflow body + `appsec-preview-gate.js` + tests **byte-identical**）
9a. `validate-spec.js <spec.json>` → exit 0 OK / 2 SPEC INVALID（abort，0 token）/ 3 internal error
9b. `preflight-check.sh <spec.json>`（agentType frontmatter / required hook in settings.json / appsec-sdk reachable / model alias 解析）— **skip = fail-closed**
10. Render Execution Preview（§16.13，用 `shared/preview-template.md`）→ display + wait reply
11. Match user reply against §16.13 approval whitelist（精确，大小写无关，trim）→ no match = no sentinel = next Workflow call blocked
12. Write sentinel JSON → `.appsec/state/preview-approved/<safeRunId>.json` = `{run_id, spec_hash, preview_hash, approved_at, approval_text, ttl_seconds}`（**fail-closed**：Bash 写失败 → abort）
13. Invoke `Workflow({scriptPath:'~/.claude/workflows/appsec-orchestrator.js', args:{spec, target, run_id, severity_floor, finders, policy, oracle, previous_results, spec_hash}})` — 错误绝不 silent re-launch
14. Map `result.phase_outputs` through §16.10.4 SDK persist（Skill 主线 / haiku 调 Bash `appsec-sdk`，过 redact）→ write workflow-state resume snapshot

**Non-negotiable Skill discipline（违反 = silent bug）**：
- 顺序铁律：4 inline → 8 hash → 9 validate → 10 preview（spec_hash 必须在 inline 完成后、preview 之前算；preview 显示 hash）
- Step 9 validate-spec **REQUIRED**，绝不"为省时间"跳（invalid spec 中途炸，浪费 agent token）
- Step 11 approval 是 **human-in-the-loop**：Skill 绝不 auto-approve，绝不把沉默 / 无关回复当批准
- Step 12 sentinel **fail-closed**：写不成 → abort，绝不无 sentinel 裸 `Workflow()`
- Step 14 persist 每 phase 走 `appsec-sdk`（过 `redact`）；**绝不**直接 Write raw `result.phase_outputs.Find`（可能含 candidate code 里的 raw secret）

### §16.12 Static → Spec Migration（30-day window）  →  references/workflow-spec-dispatch.md

> `workflow-static` mode (legacy `~/.claude/workflows/appsec-full-sweep.js`) DEPRECATED 2026-05-28. Full P0→P3 timeline + per-project migration steps + compatibility shim relocated (SAFE-A, time-gated). Read on demand only when migrating a `workflow-static` project.

### §16.13 Execution Preview Contract（hard human-in-the-loop gate）

> Full preview template literal: `~/.claude/orchestrator-runtime/shared/preview-template.md`. Verbose render-field list + the enumerated 10-point hook pass-criteria: [`references/workflow-spec-dispatch.md`](references/workflow-spec-dispatch.md) (CONTRACT-SENTINEL `appsec.workflow-spec-dispatch.v2026-05-29`). The hook (`appsec-preview-gate.js`) is the **canonical enforcement** — the reference documents it, the hook decides.

**Why this gate exists**: Workflow can spawn dozens of fresh-context agents in parallel — a single misclick could burn millions of tokens. The user must see the spec breakdown (phase count, model mix, evidence outputs, estimated cost) and explicitly approve before launch.

**Approval keyword whitelist**（精确匹配，大小写无关，首尾 trim；**无 fuzzy、无 substring**）：

| Language | Keywords |
|---|---|
| English | `OK`, `okay`, `approve`, `approved`, `go`, `yes`, `proceed`, `ship it`, `LGTM` |
| Chinese | `跑`, `批准`, `同意`, `继续`, `好`, `执行` |

ANY other reply (`maybe` / `idk` / `?` / silence / question) = NO approval → NO sentinel → next Workflow call blocked.

**Sentinel**（Skill 经 Bash 写）：`<project>/.appsec/state/preview-approved/<safeRunId>.json`，`safeRunId = runId.replace(/[^A-Za-z0-9._-]/g,'_')`（path-traversal safe）。Body shape：`{run_id, spec_hash, preview_hash, approved_at:<ISO8601>, approval_text:<exact reply>, ttl_seconds}`。

**TTL**：default 300s；hook 强制 clamp `[30, 3600]` 不论文件值（防 `ttl_seconds: 99999999` 绕过）。`.appsec/config.json.preview_approval_ttl_seconds` 可覆盖（仍 clamp）。

**Hook enforcement**（`~/.claude/hooks/appsec-preview-gate.js`，PreToolUse matcher `Workflow`；仅当 `tool_input.name=="appsec-orchestrator"` 或 `scriptPath` 以 `appsec-orchestrator.js` 结尾时 fire，其余放行）：**recompute** `spec_hash` from `args.spec`（防 approve-A-run-B）+ 校 sentinel 存在 / `run_id` / `spec_hash` 一致 / `approved_at` ISO / TTL 窗口 + 拒 `spec.allow_dynamic_workflow===true`（Governed Gate §3.7）。任一 fail → `exit 2`，Workflow 不 launch。完整 10 点 pass-criteria + 17-scenario 测试见 reference + `tests/hook-mock-test.sh`。

## 17. SDK Contract — `appsec-sdk.sh`

> 安装位置：`~/.claude/scripts/appsec-sdk.sh`（用户全局）。项目可通过 `<project>/.claude/scripts/appsec-sdk.sh` override。
> 设计模板：`~/.claude/scripts/qa-sdk.sh`（同代际、共享 `validate_safe_name` idiom）。

### §17.1 Commands

```
appsec-sdk init <release-tag>
    Create .appsec/evidence/<tag>/, .appsec/findings/<tag>/, .appsec/decisions/<tag>/.
    Update .appsec/state.json active_release_tag.

appsec-sdk set-active <release-tag>
    Update active tag without rebuild.

appsec-sdk evidence.append <tag> <layer> [<file>]
    Layer ∈ {sca, secret-scan, sast, code-review, headers-cookies, dast,
             platform-{iac,k8s,secrets,iam}, overlay-{name}, threat-model,
             pentest, csf2-coverage, workflow-state,
             incident-response, recovery}.
    File defaults to stdin. Stdin/file goes through redact before write.
    Auto-name: <YYYYMMDD>-<HHMMSS>-<rand4>.yaml (collision-safe).
    Special layers (v3.0 §16.11 Spec Authoring Contract):
      workflow-state    Per-run spec-driven orchestrator snapshot. Body =
                        JSON {run_id, target, reused_phases, cache_misses,
                              phase_outputs, phase_outputs_fingerprinted}.
                        Skill reads this back as args.previous_results on
                        next run for cross-session resume (§16.10.3).
      incident-response Used by incident-response preset; body = Skill-curated
                        Respond-function evidence (Slack thread, postmortem
                        URL, mitigation plan ref).
      recovery          Used by incident-response preset; body = Skill-curated
                        Recover-function evidence (BCP/DR exercise, backup
                        validation, restore proof).

appsec-sdk evidence.list <tag>
    Print evidence file tree under .appsec/evidence/<tag>/.

appsec-sdk evidence.validate-presence <tag> [<expected-layers-csv>]
    Returns 0 if all expected layers present; 2 BLOCKED otherwise.

appsec-sdk finding.add [<file>]
    Read finding YAML from file or stdin. Validate schema v1.0:
      - required fields present
      - enum values valid
      - asvs_mapping[] entries match ^v5\.0\.0-\d+\.\d+\.\d+$
      - body contains no raw-secret pattern (else fail with redaction error)
    On success: write to .appsec/findings/<tag>/<seq>.yaml; exit 0.
    On failure: stderr explains, exit 2.

appsec-sdk gate.check <tag> [--strict | --lax] [--allow-conditional]
    Invokes appsec-evidence-validator decision pipeline.
    Exit code mapping:
      0 PASS
      1 FAIL
      2 BLOCKED
      3 CONDITIONAL_PASS (default)
    With --allow-conditional: 3 collapses to 0 (for CI && chains).
    Reads .appsec/decisions/<tag>/appsec_release_decision.yaml (which is written
    by appsec-evidence-validator agent at §16.9) and returns the appropriate exit code.
    Does NOT write the decision file; sdk is the gate-checker, validator agent is the writer.

appsec-sdk redact
    Read stdin, write redacted stdout. Canonical redactor used by
    every hook + agent + this sdk. Replaces matched patterns with
    "<REDACTED:kind>" markers; never echoes raw secret.

appsec-sdk roe.verify <roe-file>
    Validate 13-item ROE checklist:
      target_identification, authorization_proof, environment, scope,
      allowed_methods, disallowed_methods, time_window, rate_limits,
      test_accounts, data_handling, emergency_contact, rollback, reporting_format
    Missing field => stderr lists missing items, exit 2.

appsec-sdk csf.coverage <tag>
    Compute GV/ID/PR/DE/RS/RC coverage from .appsec/evidence/<tag>/.
    Output YAML to stdout. Read-only.

appsec-sdk overlay.activate <tag> <overlay-name>
    Mark overlay as activated in .appsec/evidence/<tag>/overlay-<name>/.activated
    so Step 9 validator can assert "overlay declared → checklist required".
```

### §17.2 Exit Code Matrix（v3.0 P0.1.5）

| Code | Meaning | When |
|---|---|---|
| 0 | PASS | gate.check 全 PASS；或 CONDITIONAL_PASS + `--allow-conditional` |
| 1 | FAIL | gate.check FAIL（critical 未 risk_accept / sla 违约 / 等） |
| 2 | BLOCKED | 输入无效、schema 错、缺 evidence、ROE 缺字段、ASVS 4.x 编号 |
| 3 | CONDITIONAL_PASS | 默认；critical 全部有完整 `risk_acceptance{}` |

**CI 串法约定**（避免 `&&` 静默吞掉 3）：

```bash
# 推荐：显式 allow-conditional
appsec-sdk gate.check "$TAG" --allow-conditional && deploy

# 或者：显式分支
appsec-sdk gate.check "$TAG"
case $? in
  0) deploy ;;
  3) require_manual_approval && deploy ;;
  *) exit 1 ;;
esac
```

### §17.3 Safety Idioms（与 qa-sdk 共享）

- `validate_safe_name kind value` — 拒绝路径穿越（`..`）和非 `[a-zA-Z0-9._-]` 字符
- `find_project_root` — 向上走 12 层找 `.appsec/config.json`
- **永不读** `.env*` / `secrets/**` / `*.pem` / `*.key` / `credentials.json` 的内容
- 所有写盘前自动走 `redact` 通道

---

## 18. Hook Contract — 6 Project-Level Hooks

> **注册位置（v3.0 P0.1）**：`<project-root>/.claude/settings.json`。
> 不写 `~/.claude/hooks/hooks.json`。项目级 settings 是 single project, shareable, repo-committable 的正确入口。
> `~/.claude/skills/appsec-security-orchestrator/templates/dot-appsec-skeleton/settings.json.snippet` 提供示例片段。

### §18.0 Blocking Contract（v3.0 P0.1.1 — 不可混用）

| Hook 事件 | 阻断方式 | 不允许 |
|---|---|---|
| **PreToolUse** | stderr 写 reason + exit 2 | 不要 stdout JSON；不要 "exit 2 + JSON decision" 混写 |
| **PostToolUse** | （已发生，不能撤销）只能写 `updatedToolOutput` 影响 Claude 看到的视图 + 标记 follow-up；real blocking 必须前置到 PreToolUse | 不要假装能"阻止写入"；只能事后审计 + 触发后续 block |
| **Stop（阻断模式）** | 方式 A: stdout `{"decision":"block","reason":"..."}` + exit 0  /  方式 B: stderr 写 reason + exit 2 | 不要"exit 2 + JSON decision" 混写；两种方式择一 |
| **任何阻断式 hook** | `async: false`（或省略 async 字段） | async hook 不能 block / 不能控制 Claude 行为 |

### §18.1 `appsec-secret-redaction.js`（Stop, **sync block 强制**）

- 扫描 last_assistant_message + transcript tail
- 命中 raw secret 正则库（AWS key / GitHub PAT / OpenAI sk- + sk-proj-/sk-svcacct-/sk-admin- / Anthropic sk-ant- / JWT eyJ-triple / PEM block / .env-shape `KEY=VALUE` with high-entropy / generic high-entropy string with credential-shape context）
- 阻断方式：**Stop 块协议 §18.0 方式 A** — stdout 写 `{"decision":"block","reason":"..."}` + exit 0（由 `emitStopBlock` helper 提供）
- **永不可降级为 warn-only**（与 evidence-required 不同；secret 泄露是终态损失）
- **输入护栏**：detectSecrets 在输入 > 1 MiB 时直接判定 `oversized_input` hit（防 ReDoS）
- ★ v3.0 P7：openai_key 正则已含 `sk-proj-` / `sk-svcacct-` / `sk-admin-` 现役变体；credential_kv 显式覆盖大小写无 `I` flag 依赖

### §18.2 `appsec-active-scan-guard.js`（PreToolUse Bash, sync block）

- matcher: tool=Bash
- 命令含 `sqlmap` / `nmap -sV` / `nmap -A` / `nuclei` / `ffuf` / `gobuster` / `wfuzz` / `burp` / `zap-cli active` / `masscan` / `hydra` / `msfconsole` / `msfvenom`
- 校验 `.appsec/state.json.active_roe` 存在 + target host 在 ROE `in_scope[]` + 当前时间在 ROE `time_window` 内
- production hosts（`.appsec/config.json.production_hosts[]`）即使有 ROE 也 hard-deny
- 失败：stderr exit 2

### §18.3 `appsec-pentest-authorization.js`（PreToolUse Skill/Agent, sync block）

- matcher: skill=`authorized-pentest-validation` OR agent=`authorized-pentest-validator`
- 校验 `.planning/PENTEST-ROE.md` 存在 + 13-item 全部填齐（用 `appsec-sdk roe.verify`）+ 当前时间在 ROE window 内（ROE 自带时区，不用本机）+ user 在当前 session 写过 `I authorize this pentest validation per ROE`
- 失败：stderr 列出缺项 + exit 2

### §18.4 `appsec-evidence-required.js`（Stop, sync block in strict / warn-only in lax）

- 模式由 `.appsec/config.json.strict_mode` 决定，**默认 strict**
- 触发条件：assistant 回复出现 "appsec done" / "security review complete" / "AppSec 审查通过" / "安全审查完成" 等模式
- 校验 `.appsec/decisions/<tag>/appsec_release_decision.yaml` 存在 + `decision in {PASS, CONDITIONAL_PASS}`
- strict 失败：stdout `{"decision":"block","reason":"appsec_release_decision.yaml missing or not PASS"}` + exit 0
- lax 失败：stderr warning + exit 0（不 block）

### §18.5 Finding schema gates — **拆成两个**（v3.0 P0.1.2）

#### §18.5a `appsec-finding-schema-prewrite.js`（PreToolUse Write|Edit|MultiEdit, sync block）

- matcher: path glob `.appsec/findings/**/*.yaml` OR `.appsec/decisions/**/*.yaml`
- 默认行为：**拒绝直接 Write/Edit/MultiEdit**（canonical 写入路径 = `appsec-sdk finding.add` / `appsec-sdk gate.check`）。Edit/MultiEdit 在 protected 路径上**一律 outright block**（E7 2026-06-05：局部编辑可把 marker 塞进 `new_string` 首行做绕过 → 不再 marker-check Edit，直接拒）
- 例外白名单：当 `tool_input.content` / `new_string` 中含 marker `# written-by: appsec-sdk@<version>` 时放行
- 拒绝时：stderr "use `appsec-sdk finding.add` instead" + exit 2
- 防止 schema 错误的二次校验：解析 `tool_input.content` 为 YAML，对 schema v1.0 必填字段、enum、`asvs_mapping[]` 正则 `^v5\.0\.0-\d+\.\d+\.\d+$` 做预校验

#### §18.5b `appsec-finding-schema-postverify.js`（PostToolUse Write|Edit, audit-only）

- matcher: path glob `.appsec/findings/**/*.yaml`
- **不能撤销已发生的写入**；只做事后审计：
  - 重新 parse 落盘 YAML
  - 不合 schema → 写 `.appsec/findings/<tag>/.quarantine/<file>.reason.txt`，并通过 `updatedToolOutput` 标 follow-up 让 Claude 看到错误
  - 触发新一轮 PreToolUse Write 到 quarantine 路径时可恢复 block
- 这一对 hook 的合力：**PreToolUse 是真 block，PostToolUse 是事后审计 + 触发器**；不再误称 PostToolUse 能"写入失败"

### §18.6 `appsec-secret-access-guard.js`（PreToolUse Read|Bash, sync block）— v3.0 P0.1.3 新增

- matcher: tool=Read OR tool=Bash
- matcher: tool=Read OR tool=Bash
- **Read**：阻断 path 命中**生产 secret**：裸 `.env` / `.env.production` / `.env.prod` / `.env.staging` / `secrets/**` / `*.pem` / `*.key` / `credentials.json` / `id_rsa*` / `*.kdbx` / `*.keyring`
- **Bash**：阻断裸 `printenv` / `env`（无参 dump，**语句边界锚定** `^ ; & | \n`——引号内/注释里的 "env" 字串不再误杀）/ `env VAR=val cmd` / `cat`·`awk`·`sed`·`grep` 等针对上述**生产** path / `grep -r SECRET`
- 即使 sandbox 允许，也强制 deny + stderr 写 reason + exit 2
- **Stage 分级（2026-06-03 user charter — "先能开发完，再保证安全"）**：开发期 dev/test env **必须可读·可改·可 source**。内置 allowlist 放行 `.env.dev` / `.env.development` / `.env.local` / `.env.test` / `.env.testing` / `.env.ci` / `.env.e2e`（+ 二级后缀如 `.env.development.local`）；项目可经 `.appsec/config.json` `"dev_secret_globs": ["<regex source>"]` 扩展（如 `\.env\.staging$` 把 staging 也释放）。**只有生产 secret 程序不可碰、人工独占**。指定单变量的 `printenv FOO` / `env FOO`（非 dump）也放行。
- shape-reference 例外：`.env.example` / `.env.sample` / `.env.template` 显式 allowlist
- 与 §18.1 secret-redaction 的关系：**§18.6 防"读出"，§18.1 防"chat 兜底"**，三层叠加（PreToolUse Read|Bash + PostToolUse Write redact verify + Stop chat scan）

### §18.7 Project-level `.claude/settings.json` snippet

```jsonc
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash",         "command": "node ~/.claude/hooks/appsec-active-scan-guard.js" },
      { "matcher": "Read|Bash",    "command": "node ~/.claude/hooks/appsec-secret-access-guard.js" },
      { "matcher": "Write|Edit|MultiEdit", "command": "node ~/.claude/hooks/appsec-finding-schema-prewrite.js" },
      { "matcher": "Skill|Agent",  "command": "node ~/.claude/hooks/appsec-pentest-authorization.js" }
    ],
    "PostToolUse": [
      { "matcher": "Write|Edit",   "command": "node ~/.claude/hooks/appsec-finding-schema-postverify.js" }
    ],
    "Stop": [
      { "command": "node ~/.claude/hooks/appsec-secret-redaction.js" },
      { "command": "node ~/.claude/hooks/appsec-evidence-required.js" }
    ]
  }
}
```

> 所有 hook 都不设 `async` 字段（即同步阻断）。

---

## 19. Test Plan  →  references/test-plan.md
> Relocated (SAFE-A appendix — verbatim, not weakened; not needed to execute a run). Read on demand.

---
## 20. Acceptance Criteria（v3.0 P0.1.6 — 拆分校正后）

### §20.1 Dispatch Cannot Be Skipped（dispatch validation）

- orchestrator 触发后 `.appsec/state.json.last_dispatch_at` 必须更新
- classifier / triager / validator 三个 agent 各被 invoke 至少一次（trace 可查）
- 删除任一 Step 4 triager 产出的 finding 文件 → Step 9 validator 必须返 BLOCKED（缺 evidence presence）
- 跳过 Step 6 threat-model → `.appsec/decisions/<tag>/appsec_release_decision.yaml.csf2_coverage.ID.status == MISSING` → BLOCKED

### §20.2 Hook Enforcement Cannot Be Bypassed（hook enforcement）

- 删 `<project>/.claude/settings.json` 里的 `appsec-secret-redaction.js` → toy 故意触发 raw `AKIA...` in chat → secret 漏出（证明 hook 不在场必漏）
- 装回 hook → 再触发 → 必须 block
- 同样对 `active-scan-guard` / `secret-access-guard` / `pentest-authorization` / `finding-schema-prewrite` 各做一次"拆 hook → 漏 → 装回 → 拦"测试

### §20.3 Bundle Integrity Cannot Be Forged

- validator 必须强制 `evidence.command_evidence` 每步留 stdout 路径；缺则降为 CONDITIONAL_PASS，不能 PASS
- `redaction.attested == true` 必须由 `appsec-sdk redact`/`gitleaks --redact` 留下 `proof_path` 证据；缺 proof_path → BLOCKED

### §20.4 Non-AppSec Projects: Silent Exit

- 无 `.appsec/config.json` 的 repo → orchestrator 触发 → 0 副作用 0 噪音 0 落盘

### §20.5 CI / GSD 可消费

- `appsec-sdk gate.check "$TAG" --allow-conditional && deploy` 单行 pipeline 可串
- `gsd-ship` 改造**只需要**读 `appsec_release_decision.yaml` + 退出码，不需要知道 17 sub-skill 内部细节

### §20.6 ASVS 4.x Hard Rejection

- 任何 finding YAML 出现 `V2.1.1` / `V3.2.4` 等旧编号 → `appsec-sdk finding.add` 退 2，`appsec-finding-schema-prewrite.js` 也 block
- 错误信息明确指向 §6.1 migration

### §20.7 Pentest 13-item Hard Gate

- ROE 缺 13 字段任一 → `authorized-pentest-validation` 调用 block；validator 拒绝接受相关 evidence

---

## 21. Risks / Caveats  →  references/risks.md
> Relocated (SAFE-A appendix — verbatim, not weakened; not needed to execute a run). Read on demand.

---