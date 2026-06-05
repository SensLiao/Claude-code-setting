# GSD / QA / AppSec Handoff Protocol

> SKILL.md §7 reference。UIUX gate 完成后,如何把结论交给下游。

## 1. → `enterprise-qa-testing`(visual regression)

### Handoff 字段

```yaml
qa_handoff:
  visual_regression_required: true | false
  baseline_path: .qa/evidence/<tag>/visual-baseline/
  baseline_ready: true | false
  handoff_status: not_required | pending | ready | failed
```

### 触发逻辑

| 条件 | `visual_regression_required` |
|---|---|
| `.uiux/config.json.handoff.qa_visual_regression_required == true` | true |
| frontend phase 且 chassis.locked 且 surface_coverage.designed > 0 | true |
| 否则 | false |

### Baseline 就绪标准

`baseline_ready == true` 当且仅当:
1. `.qa/evidence/<release-tag>/visual-baseline/` 目录存在
2. 目录内有 ≥ 1 个 `.png` / `.jpg` baseline
3. 有 `baseline-approval.yaml` 含 approver + 日期 + scope

validator 物理校验文件存在,**不接受口头声明**。

### 失败 → BLOCKED

`visual_regression_required == true` AND `baseline_ready == false` → `uiux_release_decision == BLOCKED`,
`hard_block_reasons` 含 `"qa_handoff_baseline_not_ready"`。

QA 侧消费:`qa-evidence-validator` 在 §6 Step 7 校 `qa_handoff.baseline_ready`。

---

## 2. → `appsec-security-orchestrator`(frontend security review)

### Handoff 字段

```yaml
appsec_handoff:
  frontend_review_required: true | false
  user_data_surfaces:
    - id: auth-login
      surface_type: auth
      route: /login
      data_classes: [credentials, session]
    - id: settings-profile
      surface_type: settings
      route: /settings/profile
      data_classes: [PII, email]
  handoff_status: not_required | pending | ready
```

### 触发逻辑

`frontend_review_required == true` 当任一成立:
- `.uiux/config.json.handoff.appsec_frontend_review_required == true`
- `.uiux/lock/surface-inventory.yaml` 含 surface_type ∈ {auth, settings, onboarding, payment, admin}
- chassis 含 form-related component primitives(`<Input>` / `<Form>` / `<PasswordInput>` 等)

### user_data_surfaces 提取

validator 从 `surface-inventory.yaml` 提取所有满足 surface_type 黑名单的 surface,写入清单。
如果 `surface-inventory.yaml` 不存在但 `frontend_review_required == true` → BLOCKED with reason
`"surface-inventory.yaml required when appsec frontend review required"`。

### AppSec 侧消费

AppSec orchestrator 读 `.uiux/decisions/<tag>/uiux_release_decision.yaml.appsec_handoff.user_data_surfaces`,
决定 frontend code review 的范围(只 review 列出的 surface 对应的代码路径)。

---

## 3. → `gsd-ship` / `gsd-verify-work`(release decision)

### Handoff 接口

`gsd-ship` 改造**只需**:

```bash
uiux-sdk gate.ship "$RELEASE_TAG" --phase "$PHASE" --allow-conditional
case $? in
  0) ;;  # PASS or CONDITIONAL_PASS-with-flag
  3) require_manual_approval ;;  # CONDITIONAL_PASS without flag
  *) echo "UIUX gate failed: see .uiux/decisions/$RELEASE_TAG/uiux_release_decision.yaml"; exit 1 ;;
esac
```

`gsd-ship` 不需要读 YAML 内容,只看退出码。详情在 `uiux_release_decision.yaml` 里。

### `gsd-verify-work` 接口

verify 阶段读 `.uiux/decisions/<tag>/uiux_release_decision.yaml` 并 inline 到 VERIFICATION.md 的
"UI Contract" 节:

```markdown
## UI Contract

- Style: locked → luxury
- Chassis: locked,no drift
- UI Review: PASS(scores: 4/3/4/3/4/3)
- QA visual regression baseline: ready at .qa/evidence/v0.1.0/visual-baseline/
- AppSec frontend review: not required
- Decision: PASS

Source: `.uiux/decisions/v0.1.0/uiux_release_decision.yaml`
```

---

## 4. → `discoverability-orchestrator`(L12,可选)

### Handoff 字段(若启用 L12)

```yaml
discoverability_handoff:
  surface_inventory_path: .uiux/lock/surface-inventory.yaml
  public_surfaces: [<surface ids that are public-web>]
```

L12 orchestrator 读 surface inventory 决定 SEO / AEO 范围。

---

## 5. Handoff 完整性 invariants

validator 在写 decision 前必须满足:

1. 凡是声明 `*_handoff.*_ready == true` 的字段,对应文件/目录必须实际存在
2. 凡是声明 `*_handoff.*_required == true` 但 `*_ready == false` 的 → 写入 `hard_block_reasons[]`,decision 至少是 BLOCKED
3. 凡是 `handoff_status == failed` → decision 至少是 FAIL

**绝不允许**:
- 写"已就绪"但下游探测不到对应 artifact
- 跳过 handoff 检查直接 PASS
- 不写 `hard_block_reasons` 但 decision != PASS
