# GSD Bridge Contract

> Detailed Step 0-8 dispatch contract for `uiux-product-orchestrator v2.1`.
> SKILL.md §3 references this file.

## 1. Activation Matrix

| .planning/ | .uiux/config.json | strict_mode | 行为 |
|---|---|---|---|
| absent | absent | — | 普通 UIUX routing only,无 `.uiux/` 副作用 |
| present | absent | — | GSD 项目,UIUX gate 未启用,advisory only |
| present | present | lax | hooks warn only; gate.ship 0/3 都放行 |
| present | present | strict | hooks hard-block; gate.ship 必须 PASS 或 CONDITIONAL_PASS |

激活检测顺序(由 hook/sdk 自动执行):
1. 找 `.uiux/config.json`(walk up ≤ 12 levels)
2. 若不存在 → silent exit 0(零副作用)
3. 若存在 → 读 `.planning/` 配套状态;若 `.planning/` 缺失则只做 routing advisory

---

## 2. GSD Phase Detection

判断当前 phase 是否为 frontend/UI(任一命中即视为 UI phase):

1. `.planning/ROADMAP.md` phase 描述含 `frontend|ui|design|screen|page|component|tsx|jsx|vue|svelte`
2. `.planning/phases/<N>*/CONTEXT.md` 含 `visual|user-facing|surface|UI`
3. phase 任一 plan 文件涉及前端代码路径(`src/**/*.{tsx,jsx,vue,svelte}` / `app/**` / `pages/**` / `components/**`)
4. `.planning/config.json.workflow.ui_phase != false`

`uiux-sdk detect.gsd` 输出包含 phase detection 结果:

```json
{
  "planning_exists": true,
  "uiux_config_exists": true,
  "current_phase": "01",
  "phase_dir": ".planning/phases/01-dashboard",
  "phase_is_frontend": true,
  "ui_phase_enabled": true,
  "ui_safety_gate": true,
  "ui_review_enabled": true,
  "strict_mode": "strict"
}
```

---

## 3. Step 0-8 Dispatch Contract

### Step 0 — Bootstrap

输入:`.uiux/config.json` + `.planning/config.json` + `.planning/STATE.md`

逻辑:
- 无 `.uiux/config.json` → silent exit
- 无 `.planning/` → 只 routing advisory(不创建 `.uiux/` 任何文件)
- 都有 → 读 `allowed_l3_styles` / `strict_mode` / `handoff` → 进 Step 1

### Step 1 — Phase Detection

`uiux-sdk detect.gsd` → 决定后续步骤是否触发

### Step 2 — Init Release Tag(按需)

`uiux-sdk init <release-tag>` 创建:
- `.uiux/evidence/<tag>/`
- `.uiux/findings/<tag>/`
- `.uiux/decisions/<tag>/`
- 写 `.uiux/state.json.active_release_tag`

只在 GSD 进入 release 准备阶段(`/gsd-ship` 临近)才需要。早期 phase 工作可以不 init。

### Step 3 — Before `/gsd-plan-phase`(hook 触发)

`uiux-gsd-plan-guard.js`:
- phase 不是 frontend → 0
- `workflow.ui_safety_gate == false` → 0
- UI-SPEC.md 存在 → 0
- UI-SPEC.md 缺失 + strict → exit 2,提示 "Run /gsd-ui-phase N first"
- UI-SPEC.md 缺失 + lax → stderr warn,exit 0

### Step 4 — After `/gsd-ui-phase`

`uiux-sdk mirror.gsd-ui-spec <phase> <release-tag>`:
- 读 `.planning/phases/<phase>*/<phase>*-UI-SPEC.md`(支持 GSD 命名变体)
- 提取 sections: Spacing / Typography / Color / Copywriting / Registry Safety
- 写 `.uiux/evidence/<tag>/gsd-ui-spec.yaml`(完整 mirror)
- 写 `.uiux/lock/chassis.yaml`(normalized lock)
- 失败:UI-SPEC 缺必需 section → exit 2

### Step 5 — On L3 Style Skill Invocation(hook 触发)

`uiux-style-mutex-guard.js`:
- 检测 Skill matcher 命中 L3 风格 skill
- 读 `.uiux/lock/style-lock.yaml`
- 不存在 → 调 `uiux-sdk lock.style <tag> <style>` 写新 lock
- 存在且同一 style → 0
- 存在但不同 style → exit 2(除非 `# uiux-allow:unlock-style <reason>` provenance)

