#!/usr/bin/env bash
# qa-p3-hooks-smoke.sh — behavior test for the 3 P3 fail-closed hooks.
# Verifies: additive NO-OP when intake/markers absent · BLOCK when a mandated layer /
# matching-E2E / human-attestation is missing · ALLOW once satisfied. Stop hooks block
# via {"decision":"block"} on stdout + exit 0; PreToolUse blocks via exit 2.
set -u
HOOKS="$HOME/.claude/hooks"
SDK="$HOME/.claude/scripts/qa-sdk.sh"
fail=0; total=0
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
# node resolves the hook's input.cwd itself — feed it a node-friendly (Windows-mixed) path
TMPW=$(cygpath -m "$TMP" 2>/dev/null || printf '%s' "$TMP")
mkdir -p "$TMP/.qa/evidence/t1"
echo '{"version":"1.0","qa_enforcement":"strict","default_mode":"execution"}' > "$TMP/.qa/config.json"
echo '{"active_release_tag":"t1"}' > "$TMP/.qa/state.json"
STOPIN="{\"cwd\":\"$TMPW\",\"stop_hook_active\":false}"

run_stop() { printf '%s' "$2" | node "$HOOKS/$1" 2>/dev/null | grep -q '"decision":"block"' && echo BLOCK || echo ALLOW; }
run_pre()  { printf '%s' "$2" | node "$HOOKS/$1" >/dev/null 2>&1; echo $?; }
check() { total=$((total+1)); if [[ "$2" == "$3" ]]; then printf "  %-52s PASS\n" "$1"; else printf "  %-52s FAIL (got %s want %s)\n" "$1" "$2" "$3"; fail=$((fail+1)); fi; }

echo "== qa-required-layer-gate =="
check "no test-plan → additive NO-OP (ALLOW)" "$(run_stop qa-required-layer-gate.js "$STOPIN")" ALLOW
cat > "$TMP/.qa/evidence/t1/00-test-plan.json" <<EOF
{"release_tag":"t1","runtime_ref":"00-runtime.json","path_graph_ref":"path-graph.json","required_layers":[{"layer":"E2E","required":true,"reason":"auth journey","expected_artifact":".qa/evidence/t1/e2e.json"}],"critical_release_paths":["auth"],"runtime_targets":[]}
EOF
check "required E2E, artifact missing → BLOCK" "$(run_stop qa-required-layer-gate.js "$STOPIN")" BLOCK
echo '{"layer":"E2E","command_evidence":[{"command_id":"x","exit_code":0}]}' > "$TMP/.qa/evidence/t1/e2e.json"
check "required E2E, artifact present → ALLOW" "$(run_stop qa-required-layer-gate.js "$STOPIN")" ALLOW

echo "== qa-runtime-mismatch-gate =="
cat > "$TMP/.qa/evidence/t1/00-test-plan.json" <<EOF
{"release_tag":"t1","runtime_ref":"00-runtime.json","path_graph_ref":"path-graph.json","required_layers":[],"critical_release_paths":[],"runtime_targets":[{"kind":"mobile-flutter","host_capable":true,"expected_e2e_kind":"mobile-maestro"}]}
EOF
check "mobile target, only web e2e → BLOCK" "$(run_stop qa-runtime-mismatch-gate.js "$STOPIN")" BLOCK
echo '{"layer":"mobile_e2e","command_evidence":[{"command_id":"m","exit_code":0}]}' > "$TMP/.qa/evidence/t1/mobile_e2e.json"
check "mobile target, mobile_e2e present → ALLOW" "$(run_stop qa-runtime-mismatch-gate.js "$STOPIN")" ALLOW
# host_capable:false must NOT block (NOT_APPLICABLE)
cat > "$TMP/.qa/evidence/t1/00-test-plan.json" <<EOF
{"release_tag":"t1","runtime_ref":"x","path_graph_ref":"y","required_layers":[],"critical_release_paths":[],"runtime_targets":[{"kind":"mobile-ios","host_capable":false,"expected_e2e_kind":"mobile-maestro"}]}
EOF
rm -f "$TMP/.qa/evidence/t1/mobile_e2e.json"
check "mobile-ios host_capable:false → NOT double-block (ALLOW)" "$(run_stop qa-runtime-mismatch-gate.js "$STOPIN")" ALLOW

echo "== qa-no-silent-fallback =="
PREIN="{\"cwd\":\"$TMPW\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$TMPW/.qa/evidence/t1/static.yaml\",\"content\":\"fallback_used: true\"}}"
check "PreToolUse write fallback, no approval → exit 2" "$(run_pre qa-no-silent-fallback.js "$PREIN")" 2
( cd "$TMP" && bash "$SDK" fallback.approve --scope static --reason "tool missing on host" --hours 4 --human-attested >/dev/null 2>&1 )
check "PreToolUse write fallback, w/ approval → exit 0" "$(run_pre qa-no-silent-fallback.js "$PREIN")" 0
PREIN_CLEAN="{\"cwd\":\"$TMPW\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$TMPW/.qa/evidence/t1/static.yaml\",\"content\":\"tsc_errors: 0\"}}"
check "PreToolUse write w/o fallback marker → exit 0" "$(run_pre qa-no-silent-fallback.js "$PREIN_CLEAN")" 0
rm -f "$TMP/.qa/fallback-approval.json"
echo 'fallback_used: true' > "$TMP/.qa/evidence/t1/static.yaml"
check "Stop, fallback evidence, no approval → BLOCK" "$(run_stop qa-no-silent-fallback.js "$STOPIN")" BLOCK
( cd "$TMP" && bash "$SDK" fallback.approve --scope static --reason "tool missing on host" --hours 4 --human-attested >/dev/null 2>&1 )
check "Stop, fallback evidence, w/ approval → ALLOW" "$(run_stop qa-no-silent-fallback.js "$STOPIN")" ALLOW

echo "== non-QA project (no .qa/config.json) → all hooks silent ALLOW =="
NONQA=$(mktemp -d); NONQAW=$(cygpath -m "$NONQA" 2>/dev/null || printf '%s' "$NONQA")
NQIN="{\"cwd\":\"$NONQAW\",\"stop_hook_active\":false}"
check "required-layer non-QA → ALLOW" "$(run_stop qa-required-layer-gate.js "$NQIN")" ALLOW
check "runtime-mismatch non-QA → ALLOW" "$(run_stop qa-runtime-mismatch-gate.js "$NQIN")" ALLOW
check "no-silent-fallback non-QA Stop → ALLOW" "$(run_stop qa-no-silent-fallback.js "$NQIN")" ALLOW
rm -rf "$NONQA"

echo "---"
echo "qa-p3-hooks: $total tested, $((total-fail)) PASS, $fail FAIL"
[[ $fail -eq 0 ]]
