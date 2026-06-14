#!/usr/bin/env bash
# uiux-sdk — GSD-native UI contract gate helper for uiux-product-orchestrator v2.1
# Contract: SKILL.md §3-§7 and references/{gsd-bridge-contract,chassis-schema,release-decision-schema,gsd-handoff}.md
#
# Project root resolution: walks upward from current dir for .uiux/config.json.
#
# Commands:
#   uiux-sdk init <release-tag>
#   uiux-sdk set-active <release-tag>
#   uiux-sdk detect.gsd
#   uiux-sdk mirror.gsd-ui-spec <phase> <release-tag>
#   uiux-sdk mirror.gsd-ui-review <phase> <release-tag>
#   uiux-sdk lock.style <release-tag> <style-skill> [--force --reason "<text>"]
#   uiux-sdk gate.plan <phase>
#   uiux-sdk gate.ship <release-tag> --phase <N> [--allow-conditional]
#   uiux-sdk decision.write <release-tag>
#   uiux-sdk drift.check <release-tag>
#
# Exit codes:
#   0 PASS / success
#   1 FAIL
#   2 BLOCKED / unsafe input / schema invalid / missing required
#   3 CONDITIONAL_PASS (collapses to 0 with --allow-conditional)

set -u

UIUX_SDK_VERSION="2.1.0"

# ───── Project root resolution ─────
find_project_root() {
  local dir; dir=$(pwd)
  local i=0
  while (( i < 12 )); do
    if [[ -f "$dir/.uiux/config.json" ]]; then
      printf '%s' "$dir"
      return 0
    fi
    local parent; parent=$(dirname "$dir")
    if [[ "$parent" == "$dir" ]]; then return 1; fi
    dir="$parent"; i=$((i+1))
  done
  return 1
}

PROJECT_ROOT=""
ensure_project_root() {
  if ! PROJECT_ROOT=$(find_project_root); then
    echo "uiux-sdk: .uiux/config.json not found in current dir or any parent — is this a UIUX-enabled project?" >&2
    exit 1
  fi
}

# ───── init-only helpers: bootstrap config + project-local hooks ─────
# init must work BEFORE .uiux/config.json exists (it is what creates it).
CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
UIUX_CONFIG_TEMPLATE="$CLAUDE_HOME/skills/uiux-product-orchestrator/templates/dot-uiux-skeleton/config.json.tmpl"
HOOK_INSTALLER="$CLAUDE_HOME/orchestrator-runtime/shared/install-subsystem-hooks.js"

resolve_or_create_root() {
  if PROJECT_ROOT=$(find_project_root); then return 0; fi
  PROJECT_ROOT="$(pwd)"
}

ensure_uiux_config() {
  local cfg="$PROJECT_ROOT/.uiux/config.json"
  [[ -f "$cfg" ]] && return 0
  mkdir -p "$PROJECT_ROOT/.uiux"
  if [[ -f "$UIUX_CONFIG_TEMPLATE" ]]; then
    cp "$UIUX_CONFIG_TEMPLATE" "$cfg"
    echo "uiux-sdk init: created .uiux/config.json from template (set project_type / allowed_l3_styles before use)" >&2
  else
    printf '{"schema_version":"1.0","uiux_enforcement":"strict","strict_mode":"strict","allowed_l3_styles":["taste","luxury","minimalist","soft"]}\n' > "$cfg"
    echo "uiux-sdk init: created minimal .uiux/config.json (template missing)" >&2
  fi
}

install_uiux_hooks() {
  if [[ -f "$HOOK_INSTALLER" ]]; then
    node "$HOOK_INSTALLER" --subsystem uiux --project-root "$PROJECT_ROOT" >&2 \
      || echo "uiux-sdk init: WARN hook installer exited non-zero" >&2
  else
    echo "uiux-sdk init: WARN hook installer missing at $HOOK_INSTALLER — hooks NOT registered" >&2
  fi
}

# ───── Safety ─────
validate_safe_name() {
  local kind="$1" value="$2"
  if [[ -z "$value" ]]; then echo "uiux-sdk: $kind is empty" >&2; exit 2; fi
  if ! [[ "$value" =~ ^[a-zA-Z0-9._-]+$ ]]; then
    echo "uiux-sdk: $kind '$value' contains unsafe characters (allowed: a-z A-Z 0-9 . _ -)" >&2
    exit 2
  fi
  if [[ "$value" == "." || "$value" == ".." || "$value" == *".."* ]]; then
    echo "uiux-sdk: $kind '$value' contains path traversal" >&2
    exit 2
  fi
}

need_arg() {
  if [[ -z "${2:-}" ]]; then echo "uiux-sdk: missing $1" >&2; exit 2; fi
}

iso_now() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

