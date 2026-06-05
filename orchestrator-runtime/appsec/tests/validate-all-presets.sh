#!/usr/bin/env bash
# Sanity-check every preset against the spec schema. Uses the smoke args
# builder's inlining algorithm to test all presets end-to-end.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHARED="$ROOT/../shared"
TMP_DIR="${LOCALAPPDATA:-/tmp}/Temp"
mkdir -p "$TMP_DIR"

validate_preset() {
  local preset="$1"
  local preset_name; preset_name="$(basename "$preset" .json)"
  local out_spec="$TMP_DIR/preset-${preset_name}-spec.json"

  # Inline prompts + schemas into the preset just like build-smoke-args does.
  node -e '
    const fs=require("fs"), path=require("path");
    const root  = process.argv[1];
    const preset = process.argv[2];
    const out   = process.argv[3];
    const spec = JSON.parse(fs.readFileSync(preset, "utf8"));
    const promptRefs = new Set(), schemaRefs = new Set();
    for (const n of spec.phases) {
      if (n.prompt_ref) promptRefs.add(n.prompt_ref);
      if (n.schema_ref) schemaRefs.add(n.schema_ref);
      for (const s of (n.stages || [])) {
        if (s.prompt_ref) promptRefs.add(s.prompt_ref);
        if (s.schema_ref) schemaRefs.add(s.schema_ref);
      }
    }
    for (const r of promptRefs) {
      const p = path.join(root, "prompts", r + ".md");
      if (!fs.existsSync(p)) throw new Error("missing prompt file: " + p);
      spec.prompts[r] = fs.readFileSync(p, "utf8");
    }
    for (const r of schemaRefs) {
      const p = path.join(root, "schemas", r + ".json");
      if (!fs.existsSync(p)) throw new Error("missing schema file: " + p);
      spec.schemas[r] = JSON.parse(fs.readFileSync(p, "utf8"));
    }
    fs.writeFileSync(out, JSON.stringify(spec, null, 2));
  ' "$ROOT" "$preset" "$out_spec"

  printf "  preset=%s  " "$preset_name"
  if node "$SHARED/validate-spec.js" "$out_spec" --quiet 2>/dev/null; then
    echo "OK"
  else
    echo "FAIL"
    node "$SHARED/validate-spec.js" "$out_spec" 2>&1 | sed 's/^/    /' >&2
    return 1
  fi
}

echo "validate-all-presets: scanning $ROOT/presets"
failed=0
for preset in "$ROOT"/presets/*.json; do
  validate_preset "$preset" || failed=1
done
if (( failed )); then
  echo "FAIL: at least one preset failed validation"
  exit 1
fi
echo "all presets OK"

# ── Patch A.1.4 / N2 — draft-07 schema lint ─────────────────────────────
echo ""
echo "lint-schemas: scanning $ROOT/schemas"
if ! bash "$ROOT/tests/lint-schemas.sh"; then
  echo "FAIL: schema draft-07 lint failed"
  exit 1
fi

# ── Policy A model-tier lint (no haiku in real gates / no opus in fanout) ──
echo ""
echo "lint-model-policy: scanning $ROOT/presets"
if ! node "$SHARED/lint-model-policy.js" "$ROOT/presets"; then
  echo "FAIL: model-tier policy lint failed"
  exit 1
fi
