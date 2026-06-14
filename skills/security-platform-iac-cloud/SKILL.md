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
  - NIST CSF: 2.0 (PR.IP, PR.PT, PR.PS, DE.CM)
  - Pod Security Standards: restricted / baseline (k8s admission)
  - Kyverno / OPA Gatekeeper: admission control policy (defensive authoring)
  - Security Profiles Operator: seccomp / SELinux / AppArmor least-privilege recording
  - Tetragon: eBPF runtime observability + enforcement (TracingPolicy)
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
| 项目使用 Terraform / Helm / K8s manifests / Ansible / Pulumi | 默认激活（template scan）|
| 新增云资源 | IaC PR 触发 |
| 容器化项目（Dockerfile 存在）| 镜像扫描 + Hadolint |
| K8s 部署 | kube-bench + manifest scan |
| 云账号引入 | 全量 cloud posture baseline |
| 定期巡检（月 / 季）| drift detection + re-baseline |
| 上线前 | CIS Benchmark 验证 |
| **◇ k8s 项目** + 需要 admission 准入 / seccomp·AppArmor profile / runtime detection | **激活 §4.5 Runtime Authoring**（仅 k8s 项目，见下方 detection）|

### 2.1 ◇ Kubernetes detection（决定 §4.5 Runtime Authoring 是否激活）

§4.5「Runtime Authoring」是**条件激活段**：仅当项目命中 k8s marker 时才纳入工作流，否则 N/A（与 research 3-appsec §A3 "非 k8s 项目此项 N/A" 一致）。命中任一即视为 k8s 项目：

- `kind: Deployment|StatefulSet|DaemonSet|Pod|Service|Ingress` 等 K8s manifest（`*.yaml` 含 `apiVersion:` + `kind:`）
- `Chart.yaml` / `values.yaml` / `templates/*.yaml`（Helm chart）
- `kustomization.yaml`（Kustomize）
- `skaffold.yaml` / `.argocd/` / `argocd-*.yaml`（GitOps 部署到 k8s）
- 已有 `kube-system` 引用 / `kubeconfig` context / CI 中 `kubectl` / `helm` 调用
- 项目 `PROJECT.md` Tech Stack 标注 Kubernetes / EKS / GKE / AKS / k3s / OpenShift

非 k8s 项目（纯 serverless / VM / PaaS / 无编排容器）→ **跳过 §4.5**，只跑 §4 Tier A/B 的 template scan + cloud posture。本段的 admission / SPO / Tetragon **全部** defensive authoring（准入策略 + 最小权限录制 + 检测策略），**不**是 offensive、**不**扫描、**不**改生产集群（见 §4.5 hard rules）。

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

## 4.5 Runtime Authoring — Kubernetes / Container 运行时防护（◇ 仅 k8s 项目）

> 加入 2026-06-15（A3 — 纯能力，**零新 gate**）。本段是 §4 template-scan 的**互补面**，不是替代。
> **激活条件**：§2.1 检测到 k8s marker。非 k8s 项目 → 整段 N/A，跳过。
> **全 defensive authoring**：写准入策略（admission）、录最小权限 profile（SPO）、写运行时检测策略（Tetragon）。**绝不**做 offensive、绝不扫生产集群、绝不在没有 user 二次确认时 apply 到 live cluster。

### 4.5.0 边界声明 — RUNTIME authoring ≠ template scanning（关键，别混）

| 维度 | §4 IaC template scan（既有） | §4.5 Runtime authoring（本段新增） |
|---|---|---|
| **对象** | 静态 YAML / Dockerfile / *.tf **文件** | 集群**运行时**的 admission / syscall / kernel-level 行为 |
| **动作** | 读文件 → 报 misconfig（review only） | **编写**防护工件（policy / profile / TracingPolicy YAML）供 user 审后部署 |
| **时机** | build-time / PR / CI | deploy-time（admission）+ run-time（seccomp / eBPF detection）|
| **工具** | Checkov / Trivy config / Hadolint / kube-bench | Kyverno / OPA Gatekeeper / Security Profiles Operator / Tetragon |
| **本 skill 落盘** | 报告（vuln-report / evidence §9） | 防护工件 YAML（写到项目 `security/k8s-runtime/`，**不**直接 apply）|

