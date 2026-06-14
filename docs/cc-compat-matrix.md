# Claude Code Compatibility Matrix

> **Last updated**: 2026-06-14 · **Scope**: single-operator personal harness (`~/.claude/`)
> **Single source of truth for platform facts**: [`native-capabilities.md`](./native-capabilities.md)
> Update this file whenever `native-capabilities.md` is updated after a Claude Code release.

---

## 1. Purpose

This matrix exists to protect the harness from Claude Code version upgrades that silently break hooks, settings keys, skills, or the Workflow/Agent subsystem. It is **not** an enterprise release-management system — it serves one operator and one machine. The goal is simple: when CC auto-updates, this file tells you which surfaces are at risk, what the minimum safe version floor is, and where to look if something stops working. It is a living lookup table, not a policy document; keep it factual and append-only in the breaking-change log.

---

## 2. Harness CC Min-Version

The highest min-version referenced anywhere in the harness repo:

| Surface | Referenced min CC version | Source |
|---------|--------------------------|--------|
| Dynamic Workflows | **2.1.154** | `native-capabilities.md` → `machine-readable snapshot.claude_code_min_version_for_dynamic_workflows` |

**Harness floor**: `2.1.154`

No other surface in the repo declares a hard floor below this. If your Claude Code version is below `2.1.154`, Dynamic Workflows (`Workflow` tool) will be unavailable, and the `governed-gate-workflow-guard.js` PreToolUse hook + the `CLAUDE_CODE_WORKFLOWS=1` env knob will have no target.

---

## 3. Surface → Min-CC Table

| Surface | Min CC version | Risk if version too old | Source |
|---------|---------------|------------------------|--------|
| **Workflow tool** (Static + Dynamic Workflows) | `2.1.154` (Dynamic); static predates 4.8 | `Workflow()` calls fail silently or produce no-op; `governed-gate-workflow-guard.js` never fires; harness cannot run `appsec-orchestrator.js` / `qa-orchestrator.js` | `native-capabilities.md` §Dynamic Workflows + `workflow_tool.predates_4_8` |
| **Dynamic Workflows** (model-authored inline `script`) | `2.1.154` | Dynamic Workflow fan-out disabled; `ultracode` / xhigh effort orchestration silently degrades to static workflow only | `native-capabilities.md` machine-readable snapshot |
| **Agent Teams** (`TeamCreate` / `TeamDelete`) | (unverified — confirm before relying) | Team fan-out fails; `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` env key ignored | `settings.json` env key + `native-capabilities.md` §Agent Teams `[session-confirmed 2026-06-10]` — no hard min version listed |
| **Tasks** (`TaskCreate` / `TaskUpdate` / `TaskList` / `TaskGet` / `TaskOutput`) | (unverified — confirm before relying) | Background/async agent work unavailable | `native-capabilities.md` §Tasks `[session-confirmed 2026-06-10]` — no hard min version listed |
| **Cron / scheduled agents** (`CronCreate` / `CronList` / `CronDelete`) | (unverified — confirm before relying) | `schedule` skill non-functional; recurring routines cannot be registered | `native-capabilities.md` §Cron `[session-confirmed 2026-06-10]` — no hard min version listed |
| **Worktree isolation** (`EnterWorktree` / `ExitWorktree` / `isolation: "worktree"`) | (unverified — confirm before relying) | Write-conflict-safe parallel agent isolation unavailable; fan-out agents may collide on files | `native-capabilities.md` §Worktree isolation `[session-confirmed 2026-06-10]` |
| **Monitor / PushNotification / SendUserFile / SendMessage** | (unverified — confirm before relying) | Long-running orchestration ergonomics degrade; agent messaging broken | `native-capabilities.md` §Monitoring & messaging `[session-confirmed 2026-06-10]` |
| **ToolSearch + deferred-tool mechanism** | (unverified — confirm before relying) | MCP/deferred tool schemas cannot be fetched on demand; large tool catalogs must all load upfront | `native-capabilities.md` §Tool discovery `[session-confirmed 2026-06-10]` |
| **Global hooks** (PreToolUse / PostToolUse / Stop / SessionStart / SessionEnd / PreCompact) | Predates 2.1.154 (hook system long-established) | All hook-based guards (`governed-gate-workflow-guard.js`, `gsd-prompt-guard.js`, AppSec/QA project hooks, etc.) silently do nothing | `settings.json` hook definitions; no breaking version change flagged in `native-capabilities.md` |
| **Skills / SKILL.md system** | (unverified — confirm before relying) | Skills stop loading; all orchestrators (GSD / UIUX / AppSec / QA / L12) become unavailable | Not versioned in repo sources; platform internal |
| **Plugin system** (`enabledPlugins` / `extraKnownMarketplaces` / `skillOverrides`) | (unverified — confirm before relying) | Third-party plugins (bencium, designer-skills, vercel, interface-design, etc.) may fail to load; `skillOverrides` entries silently ignored | `settings.json` keys; no min-version cited in repo |
| **`statusLine` settings key** | (unverified — confirm before relying) | Custom statusline (`gsd-statusline.js`) not rendered; CC shows default or blank | `settings.json` key `statusLine`; not versioned in repo |
| **`effortLevel` settings key** | (unverified — confirm before relying) | xhigh / ultracode effort level ignored; falls back to platform default | `settings.json` key `effortLevel: "xhigh"` |
| **Subagents (`Agent` tool)** | Predates 2.1.154 | Fan-out orchestration unavailable; all gsd-* / appsec-* / qa-* agents cannot be spawned | `native-capabilities.md` §Workflow tool / Subagents (predates 4.8) |
| **MCP servers** (`mcpServers` in settings.json) | (unverified — confirm before relying) | Tavily MCP server not available; web search in research skills breaks | `settings.json` key `mcpServers` |
| **`disableSkillShellExecution` key** | (unverified — confirm before relying) | Key silently ignored; shell execution from skill context may become available unintentionally | `settings.json` key `disableSkillShellExecution: true` |
| **`skipDangerousModePermissionPrompt` key** | (unverified — confirm before relying) | Key silently ignored; prompts may reappear or behavior undefined | `settings.json` key `skipDangerousModePermissionPrompt: true` |

