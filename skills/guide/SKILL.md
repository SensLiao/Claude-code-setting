---
name: guide
description: >-
  Top-level user guide for THIS Claude Code config — what survives after the orchestrator removal (tool-grade skills, generic agents, the evidence kit), how to install, update and maintain the global config, and where the full skill index lives. Triggers: "guide / help / cheat sheet / how do I use this config / how to start on a project / 指南 / 帮助 / 怎么用 / 这套配置怎么用".
allowed-tools:
  - Read
---

<objective>
Output the reference block below VERBATIM. Do NOT add project-specific analysis, git status,
file context, or next-step suggestions — this is a static help screen.
</objective>

<reference>
# Claude Code Config — User Guide

自 2026-08-25 起本配置**没有编排主线**(GSD / I2R / QA / AppSec / L12 / UIUX 编排层已全量退场,
整体快照在 tag `pre-orchestrator-removal`)。现在的形态:**工具型 skill + 通用 agent**,
一切以你显式调用为主。宪法级规则(沟通语言 / 汇报方式 / 预览卡 / 账本 / 硬规则)在 `CLAUDE.md`。

## 1. 三类资产

| 资产 | 是什么 | 入口 |
|---|---|---|
| 工具型 skills(~31) | UIUX 簇(风格 / 生成 / 审查 / 组件)、arch-viz、codegraph-cli、codex-dispatch、skill-creator、workflow-creator 等 | `/skill名` 显式调;完整清单 `SKILLS-INDEX.md` |
| 通用 agents(~42) | planner / architect / 各语言 reviewer + build-resolver / tdd-guide / e2e-runner / security-reviewer / uiux 两件 | 描述任务即可被派;model 路由见 `rules/common/performance.md` |

## 2. 日常用法

- **做 UI**:先过 `ux-principles`;要整体风格就点名一个 L3 风格 skill(taste / luxury / brutalist,一次一个);
  截图还原用 `image-to-code-skill`;发布前审查派 `uiux-design-reviewer` agent。
- **读代码 / 架构**:`arch-viz`(出架构图)、`codegraph-cli`(调用链 / 影响面)。
- **规划**:轻量跨 session 规划用 `/lite-plan` → `/lite-execute`,进度账本用 `/ledger`,session 收尾用 `/preclear`。
- **测试**:`tdd-guide` 写测试、`e2e-runner` 跑关键旅程;风险分层表在 `rules/testing-policy.md`。
- **安全 review**:改到 auth / API / server 路径会触发 path-scoped 规则;派 `security-reviewer` agent。
  本机没有任何主动安全测试工具(红线见 `rules/security-appsec.md`)。
- **跨模型**:`codex-dispatch` skill + `/codex:review`。

## 3. 安装 / 更新本配置

唯一安装器是仓库根的 `claude-config.js`(Node + git):

```bash
node claude-config.js status            # 只读体检
node claude-config.js install --apply   # 首装(增量,不覆盖已有)
node claude-config.js update --apply    # 同步到仓库最新(覆盖 + 清 orphan + 写 skillOverrides)
```

不加 `--apply` 全是 dry-run。细节(orphan 清理范围 / custom_files 保护 / hook 接线 / 回滚)见仓库 `README.md`。

## 4. 回滚

- 任意文件按 commit 粒度回滚(GitHub `SensLiao/Claude-code-setting`)。
- 想回到 orchestrator 时代:`git checkout pre-orchestrator-removal && node claude-config.js update --apply --no-clean`。
</reference>
