#!/usr/bin/env node
'use strict';

/**
 * tests/harness/frontmatter-health.test.js
 *
 * Guards the metadata the platform actually reads. A skill/agent whose YAML frontmatter fails to
 * parse silently loses its description: Claude Code lists the name only and the skill stops being
 * auto-routable. That failure is invisible on disk — the file looks fine — so it needs a test.
 *
 * Six real instances were found and fixed on 2026-08-04 (commit b933f80 + d86ec04); the worst,
 * security-pentest-ai-redteam, had never rendered its description at all.
 *
 * Checks, per skills/<name>/SKILL.md and agents/<name>.md:
 *   1. frontmatter present and terminated
 *   2. no plain (unquoted) scalar that YAML would reparse as structure — the exact bug class:
 *        - a value or sequence item containing ": " outside quotes
 *        - a value starting with "[" or "{" that is not a closed flow collection
 *   3. `name` and `description` keys present and non-empty
 *   4. description + when_to_use within the platform's per-skill listing cap
 *
 * Built-ins only (no YAML dependency) — checks 1-3 are done structurally, which is sufficient
 * because every real failure so far has been of exactly this shape.
 */

const fs = require('fs');
const path = require('path');
const H = require('./_helpers');

const h = new H.Harness('frontmatter-health');

// Platform cap: description + when_to_use combined, per skill, in the listing.
// See docs/native-capabilities.md "Skill listing budget + visibility".
const LISTING_MAX_DESC_CHARS = 1536;

function readFrontmatter(file) {
  const txt = fs.readFileSync(file, 'utf8');
  if (!/^---\r?\n/.test(txt)) return { err: 'no frontmatter block' };
  const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
  if (!m) return { err: 'frontmatter opened but never terminated' };
  return { fm: m[1] };
}

