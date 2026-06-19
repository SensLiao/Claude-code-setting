---
name: guide
description: "Top-level user guide for THIS Claude Code config — the task mainlines (which orchestrator to use when), how to use it on an existing project, the everyday commands, the claude-config.js install/update/wire toolchain, the hook batches, and where the full skill index lives. Use when the user asks how to use this setup, what commands/skills are available, how to start on an existing project, or for a help / guide / cheat-sheet of this configuration. Trigger phrases: guide / help / cheat sheet / how do I use this config / what commands are there / what can this setup do / how to start on an existing project / 指南 / 帮助 / 怎么用 / 有哪些命令 / 这套配置怎么用 / 用户手册 / 老项目怎么用."
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

## 2. Everyday slash commands
- `/typecheck` — run the project's TypeScript check on demand (read-only)
- `/format` — format changed files with the project's formatter
- `/gsd-help` — full GSD command reference
- `/guide` — this screen

## 3. Starting on an EXISTING project (not set up with GSD)
The GSD guards stay dormant until a project has a `.planning/` dir — nothing forces GSD on you.
Pick the level of structure you want:
- Level 0 — just get tasks done: describe the task; the right orchestrator / skill / agent handles
  it, or edits happen directly. Nothing to install. Best for quick fixes, small features, exploration.
- Level 1 — light structure for one task: `/gsd-fast` (trivial, inline) or `/gsd-quick`
  (atomic commits + state tracking, skips optional agents).
- Level 2 — bring the repo under GSD: lay the groundwork first — `gsd-map-codebase` (analyze the
  existing code into `.planning/codebase/`) and, if you have docs, `gsd-ingest-docs` (bootstrap
  `.planning/` from existing ADRs / PRDs / SPECs); then `gsd-plan-phase` -> `gsd-execute-phase`.
Easiest entry: invoke `gsd-pipeline-orchestrator` (or just say "I'm on an existing project and want
to do X") — it detects a not-yet-GSD repo and routes you to onboarding vs. just doing the task.

## 4. Install / update THIS config
Underlying tool: `node claude-config.js <cmd>` from the cloned repo dir (default DRY-RUN; add `--apply` to write):
- `status` — installed-vs-repo drift + hook health (read-only)
- `install --apply` — first-time deploy; then interactively offers hook wiring (Batch A/B)
- `update --apply [--pull]` — sync to latest + clean files removed upstream + re-pin
- `wire --apply [--hooks=A,B]` — (re)wire hooks into settings.json (idempotent; interactive in a real terminal, never hangs headless)

- New machine: `git clone <repo-url> ~/.claude-config && node ~/.claude-config/claude-config.js install --apply` → answer the wiring prompts. Headless: append `--wire --hooks=A,B`.
- Update later: `/sync-config` (guided: preview -> confirm -> sync -> verify) or `node …/claude-config.js update --apply --pull`.
- Requires node + git. Cross-platform (Windows / macOS / Linux).
- `settings.json` is per-machine: `wire` MERGES hook entries into it (never overwrites it); your model / statusline / gitnexus / credentials are preserved.

## 5. Hooks — two batches, chosen at install/wire time
- Batch A — GSD core governance: workflow/read/prompt guards, prompt-injection scan on Read, context monitor, commit validation, session bootstrap.
- Batch B — ECC quality: config-protection (block edits to existing lint/format configs), block-no-verify, per-file auto-format, design-quality nudge.

## 6. Full reference (read these for the complete picture)
- `SKILLS-INDEX.md` — complete skill taxonomy + routing tables + trigger disambiguation
- `CLAUDE.md` — constitutional hard rules + governance
- `docs/ORCHESTRATOR-MAP.md` — orchestrator routing map
- Native `/` menu — lists every installed command/skill with its description
</reference>

<process>
Execute end-to-end. Display the reference content directly — no additions or modifications.
</process>
