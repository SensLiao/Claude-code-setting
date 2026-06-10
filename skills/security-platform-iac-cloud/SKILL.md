---
name: security-platform-iac-cloud
canonical_id: security.platform.iac_cloud
aliases: [iac-security, cloud-posture, infra-as-code-security]
version: 1.0.0
status: stable
created_date: 2026-05-25
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
forbidden-tools: WebFetch
manual_gate_required: false
disable-model-invocation: false
standards_versions:
  - NIST SP 800-190: container security
  - CIS Controls: v8.1
  - CIS Benchmarks: AWS / GCP / Azure / Kubernetes / Docker
  - OWASP ASVS: 5.0 (V13 Configuration)
  - NIST CSF: 2.0 (PR.IP, PR.PT, DE.CM)
sensitive_data_rules:
  never_read: [".env*", "secrets/**", "*.tfstate", "*.tfvars", "*.pem", "*.key", "kubeconfig", "credentials"]
  never_write: ["actual resource modifications"]
  redact_on_output: ["account IDs", "subscription IDs", "internal IPs", "tokens"]
upstream:
  - appsec-security-orchestrator
  - security-governance-threat-modeling  # 揭示 IaC 攻击面
  - env-parity-baseline  # 跨环境配置一致性
downstream:
  - security-remediation  # 高危 misconfig 转 finding
  - security-platform-secrets  # 如发现 IaC 含 secret
  - appsec-security-orchestrator  # 回 orchestrator
description: >
  IaC and cloud posture security review — scan Terraform / CloudFormation / Helm /
  K8s manifests / Ansible / Pulumi for misconfigurations, drift, exposure, and
  compliance deviations. Routes container security (Dockerfile / image / runtime)
  via this same skill or sub-handoffs. Maps to NIST SP 800-190, CIS Benchmarks,
  and ASVS V13. Does NOT modify infrastructure — review and report only.
trigger_phrases:
  - IaC / Terraform / Helm / Pulumi / CloudFormation 安全
  - 云配置审查 / cloud posture / cloud misconfig
  - Dockerfile / container 安全 / Kubernetes 安全
  - CIS Benchmark / kube-bench / Checkov / Prowler / Trivy
  - infra security / 基础设施安全
---

# Security Platform — IaC and Cloud Posture

## 1. Mission

把"基础设施安全"从"买一个云安全工具"升级为**IaC build-time scan + 云上 runtime posture + 持续 drift 检测**的三段闭环。

**职责边界**：
- IaC 代码 + 云配置 + 容器三层扫描
- 检测 misconfiguration、drift、exposure、合规偏差
- 路由到 secrets / IAM / network boundary 同类问题
- **不**直接修改基础设施（只 review + report）

---

## 2. Activation Triggers

| Trigger | Action |
|---|---|
| 项目使用 Terraform / Helm / K8s manifests / Ansible / Pulumi | 默认激活 |
| 新增云资源 | IaC PR 触发 |
| 容器化项目（Dockerfile 存在）| 镜像扫描 + Hadolint |
| K8s 部署 | kube-bench + manifest scan |
| 云账号引入 | 全量 cloud posture baseline |
| 定期巡检（月 / 季）| drift detection + re-baseline |
| 上线前 | CIS Benchmark 验证 |

---

## 3. Coverage Matrix

| Layer | Tool 推荐 | 输出 |
|---|---|---|
| Dockerfile lint | Hadolint | Best-practice violations |
| 镜像漏洞扫描 | Trivy image / Grype | CVE list（OS + libs）|
| 镜像 secret 扫描 | Trivy image --scanners secret | embedded secrets |
| K8s manifest scan | Trivy config / Checkov / kube-linter | RBAC / security context / network policy gaps |
| K8s 集群基线 | kube-bench | CIS Kubernetes Benchmark |
| K8s 运行时 | Falco / Tetragon | 运行时异常行为 |
| Terraform scan | Checkov / tfsec / Trivy config | misconfig + 合规偏差 |
| Helm chart scan | Checkov | RBAC / 资源 limit / image policy |
| 云姿态（AWS）| Prowler / ScoutSuite | 全 region IAM / S3 / EC2 / RDS / etc. |
| 云姿态（GCP）| Prowler / Forseti / Scout | similar |
| 云姿态（Azure）| Prowler / ScoutSuite | similar |
| Ansible scan | ansible-lint security rules | misconfig |
| Pulumi scan | Checkov（Pulumi 支持）| misconfig |

---

## 4. Standard Workflow

### Tier 分层（关键 — 决定是否需要 user 二次确认）

| Tier | 涵盖步骤 | 凭证需求 | Gate |
|---|---|---|---|
| **A. Static** | Step 2 (Dockerfile lint), Step 3 (K8s manifest scan), Step 6 (Terraform/IaC scan), Step 9 (IaC secret scan) | 无（仅读 source） | 无需 user 二次确认 |
| **B. Runtime cloud/cluster** | Step 4 (kube-bench), Step 5 (Falco rule review), Step 7 (cloud posture: prowler), Step 8 (terraform plan drift) | 需要 cluster kubeconfig / cloud credentials | **必须 user 二次确认**：本 skill 不主动读 credentials；user 须手动执行命令或显式 sign off "I authorize runtime cloud posture scan on <target>" |

