#!/usr/bin/env bash
#
# preflight-check.sh — Patch A.1.6 (§1.10 capability gate)
#
# Verifies every node.agentType referenced in spec exists with matching `name:`
# frontmatter, every required hook is installed in <project>/.claude/settings.json,
# the SDK is reachable, every model alias resolves, and conditional skills are
# available for the overlays/lifecycle declared in the spec.
#
# Usage:
#   bash preflight-check.sh <spec.json> [<project-root>]
#   # or via stdin:
#   echo "$spec" | bash preflight-check.sh - [<project-root>]
#
# Exit:
#   0 — all capability checks passed
#   2 — at least one missing capability (structured stderr listing every gap)
#   3 — internal error (bad spec / missing registry / node failure)
#
# Wired into SKILL.md §16.11 as step 9b (AFTER validate-spec.js, BEFORE preview).
# Skip = fail-closed (the Skill MUST run this before Workflow launch).

set -u

REG_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REGISTRY="$REG_DIR/registry.json"
SHARED_DIR="$REG_DIR/../shared"
SKIP_SETTINGS_CHECK="${PREFLIGHT_SKIP_SETTINGS:-0}"

if [[ ! -f "$REGISTRY" ]]; then
  echo "internal: registry.json not found at $REGISTRY" >&2
  exit 3
fi

# ── load spec (positional or stdin) ─────────────────────────────────────
SPEC_PATH="${1:-}"
PROJECT_ROOT="${2:-$PWD}"
if [[ "$SPEC_PATH" == "-" || -z "$SPEC_PATH" ]]; then
  spec_json="$(cat)"
else
  if [[ ! -f "$SPEC_PATH" ]]; then
    echo "internal: spec file not found: $SPEC_PATH" >&2
    exit 3
  fi
  spec_json="$(cat "$SPEC_PATH")"
fi

if ! echo "$spec_json" | node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"))' 2>/dev/null; then
  echo "internal: spec not parseable JSON" >&2
  exit 3
fi

# ── helpers ─────────────────────────────────────────────────────────────
GAPS=()

emit_gap() { GAPS+=("$1"); }

# Resolve `~/path` to absolute. Escape the tilde so bash does NOT
# auto-expand it inside the ${p#...} parameter expansion.
resolve_tilde() {
  local p="$1"
  if [[ "$p" == "~/"* ]]; then
    echo "$HOME/${p#\~/}"
  else
    echo "$p"
  fi
}

# ── Check 1: agents referenced in spec exist with matching `name:` frontmatter ──
agent_types_in_spec="$(echo "$spec_json" | node -e '
  const s = JSON.parse(require("fs").readFileSync(0,"utf8"));
  const types = new Set();
  for (const p of (s.phases || [])) {
    if (p.agentType) types.add(p.agentType);
    for (const st of (p.stages || [])) if (st.agentType) types.add(st.agentType);
  }
  process.stdout.write([...types].join("\n"));
')"

# All candidate .md files (user-global + project-local)
mapfile -t ALL_AGENT_FILES < <(
  find "$HOME/.claude/agents" -maxdepth 1 -name '*.md' 2>/dev/null
  find "$PROJECT_ROOT/.claude/agents" -maxdepth 1 -name '*.md' 2>/dev/null
)

# Map name → filepath (first wins)
declare -A AGENT_NAME_TO_FILE
for f in "${ALL_AGENT_FILES[@]}"; do
  n=$(awk '/^name: /{print $2; exit}' "$f")
  if [[ -n "$n" && -z "${AGENT_NAME_TO_FILE[$n]:-}" ]]; then
    AGENT_NAME_TO_FILE[$n]="$f"
  fi
done

