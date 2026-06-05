# `.appsec/` — Project-Level AppSec State (v3.0)

This directory is the **only** physical signal that a project is AppSec-enabled (see SKILL.md §16.0).
Without `.appsec/config.json` at project root, `appsec-security-orchestrator` silent-exits and
no AppSec hook fires — zero noise on non-AppSec projects.

## Bootstrap

`appsec-sdk init` is the canonical installer: it creates `.appsec/config.json` from
template (if missing), copies the AppSec hooks **project-local** into `.claude/hooks/`,
and merges them into `.claude/settings.json` — no manual `cp` of the snippet needed.
(claude-env-bootstrap EXECUTE §7.1a runs this automatically when AppSec is selected.)

```bash
# 1. Initialize. Bare `init` = config + hooks only (no release tag).
#    `init <tag>` ALSO scaffolds evidence/findings/decisions dirs for that release.
appsec-sdk init v0.1.0
# from a fresh checkout without a PATH alias:
#   bash ~/.claude/scripts/appsec-sdk.sh init v0.1.0

# 2. Edit .appsec/config.json — set asvs_level / overlays / production_hosts
$EDITOR .appsec/config.json

# 3. Sanity check (should be BLOCKED — no evidence yet)
appsec-sdk gate.check v0.1.0
echo "exit=$?"   # → 2
```

> Manual fallback (only if `appsec-sdk init` could NOT register hooks — e.g. `node` not
> on PATH): copy `appsec-*.js` + `_appsec-common.js` + `governed-gate-workflow-guard.js`
> from `~/.claude/hooks/` into `<project>/.claude/hooks/`, then merge this skeleton's
> `settings.json.snippet` `hooks` block into `<project>/.claude/settings.json`. Canonical
> hook list: `~/.claude/manifests/hook-registry.json`.

## Layout

```
.appsec/
├── README.md                    # this file
├── config.json                  # asvs_level / csf_targets / overlays / strict_mode / production_hosts
├── state.json                   # active_release_tag / initialized_at / last_dispatch_at  (managed by appsec-sdk)
├── settings.json.snippet        # copy into <project>/.claude/settings.json
├── findings/<tag>/              # finding.yaml.tmpl-shaped files (written ONLY by `appsec-sdk finding.add`)
├── evidence/<tag>/
│   ├── threat-model/            # STRIDE.md, risk-register.yaml
│   ├── sca/                     # raw-<tool>.json
│   ├── secret-scan/             # gitleaks-redacted.json + redaction-attestation.txt
│   ├── sast/                    # raw.json
│   ├── code-review/             # appsec-reviewer agent output
│   ├── headers-cookies/         # snapshot.json
│   ├── dast/                    # ZAP baseline report (if applicable)
│   ├── platform-iac/            # checkov/prowler output
│   ├── platform-k8s/            # trivy/kube-bench output
│   ├── platform-secrets/        # secrets engineering review
│   ├── platform-iam/            # IAM review
│   ├── pentest/                 # ONLY if ROE complete + manual gate passed
│   ├── overlay-<name>/          # one dir per activated overlay (mobile/llm/multitenant/...)
│   └── csf2-coverage/           # GV/ID/PR/DE/RS/RC summary YAML
└── decisions/<tag>/
    ├── appsec_release_decision.yaml   # MACHINE-READABLE release artifact (consumed by gsd-ship / CI)
    └── risk-acceptance/<n>.yaml       # per-finding acceptance docs (only for CONDITIONAL_PASS)
```

## Canonical Write Paths

| Path | Who writes |
|---|---|
| `.appsec/config.json` | Human (one-time during bootstrap) |
| `.appsec/state.json` | `appsec-sdk init` / `appsec-sdk set-active` |
| `.appsec/findings/**/*.yaml` | `appsec-sdk finding.add` ONLY (PreToolUse hook §18.5a rejects direct Write) |
| `.appsec/evidence/<tag>/<layer>/*` | `appsec-sdk evidence.append` (auto-redacts) |
| `.appsec/decisions/<tag>/appsec_release_decision.yaml` | `appsec-evidence-validator` agent + `appsec-sdk gate.check` |
| `.appsec/decisions/<tag>/risk-acceptance/<n>.yaml` | Human approver |

## Hard Rules

- ❌ Do NOT commit `.appsec/evidence/<tag>/secret-scan/**` raw artifacts containing real secrets. The
  `gitleaks --redact` flag is mandatory — raw secret values must never reach disk.
- ❌ Do NOT bypass `appsec-sdk` for finding writes. Direct `Write` to `.appsec/findings/**` is blocked
  by PreToolUse hook `appsec-finding-schema-prewrite.js` (SKILL.md §18.5a).
- ❌ Do NOT use ASVS 4.x identifiers (`V2.1.1` etc.). All `asvs_mapping[]` entries must match
  `^v5\.0\.0-\d+\.\d+\.\d+$`. Hook rejects on write; sdk rejects on finding.add.
- ✅ Commit `config.json`, `findings/`, `evidence/` (minus raw secrets), `decisions/` to repo for
  audit trail. Treat as source of truth for AppSec posture.

## CI Integration

```yaml
# .github/workflows/release-gate.yml — minimal example
- name: AppSec release gate
  run: appsec-sdk gate.check "$RELEASE_TAG" --allow-conditional
# Exit 0 → green; exit 1 → FAIL; exit 2 → BLOCKED; with --allow-conditional, CONDITIONAL_PASS → 0.
```

For shell scripts that need to distinguish CONDITIONAL_PASS from PASS:

```bash
appsec-sdk gate.check "$TAG"
case $? in
  0) deploy ;;
  3) require_manual_approval && deploy ;;
  *) exit 1 ;;
esac
```

See `~/.claude/skills/appsec-security-orchestrator/SKILL.md` §16 / §17 / §18 / §20 for the full
contract.
