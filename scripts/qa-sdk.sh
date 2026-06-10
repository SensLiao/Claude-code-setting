#!/usr/bin/env bash
# qa-sdk — evidence sink + gate helper for enterprise-qa-testing v3.1
# Contract: §17.4 of ~/.claude/skills/enterprise-qa-testing/SKILL.md
#
# Project root resolution: walks upward from current dir for .qa/config.json.
#
# Commands:
#   qa-sdk init <release-tag>                       # also writes .qa/state.json active_release_tag
#   qa-sdk set-active <release-tag>                 # update active tag without rebuild
#   qa-sdk evidence.append <tag> <layer> [<file>]
#   qa-sdk evidence.list <tag>
#   qa-sdk evidence.validate-presence <tag> [<expected-layers-csv>]
#   qa-sdk gate.check <tag> [--mode execution|plan-only|design-only]
#   qa-sdk finding.add [<file>]
#   qa-sdk quarantine.add --test <name> --owner <id> --issue <url> --expiry <YYYY-MM-DD> --repro <cmd> --unblock <cond> [--class <n>]
#   qa-sdk approve.snapshot --scope <csv> --reason <text> --hours <n> --pattern <regex> [--human-attested]
#
# Exit codes:
#   0 = success / PASS
#   1 = FAIL / generic error
#   2 = BLOCKED / missing required field / unsafe input

set -u

# ───── Project root resolution (walks upward for .qa/config.json) ─────
find_project_root() {
  local dir; dir=$(pwd)
  local i=0
  while (( i < 12 )); do
    if [[ -f "$dir/.qa/config.json" ]]; then
      printf '%s' "$dir"
      return 0
    fi
    local parent; parent=$(dirname "$dir")
    if [[ "$parent" == "$dir" ]]; then
      return 1
    fi
    dir="$parent"
    i=$((i+1))
  done
  return 1
}

PROJECT_ROOT=""
ensure_project_root() {
  if ! PROJECT_ROOT=$(find_project_root); then
    echo "qa-sdk: .qa/config.json not found in current dir or any parent — is this a QA-enabled project?" >&2
    exit 1
  fi
}

# ───── init-only helpers: bootstrap config + project-local hooks ─────
# init must work BEFORE .qa/config.json exists (it is what creates it), so it
# uses a softer root resolution than ensure_project_root.
CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
QA_CONFIG_TEMPLATE="$CLAUDE_HOME/templates/qa/.qa/config.json"
HOOK_INSTALLER="$CLAUDE_HOME/orchestrator-runtime/shared/install-subsystem-hooks.js"

resolve_or_create_root() {
  if PROJECT_ROOT=$(find_project_root); then return 0; fi
  PROJECT_ROOT="$(pwd)"
}

ensure_qa_config() {
  local cfg="$PROJECT_ROOT/.qa/config.json"
  [[ -f "$cfg" ]] && return 0
  mkdir -p "$PROJECT_ROOT/.qa"
  if [[ -f "$QA_CONFIG_TEMPLATE" ]]; then
    cp "$QA_CONFIG_TEMPLATE" "$cfg"
    echo "qa-sdk init: created .qa/config.json from template" >&2
  else
    printf '{"version":"1.0","qa_enforcement":"strict","default_mode":"execution"}\n' > "$cfg"
    echo "qa-sdk init: created minimal .qa/config.json (template missing)" >&2
  fi
}

install_qa_hooks() {
  if [[ -f "$HOOK_INSTALLER" ]]; then
    node "$HOOK_INSTALLER" --subsystem qa --project-root "$PROJECT_ROOT" >&2 \
      || echo "qa-sdk init: WARN hook installer exited non-zero" >&2
  else
    echo "qa-sdk init: WARN hook installer missing at $HOOK_INSTALLER — hooks NOT registered" >&2
  fi
}

# ───── Safety: validate tag / layer against allowlist (H-04 fix) ─────
validate_safe_name() {
  local kind="$1" value="$2"
  if [[ -z "$value" ]]; then
    echo "qa-sdk: $kind is empty" >&2
    exit 2
  fi
  if ! [[ "$value" =~ ^[a-zA-Z0-9._-]+$ ]]; then
    echo "qa-sdk: $kind '$value' contains unsafe characters (allowed: a-z A-Z 0-9 . _ -)" >&2
    exit 2
  fi
  if [[ "$value" == "." || "$value" == ".." || "$value" == *".."* ]]; then
    echo "qa-sdk: $kind '$value' contains path traversal" >&2
    exit 2
  fi
}

need_arg() {
  if [[ -z "${2:-}" ]]; then echo "qa-sdk: missing $1" >&2; exit 2; fi
}

iso_now() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

