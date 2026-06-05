# Relocated from appsec-security-orchestrator/SKILL.md — §3. NIST CSF 2.0 Function Mapping

## 3. NIST CSF 2.0 Function Mapping（六大功能映射）

NIST CSF 2.0 把网络安全管理组织为 6 大职能。本 orchestrator 的所有动作都映射到至少一个 function：

| CSF Function | 本 orchestrator 涵盖范围 | 主要 capability layer |
|---|---|---|
| **GV** Govern | 安全 scope、风险接受、例外管理、合规策略 | governance + compliance |
| **ID** Identify | 资产盘点、数据流图、攻击面识别、威胁建模、风险评估 | governance |
| **PR** Protect | 身份/访问控制、数据保护、配置基线、加密、培训 | app + platform |
| **DE** Detect | 安全日志、监控、告警、异常检测 | operations |
| **RS** Respond | 事件响应、取证、通报、遏制、根因分析 | response |
| **RC** Recover | 业务恢复、备份验证、恢复测试、复盘改进、BCP/DR | response.recovery |

> **Internal evidence completeness gate, not a NIST checklist claim**：
> NIST CSF 2.0 明确说 Core outcomes "are not a checklist of actions to perform"。本 orchestrator 的
> `csf2_coverage` 字段是**内部 evidence completeness gate**：把本次 release 已收集的 AppSec evidence 映射到
> 6 个 function，给每个 function 标 PASS / PARTIAL / MISSING。这不等同于"NIST 要求每次 release 6 函数全 PASS"。
> 措辞与表态责任由本 skill 承担，不外推到 NIST 标准本身。

---


---

# Relocated from appsec-security-orchestrator/SKILL.md — §4. Lifecycle Trigger Table

## 4. Lifecycle Trigger Table（生命周期触发器）

| 生命周期阶段 | 强制触发器 | 必跑 capability |
|---|---|---|
| 立项 / 需求 | 新系统、敏感数据、互联网暴露、并购整合 | `governance.inventory` + `governance.scope` + `governance.threat_modeling` + `governance.risk_assessment` |
| 架构设计 | 认证模型变化、第三方接入、数据流变化 | `governance.threat_modeling` + `platform.iam` + `operations.privacy` + `platform.network_boundary` |
| 编码 / PR | 每次提交、依赖新增、Secrets 变更 | `app.sast` + `platform.secrets`（leak scan）+ `app.sca` |
| 构建 / CI | 每次 build、发布候选生成 | `app.sca`（SBOM）+ `app.sbom_signing` + `platform.iac_cloud` + `platform.container_k8s` + `app.cicd` |
| 测试 / 预发 | 上线前、入口变更、认证逻辑变更 | `app.dast`（baseline）+ 必要时 `app.iast` + `platform.test_environment` |
| 部署前 | 新环境、K8s/云配置变化 | `platform.container_k8s` + `platform.iac_cloud` + `platform.iam` + `platform.secrets` + `platform.test_environment` |
| 生产运行 | 持续 | `operations.logging_monitoring` + `operations.vuln_patch` + 必要时 `app.rasp` |
| 演练 / 事件 / 审计 | 年度演练、真实事件、客户审计 | `response.pentest_*` + `response.incident_response` + `response.forensics` + `compliance.audit` + `compliance.metrics` + `compliance.reporting` |
| 事件后恢复（CSF RC） | 真实事件触发恢复 OR 计划 DR 演练 OR 季度 backup validation | `response.recovery` |

---


---

# Relocated from appsec-security-orchestrator/SKILL.md — §6. 标准映射 Standards Mapping

## 6. 标准映射（Standards Mapping）

### 6.1 OWASP ASVS 5.0

| Level | 适用场景 | 要求强度 |
|---|---|---|
| L1 | 商业 MVP、低风险公开内容 | 自动化工具可覆盖 |
| L2 | 含 user data、含 auth、含支付 | 需要人工代码审查（**默认推荐**） |
| L3 | 高安全性：医疗、金融、政府 | 需要架构师级审查 + 渗透测试 |