**Scanner-only exception**：runtime tools（prowler / kube-bench）需要 credentials 才能查询云 API / K8s API。本 skill 不读 .tfstate / kubeconfig 文件**内容**到 LLM context；它假设这些文件在 user shell 环境通过环境变量 / ~/.aws/credentials / kubectl context 已配置，scanner 进程自己读取，输出报告。报告中**永不**包含 raw token / 完整 account ID（按 §sensitive_data_rules 自动 redact 给 LLM 展示）。

### Workflow Steps

```
Step 1  Inventory IaC + 云资源
        → 找所有 Dockerfile / *.tf / *.yaml(helm/k8s) / pulumi / ansible
        → 列云账号 / project / subscription

Step 2  Dockerfile + 镜像层
        → hadolint Dockerfile
        → trivy image <registry>/<image>:<tag>
        → trivy image --scanners secret <image>:<tag>
        → 收高危：FROM unpinned / root user / Docker socket mount / curl|sh / no HEALTHCHECK

Step 3  K8s manifest 层
        → trivy config <k8s manifests dir>
        → checkov -d <k8s manifests dir>
        → 收高危：privileged: true / hostPath mount / no resource limits / runAsRoot / NET_ADMIN

Step 4  K8s 集群层（如可访问）— **Tier B, 需 user 二次确认**
        → 提示 user："runtime K8s posture scan 需要 kubeconfig 访问 cluster
                     <name>。允许？" — yes 才继续
        → kube-bench run --targets master,node,etcd,policies
        → 映射 CIS Kubernetes Benchmark
        → 收高危：API server 配置 / etcd encryption / audit log 启用
        → 报告写入 .planning/security/kube-bench-<date>.json，**不**回流 LLM context

Step 5  K8s 运行时（如有）
        → Falco / Tetragon 规则审查
        → 是否覆盖：容器逃逸 / shell exec into pod / write to /etc / unexpected outbound

Step 6  Terraform / IaC scan
        → checkov -d <tf dir>
        → trivy config <tf dir>
        → 收高危：public S3 / overly-permissive IAM / no encryption / no logging / public DB endpoint

Step 7  云姿态巡检 — **Tier B, 需 user 二次确认**
        → 提示 user："cloud posture scan 需要 cloud credentials (account/subscription/project)。允许？"
        → prowler aws / gcp / azure --output-modes json --output-directory .planning/security/
        → 收高危：root account active / no MFA / public bucket / wide IAM / no CloudTrail / no key rotation
        → 报告 account ID / ARN 等敏感字段自动 redact 给 LLM 展示

Step 8  Drift detection — **Tier B, 需 user 二次确认**
        → 提示 user："terraform plan 需要 backend access；只跑 plan，不 apply/destroy。允许？"
        → terraform plan -out=/dev/null（应为 no changes，确保不 lock state）
        → 禁用：terraform apply / destroy / refresh / state push / state rm
        → driftctl scan（如使用）
        → 收漂移：手工修改产生的 unmanaged 资源
        → **绝不**把 terraform.tfvars / *.tfstate 文件**内容**读入 LLM context

Step 9  IaC secret 扫描
        → gitleaks detect --source <iac dirs> --redact --report-format json --report-path .planning/security/iac-gitleaks.json
        → 收高危：tfvars / inline secret / hardcoded password
        → **强制 --redact**，永不在 chat / log / report 中显示 raw secret 值

Step 10 输出 + 路由
        → 高危转 vuln-report.md → security-remediation
        → Secrets-related → security-platform-secrets
        → IaC / cloud / container findings → 写入 AppSec Release Evidence §9 Platform Layer（**不是 SECURITY.md §13** — §13 仅含 Security Headers）
        → 给 risk-register 补条目
```

---

## 5. Critical Misconfigurations Checklist

### Docker / Container
- [ ] FROM tag pinned to digest（不用 latest）
- [ ] Non-root USER
- [ ] No `ADD <URL>` from untrusted source（用 COPY + verified）
- [ ] No `curl | sh` install
- [ ] HEALTHCHECK 定义
- [ ] 最小镜像（distroless / alpine）
- [ ] 没有 build-time secret（多阶段构建）
- [ ] 没有 Docker socket mount（除非明确审过）

### Kubernetes
- [ ] `runAsNonRoot: true`
- [ ] `readOnlyRootFilesystem: true`（可能）
- [ ] `privileged: false`
- [ ] `allowPrivilegeEscalation: false`
- [ ] Drop ALL capabilities, add only needed
- [ ] Resource limits + requests 设置
- [ ] NetworkPolicy 限制 east-west traffic
- [ ] PodSecurityStandards: restricted 或 baseline
- [ ] Secrets 不用 ConfigMap，用 Secret + 加密 at-rest
- [ ] etcd encryption at rest 启用
- [ ] Audit logging 启用
- [ ] No `hostPath` mount（除非审过）
- [ ] No `hostNetwork: true`
- [ ] ServiceAccount: 最小权限 RBAC