// A plain scalar is anything not wrapped in quotes and not a block scalar (> or |).
function scalarIsPlain(value) {
  const v = value.trim();
  if (v === '') return false;
  if (/^["']/.test(v)) return false;
  if (/^[>|]/.test(v)) return false;
  return true;
}

function flowCollectionIsClosed(v) {
  const open = v.trim()[0];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  for (const ch of v) {
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      // Text after the collection closes (e.g. `[a] (note)`) is a parse error too.
      if (depth === 0) return v.trim().endsWith(close);
    }
  }
  return false;
}

// Returns a list of {line, text, why} for lines YAML would choke on.
function structuralFaults(fm) {
  const faults = [];
  const lines = fm.split(/\r?\n/);
  let inBlockScalar = false;
  let blockIndent = 0;

  lines.forEach((raw, i) => {
    const line = raw.replace(/\r$/, '');
    const indent = line.length - line.trimStart().length;

    if (inBlockScalar) {
      if (line.trim() === '' || indent > blockIndent) return; // still inside — free text, no rules
      inBlockScalar = false;
    }
    if (line.trim() === '' || /^\s*#/.test(line)) return;

    const kv = line.match(/^(\s*)([A-Za-z_][\w-]*):(\s*)(.*)$/);
    const seq = line.match(/^(\s*)-\s+(.*)$/);

    if (kv) {
      const [, pad, key, , value] = kv;
      if (/^[>|]/.test(value.trim())) { inBlockScalar = true; blockIndent = pad.length; return; }
      if (!scalarIsPlain(value)) return;
      if (/^[[{]/.test(value.trim()) && !flowCollectionIsClosed(value)) {
        faults.push({ line: i + 1, text: line, why: `\`${key}\` starts a flow collection that is not closed on this line` });
        return;
      }
      if (!/^[[{]/.test(value.trim()) && /:\s/.test(value)) {
        faults.push({ line: i + 1, text: line, why: `\`${key}\` is an unquoted scalar containing ": " — YAML reads it as a nested mapping` });
      }
      return;
    }

    if (seq) {
      const value = seq[2];
      if (!scalarIsPlain(value)) return;
      // `- key: value` is legal (a one-key mapping). Only a SECOND ": " breaks it,
      // e.g. `- tool (note: a, source: b)` -> mapping value where none may appear.
      const firstColon = value.search(/:\s/);
      if (firstColon >= 0 && /:\s/.test(value.slice(firstColon + 2))) {
        faults.push({ line: i + 1, text: line, why: 'unquoted sequence item has a second ": " — YAML rejects a mapping value here' });
      }
    }
  });

  return faults;
}

function keyValue(fm, key) {
  const lines = fm.split(/\r?\n/);
  const i = lines.findIndex(l => new RegExp(`^${key}:`).test(l));
  if (i < 0) return null;
  let v = lines[i].replace(new RegExp(`^${key}:\\s*([>|]-?)?\\s*`), '');
  for (let k = i + 1; k < lines.length; k += 1) {
    if (/^\s+\S/.test(lines[k])) v += ` ${lines[k].trim()}`;
    else if (lines[k].trim() === '') continue;
    else break;
  }
  return v.replace(/^["']|["']$/g, '').trim();
}

function collect() {
  const out = [];
  const skillsDir = path.join(H.claudeRoot, 'skills');
  if (fs.existsSync(skillsDir)) {
    for (const d of fs.readdirSync(skillsDir)) {
      const f = path.join(skillsDir, d, 'SKILL.md');
      if (fs.existsSync(f)) out.push({ file: f, rel: `skills/${d}/SKILL.md`, dirName: d, kind: 'skill' });
    }
  }
  const agentsDir = path.join(H.claudeRoot, 'agents');
  if (fs.existsSync(agentsDir)) {
    for (const f of fs.readdirSync(agentsDir).filter(x => x.endsWith('.md'))) {
      out.push({ file: path.join(agentsDir, f), rel: `agents/${f}`, dirName: f.replace(/\.md$/, ''), kind: 'agent' });
    }
  }
  return out;
}

const targets = collect();
if (targets.length === 0) {
  h.error('no skills or agents found', 'expected skills/*/SKILL.md and agents/*.md');
  process.exit(h.exit());
}

h.section(`Frontmatter parses as YAML structure (${targets.length} files)`);
let faulty = 0;
for (const t of targets) {
  const { fm, err } = readFrontmatter(t.file);
  if (err) { h.fail(`${t.rel}`, err); faulty += 1; continue; }
  const faults = structuralFaults(fm);
  if (faults.length) {
    faulty += 1;
    h.fail(`${t.rel}`, `line ${faults[0].line}: ${faults[0].why}`);
  }
}
if (faulty === 0) h.ok(`all ${targets.length} frontmatter blocks structurally sound`);

h.section('Required keys present');
let missing = 0;
for (const t of targets) {
  const { fm } = readFrontmatter(t.file);
  if (!fm) continue;
  const name = keyValue(fm, 'name');
  const desc = keyValue(fm, 'description');
  if (!name) { h.fail(`${t.rel}`, 'no `name` key'); missing += 1; continue; }
  if (!desc) { h.fail(`${t.rel}`, 'no `description` key — the platform would list it name-only'); missing += 1; }
}
if (missing === 0) h.ok('every skill and agent declares name + description');

h.section('Declared name matches directory / filename');
for (const t of targets) {
  const { fm } = readFrontmatter(t.file);
  if (!fm) continue;
  const name = keyValue(fm, 'name');
  if (!name) continue;
  h.assertSoft(
    name === t.dirName,
    `${t.rel} — name matches`,
    `declares \`name: ${name}\` but lives at \`${t.dirName}\``
  );
}

h.section(`Listing text within the platform cap (${LISTING_MAX_DESC_CHARS} chars)`);
let over = 0;
for (const t of targets) {
  const { fm } = readFrontmatter(t.file);
  if (!fm) continue;
  const total = (keyValue(fm, 'description') || '').length + (keyValue(fm, 'when_to_use') || '').length;
  if (total > LISTING_MAX_DESC_CHARS) {
    over += 1;
    h.fail(`${t.rel}`, `description + when_to_use = ${total} chars — truncated in the listing`);
  }
}
if (over === 0) h.ok('no file exceeds the per-skill listing cap');

process.exit(h.exit());
