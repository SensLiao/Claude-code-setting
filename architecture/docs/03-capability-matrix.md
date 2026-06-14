# Capability Matrix

这份文档回答三个问题：**测什么、保什么安全、什么攻击路径被允许或禁止**。每一项都绑定到归属 skill、工具和版本化标准。

## 1. QA：测什么（9 层 + 4 横切）

| 层 | 能力 | 归属 skill | 工具 | 标准 | 何时必跑 |
|---:|---|---|---|---|---|
| 1 | Static 静态 | `qa-static-baseline` | tsc · ESLint · Prettier · npm audit · git-secrets | — | Low+（任何项目，不跳过）|
| 2 | Unit/TDD 单元 | `qa-test-design-tdd-bridge` → `tdd-guide` | Vitest（3 段桥）| Test Pyramid | Medium+ 或逻辑变更 |
| 3 | Component 组件 | `qa-component-behavior` | RTL · jsdom | — | UI 交互组件风险 |
| 4 | Integration 集成 | `qa-integration-service-virtualization` | MSW · Testcontainers · Compose | — | 跨模块/DB/cache/queue 边界 |
| 5 | Contract 契约 | `qa-contract-api` | OpenAPI · Pact · AsyncAPI · GraphQL | — | API/SDK/事件契约风险 |
| 6 | E2E 端到端 | `qa-e2e-coverage-gate` → `e2e-runner` | Playwright（3 段桥）| — | 关键用户路径 |
| 7 | Visual 回归 | `qa-visual-regression` | screenshot diff · Chromatic | — | UIUX release / 稳定设计系统 |
| 8 | A11y 无障碍 | `qa-a11y-compliance` | axe-core · playwright-axe | **WCAG 2.2** | public UI / commercial cert |
| 9 | Perf 可靠性 | `qa-performance-reliability` | Lighthouse CI · k6 · web-vitals | **Core Web Vitals**(LCP/INP/CLS/TBT) | release readiness / 性能敏感 |

### QA 横切能力

| 能力 | 归属 skill | 说明 |
|---|---|---|
| Smoke | `qa-smoke-release-safety` | `@smoke` 子集，每次部署 |
| Test data / environment | `qa-test-data-environment` | fixture · 角色 · 租户 · 数据隔离矩阵 |
| Flaky governance | `qa-flaky-governance` | 8 类 flaky 分类 · 8 字段问责 · 关键路径禁隔离 |
| Evidence bundle | `qa-evidence-bundle` | 聚合 `qa_evidence_bundle.yaml` + `release_decision` |

> 风险模型决定跑哪些层：`Impact × Likelihood + Exposure 修正(cap +10)` → Low/Medium/High/Critical，外加 Floor Rules（Impact≥5→≥High；+5 修正→≥Critical；生产写路径/公开未认证→≥Medium）。无全局覆盖率硬指标 —— 层由风险选。质量特性对齐 **ISO/IEC 25010:2023**。

## 2. AppSec：保什么安全（按 NIST CSF 2.0 六功能）

| CSF | 安全域 | 归属 skill | 标准 |
|---|---|---|---|
| **GV** Govern | 威胁建模 · 资产清单 · 数据分类 · authz 矩阵 · 控制覆盖 · 审计打包 | `security-governance-threat-modeling` · `appsec-sdk asset.inventory`/`data.classify`/`authz.matrix`/`control.coverage`/`audit.package` | STRIDE · NIST 800-154 · CSF 2.0 GV |
| **ID** Identify | SAST · SCA · secret scan · 供应链 · SBOM · provenance | `security-platform-supply-chain` · inline §16.4 | CWE · SSDF 800-218 · SLSA · CIS v8.1 |
| **PR** Protect | auth · authz · input validation · session · crypto · headers · API · file-upload · mobile · LLM · multitenant · websocket · secrets · IaC/cloud | `appsec-reviewer` · `security-app-*` overlays · `security-platform-secrets`/`iac-cloud` | ASVS 5.0 · API Top 10:2023 · LLM Top 10 · MASVS 2.x · NIST 800-190 |
| **DE** Detect | 被动 DAST baseline · logging · monitoring | `dast-baseline-scanning`（passive ZAP）| OWASP WSTG（passive）|
| **RS** Respond | 事件响应 · pentest 路径 · 红/紫队规划 | `security-response-incident-response` · `pentest-scope-and-roe` · `security-response-red-purple-team` | NIST 800-61r3 · MITRE ATT&CK |
| **RC** Recover | 备份验证 · 恢复测试 · RTO/RPO · BCP/DR | `security-response-recovery` | NIST CSF 2.0 RC |
| 合规 | payment · CN data · privacy | `security-compliance-payment`/`cn-data`/`privacy` | PCI DSS 4.0.1 · PIPL · GDPR/CCPA/CPRA |
| 可视化 | 安全图渲染（render-only） | `security-viz` | 从 `.appsec/` 事实源渲染，不是 arch-viz |

> 每条 finding 走 schema v1.0：`severity`/`confidence`/`asvs_mapping`(v5.0.0-N.N.N)/`csf_function`(GV-RC) 强制；空 `asvs_mapping` 必须给 `unmapped_reason`。验证器永不接受 ASVS 4.x 旧标识符。

## 3. Offensive：什么攻击被允许（全部多锁、绝不自动开火）

| 类型 | 默认状态 | 条件 | 归属 |
|---|---|---|---|
| 被动 DAST baseline | 可自动 | 授权 staging/preview，零攻击 payload | `dast-baseline-scanning` |
| 主动 pentest | **manual-only** | 13 字段 ROE + scope + time window + 逐字签字 | `pentest-scope-and-roe` → `authorized-pentest-validation` |
| Red/Purple team | **planning-only** | 只做 MITRE ATT&CK → 控制/检测覆盖映射，永不执行攻击 | `security-response-red-purple-team` |
| 生产 host active scan | **禁止** | 无例外，即使有 ROE 也硬拒 | `appsec-active-scan-guard.js` |

### 主动渗透的 5 把独立锁

```text
① 模型隐藏 skill (disable-model-invocation)         ④ 当前时间在 ROE time_window 内
② manual-only validation agent                      ⑤ 用户逐字写 "I authorize this
③ 13 字段 ROE 经 appsec-sdk roe.verify 校验             pentest validation per ROE"
                          ↓ 全部满足才放行；生产 host 仍硬拒
```

ROE 13 字段：`target_identification` · `authorization_proof` · `environment` · `scope` · `allowed_methods` · `disallowed_methods` · `time_window` · `rate_limits` · `test_accounts` · `data_handling` · `emergency_contact` · `rollback` · `reporting_format`。

## 4. 绝对禁止项

- destructive / DoS；
- persistence；
- credential theft；
- data exfiltration；
- stealth / evasion；
- out-of-scope scanning；
- production active scanning；
- 绕过 ROE 或签字短路。

由 `appsec-active-scan-guard.js`（拦 sqlmap / nmap -sV / nuclei / ffuf / hydra / msfconsole 等）+ `appsec-pentest-authorization.js` 双 hook 物理强制，不是仅靠 prompt 约定。
