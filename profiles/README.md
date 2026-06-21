# Hook profiles (light)

A **profile** is a version-controlled, portable record of exactly which hooks a machine has wired —
an **allow-list**. Hooks you deliberately don't run (e.g. `report-gate.js`, `plan-card-reminder.js`)
are captured by their **absence** from the list.

- `node claude-config.js export-profile [name] --apply` — read this machine's live `settings.json`
  hooks, templatize machine-specific paths (`__CLAUDE_HOME__` / `__NODE_BIN__` / `__USER_HOME__`),
  and write `profiles/<name>.json` (default name: `default`). Commit it to version it.
- `node claude-config.js status` — compares live wiring against `profiles/default.json` and reports
  **drift** in both directions:
  - `missing` — in the profile but not wired on this machine
  - `unexpected` — wired on this machine but not in the profile (e.g. a hook that snuck in)

This is the **light** profile: a record + drift detector. It does NOT auto-apply or prune — to
change wiring, edit `settings.json` (via `wire`) and re-run `export-profile`. `settings.json` itself
is never touched by `update` (it is in the PRESERVE set), so your wiring already survives updates;
the profile adds a portable, diffable record and a drift alarm on top.

Not deployed to `~/.claude` (the `profiles/` dir is in the installer SKIP list — it is a source-side
record, read from the repo).
