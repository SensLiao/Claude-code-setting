# SKILLS-INDEX — v4 (2026-05-23)

> 13-Layer Skill Taxonomy + 6 Primary Orchestrators + 20-Route UIUX Pipeline
> 配套：[~/.claude/CLAUDE.md](CLAUDE.md) / [docs/native-capabilities.md](docs/native-capabilities.md) / [docs/ORCHESTRATOR-MAP.md](docs/ORCHESTRATOR-MAP.md)
> 安装日志：[~/.claude/.planning/phases/skills-ui-ux-expansion-20260521/INSTALL-LOG.md](.planning/phases/skills-ui-ux-expansion-20260521/INSTALL-LOG.md)
> 备份：`~/.claude/_backup-20260522-v3/`

---

## Primary Orchestrator Layer (v1.1 — 2026-05-23 新增；2026-06-22 +I2R = 6 个)

> 这一层是 commercial-grade 系统的 6 个主入口。所有底层 13 Layer skill 都通过这些 orchestrator 路由，避免散件直接抢入口。

### 6 个 Primary Orchestrator 速查

| # | Orchestrator | 主线 | trigger | disable-model-invocation |
|---|---|---|---|---|
| 1 | `claude-env-bootstrap` | Project Bootstrap | manual-first | **true** |
| 2 | `idea-to-requirements-orchestrator`（I2R） | 需求前端（GSD 上游：raw idea → GSD-ready PRD，只产 WHAT/WHY） | auto | false |
| 3 | `gsd-pipeline-orchestrator` | GSD Delivery (PM) | auto | false |
| 4 | `uiux-product-orchestrator` | UIUX Product | auto | false |
| 5 | `enterprise-qa-testing` | Enterprise QA / SDET | auto | false |
| 6 | `appsec-security-orchestrator` | AppSec | auto when triggers present | false |

> **I2R（requirements front-end，UPSTREAM of GSD）**：把一个 raw/messy idea 变成 GSD-ready PRD（WHAT + WHY + CONSTRAINTS + LOCKED DECISIONS，**绝不**产 HOW / tasks / architecture / UI / roadmap——GSD 再 re-derive）。all-opus，SKILL-direct，9 个 i2r-* agent + 10 mode subskill + project-local `i2r.py` SDK（$0，16 命令）+ 8 个 project-installed hooks + 1 个 shared lib（`_i2r-common.js`）（gate 在 `runs/i2r/` 存在与否，无 config 文件，刻意变体）。经 `/gsd:ingest-docs` 或 `/gsd:plan-phase --prd PRD.md` 交棒 GSD。**不**触发于实现 / coding / debug / UI / roadmap。

### Pentest 双 gate (security testing 特殊路径)

| Skill | 角色 | trigger | disable-model-invocation | allowed-tools |
|---|---|---|---|---|
| `pentest-scope-and-roe` | Governance gate (ROE planner) | auto when "pentest / active scan" 关键词出现 | **false (visible)** | Read only |
| `authorized-pentest-validation` | Manual hard gate (active validator) | manual-only | **true (hidden)** | Read, Write, Bash (wrapper-only) |

### AppSec / QA Family (v3.0 — 2026-05-25 GSD-lite execution engine, 对齐 NIST CSF 2.0 + ASVS 5.0)

**AppSec Skills** (~/.claude/skills/) — 6-layer + manual gates：

| Layer | Skill | canonical_id | 说明 |
|---|---|---|---|
| Orchestrator | `appsec-security-orchestrator` v3.0 | `security.orchestrator` | 6-layer routing + Release Evidence contract + Finding schema + GSD-lite execution engine |
| governance | `security-governance-threat-modeling` | `security.governance.threat_modeling` | STRIDE / DFD / abuse cases / control gap |
| app | `security-remediation` v1.1 | `security.app.remediation` | Finding → fix + RED→GREEN regression test |
| app | `dast-baseline-scanning` v1.1 | `security.app.dast.baseline` | ZAP Baseline passive only, wrapper-based |
| app overlay | `security-app-mobile` | `security.app.mobile` | MASVS 2.x mobile security overlay |
| app overlay | `security-app-llm` | `security.app.llm` | LLM Top 10 + Agentic AI threats |
| app overlay | `security-app-multitenant` | `security.app.multitenant` | 12-layer tenant boundary checklist |
| app overlay | `security-app-websocket` | `security.app.websocket` | CSWSH / WS frame security |
| app overlay | `security-app-file-upload` | `security.app.file_upload` | 12-step upload defense + polyglot |
| app | `dast-authenticated` | `security.app.dast.authenticated` | **RED-LINE** double-gated authenticated/logged-in DAST (ZAP AF browser auth-context + spider + scan, Nuclei-with-session); staging/preview/lab + ROE + authz only; wrapper-only (raw ZAP/Nuclei CLI forbidden); **middle layer between `dast-baseline-scanning` (passive) and `authorized-pentest-validation` (exploitation)**; NEVER auto-scans, no production, references frozen-name gates |
| app | `security-app-api` | `security.app.api` | API security (OWASP API Top 10:2023, per-endpoint authz; REST / GraphQL / gRPC) |
| app | `security-app-fuzzing` | `security.app.fuzzing` | Coverage-guided / structure-aware fuzzing (libFuzzer / AFL++ / cargo-fuzz / Atheris / Jazzer / ClusterFuzzLite); fuzz harness + corpus authoring |
| app | `security-app-sast-deep` | `security.app.sast_deep` | Deep interprocedural taint / dataflow SAST (CodeQL / Joern / semgrep taint); source→sink reachability |
| platform | `security-platform-secrets` | `security.platform.secrets` | Secrets engineering（Vault / OIDC / 轮换 / 泄露响应）|
| platform | `security-platform-iac-cloud` | `security.platform.iac_cloud` | Trivy / Checkov / Hadolint / kube-bench / Prowler / Falco |
| platform | `security-platform-supply-chain` | `security.platform.supply_chain` | SBOM (CycloneDX/SPDX) + provenance/signing (SLSA/cosign/in-toto) + deep SCA |
| response | `security-response-incident-response` | `security.response.incident_response` | NIST SP 800-61 R3 IR workflow + IC + forensics bridge |
| response | `security-response-recovery` | `security.response.recovery` | NIST CSF RC + SP 800-184 + ISO 22301 BCP/DR |
| response | `pentest-scope-and-roe` v1.1 | `security.response.pentest_roe` | ROE planner (visible, Read-only, 落盘走 `pentest-scope-planner` agent)；**deepened** — ROE 模板 + box-selection / type-matrix 富化 |
| response | `authorized-pentest-validation` v1.1 | `security.response.pentest_validation` | **manual hard gate** (disable-model-invocation: true) |
| pentest | `security-pentest-recon-scan` | `security.pentest.recon_scan` | **ROE-gated** templated recon + 漏洞扫描 (nuclei / amass / ffuf / httpx); planning + authorized scan only, behind double-gate |
| pentest | `security-pentest-ai-redteam` | `security.pentest.ai_redteam` | AI / agentic red team (prompt injection / tool abuse / memory poisoning; PyRIT / promptfoo; OWASP Agentic Top 10); planning-only, behind double-gate |
| pentest | `security-pentest-exploitation-planning` | `security.pentest.exploitation_planning` | **planning/reference-only** exploitation + adversary-simulation planning (Metasploit / Sliver / Caldera / Pacu / BloodHound); Read-only; references the manual hard gate `authorized-pentest-validation` but **never auto-executes** any active/post-exploitation work; routes AFTER recon-scan |
| compliance | `security-compliance-payment` | `security.compliance.payment` | PCI DSS 4.0.1 + SAQ |
| compliance | `security-compliance-cn-data` | `security.compliance.cn_data` | PIPL + DSL + CSL + CAC 出境 |
| compliance | `security-compliance-privacy` | `security.compliance.privacy` | GDPR / CCPA / CPRA（ex-China）；与 cn-data + payment 按 jurisdiction 分工 |
| response | `security-response-red-purple-team` | `security.response.red_purple_team` | 红/紫队 ATT&CK 覆盖映射（**planning-only**，永不执行攻击；active validation 走 pentest gate）|
| visualization | `security-viz` | `security.viz` | 从 `.appsec/` + manifest 事实源渲染安全图（AI Agent 风险图 / 漏洞看板 / 证据 dashboard / pentest scope map）；render-only ≠ `arch-viz` 代码图 |
| (GSD adapter) | `gsd-secure-phase` | `gsd.workflow.secure_phase` | GSD-namespace adapter，与 AppSec 严格命名空间分离 |

