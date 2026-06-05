#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * tools/ccswitch-guard/ccswitch-guard.js
 *
 * Post-switch merge guard for ~/.claude/settings.json (provider-portability.md P4).
 *
 * WHY: CC Switch rewrites ~/.claude/settings.json when switching the active Claude
 * provider, and has a documented history (cc-switch issues #1907 / #2109) of dropping
 * non-provider keys — hooks / statusLine / etc — because it extracts "common config"
 * from its provider DB, not from the live settings.json. This harness's entire GSD
 * governance layer lives in settings.json.hooks, so a clobber = governance loss.
 *
 * This guard makes a provider switch SAFE without managed-settings by:
 *   1. capturing a known-good snapshot of the protected keys, and
 *   2. re-asserting them after a switch (or just checking, for the acceptance gate).
 *
 * Protected (governance) top-level keys are fully restored from the snapshot.
 * `env` is MERGED, not overwritten: the snapshot's non-ANTHROPIC_* env vars
 * (e.g. DISABLE_TELEMETRY, CLAUDE_CODE_*) are re-asserted, while the switch's
 * ANTHROPIC_* provider payload (BASE_URL / AUTH_TOKEN / MODEL...) is preserved.
 *
 * Modes:
 *   --capture          read settings.json → (re)write the snapshot. Run when settings
 *                      are in a known-good state (e.g. on Claude Official, hooks intact).
 *   --check            dry-run: report drift vs snapshot; exit 1 if any protected key
 *                      drifted. This is the "protected-key diff must be empty" gate.
 *   --restore (default) merge snapshot back into settings.json; back up first; write
 *                      only if changed. Run AFTER a CC Switch provider switch.
 *
 * Node built-ins only. Exit: 0 ok/clean · 1 drift (in --check) · 2 error.
 * Usage: node tools/ccswitch-guard/ccswitch-guard.js [--capture|--check|--restore] [--settings <path>]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Governance top-level keys that must survive a provider switch. (env handled separately.)
const PROTECTED_KEYS = [
  'hooks',
  'permissions',
  'statusLine',
  'enabledPlugins',
  'skillOverrides',
  'disableSkillShellExecution',
  'extraKnownMarketplaces',
  'mcpServers',
];
// env vars that belong to the PROVIDER (allowed to change on a switch). Everything
// else in env is governance/runtime and is preserved.
const PROVIDER_ENV_PREFIX = 'ANTHROPIC_';

const HERE = __dirname;
const SNAPSHOT = path.join(HERE, 'protected-keys.snapshot.json');

function parseArgs(argv) {
  const a = { mode: 'restore', settings: path.join(os.homedir(), '.claude', 'settings.json') };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--capture') a.mode = 'capture';
    else if (argv[i] === '--check') a.mode = 'check';
    else if (argv[i] === '--restore') a.mode = 'restore';
    else if (argv[i] === '--settings' && i + 1 < argv.length) { a.settings = argv[i + 1]; i += 1; }
    else if (argv[i] === '-h' || argv[i] === '--help') {
      console.log('Usage: node ccswitch-guard.js [--capture|--check|--restore] [--settings <path>]');
      process.exit(0);
    }
  }
  return a;
}

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
// Canonicalize for ORDER-INSENSITIVE comparison: recursively sort object keys.
// Array element order is preserved (it can be semantically meaningful). CC Switch
// round-trips settings.json through its own JSON serializer, which reorders OBJECT
// KEYS only — without this, deepEqual() false-positives "drift" on every switch even
// when no governance content changed, turning --check into a cry-wolf gate.
function canonicalize(x) {
  if (Array.isArray(x)) return x.map(canonicalize);
  if (x && typeof x === 'object') {
    const o = {};
    for (const k of Object.keys(x).sort()) o[k] = canonicalize(x[k]);
    return o;
  }
  return x;
}
function deepEqual(a, b) { return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b)); }

