# Quality Requirements

> 此文档定义本项目的商业级质量模型。由 `claude-env-bootstrap` 从全局模板复制至项目 `.planning/`。
> 由 `enterprise-qa-testing` orchestrator 维护；AppSec 部分由 `appsec-security-orchestrator` 维护。
> 填写说明：将所有 `{{...}}` placeholder 替换为项目实际值。

---

## Commercial Quality Tier

| 字段 | 值 |
|---|---|
| 项目类型 | `{{project_type}}` — proposal / prototype / MVP / production candidate |
| Commercial target | `{{commercial_target}}` — 内部工具 / B端客户 / C端用户 / 客户提案演示 |
| Quality strictness | `{{quality_level}}` — minimal / commercial MVP / production-like / audit-sensitive |

---

## 9-Layer Quality Gates

每一层标注：**required** / **optional** / **skipped** + 理由（skipped 必须写理由）。

### Layer 1 — Static Analysis

| 检查项 | 状态 | 工具 |
|---|---|---|
| Type check | `{{required/skipped}}` | tsc / mypy / pyright |
| Lint | `{{required/skipped}}` | ESLint / Ruff / Clippy |
| Format | `{{required/skipped}}` | Prettier / Black / rustfmt |
| Dependency audit | `{{required/skipped}}` | npm audit / pip-audit / cargo audit |
| Secret scan | `{{required/skipped}}` | gitleaks / git-secrets |

### Layer 2 — Unit

- 工具：`{{vitest/jest/pytest/cargo test}}`
- Coverage target：`{{percent}}`% (business logic default 80%; utility functions 60% floor)
- 理由（若 <80%）：`{{reason}}`

### Layer 3 — Component

- 工具：Vitest + Testing Library
- 状态：`{{required/skipped}}`
- 理由：`{{reason}}`

### Layer 4 — Integration

- 工具：Vitest + MSW / pytest + httpx
- 状态：`{{required/skipped}}`
- 覆盖范围：API handlers / state / routing / `{{other}}`

### Layer 5 — Contract

- 工具：MSW handlers（单团队）/ Pact（跨团队）— `{{tool}}`
- 状态：`{{required/skipped}}`
- 理由：`{{reason}}`

### Layer 6 — E2E

- 工具：Playwright
- 状态：`{{required/skipped}}`
- Critical journeys：`{{list journeys}}`
- 注：async Server Components 必须路由至 E2E（Vitest 不支持）

### Layer 7 — Visual Regression

- 工具：Playwright toHaveScreenshot
- 状态：`{{required/skipped}}`
- 理由（设计是否稳定）：`{{reason}}`
- Baseline 位置：CI Docker（**不用本地 Mac**）

### Layer 8 — Accessibility

- 工具：@axe-core/playwright + vitest-axe
- 状态：`{{required/optional}}`
- 标准：critical violations = 0（阻断 CI）

### Layer 9 — Performance

- 工具：Lighthouse CI
- 状态：`{{required/skipped}}`
- Targets：LCP <2.5s / INP <200ms / CLS <0.1（内部工具可放宽，需文档化）

### + Smoke

- 状态：`{{required/skipped}}`
- Targets：首页加载 / 登录可用 / 核心 API 200

---

## AppSec Baseline

如下任一触发项打勾 → AppSec baseline **required**：

- [ ] backend / server-side code
- [ ] API endpoint
- [ ] authentication / authorization
- [ ] user data handling（个人信息/未成年人数据）
- [ ] file upload
- [ ] payment
- [ ] admin surface
- [ ] production deployment

**若触发，以下全部必须完成：**

- [ ] Dependency audit — 0 critical/high
- [ ] Secret scan (gitleaks) — 0 hits
- [ ] SAST (semgrep p/ci or p/owasp-top-ten) — 0 critical
- [ ] Auth & authz review（路由至 appsec-reviewer agent）
- [ ] Input validation review
- [ ] API security review（若有 API）— API Top 10 mapping
- [ ] Security headers（CSP / HSTS / SameSite / Secure / HttpOnly）— automated check
- [ ] OWASP ASVS L1 mapping — V2 / V3 / V4 / V5 / V8 / V9（V11 / V13 if applicable）
- [ ] OWASP WSTG passive sections checklist
- [ ] OWASP API Security Top 10（若有 API）
- [ ] DAST baseline（ZAP Baseline against staging/preview）— passive only

---

## Authorized Pentest（OPTIONAL — 仅用户明确要求时）

1. 先运行 `pentest-scope-and-roe` 生成 `.planning/PENTEST-ROE.md`
2. Active validation 通过 `authorized-pentest-validation`（manual-only）
3. 开始 active testing 前必须：11-item ROE checklist 完成 + 用户明确书面授权

---

## CI Lanes Configuration

| Lane | 触发时机 | 运行内容 | 目标时间 |
|---|---|---|---|
| PR fast | push to PR branch | static + unit + component + integration | <3 min |
| Merge full | merge to main | + E2E sharded + a11y | <10 min |
| Release gate | tag / release branch | + visual regression + Lighthouse + smoke + AppSec summary | <20 min |

---

## Release Readiness Evidence（commercial MVP）

发布前必须全部勾选：

- [ ] All CI lanes green
- [ ] Coverage report 达到 §Layer-2 目标
- [ ] AppSec baseline summary attached（若 AppSec 触发）
- [ ] Smoke test report from preview/staging
- [ ] Risk register — known issues + risk acceptance 文档化
- [ ] Rollback plan documented
- [ ] On-call / contact information current

---

## Not Required Yet（防过度工程）

以下在本里程碑**不要求**，未来根据客户/监管需求再加：

- [ ] Full DAST against production
- [ ] Heavy load testing / chaos engineering
- [ ] SOC2 / ISO27001 / PCI-DSS compliance
- [ ] Production observability / SIEM / alerting
- [ ] Bug bounty program

---

## Anti-patterns

- ❌ "Tests pass" 声明但无 terminal stdout 证据
- ❌ Visual regression baseline 未经用户授权自动更新
- ❌ E2E 中 mock 整个 backend（失去测试意义）
- ❌ 以"只是 MVP"为由跳过 AppSec baseline
- ❌ 测试失败时调低 CWV 阈值而非修复问题
- ❌ 用新 high-severity 依赖修复 medium 问题