**AppSec 6-Layer Capability Map**（详 `appsec-security-orchestrator §5`）：
- **governance**: inventory / scope / threat_modeling / risk_assessment
- **app**: sast / dast / iast / rasp / sca / sbom_signing / cicd / remediation
- **platform**: container_k8s / iac_cloud / network_boundary / iam / secrets / test_environment
- **operations**: logging_monitoring / vuln_patch / privacy
- **response**: pentest_roe / pentest_validation / incident_response / forensics / recovery
- **compliance**: audit / metrics / reporting / payment / cn_data

**Agents** (~/.claude/agents/) — 全部 ASVS 5.0 aligned：
- `appsec-reviewer` (sonnet) — OWASP defensive code review (ASVS 5.0 V1-V17)
- `security-remediation-engineer` (sonnet) — RED → GREEN regression fixes (ASVS 5.0)
- `dast-baseline-engineer` (sonnet) — ZAP baseline wrapper runner
- `pentest-scope-planner` (sonnet) — ROE drafting (no Bash)
- `authorized-pentest-validator` (**opus**) — Active validation (manual-only)

**Rules** (~/.claude/rules/) — ASVS 5.0 V1-V17：
- `security-appsec.md` — path-scoped: src/api/** / src/**/auth/** / middleware*
- `testing-policy.md` — path-scoped: **/*.{test,spec}.* / tests/** / playwright.config.*

**Templates** (project-level, via claude-env-bootstrap)：
- `templates/planning/SECURITY.md` — 项目安全契约（20 sections）
- `templates/planning/PENTEST-ROE.md` — 11 user-visible sections (validated as 13 internal fields by orchestrator v3 §20.7)
- `templates/planning/QUALITY.md` — 9-layer commercial quality model
- `templates/planning/ACCEPTANCE.md` — multi-dimension acceptance + DoD

**AppSec orchestrator-local templates** (`~/.claude/skills/appsec-security-orchestrator/templates/`)：
- `threat-model-STRIDE.md` — per-system STRIDE workshop output
- `vuln-report.md` — per-finding report
- `risk-register.md` — persistent project risk register（NIST SP 800-30）
- `security-test-plan.md` — per-release security test plan
- `incident-response-initial.md` — NIST SP 800-61 R3 initial report + RC recovery criteria

**Manifests** (~/.claude/manifests/)：
- `skills.manifest.json` — 5 primary orch + tiered supporting + canonical_id schema
- `skill-routing-policy.json` — intent → orch + tie-break rules
- `skill-overrides.recommended.json` — visibility tier recommendations

**Hard rules（v3.0 新增）**：
- ❌ 不改名 `pentest-scope-and-roe` / `authorized-pentest-validation` / `dast-baseline-scanning` / `dast-authenticated`（safety-critical name = control surface；`dast-authenticated` 的 wrapper-only + double-gate 边界依赖 routing 表引用此精确名）
- ❌ 不引用 ASVS 4.x V2-V13 旧标识符（用 `v5.0.0-<chapter>.<sub>`）
- ❌ 不把 OWASP LLM Top 10 当 Agentic AI 安全的全部
- ❌ `gitleaks detect` 不加 `--redact` flag

### Hook Scope Callout (subsystem hooks are project-installed only)

AppSec / QA / UIUX / L12 子系统 hooks **不在 user-global 触发**。它们各自通过子系统 SDK 的 `init` 命令注册到 `<project>/.claude/settings.json`。**hook 枚举 / 触发 / 数量的单一真相源是 [`manifests/hook-registry.json`](manifests/hook-registry.json)，安装由 `orchestrator-runtime/shared/install-subsystem-hooks.js` 完成 —— 本文件不再写死任何 per-family hook 计数（数量类陈述一律指向 registry）。**

| Subsystem | Hook 枚举来源 | Init command | Fresh-project state |
|---|---|---|---|
| AppSec | `hook-registry.json` → `categories.project_installed.subsystems.appsec` | `appsec-sdk init` | NO enforcement (no `.appsec/config.json`) |
| QA | `hook-registry.json` → `...subsystems.qa` | `qa-sdk init` | NO enforcement (no `.qa/config.json`) |
| UIUX | `hook-registry.json` → `...subsystems.uiux` | `uiux-sdk init` | NO enforcement (no `.uiux/config.json`) |
| L12 | `hook-registry.json` → `...subsystems.discoverability` | `python -m discoverability_sdk init` | NO enforcement (no `discoverability.config.yaml`) |
| **GSD** | `hook-registry.json` → `categories.global_live` | n/a (registered globally) | **always fires** |

Fresh project 无对应 config file 时，**只有 GSD hooks 全局 fire**，所有 subsystem hooks 都是 0 enforcement。这是 by design，docs 必须明示（详 [CANONICALS.md D3](docs/CANONICALS.md#d3--hook-scope-project-installed--clarify-docs)）。

### 三主线 Handoff Protocol

| From | To | Trigger | Payload |
|---|---|---|---|
| GSD | UIUX | spec-phase 判定 UI-heavy | business intent + persona + acceptance draft |
| GSD | QA | plan-phase 需要 quality gates | acceptance criteria + risk + release target |
| UIUX | QA | UI 改 theme/layout/image | affected pages + breakpoints |
| UIUX | AppSec | production UI 含 backend/API | API surface + auth model |
| QA | AppSec | decision tree 命中 backend/API/auth/data | affected modules + auth flows |
| AppSec | pentest-scope-and-roe | user 请求 active validation | target + AppSec findings to validate |
| pentest-scope-and-roe | authorized-pentest-validation | ROE 完成 + user sign-off | ROE doc path + confirmation timestamp |

### 详细文档

- `docs/ORCHESTRATOR-MAP.md` — 5 orchestrator 协作图 + handoff 详解
- `manifests/skills.manifest.json` — 机器可读 manifest
- 详细 13-Layer 路由表（包括 UIUX / GSD / 平台 overlay / 触发冲突消歧）见下方原章节

---

## 📊 数字总览

```
~/.claude/skills/         ~141 dirs  = 68 GSD + ~73 non-GSD
~/.claude/plugins/        9 enabled + some disabled from 8 marketplaces
~/.claude/tools/          gstack (CLI)
Vercel namespace          34 sub-skills (auto-injected)
skillOverrides            8 overrides (user-invocable-only / name-only)
```

---

## 🚦 20 Route 总览（A–T；UIUX 多阶段路由 taxonomy）

> 入口：`uiux-product-orchestrator`（auto，UIUX 主线）。下面的 20-route 表是 taxonomy moat，保留。
>
> **UIUX 任务先过 `uiux-product-orchestrator` SKILL.md §2.0 Entry-Situation Router（7 入口：从零想法 / 给 reference 图 / 给截图还原 / 客户提案 / 现有项目升级 / 局部修补 / 上线审计），按用户给了什么料动态分流，再查本表。**

| Route | 适用 | 关键 skill |
|---|---|---|
| **A** 新页面 / 新功能（create/optimize） | "做个 dashboard / landing / settings" | **组合调度引擎**（ask-first min/optimal/max）：GROUND 接地（本地 `design-system` 58 品牌优先）→ EXPLORE（`prototyping-ui-directions` 多版给你挑）→ PICK（锁 1 个 L3）→ BUILD（`frontend-design@official`）→ UNIFY（`design-systems:tokenize` + `ux-principles` MODE B + `visual-critique`）→ REVIEW（`ux-principles` MODE C + `gsd-ui-review` + `santa-loop` 循环）。详 `uiux-product-orchestrator` references/combination-policy.md |
| **A+P** AI-native 对话式产品 | "对话式 AI 原生产品 / 生成式 UI / 骨架库 / conversation-first / continuous-interface" | `ai-native-interface`（范式层 Layer P，与 L3 并行）＋ 锁定 L3（视觉皮肤）＋ `ux-principles`（Show-Then-Ask / Give-Before-Take）＋ `security-app-llm` → GSD build。**Layer P composes with L3，不是 L3 风格、不占 L3 锁** |
| **B** 现有 UI 升级 | "UI 太丑帮我升级 / redesign" | `visual-critique` → `redesign-skill` → `ux-principles` MODE B |
| **C** 多 variant 探索 | "做几版给我看" | `prototyping-ui-directions` →（可选）`imagegen-frontend-web` |
| **D** 截图 → 代码 | "根据这张图还原" | `image-to-code-skill` → L3 overlay → `ux-principles` MODE B |
| **E** Next.js / Vercel 生产 | "做个 Next.js / shadcn 项目" | Vercel namespace → L3 → `frontend-design@official` → `vercel:deploy` |
| **F** iOS / SwiftUI | "iOS app / SwiftUI view" | （已移除；本配置聚焦 Web） |
| **G** 设计系统 / tokens | "建立 design system" | `design-systems` → `ui-design` → `theme-factory` → `interface-design` |
| **H** Luxury / Editorial landing | "fashion / 100dvh hero video / 杂志感" | `luxury` 或 `luxury-editorial-site-builder` + `brandkit` + `emil-design-eng` |
| **I** SaaS / Dashboard | "管理后台 / B2B 产品" | `taste` MODE A (Editorial Monochrome) → `frontend-design@official` → Vercel → `interface-design` |
| **J** 品牌资产 / 海报 | "做 brand board / logo / poster" | `brandkit` → `theme-factory` → `canvas-design` |
| **K** App Store 截图 | "iOS / Android 上架素材" | （已移除；上架 metadata 走 `app-aso`） |
| **L** 高动效 / Awwwards | "Awwwards 风 / GSAP / creative site" | `taste` MODE C (GSAP Scrollytelling) + `emil-design-eng` |
| **M** 留存 / Habit Loop | "用户不留存 / engagement" | `ux-principles` MODE C audit |
| **N** Design Sprint | "新点子 5 天 sprint 验证" | `prototyping-ui-directions` |
| **O** Remotion 视频 | "产品 demo 视频" | `remotion-best-practices` |
| **P** Meeting → 产品 | "把会议变成设计任务" | `meeting-analyzer` → `grill-with-docs` |
| **Q** 上线前 QA | "上线前最后审计" | `/verify` → `gsd-ui-review` → 手动 `gstack` |
| **R** SEO / AEO / 可发现性 | "做 SEO / 让 ChatGPT 引用 / llms.txt / Google 索引" | `discoverability-orchestrator` → `web-seo` / `web-aeo` |
| **S** Local SEO / Google Business Profile | "本地业务 / Google Maps / 实体店上线 / near me / 附近" | `discoverability-orchestrator` → `web-local-seo` |
| **T** App Store 上架 | "iOS/Android app 上架 store metadata" | `discoverability-orchestrator` → `app-aso` |

---

## 🔥 触发冲突优先级表

### "高端 / premium / luxury"

| 用户输入 | 第一选择 | 第二选择 | 不要先用 |
|---|---|---|---|
| "高级一点 / premium / expensive"（**未指明暗/浅** → 反问澄清） | `taste` MODE B (Double-Bezel Agency) 默认 | `taste-skill` | `luxury` |
| "dark luxury / 黑底白字 / Oswald / editorial" | `luxury` | `emil-design-eng` | — |
| "fashion brand site / editorial landing"（**不依赖 hero video 关键词**） | `luxury-editorial-site-builder` | + `luxury` 若暗色 | — |
| "100dvh hero video / 杂志感 brand 单页" | `luxury-editorial-site-builder` | + `brandkit` | — |
| "logo / brand board / identity" | `brandkit` | `theme-factory` | `luxury` |
| "高端 SaaS dashboard" | `taste` MODE A (Editorial Monochrome) | `interface-design` | `luxury` |
| "只是做高级一点" | `taste-skill` | `ux-principles` | `brandkit` |

### "UI audit / 视觉不对劲"

| 用户输入 | 第一选择 | 第二选择 |
|---|---|---|
| 截图 critique | `visual-critique` | `ux-principles` MODE C |
| 局部修补 spacing/hierarchy | `ux-principles` MODE B | `ux-principles` MODE C |
| 全面分阶段 audit | `design-audit@bencium`（手动） | `gsd-ui-review` |
| 上线前 gate | `gsd-ui-review` | `gstack`（手动） |
| 启发式 / 理论审计 | `ux-principles` MODE C | — |

### "设计系统 / design system"

| 用户输入 | 第一选择 | 第二选择 |
|---|---|---|
| tokens / spacing / components | `design-systems` | `interface-design` |
| color palette / typography | `ui-design` | `theme-factory` |
| theme presets | `theme-factory` | `design-systems` |
| brand board / identity | `brandkit` | `canvas-design` |
| session 间一致性 | `interface-design` | `design-systems` |

### "升级 UI / redesign"

| 用户输入 | 第一选择 | 第二选择 |
|---|---|---|
| "已有页面重做"（明确**全做**） | `redesign-skill` | `ux-principles` MODE B |
| "局部变好看" / "好看一点" | `ux-principles` MODE B | `ux-principles` MODE C |
| "升级一下 UI"（**范围模糊** → 默认 `ux-principles` MODE B 局部；用户明确说"重做整页"才进 `redesign-skill`） | `ux-principles` MODE B | 反问"范围多大？" |
| "全 surface 重做" | `anchor-prototype-wave` | + L3 风格 |
| "截图到代码" | `image-to-code-skill` | `ux-principles` MODE B |
| "先审计再分阶段修" | `visual-critique` → `redesign-skill` | `design-audit@bencium` |

### `frontend-design` 三入口规则

| 入口 | 状态 | 角色 |
|---|---|---|
| `frontend-design@claude-plugins-official` | **auto enabled** | 生产 UI 默认入口 |
| `frontend-design:frontend-design`（本地） | 不存在（已确认） | — |

---

## 🛂 Skill 状态边界响应协议（v3 新增 — 4 种状态的明确行为）

**`disabled` plugin 被用户召唤**：
- ❌ 不静默 fallback / 不假装能用
- ✅ 回复 "此 plugin 已禁用。请运行 `claude plugin enable <plugin>@<marketplace>`"
- ✅ 主动推荐替代："或走 `uiux-product-orchestrator` Route X，用 narrower skill 链"

**`user-invocable-only` skill 被用户点名**（说出 skill 名字 / 描述里的唯一关键词）：
- ✅ 立即触发，无需额外 enable
- ✅ 含义是"不自动触发"，不是"不能用"
- 案例："我要 brutalist 风的 dashboard" → `brutalist-skill` 立即可用

**`name-only` skill 被用户使用关键词**：
- ✅ name-only = 列表里可见但 model 不主动选
- ✅ 用户明确说出名字 = 视为主动调用，触发

**空查询 / 模糊查询**（"audit"、"design system"、"UI" 不带细分）：
- ✅ 先走 `ux-principles` MODE A 反问澄清
- ✅ 列出本表里所有可选细分，让用户选
- ❌ 不擅自挑一个

**多 L3 候选竞争 tie-break**（如 "premium dashboard"——premium 撞 `taste` MODE B / luxury，dashboard 撞 `taste` MODE A）：
- ✅ "语境最具体" 原则：dashboard > premium → `taste` MODE A (Editorial Monochrome) 胜
- ✅ "明确技术关键词 > 形容词"：触发词命中具体 skill 描述的优先

---

## 📋 13-Layer 详细路由

### G0 Foundation
| Skill | 状态 | 触发 | 何时不用 |
|---|---|---|---|
| `ux-principles` | auto | 所有 UI/UX 任务，MODE A pre / MODE B mid / MODE C post | 纯 backend 任务 |
| `emil-design-eng` | auto（窄） | 动效 / hover / transition / micro-interaction | 数据密集 dashboard（动效是包袱） |
| `output-skill` | **user-invocable** | 生产阶段强制完整不留 placeholder | 探索 / stub 阶段（拖慢） |
| `gstack` (CLI tool) | manual | 0-10 设计评分、上线前 gate | 不当 skill 用，是工具 |

### Layer P — Paradigm / Interaction Architecture（orthogonal overlay，G0 Foundation 的 peer）

> AI-native 对话式产品的**交互范式层**，与 L3 视觉风格**正交**。**composes with L3，永远不是 L3 候选、不占 L3 锁、不参与 L3 互斥** —— Layer P 决定 interaction architecture（对话流 / 骨架库取数 / 连续界面状态），L3 决定 visual skin，两者同时存在。

| Skill | 状态 | 触发 | 何时不用 |
|---|---|---|---|
| `ai-native-interface` | auto（窄） | "对话式 AI 原生产品 / conversation-first / 生成式 UI / 骨架库 / show-then-ask / continuous interface / URL-as-state / 没有页面只有一场对话" | 传统多页面 / 表单驱动 / 非对话式产品 |

配套：`ux-principles` 的 Show-Then-Ask / Give-Before-Take 两条 law（UX 侧判断）+ 锁定的某个 L3（视觉皮肤）+ `security-app-llm`（AI surface 安全）。

### L1 Discovery
| Skill | 状态 | 触发 |
|---|---|---|
| `grill-with-docs` | auto | 模糊点子 / 早期 PRD / 拷问需求 |
| `competitive-teardown` | auto | 竞品分析 / battle card / 12 维 / 定位 |
| `design-systems@designer-skills`（research 子集） | **disabled** | 手动 enable 才用：persona / journey map |
| `ux-principles` MODE A | auto | IA / user flow / strategy 起点 |

### L2 Exploration
| Skill | 状态 | 触发 |
|---|---|---|
| `prototyping-ui-directions` | auto | "做几版给我看" / 方向不清 |
| `imagegen-frontend-web` | auto（窄） | "网页参考图 / Awwwards 级 moodboard" |

### L2.5 Source / Spec Import（新增层）
| Skill | 状态 | 触发 |
|---|---|---|
| `image-to-code-skill` | auto（有图时） | screenshot / Figma image / 参考图还原 / DESIGN.md 导入 |
| `figma` (上游 Anthropic 缺失) | 未安装 | 待 anthropics/skills 上游补充再装 |

### L3 Style Lock（互斥单选）

**自动可用风格（互斥单选）**：

| Skill | 触发词 | 变体 / 细分 | 何时不用 |
|---|---|---|---|
| `taste-skill` | 默认 fallback / "通用高质量" | **MODE A** Editorial Monochrome（Notion/Linear/SaaS/warm-monochrome）/ **MODE B** Double-Bezel Agency（浅色高级/嵌套硬件感）/ **MODE C** GSAP Scrollytelling（高动效/Awwwards） | 已明确具体风格 |
| `luxury` | "dark editorial / 黑底白字 / Oswald / fashion / architect portfolio" | — | 浅色 / SaaS / 数据密集 |

**user-invocable 1 个手动风格**：

| Skill | 何时用 |
|---|---|
| `brutalist-skill` | 数据密集 dashboard / 实验性 Swiss/military（误触发代价高，所以手动） |

**❌ 永远不要当主风格**：

| Skill | 实际身份 | 归属 |
|---|---|---|
| `redesign-skill` | 现有 UI 升级 workflow | L6 |
| `image-to-code-skill` | 图 → 代码 workflow | L2.5 |

### L4 Production
| Skill | 状态 | 触发 |
|---|---|---|
| `frontend-design@claude-plugins-official` | auto | 生产 UI 默认入口 |
| `anchor-prototype-wave` | auto | "全 surface 铺一遍 / hi-fi gallery / 4-15 个 surface" |
| `interface-design@interface-design` | auto | 长周期项目 / session 间一致 / 多页面系统 |
| `bencium-innovative-ux-designer` | **retired（superseded）** | 与 `frontend-design@official` 近重复；其"先问几问 + 出 2-3 备选"能力已被组合引擎 ask-first + EXPLORE 多候选吸收。不再自动路由；需要时手动调用 |
| `sens-frontend-design` | auto（窄） | "客户提案 / 高保真原型 / Reference→Anchors→Prototype 三段式"（不上线，出提案用）|
| `uiux-surface-builder` (agent, Wave B) | auto（orchestrator-driven，opus） | orchestrator 驱动的**并行多 surface 量产** agent；`anchor-prototype-wave` 的 sibling，由 `uiux-product-orchestrator` 在 max 档 P3 BUILD 调度 fan-out 铺多个 surface |

### L5 Platform
| Skill | 状态 | 触发 |
|---|---|---|
| Vercel namespace (34 skills) | auto | Next.js / React / shadcn / Turbopack / Vercel deploy |

### L6 Audit / Refinement
| Skill | 状态 | 触发 |
|---|---|---|
| `redesign-skill` | auto（已有 UI 时） | "升级 UI / redesign / 现有页面重做" |
| `ux-principles` MODE B | auto | "UI 不对劲 / fix spacing / 视觉层级修补"（细节已并入 `ux-principles/references/refactoring-ui-*.md`）|
| `visual-critique@designer-skills` | auto | 截图 critique / hierarchy / brand 一致性 |
| `design-audit@bencium-marketplace` | **(via bencium plugin)** | 系统级分阶段 fix plan |
| `gsd-ui-review` | manual gate | 6-pillar 视觉审计，PR 前 / 上线前 |
| `uiux-design-reviewer` (agent, Wave B) | auto（orchestrator-driven，opus） | **pre-release scored 设计 audit** agent；complements `gsd-ui-auditor`（不取代），由 `uiux-product-orchestrator` 在 P5 REVIEW 调度做发布前评分审查 |
| `gsd-ui-phase` | manual | GSD UI 阶段化推进 |
| `gsd-sketch` | manual | 早期 sketch / 低保真方向 |
| `motion-engineering` (L6 motion) | auto（窄） | "动效 / 动画 / motion / GSAP / scroll-trigger / 时间线 / spring / 微交互动效实现" —— GSAP recipe / 动效工程实现层。**≠ `emil-design-eng`（那是 motion-taste 取舍判断），它给可落地的 motion recipe** |

### L7 Design System / Designer Skills 子集
| Plugin | 状态 | 触发 |
|---|---|---|
| `design-systems@designer-skills` | auto | tokens / spacing / components / a11y |
| `ui-design@designer-skills` | auto（窄） | color palette / typography / layout grid |
| `interaction-design@designer-skills` | auto（窄） | micro-interaction / 动画原则 / state machine |
| `visual-critique@designer-skills` | auto（L6） | screenshot critique |
| `design-token-pipeline` | auto（窄） | "design token / token 管线 / Style Dictionary / DTCG / 多主题 / 暗色模式 token / 把 token 编译成 CSS / Tailwind theme from tokens / 多品牌主题" —— token-source → 多端代码**编译**（CSS vars / Tailwind v4 / TS / Swift / Android）。**≠ `theme-factory`/`brandkit`（那是 author 调色板/视觉），它只 compile 已定好的 token set** |
| `shadcn-registry` (Wave B) | auto（窄） | "shadcn registry / 私有组件库 / 复用设计系统 / 组件库分发 / self-hosted registry / 把组件发出去给多项目用" —— 自建私有 shadcn registry，分发自己的 design system；**wires to `design-token-pipeline`**（token set 编译进 registry 组件） |

### L8 Brand / Assets
| Skill | 状态 | 触发 |
|---|---|---|
| `brandkit` | auto | "logo / brand board / identity / 视觉资产系统" |
| `theme-factory` | auto | "10 预设主题 / theme tokens / 视觉系统初稿" |
| `canvas-design` | auto | "海报 / PNG / PDF / 视觉画布" |

### L9 Collection / Master

> 已移除（`ui-ux-pro-max` / `ux-design@wondelai` 已卸载）。narrower skill 优先原则仍适用：任何 L1-L8 有匹配时不要搜索 collection 替代。

### L10 Brand Landing 特例
| Skill | 状态 | 触发 |
|---|---|---|
| `luxury-editorial-site-builder` | auto（窄） | "100dvh hero video / 杂志感 / atelier landing / Hailuo/Veo/Kling 视频" |

### L11 Non-UI / Meta
| Skill | 状态 | 触发 |
|---|---|---|
| `remotion-best-practices` | auto | Remotion / 产品视频 |
| `meeting-analyzer` | auto | meeting transcript / .vtt / .srt / 会后复盘 |
| `skill-creator` | **name-only** | 用户明确"写新 skill / 优化 skill" |
| Codex 官方 plugin (`codex@openai-codex`) | plugin（非 skill，执行引擎） | 用户明确"用 Codex" / 跨模型 review / 委派：`/codex:review`（只读 review）· `/codex:adversarial-review`（对抗式 / santa-loop 第二评审员）· `/codex:rescue`（委派执行，支持 `--background`/`--resume`/`--effort`）· `/codex:status`·`/codex:result`·`/codex:cancel`·`/codex:setup`。Codex 额度耗尽 → fallback 到 Claude subagent。 |
| `codex-dispatch`（2026-06-10 新增 v2） | auto（窄，决策/纪律层，非执行） | "用 codex / 让 codex / 派给 codex / codex 调度 / cross-review with codex / 跨模型 review / 该不该用 codex"。**决定何时用 Codex、用哪个上面 plugin 命令、带什么纪律**（决策树 / 施工单模板 / 切尺度 caps / wave 强制 cross-review / Windows UTF-8 / fallback / 版本号不写死 / governed-gate 边界）。**不自己调 `codex exec`**——执行全部转交官方 plugin。详 `skills/codex-dispatch/SKILL.md`。 |
| `gitnexus-repo-map` (2026-05-25 新增) | auto（窄） | "GitNexus / repo map / visual code graph / architecture topology / 读开源项目 / 仓库架构 / 模块地图 / clusters" — 看全局、看图、读陌生 repo |
| `codegraph-cli` (2026-05-25 新增) | auto（窄） | "callers / callees / impact / blast radius / affected tests / who calls / what calls / code context / 调用链 / 影响面 / 受影响测试 / 读代码" — 查局部、查影响、辅助开发和测试 |
| `arch-viz` (2026-06-14 登记) | auto（窄） | "可视化 / 画 / 看架构 / architecture diagram / code graph / 给客户看的架构图 / 提交架构 bundle / refresh docs/architecture" — 扫 repo 出**可提交**的架构 bundle（`graph.json` + 离线 viewer + svg + md）；要 shareable/committable 架构图时用它（gitnexus 是 Noncommercial 不能提交，arch-viz 是 permissive） |

#### L11 子段：Code Reading Tools（2026-05-25 新增；2026-06-14 加 arch-viz）

> 三把刀（tools，不是子系统/gate/source-of-truth）。**GitNexus 看全局（探索，Noncommercial 不提交），CodeGraph CLI 打局部（symbol / 影响面），arch-viz 出可提交的架构 bundle（给客户/团队看，permissive license）。** 详 `~/.claude/skills/{gitnexus-repo-map,codegraph-cli,arch-viz}/SKILL.md`。

```
陌生 repo / 架构拓扑 / 可视化
        ↓
  gitnexus-repo-map
        ↓
  repo map · clusters · process flow · visual graph

本地开发 / 调用链 / 影响面 / 受影响测试
        ↓
  codegraph-cli
        ↓
  context · callers · callees · impact · affected tests
```

**何时用哪个**：

| 场景 | 选 |
|---|---|
| 读陌生开源项目 | `gitnexus-repo-map` |
| 看代码库整体拓扑 / architecture map | `gitnexus-repo-map` |
| 看 Web UI 图 (`gitnexus serve`) | `gitnexus-repo-map` |
| 查某个函数谁调用 | `codegraph-cli` |
| 查某个函数调用谁 | `codegraph-cli` |
| 改函数前看影响面 / blast radius | `codegraph-cli` |
| 根据 git diff 选测试 (`codegraph affected`) | `codegraph-cli` |
| 本地开发前构造任务上下文 | `codegraph-cli` |
| 两者都需要 | 先 `gitnexus-repo-map` 看全局，再 `codegraph-cli` 打局部 |

**铁律**：
- 不是 orchestrator，不是 gate，不是 source of truth — 是 context tool。
- GitNexus 不自动跑 `gitnexus setup` / 不注册 Claude Code hooks / 不改 `~/.claude/`。
- CodeGraph CLI 默认不开 MCP（`codegraph serve --mcp` 需 user 明确），不跑 `codegraph install`。
- `.gitnexus/` 和 `.codegraph/` 是 local cache，不是 harness evidence root。
- 生成的 `.claude/skills/generated/` 是项目本地的 disposable 文件，不进 `~/.claude/manifests/skills.manifest.json`。
- 它们不替代 GSD / UIUX / QA / AppSec / L12 — 是 supporting input。

### L12 Discoverability（2026-05-25 新增；2026-05-25 升级 GSD-lite Harness v1.0）

> **UIUX 主线下子层**，不是第 6 个 primary orchestrator。公开产物 release 下游 gate。
> **v1.2 升级（2026-05-25）**：从 prompt-only router 升级为 GSD-lite execution harness — orchestrator self-dispatches 4 narrow skills + 3 disc-* agents + discoverability-sdk.py + 5 project-level hooks。

| Skill | 状态 | 触发 |
|---|---|---|
| `discoverability-orchestrator` (v1.2) | auto | "discoverability / 可发现性 / 上线后被找到 / release readiness check (discoverability) / L12 audit / discoverability audit / 我的网站怎么被 ChatGPT / Google 找到 / AI search + 传统 SEO 一起做" |
| `web-seo` | auto via orchestrator | robots / sitemap / canonical / structured data / metadata / Lighthouse / Search Console；**Wave B §15 tech-SEO CI gate**（unlighthouse / lighthouse-ci / lhci，feeds seo channel） |
| `web-aeo` | auto via orchestrator | AI search / answer engines / llms.txt / citability / **GEO（AI search 语境）**；**Wave B §20 AI citation tracking**（citation monitoring / share of voice，**measurement-only**，不进 gate） |
| `web-local-seo` | auto via orchestrator | **Local SEO** / GBP / Maps / NAP / near me / 附近 / 本地服务（**不是** AI search；原 `web-geo`，2026-05-25 改名 web-local-seo） |
| `app-aso` | auto via orchestrator | App Store / Google Play / store listing / metadata / screenshots；**Wave B §16.6 ASO measurement**（◇mobile，keyword difficulty / install funnel / App Store Connect Analytics，**measurement-only**） |
| `discoverability-growth` | auto via orchestrator | growth / 关键词策略 / keyword strategy / content gap / 内容缺口 / 程序化 SEO / 该写什么内容 —— **growth-execution，不是第 5 个 audit channel**（不引入新 evidence channel / gate） |

**Harness v1.0 组件**（2026-05-25 新增）：
- SDK: `~/.claude/skills/discoverability-orchestrator/scripts/discoverability-sdk.py` — 10 core commands (init / classify / audit / evidence.append / evidence.validate / gate.check / report / mark-stale / explain / status) + `measure.pull` / `measure.compare`（**measurement-only，不进 gate.check**）
- Agents: `disc-scope-classifier` (cyan) / `disc-evidence-validator` (yellow) / `disc-remediation-planner` (green) / `disc-measurement-puller` (blue，post-launch 真实指标回流，script-first 不编造)
- Hooks (项目复制): `disc-session-context` (SessionStart) / `disc-mark-stale` (PostToolUse) / `disc-robots-sitemap-guard` (PreToolUse Edit/Write) / `disc-deploy-gate` (PreToolUse Bash) / `disc-evidence-required` (Stop)
- Evidence path: `evidence/discoverability/<tag>/{seo,ai-search,local,aso}.json` + `gate-result.yaml` (tag dimension 新增 v1.2 break change)
- Config: `discoverability.config.yaml` 加 `harness:` 段（strict_mode / required_channels / evidence_freshness_hours / deploy_commands）

**命名陷阱**：本体系 **GEO = Generative Engine Optimization → `web-aeo`**；Local SEO 已从 `web-geo` 改名为 `web-local-seo` 以消歧（2026-05-25 改名）。用户口中说 "GEO" 默认路由 `web-aeo`，除非有 GBP / Maps / NAP / 实体店等明确 Local SEO 上下文。

**执行宪法**：Script-first, AI-last —— 先跑 Lighthouse / vendor script，evidence 出来再让 AI 解读。不让 AI"凭感觉审计 SEO"。

**Safety-critical name freeze**：5 skills + 3 agents + 5 hooks + 10 SDK commands 名称冻结，改名 = 打掉 safety gate。详 SKILL.md §15.1。

**边界**：robots / noindex / llms.txt 是 crawler policy，**不是** access control（访问控制走 AppSec 主线）。AEO/GEO 启发式分数（citability_score / aeo_score / geo_score）永远不能作为 blocker。

**详情**：[docs/L12-DISCOVERABILITY.md](docs/L12-DISCOVERABILITY.md) / [rules/discoverability-l12.md](rules/discoverability-l12.md) / [templates/discoverability/harness-contract.md](templates/discoverability/harness-contract.md) / [templates/discoverability/](templates/discoverability/)

---

## 🔤 字母索引（~22 个非 GSD skill / 9 enabled plugins）

```
A: ai-native-interface (Layer P paradigm — AI-native 对话式产品交互范式，composes with L3 非 L3 风格),
   anchor-prototype-wave (L4), app-aso (L12), arch-viz (L11 Code Reading)
B: bencium-innovative-ux-designer (L4), brandkit (L8), brutalist-skill (manual L3)
C: canvas-design (L8), codegraph-cli (L11 Code Reading),
   competitive-teardown (L1)
D: design-audit (L6), design-systems (L7), design-token-pipeline (L7 — token→多端 compile, ≠ theme-factory/brandkit author),
   discoverability-growth (L12 — growth-execution, 非第 5 audit channel), discoverability-orchestrator (L12)
E: emil-design-eng (G0)
F: frontend-design@official (L4)
G: gitnexus-repo-map (L11 Code Reading), grill-with-docs (L1), gsd-* (68 skills),
   gsd-ui-phase / gsd-ui-review / gsd-sketch (L6)
I: image-to-code-skill (L2.5), imagegen-frontend-web (L2), interaction-design (L7),
   interface-design (L4)
L: luxury (L3), luxury-editorial-site-builder (L10)
M: meeting-analyzer (L11), motion-engineering (L6 motion — GSAP recipe, ≠ emil-design-eng taste)
O: output-skill (manual G0)
P: prototyping-ui-directions (L2)
R: redesign-skill (L6), remotion-best-practices (L11)
S: sens-frontend-design (L4), skill-creator (name-only)
T: taste-skill (L3 default), theme-factory (L8)
U: ui-design (L7), ux-principles (G0)
V: vercel:* (34 skills, L5), visual-critique (L6/L7)
W: web-aeo (L12), web-local-seo (L12, 原 web-geo), web-seo (L12)
```

---

## ⚠ 反模式（不要这么做）

1. ❌ 跳过 `ux-principles` 直接进 production
2. ❌ 同时**锁定**多个 L3 主风格（`taste` / `luxury` / `brutalist-skill` 一次只锁一个）—— 注：引擎 EXPLORE 阶段多风格候选预览是锁前采样，不算违规
3. ❌ `redesign-skill` / `image-to-code-skill` 当主风格用
4. ❌ `output-skill` 探索阶段强制完整
5. ❌ `theme-factory` 与 L3 主风格（`luxury` / `taste` 等）同时跑
6. ❌ `luxury-editorial-site-builder` 用在 product UI（它只做 brand landing）
7. ❌ 任务还没分类就无脑堆叠**同层竞争** skill — 先分类再走。**注（v2.3）**：create/optimize 任务走质量组合引擎，刻意**跨层**组合多个 skill（P0-P5）是正确行为；被禁的是"同层竞争 skill 抢活 / 不分类乱堆"，不是跨层质量组合
8. ❌ Vercel namespace 在非 Next.js / 非 React 项目自动触发 — 它只在技术栈明确时激活
9. ❌ 让 AI"凭感觉审计 SEO/AEO"（L12 必须 script-first，先跑 Lighthouse / vendor script，evidence 出来再让 AI 解读）
10. ❌ 把 `web-local-seo`（Local SEO，原 `web-geo`，2026-05-25 改名）和"GEO = Generative Engine Optimization"混用（后者归 `web-aeo`）
11. ❌ 把 robots.txt / noindex / llms.txt 当 access control（它们只是 crawler policy，访问控制走 AppSec 主线）
12. ❌ 把 L12 当第 6 个 primary orchestrator（它是 UIUX 下游子层）

---

## 🔧 维护

### 新增 / 改名 / 卸载一个 skill — 完整同步点清单（每次至少核对以下，按适用范围）

> **结构性根因**：一个 skill 的元数据散落在 ≥7 处，漏任何一处就会 drift（2026-06-10 加 3 个 AppSec skill 时一度漏掉 `skills.manifest.json` 与 `ORCHESTRATOR-MAP.md`，即此漏项复现）。**数量类陈述一律指向 manifest / registry，不在 prose 写死**（hook 计数、skill 计数、route 计数都从机器文件读）。

1. **SKILL.md** — skill 本体（`skills/<name>/SKILL.md`）
2. **本文件 `SKILLS-INDEX.md`** — 13-Layer 路由表对应层 + 字母索引 + （若有触发消歧）触发冲突表
3. **`CLAUDE.md`** — 仅当宪法级（主线 orchestrator 域 / safety gate / 反模式 / §3 AppSec 清单）才同步
4. **`manifests/skills.manifest.json`** — 加入对应 family（`supporting_skills.*` / `appsec_*` / `qa_layers` / 等）并 bump `generated_date`
5. **`manifests/skill-routing-policy.json`** — 仅当 skill 有 intent 触发词（加 route / trigger 词条）
6. **`docs/ORCHESTRATOR-MAP.md`** — 仅当属某 primary orchestrator 域（更新该 orchestrator 的 sub-skill 列表 + Last reviewed）
7. **`manifests/hook-registry.json`** — 仅当 skill 带 hook（加到对应 `categories.project_installed.subsystems.<sub>.hooks`，它是 hook 枚举单一真相源）
8. **`tests/appsec-routing/` fixtures** — 仅当是 AppSec 路由 skill（expected-routes.json / refusal fixtures）
9. **相关 `templates/`** — 仅当 skill 随附 project 模板 / snippet
10. **`schemas/`** — 仅当 skill 引入新 evidence/finding schema（创建真实文件，不留 forward-decl）

改完跑 `node tests/harness/run-all.js --quiet` 兜底（docs-drift + registry/manifest 一致性测试会抓住漏项）。

### 其它

- 治理配置变更后（settings.json / skill 增删）→ 重跑 `node tools/ccswitch-guard/ccswitch-guard.js --capture` 刷新 protected-keys snapshot（否则 `--restore` 会回滚到旧态、复活已删 skill override）
- skillOverrides 修改：编辑 `~/.claude/settings.json`，重启 Claude Code 生效
- 触发词冲突：更具体的优先（"iOS 应用" 优先于通用 "做个 app"）
- 月度复盘：哪些 skill 一次没用过？考虑改 `name-only` 或 `off`