function ts() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function buildSnapshot(settings) {
  const snap = { captured_at: new Date().toISOString(), protected: {}, env_preserve: {} };
  for (const k of PROTECTED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(settings, k)) snap.protected[k] = settings[k];
  }
  const env = settings.env || {};
  for (const [k, v] of Object.entries(env)) {
    if (!k.startsWith(PROVIDER_ENV_PREFIX)) snap.env_preserve[k] = v;
  }
  return snap;
}

// Returns { merged, drift: [ {key, kind} ] } comparing current settings against snapshot.
function computeMerge(settings, snap) {
  const merged = { ...settings };
  const drift = [];
  for (const [k, v] of Object.entries(snap.protected)) {
    if (!Object.prototype.hasOwnProperty.call(settings, k)) {
      drift.push({ key: k, kind: 'MISSING (would restore)' });
      merged[k] = v;
    } else if (!deepEqual(settings[k], v)) {
      drift.push({ key: k, kind: 'CHANGED (would restore snapshot)' });
      merged[k] = v;
    }
  }
  // env: keep current env (incl. provider ANTHROPIC_*) then re-assert preserved vars
  const curEnv = settings.env || {};
  const mergedEnv = { ...curEnv };
  for (const [k, v] of Object.entries(snap.env_preserve)) {
    if (!Object.prototype.hasOwnProperty.call(curEnv, k)) {
      drift.push({ key: `env.${k}`, kind: 'MISSING (would restore)' });
      mergedEnv[k] = v;
    } else if (curEnv[k] !== v) {
      drift.push({ key: `env.${k}`, kind: 'CHANGED (would restore snapshot)' });
      mergedEnv[k] = v;
    }
  }
  merged.env = mergedEnv;
  return { merged, drift };
}

function main() {
  const args = parseArgs(process.argv);
  if (!fs.existsSync(args.settings)) {
    console.error(`ccswitch-guard: settings not found: ${args.settings}`);
    process.exit(2);
  }
  let settings;
  try { settings = readJson(args.settings); }
  catch (e) { console.error(`ccswitch-guard: settings.json parse error: ${e.message}`); process.exit(2); }

  if (args.mode === 'capture') {
    const snap = buildSnapshot(settings);
    fs.writeFileSync(SNAPSHOT, JSON.stringify(snap, null, 2));
    console.log('ccswitch-guard: captured known-good snapshot →', path.relative(os.homedir(), SNAPSHOT));
    console.log(`  protected keys: ${Object.keys(snap.protected).join(', ') || '(none)'}`);
    console.log(`  env preserved : ${Object.keys(snap.env_preserve).join(', ') || '(none)'}`);
    process.exit(0);
  }

  if (!fs.existsSync(SNAPSHOT)) {
    console.error('ccswitch-guard: no snapshot yet — run with --capture first (while settings are known-good).');
    process.exit(2);
  }
  const snap = readJson(SNAPSHOT);
  const { merged, drift } = computeMerge(settings, snap);

  if (args.mode === 'check') {
    if (drift.length === 0) {
      console.log('ccswitch-guard [check]: protected-key diff EMPTY ✓ (governance intact)');
      process.exit(0);
    }
    console.error('ccswitch-guard [check]: protected-key DRIFT detected:');
    for (const d of drift) console.error(`  - ${d.key}: ${d.kind}`);
    console.error('  → run `node ccswitch-guard.js --restore` to re-assert governance keys.');
    process.exit(1);
  }

  // restore
  if (drift.length === 0) {
    console.log('ccswitch-guard [restore]: no drift — settings.json governance keys already intact ✓');
    process.exit(0);
  }
  const backup = `${args.settings}.ccs-backup-${ts()}`;
  fs.copyFileSync(args.settings, backup);
  fs.writeFileSync(args.settings, JSON.stringify(merged, null, 2));
  console.log('ccswitch-guard [restore]: re-asserted governance keys after provider switch.');
  console.log(`  backup: ${path.basename(backup)}`);
  for (const d of drift) console.log(`  restored ${d.key} (${d.kind})`);
  process.exit(0);
}

try { main(); } catch (e) { console.error(`ccswitch-guard: internal error: ${e.message}`); process.exit(2); }
