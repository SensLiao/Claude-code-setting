#!/usr/bin/env bash
# qa-p4-entry-smoke.sh — behavior test for the P4 soft entry gate + level/tasklist SDK.
# Verifies: entry-ask blocks ONLY qa-sdk evidence/gate commands until a level is chosen
# (zero collateral on other Bash), level.select unblocks, tasklist-required is advisory
# (never blocks), level/tasklist validation, and non-QA projects stay silent.
set -u
HOOKS="$HOME/.claude/hooks"; SDK="$HOME/.claude/scripts/qa-sdk.sh"
fail=0; total=0
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
TMPW=$(cygpath -m "$TMP" 2>/dev/null || printf '%s' "$TMP")
mkdir -p "$TMP/.qa/evidence/t1"
echo '{"version":"1.0","qa_enforcement":"strict"}' > "$TMP/.qa/config.json"
echo '{"active_release_tag":"t1"}' > "$TMP/.qa/state.json"
run_pre() { printf '%s' "$2" | node "$HOOKS/$1" >/dev/null 2>&1; echo $?; }
check() { total=$((total+1)); if [[ "$2" == "$3" ]]; then printf "  %-52s PASS\n" "$1"; else printf "  %-52s FAIL (got %s want %s)\n" "$1" "$2" "$3"; fail=$((fail+1)); fi; }

EVCMD="{\"cwd\":\"$TMPW\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"bash ~/.claude/scripts/qa-sdk.sh evidence.run t1 static --command-id x -- echo hi\"}}"
LSCMD="{\"cwd\":\"$TMPW\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"ls -la\"}}"
LVLCMD="{\"cwd\":\"$TMPW\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"bash ~/.claude/scripts/qa-sdk.sh level.select L2\"}}"

echo "== qa-entry-ask-required =="
check "evidence cmd, no level → exit 2 (BLOCK)" "$(run_pre qa-entry-ask-required.js "$EVCMD")" 2
check "non-QA cmd (ls), no level → exit 0 (no collateral)" "$(run_pre qa-entry-ask-required.js "$LSCMD")" 0
check "level.select cmd itself → exit 0 (not gated)" "$(run_pre qa-entry-ask-required.js "$LVLCMD")" 0
( cd "$TMP" && bash "$SDK" level.select L2 >/dev/null 2>&1 )
check "evidence cmd, after level.select → exit 0" "$(run_pre qa-entry-ask-required.js "$EVCMD")" 0

echo "== qa-tasklist-required (advisory, never blocks) =="
rm -f "$TMP/.qa/state/tasklist.json"
check "evidence cmd, no tasklist → exit 0 (advisory)" "$(run_pre qa-tasklist-required.js "$EVCMD")" 0
check "non-QA cmd → exit 0" "$(run_pre qa-tasklist-required.js "$LSCMD")" 0

echo "== level.select / tasklist.write validation =="
check "level.select L9 (invalid) → exit 2" "$( ( cd "$TMP" && bash "$SDK" level.select L9 ) >/dev/null 2>&1; echo $?)" 2
check "tasklist.write valid json → exit 0" "$(echo '{"tasks":[]}' | ( cd "$TMP" && bash "$SDK" tasklist.write ) >/dev/null 2>&1; echo $?)" 0
check "tasklist.write bad json → exit 2" "$(echo 'not json' | ( cd "$TMP" && bash "$SDK" tasklist.write ) >/dev/null 2>&1; echo $?)" 2

echo "== non-QA project → silent =="
NONQA=$(mktemp -d); NONQAW=$(cygpath -m "$NONQA" 2>/dev/null || printf '%s' "$NONQA")
NQEV="{\"cwd\":\"$NONQAW\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"bash qa-sdk.sh evidence.run t1 x --command-id y -- echo hi\"}}"
check "entry-ask non-QA → exit 0" "$(run_pre qa-entry-ask-required.js "$NQEV")" 0
rm -rf "$NONQA"

echo "---"; echo "qa-p4-entry: $total tested, $((total-fail)) PASS, $fail FAIL"; [[ $fail -eq 0 ]]
