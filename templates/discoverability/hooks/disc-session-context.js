#!/usr/bin/env node
// disc-session-context — SessionStart hook (advisory only, never blocks)
// L12 Discoverability harness contract §7.1.
//
// On session start, if discoverability.config.yaml exists and harness is
// enabled, emit a brief additionalContext message reminding the model:
//   - active tag + gate status (from state.json)
//   - which file edits will mark the gate STALE
//   - command to re-run before claiming done
// Never blocks. Silent exit when no config / harness disabled / config
// malformed (no need to fail-closed for a pure advisory hook).

'use strict';

const { readInputSafe, preflight, getActiveRunTag, emitAdvisory } = require('./_disc-common.js');

// Read stdin; advisory hook can tolerate parse errors silently.
const { input } = readInputSafe();
const safeInput = input || {};

const pre = preflight(safeInput);
if (pre.mode === 'silent' || pre.mode === 'disabled' || pre.mode === 'fail-closed') {
  process.exit(0);
}

// Honor per-hook mode toggle if config specifies it.
const harness = (pre.config && pre.config.harness) || {};
const hookModes = harness.hook_modes || {};
if (hookModes.session_context === 'off') process.exit(0);

const { activeTag, activeRun, gateStatus, lastGateAt } = getActiveRunTag(pre.projectRoot);

const tagLabel = activeTag || 'none';
const statusLabel = gateStatus || 'unknown';
const runLabel = activeRun ? 'yes' : 'no';
const lastGateLabel = lastGateAt || 'never';

const lines = [
  'L12 Discoverability harness enabled in this repo.',
  `Active run tag: ${tagLabel}  (active_run=${runLabel}, gate_status=${statusLabel}, last_gate=${lastGateLabel})`,
  '',
  'Heads-up: editing any of the following will mark the gate STALE and block deploy until',
  're-audit:',
  '  - robots.txt / sitemap.xml / public/{robots.txt,sitemap.xml,llms.txt}',
  '  - app/robots.ts / app/sitemap.ts / app/metadata.ts / app/layout.tsx / app/head.tsx',
  '  - llms.txt / llms-full.txt / app/structured-data/* / jsonld*',
  '  - fastlane/metadata/* / app-store/* / google-play/* / store-listing/*',
  '  - discoverability.config.yaml',
  '',
  'Before claiming "discoverability done" / "L12 complete" / "SEO/AEO/ASO audit complete":',
  '  python scripts/discoverability-sdk.py gate.check <tag>',
  '',
  'Disc hooks:',
  '  - disc-mark-stale (PostToolUse Edit|Write): flips gate_status to STALE on trigger-file edits',
  '  - disc-robots-sitemap-guard (PreToolUse Edit|Write): blocks obvious robots/sitemap/llms.txt mistakes',
  '  - disc-deploy-gate (PreToolUse Bash): blocks deploy commands when gate is STALE/FAIL/BLOCKED/missing',
  '  - disc-evidence-required (Stop): blocks "done" claims without a valid gate-result.yaml',
];

emitAdvisory('SessionStart', lines);
process.exit(0);