usage() {
  cat <<'USAGE'
qa-sdk — enterprise-qa-testing v3.1 evidence + gate helper

Commands:
  init [<tag>]        # bootstrap .qa/config.json + register project-local hooks; <tag> optional (also makes evidence dir + active tag)
  set-active <tag>
  evidence.append <tag> <layer> [<file>]
  evidence.list <tag>
  evidence.validate-presence <tag> [<expected-layers-csv>]
  gate.check <tag> [--mode execution|plan-only|design-only]
  finding.add [<file>]
  quarantine.add --test <name> --owner <id> --issue <url> --expiry <date> --repro <cmd> --unblock <cond> [--class <n>]
  approve.snapshot --scope <csv> --reason <text> --hours <n> --pattern <regex> [--human-attested]
  spec.hash <spec.json|-> -- compute canonical sha256:<hex> matching qa-preview-gate.js
  sentinel.write --run-id <id> --mode <m> --spec-file <p> --approval-text <txt> [--ttl-seconds <n>] [--approved-estimate-high <tokens>] [--preview-hash <hex>]
  sentinel.show <run-id>

Notes:
  Project root is auto-detected by walking up to .qa/config.json.
  Tags and layers must match /^[a-zA-Z0-9._-]+$/ (no traversal).
  Sentinel modes: quick-check | focused-qa-gate | release-readiness | commercial-cert | smoke | graph-smoke
  Mode commercial-cert REQUIRES --approved-estimate-high. TTL clamped [30, 3600] (hook enforces).
USAGE
}

# ───── Commands ─────

cmd_init() {
  # release-tag is OPTIONAL: bare `qa-sdk init` bootstraps config + registers
  # project-local hooks (no release tag yet). `qa-sdk init <tag>` ALSO creates the
  # evidence dir + active-tag state for that release. Hooks gate on .qa/config.json
  # presence, so bare init is enough to make enforcement live.
  local tag="${1:-}"
  resolve_or_create_root
  ensure_qa_config
  install_qa_hooks
  if [[ -z "$tag" ]]; then
    echo "$PROJECT_ROOT/.qa"
    return 0
  fi
  validate_safe_name "release-tag" "$tag"
  local dir="$PROJECT_ROOT/.qa/evidence/$tag"
  mkdir -p "$dir" "$PROJECT_ROOT/.qa/findings"
  : > "$dir/dispatch-failures.log"
  if [[ ! -f "$PROJECT_ROOT/.qa/quarantine.yaml" ]]; then
    printf "quarantine: []\n" > "$PROJECT_ROOT/.qa/quarantine.yaml"
  fi
  printf '{"active_release_tag":"%s","initialized_at":"%s"}\n' "$tag" "$(iso_now)" > "$PROJECT_ROOT/.qa/state.json"
  echo "$dir"
}

cmd_set_active() {
  need_arg "release-tag" "${1:-}"
  validate_safe_name "release-tag" "$1"
  ensure_project_root
  printf '{"active_release_tag":"%s","initialized_at":"%s"}\n' "$1" "$(iso_now)" > "$PROJECT_ROOT/.qa/state.json"
  echo "$PROJECT_ROOT/.qa/state.json"
}

