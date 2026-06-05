<!-- CONTRACT-SENTINEL: qa.workflow-spec-dispatch.v2026-05-29 -->

# Relocated from enterprise-qa-testing/SKILL.md — §18.1-18.4 workflow-spec boundary/presets/paths/dual-mode

### 18.1 何时进 workflow-spec mode（与 v3.1 Skill-direct 的边界）

| 触发 | 路由 |
|---|---|
| `quick-check / focused-qa-gate / release-readiness / commercial-cert` 任一显式 slash 命令 | workflow-spec |
| Skill 默认入口（无显式 mode） | Skill-direct（v3.1 自 dispatch） |
| `.qa/config.json` 含 `execution_mode: "workflow-spec"` 且 `gate.check` 需要 cross-run resume | workflow-spec |
| `commercial-cert` 任何场景 | workflow-spec（强制 — 用户必须显式批准预算） |
| Skill 还在做 Discover / Risk-score / Mode-select 阶段 | Skill-direct（workflow 由 Skill 主线在 Step 6 之前 launch） |

边界铁律：
1. **风险分类永远先在 Skill 主线**跑（R4 Option A）—— `qa-risk-classifier` agent 在 Skill 主线先出 risk_snapshot，**再**写入 `spec.context.risk_snapshot`，**再** launch Workflow。Workflow 入口的 `LayerSelect` 直接消费这个 snapshot，不重跑。
2. **commercial-cert 强制 Preview + budget approval**：Skill 主线渲染 Execution Preview（含 banner `=== REQUIRES EXPLICIT BUDGET APPROVAL ===`） + 等用户 explicit approve + 写 sentinel `<project>/.qa/state/preview/<run_id>.json`（必含 `approved_estimate_high` 数字 + `approval_text` 含 approved/approve/批准/确认/同意 任一）→ `qa-preview-gate` PreToolUse hook 校验 sentinel 才允许 `Workflow({name:"qa-orchestrator"})` 启动。
3. **Workflow body 是 pure**：no `Date.now / Math.random / require / fs / fetch / process.cwd`。所有外部命令（tsc / eslint / playwright / lighthouse / axe / pa11y）都在 agent node 跑，deterministic op 只解析已收集到的证据。

### 18.2 6 Presets 选择树

| Preset | 触发 | Phases | Wall-clock est | Token est | 何时用 |
|---|---|---|---|---|---|
| `smoke` | 内部 harness 测试（不暴露给用户） | 5 | ~3 min | 100-200k | 内部回归 — 验证 single + fanout + deterministic 三类节点能跑 |
| `graph-smoke` | 内部 harness 测试 | 7 | ~5 min | 200-300k | 内部回归 — 在 smoke 基础上加 pipeline，触发全 4 类节点 |
| `quick-check` | `/qa-quick-check` 显式 slash | 5 | ~5-10 min | 200-400k | 开发分支 commit 前自检；只跑 Static + 关键层；fail-fast |
| `focused-qa-gate` | `/qa-focused-gate` | 6 | ~15-30 min | 500-800k | PR review gate；按 risk_snapshot 选层 fanout |
| `release-readiness` | `/qa-release-readiness` | 9 | ~30-60 min | 800k-1.5M | merge-to-main / release branch 验收；含 FlakyTriage + 完整 evidence bundle |
| `commercial-cert` | `/qa-commercial-cert` | 15 | ~60-120 min | 1.5-3M | 客户可见发布 / 法规行业；额外加 Visual + A11y + Perf 三 Audit→Gate；**强制用户预算批准** |

R9 Audit→Gate 模式（仅 commercial-cert 用）：Visual / A11y / Perf 三层每层都是 agent **Audit** 节点（跑 Playwright / Lighthouse / axe / pa11y）+ 紧跟一个 deterministic **Gate** 节点（按 threshold policy 出 PASS/WARN/BLOCK）。Audit 出 hint，Gate 出 final。

### 18.3 Evidence 路径

