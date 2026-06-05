#!/usr/bin/env node
/**
 * install-subsystem-hooks.js — canonical project-local subsystem hook installer.
 *
 * Single source of truth for WHICH hooks belong to a subsystem and their triggers:
 *   ~/.claude/manifests/hook-registry.json  (categories.project_installed.subsystems.<sub>)
 *
 * Used by:  appsec-sdk / qa-sdk / uiux-sdk init (bash) + discoverability-sdk init (python)
 *           + claude-env-bootstrap EXECUTE (§7.1)
 *
 * Model (project-local self-contained — user lock 2026-05-30):
 *   1. Read the subsystem's hook list + triggers from hook-registry.json.
 *   2. Copy each hook .js + its _<sub>-common.js lib module into <project>/.claude/hooks/.
 *   3. Merge nested-format hook entries into <project>/.claude/settings.json, idempotently
 *      (command form: node "${CLAUDE_PROJECT_DIR}/.claude/hooks/<name>.js").
 *
 * Why a single shared helper: the merge + nested-format + dedupe logic is fiddly and
 * settings.json is load-bearing. Four SDKs in two languages must not each re-implement it
 * (that is exactly how the 4 divergent snippets drifted). Bash/python SDKs shell out here.
 *
 * Usage:
 *   node install-subsystem-hooks.js --subsystem <appsec|qa|uiux|discoverability> \
 *        --project-root <path> [--claude-home <path>] [--dry-run] [--quiet]
 *
 * Exit: 0 ok | 1 error | 2 bad args.  Emits one JSON summary line to stdout.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ---- subsystem → (source dir for hook .js, shared common module) -----------
// appsec/qa/uiux hooks live in the global ~/.claude/hooks/; disc hooks ship as
// templates (project-local by design). The common lib module is copied alongside
// so the relative `require('./_<sub>-common.js')` inside each hook still resolves.
const COMMON_MODULE = {
  appsec: '_appsec-common.js',
  qa: '_qa-common.js',
  uiux: '_uiux-common.js',
  discoverability: '_disc-common.js',
};

function fail(msg, code) {
  process.stderr.write(`[install-subsystem-hooks] ${msg}\n`);
  process.exit(code === undefined ? 1 : code);
}

function parseArgs(argv) {
  const a = { dryRun: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--subsystem') a.subsystem = argv[++i];
    else if (t === '--project-root') a.projectRoot = argv[++i];
    else if (t === '--claude-home') a.claudeHome = argv[++i];
    else if (t === '--dry-run') a.dryRun = true;
    else if (t === '--quiet') a.quiet = true;
    else if (t === '--emit-snippet') a.emitSnippet = true;
    else fail(`unknown arg: ${t}`, 2);
  }
  if (!a.subsystem) fail('missing --subsystem', 2);
  if (!COMMON_MODULE[a.subsystem]) fail(`unknown subsystem '${a.subsystem}' (allowed: ${Object.keys(COMMON_MODULE).join(', ')})`, 2);
  if (!a.projectRoot && !a.emitSnippet) fail('missing --project-root', 2);
  a.claudeHome = a.claudeHome || path.join(os.homedir(), '.claude');
  return a;
}

// One nested-format settings entry for a registry hook.
function buildEntry(h) {
  const { event, matcher } = parseTrigger(h.trigger);
  return {
    event,
    entry: {
      matcher,
      hooks: [{
        type: 'command',
        command: `node "\${CLAUDE_PROJECT_DIR}/.claude/hooks/${h.name}"`,
        timeout: timeoutFor(event),
      }],
    },
  };
}

// --emit-snippet: print the canonical settings snippet for a subsystem (the
// manual-merge / documentation artifact), derived from the SAME registry the
// installer merges from — so the snippet can never drift from the live install.
function emitSnippet(claudeHome, subsystem) {
  const sub = loadRegistrySubsystem(claudeHome, subsystem);
  const hooks = {};
  for (const h of sub.hooks) {
    const { event, entry } = buildEntry(h);
    (hooks[event] = hooks[event] || []).push(entry);
  }
  const snippet = {
    _comment: `Project-level hook registration for the ${subsystem} subsystem. GENERATED from ` +
      `manifests/hook-registry.json by orchestrator-runtime/shared/install-subsystem-hooks.js --emit-snippet — DO NOT hand-edit. ` +
      `Preferred install path is the SDK init (it copies hooks project-local AND merges this); ` +
      `this snippet is the manual fallback: copy the hook .js + _<sub>-common.js into <project>/.claude/hooks/, ` +
      `then merge "hooks" into <project>/.claude/settings.json.`,
    _config_gate: sub.config_gate,
    _install_command: sub.install_command,
    hooks,
  };
  process.stdout.write(JSON.stringify(snippet, null, 2) + '\n');
}

// "PreToolUse(Bash)" → {event:'PreToolUse', matcher:'Bash'};  "Stop" → {event:'Stop', matcher:'*'}
function parseTrigger(trigger) {
  const m = /^([A-Za-z]+)(?:\(([^)]*)\))?$/.exec((trigger || '').trim());
  if (!m) return { event: 'PreToolUse', matcher: '*' };
  return { event: m[1], matcher: m[2] && m[2].trim() ? m[2].trim() : '*' };
}

// Stop hooks get longer budgets (they evaluate persisted gate state).
function timeoutFor(event) {
  if (event === 'Stop') return 30;
  return 10;
}

function loadRegistrySubsystem(claudeHome, subsystem) {
  const regPath = path.join(claudeHome, 'manifests', 'hook-registry.json');
  let reg;
  try {
    reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  } catch (e) {
    fail(`cannot read hook-registry.json at ${regPath}: ${e.message}`);
  }
  const sub = reg
    && reg.categories
    && reg.categories.project_installed
    && reg.categories.project_installed.subsystems
    && reg.categories.project_installed.subsystems[subsystem];
  if (!sub || !Array.isArray(sub.hooks)) {
    fail(`hook-registry.json has no project_installed.subsystems.${subsystem}.hooks`);
  }
  return sub;
}

// Find the on-disk source of a hook .js. appsec/qa/uiux/governed-gate live in
// ~/.claude/hooks/; disc-* live in ~/.claude/templates/discoverability/hooks/.
function resolveHookSource(claudeHome, name) {
  const candidates = [
    path.join(claudeHome, 'hooks', name),
    path.join(claudeHome, 'templates', 'discoverability', 'hooks', name),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

function copyIfPresent(src, destDir, name, dryRun, copied, missing) {
  const dest = path.join(destDir, name);
  if (!src) { missing.push(name); return; }
  if (!dryRun) fs.copyFileSync(src, dest);
  copied.push(name);
}

// Does settings.hooks[event] already register a hook whose command ends in /<name>"?
function alreadyRegistered(eventArr, name) {
  if (!Array.isArray(eventArr)) return false;
  const needle = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`[\\\\/]${needle}["'\\s]|[\\\\/]${needle}$`);
  for (const entry of eventArr) {
    const inner = entry && Array.isArray(entry.hooks) ? entry.hooks : [];
    for (const h of inner) {
      if (h && typeof h.command === 'string' && re.test(h.command)) return true;
    }
    // also tolerate flat legacy {matcher,command}
    if (entry && typeof entry.command === 'string' && re.test(entry.command)) return true;
  }
  return false;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.emitSnippet) { emitSnippet(args.claudeHome, args.subsystem); process.exit(0); }
  const sub = loadRegistrySubsystem(args.claudeHome, args.subsystem);

  const projectRoot = path.resolve(args.projectRoot);
  const hooksDir = path.join(projectRoot, '.claude', 'hooks');
  const settingsPath = path.join(projectRoot, '.claude', 'settings.json');

  if (!args.dryRun) fs.mkdirSync(hooksDir, { recursive: true });

  const copied = [];
  const missing = [];

  // 1. Copy the shared common module first (relative require target).
  const commonName = COMMON_MODULE[args.subsystem];
  copyIfPresent(resolveHookSource(args.claudeHome, commonName), hooksDir, commonName, args.dryRun, copied, missing);

  // 2. Copy each hook .js named by the registry.
  for (const h of sub.hooks) {
    copyIfPresent(resolveHookSource(args.claudeHome, h.name), hooksDir, h.name, args.dryRun, copied, missing);
  }

  // 3. Merge nested-format hook entries into settings.json (idempotent).
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (e) {
      fail(`existing settings.json is not valid JSON (${settingsPath}): ${e.message} — refusing to overwrite`);
    }
  }
  if (!settings.hooks || typeof settings.hooks !== 'object') settings.hooks = {};

  const registered = [];
  const skipped = [];
  for (const h of sub.hooks) {
    const { event, entry } = buildEntry(h);
    if (!Array.isArray(settings.hooks[event])) settings.hooks[event] = [];
    if (alreadyRegistered(settings.hooks[event], h.name)) { skipped.push(h.name); continue; }
    settings.hooks[event].push(entry);
    registered.push(`${event}:${h.name}`);
  }

  if (!args.dryRun) {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  }

  const summary = {
    ok: missing.length === 0,
    subsystem: args.subsystem,
    project_root: projectRoot,
    settings_path: settingsPath,
    hooks_copied: copied,
    hooks_missing: missing,
    settings_registered: registered,
    settings_skipped_already_present: skipped,
    dry_run: args.dryRun,
  };
  if (!args.quiet) {
    process.stderr.write(
      `[install-subsystem-hooks] ${args.subsystem}: copied ${copied.length}, registered ${registered.length}, ` +
      `skipped(present) ${skipped.length}${missing.length ? `, MISSING ${missing.join(',')}` : ''}\n`);
  }
  process.stdout.write(JSON.stringify(summary) + '\n');
  process.exit(missing.length === 0 ? 0 : 1);
}

main();
