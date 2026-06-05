#!/usr/bin/env node
'use strict';

/**
 * tests/harness/hook-registry.test.js
 *
 * Delegates to tools/hooks/lint.js — propagates its exit code.
 */

const path = require('path');
const child_process = require('child_process');
const H = require('./_helpers');

const h = new H.Harness('hook-registry (delegates to tools/hooks/lint.js)');

const LINTER = path.join(H.claudeRoot, 'tools', 'hooks', 'lint.js');
if (!H.existsSync(LINTER)) {
  h.error(`Linter not found: ${H.rel(LINTER)}`);
  process.exit(h.exit());
}

h.section('Running tools/hooks/lint.js');
const out = child_process.spawnSync(
  process.execPath,
  [LINTER, '--root', H.claudeRoot],
  { stdio: 'inherit' }
);

const code = out.status == null ? 2 : out.status;
if (code === 0) {
  h.ok('tools/hooks/lint.js exit 0 (clean)');
} else if (code === 1) {
  h.fail(`tools/hooks/lint.js exit 1 (drift detected)`);
} else {
  h.error(`tools/hooks/lint.js exit ${code}`, out.error ? out.error.message : null);
}

process.exit(h.exit());
