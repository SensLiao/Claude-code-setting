#!/usr/bin/env node
/**
 * claude-config.js — unified installer + updater for the Claude-code-setting repo.
 * Cross-platform (Windows PowerShell / cmd / Git Bash / macOS / Linux) — needs only Node.
 *
 *   node claude-config.js status              show install pin, repo HEAD, drift (read-only)
 *   node claude-config.js install [--apply]   first-time deploy (additive: never overwrite existing)
 *   node claude-config.js update  [--apply]   sync to repo (force-overwrite managed files) + clean orphans + re-pin
 *
 * Flags:
 *   --apply        actually write (default = DRY RUN — prints what it would do, changes nothing)
 *   --no-clean     (update) keep orphan files instead of deleting them
 *   --pull         (update) git fetch + autostash + pull --ff-only before syncing
 *   --target DIR   target dir (default: <home>/.claude)
 *
 * Never written or deleted: settings.json, .credentials.json, memory, projects, sessions,
 * tasks, history.jsonl, plugins, AND your custom files (from .config-source.json custom_files,
 * plus hooks/gitnexus/** and skills/{gitnexus*,learned}/**).
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');

const REPO = __dirname;
const args = process.argv.slice(2);
const cmd = args.find(a => !a.startsWith('-')) || 'status';
const has = f => args.includes(f);
const APPLY = has('--apply'), NOCLEAN = has('--no-clean'), PULL = has('--pull');
const tIdx = args.indexOf('--target');
const TARGET = tIdx >= 0 ? args[tIdx + 1] : path.join(os.homedir(), '.claude');

const SKIP = new Set(['install.ps1', 'install.sh', 'README.md', '.gitignore', '.gitattributes',
  'settings.example.json', '.git', '.github', '.claude', 'claude-config.js', 'claude-config.ps1']);
const PRESERVE = new Set(['.credentials.json', 'settings.json', 'settings.local.json',
  'memory', 'projects', 'sessions', 'tasks', 'history.jsonl', 'plugins']);
const MANAGED = ['agents', 'commands', 'skills', 'hooks', 'scripts', 'rules', 'docs', 'manifests',
  'schemas', 'templates', 'orchestrator-runtime', 'get-shit-done', 'workflows', 'mcp-servers', 'mcp-configs', 'tools'];
const TEXT = new Set(['.md', '.json', '.js', '.cjs', '.mjs', '.sh', '.ps1', '.py', '.yaml', '.yml', '.toml', '.txt', '.bak']);

// placeholder substitution (matches install.sh / install.ps1 intent)
const home = os.homedir();
const winp = s => s.replace(/\//g, '\\');
const toPosix = s => { let p = s.replace(/\\/g, '/'); const m = p.match(/^([A-Za-z]):(.*)$/); return m ? '/' + m[1].toLowerCase() + m[2] : p; };
const SUBST = {
  '__CLAUDE_HOME_JSON__': winp(TARGET).replace(/\\/g, '\\\\'),
  '__USER_HOME_JSON__': winp(home).replace(/\\/g, '\\\\'),
  '__CLAUDE_HOME_WIN__': winp(TARGET),
  '__USER_HOME_WIN__': winp(home),
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

function customExcludes() {
  const pin = readPin();
  return new Set((pin && pin.custom_files) ||
    ['hooks/block-no-verify.js', 'commands/typecheck.md', 'commands/format.md', 'commands/sync-config.md']);
}
function isUserOwned(r, custom) {
  return custom.has(r) || /^hooks\/gitnexus\//.test(r) || /^skills\/(gitnexus|learned)/.test(r);
}
function classify() {
  const files = repoFiles();
  let same = 0, stale = 0, missing = 0; const staleL = [], missL = [];
  for (const r of files) {
    const a = path.join(REPO, r), b = path.join(TARGET, r);
    if (!fs.existsSync(b)) { missing++; missL.push(r); continue; }
    if (Buffer.compare(fs.readFileSync(a), fs.readFileSync(b)) === 0) same++;
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
  const src = path.join(REPO, r), dst = path.join(TARGET, r);
  const exists = fs.existsSync(dst);
  if (exists && !force) return 'skip';
  if (!APPLY) return exists ? 'would-update' : 'would-add';
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (TEXT.has(path.extname(src).toLowerCase())) {
    let c = fs.readFileSync(src, 'utf8');
    for (const k of Object.keys(SUBST)) if (c.includes(k)) c = c.split(k).join(SUBST[k]);
    fs.writeFileSync(dst, c);
  } else fs.copyFileSync(src, dst);
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
    settings_merge: pin.settings_merge || 'hand-merged hooks; not managed by this script (preserved)',
    notes: 'settings.json / .credentials.json / memory / projects / sessions / tasks / plugins + custom_files are never written or deleted by claude-config.js.',
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
        const m = (h.command || '').match(/"([A-Za-z]:[\/\\][^"]+\.(?:js|cjs|sh))"/g);
        if (m) for (const q of m) { const p = q.replace(/"/g, ''); ref++; if (!fs.existsSync(p)) broken.push(`${ev}: ${p}`); }
      }
  return { ref, broken };
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
  process.exit(0);
}

if (cmd === 'install' || cmd === 'update') {
  doPull();
  const force = cmd === 'update';
  let added = 0, updated = 0, skipped = 0;
  for (const r of repoFiles()) {
    const res = deployFile(r, force);
    if (res === 'added' || res === 'would-add') added++;
    else if (res === 'updated' || res === 'would-update') updated++;
    else skipped++;
  }
  console.log(`\n  ${APPLY ? 'deployed' : 'would deploy'}: +${added} new, ~${updated} ${force ? 'overwritten' : '(existing skipped)'}, ${skipped} unchanged`);

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
  const v = verifyHooks();
  if (v) console.log(`  settings.json hooks: ${v.ref} refs, ${v.broken.length} broken` + (v.broken.length ? '\n    ' + v.broken.join('\n    ') : ''));
  if (!APPLY) console.log('\n  DRY RUN. Re-run with --apply to make changes.');
  process.exit(0);
}

console.log(`unknown command: ${cmd}. Use: status | install | update`);
process.exit(1);
