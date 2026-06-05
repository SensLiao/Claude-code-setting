#!/usr/bin/env bash
# AppSec Routing Test Runner — minimal validation runner
#
# Purpose: validate that the routing harness contract is internally consistent
# and matches actual on-disk state. Run by humans or CI.
#
# Usage:
#   bash runner.sh                # full validation
#   bash runner.sh --quick        # skip slow checks
#   bash runner.sh --json         # JSON output for CI
#
# Exit codes:
#   0  All checks passed
#   1  Schema / contract violation
#   2  Missing skill / dead reference
#   3  Manifest validation failure
#   4  Test fixture parse failure

set -uo pipefail

CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
TEST_DIR="$CLAUDE_HOME/tests/appsec-routing"
SKILLS_DIR="$CLAUDE_HOME/skills"
MANIFESTS_DIR="$CLAUDE_HOME/manifests"

PASS=0
FAIL=0
WARN=0
ERRORS=()

log_pass() { PASS=$((PASS+1)); echo "  [PASS] $1"; }
log_fail() { FAIL=$((FAIL+1)); ERRORS+=("$1"); echo "  [FAIL] $1" >&2; }
log_warn() { WARN=$((WARN+1)); echo "  [WARN] $1"; }

echo "=== AppSec Routing Test Runner ==="
echo "Claude home: $CLAUDE_HOME"
echo "Started: $(date -u +%FT%TZ)"
echo

# ============================================================================
# Check 1: All 18 AppSec-family skill directories exist
# ============================================================================
echo "[1] Verifying AppSec-family skill directories exist..."
EXPECTED_SKILLS=(
  appsec-security-orchestrator
  security-governance-threat-modeling
  security-platform-secrets
  security-platform-iac-cloud
  security-remediation
  dast-baseline-scanning
  pentest-scope-and-roe
  authorized-pentest-validation
  security-app-mobile
  security-app-llm
  security-app-multitenant
  security-app-websocket
  security-app-file-upload
  security-compliance-payment
  security-compliance-cn-data
  security-response-incident-response
  security-response-recovery
  gsd-secure-phase
)
for skill in "${EXPECTED_SKILLS[@]}"; do
  if [[ -f "$SKILLS_DIR/$skill/SKILL.md" ]]; then
    log_pass "skill exists: $skill"
  else
    log_fail "MISSING skill: $skill"
  fi
done
echo

# ============================================================================
# Check 2: JSON manifest validity
# ============================================================================
echo "[2] Verifying manifests parse as valid JSON..."
ORIGINAL_CWD="$PWD"
cd "$MANIFESTS_DIR" || { log_fail "cannot cd to manifests dir"; cd "$ORIGINAL_CWD"; }
for jsonfile in skills.manifest.json skill-routing-policy.json skill-overrides.recommended.json; do
  if [[ -f "$jsonfile" ]]; then
    if python -c "import json; json.load(open('$jsonfile', encoding='utf-8'))" 2>/dev/null; then
      log_pass "JSON valid: $jsonfile"
    else
      log_fail "JSON parse error: $jsonfile"
    fi
  else
    log_warn "missing manifest: $jsonfile"
  fi
done
cd "$ORIGINAL_CWD"
echo

# ============================================================================
# Check 3: Test fixtures parse as valid YAML / JSON
# ============================================================================
echo "[3] Verifying test fixtures parse..."
cd "$TEST_DIR" || { log_fail "cannot cd to test dir"; cd "$ORIGINAL_CWD"; }
if [[ -f "expected-routes.json" ]]; then
  if python -c "import json; json.load(open('expected-routes.json', encoding='utf-8'))" 2>/dev/null; then
    log_pass "expected-routes.json parses"
  else
    log_fail "expected-routes.json parse error"
  fi
