---
name: guide
description: "Top-level user guide for THIS Claude Code config — the task mainlines (which orchestrator to use when), the claude-config.js install/update/wire toolchain, the hook batches, the new-machine/update flow, and where the full skill index lives. Use when the user asks how to use this setup, what commands/skills are available, or for a help / guide / cheat-sheet of this configuration. Trigger phrases: guide / help / cheat sheet / how do I use this config / what commands are there / what can this setup do / 指南 / 帮助 / 怎么用 / 有哪些命令 / 这套配置怎么用 / 用户手册."
allowed-tools:
  - Read
---

<objective>
Output the reference block below VERBATIM. Do NOT add project-specific analysis, git status,
file context, or next-step suggestions — this is a static help screen.
</objective>

<reference>
# Claude Code Config — User Guide

This config = task "mainlines" (each fronted by an orchestrator skill that routes you to the
right narrow skill) + a deterministic install/update/wire toolchain. Describe a task in plain
language and the matching orchestrator picks the skills; or invoke a command directly.

## 1. Mainlines — describe the task, the orchestrator routes
| Mainline | Entry skill | Use when |
|---|---|---|
| Project setup | `claude-env-bootstrap` (manual) | install a `.claude/` env into a new project |
| Delivery / PM | `gsd-pipeline-orchestrator` (auto) | any non-trivial build: new project / phase / feature / refactor |
| UI / UX | `uiux-product-orchestrator` (auto) | design, visual direction, style lock, screenshot-to-code, UI audit |
| QA / testing | `enterprise-qa-testing` (auto) | test strategy, E2E, CI quality gates, release readiness |
| AppSec (defensive) | `appsec-security-orchestrator` (auto) | backend / API / auth / payment / pre-deploy security review |
| Discoverability (L12) | `discoverability-orchestrator` | SEO / AEO / Local SEO / ASO before & after launch |

Full GSD command list: run `/gsd-help`.

## 2. Config management toolchain (this repo)
Run from the cloned repo dir. Default is DRY-RUN; add `--apply` to write:
- `node claude-config.js status` — installed vs repo drift + hook health (read-only)
- `node claude-config.js install --apply` — first-time deploy, then interactively offers hook wiring
- `node claude-config.js update --apply [--pull]` — sync to latest + clean removed files + re-pin
- `node claude-config.js wire --apply [--hooks=A,B]` — (re)wire hooks into settings.json (interactive in a real terminal; never hangs headless)

Global slash commands:
- `/sync-config` — guided update (preview → confirm → sync → verify)
- `/typecheck` — run the project's TypeScript check on demand (read-only)
- `/format` — format changed files with the project's formatter
- `/gsd-help` — full GSD command reference

## 3. Hooks — two batches, chosen at install/wire time
- Batch A — GSD core governance: workflow/read/prompt guards, prompt-injection scan on Read, context monitor, commit validation, session bootstrap.
- Batch B — ECC quality: config-protection (block edits to existing lint/format configs), block-no-verify, per-file auto-format, design-quality nudge.

`settings.json` is per-machine: `wire` MERGES hook entries into it (idempotent), never overwrites it. Your other settings (model, statusline, gitnexus, credentials) are preserved.

## 4. New machine / updating
- New machine: `git clone <repo-url> ~/.claude-config && node ~/.claude-config/claude-config.js install --apply` → answer the wiring prompts (Batch A/B). Headless equivalent: append `--wire --hooks=A,B`.
- Update later: `node ~/.claude-config/claude-config.js update --apply --pull` (or `/sync-config`).
- node + git required. Cross-platform (Windows / macOS / Linux).

## 5. Full reference (read these for the complete picture)
- `SKILLS-INDEX.md` — complete skill taxonomy + routing tables + trigger disambiguation
- `CLAUDE.md` — constitutional hard rules + governance
- `docs/ORCHESTRATOR-MAP.md` — orchestrator routing map
- Native `/` menu — lists every installed command/skill with its description
</reference>

<process>
Execute end-to-end. Display the reference content directly — no additions or modifications.
</process>
