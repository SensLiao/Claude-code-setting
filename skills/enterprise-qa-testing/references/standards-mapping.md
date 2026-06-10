# Relocated from enterprise-qa-testing/SKILL.md — §15. Standards Mapping

## 15. Standards Mapping（国际标准锚点）

本 skill 的内部规则映射到以下行业标准，便于审计与对齐：

| 标准 | 映射 |
|---|---|
| **ISTQB CTFL** | risk-based testing → §3；test levels/types → §4；exit criteria → §11+Step9；defect reporting/triage → §9+Step7/8 |
| **ISO/IEC/IEEE 29119** | test processes → §6；test docs → §16；techniques → §4/§5；risk-based prioritization → §3 |
| **Test Pyramid (Fowler)** | unit/component/integration/E2E balance → §3+§4；fast feedback → §7 PR fast lane；broad-stack reserved → §3 High/Critical |
| **Testing Library** | user-observable behavior over implementation details → §2 Hard Rule 4 + §14 |
| **Playwright** | retries / traces / CI report artifacts → §4 Layer 6/7 + §7 + `qa-flaky-governance` + `qa-visual-regression` |
| **Vitest** | reporters / json / junit / coverage → §4 Layer 2-4 + §6 Step 5 (dispatch `qa-component-behavior`) + `qa-evidence-bundle` |
| **Lighthouse CI** | persistent run / save / assert → §4 Layer 9 + `qa-performance-reliability` |
| **WCAG 2.2** | a11y compliance → `qa-a11y-compliance` |
| **OWASP ASVS / ZAP baseline** | security controls verification → `appsec-security-orchestrator`（§12 handoff） |
| **k6 / MDN performance budgets** | load + budget → `qa-performance-reliability` |
| **Pact / OpenAPI / AsyncAPI** | consumer-driven contract → `qa-contract-api` |
| **Testcontainers / Docker Compose** | service virtualization → `qa-integration-service-virtualization` |

---

## 15.1 ISO/IEC 25010:2023 Product Quality（characteristic → layer）

详见 parent SKILL.md **§3.7** 的完整 9-characteristic 矩阵（Functional Suitability / Performance Efficiency / Compatibility / **Interaction Capability** / Reliability / **Security** / Maintainability / **Flexibility** / **Safety**）。要点：

- 2023 版相对 2011 版：**新增 Safety** 顶层特性；Usability → **Interaction Capability**（accessibility 是其子特性）；Portability 重组为 **Flexibility**。
- 引用一律带年份 `ISO/IEC 25010:2023`，避免与 2011 子特性命名混淆。
- Security / Safety 两特性**不在 QA 内闭环**：Security → §12 handoff `appsec-security-orchestrator`；Safety destructive 路径 → Floor Rule §3.6 + AppSec。

## 15.2 参考标准（REFERENCE-ONLY — 不进执行路径）

> 以下标准对**对齐 / 审计叙事 / 成熟度自评**有价值，但**不构成本 skill 的任何 gate、schema、decision 输入**。它们是"知道有这回事、能对话、能写进合规叙述"层级的锚点，**绝不**被任一 hook / agent / qa-sdk 命令强制执行。区别于 §15 / §15.1（那些是已落到 §3-§16 执行路径的映射）。

| 标准 / 模型 | 是什么 | 为何 REFERENCE-ONLY（不进执行路径） | 边界归属 |
|---|---|---|---|
| **TMMi**（Test Maturity Model integration） | 组织级测试**成熟度**分级模型（Level 1 Initial → 5 Optimization），对标 CMMI 的测试侧 | 它评的是"组织测试能力成熟度"，是**组织治理 / 过程改进**维度，不是"这次 release 能否发"的 per-run gate。本 skill 是 per-task/per-release orchestrator，TMMi 评估周期是季度/年度级 | 组织过程改进层（org-level），非本 skill 运行时职责 |
| **SLO / SLI / Error Budget**（SRE，Google SRE book / Implementing SLOs） | 生产环境**可靠性目标**（SLO）、指标（SLI）、错误预算 | 这是**运行时（production runtime）可靠性**边界——衡量"线上服务实际达标率"，靠 observability / monitoring（Prometheus / Grafana / APM）持续度量，**不是 pre-release 测试 gate**。本 skill §11 的 route-class CWV budget 是"发布前性能门槛"，与"线上 SLO 达标"是两回事，勿混 | **运行时可靠性边界**：归 SRE / observability，不归 QA pre-release gate。映射 ISO 25010:2023 Reliability 特性的"线上侧"，pre-release 侧才在 §4 Layer 9 / §6.5 |
| **Chaos Engineering**（Principles of Chaos / Netflix Chaos Monkey / Gremlin） | 主动向**生产或类生产**系统注入故障（kill 实例 / 注延迟 / 断网）验证弹性 | **类比 AppSec active scan：永不自动**。Chaos 实验是**主动破坏性**动作，可影响真实/类真实系统，必须显式授权 + ROE-like 计划 + blast-radius 控制 + 回滚预案，绝不在 QA 自动流程里触发（与 parent Hard Rule §2.6「No destructive production testing」一致） | 主动破坏性测试边界：需独立显式授权（类比 `authorized-pentest-validation` 的 manual hard gate 模式），不在本 skill 任一 Step 自动 dispatch |
| **IEEE 829**（Standard for Software Test Documentation） | 历史测试文档标准（Test Plan / Test Design Spec / Test Case Spec / Test Log / Incident Report 等模板） | **SUPERSEDED-BY ISO/IEC/IEEE 29119**（IEEE 829-2008 已被 29119 系列取代/吸收，IEEE 829 标记为 superseded）。新项目文档骨架一律按 **29119-3**（见 `qa-evidence-bundle` §10），不引 829 | DEPRECATED：仅作历史对照；现行文档骨架走 29119-3 |

**铁律重申**：本节四项都是**叙事 / 对齐 / 边界声明**用途。

- **不要**为它们新增 hook / agent / qa-sdk 命令 / schema 字段。
- **不要**把 SLO 达标、TMMi 等级、Chaos 实验结果塞进 `qa_evidence_bundle.release_decision` 的判定逻辑（§5 decision 规则不变）。
- Chaos / production fault injection 若确需进行 → 走独立显式授权流程（类比 AppSec pentest 双 gate），**绝不**由本 skill 自动发起。

---
