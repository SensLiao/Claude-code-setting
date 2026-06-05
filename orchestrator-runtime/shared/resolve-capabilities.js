#!/usr/bin/env node
/**
 * shared/resolve-capabilities.js — Capability resolver for orchestrator preflight.
 *
 * Purpose
 * -------
 * Shared resolver module called from `<domain>/tests/preflight-check.sh` to verify
 * that every capability a workflow spec references (agents, hooks, SDK, skills,
 * embedded skill contracts, model aliases) actually exists with the correct
 * identity and is reachable. Returns structured JSON; never spends a token.
 *
 * Provenance
 * ----------
 * Built per ORCHESTRATION-MIGRATION-PLAN.md §1.11 correction #6 + QA Phase B
 * blueprint §23 D2 lock (2026-05-28). Extracted from inlined logic in
 * `~/.claude/orchestrator-runtime/appsec/tests/preflight-check.sh` so QA / UIUX /
 * GSD / L12 preflight scripts can call the same resolver instead of re-inlining.
 *
 * Subcommands
 * -----------
 *   resolve-agents              <spec.json> <project-root>
 *   resolve-hooks               <registry.json> <project-root> <execution-mode> <mode>
 *   resolve-skills              <names-csv> [<project-root>]
 *   resolve-embedded-skill-contracts <names-csv> <parent-skill-md-path>
 *   resolve-sdk                 <registry.json> <sdk-name>
 *   resolve-model-aliases       <registry.json> <spec.json>
 *
 * Each subcommand prints a single JSON object to stdout:
 *   { ok: bool, found: [...], missing: [...], notes: [...] }
 *
 * Exit codes (per ORCHESTRATION-MIGRATION-PLAN.md §1.11 #17 shared exit-code contract)
 *   0 — all checks passed (found.length > 0, missing.length === 0)
 *   1 — internal error (FS / parse / unexpected)
 *   2 — missing capability (at least one item in missing[])
 *   3 — invalid input (bad CLI args / unreadable spec / unreadable registry)
 *
 * Design discipline
 * -----------------
 * - Pure Node stdlib only (fs, path, os, child_process). No npm deps.
 * - No network. No mutations outside stdout/stderr/exit-code.
 * - Tolerates YAML frontmatter quoting variants (`name: foo`, `name: "foo"`, `name: 'foo'`).
 * - Tolerates `~/...` paths via `resolveTilde`.
 * - Per Claude Code subagent docs: identity is `name:` frontmatter, NOT filename.
 * - Per Claude Code hook docs: effective settings = local > project > user (precedence).
 * - Per blueprint §23 D3: `skills` = real loadable SKILL.md; `embedded_skill_contracts`
 *   = anchor refs inside parent SKILL.md (verified by grep, NOT by file presence).
 *
 * Caller pattern (preflight-check.sh)
 * -----------------------------------
 *     node ~/.claude/orchestrator-runtime/shared/resolve-capabilities.js \
 *         resolve-agents path/to/spec.json /path/to/project
 *     # → exit 0 + JSON {ok:true, found:[...]}, OR exit 2 + JSON {ok:false, missing:[...]}
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ───────────────────────── helpers ─────────────────────────

function resolveTilde(p) {
  if (typeof p !== 'string') return p;
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  if (p === '~') return os.homedir();
  return p;
}

function readJSON(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function readJSONOrNull(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return readJSON(filePath);
  } catch {
    return null;
  }
}

function readJSONFromStdin() {
  const raw = fs.readFileSync(0, 'utf8');
  return JSON.parse(raw);
}

function parseFrontmatter(content) {
  // Minimal YAML frontmatter parser tolerant to quoted/unquoted values.
  // Recognises `key: value`, `key: "value"`, `key: 'value'`, and list-style `key:\n  - item`.
  // Returns { fields: {key: value | [values]}, ok: bool, body_start_line: int }
  const lines = content.split(/\r?\n/);
  if (lines[0] !== '---') return { fields: {}, ok: false, body_start_line: 0 };

  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') { end = i; break; }
  }
  if (end < 0) return { fields: {}, ok: false, body_start_line: 0 };

  const fields = {};
  let currentList = null;
  let currentKey = null;
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;

    const listMatch = line.match(/^\s*-\s+(.+)$/);
    if (listMatch && currentList !== null) {
      currentList.push(unquote(listMatch[1].trim()));
      continue;
    }

    const kvMatch = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!kvMatch) continue;
    const [, key, rawVal] = kvMatch;
    const val = rawVal.trim();
    if (val === '' || val === '|' || val === '>') {
      // List or block scalar start
      currentKey = key;
      currentList = [];
      fields[key] = currentList;
    } else {
      fields[key] = unquote(val);
      currentList = null;
      currentKey = null;
    }
  }
  return { fields, ok: true, body_start_line: end + 1 };
}

function unquote(s) {
  if (typeof s !== 'string') return s;
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = tmp;
    }
  }
  return dp[n];
}

function suggestClosest(target, candidates, maxDist = 3) {
  let best = null, bestDist = Infinity;
  for (const c of candidates) {
    const d = levenshtein(target, c);
    if (d < bestDist) { best = c; bestDist = d; }
  }
  return (best !== null && bestDist <= maxDist) ? best : null;
}

function listFiles(dir, pattern) {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => pattern.test(f))
      .map(f => path.join(dir, f));
  } catch {
    return [];
  }
}

function emitAndExit(payload, exitCode) {
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  process.exit(exitCode);
}

function emitErrorAndExit(stage, message, exitCode = 1) {
  process.stderr.write(`[resolve-capabilities ${stage}] ${message}\n`);
  process.exit(exitCode);
}

// ────────────── effectiveSettings (project > user merged) ──────────────

function loadEffectiveSettings(projectRoot) {
  // Per Claude Code hook docs: settings precedence local > project > user.
  // We MERGE by hook command-string presence across all 3 layers; downstream
  // we only care whether a hook command path is referenced ANYWHERE (so we union).
  const layers = [
    {
      scope: 'user',
      path: path.join(os.homedir(), '.claude', 'settings.json'),
    },
    {
      scope: 'project',
      path: path.join(projectRoot, '.claude', 'settings.json'),
    },
    {
      scope: 'local',
      path: path.join(projectRoot, '.claude', 'settings.local.json'),
    },
  ];
  const merged = {
    hookCommandsByScope: { user: [], project: [], local: [] },
    rawByScope: {},
  };
  for (const layer of layers) {
    const data = readJSONOrNull(layer.path);
    if (!data) {
      merged.rawByScope[layer.scope] = null;
      continue;
    }
    merged.rawByScope[layer.scope] = data;
    const hooks = data.hooks || {};
    for (const eventList of Object.values(hooks)) {
      if (!Array.isArray(eventList)) continue;
      for (const matcherEntry of eventList) {
        const hookArr = matcherEntry?.hooks || [];
        for (const h of hookArr) {
          if (typeof h?.command === 'string') {
            merged.hookCommandsByScope[layer.scope].push(h.command);
          }
        }
      }
    }
  }
  return merged;
}

// ────────────── subcommand: resolve-agents ──────────────

function resolveAgents(specPath, projectRoot) {
  let spec;
  try {
    spec = (specPath === '-' || !specPath) ? readJSONFromStdin() : readJSON(specPath);
  } catch (e) {
    emitErrorAndExit('resolve-agents', `cannot read/parse spec: ${e.message}`, 3);
  }

  // Extract all agentType references (phases + nested stages)
  const wanted = new Set();
  for (const p of (spec.phases || [])) {
    if (p.agentType) wanted.add(p.agentType);
    for (const st of (p.stages || [])) {
      if (st.agentType) wanted.add(st.agentType);
    }
  }

  // Scan candidate directories (precedence: project > user)
  const userAgentsDir = path.join(os.homedir(), '.claude', 'agents');
  const projectAgentsDir = path.join(projectRoot, '.claude', 'agents');

  const userFiles = listFiles(userAgentsDir, /\.md$/);
  const projectFiles = listFiles(projectAgentsDir, /\.md$/);

  // Build name → {file, layer} map; project wins.
  const nameMap = {};
  for (const f of userFiles) {
    try {
      const fm = parseFrontmatter(fs.readFileSync(f, 'utf8')).fields;
      if (fm.name && !nameMap[fm.name]) {
        nameMap[fm.name] = {
          source_file: f,
          layer: 'user',
          model: fm.model || null,
          tools: typeof fm.tools === 'string' ? fm.tools : (fm.tools || null),
          description: fm.description || null,
        };
      }
    } catch { /* skip unreadable file */ }
  }
  for (const f of projectFiles) {
    try {
      const fm = parseFrontmatter(fs.readFileSync(f, 'utf8')).fields;
      if (fm.name) {
        // Project precedence: overwrite even if user already had it
        nameMap[fm.name] = {
          source_file: f,
          layer: 'project',
          model: fm.model || null,
          tools: typeof fm.tools === 'string' ? fm.tools : (fm.tools || null),
          description: fm.description || null,
        };
      }
    } catch { /* skip */ }
  }

  const candidates = Object.keys(nameMap);
  const found = [];
  const missing = [];
  for (const want of wanted) {
    if (nameMap[want]) {
      found.push({ name: want, ...nameMap[want] });
    } else {
      const did_you_mean = suggestClosest(want, candidates, 3);
      missing.push({
        name: want,
        did_you_mean,
        hint: `no .md file with frontmatter \`name: ${want}\` under ~/.claude/agents/ or ${projectAgentsDir}${did_you_mean ? ` — did you mean "${did_you_mean}"?` : ''}`,
      });
    }
  }

  emitAndExit(
    {
      ok: missing.length === 0,
      subcommand: 'resolve-agents',
      total_candidates: candidates.length,
      requested: [...wanted],
      found,
      missing,
      notes: [],
    },
    missing.length === 0 ? 0 : 2,
  );
}

