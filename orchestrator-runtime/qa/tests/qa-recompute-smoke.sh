#!/usr/bin/env bash
# qa-recompute-smoke.sh — end-to-end proof of 承重柱 1 (default-mode recompute).
# Exercises: qa-sdk evidence.run (capture+hash+parse+merge) → qa-recompute-gate.js
# (re-hash + re-parse + re-derive + compare) → gate.check wiring.
#
# Scenarios:
#   A honest static (0 tsc errors) + declared PASS         → recompute exit 0 (agree)
#   B static with 3 errors        + declared PASS          → recompute exit 2 (declared too lenient)
#   C honest 3 errors, parsed_metrics TAMPERED to 0        → recompute exit 2 (PARSED_METRICS_FABRICATED)
#   D gate.check: bundle says PASS but static fails        → gate.check exit 2 (recompute blocks)
#   E gate.check: bundle PASS + honest static              → gate.check exit 0 (happy path intact)
#
# Run:  bash orchestrator-runtime/qa/tests/qa-recompute-smoke.sh
# Exit: 0 = all scenarios behaved as expected / 1 = a regression

set -u
QA="$HOME/.claude/scripts/qa-sdk.sh"
ENGINE="$HOME/.claude/orchestrator-runtime/shared/qa-recompute-gate.js"
FAILS=0

expect() { # label actual expected
  if [[ "$2" == "$3" ]]; then echo "  ok   $1 (exit $2)"; else echo "  FAIL $1 (exit $2, expected $3)"; FAILS=$((FAILS+1)); fi
}

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/.qa"
printf '{"version":"1.0","qa_enforcement":"strict","default_mode":"execution","evidence_freshness_hours":168}\n' > "$TMP/.qa/config.json"
cd "$TMP" || exit 1

ctx() { # tag — write recompute-context.json selecting only Static
  printf '{"selected_layers":["Static"],"policy":{"static_floor":{}},"risk_snapshot":null,"critical_release_paths":[]}\n' \
    > "$TMP/.qa/evidence/$1/recompute-context.json"
}

echo "[A] honest static, declared PASS → expect recompute OK"
bash "$QA" init A >/dev/null
bash "$QA" evidence.run A Static --command-id tsc --parser qa-parse-tsc@1 --state-node StaticBaseline -- \
  node -e "process.stdout.write('Found 0 errors.')" >/dev/null
ctx A
node "$ENGINE" --tag A --project-root "$TMP" --declared PASS >/dev/null 2>&1; expect "A recompute" $? 0

echo "[B] static 3 errors, declared PASS → expect recompute BLOCK"
bash "$QA" init B >/dev/null
bash "$QA" evidence.run B Static --command-id tsc --parser qa-parse-tsc@1 --state-node StaticBaseline -- \
  node -e "process.stdout.write('a(1,1): error TS1: x\nb(2,2): error TS2: y\nc(3,3): error TS3: z\nFound 3 errors.')" >/dev/null
ctx B
node "$ENGINE" --tag B --project-root "$TMP" --declared PASS >/dev/null 2>&1; expect "B recompute" $? 2

echo "[C] honest 3 errors but parsed_metrics tampered to 0 → expect recompute BLOCK (fabrication)"
bash "$QA" init C >/dev/null
bash "$QA" evidence.run C Static --command-id tsc --parser qa-parse-tsc@1 --state-node StaticBaseline -- \
  node -e "process.stdout.write('a(1,1): error TS1: x\nb(2,2): error TS2: y\nc(3,3): error TS3: z\nFound 3 errors.')" >/dev/null
ctx C
# tamper: lie that tsc_errors=0 in BOTH derived and the command_evidence record, leave stdout untouched
node -e "
  const fs=require('fs'); const p=process.argv[1];
  const j=JSON.parse(fs.readFileSync(p,'utf8'));
  j.derived.tsc_errors=0; j.command_evidence[0].parsed_metrics.tsc_errors=0;
  fs.writeFileSync(p, JSON.stringify(j,null,2));
" "$TMP/.qa/evidence/C/Static.json"
node "$ENGINE" --tag C --project-root "$TMP" --declared PASS >/dev/null 2>&1; expect "C recompute" $? 2

echo "[D] gate.check: bundle PASS but static fails → expect gate.check BLOCK"
bash "$QA" init D >/dev/null
bash "$QA" evidence.run D Static --command-id tsc --parser qa-parse-tsc@1 --state-node StaticBaseline -- \
  node -e "process.stdout.write('a(1,1): error TS1: x\nFound 1 error.')" >/dev/null
ctx D
printf '{"release_decision":"PASS","generated_at":"%s"}' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  | bash "$QA" evidence.append D qa_evidence_bundle >/dev/null
bash "$QA" gate.check D >/dev/null 2>&1; expect "D gate.check" $? 2

echo "[E] gate.check: bundle PASS + honest static → expect gate.check PASS"
bash "$QA" init E >/dev/null
bash "$QA" evidence.run E Static --command-id tsc --parser qa-parse-tsc@1 --state-node StaticBaseline -- \
  node -e "process.stdout.write('Found 0 errors.')" >/dev/null
ctx E
printf '{"release_decision":"PASS","generated_at":"%s"}' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  | bash "$QA" evidence.append E qa_evidence_bundle >/dev/null
bash "$QA" gate.check E >/dev/null 2>&1; expect "E gate.check" $? 0

echo ""
if (( FAILS == 0 )); then echo "qa-recompute-smoke: ALL PASS"; exit 0
else echo "qa-recompute-smoke: $FAILS FAILURE(S)"; exit 1; fi
