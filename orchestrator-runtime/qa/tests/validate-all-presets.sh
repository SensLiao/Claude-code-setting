#!/usr/bin/env bash
# validate-all-presets.sh — run shared/validate-spec.js on every QA preset.
# Exit 0 if all PASS; 1 if any FAIL with structured output.
set -u
RUNTIME_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
VALIDATOR="$RUNTIME_DIR/shared/validate-spec.js"
PRESET_DIR="$RUNTIME_DIR/qa/presets"

if [[ ! -f "$VALIDATOR" ]]; then
  echo "internal: validate-spec.js not found at $VALIDATOR" >&2
  exit 3
fi

fail=0
total=0
for f in "$PRESET_DIR"/*.json; do
  total=$((total+1))
  # Only capture stdout (validator JSON); discard stderr to avoid corrupting JSON.parse.
  result_json="$(node "$VALIDATOR" "$f" 2>/dev/null || true)"
  ok=$(printf '%s' "$result_json" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const j=JSON.parse(d);console.log(j.ok===true?"PASS":"FAIL")}catch{console.log("PARSE_ERR")}})')
  printf "%-55s %s\n" "$(basename "$f")" "$ok"
  if [[ "$ok" != "PASS" ]]; then
    fail=$((fail+1))
    printf '%s\n' "$result_json" | sed 's/^/    /'
  fi
done

echo "---"
echo "QA presets: $total tested, $((total-fail)) PASS, $fail FAIL"

# ── Policy A model-tier lint (no haiku in real gates / no opus in fanout) ──
echo ""
echo "lint-model-policy: scanning $PRESET_DIR"
if ! node "$RUNTIME_DIR/shared/lint-model-policy.js" "$PRESET_DIR"; then
  fail=$((fail+1))
fi

[[ $fail -eq 0 ]]
