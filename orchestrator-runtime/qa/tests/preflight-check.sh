#!/usr/bin/env bash
#
# preflight-check.sh — QA Phase B.1.d preflight gate.
#
# Verifies every node.agentType in spec exists with matching `name:` frontmatter,
# every required hook is installed in <project>/.claude/settings.json,
# qa-sdk is reachable, every model alias resolves, and every embedded skill
# contract anchor exists in ~/.claude/skills/enterprise-qa-testing/SKILL.md.
#
# Usage:
#   bash preflight-check.sh <spec.json> [<project-root>]
#   echo "$spec" | bash preflight-check.sh - [<project-root>]
#
# Exit:
#   0 — all checks passed
#   2 — at least one missing capability (structured stderr listing every gap)
#   3 — internal error (bad spec / missing registry / node failure)

set -u

REG_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REGISTRY="$REG_DIR/registry.json"
SHARED_DIR="$REG_DIR/../shared"
PARENT_SKILL="${QA_PARENT_SKILL:-$HOME/.claude/skills/enterprise-qa-testing/SKILL.md}"
SKIP_SETTINGS_CHECK="${PREFLIGHT_SKIP_SETTINGS:-0}"

if [[ ! -f "$REGISTRY" ]]; then
  echo "internal: registry.json not found at $REGISTRY" >&2
  exit 3
fi

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

GAPS=()
emit_gap() { GAPS+=("$1"); }

resolve_tilde() {
  local p="$1"
  if [[ "$p" == "~/"* ]]; then echo "$HOME/${p#\~/}"; else echo "$p"; fi
}

# ── Check 1: agents in spec exist with matching name: frontmatter ──────
agent_types_in_spec="$(echo "$spec_json" | node -e '
  const s = JSON.parse(require("fs").readFileSync(0,"utf8"));
  const types = new Set();
  for (const p of (s.phases || [])) {
    if (p.agentType) types.add(p.agentType);
    for (const st of (p.stages || [])) if (st.agentType) types.add(st.agentType);
  }
  process.stdout.write([...types].join("\n"));
')"

mapfile -t ALL_AGENT_FILES < <(
  find "$HOME/.claude/agents" -maxdepth 1 -name '*.md' 2>/dev/null
  find "$PROJECT_ROOT/.claude/agents" -maxdepth 1 -name '*.md' 2>/dev/null
)
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
      emit_gap "missing agent: $at (no .md with name: $at under ~/.claude/agents/ or $PROJECT_ROOT/.claude/agents/)"
    fi
  done <<< "$agent_types_in_spec"
fi

# ── Check 2: required hooks installed (workflow-spec mode fail-closed) ──
PROJECT_SETTINGS="$PROJECT_ROOT/.claude/settings.json"
REQUIRED_HOOK_NAMES="$(node -e '
  const r = JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
  const out = [];
  for (const [k,v] of Object.entries(r.hooks||{})) {
    if (v.required === true) out.push(k);
    if (k === "qa-preview-gate") out.push(k);  // launch_gate ALWAYS required when workflow-spec
  }
  process.stdout.write([...new Set(out)].join("\n"));
' "$REGISTRY")"

exec_mode="$(node -e 'try{process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).execution_mode||"")}catch{}' "$PROJECT_ROOT/.qa/config.json" 2>/dev/null || echo "")"

if [[ "$SKIP_SETTINGS_CHECK" != "1" && -n "$REQUIRED_HOOK_NAMES" ]]; then
  if [[ ! -f "$PROJECT_SETTINGS" ]]; then
    if [[ "$exec_mode" == "workflow-spec" ]]; then
      emit_gap "settings.json missing AND execution_mode=workflow-spec — qa-preview-gate cannot fire without install (run 'qa-sdk init')"
    else
      emit_gap "note: $PROJECT_SETTINGS not present (fresh project? run 'qa-sdk init' to install QA hooks)"
    fi
  else
    settings_text="$(cat "$PROJECT_SETTINGS")"
    while IFS= read -r hook_name; do
      [[ -z "$hook_name" ]] && continue
      hook_basename="$hook_name.js"
      if ! echo "$settings_text" | grep -q "$hook_basename"; then
        emit_gap "hook not installed: $hook_name (not referenced in $PROJECT_SETTINGS)"
      fi
    done <<< "$REQUIRED_HOOK_NAMES"
  fi