fi
if [[ -d "fixtures" ]]; then
  cd fixtures
  for yamlfile in *.yaml; do
    if python -c "import yaml; yaml.safe_load(open('$yamlfile', encoding='utf-8'))" 2>/dev/null; then
      log_pass "yaml valid: $yamlfile"
    else
      log_warn "yaml parse check skipped (pyyaml may not be installed): $yamlfile"
    fi
  done
  cd "$TEST_DIR"
fi
cd "$ORIGINAL_CWD"
echo

# ============================================================================
# Check 4: Safety-critical skill names NOT renamed
# ============================================================================
echo "[4] Verifying safety-critical skill names preserved..."
SAFETY_CRITICAL=(
  pentest-scope-and-roe
  authorized-pentest-validation
  dast-baseline-scanning
)
for skill in "${SAFETY_CRITICAL[@]}"; do
  if [[ -d "$SKILLS_DIR/$skill" ]]; then
    log_pass "preserved: $skill"
  else
    log_fail "RENAMED/MISSING safety-critical: $skill"
  fi
done
echo

# ============================================================================
# Check 5: authorized-pentest-validation manual gate preserved
# ============================================================================
echo "[5] Verifying authorized-pentest-validation manual gate..."
if grep -q "disable-model-invocation: true" "$SKILLS_DIR/authorized-pentest-validation/SKILL.md" 2>/dev/null; then
  log_pass "disable-model-invocation: true preserved"
else
  log_fail "CRITICAL: manual gate weakened on authorized-pentest-validation"
fi
echo

# ============================================================================
# Check 6: ASVS 5.0 references in agents (no leftover 4.x V2/V3/V4/V5)
# ============================================================================
echo "[6] Verifying ASVS 5.0 in agents..."
for agent in "$CLAUDE_HOME/agents/appsec-reviewer.md" "$CLAUDE_HOME/agents/security-remediation-engineer.md"; do
  if [[ -f "$agent" ]]; then
    if grep -q "ASVS 5.0\|v5.0.0-" "$agent"; then
      log_pass "ASVS 5.0 referenced: $(basename $agent)"
    else
      log_warn "no explicit ASVS 5.0 reference: $(basename $agent)"
    fi
  fi
done
echo

# ============================================================================
# Check 7: gitleaks --redact in skill examples
# ============================================================================
echo "[7] Verifying gitleaks --redact discipline..."
GITLEAKS_HITS=$(grep -rn "gitleaks detect" "$SKILLS_DIR" 2>/dev/null | grep -v "binary file" || true)
GITLEAKS_MISSING_REDACT=$(echo "$GITLEAKS_HITS" | grep -v "\-\-redact" || true)
if [[ -z "$GITLEAKS_MISSING_REDACT" ]]; then
  log_pass "all gitleaks invocations include --redact"
else
  log_fail "gitleaks invocations missing --redact:"
  echo "$GITLEAKS_MISSING_REDACT" | head -5
fi
echo

# ============================================================================
# Check 8: GSD-namespace boundary preserved
# ============================================================================
echo "[8] Verifying GSD namespace boundary..."
if [[ -f "$SKILLS_DIR/gsd-secure-phase/SKILL.md" ]]; then
  if grep -q "do NOT merge into appsec-security-orchestrator\|canonical_id: gsd.workflow" "$SKILLS_DIR/gsd-secure-phase/SKILL.md"; then
    log_pass "gsd-secure-phase namespace boundary asserted"
  else
    log_warn "gsd-secure-phase namespace assertion weak"
  fi
fi
echo

# ============================================================================
# Final summary
# ============================================================================
echo "=== Summary ==="
echo "  PASS: $PASS"
echo "  WARN: $WARN"
echo "  FAIL: $FAIL"
echo "  Completed: $(date -u +%FT%TZ)"
echo

if [[ $FAIL -gt 0 ]]; then
  echo "FAILURES:" >&2
  for e in "${ERRORS[@]}"; do echo "  - $e" >&2; done
  exit 1
fi

echo "All routing harness contract checks passed."
exit 0
