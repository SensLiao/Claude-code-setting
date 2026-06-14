#!/usr/bin/env bash
# appsec-sdk — evidence sink + gate helper for appsec-security-orchestrator v3.0
# Contract: §17 of ~/.claude/skills/appsec-security-orchestrator/SKILL.md
#
# Project root resolution: walks upward from current dir for .appsec/config.json.
#
# Commands:
#   appsec-sdk init <release-tag>
#   appsec-sdk set-active <release-tag>
#   appsec-sdk evidence.append <tag> <layer> [<file>]
#   appsec-sdk evidence.list <tag>
#   appsec-sdk evidence.validate-presence <tag> [<expected-layers-csv>] [--legacy-path <path>]
#   appsec-sdk finding.add [<file>]                  # schema v1.0 + ASVS regex + raw-secret reject
#   appsec-sdk gate.check <tag> [--strict|--lax] [--allow-conditional] [--legacy-path <path>]
#   appsec-sdk redact                                # stdin → redacted stdout
#   appsec-sdk roe.verify <roe-file>                 # 13-field ROE checklist (11 user-visible sections)
#   appsec-sdk csf.coverage <tag>                    # GV/ID/PR/DE/RS/RC YAML
#   appsec-sdk overlay.activate <tag> <overlay-name>
#   appsec-sdk migrate-evidence [--from <path>] [--to <path>] [--dry-run]
#                                                    # D2 legacy-path adapter — move
#                                                    # .planning/security/ → .appsec/evidence/<tag>/
#
# Exit codes (per SKILL.md §17.2):
#   0 PASS / success
#   1 FAIL
#   2 BLOCKED / unsafe input / schema invalid / missing required
#   3 CONDITIONAL_PASS (collapses to 0 with --allow-conditional)

set -u

# ───── Project root resolution (walks upward for .appsec/config.json) ─────
find_project_root() {
  local dir; dir=$(pwd)
  local i=0
  while (( i < 12 )); do
    if [[ -f "$dir/.appsec/config.json" ]]; then
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
    echo "appsec-sdk: .appsec/config.json not found in current dir or any parent — is this an AppSec-enabled project?" >&2
    exit 1
  fi
}

# ───── init-only helpers: bootstrap config + project-local hooks ─────
# init must work BEFORE .appsec/config.json exists (it is what creates it).
CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
APPSEC_CONFIG_TEMPLATE="$CLAUDE_HOME/skills/appsec-security-orchestrator/templates/dot-appsec-skeleton/config.json.tmpl"
HOOK_INSTALLER="$CLAUDE_HOME/orchestrator-runtime/shared/install-subsystem-hooks.js"

resolve_or_create_root() {
  if PROJECT_ROOT=$(find_project_root); then return 0; fi
  PROJECT_ROOT="$(pwd)"
}

ensure_appsec_config() {
  local cfg="$PROJECT_ROOT/.appsec/config.json"
  [[ -f "$cfg" ]] && return 0
  mkdir -p "$PROJECT_ROOT/.appsec"
  if [[ -f "$APPSEC_CONFIG_TEMPLATE" ]]; then
    cp "$APPSEC_CONFIG_TEMPLATE" "$cfg"
    echo "appsec-sdk init: created .appsec/config.json from template (edit production_hosts / asvs_level before release)" >&2
  else
    printf '{"schema_version":"1.0","asvs_level":"L2","asvs_version":"5.0.0","strict_mode":"strict","overlays":[],"production_hosts":[]}\n' > "$cfg"
    echo "appsec-sdk init: created minimal .appsec/config.json (template missing)" >&2
  fi
}

install_appsec_hooks() {
  if [[ -f "$HOOK_INSTALLER" ]]; then
    node "$HOOK_INSTALLER" --subsystem appsec --project-root "$PROJECT_ROOT" >&2 \
      || echo "appsec-sdk init: WARN hook installer exited non-zero" >&2
  else
    echo "appsec-sdk init: WARN hook installer missing at $HOOK_INSTALLER — hooks NOT registered" >&2
  fi
}

# ───── Safety: validate names against allowlist ─────
validate_safe_name() {
  local kind="$1" value="$2"
  if [[ -z "$value" ]]; then echo "appsec-sdk: $kind is empty" >&2; exit 2; fi
  if ! [[ "$value" =~ ^[a-zA-Z0-9._-]+$ ]]; then
    echo "appsec-sdk: $kind '$value' contains unsafe characters (allowed: a-z A-Z 0-9 . _ -)" >&2
    exit 2
  fi
  if [[ "$value" == "." || "$value" == ".." || "$value" == *".."* ]]; then
    echo "appsec-sdk: $kind '$value' contains path traversal" >&2
    exit 2
  fi
}

need_arg() {
  if [[ -z "${2:-}" ]]; then echo "appsec-sdk: missing $1" >&2; exit 2; fi
}

iso_now() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

# Confirm resolved path stays under expected root (defense in depth)
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
    *) echo "appsec-sdk: refusing path-traversal: $out" >&2; exit 2;;
  esac
}

usage() {
  cat <<'USAGE'
appsec-sdk — appsec-security-orchestrator v3.0 evidence + gate helper

Commands:
  init [<tag>]        # bootstrap .appsec/config.json + register project-local hooks; <tag> optional (also makes evidence/findings/decisions dirs + active tag)
  set-active <tag>
  evidence.append <tag> <layer> [<file>]
  evidence.list <tag>
  evidence.validate-presence <tag> [<expected-layers-csv>] [--legacy-path <path>]
  finding.add [<file>]
  gate.check <tag> [--strict|--lax] [--allow-conditional] [--legacy-path <path>]
  redact                              (stdin → redacted stdout)
  roe.verify <roe-file>
  csf.coverage <tag>
  overlay.activate <tag> <overlay-name>
  asset.inventory <tag> [<file>]      # enterprise module #2 — standing asset map
  data.classify <tag> [<file>]        # enterprise module #3 — data classification map
  authz.matrix <tag> [<file>]         # enterprise module #7 — role x resource x action (IDOR/BOLA)
  attack.coverage <tag> [<file>]      # enterprise module #14 — MITRE ATT&CK coverage (defensive)
  pentest.recommend <tag> [<file>]    # feeds §16.9.5 surfacing; RECOMMENDATION ONLY (never auto-fires gate)
  control.coverage <tag>              # enterprise module #5 — ASVS 5.0 V1-V17 coverage matrix
  audit.package <tag> [--output <path>] # enterprise module #16 — auditor deliverable bundle
  migrate-evidence [--from <path>] [--to <path>] [--dry-run]
                                      (D2 legacy adapter; default --from .planning/security/
                                       --to .appsec/evidence/<active-tag>/)
  ledger.append <tag> [--decision <d>] [--stage <s>] [--gate-result <p>] [--k=v...]
                                      # T1.1 — append run-ledger row to <project>/.harness/runs.jsonl (record-only, NEVER blocks)
  control.matrix.verify [--map <f>] [--level baseline|elevated|regulated]
                                      # T1.2 — fail-closed: status:covered control without resolvable evidence_ref → FAIL
  tool.registry [<file>]              # T1.4 — validate a tool/MCP risk registry (T0-T6 ladder)
  tool.gate [--registry <f>] [--require]  # T1.4 — unclassified/unbound high-risk tool (T4+/T5/T6) → BLOCK
  lifecycle.transition <from> <to>    # T2.1 — 9-state vuln lifecycle; illegal jump → exit 1
  exception.sweep <tag>               # T2.1 — ACCEPTED_RISK past exception_expiry → exit 1 (must reopen)

Exit codes: 0=PASS  1=FAIL  2=BLOCKED  3=CONDITIONAL_PASS
With --allow-conditional, 3 collapses to 0.

Project root auto-detected by walking up to .appsec/config.json.
Tags / layers / overlays must match /^[a-zA-Z0-9._-]+$/.

D2 Legacy Path Adapter:
  Canonical evidence layout is .appsec/evidence/<tag>/. Projects migrating from
  v2.x may still have content under .planning/security/. The --legacy-path flag
  on validate-presence / gate.check makes the SDK ALSO scan the deprecated alias
  and emit a WARN-level finding when legacy content is observed. Use the
  migrate-evidence subcommand to relocate content into the canonical layout.
USAGE
}

