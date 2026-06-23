# Security Risk Register

> Owned by: `security-governance-risk-assessment` capability (planned skill) + `compliance.reporting`
> Standards: NIST SP 800-30 Rev. 1 (Risk Assessment) + CSF ID.RA + ISO/IEC 27005

This is the **persistent** risk register. Findings transition through it. Risk acceptance is recorded here, not lost in chat.

---

## Project Identification

- Project: {{project_name}}
- Owner: {{security_owner_name}}
- Last reviewed: {{YYYY-MM-DD}}
- Next review due: {{YYYY-MM-DD}}（每季度强制 review）
- Total open risks: {{N}}
- Critical open: {{N}}, High open: {{N}}

---

## Risk Rating Method

按 NIST SP 800-30 Rev. 1 公式：

```
Initial Risk = f(Threat Source × Vulnerability × Likelihood × Impact)
Residual Risk = Initial Risk − Compensating Controls
```

5x5 矩阵：

| Impact \ Likelihood | Very Low | Low | Medium | High | Very High |
|---|---|---|---|---|---|
| Very High | Medium | High | Critical | Critical | Critical |
| High | Low | Medium | High | Critical | Critical |
| Medium | Low | Low | Medium | High | High |
| Low | Very Low | Low | Low | Medium | Medium |
| Very Low | Very Low | Very Low | Low | Low | Medium |

修复 SLA（与 orchestrator §10 一致）：
- **Critical**: 24-72h
- **High**: 7-14d
- **Medium**: 30d
- **Low**: 90d 或纳入版本规划

---

## Risk Register Table

| Risk ID | Asset / Flow | Threat Scenario | Vulnerability | Impact | Likelihood | Initial Risk | Existing Controls | Planned Controls | Residual Risk | Owner | Due | Status | Risk Acceptance Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| R-001 | Payment API | 对象级越权读取他人订单 | 缺少服务端对象级授权 | High | Medium | **High** | JWT auth | Resource-level authz + audit | Medium | 张三 | 2026-06-15 | Open | - |
| R-002 | File upload | 上传恶意文件触发解析漏洞 | 仅校验 Content-Type | High | Medium | **High** | size limit | Extension whitelist + signature check + sandbox | Medium | 李四 | 2026-06-20 | Open | - |
| R-003 | Admin surface | 横向越权访问管理后台 | 共享身份系统 | Very High | Low | **Medium** | RBAC role check | Separate auth domain + IP allowlist | Low | 王五 | 2026-07-01 | Open | - |
| R-004 | Logging | 敏感数据写入应用日志 | 缺少 PII redaction | Medium | High | **High** | none | Pino redact rule + log dictionary | Low | 赵六 | 2026-06-10 | In Progress | - |

---

## Risk Acceptance Log

如果选择不修复，必须记录在这里：

| Risk ID | Why Not Fixing | Compensating Controls | Approver | Approval Date | Review Date |
|---|---|---|---|---|---|
| R-XXX | {{technical / business / regulatory reason}} | {{what reduces risk in lieu of fix}} | {{name + role}} | {{date}} | {{date — quarterly}} |

**铁律**：
- Critical / High risk 接受必须 CISO / Engineering Director / 安全负责人 三人之一签字
- 接受期最长 90 天，到期必须 re-review
- 接受理由必须包含"compensating control"——纯"暂时没空"不构成接受理由

---

## Closed Risk Audit Trail

定期归档已关闭风险，便于审计与复盘：

| Risk ID | Closed Date | Closed By | Resolution Type | Verification Evidence |
|---|---|---|---|---|
| R-XXX | {{date}} | {{name}} | Fixed / Risk Accepted / Risk Transferred / No Longer Applicable | {{link to regression test / approval doc / risk transfer agreement}} |

---

## KPIs（建议跟踪）

- 高危风险平均闭环时长（MTTR）：{{N}} days
- 超期未闭环高危数：{{N}}
- 接受期超期数：{{N}}
- 每季度新增 vs 关闭风险数比

参考：NIST SP 800-55 (Performance Measurement Guide)。

---

## 与其他系统接口

- 上游输入：
  - `templates/threat-model-STRIDE.md` 的 §7 Control Gap Inventory
  - `templates/vuln-report.md` 每个 finding
  - DAST / pentest 报告
  - 外部漏洞披露 / CVE 通告
- 下游使用：
  - `templates/security-test-plan.md` 引用本 register 决定测试优先级
  - AppSec Release Evidence §2 引用本 register 摘要
  - `gsd-verify-work` / `gsd-ship` 把本 register 摘要作为 release gate
