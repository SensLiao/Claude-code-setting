---
description: Update ~/.claude from the Claude-code-setting repo via claude-config.js — preview, confirm, sync, verify
allowed-tools: Bash
---

Thin wrapper around the deterministic updater `claude-config.js` in the Claude-code-setting repo.
Repo path is recorded in `~/.claude/.config-source.json` (`repo_path`). If that file is missing, ask me for the repo path.

Run, stopping for my confirmation between step 2 and 3:

1. (optional) To also pull the latest from GitHub first, note it — step 3 will pass `--pull`.
2. **Preview (read-only):** run `node "<repo_path>/claude-config.js" update` (no --apply = DRY RUN). It prints: how many files would be overwritten, orphan files that would be deleted, and any broken settings.json hook references. Show me this output.
3. **WAIT for my explicit OK.** Then run `node "<repo_path>/claude-config.js" update --apply` (add `--pull` if I asked to pull from GitHub; add `--no-clean` if I want to keep orphans).
4. Report the result: deployed/overwritten counts, orphans deleted, hook-reference check (must be 0 broken), and the new pinned SHA.

The script never writes settings.json / .credentials.json / memory / projects / sessions / tasks / plugins, nor any file in `custom_files` (block-no-verify.js, /typecheck, /format, /sync-config) — those are protected. If step 4 shows a broken hook reference, fix `~/.claude/settings.json` (pre-merge backup at `~/.claude/settings.json.bak`).

For a quick read-only health check without updating, run `node "<repo_path>/claude-config.js" status`.
