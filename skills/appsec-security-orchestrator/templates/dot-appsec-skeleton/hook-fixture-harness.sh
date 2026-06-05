#!/usr/bin/env bash
# P5 — AppSec hook fixture harness.
# Spins up a project root with .appsec/config.json + .planning/PENTEST-ROE.md,
# pipes purpose-built JSON fixtures into each of the 7 hooks via stdin,
# captures (exit, stderr, stdout), asserts expected behavior.
#
# Result: a PASS/FAIL matrix printed to stdout.

set -u

HOOKS="$HOME/.claude/hooks"
SDK="$HOME/.claude/scripts/appsec-sdk.sh"
T=$(mktemp -d -p /tmp appsec-fixt.XXXX)
mkdir -p "$T/.appsec" "$T/.planning"

# Path translation: Bash uses MSYS path /tmp/...; Node.js on Windows needs Windows-style path.
# Use cygpath -m for mixed format (C:/foo) which works in both JSON strings and Node fs.
to_win() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -m "$1"
  else
    printf '%s' "$1"
  fi
}
TW=$(to_win "$T")
HOOKSW=$(to_win "$HOOKS")
# Helper that JSON-escapes a string for embedding (path uses forward slashes already, so usually safe).
json_str() {
  node -e "process.stdout.write(JSON.stringify(process.argv[1]))" -- "$1"
}

# Minimal config
cat > "$T/.appsec/config.json" <<EOF
{
  "schema_version": "1.0",
  "asvs_level": "L2",
  "csf_targets": ["GV","ID","PR","DE","RS","RC"],
  "overlays": [],
  "strict_mode": "strict",
  "production_hosts": ["prod.example.com"],
  "staging_hosts": ["staging.example.com"],
  "active_roe": null
}
EOF

# Minimal state (init a tag so evidence-required can find it).
# NOTE (E7 2026-06-05): the init MUST run AFTER `cd "$T"`. A stray pre-cd `init` here previously
# ran with cwd = wherever the harness was invoked from and polluted that dir with .appsec/ + .claude/
# (appsec-sdk init resolves PROJECT_ROOT to cwd when no .appsec/config.json is found above).
cd "$T"
bash "$SDK" init t1 >/dev/null

# Helper: run a fixture
declare -i PASS=0 FAIL=0
declare -a FAILS=()
run() {
  local id="$1" hook="$2" expected_exit="$3" expected_pattern="$4" stdin_payload="$5" expected_stream="${6:-stderr}"
  local out err code
  out=$(printf '%s' "$stdin_payload" | node "$HOOKS/$hook" 2>/tmp/_e1)
  code=$?
  err=$(cat /tmp/_e1)
  local stream="$err"
  [[ "$expected_stream" == "stdout" ]] && stream="$out"

  if [[ "$code" -eq "$expected_exit" ]] && { [[ -z "$expected_pattern" ]] || printf '%s' "$stream" | grep -qE "$expected_pattern"; }; then
    PASS+=1
    printf "PASS  %-50s  exit=%d\n" "$id" "$code"
  else
    FAIL+=1
    FAILS+=("$id (expected exit=$expected_exit pattern='$expected_pattern' got exit=$code stream=$expected_stream='$stream')")
    printf "FAIL  %-50s  exit=%d  (expected %d, pattern='%s')\n" "$id" "$code" "$expected_exit" "$expected_pattern"
  fi
}

# ──────── §18.1 secret-redaction ────────
run "secret-redaction/clean" "appsec-secret-redaction.js" 0 "" \
  "$(printf '{"cwd":"%s","last_assistant_message":"audit complete, no findings"}' "$TW")"

run "secret-redaction/aws-key-in-message" "appsec-secret-redaction.js" 0 "aws_access_key" \
  "$(printf '{"cwd":"%s","last_assistant_message":"leaked: AKIAIOSFODNN7EXAMPLE"}' "$TW")" stdout

run "secret-redaction/redacted-marker-clean" "appsec-secret-redaction.js" 0 "" \
  "$(printf '{"cwd":"%s","last_assistant_message":"key was <REDACTED:aws_access_key>"}' "$TW")"