# ───── Redaction (canonical) ─────
# Replaces matched secret patterns with <REDACTED:kind>. Used by every hook + agent.
redact_stdin() {
  # Read all stdin, then run sequential sed replacements.
  # NOTE: order matters — match more specific patterns first.
  local input; input=$(cat)
  # PEM private key blocks (multiline)
  input=$(printf '%s' "$input" | awk '
    BEGIN{drop=0}
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/ {print "<REDACTED:pem_private_key>"; drop=1; next}
    /-----END [A-Z ]*PRIVATE KEY-----/   {drop=0; next}
    drop==1 {next}
    {print}
  ')
  # Single-line patterns
  # ★ P7 fix (code-reviewer MEDIUM): sed `gI` flag is GNU-only; BSD/macOS sed silently no-ops.
  # ★ P7 fix (Tier 1 #4): openai_key body allows _ and -; sk-proj-/sk-svcacct-/sk-admin- prefixes.
  # Match credential KV with explicit case alternatives instead of `I` flag.
  input=$(printf '%s' "$input" | sed -E \
    -e 's/(AKIA[0-9A-Z]{16})/<REDACTED:aws_access_key>/g' \
    -e 's/(ASIA[0-9A-Z]{16})/<REDACTED:aws_session_key>/g' \
    -e 's/(aws_secret_access_key[[:space:]]*[:=][[:space:]]*)[A-Za-z0-9\/+=]{30,256}/\1<REDACTED:aws_secret>/g' \
    -e 's/(AWS_SECRET_ACCESS_KEY[[:space:]]*[:=][[:space:]]*)[A-Za-z0-9\/+=]{30,256}/\1<REDACTED:aws_secret>/g' \
    -e 's/(ghp_[A-Za-z0-9]{30,256})/<REDACTED:github_pat>/g' \
    -e 's/(gho_[A-Za-z0-9]{30,256})/<REDACTED:github_oauth>/g' \
    -e 's/(ghu_[A-Za-z0-9]{30,256})/<REDACTED:github_user>/g' \
    -e 's/(ghs_[A-Za-z0-9]{30,256})/<REDACTED:github_server>/g' \
    -e 's/(ghr_[A-Za-z0-9]{30,256})/<REDACTED:github_refresh>/g' \
    -e 's/(sk-ant-[A-Za-z0-9_-]{20,256})/<REDACTED:anthropic_key>/g' \
    -e 's/(sk-(proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,256})/<REDACTED:openai_key>/g' \
    -e 's/(xox[abprs]-[A-Za-z0-9-]{10,256})/<REDACTED:slack_token>/g' \
    -e 's/(eyJ[A-Za-z0-9_-]{10,512}\.[A-Za-z0-9_-]{10,512}\.[A-Za-z0-9_-]{10,512})/<REDACTED:jwt>/g' \
    -e 's/((PASSWORD|PASSWD|PWD|SECRET|TOKEN|API_KEY|APIKEY|PRIVATE_KEY|password|passwd|pwd|secret|token|api_key|apikey|private_key|Password|Passwd|Pwd|Secret|Token|Api_Key|ApiKey|Private_Key)[[:space:]]{0,8}[:=][[:space:]]{0,8})["'\'']?[^"'\''[:space:]]{8,256}["'\'']?/\1<REDACTED:credential>/g' \
  )
  printf '%s\n' "$input"
}

# Strip YAML comments (both whole-line `^# ...` and inline `<whitespace># ...$`)
# Used by raw-secret and ASVS 4.x detection so docstring/comment examples don't trip the gate.
strip_yaml_comments() {
  sed -E -e 's/^[[:space:]]*#.*$//' -e 's/[[:space:]]+#.*$//'
}

# Returns 0 if input is clean, 1 if any raw-secret pattern matched (used by finding.add).
# ★ P7 fix (code-reviewer HIGH #3): include JWT pattern + (Tier 1 #4) sk-proj-/sk-svcacct-/sk-admin- aware
contains_raw_secret() {
  local content="$1"
  # ★ fix (2026-06-10): (1) strip our own <REDACTED:...> markers first so an ALREADY-redacted
  # finding passes this gate; (2) add the credential-KV detector below — redact_stdin catches
  # `password = "..."`-style secrets but this raw-secret gate previously did NOT, so a finding
  # body with a hardcoded credential could land un-redacted via finding.add (the Bash path skips
  # the prewrite hook). Keep the two detectors in lock-step with redact_stdin's key set.
  local stripped; stripped=$(printf '%s' "$content" | strip_yaml_comments | sed -E 's/<REDACTED:[^>]*>//g')
  # Combined high-signal regex including JWT
  if printf '%s' "$stripped" | grep -qE '(AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|gho_[A-Za-z0-9]{30,}|ghu_[A-Za-z0-9]{30,}|ghs_[A-Za-z0-9]{30,}|ghr_[A-Za-z0-9]{30,}|sk-ant-[A-Za-z0-9_-]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})'; then
    return 1
  fi
  # OpenAI keys (sk-, sk-proj-, sk-svcacct-, sk-admin-) — body allows _ and -
  if printf '%s' "$stripped" | grep -qE 'sk-(proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}'; then
    return 1
  fi
  # credential KV — mirrors redact_stdin's PASSWORD|SECRET|TOKEN|API_KEY|… [:=] value{8,256}.
  # value class is non-space (surrounding quotes counted toward the length); redaction markers
  # were already stripped above so a properly-redacted finding does not trip this.
  if printf '%s' "$stripped" | grep -qiE '(PASSWORD|PASSWD|PWD|SECRET|TOKEN|API_KEY|APIKEY|PRIVATE_KEY)[[:space:]]{0,8}[:=][[:space:]]{0,8}[^[:space:]]{8,256}'; then
    return 1
  fi
  return 0
}

# ───── Commands ─────

cmd_init() {
  # release-tag is OPTIONAL: bare `appsec-sdk init` bootstraps .appsec/config.json +
  # registers project-local hooks (no release tag yet). `appsec-sdk init <tag>` ALSO
  # creates the evidence/findings/decisions dirs + active-tag state for that release.
  # Hooks gate on .appsec/config.json presence, so bare init makes enforcement live.
  local tag="${1:-}"
  resolve_or_create_root
  ensure_appsec_config
  install_appsec_hooks
  if [[ -z "$tag" ]]; then
    echo "$PROJECT_ROOT/.appsec"
    return 0
  fi
  validate_safe_name "release-tag" "$tag"
  local ev_dir="$PROJECT_ROOT/.appsec/evidence/$tag"
  local fnd_dir="$PROJECT_ROOT/.appsec/findings/$tag"
  local dec_dir="$PROJECT_ROOT/.appsec/decisions/$tag"
  mkdir -p "$ev_dir" "$fnd_dir" "$dec_dir"
  ensure_under_root "$ev_dir" "$PROJECT_ROOT/.appsec"
  ensure_under_root "$fnd_dir" "$PROJECT_ROOT/.appsec"
  ensure_under_root "$dec_dir" "$PROJECT_ROOT/.appsec"
  : > "$ev_dir/dispatch-failures.log"
  printf '{"active_release_tag":"%s","initialized_at":"%s","last_dispatch_at":null}\n' "$tag" "$(iso_now)" \
    > "$PROJECT_ROOT/.appsec/state.json"
  echo "$ev_dir"
}

cmd_set_active() {
  need_arg "release-tag" "${1:-}"
  validate_safe_name "release-tag" "$1"
  ensure_project_root
  # ★ P7 fix (drift D-011): preserve last_dispatch_at across tag switch (was: clobbered to null)
  local last_dispatch="null"
  if [[ -f "$PROJECT_ROOT/.appsec/state.json" ]]; then
    last_dispatch=$(grep -oE '"last_dispatch_at"[[:space:]]*:[[:space:]]*("[^"]*"|null)' "$PROJECT_ROOT/.appsec/state.json" \
      | head -n1 | sed -E 's/.*"last_dispatch_at"[[:space:]]*:[[:space:]]*//')
    [[ -z "$last_dispatch" ]] && last_dispatch="null"
  fi
  printf '{"active_release_tag":"%s","initialized_at":"%s","last_dispatch_at":%s}\n' "$1" "$(iso_now)" "$last_dispatch" \
    > "$PROJECT_ROOT/.appsec/state.json"
  echo "$PROJECT_ROOT/.appsec/state.json"
}

cmd_evidence_append() {
  need_arg "release-tag" "${1:-}"
  need_arg "layer" "${2:-}"
  validate_safe_name "release-tag" "$1"
  validate_safe_name "layer" "$2"
  local tag="$1" layer="$2" file="${3:-}"
  ensure_project_root
  local dir="$PROJECT_ROOT/.appsec/evidence/$tag/$layer"
  mkdir -p "$dir"
  ensure_under_root "$dir" "$PROJECT_ROOT/.appsec/evidence/$tag"
  # ★ P7 fix (code-reviewer HIGH #2): random hex suffix to avoid collision under rapid CI calls
  local stamp; stamp=$(date -u +"%Y%m%d-%H%M%S")
  local rand; rand=$(printf "%04x" $((RANDOM % 65536)))
  local out="$dir/${stamp}-${rand}.yaml"
  ensure_under_root "$out" "$dir"

  local content
  if [[ -n "$file" ]]; then
    if [[ ! -f "$file" ]]; then echo "appsec-sdk: file not found: $file" >&2; exit 1; fi
    content=$(cat "$file")
  else
    content=$(cat)
  fi

  # Always run through redaction before persisting
  local redacted; redacted=$(printf '%s' "$content" | redact_stdin)

  {
    echo "# written-by: appsec-sdk@3.0.0"
    echo "# appsec-sdk evidence.append"
    echo "# layer: $layer"
    echo "# release_tag: $tag"
    echo "# appended_at: $(iso_now)"
    printf '%s\n' "$redacted"
  } > "$out"
  echo "$out"
}

cmd_evidence_list() {
  need_arg "release-tag" "${1:-}"
  validate_safe_name "release-tag" "$1"
  ensure_project_root
  local dir="$PROJECT_ROOT/.appsec/evidence/$1"
  if [[ ! -d "$dir" ]]; then echo "appsec-sdk: no evidence dir for tag $1" >&2; exit 1; fi
  find "$dir" -type f -printf '%P\n' 2>/dev/null || (cd "$dir" && find . -type f | sed 's|^\./||')
}

cmd_evidence_validate_presence() {
  need_arg "release-tag" "${1:-}"
  validate_safe_name "release-tag" "$1"
  local tag="$1"; shift
  ensure_project_root
  local dir="$PROJECT_ROOT/.appsec/evidence/$tag"
  if [[ ! -d "$dir" ]]; then echo "appsec-sdk: no evidence dir for tag $tag" >&2; exit 2; fi
  # ★ D2 SDK adapter: parse remaining args (positional expected-layers-csv OR --legacy-path <path>)
  local expected_csv="" legacy_path=""
  while (( "$#" )); do
    case "$1" in
      --legacy-path)
        if [[ -z "${2:-}" ]]; then echo "appsec-sdk evidence.validate-presence: --legacy-path requires <path>" >&2; exit 2; fi
        legacy_path="$2"; shift 2;;
      --legacy-path=*)
        legacy_path="${1#--legacy-path=}"; shift;;
      *)
        # First non-flag positional is the expected-layers CSV (legacy positional contract)
        if [[ -z "$expected_csv" ]]; then expected_csv="$1"; shift
        else echo "appsec-sdk evidence.validate-presence: unexpected arg '$1'" >&2; exit 2; fi;;
    esac
  done
  # Required layers per §16 Dispatch Contract
  # ★ fix (2026-06-10): csf2-coverage removed from required INPUT layers. CSF 2.0 coverage is
  # COMPUTED by `appsec-sdk csf.coverage` from the other layers' presence and folded into the
  # release decision — it is NOT a stored input layer. Requiring a csf2-coverage/ dir that no
  # pipeline step ever produces caused a spurious BLOCK on the documented happy path.
  local required=(threat-model sca secret-scan sast code-review headers-cookies)
  if [[ -n "$expected_csv" ]]; then
    IFS=',' read -ra extra <<< "$expected_csv"
    for layer in "${extra[@]}"; do
      layer="${layer// /}"
      [[ -n "$layer" ]] && required+=("$layer")
    done
  fi
  local missing=()
  for layer in "${required[@]}"; do
    if [[ ! -d "$dir/$layer" ]] || [[ -z "$(ls -A "$dir/$layer" 2>/dev/null)" ]]; then
      missing+=("$layer")
    fi
  done
  # ★ D2 SDK adapter: if --legacy-path was given, ALSO scan the deprecated alias
  # and emit a WARN to stderr when legacy content is found. Does NOT block on
  # legacy content; that's the migration warning, not a release block.
  local legacy_warn=""
  if [[ -n "$legacy_path" ]]; then
    local legacy_dir="$PROJECT_ROOT/$legacy_path"
    [[ "$legacy_path" = /* ]] && legacy_dir="$legacy_path"
    if [[ -d "$legacy_dir" ]] && [[ -n "$(ls -A "$legacy_dir" 2>/dev/null)" ]]; then
      legacy_warn="$legacy_dir"
      echo "appsec-sdk evidence.validate-presence: WARN — legacy evidence found at $legacy_dir; run 'appsec-sdk migrate-evidence' to relocate into canonical .appsec/evidence/$tag/" >&2
    fi
  fi
  if (( ${#missing[@]} > 0 )); then
    echo "appsec-sdk: missing required evidence layers:" >&2
    for layer in "${missing[@]}"; do echo "  - $layer" >&2; done
    [[ -n "$legacy_warn" ]] && echo "  (note: legacy content present at $legacy_warn — migrate before release)" >&2
    exit 2
  fi
  echo "all required evidence layers present"
  [[ -n "$legacy_warn" ]] && echo "evidence_migration_required: true (legacy alias: $legacy_warn)"
  exit 0
}

# Extract the scalar value of a top-level YAML key, stripping inline `# comment` suffixes
# and surrounding quotes. Returns empty if key not found.
extract_scalar() {
  local content="$1" key="$2"
  printf '%s' "$content" \
    | grep -E "^[[:space:]]{0,4}${key}[[:space:]]*:" \
    | head -n1 \
    | sed -E "s/^[[:space:]]*${key}[[:space:]]*:[[:space:]]*//" \
    | sed -E 's/[[:space:]]+#.*$//' \
    | sed -E 's/^"(.*)"$/\1/' \
    | sed -E "s/^'(.*)'\$/\1/" \
    | sed -E 's/[[:space:]]+$//'
}

# Validate finding YAML against schema v1.0
# Returns 0 if valid; non-zero with stderr explanation otherwise.
validate_finding_yaml() {
  local content="$1"
  local missing=()
  for k in schema_version id source detector severity confidence asvs_mapping csf_function description; do
    if ! printf '%s' "$content" | grep -qE "^[[:space:]]{0,4}${k}[[:space:]]*:"; then
      missing+=("$k")
    fi
  done
  if (( ${#missing[@]} > 0 )); then
    echo "appsec-sdk finding.add: missing required fields: ${missing[*]}" >&2
    return 2
  fi
  # schema_version must be 1.0
  local sv; sv=$(extract_scalar "$content" "schema_version")
  if [[ "$sv" != "1.0" ]]; then
    echo "appsec-sdk finding.add: schema_version must be 1.0 (got '$sv')" >&2
    return 2
  fi
  # severity enum
  local sev; sev=$(extract_scalar "$content" "severity")
  case "$sev" in
    critical|high|medium|low) :;;
    *) echo "appsec-sdk finding.add: severity must be critical|high|medium|low (got '$sev')" >&2; return 2;;
  esac
  # confidence enum
  local cf; cf=$(extract_scalar "$content" "confidence")
  case "$cf" in
    high|medium|low) :;;
    *) echo "appsec-sdk finding.add: confidence must be high|medium|low (got '$cf')" >&2; return 2;;
  esac
  # csf_function enum
  local csf; csf=$(extract_scalar "$content" "csf_function")
  case "$csf" in
    GV|ID|PR|DE|RS|RC) :;;
    *) echo "appsec-sdk finding.add: csf_function must be GV|ID|PR|DE|RS|RC (got '$csf')" >&2; return 2;;
  esac
  # source enum
  local src; src=$(extract_scalar "$content" "source")
  case "$src" in
    sast|dast|sca|secret_scan|manual_review|pentest|external_disclosure|threat_model|iac_scan|container_scan|cloud_posture|secrets_engineering) :;;
    *) echo "appsec-sdk finding.add: source enum violation (got '$src')" >&2; return 2;;
  esac
  # ASVS regex — every entry under asvs_mapping must match ^v5\.0\.0-\d+\.\d+\.\d+$
  # Extract list items robustly (inline [v5.0.0-1.2.3, ...] or block "- v5.0.0-...")
  # ★ P7 fix (code-reviewer MEDIUM): track in_asvs_block so list items from OTHER fields
  # (e.g. affected_urls, cwe) do NOT bleed into the asvs_mapping check.
  local asvs_entries
  asvs_entries=$(printf '%s' "$content" | awk '
    BEGIN{in_asvs_block=0}
    /^[[:space:]]{0,4}asvs_mapping[[:space:]]*:[[:space:]]*\[/ {
      # Inline form: extract and dont enter block mode
      in_asvs_block=0
      line=$0
      sub(/^[^\[]*\[/, "", line)
      sub(/\].*$/, "", line)
      n=split(line, parts, ",")
      for (i=1;i<=n;i++) {
        gsub(/^[[:space:]"'\'']+|[[:space:]"'\'']+$/, "", parts[i])
        if (length(parts[i])>0) print parts[i]
      }
      next
    }
    /^[[:space:]]{0,4}asvs_mapping[[:space:]]*:[[:space:]]*$/ {
      in_asvs_block=1
      next
    }
    # Exit block on any other top-level key (start-of-line word followed by colon)
    in_asvs_block==1 && /^[[:space:]]{0,4}[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*:/ {
      in_asvs_block=0
    }
    in_asvs_block==1 && /^[[:space:]]+-[[:space:]]+/ {
      v=$0
      sub(/^[[:space:]]+-[[:space:]]+/, "", v)
      gsub(/[[:space:]"'\'']/, "", v)
      if (length(v)>0) print v
    }
  ')
  # Detect ASVS 4.x style identifiers anywhere → hard reject (after stripping YAML comments
  # so example references like "ASVS 4.x V2.1.1 deprecated" inside docstrings don't trip)
  local stripped_for_asvs
  stripped_for_asvs=$(printf '%s' "$content" | strip_yaml_comments)
  if printf '%s' "$stripped_for_asvs" | grep -qE '\bV[0-9]+\.[0-9]+\.[0-9]+\b'; then
    echo "appsec-sdk finding.add: ASVS 4.x identifier (V<n>.<n>.<n>) detected — must migrate to ASVS 5.0 format (v5.0.0-<chapter>.<section>.<requirement>)" >&2
    return 2
  fi
  if [[ -z "$asvs_entries" ]]; then
    # contracts-appsec#1 (2026-06-10): empty asvs_mapping [] is acceptable IFF the
    # finding carries a non-empty `unmapped_reason`. Many honest sca/secret_scan CVE
    # findings have NO truthful ASVS mapping; forcing >=1 incentivizes fabrication
    # (exactly what agents/appsec-finding-triager.md:64 warns against). Require an
    # explicit reason instead of a fabricated identifier.
    local unmapped; unmapped=$(extract_scalar "$content" "unmapped_reason")
    if [[ -n "$unmapped" ]]; then
      return 0   # empty mapping justified by unmapped_reason — accept
    fi
    echo "appsec-sdk finding.add: asvs_mapping is empty — provide at least one ASVS 5.0 identifier, OR add a non-empty 'unmapped_reason' explaining why no honest mapping exists (do NOT fabricate a mapping)" >&2
    return 2
  fi
  while IFS= read -r entry; do
    [[ -z "$entry" ]] && continue
    if ! [[ "$entry" =~ ^v5\.0\.0-[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "appsec-sdk finding.add: asvs_mapping entry '$entry' does not match ^v5\\.0\\.0-\\d+\\.\\d+\\.\\d+\$" >&2
      return 2
    fi
  done <<< "$asvs_entries"
  return 0
}

cmd_finding_add() {
  ensure_project_root
  local file="${1:-}"
  local content
  if [[ -n "$file" ]]; then
    if [[ ! -f "$file" ]]; then echo "appsec-sdk: file not found: $file" >&2; exit 1; fi
    content=$(cat "$file")
  else
    content=$(cat)
  fi

  # Raw secret in finding body → reject (force user to redact first)
  if ! contains_raw_secret "$content"; then
    echo "appsec-sdk finding.add: raw secret pattern detected in finding body — pipe through 'appsec-sdk redact' first" >&2
    exit 2
  fi

  if ! validate_finding_yaml "$content"; then
    exit 2
  fi

  # Determine active tag
  local tag=""
  if [[ -f "$PROJECT_ROOT/.appsec/state.json" ]]; then
    tag=$(grep -oE '"active_release_tag"[[:space:]]*:[[:space:]]*"[^"]+"' "$PROJECT_ROOT/.appsec/state.json" \
          | head -n1 | sed -E 's/.*"active_release_tag"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')
  fi
  if [[ -z "$tag" ]]; then
    echo "appsec-sdk finding.add: no active release tag — run 'appsec-sdk init <tag>' first" >&2
    exit 2
  fi
  validate_safe_name "release-tag" "$tag"

  local fnd_dir="$PROJECT_ROOT/.appsec/findings/$tag"
  mkdir -p "$fnd_dir"
  ensure_under_root "$fnd_dir" "$PROJECT_ROOT/.appsec/findings"
  local stamp; stamp=$(date -u +"%Y%m%d-%H%M%S")
  local rand; rand=$(printf "%04x" $((RANDOM % 65536)))
  local out="$fnd_dir/${stamp}-${rand}.yaml"
  ensure_under_root "$out" "$fnd_dir"

  {
    echo "# written-by: appsec-sdk@3.0.0"
    echo "# released_tag: $tag"
    echo "# added_at: $(iso_now)"
    printf '%s\n' "$content"
  } > "$out"
  echo "$out"
}

# ───── gate.check helpers (ADDITIVE — A1 canonical-schema + D2 freshness/STALE) ─────
#
# A1 — canonical gate-decision vocabulary validation.
# WHY: the existing decision extraction + case block can be satisfied by a malformed
# decision value (typo'd enum, calendar-invalid decided_at) that still parses by grep.
# This closes that hole by re-using the installed canonical validator
# (~/.claude/schemas/verdict-validator.js) instead of re-implementing schema logic.
#
# NOTE on shape: appsec_release_decision.yaml is a RICH nested release artifact (csf2_coverage,
# nested redaction{}, risk_acceptance[] …) and is intentionally NOT the flat canonical
# gate-result shape ({reason, evidence_refs, gate_tag}). Running the validator against the raw
# file with the default schema would false-reject every valid file (additionalProperties:false +
# missing reason/evidence_refs/gate_tag + nested seq-of-maps the flat-YAML reader rejects).
# So A1 synthesizes a MINIMAL canonical object from the fields that DO map
# (decision → enum, decided_at → timestamp, release_tag → gate_tag) and validates THAT.
# It runs WITHOUT --release-context on purpose: release semantics (STRATEGY_READY rejection,
# CONDITIONAL_PASS gating) remain owned by the existing case block below — A1 is pure
# vocabulary + format validation, so it can never double-block an already-approved flow.
NODE_BIN="${NODE_BIN:-node}"
VERDICT_VALIDATOR="${VERDICT_VALIDATOR:-$CLAUDE_HOME/schemas/verdict-validator.js}"

# json_escape <string> — minimal JSON string-body escaper for synthesized object.
json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"   # backslash first
  s="${s//\"/\\\"}"   # double quote
  s="${s//	/\\t}"    # tab
  printf '%s' "$s"
}

# gate_check_a1_canonical <decision_value> <timestamp> <gate_tag> <mode>
# Validates the canonical decision vocabulary via the installed validator.
# strict (default): BLOCK exit 2 on invalid / unavailable (fail-closed, mirrors validator design).
# lax: WARN only, never blocks.
gate_check_a1_canonical() {
  local d="$1" ts="$2" gt="$3" mode="$4"
  # Tooling availability — fail-closed in strict, WARN in lax.
  if ! command -v "$NODE_BIN" >/dev/null 2>&1 || [[ ! -f "$VERDICT_VALIDATOR" ]]; then
    if [[ "$mode" == "lax" ]]; then
      echo "appsec-sdk gate.check: WARN (lax) — canonical validator unavailable (node='$NODE_BIN', validator='$VERDICT_VALIDATOR'); skipping A1 schema check" >&2
      return 0
    fi
    echo "appsec-sdk gate.check: BLOCKED — canonical validator unavailable (node='$NODE_BIN', validator='$VERDICT_VALIDATOR'); cannot verify gate-decision schema (fail-closed)" >&2
    exit 2
  fi
  # Fallbacks so the synthesized object is always schema-shaped even if a field was unparsed.
  [[ -z "$ts" ]] && ts="1970-01-01T00:00:00Z"
  [[ -z "$gt" ]] && gt="unknown"
  local tmp; tmp=$(mktemp 2>/dev/null) || tmp="${TMPDIR:-/tmp}/appsec-a1-$$-$RANDOM"
  local tmp_json="${tmp}.json"
  printf '{"decision":"%s","reason":"appsec release decision: %s","evidence_refs":[],"timestamp":"%s","gate_tag":"%s","subsystem":"appsec","schema_version":"1.0.0"}\n' \
    "$(json_escape "$d")" "$(json_escape "$d")" "$(json_escape "$ts")" "$(json_escape "$gt")" > "$tmp_json"
  local out rc
  out=$("$NODE_BIN" "$VERDICT_VALIDATOR" "$tmp_json" 2>&1); rc=$?
  rm -f "$tmp" "$tmp_json" 2>/dev/null
  if (( rc != 0 )); then
    if [[ "$mode" == "lax" ]]; then
      echo "appsec-sdk gate.check: WARN (lax) — decision failed canonical gate-decision schema:" >&2
      printf '%s\n' "$out" >&2
      return 0
    fi
    echo "appsec-sdk gate.check: BLOCKED — decision failed canonical gate-decision schema validation:" >&2
    printf '%s\n' "$out" >&2
    exit 2
  fi
  return 0
}

# D2 — evidence freshness / STALE.
# WHY: a decision can be schema-valid and PASS yet be days/weeks old, no longer reflecting the
# current codebase/deps. This ages the decision against a configurable window and emits STALE
# (the canonical decision value for freshness expiry — see gate-decision.schema.yaml example).
# Window source: .appsec/config.json "evidence_freshness_hours". Conservative default below.
APPSEC_DEFAULT_FRESHNESS_HOURS=168   # 168h = 7 days; conservative default (matches canonical STALE example) when config omits evidence_freshness_hours

# read_freshness_hours — echo the configured window (positive integer) or the default.
read_freshness_hours() {
  local cfg="$PROJECT_ROOT/.appsec/config.json" hours=""
  if [[ -f "$cfg" ]]; then
    hours=$(grep -oE '"evidence_freshness_hours"[[:space:]]*:[[:space:]]*[0-9]+' "$cfg" \
            | head -n1 | sed -E 's/.*:[[:space:]]*([0-9]+).*/\1/')
  fi
  if [[ -n "$hours" && "$hours" =~ ^[0-9]+$ && "$hours" -gt 0 ]]; then
    printf '%s' "$hours"
  else
    printf '%s' "$APPSEC_DEFAULT_FRESHNESS_HOURS"
  fi
}

# epoch_of_iso <iso8601> — best-effort UTC epoch seconds; echoes empty on failure.
# E7 codex finding 4 (2026-06-05): prefer Node Date.parse for cross-platform robustness — it
# accepts fractional seconds (…:56.789Z) and numeric offsets (+00:00) that the BSD `date -j`
# fixed format string rejects, matching qa-sdk D2 exactly and removing the macOS/BSD false-BLOCK.
# Shell `date` is kept ONLY as a fallback if node is unavailable (A1 already fail-closes on no node).
epoch_of_iso() {
  local iso="$1" e=""
  if command -v "$NODE_BIN" >/dev/null 2>&1; then
    e=$("$NODE_BIN" -e 'const t=Date.parse(process.argv[1]); if(Number.isNaN(t))process.exit(1); process.stdout.write(String(Math.floor(t/1000)));' "$iso" 2>/dev/null) \
      && [[ -n "$e" ]] && { printf '%s' "$e"; return 0; }
  fi
  # GNU date (Linux / Git-Bash on Windows ships GNU date)
  e=$(date -u -d "$iso" +%s 2>/dev/null) && { printf '%s' "$e"; return 0; }
  # BSD/macOS date (strict format only; the node path above handles the richer ISO forms)
  e=$(date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$iso" +%s 2>/dev/null) && { printf '%s' "$e"; return 0; }
  return 1
}

# gate_check_d2_freshness <decided_at> <mode>
# strict (default): STALE → exit 2 when decision is older than the window.
# lax: WARN only, never blocks. Unparseable/missing decided_at: BLOCK in strict (cannot prove
# freshness → fail-closed), WARN in lax.
gate_check_d2_freshness() {
  local decided_at="$1" mode="$2"
  local hours; hours=$(read_freshness_hours)
  if [[ -z "$decided_at" ]]; then
    if [[ "$mode" == "lax" ]]; then
      echo "appsec-sdk gate.check: WARN (lax) — decided_at missing; cannot verify freshness (window=${hours}h)" >&2
      return 0
    fi
    echo "appsec-sdk gate.check: BLOCKED — decided_at missing; cannot verify freshness against ${hours}h window (fail-closed)" >&2
    exit 2
  fi
  local decided_epoch now_epoch age_h max_s
  decided_epoch=$(epoch_of_iso "$decided_at") || decided_epoch=""
  now_epoch=$(date -u +%s 2>/dev/null)
  if [[ -z "$decided_epoch" || -z "$now_epoch" ]]; then
    if [[ "$mode" == "lax" ]]; then
      echo "appsec-sdk gate.check: WARN (lax) — could not compute decision age from decided_at='$decided_at'" >&2
      return 0
    fi
    echo "appsec-sdk gate.check: BLOCKED — could not compute decision age from decided_at='$decided_at' (fail-closed)" >&2
    exit 2
  fi
  max_s=$(( hours * 3600 ))
  if (( now_epoch - decided_epoch > max_s )); then
    age_h=$(( (now_epoch - decided_epoch) / 3600 ))
    if [[ "$mode" == "lax" ]]; then
      echo "appsec-sdk gate.check: WARN (lax) — STALE: decision is ${age_h}h old (> ${hours}h freshness window); re-run release decision before shipping" >&2
      return 0
    fi
    echo "appsec-sdk gate.check: STALE — decision is ${age_h}h old (> ${hours}h freshness window); re-run release decision before shipping" >&2
    _LEDGER_DECISION="STALE"   # codex P2: ledger records true STALE, not exit-code-mapped BLOCKED
    exit 2
  fi
  return 0
}

# D3 — per-finding SLA breach (deterministic backstop). The evidence-validator agent SHOULD already
# reflect overdue findings in the decision, but the exit-code path CI / gsd-ship consumes must catch a
# PASS that contradicts an overdue OPEN finding independently of agent diligence (§10 SLA enforcement
# previously lived only in agent prose). Only open-ish findings count; mitigated/resolved/accepted
# (incl. risk-accepted) are exempt. Called ONLY from the PASS branch — CONDITIONAL_PASS exceptions are
# governed by risk_acceptance.
gate_check_d3_sla() {
  local tag="$1" mode="$2"
  local fnd_dir="$PROJECT_ROOT/.appsec/findings/$tag"
  [[ -d "$fnd_dir" ]] || return 0
  local now_epoch; now_epoch=$(date -u +%s 2>/dev/null) || return 0
  local breaches=() f content st due due_epoch id sev b
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    content=$(cat "$f" 2>/dev/null)
    due=$(extract_scalar "$content" "sla_due")
    [[ -z "$due" ]] && continue
    st=$(extract_scalar "$content" "status")
    case "$st" in
      ""|open|in_progress|reopened|new) :;;   # legacy open-ish → subject to SLA
      OPEN|TRIAGED|FIXING|RETEST_REQUIRED|RETEST_FAILED|EXPIRED_EXCEPTION) :;;  # codex P1: 9-state lifecycle open-ish → subject to SLA (EXPIRED_EXCEPTION is an active vuln again)
      *) continue;;                            # FIXED/CLOSED/ACCEPTED_RISK/mitigated/resolved/false_positive → exempt
    esac
    due_epoch=$(epoch_of_iso "$due") || due_epoch=""
    [[ -z "$due_epoch" ]] && continue
    if (( now_epoch > due_epoch )); then
      id=$(extract_scalar "$content" "id"); [[ -z "$id" ]] && id="$(basename "$f")"
      sev=$(extract_scalar "$content" "severity")
      breaches+=("$id (severity=${sev:-?}, sla_due=$due, status=${st:-open})")
    fi
  done < <(find "$fnd_dir" -type f -name '*.yaml' 2>/dev/null)
  if (( ${#breaches[@]} > 0 )); then
    if [[ "$mode" == "lax" ]]; then
      echo "appsec-sdk gate.check: WARN (lax) — ${#breaches[@]} open finding(s) past SLA due date:" >&2
      for b in "${breaches[@]}"; do echo "    - $b" >&2; done
      return 0
    fi
    echo "appsec-sdk gate.check: BLOCKED — ${#breaches[@]} open finding(s) past SLA due date (fix or formally risk-accept before release):" >&2
    for b in "${breaches[@]}"; do echo "    - $b" >&2; done
    exit 2
  fi
  return 0
}

cmd_gate_check() {
  need_arg "release-tag" "${1:-}"
  validate_safe_name "release-tag" "$1"
  local tag="$1"; shift
  local mode="strict" allow_conditional="false" legacy_path=""
  while (( "$#" )); do
    case "$1" in
      --strict)            mode="strict"; shift;;
      --lax)               mode="lax"; shift;;
      --allow-conditional) allow_conditional="true"; shift;;
      --legacy-path)
        # ★ D2 SDK adapter: scan deprecated .planning/security/ alias and emit WARN
        if [[ -z "${2:-}" ]]; then echo "appsec-sdk gate.check: --legacy-path requires <path>" >&2; exit 2; fi
        legacy_path="$2"; shift 2;;
      --legacy-path=*)     legacy_path="${1#--legacy-path=}"; shift;;
      *) echo "appsec-sdk gate.check: unknown arg $1" >&2; exit 2;;
    esac
  done
  ensure_project_root
  # ★ T1.1 (ADDITIVE) — install EXIT trap so EVERY gate.check exit path records its final
  # outcome in the run ledger (the black box). Record-only; never alters the gate's exit code.
  _LEDGER_TAG="$tag"; _LEDGER_STAGE="gate.check"
  trap _gate_ledger_on_exit EXIT
  # ★ D2 SDK adapter: WARN (but do not block) when legacy evidence content is observed
  if [[ -n "$legacy_path" ]]; then
    local legacy_dir="$PROJECT_ROOT/$legacy_path"
    [[ "$legacy_path" = /* ]] && legacy_dir="$legacy_path"
    if [[ -d "$legacy_dir" ]] && [[ -n "$(ls -A "$legacy_dir" 2>/dev/null)" ]]; then
      echo "appsec-sdk gate.check: WARN — legacy evidence found at $legacy_dir; run 'appsec-sdk migrate-evidence' before release. Gate not blocked on legacy alone." >&2
    fi
  fi
  local decision_file="$PROJECT_ROOT/.appsec/decisions/$tag/appsec_release_decision.yaml"
  if [[ ! -f "$decision_file" ]]; then
    echo "appsec-sdk gate.check: BLOCKED — $decision_file missing" >&2
    exit 2
  fi

  local decision
  decision=$(grep -v '^[[:space:]]*#' "$decision_file" \
    | grep -E '^[[:space:]]{0,4}decision[[:space:]]*:' | head -n1 \
    | sed -E 's/^[[:space:]]*decision[[:space:]]*:[[:space:]]*"?([A-Z_]+)"?.*/\1/')
  if [[ -z "$decision" ]]; then
    echo "appsec-sdk gate.check: BLOCKED — decision field missing in $decision_file" >&2
    exit 2
  fi

  # ★ Codex adversarial finding (2026-06-14) — duplicate-key smuggling: a decision file with TWO
  # top-level `decision:` keys (e.g. PASS bait + BLOCKED terminal) would let the grep|head extractor
  # above silently pick the FIRST. YAML duplicate mapping keys are ambiguous/malformed; a fail-closed
  # gate must REFUSE to guess. Same for decided_at (freshness integrity). Count uses the SAME pattern
  # the extractor uses, so any ambiguity the extractor could resolve arbitrarily is caught.
  local _dco _dao
  _dco=$(grep -v '^[[:space:]]*#' "$decision_file" | grep -cE '^[[:space:]]{0,4}decision[[:space:]]*:' || true)
  if (( _dco > 1 )); then
    echo "appsec-sdk gate.check: BLOCKED — $_dco conflicting 'decision:' keys in $decision_file (ambiguous/duplicate — refusing to guess; possible smuggling)" >&2
    exit 2
  fi
  _dao=$(grep -v '^[[:space:]]*#' "$decision_file" | grep -cE '^[[:space:]]{0,4}decided_at[[:space:]]*:' || true)
  if (( _dao > 1 )); then
    echo "appsec-sdk gate.check: BLOCKED — $_dao 'decided_at:' keys in $decision_file (ambiguous timestamp — refusing to guess)" >&2
    exit 2
  fi

  # ★ A1 + D2 (ADDITIVE) — run AFTER decision extraction, BEFORE redaction/case judgment.
  # Both honor existing --strict (default) / --lax semantics: strict blocks, lax WARNs only.
  local decided_at_val
  decided_at_val=$(grep -v '^[[:space:]]*#' "$decision_file" \
    | grep -E '^[[:space:]]{0,4}decided_at[[:space:]]*:' | head -n1 \
    | sed -E 's/^[[:space:]]*decided_at[[:space:]]*:[[:space:]]*"?([^"#[:space:]]+)"?.*/\1/')
  # E7 codex finding 3 (2026-06-05): canonical gate-decision-shaped files use `timestamp:` rather
  # than the rich decision's `decided_at:`. Prefer decided_at, fall back to a top-level timestamp
  # before D2 fail-closes — defensive, never loosens (still requires SOME parseable timestamp).
  # E7 round-2 (codex): anchor the fallback to column 0 (`^timestamp:`) — a 0-4-space-indented
  # match would wrongly pick up a NESTED `timestamp:` (e.g. inside an evidence block) and age the
  # gate against the wrong time. A canonical top-level timestamp is always at column 0.
  if [[ -z "$decided_at_val" ]]; then
    decided_at_val=$(grep -v '^[[:space:]]*#' "$decision_file" \
      | grep -E '^timestamp[[:space:]]*:' | head -n1 \
      | sed -E 's/^timestamp[[:space:]]*:[[:space:]]*"?([^"#[:space:]]+)"?.*/\1/')
  fi
  # ★ A1 — canonical gate-decision schema/vocabulary validation via installed validator
  gate_check_a1_canonical "$decision" "$decided_at_val" "$tag" "$mode"
  # ★ D2 — evidence freshness / STALE against .appsec/config.json evidence_freshness_hours
  gate_check_d2_freshness "$decided_at_val" "$mode"

  local redaction_attested
  redaction_attested=$(grep -v '^[[:space:]]*#' "$decision_file" \
    | awk '/^[[:space:]]{0,4}redaction[[:space:]]*:/{in_block=1; next} in_block && /^[^[:space:]]/{in_block=0} in_block' \
    | grep -E '^[[:space:]]+attested[[:space:]]*:' | head -n1 \
    | sed -E 's/^[[:space:]]+attested[[:space:]]*:[[:space:]]*(true|false).*/\1/')
  if [[ "$redaction_attested" != "true" ]]; then
    echo "appsec-sdk gate.check: BLOCKED — redaction.attested != true (got '$redaction_attested')" >&2
    exit 2
  fi

  # ★ T1.2 (ADDITIVE) — control-matrix verify. Fires ONLY if a control map exists, so projects
  # without .harness/control-matrix.json are unaffected. strict: FAIL/BLOCK propagates; lax: WARN.
  # codex P1: fail-closed once the artifact exists — a present control map with a missing/
  # mis-resolved verifier must BLOCK (strict) / WARN (lax), NOT silently skip (fail-open).
  local _cm_map="$PROJECT_ROOT/.harness/control-matrix.json"
  if [[ -f "$_cm_map" ]]; then
    if [[ ! -f "$CONTROL_VERIFY" ]] || ! command -v "$NODE_BIN" >/dev/null 2>&1; then
      if [[ "$mode" == "lax" ]]; then
        echo "appsec-sdk gate.check: WARN (lax) — control-matrix present but verifier/node unavailable; cannot verify" >&2
      else
        echo "appsec-sdk gate.check: BLOCKED — control-matrix present but verifier/node unavailable (fail-closed)" >&2
        exit 2
      fi
    else
      local _cmv_out _cmv_rc
      _cmv_out=$("$NODE_BIN" "$CONTROL_VERIFY" "$_cm_map" "$PROJECT_ROOT" 2>&1); _cmv_rc=$?
      if (( _cmv_rc != 0 )); then
        if [[ "$mode" == "lax" ]]; then
          echo "appsec-sdk gate.check: WARN (lax) — control-matrix verify non-clean:" >&2; printf '%s\n' "$_cmv_out" >&2
        else
          printf '%s\n' "$_cmv_out" >&2
          echo "appsec-sdk gate.check: control-matrix verify failed (rc=$_cmv_rc)" >&2
          exit "$_cmv_rc"
        fi
      fi
    fi
  fi
  # ★ T1.4 (ADDITIVE) — tool-risk gate. Fires ONLY if a tool-risk registry exists; fail-closed once present.
  local _tr_reg="$PROJECT_ROOT/.harness/tool-risk.json"
  if [[ -f "$_tr_reg" ]]; then
    if [[ ! -f "$TOOL_VERIFY" ]] || ! command -v "$NODE_BIN" >/dev/null 2>&1; then
      if [[ "$mode" == "lax" ]]; then
        echo "appsec-sdk gate.check: WARN (lax) — tool-risk registry present but verifier/node unavailable; cannot verify" >&2
      else
        echo "appsec-sdk gate.check: BLOCKED — tool-risk registry present but verifier/node unavailable (fail-closed)" >&2
        exit 2
      fi
    else
      local _trv_out _trv_rc
      _trv_out=$("$NODE_BIN" "$TOOL_VERIFY" "$_tr_reg" 2>&1); _trv_rc=$?
      if (( _trv_rc != 0 )); then
        if [[ "$mode" == "lax" ]]; then
          echo "appsec-sdk gate.check: WARN (lax) — tool-risk verify non-clean:" >&2; printf '%s\n' "$_trv_out" >&2
        else
          printf '%s\n' "$_trv_out" >&2
          echo "appsec-sdk gate.check: tool-risk verify failed (rc=$_trv_rc)" >&2
          exit "$_trv_rc"
        fi
      fi
    fi
  fi

  _LEDGER_DECISION="$decision"   # codex P2: record the parsed decision (PASS/FAIL/BLOCKED/CONDITIONAL_PASS) accurately
  case "$decision" in
    PASS)
      gate_check_d3_sla "$tag" "$mode"   # a PASS must not coexist with an overdue OPEN finding
      echo "appsec-sdk gate.check: PASS"; exit 0;;
    FAIL)
      echo "appsec-sdk gate.check: FAIL" >&2; exit 1;;
    BLOCKED)
      echo "appsec-sdk gate.check: BLOCKED" >&2; exit 2;;
    CONDITIONAL_PASS)
      # Verify risk_acceptance section is present and non-empty
      local ra_present
      ra_present=$(grep -E '^[[:space:]]{0,4}risk_acceptance[[:space:]]*:' "$decision_file" | head -n1)
      if [[ -z "$ra_present" ]]; then
        echo "appsec-sdk gate.check: BLOCKED — CONDITIONAL_PASS requires risk_acceptance: in decision YAML" >&2
        exit 2
      fi
      # Need at least one entry with approver + approval_date + review_date
      local ra_items
      ra_items=$(awk '/^[[:space:]]{0,4}risk_acceptance[[:space:]]*:/{in_block=1; next} in_block && /^[^[:space:]]/{in_block=0} in_block' "$decision_file")
      if ! printf '%s' "$ra_items" | grep -qE 'approver[[:space:]]*:' || \
         ! printf '%s' "$ra_items" | grep -qE 'approval_date[[:space:]]*:' || \
         ! printf '%s' "$ra_items" | grep -qE 'review_date[[:space:]]*:'; then
        echo "appsec-sdk gate.check: BLOCKED — risk_acceptance missing approver/approval_date/review_date" >&2
        exit 2
      fi
      echo "appsec-sdk gate.check: CONDITIONAL_PASS (risk-acceptance validated)"
      if [[ "$allow_conditional" == "true" ]]; then exit 0; else exit 3; fi
      ;;
    *)
      echo "appsec-sdk gate.check: BLOCKED — unknown decision='$decision'" >&2; exit 2;;
  esac
}

