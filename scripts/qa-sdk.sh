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
  fallback.approve --scope <csv> --reason <text> --hours <n> --human-attested   # human-attest a degraded QA path (qa-no-silent-fallback)
  level.select <L1|L2|L3|L4> [--run-id <tag>]   # write .qa/state/level-selected.json (SKILL §6 Step 0)
  tasklist.write [<file>]                        # write .qa/state/tasklist.json from file/stdin (SKILL §6 Step 0.5)
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
  # JSON evidence (Architecture-Intake 00-runtime.json / path-graph.json /
  # 00-test-plan.json + recompute-context.json) is written verbatim with a .json
  # suffix so hooks + qa-recompute-gate.js can JSON.parse it. All other layers get
  # the canonical .yaml provenance treatment. A layer arg already ending in .json
  # selects JSON mode; legacy callers (no .json) are unchanged.
  local out is_json=0
  case "$layer" in
    *.json) out="$dir/${layer}"; is_json=1;;
    *)      out="$dir/${layer}.yaml";;
  esac

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

  # JSON-evidence path: validate it parses (fail-closed — a gate must not consume
  # malformed intake/context), then return WITHOUT the YAML provenance header
  # (JSON has no '#' comments) and WITHOUT canon-bundle.
  if [[ "$is_json" == "1" ]]; then
    if ! node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$out" 2>/dev/null; then
      echo "qa-sdk evidence.append: BLOCKED — $out is not valid JSON" >&2
      exit 2
    fi
    echo "$out"
    return 0
  fi

  # Canonicalize the release bundle: EvidenceBundle agents emit StructuredOutput JSON, but
  # gate.check / qa-evidence-required require a col-0, unquoted, single `release_decision:` scalar.
  # canon-bundle.js converts JSON bundles to canonical YAML (col-0 scalars + flow-style nested);
  # idempotent + passthrough for non-JSON content, so it can never drop/corrupt a bundle. qa-sdk
  # writes via Bash, so qa-bundle-write-guard's provenance allow-path is unaffected.
  if [[ "$layer" == "qa_evidence_bundle" ]]; then
    local _canon; _canon=$(mktemp)
    if node "$HOME/.claude/scripts/canon-bundle.js" < "$out" > "$_canon" 2>/dev/null && [[ -s "$_canon" ]]; then
      mv "$_canon" "$out"
    else
      rm -f "$_canon"
    fi
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