run "secret-redaction/stop-hook-active-yields" "appsec-secret-redaction.js" 0 "" \
  "$(printf '{"cwd":"%s","stop_hook_active":true,"last_assistant_message":"AKIAIOSFODNN7EXAMPLE"}' "$TW")"

# ──────── §18.2 active-scan-guard ────────
# Non-Bash → pass
run "active-scan-guard/non-bash-pass" "appsec-active-scan-guard.js" 0 "" \
  "$(printf '{"cwd":"%s","tool_name":"Read","tool_input":{}}' "$TW")"

# nmap no ROE → block
run "active-scan-guard/nmap-no-roe-block" "appsec-active-scan-guard.js" 2 "active_roe is null" \
  "$(printf '{"cwd":"%s","tool_name":"Bash","tool_input":{"command":"nmap -sV staging.example.com"}}' "$TW")"

# sqlmap no ROE → block
run "active-scan-guard/sqlmap-no-roe-block" "appsec-active-scan-guard.js" 2 "active_roe" \
  "$(printf '{"cwd":"%s","tool_name":"Bash","tool_input":{"command":"sqlmap -u https://staging.example.com/api?id=1"}}' "$TW")"

# Production host with ROE → still block
cat > "$T/.planning/ROE-prod.md" <<'EOF'
target_identification: prod.example.com
authorization_proof: ticket-123
environment: production
scope: prod.example.com
in_scope: [prod.example.com]
allowed_methods: passive
disallowed_methods: destructive
time_window_start: 2026-01-01T00:00:00Z
time_window_end: 2026-12-31T23:59:59Z
rate_limits: 10rps
test_accounts: testacct
data_handling: redact
emergency_contact: oncall@example.com
rollback: revert-config
reporting_format: STRIDE
EOF
# Set active_roe in config (mutate)
node -e "
const fs=require('fs');
const p='$TW/.appsec/config.json';
const c=JSON.parse(fs.readFileSync(p,'utf8'));
c.active_roe='.planning/ROE-prod.md';
fs.writeFileSync(p, JSON.stringify(c,null,2));
"
run "active-scan-guard/prod-host-hard-deny" "appsec-active-scan-guard.js" 2 "PRODUCTION host" \
  "$(printf '{"cwd":"%s","tool_name":"Bash","tool_input":{"command":"nmap -sV prod.example.com"}}' "$TW")"

# Reset for staging test
cat > "$T/.planning/ROE-staging.md" <<'EOF'
target_identification: staging.example.com
authorization_proof: ticket-456
environment: staging
scope: staging.example.com
in_scope: [staging.example.com]
allowed_methods: passive,light_active
disallowed_methods: destructive,dos
time_window_start: 2026-01-01T00:00:00Z
time_window_end: 2026-12-31T23:59:59Z
rate_limits: 10rps
test_accounts: testacct
data_handling: redact
emergency_contact: oncall@example.com
rollback: revert-config
reporting_format: STRIDE
EOF
node -e "
const fs=require('fs');
const p='$TW/.appsec/config.json';
const c=JSON.parse(fs.readFileSync(p,'utf8'));
c.active_roe='.planning/ROE-staging.md';
fs.writeFileSync(p, JSON.stringify(c,null,2));
"
run "active-scan-guard/staging-with-roe-allow" "appsec-active-scan-guard.js" 0 "" \
  "$(printf '{"cwd":"%s","tool_name":"Bash","tool_input":{"command":"nmap -sV staging.example.com"}}' "$TW")"

# Off-scope target with ROE → block
run "active-scan-guard/off-scope-block" "appsec-active-scan-guard.js" 2 "not in ROE" \
  "$(printf '{"cwd":"%s","tool_name":"Bash","tool_input":{"command":"nmap -sV other.example.com"}}' "$TW")"

# Innocuous bash → pass
run "active-scan-guard/innocuous-ls-pass" "appsec-active-scan-guard.js" 0 "" \
  "$(printf '{"cwd":"%s","tool_name":"Bash","tool_input":{"command":"ls -la"}}' "$TW")"

# Reset active_roe to null for subsequent tests
node -e "
const fs=require('fs');
const p='$TW/.appsec/config.json';
const c=JSON.parse(fs.readFileSync(p,'utf8'));
c.active_roe=null;
fs.writeFileSync(p, JSON.stringify(c,null,2));
"