所有 workflow-spec run 的 evidence 落到 `<project>/.qa/evidence/<release-tag>/`，层布局：

```
.qa/evidence/<tag>/
  static.yaml               # StaticBaseline + StaticGate
  component.yaml            # UnitOrComponent 或 ComponentOrContract fanout 各 surface
  contract.yaml             # commercial-cert / focused-qa-gate 的 contract drift
  e2e/<scenario_id>/
    prepare.yaml            # E2E pipeline stage 1
    run.yaml                # E2E pipeline stage 2
    screenshot.png / video.webm / trace.zip / network.har
  flaky.yaml                # FlakyTriage 8-cat 分类 + 8-field quarantine
  visual/<surface_id>/      # commercial-cert only — actual/expected/diff.png + audit yaml
  a11y.yaml                 # commercial-cert only
  perf.yaml                 # commercial-cert only
  qa_evidence_bundle.yaml   # 最终 release decision（PASS/FAIL/BLOCKED/CONDITIONAL_PASS）
  workflow-state.yaml       # R10 — provenance / planning snapshot（不是 Workflow native resume cache）
  dispatch_failures.yaml    # R7 — 所有 null/dropped 的 fanout/pipeline item 记录为 MISSING
```

Naming 安全：所有 `<tag>` 与 `<layer>` 必须匹配 `^[a-zA-Z0-9._-]+$`，qa-sdk 强制 reject 不合规字符（防路径遍历）。

### 18.4 Dual Execution Mode Boundary（Workflow vs Skill-direct）

| 维度 | workflow-spec | Skill-direct (v3.1) |
|---|---|---|
| 入口 | Skill 主线 launch `Workflow({name:"qa-orchestrator", args:{spec, run_id, release_tag, ...}})` | Skill 自身 §6 9-step orchestration |
| Phase 调度 | Workflow body deterministic 调度，依 spec.phases + ops_allowed 白名单 | Skill 主线按 §6 顺序 dispatch |
| Resume | same-session 内 Workflow `resumeFromRunId` + spec_hash + node fingerprint；跨 session 由 Skill 主线读 workflow-state.yaml + 注入 `args.previous_results` | 不支持 resume — 每次重跑 |
| Model 路由 | 双层：`model` alias (production-skill 决定) + `resolved_model` (preset pre-bake / Skill 覆盖) | Skill 主线直接调 agent，按各自 frontmatter |
| Cost 可预测性 | 高（preset 写明 `_estimate.token_estimate_low/high`） | 中（依分支复杂度） |
| Audit footprint | 完整 — preset spec_hash + phase fingerprint + Preview approval sentinel | 中 — 各 Step 输出落 .qa/evidence/<tag>/ 但无 spec_hash 锚 |
| commercial-cert 必走 | 是（强制 budget approval gate） | 否 |

铁律：
- workflow-spec **永远** 在风险分类、preview rendering、user approval、sentinel 写盘 之后再 launch
- Skill-direct **永远** 不调 `Workflow` tool（除非用户显式 enable workflow-spec mode）
- 同一 release_tag 不能同时跑两种 mode 写 evidence（先到先得；Skill 主线在 launch 前用 `qa-sdk evidence.list <tag>` 检查冲突）


---

# Relocated from enterprise-qa-testing/SKILL.md — §18.5 Workflow-Spec Launch Contract (14-step)

### 18.5 Workflow-Spec Launch Contract（Skill → Workflow handshake，B.1.g 2026-05-29 — REQUIRED）

> 镜像 `appsec-security-orchestrator` §16.11。本 contract 是 Skill 主线在
> workflow-spec mode 下 launch Workflow tool 之前**必走的 14 步**。任何一步
> skip 或 silent fallback = bug。可执行 helper 已落地为 `qa-sdk spec.hash` /
> `qa-sdk sentinel.write` / `qa-sdk sentinel.show`（§17.4）+ `shared/spec-hash.js` 
> canonical 算法 helper。
>
> **Governed Gate Mode (CLAUDE.md §3.7) — gate_active window**：作为本 contract 的**第一个动作**（在 Step 1 / preview render 之前），Skill 必须写 `.qa/state.json` `gate_active: true`，并在 terminal verdict / abort 时清除。这关掉 pre-sentinel 窗口，使 `governed-gate-workflow-guard.js` 在**整个 gate 期间**（不只是 sentinel 写盘后）拦截 inline model-authored Dynamic Workflows。

