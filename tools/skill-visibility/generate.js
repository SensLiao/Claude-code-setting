#!/usr/bin/env node
'use strict';

/**
 * tools/skill-visibility/generate.js
 *
 * Regenerates the `recommended_overrides` block of
 * `manifests/skill-overrides.recommended.json` from the skills actually on disk.
 *
 * WHY THIS EXISTS
 * ---------------
 * The skill listing has two hard limits (docs/native-capabilities.md "Skill listing budget"):
 * 1,536 chars per skill, and 1% of the context window for the whole listing. Over budget, Claude
 * Code keeps names and drops descriptions starting with the least-invoked skills — silently.
 *
 * Measured 2026-08-04 on a 173-entry listing: 112 entries rendered as bare names. Only 38 of those
 * were our own `name-only` choices; the other ~74 were dropped by the budget, including
 * web-seo / web-aeo / web-local-seo — three of the four skills CLAUDE.md §3 explicitly excludes
 * from name-only *because they must self-trigger*. The exclusion was paper-only at runtime.
 *
 * The same session proved `name-only` genuinely returns its description chars to the shared budget:
 * with 166 skills forced to name-only, all four previously-dropped skills regained descriptions
 * (control: a skill that had a description lost it when the overlay set it name-only, so the
 * overlay demonstrably applied). See tests/orchestrator-routing/RESULTS-2026-08-04.md.
 *
 * THE POLICY
 * ----------
 * A skill only needs a *description* if Claude must recognise it unprompted. A skill dispatched by
 * an orchestrator does not: the orchestrator's own body carries the routing table, and
 * `Skill(name)` dispatch keeps working at `name-only`. So description budget spent on a dispatched
 * sub-skill buys nothing and costs an entry that a self-triggering skill needed.
 *
 *   keep_on       -> on                   (must be recognised unprompted; hand-owned)
 *   manual_gates  -> user-invocable-only  (must NEVER be model-invoked; hand-owned)
 *   command_off   -> off                  (command-backed, unused here; hand-owned)
 *   everything else on disk -> name-only  (orchestrator-dispatched; COMPUTED here)
 *
 * All judgment lives in the three hand-owned lists in the manifest. This script computes only the
 * mechanical remainder, so adding a skill can never silently grant it description budget —
 * tests/harness/skill-visibility-drift.test.js fails when disk and manifest disagree.
 *
 * Usage:
 *   node tools/skill-visibility/generate.js            # dry-run: print the diff
 *   node tools/skill-visibility/generate.js --write    # rewrite the manifest
 *   node tools/skill-visibility/generate.js --audit    # who references each skill (keep_on review)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST = path.join(ROOT, 'manifests', 'skill-overrides.recommended.json');
const SKILLS_DIR = path.join(ROOT, 'skills');

function skillsOnDisk() {
  return fs.readdirSync(SKILLS_DIR)
    .filter(d => fs.existsSync(path.join(SKILLS_DIR, d, 'SKILL.md')))
    .sort();
}

function build(manifest, disk) {
  const keepOn = Object.keys(manifest.keep_on || {});
  const gates = Object.keys(manifest.manual_gates || {});
  const off = manifest.command_off || [];

  const overrides = {};
  for (const name of off) overrides[name] = 'off';
  for (const name of gates.slice().sort()) overrides[name] = 'user-invocable-only';
  for (const name of keepOn.slice().sort()) overrides[name] = 'on';
  for (const name of disk) {
    if (overrides[name]) continue;      // already classified by a hand-owned list
    overrides[name] = 'name-only';
  }
  return overrides;
}

// --audit: re-derive who dispatches what, so a keep_on entry justified as "standalone" can be
// checked instead of trusted. The first hand-run of this scan covered only the orchestrators'
// SKILL.md + references/ and therefore missed dispatch from agents/ — motion-engineering and
// discoverability-growth were mislabelled standalone for exactly that reason. Scan all three
// surfaces. Substring matching errs both ways (`guide` matches the ordinary English word), so
// this prints evidence for a human to read; it does not decide anything.
function audit(manifest, disk) {
  const dirs = ['skills', 'agents', 'commands'];
  const files = [];
  for (const d of dirs) {
    const base = path.join(ROOT, d);
    if (!fs.existsSync(base)) continue;
    const stack = [base];
    while (stack.length) {
      const cur = stack.pop();
      for (const ent of fs.readdirSync(cur, { withFileTypes: true })) {
        const full = path.join(cur, ent.name);
        if (ent.isDirectory()) stack.push(full);
        else if (/\.(md|json)$/.test(ent.name)) files.push(full);
      }
    }
  }
  const text = new Map(files.map(f => [f, fs.readFileSync(f, 'utf8')]));
  const keepOn = new Set(Object.keys(manifest.keep_on || {}));

  console.log(`scanned ${files.length} files under ${dirs.join(', ')}\n`);
  for (const name of disk) {
    const own = path.join(ROOT, 'skills', name) + path.sep;
    const refs = files.filter(f => !f.startsWith(own) && text.get(f).includes(name));
    const bySurface = { skills: 0, agents: 0, commands: 0 };
    for (const f of refs) {
      const top = path.relative(ROOT, f).split(path.sep)[0];
      if (top in bySurface) bySurface[top] += 1;
    }
    const dispatched = refs.length > 0;
    const inKeep = keepOn.has(name);
    // only the contradictions are worth printing: a keep_on entry that IS referenced, or an
    // unreferenced skill that is NOT in keep_on
    if (inKeep && dispatched) {
      console.log(`  keep_on but referenced  ${name}  (skills:${bySurface.skills} agents:${bySurface.agents} commands:${bySurface.commands})`);
      refs.slice(0, 4).forEach(f => console.log(`      ${path.relative(ROOT, f)}`));
    } else if (!inKeep && !dispatched) {
      console.log(`  unreferenced, not keep_on  ${name}  — nothing dispatches it, and it has no description`);
    }
  }
  console.log('\nRead these by hand: a reference can be an ordinary English word, and a genuine');
  console.log('dispatch can be phrased without the skill name. This lists candidates, not verdicts.');
}

function main() {
  const write = process.argv.includes('--write');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const disk = skillsOnDisk();

  if (process.argv.includes('--audit')) { audit(manifest, disk); return; }

  // Hand-owned lists must refer to skills that exist (command_off is command-backed, not skills).
  const stale = [...Object.keys(manifest.keep_on || {}), ...Object.keys(manifest.manual_gates || {})]
    .filter(n => !disk.includes(n));
  if (stale.length) {
    console.error(`ERROR: hand-owned list names skills that are not on disk: ${stale.join(', ')}`);
    process.exit(2);
  }

  const next = build(manifest, disk);
  const prev = manifest.recommended_overrides || {};

  const added = Object.keys(next).filter(k => !(k in prev));
  const removed = Object.keys(prev).filter(k => !(k in next));
  const changed = Object.keys(next).filter(k => k in prev && prev[k] !== next[k]);

  const counts = {};
  for (const v of Object.values(next)) counts[v] = (counts[v] || 0) + 1;

  console.log(`skills on disk : ${disk.length}`);
  console.log(`overrides      : ${Object.keys(next).length}  (${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(', ')})`);
  console.log(`added          : ${added.length}${added.length ? '  ' + added.slice(0, 8).join(', ') + (added.length > 8 ? ' …' : '') : ''}`);
  console.log(`removed        : ${removed.length}${removed.length ? '  ' + removed.join(', ') : ''}`);
  console.log(`changed        : ${changed.length}${changed.length ? '  ' + changed.map(k => `${k} ${prev[k]}->${next[k]}`).slice(0, 8).join(', ') : ''}`);

  if (!write) {
    console.log('\n(dry-run — pass --write to update the manifest)');
    return;
  }

  manifest.recommended_overrides = next;
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`\nwrote ${path.relative(ROOT, MANIFEST)}`);
}

main();
