# L12 Discoverability — Project Hooks

5 project-level hooks that enforce the harness contract at the Claude Code tool layer. Together with `discoverability-sdk.py` and the orchestrator's named agents, these hooks turn L12 from a prompt-best-effort into a real release gate.

## What each hook does

| Hook | Event | Purpose | Blocks? |
|---|---|---|---|
| `disc-session-context.js` | `SessionStart` | Advises model of active tag, gate status, and which files mark gate STALE. | No |
| `disc-mark-stale.js` | `PostToolUse(Edit|Write)` | Flips `.discoverability/state.json.gate_status` to STALE when a triggering file (robots/sitemap/metadata/structured-data/store-listing/config) is edited. | No (PostToolUse cannot undo) |
| `disc-robots-sitemap-guard.js` | `PreToolUse(Edit|Write)` | Hard-blocks 5 obvious mistakes: full-site `Disallow: /` without sentinel, malformed sitemap.xml, private routes in sitemap, private/token URLs in llms.txt, robots Disallow targeting private routes. | Exit 2 |
| `disc-deploy-gate.js` | `PreToolUse(Bash)` | Blocks deploy commands (vercel/netlify/wrangler/firebase/pnpm-release/gsd-ship/...) when gate is STALE/FAIL/BLOCKED/missing/stale-by-time. | Exit 2 |
| `disc-evidence-required.js` | `Stop` | Blocks "discoverability done" / "L12 complete" / "SEO/AEO/ASO audit done" / "可发现性审查通过" claims when `gate-result.yaml` is missing / FAIL / BLOCKED / STALE. | Stop block JSON |

Helper: `_disc-common.js` — shared loader (config + state), trigger-file regex bank, deploy-command matcher, private-route patterns, atomic state.json updater. Required by all 5 hooks.

## Install

1. **Copy hook files into your project:**
   ```bash
   # from the template dir
   cp ~/.claude/templates/discoverability/hooks/*.js <project-root>/.claude/hooks/
   cp ~/.claude/templates/discoverability/hooks/README.md <project-root>/.claude/hooks/disc-README.md
   ```
2. **Merge `settings-snippet.json` into your project's `.claude/settings.json` `hooks` section.** See `templates/discoverability/settings-snippet.json` for the exact entries.
3. **Ensure your project has `discoverability.config.yaml` at the project root.** Hooks anchor on this file; without it they silent-exit.
4. **Initialize a run tag:**
   ```bash
   python scripts/discoverability-sdk.py init <tag>
   ```

## Enable / disable

| Goal | Setting (in `discoverability.config.yaml`) |
|---|---|
| Disable all hooks globally | `harness.enabled: false` |
| Downgrade all hooks to advisory (warn-only) | `harness.strict_mode: false` |
| Turn off a single hook | `harness.hook_modes.<name>: off` |
| Adjust deploy-gate to warn-only | `harness.hook_modes.deploy_gate: warn` |
| Adjust evidence-freshness window | `harness.evidence_freshness_hours: 24` |
| Add project-specific deploy commands | `harness.deploy_commands: [- "my-deploy-cmd", ...]` |

`hook_modes.<name>` keys: `session_context` | `mark_stale` | `robots_sitemap_guard` | `deploy_gate` | `evidence_required`.

## Why silent-exit when `discoverability.config.yaml` is absent

Hooks must be safe to ship as a global default. If a repo has no `discoverability.config.yaml`, that repo is **not an L12 project** — there's nothing to gate, and any noise would degrade developer experience on non-L12 work. Every hook's first action (via `preflight()` in `_disc-common.js`) is the absent-config check; failure modes are:

- **No config** → silent exit 0
- **`harness.enabled: false`** → silent exit 0
- **Config malformed/unreadable** → blocking hooks fail-closed (exit 2 / Stop block); advisory hooks silent-exit with stderr note
- **`harness.strict_mode: false`** → all hooks downgrade to stderr advisory + exit 0

## Cross-references

- **Contract:** `~/.claude/templates/discoverability/harness-contract.md` §7 (binding hook behavior contract). §9 freezes hook names — never rename.
- **Orchestrator:** `~/.claude/skills/discoverability-orchestrator/SKILL.md` §10 (8-step self-dispatch that produces the evidence these hooks check).
- **SDK:** `templates/discoverability/runner-skeleton/discoverability-sdk.py` (the only writer of `.discoverability/state.json` and `gate-result.yaml`).
- **Boundary:** Hooks do NOT implement access control. If they detect a private route leaking via robots/sitemap/llms.txt, they flag it and recommend handoff to `appsec-security-orchestrator`.

## Constraints

- All hooks are `'use strict'`, fully synchronous, Node stdlib only (no npm deps).
- Every hook starts with `preflight()` and short-circuits on absent/disabled config.
- Stop hook respects `stop_hook_active === true` to avoid infinite loops.
- Hook names in §9 of the contract are safety-critical; do not rename.
