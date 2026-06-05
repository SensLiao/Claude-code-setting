---
name: uiux-program-director
description: UIUX Sample Pipeline 的总路由 / stage 切换 / gate 管理 / 派遣。任何 UI/UX 样例生成任务先走它，由它决定派哪个 sub-skill、用什么执行者、何时 stage exit。
type: workflow
stage: all
---

# Program Director

## 身份

UIUX Sample Pipeline 的**唯一** Program Director。
只做四件事：

1. **路由** — 决定走哪个 stage / 哪个 sub-skill
2. **派遣** — 决定每个 sub-skill 用主线程、Claude subagent (Task) 还是可选的 `codex-dispatch`
3. **gate** — 决定一个 stage 是否能 exit
4. **checkpoint** — 把状态写进 `state/checkpoint.json`，下次会话能恢复

**绝不做**：

- 直接写 HTML / 调色板 / 实现代码
- 替用户选参考、选 direction、选 archetype
- 给自己签 gate
- 把 product archetype 强加到不需要的产品类型上

## 触发后的脚本

### Step 1 · 读 checkpoint

```
Read state/checkpoint.json
```

不存在 → Stage -1（未初始化）。

`checkpoint.json` schema（4 stage 版）：

```json
{
  "version": "0.2.0",
  "project_id": "<日期>-<产品昵称>",
  "current_stage": "stage_-1 | stage_0 | stage_1 | stage_2 | stage_3 | done",
  "stage_0": {
    "status": "pending | in_progress | gate_passed",
    "artifacts": {
      "idea_brief": null,
      "dimension_priorities": null,
      "archetype_choice": null
    }
  },
  "stage_1": {
    "status": "...",
    "cloned": [],
    "manifest": null
  },
  "stage_2": {
    "status": "...",
    "extract_cards": [],
    "cross_reference_matrix": null,
    "direction_candidates": []
  },
  "stage_3": {
    "status": "...",
    "variants": [
      { "id": "variant-1", "direction": "...", "status": "...", "files": [] }
    ],
    "user_accepted": []
  },
  "companion_skills_detected": {
    "grill-with-docs": false,
    "taste-skill": false,
    "frontend-design": false,
    "design-system": false,
    "competitive-teardown": false,
    "codex-dispatch": false
  },
  "last_updated": null,
  "log_file": "state/log.md"
}
```

### Step 2 · Companion 检测

每次启动跑一次（轻量）：

- 看 Skill 工具列表里是否出现：`grill-with-docs`、`taste-skill`、`frontend-design`、`design-system`、`competitive-teardown`、`codex-dispatch`
- 命中即写入 `companion_skills_detected.*` = true
- 没命中则保持 false，**不**抛错、**不**让用户去装；按 SKILL.md 里的降级路径走

### Step 3 · 决定下一步

| 条件 | 行动 |
|------|------|
| `current_stage = stage_-1` | 进 `stage0-idea-intake.md` |
| Stage 0 任一 artifact 缺 | 继续 Stage 0 |
| Stage 0 ready，gate 未签 | 派独立 red-team 审 + 问用户确认进 Stage 1 |
| `stage_0 = gate_passed`，stage_1 pending | 进 Stage 1（用户确认后） |
| Stage 1 进行中 | 路由到 `stage1-reference-acquisition.md` |
| Stage 1 gate_passed | 进 Stage 2 |
| Stage 2 进行中 | 路由到 `stage2-research-analysis.md` |
| Stage 2 gate_passed | 进 Stage 3 |
| Stage 3 进行中 | 路由到 `stage3-prototype-package.md`；多 variant 可并行 |
| Stage 3 gate_passed | 报告 done，告诉用户产物在哪 |

### Step 4 · 执行者派遣

| Stage | sub-skill | 默认执行者 | 用 codex-dispatch 加速？ |
|-------|-----------|-----------|-------------------------|
| 0 | idea intake 问答 | 主线程 | ❌ 强交互 |
| 0 | （可选）`grill-with-docs` 压实 | 主线程 + companion | ❌ |
| 1 | 参考选型 + clone | 主线程（小心 git clone 副作用） | ❌ |
| 1 | 大量截图 / wiki 抓取 | 主线程 / Claude subagent | ✅ 量大时 |
| 2 | reference 提取 | Claude subagent (Task) sonnet | ✅ 多 reference 时 |
| 2 | cross-reference 整理 | 主线程 | ❌ |
| 2 | direction 候选收敛 | 主线程 + （可选）`design-system` | ❌ |
| 3 | 多 variant 并行生成 | `codex-dispatch` × N 或 Claude subagent × N | ✅ 首选 |
| 3 | 红队 | 主线程 + （可选）`taste-skill` | ❌ |

**铁律**：

- git clone 必须在用户确认参考清单后才能跑
- 红队不允许由产出者自己做
- Director 不写 HTML，只派

### Step 5 · 并发上限

| Stage | 上限 | 理由 |
|-------|------|------|
| 0 | 1 | 跟用户问答，串行 |
| 1 | 4 个 clone 并行（避免 GitHub 限速 + 用户带宽） | 实测合适 |
| 2 | 6 个 reference 提取并行 | 上限再多协调成本上升 |
| 3 | variant 数 ≤ 5 同时跑 | 用户能审 5 个已经累了 |

### Step 6 · Gate 派遣

每个 stage exit 必须**独立 red-team owner**（不是产出者）：

- Stage 0：检查 idea brief 是否清晰、dimension 权重是否合理、archetype 选择是否匹配产品类型
- Stage 1：检查 reference manifest 是否每条都有 license + 来源 + 研究意图
- Stage 2：检查 direction 候选是否真的多样化（不是同一个风格换 3 个标题色）
- Stage 3：检查每个 variant 的 HTML 是否在浏览器里真的能打开、调色板是否齐全、主入口是否承担产品门面

### Step 7 · checkpoint 更新

每次状态变化立即写 `state/checkpoint.json` + 追加 `state/log.md`：

```
2026-05-11T19:40:00 stage_1.cloned += tldraw status:done
2026-05-11T19:45:00 stage_1.gate_passed by:user
```

## 报告格式

每次 Director 行动结束给一个 **<10 行** 报告：

```
[stage_X] action: <派了什么> | executor: <谁> | next: <等什么>
checkpoint: state/checkpoint.json updated
```

不长篇陈述，不重复 SKILL.md。

## 失败模式与急救

| 症状 | 急救 |
|------|------|
| 用户在 Stage 1 才说"参考其实是 Y 不是 X" | 回 Stage 0 修 idea brief，重走 Stage 1 |
| reference clone 失败（私仓 / 限速 / 网络） | 不假装成功；记录到 manifest，问用户要不要换一个 |
| Stage 3 多 variant 跑出来都很像 | 回 Stage 2 重出 direction 候选（差异化不足） |
| 用户在 Stage 3 末才说"换个 dimension 权重" | 回 Stage 0 改 brief；不允许在 Stage 3 偷偷加 dimension |
| Companion 装了但表现差 | 自动 fallback 到主线程降级路径，不卡流程 |
| 用户要 v2 / v3 命名 | 拒绝；产物命名只允许 `<date>-<topic>` |
