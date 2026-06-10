#!/usr/bin/env bash
# gsd-hook-version: 1.42.3
# gsd-validate-commit.sh — PreToolUse hook: enforce Conventional Commits format
# Blocks git commit commands with non-conforming messages (exit 2).
# Allows conforming messages and all non-commit commands (exit 0).
# Uses Node.js for JSON parsing (always available in GSD projects, no jq dependency).
#
# OPT-IN: This hook is a no-op unless config.json has hooks.community: true.
# Enable with: "hooks": { "community": true } in .planning/config.json
#
# ── v4.0.3 / H2-B CRIT-1 (re-classified to HIGH after santa-loop synthesis) ─
# This hook depends on hooks/lib/git-cmd.js (for isGitSubcommand classifier).
# If that file is missing, the inner `node -e "...require(GIT_CMD_LIB)..."`
# throws MODULE_NOT_FOUND, the surrounding `if` block treats that as "not a
# git commit command", and execution falls through to `exit 0` at the bottom.
# Net effect: when git-cmd.js is missing AND hooks.community=true is enabled,
# this hook silently passes ALL commits without validating them.
#
# ── 2026-06-10 (hooks-B#3 FIX): hooks/lib/git-cmd.js is now VENDORED in this repo,
# so the gate actively classifies commits again (no longer a silent no-op when
# hooks.community=true). The defensive `2>/dev/null` is RETAINED on purpose: if the
# lib is ever deleted, the hook degrades to fail-open (passes commits) rather than
# breaking every Bash call — the line below makes that degradation explicit instead
# of silent. Status check (run once after setup):
#   ls "$(dirname "$0")/lib/git-cmd.js" && echo "gate active" || echo "GATE DEGRADED (fail-open): hooks/lib/git-cmd.js missing"

# Check opt-in config — exit silently if not enabled
if [ -f .planning/config.json ]; then
  ENABLED=$(node -e "try{const c=require('./.planning/config.json');process.stdout.write(c.hooks?.community===true?'1':'0')}catch{process.stdout.write('0')}" 2>/dev/null)
  if [ "$ENABLED" != "1" ]; then exit 0; fi
else
  exit 0
fi

INPUT=$(cat)

# Extract command from JSON using Node (handles escaping correctly, no jq needed)
CMD=$(echo "$INPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(JSON.parse(d).tool_input?.command||'')}catch{}})" 2>/dev/null)

# Only check git commit commands.
# Delegates to hooks/lib/git-cmd.js isGitSubcommand() — the canonical token-walk
# classifier that handles env-prefix, -C path, and full-path git invocations.
# A naive `^git\s+commit` regex misses all three; this guard fixes that (#3129).
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
# Make a missing classifier lib a VISIBLE downgrade, not a silent pass (hooks-B#3).
# Only warns when opt-in is on (we already exited above otherwise), so non-opt-in
# projects stay quiet. The hook then fails open (passes the commit) rather than
# breaking every Bash call — but now you can see it happened.
if [ ! -f "$HOOK_DIR/lib/git-cmd.js" ]; then
  echo "[gsd-validate-commit] WARN: hooks/lib/git-cmd.js missing — Conventional Commits gate DEGRADED (passing commit unchecked)." >&2
  exit 0
fi
if GIT_CMD_LIB="$HOOK_DIR/lib/git-cmd.js" node -e "
  const {isGitSubcommand}=require(process.env.GIT_CMD_LIB);
  process.exit(isGitSubcommand(process.argv[1],'commit')?0:1);
" "$CMD" 2>/dev/null; then
  # Extract message from -m flag
  MSG=""
  if [[ "$CMD" =~ -m[[:space:]]+\"([^\"]+)\" ]]; then
    MSG="${BASH_REMATCH[1]}"
  elif [[ "$CMD" =~ -m[[:space:]]+\'([^\']+)\' ]]; then
    MSG="${BASH_REMATCH[1]}"
  fi

  if [ -n "$MSG" ]; then
    SUBJECT=$(echo "$MSG" | head -1)
    # Validate Conventional Commits format
    if ! [[ "$SUBJECT" =~ ^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\(.+\))?:[[:space:]].+ ]]; then
      # Emit a typed `code` field alongside `reason` (#2974). Tests assert
      # on the stable code string; the reason is the human-readable copy.
      echo '{"decision": "block", "code": "CONVENTIONAL_COMMITS_VIOLATION", "reason": "Commit message must follow Conventional Commits: <type>(<scope>): <subject>. Valid types: feat, fix, docs, style, refactor, perf, test, build, ci, chore. Subject must be <=72 chars, lowercase, imperative mood, no trailing period."}'
      exit 2
    fi
    if [ ${#SUBJECT} -gt 72 ]; then
      echo '{"decision": "block", "code": "COMMIT_SUBJECT_TOO_LONG", "reason": "Commit subject must be 72 characters or less."}'
      exit 2
    fi
  fi
fi

exit 0
