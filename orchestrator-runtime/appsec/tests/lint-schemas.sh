#!/usr/bin/env bash
#
# lint-schemas.sh — Patch A.1.4 (N2)
#
# Fail if any agent-executed schema declares non-draft-07 $schema.
# Background: Workflow's internal ajv validator does not support draft-2020-12.
# See orchestrator-runtime/appsec/schemas/README.md §1.
#
# Wired into validate-all-presets.sh as a sub-step. Run standalone:
#   bash ~/.claude/orchestrator-runtime/appsec/tests/lint-schemas.sh

set -euo pipefail

SCHEMA_DIR="$(cd "$(dirname "$0")/.." && pwd)/schemas"
EXPECTED_SCHEMA='http://json-schema.org/draft-07/schema#'

if [[ ! -d "$SCHEMA_DIR" ]]; then
  echo "FAIL: schemas dir not found at $SCHEMA_DIR" >&2
  exit 2
fi

fail=0
ok=0
for f in "$SCHEMA_DIR"/*.json; do
  [[ -e "$f" ]] || continue  # no matches → nothing to lint
  schema=$(node -e "
    try {
      const obj = JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));
      process.stdout.write(obj.\$schema || '');
    } catch (e) {
      process.stdout.write('__UNPARSEABLE__:' + e.message);
    }
  " "$f")
  base=$(basename "$f")
  if [[ "$schema" == "__UNPARSEABLE__"* ]]; then
    echo "FAIL: $base — JSON parse error (${schema#__UNPARSEABLE__:})" >&2
    fail=1
  elif [[ -z "$schema" ]]; then
    echo "FAIL: $base — missing \$schema field (must be draft-07)" >&2
    fail=1
  elif [[ "$schema" != "$EXPECTED_SCHEMA" ]]; then
    echo "FAIL: $base — uses \$schema=\"$schema\" (must be \"$EXPECTED_SCHEMA\")" >&2
    echo "      Workflow's internal ajv only ships draft-07 meta." >&2
    fail=1
  else
    ok=$((ok+1))
  fi
done

if (( fail == 0 )); then
  echo "lint-schemas: OK ($ok schemas, all draft-07)"
  exit 0
else
  echo "" >&2
  echo "lint-schemas: FAIL ($fail schema(s) non-draft-07)" >&2
  exit 1
fi
