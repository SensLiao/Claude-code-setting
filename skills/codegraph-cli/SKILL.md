---
name: codegraph-cli
description: Use CodeGraph CLI as a lightweight local code-reading tool — find callers, callees, impact radius, affected tests, and a focused task context for any symbol in a local repo. CLI-only by default; never auto-enable the MCP server, never run the interactive installer, never let CodeGraph become a harness subsystem. Trigger phrases include: "CodeGraph CLI / callers / callees / impact / blast radius / affected tests / who calls / what calls / code context / 调用链 / 影响面 / 受影响测试 / 读代码 / 函数开发".
---

# codegraph-cli

> Supporting utility skill (Layer 11 Meta · "Code Reading Tools" pair with `gitnexus-repo-map`).
> Wraps the CodeGraph CLI (`npm i -g @colbymchenry/codegraph` · cli `codegraph`) so the harness can use it for **fast local symbol traversal and affected-test selection** without bolting an MCP server onto Claude Code by default.
> Upstream: <https://github.com/colbymchenry/codegraph> · License: MIT.

## 1. Purpose

CodeGraph parses a repo with tree-sitter, stores symbols + edges + files in a local SQLite (FTS5) at `.codegraph/codegraph.db`, and exposes a CLI that lets you ask precise questions about the local code:

- *"Who calls this function?"*
- *"What does this function call?"*
- *"If I change this symbol, what is affected?"*
- *"For this task description, what is the minimum context I need?"*
- *"Given this `git diff`, which test files should I run?"*

This skill uses **only the CLI surface**. CodeGraph also ships an MCP server (`codegraph serve --mcp`) and a multi-agent installer (`codegraph install`) that registers itself in `~/.claude.json`, `~/.cursor/`, `~/.codex/`, `~/.config/opencode/`, etc. The harness does **not** auto-enable any of that — the harness already has its own MCP and orchestrator topology; we use CodeGraph as a knife, not as a daemon.

## 2. Use this skill when

- The user asks **who calls** a function / class / method.
- The user asks **what a function calls** (callees).
- The user asks **what will be affected** by changing a symbol (impact / blast radius).
- The user asks for **focused context** before implementing a task ("for this task, what code matters?").
- The user asks **which tests are affected** by a git diff.
- The user is **reading or modifying local code** and grep/read loops have gotten expensive.

## 3. Do NOT use this skill when

- The user wants a **visual / architectural** view of the whole repo → use [[gitnexus-repo-map]] instead.
- The user wants full project initialization → that is `claude-env-bootstrap`'s job.
- The user only asks for a **conceptual explanation** with no repo context → answer from knowledge; do not index for nothing.
- The project has no `.codegraph/` and the task is **small enough to inspect directly** (1-2 files, single function) → just use Read/Grep; do not pay the indexing cost.
- The user wants to **change** the code's behavior at the architecture level → CodeGraph reads what's there, it does not decide what should be there; route through GSD instead.

## 4. Pre-flight check

```bash
codegraph --version 2>/dev/null || echo "CodeGraph not installed"
```

If it is **not** installed:

1. Tell the user.
2. Offer install options but do **not** run any of them without explicit user consent:
   - Cross-platform (npm): `npm install -g @colbymchenry/codegraph`
   - Zero-install: `npx @colbymchenry/codegraph <command>`
   - Bundled installer (macOS/Linux): `curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh`
   - Bundled installer (Windows PowerShell): `irm https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.ps1 | iex`
3. If the user is OK with `npx`, prefer it — it does not install globally and does not run CodeGraph's interactive installer.

## 5. Commands (the curated surface)

### 5.1 Inspect first

```bash
codegraph status                   # is this project initialized? backend? journal mode?
```

If it reports anything other than `Journal: wal`, warn the user — WAL falls back on network shares / WSL2 `/mnt`, and reads block on writes.

### 5.2 Initialize / index

```bash
codegraph init [path]              # initialize (creates .codegraph/ — see §6 rule about gitignore)
codegraph init -i                  # interactive init (sane defaults, prompts for path)
codegraph index [path]             # full index
codegraph index [path] --force     # re-index from scratch
codegraph sync [path]              # incremental update (after edits)
```

### 5.3 Read / query

```bash
# Search symbols by name
codegraph query "PaymentService"
codegraph query "PaymentService" --kind class --limit 10 --json

# Show indexed file structure (faster than recursive ls)
codegraph files
codegraph files --format tree --filter "src/**" --max-depth 3 --json

# Build a task-focused context bundle for the agent
codegraph context "Fix the silent failure in checkout"
codegraph context "Add OIDC login" --format markdown --max-nodes 30
```

### 5.4 Call-graph traversal

```bash
codegraph callers "PaymentService.charge"
codegraph callers "PaymentService.charge" --limit 50 --json

codegraph callees "PaymentService.charge"
codegraph callees "PaymentService.charge" --limit 50 --json

codegraph impact "PaymentService.charge"
codegraph impact "PaymentService.charge" --depth 3 --json
```

### 5.5 Affected-test selection (the QA-adjacent value)