---

## 4. Settings-Key → Min-CC Table

These are the version-sensitive settings keys that the harness uses in `~/.claude/settings.json`. "Version-sensitive" means a too-old CC will either ignore the key (silent) or interpret it differently.

| Key | Value in harness | Introducing CC version | Failure mode if CC too old | Source |
|-----|-----------------|----------------------|---------------------------|--------|
| `env.CLAUDE_CODE_WORKFLOWS` | `"1"` | (unverified — confirm before relying) | `Workflow` tool not enabled; all workflow-spec execution paths disabled | `settings.json` line 5; `native-capabilities.md` §Dynamic Workflows cites `CLAUDE_CODE_DISABLE_WORKFLOWS=1` as the disable knob |
| `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | `"1"` | (unverified — confirm before relying) | `TeamCreate` / `TeamDelete` tools unavailable; "Experimental" prefix suggests feature-flag gating | `settings.json` line 3 |
| `effortLevel` | `"xhigh"` | (unverified — confirm before relying) | Key silently ignored; effort falls back to platform default (`high` for Opus 4.8); ultracode not activated | `settings.json` line 720; `native-capabilities.md` §Effort |
| `skillOverrides` | various `user-invocable-only` / `name-only` entries | (unverified — confirm before relying) | Silently ignored; safety-critical manual-first gates (`claude-env-bootstrap`, `authorized-pentest-validation`) could become auto-invocable | `settings.json` lines 212–227 |
| `enabledPlugins` | multiple third-party plugins | (unverified — confirm before relying) | Silently ignored; plugins load based on internal CC defaults | `settings.json` lines 656–675 |
| `extraKnownMarketplaces` | bencium, cli-anything, designer-skills, etc. | (unverified — confirm before relying) | Third-party marketplace sources not resolved; `enabledPlugins` entries for those marketplaces silently fail | `settings.json` lines 676–719 |
| `statusLine` | custom JS command | (unverified — confirm before relying) | Silently ignored; shows default CC statusline | `settings.json` lines 652–655 |
| `disableSkillShellExecution` | `true` | (unverified — confirm before relying) | Silently ignored (permissive direction) | `settings.json` line 651 |
| `skipDangerousModePermissionPrompt` | `true` | (unverified — confirm before relying) | Silently ignored; prompts may reappear | `settings.json` line 721 |
| `hooks` (all hook types) | PreToolUse / PostToolUse / Stop / SessionStart / SessionEnd / PreCompact | Hook system predates 2.1.154; `PreCompact` recency unverified | Unknown hook types silently skipped; harness guards stop firing | `settings.json` hooks section; `native-capabilities.md` §Workflow tool / Subagents / Hooks |
| `mcpServers` | `tavily` | (unverified — confirm before relying) | MCP server not registered; Tavily web search unavailable in session | `settings.json` lines 725–736 |

> **Note on `strictPluginOnlyCustomization` and `allowManagedHooksOnly`**: these keys were not found in `settings.json`, `manifests/`, or `CLAUDE.md` in this repo. They are not documented in `native-capabilities.md`. Do **not** assume they exist or their semantics — verify against live CC docs before relying on them.

---

## 5. Breaking-Change Log (append-only)

> **Append-only**: never delete or modify existing rows. Add new rows at the bottom.
> When a CC update breaks a harness surface, add a row here, update the tables above, and run the test suite.

| Date | CC version | Surface | What changed | Harness action required |
|------|-----------|---------|--------------|------------------------|
| _(template row — no real entry yet)_ | `X.Y.Z` | e.g. `Workflow tool` | e.g. `inline script param renamed` | e.g. `update governed-gate-workflow-guard.js + re-test` |

**How to add a row**: when CC auto-updates and a surface breaks, fill in the date you discovered it, the CC version that introduced the change (run `claude --version` or check the CC release notes), which surface broke, what exactly changed, and what action you took (or need to take) in the harness.

---

## 6. How to Use This Matrix

- **When CC updates**: run `node ~/.claude/tests/harness/run-all.js` immediately after the update to detect regressions before relying on the harness for real work.
- **After the test run**: check this matrix — if a surface in §3 or §4 is marked "(unverified)", look up the actual min-version in the CC release notes and fill it in; if a previously working surface now fails, add a row to §5.
- **When adding a new breaking change**: append a row to the §5 log (date / CC version / surface / what changed / harness action), update the relevant row in §3 or §4 to reflect the new version floor, and commit the update to `SensLiao/Claude-code-setting` for rollback coverage.