// ────────────── subcommand: resolve-hooks ──────────────

function resolveHooks(registryPath, projectRoot, executionMode, currentMode) {
  let registry;
  try {
    registry = readJSON(registryPath);
  } catch (e) {
    emitErrorAndExit('resolve-hooks', `cannot read registry: ${e.message}`, 3);
  }

  const settings = loadEffectiveSettings(projectRoot);
  const hooks = registry.hooks || {};
  const found = [];
  const missing = [];
  const notes = [];

  // Helper: search for hook command in effective settings.
  function findInstalledScope(hookKey) {
    // Match by file basename — registry stores `path` like "~/.claude/hooks/<name>.js"
    const basename = `${hookKey}.js`;
    for (const scope of ['local', 'project', 'user']) {
      for (const cmd of settings.hookCommandsByScope[scope]) {
        if (cmd.includes(basename)) return scope;
      }
    }
    return null;
  }

  // Per-mode enforcement matrix (blueprint §22.1 R12).
  // Caller passes `currentMode` (e.g. "quick-check" / "focused-qa-gate" / "release-readiness" / "commercial-cert").
  // Each registry hook may declare `enforcement: {<mode>: "block"|"warn"|"skip"}` OR
  // fall back to fail_policy / hook_class default:
  //   launch_gate      → always block
  //   safety_guard     → block in {release-readiness, commercial-cert}; warn elsewhere
  //   evidence_quality → block in release-readiness/commercial-cert; warn in quick/focused
  function effectiveEnforcement(entry, mode) {
    if (entry.enforcement && entry.enforcement[mode]) return entry.enforcement[mode];
    const klass = entry.hook_class || 'evidence_quality';
    if (klass === 'launch_gate') return 'block';
    if (klass === 'safety_guard') {
      return ['release-readiness', 'commercial-cert'].includes(mode) ? 'block' : 'warn';
    }
    return ['release-readiness', 'commercial-cert'].includes(mode) ? 'block' : 'warn';
  }

  for (const [name, entry] of Object.entries(hooks)) {
    // Required-when gating
    let requiredHere = entry.required === true;
    if (!requiredHere && typeof entry.required_when === 'string') {
      // Simple required_when language: "execution_mode == 'workflow-spec'"
      const rw = entry.required_when;
      if (rw.includes("execution_mode == 'workflow-spec'") && executionMode === 'workflow-spec') {
        requiredHere = true;
      }
    }

    if (!requiredHere) continue;

    const enforcement = effectiveEnforcement(entry, currentMode);
    const installedScope = findInstalledScope(name);

    // Launch-gate hooks MUST be project scope per §1.11 #7.
    if (entry.hook_class === 'launch_gate' && entry.install_scope === 'project' && installedScope && installedScope !== 'project') {
      missing.push({
        name,
        hook_class: entry.hook_class,
        expected_install_scope: 'project',
        actual_install_scope: installedScope,
        hint: `${name} is a launch_gate hook and MUST be installed at project scope (in <project>/.claude/settings.json), not ${installedScope}.`,
      });
      continue;
    }

    if (!installedScope) {
      // Decide block vs warn based on enforcement
      if (enforcement === 'block') {
        missing.push({
          name,
          hook_class: entry.hook_class || null,
          fail_policy: entry.fail_policy || null,
          expected_install_scope: entry.install_scope || 'project_or_user',
          enforcement_for_mode: enforcement,
          mode: currentMode,
          hint: `hook "${name}" not referenced in any effective settings.json (user/project/local). Run the domain SDK init to install.`,
        });
      } else {
        notes.push({
          name,
          enforcement_for_mode: enforcement,
          mode: currentMode,
          message: `hook "${name}" not installed; enforcement="${enforcement}" in mode="${currentMode}" — warning, not blocking.`,
        });
      }
    } else {
      found.push({
        name,
        hook_class: entry.hook_class || null,
        install_scope_actual: installedScope,
        enforcement_for_mode: enforcement,
      });
    }
  }

  emitAndExit(
    {
      ok: missing.length === 0,
      subcommand: 'resolve-hooks',
      mode: currentMode,
      execution_mode: executionMode,
      found,
      missing,
      notes,
    },
    missing.length === 0 ? 0 : 2,
  );
}

