#!/usr/bin/env bash
# unit-resolve-capabilities.sh — smoke each shared/resolve-capabilities.js
# subcommand using the QA registry. Validates registry shape via the resolver.
set -u
RUNTIME_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
RESOLVER="$RUNTIME_DIR/shared/resolve-capabilities.js"
REGISTRY="$RUNTIME_DIR/qa/registry.json"
PARENT_SKILL="${QA_PARENT_SKILL:-$HOME/.claude/skills/enterprise-qa-testing/SKILL.md}"

if [[ ! -f "$RESOLVER" ]]; then
  echo "internal: resolver not found at $RESOLVER" >&2
  exit 3
fi
if [[ ! -f "$REGISTRY" ]]; then
  echo "internal: QA registry not found at $REGISTRY" >&2
  exit 3
fi

pass=0
fail=0
checks=()

run_check() {
  local label="$1"; shift
  # Optional expected-exit-code prefix as $LABEL ↑ "(expect-ec=N)" → accept that EC as PASS
  local expect_ec="${EXPECT_EC:-0}"
  local out
  out=$(node "$RESOLVER" "$@" 2>&1)
  local ec=$?
  if [[ "$ec" -eq "$expect_ec" || "$ec" -eq 0 ]]; then
    printf "  + %s (exit=%d)\n" "$label" "$ec"
    pass=$((pass+1))
  else
    printf "  x %s (exit=%d, expected %d)\n" "$label" "$ec" "$expect_ec"
    echo "$out" | sed 's/^/      /'
    fail=$((fail+1))
  fi
  checks+=("$label:$ec")
  unset EXPECT_EC
}

# Positional args per resolve-capabilities.js --help:
#   resolve-agents              <spec.json> <project-root>
#   resolve-hooks               <registry.json> <project-root> <execution-mode> <mode>
#   resolve-skills              <names-csv> [<project-root>]
#   resolve-embedded-skill-contracts <names-csv> <parent-skill-md-path>
#   resolve-sdk                 <registry.json> <sdk-name>
#   resolve-model-aliases       <registry.json> <spec.json>
#
# We smoke each by feeding the smoke preset where a spec is needed.
SPEC="$RUNTIME_DIR/qa/presets/smoke.json"
CONTRACT_NAMES="$(node -e '
  const r = JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
  process.stdout.write(Object.keys(r.embedded_skill_contracts||{}).filter(k => !k.startsWith("_")).join(","));
' "$REGISTRY")"

echo "Smoke testing resolve-capabilities.js with QA registry..."
run_check "resolve-agents <smoke.json> <pwd>"                   resolve-agents "$SPEC" "$PWD"
run_check "resolve-skills (empty csv ok)"                       resolve-skills "" "$PWD"
run_check "resolve-embedded-skill-contracts ($(echo "$CONTRACT_NAMES" | tr ',' ' ' | wc -w) names)" resolve-embedded-skill-contracts "$CONTRACT_NAMES" "$PARENT_SKILL"
run_check "resolve-sdk <registry> qa-sdk"                       resolve-sdk "$REGISTRY" "qa-sdk"
run_check "resolve-model-aliases <registry> <smoke.json>"       resolve-model-aliases "$REGISTRY" "$SPEC"
# resolve-hooks expects exit 2 on fresh project (no settings.json with qa-preview-gate).
EXPECT_EC=2 run_check "resolve-hooks <registry> <pwd> workflow-spec smoke (expect ec=2 on fresh)" resolve-hooks "$REGISTRY" "$PWD" "workflow-spec" "smoke"

echo "---"
echo "QA resolve-capabilities subcommands: $((pass+fail)) run, $pass PASS, $fail FAIL"
[[ $fail -eq 0 ]]
