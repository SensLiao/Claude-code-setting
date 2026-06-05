# QA-enabled project template

Opt a project into the `enterprise-qa-testing` orchestrator's enforcement layer.

**Canonical install** — one command, from the project root:

```bash
bash ~/.claude/scripts/qa-sdk.sh init      # or `qa-sdk init` if aliased
```

`qa-sdk init` creates `.qa/config.json` (from this template if missing), copies the QA
hooks **project-local** into `.claude/hooks/`, and merges them into `.claude/settings.json`
(nested form, `${CLAUDE_PROJECT_DIR}` paths). claude-env-bootstrap EXECUTE §7.1a runs this
automatically when QA is selected. Bare `init` needs no release tag; `init <tag>` also
scaffolds `.qa/evidence/<tag>/`.

## Files (manual fallback — `qa-sdk init` does all of this)

| Source | Destination | Purpose |
|---|---|---|
| `settings.project.json` | `<project>/.claude/settings.json` | Registers the QA hooks (PreToolUse / PostToolUse / Stop) — canonical list in `manifests/hook-registry.json` |
| `.qa/config.json` | `<project>/.qa/config.json` | `qa_enforcement: strict|warn|off` switch (also the hook gate) |
| `.qa/quarantine.yaml` | `<project>/.qa/quarantine.yaml` | Flaky test accountability ledger |
| `~/.claude/hooks/qa-*.js` + `_qa-common.js` + `governed-gate-workflow-guard.js` | `<project>/.claude/hooks/` | The hook implementations (project-local copy) |

## What this gives you

1. **Snapshot baseline updates require explicit approval** — `--update-snapshots` blocked by `qa-block-update-snapshots.js` unless `.qa/snapshot-update-approval.json` is valid (24h max, scoped).
2. **High-risk path edits are flagged** — `qa-floor-rule-prompt.js` injects Floor Rule reminder when auth/payment/admin/migration paths are touched.
3. **Internal-module mocks are caught** — `qa-detect-internal-mock.js` writes `.qa/findings/internal-mock-<hash>.yaml` when tests mock the module under test.
4. **Quarantine entries are accountable** — `qa-quarantine-accountability.js` blocks `git commit` if quarantine entries lack any of 8 required fields (test_name, failure_class, owner, issue_id, expiry_date, reproduction_command, last_seen, unblock_condition).
5. **Stop is gated on evidence** — `qa-evidence-required.js` blocks Claude from claiming done if `.qa/evidence/<tag>/qa_evidence_bundle.yaml` is missing or `release_decision` is FAIL/BLOCKED without `.qa/risk-acceptance.yaml`.

## Disabling temporarily

Set `qa_enforcement: "warn"` in `.qa/config.json` — hooks become advisory only. Set to `"off"` to silence.

## Reference

- Skill: `~/.claude/skills/enterprise-qa-testing/SKILL.md` v3.1.0 §1.6 + §17
- Hooks: `~/.claude/hooks/qa-*.js`
- SDK: `~/.claude/scripts/qa-sdk.sh`
