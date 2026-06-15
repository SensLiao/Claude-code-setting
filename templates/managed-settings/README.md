# Managed-Settings Templates

Wave 3 task T3.2 — 2026-06-14

**这些是模板文件。不要直接把它们 symlink 或覆盖到你的 live `settings.json`。先阅读迁移检查清单，按步骤操作。**

---

## 什么是 managed-settings

Claude Code 支持 **managed-settings** 机制：由系统管理员或项目配置统一下发一套 settings，可以锁定某些行为，让用户无法在本地覆盖。典型的企业团队使用场景：

- 统一限制危险操作
- 只允许 managed scope 里的 hooks/MCP/plugins 生效
- 移交项目时提供可移植的基础配置

**managed-settings 文件位置（按 OS）：**

| OS | 路径 |
|----|------|
| macOS / Linux | `~/.claude/managed-settings.json` |
| Windows | `C:\Users\<username>\.claude\managed-settings.json` |

> 具体路径以你的 Claude Code 版本官方文档为准。上表来自 native-capabilities.md 中的已知目录约定推断；如有出入，以 `claude --help` 或官方 docs 为准。

---

## 4 个 Profile 对照表

| Profile | 文件 | 适用场景 | allowManaged*Only 锁定 | 风险等级 |
|---------|------|---------|----------------------|---------|
| **solo** | `solo.json` | 单人日常开发，安全起点 | **不启用** | 低 |
| **strict** | `strict.json` | 团队/企业锁定，CI 强制 | **全部启用** | 高（需先迁移 hooks） |
| **portable** | `portable.json` | 项目移交给他人 | 不启用 | 低（无机器路径） |
| **danger-off** | `danger-off.json` | 任何场景的危险操作基线 | 不启用 | 安全底线 |

---

## 迁移检查清单

### 1. 阅读现有 settings.json 中的 hooks（必做）

```bash
# 查看现有用户全局 hooks 数量
node -e "const s=require(require('os').homedir()+'/.claude/settings.json'); const h=s.hooks||{}; let n=0; Object.values(h).forEach(arr=>arr.forEach(()=>n++)); console.log('hook entries:', n);"
```

当前 `~/.claude/settings.json` 包含以下类别的用户全局 hooks（已识别，2026-06-14）：

| Hook 类别 | 数量（约） | 关键 hooks |
|-----------|-----------|-----------|
| PostToolUse | 11 条 | post-bash-command-log, post-bash-pr-created, quality-gate, design-quality-check, post-edit-accumulator, governance-capture, gsd-context-monitor, gsd-read-injection-scanner, gsd-phase-boundary, observe.sh, mcp-health-check |
| PreToolUse | 12 条 | governed-gate-workflow-guard, block-no-verify, auto-tmux-dev, pre-bash-tmux-reminder, pre-bash-git-push-reminder, pre-bash-commit-quality, doc-file-warning, suggest-compact, governance-capture, config-protection, gsd-prompt-guard, gsd-read-guard, gsd-workflow-guard, gsd-validate-commit |
| SessionStart | 4 条 | session-start-bootstrap, detect-bootstrap-needed, gsd-check-update, gsd-session-state |
| Stop | 6 条 | stop-format-typecheck, check-console-log, session-end, evaluate-session, cost-tracker, desktop-notify |
| PreCompact | 1 条 | pre-compact |
| SessionEnd | 1 条 | session-end-marker |
| PostToolUseFailure | 1 条 | mcp-health-check |

**合计约 36 条用户全局 hook entries。**

---

### 2. 启用 `allowManagedHooksOnly` 前的必做事项（#1 Footgun）

> **这是最危险的迁移步骤。** `allowManagedHooksOnly: true` 会让 Claude Code 只执行 managed-settings 文件中定义的 hooks，忽略 `~/.claude/settings.json` 的所有 hooks。

启用前必须：

- [ ] **列出所有关键 hooks**（特别是 governance-capture、governed-gate-workflow-guard、gsd-*、quality-gate）
- [ ] **把关键 hooks 复制到 managed-settings 文件的 `hooks` 字段中**（或移入项目级 `.claude/settings.json`）
- [ ] **测试验证**：在测试项目中启用 strict.json，运行一次完整 GSD session，确认 hooks 按预期触发
- [ ] **特别确认以下 safety-critical hooks 已迁移**：
  - `governed-gate-workflow-guard.js`（PreToolUse[Workflow]）— 拦截 Dynamic Workflow 进入 governed gate
  - `config-protection.js`（PreToolUse[Write|Edit]）— 保护 settings.json 不被覆写
  - `gsd-prompt-guard.js` / `gsd-read-guard.js` / `gsd-workflow-guard.js`（PreToolUse）— GSD 主线守卫