Workflow skill(`redesign-skill` / `image-to-code-skill` / `stitch-skill`)被作为 L3 → 永远拒,exit 2。

### Step 6 — Before `/gsd-execute-phase`

不强制重跑全流程。只检查:
- frontend phase 是否有 UI-SPEC(已由 Step 3 保证)
- chassis lock 仍 consistent(`uiux-sdk drift.check <tag>` advisory)
- style lock 仍 active

通过即继续。

### Step 7 — After `/gsd-ui-review`

`uiux-sdk mirror.gsd-ui-review <phase> <release-tag>`:
- 读 `.planning/phases/<phase>*/<phase>*-UI-REVIEW.md`
- 提取 6-pillar scores: Copywriting / Visuals / Color / Typography / Spacing / Experience Design
- 提取 top fixes(BLOCKER / WARNING)
- 写 `.uiux/evidence/<tag>/gsd-ui-review.yaml`

### Step 8 — Before `/gsd-ship`

分两层 enforcement(hook 不直接 dispatch agent,因为 hook 是短同步进程):

**Layer A — Orchestrator 主动调用(推荐)**:
- 在 user explicit `/gsd-ship` 前,orchestrator(或用户)应主动 invoke
  `Agent(subagent_type="uiux-gsd-contract-validator", model="opus")` 生成完整 decision
- Agent 写 `.uiux/decisions/<tag>/uiux_release_decision.yaml`(full schema per
  references/release-decision-schema.md §1,含 `config` / `surface_coverage` /
  `qa_handoff` / `appsec_handoff` 等所有 block)
- 如果只有 SDK fallback `uiux-sdk decision.write <tag>` 写过,decision 是 minimal subset
  (无 handoff 块);CI-only path,production 必须用 agent

**Layer B — Hook 兜底(`uiux-release-guard.js`)**:
- PreToolUse Skill=`gsd-ship` 触发 hook
- Hook **不**调用 agent(同步进程,避免阻塞)
- Hook 只读 `.uiux/decisions/<tag>/uiux_release_decision.yaml` 并校验
  `decision in {PASS, CONDITIONAL_PASS}`
- 缺失或 != PASS/CONDITIONAL_PASS → 阻断 `gsd-ship`,提示 user 跑 validator agent 或 sdk gate.ship
- Stop hook 兜底:assistant 说"UI done / 上线就绪"等触发词时同样校验

**CI / 命令行 path**:
- `uiux-sdk gate.ship <tag> --phase <N> [--allow-conditional]` — 退出码 0/1/2/3
- 当 `--phase` 提供时,gate.ship 会调 SDK 的 `cmd_decision_write_internal` fallback
  自动写一份 minimal decision(若不存在),便于纯 CI 场景使用

---

## 4. Dispatch Failure Policy

任何 dispatch 失败都不允许伪装通过:

| 失败类型 | release_decision 影响 |
|---|---|
| UI-SPEC.md 缺失 + frontend phase + strict | BLOCKED |
| UI-SPEC.md 存在但 `gsd-ui-checker` 标 BLOCK | BLOCKED(消费 GSD checker 结论,不重审) |
| chassis.yaml mirror 失败(缺必需 section) | BLOCKED |
| style-lock 冲突未 resolve | BLOCKED |
| UI-REVIEW.md 缺失 + `workflow.ui_review != false` + strict | BLOCKED |
| UI-REVIEW.md 含 BLOCKER | FAIL |
| UI-REVIEW.md 仅 WARNING | CONDITIONAL_PASS |
| QA handoff 声明 baseline_ready=true 但 `.qa/evidence/<tag>/visual-baseline/` 不存在 | BLOCKED |

---

## 5. 与 GSD config 的协同

读取 `.planning/config.json` 关键字段:

```json
{
  "workflow": {
    "ui_phase": true,
    "ui_safety_gate": true,
    "ui_review": true
  }
}
```

- `ui_phase=false` → 跳过 Step 4 mirror(GSD 项目不跑 UI 设计契约)
- `ui_safety_gate=false` → Step 3 plan-guard hook 始终放行
- `ui_review=false` → Step 7/8 不要求 UI-REVIEW.md

UIUX orchestrator **完全尊重 GSD config**,绝不绕过。