```bash
# Pass changed files explicitly
codegraph affected src/utils.ts src/api.ts

# Pipe from git diff (most useful in pre-commit / pre-push hooks)
git diff --name-only | codegraph affected --stdin
git diff --name-only HEAD~1 HEAD | codegraph affected --stdin --quiet

# Custom test glob if auto-detect picks the wrong layout
codegraph affected src/auth.ts --filter "e2e/**"

# JSON for machine consumption (QA pipeline / CI gate)
git diff --name-only | codegraph affected --stdin --json
```

This output is **suggestive**, not authoritative — it answers *"which tests share import lineage with these source files?"*. It does **not** replace QA's risk decisions (see §6 rule 5).

### 5.6 Cleanup

```bash
codegraph uninit [path] --force    # remove .codegraph/ from a project
```

## 6. Hard safety rules (do not violate)

1. **CLI only by default.** Do not start `codegraph serve --mcp` unless the user explicitly asks for the MCP server. The harness has its own MCP discipline (see `~/.claude/manifests/skills.manifest.json`); silently adding CodeGraph as an MCP surface inflates Claude Code's tool inventory and changes other agents' tool-choice behavior.
2. **Do not run `codegraph install` / `codegraph` interactive installer automatically.** Those write to `~/.claude.json`, `~/.claude/settings.json`, `~/.cursor/`, `~/.codex/config.toml`, etc. — global mutations that belong to the user, not to this skill.
3. **Do not run `codegraph uninstall` automatically.** Same blast radius, opposite direction.
4. **Treat `.codegraph/` as a local tool cache.** Do not promote it into harness evidence roots (`.appsec/evidence/<tag>/` / `.qa/evidence/<tag>/` / `evidence/discoverability/<tag>/` / `.planning/`). Do not commit it (CodeGraph honors `.gitignore`; if the user hasn't ignored it yet, suggest they do).
5. **`codegraph affected` is supporting context, not a QA gate.** QA's release gate lives in `enterprise-qa-testing` / `qa-evidence-validator` and follows the §3 Floor Rules. Use `affected` to *propose* a candidate test set; let QA decide if that set is sufficient.
6. **Do not double-cite as authoritative.** If CodeGraph and the live source disagree (post-edit, pre-sync), trust the source. Run `codegraph sync` after meaningful edits.
7. **Never expand the harness's MCP tool surface from inside this skill.** No `mcp__codegraph__*` registration. No `~/.claude/settings.json` permission edits. If the user wants that integration, point them at the official `codegraph install --target=claude` flow — they make that call deliberately, outside this skill.

## 7. Handoff matrix

CodeGraph is a context tool. Pass forward to:

| Downstream | When to hand off |
|---|---|
| [[gitnexus-repo-map]] | User now wants a global / visual / architectural read of the repo — CodeGraph is symbol-local; GitNexus is repo-wide. |
| `enterprise-qa-testing` | `codegraph affected` returned a candidate test set — QA decides whether that set passes the Floor Rules + Modifier Cap. Pass the set as supporting context, not as the gate. |
| `appsec-security-orchestrator` | `codegraph callers` / `codegraph impact` surfaced a path touching auth / payment / user data — AppSec decides threat-model impact + ASVS 5.0 mapping. |
| `gsd-pipeline-orchestrator` | The exploration informed a plan-able change — hand the focused context to GSD's `plan-phase`. |
| `gsd-code-review` | Use `codegraph callers` / `impact` to size the blast radius the reviewer should look at. |

Pass forward as **supporting context only**:

> "CodeGraph reports N direct callers, M downstream symbols within depth 3, and these K test files share import lineage. Use as background; the harness still owns the decision."

## 8. Two-line decision card (for when you're routing in a hurry)

- **"Who calls / who depends on / what breaks if I change X"** → `codegraph-cli`
- **"Show me the repo's overall shape"** → `gitnexus-repo-map`

## 9. Anti-patterns (will silently break the harness)

- ❌ Starting `codegraph serve --mcp` on every project — re-shapes Claude Code's tool inventory globally.
- ❌ Running `codegraph install` to "make it work" — that registers CodeGraph in every agent the user has installed.
- ❌ Citing `codegraph affected` output as the QA test plan — it is *one* input to risk classification, not the whole answer.
- ❌ Using `codegraph context` output as a literal spec to implement — it is a *retrieval* result, not a product spec. Decisions still go through `gsd-spec-phase`.
- ❌ Skipping `codegraph sync` after large edits and then trusting `callers / impact` — stale graph = wrong answer.
- ❌ Treating CodeGraph and GitNexus as alternatives that compete. They cover different slices:
  - GitNexus = global / visual / cluster-level / architectural.
  - CodeGraph = local / symbol-level / call-graph / affected-tests.
  - On a hard problem you often want both: GitNexus to *see* the repo, then CodeGraph to *aim* at the specific symbol.

## 10. Maintenance

- Tool updates → only touch this file and (optionally) the version note in `~/.claude/SKILLS-INDEX.md`. Do not propagate CodeGraph internals deeper into the harness.
- If CodeGraph renames / deprecates a command upstream, update §5 and §7. Do not preserve dead aliases.
- If the user later wants the full MCP integration, they make that decision deliberately outside this skill — point them at `codegraph install --target=claude --yes` and document it in their project's `CLAUDE.md`, not in `~/.claude/`.