**ASVS 5.0 主要控制章节**：V1 Encoding / V2 Validation / V3 Web Frontend / V4 API / V5 File Handling / V6 Authentication / V7 Session / V8 Authorization / V9 Self-contained Tokens / V10 OAuth / V11 Cryptography / V12 Secure Communication / V13 Configuration / V14 Data Protection / V15 Secure Coding / V16 Security Logging / V17 WebRTC（如适用）

> **ASVS identifier 格式（v3.0 P0.1 校正）**：
> 所有 finding YAML 中的 `asvs_mapping[]` 字段必须使用 OWASP 官方
> `v<version>-<chapter>.<section>.<requirement>` **三段数字** 格式，例如 `v5.0.0-1.2.5`、`v5.0.0-6.2.1`。
> 校验正则：`^v5\.0\.0-\d+\.\d+\.\d+$`
> 旧 ASVS 4.x 标识符（`V2.1.1` / `V3.2.4` 等）由 `appsec-finding-schema.js` PreToolUse hook **物理拒绝**写盘。

### 6.2 OWASP WSTG (passive only)

Passive：WSTG-INFO / WSTG-CONF / WSTG-IDNT / WSTG-INPV (code review) / WSTG-ERRH / WSTG-CRYP / WSTG-CLNT
Active（路由出去）：WSTG-ATHN / WSTG-ATHZ / WSTG-SESS / WSTG-BUSL / WSTG-API active fuzz → `authorized-pentest-validation`

### 6.3 OWASP API Security Top 10 (2023)

API1 BOLA / API2 Auth / API3 BOPA / API4 Resource Consumption / API5 BFLA / API6 Business Flows / API7 SSRF / API8 Misconfig / API9 Inventory / API10 Unsafe Consumption

### 6.4 其他标准（按需）

NIST SSDF SP 800-218 / SP 800-30 R1 / SP 800-40 R4 / SP 800-53A R5 / SP 800-61 R3 / SP 800-63B-4 / SP 800-92 / SP 800-154 / SP 800-190 / CIS Controls v8.1 / OWASP MASVS+MASTG / OWASP LLM Top 10 + Agentic AI Threats / OWASP SCVS + SLSA / ISO/IEC 27001:2022 / PCI DSS / 中国 PIPL + 数据出境

### 6.5 OWASP Top 10:2025（Web Application Security Risks）

> 2025 版正式发布，取代 2021 版作为主 Top 10。官方有序列表（primary-source verified
> 2026-06-05, https://owasp.org/Top10/2025/）：

| # | 2025 类别 | 相对 2021 的关键变化 |
|---|---|---|
| A01:2025 | Broken Access Control | 续居第 1（40 CWEs）|
| A02:2025 | Security Misconfiguration | 上升 |
| A03:2025 | Software Supply Chain Failures | **由 A06:2021 Vulnerable & Outdated Components 扩展**；5 CWEs，数据中出现最少但 CVE 平均利用/影响分最高 |
| A04:2025 | Cryptographic Failures | — |
| A05:2025 | Injection | **由 A03:2021 降至 A05** |
| A06:2025 | Insecure Design | — |
| A07:2025 | Authentication Failures | — |
| A08:2025 | Software or Data Integrity Failures | — |
| A09:2025 | Security Logging and Alerting Failures | — |
| A10:2025 | Mishandling of Exceptional Conditions | **新增类别**；24 CWEs（错误处理不当 / 逻辑错误 / fail-open / 异常条件误处理）|

**数据集规模（官方逐字核实；四个口径勿混淆）**：
- ~**220,000** CVEs extracted（160k 有 CVSS v2 / 156k v3 / 6k v4）
- ~**175,000** CVE→CWE mapped records（2021 为 125k）
- **643** unique CWEs mapped to CVEs in the dataset（2021 为 241）
- **248** CWEs within the final 10 categories

> 引用统计必须区分这四个数字（"643 数据集映射 CWE" ≠ "248 的 10 类内 CWE"）。
> **Finding 标签已迁移到 2025**（2026-06-05）：finding schema 的 `owasp_top10` 字段示例/模板现用 `A<n>:2025`
> （见 SKILL.md §9 + finding.yaml.tmpl）；**legacy `A<n>:2021` 仍被接受**（prewrite 未硬切，避免废掉存量 finding）。
> 注意分类位移：Injection `A03:2021`→`A05:2025`，Software Supply Chain Failures = `A03:2025`。

---
