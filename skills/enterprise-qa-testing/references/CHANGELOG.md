# Relocated from enterprise-qa-testing/SKILL.md — §Changelog v3.0–v3.2

> **v3.2.1 (2026-06-05) — workflow-spec perf-floor 闭环 + gate.check fail-closed + write-guard 加固（codex 双轮 + E8 42/42 + 自审）**：
>   1. **§18.5 perf-floor 透传（真 correctness gap 修复）**：step 5/13（SKILL.md + `references/workflow-spec-dispatch.md`）钉死 preset baked `context.policy`(a11y_floor/perf_floor) 必须复制进 `args.context.policy`——否则 `perf_gate_policy` 缺 floor 默认 Infinity = workflow 模式 perf 门**静默失效**。三处 double-write anchor（preset baked / schema `_doc` / §18.5）对齐。
>   2. **引擎兜底**：`workflows/qa-orchestrator.js` 加 `fillPolicyFromPreset`——`input.context.policy` 缺 floor 时从 `spec.context.policy` gap-fill（只填缺、不静默放宽；runtime 仍可收紧）。release-time only，dev 不触发。
>   3. **`qa-sdk gate.check` A1 fail-closed**：canonical schema validator 缺失 / 合成失败从 WARN-skip 改为 BLOCK exit 2（与 qa D2 无-escape fail-closed 一致；消 silent non-enforcement）。
>   4. **`qa-bundle-write-guard.js`**：修嵌套 `qa_enforcement:"off"` 遮蔽外层 enforcing root（收集所有 containing root，任一 enforcing 即拦）。
>   5. **`qa-mark-stale.js`**：reasons[] 加 cap+dedupe、PID-unique temp 名。
>   6. **`qa-sdk` evidence.append 盖章**：首行 `# written-by: qa-sdk@3.1.0`，补全 guard allow-path（HANDOFF §6 "必须"；零拦截因 SDK 走 Bash）。
>   验证：E8 自建 42/42 + appsec fixture 38/38 回归 + codex round-1(12 findings)/round-2(1 新缺陷)全修。详 `Desktop/harness-eval-sandbox/HANDOFF-PHASE-D.md`。

> **v3.1.0 GSD 化升级 (2026-05-25) — 从"输出 dispatch 建议（软）"升级到"真 dispatch + 验收 evidence + 阻断假通过（硬）"**：
>   1. frontmatter `allowed-tools` 加入 `Skill, Agent, AskUserQuestion` — 本 skill 现在**真的**有 dispatch 权限
>   2. §1.6 新增 Enforcement Contract — 声明 `.qa/` 目录契约、3 个 named agents、5 个 hooks、qa-sdk helper 的硬绑定
>   3. §6 Step 5/6 重写：从"输出 dispatch_qa_owned YAML 让调用方执行"改为"本 skill 直接 `Skill(...)` / `Agent(...)`，收 evidence 落到 `.qa/evidence/<release-tag>/`"
>   4. §6 Step 7 重写：用 `Agent(subagent_type=qa-evidence-validator)` 真验收，不再让 parent 自己 grep YAML
>   5. §6 Step 8 重写：用 `Agent(subagent_type=qa-flaky-triager)` + `Skill(qa-flaky-governance)` 双校验
>   6. §6 Step 9 重写：dispatch `Skill(qa-evidence-bundle)` 出 release_decision
>   7. §13.1 重写：从"本 skill 不能自己 dispatch"改为"必须自己 dispatch + 验收，失败不能伪装 PASS"
>   8. §17 新增 Enforcement Registration — `.qa/` 文件契约、agent/hook 注册位置、qa-sdk 命令契约
> **v3.0.1 微调日期：2026-05-24 — scenario 3 回归暴露的 2 MEDIUM + 1 LOW 补丁（不改架构）**：
>   1. §13.1.1 新增 "Bridge skill 3-stage dispatch chain" 图解，明确调用方必须执行 stage (d) 回灌 bridge skill 验收，避免跳过 hard-rule 检查
>   2. §16 新增 `schema_registry` block，调用方 1-shot 拿到 13 个 child skill 的 §6 schema path + output_key + 特殊 decision_states，无需挨个 Read
>   3. （配套）`qa-evidence-bundle` §5 Step 6 补 `test_data READY → PASS aggregation` / `flaky NOT_APPLICABLE → PASS aggregation` 规则 + decision state 字典
> **v3.0 重构日期：2026-05-24 — A+ 架构升级：从"单体决策中枢"变为"调度中枢 + 13 个 QA-owned child skill 网络"**。
>   - 1 parent (本文件) 保留：Risk Model / Layer Selection / 9-Step Workflow / Hard Rules / Dispatch Contract / Output Contract
>   - 13 children 实施：Static / TDD-Bridge / Component / Integration / Contract / E2E-Gate / Visual / a11y / Perf / Test-Data / Flaky / Smoke / Evidence-Bundle
>   - 2 reference agents（不替代）：tdd-guide（被 qa-test-design-tdd-bridge 引用）、e2e-runner（被 qa-e2e-coverage-gate 引用）
>   - 与其他 4 大 orchestrator（appsec / uiux / gsd-pipeline / claude-env-bootstrap）的对称网络架构完成

---
