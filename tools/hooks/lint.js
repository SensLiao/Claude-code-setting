#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * tools/hooks/lint.js
 *
 * Hook registry consistency linter for the Claude Code harness.
 *
 * Verifies:
 *   1. manifests/hook-registry.json conforms to the basic shape we depend on
 *   2. Every command path referenced in ~/.claude/settings.json resolves to a real file on disk
 *   3. Every hook listed in `global_live.hooks` is referenced (by command_pattern) in settings.json
 *   4. Every hook listed in `project_installed.<subsystem>.hooks` is referenced in the
 *      corresponding subsystem snippet's `command` strings
 *   5. Every hook file actually on disk (under ~/.claude/hooks/ and templates/.../hooks/) is
 *      classified somewhere in the registry: global_live, project_installed, library_modules,
 *      dormant_opt_in, or deprecated. Anything else is reported as an orphan.
 *
 * Exit codes:
 *   0   all clean
 *   1   drift (missing reference, orphan, mismatch)
 *   2   structural / file-missing error (registry or settings absent)
 *
 * Uses Node built-ins only (path, fs, url, process). No npm deps.
 *
 * Usage:
 *   node tools/hooks/lint.js                # lint default ~/.claude/ install
 *   node tools/hooks/lint.js --root <dir>   # lint a different .claude/ root
 *   node tools/hooks/lint.js --quiet        # suppress per-OK lines
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { root: null, quiet: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--root' && i + 1 < argv.length) {
      args.root = argv[i + 1];
      i += 1;
    } else if (a === '--quiet' || a === '-q') {
      args.quiet = true;
    } else if (a === '--help' || a === '-h') {
      printUsage();
      process.exit(0);
    } else {
      console.error(`hooks/lint.js: unknown argument: ${a}`);
      printUsage();
      process.exit(2);
    }
  }
  if (!args.root) {
    args.root = path.join(os.homedir(), '.claude');
  }
  return args;
}

function printUsage() {
  console.error('Usage: node tools/hooks/lint.js [--root <claude-dir>] [--quiet]');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJsonSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return { ok: true, data: JSON.parse(stripJsonComments(raw)), raw };
  } catch (err) {
    return { ok: false, err };
  }
}

// Tolerant JSON reader — strips // and /* */ comments. snippet files include
// `_doc` keys but no actual comments, so this is mostly defensive.
function stripJsonComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function existsSync(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch (_e) {
    return false;
  }
}

// Walk a hooks object recursively and emit every hook entry that has a `command`
// field. Supports two shapes:
//   - Nested (settings.json):  hooks: { <Phase>: [ { matcher, hooks: [ { type, command, ... } ] }, ... ] }
//   - Flat (snippet files):    hooks: { <Phase>: [ { matcher, command, ... }, ... ] }
function collectCommandEntries(hooksObj) {
  const out = [];
  if (!hooksObj || typeof hooksObj !== 'object') return out;
  for (const phase of Object.keys(hooksObj)) {
    const phaseGroups = hooksObj[phase];
    if (!Array.isArray(phaseGroups)) continue;
    for (const group of phaseGroups) {
      if (!group || typeof group !== 'object') continue;
      const matcher = group.matcher || '*';
      // Flat shape: command lives directly on the group
      if (typeof group.command === 'string') {
        out.push({ phase, matcher, command: group.command });
      }
      // Nested shape: group has its own hooks: [{ type, command }] array
      const inner = Array.isArray(group.hooks) ? group.hooks : [];
      for (const entry of inner) {
        if (entry && typeof entry === 'object' && typeof entry.command === 'string') {
          out.push({ phase, matcher, command: entry.command });
        }
      }
    }
  }
  return out;
}