**如果跳过这一步直接启用 strict.json：整个 GSD orchestrator 主线的 hook 保障将失效，governed gate 将失去 workflow guard，质量门将不再自动触发。**

---

### 3. `allowManagedMcpServersOnly` 迁移

- [ ] 把 `~/.claude/settings.json` 中的 `mcpServers`（当前有 `tavily`）复制到 managed-settings 的 `mcpServers` 字段
- [ ] 确认 `TAVILY_API_KEY` 等环境变量在目标环境中可用

---

### 4. `allowManagedPermissionRulesOnly` 迁移

- [ ] 把 `~/.claude/settings.json` 中 `permissions.allow`（33 条）和 `permissions.deny`（约 150 条）合并到 managed-settings
- [ ] 注意 `permissions.ask` 中的条目也需迁移（如 ZAP baseline、db:migrate 等）

---

### 5. `strictPluginOnlyCustomization` 版本要求

> **需要 Claude Code >= v2.1.82**（此为 task brief 中指定的版本要求）。
>
> 验证方法：`claude --version`
>
> 如果版本低于 v2.1.82，`strictPluginOnlyCustomization: true` 可能被忽略或导致解析错误。在 `strict.json` 中，该 key 被放在 `_managed_only_flags` 嵌套对象中——**在正式部署前需要将其提升到顶层**（如果 CC 支持此 key 的话，见下节注意事项）。

---

## Key 名称核实说明

> **重要**：以下 managed-settings 专用 key 在 `native-capabilities.md` 中**未被记录**。它们来自 task brief 中的规格说明，而非从本仓库文档中验证。在你的 Claude Code 版本中使用前，必须独立核实 key 名称是否正确。

| Key | 来源 | 状态 |
|-----|------|------|
| `allowManagedHooksOnly` | task brief 规格 | **(verify key name against your Claude Code version)** |
| `allowManagedMcpServersOnly` | task brief 规格 | **(verify key name against your Claude Code version)** |
| `allowManagedPermissionRulesOnly` | task brief 规格 | **(verify key name against your Claude Code version)** |
| `strictPluginOnlyCustomization` | task brief 规格，min CC v2.1.82 | **(verify key name against your Claude Code version)** |
| `disableWorkflows` | `native-capabilities.md` [doc-cited] | 已确认（project settings 级） |
| `permissions.allow/deny/ask` | live `settings.json` 观察 | 已确认 |
| `env` | live `settings.json` 观察 | 已确认 |
| `disableSkillShellExecution` | live `settings.json` 观察 | 已确认 |
| `effortLevel` | live `settings.json` 观察 | 已确认 |
| `mcpServers` | live `settings.json` 观察 | 已确认 |

核实方法：查阅 [Claude Code 官方文档](https://docs.anthropic.com/en/docs/claude-code) 或运行 `claude config list` 查看支持的配置 key。

---

## 使用方法

### 快速开始（solo — 推荐新手）

```bash
# 1. 复制模板（先备份现有文件，如果有）
cp ~/.claude/managed-settings.json ~/.claude/managed-settings.json.bak 2>/dev/null || true

# 2. 复制 solo 模板
cp "~/.claude/templates/managed-settings/solo.json" \
   ~/.claude/managed-settings.json

# 3. 验证 JSON 语法
node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); console.log('valid')" \
   ~/.claude/managed-settings.json
```

### 适配然后使用

**不要直接使用模板。** 正确流程：

1. 复制模板到工作目录
2. 删除 `_profile` / `_doc` / `_notes` / `_WARNING` 等注解字段（Claude Code 会解析 JSON，未知 key 可能报警）
3. 按迁移清单补充 hooks（如需 allowManagedHooksOnly）
4. 在测试环境验证
5. 部署到目标机器的 managed-settings 路径

### 注意：不要 symlink 到 live settings.json

```bash
# 错误做法（会破坏现有配置）
ln -s templates/managed-settings/strict.json ~/.claude/settings.json  # 不要这样做！

# managed-settings 和 settings.json 是两个不同文件，不要混淆
```

---

## 设计原则

这 4 个模板遵循 CLAUDE.md §4 硬规则：

- 不硬编码密钥（`env` 中使用 `${VAR}` 引用，不内联 secret）
- deny list 优先于 allow list（danger-off 尤为严格）
- 危险操作（pentest 工具、破坏性文件操作）全部在 deny 中
- 没有自动 bypass 权限提示（`skipDangerousModePermissionPrompt` 不设置为 true，danger-off 中明确不设置）
