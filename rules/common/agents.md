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
>
> **Skill → Agent + Model 映射表** / **Audit 模型升级规则** / **多 agent 协作模式**（UI/UX 特定）已于 2026-07-29 迁入
> [`skills/uiux-product-orchestrator/references/uiux-routing-table.md`](../../skills/uiux-product-orchestrator/references/uiux-routing-table.md) §Agent + Model 路由 ——
> 它们只在真跑 UI 时用得上，随 orchestrator 按需加载，不再常驻每个 session。
