#!/usr/bin/env node
/**
 * claude-config.js — unified installer + updater + hook-wirer for the Claude-code-setting repo.
 * Cross-platform (Windows PowerShell / cmd / Git Bash / macOS / Linux) — needs only Node + git.
 *
 *   node claude-config.js status              show install pin, repo HEAD, drift (read-only)
 *   node claude-config.js install [--apply]   deploy files (additive) + interactively offer hook wiring
 *   node claude-config.js update  [--apply]   force-sync managed dirs + clean orphans + re-pin
 *   node claude-config.js wire    [--apply]   (re-)wire hooks into settings.json (interactive or --hooks)
 *   node claude-config.js export-profile [name] [--apply]   record wired hooks -> profiles/<name>.json; `status` then reports drift
 *
 * Flags:
 *   --apply              actually write (default = DRY RUN — prints what it would do)
 *   --no-clean           (update) keep orphan files instead of deleting them
 *   --pull               (update) git fetch + autostash + pull --ff-only first
 *   --target DIR         target dir (default: <home>/.claude)
 *   --wire / --no-wire   force/skip hook wiring non-interactively
 *   --hooks=A,B          which batches to wire (implies --wire); default = all batches
 *   --yes                accept defaults, no prompts
 *
 * Interactive prompts only run in a real terminal (TTY). When piped / headless / via an agent,
 * the script never blocks: it wires only if --wire/--hooks is given, otherwise prints a hint.
 *
 * Never written or deleted: settings.json (only hooks MERGED on wire), .credentials.json, memory,
 * projects, sessions, tasks, history.jsonl, plugins, and anything in custom_files.
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), readline = require('readline');

const REPO = __dirname;
const args = process.argv.slice(2);
const cmd = args.find(a => !a.startsWith('-')) || 'status';
const has = f => args.includes(f);
const APPLY = has('--apply'), NOCLEAN = has('--no-clean'), PULL = has('--pull');
const NOWIRE = has('--no-wire'), WIRE = has('--wire'), YES = has('--yes');
const tIdx = args.indexOf('--target');
const TARGET = tIdx >= 0 ? args[tIdx + 1] : path.join(os.homedir(), '.claude');
const hooksArg = args.find(a => a.startsWith('--hooks='));
const HOOKS_FLAG = hooksArg ? hooksArg.split('=')[1] : (args.indexOf('--hooks') >= 0 ? args[args.indexOf('--hooks') + 1] : null);
const PROFILE_NAME = args.filter(a => !a.startsWith('-'))[1] || 'default';

const SKIP = new Set(['install.ps1', 'install.sh', 'README.md', '.gitignore', '.gitattributes',
  'settings.example.json', '.git', '.github', '.claude', 'claude-config.js', 'claude-config.ps1', 'wire-manifest.json', 'profiles']);
const PRESERVE = new Set(['.credentials.json', 'settings.json', 'settings.local.json',
  'memory', 'projects', 'sessions', 'tasks', 'history.jsonl', 'plugins']);
const MANAGED = ['agents', 'commands', 'skills', 'hooks', 'scripts', 'rules', 'docs', 'manifests',
  'schemas', 'templates', 'orchestrator-runtime', 'get-shit-done', 'workflows', 'mcp-servers', 'mcp-configs', 'tools'];
const TEXT = new Set(['.md', '.json', '.js', '.cjs', '.mjs', '.sh', '.ps1', '.py', '.yaml', '.yml', '.toml', '.txt', '.bak']);

// placeholder substitution (OS-aware: posix paths on macOS/Linux, backslash on Windows)
const home = os.homedir();
const isWin = process.platform === 'win32';
const winp = s => s.replace(/\//g, '\\');
const toPosix = s => { let p = s.replace(/\\/g, '/'); const m = p.match(/^([A-Za-z]):(.*)$/); return m ? '/' + m[1].toLowerCase() + m[2] : p; };
const nativeT = isWin ? winp(TARGET) : TARGET;
const nativeH = isWin ? winp(home) : home;
const SUBST = {
  '__CLAUDE_HOME_JSON__': nativeT.replace(/\\/g, '\\\\'),
  '__USER_HOME_JSON__': nativeH.replace(/\\/g, '\\\\'),
  '__CLAUDE_HOME_WIN__': nativeT,
  '__USER_HOME_WIN__': nativeH,
  '__CLAUDE_HOME_POSIX__': toPosix(TARGET),
  '__USER_HOME_POSIX__': toPosix(home),
};

function walk(base, rel = '') {
  let out = []; let ents;
  try { ents = fs.readdirSync(base, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) out = out.concat(walk(path.join(base, e.name), r));
    else out.push(r);
  }
  return out;
}
function repoFiles() {
  return walk(REPO).filter(r => {
    const top = r.split('/')[0];
    return !(SKIP.has(top) || SKIP.has(r) || PRESERVE.has(top));
  });
}
const pinPath = () => path.join(TARGET, '.config-source.json');
const readPin = () => { try { return JSON.parse(fs.readFileSync(pinPath(), 'utf8')); } catch { return null; } };
const gitHead = () => { try { return cp.execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim(); } catch { return null; } };

let _customCache;
function customExcludes() {
  if (_customCache) return _customCache;
  const pin = readPin();
  _customCache = new Set((pin && pin.custom_files) || []);
  return _customCache;
}
function isUserOwned(r, custom) {
  return custom.has(r) || /^hooks\/gitnexus\//.test(r) || /^skills\/(gitnexus|learned)/.test(r);
}
// exact bytes deployFile would write for repo-relative path r (text files get OS-aware SUBST,
// so a deployed placeholder file compares equal to source — no false "stale").
function expectedBytes(r) {
  const src = path.join(REPO, r);
  if (TEXT.has(path.extname(src).toLowerCase())) {
    let c = fs.readFileSync(src, 'utf8');
    for (const k of Object.keys(SUBST)) if (c.includes(k)) c = c.split(k).join(SUBST[k]);
    return Buffer.from(c, 'utf8');
  }
  return fs.readFileSync(src);
}
function classify() {
  const files = repoFiles();
  let same = 0, stale = 0, missing = 0; const staleL = [], missL = [];
  for (const r of files) {
    const b = path.join(TARGET, r);
    if (!fs.existsSync(b)) { missing++; missL.push(r); continue; }
    if (Buffer.compare(expectedBytes(r), fs.readFileSync(b)) === 0) same++;
    else { stale++; staleL.push(r); }
  }
  const repoSet = new Set(files), custom = customExcludes(), orphans = [];
  for (const m of MANAGED) {
    const base = path.join(TARGET, m);
    if (!fs.existsSync(base)) continue;
    for (const r of walk(base, m)) {
      if (repoSet.has(r) || fs.existsSync(path.join(REPO, r)) || isUserOwned(r, custom)) continue;
      orphans.push(r);
    }
  }
  return { files, same, stale, missing, staleL, missL, orphans };
}
function deployFile(r, force) {
  if (customExcludes().has(r)) return 'protected'; // never overwrite a user-registered custom file, even on --force
  const src = path.join(REPO, r), dst = path.join(TARGET, r);
  const exists = fs.existsSync(dst);
  if (exists && !force) return 'skip';
  if (!APPLY) return exists ? 'would-update' : 'would-add';
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (TEXT.has(path.extname(src).toLowerCase())) fs.writeFileSync(dst, expectedBytes(r));
  else fs.copyFileSync(src, dst);
  return exists ? 'updated' : 'added';
}
function writePin() {
  const pin = readPin() || {};
  const out = {
    repo_path: REPO.replace(/\\/g, '/'),
    remote: (() => { try { return cp.execSync('git remote get-url origin', { cwd: REPO }).toString().trim(); } catch { return pin.remote || null; } })(),
    installed_sha: gitHead(),
    installed_at: new Date().toISOString(),
    install_mode: cmd,
    custom_files: [...customExcludes()],
    notes: 'settings.json / .credentials.json / memory / projects / sessions / tasks / plugins + custom_files are never written or deleted by claude-config.js (settings.json hooks are only MERGED via `wire`).',
  };
  if (APPLY) fs.writeFileSync(pinPath(), JSON.stringify(out, null, 2) + '\n');
  return out;
}
function verifyHooks() {
  let st; try { st = JSON.parse(fs.readFileSync(path.join(TARGET, 'settings.json'), 'utf8')); } catch { return null; }
  const broken = []; let ref = 0;
  for (const ev of Object.keys(st.hooks || {}))
    for (const g of st.hooks[ev] || [])
      for (const h of (g.hooks || [])) {
        const m = (h.command || '').match(/"([^"]+\.(?:js|cjs|sh))"/g);
        if (m) for (const q of m) { const p = q.replace(/"/g, ''); ref++; if (!fs.existsSync(p)) broken.push(`${ev}: ${p}`); }
      }
  return { ref, broken };
}
// ---- hook profile (light): record wired hooks as a portable allow-list + drift check ----
const TARGET_FWD = TARGET.replace(/\\/g, '/');
const HOME_FWD = home.replace(/\\/g, '/');
function templatize(cmd) {
  let c = cmd || '';
  c = c.split(NODE_BIN).join('__NODE_BIN__');             // node path, forward-slash form (entryCommand)
  c = c.split(process.execPath).join('__NODE_BIN__');     // node path, native form
  c = c.split(TARGET_FWD).join('__CLAUDE_HOME__');        // ~/.claude, forward-slash
  c = c.split(TARGET).join('__CLAUDE_HOME__');            // ~/.claude, native backslash
  c = c.split(toPosix(TARGET)).join('__CLAUDE_HOME__');   // ~/.claude, posix /c/...
  c = c.split(HOME_FWD).join('__USER_HOME__');
  c = c.split(home).join('__USER_HOME__');
  c = c.split(toPosix(home)).join('__USER_HOME__');
  return c;
}
function liveHookEntries() {
  let st; try { st = JSON.parse(fs.readFileSync(path.join(TARGET, 'settings.json'), 'utf8')); } catch { return null; }
  const out = [];
  for (const event of Object.keys(st.hooks || {}))
    for (const g of st.hooks[event] || [])
      for (const h of (g.hooks || []))
        out.push({ event, matcher: g.matcher || null, command: templatize(h.command || ''), ...(h.timeout ? { timeout: h.timeout } : {}) });
  out.sort((a, b) => (a.event + '|' + a.command).localeCompare(b.event + '|' + b.command));
  return out;
}
const profileKey = e => `${e.event}|${e.matcher || '-'}|${e.command}`;
function profileDrift(name) {
  const p = path.join(REPO, 'profiles', name + '.json');
  if (!fs.existsSync(p)) return null;
  let prof; try { prof = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
  const live = liveHookEntries() || [];
  const liveSet = new Set(live.map(profileKey)), profSet = new Set((prof.hooks || []).map(profileKey));
  return {
    missing: (prof.hooks || []).filter(e => !liveSet.has(profileKey(e))),  // in profile, not live
    extra: live.filter(e => !profSet.has(profileKey(e))),                  // in live, not in profile (snuck in)
  };
}
function doPull() {
  if (!PULL) return;
  try {
    const dirty = cp.execSync('git status --porcelain', { cwd: REPO }).toString().trim().length > 0;
    if (dirty) { console.log('  git: stashing local changes'); cp.execSync('git stash', { cwd: REPO }); }
    cp.execSync('git fetch', { cwd: REPO, stdio: 'inherit' });
    cp.execSync('git pull --ff-only', { cwd: REPO, stdio: 'inherit' });
    if (dirty) { console.log('  git: restoring stash'); try { cp.execSync('git stash pop', { cwd: REPO }); } catch { console.log('  git: stash pop conflicted — resolve manually'); } }
  } catch (e) { console.log('  git pull failed: ' + e.message); }
}

// ---- hook wiring ----
const NODE_BIN = process.execPath.replace(/\\/g, '/');
function loadManifest() { try { return JSON.parse(fs.readFileSync(path.join(REPO, 'wire-manifest.json'), 'utf8')); } catch { return { batches: {} }; } }
function entryCommand(e) {
  const p = TARGET.replace(/\\/g, '/') + '/' + e.script;
  return e.runner === 'bash' ? `bash "${p}"` : `"${NODE_BIN}" "${p}"`;
}
function eventHasScript(settings, event, base) {
  return (settings.hooks?.[event] || []).some(g => (g.hooks || []).some(h => (h.command || '').includes(base)));
}
function ask(q) {
  return new Promise(res => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, a => { rl.close(); res(a.trim()); });
  });
}
const yesNo = (ans, def) => ans === '' ? def : /^y(es)?$/i.test(ans);

async function doWire(fromInstall) {
  if (NOWIRE) { if (!fromInstall) console.log('  --no-wire: skipping wiring'); return; }
  const man = loadManifest();
  const allKeys = Object.keys(man.batches);
  if (!allKeys.length) { console.log('  (no wire-manifest batches found)'); return; }

  let selected = [];
  const tty = !!process.stdin.isTTY;
  if (HOOKS_FLAG) {
    const want = HOOKS_FLAG.split(',').map(x => x.trim().toUpperCase()).filter(Boolean);
    selected = allKeys.filter(k => want.includes(k));
  } else if (WIRE) {
    selected = allKeys; // --wire without --hooks = all batches
  } else if (tty && !YES) {
    if (!yesNo(await ask('\n  Wire hooks into settings.json now? [y/N] '), false)) { console.log('  skipped wiring.'); return; }
    for (const k of allKeys) {
      const b = man.batches[k];
      const def = b.default !== false;
      const want = yesNo(await ask(`  Install Batch ${k} — ${b.label}? [${def ? 'Y/n' : 'y/N'}] `), def);
      if (want) selected.push(k);
    }
  } else {
    if (fromInstall) console.log('\n  hooks NOT wired (non-interactive). To wire: node claude-config.js wire --apply --hooks=A,B');
    return;
  }
  if (!selected.length) { console.log('  no batches selected — nothing wired.'); return; }

  const sp = path.join(TARGET, 'settings.json');
  let settings = {};
  try { settings = JSON.parse(fs.readFileSync(sp, 'utf8')); } catch { settings = {}; }
  settings.hooks = settings.hooks || {};

  const added = [], missingFiles = [];
  for (const k of selected) {
    for (const e of man.batches[k].entries) {
      const base = e.script.split('/').pop();
      if (!fs.existsSync(path.join(TARGET, e.script))) { missingFiles.push(e.script); continue; } // don't wire a hook whose file isn't deployed
      settings.hooks[e.event] = settings.hooks[e.event] || [];
      if (eventHasScript(settings, e.event, base)) continue; // idempotent
      const group = e.matcher ? { matcher: e.matcher, hooks: [] } : { hooks: [] };
      group.hooks.push({ type: 'command', command: entryCommand(e), ...(e.timeout ? { timeout: e.timeout } : {}) });
      settings.hooks[e.event].push(group);
      added.push(`${e.event} [${e.matcher || '-'}] ${base}`);
    }
  }

  console.log(`\n  wire (batches ${selected.join(',')}): ${added.length} entr${added.length === 1 ? 'y' : 'ies'} to add`);
  added.forEach(a => console.log('    + ' + a));
  if (!added.length) console.log('    (all selected hooks already wired — no change)');
  if (missingFiles.length) console.log('    skipped (file not deployed): ' + missingFiles.join(', '));
  if (APPLY) { fs.writeFileSync(sp, JSON.stringify(settings, null, 2) + '\n'); console.log('  settings.json updated.'); }
  else console.log('  (dry run — re-run with --apply to write settings.json)');
  const v = verifyHooks(); if (v) console.log(`  settings.json hooks: ${v.ref} refs, ${v.broken.length} broken`);
}

// ---- dispatch ----
(async () => {
  console.log(`claude-config: ${cmd}${APPLY ? '' : '  (DRY RUN — add --apply to write)'}`);
  console.log(`  repo   : ${REPO}`);
  console.log(`  target : ${TARGET}`);

  if (cmd === 'status') {
    const pin = readPin();
    console.log(`  pinned installed_sha : ${pin ? pin.installed_sha : '(none — never installed via claude-config)'}`);
    console.log(`  repo HEAD            : ${gitHead()}`);
    const c = classify();
    console.log(`\n  SAME=${c.same}  STALE=${c.stale}  MISSING=${c.missing}  ORPHAN=${c.orphans.length}`);
    if (c.stale) console.log('  stale e.g.: ' + c.staleL.slice(0, 8).join(', '));
    if (c.missing) console.log('  missing e.g.: ' + c.missL.slice(0, 8).join(', '));
    if (c.orphans.length) console.log('  orphan e.g.: ' + c.orphans.slice(0, 8).join(', '));
    const v = verifyHooks(); if (v) console.log(`  settings.json hooks: ${v.ref} refs, ${v.broken.length} broken`);
    const d = profileDrift('default');
    if (d) {
      console.log(`\n  profile (default): ${d.missing.length} missing, ${d.extra.length} unexpected`);
      d.missing.forEach(e => console.log(`    - missing    : ${e.event} ${e.command}`));
      d.extra.forEach(e => console.log(`    + unexpected : ${e.event} ${e.command}`));
      if (!d.missing.length && !d.extra.length) console.log('    live wiring matches profile.');
    }
    return;
  }

  if (cmd === 'install' || cmd === 'update') {
    doPull();
    const force = cmd === 'update';
    let added = 0, updated = 0, skipped = 0, protectedN = 0;
    for (const r of repoFiles()) {
      const res = deployFile(r, force);
      if (res === 'added' || res === 'would-add') added++;
      else if (res === 'updated' || res === 'would-update') updated++;
      else if (res === 'protected') protectedN++;
      else skipped++;
    }
    console.log(`\n  ${APPLY ? 'deployed' : 'would deploy'}: +${added} new, ~${updated} ${force ? 'overwritten' : '(existing skipped)'}, ${skipped} unchanged, ${protectedN} custom-protected`);

    if (cmd === 'update' && !NOCLEAN) {
      const { orphans } = classify();
      console.log(`\n  orphans (local-only, removed upstream): ${orphans.length}`);
      orphans.slice(0, 60).forEach(o => console.log('    - ' + o));
      if (APPLY) {
        let d = 0; for (const o of orphans) { try { fs.unlinkSync(path.join(TARGET, o)); d++; } catch {} }
        const ds = [...new Set(orphans.map(o => path.dirname(o)))].sort((a, b) => b.length - a.length);
        for (const dd of ds) { try { const full = path.join(TARGET, dd); if (fs.existsSync(full) && fs.readdirSync(full).length === 0) fs.rmdirSync(full); } catch {} }
        console.log(`  deleted ${d} orphan(s)`);
      } else if (orphans.length) console.log('  (dry run — would delete the above)');
    }

    const pin = writePin();
    console.log(`\n  pin: ${APPLY ? 'written' : 'would write'} .config-source.json @ ${pin.installed_sha ? pin.installed_sha.slice(0, 8) : '?'}`);
    await doWire(true);
    if (!APPLY) console.log('\n  DRY RUN. Re-run with --apply to make changes.');
    return;
  }

  if (cmd === 'wire') { await doWire(false); if (!APPLY) console.log('\n  DRY RUN. Re-run with --apply to write settings.json.'); return; }

  if (cmd === 'export-profile') {
    const entries = liveHookEntries();
    if (!entries) { console.log('  no settings.json found — nothing to export'); return; }
    const profile = {
      name: PROFILE_NAME,
      exported_at: new Date().toISOString(),
      source_sha: gitHead(),
      note: 'Allow-list of this machine\'s wired hooks (paths templatized to __CLAUDE_HOME__ / __NODE_BIN__ / __USER_HOME__). Exclusions = hooks absent from this list. Run `status` to see drift (missing or unexpected). Re-run export-profile after changing wiring, then commit to version it.',
      hooks: entries,
    };
    const dst = path.join(REPO, 'profiles', PROFILE_NAME + '.json');
    console.log(`  ${APPLY ? 'writing' : 'would write'} ${entries.length} hook entries -> profiles/${PROFILE_NAME}.json`);
    entries.forEach(e => console.log(`    ${e.event}${e.matcher ? ' [' + e.matcher + ']' : ''}  ${e.command}`));
    if (APPLY) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.writeFileSync(dst, JSON.stringify(profile, null, 2) + '\n'); console.log('  written.'); }
    else console.log('  (dry run — add --apply to write the profile)');
    return;
  }

  console.log(`unknown command: ${cmd}. Use: status | install | update | wire | export-profile`);
  process.exitCode = 1;
})();