cmd_evidence_append() {
  need_arg "release-tag" "${1:-}"
  need_arg "layer" "${2:-}"
  validate_safe_name "release-tag" "$1"
  validate_safe_name "layer" "$2"
  local tag="$1" layer="$2" file="${3:-}"
  ensure_project_root
  local dir="$PROJECT_ROOT/.qa/evidence/$tag"
  mkdir -p "$dir"
  local out="$dir/${layer}.yaml"

  # Confirm resolved path stays under the evidence dir (defense in depth against shell-side traversal)
  local resolved
  case "$(uname -s 2>/dev/null)" in
    MINGW*|MSYS*|CYGWIN*) resolved=$(cygpath -m "$out" 2>/dev/null || printf '%s' "$out");;
    *) resolved=$(readlink -f "$out" 2>/dev/null || printf '%s' "$out");;
  esac
  local root_resolved
  case "$(uname -s 2>/dev/null)" in
    MINGW*|MSYS*|CYGWIN*) root_resolved=$(cygpath -m "$dir" 2>/dev/null || printf '%s' "$dir");;
    *) root_resolved=$(readlink -f "$dir" 2>/dev/null || printf '%s' "$dir");;
  esac
  case "$resolved" in
    "$root_resolved"/*) :;;
    *) echo "qa-sdk: refusing path-traversal: $out" >&2; exit 2;;
  esac

  if [[ -n "$file" ]]; then
    if [[ ! -f "$file" ]]; then echo "qa-sdk: file not found: $file" >&2; exit 1; fi
    cat "$file" > "$out"
  else
    cat > "$out"
  fi

  local tmp; tmp=$(mktemp)
  {
    # E7 follow-up (2026-06-05, HANDOFF §6 "必须"): first non-empty line is the canonical qa-sdk
    # provenance marker so qa-bundle-write-guard's allow-path has a real producer (a model
    # reproducing an SDK artifact must carry this exact line). SDK writes go via Bash, NOT the
    # Write tool, so this adds ZERO new blocking — it only stamps provenance. Order-independent
    # downstream parsers (gate.check release_decision / D2 `# appended_at:`) are unaffected.
    echo "# written-by: qa-sdk@3.1.0"
    echo "# qa-sdk evidence.append"
    echo "# layer: $layer"
    echo "# release_tag: $tag"
    echo "# appended_at: $(iso_now)"
    cat "$out"
  } > "$tmp"
  mv "$tmp" "$out"
  echo "$out"
}

cmd_evidence_list() {
  need_arg "release-tag" "${1:-}"
  validate_safe_name "release-tag" "$1"
  ensure_project_root
  local dir="$PROJECT_ROOT/.qa/evidence/$1"
  if [[ ! -d "$dir" ]]; then echo "qa-sdk: no evidence dir for tag $1" >&2; exit 1; fi
  ls -1 "$dir"
}

cmd_evidence_validate_presence() {
  need_arg "release-tag" "${1:-}"
  validate_safe_name "release-tag" "$1"
  ensure_project_root
  local dir="$PROJECT_ROOT/.qa/evidence/$1"
  if [[ ! -d "$dir" ]]; then echo "qa-sdk: no evidence dir for tag $1" >&2; exit 1; fi
  local expected_csv="${2:-}"
  local required=(00-discovery.yaml 01-risk.yaml 02-layer-selection.yaml evidence_validation.yaml qa_evidence_bundle.yaml dispatch-failures.log)
  if [[ -n "$expected_csv" ]]; then
    IFS=',' read -ra extra <<< "$expected_csv"
    for layer in "${extra[@]}"; do
      layer="${layer// /}"
      [[ -n "$layer" ]] && required+=("${layer}.yaml")
    done
  fi
  local missing=()
  for f in "${required[@]}"; do
    if [[ ! -e "$dir/$f" ]]; then missing+=("$f"); fi
  done
  if (( ${#missing[@]} > 0 )); then
    echo "qa-sdk: missing required evidence files:" >&2
    for f in "${missing[@]}"; do echo "  - $f" >&2; done
    exit 1
  fi
  echo "all required evidence present"
  exit 0
}

cmd_gate_check() {
  need_arg "release-tag" "${1:-}"
  validate_safe_name "release-tag" "$1"
  local tag="$1"; shift
  local mode="execution"
  while (( "$#" )); do
    case "$1" in
      --mode) mode="${2:-}"; shift 2;;
      *) echo "qa-sdk gate.check: unknown arg $1" >&2; exit 2;;
    esac
  done
  ensure_project_root
  local bundle="$PROJECT_ROOT/.qa/evidence/$tag/qa_evidence_bundle.yaml"
  if [[ ! -f "$bundle" ]]; then
    echo "qa-sdk gate.check: BLOCKED — $bundle missing" >&2
    exit 2
  fi

  # Strip comments before regex match; anchor to start-of-line (H-06 alignment)
  local decision
  decision=$(grep -v '^[[:space:]]*#' "$bundle" | grep -E '^[[:space:]]{0,4}release_decision[[:space:]]*:' | head -n1 | sed -E 's/^[[:space:]]*release_decision[[:space:]]*:[[:space:]]*([A-Z_]+).*/\1/')

  if [[ -z "$decision" ]]; then
    echo "qa-sdk gate.check: BLOCKED — release_decision missing in bundle" >&2
    exit 2
  fi

  # ───── (A1) Canonical gate-decision schema validation (ADDITIVE 2026-06-05) ─────
  # The grep above only proves release_decision matches /[A-Z_]+/; it does NOT prove
  # the value is one of the 7 canonical gate-decision enum values. The bundle itself
  # is a deeply-nested qa_evidence_bundle YAML (flow maps + 2-level nesting) that the
  # fail-closed verdict-validator reader cannot parse, so we synthesize a minimal
  # canonical gate-decision object from the EXTRACTED scalar and validate THAT object
  # against gate-decision.schema via the installed validator. We intentionally do NOT
  # pass --release-context here: FAIL/BLOCKED/STRATEGY_READY must still fall through to
  # the existing case branches below (which produce the correct exit codes / mode
  # semantics). This check only adds: "is `decision` a canonical enum + required fields
  # well-formed". Any non-enum value would also have hit the old `*)` BLOCK branch, so
  # this is no regression — it just blocks earlier with a clearer schema error.
  local validator="$HOME/.claude/schemas/verdict-validator.js"
  # Fail-closed (consistent with qa D2 below + appsec A1): a release gate must NOT run without its
  # canonical schema validator, and must NOT silently skip A1 when object synthesis fails. Silent
  # non-enforcement on an infra gap is unacceptable (E7 codex findings 1+2, 2026-06-05). qa-sdk
  # gate.check has no --lax escape by design, so both branches hard-BLOCK.
  if [[ ! -f "$validator" ]]; then
    echo "qa-sdk gate.check: BLOCKED — verdict-validator.js not found at $validator; cannot verify canonical gate-decision schema (fail-closed)" >&2
    exit 2
  fi
  local vtmp; vtmp=$(mktemp)
  if node -e "
    const fs=require('fs');
    const obj={
      decision: process.argv[1],
      reason: 'qa-sdk gate.check canonical schema check for release_decision',
      evidence_refs: [process.argv[2]],
      timestamp: process.argv[3],
      gate_tag: 'qa/'+process.argv[4],
    };
    fs.writeFileSync(process.argv[5], JSON.stringify(obj));
  " "$decision" "$bundle" "$(iso_now)" "$tag" "$vtmp" 2>/dev/null; then
    if ! node "$validator" "$vtmp" >/dev/null 2>&1; then
      rm -f "$vtmp"
      echo "qa-sdk gate.check: BLOCKED — release_decision='$decision' fails canonical gate-decision schema (not in PASS|WARN|CONDITIONAL_PASS|FAIL|BLOCKED|STALE|STRATEGY_READY)" >&2
      exit 2
    fi
    rm -f "$vtmp"
  else
    rm -f "$vtmp"
    echo "qa-sdk gate.check: BLOCKED — could not synthesize canonical gate-decision object for schema check (fail-closed)" >&2
    exit 2
  fi

  # ───── (D2) Evidence freshness → STALE (ADDITIVE 2026-06-05) ─────
  # Read evidence_freshness_hours from .qa/config.json (default 168h = 7 days). Compare
  # the bundle's age, preferring the SDK-written `# appended_at:` comment (evidence.append
  # always writes it), falling back to the `generated_at:` field. Over-age => STALE exit 2.
  # Fail-closed: a bundle with no parseable freshness marker in a gate context is STALE.
  local cfg="$PROJECT_ROOT/.qa/config.json"
  local fresh_hours=168
  if [[ -f "$cfg" ]]; then
    local cfg_hours
    cfg_hours=$(node -e "
      try {
        const c=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));
        const v=c.evidence_freshness_hours;
        if (Number.isInteger(v) && v>0) process.stdout.write(String(v));
      } catch (e) {}
    " "$cfg" 2>/dev/null)
    if [[ "$cfg_hours" =~ ^[1-9][0-9]*$ ]]; then
      fresh_hours="$cfg_hours"
    fi
  fi
  # Extract age marker: prefer `# appended_at: <ISO>`, fall back to `generated_at: <ISO>`.
  local age_iso=""
  age_iso=$(grep -E '^[[:space:]]*#[[:space:]]*appended_at[[:space:]]*:' "$bundle" | head -n1 | sed -E 's/^[[:space:]]*#[[:space:]]*appended_at[[:space:]]*:[[:space:]]*//; s/[[:space:]]*$//')
  if [[ -z "$age_iso" ]]; then
    age_iso=$(grep -v '^[[:space:]]*#' "$bundle" | grep -E '^[[:space:]]*generated_at[[:space:]]*:' | head -n1 | sed -E 's/^[[:space:]]*generated_at[[:space:]]*:[[:space:]]*"?([^"#]+)"?.*/\1/; s/[[:space:]]*$//')
  fi
  if [[ -z "$age_iso" ]]; then
    echo "qa-sdk gate.check: STALE — bundle has no parseable freshness marker (# appended_at / generated_at); cannot prove evidence is within ${fresh_hours}h" >&2
    exit 2
  fi
  local age_check
  age_check=$(node -e "
    const iso=process.argv[1];
    const hours=parseInt(process.argv[2],10);
    const t=Date.parse(iso);
    if (Number.isNaN(t)) { process.stdout.write('UNPARSEABLE'); process.exit(0); }
    const ageH=(Date.now()-t)/3600000;
    process.stdout.write(ageH > hours ? ('STALE '+ageH.toFixed(1)) : 'FRESH');
  " "$age_iso" "$fresh_hours" 2>/dev/null)
  case "$age_check" in
    FRESH) : ;;
    UNPARSEABLE)
      echo "qa-sdk gate.check: STALE — freshness marker '$age_iso' is not a parseable timestamp; cannot prove evidence is within ${fresh_hours}h" >&2
      exit 2
      ;;
    STALE\ *)
      echo "qa-sdk gate.check: STALE — evidence aged ${age_check#STALE } h exceeds evidence_freshness_hours=${fresh_hours} (marker: $age_iso); rerun QA + regenerate bundle" >&2
      exit 2
      ;;
    *)
      echo "qa-sdk gate.check: STALE — freshness self-check returned no result for marker '$age_iso' (fail-closed)" >&2
      exit 2
      ;;
  esac

  local failures="$PROJECT_ROOT/.qa/evidence/$tag/dispatch-failures.log"
  if [[ -s "$failures" ]]; then
    echo "qa-sdk gate.check: BLOCKED — dispatch-failures.log non-empty" >&2
    exit 2
  fi

  case "$decision" in
    PASS)
      echo "qa-sdk gate.check: PASS"
      exit 0
      ;;
    STRATEGY_READY)
      # H-05 fix: STRATEGY_READY is releasable ONLY when --mode design-only
      if [[ "$mode" == "design-only" ]]; then
        echo "qa-sdk gate.check: PASS (STRATEGY_READY in design-only mode)"
        exit 0
      fi
      echo "qa-sdk gate.check: BLOCKED — STRATEGY_READY is not releasable in $mode mode" >&2
      exit 2
      ;;
    CONDITIONAL_PASS)
      if [[ ! -f "$PROJECT_ROOT/.qa/risk-acceptance.yaml" ]]; then
        echo "qa-sdk gate.check: BLOCKED — CONDITIONAL_PASS requires .qa/risk-acceptance.yaml" >&2
        exit 2
      fi
      # Minimal schema check: must have release_tag matching, accepted_decision, approver, expires_at, reason
      local ra="$PROJECT_ROOT/.qa/risk-acceptance.yaml"
      local missing=()
      for k in approver approved_at expires_at release_tag accepted_decision reason; do
        if ! grep -E "^[[:space:]]{0,4}${k}[[:space:]]*:" "$ra" >/dev/null 2>&1; then
          missing+=("$k")
        fi
      done
      if (( ${#missing[@]} > 0 )); then
        echo "qa-sdk gate.check: BLOCKED — risk-acceptance.yaml missing fields: ${missing[*]}" >&2
        exit 2
      fi
      local ra_tag
      ra_tag=$(grep -E '^[[:space:]]{0,4}release_tag[[:space:]]*:' "$ra" | head -n1 | sed -E 's/^[[:space:]]*release_tag[[:space:]]*:[[:space:]]*"?([^"]+)"?[[:space:]]*$/\1/')
      if [[ "$ra_tag" != "$tag" ]]; then
        echo "qa-sdk gate.check: BLOCKED — risk-acceptance.release_tag='$ra_tag' != '$tag'" >&2
        exit 2
      fi
      local ra_decision
      ra_decision=$(grep -E '^[[:space:]]{0,4}accepted_decision[[:space:]]*:' "$ra" | head -n1 | sed -E 's/^[[:space:]]*accepted_decision[[:space:]]*:[[:space:]]*"?([A-Z_]+)"?[[:space:]]*$/\1/')
      if [[ "$ra_decision" != "CONDITIONAL_PASS" ]]; then
        echo "qa-sdk gate.check: BLOCKED — risk-acceptance.accepted_decision='$ra_decision' does not authorize CONDITIONAL_PASS" >&2
        exit 2
      fi
      # ── (qa-xref#1 / contracts-qa#1) expires_at + approved_at validation ──
      # Contract (SKILL §17.4 / enforcement-registration.md:111) promises CONDITIONAL_PASS
      # requires risk-acceptance "完整且未过期". The field-presence loop above only proves
      # expires_at exists — it never compared the date. Fail-closed (same as D2 freshness):
      # unparseable expires_at → BLOCK; past expires_at → BLOCK; approved_at in the future
      # (beyond a 5min clock-skew tolerance) → BLOCK.
      local ra_expires ra_approved
      ra_expires=$(grep -E '^[[:space:]]{0,4}expires_at[[:space:]]*:' "$ra" | head -n1 | sed -E 's/^[[:space:]]*expires_at[[:space:]]*:[[:space:]]*"?([^"#]+)"?.*/\1/; s/[[:space:]]*$//')
      ra_approved=$(grep -E '^[[:space:]]{0,4}approved_at[[:space:]]*:' "$ra" | head -n1 | sed -E 's/^[[:space:]]*approved_at[[:space:]]*:[[:space:]]*"?([^"#]+)"?.*/\1/; s/[[:space:]]*$//')
      local ra_time_check
      ra_time_check=$(node -e "
        const exp=process.argv[1];
        const app=process.argv[2];
        const skewMs=300000; // 5min clock-skew tolerance for approved_at in the future
        const te=Date.parse(exp);
        if (Number.isNaN(te)) { process.stdout.write('EXP_UNPARSEABLE'); process.exit(0); }
        const now=Date.now();
        if (te < now) { process.stdout.write('EXPIRED'); process.exit(0); }
        if (app) {
          const ta=Date.parse(app);
          if (!Number.isNaN(ta) && ta - now > skewMs) { process.stdout.write('APPROVED_FUTURE'); process.exit(0); }
        }
        process.stdout.write('OK');
      " "$ra_expires" "$ra_approved" 2>/dev/null)
      case "$ra_time_check" in
        OK) : ;;
        EXP_UNPARSEABLE)
          echo "qa-sdk gate.check: BLOCKED — risk-acceptance.expires_at='$ra_expires' is not a parseable timestamp (fail-closed)" >&2
          exit 2
          ;;
        EXPIRED)
          echo "qa-sdk gate.check: BLOCKED — risk-acceptance expired (expires_at='$ra_expires' is in the past); re-issue acceptance" >&2
          exit 2
          ;;
        APPROVED_FUTURE)
          echo "qa-sdk gate.check: BLOCKED — risk-acceptance.approved_at='$ra_approved' is in the future beyond clock-skew tolerance (clock skew or forged timestamp)" >&2
          exit 2
          ;;
        *)
          echo "qa-sdk gate.check: BLOCKED — risk-acceptance time self-check returned no result (fail-closed)" >&2
          exit 2
          ;;
      esac
      echo "qa-sdk gate.check: CONDITIONAL_PASS (risk-acceptance validated)"
      exit 0
      ;;
    FAIL)
      echo "qa-sdk gate.check: FAIL" >&2
      exit 1
      ;;
    BLOCKED)
      echo "qa-sdk gate.check: BLOCKED" >&2
      exit 2
      ;;
    *)
      echo "qa-sdk gate.check: BLOCKED — unknown release_decision=$decision" >&2
      exit 2
      ;;
  esac
}

