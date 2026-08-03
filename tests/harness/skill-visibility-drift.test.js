#!/usr/bin/env node
'use strict';

/**
 * tests/harness/skill-visibility-drift.test.js
 *
 * Guards `manifests/skill-overrides.recommended.json` against the failure it exists to prevent:
 * a skill quietly consuming description budget that a self-triggering skill needed.
 *
 * The listing has a hard total budget (1% of context). Over it, Claude Code keeps names and drops
 * descriptions starting with the least-invoked skills — with no error anywhere. Measured 2026-08-04:
 * 112 of 173 entries were bare names, and three of the four skills CLAUDE.md §3 requires to
 * self-trigger had been silently dropped. A new skill defaults to `on`, so every skill added
 * without an override entry makes that worse, invisibly. Hence a test rather than a convention.
 *
 * Checks:
 *   1. every skill on disk has an entry in recommended_overrides
 *   2. every name in the hand-owned lists (keep_on / manual_gates) still exists on disk
 *   3. recommended_overrides equals what tools/skill-visibility/generate.js would produce
 *      (catches a hand-edit that bypassed the generator)
 *   4. SAFETY: every manual gate resolves to `user-invocable-only` — never `name-only`, which
 *      would keep `Skill(name)` dispatch alive for a skill that must never be model-invoked
 *   5. SAFETY: any skill declaring `disable-model-invocation: true` is listed in manual_gates
 *   6. `pentest-scope-and-roe` stays `on` — it is the visible governance gate (CLAUDE.md §3)
 */

const fs = require('fs');
const path = require('path');
const H = require('./_helpers');

const h = new H.Harness('skill-visibility-drift');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST = path.join(ROOT, 'manifests', 'skill-overrides.recommended.json');
const SKILLS_DIR = path.join(ROOT, 'skills');

if (!fs.existsSync(MANIFEST)) {
  h.error(`missing manifest: ${path.relative(ROOT, MANIFEST)}`);
  process.exit(h.exit());
}
if (!fs.existsSync(SKILLS_DIR)) {
  h.error('missing skills/ directory');
  process.exit(h.exit());
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
} catch (e) {
  h.error('manifest is not valid JSON', e.message);
  process.exit(h.exit());
}

const disk = fs.readdirSync(SKILLS_DIR)
  .filter(d => fs.existsSync(path.join(SKILLS_DIR, d, 'SKILL.md')))
  .sort();

const overrides = manifest.recommended_overrides || {};
const keepOn = Object.keys(manifest.keep_on || {});
const gates = Object.keys(manifest.manual_gates || {});
const commandOff = manifest.command_off || [];

// ---- 1. every skill on disk is classified ------------------------------------------------
const unlisted = disk.filter(n => !(n in overrides));
if (unlisted.length === 0) {
  h.ok(`all ${disk.length} skills on disk have a visibility entry`);
} else {
  h.fail(
    `${unlisted.length} skill(s) on disk have no visibility entry: ${unlisted.join(', ')}`,
    'They default to `on` and silently consume listing budget. Run: node tools/skill-visibility/generate.js --write',
  );
}

// ---- 2. hand-owned lists point at real skills --------------------------------------------
const stale = [...keepOn, ...gates].filter(n => !disk.includes(n));
if (stale.length === 0) {
  h.ok(`hand-owned lists (keep_on ${keepOn.length}, manual_gates ${gates.length}) all resolve on disk`);
} else {
  h.fail(
    `hand-owned list names skill(s) not on disk: ${stale.join(', ')}`,
    'A renamed or deleted skill left a dangling entry — fix the list in the manifest.',
  );
}

// ---- 3. computed block matches the generator ----------------------------------------------
const expected = {};
for (const n of commandOff) expected[n] = 'off';
for (const n of gates.slice().sort()) expected[n] = 'user-invocable-only';
for (const n of keepOn.slice().sort()) expected[n] = 'on';
for (const n of disk) if (!expected[n]) expected[n] = 'name-only';

const mismatched = Object.keys(expected).filter(k => overrides[k] !== expected[k]);
const extra = Object.keys(overrides).filter(k => !(k in expected));
if (mismatched.length === 0 && extra.length === 0) {
  h.ok(`recommended_overrides (${Object.keys(overrides).length}) matches the generator output`);
} else {
  h.fail(
    `recommended_overrides drifted from the generator: ${mismatched.length} mismatched, ${extra.length} orphaned`,
    `${[...mismatched.slice(0, 6), ...extra.slice(0, 6)].join(', ')} — run: node tools/skill-visibility/generate.js --write`,
  );
}

// ---- 4. SAFETY: manual gates must be hidden, not merely name-only -------------------------
const weakGates = gates.filter(n => overrides[n] !== 'user-invocable-only');
if (weakGates.length === 0) {
  h.ok(`all ${gates.length} manual gates resolve to user-invocable-only`);
} else {
  h.fail(
    `manual gate(s) not hidden from the model: ${weakGates.map(n => `${n}=${overrides[n]}`).join(', ')}`,
    '`name-only` keeps Skill(name) dispatch working — a manual gate must be user-invocable-only or off.',
  );
}

// ---- 5. SAFETY: every disable-model-invocation skill is a declared gate --------------------
const declaredManual = disk.filter(n => {
  const txt = fs.readFileSync(path.join(SKILLS_DIR, n, 'SKILL.md'), 'utf8');
  const fm = (txt.match(/^---\r?\n([\s\S]*?)\r?\n---/) || [])[1] || '';
  return /disable-model-invocation:\s*true/.test(fm);
});
const unguarded = declaredManual.filter(n => !gates.includes(n));
if (unguarded.length === 0) {
  h.ok(`all ${declaredManual.length} disable-model-invocation skills are listed in manual_gates`);
} else {
  h.fail(
    `skill(s) declare disable-model-invocation but are not in manual_gates: ${unguarded.join(', ')}`,
    'Add them to manual_gates so the settings layer agrees with the frontmatter gate (defense in depth).',
  );
}

// ---- 6. visible governance gate stays visible ---------------------------------------------
if (overrides['pentest-scope-and-roe'] === 'on') {
  h.ok('pentest-scope-and-roe stays `on` (visible governance gate)');
} else {
  h.fail(
    `pentest-scope-and-roe is \`${overrides['pentest-scope-and-roe']}\`, expected \`on\``,
    'It exists to remind Claude to confirm ROE before active testing (CLAUDE.md §3) — hiding it defeats its purpose.',
  );
}

process.exit(h.exit());
