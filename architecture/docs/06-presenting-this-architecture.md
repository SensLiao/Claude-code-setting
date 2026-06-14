# Presenting This Architecture on GitHub

这份文档给你一个 GitHub 展示策略：别人打开仓库时，应该如何理解这套架构。

## 1. 首页 README 的任务

README 不应该塞满所有细节。它只需要完成三件事：

1. **定位**：这是五主线 agentic delivery orchestration architecture。
2. **可信度**：不是 prompt-only，而是 hooks、evidence、deterministic gates、manual approvals。
3. **导航**：按角色把读者带到 docs 子文件。

## 2. 第一屏建议

第一屏结构：

```text
Title
One-sentence positioning
30-second architecture table
One Mermaid overview diagram
Why this exists
Navigation table
```

避免第一屏出现：

- 太多内部 implementation detail；
- 过长 ASCII 图；
- 大段没有标题的说明；
- 没有下一步阅读路径。

## 3. 文档分层

| 文件 | 目标 |
|---|---|
| `README.md` | 30 秒看懂 |
| `docs/00-overview.md` | 3 分钟看懂 |
| `docs/01-routing.md` | 明白 prompt 怎么路由 |
| `docs/02-orchestrators/*.md` | 分主线展开 |
| `docs/03-capability-matrix.md` | 展示测试、安全、offensive 能力边界 |
| `docs/04-governance-and-evidence.md` | 展示可信度来源 |
| `docs/05-security-boundaries.md` | 展示安全边界 |
| `data/*.yml` | 给工具或未来脚本读取 |
| `examples/evidence/*.yaml` | 给 reviewer 看产物形态 |

## 4. Reviewer 阅读路径

| Reviewer 类型 | 建议路径 |
|---|---|
| 工程负责人 | README → Overview → Governance |
| 产品/设计负责人 | README → UIUX → Capability Matrix |
| QA / Test engineer | README → QA → Evidence |
| Security engineer | README → AppSec → Security Boundaries → Evidence |
| 招聘/展示观众 | README → Overview → diagrams |
| 未来维护者 | README → data YAML → CONTRIBUTING |

## 5. Mermaid 图策略

建议在 README 只放 1-2 张图：

- `overview`：展示 5 主线和 4 层；
- `reading path`：展示读者应该怎么继续看。

详细图放进 `docs/`，同时把 `.mmd` 源文件放进 `diagrams/`，便于未来维护。

## 6. 命名策略

建议公开展示时使用外部可理解的名字：

| 内部名 | 对外展示名 |
|---|---|
| GSD | Delivery PM Orchestrator |
| UIUX | Product Experience Orchestrator |
| QA | Enterprise QA Orchestrator |
| AppSec | Application Security Orchestrator |
| Bootstrap | Environment Bootstrap Orchestrator |

## 7. 展示语气

建议强调：

- 架构边界清楚；
- 有 evidence 和 gate；
- 不把模型输出当最终裁决；
- offensive capability 有严格人工授权；
- 每条主线都有产物和 handoff。

不建议强调：

- “全自动攻击”；
- “模型能替代安全团队”；
- “所有任务都能自动完成”；
- 没有证据的能力宣称。

## 8. 最小可发布版本

如果你只想先公开最小版本，保留这些文件即可：

```text
README.md
docs/00-overview.md
docs/01-routing.md
docs/02-orchestrators/appsec.md
docs/03-capability-matrix.md
docs/04-governance-and-evidence.md
diagrams/overview.mmd
data/orchestrators.yml
```
