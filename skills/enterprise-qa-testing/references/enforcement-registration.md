# Relocated from enterprise-qa-testing/SKILL.md — §17. Enforcement Registration

## 17. Enforcement Registration（v3.1 新增 — agent / hook / qa-sdk 注册位置）

### 17.1 Agent 注册位置

9 个 named agent 必须在 `~/.claude/agents/` 用户级目录，frontmatter 用 `tools` 字段（Claude Code custom subagent 官方约定）：

| Agent | 文件 | Model | Tools | 角色 |
|---|---|---|---|---|
| `qa-risk-classifier` | `~/.claude/agents/qa-risk-classifier.md` | opus | Read, Grep, Glob, Bash | Skill 主线 R4 — 风险分类（Workflow 启动前） |
| `qa-evidence-validator` | `~/.claude/agents/qa-evidence-validator.md` | sonnet | Read, Grep, Glob, Bash | EvidenceBundle phase — release decision + qa-sdk 持久化 |
| `qa-flaky-triager` | `~/.claude/agents/qa-flaky-triager.md` | sonnet | Read, Grep, Glob, Bash | FlakyTriage phase — 8-cat 分类 + 8-field quarantine |
| `qa-static-baseline-runner` | `~/.claude/agents/qa-static-baseline-runner.md` | sonnet | Read, Bash, Grep, Glob | StaticBaseline phase — tsc / eslint / npm audit / git-secrets 执行（B.1.f R2 dedicated runner）|
| `qa-component-runner` | `~/.claude/agents/qa-component-runner.md` | sonnet | Read, Bash, Grep, Glob | UnitOrComponent / ComponentOrContract phase — Vitest / Jest / RTL 执行（B.1.f R2 dedicated runner）|
| `qa-contract-runner` | `~/.claude/agents/qa-contract-runner.md` | sonnet | Read, Bash, Grep, Glob | 未来纯 Contract phase 用 — openapi-cli / spectral / pact verify（B.1.f R2 dedicated runner，预备）|
| `qa-visual-runner` | `~/.claude/agents/qa-visual-runner.md` | sonnet | Read, Bash, Grep, Glob | VisualAudit phase — Playwright toHaveScreenshot / Storybook visual diff（commercial-cert）（B.1.f R2 dedicated runner）|
| `qa-a11y-runner` | `~/.claude/agents/qa-a11y-runner.md` | sonnet | Read, Bash, Grep, Glob | A11yAudit phase — axe-core / Lighthouse a11y / pa11y（commercial-cert）（B.1.f R2 dedicated runner）|
| `qa-perf-runner` | `~/.claude/agents/qa-perf-runner.md` | sonnet | Read, Bash, Grep, Glob | PerfAudit phase — Lighthouse CI / playwright-perf / k6 / bundle-analyzer（commercial-cert）（B.1.f R2 dedicated runner）|

每个 agent 必须输出本 skill §16 schema 要求的 YAML 块（或 workflow-spec mode 下对应的 `*_SCHEMA.v1` JSON），否则视为 dispatch 失败。

**R2 roadmap status (B.1.f 2026-05-29 — COMPLETE)**: 6 dedicated runners（qa-static-baseline-runner / qa-component-runner / qa-contract-runner / qa-visual-runner / qa-a11y-runner / qa-perf-runner）替换了 D1 短期 `code-reviewer` 重用。production 模式（quick-check / focused-qa-gate / release-readiness / commercial-cert）的 preset agentType 均迁移完毕。`code-reviewer` 仅保留给内部 harness preset（smoke / graph-smoke）。

### 17.2 Hook Scripts 位置（脚本与注册分离）

Hook **脚本**放在用户级目录（任何项目都能引用同一份脚本）：

```
~/.claude/hooks/
├── _qa-common.js                       # 共享 helper (findProjectRoot / loadConfig / preflight)
├── qa-block-update-snapshots.js
├── qa-floor-rule-prompt.js
├── qa-detect-internal-mock.js
├── qa-quarantine-accountability.js
└── qa-evidence-required.js
```