### Terraform / Cloud
- [ ] S3 bucket 默认 private + block public access
- [ ] S3 encryption at rest（KMS）
- [ ] S3 access logging
- [ ] IAM policy 最小权限（no `*:*`）
- [ ] No `Principal: *` 在 resource policy
- [ ] RDS / DB 不对 public 暴露
- [ ] DB encryption at rest
- [ ] DB backup + retention
- [ ] CloudTrail / audit log 全 region 启用
- [ ] KMS key rotation 启用
- [ ] VPC flow logs 启用
- [ ] Security groups 不允许 0.0.0.0/0 到敏感端口
- [ ] No long-lived access keys（用 IAM role / OIDC）
- [ ] MFA enforced on root + privileged accounts

### CloudFormation
- [ ] 上述 Terraform / Cloud 资源级检查同样适用 CFN templates（S3 / IAM / RDS / KMS / SG / logging）
- [ ] 用 cfn-lint + Checkov（`-d <cfn dir>`）/ cfn-nag 扫 template misconfig
- [ ] No hardcoded secret 在 template / Parameters default（用 `NoEcho` + Secrets Manager / SSM dynamic reference）
- [ ] IAM resource 用最小权限（no `Action: "*"` / `Resource: "*"`）+ no inline `Principal: "*"`
- [ ] StackPolicy 防关键资源被意外 replace / delete

---

## 6. Hard Rules

- ❌ **不**直接修改生产基础设施（review + report only）
- ❌ **不**读 `.tfstate` / `.tfvars` / kubeconfig 等含 secret 文件
- ❌ **不**绕过 IaC 扫描去手工改云资源——drift 是高风险
- ❌ **不**只扫 build-time 不查 runtime——云上手工改是常见漂移源（但 runtime 检查必须走 §4 Tier B 用户授权流程）
- ❌ **不**在没有 user explicit "yes" 时跑 Tier B 命令（kube-bench / prowler / terraform plan / driftctl）
- ❌ **不**把"prowler 全过"当成"云安全"——还需补 IAM 行为审计 + 应用层 AppSec
- ❌ **不**忽略 sub-account / OU / 子项目——攻击者常打弱项目
- ❌ **不**在没有 baseline 时跑扫描就大改——先建 baseline 再 enforce

---

## 7. Output Contract

> **v3.0 evidence sink**: machine-readable findings MUST be written via `appsec-sdk finding.add` (schema-validated against orchestrator §9, redacted first). Direct Write to `.appsec/findings/**` is blocked by the PreToolUse hook. The markdown report (vuln-report.md / SECURITY.md section) is the human-rendered view only.

每次 review 产出：

1. Coverage summary（哪些 layer 扫了，哪些没扫，原因）— 区分 Tier A static vs Tier B runtime
2. Critical misconfig 列表（按 §5 checklist）
3. Drift list（unmanaged resources / out-of-band changes）— 仅在 Tier B 用户授权后
4. CIS Benchmark 通过率（K8s / Cloud）— 仅在 Tier B 用户授权后
5. 高危转 vuln-report.md → security-remediation
6. Secrets 嫌疑转 security-platform-secrets
7. 报告写入 **AppSec Release Evidence §9 Platform Layer**（**不是** SECURITY.md §13 — §13 仅含 Security Headers）
8. 给 risk-register 补条目（每个高危）
9. Scanner 原始报告归档到 `.planning/security/<scanner>-<date>.json`，列入 `.gitignore`

---

## 8. Anti-patterns

- ❌ 把 IaC scan 当 cloud posture——build-time 检查不能发现运行时漂移
- ❌ 用 Trivy filesystem 当镜像扫描——`trivy fs` 扫文件系统，`trivy image` 才扫镜像层
- ❌ kube-bench 跑了但不修——只产报告等于不扫
- ❌ checkov 用默认规则不裁剪——大量误报淹没真正高危
- ❌ 把 RBAC `*` permission 当临时方案——临时变永久，攻击面长期暴露
- ❌ 没有 NetworkPolicy 的 K8s 集群——内部横向移动零成本
- ❌ 配置 audit log 但不接 SIEM——只产日志没人看
- ❌ Drift 扫到 unmanaged resource 直接删——可能是某团队应急手工建的，先沟通

---

## 9. References

- [NIST SP 800-190 Container Security](https://csrc.nist.gov/pubs/sp/800/190/final)
- [CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks/)
- [OWASP Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [OWASP Kubernetes Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Kubernetes_Security_Cheat_Sheet.html)
- [Checkov](https://www.checkov.io/)
- [Trivy](https://github.com/aquasecurity/trivy)
- [Hadolint](https://github.com/hadolint/hadolint)
- [kube-bench](https://github.com/aquasecurity/kube-bench)
- [Prowler](https://github.com/prowler-cloud/prowler)
- [Falco](https://falco.org/)
- [appsec-security-orchestrator](../appsec-security-orchestrator/SKILL.md)
- [security-platform-secrets](../security-platform-secrets/SKILL.md)
- [env-parity-baseline](../env-parity-baseline/SKILL.md)