cmd_finding_add() {
  ensure_project_root
  local file="${1:-}"
  mkdir -p "$PROJECT_ROOT/.qa/findings"
  local stamp; stamp=$(date -u +"%Y%m%d-%H%M%S")
  local rand; rand=$(printf "%04x" $((RANDOM % 65536)))
  local out="$PROJECT_ROOT/.qa/findings/manual-${stamp}-${rand}.yaml"
  if [[ -n "$file" ]]; then
    if [[ ! -f "$file" ]]; then echo "qa-sdk: file not found: $file" >&2; exit 1; fi
    cat "$file" > "$out"
  else
    cat > "$out"
  fi
  echo "$out"
}

cmd_quarantine_add() {
  ensure_project_root
  local test_name="" owner="" issue="" expiry="" repro="" unblock="" failure_class="unspecified"
  while (( "$#" )); do
    case "$1" in
      --test)    test_name="${2:-}"; shift 2;;
      --owner)   owner="${2:-}"; shift 2;;
      --issue)   issue="${2:-}"; shift 2;;
      --expiry)  expiry="${2:-}"; shift 2;;
      --repro)   repro="${2:-}"; shift 2;;
      --unblock) unblock="${2:-}"; shift 2;;
      --class)   failure_class="${2:-}"; shift 2;;
      *) echo "qa-sdk quarantine.add: unknown arg $1" >&2; exit 2;;
    esac
  done

  local missing=()
  [[ -z "$test_name" ]] && missing+=("--test")
  [[ -z "$owner"     ]] && missing+=("--owner")
  [[ -z "$issue"     ]] && missing+=("--issue")
  [[ -z "$expiry"    ]] && missing+=("--expiry")
  [[ -z "$repro"     ]] && missing+=("--repro")
  [[ -z "$unblock"   ]] && missing+=("--unblock")
  if (( ${#missing[@]} > 0 )); then
    echo "qa-sdk quarantine.add: missing required fields: ${missing[*]}" >&2
    exit 2
  fi

  local file="$PROJECT_ROOT/.qa/quarantine.yaml"
  if [[ ! -f "$file" ]] || ! grep -q '^quarantine:' "$file"; then
    printf "quarantine:\n" > "$file"
  fi
  # If the file contains "quarantine: []", replace with header
  if grep -q '^quarantine:[[:space:]]*\[\][[:space:]]*$' "$file"; then
    sed -i 's/^quarantine:[[:space:]]*\[\][[:space:]]*$/quarantine:/' "$file"
  fi

  local today; today=$(date -u +"%Y-%m-%d")
  cat >> "$file" <<EOF
  - test_name: "$test_name"
    failure_class: $failure_class
    owner: "$owner"
    issue_id: "$issue"
    expiry_date: $expiry
    reproduction_command: "$repro"
    last_seen: $today
    unblock_condition: "$unblock"
EOF
  echo "$file"
}

cmd_approve_snapshot() {
  ensure_project_root
  local scope="" reason="" hours="" pattern="" human_attested="false"
  while (( "$#" )); do
    case "$1" in
      --scope)   scope="${2:-}";  shift 2;;
      --reason)  reason="${2:-}"; shift 2;;
      --hours)   hours="${2:-}";  shift 2;;
      --pattern) pattern="${2:-}"; shift 2;;
      --human-attested) human_attested="true"; shift 1;;
      *) echo "qa-sdk approve.snapshot: unknown arg $1" >&2; exit 2;;
    esac
  done
  local missing=()
  [[ -z "$scope"   ]] && missing+=("--scope")
  [[ -z "$reason"  ]] && missing+=("--reason")
  [[ -z "$hours"   ]] && missing+=("--hours")
  [[ -z "$pattern" ]] && missing+=("--pattern")
  if (( ${#missing[@]} > 0 )); then
    echo "qa-sdk approve.snapshot: missing: ${missing[*]}" >&2
    exit 2
  fi
  if ! [[ "$hours" =~ ^[0-9]+$ ]] || (( hours < 1 || hours > 24 )); then
    echo "qa-sdk approve.snapshot: --hours must be 1..24 (got $hours)" >&2
    exit 2
  fi
  if (( ${#reason} < 8 )); then
    echo "qa-sdk approve.snapshot: --reason too short (min 8 chars)" >&2
    exit 2
  fi
  if [[ "$human_attested" != "true" ]]; then
    echo "qa-sdk approve.snapshot: --human-attested is required (Claude cannot self-mint approvals)" >&2
    exit 2
  fi
  local now expires approver
  now=$(iso_now)
  if expires=$(date -u -d "+$hours hours" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null); then
    :
  else
    expires=$(python -c "import datetime; print((datetime.datetime.utcnow()+datetime.timedelta(hours=$hours)).strftime('%Y-%m-%dT%H:%M:%SZ'))" 2>/dev/null) || {
      echo "qa-sdk approve.snapshot: cannot compute expires_at (date -d failed and python not available)" >&2; exit 1;
    }
  fi
  approver="${USER:-${USERNAME:-unknown}}"
  local scope_json
  scope_json=$(printf '%s' "$scope" | awk -F, '{
    out="[";
    for (i=1; i<=NF; i++) {
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", $i);
      gsub(/"/, "\\\"", $i);
      out = out (i>1 ? "," : "") "\"" $i "\"";
    }
    print out "]";
  }')
  # Escape JSON string fields
  local reason_json pattern_json
  reason_json=$(printf '%s' "$reason" | python -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null || printf '"%s"' "${reason//\"/\\\"}")
  pattern_json=$(printf '%s' "$pattern" | python -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null || printf '"%s"' "${pattern//\"/\\\"}")
  cat > "$PROJECT_ROOT/.qa/snapshot-update-approval.json" <<EOF
{
  "approver": "$approver",
  "approved_at": "$now",
  "expires_at": "$expires",
  "scope": $scope_json,
  "reason": $reason_json,
  "command_pattern": $pattern_json,
  "human_attested": true
}
EOF
  echo "$PROJECT_ROOT/.qa/snapshot-update-approval.json"
}

# ───── Workflow-Spec Launch helpers (SKILL §18.5, B.1.g 2026-05-29) ─────
#
# These commands let the Skill main thread perform the canonical workflow-spec
# launch handshake (compute spec_hash, write preview-approved sentinel) without
# re-implementing the algorithm inline. The hook (qa-preview-gate.js) reads the
# same sentinel and recomputes spec_hash via byte-identical algorithm shared
# via ~/.claude/orchestrator-runtime/shared/spec-hash.js.

cmd_spec_hash() {
  local src="${1:-}"
  local helper="$HOME/.claude/orchestrator-runtime/shared/spec-hash.js"
  if [[ ! -f "$helper" ]]; then
    echo "qa-sdk spec.hash: missing canonical helper at $helper" >&2; exit 1
  fi
  if [[ -z "$src" || "$src" == "-" ]]; then
    node "$helper" -
  else
    if [[ ! -f "$src" ]]; then echo "qa-sdk spec.hash: file not found: $src" >&2; exit 1; fi
    node "$helper" "$src"
  fi
}

cmd_sentinel_write() {
  ensure_project_root
  local run_id="" mode="" approval_text="" ttl=300 approved_estimate_high="" preview_hash="" spec_file=""
  while (( "$#" )); do
    case "$1" in
      --run-id)                 run_id="${2:-}"; shift 2;;
      --mode)                   mode="${2:-}"; shift 2;;
      --approval-text)          approval_text="${2:-}"; shift 2;;
      --ttl-seconds)            ttl="${2:-300}"; shift 2;;
      --approved-estimate-high) approved_estimate_high="${2:-}"; shift 2;;
      --preview-hash)           preview_hash="${2:-}"; shift 2;;
      --spec-file)              spec_file="${2:-}"; shift 2;;
      *) echo "qa-sdk sentinel.write: unknown arg $1" >&2; exit 2;;
    esac
  done
  local missing=()
  [[ -z "$run_id"        ]] && missing+=("--run-id")
  [[ -z "$mode"          ]] && missing+=("--mode")
  [[ -z "$approval_text" ]] && missing+=("--approval-text")
  [[ -z "$spec_file"     ]] && missing+=("--spec-file")
  if (( ${#missing[@]} > 0 )); then
    echo "qa-sdk sentinel.write: missing required: ${missing[*]}" >&2; exit 2
  fi
  validate_safe_name "run-id" "$run_id"
  case "$mode" in
    quick-check|focused-qa-gate|release-readiness|commercial-cert|smoke|graph-smoke) :;;
    *) echo "qa-sdk sentinel.write: invalid mode '$mode' (allowed: quick-check|focused-qa-gate|release-readiness|commercial-cert|smoke|graph-smoke)" >&2; exit 2;;
  esac
  if [[ "$mode" == "commercial-cert" && -z "$approved_estimate_high" ]]; then
    echo "qa-sdk sentinel.write: --approved-estimate-high (tokens) required for commercial-cert mode" >&2; exit 2
  fi
  if [[ -n "$approved_estimate_high" ]] && ! [[ "$approved_estimate_high" =~ ^[1-9][0-9]*$ ]]; then
    echo "qa-sdk sentinel.write: --approved-estimate-high must be positive integer (got '$approved_estimate_high')" >&2; exit 2
  fi
  if ! [[ "$ttl" =~ ^[0-9]+$ ]] || (( ttl < 30 || ttl > 3600 )); then
    echo "qa-sdk sentinel.write: --ttl-seconds must be 30..3600 (got $ttl)" >&2; exit 2
  fi
  # commercial-cert: validate approval_text matches approval pattern (defense in depth — hook also checks)
  if [[ "$mode" == "commercial-cert" ]]; then
    if ! echo "$approval_text" | grep -qiE '\b(approved|approve)\b|批准|确认|同意|=== REQUIRES EXPLICIT BUDGET APPROVAL ==='; then
      echo "qa-sdk sentinel.write: commercial-cert --approval-text must contain explicit approval (approved/approve/批准/确认/同意/budget-banner)" >&2; exit 2
    fi
  fi
  if [[ ! -f "$spec_file" ]]; then
    echo "qa-sdk sentinel.write: spec file not found: $spec_file" >&2; exit 1
  fi
  local helper="$HOME/.claude/orchestrator-runtime/shared/spec-hash.js"
  local spec_hash
  spec_hash=$(node "$helper" "$spec_file" 2>/dev/null) || {
    echo "qa-sdk sentinel.write: spec_hash computation failed (invalid JSON?)" >&2; exit 1
  }
  spec_hash="${spec_hash%$'\n'}"  # trim
  local dir="$PROJECT_ROOT/.qa/state/preview"
  mkdir -p "$dir"
  local safe_id; safe_id=$(printf '%s' "$run_id" | tr -c 'A-Za-z0-9._-' '_')
  local out="$dir/${safe_id}.json"
  local tmp; tmp=$(mktemp)
  local approved_at; approved_at=$(iso_now)
  # Build sentinel JSON via node for safe escaping
  if ! node -e "
    const fs=require('fs');
    const d={
      run_id: process.argv[1],
      spec_hash: process.argv[2],
      mode: process.argv[3],
      approval_text: process.argv[4],
      approved_at: process.argv[5],
      ttl_seconds: parseInt(process.argv[6],10),
    };
    if (process.argv[7]) d.preview_hash = process.argv[7];
    if (process.argv[8]) d.approved_estimate_high = parseInt(process.argv[8],10);
    fs.writeFileSync(process.argv[9], JSON.stringify(d, null, 2)+'\n');
  " "$run_id" "$spec_hash" "$mode" "$approval_text" "$approved_at" "$ttl" "$preview_hash" "$approved_estimate_high" "$tmp" 2>/dev/null; then
    rm -f "$tmp"
    echo "qa-sdk sentinel.write: failed to serialize sentinel JSON" >&2; exit 1
  fi
  mv "$tmp" "$out"
  echo "$out"
}