> 一句话：§4 查"清单写对没"，§4.5 写"运行起来后拿什么挡 + 拿什么看"。两者都不改生产集群——§4 是 review，§4.5 是产出 user 去 apply 的工件。

### 4.5.1 三层运行时防护（admission → least-privilege → detection）

```
        ┌─────────────────────────── deploy-time ───────────────────────────┐
Layer 1 │ Admission control   Kyverno / OPA Gatekeeper                       │
        │   准入即拦截：把 §5 K8s checklist 的硬项变成集群级 enforce 策略     │
        └────────────────────────────────────────────────────────────────────┘
        ┌─────────────────────────── workload-spec ──────────────────────────┐
Layer 2 │ Least-privilege     Security Profiles Operator (SPO)               │
        │   ProfileRecording 从真实流量录最小 seccomp / SELinux / AppArmor    │
        └────────────────────────────────────────────────────────────────────┘
        ┌─────────────────────────── run-time ───────────────────────────────┐
Layer 3 │ Runtime detection   Tetragon (eBPF) — 默认 observe，Sigkill 须显式 │
        │   TracingPolicy 声明式监控 syscall / 文件 / 网络异常               │
        └────────────────────────────────────────────────────────────────────┘
```

### 4.5.2 Layer 1 — Admission control（Kyverno / OPA Gatekeeper）

准入控制器在 Pod **创建/更新进入集群前**校验/变更其 spec —— 把 §5 Kubernetes checklist 从"事后扫描发现违规"升级为"违规根本进不来"。两个主流选型：

| 选型 | 策略语言 | 适合 | 许可 |
|---|---|---|---|
| **Kyverno** | YAML（k8s-native，无需学新 DSL）| 大多数团队首选；validate / mutate / generate / verifyImages | Apache-2.0（CNCF）|
| **OPA Gatekeeper** | Rego（OPA policy language）| 已有 OPA 生态 / 需要复杂逻辑策略 | Apache-2.0（CNCF）|

**编写纪律**（本 skill 产出 policy YAML 供 user 审 → user apply）：

1. **先 `Audit`/`audit` 模式，后 `Enforce`/`enforce`**：新策略一律先以审计模式上线（只报不拦），观察 violations 不误伤现有 workload，再切 enforce。直接 enforce 易在生产挡掉合法部署。
2. **映射 §5 checklist 为策略**：每条 K8s checklist 硬项 → 一条 admission rule（如 `runAsNonRoot` / `readOnlyRootFilesystem` / drop ALL caps / 禁 `hostPath` / 禁 `privileged` / require resource limits / 禁 `latest` tag / require NetworkPolicy 标签）。
3. **Pod Security Standards 对齐**：策略 baseline 至少达 PSS `baseline`，生产目标 `restricted`。
4. **不在没有 user 二次确认时部署到 live cluster**：本 skill 只写 policy 文件；apply（`kubectl apply` / `helm install kyverno`）是 user 动作（与 §4 Tier B 同纪律）。

**Kyverno 策略示例骨架**（require runAsNonRoot + drop ALL caps，**先 Audit**）：

```yaml
# security/k8s-runtime/kyverno/require-nonroot-drop-caps.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-nonroot-drop-caps
spec:
  validationFailureAction: Audit   # ← 先 Audit；观察无误伤后改 Enforce
  background: true
  rules:
    - name: require-run-as-non-root
      match:
        any:
          - resources:
              kinds: [Pod]
      validate:
        message: "containers must set securityContext.runAsNonRoot=true"
        pattern:
          spec:
            =(securityContext):
              =(runAsNonRoot): true
            containers:
              - =(securityContext):
                  =(runAsNonRoot): true
                  =(allowPrivilegeEscalation): false
                  =(capabilities):
                    drop: ["ALL"]
```

**OPA Gatekeeper 等价**：写一个 `ConstraintTemplate`（Rego）+ 对应 `Constraint`（`enforcementAction: dryrun` 先行，等价 Kyverno 的 Audit）。

CLI（命令留档，实装以各 repo 当下 README 为准 — 版本号别写死）：
- 安装 Kyverno：`helm install kyverno kyverno/kyverno -n kyverno --create-namespace`（CNCF chart）
- 本地校验策略 against manifest（**不连集群**）：`kyverno apply security/k8s-runtime/kyverno/ --resource <your-manifests-dir>`（kyverno CLI dry-run，可进 CI）
- Gatekeeper：`helm install gatekeeper gatekeeper/gatekeeper -n gatekeeper-system --create-namespace`

