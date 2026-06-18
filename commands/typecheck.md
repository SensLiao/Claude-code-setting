---
description: Run the project's TypeScript type checker (tsc --noEmit) and report errors
allowed-tools: Bash
---

Run a full TypeScript type check on the current project. This is the on-demand
replacement for the per-turn Stop typecheck hook (kept off to avoid overhead).

1. Find the nearest `tsconfig.json` (current directory or nearest ancestor). If none, say so and stop.
2. From that directory, run `npx tsc --noEmit --pretty false` (prefer a local `node_modules/.bin/tsc` if present).
3. If it passes, report "type check passed" in one line.
4. If there are errors, list them grouped by file as `path:line — message`, then offer to fix them.

This is read-only — do not modify any files unless I explicitly ask.
