# Release Decision Schema

> SKILL.md §6 reference。`.uiux/decisions/<tag>/uiux_release_decision.yaml` 的完整 schema。

## 1. Schema

```yaml
schema_version: 1.0
release_tag: <tag>
decision: PASS | FAIL | BLOCKED | CONDITIONAL_PASS
decided_at: <ISO8601>
decided_by: uiux-gsd-contract-validator@<git_sha>

gsd:
  phase: "01"
  phase_dir: ".planning/phases/01-dashboard"
  phase_status: in_progress | verified | shipped | unknown
  ui_spec_path: ".planning/phases/01-dashboard/01-UI-SPEC.md"
  ui_review_path: ".planning/phases/01-dashboard/01-UI-REVIEW.md"
  verification_path: ".planning/phases/01-dashboard/01-VERIFICATION.md"
  uat_path: ".planning/phases/01-dashboard/01-UAT.md"

config:
  workflow_ui_phase: true | false
  workflow_ui_safety_gate: true | false
  workflow_ui_review: true | false
  uiux_strict_mode: strict | lax

style_lock:
  status: locked | not_required | missing | conflict
  l3_style: taste | luxury | brutalist | null   # taste 含 §11 三档变体 A/B/C(语义切换,非独立 enum)
  skill_id: <exact skill name>
  lock_path: .uiux/lock/style-lock.yaml
  mutex_violations: []   # list of attempted-but-blocked L3 invocations

chassis:
  status: locked | missing | drift_detected | partial
  source_type: gsd-ui-phase
  source_path: ".planning/phases/01-dashboard/01-UI-SPEC.md"
  source_sha256: <hash>
  lock_path: ".uiux/lock/chassis.yaml"
  drift_detected: false
  required_sections_missing: []

ui_review:
  status: pass | warning | blocker | missing | not_required
  source_type: gsd-ui-review
  source_path: ".planning/phases/01-dashboard/01-UI-REVIEW.md"
  scores:
    copywriting: 1..4
    visuals: 1..4
    color: 1..4
    typography: 1..4
    spacing: 1..4
    experience_design: 1..4
  total_average: <float>
  blockers: []        # severity=BLOCKER fix items
  warnings: []        # severity=WARNING fix items

surface_coverage:
  total_declared: <int>
  designed: <int>
  reviewed: <int>
  missing: <int>
  notes: ""

qa_handoff:
  visual_regression_required: true | false
  baseline_path: .qa/evidence/<tag>/visual-baseline/
  baseline_ready: true | false
  handoff_status: not_required | pending | ready | failed

appsec_handoff:
  frontend_review_required: true | false
  user_data_surfaces: []   # surface ids that contain user data / auth / settings
  handoff_status: not_required | pending | ready

hard_block_reasons: []      # FAIL / BLOCKED 必填
conditional_reasons: []     # CONDITIONAL_PASS 必填
warnings: []                # informational

downstream_consumers:
  - gsd-ship
  - gsd-verify-work
  - qa-visual-regression
  - appsec-frontend-review
```

## 2. Decision State 计算

```
decision = compute_from(
  style_lock.status,
  chassis.status,
  ui_review.status,
  qa_handoff.handoff_status,
  appsec_handoff.handoff_status,
)
```

### PASS(exit 0)

全部满足:
- `style_lock.status in {locked, not_required}`
- `chassis.status == locked` (frontend phase) OR `not_required` (non-UI phase)
- `ui_review.status in {pass, not_required}`
- `qa_handoff.handoff_status in {not_required, ready}`
- `appsec_handoff.handoff_status in {not_required, ready}`
- `hard_block_reasons == []`
- `conditional_reasons == []`

### CONDITIONAL_PASS(exit 3)

PASS 的所有条件,**除**:
- `ui_review.status == warning`(有 WARNING 但无 BLOCKER)

`conditional_reasons[]` 必须列出全部 warning fix ids。

CI 串法约定:

```bash
# 推荐:显式 allow-conditional
uiux-sdk gate.ship "$TAG" --phase "$N" --allow-conditional && deploy

# 或者:显式分支
uiux-sdk gate.ship "$TAG" --phase "$N"
case $? in
  0) deploy ;;
  3) require_manual_approval && deploy ;;
  *) exit 1 ;;
esac
```

### FAIL(exit 1)

- `ui_review.status == blocker`
- OR `chassis.status == drift_detected`
- OR `style_lock.status == conflict`(已 lock 但实际代码用了不同 style 的特征)

`hard_block_reasons[]` 必填。

### BLOCKED(exit 2)

任一前置 artifact 缺失:
- `chassis.status == missing` 且是 frontend phase
- `ui_review.status == missing` 且 `workflow_ui_review != false`
- `style_lock.status == missing` 且检测到 L3 skill 被 invoke 过
- QA handoff 声明 ready 但 baseline 文件不存在
- AppSec handoff 必需但缺 user_data_surfaces 清单

`hard_block_reasons[]` 必填。

## 3. 谁写

| 字段 | 写入者 |
|---|---|
| 整个 decision 文件 | `uiux-gsd-contract-validator` agent(由 release-guard hook 触发) |
| `gsd.*` | validator 读 `.planning/` |
| `config.*` | validator 读 `.uiux/config.json` + `.planning/config.json` |
| `style_lock.*` | validator 读 `.uiux/lock/style-lock.yaml` |
| `chassis.*` | validator 读 `.uiux/lock/chassis.yaml` + drift check |
| `ui_review.*` | validator 读 `.uiux/evidence/<tag>/gsd-ui-review.yaml`(由 sdk mirror 写入) |
| `qa_handoff.*` | validator 读 `.uiux/config.json.handoff.qa_visual_regression_required` + 探测 `.qa/evidence/<tag>/visual-baseline/` |
| `appsec_handoff.*` | validator 读 `.uiux/lock/surface-inventory.yaml`(若存在)+ config |

## 4. 与 GSD `gsd-ship` 的接口

`gsd-ship` 改造**只需要**:

```bash
uiux-sdk gate.ship "$RELEASE_TAG" --phase "$PHASE" --allow-conditional
echo "uiux decision: $?"
```

`gsd-ship` 不需要知道 `.uiux/` 内部细节,不需要 parse yaml,只需要看退出码。
