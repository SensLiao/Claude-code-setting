#!/usr/bin/env bash
# qa-parsers-smoke.sh — fixture-based determinism + correctness test for every
# deterministic parser under scripts/qa-parsers/. Each parser is the tamper-evidence
# anchor: qa-recompute-gate.js re-runs it over the same raw bytes and deep-compares
# to the recorded parsed_metrics, so a parser MUST be (a) correct and (b) byte-stable.
# This test feeds a known fixture, asserts the exact expected JSON, then re-runs and
# asserts identical output (determinism). Exit 0 only if all parsers pass.
set -u
PARSERS="$HOME/.claude/scripts/qa-parsers"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
fail=0
total=0

# assert <name> <parser-file> <fixture-file> <expected-json>
assert_parser() {
  local name="$1" parser="$2" fixture="$3" expected="$4"
  total=$((total+1))
  local out1 out2
  out1=$(node "$PARSERS/$parser" "$fixture" 2>/dev/null)
  local ec=$?
  out2=$(node "$PARSERS/$parser" "$fixture" 2>/dev/null)
  if [[ $ec -ne 0 ]]; then
    printf "  %-22s FAIL (exit %d)\n" "$name" "$ec"; fail=$((fail+1)); return
  fi
  if [[ "$out1" != "$expected" ]]; then
    printf "  %-22s FAIL\n     expected: %s\n     got:      %s\n" "$name" "$expected" "$out1"; fail=$((fail+1)); return
  fi
  if [[ "$out1" != "$out2" ]]; then
    printf "  %-22s FAIL (non-deterministic: %s != %s)\n" "$name" "$out1" "$out2"; fail=$((fail+1)); return
  fi
  printf "  %-22s PASS\n" "$name"
}

echo "qa-parsers-smoke: fixture correctness + determinism"

# ── tsc ──
printf "src/a.ts(1,2): error TS2304: Cannot find name 'x'.\nFound 1 error in src/a.ts\n" > "$TMP/tsc.txt"
assert_parser "qa-parse-tsc" qa-parse-tsc.js "$TMP/tsc.txt" '{"tsc_errors":1}'

# ── eslint ──
cat > "$TMP/eslint.json" <<'EOF'
[{"filePath":"a.ts","errorCount":2,"warningCount":1,"messages":[{"severity":2},{"severity":2},{"severity":1}]},
 {"filePath":"b.ts","errorCount":0,"warningCount":0,"messages":[]}]
EOF
assert_parser "qa-parse-eslint" qa-parse-eslint.js "$TMP/eslint.json" '{"eslint_findings":{"errors":2,"warnings":1}}'

# ── npm audit ──
echo '{"metadata":{"vulnerabilities":{"info":0,"low":1,"moderate":2,"high":3,"critical":1,"total":7}}}' > "$TMP/npm.json"
assert_parser "qa-parse-npm-audit" qa-parse-npm-audit.js "$TMP/npm.json" '{"npm_audit_critical_count":1,"npm_audit_high_count":3}'

# ── coverage (istanbul summary) ──
echo '{"total":{"lines":{"pct":92.5},"statements":{"pct":91},"functions":{"pct":88},"branches":{"pct":80}}}' > "$TMP/cov.json"
assert_parser "qa-parse-coverage" qa-parse-coverage.js "$TMP/cov.json" '{"line_pct":92.5,"branch_pct":80,"statement_pct":91,"function_pct":88,"coverage_pct":92.5}'

# ── junit xml ──
cat > "$TMP/junit.xml" <<'EOF'
<?xml version="1.0"?>
<testsuites tests="10" failures="1" errors="0" skipped="2">
  <testsuite name="s" tests="10" failures="1" errors="0" skipped="2"></testsuite>
</testsuites>
EOF
assert_parser "qa-parse-junit" qa-parse-junit.js "$TMP/junit.xml" '{"tests":10,"failures":1,"errors":0,"skipped":2,"passed":7}'

# ── playwright json ──
echo '{"stats":{"expected":8,"unexpected":1,"flaky":1,"skipped":0}}' > "$TMP/pw.json"
assert_parser "qa-parse-playwright" qa-parse-playwright.js "$TMP/pw.json" '{"passed":8,"failed":1,"flaky":1,"skipped":0,"tests":10}'

# ── k6 summary json (threshold .ok, NOT exit code) ──
cat > "$TMP/k6.json" <<'EOF'
{"metrics":{
  "http_req_duration":{"values":{"p(95)":240.5},"thresholds":{"p(95)<500":{"ok":true}}},
  "http_req_failed":{"values":{"rate":0.001},"thresholds":{"rate<0.01":{"ok":true}}},
  "checks":{"values":{"rate":1}}}}
EOF
assert_parser "qa-parse-k6" qa-parse-k6.js "$TMP/k6.json" '{"thresholds_ok":true,"failed_thresholds":[],"p95_ms":240.5,"error_rate":0.001,"checks_pass_rate":1}'

# ── stryker mutation report ──
cat > "$TMP/stryker.json" <<'EOF'
{"files":{"a.ts":{"mutants":[
  {"status":"Killed"},{"status":"Killed"},{"status":"Survived"},{"status":"Timeout"},{"status":"NoCoverage"}]}}}
EOF
assert_parser "qa-parse-stryker" qa-parse-stryker.js "$TMP/stryker.json" '{"mutation_score":60,"killed":2,"survived":1,"timeout":1,"no_coverage":1,"total":5}'

# ── lighthouse json ──
cat > "$TMP/lh.json" <<'EOF'
{"audits":{
  "largest-contentful-paint":{"numericValue":1800.4},
  "total-blocking-time":{"numericValue":120.7},
  "cumulative-layout-shift":{"numericValue":0.023},
  "first-contentful-paint":{"numericValue":900.2},
  "speed-index":{"numericValue":2100.9}},
 "categories":{"performance":{"score":0.92}}}
EOF
assert_parser "qa-parse-lighthouse" qa-parse-lighthouse.js "$TMP/lh.json" '{"metrics":{"lcp_ms":1800,"tbt_ms":121,"cls":0.023,"fcp_ms":900,"speed_index":2101,"lighthouse_perf_score":92}}'

# ── axe json ──
echo '{"violations":[{"id":"color-contrast","impact":"serious"},{"id":"label","impact":"critical"}]}' > "$TMP/axe.json"
assert_parser "qa-parse-axe" qa-parse-axe.js "$TMP/axe.json" '{"violations":[{"rule_id":"color-contrast","impact":"serious"},{"rule_id":"label","impact":"critical"}],"violation_summary":{"critical":1,"serious":1,"moderate":0,"minor":0,"total":2},"violating_surfaces_count":1}'

# ── negative: malformed input must FAIL the parser (→ PARSER_FAILED → gate BLOCK) ──
total=$((total+1))
echo 'not json at all {{{' > "$TMP/bad.json"
if node "$PARSERS/qa-parse-axe.js" "$TMP/bad.json" >/dev/null 2>&1; then
  printf "  %-22s FAIL (malformed input should exit non-zero)\n" "negative-malformed"; fail=$((fail+1))
else
  printf "  %-22s PASS\n" "negative-malformed"
fi

echo "---"
echo "qa-parsers: $total tested, $((total-fail)) PASS, $fail FAIL"
[[ $fail -eq 0 ]]
