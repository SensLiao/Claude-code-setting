#!/usr/bin/env node
'use strict';

/**
 * tests/harness/relocation-integrity.test.js
 *
 * Delegates to tools/relocation-integrity/lint.js — propagates its exit code.
 * Guards the SKILL-slimming refactor: no binding governance contract silently
 * degrades from always-loaded to best-effort-loaded; hooks stay SKILL-independent;
 * descriptions stay <= 1024 chars.
 */

const path = require('path');
const child_process = require('child_process');
const H = require('./_helpers');

const h = new H.Harness('relocation-integrity (delegates to tools/relocation-integrity/lint.js)');

const LINTER = path.join(H.claudeRoot, 'tools', 'relocation-integrity', 'lint.js');
if (!H.existsSync(LINTER)) {
  h.error(`Linter not found: ${H.rel(LINTER)}`);
  process.exit(h.exit());
}

h.section('Running tools/relocation-integrity/lint.js');
const out = child_process.spawnSync(
  process.execPath,
  [LINTER, '--root', H.claudeRoot],
  { stdio: 'inherit' }
);

const code = out.status == null ? 2 : out.status;
if (code === 0) {
  h.ok('tools/relocation-integrity/lint.js exit 0 (clean)');
} else if (code === 1) {
  h.fail('tools/relocation-integrity/lint.js exit 1 (contract degradation / drift detected)');
} else {
  h.error(`tools/relocation-integrity/lint.js exit ${code}`, out.error ? out.error.message : null);
}

process.exit(h.exit());