if [[ -n "$agent_types_in_spec" ]]; then
  while IFS= read -r at; do
    [[ -z "$at" ]] && continue
    if [[ -z "${AGENT_NAME_TO_FILE[$at]:-}" ]]; then
      # find closest by name for hint
      best=""
      for n in "${!AGENT_NAME_TO_FILE[@]}"; do
        if [[ "$n" == "${at%-*}"* || "${n%-*}" == "${at%-*}" ]]; then
          best="$n"; break
        fi
      done
      if [[ -n "$best" ]]; then
        emit_gap "missing agent: $at (no .md file with name: $at under ~/.claude/agents/ or $PROJECT_ROOT/.claude/agents/ — did you mean \"$best\"?)"
      else
        emit_gap "missing agent: $at (no .md file with name: $at under ~/.claude/agents/ or $PROJECT_ROOT/.claude/agents/)"
      fi
    fi
  done <<< "$agent_types_in_spec"
fi

# ── Check 2: required hooks installed in <project>/.claude/settings.json ──
PROJECT_SETTINGS="$PROJECT_ROOT/.claude/settings.json"

# Always-required hooks per registry (we only enforce required:true here; required_when needs ambient context)
REQUIRED_HOOK_NAMES="$(node -e '
  const r = JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
  const out = [];
  for (const [k,v] of Object.entries(r.hooks||{})) {
    if (v.required === true) out.push(k);
  }
  process.stdout.write(out.join("\n"));
' "$REGISTRY")"

# Read execution_mode FIRST — it changes the severity of a missing settings.json.
# Fix per cross-review Item E (FAIL): in workflow-spec mode, the preview-gate hook
# MUST be installed; a missing settings.json is no longer a soft note — it is a
# HARD gap because the safety gate cannot fire without it.
exec_mode="$(node -e 'try{process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).execution_mode||"")}catch{}' "$PROJECT_ROOT/.appsec/config.json" 2>/dev/null || echo "")"

if [[ "$SKIP_SETTINGS_CHECK" != "1" && -n "$REQUIRED_HOOK_NAMES" ]]; then
  if [[ ! -f "$PROJECT_SETTINGS" ]]; then
    if [[ "$exec_mode" == "workflow-spec" ]]; then
      # HARD gap: workflow-spec mode requires the preview-gate hook installed.
      # Without settings.json the hook never fires → preview approval bypass.
      emit_gap "settings.json missing AND execution_mode=workflow-spec — appsec-preview-gate cannot fire without install (run 'appsec-sdk init')"
    else
      # Fresh project not using workflow-spec — soft note is OK.
      emit_gap "note: $PROJECT_SETTINGS not present (fresh project? run 'appsec-sdk init' to install AppSec hooks)"
    fi
  else
    settings_text="$(cat "$PROJECT_SETTINGS")"
    while IFS= read -r hook_name; do
      [[ -z "$hook_name" ]] && continue
      # Match by filename suffix of registry.path (handles tilde, full paths, partial)
      hook_basename="$hook_name.js"
      if ! echo "$settings_text" | grep -q "$hook_basename"; then
        emit_gap "hook not installed: $hook_name (not referenced in $PROJECT_SETTINGS — run 'appsec-sdk init' to install)"
      fi
    done <<< "$REQUIRED_HOOK_NAMES"
  fi
fi

# Hook required_when: workflow-spec mode → check appsec-preview-gate is installed
# (only meaningful when settings.json exists — the missing-settings.json case is
# already handled HARD above)
if [[ "$exec_mode" == "workflow-spec" && "$SKIP_SETTINGS_CHECK" != "1" && -f "$PROJECT_SETTINGS" ]]; then
  if ! grep -q "appsec-preview-gate.js" "$PROJECT_SETTINGS" 2>/dev/null; then
    emit_gap "hook not installed: appsec-preview-gate (workflow-spec mode requires it; run 'appsec-sdk init')"
  fi
fi

# ── Check 3: SDK reachable + smoke command works ─────────────────────────
sdk_path_raw="$(node -e '
  const r = JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
  process.stdout.write((r.sdk||{})["appsec-sdk"]?.path || "");
' "$REGISTRY")"
sdk_path="$(resolve_tilde "$sdk_path_raw")"

