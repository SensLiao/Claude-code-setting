#!/usr/bin/env bash
# qa-main-thread-guard-smoke.sh — proof of 承重柱 2 (subagent-only test execution).
# Drives hooks/qa-main-thread-test-guard.js with synthetic PreToolUse payloads.
#
#   1 main-thread test cmd (no agent_id), strict QA   → exit 2 (BLOCK)
#   2 subagent test cmd (agent_id set), strict QA     → exit 0 (ALLOW)
#   3 non-test cmd (ls) on main thread, strict QA     → exit 0 (ALLOW)
#   4 test cmd in NON-QA dir                           → exit 0 (silent)
#   5 main-thread test cmd, warn mode                  → exit 0 (advisory)
#   6 npm test on main thread, strict QA               → exit 2 (BLOCK)
#   7 SANITY: confirm the strict QA project is actually detected (else 1/6 are vacuous)
#
# NOTE: cwd in the payload must be a forward-slash path (cygpath -m) — a Windows
# backslash path would break JSON.parse and the hook would fall back to silent.
#
# Run:  bash orchestrator-runtime/qa/tests/qa-main-thread-guard-smoke.sh
# Exit: 0 = all expected / 1 = regression

set -u
HOOK="$HOME/.claude/hooks/qa-main-thread-test-guard.js"
FAILS=0
expect() { if [[ "$2" == "$3" ]]; then echo "  ok   $1 (exit $2)"; else echo "  FAIL $1 (exit $2, expected $3)"; FAILS=$((FAILS+1)); fi; }
winpath() { cygpath -m "$1" 2>/dev/null || printf '%s' "$1" | sed 's#\\#/#g'; }

STRICT_RAW=$(mktemp -d); mkdir -p "$STRICT_RAW/.qa"
printf '{"version":"1.0","qa_enforcement":"strict"}\n' > "$STRICT_RAW/.qa/config.json"
WARN_RAW=$(mktemp -d); mkdir -p "$WARN_RAW/.qa"
printf '{"version":"1.0","qa_enforcement":"warn"}\n' > "$WARN_RAW/.qa/config.json"
NONQA_RAW=$(mktemp -d)
trap 'rm -rf "$STRICT_RAW" "$WARN_RAW" "$NONQA_RAW"' EXIT
STRICT=$(winpath "$STRICT_RAW"); WARN=$(winpath "$WARN_RAW"); NONQA=$(winpath "$NONQA_RAW")

run() { printf '%s' "$1" | node "$HOOK" >/dev/null 2>&1; echo $?; }

S=$(run "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"npx vitest run\"},\"cwd\":\"$STRICT\"}")
expect "1 main-thread vitest, strict" "$S" 2

S=$(run "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"npx vitest run\"},\"agent_id\":\"a-123\",\"cwd\":\"$STRICT\"}")
expect "2 subagent vitest, strict" "$S" 0

S=$(run "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"ls -la\"},\"cwd\":\"$STRICT\"}")
expect "3 non-test (ls), strict" "$S" 0

S=$(run "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"npx vitest run\"},\"cwd\":\"$NONQA\"}")
expect "4 test in non-QA dir" "$S" 0

S=$(run "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"npx playwright test\"},\"cwd\":\"$WARN\"}")
expect "5 main-thread playwright, warn" "$S" 0

S=$(run "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"npm test\"},\"cwd\":\"$STRICT\"}")
expect "6 npm test main-thread, strict" "$S" 2

# sanity: a deliberately blockable case proves detection works (guards against vacuous 1/6)
S=$(run "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"go test ./...\"},\"cwd\":\"$STRICT\"}")
expect "7 sanity go test main-thread, strict" "$S" 2

echo ""
if (( FAILS == 0 )); then echo "qa-main-thread-guard-smoke: ALL PASS"; exit 0
else echo "qa-main-thread-guard-smoke: $FAILS FAILURE(S)"; exit 1; fi
