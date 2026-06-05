#!/usr/bin/env node
'use strict';

/**
 * tests/harness/appsec-routing-bridge.test.js
 *
 * Bridges to tests/appsec-routing/runner.sh (bash + python). On Linux/macOS,
 * runs directly. On Windows, attempts to spawn `bash` (Git Bash / WSL).
 * Falls back to SMOKE_SKIPPED if bash unavailable.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const child_process = require('child_process');
const H = require('./_helpers');

const h = new H.Harness('appsec-routing-bridge');

const RUNNER = path.join(H.claudeRoot, 'tests', 'appsec-routing', 'runner.sh');
if (!H.existsSync(RUNNER)) {
  h.error(`Runner not found: ${H.rel(RUNNER)}`);
  process.exit(h.exit());
}

const platform = os.platform();
h.section(`Platform: ${platform}`);

function tryRunBash(bashBin) {
  return child_process.spawnSync(
    bashBin,
    [RUNNER],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        CLAUDE_HOME: H.claudeRoot,
      },
      timeout: 60000,
    }
  );
}

// Find an executable on PATH, return its path or null
function whichExists(bin) {
  const sep = platform === 'win32' ? ';' : ':';
  const paths = (process.env.PATH || process.env.Path || '').split(sep);
  const exts = platform === 'win32'
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';').map(s => s.toLowerCase())
    : [''];
  for (const p of paths) {
    if (!p) continue;
    for (const ext of exts) {
      const cand = path.join(p, bin + ext);
      try {
        if (fs.existsSync(cand)) return cand;
      } catch (_e) { /* skip */ }
    }
    // also try plain bin name without ext (linux/mac default)
    const plain = path.join(p, bin);
    try {
      if (fs.existsSync(plain) && !platform.match(/win/i)) return plain;
    } catch (_e) { /* skip */ }
  }
  return null;
}

// Strategy:
//   non-Windows: spawn 'bash'
//   Windows: prefer bash on PATH (Git Bash / WSL); if missing, SMOKE_SKIPPED
let bashBin = 'bash';
if (platform === 'win32') {
  const found = whichExists('bash');
  if (!found) {
    h.warn(
      'SMOKE_SKIPPED: bash not on PATH (Windows). '
      + 'Requires Git Bash / WSL to bridge to tests/appsec-routing/runner.sh'
    );
    process.exit(h.exit());
  }
  bashBin = found;
  h.ok(`Found bash on Windows: ${bashBin}`);
}

h.section('Running tests/appsec-routing/runner.sh');
const out = tryRunBash(bashBin);

if (out.error && out.error.code === 'ENOENT') {
  h.warn(
    'SMOKE_SKIPPED: bash spawn ENOENT — '
    + (platform === 'win32'
      ? 'install Git Bash or WSL to enable this bridge'
      : 'bash should be available on POSIX hosts; investigate')
  );
  process.exit(h.exit());
}

if (out.status === 0) {
  h.ok('tests/appsec-routing/runner.sh exit 0 (all checks passed)');
} else {
  // The bash runner uses exit codes 1-4 per its own contract
  h.fail(`tests/appsec-routing/runner.sh exit ${out.status}`);
  if (out.error) {
    console.log(`         (${out.error.message})`);
  }
}

process.exit(h.exit());