### 4.5.3 Layer 2 — Least-privilege profiles（Security Profiles Operator）

Security Profiles Operator（SPO，kubernetes-sigs，Apache-2.0）负责把 seccomp / SELinux / AppArmor profile 作为 k8s CRD 管理并下发到节点。核心能力 = **`ProfileRecording` 从真实流量录最小权限**，避免手写 syscall allowlist 的猜测。

**录制 → 固化流程**（defensive，本 skill 写 CRD YAML + recording 流程指导）：

```
Step A  装 SPO（user 动作）：kubectl apply -f <SPO release manifests>（含 cert-manager 前置）
Step B  写 ProfileRecording CRD（recorder: bpf 或 logs）选中目标 workload label
Step C  在 staging/lab 跑真实/代表性流量（让 workload 执行全部正常路径）
Step D  停录 → SPO 生成 SeccompProfile / SelinuxProfile / AppArmorProfile CRD（最小集）
Step E  人工审 profile（去掉录制噪声 / 补漏掉的低频合法 syscall）
Step F  把 profile 挂回 workload securityContext.seccompProfile（type: Localhost）
Step G  先以 audit/complain 模式观察一轮，再切 enforce
```

**`ProfileRecording` 骨架**：

```yaml
# security/k8s-runtime/spo/recording-api.yaml
apiVersion: security-profiles-operator.x-k8s.io/v1alpha1
kind: ProfileRecording
metadata:
  name: api-seccomp-recording
  namespace: app-staging       # ← staging/lab，绝不生产录制
spec:
  kind: SeccompProfile
  recorder: bpf                 # bpf（eBPF）或 logs（audit log）
  mergeStrategy: containers
  podSelector:
    matchLabels:
      app: api                  # 选中要录的 workload
```

**录制纪律（safety）**：
- ❌ **绝不**在生产环境跑 ProfileRecording（录制 = 观测真实流量；放生产有侧信道/性能风险，且录到的 profile 可能含异常路径）。只在 **staging / lab** 录。
- ❌ **绝不**把录制出的 `SeccompProfile: Unconfined`（空/全放）当成"已加固"——录制噪声需人工裁剪。
- seccomp profile 切 enforce 前必须先 `audit`（complain）一轮，确认无 legit syscall 被挡（否则 workload 直接 crash）。
- 默认起点用 upstream `RuntimeDefault` seccomp（比 Unconfined 强很多、零维护），SPO 录制是在此之上做 workload-specific 收紧。

CLI（命令留档）：
- 安装 SPO：`kubectl apply -f https://github.com/kubernetes-sigs/security-profiles-operator/releases/download/<version>/operator.yaml`（需 cert-manager）
- 录制依赖 SPO 的 `spod` DaemonSet + `enableBpfRecorder: true`（用 bpf recorder 时）。

### 4.5.4 Layer 3 — Runtime detection（Tetragon eBPF）

Tetragon（cilium，eBPF-based，Apache-2.0）在内核态观测进程/文件/网络/syscall 事件；`TracingPolicy` 是声明式 YAML 策略。它能 **observe**（产 event）或 **enforce**（内核态 `Sigkill` 同步阻断）。

**铁律 — 默认 observe，Sigkill 须显式（safety boundary）**：

- ✅ **默认只 observe**：写 TracingPolicy 先做"监控 + 告警"，产出 event 流接 SIEM / 审计。这是绝大多数场景的正确起点。
- ⚠️ **`Sigkill` action 须显式 + 经 user 审批**：内核态 kill 进程是高风险（误杀合法进程 = 自造 DoS）。任何含 `Sigkill` / `Override` enforcement 的 TracingPolicy 必须：(1) 先以 observe 版本跑一轮验证规则不误报；(2) user 显式确认"我授权在 <env> 启用 Tetragon 内核态阻断"；(3) 默认只在 staging 验证，生产 enforce 须额外二次确认。
- ❌ **绝不**默认产出带 `Sigkill` 的策略；绝不在 observe 验证前直接 enforce。

**TracingPolicy 骨架（observe-only — 监控写敏感路径）**：