# ──────── §18.3 pentest-authorization ────────
# No ROE file → block
run "pentest-auth/no-roe-block" "appsec-pentest-authorization.js" 2 "no ROE file found|PENTEST-ROE.md not found" \
  "$(printf '{"cwd":"%s","tool_name":"Skill","tool_input":{"skill_name":"authorized-pentest-validation"}}' "$TW")"

# ROE incomplete → block (only first 2 fields)
cat > "$T/.planning/PENTEST-ROE.md" <<'EOF'
target_identification: staging.example.com
authorization_proof: ticket-789
EOF
run "pentest-auth/incomplete-roe-block" "appsec-pentest-authorization.js" 2 "13-item checklist failed|11-item checklist failed" \
  "$(printf '{"cwd":"%s","tool_name":"Skill","tool_input":{"skill_name":"authorized-pentest-validation"}}' "$TW")"

# Full ROE but no user signoff → block
cat > "$T/.planning/PENTEST-ROE.md" <<'EOF'
target_identification: staging.example.com
authorization_proof: ticket-789
environment: staging
scope: staging.example.com
allowed_methods: passive
disallowed_methods: destructive
time_window: 2026-01-01 to 2026-12-31
time_window_start: 2026-01-01T00:00:00Z
time_window_end: 2026-12-31T23:59:59Z
rate_limits: 10rps
test_accounts: testacct
data_handling: redact
emergency_contact: oncall@example.com
rollback: revert
reporting_format: STRIDE
EOF
run "pentest-auth/no-signoff-block" "appsec-pentest-authorization.js" 2 "sign-off phrase" \
  "$(printf '{"cwd":"%s","tool_name":"Skill","tool_input":{"skill_name":"authorized-pentest-validation"},"user_prompt":"please run pentest"}' "$TW")"

# Full ROE + signoff → pass
run "pentest-auth/full-pass" "appsec-pentest-authorization.js" 0 "" \
  "$(printf '{"cwd":"%s","tool_name":"Skill","tool_input":{"skill_name":"authorized-pentest-validation"},"user_prompt":"I authorize this pentest validation per ROE"}' "$TW")"

# Non-target tool → pass
run "pentest-auth/other-skill-pass" "appsec-pentest-authorization.js" 0 "" \
  "$(printf '{"cwd":"%s","tool_name":"Skill","tool_input":{"skill_name":"some-other-skill"}}' "$TW")"

# ──────── §18.4 evidence-required (Stop) ────────
# No claim → pass
run "evidence-required/no-claim-pass" "appsec-evidence-required.js" 0 "" \
  "$(printf '{"cwd":"%s","last_assistant_message":"working on it"}' "$TW")"

# Claim but no decision.yaml → block (strict)
run "evidence-required/claim-no-decision-block" "appsec-evidence-required.js" 0 "appsec_release_decision.yaml does not exist|no active release tag" \
  "$(printf '{"cwd":"%s","last_assistant_message":"AppSec review complete, ready to ship"}' "$TW")" stdout

# Now craft a passing decision and retry
mkdir -p "$T/.appsec/decisions/t1"
cat > "$T/.appsec/decisions/t1/appsec_release_decision.yaml" <<'EOF'
schema_version: 1.0
release_tag: t1
decision: PASS
redaction:
  attested: true
  method: gitleaks --redact
EOF
run "evidence-required/claim-with-pass-decision" "appsec-evidence-required.js" 0 "" \
  "$(printf '{"cwd":"%s","last_assistant_message":"AppSec done"}' "$TW")"

# Mutate decision to FAIL → block
sed -i 's/^decision: PASS/decision: FAIL/' "$T/.appsec/decisions/t1/appsec_release_decision.yaml"
run "evidence-required/claim-with-fail-decision-block" "appsec-evidence-required.js" 0 "not PASS or CONDITIONAL_PASS" \
  "$(printf '{"cwd":"%s","last_assistant_message":"appsec done"}' "$TW")" stdout
sed -i 's/^decision: FAIL/decision: PASS/' "$T/.appsec/decisions/t1/appsec_release_decision.yaml"