每个脚本**第一步必须**通过 `_qa-common.preflight(input)`：
- 向上 walk 找 `.qa/config.json` → 找不到 silent exit 0
- 找到但解析失败 → fail-closed（PreToolUse exit 2 / Stop emitStopBlock）
- `qa_enforcement: off` → silent
- `qa_enforcement: warn` → advisory 但不 block
- `qa_enforcement: strict` → 完整 enforcement

这保证 QA hooks 不打扰非 QA 项目，且不会因为配置损坏 fail open。

### 17.3 Hook 注册位置（项目级，不污染全局）

注册只在**项目级** `.claude/settings.json` 中，**不**注册到用户级 `~/.claude/settings.json`。

**Windows 路径展开陷阱**：Git Bash 不展开带引号的 `~`，Claude Code 也不展开。因此命令必须用 **绝对路径**（由 install/setup 脚本根据 `$HOME` / `%USERPROFILE%` 在落地时填入）：

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "node \"<HOOK_DIR>/qa-block-update-snapshots.js\"", "timeout": 5 }] },
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "node \"<HOOK_DIR>/qa-quarantine-accountability.js\"", "timeout": 5 }] }
    ],
    "PostToolUse": [
      { "matcher": "Edit|Write|MultiEdit", "hooks": [{ "type": "command", "command": "node \"<HOOK_DIR>/qa-floor-rule-prompt.js\"", "timeout": 5 }] },
      { "matcher": "Edit|Write|MultiEdit", "hooks": [{ "type": "command", "command": "node \"<HOOK_DIR>/qa-detect-internal-mock.js\"", "timeout": 5 }] }
    ],
    "Stop": [
      { "matcher": "*", "hooks": [{ "type": "command", "command": "node \"<HOOK_DIR>/qa-evidence-required.js\"", "timeout": 10 }] }
    ]
  }
}
```

`<HOOK_DIR>` 通常为：
- Linux/macOS：`$HOME/.claude/hooks`
- Windows：`C:/Users/<user>/.claude/hooks`（path separator 用 `/` 避免 JSON escape）

**关键约束**：
- Stop hook **不**带 `async: true`（异步无法 block，gate 失效）
- PreToolUse hook exit 2 = hard block；exit 0 = allow
- PostToolUse hook 只能 advisory（动作已发生）；不会 block
- Edit\|Write\|MultiEdit 全部要 match（草案误漏 MultiEdit）

模板：`~/.claude/templates/qa/settings.project.json`。落地时把 `~` 替换为目标机器路径——团队团队/CI 不可直接复制此机器的路径。

### 17.4 qa-sdk.sh 命令契约

`~/.claude/scripts/qa-sdk.sh` 提供 evidence 落盘和 gate 检查的统一入口。**调用形式**（Windows 无 PATH shim 时）：

```bash
bash "$HOME/.claude/scripts/qa-sdk.sh" <command> [args]
```

| 命令 | 用途 | exit code |
|---|---|---|
| `init <release-tag>` | 创建 `.qa/evidence/<tag>/` 骨架；写 `.qa/state.json` active_release_tag | 0 = OK / 2 = unsafe tag |
| `set-active <release-tag>` | 仅更新 `.qa/state.json` active_release_tag | 0 = OK / 2 = unsafe tag |
| `evidence.append <tag> <layer> [<file>]` | 追加一层证据（stdin 或文件）。`<layer>` 可为常规层（static/component/contract/e2e/visual/a11y/perf/smoke/qa_evidence_bundle 等）或特殊层 `workflow-state`（见下方注释） | 0 = OK / 2 = unsafe name |
| `evidence.list <tag>` | 列出已有证据文件 | 0 = OK |
| `evidence.validate-presence <tag> [<expected-layers-csv>]` | 检查必须证据 + 选定层 YAML 是否齐全 | 0 = present / 1 = missing |
| `gate.check <tag> [--mode execution\|plan-only\|design-only]` | 检查 `release_decision` + CONDITIONAL_PASS 时验 risk-acceptance | 0 = PASS/CONDITIONAL_PASS(valid) / 1 = FAIL / 2 = BLOCKED |
| `finding.add [<file>]` | 写入 `.qa/findings/<id>.yaml` | 0 = OK |
| `quarantine.add --test <name> --owner <id> --issue <url> --expiry <date> --repro <cmd> --unblock <cond> [--class <n>]` | 追加 quarantine 记录（8 字段） | 0 = OK / 2 = missing field |
| `approve.snapshot --scope <csv> --reason <text> --hours <n> --pattern <regex> --human-attested` | 写 `.qa/snapshot-update-approval.json`，必须人工 attest，pattern 限定授权命令形态 | 0 = OK / 2 = missing/unsafe |

**Project root**：所有命令向上 walk 找 `.qa/config.json` — 子目录调用也能定位项目根。

**Safety**：`tag` 和 `layer` 必须匹配 `^[a-zA-Z0-9._-]+$`（禁路径遍历）。Resolve 后的输出路径必须留在 `<root>/.qa/evidence/<tag>/` 内。

**Gate decision 严格表**：
- `PASS` → exit 0
- `STRATEGY_READY` → 仅 `--mode design-only` 才 exit 0；其他模式 exit 2
- `CONDITIONAL_PASS` → 需 `.qa/risk-acceptance.yaml` 含 `approver / approved_at / expires_at / release_tag(=tag) / accepted_decision(=CONDITIONAL_PASS) / reason` 且未过期；缺/不匹配 exit 2
- `FAIL` → exit 1
- `BLOCKED` → exit 2
- 未识别值 → exit 2

**调用约定**：
- 本 skill §6 各 Step **必须**通过 qa-sdk 落盘，不允许自己 `echo > file`
- `gate.check` exit code 与 CI return value 直接对齐
- Claude **不能**自己 `approve.snapshot` —— `--human-attested` 强制人工 invocation 才生效

**`workflow-state` layer 边界（D4 + R10 lock — 2026-05-28）**：

`evidence.append <tag> workflow-state` 接受任意 safe-name layer 名（`^[a-zA-Z0-9._-]+$`），用于把 Workflow run 的元数据（spec_hash / run_id / reused_phases / cache_misses / dispatch_failures / phase_outputs_fingerprinted / 触发的 model 与 prompt_ref / 用户 approval 文字摘要）以 yaml 形式追加为单文件，路径 `<root>/.qa/evidence/<tag>/workflow-state.yaml`。

这是 **Skill-level provenance / planning snapshot**（Option B 单文件累加器），**不是** Workflow native cross-session resume cache：
- Workflow 自带的 resume 缓存（`resumeFromRunId`）只在 **same-session** 内有效（参 `Workflow` tool docs：'Same-session only. Stop the prior run first ...'）
- `workflow-state.yaml` 是为后续 release evidence audit / 跨 session 故障复盘 / 与 GSD `gsd-ship` artifact-based 解耦准备的快照，与 native resume 是两层东西，**不要混淆**
- 不要把 workflow-state 当作可被 `Workflow({resumeFromRunId})` 自动消费的 cache —— 它只是 Skill 主线写出来的 provenance log，下次 run 由 Skill 主线显式读 + 注入 `args.previous_results` 字段实现"我希望复用上次 phase 输出"语义

### 17.5 GSD 接口对齐（v3.1 反向接口）

`gsd-ship` / `gsd-verify-work` 不再需要"调本 skill 输出 dispatch 建议"，而是直接消费 `.qa/evidence/<tag>/qa_evidence_bundle.yaml`：

```bash
# gsd-ship pre-merge gate
bash "$HOME/.claude/scripts/qa-sdk.sh" gate.check <release-tag>
case $? in
  0) echo "QA PASS — proceed to merge" ;;
  1) echo "QA FAIL — block merge" ; exit 1 ;;
  2) echo "QA BLOCKED — block merge, see .qa/evidence/<tag>/" ; exit 1 ;;
esac
```

这保证 GSD 主线与 QA 主线之间是 **artifact-based 解耦**（不需要 in-memory dispatch），可独立演化。

---
