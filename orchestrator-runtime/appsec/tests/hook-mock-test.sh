#!/usr/bin/env bash
#
# hook-mock-test.sh — Unit tests for ~/.claude/hooks/appsec-preview-gate.js
#
# Tests the PreToolUse gate against 12 fixture scenarios (covers caveat 10
# of the migration plan). Each test builds a mock {tool_name, tool_input}
# stdin payload + (optionally) writes/skips the sentinel file under a
# throwaway project root, then asserts the hook's exit code matches.
#
# Run from any cwd; the script self-isolates under $LOCALAPPDATA/Temp.

set -u  # not -e — we want to capture non-zero exits ourselves
HOOK_PATH="$HOME/.claude/hooks/appsec-preview-gate.js"
SHARED_DIR="$HOME/.claude/orchestrator-runtime/shared"

if [[ ! -f "$HOOK_PATH" ]]; then
  echo "FAIL: hook not found at $HOOK_PATH" >&2
  exit 2
fi
if ! command -v node >/dev/null 2>&1; then
  echo "FAIL: node not in PATH" >&2
  exit 2
fi

# Throwaway project root per run (collision-safe via $$ and SECONDS)
RUN_ID_BASE="hookmock-$$-$SECONDS"
SANDBOX_ROOT="${LOCALAPPDATA:-/tmp}/Temp/appsec-hook-tests-$RUN_ID_BASE"
SENTINEL_DIR="$SANDBOX_ROOT/.appsec/state/preview-approved"
mkdir -p "$SENTINEL_DIR"

cleanup() { rm -rf "$SANDBOX_ROOT" 2>/dev/null || true; }
trap cleanup EXIT

# ── helpers ─────────────────────────────────────────────────────────────
PASS_COUNT=0
FAIL_COUNT=0
FAIL_NAMES=()

# Minimal valid spec (matches workflow's expectations enough to pass arg-shape checks).
MINIMAL_SPEC='{
  "engine_version":"1.0",
  "orchestrator":"appsec",
  "phases":[{"name":"Scope","type":"single","prompt_ref":"scope.v1","schema_ref":"SCOPE_SCHEMA.v1","agentType":"appsec-risk-classifier"}],
  "prompts":{"scope.v1":"hello"},
  "schemas":{"SCOPE_SCHEMA.v1":{"type":"object"}}
}'

# Recompute spec_hash via canonical SHA-256 (per §1.11 correction #3).
# Helper emits new sha256: prefixed form.
compute_spec_hash() {
  node -e '
    const crypto = require("crypto");
    const obj = JSON.parse(process.argv[1]);
    function stable(o){
      if (o===null||o===undefined) return "null";
      if (typeof o!=="object") return JSON.stringify(o);
      if (Array.isArray(o)) return "["+o.map(stable).join(",")+"]";
      const k=Object.keys(o).sort();
      return "{"+k.map(x=>JSON.stringify(x)+":"+stable(o[x])).join(",")+"}";
    }
    process.stdout.write("sha256:" + crypto.createHash("sha256").update(stable(obj),"utf8").digest("hex"));
  ' "$1"
}
# Legacy djb2 helper kept for transition tests
compute_spec_hash_djb2_legacy() {
  node -e '
    const obj = JSON.parse(process.argv[1]);
    function stable(o){
      if (o===null||o===undefined) return "null";
      if (typeof o!=="object") return JSON.stringify(o);
      if (Array.isArray(o)) return "["+o.map(stable).join(",")+"]";
      const k=Object.keys(o).sort();
      return "{"+k.map(x=>JSON.stringify(x)+":"+stable(o[x])).join(",")+"}";
    }
    function djb2(s){let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(16).padStart(8,"0");}
    process.stdout.write(djb2(stable(obj)));
  ' "$1"
}

SPEC_HASH="$(compute_spec_hash "$MINIMAL_SPEC")"
SPEC_HASH_LEGACY="$(compute_spec_hash_djb2_legacy "$MINIMAL_SPEC")"