cmd_redact() { redact_stdin; }

cmd_roe_verify() {
  need_arg "roe-file" "${1:-}"
  local roe="$1"
  if [[ ! -f "$roe" ]]; then echo "appsec-sdk roe.verify: file not found: $roe" >&2; exit 2; fi
  # 13 canonical field names (= 11 user-visible ROE sections per §17.1 / pentest-scope-and-roe;
  # emergency_contact + rollback are split out, authorization_proof is an anchor field).
  local required=(target_identification authorization_proof environment scope \
                  allowed_methods disallowed_methods time_window rate_limits \
                  test_accounts data_handling emergency_contact rollback reporting_format)
  local missing=()
  for k in "${required[@]}"; do
    # Match EITHER a machine-readable YAML key (e.g. `target_identification:`) OR a markdown
    # section header — tolerating a numbered prefix like "## 1. Target Identification" (the
    # shipped PENTEST-ROE.md template uses numbered headers; the `[0-9.]*` allows them).
    if ! grep -qE "^[[:space:]]{0,4}${k}[[:space:]]*:" "$roe" && \
       ! grep -qiE "^#+[[:space:]]*[0-9.]*[[:space:]]*${k//_/ }" "$roe"; then
      missing+=("$k")
    fi
  done
  if (( ${#missing[@]} > 0 )); then
    echo "appsec-sdk roe.verify: ROE missing required items:" >&2
    for k in "${missing[@]}"; do echo "  - $k" >&2; done
    exit 2
  fi
  echo "appsec-sdk roe.verify: ROE 13-field checklist OK (11 user-visible sections)"
  exit 0
}

cmd_csf_coverage() {
  need_arg "release-tag" "${1:-}"
  validate_safe_name "release-tag" "$1"
  ensure_project_root
  local tag="$1"
  local ev_dir="$PROJECT_ROOT/.appsec/evidence/$tag"
  if [[ ! -d "$ev_dir" ]]; then echo "appsec-sdk csf.coverage: no evidence for tag $tag" >&2; exit 2; fi
  # Heuristic mapping from layer presence to CSF function status
  declare -A layer_for
  layer_for[GV]="threat-model"
  layer_for[ID]="threat-model"
  layer_for[PR]="sast code-review headers-cookies"
  layer_for[DE]="secret-scan sca"
  layer_for[RS]="pentest"
  layer_for[RC]="recovery"

  echo "# appsec-sdk csf.coverage"
  echo "# release_tag: $tag"
  echo "# generated_at: $(iso_now)"
  echo "# note: Internal evidence completeness gate per SKILL.md §3; not a NIST CSF release checklist claim."
  echo "csf2_coverage:"
  local f layers status paths
  for f in GV ID PR DE RS RC; do
    layers="${layer_for[$f]}"
    paths=()
    local any_present=0 all_present=1
    for layer in $layers; do
      if [[ -d "$ev_dir/$layer" ]] && [[ -n "$(ls -A "$ev_dir/$layer" 2>/dev/null)" ]]; then
        paths+=(".appsec/evidence/$tag/$layer/")
        any_present=1
      else
        all_present=0
      fi
    done
    if (( any_present == 0 )); then
      status="MISSING"
    elif (( all_present == 1 )); then
      status="PASS"
    else
      status="PARTIAL"
    fi
    echo "  $f:"
    echo "    status: $status"
    if (( ${#paths[@]} == 0 )); then
      echo "    evidence_paths: []"
    else
      echo "    evidence_paths:"
      for p in "${paths[@]}"; do echo "      - $p"; done
    fi
  done
}

cmd_overlay_activate() {
  need_arg "release-tag" "${1:-}"
  need_arg "overlay-name" "${2:-}"
  validate_safe_name "release-tag" "$1"
  validate_safe_name "overlay-name" "$2"
  ensure_project_root
  local tag="$1" overlay="$2"
  case "$overlay" in
    mobile|llm|multitenant|websocket|file_upload|payment|cn_data|api|privacy) :;;
    *) echo "appsec-sdk overlay.activate: unknown overlay '$overlay' (allowed: mobile|llm|multitenant|websocket|file_upload|payment|cn_data|api|privacy)" >&2; exit 2;;
  esac
  local dir="$PROJECT_ROOT/.appsec/evidence/$tag/overlay-$overlay"
  mkdir -p "$dir"
  ensure_under_root "$dir" "$PROJECT_ROOT/.appsec/evidence/$tag"
  printf 'activated_at: %s\noverlay: %s\nstatus: activated\n' "$(iso_now)" "$overlay" > "$dir/.activated"
  echo "$dir/.activated"
}

# ───── Enterprise security modules (v3.0 P1 — fact-source writers + generators) ─────
# Extend the evidence sink with the enterprise body-of-knowledge fact-sources
# (asset inventory / data classification / authz matrix / ATT&CK coverage /
# pentest recommendation) + two generators (control.coverage, audit.package).
# Every writer redacts before persisting and stays under .appsec/.

# _write_layer_artifact <tag> <layer> <content> [<basename>]
# Shared writer: redact + stamp + write into .appsec/evidence/<tag>/<layer>/.
# Mirrors cmd_evidence_append's core but with a caller-chosen layer + optional
# stable basename (standing artifacts overwrite; omit basename → timestamped).
_write_layer_artifact() {
  local tag="$1" layer="$2" content="$3" base="${4:-}"
  validate_safe_name "release-tag" "$tag"
  validate_safe_name "layer" "$layer"
  local dir="$PROJECT_ROOT/.appsec/evidence/$tag/$layer"
  mkdir -p "$dir"
  ensure_under_root "$dir" "$PROJECT_ROOT/.appsec/evidence/$tag"
  local fname
  if [[ -n "$base" ]]; then
    validate_safe_name "filename" "$base"
    fname="$base"
  else
    local stamp; stamp=$(date -u +"%Y%m%d-%H%M%S")
    local rand; rand=$(printf "%04x" $((RANDOM % 65536)))
    fname="${stamp}-${rand}.yaml"
  fi
  local out="$dir/$fname"
  ensure_under_root "$out" "$dir"
  local redacted; redacted=$(printf '%s' "$content" | redact_stdin)
  {
    echo "# written-by: appsec-sdk@3.0.0"
    echo "# layer: $layer"
    echo "# release_tag: $tag"
    echo "# appended_at: $(iso_now)"
    printf '%s\n' "$redacted"
  } > "$out"
  echo "$out"
}

# _content_or_skeleton <file> <skeleton> — content from <file>, from stdin if <file> is
# the literal "-", else the skeleton. NEVER reads stdin implicitly (an agent calling the
# command non-interactively with no file must get the skeleton, not a hang on an empty pipe).
_content_or_skeleton() {
  local file="$1" skeleton="$2"
  if [[ "$file" == "-" ]]; then
    cat                                   # explicit stdin opt-in
  elif [[ -n "$file" ]]; then
    if [[ ! -f "$file" ]]; then echo "appsec-sdk: file not found: $file" >&2; exit 1; fi
    cat "$file"
  else
    printf '%s' "$skeleton"               # default: write the documented skeleton
  fi
}

# asset.inventory <tag> [<file>] — enterprise module #2 (standing asset map)
cmd_asset_inventory() {
  need_arg "release-tag" "${1:-}"; ensure_project_root
  local tag="$1" file="${2:-}"
  local skeleton; skeleton=$(cat <<'YAML'
schema_version: "1.0"
artifact: asset-inventory
# Enterprise module #2. Enumerate every asset that carries or exposes risk; give
# each a STABLE id so findings / authz-matrix / data-classification can reference it.
assets:
  - id: ASSET-001
    type: service          # service | api | datastore | frontend | agent-tool | third-party | cloud-resource
    name: ""
    exposure: internal     # public | internal | private
    auth_required: true
    data_classes: []       # subset of [public, internal, confidential, restricted]
    owner: ""
    notes: ""
YAML
)
  local content; content=$(_content_or_skeleton "$file" "$skeleton")
  _write_layer_artifact "$tag" "asset-inventory" "$content" "asset-inventory.yaml"
}

# data.classify <tag> [<file>] — enterprise module #3 (standing data-classification map)
cmd_data_classify() {
  need_arg "release-tag" "${1:-}"; ensure_project_root
  local tag="$1" file="${2:-}"
  local skeleton; skeleton=$(cat <<'YAML'
schema_version: "1.0"
artifact: data-classification
# Enterprise module #3. Classify each data entity by sensitivity + where it flows
# + how it is protected. Tiers align with finding schema affected.data_classes.
data_entities:
  - id: DATA-001
    name: ""
    classification: internal   # public | internal | confidential | restricted
    pii: false
    stores: []                 # asset ids from asset-inventory
    flows_to: []               # asset ids
    protection: []             # e.g. [at-rest-encryption, tls, field-masking, tokenization]
    retention: ""
YAML
)
  local content; content=$(_content_or_skeleton "$file" "$skeleton")
  _write_layer_artifact "$tag" "data-classification" "$content" "data-classification.yaml"
}

# authz.matrix <tag> [<file>] — enterprise module #7 (role x resource x action, IDOR/BOLA)
cmd_authz_matrix() {
  need_arg "release-tag" "${1:-}"; ensure_project_root
  local tag="$1" file="${2:-}"
  local skeleton; skeleton=$(cat <<'YAML'
schema_version: "1.0"
artifact: authz-matrix
# Enterprise module #7. Persist the role x resource x action matrix that
# security-app-api / security-app-multitenant review in prose, so IDOR/BOLA/BFLA
# coverage is auditable evidence, not just a code-review note.
roles: []                      # e.g. [anonymous, user, admin, tenant_owner]
resources: []                  # e.g. [order, invoice, admin_panel]
matrix:
  - role: ""
    resource: ""
    actions_allowed: []        # subset of [create, read, update, delete, list]
    object_level_check: false  # BOLA/IDOR: is ownership enforced server-side?
    function_level_check: false# BFLA: is the role enforced server-side?
    verdict: not_tested        # pass | fail | not_tested
    evidence_ref: ""
YAML
)
  local content; content=$(_content_or_skeleton "$file" "$skeleton")
  _write_layer_artifact "$tag" "authz-matrix" "$content" "authz-matrix.yaml"
}

# attack.coverage <tag> [<file>] — enterprise module #14 (MITRE ATT&CK technique coverage)
cmd_attack_coverage() {
  need_arg "release-tag" "${1:-}"; ensure_project_root
  local tag="$1" file="${2:-}"
  local skeleton; skeleton=$(cat <<'YAML'
schema_version: "1.0"
artifact: attack-coverage
# Enterprise module #14 (Red/Purple-Team planning, DEFENSIVE coverage only — no
# adversary emulation runs here; active validation stays behind the pentest gate).
# Map relevant MITRE ATT&CK techniques to detection/control status. Populated by
# security-response-red-purple-team. ATT&CK Navigator layer can be exported from this.
attack_coverage:
  framework: "MITRE ATT&CK Enterprise"
  techniques:
    - id: ""                   # e.g. T1190 (Exploit Public-Facing Application)
      tactic: ""               # e.g. Initial Access
      relevant: true
      control_status: none     # none | partial | covered
      detection_status: none   # none | partial | covered
      evidence_ref: ""
YAML
)
  local content; content=$(_content_or_skeleton "$file" "$skeleton")
  _write_layer_artifact "$tag" "attack-coverage" "$content" "attack-coverage.yaml"
}

# pentest.recommend <tag> [<file>] — feeds §16.9.5 proactive surfacing. RECOMMENDATION ONLY.
# Never auto-fires authorized-pentest-validation (manual: ROE -> sign-off -> /authorized-pentest-validation).
cmd_pentest_recommend() {
  need_arg "release-tag" "${1:-}"; ensure_project_root
  local tag="$1" file="${2:-}"
  local cfg="$PROJECT_ROOT/.appsec/config.json" asvs="unknown"
  if [[ -f "$cfg" ]]; then
    asvs=$(grep -oE '"asvs_level"[[:space:]]*:[[:space:]]*"[^"]*"' "$cfg" | head -n1 \
           | sed -E 's/.*"asvs_level"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/')
    [[ -z "$asvs" ]] && asvs="unknown"
  fi
  local skeleton; skeleton=$(cat <<YAML
schema_version: "1.0"
artifact: pentest-recommendation
release_tag: "$tag"
generated_at: "$(iso_now)"
# Computed honestly by appsec-evidence-validator (§16.9.5); this is the SDK fallback skeleton.
# recommended==true iff the project meets criteria (user-data L2+ / payment / admin /
# multitenant / public-api / llm-agent). RECOMMENDATION ONLY — never auto-fires the
# manual pentest gate. surfaced flips true once the user-facing card has been shown.
recommended: false
criteria_met: []           # subset of [user_data_L2plus, payment, admin, multitenant, external_network, llm_agent]
recommended_types: []      # subset of [web-app, api, authz-logic, ai-agent, cloud, network]
suggested_box: gray        # white (dev/source-assisted) | gray (pre-release) | black (mature external)
current_pentest_status: not_required
surfaced: false
detected_asvs_level: "$asvs"
next_action: "Draft ROE via pentest-scope-and-roe, then manually run /authorized-pentest-validation"
YAML
)
  local content; content=$(_content_or_skeleton "$file" "$skeleton")
  _write_layer_artifact "$tag" "pentest-recommend" "$content" "pentest-recommendation.yaml"
}

# control.coverage <tag> — enterprise module #5 (ASVS 5.0 V1-V17 coverage matrix).
# Honest, evidence-presence based: aggregates ASVS chapter references across findings +
# code-review evidence presence. NOT a formal conformance claim (mirrors csf.coverage).
cmd_control_coverage() {
  need_arg "release-tag" "${1:-}"; validate_safe_name "release-tag" "$1"; ensure_project_root
  local tag="$1"
  local fnd_dir="$PROJECT_ROOT/.appsec/findings/$tag"
  local ev_dir="$PROJECT_ROOT/.appsec/evidence/$tag"
  declare -A chap_count
  local f content e chap
  if [[ -d "$fnd_dir" ]]; then
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      content=$(cat "$f" 2>/dev/null)
      while IFS= read -r e; do
        [[ -z "$e" ]] && continue
        chap=$(printf '%s' "$e" | sed -E 's/^v5\.0\.0-([0-9]+)\..*/\1/')
        [[ "$chap" =~ ^[0-9]+$ ]] && chap_count[$chap]=$(( ${chap_count[$chap]:-0} + 1 ))
      done < <(printf '%s' "$content" | grep -oE 'v5\.0\.0-[0-9]+\.[0-9]+\.[0-9]+')
    done < <(find "$fnd_dir" -type f -name '*.yaml' 2>/dev/null)
  fi
  local code_review_present=0
  if [[ -d "$ev_dir/code-review" ]] && [[ -n "$(ls -A "$ev_dir/code-review" 2>/dev/null)" ]]; then code_review_present=1; fi
  # ASVS 5.0 chapter short names (index 1..17)
  local names=( "" "Encoding & Sanitization" "Validation & Business Logic" "Web Frontend Security" \
    "API & Web Service" "File Handling" "Authentication" "Session Management" "Authorization" \
    "Self-contained Tokens" "OAuth & OIDC" "Cryptography" "Secure Communication" "Configuration" \
    "Data Protection" "Secure Coding & Architecture" "Security Logging & Error Handling" "WebRTC" )
  echo "# appsec-sdk control.coverage"
  echo "# release_tag: $tag"
  echo "# generated_at: $(iso_now)"
  echo "# basis: ASVS 5.0 chapter references across findings + code-review evidence presence."
  echo "# NOT a formal ASVS conformance claim — an internal coverage/attention map."
  echo "control_coverage:"
  echo "  standard: \"OWASP ASVS 5.0 (V1-V17)\""
  echo "  chapters:"
  local i status cnt
  for i in $(seq 1 17); do
    cnt=${chap_count[$i]:-0}
    if (( cnt > 0 )); then status="ASSESSED"
    elif (( code_review_present == 1 )); then status="REVIEW_NO_FINDING"
    else status="NOT_ASSESSED"; fi
    echo "    V$i:"
    echo "      name: \"${names[$i]}\""
    echo "      findings_referencing: $cnt"
    echo "      status: $status"
  done
}

# audit.package <tag> [--output <path>] — enterprise module #16 (auditor deliverable bundle)
cmd_audit_package() {
  need_arg "release-tag" "${1:-}"; validate_safe_name "release-tag" "$1"; ensure_project_root
  local tag="$1"; shift
  local out_path=""
  while (( "$#" )); do
    case "$1" in
      --output)   if [[ -z "${2:-}" ]]; then echo "appsec-sdk audit.package: --output requires <path>" >&2; exit 2; fi
                  out_path="$2"; shift 2;;
      --output=*) out_path="${1#--output=}"; shift;;
      *) echo "appsec-sdk audit.package: unknown arg $1" >&2; exit 2;;
    esac
  done
  local base="$PROJECT_ROOT/.appsec"
  local stamp; stamp=$(date -u +"%Y%m%d-%H%M%S")
  local pkg_dir="$base/audit-package/${tag}-${stamp}"
  if [[ -n "$out_path" ]]; then
    pkg_dir="$PROJECT_ROOT/$out_path"; [[ "$out_path" = /* ]] && pkg_dir="$out_path"
  else
    ensure_under_root "$pkg_dir" "$base"
  fi
  mkdir -p "$pkg_dir"
  local n_ev=0 n_fnd=0 n_dec=0
  if [[ -d "$base/evidence/$tag" ]]; then cp -r "$base/evidence/$tag" "$pkg_dir/evidence" 2>/dev/null; n_ev=$(find "$base/evidence/$tag" -type f 2>/dev/null | wc -l | tr -d ' '); fi
  if [[ -d "$base/findings/$tag" ]]; then cp -r "$base/findings/$tag" "$pkg_dir/findings" 2>/dev/null; n_fnd=$(find "$base/findings/$tag" -type f 2>/dev/null | wc -l | tr -d ' '); fi
  if [[ -d "$base/decisions/$tag" ]]; then cp -r "$base/decisions/$tag" "$pkg_dir/decisions" 2>/dev/null; n_dec=$(find "$base/decisions/$tag" -type f 2>/dev/null | wc -l | tr -d ' '); fi
  local redaction_attested="unknown"
  local dec_file="$base/decisions/$tag/appsec_release_decision.yaml"
  if [[ -f "$dec_file" ]]; then
    redaction_attested=$(grep -v '^[[:space:]]*#' "$dec_file" \
      | awk '/^[[:space:]]{0,4}redaction[[:space:]]*:/{b=1;next} b&&/^[^[:space:]]/{b=0} b' \
      | grep -E '^[[:space:]]+attested[[:space:]]*:' | head -n1 | sed -E 's/.*:[[:space:]]*(true|false).*/\1/')
    [[ -z "$redaction_attested" ]] && redaction_attested="unknown"
  fi
  {
    echo "# appsec-sdk audit.package — auditor deliverable manifest"
    echo "schema_version: \"1.0\""
    echo "release_tag: \"$tag\""
    echo "generated_at: \"$(iso_now)\""
    echo "generated_by: \"appsec-sdk@3.0.0\""
    echo "redaction_attested: $redaction_attested"
    echo "contents:"
    echo "  evidence_files: $n_ev"
    echo "  finding_files: $n_fnd"
    echo "  decision_files: $n_dec"
    echo "note: \"All artifacts were redacted at write-time by appsec-sdk. Verify redaction_attested==true before external delivery.\""
  } > "$pkg_dir/MANIFEST.yaml"
  echo "$pkg_dir"
}

# ───── D2 SDK adapter: migrate-evidence ─────
# Relocates content from the deprecated alias .planning/security/ to the canonical
# .appsec/evidence/<active-tag>/ layout. Preserves sub-structure under each layer.
# Active tag is read from .appsec/state.json unless --to is given as an explicit path.
#
# Usage:
#   appsec-sdk migrate-evidence [--from <path>] [--to <path>] [--dry-run]
# Defaults:
#   --from .planning/security/
#   --to   .appsec/evidence/<active_release_tag>/
cmd_migrate_evidence() {
  ensure_project_root
  local from="" to="" dry_run="false"
  while (( "$#" )); do
    case "$1" in
      --from)      if [[ -z "${2:-}" ]]; then echo "appsec-sdk migrate-evidence: --from requires <path>" >&2; exit 2; fi
                   from="$2"; shift 2;;
      --from=*)    from="${1#--from=}"; shift;;
      --to)        if [[ -z "${2:-}" ]]; then echo "appsec-sdk migrate-evidence: --to requires <path>" >&2; exit 2; fi
                   to="$2"; shift 2;;
      --to=*)      to="${1#--to=}"; shift;;
      --dry-run)   dry_run="true"; shift;;
      *) echo "appsec-sdk migrate-evidence: unknown arg $1" >&2; exit 2;;
    esac
  done

  # Default --from = .planning/security/
  if [[ -z "$from" ]]; then from=".planning/security"; fi
  local from_dir="$PROJECT_ROOT/$from"
  [[ "$from" = /* ]] && from_dir="$from"

  # Default --to = .appsec/evidence/<active-tag>/ — read active tag from state.json
  local to_dir=""
  if [[ -n "$to" ]]; then
    to_dir="$PROJECT_ROOT/$to"
    [[ "$to" = /* ]] && to_dir="$to"
  else
    local tag=""
    if [[ -f "$PROJECT_ROOT/.appsec/state.json" ]]; then
      tag=$(grep -oE '"active_release_tag"[[:space:]]*:[[:space:]]*"[^"]+"' "$PROJECT_ROOT/.appsec/state.json" \
            | head -n1 | sed -E 's/.*"active_release_tag"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')
    fi
    if [[ -z "$tag" ]]; then
      echo "appsec-sdk migrate-evidence: no --to given and no active_release_tag in .appsec/state.json — run 'appsec-sdk init <tag>' or pass --to <path>" >&2
      exit 2
    fi
    validate_safe_name "release-tag" "$tag"
    to_dir="$PROJECT_ROOT/.appsec/evidence/$tag"
  fi

  if [[ ! -d "$from_dir" ]]; then
    echo "appsec-sdk migrate-evidence: source not found: $from_dir (nothing to migrate)" >&2
    exit 0
  fi
  if [[ -z "$(ls -A "$from_dir" 2>/dev/null)" ]]; then
    echo "appsec-sdk migrate-evidence: source empty: $from_dir (nothing to migrate)"
    exit 0
  fi

  ensure_under_root "$to_dir" "$PROJECT_ROOT/.appsec"
  if [[ "$dry_run" == "false" ]]; then
    mkdir -p "$to_dir"
  fi

  # Walk source; for each file, compute the relative path under from_dir and
  # mirror it under to_dir. Preserve sub-structure so a layer like
  # .planning/security/sast/foo.json becomes .appsec/evidence/<tag>/sast/foo.json.
  local moved=0 skipped=0 collisions=0
  local f rel target target_parent
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    rel="${f#"$from_dir"/}"
    target="$to_dir/$rel"
    target_parent="$(dirname "$target")"
    ensure_under_root "$target" "$to_dir"
    if [[ -e "$target" ]]; then
      echo "  COLLIDE $rel  (canonical wins, leaving $f in place)"
      collisions=$((collisions+1))
      skipped=$((skipped+1))
      continue
    fi
    if [[ "$dry_run" == "true" ]]; then
      echo "  DRY-RUN $rel -> $target"
    else
      mkdir -p "$target_parent"
      if mv "$f" "$target" 2>/dev/null; then
        echo "  MOVED   $rel"
        moved=$((moved+1))
      else
        echo "  FAIL    $rel (mv failed, source kept)" >&2
        skipped=$((skipped+1))
      fi
    fi
  done < <(find "$from_dir" -type f 2>/dev/null)

  echo ""
  echo "appsec-sdk migrate-evidence summary:"
  echo "  from: $from_dir"
  echo "  to:   $to_dir"
  echo "  moved:      $moved"
  echo "  skipped:    $skipped"
  echo "  collisions: $collisions (canonical preferred)"
  if [[ "$dry_run" == "true" ]]; then
    echo "  mode:       DRY-RUN (no files changed)"
  else
    # Stamp the migration so the validator can see legacy was processed.
    local stamp_file="$PROJECT_ROOT/.appsec/.migrate-evidence.log"
    {
      echo "# appsec-sdk migrate-evidence"
      echo "migrated_at: $(iso_now)"
      echo "from: $from_dir"
      echo "to:   $to_dir"
      echo "moved: $moved"
      echo "collisions: $collisions"
    } >> "$stamp_file"
    echo "  log:        $stamp_file"
  fi
  exit 0
}

# ───── T1.1 / T1.2 / T1.4 (ADDITIVE — run-ledger black box + control-matrix gate + tool-risk gate) ─────
# Design: the ledger is RECORD-ONLY (never blocks — governed verdicts stay with gate.check + spec_hash,
# CLAUDE.md §3.7). control.matrix.verify + tool.gate are fail-closed verifiers; gate.check reuses them
# ONLY when their artifact exists under .harness/, so projects without those files are unaffected (additive).
RUN_LEDGER="${RUN_LEDGER:-$CLAUDE_HOME/orchestrator-runtime/shared/run-ledger.js}"
CONTROL_VERIFY="${CONTROL_VERIFY:-$CLAUDE_HOME/schemas/control-matrix-verify.js}"
TOOL_VERIFY="${TOOL_VERIFY:-$CLAUDE_HOME/schemas/tool-risk-verify.js}"
LIFECYCLE_VERIFY="${LIFECYCLE_VERIFY:-$CLAUDE_HOME/schemas/lifecycle-transition-verify.js}"

# _gate_ledger <tag> <decision> <stage> — best-effort append to the run ledger. NEVER fails the caller.
_gate_ledger() {
  local tag="$1" decision="$2" stage="$3"
  [[ -f "$RUN_LEDGER" ]] || return 0
  command -v "$NODE_BIN" >/dev/null 2>&1 || return 0
  "$NODE_BIN" "$RUN_LEDGER" append --project "$PROJECT_ROOT" \
    "--run_id=$tag" --subsystem=appsec "--stage=$stage" "--decision=$decision" \
    "--gate_result=$PROJECT_ROOT/.appsec/decisions/$tag/appsec_release_decision.yaml" >/dev/null 2>&1 || true
}

# _gate_ledger_on_exit — EXIT trap installed inside cmd_gate_check: records the FINAL gate outcome
# (mapped from the real exit code) so the ledger row matches what the gate actually returned.
_gate_ledger_on_exit() {
  local rc=$?
  # codex P2: prefer the PARSED decision (set right before the case + by d2 STALE) so the ledger
  # records the true gate decision; exit-code mapping is only a fallback for early/uninstrumented exits.
  local decision="${_LEDGER_DECISION:-}"
  if [[ -z "$decision" ]]; then
    case "$rc" in
      0) decision=PASS;;
      1) decision=FAIL;;
      2) decision=BLOCKED;;
      3) decision=CONDITIONAL_PASS;;
      *) decision=RECORDED;;
    esac
  fi
  _gate_ledger "${_LEDGER_TAG:-unknown}" "$decision" "${_LEDGER_STAGE:-gate.check}"
  return 0
}

cmd_ledger_append() {
  ensure_project_root
  if [[ ! -f "$RUN_LEDGER" ]] || ! command -v "$NODE_BIN" >/dev/null 2>&1; then
    echo "appsec-sdk ledger.append: WARN — node/run-ledger unavailable; skipped (ledger is record-only, never blocks)" >&2
    return 0
  fi
  local fwd=( append --project "$PROJECT_ROOT" --subsystem=appsec )
  if [[ -n "${1:-}" && "$1" != --* ]]; then fwd+=( "--run_id=$1" ); shift; fi
  while (( "$#" )); do
    case "$1" in
      --decision)    fwd+=( "--decision=$2" ); shift 2;;
      --stage)       fwd+=( "--stage=$2" ); shift 2;;
      --task)        fwd+=( "--task=$2" ); shift 2;;
      --gate-result) fwd+=( "--gate_result=$2" ); shift 2;;
      --stdin)       fwd+=( --stdin ); shift;;
      --*=*)         fwd+=( "$1" ); shift;;
      *)             shift;;
    esac
  done
  "$NODE_BIN" "$RUN_LEDGER" "${fwd[@]}"
}

cmd_control_matrix_verify() {
  ensure_project_root
  local map="$PROJECT_ROOT/.harness/control-matrix.json" level="elevated"
  while (( "$#" )); do
    case "$1" in
      --map)   map="$2"; shift 2;;
      --level) level="$2"; shift 2;;
      *) echo "appsec-sdk control.matrix.verify: unknown arg $1" >&2; exit 2;;
    esac
  done
  if [[ ! -f "$map" ]]; then
    echo "appsec-sdk control.matrix.verify: BLOCKED — control map not found: $map" >&2
    echo "  author one per $CLAUDE_HOME/schemas/control-check-map.schema.json" >&2
    exit 2
  fi
  if [[ ! -f "$CONTROL_VERIFY" ]] || ! command -v "$NODE_BIN" >/dev/null 2>&1; then
    echo "appsec-sdk control.matrix.verify: BLOCKED — verifier/node unavailable (fail-closed)" >&2; exit 2
  fi
  "$NODE_BIN" "$CONTROL_VERIFY" "$map" "$PROJECT_ROOT" --level "$level"
}

cmd_tool_registry() {
  ensure_project_root
  local reg="$PROJECT_ROOT/.harness/tool-risk.json"
  [[ -n "${1:-}" && "$1" != --* ]] && { reg="$1"; shift; }
  if [[ ! -f "$reg" ]]; then
    echo "appsec-sdk tool.registry: no registry at $reg" >&2
    echo "  seed: cp $CLAUDE_HOME/templates/harness/tool-risk.seed.json $reg  (then classify your project's surface)" >&2
    exit 2
  fi
  if [[ ! -f "$TOOL_VERIFY" ]] || ! command -v "$NODE_BIN" >/dev/null 2>&1; then
    echo "appsec-sdk tool.registry: BLOCKED — verifier/node unavailable" >&2; exit 2
  fi
  "$NODE_BIN" "$TOOL_VERIFY" "$reg"
}

cmd_tool_gate() {
  ensure_project_root
  local reg="$PROJECT_ROOT/.harness/tool-risk.json" require=""
  while (( "$#" )); do
    case "$1" in
      --registry) reg="$2"; shift 2;;
      --require)  require="--require-registry"; shift;;
      *) echo "appsec-sdk tool.gate: unknown arg $1" >&2; exit 2;;
    esac
  done
  if [[ ! -f "$TOOL_VERIFY" ]] || ! command -v "$NODE_BIN" >/dev/null 2>&1; then
    echo "appsec-sdk tool.gate: BLOCKED — verifier/node unavailable (fail-closed)" >&2; exit 2
  fi
  "$NODE_BIN" "$TOOL_VERIFY" "$reg" $require
}

# T2.1 (ADDITIVE) — vuln lifecycle 9-state machine + expired-exception sweep.
cmd_lifecycle_transition() {
  if [[ ! -f "$LIFECYCLE_VERIFY" ]] || ! command -v "$NODE_BIN" >/dev/null 2>&1; then
    echo "appsec-sdk lifecycle.transition: BLOCKED — verifier/node unavailable (fail-closed)" >&2; exit 2
  fi
  "$NODE_BIN" "$LIFECYCLE_VERIFY" "${1:-}" "${2:-}"
}

cmd_exception_sweep() {
  ensure_project_root
  need_arg "release-tag" "${1:-}"; validate_safe_name "release-tag" "$1"
  local tag="$1"
  local fnd_dir="$PROJECT_ROOT/.appsec/findings/$tag"
  local now_epoch; now_epoch=$(date +%s)
  local expired=0 unbounded=0 total_ar=0 f content status expiry exp_epoch
  if [[ -d "$fnd_dir" ]]; then
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      content=$(cat "$f" 2>/dev/null)
      status=$(printf '%s\n' "$content" | grep -E '^[[:space:]]*status[[:space:]]*:' | head -n1 | sed -E 's/^[[:space:]]*status[[:space:]]*:[[:space:]]*"?([A-Za-z_]+)"?.*/\1/')
      [[ "$status" != "ACCEPTED_RISK" ]] && continue
      total_ar=$(( total_ar + 1 ))
      expiry=$(printf '%s\n' "$content" | grep -E '^[[:space:]]*exception_expiry[[:space:]]*:' | head -n1 | sed -E 's/^[[:space:]]*exception_expiry[[:space:]]*:[[:space:]]*"?([^"#[:space:]]+)"?.*/\1/')
      # codex P1: an ACCEPTED_RISK with NO (or unparseable) expiry is an UNBOUNDED acceptance that
      # never gets reviewed — that is a violation, not a pass. Treat missing/unparseable as review-due.
      if [[ -z "$expiry" ]]; then
        echo "  REVIEW-DUE: $(basename "$f") is ACCEPTED_RISK with no exception_expiry (unbounded acceptance — set a review date)"
        unbounded=$(( unbounded + 1 ))
        continue
      fi
      exp_epoch=$(epoch_of_iso "$expiry")
      if [[ -z "$exp_epoch" ]]; then
        echo "  REVIEW-DUE: $(basename "$f") has unparseable exception_expiry='$expiry' (cannot verify — treat as review-due)"
        unbounded=$(( unbounded + 1 ))
        continue
      fi
      if (( exp_epoch < now_epoch )); then
        echo "  EXPIRED: $(basename "$f") (expiry $expiry) -> must reopen to EXPIRED_EXCEPTION"
        expired=$(( expired + 1 ))
      fi
    done < <(find "$fnd_dir" -type f -name '*.yaml' 2>/dev/null)
  fi
  echo "appsec-sdk exception.sweep: tag=$tag accepted_risk=$total_ar expired=$expired unbounded=$unbounded"
  (( expired > 0 || unbounded > 0 )) && exit 1
  exit 0
}

main() {
  if (( $# < 1 )); then usage; exit 2; fi
  local cmd="$1"; shift
  case "$cmd" in
    init)                         cmd_init "$@";;
    set-active)                   cmd_set_active "$@";;
    evidence.append)              cmd_evidence_append "$@";;
    evidence.list)                cmd_evidence_list "$@";;
    evidence.validate-presence)   cmd_evidence_validate_presence "$@";;
    finding.add)                  cmd_finding_add "$@";;
    gate.check)                   cmd_gate_check "$@";;
    redact)                       cmd_redact;;
    roe.verify)                   cmd_roe_verify "$@";;
    csf.coverage)                 cmd_csf_coverage "$@";;
    overlay.activate)             cmd_overlay_activate "$@";;
    asset.inventory)              cmd_asset_inventory "$@";;
    data.classify)                cmd_data_classify "$@";;
    authz.matrix)                 cmd_authz_matrix "$@";;
    attack.coverage)              cmd_attack_coverage "$@";;
    pentest.recommend)            cmd_pentest_recommend "$@";;
    control.coverage)             cmd_control_coverage "$@";;
    audit.package)                cmd_audit_package "$@";;
    migrate-evidence)             cmd_migrate_evidence "$@";;
    ledger.append)                cmd_ledger_append "$@";;
    control.matrix.verify)        cmd_control_matrix_verify "$@";;
    tool.registry)                cmd_tool_registry "$@";;
    tool.gate)                    cmd_tool_gate "$@";;
    lifecycle.transition)         cmd_lifecycle_transition "$@";;
    exception.sweep)              cmd_exception_sweep "$@";;
    -h|--help|help)               usage; exit 0;;
    *) echo "appsec-sdk: unknown command $cmd" >&2; usage; exit 2;;
  esac
}

main "$@"