// ────────────── subcommand: resolve-skills (loadable SKILL.md only) ──────────────

function resolveSkills(namesCsv, projectRoot) {
  const names = (namesCsv || '').split(',').map(s => s.trim()).filter(Boolean);
  const userSkillsDir = path.join(os.homedir(), '.claude', 'skills');
  const projectSkillsDir = path.join(projectRoot, '.claude', 'skills');
  const found = [];
  const missing = [];
  for (const n of names) {
    const candidates = [
      path.join(projectSkillsDir, n, 'SKILL.md'),
      path.join(userSkillsDir, n, 'SKILL.md'),
    ];
    const hit = candidates.find(p => fs.existsSync(p));
    if (hit) {
      found.push({ name: n, source_file: hit, layer: hit.startsWith(projectSkillsDir) ? 'project' : 'user' });
    } else {
      missing.push({
        name: n,
        hint: `no SKILL.md found at any of: ${candidates.join(' | ')}. If this skill is embedded in a parent SKILL.md, use resolve-embedded-skill-contracts instead.`,
      });
    }
  }
  emitAndExit(
    { ok: missing.length === 0, subcommand: 'resolve-skills', requested: names, found, missing, notes: [] },
    missing.length === 0 ? 0 : 2,
  );
}

// ────────────── subcommand: resolve-embedded-skill-contracts (D3) ──────────────