// Pull plausible file paths out of a command string. Looks for any token
// that ends in .js, .sh, .py, .cjs, .mjs and tolerates Windows-style
// backslashes, forward slashes, surrounding quotes, and ${CLAUDE_PROJECT_DIR}.
//
// Special case: `node -e "<inline body>"` commands embed entire JS bodies
// that frequently include string literals like 'scripts/hooks/foo.js'
// resolved at runtime by the wrapper. These are NOT file references the
// hook system invokes directly — they are plugin-cache resolution code
// inside an inline script. We strip the inline body before scanning.
function extractScriptPaths(command) {
  if (typeof command !== 'string' || !command) return [];

  // Strip inline node -e bodies so we don't mine paths from runtime JS.
  // The inline body is delimited by an opening "node -e \"" and the
  // matching closing escaped quote near end-of-command.
  let scanTarget = command;
  const nodeEMatch = scanTarget.match(/^\s*node\s+-e\s+"/);
  if (nodeEMatch) {
    // Drop everything after `node -e "` — the rest is the inline script
    // body, not a separate file-system reference.
    scanTarget = scanTarget.slice(0, nodeEMatch[0].length);
  }

  // Match optional opening quote, capture everything up to the extension.
  const re = /"?([A-Za-z]:[\\/][^"]*?\.(?:js|sh|cjs|mjs|py)|[^"\s]+?\.(?:js|sh|cjs|mjs|py))"?/g;
  const found = [];
  let m;
  while ((m = re.exec(scanTarget)) !== null) {
    const raw = m[1];
    if (!raw) continue;
    // Skip pure literal node.exe path; we only want script targets.
    if (/node\.exe$/i.test(raw)) continue;
    found.push(raw);
  }
  return found;
}

// Resolve a possibly-templated path against the claude root. Handles:
//   - ${CLAUDE_PROJECT_DIR} -> claudeRoot (best-effort; settings.json is
//     a "project" for harness-lint purposes)
//   - Mixed backslash/forward slash on Windows
//   - Absolute Windows paths (C:\Users\...) — used verbatim
function resolveCommandPath(rawPath, claudeRoot) {
  if (!rawPath) return null;
  let p = rawPath.trim().replace(/^"+|"+$/g, '');
  // settings.json sometimes uses ${CLAUDE_PROJECT_DIR} for project-relative
  // hooks. For our harness lint we treat the global claudeRoot as the
  // expansion target.
  p = p.replace(/\$\{CLAUDE_PROJECT_DIR\}/g, claudeRoot);
  // Normalize separators
  p = p.replace(/\\/g, '/');
  // Absolute? (Windows or POSIX)
  if (/^[A-Za-z]:\//.test(p) || p.startsWith('/')) {
    return path.normalize(p);
  }
  // Relative — anchor against claudeRoot
  return path.normalize(path.join(claudeRoot, p));
}

function listFilesRecursive(dir, predicate) {
  const out = [];
  if (!existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch (_e) {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) {
        stack.push(full);
      } else if (ent.isFile()) {
        if (!predicate || predicate(full)) out.push(full);
      }
    }
  }
  return out;
}

function relativize(p, root) {
  const norm = path.normalize(p).replace(/\\/g, '/');
  const rootNorm = path.normalize(root).replace(/\\/g, '/');
  if (norm.toLowerCase().startsWith(rootNorm.toLowerCase())) {
    return norm.slice(rootNorm.length).replace(/^\/+/, '');
  }
  return norm;
}

function basenameNoExt(p) {
  const base = path.basename(p);
  return base.replace(/\.(js|sh|cjs|mjs|py)$/i, '');
}

