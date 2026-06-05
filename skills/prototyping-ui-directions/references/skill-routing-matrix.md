# Skill Routing Matrix

> 完整的 sub-skill × stage × 执行者 × companion 路由表。`program-director.md` Step 3-4 的扩展版。

## 主流程路由

| Stage | sub-skill / 任务 | 默认执行者 | Companion 增强 | 并发上限 |
|-------|------------------|-----------|----------------|----------|
| 0 | `stage0-idea-intake.md` 问答 | 主线程 | `grill-with-docs`（压实） | 1 |
| 0 | `surface-architecture.md` 出 surface 列表 | 主线程 | — | 1 |
| 0 | Gate 0 red-team | 主线程独立 owner（**不是产出者**） | `taste-skill`（如果装了） | 1 |
| 1 | `stage1-reference-acquisition.md` 选型 | 主线程 | `competitive-teardown` | 1 |
| 1 | `reference-intelligence.md` 跑 clone / 截图 | 主线程 / Claude subagent | `codex-dispatch`（量大时） | 4 |
| 1 | manifest 写入 | 主线程 | — | 1 |
| 1 | Gate 1 red-team | 独立 owner | — | 1 |
| 2 | `reference-intelligence.md` 提取卡 | Claude subagent (Task) sonnet × N | `codex-dispatch` | 6 |
| 2 | cross-reference matrix | 主线程 | `competitive-teardown` | 1 |
| 2 | `design-direction.md` direction 候选 | 主线程 | `design-system` | 1 |
| 2 | Gate 2 red-team | 独立 owner — 看差异化是否够 | `taste-skill` | 1 |
| 3 | 多 variant 生成 | `codex-dispatch` × variant（首选） / Claude subagent × variant | `frontend-design` | 5 |
| 3 | palette.json + palette.html | 同上 | — | 跟随 variant |
| 3 | 红队 | 独立 owner | `taste-skill`（强推） | 1 |
| 3 | Gate 3 red-team | 独立 owner | `taste-skill` | 1 |

## Companion 角色锁死

| Companion | 永远做什么 | 永远不做什么 |
|-----------|-----------|--------------|
| `grill-with-docs` | Stage 0 压实模糊点 | 拍主决策 |
| `taste-skill` | Stage 0/2/3 红队 + anti-slop 守门 | 当风格制作器 / 写 spec / 当主设计师 |
| `frontend-design` | Stage 3 写 variant HTML | Stage 0/1 拍方向 |
| `design-system` | Stage 2 调色板 / typography 候选输入 | 直接覆盖最终 token、当主设计师 |
| `competitive-teardown` | Stage 1 reference 选型 / Stage 2 cross-ref | 拍最终 direction |
| `codex-dispatch` | Stage 1 大量 acquisition / Stage 2 提取 / Stage 3 variant 加速 | 做决策性工作 |

## 三类禁令

1. **审查 companion 不许偷偷设计**（taste-skill / design-system 只能给意见 / 候选输入，不能产出 variant 当成主设计）
2. **产出者不许审自己**（Stage 1/2/3 gate 必须独立 red-team owner）
3. **Program Director 不许当产出者**（只做路由、派遣、gate、checkpoint）

## 执行者降级路径

| 情况 | 降级到 |
|------|--------|
| `codex-dispatch` 额度用完 | Claude subagent (Task) sonnet × N |
| Claude subagent 也跑不动（context 太满） | 串行（用 1 个 subagent 跑完一个 variant 再跑下一个） |
| 没装 `taste-skill` | 主线程按 `references/anti-patterns.md` 自审，明确告诉用户"未经独立红队" |
| 没装 `frontend-design` | 主线程写基础 HTML，并在 readme 注明"未经 frontend-design 润色" |
| 网络不可用（无法 clone） | 提前在 Stage 1 报告，让用户改路径 |

## 下游 Handoff（Stage 3 done → 进入生产 pipeline）

本 skill 在 Stage 3 出 review-ready prototype packages 后**就停**。如果用户选定某个 variant 要走到生产 / 上线，按下表 handoff 到对应的生产型 skill。本 skill 不替用户做这一步——只在 `prototypes/comparison-report.md` 末尾提示候选下游 skill。

| 用户选定的 variant 类型 | 推荐下游 skill | 衔接点 |
|------------------------|----------------|--------|
| **editorial-luxury / 高端品牌单页 / 杂志感 / 100dvh hero video** | `luxury-editorial-site-builder` | 1. Stage 3 选定 variant 的 `index.html` + `token-candidates.css` 直接喂给 luxury 的 **Phase 1 skeleton**（占位品牌已经替你跑通），可**跳过 luxury 的 Phase 0 alignment + Phase 1 骨架**<br>2. 从 luxury **Phase 2 真实内容迁移**开始走（fill-in MD 模板）<br>3. 后续 Phase 3-8（AI 图 / AI 视频 / Topaz 4K / crossfade / Vercel deploy）按 luxury 原流程 |
| dashboard / 数据密集型 | （待收录）`dashboard-production-skill` | 暂无；交给用户自己工程流程 |
| landing / marketing 滚动叙事 | （待收录）`landing-scrolly-skill` | 暂无；交给用户自己工程流程 |
| 节点编辑器 / canvas | （待收录）`canvas-production-skill` | 暂无；本 skill 的 canvas archetype 已经覆盖 prototype 阶段；后续运行时层（React Flow / Pixi / 自研）交给用户 |

### 衔接铁律

1. **prototyping-ui-directions 永远不调用** luxury（或任何下游 skill），只在 comparison-report 末尾 **提示**：「本 variant 风格匹配 `luxury-editorial-site-builder`，继续上线请触发该 skill」
2. **下游 skill 收到 variant 不能反推回探索阶段**——variant 是已经签字的方向锚，luxury 的 Phase 0 可直接跳过
3. **token / palette 不允许在 handoff 时被重做**——下游接的是 `token-candidates.css` 的完整 token，luxury 的 Phase 7 design system 收敛只是清理，不允许重新选色
4. **handoff 不是自动**——必须用户明确说「我选 variant-N，开始上线」才触发下游 skill