# ───── evidence.run — tamper-evident capture wrapper (P0-3, 2026-06-16) ─────
# Runs a command, captures raw stdout/stderr to .qa/runs/<tag>/raw/, hashes the
# BYTES via node crypto (byte-identical to qa-recompute-gate.js), runs a named
# deterministic parser → parsed_metrics, binds git HEAD + dirty-tree hash (G2),
# and is the SOLE writer of the machine-facing per-layer JSON
# (.qa/evidence/<tag>/<layer>.json). The model never types a metric — the SDK
# derives it. Consumed by qa-recompute-gate.js (re-hash + re-parse + re-derive).
#   qa-sdk evidence.run <tag> <layer> --command-id <id> [--parser <name@v>]
#       [--parser-input stdout|artifact] [--artifact <path>] [--state-node <node>] -- <cmd...>
_qa_sha256_file() {  # hash file BYTES via node (no sha256sum dependency; parity with recompute)
  node -e "const c=require('crypto'),f=require('fs');process.stdout.write(c.createHash('sha256').update(f.readFileSync(process.argv[1])).digest('hex'))" "$1" 2>/dev/null
}
cmd_evidence_run() {
  need_arg "release-tag" "${1:-}"
  need_arg "layer" "${2:-}"
  validate_safe_name "release-tag" "$1"
  validate_safe_name "layer" "$2"
  local tag="$1" layer="$2"; shift 2
  local command_id="" parser="" parser_input="stdout" artifact="" state_node="$layer"
  local -a cmd=()
  while (( "$#" )); do
    case "$1" in
      --command-id)   command_id="${2:-}"; shift 2;;
      --parser)       parser="${2:-}"; shift 2;;
      --parser-input) parser_input="${2:-}"; shift 2;;
      --artifact)     artifact="${2:-}"; shift 2;;
      --state-node)   state_node="${2:-}"; shift 2;;
      --) shift; cmd=( "$@" ); break;;
      *) echo "qa-sdk evidence.run: unknown arg $1" >&2; exit 2;;
    esac
  done
  [[ -z "$command_id" ]] && { echo "qa-sdk evidence.run: --command-id required" >&2; exit 2; }
  validate_safe_name "command-id" "$command_id"
  (( ${#cmd[@]} == 0 )) && { echo "qa-sdk evidence.run: missing command after --" >&2; exit 2; }
  case "$parser_input" in stdout|artifact) :;; *) echo "qa-sdk evidence.run: --parser-input must be stdout|artifact" >&2; exit 2;; esac
  ensure_project_root
  local raw_dir="$PROJECT_ROOT/.qa/runs/$tag/raw"
  mkdir -p "$raw_dir"
  local ev_dir="$PROJECT_ROOT/.qa/evidence/$tag"; mkdir -p "$ev_dir"
  local stdout_f="$raw_dir/${command_id}.stdout"
  local stderr_f="$raw_dir/${command_id}.stderr"
  local rel_stdout=".qa/runs/$tag/raw/${command_id}.stdout"
  local rel_stderr=".qa/runs/$tag/raw/${command_id}.stderr"

  local started_at; started_at=$(iso_now)
  local start_ns; start_ns=$(date +%s%N 2>/dev/null || echo 0)
  "${cmd[@]}" >"$stdout_f" 2>"$stderr_f"
  local ec=$?
  local end_ns; end_ns=$(date +%s%N 2>/dev/null || echo 0)
  local duration_ms=0
  if [[ "$start_ns" != "0" && "$end_ns" != "0" ]]; then duration_ms=$(( (end_ns - start_ns) / 1000000 )); fi

  local stdout_sha; stdout_sha=$(_qa_sha256_file "$stdout_f")
  local stderr_sha; stderr_sha=$(_qa_sha256_file "$stderr_f")

  # artifact (optional structured parser input)
  local rel_artifact="" artifact_sha=""
  if [[ -n "$artifact" ]]; then
    if [[ ! -f "$artifact" ]]; then echo "qa-sdk evidence.run: --artifact not found: $artifact" >&2; exit 1; fi
    local art_dest="$raw_dir/${command_id}$(basename "$artifact" | sed 's/^[^.]*//')"
    cp "$artifact" "$art_dest"
    rel_artifact=".qa/runs/$tag/raw/$(basename "$art_dest")"
    artifact_sha=$(_qa_sha256_file "$art_dest")
  fi

  # parser → parsed_metrics
  local parse_status="OK" parser_input_sha="$stdout_sha" pm_file=""
  local input_for_parser="$stdout_f"
  if [[ "$parser_input" == "artifact" ]]; then
    if [[ -z "$rel_artifact" ]]; then echo "qa-sdk evidence.run: --parser-input artifact requires --artifact" >&2; exit 2; fi
    input_for_parser="$PROJECT_ROOT/$rel_artifact"; parser_input_sha="$artifact_sha"
  elif [[ "$parser_input" == "stderr" ]]; then
    input_for_parser="$stderr_f"; parser_input_sha="$stderr_sha"
  fi
  if [[ -n "$parser" ]]; then
    local base="${parser%@*}"
    local parser_path="$HOME/.claude/scripts/qa-parsers/${base}.js"
    pm_file=$(mktemp)
    if [[ -f "$parser_path" ]] && node "$parser_path" "$input_for_parser" > "$pm_file" 2>/dev/null && [[ -s "$pm_file" ]]; then
      if ! node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$pm_file" 2>/dev/null; then
        parse_status="PARSER_FAILED"; printf 'null' > "$pm_file"
      fi
    else
      parse_status="PARSER_FAILED"; printf 'null' > "$pm_file"
    fi
  else
    pm_file=$(mktemp); printf 'null' > "$pm_file"; parse_status="SKIPPED"
  fi

  # G2 git binding
  local git_head="" git_dirty_sha=""
  if git_head=$(git -C "$PROJECT_ROOT" rev-parse HEAD 2>/dev/null); then
    local porcelain; porcelain=$(git -C "$PROJECT_ROOT" status --porcelain 2>/dev/null)
    git_dirty_sha=$(printf '%s' "$porcelain" | node -e "const c=require('crypto');let d='';process.stdin.on('data',x=>d+=x).on('end',()=>process.stdout.write(c.createHash('sha256').update(d).digest('hex')))" 2>/dev/null)
  else
    git_head=""
  fi

  # build command_evidence record + merge into layer file (SDK = sole writer)
  local layer_file="$ev_dir/${layer}.json"
  node "$HOME/.claude/scripts/qa-evidence-merge.js" \
    --layer-file "$layer_file" --layer "$layer" --state-node "$state_node" \
    --command-id "$command_id" --command "$(printf '%s ' "${cmd[@]}")" --exit-code "$ec" \
    --started-at "$started_at" --duration-ms "$duration_ms" \
    --stdout-path "$rel_stdout" --stdout-sha256 "$stdout_sha" \
    --stderr-path "$rel_stderr" --stderr-sha256 "$stderr_sha" \
    --artifact-path "$rel_artifact" --artifact-sha256 "$artifact_sha" \
    --parser "$parser" --parser-input "$parser_input" --parser-input-sha256 "$parser_input_sha" \
    --parse-status "$parse_status" --parsed-metrics-file "$pm_file" \
    --git-head "$git_head" --git-dirty-sha256 "$git_dirty_sha" \
    --captured-by "qa-sdk@3.2.0 evidence.run" || { rm -f "$pm_file"; echo "qa-sdk evidence.run: merge failed" >&2; exit 1; }
  rm -f "$pm_file"
  echo "$layer_file"
  return 0
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

# ───────────────────────────────────────────────────────────────────────────────
# ★ R3 adversarial-sweep hardening (2026-06-14; Codex + main-agent cross-review).
# qa-sdk read gate fields with `grep '^[[:space:]]{0,4}KEY:' | head -n1`, which has
# NO YAML structural awareness — a decoy value placed first (nested 2-4 spaces, TAB,
# duplicated, block-scalar/tag/anchor, multi-doc, BOM-hidden, trailing-junk) beat the
# real later value → fail-open. These helpers enforce a strict canonical subset
# (fail-closed) + col-0 + full-scalar + dup-key. Keep in lock-step with the identical
# guards in appsec-sdk.sh / uiux-sdk.sh. NOTE: the guard is intentionally per-critical-
# key (not whole-file-flat) so the rich, legitimately-nested qa_evidence_bundle still
# passes — col-0 extraction + dup-key fail-close nested/flow/explicit-key smuggling.
_qa_assert_canonical_gate_yaml() {
  local content; content=$(printf '%s' "$1" | tr -d '\r'); local crit="$2"; local tab; tab=$(printf '\t')
  if printf '%s' "$content" | grep -q "$(printf '\xef\xbb\xbf')"; then
    echo "noncanonical: UTF-8 BOM / U+FEFF (a zero-width prefix anywhere can hide a top-level key)"; return 2; fi
  if printf '%s' "$content" | grep -q "$tab"; then
    echo "noncanonical: TAB character (invalid YAML whitespace; defeats space parsing)"; return 2; fi
  if printf '%s\n' "$content" | grep -qE '^[[:space:]]*(---|\.\.\.)([[:space:]].*)?$'; then
    echo "noncanonical: document marker (--- / ...) — single canonical document required"; return 2; fi
  if printf '%s\n' "$content" | grep -qE '^%'; then
    echo "noncanonical: YAML directive (%)"; return 2; fi
  if printf '%s\n' "$content" | grep -qE "^[[:space:]]*[\"'](${crit})[\"'][[:space:]]*:"; then
    echo "noncanonical: quoted critical key (use the unquoted canonical key)"; return 2; fi
  if printf '%s\n' "$content" | grep -qE "^(${crit})[[:space:]]*:[[:space:]]*[|>]"; then
    echo "noncanonical: block scalar (| or >) on a critical key"; return 2; fi
  if printf '%s\n' "$content" | grep -qE "^(${crit})[[:space:]]*:[[:space:]]*[!&*]"; then
    echo "noncanonical: YAML tag/anchor/alias on a critical key"; return 2; fi
  return 0
}
# Count col-0 (top-level) occurrences of a key. >1 = ambiguous duplicate → caller BLOCKs.
_qa_count_key() { printf '%s' "$1" | tr -d '\r' | grep -v '^[[:space:]]*#' | grep -cE "^$2[[:space:]]*:" || true; }
# Extract a col-0 key's COMPLETE scalar (no nested keys; trailing junk is kept so the
# downstream enum/format check rejects it rather than a greedy prefix capture accepting it).
_qa_extract_scalar() {
  printf '%s' "$1" | tr -d '\r' | grep -v '^[[:space:]]*#' | grep -E "^$2[[:space:]]*:" | head -n1 \
    | sed -E "s/^$2[[:space:]]*:[[:space:]]*//" | sed -E 's/[[:space:]]+#.*$//' \
    | sed -E 's/^"([^"]*)"$/\1/' | sed -E "s/^'([^']*)'\$/\1/" | sed -E 's/[[:space:]]+$//'
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
  _LEDGER_TAG="$tag"; _LEDGER_STAGE="gate.check"; trap _qa_ledger_on_exit EXIT
  local bundle="$PROJECT_ROOT/.qa/evidence/$tag/qa_evidence_bundle.yaml"
  if [[ ! -f "$bundle" ]]; then
    echo "qa-sdk gate.check: BLOCKED — $bundle missing" >&2
    exit 2
  fi

  # ★ R3 hardening — reject non-canonical bundle (BOM/TAB/multi-doc/block-scalar/tag/anchor
  # on release_decision) + dup-key guard, BEFORE col-0 full-scalar extraction. The bundle is
  # legitimately nested, so we only assert per-critical-key canonicity (not whole-file flatness).
  local _bundle_content _ncg
  _bundle_content=$(cat "$bundle")
  if ! _ncg=$(_qa_assert_canonical_gate_yaml "$_bundle_content" 'release_decision|generated_at'); then
    echo "qa-sdk gate.check: BLOCKED — $_ncg in $bundle (refusing ambiguous artifact)" >&2
    exit 2
  fi
  local _drc; _drc=$(_qa_count_key "$_bundle_content" 'release_decision')
  if (( _drc > 1 )); then
    echo "qa-sdk gate.check: BLOCKED — $_drc conflicting 'release_decision:' keys in $bundle (ambiguous/duplicate — refusing to guess; possible smuggling)" >&2
    exit 2
  fi
  # col-0 ONLY + complete scalar: a nested (audit.release_decision) or trailing-junk value is not the verdict
  local decision
  decision=$(_qa_extract_scalar "$_bundle_content" 'release_decision')

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

  # ───── (R-recompute) DEFAULT-mode deterministic verdict recompute (P0-4, 2026-06-16) ─────
  # Re-derive the verdict from MACHINE evidence (.qa/evidence/<tag>/<layer>.json written by
  # evidence.run) via the canonical shared module, and BLOCK if the declared release_decision is
  # MORE LENIENT than computed, or if any command_evidence hash/parse integrity check fails. This
  # closes the audit's "default mode never recomputes" hole. Additive: the engine NO-OPs when a run
  # produced no machine evidence (legacy back-compat). Engine present + errors → BLOCK (fail-closed);
  # engine file MISSING → WARN-continue (additive rollout; tighten to fail-closed once deployed).
  local recompute_engine="$HOME/.claude/orchestrator-runtime/shared/qa-recompute-gate.js"
  if [[ -f "$recompute_engine" ]]; then
    if ! node "$recompute_engine" --tag "$tag" --project-root "$PROJECT_ROOT" --declared "$decision" >&2; then
      echo "qa-sdk gate.check: BLOCKED — deterministic recompute rejected declared release_decision='$decision' (see .qa/evidence/$tag/recompute-verdict.json)" >&2
      exit 2
    fi
  else
    echo "qa-sdk gate.check: WARN — qa-recompute-gate.js not found; default-mode recompute skipped (additive rollout)" >&2
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
      # ★ R3 hardening — risk-acceptance.yaml is a flat canonical doc; reject non-canonical
      # forms + require col-0 keys + dup-key guard so nested/TAB/block-scalar/duplicate decoys
      # cannot satisfy presence or smuggle field values past the validity checks below.
      local _ra_content; _ra_content=$(cat "$ra")
      local _ra_nc
      if ! _ra_nc=$(_qa_assert_canonical_gate_yaml "$_ra_content" 'approver|approved_at|expires_at|release_tag|accepted_decision|reason'); then
        echo "qa-sdk gate.check: BLOCKED — risk-acceptance.yaml $_ra_nc" >&2
        exit 2
      fi
      local missing=()
      for k in approver approved_at expires_at release_tag accepted_decision reason; do
        local _kc; _kc=$(_qa_count_key "$_ra_content" "$k")
        if [[ "$_kc" == "0" ]]; then
          missing+=("$k")
        elif (( _kc > 1 )); then
          echo "qa-sdk gate.check: BLOCKED — risk-acceptance.yaml has $_kc duplicate '$k:' keys (ambiguous — refusing to guess)" >&2
          exit 2
        fi
      done
      if (( ${#missing[@]} > 0 )); then
        echo "qa-sdk gate.check: BLOCKED — risk-acceptance.yaml missing fields: ${missing[*]}" >&2
        exit 2
      fi
      local ra_tag
      ra_tag=$(_qa_extract_scalar "$_ra_content" 'release_tag')
      if [[ "$ra_tag" != "$tag" ]]; then
        echo "qa-sdk gate.check: BLOCKED — risk-acceptance.release_tag='$ra_tag' != '$tag'" >&2
        exit 2
      fi
      local ra_decision
      ra_decision=$(_qa_extract_scalar "$_ra_content" 'accepted_decision')
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
      ra_expires=$(_qa_extract_scalar "$_ra_content" 'expires_at')
      ra_approved=$(_qa_extract_scalar "$_ra_content" 'approved_at')
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

# ───── fallback.approve — human attestation for a degraded QA path (P3, 2026-06-16) ─────
# Mints .qa/fallback-approval.json so qa-no-silent-fallback.js allows evidence that
# records fallback_used:true. --human-attested is REQUIRED (Claude cannot self-mint);
# same contract-trust model as approve.snapshot (attestation, not crypto).
cmd_fallback_approve() {
  ensure_project_root
  local scope="" reason="" hours="" human_attested="false"
  while (( "$#" )); do
    case "$1" in
      --scope)   scope="${2:-}"; shift 2;;
      --reason)  reason="${2:-}"; shift 2;;
      --hours)   hours="${2:-}"; shift 2;;
      --human-attested) human_attested="true"; shift 1;;
      *) echo "qa-sdk fallback.approve: unknown arg $1" >&2; exit 2;;
    esac
  done
  local missing=()
  [[ -z "$scope"  ]] && missing+=("--scope")
  [[ -z "$reason" ]] && missing+=("--reason")
  [[ -z "$hours"  ]] && missing+=("--hours")
  if (( ${#missing[@]} > 0 )); then echo "qa-sdk fallback.approve: missing: ${missing[*]}" >&2; exit 2; fi
  if ! [[ "$hours" =~ ^[0-9]+$ ]] || (( hours < 1 || hours > 24 )); then
    echo "qa-sdk fallback.approve: --hours must be 1..24 (got $hours)" >&2; exit 2; fi
  if (( ${#reason} < 8 )); then echo "qa-sdk fallback.approve: --reason too short (min 8 chars)" >&2; exit 2; fi
  if [[ "$human_attested" != "true" ]]; then
    echo "qa-sdk fallback.approve: --human-attested is required (Claude cannot self-mint a fallback approval)" >&2; exit 2; fi
  local now expires approver
  now=$(iso_now)
  if expires=$(date -u -d "+$hours hours" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null); then :; else
    expires=$(python -c "import datetime; print((datetime.datetime.utcnow()+datetime.timedelta(hours=$hours)).strftime('%Y-%m-%dT%H:%M:%SZ'))" 2>/dev/null) || {
      echo "qa-sdk fallback.approve: cannot compute expires_at (date -d failed and python not available)" >&2; exit 1; }
  fi
  approver="${USER:-${USERNAME:-unknown}}"
  local scope_json
  scope_json=$(printf '%s' "$scope" | awk -F, '{out="[";for(i=1;i<=NF;i++){gsub(/^[[:space:]]+|[[:space:]]+$/,"",$i);gsub(/"/,"\\\"",$i);out=out (i>1?",":"") "\"" $i "\""} print out "]"}')
  local reason_json
  reason_json=$(printf '%s' "$reason" | python -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null || printf '"%s"' "${reason//\"/\\\"}")
  cat > "$PROJECT_ROOT/.qa/fallback-approval.json" <<EOF
{
  "approver": "$approver",
  "approved_at": "$now",
  "expires_at": "$expires",
  "scope": $scope_json,
  "reason": $reason_json,
  "human_attested": true
}
EOF
  echo "$PROJECT_ROOT/.qa/fallback-approval.json"
}

# ───── level.select / tasklist.write — entry substitute files (P4 soft gate, 2026-06-16) ─────
# The platform cannot force "ask first" (hooks can't see AskUserQuestion / the active skill),
# so SKILL §6 Step 0/0.5 write these substitute files; qa-entry-ask-required / qa-tasklist-required
# gate/remind off their presence. level.select is the UNBLOCKING action (never gated).
cmd_level_select() {
  ensure_project_root
  local level="${1:-}"; [[ "${1:-}" == --* ]] || shift || true
  local run_id=""
  while (( "$#" )); do case "$1" in --run-id) run_id="${2:-}"; shift 2;; *) shift;; esac; done
  case "$level" in
    L1|L2|L3|L4) :;;
    *) echo "qa-sdk level.select: level must be L1|L2|L3|L4 (got '$level'); L0 (intake-only) is folded into Step 1.7" >&2; exit 2;;
  esac
  mkdir -p "$PROJECT_ROOT/.qa/state"
  if [[ -z "$run_id" && -f "$PROJECT_ROOT/.qa/state.json" ]]; then
    run_id=$(node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{process.stdout.write(JSON.parse(s).active_release_tag||'')}catch{}})" < "$PROJECT_ROOT/.qa/state.json" 2>/dev/null)
  fi
  printf '{"level":"%s","run_id":"%s","answered_at":"%s"}\n' "$level" "$run_id" "$(iso_now)" > "$PROJECT_ROOT/.qa/state/level-selected.json"
  echo "$PROJECT_ROOT/.qa/state/level-selected.json"
}
cmd_tasklist_write() {
  ensure_project_root
  local file="${1:-}"
  mkdir -p "$PROJECT_ROOT/.qa/state"
  local out="$PROJECT_ROOT/.qa/state/tasklist.json"
  if [[ -n "$file" ]]; then
    [[ -f "$file" ]] || { echo "qa-sdk tasklist.write: file not found: $file" >&2; exit 1; }
    cat "$file" > "$out"
  else
    cat > "$out"
  fi
  if ! node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$out" 2>/dev/null; then
    echo "qa-sdk tasklist.write: BLOCKED — not valid JSON" >&2; exit 2
  fi
  echo "$out"
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

# ───── T1.1 (ADDITIVE — run-ledger black box; record-only, NEVER blocks) ─────
NODE_BIN="${NODE_BIN:-node}"
RUN_LEDGER="${RUN_LEDGER:-$CLAUDE_HOME/orchestrator-runtime/shared/run-ledger.js}"
_qa_ledger() {
  local tag="$1" decision="$2" stage="$3"
  [[ -f "$RUN_LEDGER" ]] || return 0
  command -v "$NODE_BIN" >/dev/null 2>&1 || return 0
  "$NODE_BIN" "$RUN_LEDGER" append --project "$PROJECT_ROOT" \
    "--run_id=$tag" --subsystem=qa "--stage=$stage" "--decision=$decision" \
    "--gate_result=$PROJECT_ROOT/.qa/evidence/$tag/qa_evidence_bundle.yaml" >/dev/null 2>&1 || true
}
_qa_ledger_on_exit() {
  local rc=$? decision="${_LEDGER_DECISION:-}"
  if [[ -z "$decision" ]]; then
    case "$rc" in 0) decision=PASS;; 1) decision=FAIL;; 2) decision=BLOCKED;; 3) decision=CONDITIONAL_PASS;; *) decision=RECORDED;; esac
  fi
  _qa_ledger "${_LEDGER_TAG:-unknown}" "$decision" "${_LEDGER_STAGE:-gate.check}"
  return 0
}
cmd_ledger_append() {
  ensure_project_root
  if [[ ! -f "$RUN_LEDGER" ]] || ! command -v "$NODE_BIN" >/dev/null 2>&1; then
    echo "qa-sdk ledger.append: WARN — node/run-ledger unavailable; skipped (record-only, never blocks)" >&2; return 0
  fi
  local fwd=( append --project "$PROJECT_ROOT" --subsystem=qa )
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

main() {
  if (( $# < 1 )); then usage; exit 2; fi
  local cmd="$1"; shift
  case "$cmd" in
    init)                         cmd_init "$@";;
    set-active)                   cmd_set_active "$@";;
    evidence.append)              cmd_evidence_append "$@";;
    evidence.run)                 cmd_evidence_run "$@";;
    evidence.list)                cmd_evidence_list "$@";;
    evidence.validate-presence)   cmd_evidence_validate_presence "$@";;
    gate.check)                   cmd_gate_check "$@";;
    finding.add)                  cmd_finding_add "$@";;
    quarantine.add)               cmd_quarantine_add "$@";;
    approve.snapshot)             cmd_approve_snapshot "$@";;
    fallback.approve)             cmd_fallback_approve "$@";;
    level.select)                 cmd_level_select "$@";;
    tasklist.write)               cmd_tasklist_write "$@";;
    spec.hash)                    cmd_spec_hash "$@";;
    sentinel.write)               cmd_sentinel_write "$@";;
    sentinel.show)                cmd_sentinel_show "$@";;
    ledger.append)                cmd_ledger_append "$@";;
    -h|--help|help)               usage; exit 0;;
    *) echo "qa-sdk: unknown command $cmd" >&2; usage; exit 2;;
  esac
}

main "$@"
