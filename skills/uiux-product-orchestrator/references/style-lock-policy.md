# Style Lock Policy

> SKILL.md §4 reference。`.uiux/lock/style-lock.yaml` 的写入 / 互斥 / unlock 规则。

## 1. Schema

```yaml
schema_version: 1.0
locked_at: <ISO8601>
locked_by: "uiux-sdk@2.1.0" | "uiux-gsd-contract-validator@<git_sha>"
release_tag: <tag>

l3_style: taste | luxury | minimalist | soft | brutalist | gpt-tasteskill
l3_style_skill_id: <exact skill name>   # 例 luxury-editorial-site-builder

rationale: |
  <≤ 200 chars,user-confirmed reason for picking this style>

mode_a_evidence_path: .uiux/evidence/<tag>/01-mode-a-pre.yaml   # nullable
exploration_evidence_path: .uiux/evidence/<tag>/02-exploration.yaml   # nullable

excluded_alternatives: [luxury, brutalist]   # 反问协议中被排除的
locked_until_release: <next-release-tag> | "permanent"
```

## 2. 允许的 L3 候选(全局)

| skill | 触发方式 | 用途 |
|---|---|---|
| `taste-skill` | auto / manual | 默认通用 premium craft |
| `luxury` | auto / manual | 暗色编辑 / fashion |
| `luxury-editorial-site-builder` | auto(brand landing) | luxury 的 brand landing 专用 variant |
| `minimalist-skill` | auto / manual | SaaS / 产品 UI |
| `soft-skill` | auto / manual | 浅色高级感 |
| `brutalist-skill` | **manual-only** | Swiss / 数据密集 |
| `gpt-tasteskill` | **manual-only** | 高动效 GSAP |

`luxury` 和 `luxury-editorial-site-builder` 在同一 release_tag 内视为**互相兼容**(同一 family);
但不能再混入 `taste-skill` / `minimalist-skill` / `soft-skill`。

## 3. 项目级白名单

`.uiux/config.json.allowed_l3_styles` 是项目级过滤:

```json
{ "allowed_l3_styles": ["taste", "luxury", "minimalist", "soft"] }
```

- 全局允许 ≠ 本项目允许
- `brutalist` 和 `gpt-tasteskill` 即使全局是 manual-only,本项目 config 不列也拒
- 空 array `[]` = 不限制(等同列全部)

## 4. Mutex 规则

| 当前 lock 状态 | 新 invoke 的 style | 行为 |
|---|---|---|
| 无 lock | 任一允许的 L3 | 写 lock,放行 |
| lock=`luxury` | `luxury` 或 `luxury-editorial-site-builder` | 放行(同 family) |
| lock=`luxury` | `taste-skill` | **拒**,exit 2 |
| lock=`taste` | `taste-skill` | 放行 |
| 任何 lock | 同一 L3 重复 invoke | 放行 |

**Workflow skill semantics**(澄清——分两层 enforcement):

| 情况 | SDK `lock.style` | Hook `style-mutex-guard` |
|---|---|---|
| 试图把 workflow skill 当 L3 锁定(`lock.style v0.1.0 redesign-skill`) | **永远拒**,exit 2 | n/a |
| `Skill(redesign-skill)` invoke,无 L3 lock | n/a | **拒**(Case 1):workflow skill 需要先有 style 才能套用 |
| `Skill(redesign-skill)` invoke,已有 L3 lock | n/a | 放行(legitimate workflow on top of locked style) |
| `Skill(anchor-prototype-wave)` invoke,已有 L3 lock | n/a | 放行(production workflow,需要已锁的 style 才能 fan-out) |

**关键**:workflow skill 永远**不能作为 L3 style 本身**(SDK 拒),但 workflow skill 可以在 L3 lock 之后作为合法 production workflow 被 invoke(hook 放行)。

## 5. Workflow Blacklist(永远不能作为 L3)

| skill | 为什么不是 L3 |
|---|---|
| `redesign-skill` | workflow:已有 UI → 升级,不是风格 |
| `image-to-code-skill` | workflow:截图 → 代码,不是风格 |
| `stitch-skill` | workflow:DESIGN.md → 代码,不是风格 |
| `frontend-design-pro` | workflow:11 风格采样 |
| `frontend-design@official` | workflow:production React 默认入口 |
| `frontend-pipeline` | workflow:17-Route 总编排 |
| `anchor-prototype-wave` | workflow:多 surface 量产 |
| `sens-frontend-design` | workflow:3-stage 提案 |

## 6. Unlock / Relock 流程

合法场景:用户明确决定整页 redesign / 品牌方向变更。

流程:
1. 用户 explicit prompt:"unlock style for redesign" 或类似(provenance check)
2. 调 `uiux-sdk lock.style <tag> <new-style> --force --reason "<≥ 30 chars>"`
3. sdk 写 `.uiux/design-debt.yaml`(签字 record)
4. 旧 lock 移到 `.uiux/lock/.history/<timestamp>-style-lock.yaml`
5. 新 lock 生效

无 `--force` + `--reason` 的 unlock 调用 → exit 2。

## 7. Provenance Check

`uiux-style-mutex-guard.js` hook 会做 provenance check:

| 触发源 | 处理 |
|---|---|
| User message 含 explicit skill name(`/luxury` / "use the luxury skill") | 放行 |
| User message 含 unlock 意图("redesign with brutalist" + 已 lock taste) | 放行(同时启动 unlock 流程) |
| 模型 auto-invoke 但无 user explicit | **拒**(避免模型自作主张换风格) |
| GSD pipeline orchestrator 在合规 dispatch 中触发 | 放行(需 `# uiux-allow:gsd-pipeline-dispatch` marker) |
