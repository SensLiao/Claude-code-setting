# Claude Code Harness — Configuration & Architecture

> 五主线 orchestrator 架构（Bootstrap · GSD PM · UIUX `v2.3` · QA `v3.2` · AppSec `v3.0`），以 hooks + 确定性 gate + spec_hash + evidence bundle + 人工签字治理 agentic 交付。`context loading != enforcement`。

## 🚀 安装 / 更新

**`claude-config.js` 是唯一完整的部署路径**，需要 node。

```bash
node claude-config.js status                 # 先看：本机与仓库差多少（SAME / STALE / MISSING / ORPHAN）
node claude-config.js update --apply         # 部署：覆盖旧文件 + 写 skillOverrides + 清理 orphan + 交互式接线 hooks
```

| 命令 | 已存在的文件 | 何时用 |
|---|---|---|
| `install` | **跳过不覆盖**（additive） | 首次装、或不想动本机已有改动 |
| `update` | **覆盖**（force） | 想真正同步到仓库最新版 —— **升级请用这个** |

`update --apply` 一次做完四件事：① 覆盖 `CLAUDE.md` / `rules/` / `agents/` / `skills/` 等全部受管文件 ② 写入 `skillOverrides` 可见性策略 ③ 删除上游已移除的 orphan ④ 询问是否接线 hooks（可用 `--wire` / `--hooks=A,B` 免交互，`--no-wire` 跳过）。

**为什么 ② 不是可选项**：只复制 skill 文件而不写 `skillOverrides`，清单就停在平台默认——每个 skill 都来抢描述预算，平台再按"调用最少优先丢"**静默**砍掉一批。本库实测：173 条里 112 条被砍成裸名，其中包括 CLAUDE.md §3 明令必须自触发的 skill。所以那不是"少装了一样"，而是**装错了**。策略源在 [`manifests/skill-overrides.recommended.json`](manifests/skill-overrides.recommended.json)，漂移由 `tests/harness/skill-visibility-drift.test.js` 守。

**常用附加参数**：`--target <path>` 换目标目录 · `--no-clean` 保留 orphan · `--pull` 先 git pull · `--yes` 免交互。不带 `--apply` 一律是 dry-run，只打印不落盘。

单项操作（`update` 已包含，一般不用单独跑）：

```bash
node claude-config.js skills                 # 只对可见性策略：dry-run 看 diff，--apply 落盘
node claude-config.js wire --apply --hooks=A,B   # 只接线 hooks
node claude-config.js export-profile --apply     # 把本机 hook 接线导出成 profiles/<name>.json
```

> `install.sh` / `install.ps1` 是**无 node 环境的兜底**，只做文件复制（默认跳过已存在，加 `--force` 才覆盖）。它们**不写 `skillOverrides`、不接线 hooks、不清 orphan、不写 pin**，跑完得到的是上面说的那个"装错了"的状态。有 node 就用 `claude-config.js`。

## 📐 Architecture

完整架构展示（5 主线 workflow、能力矩阵"什么测试 / 防什么安全 / 什么攻击"、门禁与证据链、安全边界）见 **[`architecture/`](architecture/)**，从 [`architecture/README.md`](architecture/README.md) 开始。

| 入口 | 内容 |
|---|---|
| [`architecture/docs/00-overview.md`](architecture/docs/00-overview.md) | 5 主线、4 层控制面、核心原则 |
| [`architecture/docs/01-routing.md`](architecture/docs/01-routing.md) | 路由策略、优先级、tie-break、handoff |
| [`architecture/docs/02-orchestrators/`](architecture/docs/02-orchestrators/) | 每条主线深挖到 agent / hook / SDK 级 |
| [`architecture/docs/03-capability-matrix.md`](architecture/docs/03-capability-matrix.md) | 测什么 / 防什么 / 攻什么 + 标准 |
| [`architecture/docs/04-governance-and-evidence.md`](architecture/docs/04-governance-and-evidence.md) | verdict、spec_hash、evidence、dynamic workflow 边界 |

标准底座：OWASP ASVS 5.0 · NIST CSF 2.0 · OWASP Top 10:2025 · WCAG 2.2 · ISO/IEC 25010:2023 · PCI DSS 4.0.1 · MITRE ATT&CK。

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
