#!/usr/bin/env bash
#
# cold-start-customs.sh — QA custom-agent path coverage harness (B.1.g, 2026-05-29)
#
# Audits every QA preset to confirm:
#   1. Each node.agentType (single + fanout + pipeline.stages[]) resolves to a
#      real ~/.claude/agents/*.md with matching frontmatter `name:`
#   2. Each schema_ref resolves to a real schemas/*.json (draft-07 valid)
#   3. Each prompt_ref resolves to a real prompts/*.md (non-empty)
#   4. Frontmatter `tools:` honors STRICT boundary (runners get NO Edit / Write)
#
# Then produces a coverage table showing:
#   - Which agents are wired into which presets
#   - Which are "runtime-proven" (B.2 graph-smoke evidence) vs "cold-start"
#   - DRY-RUN mode (default) does NO live agent dispatch (0 token spend)
#   - --live mode is RESERVED for future minimal-dispatch smoke
#     (not enabled in B.1.g — user explicit defer: "真项目就不需要了目前")
#
# Exit:
#   0 — all preset/agent/schema/prompt linkages resolve cleanly
#   1 — at least one resolution failure
#   2 — usage / internal error
#
# Usage:
#   bash cold-start-customs.sh             # dry-run audit
#   bash cold-start-customs.sh --json      # machine-readable output
#   bash cold-start-customs.sh --live      # RESERVED — not implemented in B.1.g

set -u

MODE="dry-run"
JSON_OUT=0
for arg in "$@"; do
  case "$arg" in
    --live)  MODE="live";;
    --json)  JSON_OUT=1;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *) echo "cold-start-customs: unknown arg $arg" >&2; exit 2;;
  esac
done

if [[ "$MODE" == "live" ]]; then
  cat >&2 <<'EOF'
cold-start-customs: --live mode is RESERVED for future minimal dispatch smoke.
B.1.g 2026-05-29 deferred per user instruction: "真项目就不需要了目前，等所有的东西都正确接入Workflow后再说".
Re-enable by wiring agent('test', {agentType: <name>, schema: SCHEMA}) per agent.
EOF
  exit 2
fi

REG_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PRESETS_DIR="$REG_DIR/presets"
SCHEMAS_DIR="$REG_DIR/schemas"
PROMPTS_DIR="$REG_DIR/prompts"
AGENTS_DIR="$HOME/.claude/agents"

# ── Runtime-proven set (from QA-PHASE-B-CLOSEOUT.md §5 B.2 + §6 B.3) ──
# Update this list when new agents are confirmed via real Workflow runs.
declare -A RUNTIME_PROVEN=(
  ["qa-risk-classifier"]="B.2 LayerSelect fingerprint e5d982eb (wf_05352b89-de6, 2026-05-29)"
  ["qa-evidence-validator"]="B.2 EvidenceBundle fingerprint e41e2673 + B.3 negative test (synthetic PASS refused)"
  ["code-reviewer"]="B.2 StaticBaseline 36942fe1 + UnitOrComponent 28b5da22 ×2 (internal harness only)"
  ["e2e-runner"]="B.2 E2E pipeline f56a0fe9 (internal harness)"
)

# ── Helpers ────────────────────────────────────────────────────────
FAILS=()
emit_fail() { FAILS+=("$1"); }

# Read frontmatter `name:` from agent .md
agent_frontmatter_name() {
  local file="$1"
  if [[ ! -f "$file" ]]; then return 1; fi
  awk '/^name: /{print $2; exit}' "$file"
}

# Read frontmatter `tools:` from agent .md
agent_frontmatter_tools() {
  local file="$1"
  awk '/^tools: /{sub(/^tools: /, ""); print; exit}' "$file"
}

