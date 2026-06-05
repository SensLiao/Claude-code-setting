#!/usr/bin/env node
/**
 * check-gate-decision-parity.js — drift guard between the canonical gate-decision schema YAML
 * (human source of truth) and its JSON mirror (the live schema verdict-validator.js actually loads).
 *
 * WHY (#3, 2026-06-05): verdict-validator.loadDefaultSchema() reads gate-decision.schema.JSON. The
 * YAML is the documented source of truth. They drifted before (the JSON gained `provenance` while
 * the YAML did not — caught + fixed by this very check on first run). The JSON's own description
 * promised "Kept in sync via test/schema-parity.test" but that test was never implemented. This is
 * it: dependency-free (no YAML lib on this box), structural-invariant comparison.
 *
 * Scope: compares the load-bearing invariants (enums, required sets, property key set,
 * additionalProperties, provenance shape, x-release-semantics buckets). It is NOT a full YAML
 * parser / deep-equal — it asserts the things whose drift would silently change gate behavior.
 *
 * Exit 0 = in sync · exit 1 = DRIFT (prints each mismatch) · exit 2 = file/parse error.
 * Zero dev friction: this never runs during development — it's a CI / maintenance check.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const JSON_PATH = path.join(DIR, 'gate-decision.schema.json');
const YAML_PATH = path.join(DIR, 'gate-decision.schema.yaml');

function die(msg) { console.error(`[schema-parity] ERROR: ${msg}`); process.exit(2); }

let J, Y;
try { J = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')); } catch (e) { die(`cannot parse JSON mirror: ${e.message}`); }
try { Y = fs.readFileSync(YAML_PATH, 'utf8'); } catch (e) { die(`cannot read YAML source: ${e.message}`); }
const yLines = Y.split(/\r?\n/);

// ── focused dependency-free YAML extractors (schema structure is fixed/known) ──
const indentOf = (s) => s.length - s.trimStart().length;

// Collect `- item` values directly under a `key:` whose line matches keyRe (at any indent);
// items are the immediately-following lines indented deeper than the key line.
function listUnder(keyRe) {
  for (let i = 0; i < yLines.length; i++) {
    if (keyRe.test(yLines[i])) {
      const base = indentOf(yLines[i]);
      const out = [];
      for (let j = i + 1; j < yLines.length; j++) {
        const ln = yLines[j];
        if (ln.trim() === '') continue;
        if (indentOf(ln) <= base) break;
        const m = ln.trim().match(/^-\s+(.+?)\s*$/);
        if (m) out.push(m[1].replace(/^["']|["']$/g, ''));
        else if (indentOf(ln) === base + 2 && /^[A-Za-z0-9_"-]+:/.test(ln.trim())) break; // sibling map key
      }
      return out;
    }
  }
  return null;
}

// Enum finder: scan the named property block explicitly for its `enum:` list.
function enumOf(prop) {
  const propRe = new RegExp(`^  ${prop}:\\s*$`);
  for (let i = 0; i < yLines.length; i++) {
    if (!propRe.test(yLines[i])) continue;
    for (let j = i + 1; j < yLines.length; j++) {
      const ln = yLines[j];
      if (ln.trim() === '') continue;
      if (indentOf(ln) <= 2) break; // left property block
      if (/^\s{4}enum:\s*$/.test(ln)) {
        const out = [];
        for (let k = j + 1; k < yLines.length; k++) {
          const m = yLines[k].trim().match(/^-\s+(.+?)\s*$/);
          if (m && indentOf(yLines[k]) >= 6) out.push(m[1].replace(/^["']|["']$/g, ''));
          else if (yLines[k].trim() !== '') break;
        }
        return out;
      }
    }
  }
  return null;
}

// Top-level property key set: `  <key>:` between `properties:` and the next col-0 line.
function topPropertyKeys() {
  const keys = [];
  let inProps = false;
  for (const ln of yLines) {
    if (/^properties:\s*$/.test(ln)) { inProps = true; continue; }
    if (inProps) {
      if (ln.trim() !== '' && indentOf(ln) === 0) break; // col-0 → left properties
      const m = ln.match(/^  ([A-Za-z0-9_]+):\s*$/);
      if (m) keys.push(m[1]);
      // also catch inline `  key: value` (none here, but be safe)
      const m2 = ln.match(/^  ([A-Za-z0-9_]+):\s+\S/);
      if (m2) keys.push(m2[1]);
    }
  }
  return keys;
}

// provenance.required (nested under properties.provenance)
function provenanceRequired() {
  for (let i = 0; i < yLines.length; i++) {
    if (/^  provenance:\s*$/.test(yLines[i])) {
      for (let j = i + 1; j < yLines.length; j++) {
        if (yLines[j].trim() !== '' && indentOf(yLines[j]) <= 2) break;
        if (/^\s{4}required:\s*$/.test(yLines[j])) {
          const out = [];
          for (let k = j + 1; k < yLines.length; k++) {
            const m = yLines[k].trim().match(/^-\s+(.+?)\s*$/);
            if (m && indentOf(yLines[k]) >= 6) out.push(m[1].replace(/^["']|["']$/g, ''));
            else if (yLines[k].trim() !== '') break;
          }
          return out;
        }
      }
    }
  }
  return null;
}

function topLevelRequired() { return listUnder(/^required:\s*$/); }
function xrelList(bucket) { return listUnder(new RegExp(`^  ${bucket}:\\s*$`)); }
function yamlHas(re) { return yLines.some((l) => re.test(l)); }

// ── comparisons ──
const fails = [];
const setEq = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length &&
  [...a].sort().join('|') === [...b].sort().join('|');
function cmpSet(name, jv, yv) {
  if (!setEq(jv, yv)) fails.push(`${name}: JSON=${JSON.stringify(jv)} vs YAML=${JSON.stringify(yv)}`);
}

cmpSet('decision.enum', J.properties.decision.enum, enumOf('decision'));
cmpSet('required', J.required, topLevelRequired());
cmpSet('subsystem.enum', J.properties.subsystem.enum, enumOf('subsystem'));
cmpSet('property keys', Object.keys(J.properties), topPropertyKeys());
cmpSet('provenance.required', J.properties.provenance.required, provenanceRequired());
cmpSet('xrel.blocks_release', J['x-release-semantics'].blocks_release, xrelList('blocks_release'));
cmpSet('xrel.allows_release', J['x-release-semantics'].allows_release, xrelList('allows_release'));
cmpSet('xrel.not_release_decision', J['x-release-semantics'].not_release_decision, xrelList('not_release_decision'));

if (J.additionalProperties !== false) fails.push('JSON additionalProperties is not false');
if (!yamlHas(/^additionalProperties:\s*false\s*$/)) fails.push('YAML missing `additionalProperties: false`');

// provenance.written_by pattern: compare escaping-insensitively. JSON.parse yields a single
// backslash (\S); YAML double-quoted source stores \\S. Normalize by stripping ALL backslashes
// from both sides (the only legal difference here is backslash-doubling), then compare.
const wbPat = J.properties.provenance.properties.written_by.pattern; // ^(appsec|qa|...)-sdk@\S+$
const yamlWbLine = (() => {
  for (let i = 0; i < yLines.length; i++) {
    if (/^\s+written_by:\s*$/.test(yLines[i])) {
      for (let j = i + 1; j < yLines.length && j < i + 4; j++) {
        const m = yLines[j].match(/^\s+pattern:\s*["']?(.+?)["']?\s*$/);
        if (m) return m[1];
      }
    }
  }
  return null;
})();
const noBs = (s) => (s == null ? null : String(s).replace(/\\/g, ''));
if (!yamlWbLine) fails.push('provenance.written_by.pattern not found in YAML');
else if (noBs(wbPat) !== noBs(yamlWbLine)) {
  fails.push(`provenance.written_by pattern differs: JSON='${wbPat}' vs YAML='${yamlWbLine}'`);
}

if (fails.length === 0) {
  console.log('[schema-parity] ✓ gate-decision.schema.json mirrors gate-decision.schema.yaml (all load-bearing invariants match)');
  process.exit(0);
}
console.error('[schema-parity] ✗ DRIFT between JSON mirror and YAML source:');
for (const f of fails) console.error(`  - ${f}`);
console.error('  Fix: reconcile the two files (YAML is the human source; JSON is what verdict-validator loads).');
process.exit(1);