```yaml
# security/k8s-runtime/tetragon/monitor-sensitive-write.yaml
apiVersion: cilium.io/v1alpha1
kind: TracingPolicy
metadata:
  name: monitor-sensitive-write
spec:
  kprobes:
    - call: "security_file_permission"
      syscall: false
      args:
        - index: 0
          type: "file"
        - index: 1
          type: "int"
      selectors:
        - matchArgs:
            - index: 1
              operator: "Equal"
              values: ["2"]          # MAY_WRITE
          matchActions:
            - action: Post           # ← observe：产 event，不阻断
        # 若要阻断：增加 action: Sigkill —— 但须先 observe 验证 + user 显式授权（见上铁律）
```

**Tetragon vs Falco（§3 Coverage Matrix 已列两者）**：两者都做 runtime detection；Falco 偏 rule-based 告警（成熟、规则库大），Tetragon 偏 eBPF + 声明式 policy + 可选内核态 enforce。本 skill 写策略时按项目已有栈选；**两者的 enforce/kill 能力都遵守"observe-default、阻断须显式授权"铁律**。

CLI（命令留档）：
- 安装 Tetragon：`helm install tetragon cilium/tetragon -n kube-system`
- 看 event（observe 验证）：`kubectl exec -n kube-system ds/tetragon -c tetragon -- tetra getevents -o compact`
- 应用策略（user 动作，审后）：`kubectl apply -f security/k8s-runtime/tetragon/<policy>.yaml`

### 4.5.5 Runtime authoring → finding / evidence 接口

§4.5 产出的是**防护工件**（不是漏洞 finding）。但运行时 detection 触发的真实异常、或 admission audit 暴露的违规聚类，按 §7 Output Contract 走：

- Admission `Audit` 模式暴露的 violation 聚类（如"30% workload 跑 root"）→ 作为 misconfig finding 经 `appsec-sdk finding.add`（`source: container_scan`，`csf_function: PR`，映射 ASVS v5.0.0-13.x / NIST SP 800-190）。
- Tetragon observe 捕获的运行时异常（容器内起 shell / 写 `/etc` / 异常出站）→ 若构成 incident，escalate `security-response-incident-response`；若是 detection gap，记 risk-register。
- 防护工件本身（policy / profile / TracingPolicy YAML）写到项目 `security/k8s-runtime/`，列入版本控制（**不**含 secret），作为 §9 Platform Layer evidence 的配套工件引用。

### 4.5.6 §4.5 Hard Rules（运行时 authoring 专属，叠加 §6）

- ❌ **不**直接 apply policy / profile / TracingPolicy 到 live cluster（本 skill 只写工件；apply 是 user 二次确认动作，同 §4 Tier B）
- ❌ **不**默认产出带 `Sigkill` / `Override` / `enforce` 的 Tetragon 策略（默认 observe；阻断须 observe 验证 + user 显式授权）
- ❌ **不**在生产环境跑 SPO `ProfileRecording`（只在 staging/lab 录；录制 = 观测真实流量）
- ❌ **不**直接把新 admission 策略上 `Enforce`（先 `Audit`/`dryrun` 观察无误伤再 enforce）
- ❌ **不**把录制出的 `Unconfined` / 空 profile 当作"已加固"（录制噪声须人工裁剪）
- ❌ **不**把 §4.5 当 offensive —— admission/SPO/Tetragon 全是 defensive（准入 / 最小权限 / 检测）；本 skill 永不做 active scan / exploit / 攻击集群

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
- §4.5 Runtime authoring (◇ k8s):
  - [Kyverno (CNCF, admission control)](https://github.com/kyverno/kyverno)
  - [OPA Gatekeeper (CNCF, admission control)](https://github.com/open-policy-agent/gatekeeper)
  - [Security Profiles Operator (kubernetes-sigs)](https://github.com/kubernetes-sigs/security-profiles-operator)
  - [Tetragon (Cilium, eBPF runtime detection)](https://github.com/cilium/tetragon)
  - [Kubernetes Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [appsec-security-orchestrator](../appsec-security-orchestrator/SKILL.md)
- [security-platform-secrets](../security-platform-secrets/SKILL.md)
- [env-parity-baseline](../env-parity-baseline/SKILL.md)
- [security-response-incident-response](../security-response-incident-response/SKILL.md)（§4.5.5 runtime detection → incident escalation）