function resolveEmbeddedSkillContracts(namesCsv, parentSkillPath) {
  const names = (namesCsv || '').split(',').map(s => s.trim()).filter(Boolean);
  const expanded = resolveTilde(parentSkillPath);
  if (!fs.existsSync(expanded)) {
    emitErrorAndExit('resolve-embedded-skill-contracts', `parent skill not found: ${expanded}`, 3);
  }
  let content;
  try {
    content = fs.readFileSync(expanded, 'utf8');
  } catch (e) {
    emitErrorAndExit('resolve-embedded-skill-contracts', `cannot read parent skill: ${e.message}`, 1);
  }

  // Embedded skill contracts are referenced either in frontmatter `children:` or
  // in body anchors like `→ \`<name>\`` / `qa-<name>` headings. We grep with a
  // permissive pattern: name appears as a standalone token at least once.
  const found = [];
  const missing = [];
  for (const n of names) {
    // Build a regex that matches the name as a standalone identifier (token bound by non-word chars).
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^A-Za-z0-9_-])${escaped}([^A-Za-z0-9_-]|$)`, 'm');
    const lines = content.split(/\r?\n/);
    let firstHit = -1;
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) { firstHit = i + 1; break; }
    }
    if (firstHit > 0) {
      found.push({ name: n, anchor_file: expanded, anchor_line: firstHit, anchor_text: lines[firstHit - 1].trim() });
    } else {
      missing.push({
        name: n,
        anchor_file: expanded,
        hint: `embedded skill contract "${n}" not referenced anywhere in parent SKILL.md. Either add an anchor (children: / heading / mention) or write a real SKILL.md and resolve via resolve-skills.`,
      });
    }
  }
  emitAndExit(
    { ok: missing.length === 0, subcommand: 'resolve-embedded-skill-contracts', parent_skill: expanded, requested: names, found, missing, notes: [] },
    missing.length === 0 ? 0 : 2,
  );
}

// ────────────── subcommand: resolve-sdk ──────────────

function resolveSDK(registryPath, sdkName) {
  let registry;
  try { registry = readJSON(registryPath); }
  catch (e) { emitErrorAndExit('resolve-sdk', `cannot read registry: ${e.message}`, 3); }

  const entry = (registry.sdk || {})[sdkName];
  if (!entry) {
    emitAndExit(
      { ok: false, subcommand: 'resolve-sdk', missing: [{ name: sdkName, hint: `registry.sdk["${sdkName}"] not declared` }], found: [], notes: [] },
      2,
    );
  }
  const expandedPath = resolveTilde(entry.path);
  const missing = [];
  const notes = [];
  const found = [];

  if (!fs.existsSync(expandedPath)) {
    missing.push({ name: sdkName, path: entry.path, hint: `file does not exist at ${expandedPath}` });
  } else {
    let isExec = false;
    try {
      const st = fs.statSync(expandedPath);
      // On Windows we can't reliably check exec bit; assume true if file readable.
      isExec = process.platform === 'win32' || ((st.mode & 0o111) !== 0);
    } catch { /* ignore */ }
    if (!isExec) {
      missing.push({ name: sdkName, path: entry.path, hint: `not executable — chmod +x ${expandedPath}` });
    } else if (entry.smoke_command) {
      // Cross-platform bash discovery: try common bash locations + PATH lookup.
      // smoke_command may use `~/`, pipelines (`| head`), or invoke `bash`.
      const homeForwardSlash = os.homedir().replace(/\\/g, '/');
      const smokeExpanded = entry.smoke_command.replace(/~\//g, homeForwardSlash + '/');
      const bashCandidates = process.platform === 'win32'
        ? ['bash', 'C:\\Program Files\\Git\\bin\\bash.exe', '/usr/bin/bash']
        : ['/bin/bash', '/usr/bin/bash', 'bash'];
      let ranOk = false;
      let lastErr = null;
      for (const bashExec of bashCandidates) {
        try {
          execSync(smokeExpanded, { stdio: 'pipe', timeout: 5000, shell: bashExec });
          ranOk = true;
          found.push({ name: sdkName, path: expandedPath, smoke: 'ok', shell: bashExec, commands: entry.commands || [] });
          break;
        } catch (e) {
          lastErr = e;
          if (e.code === 'ENOENT') continue; // bash not at this path, try next
          // Real exec failure: stop trying more bash paths
          break;
        }
      }
      if (!ranOk) {
        missing.push({
          name: sdkName,
          path: entry.path,
          smoke_command: entry.smoke_command,
          smoke_expanded: smokeExpanded,
          exit_code: lastErr?.status ?? null,
          hint: `smoke command failed (exit ${lastErr?.status ?? 'no-bash'}): ${(lastErr?.stderr || lastErr?.stdout || lastErr?.message || '').toString().slice(0, 200)}`,
        });
      }
    } else {
      // No smoke command declared — accept existence + exec.
      notes.push({ name: sdkName, message: 'no smoke_command in registry; accepted by file+exec only' });
      found.push({ name: sdkName, path: expandedPath, smoke: 'skipped', commands: entry.commands || [] });
    }
  }

  emitAndExit(
    { ok: missing.length === 0, subcommand: 'resolve-sdk', found, missing, notes },
    missing.length === 0 ? 0 : 2,
  );
}

// ────────────── subcommand: resolve-model-aliases ──────────────

function resolveModelAliases(registryPath, specPath) {
  let registry, spec;
  try { registry = readJSON(registryPath); }
  catch (e) { emitErrorAndExit('resolve-model-aliases', `cannot read registry: ${e.message}`, 3); }
  try {
    spec = (specPath === '-' || !specPath) ? readJSONFromStdin() : readJSON(specPath);
  } catch (e) {
    emitErrorAndExit('resolve-model-aliases', `cannot read spec: ${e.message}`, 3);
  }

  const known = new Set(registry.model_aliases || []);
  const wanted = new Set();
  for (const p of (spec.phases || [])) {
    if (p.model) wanted.add(p.model);
    for (const st of (p.stages || [])) {
      if (st.model) wanted.add(st.model);
    }
  }

  // Legacy literal model names — accepted but flagged as note (Patch A.4 will migrate).
  const legacyLiteralRe = /^(haiku|sonnet|opus)(-[\w.]+)?$/;

  const found = [];
  const missing = [];
  const notes = [];
  for (const m of wanted) {
    if (known.has(m)) {
      found.push({ alias: m, status: 'alias' });
    } else if (legacyLiteralRe.test(m)) {
      notes.push({ alias: m, message: `legacy literal model name accepted; consider migrating to alias` });
      found.push({ alias: m, status: 'legacy_literal' });
    } else {
      missing.push({ alias: m, hint: `not in registry.model_aliases (${[...known].join(', ')}) and not a known literal model name` });
    }
  }
  emitAndExit(
    { ok: missing.length === 0, subcommand: 'resolve-model-aliases', registry_aliases: [...known], requested: [...wanted], found, missing, notes },
    missing.length === 0 ? 0 : 2,
  );
}

// ────────────── entrypoint ──────────────

function main() {
  const [, , subcommand, ...rest] = process.argv;

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    process.stdout.write(`shared/resolve-capabilities.js — capability resolver

