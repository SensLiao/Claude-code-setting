#!/usr/bin/env bash
# Unit tests for governed-gate-workflow-guard.js (Governed Gate Mode, 2026-05-29).
# Sets up temp governed / non-governed projects with sentinels, pipes mock
# PreToolUse[Workflow] payloads, asserts exit codes. 0=allow, 2=block.
set -u
HOOK="$HOME/.claude/hooks/governed-gate-workflow-guard.js"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
pass=0; fail=0

now()  { node -e "console.log(new Date().toISOString())"; }
past() { node -e "console.log(new Date(Date.now()-1000*1000).toISOString())"; }

# run_case <label> <projdir> <payload-json> <expected-rc>
run_case() {
  local label="$1" proj="$2" payload="$3" want="$4"
  local got
  ( cd "$proj" && printf '%s' "$payload" | node "$HOOK" >/dev/null 2>&1 )
  got=$?
  if [ "$got" = "$want" ]; then echo "  PASS  $label (rc=$got)"; pass=$((pass+1))
  else echo "  FAIL  $label (rc=$got, want=$want)"; fail=$((fail+1)); fi
}

INLINE='{"tool_name":"Workflow","tool_input":{"script":"export const meta={name:1};agent(1)"}}'
SCRIPTPATH='{"tool_name":"Workflow","tool_input":{"scriptPath":"/x/qa-orchestrator.js","args":{}}}'
NAMED='{"tool_name":"Workflow","tool_input":{"name":"deep-research"}}'
RESUME='{"tool_name":"Workflow","tool_input":{"resumeFromRunId":"wf_abc123"}}'
NOTWF='{"tool_name":"Read","tool_input":{}}'

# ── 1. non-governed project: inline script → allow (NO-OP) ──
NG="$TMP/plain"; mkdir -p "$NG"
run_case "non-governed + inline script → allow" "$NG" "$INLINE" 0
run_case "non-governed + not-Workflow → allow"  "$NG" "$NOTWF" 0

# ── 2. governed .qa, default (active-gate), NO active gate → allow+advise ──
G1="$TMP/qa-default"; mkdir -p "$G1/.qa/state/preview"
echo '{"qa_enforcement":"strict"}' > "$G1/.qa/config.json"
run_case "governed default + inline, no active gate → allow" "$G1" "$INLINE" 0
run_case "governed + scriptPath runner → allow"              "$G1" "$SCRIPTPATH" 0
run_case "governed + named saved workflow → allow"           "$G1" "$NAMED" 0
run_case "governed + resumeFromRunId only → allow"           "$G1" "$RESUME" 0

# ── 3. governed .qa, active-gate, ACTIVE sentinel (fresh) → block ──
G2="$TMP/qa-active"; mkdir -p "$G2/.qa/state/preview"
echo '{"qa_enforcement":"strict"}' > "$G2/.qa/config.json"
printf '{"run_id":"r1","approved_at":"%s","ttl_seconds":300}' "$(now)" > "$G2/.qa/state/preview/r1.json"
run_case "governed active-gate + inline + ACTIVE sentinel → block" "$G2" "$INLINE" 2
run_case "governed active-gate + scriptPath (even active) → allow" "$G2" "$SCRIPTPATH" 0

# ── 4. governed .qa, EXPIRED sentinel → allow (no active gate) ──
G3="$TMP/qa-expired"; mkdir -p "$G3/.qa/state/preview"
echo '{"qa_enforcement":"strict"}' > "$G3/.qa/config.json"
printf '{"run_id":"r1","approved_at":"%s","ttl_seconds":300}' "$(past)" > "$G3/.qa/state/preview/r1.json"
run_case "governed + inline + EXPIRED sentinel → allow" "$G3" "$INLINE" 0

# ── 5. governed .qa, mode=always → block inline regardless ──
G4="$TMP/qa-always"; mkdir -p "$G4/.qa/state/preview"
echo '{"qa_enforcement":"strict","governed_gate_mode":"always"}' > "$G4/.qa/config.json"
run_case "governed mode=always + inline → block"     "$G4" "$INLINE" 2
run_case "governed mode=always + scriptPath → allow" "$G4" "$SCRIPTPATH" 0

# ── 6. governed .qa, mode=off → fail-safe to active-gate UNLESS justified (2026-05-29 hardening) ──
G5="$TMP/qa-off"; mkdir -p "$G5/.qa/state/preview"
echo '{"qa_enforcement":"strict","governed_gate_mode":"off"}' > "$G5/.qa/config.json"
printf '{"run_id":"r1","approved_at":"%s","ttl_seconds":300}' "$(now)" > "$G5/.qa/state/preview/r1.json"
run_case "governed mode=off (no justification) + inline (active) → BLOCK (fail-safe)" "$G5" "$INLINE" 2
# off WITH justification reason → honored (allow even during active gate)
G5b="$TMP/qa-off-justified"; mkdir -p "$G5b/.qa/state/preview"
echo '{"qa_enforcement":"strict","governed_gate_mode":"off","governed_gate_mode_off_reason":"sandbox repo, no release gate"}' > "$G5b/.qa/config.json"
printf '{"run_id":"r1","approved_at":"%s","ttl_seconds":300}' "$(now)" > "$G5b/.qa/state/preview/r1.json"
run_case "governed mode=off (justified) + inline (active) → allow" "$G5b" "$INLINE" 0

# ── 7. governed .appsec, state.gate_active=true → block inline ──
G6="$TMP/appsec-active"; mkdir -p "$G6/.appsec/state/preview-approved"
echo '{"strict_mode":"strict"}' > "$G6/.appsec/config.json"
echo '{"gate_active":true}' > "$G6/.appsec/state.json"
run_case "governed .appsec + state.gate_active + inline → block" "$G6" "$INLINE" 2

# ── 8. both domains present, .qa=off but .appsec=always → strictest (always) blocks ──
G7="$TMP/both"; mkdir -p "$G7/.qa/state/preview" "$G7/.appsec/state/preview-approved"
echo '{"qa_enforcement":"strict","governed_gate_mode":"off"}' > "$G7/.qa/config.json"
echo '{"strict_mode":"strict","governed_gate_mode":"always"}' > "$G7/.appsec/config.json"
run_case "both domains, strictest (always) wins + inline → block" "$G7" "$INLINE" 2

echo "---"
echo "governed-gate-guard: $pass PASS / $fail FAIL"
[ "$fail" = "0" ]