ensure_under_root() {
  local out="$1" root="$2"
  local out_r root_r
  case "$(uname -s 2>/dev/null)" in
    MINGW*|MSYS*|CYGWIN*)
      out_r=$(cygpath -m "$out" 2>/dev/null || printf '%s' "$out")
      root_r=$(cygpath -m "$root" 2>/dev/null || printf '%s' "$root");;
    *)
      out_r=$(readlink -f "$out" 2>/dev/null || printf '%s' "$out")
      root_r=$(readlink -f "$root" 2>/dev/null || printf '%s' "$root");;
  esac
  case "$out_r" in
    "$root_r"/*|"$root_r") :;;
    *) echo "uiux-sdk: refusing path-traversal: $out" >&2; exit 2;;
  esac
}

usage() {
  cat <<'USAGE'
uiux-sdk — uiux-product-orchestrator v2.1 GSD bridge + gate helper

Commands:
  init <tag>
  set-active <tag>
  detect.gsd
  mirror.gsd-ui-spec <phase> <tag>
  mirror.gsd-ui-review <phase> <tag>
  lock.style <tag> <style-skill> [--force --reason "<text>"]
  gate.plan <phase>
  gate.ship <tag> --phase <N> [--allow-conditional]
  decision.write <tag>
  drift.check <tag>

Exit codes: 0=PASS  1=FAIL  2=BLOCKED  3=CONDITIONAL_PASS
With --allow-conditional, 3 collapses to 0.

Project root auto-detected by walking up to .uiux/config.json.
Tags / styles must match /^[a-zA-Z0-9._-]+$/.
USAGE
}

# ───── tiny YAML/JSON helpers (R3-hardened 2026-06-14; lock-step with qa/appsec) ─────
# ★ R3 adversarial-sweep: the old `grep '^{0,4}KEY' | head -n1` extractors had no YAML/JSON
# structural awareness — nested/dup/TAB/block-scalar/tag/anchor decoys beat real values
# (style-mutex bypass, drift bypass, decision smuggle). These are now col-0 + structure-aware.
# Canonical-gate guard: reject BOM/TAB/multi-doc/directive + quoted/block-scalar/tag/anchor on a
# critical key. $1=content $2=ERE alternation of critical key names. echo reason + return 2 if bad.
_uiux_assert_canonical_gate_yaml() {
  local content; content=$(printf '%s' "$1" | tr -d '\r'); local crit="$2"; local tab; tab=$(printf '\t')
  if printf '%s' "$content" | grep -q "$(printf '\xef\xbb\xbf')"; then echo "noncanonical: UTF-8 BOM / U+FEFF (zero-width prefix anywhere)"; return 2; fi
  if printf '%s' "$content" | grep -q "$tab"; then echo "noncanonical: TAB character"; return 2; fi
  if printf '%s\n' "$content" | grep -qE '^[[:space:]]*(---|\.\.\.)([[:space:]].*)?$'; then echo "noncanonical: document marker (--- / ...)"; return 2; fi
  if printf '%s\n' "$content" | grep -qE '^%'; then echo "noncanonical: YAML directive (%)"; return 2; fi
  if printf '%s\n' "$content" | grep -qE "^[[:space:]]*[\"'](${crit})[\"'][[:space:]]*:"; then echo "noncanonical: quoted critical key"; return 2; fi
  if printf '%s\n' "$content" | grep -qE "^(${crit})[[:space:]]*:[[:space:]]*[|>]"; then echo "noncanonical: block scalar on critical key"; return 2; fi
  if printf '%s\n' "$content" | grep -qE "^(${crit})[[:space:]]*:[[:space:]]*[!&*]"; then echo "noncanonical: tag/anchor/alias on critical key"; return 2; fi
  return 0
}
_uiux_count_key() { printf '%s' "$1" | tr -d '\r' | grep -v '^[[:space:]]*#' | grep -cE "^$2[[:space:]]*:" || true; }

extract_scalar() {
  local content="$1" key="$2"
  printf '%s' "$content" | tr -d '\r' \
    | grep -v '^[[:space:]]*#' \
    | grep -E "^${key}[[:space:]]*:" \
    | head -n1 \
    | sed -E "s/^${key}[[:space:]]*:[[:space:]]*//" \
    | sed -E 's/[[:space:]]+#.*$//' \
    | sed -E 's/^"([^"]*)"$/\1/' \
    | sed -E "s/^'([^']*)'\$/\1/" \
    | sed -E 's/[[:space:]]+$//'
}

# Structure-aware JSON top-level scalar read + duplicate-top-level-key reject (kills nested
# first-match, string-embedded fake keys, and dup-key smuggling incl. \uXXXX-escaped key names).
_UIUX_JSON_READ_JS='const fs=require("fs");const f=process.argv[1],k=process.argv[2];let raw;try{raw=fs.readFileSync(f,"utf8");}catch(e){process.exit(2);}let doc;try{doc=JSON.parse(raw);}catch(e){process.exit(3);}if(doc===null||typeof doc!=="object"||Array.isArray(doc))process.exit(4);let depth=0,inStr=false,esc=false,ps=null,cnt=0;for(let i=0;i<raw.length;i++){const c=raw[i];if(inStr){if(esc){esc=false;ps+=c;continue;}if(c==="\\"){esc=true;ps+=c;continue;}if(c==="\""){inStr=false;continue;}ps+=c;continue;}if(c==="\""){inStr=true;ps="";continue;}if(c==="{"||c==="[")depth++;else if(c==="}"||c==="]")depth--;else if(c===":"&&depth===1&&ps!==null){let kk;try{kk=JSON.parse("\""+ps+"\"");}catch(e){kk=ps;}if(kk===k)cnt++;ps=null;}}if(cnt>1)process.exit(5);if(!Object.prototype.hasOwnProperty.call(doc,k))process.exit(0);const v=doc[k];process.stdout.write(v===null?"null":String(v));'
extract_json_scalar() {
  local file="$1" key="$2"
  node -e "$_UIUX_JSON_READ_JS" "$file" "$key" 2>/dev/null
}

# Extract a markdown section by H2 header, until the next H2 or EOF.
extract_md_section() {
  local file="$1" header_pattern="$2"
  awk -v pat="$header_pattern" '
    BEGIN { in_section=0 }
    /^## / {
      if (in_section==1) { exit }
      if ($0 ~ pat) { in_section=1; next }
    }
    in_section==1 { print }
  ' "$file"
}

sha256_of_file() {
  local f="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$f" 2>/dev/null | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$f" 2>/dev/null | awk '{print $1}'
  else
    echo "no-sha256-tool"
  fi
}

# ───── Commands ─────

cmd_init() {
  # release-tag is OPTIONAL: bare `uiux-sdk init` bootstraps .uiux/config.json +
  # registers project-local hooks (no release tag yet). `uiux-sdk init <tag>` ALSO
  # creates evidence/findings/decisions/lock dirs + active-tag state for that release.
  local tag="${1:-}"
  resolve_or_create_root
  ensure_uiux_config
  install_uiux_hooks
  if [[ -z "$tag" ]]; then
    echo "$PROJECT_ROOT/.uiux"
    return 0
  fi
  validate_safe_name "release-tag" "$tag"
  local ev_dir="$PROJECT_ROOT/.uiux/evidence/$tag"
  local fnd_dir="$PROJECT_ROOT/.uiux/findings/$tag"
  local dec_dir="$PROJECT_ROOT/.uiux/decisions/$tag"
  local lock_dir="$PROJECT_ROOT/.uiux/lock"
  mkdir -p "$ev_dir" "$fnd_dir" "$dec_dir" "$lock_dir"
  ensure_under_root "$ev_dir" "$PROJECT_ROOT/.uiux"
  ensure_under_root "$fnd_dir" "$PROJECT_ROOT/.uiux"
  ensure_under_root "$dec_dir" "$PROJECT_ROOT/.uiux"
  ensure_under_root "$lock_dir" "$PROJECT_ROOT/.uiux"
  # Preserve operational metadata when re-initializing an existing tag
  local init_at last_mirror last_gate
  init_at="$(iso_now)"
  last_mirror="null"
  last_gate="null"
  if [[ -f "$PROJECT_ROOT/.uiux/state.json" ]]; then
    local existing_init existing_mirror existing_gate
    existing_init=$(extract_json_scalar "$PROJECT_ROOT/.uiux/state.json" "initialized_at" 2>/dev/null || true)
    existing_mirror=$(extract_json_scalar "$PROJECT_ROOT/.uiux/state.json" "last_mirror_at" 2>/dev/null || true)
    existing_gate=$(extract_json_scalar "$PROJECT_ROOT/.uiux/state.json" "last_gate_at" 2>/dev/null || true)
    # Only preserve if same tag being re-init'd
    local existing_tag
    existing_tag=$(extract_json_scalar "$PROJECT_ROOT/.uiux/state.json" "active_release_tag" 2>/dev/null || true)
    if [[ "$existing_tag" == "$tag" ]]; then
      [[ -n "$existing_init" && "$existing_init" != "null" ]] && init_at="$existing_init"
      [[ -n "$existing_mirror" && "$existing_mirror" != "null" ]] && last_mirror="\"$existing_mirror\""
      [[ -n "$existing_gate" && "$existing_gate" != "null" ]] && last_gate="\"$existing_gate\""
    fi
  fi
  printf '{"active_release_tag":"%s","initialized_at":"%s","last_mirror_at":%s,"last_gate_at":%s}\n' \
    "$tag" "$init_at" "$last_mirror" "$last_gate" > "$PROJECT_ROOT/.uiux/state.json"
  echo "$ev_dir"
}

cmd_set_active() {
  need_arg "release-tag" "${1:-}"
  validate_safe_name "release-tag" "$1"
  ensure_project_root
  local init_at last_mirror last_gate
  if [[ -f "$PROJECT_ROOT/.uiux/state.json" ]]; then
    init_at=$(extract_json_scalar "$PROJECT_ROOT/.uiux/state.json" "initialized_at")
    last_mirror=$(extract_json_scalar "$PROJECT_ROOT/.uiux/state.json" "last_mirror_at")
    last_gate=$(extract_json_scalar "$PROJECT_ROOT/.uiux/state.json" "last_gate_at")
  fi
  [[ -z "${init_at:-}" || "$init_at" == "null" ]] && init_at="$(iso_now)"
  [[ -z "${last_mirror:-}" ]] && last_mirror="null"
  [[ -z "${last_gate:-}" ]] && last_gate="null"
  local lm_out lg_out
  if [[ "$last_mirror" == "null" ]]; then lm_out="null"; else lm_out="\"$last_mirror\""; fi
  if [[ "$last_gate" == "null" ]]; then lg_out="null"; else lg_out="\"$last_gate\""; fi
  printf '{"active_release_tag":"%s","initialized_at":"%s","last_mirror_at":%s,"last_gate_at":%s}\n' \
    "$1" "$init_at" "$lm_out" "$lg_out" > "$PROJECT_ROOT/.uiux/state.json"
  echo "$PROJECT_ROOT/.uiux/state.json"
}

# Returns a JSON object describing GSD detection state.
cmd_detect_gsd() {
  local cwd; cwd=$(pwd)
  local pr=""
  if pr=$(find_project_root); then :; fi
  local uiux_cfg="false"
  local planning="false"
  local cfg_path
  if [[ -n "$pr" ]]; then
    uiux_cfg="true"
    [[ -d "$pr/.planning" ]] && planning="true"
  else
    # No .uiux/, still check .planning/ near cwd
    local d="$cwd"; local i=0
    while (( i < 12 )); do
      if [[ -d "$d/.planning" ]]; then planning="true"; pr="$d"; break; fi
      local p; p=$(dirname "$d")
      if [[ "$p" == "$d" ]]; then break; fi
      d="$p"; i=$((i+1))
    done
  fi

  local current_phase="null"
  local phase_dir="null"
  local ui_phase_enabled="true"
  local ui_safety_gate="true"
  local ui_review_enabled="true"
  local strict_mode="null"

  if [[ "$planning" == "true" && -n "$pr" ]]; then
    cfg_path="$pr/.planning/config.json"
    if [[ -f "$cfg_path" ]]; then
      local v
      v=$(grep -oE '"ui_phase"[[:space:]]*:[[:space:]]*(true|false)' "$cfg_path" | head -n1 | grep -oE '(true|false)$' || true)
      [[ -n "$v" ]] && ui_phase_enabled="$v"
      v=$(grep -oE '"ui_safety_gate"[[:space:]]*:[[:space:]]*(true|false)' "$cfg_path" | head -n1 | grep -oE '(true|false)$' || true)
      [[ -n "$v" ]] && ui_safety_gate="$v"
      v=$(grep -oE '"ui_review"[[:space:]]*:[[:space:]]*(true|false)' "$cfg_path" | head -n1 | grep -oE '(true|false)$' || true)
      [[ -n "$v" ]] && ui_review_enabled="$v"
    fi
    # current_phase from STATE.md if present
    if [[ -f "$pr/.planning/STATE.md" ]]; then
      local cp
      cp=$(grep -oE 'current_phase[[:space:]]*[:=][[:space:]]*[A-Za-z0-9._-]+' "$pr/.planning/STATE.md" \
        | head -n1 | sed -E 's/.*[:=][[:space:]]*//')
      if [[ -n "$cp" ]]; then current_phase="\"$cp\""; fi
    fi
    # phase_dir best-effort
    if [[ "$current_phase" != "null" ]]; then
      local cp_unq; cp_unq=$(echo "$current_phase" | tr -d '"')
      local found
      found=$(find "$pr/.planning/phases" -maxdepth 1 -type d -name "${cp_unq}*" 2>/dev/null | head -n1)
      [[ -n "$found" ]] && phase_dir="\"${found#$pr/}\""
    fi
  fi

  if [[ "$uiux_cfg" == "true" ]]; then
    local sm
    sm=$(extract_json_scalar "$pr/.uiux/config.json" "strict_mode" 2>/dev/null || true)
    [[ -n "$sm" && "$sm" != "null" ]] && strict_mode="\"$sm\""
  fi

  printf '{"project_root":"%s","planning_exists":%s,"uiux_config_exists":%s,"current_phase":%s,"phase_dir":%s,"ui_phase_enabled":%s,"ui_safety_gate":%s,"ui_review_enabled":%s,"strict_mode":%s}\n' \
    "$pr" "$planning" "$uiux_cfg" "$current_phase" "$phase_dir" "$ui_phase_enabled" "$ui_safety_gate" "$ui_review_enabled" "$strict_mode"
}

# Locate a UI-SPEC.md (or UI-REVIEW.md) for a given phase. Returns absolute path or empty.
find_phase_artifact() {
  local root="$1" phase="$2" suffix="$3"  # e.g. "UI-SPEC.md"
  local hits
  hits=$(find "$root/.planning/phases" -maxdepth 3 -type f -name "*${suffix}" 2>/dev/null \
    | grep -E "(/|^)${phase}[-/]|/${phase}-?[A-Za-z]*-?${suffix}|/${phase}/${suffix}" \
    | head -n1)
  if [[ -z "$hits" ]]; then
    # Broader fallback: any UI-SPEC.md under a phase dir starting with the number
    hits=$(find "$root/.planning/phases" -maxdepth 3 -type f -name "*${suffix}" 2>/dev/null \
      | grep -E "/${phase}[-_a-zA-Z0-9]*/" \
      | head -n1)
  fi
  if [[ -z "$hits" ]]; then
    # Last resort: any UI-SPEC.md if there's exactly one phase
    hits=$(find "$root/.planning/phases" -maxdepth 3 -type f -name "${suffix}" 2>/dev/null | head -n1)
  fi
  echo "$hits"
}

cmd_mirror_gsd_ui_spec() {
  need_arg "phase" "${1:-}"
  need_arg "release-tag" "${2:-}"
  validate_safe_name "phase" "$1"
  validate_safe_name "release-tag" "$2"
  local phase="$1" tag="$2"
  ensure_project_root

  local ui_spec
  ui_spec=$(find_phase_artifact "$PROJECT_ROOT" "$phase" "UI-SPEC.md")
  if [[ -z "$ui_spec" || ! -f "$ui_spec" ]]; then
    echo "uiux-sdk: UI-SPEC.md not found for phase '$phase' under $PROJECT_ROOT/.planning/phases/" >&2
    echo "Run /gsd-ui-phase $phase first." >&2
    exit 2
  fi

  local content; content=$(cat "$ui_spec")
  local hash; hash=$(sha256_of_file "$ui_spec")

  # Extract sections
  local sec_spacing sec_typo sec_color sec_copy sec_registry
  sec_spacing=$(extract_md_section "$ui_spec" '^## ([Ss]pacing|SPACING)')
  sec_typo=$(extract_md_section "$ui_spec" '^## ([Tt]ypography|TYPOGRAPHY)')
  sec_color=$(extract_md_section "$ui_spec" '^## ([Cc]olor|COLOR|Colou?rs?)')
  sec_copy=$(extract_md_section "$ui_spec" '^## ([Cc]opy(?:writing)?|COPY|COPYWRITING)')
  sec_registry=$(extract_md_section "$ui_spec" '^## ([Rr]egistry [Ss]afety|[Tt]hird-?[Pp]arty)')

  local missing=()
  [[ -z "$sec_spacing" ]] && missing+=("spacing")
  [[ -z "$sec_typo" ]] && missing+=("typography")
  [[ -z "$sec_color" ]] && missing+=("color")
  [[ -z "$sec_copy" ]] && missing+=("copywriting")

  local required_present="true"
  if (( ${#missing[@]} > 0 )); then
    required_present="false"
  fi

  # Naive numeric extraction for spacing scale
  local spacing_scale="[]"
  if [[ -n "$sec_spacing" ]]; then
    local nums
    nums=$(printf '%s' "$sec_spacing" | grep -oE '\b[0-9]+\b' | sort -nu | head -n 12 | paste -sd, -)
    [[ -n "$nums" ]] && spacing_scale="[$nums]"
  fi

  # Naive sizes from typography section: things like 12px, 1rem, clamp(...)
  local typo_sizes="[]"
  if [[ -n "$sec_typo" ]]; then
    local sizes
    sizes=$(printf '%s' "$sec_typo" | grep -oE '\b[0-9]+(\.[0-9]+)?(px|rem|em|pt)\b' | sort -u | head -n 12 \
      | awk '{printf "\"%s\",", $0}' | sed 's/,$//')
    [[ -n "$sizes" ]] && typo_sizes="[$sizes]"
  fi
  local distinct_count=0
  if [[ "$typo_sizes" != "[]" ]]; then
    distinct_count=$(echo "$typo_sizes" | tr -cd ',' | wc -c)
    distinct_count=$((distinct_count + 1))
  fi

  # Registry safety enabled if a section is present
  local registry_enabled="false"
  [[ -n "$sec_registry" ]] && registry_enabled="true"

  # Write evidence (raw mirror)
  local ev_dir="$PROJECT_ROOT/.uiux/evidence/$tag"
  mkdir -p "$ev_dir"
  ensure_under_root "$ev_dir" "$PROJECT_ROOT/.uiux"
  local ev_path="$ev_dir/gsd-ui-spec.yaml"
  {
    echo "# written-by: uiux-sdk@${UIUX_SDK_VERSION}"
    echo "schema_version: 1.0"
    echo "kind: gsd-ui-spec-mirror"
    echo "release_tag: $tag"
    echo "phase: \"$phase\""
    echo "source_path: \"${ui_spec#$PROJECT_ROOT/}\""
    echo "source_sha256: $hash"
    echo "mirrored_at: $(iso_now)"
    echo "raw_content: |"
    printf '%s\n' "$content" | sed 's/^/  /'
  } > "$ev_path"

  # Write chassis.yaml lock
  local lock_dir="$PROJECT_ROOT/.uiux/lock"
  mkdir -p "$lock_dir"
  local chassis_path="$lock_dir/chassis.yaml"
  {
    echo "# written-by: uiux-sdk@${UIUX_SDK_VERSION}"
    echo "schema_version: 1.0"
    echo "locked_at: $(iso_now)"
    echo "locked_by: \"uiux-sdk@${UIUX_SDK_VERSION}\""
    echo "release_tag: $tag"
    echo "phase: \"$phase\""
    echo ""
    echo "source:"
    echo "  type: gsd-ui-phase"
    echo "  path: \"${ui_spec#$PROJECT_ROOT/}\""
    echo "  sha256: $hash"
    echo "  mirrored_at: $(iso_now)"
    echo ""
    echo "design_contract:"
    echo "  spacing:"
    echo "    source_section: \"## Spacing\""
    echo "    scale: $spacing_scale"
    echo "    base_unit: 4"
    echo "  typography:"
    echo "    source_section: \"## Typography\""
    echo "    sizes: $typo_sizes"
    echo "    distinct_size_count: $distinct_count"
    echo "  color:"
    echo "    source_section: \"## Color\""
    echo "    palette:"
    echo "      dominant: null"
    echo "      secondary: null"
    echo "      accent: null"
    echo "    mode: light"
    echo "  copywriting:"
    echo "    source_section: \"## Copywriting\""
    echo "    ctas: []"
    echo "  registry_safety:"
    echo "    enabled: $registry_enabled"
    echo "    third_party_blocks: []"
    echo ""
    echo "validation:"
    echo "  required_sections_present: $required_present"
    local mi_out=""
    if (( ${#missing[@]} > 0 )); then
      mi_out="["
      local first=1
      for m in "${missing[@]}"; do
        if (( first==1 )); then mi_out+="\"$m\""; first=0; else mi_out+=",\"$m\""; fi
      done
      mi_out+="]"
    else
      mi_out="[]"
    fi
    echo "  missing_sections: $mi_out"
    echo "  warnings: []"
  } > "$chassis_path"

  # Update state
  if [[ -f "$PROJECT_ROOT/.uiux/state.json" ]]; then
    local init_at; init_at=$(extract_json_scalar "$PROJECT_ROOT/.uiux/state.json" "initialized_at")
    [[ -z "$init_at" || "$init_at" == "null" ]] && init_at="$(iso_now)"
    printf '{"active_release_tag":"%s","initialized_at":"%s","last_mirror_at":"%s","last_gate_at":null}\n' \
      "$tag" "$init_at" "$(iso_now)" > "$PROJECT_ROOT/.uiux/state.json"
  fi

  echo "$chassis_path"
  if [[ "$required_present" == "false" ]]; then
    echo "uiux-sdk: WARN missing sections in UI-SPEC: ${missing[*]}" >&2
    exit 2
  fi
  exit 0
}

cmd_mirror_gsd_ui_review() {
  need_arg "phase" "${1:-}"
  need_arg "release-tag" "${2:-}"
  validate_safe_name "phase" "$1"
  validate_safe_name "release-tag" "$2"
  local phase="$1" tag="$2"
  ensure_project_root

  local ui_review
  ui_review=$(find_phase_artifact "$PROJECT_ROOT" "$phase" "UI-REVIEW.md")
  if [[ -z "$ui_review" || ! -f "$ui_review" ]]; then
    echo "uiux-sdk: UI-REVIEW.md not found for phase '$phase' under $PROJECT_ROOT/.planning/phases/" >&2
    echo "Run /gsd-ui-review $phase first." >&2
    exit 2
  fi
  local content; content=$(cat "$ui_review")

  # Extract 6-pillar scores (very tolerant patterns)
  local s_copy s_visual s_color s_typo s_spacing s_xd
  extract_score() {
    local label="$1"
    printf '%s' "$content" \
      | grep -iE "$label" \
      | grep -oE '\b[1-4]\b' \
      | head -n1
  }
  s_copy=$(extract_score 'copy(writing)?[[:space:]]*[:|-][[:space:]]*[1-4]|copy(writing)?.*score.*[1-4]')
  s_visual=$(extract_score 'visuals?[[:space:]]*[:|-][[:space:]]*[1-4]|visual.*score.*[1-4]')
  s_color=$(extract_score 'colou?r[[:space:]]*[:|-][[:space:]]*[1-4]|colou?r.*score.*[1-4]')
  s_typo=$(extract_score 'typography[[:space:]]*[:|-][[:space:]]*[1-4]|typography.*score.*[1-4]')
  s_spacing=$(extract_score 'spacing[[:space:]]*[:|-][[:space:]]*[1-4]|spacing.*score.*[1-4]')
  s_xd=$(extract_score '(experience design|experience|xd)[[:space:]]*[:|-][[:space:]]*[1-4]|experience.*score.*[1-4]')

  # Defaults
  [[ -z "$s_copy" ]] && s_copy="null"
  [[ -z "$s_visual" ]] && s_visual="null"
  [[ -z "$s_color" ]] && s_color="null"
  [[ -z "$s_typo" ]] && s_typo="null"
  [[ -z "$s_spacing" ]] && s_spacing="null"
  [[ -z "$s_xd" ]] && s_xd="null"

  # Count blockers / warnings (case-insensitive)
  local blockers warnings
  blockers=$(printf '%s' "$content" | grep -ciE 'BLOCKER|severity:[[:space:]]*blocker' || true)
  warnings=$(printf '%s' "$content" | grep -ciE 'WARNING|severity:[[:space:]]*warning' || true)
  [[ -z "$blockers" ]] && blockers=0
  [[ -z "$warnings" ]] && warnings=0

  local ev_dir="$PROJECT_ROOT/.uiux/evidence/$tag"
  mkdir -p "$ev_dir"
  local out="$ev_dir/gsd-ui-review.yaml"
  {
    echo "# written-by: uiux-sdk@${UIUX_SDK_VERSION}"
    echo "schema_version: 1.0"
    echo "kind: gsd-ui-review-mirror"
    echo "release_tag: $tag"
    echo "phase: \"$phase\""
    echo "source_path: \"${ui_review#$PROJECT_ROOT/}\""
    echo "mirrored_at: $(iso_now)"
    echo ""
    echo "scores:"
    echo "  copywriting: $s_copy"
    echo "  visuals: $s_visual"
    echo "  color: $s_color"
    echo "  typography: $s_typo"
    echo "  spacing: $s_spacing"
    echo "  experience_design: $s_xd"
    echo ""
    echo "blocker_count: $blockers"
    echo "warning_count: $warnings"
  } > "$out"

  echo "$out"
  exit 0
}

cmd_lock_style() {
  need_arg "release-tag" "${1:-}"
  need_arg "style-skill" "${2:-}"
  validate_safe_name "release-tag" "$1"
  validate_safe_name "style-skill" "$2"
  local tag="$1" style="$2"
  shift 2
  local force=0
  local reason=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --force) force=1; shift;;
      --reason) reason="${2:-}"; shift 2;;
      *) echo "uiux-sdk lock.style: unknown arg '$1'" >&2; exit 2;;
    esac
  done
  ensure_project_root

  # Workflow blacklist (NEVER_LOCKABLE — can never BE an L3 style; see style-lock-policy.md §5).
  # prototyping-ui-directions added 2026-06-10: the mutex hook no longer blocks it pre-lock
  # (it is a legit EXPLORE sampler), so the SDK is now the sole guard against locking it as L3.
  case "$style" in
    redesign-skill|image-to-code-skill|stitch-skill|frontend-design-pro|frontend-design|frontend-pipeline|anchor-prototype-wave|sens-frontend-design|prototyping-ui-directions)
      echo "uiux-sdk lock.style: BLOCKED — '$style' is a workflow skill, not an L3 style (see references/style-lock-policy.md §5)" >&2
      exit 2
      ;;
  esac

  # Determine L3 family
  local family=""
  case "$style" in
    taste|taste-skill) family="taste";;
    luxury|luxury-editorial-site-builder) family="luxury";;
    minimalist|minimalist-skill) family="minimalist";;
    soft|soft-skill) family="soft";;
    brutalist|brutalist-skill) family="brutalist";;
    gpt-tasteskill) family="gpt-tasteskill";;
    *)
      echo "uiux-sdk lock.style: BLOCKED — unknown L3 style '$style' (must be one of taste|luxury|minimalist|soft|brutalist|gpt-tasteskill)" >&2
      exit 2
      ;;
  esac

  # Project whitelist check
  local cfg="$PROJECT_ROOT/.uiux/config.json"
  if [[ -f "$cfg" ]]; then
    if grep -q '"allowed_l3_styles"' "$cfg"; then
      local allowed
      allowed=$(grep -oE '"allowed_l3_styles"[[:space:]]*:[[:space:]]*\[[^]]*\]' "$cfg" \
        | sed -E 's/.*\[//; s/\].*//' | tr -d '"' | tr ',' ' ' | tr -s ' ')
      if [[ -n "$allowed" ]]; then
        local ok=0
        for a in $allowed; do
          if [[ "$a" == "$family" ]]; then ok=1; break; fi
        done
        if (( ok == 0 )); then
          echo "uiux-sdk lock.style: BLOCKED — '$family' not in project allowed_l3_styles=[${allowed}]" >&2
          exit 2
        fi
      fi
    fi
  fi

  local lock="$PROJECT_ROOT/.uiux/lock/style-lock.yaml"
  mkdir -p "$PROJECT_ROOT/.uiux/lock"

  if [[ -f "$lock" ]]; then
    # ★ R3 hardening — a corrupted/ambiguous style-lock must not let the mutex be bypassed
    local _lock_content; _lock_content=$(cat "$lock")
    local _lnc
    if ! _lnc=$(_uiux_assert_canonical_gate_yaml "$_lock_content" 'l3_style|release_tag'); then
      echo "uiux-sdk lock.style: BLOCKED — style-lock.yaml $_lnc (refusing ambiguous lock state)" >&2; exit 2
    fi
    if (( $(_uiux_count_key "$_lock_content" 'l3_style') > 1 )) || (( $(_uiux_count_key "$_lock_content" 'release_tag') > 1 )); then
      echo "uiux-sdk lock.style: BLOCKED — duplicate l3_style/release_tag in style-lock.yaml (ambiguous lock state)" >&2; exit 2
    fi
    local cur_family; cur_family=$(extract_scalar "$_lock_content" "l3_style")
    local cur_tag; cur_tag=$(extract_scalar "$_lock_content" "release_tag")
    if [[ "$cur_family" == "$family" ]]; then
      echo "uiux-sdk lock.style: already locked to '$family', no change"
      echo "$lock"
      exit 0
    fi
    if [[ "$cur_tag" == "$tag" ]]; then
      if (( force == 0 )); then
        echo "uiux-sdk lock.style: BLOCKED — release '$tag' already locked to family '$cur_family' (attempted '$family'). Use --force --reason \"<text>\" to unlock." >&2
        exit 2
      fi
      # ★ R3 hardening — reject whitespace-only reasons (30 spaces produced an empty audit entry)
      local _reason_nows; _reason_nows=$(printf '%s' "$reason" | tr -d '[:space:]')
      if [[ -z "$reason" || ${#reason} -lt 30 || ${#_reason_nows} -lt 15 ]]; then
        echo "uiux-sdk lock.style: BLOCKED — --force requires --reason with >=30 chars AND >=15 non-whitespace (got ${#reason} chars / ${#_reason_nows} non-ws)" >&2
        exit 2
      fi
      # Archive old lock
      local hist="$PROJECT_ROOT/.uiux/lock/.history"
      mkdir -p "$hist"
      local stamp; stamp=$(date -u +"%Y%m%d-%H%M%S")
      cp "$lock" "$hist/${stamp}-style-lock.yaml"
      # Record design debt
      {
        echo "# written-by: uiux-sdk@${UIUX_SDK_VERSION}"
        echo "schema_version: 1.0"
        echo "release_tag: \"$tag\""
        echo "unlocked_at: $(iso_now)"
        echo "from_family: \"$cur_family\""
        echo "to_family: \"$family\""
        echo "reason: |"
        printf '%s\n' "$reason" | sed 's/^/  /'
        echo "archived_to: \"$hist/${stamp}-style-lock.yaml\""
      } >> "$PROJECT_ROOT/.uiux/design-debt.yaml"
    fi
  fi

  {
    echo "# written-by: uiux-sdk@${UIUX_SDK_VERSION}"
    echo "schema_version: 1.0"
    echo "locked_at: $(iso_now)"
    echo "locked_by: \"uiux-sdk@${UIUX_SDK_VERSION}\""
    echo "release_tag: \"$tag\""
    echo "l3_style: $family"
    echo "l3_style_skill_id: \"$style\""
    echo "rationale: |"
    if [[ -n "$reason" ]]; then
      printf '%s\n' "$reason" | sed 's/^/  /'
    else
      echo "  Auto-locked via uiux-sdk lock.style (no user rationale provided)."
    fi
    echo "mode_a_evidence_path: null"
    echo "exploration_evidence_path: null"
    echo "excluded_alternatives: []"
    echo "locked_until_release: \"permanent\""
  } > "$lock"

  echo "$lock"
  exit 0
}

cmd_gate_plan() {
  need_arg "phase" "${1:-}"
  validate_safe_name "phase" "$1"
  local phase="$1"
  ensure_project_root

  # Check workflow.ui_safety_gate
  local pl_cfg="$PROJECT_ROOT/.planning/config.json"
  if [[ -f "$pl_cfg" ]]; then
    local v
    v=$(grep -oE '"ui_safety_gate"[[:space:]]*:[[:space:]]*false' "$pl_cfg" | head -n1 || true)
    if [[ -n "$v" ]]; then
      echo "uiux-sdk gate.plan: ui_safety_gate=false, skipping"
      exit 0
    fi
  fi

  local ui_spec
  ui_spec=$(find_phase_artifact "$PROJECT_ROOT" "$phase" "UI-SPEC.md")
  if [[ -z "$ui_spec" || ! -f "$ui_spec" ]]; then
    echo "uiux-sdk gate.plan: BLOCKED — no UI-SPEC.md found for phase '$phase'." >&2
    echo "Run /gsd-ui-phase $phase before /gsd-plan-phase $phase." >&2
    exit 2
  fi
  echo "uiux-sdk gate.plan: PASS — UI-SPEC at ${ui_spec#$PROJECT_ROOT/}"
  exit 0
}

cmd_drift_check() {
  need_arg "release-tag" "${1:-}"
  validate_safe_name "release-tag" "$1"
  local tag="$1"
  ensure_project_root
  local chassis="$PROJECT_ROOT/.uiux/lock/chassis.yaml"
  if [[ ! -f "$chassis" ]]; then
    echo "uiux-sdk drift.check: no chassis.yaml — run mirror.gsd-ui-spec first" >&2
    exit 2
  fi
  local locked_hash; locked_hash=$(extract_scalar "$(cat "$chassis")" "sha256")
  local source_rel; source_rel=$(extract_scalar "$(cat "$chassis")" "path")
  [[ -z "$source_rel" ]] && { echo "uiux-sdk drift.check: chassis source path missing" >&2; exit 2; }
  local full="$PROJECT_ROOT/$source_rel"
  if [[ ! -f "$full" ]]; then
    echo "uiux-sdk drift.check: source UI-SPEC missing at $full" >&2
    exit 2
  fi
  local current; current=$(sha256_of_file "$full")
  if [[ "$current" != "$locked_hash" ]]; then
    echo "uiux-sdk drift.check: DRIFT — chassis hash=$locked_hash, current UI-SPEC hash=$current" >&2
    exit 2
  fi
  echo "uiux-sdk drift.check: no drift"
  exit 0
}

cmd_gate_ship() {
  need_arg "release-tag" "${1:-}"
  validate_safe_name "release-tag" "$1"
  local tag="$1"
  shift
  local phase=""
  local allow_conditional=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --phase) phase="${2:-}"; shift 2;;
      --allow-conditional) allow_conditional=1; shift;;
      *) echo "uiux-sdk gate.ship: unknown arg '$1'" >&2; exit 2;;
    esac
  done
  ensure_project_root
  _LEDGER_TAG="$tag"; _LEDGER_STAGE="gate.ship"; trap _uiux_ledger_on_exit EXIT

  local dec="$PROJECT_ROOT/.uiux/decisions/$tag/uiux_release_decision.yaml"
  if [[ ! -f "$dec" ]]; then
    # Try to compute one inline if minimal artifacts are present
    if [[ -n "$phase" ]]; then
      cmd_decision_write_internal "$tag" "$phase"
    fi
  fi
  if [[ ! -f "$dec" ]]; then
    echo "uiux-sdk gate.ship: BLOCKED — no uiux_release_decision.yaml at $dec" >&2
    echo "Run uiux-sdk decision.write $tag (or invoke uiux-gsd-contract-validator agent)." >&2
    exit 2
  fi

  # ★ R3 hardening — reject non-canonical / duplicate decision before extraction
  local _dec_content; _dec_content=$(cat "$dec")
  local _dnc
  if ! _dnc=$(_uiux_assert_canonical_gate_yaml "$_dec_content" 'decision|release_tag|decided_at'); then
    echo "uiux-sdk gate.ship: BLOCKED — uiux_release_decision.yaml $_dnc (refusing ambiguous artifact)" >&2; exit 2
  fi
  if (( $(_uiux_count_key "$_dec_content" 'decision') > 1 )); then
    echo "uiux-sdk gate.ship: BLOCKED — duplicate 'decision:' keys in uiux_release_decision.yaml (ambiguous — refusing to guess)" >&2; exit 2
  fi
  local decision; decision=$(extract_scalar "$_dec_content" "decision")
  _LEDGER_DECISION="$decision"   # codex P2: record parsed decision accurately (CONDITIONAL_PASS, etc.)
  case "$decision" in
    PASS) echo "uiux-sdk gate.ship: PASS"; exit 0 ;;
    FAIL) echo "uiux-sdk gate.ship: FAIL — see $dec" >&2; exit 1 ;;
    BLOCKED) echo "uiux-sdk gate.ship: BLOCKED — see $dec" >&2; exit 2 ;;
    CONDITIONAL_PASS)
      echo "uiux-sdk gate.ship: CONDITIONAL_PASS — see $dec"
      if (( allow_conditional == 1 )); then exit 0; else exit 3; fi
      ;;
    *)
      echo "uiux-sdk gate.ship: BLOCKED — unrecognized decision '$decision'" >&2
      exit 2
      ;;
  esac
}