Subcommands:
  resolve-agents              <spec.json> <project-root>
  resolve-hooks               <registry.json> <project-root> <execution-mode> <mode>
  resolve-skills              <names-csv> [<project-root>]
  resolve-embedded-skill-contracts <names-csv> <parent-skill-md-path>
  resolve-sdk                 <registry.json> <sdk-name>
  resolve-model-aliases       <registry.json> <spec.json>

Output: JSON to stdout. Exit codes: 0 ok | 1 internal | 2 missing | 3 invalid input.
`);
    process.exit(0);
  }

  try {
    switch (subcommand) {
      case 'resolve-agents':
        return resolveAgents(rest[0], rest[1] || process.cwd());
      case 'resolve-hooks':
        return resolveHooks(rest[0], rest[1] || process.cwd(), rest[2] || '', rest[3] || 'focused-qa-gate');
      case 'resolve-skills':
        return resolveSkills(rest[0], rest[1] || process.cwd());
      case 'resolve-embedded-skill-contracts':
        return resolveEmbeddedSkillContracts(rest[0], rest[1]);
      case 'resolve-sdk':
        return resolveSDK(rest[0], rest[1]);
      case 'resolve-model-aliases':
        return resolveModelAliases(rest[0], rest[1]);
      default:
        emitErrorAndExit('main', `unknown subcommand: ${subcommand}`, 3);
    }
  } catch (e) {
    emitErrorAndExit('main', `unexpected error: ${e.message}\n${e.stack || ''}`, 1);
  }
}

main();
