#!/usr/bin/env node
'use strict';

/**
 * tests/harness/run-all.js
 *
 * Root test runner — discovers every *.test.js sibling, spawns each in its
 * own Node child process, and aggregates results. Cross-platform (Windows /
 * Linux / macOS).
 *
 * Exit codes:
 *   0 — every test PASS
 *   1 — one or more tests FAIL (drift)
 *   2 — one or more tests ERROR (infrastructure)
 *
 * Usage:
 *   node tests/harness/run-all.js
 *   node tests/harness/run-all.js --bail        # stop on first non-PASS
 *   node tests/harness/run-all.js --quiet       # only print final summary
 */

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const { color } = require('./_helpers');

const THIS_DIR = __dirname;
const RUN_FILE = path.basename(__filename);

function parseArgs(argv) {
  const args = { bail: false, quiet: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--bail') args.bail = true;
    else if (a === '--quiet' || a === '-q') args.quiet = true;
    else if (a === '--help' || a === '-h') {
      console.error('Usage: node tests/harness/run-all.js [--bail] [--quiet]');
      process.exit(0);
    }
  }
  return args;
}

function discoverTests(dir) {
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.test.js') && f !== RUN_FILE)
    .sort();
}

function statusLabel(code) {
  if (code === 0) return color('green', 'PASS');
  if (code === 2) return color('magenta', 'ERROR');
  return color('red', 'FAIL');
}

function main() {
  const args = parseArgs(process.argv);
  const tests = discoverTests(THIS_DIR);

  const header = '='.repeat(72);
  console.log(color('cyan', header));
  console.log(color('bold', `  CLAUDE HARNESS TEST SUITE  (${tests.length} tests)`));
  console.log(color('cyan', header));
  console.log('');

  const results = [];
  let interrupted = false;
  const onSigint = () => {
    interrupted = true;
    console.log('');
    console.log(color('yellow', '  Interrupted by user (Ctrl+C). Reporting partial results.'));
  };
  process.on('SIGINT', onSigint);

  for (const file of tests) {
    if (interrupted) break;
    const full = path.join(THIS_DIR, file);
    const started = Date.now();
    if (!args.quiet) {
      console.log(color('blue', `>>> ${file}`));
    }
    const out = child_process.spawnSync(
      process.execPath,
      [full],
      { stdio: args.quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit' }
    );
    const code = out.status == null ? 2 : out.status;
    const dur = Date.now() - started;
    results.push({ file, code, dur, signal: out.signal, error: out.error });
    if (args.quiet && (code !== 0 || args.bail)) {
      // dump captured output when non-PASS in quiet mode
      if (out.stdout) process.stdout.write(out.stdout);
      if (out.stderr) process.stderr.write(out.stderr);
    }
    if (args.bail && code !== 0) break;
  }

  process.removeListener('SIGINT', onSigint);

  // Summary
  console.log('');
  console.log(color('cyan', header));
  console.log(color('bold', '  SUMMARY'));
  console.log(color('cyan', header));

  let passes = 0; let fails = 0; let infraErrors = 0; let totalDur = 0;
  for (const r of results) {
    if (r.code === 0) passes += 1;
    else if (r.code === 2) infraErrors += 1;
    else fails += 1;
    totalDur += r.dur;
    const left = `  ${statusLabel(r.code)}`;
    const pad = Math.max(0, 50 - r.file.length);
    const padStr = ' '.repeat(pad);
    console.log(`${left}  ${r.file}${padStr}${color('gray', `(${r.dur}ms)`)}`);
  }

  const notRun = tests.length - results.length;
  if (notRun > 0) {
    console.log(color('yellow', `  ${notRun} test(s) not run (bailed or interrupted)`));
  }

  console.log(color('gray', '-'.repeat(72)));
  const overall =
    infraErrors > 0 ? color('magenta', 'ERROR')
    : fails > 0 ? color('red', 'FAIL')
    : color('green', 'PASS');
  console.log(
    `  Overall: ${overall}   `
    + `${color('green', `PASS:${passes}`)}  `
    + `${color('red', `FAIL:${fails}`)}  `
    + `${color('magenta', `ERROR:${infraErrors}`)}  `
    + `${color('gray', `total:${totalDur}ms`)}`
  );
  console.log('');

  // Exit semantics:
  //   - any infra error → 2
  //   - any fail → 1
  //   - all pass → 0
  if (infraErrors > 0) process.exit(2);
  if (fails > 0) process.exit(1);
  if (interrupted) process.exit(1);
  process.exit(0);
}

main();
