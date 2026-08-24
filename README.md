# Claude Code Harness — Configuration & Architecture

> 精简形态（2026-08-25 起）：**工具型 skills + 通用 agents + evidence kit + 沟通/执行纪律**。编排主线（GSD / I2R / QA / AppSec / L12 / UIUX 编排层）已全量退场，整体快照在 tag `pre-orchestrator-removal`。`context loading != enforcement`。

---

## 🚀 安装 / 更新

本仓库**只有一个安装器**：根目录的 `claude-config.js`。它把仓库内容部署到全局 `~/.claude/`，跨平台（Windows / macOS / Linux），只依赖 **Node + git** —— 不需要 PowerShell、不需要 bash 脚本。（为什么只留一个：见下方[「只有一个安装器，是刻意的」](#只有一个安装器是刻意的)。）

### 环境要求

| 依赖 | 用途 |
|---|---|
| Node.js 18+ LTS | 跑 `claude-config.js`，以及绝大多数 hook（脚本本身只用到 Node 14+ 语法） |
| git | 版本 pin、`--pull` 自更新、回滚 |

### 首次安装（新机器）

```bash
git clone https://github.com/SensLiao/Claude-code-setting.git ~/.claude-config
cd ~/.claude-config

node claude-config.js status            # 1. 只读体检：先看清楚会发生什么
node claude-config.js install --apply   # 2. 真正部署
```

> **所有命令默认 DRY RUN。** 不加 `--apply` 就只打印计划、一个字节都不写。养成先跑一遍不带 `--apply` 的习惯。

`install` 是**增量**的：目标已存在的文件一律跳过，只补缺失的。所以首装安全，重复跑也安全。在真实终端（TTY）里跑还会顺带交互式询问要不要接 hook。

装完启动一次 Claude Code，让它生成 / 更新你自己的 `settings.json`（含 OAuth 登录）。

### 日常更新（已装过的机器）

```bash
cd ~/.claude-config
node claude-config.js update --pull                      # dry-run：拉最新 + 打印将要做的改动
node claude-config.js update --apply --pull --no-clean   # 执行
```

`update` 与 `install` 的区别务必分清：

| 命令 | 目标已存在的文件 | 仓库里没有、本机独有的文件（orphan） |
|---|---|---|
| `install --apply` | **跳过**，不覆盖 | 保留 |
| `update --apply` | **强制覆盖** | **默认删除** ⚠️ |
| `update --apply --no-clean` | **强制覆盖** | 保留 |

⚠️ **`update` 默认会删 orphan。** orphan = "managed 目录下、当前仓库里已经没有的文件"。如果你往 `~/.claude/tools/`、`~/.claude/skills/`、`~/.claude/mcp-servers/` 里放过本机独有的东西（自己写的工具、MCP server 的编译产物、本地 skill），**先跑 dry-run 看清 ORPHAN 列表**，要保留就加 `--no-clean`。

orphan 清理只在这些 **managed 目录**内发生：

```
agents  commands  skills  hooks  scripts  rules  docs  manifests
schemas  templates  orchestrator-runtime  get-shit-done  workflows
mcp-servers  mcp-configs  tools
```

（注意：**覆盖**作用于全部被部署的文件，**删除**只作用于上面这些目录。）

### skillOverrides 可见性策略（不是可选项）

`install` / `update` 在部署文件的同时都会写入 `settings.json` 的 `skillOverrides` 可见性策略（内部的 `doSkills()`，additive-merge + 自动备份）。只复制 skill 文件而不写 `skillOverrides`，清单就停在平台默认——每个 skill 都来抢描述预算，平台再按"调用最少优先丢"**静默**砍掉一批。本库实测：173 条里 112 条被砍成裸名，其中包括本应自触发的 skill。所以那不是"少装了一样"，而是**装错了**。策略源在 [`manifests/skill-overrides.recommended.json`](manifests/skill-overrides.recommended.json)，漂移由 `tests/harness/skill-visibility-drift.test.js` 守；单独跑：`node claude-config.js skills [--apply]`。

### 命令全表

| 命令 | 作用 |
|---|---|
| `status` | 只读体检：版本 pin、仓库 HEAD、`SAME` / `STALE` / `MISSING` / `ORPHAN` 计数、`settings.json` hook 断链数、profile 漂移 |
| `install [--apply]` | 增量部署（已存在即跳过）+ 写 skillOverrides + 交互式询问 hook 接线 |
| `update [--apply]` | 强制同步 + 写 skillOverrides + 清 orphan + 重打 pin |
| `wire [--apply]` | 把 hook 接进 `settings.json`（幂等、只增不删） |
| `export-profile [name] [--apply]` | 把当前 hook 接线导出成 `profiles/<name>.json`，之后 `status` 会报漂移 |

| Flag | 作用 |
|---|---|
| `--apply` | 真正写入（**不加就是 dry run**） |
| `--no-clean` | `update` 时保留 orphan，不删 |
| `--pull` | `update` 前先 `git fetch` + autostash + `pull --ff-only` |
| `--target DIR` | 换部署目标（默认 `<home>/.claude`） |
| `--wire` / `--no-wire` | 非交互地强制 / 跳过 hook 接线 |
| `--hooks=A,B` | 只接指定批次（隐含 `--wire`；默认全部） |
| `--yes` | 接受默认值，不提问 |

`status` 的四个计数含义：`SAME` = 与仓库一致；`STALE` = 内容有差异，`update` 会覆盖它；`MISSING` = 本机还没有，会被新增；`ORPHAN` = 本机独有，`update` 默认会删。

### 永不被写入 / 删除的东西

安装器在**任何模式下**（含 `update --apply`）都不碰：

```
.credentials.json    settings.json    settings.local.json
memory/    projects/    sessions/    tasks/    history.jsonl    plugins/
```

`settings.json` 唯一的例外是 `wire` —— 而它只**合并** `hooks` 键，不重写任何其它配置。

以下也不会被覆盖：

- `hooks/gitnexus/`、`skills/gitnexus*`、`skills/learned*`（视为用户自有内容）
- 登记在 `~/.claude/.config-source.json` 的 `custom_files` 数组里的任意路径 —— 这是"我改过某个 managed 文件，别覆盖我"的逃生口。目前需要**手动编辑该文件**把路径加进数组（仓库相对路径，如 `skills/my-skill/SKILL.md`）；加进去后连 `update` 也会跳过它，并在输出里记为 `custom-protected`。

以下只存在于仓库、**从不部署**到 `~/.claude`：

```
README.md  .gitignore  .gitattributes  settings.example.json
claude-config.js  wire-manifest.json  profiles/  .goals/
.cursor/  .codex/  .gemini/  .planning/  .harness/
```

### Hook 接线

hook 的**脚本文件**由 `install` / `update` 部署；把它们**接进 `settings.json`** 是单独一步：

```bash
node claude-config.js wire                        # dry-run：看会加哪几条
node claude-config.js wire --apply --wire         # 接全部批次
node claude-config.js wire --apply --hooks=A,C    # 只接 A 和 C
```

批次定义在 `wire-manifest.json`：

| 批次 | 内容 |
|---|---|
| A | GSD core governance（guards + injection scan + context monitor） |
| B | ECC quality（config-protection / block-no-verify / 逐文件格式化 / design-check） |
| C | Progress-ledger discipline（Stop 事件；soft、非阻断、fail-open） |

接线是**幂等**的：按脚本文件名逐事件匹配，已接过的不重复加，也从不删除你已有的条目。接线后会立刻校验，输出 `N refs, M broken` —— `broken` 应为 0。

> **幂等判断按脚本文件名。** 如果同一功能你已经用别的形式接过（例如 `npx block-no-verify@1.1.2` 而不是本地的 `hooks/block-no-verify.js`），安装器认不出来，会再加一条：功能重复但不冲突，介意就手动删掉其中一条。

接线稳定后可以固化成 profile，之后 `status` 会告诉你有没有条目被偷偷改动或新增：

```bash
node claude-config.js export-profile default --apply
```

### 版本 pin 与回滚

`--apply` 后会写 `~/.claude/.config-source.json`，记录 `installed_sha` / `repo_path` / `remote` / 时间戳 / `custom_files`。`status` 用它和仓库 HEAD 对比。

**安装器本身不做备份** —— `update --apply` 是不可撤销的覆盖。两条回滚路径：

1. **仓库侧**（推荐）—— 任意 commit 粒度：
   ```bash
   git checkout <sha> && node claude-config.js update --apply --no-clean
   ```
2. **机器侧** —— 覆盖前自己备份。`status` 输出的 `STALE` 列表就是**精确的**将被改动集合，按它备份即可，不必整个 `~/.claude` 打包。

### 只有一个安装器，是刻意的

本仓库曾另有 `install.sh` 和 `install.ps1`，已于 2026-08-03 删除。它们在真实 Windows 机器上都不可靠：

- **`install.ps1`** — Windows PowerShell 5.1 读**不带 BOM** 的 UTF-8 `.ps1` 时会按系统 ANSI 代码页解码。脚本里的中文注释因此变成乱码，并吃掉字符串引号，导致**整个脚本直接语法报错**，一行都执行不了。
- **`install.sh`** — 在 Git Bash 下 `$HOME` 是 `/c/Users/<name>`，于是 `__CLAUDE_HOME_JSON__` 被替换成 POSIX 路径；但 Windows 上的 hook 命令需要的是 `C:\\Users\\<name>\\.claude`。`hooks/hooks.json` 里 22 处路径会被写坏，hook 全部断链。

`claude-config.js` 用 Node 的 `os.homedir()` + `process.platform` 计算路径，JSON 转义 / Windows / POSIX 三种形态分别正确，没有 shell 差异和代码页问题。**请不要再往仓库里加 `.sh` / `.ps1` 安装壳。**

---
## 📐 Architecture

现行形态很薄：`CLAUDE.md`（宪法 + 硬规则）· `SKILLS-INDEX.md`（存活 skill 索引）· `rules/`（通用 + path-scoped 规则）· `agents/`（通用 agent）· evidence kit（`scripts/*-sdk.sh` + `schemas/`）。orchestrator 时代的完整架构文档（五主线 / 能力矩阵 / 门禁与证据链）在 tag `pre-orchestrator-removal` 的 `architecture/` 目录。

---

### Plugin Manifest Gotchas

If you plan to edit `.claude-plugin/plugin.json`, be aware that the Claude plugin validator enforces several **undocumented but strict constraints** that can cause installs to fail with vague errors (for example, `agents: Invalid input`). In particular, component fields must be arrays, `agents` must use explicit file paths rather than directories, and a `version` field is required for reliable validation and installation.

These constraints are not obvious from public examples and have caused repeated installation failures in the past. They are documented in detail in `.claude-plugin/PLUGIN_SCHEMA_NOTES.md`, which should be reviewed before making any changes to the plugin manifest.

### Custom Endpoints and Gateways

ECC does not override Claude Code transport settings. If Claude Code is configured to run through an official LLM gateway or a compatible custom endpoint, the plugin continues to work because hooks, skills, and any retained legacy command shims execute locally after the CLI starts successfully.

Use Claude Code's own environment/configuration for transport selection, for example:

```bash
export ANTHROPIC_BASE_URL=https://your-gateway.example.com
export ANTHROPIC_AUTH_TOKEN=your-token
claude
```