# Lax mode → warn-only
node -e "
const fs=require('fs');
const p='$TW/.appsec/config.json';
const c=JSON.parse(fs.readFileSync(p,'utf8'));
c.strict_mode='lax';
fs.writeFileSync(p, JSON.stringify(c,null,2));
"
rm "$T/.appsec/decisions/t1/appsec_release_decision.yaml"
run "evidence-required/claim-no-decision-lax-warn" "appsec-evidence-required.js" 0 "" \
  "$(printf '{"cwd":"%s","last_assistant_message":"appsec done"}' "$TW")"
# Restore strict + decision
node -e "
const fs=require('fs');
const p='$TW/.appsec/config.json';
const c=JSON.parse(fs.readFileSync(p,'utf8'));
c.strict_mode='strict';
fs.writeFileSync(p, JSON.stringify(c,null,2));
"

# ──────── §18.5a finding-schema-prewrite ────────
# Direct Write without marker → block
run "schema-prewrite/direct-write-block" "appsec-finding-schema-prewrite.js" 2 "Use .appsec-sdk finding.add. canonical|canonical write path" \
  "$(printf '{"cwd":"%s","tool_name":"Write","tool_input":{"file_path":".appsec/findings/t1/x.yaml","content":"schema_version: 1.0"}}' "$TW")"

# With marker + valid schema → pass
VALID_CONTENT="# written-by: appsec-sdk@3.0.0
schema_version: 1.0
id: t-001
source: sast
detector: x@1
severity: high
confidence: medium
asvs_mapping: [v5.0.0-6.2.1]
csf_function: PR
description: legit"
ESCAPED=$(printf '%s' "$VALID_CONTENT" | node -e "process.stdout.write(JSON.stringify(require('fs').readFileSync(0,'utf8')))")
run "schema-prewrite/marker-valid-pass" "appsec-finding-schema-prewrite.js" 0 "" \
  "$(printf '{"cwd":"%s","tool_name":"Write","tool_input":{"file_path":".appsec/findings/t1/x.yaml","content":%s}}' "$TW" "$ESCAPED")"

# Marker + ASVS 4.x → block
ASVS4_CONTENT="# written-by: appsec-sdk@3.0.0
schema_version: 1.0
id: t-002
source: sast
detector: x@1
severity: high
confidence: medium
asvs_mapping: [V6.2.1]
csf_function: PR
description: legacy"
ESCAPED=$(printf '%s' "$ASVS4_CONTENT" | node -e "process.stdout.write(JSON.stringify(require('fs').readFileSync(0,'utf8')))")
run "schema-prewrite/marker-asvs4-block" "appsec-finding-schema-prewrite.js" 2 "ASVS 4.x" \
  "$(printf '{"cwd":"%s","tool_name":"Write","tool_input":{"file_path":".appsec/findings/t1/x.yaml","content":%s}}' "$TW" "$ESCAPED")"

# Marker + raw secret → block
LEAK_CONTENT="# written-by: appsec-sdk@3.0.0
schema_version: 1.0
id: t-003
source: secret_scan
detector: gitleaks@8
severity: critical
confidence: high
asvs_mapping: [v5.0.0-6.2.1]
csf_function: PR
description: leaked AKIAIOSFODNN7EXAMPLE in config"
ESCAPED=$(printf '%s' "$LEAK_CONTENT" | node -e "process.stdout.write(JSON.stringify(require('fs').readFileSync(0,'utf8')))")
run "schema-prewrite/marker-raw-secret-block" "appsec-finding-schema-prewrite.js" 2 "raw secret" \
  "$(printf '{"cwd":"%s","tool_name":"Write","tool_input":{"file_path":".appsec/findings/t1/x.yaml","content":%s}}' "$TW" "$ESCAPED")"

# Non-appsec path → pass
run "schema-prewrite/other-path-pass" "appsec-finding-schema-prewrite.js" 0 "" \
  "$(printf '{"cwd":"%s","tool_name":"Write","tool_input":{"file_path":"src/app.js","content":"console.log(1)"}}' "$TW")"