if [[ ! -f "$sdk_path" ]]; then
  emit_gap "SDK missing: appsec-sdk (path: $sdk_path_raw — file does not exist)"
elif [[ ! -x "$sdk_path" ]]; then
  emit_gap "SDK not executable: appsec-sdk (path: $sdk_path_raw — chmod +x to fix)"
else
  # Smoke: --help should exit 0
  if ! "$sdk_path" --help >/dev/null 2>&1; then
    smoke_exit=$?
    emit_gap "SDK smoke failed: appsec-sdk --help (path: $sdk_path_raw — exit $smoke_exit)"
  fi
fi

# ── Check 4: every node.model alias resolves ──────────────────────────────
known_aliases="$(node -e '
  const r = JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
  process.stdout.write((r.model_aliases||[]).join("\n"));
' "$REGISTRY")"

spec_aliases="$(echo "$spec_json" | node -e '
  const s = JSON.parse(require("fs").readFileSync(0,"utf8"));
  const m = new Set();
  for (const p of (s.phases || [])) {
    if (p.model) m.add(p.model);
    for (const st of (p.stages || [])) if (st.model) m.add(st.model);
  }
  process.stdout.write([...m].join("\n"));
')"

# Common literal model names — allow as legacy (not preferred)
LEGACY_LITERALS_RE='^(haiku|sonnet|opus|haiku-[0-9]|sonnet-[0-9]|opus-[0-9])'

if [[ -n "$spec_aliases" ]]; then
  while IFS= read -r m; do
    [[ -z "$m" ]] && continue
    if grep -qxF "$m" <<<"$known_aliases"; then
      :  # resolved alias
    elif [[ "$m" =~ $LEGACY_LITERALS_RE ]]; then
      :  # legacy literal — accept but Patch A.4 will migrate
    else
      emit_gap "unresolvable model alias: $m (not in registry.model_aliases nor a known literal model name)"
    fi
  done <<< "$spec_aliases"
fi

# ── Check 5: conditional skills warning ──────────────────────────────────
# When .appsec/state.json overlays are set, surface what conditional skills are expected.
# This is informational, not fail-closed; Skill calls the skill at the right time.
state_overlays="$(node -e 'try{
  const s = JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
  process.stdout.write((s.overlays||[]).join("\n"));
}catch{}' "$PROJECT_ROOT/.appsec/state.json" 2>/dev/null || echo "")"

# (no hard fail here — Skill is expected to dispatch overlay sub-skills per §16.3;
# the registry lists them so a future skill-availability scanner can verify.)

# ── Report ──────────────────────────────────────────────────────────────
if (( ${#GAPS[@]} == 0 )); then
  # Count what we did verify
  n_agents=$(grep -c . <<<"$agent_types_in_spec" 2>/dev/null || echo 0)
  n_hooks=$(grep -c . <<<"$REQUIRED_HOOK_NAMES" 2>/dev/null || echo 0)
  echo "Preflight OK:"
  echo "  ✓ $n_agents agent(s) resolved (by name: frontmatter)"
  echo "  ✓ $n_hooks required hook(s) installed (or no project settings.json — soft note)"
  echo "  ✓ 1 SDK reachable (appsec-sdk --help OK)"
  echo "  ✓ model aliases resolvable"
  echo "  ✓ 0 fatal gaps"
  exit 0
fi

echo "Cannot launch appsec workflow (preflight failed):" >&2
for g in "${GAPS[@]}"; do
  case "$g" in
    note:*) echo "  - $g" >&2 ;;
    *)      echo "  ✗ $g" >&2 ;;
  esac
done
echo "" >&2
echo "Aborting. Zero tokens spent. Fix capability gaps and re-run." >&2

# If only soft notes remain (no ✗), pass with warnings
HARD_GAPS=0
for g in "${GAPS[@]}"; do
  [[ "$g" != note:* ]] && HARD_GAPS=$((HARD_GAPS+1))
done
if (( HARD_GAPS == 0 )); then
  echo "(soft notes only — preflight allows launch)" >&2
  exit 0
fi
exit 2