// ---------------------------------------------------------------------------
// Main lint
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv);
  const claudeRoot = path.normalize(args.root);
  const verbose = !args.quiet;

  const findings = []; // { level: 'error' | 'warn', message }
  let exitCode = 0;

  const registryPath = path.join(claudeRoot, 'manifests', 'hook-registry.json');
  const settingsPath = path.join(claudeRoot, 'settings.json');

  // --- 1. Required files exist -----------------------------------------
  let registry = null;
  if (!existsSync(registryPath)) {
    findings.push({
      level: 'error',
      message: `manifests/hook-registry.json not found at ${registryPath}`,
    });
    exitCode = 2;
  } else {
    const r = readJsonSafe(registryPath);
    if (!r.ok) {
      findings.push({
        level: 'error',
        message: `Failed to parse hook-registry.json: ${r.err.message}`,
      });
      exitCode = 2;
    } else {
      registry = r.data;
    }
  }

  let settings = null;
  if (!existsSync(settingsPath)) {
    findings.push({
      level: 'error',
      message: `settings.json not found at ${settingsPath}`,
    });
    exitCode = 2;
  } else {
    const r = readJsonSafe(settingsPath);
    if (!r.ok) {
      findings.push({
        level: 'error',
        message: `Failed to parse settings.json: ${r.err.message}`,
      });
      exitCode = 2;
    } else {
      settings = r.data;
    }
  }

  if (exitCode === 2 || !registry || !settings) {
    report(findings, verbose, claudeRoot);
    process.exit(exitCode || 2);
  }

  // --- Registry traversal: tolerate both flat shape (registry.global_live)
  //     and categorized shape (registry.categories.global_live). A2 wrote
  //     the JSON under a `categories` wrapper per the schema A3 also wrote,
  //     so prefer the categorized shape and fall back to the flat shape for
  //     backward compatibility. -------------------------------------------
  const categories = (registry && typeof registry === 'object' && registry.categories && typeof registry.categories === 'object')
    ? registry.categories
    : registry;

  // --- External-plugin scope filter ------------------------------------
  // Some commands in settings.json reference scripts owned by ECC plugins
  // installed under a different root (e.g. continuous-learning-v2). Those
  // files do NOT live under ~/.claude/ on disk; treating them as drift
  // produces a false positive. Classify by path pattern and downgrade to
  // INFO (no exit code impact).
  function isExternalPluginScope(sp) {
    if (typeof sp !== 'string') return false;
    const norm = sp.replace(/\\/g, '/');
    if (/(^|\/)skills\/continuous-learning-v2\//.test(norm)) return true;
    // Also flag any skill-owned observe.* hook pattern; these belong to the
    // owning skill's plugin install, not the host ~/.claude/hooks/.
    if (/(^|\/)skills\/[^/]+\/hooks\/observe\.[a-z]+$/i.test(norm)) return true;
    return false;
  }

  // --- 2. Verify every settings.json command path resolves -------------
  const settingsCommands = collectCommandEntries(settings.hooks || {});
  if (verbose) console.log(`Inspecting ${settingsCommands.length} command entries in settings.json...`);

  let externalPluginRefs = 0;
  for (const ce of settingsCommands) {
    const scripts = extractScriptPaths(ce.command);
    if (scripts.length === 0) {
      // e.g. `npx block-no-verify@1.1.2` — nothing to file-check, skip
      continue;
    }
    for (const sp of scripts) {
      const resolved = resolveCommandPath(sp, claudeRoot);
      if (!resolved) continue;
      if (!existsSync(resolved)) {
        if (isExternalPluginScope(sp)) {
          // INFO: external plugin install scope. Not drift.
          externalPluginRefs += 1;
          if (verbose) {
            console.log(`  INFO  external_plugin_scope: ${sp}  [${ce.phase}/${ce.matcher}]`);
          }
          continue;
        }
        findings.push({
          level: 'error',
          message: `settings.json [${ce.phase}/${ce.matcher}]: command references missing file -> ${sp}\n      resolved: ${resolved}`,
        });
        exitCode = exitCode === 2 ? 2 : 1;
      }
    }
  }

  // --- 3. Verify every global_live hook is referenced in settings.json -
  const globalLive = categories.global_live || {};
  const globalLiveHooks = Array.isArray(globalLive.hooks) ? globalLive.hooks : [];

  // Include the top-level `statusLine.command` so statusline hooks
  // (e.g. gsd-statusline.js) are recognized as live. statusLine is a
  // separate top-level config key, not nested under settings.hooks.
  const statusLineCmd = (settings && settings.statusLine && typeof settings.statusLine.command === 'string')
    ? settings.statusLine.command
    : '';
  const allSettingsCommandStrings = settingsCommands.map((c) => c.command).concat([statusLineCmd]).join('\n');

  for (const h of globalLiveHooks) {
    const pattern = h.command_pattern || h.name;
    if (!pattern) {
      findings.push({
        level: 'error',
        message: `global_live hook entry missing both name and command_pattern: ${JSON.stringify(h)}`,
      });
      exitCode = exitCode === 2 ? 2 : 1;
      continue;
    }
    if (!allSettingsCommandStrings.includes(pattern)) {
      findings.push({
        level: 'error',
        message: `global_live hook '${h.name}' declared as live but command_pattern '${pattern}' not found in settings.json`,
      });
      exitCode = exitCode === 2 ? 2 : 1;
    }
  }

  // --- 4. Verify every project_installed.<subsystem>.hooks is referenced
  //         in the corresponding subsystem snippet --------------------
  // Categorized shape: registry.categories.project_installed.subsystems.<name>
  // Flat shape:        registry.project_installed.<name>
  const projInstalledRoot = categories.project_installed || {};
  const projInstalled = (projInstalledRoot && typeof projInstalledRoot.subsystems === 'object')
    ? projInstalledRoot.subsystems
    : projInstalledRoot;
  for (const subsystem of Object.keys(projInstalled)) {
    const entry = projInstalled[subsystem];
    if (!entry || typeof entry !== 'object') continue;
    // Skip non-subsystem siblings (description, scope, etc.) that don't
    // declare a `hooks` array — only true subsystem entries have a snippet.
    if (!Array.isArray(entry.hooks)) continue;
    const snippetRel = entry.snippet_path;
    if (!snippetRel) {
      findings.push({
        level: 'error',
        message: `project_installed.${subsystem}: missing snippet_path`,
      });
      exitCode = exitCode === 2 ? 2 : 1;
      continue;
    }
    const snippetAbs = path.isAbsolute(snippetRel)
      ? snippetRel
      : path.join(claudeRoot, snippetRel);
    if (!existsSync(snippetAbs)) {
      findings.push({
        level: 'error',
        message: `project_installed.${subsystem}: snippet not found at ${snippetAbs}`,
      });
      exitCode = exitCode === 2 ? 2 : 1;
      continue;
    }
    const snippetRead = readJsonSafe(snippetAbs);
    if (!snippetRead.ok) {
      findings.push({
        level: 'error',
        message: `project_installed.${subsystem}: failed to parse snippet ${snippetAbs}: ${snippetRead.err.message}`,
      });
      exitCode = exitCode === 2 ? 2 : 1;
      continue;
    }
    const snippetCommands = collectCommandEntries(snippetRead.data.hooks || {}).map((c) => c.command).join('\n');
    const declared = Array.isArray(entry.hooks) ? entry.hooks : [];
    for (const h of declared) {
      const pattern = h.command_pattern || h.name;
      if (!pattern) {
        findings.push({
          level: 'error',
          message: `project_installed.${subsystem}: hook entry missing name and command_pattern`,
        });
        exitCode = exitCode === 2 ? 2 : 1;
        continue;
      }
      if (!snippetCommands.includes(pattern)) {
        findings.push({
          level: 'error',
          message: `project_installed.${subsystem}: hook '${h.name}' not referenced in snippet ${snippetRel} (looking for '${pattern}')`,
        });
        exitCode = exitCode === 2 ? 2 : 1;
      }
      // Also check the file actually exists on disk if path is declared
      if (h.path) {
        const resolved = path.isAbsolute(h.path) ? h.path : path.join(claudeRoot, h.path);
        if (!existsSync(resolved)) {
          findings.push({
            level: 'error',
            message: `project_installed.${subsystem}: hook '${h.name}' path missing on disk -> ${resolved}`,
          });
          exitCode = exitCode === 2 ? 2 : 1;
        }
      }
    }
  }

  // --- 5. Orphan detection: every .js/.sh under hooks/ and
  //         templates/<subsystem>/hooks/ must be classified --------------
  const hookFileExtensions = /\.(js|sh|cjs|mjs)$/i;
  const isHookSource = (f) => hookFileExtensions.test(f);

  const globalHooksDir = path.join(claudeRoot, 'hooks');
  const templatesDir = path.join(claudeRoot, 'templates');

  const candidates = [];
  candidates.push(...listFilesRecursive(globalHooksDir, isHookSource));
  // Only scan templates/<subsystem>/hooks/ — not arbitrary template files
  if (existsSync(templatesDir)) {
    let subEntries;
    try {
      subEntries = fs.readdirSync(templatesDir, { withFileTypes: true });
    } catch (_e) {
      subEntries = [];
    }
    for (const ent of subEntries) {
      if (ent.isDirectory()) {
        const hookSub = path.join(templatesDir, ent.name, 'hooks');
        candidates.push(...listFilesRecursive(hookSub, isHookSource));
      }
    }
  }

  // Helper: add a hook name to classifiedNames in both raw and stem form so
  // orphan detection (which uses basenameNoExt on disk files) matches even
  // when the registry stores entries with their .js/.sh extension.
  function addHookClassified(set, name) {
    if (typeof name !== 'string' || !name) return;
    set.add(name);
    set.add(basenameNoExt(name));
  }

  const classifiedNames = new Set();
  for (const h of globalLiveHooks) {
    addHookClassified(classifiedNames, h.name);
    if (h.path) addHookClassified(classifiedNames, basenameNoExt(h.path));
  }
  for (const subsystem of Object.keys(projInstalled)) {
    const entry = projInstalled[subsystem];
    if (!entry) continue;
    const declared = Array.isArray(entry.hooks) ? entry.hooks : [];
    for (const h of declared) {
      addHookClassified(classifiedNames, h.name);
      if (h.path) addHookClassified(classifiedNames, basenameNoExt(h.path));
    }
  }
  // Library modules: both flat `registry.library_modules` (array of strings)
  // and categorized `registry.categories.library_modules.modules` (array of
  // { name, used_by }) are supported.
  const libRoot = categories.library_modules || {};
  const libList = Array.isArray(libRoot)
    ? libRoot
    : (Array.isArray(libRoot.modules) ? libRoot.modules : []);
  for (const libEntry of libList) {
    if (typeof libEntry === 'string') {
      addHookClassified(classifiedNames, libEntry);
    } else if (libEntry && typeof libEntry === 'object' && libEntry.name) {
      addHookClassified(classifiedNames, libEntry.name);
    }
  }
  // Dormant opt-in: flat `registry.dormant_opt_in` array OR categorized
  // `registry.categories.dormant_opt_in.entries`.
  const dormantRoot = categories.dormant_opt_in || {};
  const dormantList = Array.isArray(dormantRoot)
    ? dormantRoot
    : (Array.isArray(dormantRoot.entries) ? dormantRoot.entries : []);
  for (const d of dormantList) {
    if (typeof d === 'string') addHookClassified(classifiedNames, d);
    else if (d && d.name) addHookClassified(classifiedNames, d.name);
  }
  // Deprecated: flat `registry.deprecated` array OR categorized
  // `registry.categories.deprecated.entries`.
  const deprecatedRoot = categories.deprecated || {};
  const deprecatedList = Array.isArray(deprecatedRoot)
    ? deprecatedRoot
    : (Array.isArray(deprecatedRoot.entries) ? deprecatedRoot.entries : []);
  for (const name of deprecatedList) {
    if (typeof name === 'string') addHookClassified(classifiedNames, name);
    else if (name && name.name) addHookClassified(classifiedNames, name.name);
  }

  // Helper: a file on disk counts as classified if its bare stem is in the
  // set OR if it's a recognized companion of a classified hook (e.g.
  // `gsd-check-update-worker.js` is the worker spawned by the classified
  // `gsd-check-update.js`).
  function isWorkerCompanion(stem) {
    const m = stem.match(/^(.+)-worker$/i);
    if (!m) return null;
    const parent = m[1];
    if (classifiedNames.has(parent) || classifiedNames.has(`${parent}.js`)) {
      return parent;
    }
    return null;
  }

  const orphans = [];
  for (const f of candidates) {
    const stem = basenameNoExt(f);
    if (classifiedNames.has(stem)) continue;
    const parent = isWorkerCompanion(stem);
    if (parent) {
      if (verbose) {
        console.log(`  INFO  worker_companion: ${relativize(f, claudeRoot)}  (parent: ${parent})`);
      }
      continue;
    }
    orphans.push(relativize(f, claudeRoot));
  }
  if (orphans.length > 0) {
    for (const o of orphans) {
      findings.push({
        level: 'error',
        message: `Orphan hook file (not classified in hook-registry.json): ${o}`,
      });
    }
    exitCode = exitCode === 2 ? 2 : 1;
  }

  // --- Report ---------------------------------------------------------
  report(findings, verbose, claudeRoot, {
    settingsCommands: settingsCommands.length,
    globalLive: globalLiveHooks.length,
    projectInstalledSubsystems: Object.keys(projInstalled).filter((k) => Array.isArray(projInstalled[k] && projInstalled[k].hooks)).length,
    candidatesScanned: candidates.length,
    orphans: orphans.length,
    externalPluginRefs,
  });

  process.exit(exitCode);
}

