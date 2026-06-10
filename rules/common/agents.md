# Agent Orchestration

> Updated 2026-06-02 v4: 移除 frontend-pipeline；L3 风格收敛为 taste/luxury/brutalist-skill；UI/UX 编排统一走 uiux-product-orchestrator。

## Available Agents

Located in `~/.claude/agents/`:

| Agent | Model | Purpose | When to Use |
|-------|-------|---------|-------------|
| planner | opus | Implementation planning | Complex features, refactoring |
| architect | opus | System design | Architectural decisions |
| tdd-guide | sonnet | Test-driven development | New features, bug fixes |
| code-reviewer | sonnet | Code review | After writing code |
| security-reviewer | opus | Security analysis | Before commits |
| build-error-resolver | sonnet | Fix build errors | When build fails |
| e2e-runner | sonnet | E2E testing | Critical user flows |
| refactor-cleaner | sonnet | Dead code cleanup | Code maintenance |
| doc-updater | haiku | Documentation | Updating docs |
| rust-reviewer | sonnet | Rust code review | Rust projects |

## Agent 模型路由

Agent 调用时通过 `model` 参数指定模型，遵循模型路由策略（见 `performance.md`）：

- **Opus**：planner、architect、security-reviewer — 决策层，错了代价大
- **Sonnet**：tdd-guide、code-reviewer、build-error-resolver、e2e-runner、refactor-cleaner、rust-reviewer — 执行层，日常主力
- **Haiku**：doc-updater — 工具层，结构化输出

如果 Sonnet 层的 agent 多轮尝试仍不稳定，可临时升级到 Opus。反之，如果任务明确简单（如单文件小修复），Sonnet 层的 agent 也可降级到 Haiku。

## Immediate Agent Usage

No user prompt needed:
1. Complex feature requests - Use **planner** agent
2. Code just written/modified - Use **code-reviewer** agent
3. Bug fix or new feature - Use **tdd-guide** agent
4. Architectural decision - Use **architect** agent

## Parallel Task Execution

ALWAYS use parallel Task execution for independent operations:

```markdown
# GOOD: Parallel execution
Launch 3 agents in parallel:
1. Agent 1: Security analysis of auth module
2. Agent 2: Performance review of cache system
3. Agent 3: Type checking of utilities

# BAD: Sequential when unnecessary
First agent 1, then agent 2, then agent 3
```

## Multi-Perspective Analysis

For complex problems, use split role sub-agents:
- Factual reviewer
- Senior engineer
- Security expert
- Consistency reviewer
- Redundancy checker

---

> UI/UX 多阶段编排：见 `uiux-product-orchestrator`（auto 主线，SKILL.md §2.0 Entry-Situation Router 做入口分流 + L0-L8 routing-table）。

---

## UI/UX Skill ↔ Agent 路由（更新 2026-06-02 v4）

> 配合 CLAUDE.md 的 "前端 UI/UX 工作流 v2"，下表列出每层 skill 适合哪个 agent + model 触发。
> 完整 skill 列表见 `~/.claude/SKILLS-INDEX.md`。

### Skill → Agent + Model 映射表

| Layer | Skill | Agent | Model | 触发理由 |
|---|---|---|---|---|
| L0 Foundation | `ux-principles` (MODE A pre) | planner | opus | UX 决策错了代价大 |
| L0 Foundation | `ux-principles` (MODE B mid) | （inline, no agent） | sonnet | 战术查表，无需 agent |
| L0 Foundation | `ux-principles` (MODE C audit) | code-reviewer / security-reviewer | opus | 最终质量审查 |
| L1 Discovery | `grill-with-docs` / `competitive-teardown` | planner | opus | 需求澄清是上游决策 |
| L2 Exploration | `prototyping-ui-directions` Stage 0-1 | planner | opus | 方向决策 |
| L2 Exploration | `prototyping-ui-directions` Stage 2-3 | （inline） | sonnet | 出 variant 是执行 |
| L2 Exploration | `imagegen-frontend-web` | （inline） | sonnet | 图片生成执行 |
| L3 Style Lock | `taste-skill` / `luxury` / `brutalist-skill` | （inline） | sonnet | 三档 L3 风格（互斥，taste 含 Editorial Monochrome/Double-Bezel Agency/GSAP 三变体） |
| L6 Refinement | `redesign-skill` | code-reviewer | sonnet | 现有 UI 升级 workflow（不是 L3 风格） |
| L2.5 Source Import | `image-to-code-skill` | （inline） | sonnet | 截图/参考图/DESIGN.md 导入 → 代码（不是 L3 风格） |
| L4 Production | `anchor-prototype-wave` | planner + parallel general-purpose × N | opus 主 + sonnet 执行 | 多 surface 并行铺 |
| L4 Production | `bencium-innovative-ux-designer` | （inline） | sonnet | 创意执行 |
| L4 Production | `interface-design@interface-design` | （inline） | sonnet | session 持久化执行 |
| L4 Production | `frontend-design@claude-plugins-official` | （inline） | sonnet | Anthropic 官方执行 |
| L5 Platform | `vercel:nextjs` / `:react-best-practices` / `:shadcn` / `:turbopack` | code-reviewer | sonnet | React 最佳实践审 |
| L6 Refinement | `ux-principles` (MODE B mid) | （inline） | sonnet | 局部修补/视觉审改场景（战术查表） |
| L6 Refinement | `visual-critique@designer-skills` | code-reviewer | opus | 完整 audit，需高质量 |
| L6 Refinement | `design-audit@bencium` | code-reviewer | opus | 分阶段 fix plan，是设计决策 |
| L6 Refinement | `gsd-ui-review` | gsd-ui-auditor agent | opus | 6-pillar 视觉审计 |
| L8 Assets | `brandkit` / `theme-factory` / `canvas-design` | （inline） | sonnet | 资产生成执行 |
| L10 Brand Landing | `luxury-editorial-site-builder` | planner（page architecture）+ （inline 实施） | opus + sonnet | 单页架构是决策 |
| L11 Meta | `emil-design-eng` | code-reviewer（动画审）| sonnet | 动画细节审 |
| L11 Meta | `skill-creator` | （inline） | sonnet | 元开发执行 |
| L11 Meta | `output-skill` | （always enforced） | n/a | 强制完整输出 |

### UI/UX Audit 模型升级规则

如果 UI/UX audit 涉及以下情况，**升级到 opus**：
- 客户可见 / 对外发布前的最终审查
- 跨 4+ surface 的一致性审查
- 无障碍 / WCAG 合规审查
- 跨多 viewport / 多 theme 的回归审查
- 设计决策成本高（重新设计 > 2 工时）

简单单 surface 审查留在 sonnet。

### 多 agent 协作模式（UI/UX 特定）

| 场景 | 编排 |
|---|---|
| 多 variant 探索 | parallel general-purpose × N（每个 variant 一个 agent，同 prompt 不同 style）|
| 全 surface 量产 | anchor-prototype-wave 内置 parallel subagent × 4-15 |
| 跨 AI 设计 review（santa-loop） | 2 个 reviewer（Claude Opus + Codex via `/codex:adversarial-review`）双盲；Codex 额度耗尽 → fallback 到第二个 Claude subagent |
| 设计 audit + fix 一站式 | 1 code-reviewer (opus audit) → 1 general-purpose (sonnet fix) → 1 code-reviewer (opus verify) |