```
 1. 解析触发：用户显式 slash（/qa-quick-check / /qa-focused-gate /
    /qa-release-readiness / /qa-commercial-cert）OR config.execution_mode == "workflow-spec"
    → 若都不匹配 → 走 §6 Skill-direct 路径，不进 §18.5。

 2. 跑 §1.6.1 Discover + §3 Risk Model（Skill 主线 dispatch qa-risk-classifier agent）
    → 出 risk_snapshot（含 Impact × Likelihood + Floor Rules + Modifier Cap）
    → 不出 risk_snapshot 不能进 §18.5（R4 Option A 锁）

 3. Pick preset 路径（~/.claude/orchestrator-runtime/qa/presets/）：
    /qa-quick-check        → quick-check.json
    /qa-focused-gate       → focused-qa-gate.json
    /qa-release-readiness  → release-readiness.json
    /qa-commercial-cert    → commercial-cert.json
    内部 harness 测试       → smoke.json / graph-smoke.json（绝不暴露给用户）

 4. Load preset → 作为 `spec` 基础。Walk spec.phases + pipeline.stages 收集
    所有 prompt_ref / schema_ref：
      prompts:  ~/.claude/orchestrator-runtime/qa/prompts/<ref>.md
      schemas:  ~/.claude/orchestrator-runtime/qa/schemas/<REF>.json
    把内容 inline 到 spec.prompts[ref] / spec.schemas[ref]。
    缺文件 = hard fail（绝不 silent skip）。

 5. 注入 spec.context（Skill-fill fields）：
      risk_snapshot:           来自 Step 2
      release_tag:             用户提供或当前 git tag
      run_id:                  release_tag 的 safe-name 版本
      critical_release_paths:  来自 .qa/config.json
      policy:                  CANONICAL FLOOR = preset 自带的 spec.context.policy
                               （commercial-cert baked a11y_floor + perf_floor，见
                               presets/commercial-cert.json 的 context.policy 块）。
                               在此 floor 之上 merge `.qa/config.json` + risk_snapshot
                               派生的**收紧**项；**绝不丢弃、绝不放宽 preset floor**。
                               ⚠️ 引擎 qa-orchestrator.js:47 读的是 args.context.policy
                               （= Step 13 传的本字段），**不是** spec.context.policy；
                               而 perf_gate_policy 对缺失 floor 默认 Infinity（永不拦）——
                               所以 policy 缺 perf_floor = workflow 模式 perf 门**静默失效**
                               （a11y_floor 缺则默认 0/0，偏严，安全）。Step 13 必须把这个
                               merged policy 原样带进 args.context.policy（DOUBLE-WRITE 第 3 处）。
                               注：保留 spec.context.policy 为 preset baked floor、**勿覆盖**——
                               qa-orchestrator.js 有引擎兜底（2026-06-05）：args.context.policy 缺
                               floor 时从 spec.context.policy gap-fill（只填缺、不放宽），作为
                               "Skill 忘传"的最后防线。两层都对 = 不会静默失效。
      （commercial-cert 额外）budget_approval: 暂为占位，Step 10/11 填入

 6. 决定 fanout / pipeline width：
      ComponentOrContract fanout width = LayerSelect.changed_surfaces.length（按 risk 上下限 clamp）
      VisualAudit fanout width = surfaces × viewports × themes（commercial-cert only）
      E2E pipeline items = LayerSelect.critical_scenarios（preset _items_range clamp）

 7. Skill-side alias resolution（§1.11 #2 必走）：对 spec.phases[].model / stages[].model
    做 alias → literal 映射，写 node.resolved_model 字段。来源优先级：
      (a) .qa/config.json.model_policy_overrides
      (b) ~/.claude/orchestrator-runtime/shared/model-policy.md 默认 mapping
    生成 args.model_policy_version = sha256-prefix(overrides + default snapshot)
    Workflow body NEVER 再 resolve；它读 resolved_model 即用。
    **Model-tier 铁律（Policy A, user lock 2026-05-30；supersedes 2026-05-28 sonnet-cap）**：
    haiku 只在 smoke preset；real gate ≥ sonnet；judgment/verdict 节点 bake
    `resolved_model: opus`；fanout 封顶 sonnet。由 `shared/lint-model-policy.js`
    强制（接进 qa|appsec validate-all-presets.sh）：non-smoke haiku → FAIL，fanout
    opus → FAIL。（注：早先"workflow-lint.sh 拒 preset 写死 opus / production 自动上提"
    **从未实装**——workflow-lint.sh 只 lint runner JS，不看 preset；真正的 preset 模型
    策略强制器是 `shared/lint-model-policy.js`。见 model-policy.md §Policy A。）

 8. 计算 spec_hash：
      spec_hash=$(echo "$spec_json" | bash "$HOME/.claude/scripts/qa-sdk.sh" spec.hash -)
    或读文件：
      spec_hash=$(bash qa-sdk spec.hash <(echo "$spec_json"))
    算法与 ~/.claude/hooks/qa-preview-gate.js 一致（共享 helper
    ~/.claude/orchestrator-runtime/shared/spec-hash.js，B.1.g 落地）。
    格式：`sha256:<64-hex>`。任何 drift = hook 拒 launch。

 9a. Spec 验证：
      node ~/.claude/orchestrator-runtime/shared/validate-spec.js <spec.json>
      exit 0 = OK / exit 2 = SPEC INVALID（中止，0 token 花费）

 9b. Capability preflight（§17 + §1.10 必走）：
      bash ~/.claude/orchestrator-runtime/qa/tests/preflight-check.sh <spec.json>
      检查：
        - 每个 node.agentType 对应 ~/.claude/agents/*.md 真实 name: frontmatter
        - registry.json 里 required hook 都在 <project>/.claude/settings.json 注册
        - qa-sdk 可达
        - 每个 model alias 在 registry / shared/model-policy 可解析
        - 13 个 embedded_skill_contracts anchor 都在 SKILL.md 存在
      exit 0 = OK / exit 2 = MISSING_CAPABILITY（中止）/ exit 3 = internal error
      **不可 skip。** 缺一不 launch。

10. Render Execution Preview（使用 ~/.claude/orchestrator-runtime/shared/preview-template.md）：
    必填字段：
      Mode（human-readable）/ Why this shape（2-3 句）/ Workflow 每 phase
      （type human / model alias human / agentType / job 一句）/
      Budget（token est_low~est_high + hard_cap + abort rule）/
      Evidence outputs（preset._estimate.evidence_layers）/
      Resume（fresh 或 cached N phases from <snapshot>）/
      Preflight（绿色一行 summary）/
      Approve? 提示
    commercial-cert 额外渲染 banner：`=== REQUIRES EXPLICIT BUDGET APPROVAL ===`，
    并显式询问用户对 token_estimate_high 的批准（数字必须 echo 出来）。

11. 等用户 reply。匹配 approval whitelist（精确，大小写无关，trim）：
      英文：OK / okay / approve / approved / go / yes / proceed / ship it / LGTM
      中文：跑 / 批准 / 同意 / 继续 / 好 / 执行
    commercial-cert 额外要求用户 reply 含数字（批准的 estimate_high）OR 含
    "=== REQUIRES EXPLICIT BUDGET APPROVAL ===" banner 复述。
    不匹配 → 不写 sentinel → 不 launch（下一次 hook 会自动 block）。

12. 写 sentinel（fail-closed）：
    bash "$HOME/.claude/scripts/qa-sdk.sh" sentinel.write \
      --run-id "$run_id" \
      --mode "$mode" \
      --spec-file "$spec_path" \
      --approval-text "$user_reply" \
      --ttl-seconds "$(read_config preview_approval_ttl_seconds 300)" \
      ${mode}=="commercial-cert" && --approved-estimate-high "$approved_tokens"
    qa-sdk 会：重算 spec_hash 防漂移 / 写 mode-whitelist / commercial-cert 强校
    budget + approval text / TTL clamp [30, 3600] / 原子写入 <project>/.qa/state/preview/<safe_run_id>.json。
    Bash 失败 = abort（不能 launch 无 sentinel）。

13. Launch Workflow：
      Workflow({
        name: "qa-orchestrator",
        args: {
          spec,                  // inline + alias-resolved spec
          run_id,
          release_tag,
          spec_hash,             // 必传，hook 二次校
          context: {
            risk_snapshot, critical_release_paths,
            policy,                // Step 5 的 merged policy：preset baked floor
                                   // (a11y_floor + perf_floor) + 项目收紧项。引擎读
                                   // input.context.policy（本字段），perf 缺 floor =
                                   // Infinity = 不拦 → 必须带全，不能传 {} 或半截。
            // R15 node-specific extras：
            branch_sha, viewport, playwright_config_hash,
            screenshot_baseline_dir_hash, visual_baseline_dir_hash,
            e2e_runner_version,
          },
          model_policy: { /* overrides for resolveModel */ },
          previous_results,      // 来自上次 workflow-state.yaml.phase_outputs_fingerprinted
        }
      })
    Hook (`qa-preview-gate`) PreToolUse 校 sentinel → 允许 launch / 拒。
    错误处理：log + 上报用户，重启路径由用户决定，**绝不 silent re-launch**。

14. Persist：Workflow result 回来后，Skill 主线：
      a. 把 result.phase_outputs 各层（static / component / contract / e2e / visual / a11y / perf / flaky / qa_evidence_bundle）
         通过 `qa-sdk evidence.append <tag> <layer>` 落盘。
      b. 把 result.phase_outputs_fingerprinted（JSON）+ result.run_id + result.spec_hash + 
         reused_phases + cache_misses + dispatch_failures + model_policy_version + 用户 approval 摘要
         作为 yaml 通过 `qa-sdk evidence.append <tag> workflow-state` 单文件追加。
      c. 调 `qa-sdk gate.check <tag>` 出 release_decision exit code（GSD 主线 / CI 消费）。

非协商铁律：
- **Step 8 在 Step 9 之前**（hash 先于 validate）—— validate 失败也得有 hash 给用户看；
  但 hash 计算必须在 Step 7 alias-resolve 之后（不然 resolved_model 不入 hash）。
- **Step 9b preflight 不可 skip**（"为省 token" 跳 → 一次跑废）。
- **Step 11 approval 是 human-in-the-loop**：Skill 不 auto-approve / 不把沉默当批准 /
  不把 unrelated reply 当批准。
- **Step 12 sentinel** = fail-closed：Bash 写失败 → abort，绝不 Workflow() 后裸 launch。
- **Step 14 persist** 必经 qa-sdk（不允许 echo > file）；workflow-state.yaml
  是 Skill provenance log（D4），不是 Workflow native resume cache。

测试覆盖（B.1.g 落地）：
- `tests/cold-start-customs.sh` 验证所有 spec.agentType 在真实 frontmatter 解析得到 +
  preset 与 schema 链路一致（dry-run 默认；--live 可选触发 dispatch smoke）
- `tests/spec-hash-parity.js` 验证 spec-hash.js 与 qa-preview-gate.js 算法 byte-identical
- 既有 `validate-all-presets.sh` / `workflow-lint.sh` / `lint-schemas.sh` /
  `unit-resolve-capabilities.sh` / `unit-hashnode-stability.js` / `preflight-check.sh` 全部继续 PASS

---
