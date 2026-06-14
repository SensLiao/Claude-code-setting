---
name: security-platform-supply-chain
canonical_id: security.platform.supply_chain
aliases: [sbom, sca-deep, supply-chain, sbom-signing, software-supply-chain]
version: 1.0.0
status: stable
created_date: 2026-06-10
last_updated: 2026-06-10
allowed-tools: Read, Grep, Glob, Bash
forbidden-tools: WebFetch
manual_gate_required: false
disable-model-invocation: false
standards_versions:
  - OWASP Top 10: 2025 (A03 Software Supply Chain Failures — elevated #3)
  - OWASP ASVS: 5.0 (V8 Authorization / V10 OAuth&OIDC / V13 Configuration / V15 Secure Coding & Architecture)
  - OWASP SCVS: latest (Software Component Verification Standard)
  - SLSA: v1.0 (Supply-chain Levels for Software Artifacts)
  - CycloneDX: 1.6
  - SPDX: 3.0 / 2.3
  - in-toto attestation: v1.0
  - Sigstore / cosign: latest
  - NIST SSDF SP 800-218: 1.1 (PS / PW / RV practices)
  - NIST SP 800-161 Rev. 1: C-SCRM
  - NIST CSF: 2.0 (ID.RA / ID.SC / PR.DS / PR.PS / DE / RC for CSPM)
  - Prowler: latest (multi-cloud CSPM, Apache-2.0; AWS/Azure/GCP/K8s; 44+ compliance frameworks)
  - Reachability FP evidence: CODASPY'26 preprint (arXiv 2511.20313) — MEDIUM confidence (single preprint, n=113/4 repos)
sensitive_data_rules:
  never_read: [".env*", "secrets/**", "*.pem", "*.key", "cloud credentials", "*.aws/credentials"]
  never_write: ["actual secret values", "real signing private keys", "cosign.key contents", "cloud access keys"]
  redact_on_output: ["tokens", "credentials", "registry passwords", "signing key material", "cloud account IDs / ARNs with secrets"]
upstream:
  - appsec-security-orchestrator
  - security-governance-threat-modeling  # 揭示供应链攻击面
downstream:
  - security-remediation  # 高危依赖 / 未签产物转 finding
  - appsec-security-orchestrator  # 回 orchestrator
description: >
  Software supply-chain security review — SBOM generation (CycloneDX / SPDX),
  deep SCA beyond `npm/pip/cargo audit` (transitive vulns, lockfile integrity,
  reachability, VEX suppression, license risk), provenance & artifact/image
  signing (SLSA / in-toto / Sigstore-cosign), container image supply chain
  (digest-pinned base + verify-on-deploy), dependency-confusion / typosquatting /
  malicious-package defenses, and build-pipeline integrity. Also covers
  reachability-based noise reduction (raw SBOM vuln lists are a candidate set,
  not a worklist — ~92% contextual FP; prune to reachable+unmitigated) and
  cloud posture management (CSPM via Prowler — live cloud config audit,
  complementary to security-platform-iac-cloud's IaC-template scanning). Fills
  the orchestrator §5.2 `sbom_signing` gap and deepens `sca`. Maps to OWASP Top
  10:2025 A03, ASVS 5.0, SLSA, NIST SSDF / SP 800-161. Does NOT run active
  exploitation — wrapper/CLI scanning on the local repo + read-only cloud
  posture evaluation only.
trigger_phrases:
  - SBOM / software supply chain / 供应链安全
  - SCA / dependency vulnerability / 依赖漏洞 / transitive dependency
  - CycloneDX / SPDX / SCVS
  - SLSA / provenance / in-toto / build attestation
  - cosign / sigstore / artifact signing / image signing / 镜像签名
  - dependency confusion / typosquatting / malicious package / lockfile integrity / VEX
  - reachability / reachable vulnerability / 可达性 / 漏洞降噪 / SCA 误报 / vuln noise reduction
  - CSPM / cloud posture / cloud security posture / prowler / 云安全配置 / 云姿态 / cloud misconfiguration
---

# Security Platform — Software Supply Chain

## 1. Mission

供应链是当前 harness 最大的 AppSec 缺口。OWASP Top 10:2025 把它从 2021 的 "A06 Vulnerable & Outdated Components" 升级为 **A03 Software Supply Chain Failures**——数据集里出现频率最低，但平均 CVE 利用/影响分**最高**。

本 skill 把"供应链安全"从"跑 `npm audit` 看有没有红"升级为完整闭环：**清点（SBOM）→ 深度 SCA → provenance & 签名 → 容器镜像链 → malicious-package 防御 → build-pipeline 完整性**。

**职责边界**：
- 生成 / 审查 SBOM（CycloneDX + SPDX）
- 深度 SCA：transitive vuln、lockfile 完整性、reachability、VEX、license risk
- 验证 provenance + 产物/镜像签名（SLSA / in-toto / cosign）
- 审查 dependency-confusion / typosquatting / malicious-package 防御
- 审查 CI build-pipeline 完整性
- **不**执行 active exploitation；**不**改基础设施（review + report only）
- **不**碰真实 signing private key / registry 凭证内容（§sensitive_data_rules 禁止）

**与同层 skill 的边界**：
- `security-platform-secrets`：CI 凭证轮换 / OIDC / leak 扫描归它；本 skill 只在发现 install-script / lockfile 内嵌 secret 时 handoff。
- `security-platform-iac-cloud`：Dockerfile lint / 镜像 **CVE** 扫描 / K8s manifest misconfig 归它；本 skill 管镜像的**供应链维度**（digest pin / 签名 / admission verify / provenance），与它互补不重叠。重叠区（镜像签名 + verify-on-deploy）以本 skill 为主，结论同写 Release Evidence §9 Platform Layer。

---

## 2. Activation Triggers

| Trigger | Action |
|---|---|
| 项目有 lockfile（package-lock / pnpm-lock / poetry.lock / Cargo.lock / go.sum）| 默认激活：深度 SCA + lockfile 完整性 |
| 构建 / CI 阶段（生成 release artifact）| 生成 SBOM + 评估 provenance/签名 |
| 容器化项目（Dockerfile / 镜像产物）| 镜像供应链：digest pin + 签名 + verify-on-deploy |
| 上线前 release gate | SBOM 存档 + 签名验证 + critical 依赖漏洞清零 |
| 新增 / 升级依赖 | typosquatting + dependency-confusion + install-script review |
| 引入私有 registry / scoped package | namespace 预留 + scoped registry 配置审查 |
| 供应链事件（malicious package 曝光 / 依赖被投毒）| 立即排查 + handoff incident-response |
| 客户 / 合规要求 SBOM | 生成符合 NTIA minimum elements 的 CycloneDX / SPDX |
| SCA 输出噪声大 / 高危漏洞数百条难以下手 | 激活 reachability 剪枝（§5.4）：候选集 → 只升 reachable+无缓解 |
| 项目部署到云（AWS/Azure/GCP/K8s）且有只读访问授权 | 激活 CSPM（§9.5 Prowler）：评估 live 云姿态（与 iac-cloud 模板扫描互补）|

**判断规则**：不假设"项目小所以没有供应链风险"。任何有 lockfile 或 build artifact 的项目都有传递依赖与供应链面，必须明确判断，不跳过。

---

## 3. The 6 Pillars（覆盖矩阵）

| # | Pillar | 核心问题 | 主要工具 |
|---|---|---|---|
| 1 | **SBOM 生成** | 我们到底依赖了什么？（含传递）| syft / cdxgen / `npm sbom` / trivy |
| 2 | **深度 SCA** | 这些依赖里哪些漏洞**真的可被利用**？| osv-scanner / trivy / grype / + VEX |
| 3 | **Provenance & 签名** | 这个产物**真的是我们的 CI** 构建的吗？| cosign / slsa-verifier / in-toto |
| 4 | **容器镜像链** | base image 钉死了吗？部署时验签了吗？| cosign verify / digest pin / policy-controller |
| 5 | **Malicious-package 防御** | 装包时会不会被投毒 / 抢注 / 串名？| scoped registry / pinned+hash install |
| 6 | **Build-pipeline 完整性** | CI 本身被攻破了怎么办？| OIDC / protected branch / 2-person review |

**两条横切能力**（贯穿 Pillar 2 与云侧，2026-06-15 补强）：

| 横切 | 核心问题 | 归属 | 工具 |
|---|---|---|---|
| **Reachability 降噪** | raw SBOM 漏洞表 ~92% 是上下文误报——哪些**真在调用路径上**？ | 深化 Pillar 2（§5.4）| osv-scanner call-graph / Joern (借 `security-app-sast-deep`) |
| **Prowler CSPM** | 云配置（IAM/网络/加密/日志）合规吗？ | 新增 §9.5（云姿态）| prowler（Apache-2.0，多云 600+ AWS 检查/44 框架）|

---

## 4. Pillar 1 — SBOM Generation

SBOM = Software Bill of Materials，软件成分清单。它是**所有其它 pillar 的地基**：没有清单就没法做 SCA、没法回答"log4shell 影响我们吗"。

### 4.1 两种格式（都要会，按消费方选）

| 格式 | 标准 | 何时用 |
|---|---|---|
| **CycloneDX** | OWASP，1.6 | security 用途首选——原生支持 VEX、漏洞、pedigree、依赖图谱 |
| **SPDX** | Linux Foundation / ISO 5962，3.0 | license/合规 + 政府交付首选（NTIA、US EO 14028 偏好）|

可双格式产出，二者可互转（不丢关键字段时）。

### 4.2 工具与命令（wrapper / CLI only，只读本仓库）

```bash
# syft — 多生态通用，最常用；同时出两种格式
syft dir:. -o cyclonedx-json=.appsec/evidence/<tag>/sbom/sbom.cdx.json
syft dir:. -o spdx-json=.appsec/evidence/<tag>/sbom/sbom.spdx.json

# cdxgen — CycloneDX 官方多语言生成器，依赖图谱更细
cdxgen -t js -o .appsec/evidence/<tag>/sbom/sbom.cdx.json .

# npm 原生（Node 项目快速 SBOM；CycloneDX 或 SPDX）
npm sbom --sbom-format cyclonedx > .appsec/evidence/<tag>/sbom/sbom.cdx.json
npm sbom --sbom-format spdx > .appsec/evidence/<tag>/sbom/sbom.spdx.json

# trivy — 也能产 SBOM（顺带做 SCA，见 §5）
trivy fs --format cyclonedx --output .appsec/evidence/<tag>/sbom/sbom.cdx.json .

# 容器镜像 SBOM（从镜像而非源码生成 — 反映真实运行时成分）
syft <registry>/<image>:<digest> -o cyclonedx-json=.appsec/evidence/<tag>/sbom/image-sbom.cdx.json
```

### 4.3 一份好 SBOM 必含（对齐 NTIA minimum elements + CycloneDX 实践）

- [ ] 每个组件：name + version + **唯一标识**（PURL `pkg:npm/lodash@4.17.21` / CPE）
- [ ] **传递依赖**全展开，不止 top-level（直接 vs 传递可区分）
- [ ] 依赖关系图（dependsOn）——reachability 与影响面分析的前提
- [ ] supplier / author + license（每组件）
- [ ] 组件 hash（integrity）
- [ ] SBOM 自身 metadata：生成工具 + 版本 + timestamp + 目标 component
- [ ] （理想）pedigree / 来源 registry
- [ ] 容器项目：**源码 SBOM + 镜像 SBOM 两份**（镜像 SBOM 反映 base image 带入的 OS 包）

### 4.4 CI 集成点

- **build / CI 阶段**生成（而非临时手跑）——SBOM 要跟着每个 release artifact 走
- SBOM 作为 build artifact **存档 + 版本化**（随 release tag）
- 理想：SBOM 本身被**签名 + attest**（见 §6），形成可验证 supply-chain 证据
- 反模式：只在本地生成一次、不进 CI、不存档——下次出 CVE 时无清单可查

---

## 5. Pillar 2 — Deep SCA（超越 `npm/pip/cargo audit`）

`npm audit` / `pip-audit` / `cargo audit` 是**地板，不是天花板**。它们：只看 advisory DB、不做 reachability、噪声大、不支持 VEX 抑制、跨生态覆盖参差。深度 SCA 在其上叠加六件事。

### 5.1 工具

```bash
# osv-scanner — Google OSV.dev，跨生态 + 吃 lockfile + 支持 VEX/call-graph(实验)
osv-scanner --lockfile=package-lock.json --format=json --output=.appsec/evidence/<tag>/sca/osv.json
osv-scanner scan source --recursive . --format=json --output=.appsec/evidence/<tag>/sca/osv-tree.json

# trivy — SCA + SBOM + license 一体
trivy fs --scanners vuln,license --format json --output .appsec/evidence/<tag>/sca/trivy.json .

# grype — 吃 SBOM 直接扫（SBOM-driven，与 §4 串联）
grype sbom:.appsec/evidence/<tag>/sbom/sbom.cdx.json -o json > .appsec/evidence/<tag>/sca/grype.json

# 生态原生 floor（必跑作对照，不作唯一依据）
npm audit --json > .appsec/evidence/<tag>/sca/npm-audit.json
pip-audit -f json > .appsec/evidence/<tag>/sca/pip-audit.json
cargo audit --json > .appsec/evidence/<tag>/sca/cargo-audit.json
```

### 5.2 深度 SCA 的六个维度

1. **Transitive vuln**：绝大多数依赖漏洞在传递层，不在 top-level package.json。必须扫展开后的依赖树（lockfile-driven），不能只看直接依赖。
2. **Lockfile integrity**：lockfile 在不在？是否提交？`integrity` hash 是否完整（subresource integrity）？是否被手工编辑（hash 与 registry 不符 = 红旗）？无 lockfile = 每次 install 拉到的可能不是同一份代码。
3. **Reachability analysis**：漏洞函数是否真在调用路径上？不可达漏洞可降优先级（osv-scanner call-graph / 商业工具）。减噪是为了让有限修复预算打在真问题上——**不是**借口忽略。**详见 §5.4（raw SBOM 漏洞表 ≠ 工作清单的纪律 + 工具）。**
4. **VEX（Vulnerability Exploitability eXchange）**：对**非可利用**漏洞出具机读声明（`not_affected` + justification，如 `vulnerable_code_not_in_execute_path`），CI 据此**抑制**而非删除。VEX 是审计留痕的抑制，区别于"把红的删掉假装没看见"。CycloneDX 原生支持。
5. **Fix-version pinning**：修复 = 钉到**已知良好版本**（含传递，必要时用 `overrides` / `resolutions` / `constraints`）。区分"有 fix 版"vs"无 fix（需缓解/换库/接受风险）"。
6. **License risk**：copyleft（GPL/AGPL）混入闭源分发、license 缺失、license 冲突——都是供应链法务风险。SBOM 里逐组件核 license。

### 5.3 SCA 输出纪律

- 每条 SCA 高危 → §9 schema finding（`source: sca`）→ `appsec-sdk finding.add`
- **被 VEX 抑制的项必须留痕**：写明 justification + 评估人，不得静默丢弃
- 原始报告归档 `.appsec/evidence/<tag>/sca/`，列入 `.gitignore`
- 反模式：把 `npm audit` 0 high 当"依赖安全"（orchestrator §12 Hard Rule）

### 5.4 Reachability-Based Noise Reduction（raw SBOM 漏洞表 ≠ 工作清单）

> **纪律起点**：`syft`/`grype`/`trivy`/`osv-scanner` 直接吐出的漏洞列表里，**绝大多数对你的应用不可利用**——漏洞函数根本不在你的调用路径上。学术初步证据（CODASPY'26 preprint, n=113/4 repos）测得 raw SBOM 漏洞表约 **~92% 是上下文误报**；reachability 剪枝（基于静态 call-graph）可减约 **61.9%** 假阳。**该具体数字标 medium 证据**（单篇 preprint），但**方向是确立的**：reachability > 纯版本匹配。

**铁律**：raw SCA 输出是**待分类的候选集**，不是 worklist。把它直接当"待修清单"扔给开发 = 用噪声淹没真问题 + 烧光有限修复预算。

#### 剪枝判定（每条漏洞过一遍）

1. **漏洞符号是否被引用？** 漏洞在依赖的某个函数/类里——你的代码（含传递调用）是否真的 import 并调用到它？没调到 = 不可达 → 降级。
2. **是否在运行时代码路径上？** dev-only / test-only / 构建期依赖里的漏洞，生产运行时根本不加载 → 降级（但仍记 dev 供应链面）。
3. **可达 + 无缓解 = 真 worklist**：被调用到 + 无 sanitizer/配置缓解 → 进修复清单，按 §10 SLA。
4. **降级 ≠ 删除**：不可达项**写明 reachability justification 留痕**（VEX `not_affected` + `vulnerable_code_not_in_execute_path`），CI 据此**抑制**——审计可查，不是"假装没看见"（与 §5.2 item 4 VEX 一致）。

#### 工具（CLI-first；只读本仓库）

```bash
# osv-scanner 实验性 call-graph reachability（Go / 部分生态）——可达性增强
osv-scanner --call-analysis=all --lockfile=go.mod \
  --format=json --output=.appsec/evidence/<tag>/sca/osv-reachability.json .

# 深度可达性（跨生态 / 自定义）：借 security-app-sast-deep 的 Joern CPG
#   1) Joern 建 CPG  2) query「漏洞依赖的 sink 符号是否 reachableBy 应用入口」
#   → 把"版本命中"升级为"路径命中"。详 security-app-sast-deep §5.2。

# 生成 VEX（CycloneDX）记录不可达裁决（机读抑制 + 留痕）
#   not_affected + justification: code_not_reachable / vulnerable_code_not_in_execute_path
```

#### 输出纪律

- reachability 裁决结果（reachable / unreachable + justification）写入 SCA evidence，**每条都留痕**。
- 只有 **reachable + 无缓解** 的高危才升 §9 finding（避免 92% 噪声灌进 finding 库）。
- 不可达项 → VEX 抑制 + justification（不静默丢，不当借口忽略——orchestrator §14 反模式）。
- reachability 是**剪枝**不是**豁免**：证据不足以判定可达性时，**默认按可达处理**（保守），不拿"可能不可达"当不修理由。

---

## 6. Pillar 3 — Provenance & Signing

回答："这个产物**真的是我们 CI 构建的**吗？没被中途掉包吗？"

### 6.1 SLSA（Supply-chain Levels for Software Artifacts）

成熟度框架，v1.0 用 **Build track L0–L3** 描述构建完整性：

| Level | 含义 | 大白话 |
|---|---|---|
| **L0** | 无保证 | 本地手 build，无任何来源记录 |
| **L1** | 有 provenance | 构建产出 provenance（怎么 build 的有记录），但未必防篡改 |
| **L2** | 签名 provenance + 托管构建 | provenance 被构建平台签名，可验来源 |
| **L3** | 加固构建平台 + 防伪造 | 构建环境隔离、provenance 不可伪造（如 GitHub Actions + slsa-github-generator）|

目标：商业交付争取 **≥ L2**，关键产物 L3。

### 6.2 in-toto attestation

机读的"构建发生了什么"声明（predicate）：谁、用什么、输入是什么、产出什么 hash。SLSA provenance 是 in-toto attestation 的一种 predicate。

### 6.3 Sigstore / cosign（签名 + 验证）

```bash
# 验证产物签名（keyless / OIDC-backed —— 推荐，无长期私钥）
cosign verify-blob --bundle artifact.bundle \
  --certificate-identity-regexp 'https://github.com/<org>/.+' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  artifact.tar.gz

# 验证 SLSA provenance attestation
cosign verify-attestation --type slsaprovenance \
  --certificate-identity-regexp '...' --certificate-oidc-issuer '...' \
  <registry>/<image>@sha256:<digest>

# slsa-verifier — 校验 GitHub-built 产物的 SLSA provenance
slsa-verifier verify-artifact artifact.tar.gz \
  --provenance-path artifact.intoto.jsonl \
  --source-uri github.com/<org>/<repo>
```

**纪律**：
- **优先 keyless（OIDC-backed）签名**——无长期私钥可泄。与 `security-platform-secrets` 的 OIDC 主线一致。
- 若必须用 key-based：私钥进 KMS/HSM，**绝不**入 repo / CI 明文 secret（本 skill 不读 `cosign.key` 内容）。
- 验证侧（verify）比签名侧（sign）更重要——**没验证的签名等于没签**。
- SBOM 本身也应被 attest（`cosign attest --type cyclonedx`），形成"清单可信"链。

---

## 7. Pillar 4 — Container Image Supply Chain

> 与 `security-platform-iac-cloud` 互补：那边管 Dockerfile lint + 镜像 CVE + K8s misconfig；这边管镜像的**供应链可信维度**。

### 7.1 Checklist

- [ ] **Base image 用 digest 钉死**（`FROM node@sha256:...`，不用 `:latest` / 浮动 tag）——tag 可被重新指向，digest 不可变
- [ ] base image 来源可信（官方 / verified publisher），并纳入 §5 SCA
- [ ] **distroless / minimal base**（gcr.io/distroless、wolfi、alpine）——更小攻击面、更少 OS CVE
- [ ] 镜像**被签名**（`cosign sign <image>@sha256:<digest>`）
- [ ] 部署侧 **verify-on-deploy / admission control**：K8s 用 sigstore policy-controller / Kyverno / OPA Gatekeeper 拒绝未签或签名不匹配的镜像
- [ ] 镜像附 SBOM attestation（§4.2 image-sbom + `cosign attest`）
- [ ] 多阶段构建——build 工具链不进最终镜像（减面 + 防 build-time secret 泄入层）

### 7.2 命令

```bash
# 检测 Dockerfile 是否 digest-pin（grep 非 digest 的 FROM —— 只读分析）
# 签名镜像（keyless）
cosign sign --yes <registry>/<image>@sha256:<digest>

# 部署前验签（CI / admission webhook 调用）
cosign verify <registry>/<image>@sha256:<digest> \
  --certificate-identity-regexp '...' --certificate-oidc-issuer '...'

# 验证镜像的 SBOM attestation
cosign verify-attestation --type cyclonedx <registry>/<image>@sha256:<digest> \
  --certificate-identity-regexp '...' --certificate-oidc-issuer '...'
```

---

## 8. Pillar 5 — Dependency-Confusion / Typosquatting / Malicious-Package

最隐蔽的供应链攻击发生在 `install` 那一刻。

### 8.1 三类攻击

| 攻击 | 机制 | 例 |
|---|---|---|
| **Dependency confusion** | 内部私有包名在公共 registry 被抢注更高版本，install 误拉公共恶意包 | 内部 `@acme/utils` 公共注册高版本 |
| **Typosquatting** | 抢注与热门包形近的名字 | `crossenv` vs `cross-env`、`python-dateutil` vs `dateutil` |
| **Malicious package / 投毒** | 合法包被接管或新包内嵌恶意 install-script / 数据外传 | `event-stream` 事件 |

### 8.2 防御 Checklist

- [ ] **Scoped registry**：内部包用 scope（`@acme/*`）并锁到私有 registry（`.npmrc` 的 `@acme:registry=`），公共 scope 不解析到私有
- [ ] **Namespace 预留**：在公共 registry 抢先注册自己的 org scope / 包名，防被人占
- [ ] **Pinned + hash-checked install**：CI 用 `npm ci` / `pip install --require-hashes` / `cargo --locked` ——按 lockfile + integrity hash 装，拒绝漂移
- [ ] **Install-script review**：审查依赖的 `postinstall` / `preinstall`（npm `--ignore-scripts` 默认关高风险脚本，按需白名单放行）
- [ ] **版本钉死**：生产依赖不用 `^` / `~` 浮动范围 + 提交 lockfile
- [ ] **新依赖准入**：引入前查 registry——发布时间（昨天才发的同名高版本可疑）、下载量、维护者、源码仓库是否对得上
- [ ] **私有 registry 优先级**：确保私有 registry 在解析顺序上不被公共 registry 的更高版本覆盖（dependency-confusion 根因）

### 8.3 命令

```bash
# 检查 .npmrc / scope 配置（只读）
# CI 安装必须用 lockfile-faithful 命令：
npm ci                              # 而非 npm install
pip install --require-hashes -r requirements.txt
cargo build --locked

# 审查 install-script（哪些包带 lifecycle script）
npm ls --all --json > .appsec/evidence/<tag>/sca/dep-tree.json   # 配合人工审 postinstall
```

---

## 9. Pillar 6 — Build-Pipeline Integrity

CI 被攻破 = 攻击者拿到签名权 + 部署权，是供应链的"皇冠珠宝"（对应 OWASP A08 Software/Data Integrity Failures 与 SLSA Build track）。

### 9.1 Checklist

- [ ] **CI runner 加固**：最小权限 token（`permissions:` 收窄到按 job 所需）、third-party action **pin 到 commit SHA**（不用浮动 tag）、ephemeral runner
- [ ] **Ephemeral credentials**：CI → 云用 **OIDC short-lived token**，不用长期 access key（与 `security-platform-secrets` §7 一致）
- [ ] **Protected branches**：release/main 受保护——禁直推、强制 PR、required status checks
- [ ] **Two-person review for release**：发布动作（tag / publish / deploy）要双人审批（GitHub environments + required reviewers）
- [ ] **Signed commits / tags**（理想）：release tag GPG/Sigstore 签名
- [ ] **构建隔离**：build 环境不可被 PR 代码改写（防恶意 PR 偷签名权 / secrets）——pull_request_target 风险审查
- [ ] **依赖缓存投毒防护**：CI cache key 含 lockfile hash，防缓存被污染复用

### 9.2 越界声明

本 skill **只读审查** CI 配置（`.github/workflows/*.yml` 等）并标记缺口；**不**改 pipeline、**不**触碰 runner secret、**不**执行 deploy。CI 凭证轮换 / OIDC 实施细节 → `security-platform-secrets`。

---

## 9.5 Cloud Posture (CSPM) — Prowler（横切：部署环境的供应链可信底座）

> 2026-06-15 补强。供应链不止"代码 + 依赖 + 产物"，还包括**产物落地的云环境配置**——一个 misconfigured 的 S3 公开桶 / 过宽 IAM / 无加密 RDS / 关闭的审计日志，会让前面所有 SBOM/签名功亏一篑。**Prowler** = Apache-2.0 免费 CSPM（Cloud Security Posture Management），多云覆盖（AWS 600+ 检查 / Azure / GCP / Kubernetes，44+ 合规框架：CIS / NIST / PCI / GDPR / SOC2 / ISO27001 …）。

### 9.5.1 边界（vs `security-platform-iac-cloud` —— 不重叠声明）

| 维度 | `security-platform-iac-cloud` | 本 skill 的 Prowler CSPM |
|---|---|---|
| 看什么 | **IaC 代码**（Terraform / CloudFormation / K8s manifest）静态 misconfig + 镜像 CVE | **运行中的云账户实际配置**（live posture）|
| 时机 | 部署**前**（shift-left，代码层）| 部署**后 / 持续**（实际生效的配置）|
| 工具 | checkov / tfsec / trivy-config / kube-linter | **prowler** |
| 重叠区裁决 | IaC 模板缺陷以 iac-cloud 为主 | live 云账户姿态以本 skill 为主；两边结论同写 Release Evidence §9 Platform Layer |

**判断规则**：有云账户（AWS/Azure/GCP）且能只读授权访问时，跑 Prowler 看**实际配置**；只有 IaC 代码、无云访问时，走 `security-platform-iac-cloud` 看模板。两者互补——IaC 对了不代表 live 没被手工改歪。

### 9.5.2 CLI（CLI-first；只读云只读凭证；不改云资源）

```bash
pip install prowler          # 或 brew install prowler / docker run toniblyx/prowler

# AWS（用只读凭证 / 只读 role；prowler 默认只读评估，不改资源）
prowler aws --output-formats json-ocsf \
  --output-directory .appsec/evidence/<tag>/cspm/

# 指定合规框架（按客户/监管要求）
prowler aws --compliance cis_3.0_aws \
  --output-directory .appsec/evidence/<tag>/cspm/
prowler aws --compliance pci_4.0_aws --output-directory .appsec/evidence/<tag>/cspm/

# 多云
prowler azure --output-directory .appsec/evidence/<tag>/cspm/
prowler gcp   --output-directory .appsec/evidence/<tag>/cspm/
prowler kubernetes --output-directory .appsec/evidence/<tag>/cspm/
```

### 9.5.3 重点检查域（CSPM 高价值面）

- **公开暴露**：S3/blob 公开桶、公开快照、0.0.0.0/0 安全组、公开数据库端点
- **IAM 过宽**：`*:*` 策略、长期 access key 未轮换、无 MFA 的特权账户、未用的高权限角色
- **加密缺失**：未加密的存储/数据库/快照、传输未强制 TLS、KMS key 轮换关闭
- **日志 / 审计关闭**：CloudTrail/Activity Log 关闭、日志未集中、无 config 记录 → 事件无法溯源（联动 CSF DE/RC）
- **网络**：公开管理端口（SSH/RDP）、缺 VPC flow log、缺 WAF

### 9.5.4 输出纪律

- Prowler 跑在**只读凭证 / 只读 role**下——**评估姿态，不改云资源**（与本 skill「review + report only」一致）。
- 凭证经环境变量 / 云原生 role 注入，**绝不**把云凭证写进 repo / chat / log（本 skill `never_read` 含 `*.pem`/`*.key`；输出前 `appsec-sdk redact`）。
- 高危 misconfig（公开数据 / 过宽 IAM / 加密缺失）→ §9 finding，`source: cloud_posture`（现有 enum）。
- CSPM evidence 落 `.appsec/evidence/<tag>/cspm/`，写入 Release Evidence **§9 Platform Layer**。
- 合规框架映射（CIS/PCI/NIST）按客户要求选——但**框架通过 ≠ 安全**（合规是地板，不是天花板）。

---

## 10. Standard Workflow

```
Step 1  Inventory（清点）
        → 找 lockfile（package-lock / pnpm-lock / yarn.lock / poetry.lock /
          Pipfile.lock / Cargo.lock / go.sum / pom.xml / build.gradle）
        → 找 Dockerfile / 镜像产物 / CI workflow 文件
        → 判断生态 + 是否容器化 + 是否有 release artifact

Step 2  SBOM 生成（Pillar 1）
        → syft / cdxgen / npm sbom → CycloneDX + SPDX
        → 容器项目：源码 SBOM + 镜像 SBOM 两份
        → 落 .appsec/evidence/<tag>/sbom/
        → 核 §4.3 必含字段

Step 3  深度 SCA（Pillar 2）
        → osv-scanner + trivy + grype(吃 SBOM) + 生态原生 audit 对照
        → transitive / lockfile integrity / VEX / fix-pin / license
        → **reachability 剪枝（§5.4）**：raw 漏洞表是候选集不是 worklist
          （~92% 上下文 FP）→ 只 reachable+无缓解 升 finding；不可达 VEX 留痕
        → 落 .appsec/evidence/<tag>/sca/

Step 4  Provenance & 签名验证（Pillar 3）
        → 有 release artifact？检查是否有 SLSA provenance + 签名
        → cosign verify-blob / verify-attestation / slsa-verifier
        → 记录 SLSA level 现状 + 目标差距

Step 5  容器镜像链（Pillar 4，如容器化）
        → base image digest-pin? distroless? 镜像签名? verify-on-deploy?
        → cosign verify + admission control 审查

Step 6  Malicious-package 防御（Pillar 5）
        → .npmrc/scope 配置、namespace 预留、pinned+hash install、
          install-script review、新依赖准入流程
        → dependency-confusion 解析顺序审查

Step 7  Build-pipeline 完整性（Pillar 6）
        → CI workflow 只读审查：token 权限 / action SHA-pin / OIDC /
          protected branch / 2-person release review
        → 标记缺口，凭证细节 handoff secrets skill

Step 7.5  Cloud Posture / CSPM（§9.5，如有云账户 + 只读访问授权）
        → prowler aws/azure/gcp/kubernetes（只读凭证，不改资源）
        → 公开暴露 / IAM 过宽 / 加密缺失 / 审计日志关闭 / 网络
        → 落 .appsec/evidence/<tag>/cspm/；source: cloud_posture
        → 与 security-platform-iac-cloud 互补（IaC 模板 vs live 姿态）

Step 8  输出 + 路由
        → 高危转 §9 schema finding → appsec-sdk finding.add → security-remediation
        → 供应链 evidence（SBOM / SCA / 签名验证）写入 AppSec Release Evidence
          §9 Platform Layer（**不是** SECURITY.md §13）
        → secret 嫌疑（lockfile/install-script 内嵌）→ security-platform-secrets
        → malicious package 确认在用 → handoff security-response-incident-response
        → 给 risk-register 补条目
```

---

## 11. Critical Issues Checklist（速查）

### SBOM
- [ ] 每个 release 有 SBOM（CycloneDX + 合规需要时 SPDX）
- [ ] 传递依赖全展开 + 依赖图 + PURL + hash + license
- [ ] SBOM 进 CI + 存档 + 版本化（理想：被签名/attest）

### Deep SCA
- [ ] 扫的是展开后依赖树（lockfile-driven），不只 top-level
- [ ] lockfile 已提交 + integrity hash 完整 + 未被手工篡改
- [ ] critical/high 传递漏洞有 fix-pin 或 VEX 留痕（非静默忽略）
- [ ] license 风险（copyleft 混入闭源 / 缺失 / 冲突）已核

### Reachability 降噪（§5.4）
- [ ] raw SCA 输出当**候选集**处理，不直接当 worklist（~92% 上下文 FP）
- [ ] 高危漏洞做可达性判定（符号被调用？运行时路径上？）
- [ ] 不可达项 VEX 留痕（`code_not_reachable` justification），不静默丢、不当忽略借口
- [ ] 证据不足判定可达性时**默认按可达**（保守，不拿"可能不可达"当不修理由）

### Cloud Posture / CSPM（§9.5，如有云账户）
- [ ] Prowler 跑在只读凭证下评估 live 姿态（不改云资源）
- [ ] 公开暴露 / 过宽 IAM / 加密缺失 / 审计日志关闭已核
- [ ] 云凭证不入 repo/chat/log；高危 misconfig → `source: cloud_posture` finding
- [ ] 与 iac-cloud 分工清楚（模板 vs live），重叠以 live 姿态为主

### Provenance & Signing
- [ ] release artifact 有 provenance（SLSA ≥ L2 目标）
- [ ] 产物/镜像签名 **且验证侧到位**（keyless/OIDC 优先）
- [ ] 私钥（若用 key-based）在 KMS/HSM，不入 repo/CI 明文

### Container
- [ ] base image digest-pin（非 `:latest`）+ distroless/minimal
- [ ] 镜像签名 + 部署侧 verify-on-deploy / admission control

### Malicious-package
- [ ] scoped registry + namespace 预留 + 私有 registry 解析优先级正确
- [ ] CI 用 `npm ci` / `--require-hashes` / `--locked`
- [ ] install-script 审查 + 新依赖准入流程

### Build-pipeline
- [ ] CI token 最小权限 + third-party action SHA-pin
- [ ] OIDC 短期凭证（无长期 key）
- [ ] protected branch + release 双人审批

---

## 12. Hard Rules

- ❌ **不**执行 active exploitation / 不向恶意包"主动触发"以验证——只静态/wrapper 扫描本仓库
- ❌ **不**读 `.env` / `secrets/**` / `*.pem` / `*.key` / `cosign.key` 内容——只读路径存在性
- ❌ **不**把 `npm audit` 0 high 当成"供应链安全"——那是地板（orchestrator §12 / §14）
- ❌ **不**把"生成了 SBOM 文件"当成"供应链治理完成"——SBOM 是地基不是终点（orchestrator §14）
- ❌ **不**把 VEX 当"删红的借口"——VEX 是带 justification + 留痕的抑制，不是隐藏
- ❌ **不**用浮动 tag 当依赖/base-image 钉死手段——tag 可变，必须 lockfile + digest
- ❌ **不**信"有签名"就够——**没验证的签名等于没签**
- ❌ **不**改 CI pipeline / 不触 runner secret / 不执行 deploy——review + report only
- ❌ **不**把 raw SCA 漏洞表直接当 worklist——~92% 上下文 FP，先 reachability 剪枝（§5.4），但**不可达 ≠ 删除**（VEX 留痕）
- ❌ **不**拿"可能不可达"当不修理由——证据不足判定可达性时默认按可达（保守）
- ❌ **不**用 Prowler 改云资源——只读凭证评估 live 姿态；云凭证不入 repo/chat/log
- ❌ **不**把合规框架（CIS/PCI）通过当"云安全"——合规是地板不是天花板
- ❌ **不**在 chat / log / report 输出 raw signing key / registry 凭证 / 云凭证——先走 `appsec-sdk redact`

---

## 13. Output Contract

> **v3.0 evidence sink**: machine-readable findings MUST be written via `appsec-sdk finding.add` (schema-validated against orchestrator §9, redacted first). Direct Write to `.appsec/findings/**` is blocked by the PreToolUse hook. The markdown report is the human-rendered view only. **本 skill `allowed-tools` 不含 Write/Edit**——落盘一律经 `appsec-sdk` 命令（Bash），从工具层杜绝绕过 schema 直写。

每次 review 产出：

1. **SBOM**（CycloneDX + 必要时 SPDX）→ `.appsec/evidence/<tag>/sbom/`
2. **深度 SCA 报告**（含 transitive / lockfile / VEX 决策 / license）→ `.appsec/evidence/<tag>/sca/`
3. **Provenance & 签名验证状态**（SLSA level 现状 + 差距）
4. **容器镜像链审查**（digest-pin / 签名 / verify-on-deploy）— 如容器化
5. **Malicious-package 防御现状**（scoped registry / pinned-install / install-script）
6. **Build-pipeline 完整性缺口**（CI 只读审查）
7. **Reachability 剪枝结论**（§5.4）：每条高危的 reachable/unreachable 裁决 + justification（不可达走 VEX 留痕，不静默丢）
8. **Cloud Posture / CSPM 报告**（§9.5，如有云访问）→ `.appsec/evidence/<tag>/cspm/`（公开暴露 / IAM / 加密 / 审计日志）
9. 高危发现 → §9 schema finding → `appsec-sdk finding.add` → 路由 `security-remediation`
10. 供应链 evidence 经 `appsec-sdk evidence.append <tag> sca` 落盘，写入 **AppSec Release Evidence §9 Platform Layer**（**不是** SECURITY.md §13 — §13 仅含 Security Headers）
11. 给 `risk-register` 补条目（每个高危）

### Finding schema 对齐（orchestrator §9）

- `source`：用现有 enum——依赖漏洞用 `sca`；镜像层用 `container_scan`；**云配置 misconfig 用 `cloud_posture`**（§9.5 Prowler）；不发明新值（PreToolUse prewrite hook 拒 schema 漂移）。
  > 备注：§9 enum 暂无独立 `sbom` / `provenance` source。SBOM/provenance 类发现归 `sca`（依赖维度）或 `container_scan`（镜像维度）。若 orchestrator 后续扩 enum，本 skill 跟随。
- `asvs_mapping[]`：versioned `v5.0.0-<ch>.<sec>.<req>` 三段格式（如 `v5.0.0-13.4.1`、`v5.0.0-15.1.1`）；regex `^v5\.0\.0-\d+\.\d+\.\d+$`。云 misconfig 常无对应 ASVS 控制时留空 `[]` + `unmapped_reason`，**禁止编造**。
- `severity` / `confidence`：**小写** enum（`critical|high|medium|low` / `high|medium|low`）。
- `owasp_top10[]`：供应链类用 `A03:2025`（Software Supply Chain Failures）；完整性类可加 `A08:2025`；云 misconfig 可用 `A05:2025`（Security Misconfiguration）。
- `csf_function`：多为 `ID`（识别/SCA 清点）或 `PR`（保护/签名验证）；CSPM 审计日志类可 `DE`/`RC`。
- `detector`：工具名 + 版本（如 `syft@1.x` / `osv-scanner@1.x` / `cosign@2.x` / `prowler@5.x`）。
- 任何 evidence 落盘前经 `appsec-sdk redact`。

---

## 14. Anti-patterns

- ❌ 只跑 `npm audit` 当 SCA——漏 transitive、无 reachability、无 VEX、跨生态盲区
- ❌ SBOM 只扫 top-level——传递依赖才是漏洞主战场
- ❌ SBOM 生成一次不进 CI / 不存档——出 CVE 时无清单可查
- ❌ base image 用 `:latest`——tag 可被重新指向，供应链不可信
- ❌ 镜像签了名但部署侧不验签——签名形同虚设
- ❌ 用 VEX 把红的"抑制"掉却不写 justification——等于伪造已修
- ❌ 私有包不 scope / 不锁 registry——dependency-confusion 门户大开
- ❌ CI 用长期云凭证 + third-party action 用浮动 tag——CI 一破全破
- ❌ 把 license 风险当"非安全问题"忽略——copyleft 混入闭源是真实法务+供应链风险
- ❌ 把"SLSA L1 有 provenance"当"产物可信"——L1 未必防篡改，商业交付争取 ≥ L2
- ❌ 把 raw grype/syft/trivy 漏洞表直接丢给开发当 backlog——~92% 上下文 FP，淹没真问题（§5.4）
- ❌ 用 reachability "不可达"当借口直接删漏洞——剪枝是降级+留痕（VEX），不是豁免
- ❌ "IaC 模板扫过了云就安全"——live 姿态可能被手工改歪，CSPM（Prowler）查实际配置
- ❌ 把 Prowler 跑在可写凭证下——只读评估，CSPM 不改云资源

---

## 15. References

- [OWASP Top 10:2025 — A03 Software Supply Chain Failures](https://owasp.org/Top10/2025/)
- [OWASP SCVS — Software Component Verification Standard](https://owasp.org/www-project-software-component-verification-standard/)
- [OWASP CycloneDX](https://cyclonedx.org/)
- [SPDX](https://spdx.dev/)
- [SLSA — Supply-chain Levels for Software Artifacts](https://slsa.dev/)
- [in-toto attestation framework](https://in-toto.io/)
- [Sigstore / cosign](https://docs.sigstore.dev/)
- [OSV-Scanner](https://google.github.io/osv-scanner/) (含 `--call-analysis` reachability)
- [syft](https://github.com/anchore/syft) / [grype](https://github.com/anchore/grype)
- [cdxgen](https://github.com/CycloneDX/cdxgen)
- [Trivy](https://github.com/aquasecurity/trivy)
- [Prowler — multi-cloud CSPM (Apache-2.0)](https://github.com/prowler-cloud/prowler) — §9.5 cloud posture
- Reachability FP 研究（CODASPY'26 preprint, n=113/4 repos, ~92% 上下文 FP — **medium 证据**）: [arXiv 2511.20313](https://arxiv.org/pdf/2511.20313)
- [NIST SSDF SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final) · [NIST SP 800-161 Rev.1 C-SCRM](https://csrc.nist.gov/pubs/sp/800/161/r1/final)
- [appsec-security-orchestrator](../appsec-security-orchestrator/SKILL.md) (§5.2 capability map / §9 finding schema / §13 Release Evidence)
- [security-platform-secrets](../security-platform-secrets/SKILL.md) (OIDC / CI 凭证)
- [security-platform-iac-cloud](../security-platform-iac-cloud/SKILL.md) (IaC 模板 misconfig / 镜像 CVE / K8s — CSPM 互补，§9.5.1)
- [security-app-sast-deep](../security-app-sast-deep/SKILL.md) (Joern CPG 借用于 reachability 剪枝，§5.4)
- [security-remediation](../security-remediation/SKILL.md) (finding → fix → regression)
