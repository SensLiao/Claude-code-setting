#!/usr/bin/env node
'use strict';

/**
 * tests/harness/safety-name-freeze.test.js
 *
 * Reads `name_freeze` list from manifests/harness.registry.json AND
 * manifests/skills.manifest.json — for every frozen name, verifies the
 * corresponding file/directory exists on disk.
 *
 * Resolution rules:
 *   - skill name  → skills/<name>/SKILL.md
 *   - agent name  → agents/<name>.md
 *   - hook name   → hooks/<name>  OR  templates/discoverability/hooks/<name>
 *                   (with or without .js extension)
 *   - sdk command → not file-level (checked by sdk-matrix.test.js)
 *
 * The skills.manifest.json name_freeze is a simple string array;
 * harness.registry.json name_freeze is an array of {name, type, category}.
 */

const path = require('path');
const H = require('./_helpers');

const h = new H.Harness('safety-name-freeze');

const SKILLS_MANIFEST = path.join(H.claudeRoot, 'manifests', 'skills.manifest.json');
const HARNESS_REGISTRY = path.join(H.claudeRoot, 'manifests', 'harness.registry.json');

if (!H.existsSync(SKILLS_MANIFEST)) {
  h.error(`Missing: ${H.rel(SKILLS_MANIFEST)}`);
}
if (!H.existsSync(HARNESS_REGISTRY)) {
  h.error(`Missing: ${H.rel(HARNESS_REGISTRY)}`);
}
if (h.infraErrors > 0) process.exit(h.exit());

let manifest; let registry;
try { manifest = H.readJson(SKILLS_MANIFEST); }
catch (e) { h.error('skills.manifest.json parse error', e.message); process.exit(h.exit()); }
try { registry = H.readJson(HARNESS_REGISTRY); }
catch (e) { h.error('harness.registry.json parse error', e.message); process.exit(h.exit()); }

// --- Heuristic name → type classifier for skills.manifest.json strings ---
// (the manifest uses bare names; the registry has structured {name, type})
function classify(name) {
  if (/\.(js|sh)$/.test(name)) return 'hook';
  if (/^disc-/.test(name) && !/\.js$/.test(name)) return 'agent';
  return 'skill';
}

function fileExistsForFrozen(name, type) {
  const candidates = [];
  switch (type) {
    case 'skill':
      candidates.push(path.join(H.claudeRoot, 'skills', name, 'SKILL.md'));
      break;
    case 'agent':
      candidates.push(path.join(H.claudeRoot, 'agents', `${name}.md`));
      break;
    case 'hook': {
      // Hook may live in hooks/ or templates/discoverability/hooks/ (or
      // similar template paths). Try several locations with or without .js.
      const basename = name;
      const noExt = name.replace(/\.(js|sh)$/, '');
      const locations = [
        ['hooks', basename],
        ['hooks', noExt],
        ['hooks', `${noExt}.js`],
        ['templates', 'discoverability', 'hooks', basename],
        ['templates', 'discoverability', 'hooks', noExt],
        ['templates', 'discoverability', 'hooks', `${noExt}.js`],
      ];
      for (const segs of locations) {
        candidates.push(path.join(H.claudeRoot, ...segs));
      }
      break;
    }
    default:
      candidates.push(path.join(H.claudeRoot, name));
  }
  for (const c of candidates) if (H.existsSync(c)) return { ok: true, path: c };
  return { ok: false, tried: candidates };
}

// --- 1. Process skills.manifest.json `name_freeze` (string array) -------
h.section('skills.manifest.json — name_freeze');
const mfFrozen = manifest.name_freeze || [];
if (!Array.isArray(mfFrozen) || mfFrozen.length === 0) {
  h.error('skills.manifest.json.name_freeze missing or empty');
} else {
  h.ok(`skills.manifest.json.name_freeze has ${mfFrozen.length} entries`);
  for (const entry of mfFrozen) {
    if (typeof entry !== 'string') {
      h.fail(`skills.manifest.json.name_freeze contains non-string entry: ${JSON.stringify(entry)}`);
      continue;
    }
    const type = classify(entry);
    const r = fileExistsForFrozen(entry, type);
    h.assert(
      r.ok,
      `  [${type}] ${entry} resolves to a file`,
      r.ok ? null : `tried: ${r.tried.map(p => H.rel(p)).join(', ')}`
    );
  }
}

// --- 2. Process harness.registry.json `name_freeze` (structured) --------
h.section('harness.registry.json — name_freeze (structured)');
const regFrozen = registry.name_freeze || [];
if (!Array.isArray(regFrozen) || regFrozen.length === 0) {
  h.error('harness.registry.json.name_freeze missing or empty');
} else {
  h.ok(`harness.registry.json.name_freeze has ${regFrozen.length} entries`);
  for (const entry of regFrozen) {
    if (!entry || !entry.name) {
      h.fail(`harness.registry.json.name_freeze contains malformed entry: ${JSON.stringify(entry)}`);
      continue;
    }
    const type = entry.type || classify(entry.name);
    if (type === 'sdk_command') {
      h.assertSoft(true, `  [${type}] ${entry.name} — not file-level (covered by sdk-matrix.test.js)`);
      continue;
    }
    const r = fileExistsForFrozen(entry.name, type);
    h.assert(
      r.ok,
      `  [${type}] ${entry.name} resolves to a file`,
      r.ok ? null : `tried: ${r.tried.map(p => H.rel(p)).join(', ')}`
    );
  }
}

// --- 3. Optional: verify the two lists overlap (consistency) ------------
h.section('Cross-consistency');
const setManifest = new Set(mfFrozen.filter(s => typeof s === 'string'));
const setRegistry = new Set(regFrozen.map(e => e && e.name).filter(Boolean));
const onlyInManifest = [...setManifest].filter(n => !setRegistry.has(n));
const onlyInRegistry = [...setRegistry].filter(n => !setManifest.has(n));

// Differences are tolerated but surfaced as warnings for visibility
if (onlyInManifest.length) {
  h.assertSoft(
    false,
    `Names only in skills.manifest.json.name_freeze: ${onlyInManifest.join(', ')}`,
    'These names not present in harness.registry.json.name_freeze'
  );
}
if (onlyInRegistry.length) {
  h.assertSoft(
    false,
    `Names only in harness.registry.json.name_freeze: ${onlyInRegistry.join(', ')}`,
    'These names not present in skills.manifest.json.name_freeze'
  );
}
if (!onlyInManifest.length && !onlyInRegistry.length) {
  h.ok('name_freeze lists are identical between the two manifests');
}

process.exit(h.exit());