cmd_sentinel_show() {
  ensure_project_root
  need_arg "run-id" "${1:-}"
  validate_safe_name "run-id" "$1"
  local safe_id; safe_id=$(printf '%s' "$1" | tr -c 'A-Za-z0-9._-' '_')
  local sentinel="$PROJECT_ROOT/.qa/state/preview/${safe_id}.json"
  if [[ ! -f "$sentinel" ]]; then
    echo "qa-sdk sentinel.show: not found at $sentinel" >&2; exit 1
  fi
  cat "$sentinel"
  # Structural validity report on stderr
  node -e "
    const fs=require('fs');
    const s=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
    const req=['run_id','spec_hash','mode','approval_text','approved_at','ttl_seconds'];
    const missing=req.filter(k => !(k in s));
    if (missing.length) {
      process.stderr.write('sentinel.show: STRUCTURAL FAIL — missing: '+missing.join(',')+'\n');
      process.exit(2);
    }
    const age = (Date.now() - Date.parse(s.approved_at))/1000;
    const ttl = Math.max(30, Math.min(3600, s.ttl_seconds));
    if (age > ttl) {
      process.stderr.write('sentinel.show: EXPIRED — age='+Math.round(age)+'s ttl='+ttl+'s\n');
      process.exit(3);
    }
    if (s.mode === 'commercial-cert' && (typeof s.approved_estimate_high !== 'number' || s.approved_estimate_high <= 0)) {
      process.stderr.write('sentinel.show: STRUCTURAL FAIL — commercial-cert requires approved_estimate_high\n');
      process.exit(2);
    }
    process.stderr.write('sentinel.show: OK — age='+Math.round(age)+'s/'+ttl+'s remaining='+(ttl-Math.round(age))+'s\n');
  " "$sentinel"
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
    gate.check)                   cmd_gate_check "$@";;
    finding.add)                  cmd_finding_add "$@";;
    quarantine.add)               cmd_quarantine_add "$@";;
    approve.snapshot)             cmd_approve_snapshot "$@";;
    spec.hash)                    cmd_spec_hash "$@";;
    sentinel.write)               cmd_sentinel_write "$@";;
    sentinel.show)                cmd_sentinel_show "$@";;
    -h|--help|help)               usage; exit 0;;
    *) echo "qa-sdk: unknown command $cmd" >&2; usage; exit 2;;
  esac
}

main "$@"