# build_payload <run_id> <spec_hash> [extra-fields-json]
# Emits a JSON {tool_name:"Workflow", tool_input:{name:"appsec-orchestrator", args:{...}}}
build_payload() {
  local run_id="$1" claimed_hash="$2" extras="${3:-{\}}"
  node -e '
    const runId = process.argv[1];
    const hash  = process.argv[2];
    const spec  = JSON.parse(process.argv[3]);
    const extras= JSON.parse(process.argv[4]);
    const payload = {
      tool_name: "Workflow",
      tool_input: Object.assign({
        name: "appsec-orchestrator",
        args: { spec, run_id: runId, spec_hash: hash }
      }, extras)
    };
    process.stdout.write(JSON.stringify(payload));
  ' "$run_id" "$claimed_hash" "$MINIMAL_SPEC" "$extras"
}

# build_sentinel <run_id> <spec_hash> <approved_at_ISO> <ttl_seconds> > <path>
write_sentinel() {
  local run_id="$1" hash="$2" approved_at="$3" ttl="$4" path="$5"
  cat > "$path" <<EOF
{
  "run_id": "$run_id",
  "spec_hash": "$hash",
  "preview_hash": "deadbeef",
  "approved_at": "$approved_at",
  "approval_text": "OK",
  "ttl_seconds": $ttl
}
EOF
}

# run_test <name> <expected_exit> <payload-stdin> [pre-action]
run_test() {
  local name="$1" expected="$2" payload="$3" pre_action="${4:-:}"
  eval "$pre_action"

  # Hook reads sentinel via process.cwd() → must cd into SANDBOX_ROOT
  local actual stderr_capture
  stderr_capture=$(mktemp)
  ( cd "$SANDBOX_ROOT" && printf '%s' "$payload" | node "$HOOK_PATH" 2>"$stderr_capture" )
  actual=$?

  if [[ "$actual" == "$expected" ]]; then
    printf "  PASS  %-40s exit=%d\n" "$name" "$actual"
    PASS_COUNT=$((PASS_COUNT+1))
  else
    printf "  FAIL  %-40s expected=%d got=%d\n" "$name" "$expected" "$actual"
    if [[ -s "$stderr_capture" ]]; then
      sed 's/^/        stderr: /' "$stderr_capture"
    fi
    FAIL_COUNT=$((FAIL_COUNT+1))
    FAIL_NAMES+=("$name")
  fi
  rm -f "$stderr_capture"
}

# Helper: ISO8601 UTC at now ± offset_seconds
iso_at_offset() {
  local offset="$1"  # signed integer seconds; 0 = now
  # `--` separates node options from positional args; otherwise -600 is parsed as flag.
  node -e '
    const off = Number(process.argv[1])||0;
    process.stdout.write(new Date(Date.now() + off*1000).toISOString());
  ' -- "$offset"
}

