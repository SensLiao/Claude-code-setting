# Security Test Plan

> Owned by: `compliance.reporting` capability + consumed by `enterprise-qa-testing` orchestrator
> One plan per release / pre-prod window / scheduled security wave

---

## Basic Information

| Field | Value |
|---|---|
| System / Project | {{name}} |
| Version under test | {{tag / commit / build}} |
| Environment | dev / staging / preview / pre-prod |
| Release window | {{date range}} |
| Plan version | {{1.0}} |
| Plan owner | {{name}} |
| Plan date | {{YYYY-MM-DD}} |
| Sign-off required by | {{date}} |

---

## 1. Security Scope

### In-Scope Systems / Services / APIs
- {{system A}}
- {{API surface}}

### Explicit Out-of-Scope
- {{system B (do NOT touch)}}
- {{third-party (out of authorization)}}

### Third-Party / Vendor Boundary
- {{Stripe webhook}}: in-scope for replay/HMAC verification, out-of-scope for active attack on Stripe
- {{Auth0}}: in-scope for token validation, out-of-scope for active testing

### Data Classes Involved
- [ ] Public
- [ ] Internal
- [ ] Confidential (PII)
- [ ] Restricted (payment / health / credentials)

### Critical Business Flows
1. {{login / checkout / upload / admin action}}
2. ...

### High-Value Assets / Crown Jewels
- {{customer data / payment data / secrets vault / admin surface}}

---

## 2. Verification Targets and Baselines

### Verification Objectives
- {{e.g. 验证所有 ASVS 5.0 V2/V6/V7 控制项已实现}}
- {{e.g. 验证 OWASP API Top 10 全 10 项无 high+ finding}}
- {{e.g. 验证 release SECURITY.md 与实现一致}}

### Default Control Baselines
- [x] NIST CSF 2.0
- [x] NIST SSDF SP 800-218
- [x] OWASP ASVS 5.0 — Level: **L1 / L2 / L3**

### Overlay Baselines (如适用)
- [ ] OWASP MASVS（移动端项目）
- [ ] PCI DSS（支付项目）— SAQ Level: {{A / D}}
- [ ] 中国 PIPL + 数据出境（中国 PI / 跨境数据）
- [ ] OWASP LLM Top 10 + Agentic AI threats（GenAI / Agent 项目）
- [ ] CIS Benchmarks（云原生 / K8s 项目）
- [ ] ISO/IEC 27001:2022（ISMS 范围）

---

## 3. Test Items（每项一行 → 一份证据）

按 6-layer 组织：

### Governance Layer
- [ ] 资产盘点与攻击面核对（owner: {{}}）
- [ ] 威胁建模复核（threat-model-STRIDE.md）
- [ ] 风险登记表更新（risk-register.md）
- [ ] 安全 scope 与例外列表 lock

### App Layer
- [ ] SAST scan（tool: semgrep / CodeQL）
- [ ] Secrets scan（tool: gitleaks，含 git history）
- [ ] SCA / dependency audit（tool: npm audit / trivy / pip-audit）
- [ ] SBOM 生成（tool: CycloneDX / SPDX）
- [ ] SBOM 签名（tool: Cosign）— 如适用
- [ ] DAST baseline（tool: ZAP Baseline）
- [ ] IAST（如适用）

### Platform Layer
- [ ] Container / image scan（tool: Trivy / Hadolint）
- [ ] K8s 集群基线（tool: kube-bench → CIS K8s Benchmark）
- [ ] IaC scan（tool: Checkov / tfsec）
- [ ] 云姿态巡检（tool: Prowler）
- [ ] IAM / 权限审查
- [ ] Secrets 管理审查（centralized? rotation? OIDC?）
- [ ] 测试环境隔离验证

### Operations Layer
- [ ] 日志 schema 与覆盖率
- [ ] 监控告警规则验证
- [ ] 漏洞 patch 流程 dry-run
- [ ] 隐私 data flow 审查

### Response Layer
- [ ] Pentest（如计划）— 走 pentest-scope-and-roe → authorized-pentest-validation
- [ ] IR runbook dry-run
- [ ] Forensics 取证流程演练（如适用）

### Compliance Layer
- [ ] 控制映射表更新
- [ ] 证据清单收齐
- [ ] AppSec Release Evidence 生成

---

## 4. Triggers and Gates

| Stage | Trigger | Gate | Owner |
|---|---|---|---|
| Pre-commit | git commit | Secrets scan local hook | dev |
| PR | PR open | SAST + SCA + secret scan + code review | AppSec + dev |
| Build / CI | merge to main | SBOM + signing + IaC scan + container scan | platform |
| Pre-prod | tag release candidate | DAST baseline + IAM review + Secrets check | AppSec + platform |
| Release | promote to prod | AppSec Release Evidence sign-off | AppSec + product |
| Production smoke | post-deploy | smoke endpoint + auth flow + log emit verify | SRE |

**Exception approval path**：超过 SLA 或绕过 gate 必须经 {{role}} 书面批准并记录到 risk register。

---

## 5. Tools and Environment

### Tool Matrix
| Capability | Tool | Version | Owner |
|---|---|---|---|
| SAST | Semgrep | x.y | dev |
| Secrets | gitleaks | x.y | dev |
| SCA | npm audit + Trivy | latest | platform |
| SBOM | CycloneDX | x.y | platform |
| Signing | Cosign | x.y | platform |
| DAST | OWASP ZAP Baseline | x.y | AppSec |
| Container | Trivy + Hadolint | x.y | platform |
| K8s baseline | kube-bench | x.y | platform |
| IaC | Checkov | x.y | platform |
| Cloud posture | Prowler | x.y | platform |
| Logging | (TBD) | - | SRE |

### Test Environment Isolation
- [ ] 测试与生产 network 隔离
- [ ] 测试与生产凭证完全分离
- [ ] 测试数据 = 假数据 / 脱敏 production data
- [ ] 测试 artifact 不会回流生产
- [ ] DAST/pentest 目标在授权环境（local / lab / staging / preview）

---

## 6. Output Deliverables

- [ ] Test execution report（per tool）
- [ ] Risk register updated
- [ ] Vuln reports per finding (vuln-report.md)
- [ ] Regression test added in CI per high+ finding
- [ ] Risk acceptance log updated (if any)
- [ ] AppSec Release Evidence

---

## 7. Acceptance Criteria

- [ ] No Critical findings unresolved at release
- [ ] All High findings either resolved OR have signed risk acceptance with compensating control + review date
- [ ] SBOM 100% release coverage
- [ ] Signing 100% release coverage（如适用）
- [ ] DAST baseline 已跑 + 无 high+
- [ ] AppSec Release Evidence 已生成、已签字

---

## 8. KPIs to track

- 计划 vs 实际执行项比
- High+ 发现数 vs 关闭数
- SLA 命中率
- 工具误报率（按类目）
- 复测通过率

---

## 9. Sign-off

- [ ] AppSec lead reviewed: {{name}} / {{date}}
- [ ] Platform lead reviewed: {{name}} / {{date}}
- [ ] Product owner aware: {{name}} / {{date}}