function report(findings, verbose, claudeRoot, summary) {
  const errors = findings.filter((f) => f.level === 'error');
  const warns = findings.filter((f) => f.level === 'warn');

  if (verbose && summary) {
    console.log('--- hook-registry lint summary ---');
    console.log(`claude_root:                ${claudeRoot}`);
    console.log(`settings commands scanned:  ${summary.settingsCommands}`);
    console.log(`global_live hooks declared: ${summary.globalLive}`);
    console.log(`subsystems w/ project hooks:${summary.projectInstalledSubsystems}`);
    console.log(`hook files on disk scanned: ${summary.candidatesScanned}`);
    console.log(`orphans:                    ${summary.orphans}`);
    if (typeof summary.externalPluginRefs === 'number') {
      console.log(`external plugin refs:       ${summary.externalPluginRefs}  (info, not drift)`);
    }
    console.log('');
  }

  if (errors.length === 0 && warns.length === 0) {
    if (verbose) console.log('hook-registry lint: OK (no drift)');
    return;
  }

  for (const w of warns) console.warn(`WARN  ${w.message}`);
  for (const e of errors) console.error(`ERROR ${e.message}`);

  console.error('');
  console.error(`hook-registry lint: ${errors.length} error(s), ${warns.length} warning(s)`);
}

main();