clear_sentinels() { rm -f "$SENTINEL_DIR"/*.json 2>/dev/null || true; }

# ── test fixtures ───────────────────────────────────────────────────────
echo "appsec-preview-gate.js unit tests"
echo "  sandbox = $SANDBOX_ROOT"
echo "  spec_hash = $SPEC_HASH"
echo ""

# Test 1: no sentinel exists → block (exit 2)
clear_sentinels
run_test "1.no-sentinel" 2 "$(build_payload "test1-run" "$SPEC_HASH")"

# Test 2: sentinel expired (approved_at older than ttl) → block
clear_sentinels
old_iso=$(iso_at_offset -600)  # 10 min ago
write_sentinel "test2-run" "$SPEC_HASH" "$old_iso" 300 "$SENTINEL_DIR/test2-run.json"
run_test "2.sentinel-expired" 2 "$(build_payload "test2-run" "$SPEC_HASH")"

# Test 3: sentinel.run_id mismatches args.run_id → block
clear_sentinels
fresh_iso=$(iso_at_offset 0)
write_sentinel "test3-different" "$SPEC_HASH" "$fresh_iso" 300 "$SENTINEL_DIR/test3-run.json"
run_test "3.sentinel-runid-mismatch" 2 "$(build_payload "test3-run" "$SPEC_HASH")"

# Test 4: sentinel.spec_hash mismatches recomputed → block
clear_sentinels
write_sentinel "test4-run" "00000000" "$fresh_iso" 300 "$SENTINEL_DIR/test4-run.json"
run_test "4.sentinel-spechash-mismatch" 2 "$(build_payload "test4-run" "$SPEC_HASH")"

# Test 5: args.spec_hash doesn't match recomputed → block (caller lied)
# Hook recomputes from args.spec; if it disagrees with claimed args.spec_hash, fail-closed.
clear_sentinels
write_sentinel "test5-run" "$SPEC_HASH" "$fresh_iso" 300 "$SENTINEL_DIR/test5-run.json"
run_test "5.args-spechash-lied" 2 "$(build_payload "test5-run" "deadbeef")"

# Test 6: valid sentinel + everything matches → allow (exit 0)
clear_sentinels
write_sentinel "test6-run" "$SPEC_HASH" "$fresh_iso" 300 "$SENTINEL_DIR/test6-run.json"
run_test "6.valid-allow" 0 "$(build_payload "test6-run" "$SPEC_HASH")"

# Test 7: tool_name != "Workflow" → allow (not our concern)
run_test "7.other-tool-allow" 0 '{"tool_name":"Bash","tool_input":{"command":"ls"}}'

# Test 8: tool_name == "Workflow" but name != "appsec-orchestrator" → allow
run_test "8.other-workflow-allow" 0 '{"tool_name":"Workflow","tool_input":{"name":"hello-test","args":{}}}'

# Test 9: malformed stdin JSON → block (fail-closed)
run_test "9.malformed-json-block" 2 '{not valid json'

# Test 10: empty stdin → block (fail-closed)
run_test "10.empty-stdin-block" 2 ''

# Test 11: approved_at in the future (clock skew) → block
clear_sentinels
future_iso=$(iso_at_offset 3600)  # 1h in future
write_sentinel "test11-run" "$SPEC_HASH" "$future_iso" 300 "$SENTINEL_DIR/test11-run.json"
run_test "11.future-approved_at-block" 2 "$(build_payload "test11-run" "$SPEC_HASH")"

# Test 12: sentinel JSON parse failure → block
clear_sentinels
printf '{ corrupted not json' > "$SENTINEL_DIR/test12-run.json"
run_test "12.sentinel-parse-fail-block" 2 "$(build_payload "test12-run" "$SPEC_HASH")"

# Bonus 13: missing args.run_id → block
clear_sentinels
run_test "13.missing-run_id-block" 2 '{"tool_name":"Workflow","tool_input":{"name":"appsec-orchestrator","args":{"spec":'"$MINIMAL_SPEC"',"spec_hash":"'"$SPEC_HASH"'"}}}'

# Bonus 14: scriptPath-based detection works equivalently to name
clear_sentinels
script_iso=$(iso_at_offset 0)
write_sentinel "test14-run" "$SPEC_HASH" "$script_iso" 300 "$SENTINEL_DIR/test14-run.json"
run_test "14.scriptPath-detection-allow" 0 '{"tool_name":"Workflow","tool_input":{"scriptPath":"~/.claude/workflows/appsec-orchestrator.js","args":{"spec":'"$MINIMAL_SPEC"',"run_id":"test14-run","spec_hash":"'"$SPEC_HASH"'"}}}'

# Bonus 15: ttl below floor (1 second) still bounded to ABSOLUTE_MIN_TTL=30, fresh sentinel passes
clear_sentinels
write_sentinel "test15-run" "$SPEC_HASH" "$(iso_at_offset 0)" 1 "$SENTINEL_DIR/test15-run.json"
run_test "15.ttl-below-floor-still-allow" 0 "$(build_payload "test15-run" "$SPEC_HASH")"

# Bonus 16: ttl above cap (99999) gets clamped to 3600
clear_sentinels
write_sentinel "test16-run" "$SPEC_HASH" "$(iso_at_offset 0)" 99999 "$SENTINEL_DIR/test16-run.json"
run_test "16.ttl-above-cap-still-allow" 0 "$(build_payload "test16-run" "$SPEC_HASH")"

# Bonus 17: path-traversal in run_id is sanitized — sentinel filename uses safe form
clear_sentinels
# Hook computes safeId = runId.replace(/[^A-Za-z0-9._-]/g,'_')
# `.` and `-` are kept; `/` becomes `_`. So "../etc/passwd" → ".._etc_passwd".
# We create that exact sanitized filename and confirm hook reads it (i.e. no \..\ traversal can occur).
write_sentinel "../etc/passwd" "$SPEC_HASH" "$(iso_at_offset 0)" 300 "$SENTINEL_DIR/.._etc_passwd.json"
run_test "17.path-traversal-runid-sanitized" 0 "$(build_payload "../etc/passwd" "$SPEC_HASH")"

# ── §1.11 correction #3: SHA-256 spec_hash migration ──────────────────
# Test 20: sentinel + args both use NEW sha256: form → allow
clear_sentinels
write_sentinel "test20-run" "$SPEC_HASH" "$(iso_at_offset 0)" 300 "$SENTINEL_DIR/test20-run.json"
run_test "20.sha256-new-form-allow" 0 "$(build_payload "test20-run" "$SPEC_HASH")"

# Test 21: sentinel + args both use LEGACY djb2 bare form → still allow (backward compat)
clear_sentinels
write_sentinel "test21-run" "$SPEC_HASH_LEGACY" "$(iso_at_offset 0)" 300 "$SENTINEL_DIR/test21-run.json"
run_test "21.djb2-legacy-bare-allow" 0 "$(build_payload "test21-run" "$SPEC_HASH_LEGACY")"

# Test 22: sentinel uses legacy djb2, args claims new sha256 → both verify against spec → allow
# (real-world transition: sentinel written before migration, args after)
clear_sentinels
write_sentinel "test22-run" "$SPEC_HASH_LEGACY" "$(iso_at_offset 0)" 300 "$SENTINEL_DIR/test22-run.json"
run_test "22.mixed-sentinel-legacy-args-new-allow" 0 "$(build_payload "test22-run" "$SPEC_HASH")"

# Test 23: garbage spec_hash → still block
clear_sentinels
write_sentinel "test23-run" "$SPEC_HASH" "$(iso_at_offset 0)" 300 "$SENTINEL_DIR/test23-run.json"
run_test "23.garbage-spec-hash-block" 2 "$(build_payload "test23-run" "sha256:0000000000000000000000000000000000000000000000000000000000000000")"

# ── R10 / Patch A.1.3 configurable TTL round-trip ──────────────────────
# Skill is supposed to set sentinel.ttl_seconds from .appsec/config.json.preview_approval_ttl_seconds.
# Hook must honor that file value when computing expiry (still clamped to [30, 3600]).

# Test 18: configured ttl=60s, approved 30s ago → within window → allow
clear_sentinels
write_sentinel "test18-run" "$SPEC_HASH" "$(iso_at_offset -30)" 60 "$SENTINEL_DIR/test18-run.json"
run_test "18.config-ttl-60s-30s-old-allow" 0 "$(build_payload "test18-run" "$SPEC_HASH")"

# Test 19: configured ttl=60s but approved 65s ago → expired → block
# NOTE: hook floors ttl to ABSOLUTE_MIN_TTL=30, so ttl=60 stays at 60. Expiry hits at 60s past approved_at.
clear_sentinels
write_sentinel "test19-run" "$SPEC_HASH" "$(iso_at_offset -65)" 60 "$SENTINEL_DIR/test19-run.json"
run_test "19.config-ttl-60s-65s-old-block" 2 "$(build_payload "test19-run" "$SPEC_HASH")"

# ── summary ─────────────────────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────"
echo "  PASS: $PASS_COUNT"
echo "  FAIL: $FAIL_COUNT"
if (( FAIL_COUNT > 0 )); then
  echo "  Failed tests:"
  for n in "${FAIL_NAMES[@]}"; do
    echo "    - $n"
  done
  exit 1
fi
echo "  All tests passed."
exit 0