# Compose a decision yaml from current .uiux/ + .planning/ state.
# This is a deterministic, no-agent fallback for CI; richer reasoning belongs in
# the uiux-gsd-contract-validator agent.
cmd_decision_write_internal() {
  local tag="$1" phase="${2:-}"
  ensure_project_root
  local dec_dir="$PROJECT_ROOT/.uiux/decisions/$tag"
  mkdir -p "$dec_dir"
  local dec="$dec_dir/uiux_release_decision.yaml"

  # style_lock
  local lock="$PROJECT_ROOT/.uiux/lock/style-lock.yaml"
  local sl_status sl_family sl_skill
  if [[ -f "$lock" ]]; then
    sl_status="locked"
    sl_family=$(extract_scalar "$(cat "$lock")" "l3_style")
    sl_skill=$(extract_scalar "$(cat "$lock")" "l3_style_skill_id")
  else
    sl_status="not_required"
    sl_family="null"
    sl_skill="null"
  fi

  # chassis
  local chassis="$PROJECT_ROOT/.uiux/lock/chassis.yaml"
  local ch_status ch_source ch_hash ch_required
  if [[ -f "$chassis" ]]; then
    ch_required=$(extract_scalar "$(cat "$chassis")" "required_sections_present")
    ch_source=$(extract_scalar "$(cat "$chassis")" "path")
    ch_hash=$(extract_scalar "$(cat "$chassis")" "sha256")
    if [[ "$ch_required" == "true" ]]; then
      # drift check
      local cur; cur=$(sha256_of_file "$PROJECT_ROOT/$ch_source" 2>/dev/null || echo "")
      if [[ -n "$cur" && "$cur" != "$ch_hash" ]]; then
        ch_status="drift_detected"
      else
        ch_status="locked"
      fi
    else
      ch_status="partial"
    fi
  else
    ch_status="missing"
    ch_source="null"
    ch_hash="null"
  fi

  # ui_review
  local review_yaml="$PROJECT_ROOT/.uiux/evidence/$tag/gsd-ui-review.yaml"
  local rv_status="not_required"
  local rv_blockers=0 rv_warnings=0
  if [[ -f "$review_yaml" ]]; then
    rv_blockers=$(extract_scalar "$(cat "$review_yaml")" "blocker_count")
    rv_warnings=$(extract_scalar "$(cat "$review_yaml")" "warning_count")
    [[ -z "$rv_blockers" ]] && rv_blockers=0
    [[ -z "$rv_warnings" ]] && rv_warnings=0
    if (( rv_blockers > 0 )); then rv_status="blocker"
    elif (( rv_warnings > 0 )); then rv_status="warning"
    else rv_status="pass"; fi
  else
    # Check planning config ui_review
    local pl_cfg="$PROJECT_ROOT/.planning/config.json"
    if [[ -f "$pl_cfg" ]]; then
      if grep -qE '"ui_review"[[:space:]]*:[[:space:]]*false' "$pl_cfg"; then
        rv_status="not_required"
      else
        rv_status="missing"
      fi
    else
      rv_status="missing"
    fi
  fi

  # Compose decision
  local decision="PASS"
  local -a hbr=()
  local -a cnd=()

  if [[ "$ch_status" == "missing" ]]; then
    decision="BLOCKED"; hbr+=("chassis_missing")
  fi
  if [[ "$ch_status" == "drift_detected" ]]; then
    decision="FAIL"; hbr+=("chassis_drift_detected")
  fi
  if [[ "$rv_status" == "missing" ]]; then
    decision="BLOCKED"; hbr+=("ui_review_missing")
  fi
  if [[ "$rv_status" == "blocker" ]]; then
    decision="FAIL"; hbr+=("ui_review_blocker_count=$rv_blockers")
  fi
  if [[ "$decision" == "PASS" && "$rv_status" == "warning" ]]; then
    decision="CONDITIONAL_PASS"; cnd+=("ui_review_warning_count=$rv_warnings")
  fi

  # Emit hard_block_reasons / conditional_reasons
  local hbr_yaml="[]" cnd_yaml="[]"
  if (( ${#hbr[@]} > 0 )); then
    hbr_yaml="["; local first=1
    for r in "${hbr[@]}"; do
      if (( first==1 )); then hbr_yaml+="\"$r\""; first=0; else hbr_yaml+=",\"$r\""; fi
    done
    hbr_yaml+="]"
  fi
  if (( ${#cnd[@]} > 0 )); then
    cnd_yaml="["; local first=1
    for r in "${cnd[@]}"; do
      if (( first==1 )); then cnd_yaml+="\"$r\""; first=0; else cnd_yaml+=",\"$r\""; fi
    done
    cnd_yaml+="]"
  fi

  {
    echo "# written-by: uiux-sdk@${UIUX_SDK_VERSION}"
    echo "# do-not-edit: yes"
    echo "schema_version: 1.0"
    echo "release_tag: \"$tag\""
    echo "decision: $decision"
    echo "decided_at: $(iso_now)"
    echo "decided_by: \"uiux-sdk@${UIUX_SDK_VERSION}\""
    echo ""
    echo "gsd:"
    echo "  phase: \"${phase:-null}\""
    echo ""
    echo "style_lock:"
    echo "  status: $sl_status"
    echo "  l3_style: $sl_family"
    echo "  skill_id: \"${sl_skill}\""
    echo "  lock_path: \".uiux/lock/style-lock.yaml\""
    echo "  mutex_violations: []"
    echo ""
    echo "chassis:"
    echo "  status: $ch_status"
    echo "  source_type: gsd-ui-phase"
    echo "  source_path: \"${ch_source}\""
    echo "  source_sha256: \"${ch_hash}\""
    echo "  lock_path: \".uiux/lock/chassis.yaml\""
    echo "  drift_detected: $([[ "$ch_status" == "drift_detected" ]] && echo true || echo false)"
    echo ""
    echo "ui_review:"
    echo "  status: $rv_status"
    echo "  source_path: \".uiux/evidence/$tag/gsd-ui-review.yaml\""
    echo "  blocker_count: $rv_blockers"
    echo "  warning_count: $rv_warnings"
    echo ""
    echo "hard_block_reasons: $hbr_yaml"
    echo "conditional_reasons: $cnd_yaml"
    echo "warnings: []"
    echo ""
    echo "downstream_consumers:"
    echo "  - gsd-ship"
    echo "  - gsd-verify-work"
    echo "  - qa-visual-regression"
    echo "  - appsec-frontend-review"
  } > "$dec"

  echo "$dec"
}

cmd_decision_write() {
  need_arg "release-tag" "${1:-}"
  validate_safe_name "release-tag" "$1"
  local tag="$1"
  ensure_project_root
  cmd_decision_write_internal "$tag" ""
  exit 0
}

# ───── T1.1 (ADDITIVE — run-ledger black box; record-only, NEVER blocks) ─────
NODE_BIN="${NODE_BIN:-node}"
RUN_LEDGER="${RUN_LEDGER:-$CLAUDE_HOME/orchestrator-runtime/shared/run-ledger.js}"
_uiux_ledger() {
  local tag="$1" decision="$2" stage="$3"
  [[ -f "$RUN_LEDGER" ]] || return 0
  command -v "$NODE_BIN" >/dev/null 2>&1 || return 0
  "$NODE_BIN" "$RUN_LEDGER" append --project "$PROJECT_ROOT" \
    "--run_id=$tag" --subsystem=uiux "--stage=$stage" "--decision=$decision" \
    "--gate_result=$PROJECT_ROOT/.uiux/decisions/$tag/uiux_release_decision.yaml" >/dev/null 2>&1 || true
}
_uiux_ledger_on_exit() {
  local rc=$? decision="${_LEDGER_DECISION:-}"
  if [[ -z "$decision" ]]; then
    case "$rc" in 0) decision=PASS;; 1) decision=FAIL;; 2) decision=BLOCKED;; 3) decision=CONDITIONAL_PASS;; *) decision=RECORDED;; esac
  fi
  _uiux_ledger "${_LEDGER_TAG:-unknown}" "$decision" "${_LEDGER_STAGE:-gate.ship}"
  return 0
}
cmd_ledger_append() {
  ensure_project_root
  if [[ ! -f "$RUN_LEDGER" ]] || ! command -v "$NODE_BIN" >/dev/null 2>&1; then
    echo "uiux-sdk ledger.append: WARN — node/run-ledger unavailable; skipped (record-only, never blocks)" >&2; return 0
  fi
  local fwd=( append --project "$PROJECT_ROOT" --subsystem=uiux )
  if [[ -n "${1:-}" && "$1" != --* ]]; then fwd+=( "--run_id=$1" ); shift; fi
  while (( "$#" )); do
    case "$1" in
      --decision) fwd+=( "--decision=$2" ); shift 2;;
      --stage) fwd+=( "--stage=$2" ); shift 2;;
      --task) fwd+=( "--task=$2" ); shift 2;;
      --gate-result) fwd+=( "--gate_result=$2" ); shift 2;;
      --stdin) fwd+=( --stdin ); shift;;
      --*=*) fwd+=( "$1" ); shift;;
      *) shift;;
    esac
  done
  "$NODE_BIN" "$RUN_LEDGER" "${fwd[@]}"
}

# ───── Dispatch ─────
case "${1:-}" in
  init) shift; cmd_init "$@" ;;
  set-active) shift; cmd_set_active "$@" ;;
  detect.gsd) shift; cmd_detect_gsd "$@" ;;
  mirror.gsd-ui-spec) shift; cmd_mirror_gsd_ui_spec "$@" ;;
  mirror.gsd-ui-review) shift; cmd_mirror_gsd_ui_review "$@" ;;
  lock.style) shift; cmd_lock_style "$@" ;;
  gate.plan) shift; cmd_gate_plan "$@" ;;
  gate.ship) shift; cmd_gate_ship "$@" ;;
  decision.write) shift; cmd_decision_write "$@" ;;
  drift.check) shift; cmd_drift_check "$@" ;;
  ledger.append) shift; cmd_ledger_append "$@" ;;
  -h|--help|help|"") usage; exit 0 ;;
  *) echo "uiux-sdk: unknown command '$1'" >&2; usage; exit 2 ;;
esac
