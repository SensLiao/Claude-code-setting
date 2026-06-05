#!/usr/bin/env node
// disc-mark-stale — PostToolUse(Edit|Write) hook (state-update only, never blocks)
// L12 Discoverability harness contract §7.2.
//
// When the model edits a discoverability-relevant file (robots / sitemap /
// metadata / structured data / store listing / harness config), flip
// .discoverability/state.json gate_status to STALE and append a stale_reasons
// entry. PostToolUse hooks cannot undo the edit; this just forces re-audit.

'use strict';

const path = require('path');
const {
  readInputSafe,
  preflight,
  DISC_TRIGGER_PATTERNS,
  pathMatchesAny,
  markStaleInState,
} = require('./_disc-common.js');

// Advisory state-update hook — tolerate stdin parse errors silently.
const { input, parseError } = readInputSafe();
const safeInput = input || {};

const pre = preflight(safeInput);
if (pre.mode === 'silent' || pre.mode === 'disabled' || pre.mode === 'fail-closed') {
  if (parseError && pre.mode !== 'silent') {
    process.stderr.write(`[disc-mark-stale] stdin parse error: ${parseError}; skipping.\n`);
  }
  process.exit(0);
}

const harness = (pre.config && pre.config.harness) || {};
const hookModes = harness.hook_modes || {};
if (hookModes.mark_stale === 'off') process.exit(0);

// Only act on Edit / Write tool calls
const toolName = safeInput.tool_name || safeInput.tool || '';
if (toolName !== 'Edit' && toolName !== 'Write' && toolName !== 'MultiEdit') process.exit(0);

const tinp = safeInput.tool_input || {};
const filePath = tinp.file_path || tinp.path || '';
if (!filePath) process.exit(0);

if (!pathMatchesAny(filePath, DISC_TRIGGER_PATTERNS)) process.exit(0);

const projectRoot = pre.projectRoot;
const rel = (() => {
  try { return path.relative(projectRoot, filePath); } catch { return filePath; }
})();

const reason = `Edit/Write touched discoverability-relevant file: ${rel}`;
const ok = markStaleInState(projectRoot, reason, rel, 'disc-mark-stale-hook');

if (ok) {
  process.stderr.write(
    `[disc-mark-stale] gate marked STALE due to ${rel}; ` +
    `rerun audit + gate.check before deploy.\n`
  );
} else {
  process.stderr.write(
    `[disc-mark-stale] failed to update .discoverability/state.json for ${rel}; ` +
    `check filesystem permissions.\n`
  );
}

process.exit(0);
