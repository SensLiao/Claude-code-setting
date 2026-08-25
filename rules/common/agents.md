# Agent Orchestration

> Updated 2026-08-25: orchestrator 全量退场；本文件只覆盖通用 agents 与调度纪律。

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

能并行必须并行（单 message 发多个 Agent / Bash / Read call）；有依赖、写冲突或资源争抢必须串行；判断模糊选串行。

> 完整判断规则 + 6 行场景对照表见 `CLAUDE.md` §4.5 第 1 条（Parallel-vs-Serial 调度纪律）—— 不在此重复。

## Multi-Perspective Analysis

For complex problems, use split role sub-agents:
- Factual reviewer
- Senior engineer
- Security expert
- Consistency reviewer
- Redundancy checker

---

> UI/UX 专项 agent：`uiux-design-reviewer`（发布前设计审，read-only 打分）与 `uiux-surface-builder`（锁定 chassis 后多 surface 并行量产）——直接用 Agent tool 派发，model 按 §模型路由。
