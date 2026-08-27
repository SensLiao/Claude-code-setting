# Claude-code-setting — 本仓维护规则

> 这是**这个仓库自己**的 project instructions，只在本仓工作时注入。
> 通用行为规则（沟通语言 / 汇报方式 / 预览卡 / 账本 / 硬规则 / 三主线路由 / 执行纪律 / L12）不在这里，在 `CLAUDE.global.md`。

---

## 1. 两份 CLAUDE.md 的分工（先读这条）

| 文件 | 身份 | 谁读到 |
|---|---|---|
| `CLAUDE.md`（本文件） | 本仓的维护契约 | 只在本仓工作时，作为 project instructions 注入 |
| `CLAUDE.global.md` | 全局行为规则（含 orchestrator 路由） | 由 installer 部署为 `~/.claude/CLAUDE.md`，**任何项目**都读到 |

**改规则前先分清改的是哪一份**：与"在任意项目里怎么干活"有关的 → `CLAUDE.global.md`；与"怎么维护这套配置"有关的 → 本文件。

机制上靠 `claude-config.js` 的两处支撑，改 installer 时别碰坏：

- `SKIP` 含 `'CLAUDE.md'` —— 本文件**永不**部署，否则会覆盖全局那份。
- `RENAME` 把 `CLAUDE.global.md` 映射成部署路径 `CLAUDE.md`；`expectedBytes()` / `deployFile()` 用 `srcOf()` 反查真实源文件名。

---

## 2. 这个仓库是什么

`~/.claude` 的源。仓库里的 managed 目录（`agents/` `commands/` `skills/` `hooks/` `scripts/` `rules/` `docs/` `manifests/` `schemas/` `templates/` `orchestrator-runtime/` `get-shit-done/` `tools/` 等）整体同步过去；`settings.json` / `memory/` / `projects/` / `sessions/` 等属于用户本机，installer 从不写也从不删（`PRESERVE`）。

- 安装：`node claude-config.js install --apply`（首次，增量）
- 更新：`node claude-config.js update --apply --no-clean`（强制同步）
- 对账：`node claude-config.js status`
- 测试：`npm run test:harness`

**~/.claude 里有、仓库里没有的文件不在 GitHub 回滚通道内**——本机独有的东西改动前自己留份。

---

## 3. 应急回滚

- **首选**：GitHub 同步仓库 `SensLiao/Claude-code-setting`（private）按 commit 粒度回滚任意文件；staging 在 `~/claude-config-upload`。
- 本地兜底：`~/.claude/backups/`（按日期目录）+ `settings.json.known-good-*.bak`。
- settings.json 治理键：`node ~/.claude/tools/ccswitch-guard/ccswitch-guard.js --check`（对账）/ `--capture`（重打快照）。`--restore` 会整体覆盖治理键——**先 `--check` 确认快照新鲜再用**。