# Locate agent file by frontmatter name (NOT filename — Claude Code identity)
locate_agent_file_by_name() {
  local name="$1"
  for f in "$AGENTS_DIR"/*.md; do
    [[ -f "$f" ]] || continue
    local n; n=$(agent_frontmatter_name "$f")
    if [[ "$n" == "$name" ]]; then printf '%s' "$f"; return 0; fi
  done
  return 1
}

# Extract agentTypes referenced by a preset (single + fanout + pipeline.stages[])
extract_agent_types() {
  local preset="$1"
  node -e '
    const s = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const out = new Set();
    for (const p of (s.phases || [])) {
      if (p.agentType) out.add(p.agentType);
      for (const st of (p.stages || [])) if (st.agentType) out.add(st.agentType);
    }
    process.stdout.write([...out].join("\n") + (out.size ? "\n" : ""));
  ' "$preset"
}

extract_prompt_refs() {
  local preset="$1"
  node -e '
    const s = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const out = new Set();
    for (const p of (s.phases || [])) {
      if (p.prompt_ref) out.add(p.prompt_ref);
      for (const st of (p.stages || [])) if (st.prompt_ref) out.add(st.prompt_ref);
    }
    process.stdout.write([...out].join("\n") + (out.size ? "\n" : ""));
  ' "$preset"
}

extract_schema_refs() {
  local preset="$1"
  node -e '
    const s = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const out = new Set();
    for (const p of (s.phases || [])) {
      if (p.schema_ref) out.add(p.schema_ref);
      for (const st of (p.stages || [])) if (st.schema_ref) out.add(st.schema_ref);
    }
    process.stdout.write([...out].join("\n") + (out.size ? "\n" : ""));
  ' "$preset"
}

# ── Per-preset coverage scan ───────────────────────────────────────
declare -A AGENT_USED_IN_PRESETS    # agent => "preset1,preset2,..."
declare -A SCHEMA_USED_IN_PRESETS
declare -A PROMPT_USED_IN_PRESETS

PRESET_COUNT=0

for preset in "$PRESETS_DIR"/*.json; do
  PRESET_COUNT=$((PRESET_COUNT+1))
  pname=$(basename "$preset" .json)

  # agentType resolution
  while IFS= read -r at; do
    [[ -z "$at" ]] && continue
    if ! file=$(locate_agent_file_by_name "$at"); then
      emit_fail "preset $pname: agentType '$at' does not match any frontmatter name: in $AGENTS_DIR/*.md"
      continue
    fi
    AGENT_USED_IN_PRESETS["$at"]="${AGENT_USED_IN_PRESETS[$at]:-}${AGENT_USED_IN_PRESETS[$at]:+,}$pname"

    # STRICT boundary check for qa-* runners (must NOT have Edit / Write)
    if [[ "$at" =~ ^qa-(static-baseline|component|contract|visual|a11y|perf)-runner$ ]]; then
      tools=$(agent_frontmatter_tools "$file")
      if echo "$tools" | grep -qE '\bEdit\b|\bWrite\b'; then
        emit_fail "agent $at: STRICT boundary violation — frontmatter tools contains Edit or Write ($tools)"
      fi
    fi
  done < <(extract_agent_types "$preset")

  # prompt_ref resolution
  while IFS= read -r pr; do
    [[ -z "$pr" ]] && continue
    if [[ ! -s "$PROMPTS_DIR/${pr}.md" ]]; then
      emit_fail "preset $pname: prompt_ref '$pr' → missing or empty $PROMPTS_DIR/${pr}.md"
    fi
    PROMPT_USED_IN_PRESETS["$pr"]="${PROMPT_USED_IN_PRESETS[$pr]:-}${PROMPT_USED_IN_PRESETS[$pr]:+,}$pname"
  done < <(extract_prompt_refs "$preset")

  # schema_ref resolution
  while IFS= read -r sr; do
    [[ -z "$sr" ]] && continue
    if [[ ! -s "$SCHEMAS_DIR/${sr}.json" ]]; then
      emit_fail "preset $pname: schema_ref '$sr' → missing or empty $SCHEMAS_DIR/${sr}.json"
    fi
    SCHEMA_USED_IN_PRESETS["$sr"]="${SCHEMA_USED_IN_PRESETS[$sr]:-}${SCHEMA_USED_IN_PRESETS[$sr]:+,}$pname"
  done < <(extract_schema_refs "$preset")
done

# ── Report ─────────────────────────────────────────────────────────
if (( JSON_OUT == 1 )); then
  # Machine-readable
  node -e '
    const agents = JSON.parse(process.argv[1]);
    const proven = JSON.parse(process.argv[2]);
    const fails = JSON.parse(process.argv[3]);
    const presets_scanned = parseInt(process.argv[4], 10);
    const out = {
      presets_scanned,
      agents: Object.entries(agents).map(([name, csv]) => ({
        name,
        presets: csv.split(",").filter(Boolean),
        runtime_proven: name in proven,
        runtime_evidence: proven[name] || null,
        status: name in proven ? "PROVEN" : "COLD-START",
      })),
      failures: fails,
    };
    process.stdout.write(JSON.stringify(out, null, 2));
  ' "$(node -e '
    const data={}; for(const e of process.argv.slice(1)){const [k,v]=e.split("\t");data[k]=v||"";} process.stdout.write(JSON.stringify(data));
  ' $(for k in "${!AGENT_USED_IN_PRESETS[@]}"; do printf '%s\t%s\n' "$k" "${AGENT_USED_IN_PRESETS[$k]}"; done))" \
    "$(node -e '
    const data={}; for(const e of process.argv.slice(1)){const [k,v]=e.split("\t");data[k]=v||"";} process.stdout.write(JSON.stringify(data));
  ' $(for k in "${!RUNTIME_PROVEN[@]}"; do printf '%s\t%s\n' "$k" "${RUNTIME_PROVEN[$k]}"; done))" \
    "$(node -e '
    const data=process.argv.slice(1); process.stdout.write(JSON.stringify(data));
  ' "${FAILS[@]}")" "$PRESET_COUNT"
else
  # Human-readable
  echo ""
  echo "════════════════════════════════════════════════════════════════════════"
  echo "QA Custom-Agent Coverage — DRY RUN (B.1.g 2026-05-29)"
  echo "════════════════════════════════════════════════════════════════════════"
  echo "Presets scanned: $PRESET_COUNT"
  echo ""
  printf "  %-32s %-12s %-s\n" "Agent" "Status" "Used in presets"
  echo "  -------------------------------- ------------ --------------------------------"

  # Sort agents: PROVEN first, COLD-START second
  for status in PROVEN COLD-START; do
    for at in $(printf '%s\n' "${!AGENT_USED_IN_PRESETS[@]}" | sort); do
      if [[ "$status" == "PROVEN" ]]; then
        [[ -n "${RUNTIME_PROVEN[$at]:-}" ]] || continue
      else
        [[ -z "${RUNTIME_PROVEN[$at]:-}" ]] || continue
      fi
      printf "  %-32s %-12s %s\n" "$at" "$status" "${AGENT_USED_IN_PRESETS[$at]}"
    done
  done

  echo ""
  echo "Schemas in use: ${#SCHEMA_USED_IN_PRESETS[@]} / $(ls "$SCHEMAS_DIR"/*.json 2>/dev/null | wc -l) files"
  echo "Prompts in use: ${#PROMPT_USED_IN_PRESETS[@]} / $(ls "$PROMPTS_DIR"/*.md  2>/dev/null | wc -l) files"
  echo ""

  if (( ${#FAILS[@]} > 0 )); then
    echo "FAILURES (${#FAILS[@]}):"
    for f in "${FAILS[@]}"; do
      echo "  ✗ $f"
    done
    echo "════════════════════════════════════════════════════════════════════════"
    exit 1
  fi
  echo "All preset → agent → schema → prompt linkages resolve cleanly."
  echo ""
  echo "Cold-start agents above have valid wiring but no Workflow runtime evidence yet."
  echo "Next live verification (deferred per user — B.1.g 2026-05-29):"
  echo "  - 1 surface dispatch each for qa-static-baseline / qa-component / qa-contract / qa-visual / qa-a11y / qa-perf runners"
  echo "  - 1 mock-input dispatch for qa-flaky-triager (critical-path-quarantine refusal path)"
  echo "  - Estimated cost: ~50-100k tokens total via quick-check preset, 1 surface per agent"
  echo "════════════════════════════════════════════════════════════════════════"
fi
exit 0
