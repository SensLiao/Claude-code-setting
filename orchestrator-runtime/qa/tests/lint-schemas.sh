#!/usr/bin/env bash
# lint-schemas.sh — ajv compile every schema under qa/schemas/.
# Catches malformed JSON Schema, missing required keys, type errors.
set -u
SCHEMA_DIR="$(cd "$(dirname "$0")/../schemas" && pwd)"
fail=0
total=0

for f in "$SCHEMA_DIR"/*.json; do
  total=$((total+1))
  result=$(node -e '
    const fs = require("fs");
    // Discover ajv from plugins or local node_modules (mirror validate-spec.js).
    let Ajv;
    const candidates = [
      "ajv/dist/2020.js",
      "ajv",
    ];
    const pluginRoot = require("path").join(process.env.HOME || process.env.USERPROFILE, ".claude/plugins/marketplaces/everything-claude-code/node_modules");
    for (const c of candidates) {
      try { Ajv = require(c); break; } catch {}
      try { Ajv = require(require("path").join(pluginRoot, c)); break; } catch {}
    }
    if (!Ajv) { console.error("AJV_MISSING"); process.exit(3); }
    const ajv = new Ajv({ strict: false, allowUnionTypes: true });
    // Register draft-07 meta schema (our QA schemas all use draft-07).
    try {
      const draft07 = require(require("path").join(pluginRoot, "ajv/dist/refs/json-schema-draft-07.json"));
      ajv.addMetaSchema(draft07);
    } catch {
      try {
        const draft07 = require("ajv/dist/refs/json-schema-draft-07.json");
        ajv.addMetaSchema(draft07);
      } catch {}
    }
    const schemaPath = process.argv[1];
    try {
      const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
      const validate = ajv.compile(schema);
      console.log("OK");
    } catch (e) {
      console.log("ERR: " + e.message);
    }
  ' "$f" 2>&1)

  # Compile succeeded if "OK" appears as a complete line; warnings are tolerated.
  if echo "$result" | grep -q "^OK$"; then
    if echo "$result" | grep -q "^ERR:"; then
      printf "%-50s FAIL\n" "$(basename "$f")"
      echo "$result" | grep "^ERR:" | sed 's/^/    /'
      fail=$((fail+1))
    else
      printf "%-50s PASS\n" "$(basename "$f")"
    fi
  else
    printf "%-50s FAIL\n" "$(basename "$f")"
    echo "$result" | sed 's/^/    /'
    fail=$((fail+1))
  fi
done

echo "---"
echo "QA schemas: $total tested, $((total-fail)) PASS, $fail FAIL"
[[ $fail -eq 0 ]]