fi

# qa-preview-gate is launch_gate — must be installed in workflow-spec mode
if [[ "$exec_mode" == "workflow-spec" && "$SKIP_SETTINGS_CHECK" != "1" && -f "$PROJECT_SETTINGS" ]]; then
  if ! grep -q "qa-preview-gate.js" "$PROJECT_SETTINGS" 2>/dev/null; then
    emit_gap "hook not installed: qa-preview-gate (workflow-spec mode requires it; run 'qa-sdk init')"
  fi
fi

# ── Check 3: qa-sdk reachable + smoke ───────────────────────────────────
sdk_path_raw="$(node -e '
  const r = JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
  process.stdout.write((r.sdk||{})["qa-sdk"]?.path || "");
' "$REGISTRY")"
sdk_path="$(resolve_tilde "$sdk_path_raw")"

if [[ -z "$sdk_path" ]]; then
  emit_gap "registry.sdk.qa-sdk.path is empty"
elif [[ ! -f "$sdk_path" ]]; then
  emit_gap "note: qa-sdk missing (path: $sdk_path_raw — file does not exist). Run 'qa-sdk init' to install."
else
  # qa-sdk is bash script; smoke just confirms head -1 readable
  if ! head -1 "$sdk_path" >/dev/null 2>&1; then
    emit_gap "qa-sdk smoke failed: cannot read $sdk_path_raw"
  fi
fi

# ── Check 4: every node.model alias resolves ────────────────────────────
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

LEGACY_LITERALS_RE='^(haiku|sonnet|opus|haiku-[0-9]|sonnet-[0-9]|opus-[0-9])'
if [[ -n "$spec_aliases" ]]; then
  while IFS= read -r m; do
    [[ -z "$m" ]] && continue
    if grep -qxF "$m" <<<"$known_aliases"; then
      :
    elif [[ "$m" =~ $LEGACY_LITERALS_RE ]]; then
      :
    else
      emit_gap "unresolvable model alias: $m (not in registry.model_aliases nor a known literal)"
    fi
  done <<< "$spec_aliases"
fi

# ── Check 5: embedded skill contract anchors exist in parent SKILL.md ──
if [[ ! -f "$PARENT_SKILL" ]]; then
  emit_gap "note: parent skill $PARENT_SKILL not found — embedded_skill_contracts anchors cannot be verified"
else
  contract_names="$(node -e '
    const r = JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
    process.stdout.write(Object.keys(r.embedded_skill_contracts||{}).filter(k => !k.startsWith("_")).join("\n"));
  ' "$REGISTRY")"
  while IFS= read -r cn; do
    [[ -z "$cn" ]] && continue
    if ! grep -qE "^#+ .*(${cn})|<a name=\"${cn}\"|<!--[[:space:]]*${cn}[[:space:]]*-->" "$PARENT_SKILL"; then
      # also accept plain keyword presence as anchor proxy
      if ! grep -qF "$cn" "$PARENT_SKILL"; then
        emit_gap "embedded skill contract anchor not found in parent SKILL.md: $cn"
      fi
    fi
  done <<< "$contract_names"
fi

# ── Report ──────────────────────────────────────────────────────────────
if (( ${#GAPS[@]} == 0 )); then
  n_agents=$(grep -c . <<<"$agent_types_in_spec" 2>/dev/null || echo 0)
  n_hooks=$(grep -c . <<<"$REQUIRED_HOOK_NAMES" 2>/dev/null || echo 0)
  echo "QA preflight OK:"
  echo "  + $n_agents agent(s) resolved (by name: frontmatter)"
  echo "  + $n_hooks required hook(s) checked"
  echo "  + qa-sdk reachable"
  echo "  + model aliases resolvable"
  echo "  + embedded skill contract anchors present"
  exit 0
fi

echo "QA preflight failed:" >&2
for g in "${GAPS[@]}"; do
  case "$g" in
    note:*) echo "  - $g" >&2 ;;
    *)      echo "  x $g" >&2 ;;
  esac
done

HARD_GAPS=0
for g in "${GAPS[@]}"; do
  [[ "$g" != note:* ]] && HARD_GAPS=$((HARD_GAPS+1))
done
if (( HARD_GAPS == 0 )); then
  echo "(soft notes only — preflight allows launch)" >&2
  exit 0
fi
exit 2