# ──────── §18.5b finding-schema-postverify ────────
# This is audit-only — exit 0, but quarantines on drift
# Land a bad file directly, then invoke postverify
mkdir -p "$T/.appsec/findings/t1"
cat > "$T/.appsec/findings/t1/drift.yaml" <<'EOF'
schema_version: 1.0
id: t-004
source: sast
detector: x@1
severity: high
confidence: medium
asvs_mapping: [V6.2.1]
csf_function: PR
description: drift
EOF
run "schema-postverify/quarantines-asvs4" "appsec-finding-schema-postverify.js" 0 "" \
  "$(printf '{"cwd":"%s","tool_name":"Write","tool_input":{"file_path":"%s/.appsec/findings/t1/drift.yaml"}}' "$TW" "$TW")"
if [[ -f "$T/.appsec/findings/t1/.quarantine/drift.yaml" ]] && [[ -f "$T/.appsec/findings/t1/.quarantine/drift.yaml.reason.txt" ]]; then
  PASS+=1
  printf "PASS  %-50s  (quarantine + reason.txt present)\n" "schema-postverify/quarantine-files-exist"
else
  FAIL+=1
  FAILS+=("schema-postverify/quarantine-files-exist (quarantine not created)")
  printf "FAIL  %-50s\n" "schema-postverify/quarantine-files-exist"
fi

# ──────── §18.6 secret-access-guard ────────
run "secret-access-guard/read-env-block" "appsec-secret-access-guard.js" 2 "sensitive path" \
  "$(printf '{"cwd":"%s","tool_name":"Read","tool_input":{"file_path":".env"}}' "$TW")"

run "secret-access-guard/read-env-example-pass" "appsec-secret-access-guard.js" 0 "" \
  "$(printf '{"cwd":"%s","tool_name":"Read","tool_input":{"file_path":".env.example"}}' "$TW")"

run "secret-access-guard/read-pem-block" "appsec-secret-access-guard.js" 2 "sensitive path" \
  "$(printf '{"cwd":"%s","tool_name":"Read","tool_input":{"file_path":"keys/server.pem"}}' "$TW")"

run "secret-access-guard/read-credentials-block" "appsec-secret-access-guard.js" 2 "sensitive path" \
  "$(printf '{"cwd":"%s","tool_name":"Read","tool_input":{"file_path":"./credentials.json"}}' "$TW")"

run "secret-access-guard/read-package-json-pass" "appsec-secret-access-guard.js" 0 "" \
  "$(printf '{"cwd":"%s","tool_name":"Read","tool_input":{"file_path":"package.json"}}' "$TW")"

run "secret-access-guard/bash-printenv-block" "appsec-secret-access-guard.js" 2 "printenv" \
  "$(printf '{"cwd":"%s","tool_name":"Bash","tool_input":{"command":"printenv"}}' "$TW")"

run "secret-access-guard/bash-cat-env-block" "appsec-secret-access-guard.js" 2 "sensitive path" \
  "$(printf '{"cwd":"%s","tool_name":"Bash","tool_input":{"command":"cat .env"}}' "$TW")"

run "secret-access-guard/bash-grep-secret-block" "appsec-secret-access-guard.js" 2 "credential keywords" \
  "$(printf '{"cwd":"%s","tool_name":"Bash","tool_input":{"command":"grep -r PASSWORD ."}}' "$TW")"

run "secret-access-guard/bash-innocuous-pass" "appsec-secret-access-guard.js" 0 "" \
  "$(printf '{"cwd":"%s","tool_name":"Bash","tool_input":{"command":"ls -la"}}' "$TW")"

# ──────── Cross-cutting: non-appsec project silent exit ────────
T2=$(mktemp -d -p /tmp appsec-non.XXXX); TW2=$(to_win "$T2")
run "non-appsec-project/all-hooks-silent-exit" "appsec-secret-redaction.js" 0 "" \
  "$(printf '{"cwd":"%s","last_assistant_message":"AKIAIOSFODNN7EXAMPLE"}' "$TW2")"
rm -rf "$TW2"

# ──────── Summary ────────
echo
echo "════════════════════════════════════════════════════════════════════════════"
echo "P5 Hook Fixture Harness — Summary"
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
if (( FAIL > 0 )); then
  echo
  echo "Failures:"
  for f in "${FAILS[@]}"; do echo "  - $f"; done
fi
echo "════════════════════════════════════════════════════════════════════════════"

rm -rf "$T"
exit $FAIL
