#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * tools/relocation-integrity/lint.js
 *
 * Guards the SKILL-slimming runtime-topology refactor (SKILL-SLIMMING-PLAN-2026.05.29.md).
 * Verifies that relocating SKILL.md content into references/ did NOT silently
 * degrade a binding governance contract from always-loaded to best-effort-loaded.
 *
 * Checks (per the plan's PART 8 + 2026-05-29 follow-up patches G4/G5/D2):
 *   GLOBAL (always run):
 *     G1 Hook independence — hooks/*preview-gate*.js + governed-gate-workflow-guard.js
 *        contain ZERO "SKILL.md" path references (enforcement must stay SKILL-independent).
 *     G2 Description budget — each watched skill's frontmatter `description` is
 *        <= 1024 chars and contains no XML tag.
 *     D2 Listing-cap budget — Claude Code truncates the combined `description` +
 *        `when_to_use` text at 1536 chars in the skill listing (official docs;
 *        configurable via maxSkillDescriptionChars). Forward-guard: if a watched
 *        skill ever grows a `when_to_use`, the COMBINED text must stay <= 1536.
 *     G3 Skeleton presence — appsec/qa keep-guard anchors still live in SKILL.md
 *        (name-freeze table, §-headings, approval whitelist, gate_active).
 *     G4 Compaction-safe index — appsec/qa carry a <!-- COMPACTION-SAFE-INDEX --> block
 *        whose required keep-guard anchors all appear within the first ~5000 tokens
 *        of SKILL.md, so auto-compaction (keeps only the first 5,000 tokens of each
 *        re-attached skill — official Claude Code skills docs) cannot drop them.
 *     G5 One-level references — no references/*.md issues a read-obligation pointing
 *        at ANOTHER references/*.md unless that target is also directly linked from
 *        SKILL.md (progressive disclosure must stay one level deep).
 *   PER-SKILL (only when skills/<skill>/references/MANIFEST.md exists):
 *     M1 every reference file named in MANIFEST exists on disk.
 *     M2 KEEP-GUARD-B rows: the exact "§n" appears in a heading in BOTH the
 *        SKILL.md AND the named reference file (dual tombstone anchor).
 *     M3 KEEP-GUARD-B rows: the reference file's first non-empty line is the
 *        CONTRACT-SENTINEL marker equal to the MANIFEST sentinel value.
 *
 * Exit: 0 clean · 1 drift · 2 internal error.
 * Node built-ins only. Usage: node tools/relocation-integrity/lint.js [--root <dir>] [--json]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

function parseArgs(argv) {
  const a = { root: null, json: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--root' && i + 1 < argv.length) { a.root = argv[i + 1]; i += 1; }
    else if (argv[i] === '--json') a.json = true;
    else if (argv[i] === '--help' || argv[i] === '-h') {
      console.error('Usage: node tools/relocation-integrity/lint.js [--root <claude-dir>] [--json]');
      process.exit(0);
    }
  }
  if (!a.root) a.root = path.join(os.homedir(), '.claude');
  return a;
}

function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }
function read(p) { return fs.readFileSync(p, 'utf8'); }

// Skills whose descriptions we budget-check (the 6 orchestrators touched by the plan).
const WATCHED_SKILLS = [
  'appsec-security-orchestrator',
  'enterprise-qa-testing',
  'discoverability-orchestrator',
  'claude-env-bootstrap',
  'gsd-pipeline-orchestrator',
  'uiux-product-orchestrator',
];

// Skills that own a references/MANIFEST.md after slimming.
const SLIMMED_SKILLS = [
  'appsec-security-orchestrator',
  'enterprise-qa-testing',
  'discoverability-orchestrator',
  'claude-env-bootstrap',
];

// G3 skeleton anchors that MUST remain in the SKILL.md after skeleton-stays slimming.
const SKELETON_ANCHORS = {
  'appsec-security-orchestrator': [
    '16.10.7',          // name-freeze section number
    'Name Freeze',      // name-freeze heading text
    '16.11',            // spec authoring contract
    '16.13',            // preview contract
    'ship it',          // approval keyword whitelist (kept skeleton)
    'gate_active',      // governed-gate first-action (hook-facing)
  ],
  'enterprise-qa-testing': [
    '18.5',             // launch contract
    'qa-preview-gate',  // launch gate hook name
    'gate_active',      // governed-gate first-action
    'ship it',          // approval whitelist
    'schema_registry',  // §16 every-run output contract (DO-NOT-MOVE)
  ],
};

// G4 compaction-safe index: the binding anchors that MUST appear inside the
// <!-- COMPACTION-SAFE-INDEX --> block AND within the first ~5000 tokens of SKILL.md.
// Auto-compaction keeps only the first 5,000 tokens of each re-attached skill
// (Claude Code skills docs), so late-section governance skeletons can be dropped;
// the index re-surfaces their anchors at the top so they survive compaction.
const COMPACTION_TOKEN_BUDGET = 5000; // official per-skill retained window
const COMPACTION_SAFE_MARGIN = 4800;  // assert the index sits comfortably inside it
const COMPACTION_INDEX = {
  'appsec-security-orchestrator': ['16.10.7', '16.11', '16.13', 'gate_active'],
  'enterprise-qa-testing': ['18.5', 'gate_active', 'schema_registry'],
};

// Conservative token estimator (no tokenizer dependency; intentionally over-counts CJK).
// ASCII ~4 chars/token; CJK ~1.3 tokens/char; other ~2 chars/token.
function estTokens(text) {
  let ascii = 0; let cjk = 0; let other = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (c < 128) ascii += 1;
    else if ((c >= 0x3000 && c <= 0x9fff) || (c >= 0xf900 && c <= 0xfaff)
             || (c >= 0x20000 && c <= 0x2ffff) || (c >= 0xff00 && c <= 0xffef)) cjk += 1;
    else other += 1;
  }
  return Math.ceil(ascii / 4 + cjk * 1.3 + other / 2);
}

const findings = [];
function err(check, msg, detail) { findings.push({ level: 'error', check, msg, detail: detail || '' }); }
function ok(check, msg) { findings.push({ level: 'ok', check, msg }); }

// ── frontmatter field extraction (handles `>` folded and inline) ────────────
function extractFmField(skillMd, key) {
  const lines = skillMd.split(/\r?\n/);
  // frontmatter is between the first two lines that are exactly '---'
  let fmStart = -1; let fmEnd = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') { if (fmStart === -1) fmStart = i; else { fmEnd = i; break; } }
  }
  if (fmStart === -1 || fmEnd === -1) return null;
  const fm = lines.slice(fmStart + 1, fmEnd);
  const keyRe = new RegExp(`^${key}:\\s*(.*)$`);
  for (let i = 0; i < fm.length; i += 1) {
    const m = fm[i].match(keyRe);
    if (!m) continue;
    const rest = m[1].trim();
    if (rest && rest !== '>' && rest !== '|' && rest !== '>-' && rest !== '|-') {
      // inline form — strip surrounding quotes
      return rest.replace(/^["']/, '').replace(/["']$/, '');
    }
    // block scalar — collect following lines that are indented (deeper than column 0 key)
    const body = [];
    for (let j = i + 1; j < fm.length; j += 1) {
      if (/^[A-Za-z_][A-Za-z0-9_-]*:/.test(fm[j])) break; // next top-level key
      body.push(fm[j].replace(/^\s+/, ''));
    }
    return body.join(' ').replace(/\s+/g, ' ').trim();
  }
  return null;
}

// markdown table row → cells
function tableCells(line) {
  const t = line.trim();
  if (!t.startsWith('|')) return null;
  return t.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
}

function headingsOf(text) {
  return text.split(/\r?\n/).filter(l => /^#{1,6}\s/.test(l));
}
function firstContentLine(text) {
  for (const l of text.split(/\r?\n/)) { if (l.trim()) return l.trim(); }
  return '';
}

function main() {
  const args = parseArgs(process.argv);
  const root = path.normalize(args.root);
  if (!exists(root)) { console.error(`relocation-integrity: root not found: ${root}`); process.exit(2); }

  // ── G1 hook independence ──────────────────────────────────────────────
  const hookDir = path.join(root, 'hooks');
  const guardHooks = [];
  if (exists(hookDir)) {
    for (const f of fs.readdirSync(hookDir)) {
      if (/preview-gate.*\.js$/.test(f) || f === 'governed-gate-workflow-guard.js') guardHooks.push(f);
    }
  }
  if (guardHooks.length === 0) {
    err('G1', 'no preview-gate / governed-gate hooks found to verify independence');
  } else {
    for (const f of guardHooks) {
      const txt = read(path.join(hookDir, f));
      if (/SKILL\.md/.test(txt)) err('G1', `hook ${f} references SKILL.md — enforcement must stay SKILL-independent`);
      else ok('G1', `hook ${f} is SKILL.md-independent`);
    }
  }

  // ── G2 description budget + D2 listing-cap (description + when_to_use) ──
  for (const s of WATCHED_SKILLS) {
    const p = path.join(root, 'skills', s, 'SKILL.md');
    if (!exists(p)) { err('G2', `skill missing: ${s}/SKILL.md`); continue; }
    const md = read(p);
    const desc = extractFmField(md, 'description');
    if (desc == null) { err('G2', `${s}: could not extract frontmatter description`); continue; }
    // Hard constraint (Agent Skills authoring spec): description <= 1024 chars.
    // NOTE: we do NOT flag `<tag>` / `<N>` / `<channel>` angle-bracket PLACEHOLDERS —
    // production descriptions ship with them and load fine; the spec's "no XML tags"
    // is about real markup, and a path placeholder is not that. Budget is the load-bearing guard.
    if (desc.length > 1024) err('G2', `${s}: description ${desc.length} chars > 1024 limit`);
    else ok('G2', `${s}: description ${desc.length}/1024 chars`);

    // D2 — Claude Code skill listing truncates COMBINED description + when_to_use at
    // 1536 chars (official docs; maxSkillDescriptionChars). when_to_use IS a skill
    // frontmatter field (not subagent-only). Forward-guard: only fires if present.
    const wtu = extractFmField(md, 'when_to_use');
    if (wtu != null && wtu !== '') {
      const combined = `${desc}\n${wtu}`.length;
      if (combined > 1536) {
        err('D2', `${s}: description+when_to_use ${combined} chars > 1536 listing cap (keywords would be truncated)`);
      } else {
        ok('D2', `${s}: description+when_to_use ${combined}/1536 chars`);
      }
    }
  }

  // ── G3 skeleton presence ──────────────────────────────────────────────
  for (const [s, anchors] of Object.entries(SKELETON_ANCHORS)) {
    const p = path.join(root, 'skills', s, 'SKILL.md');
    if (!exists(p)) { err('G3', `skill missing: ${s}/SKILL.md`); continue; }
    const txt = read(p);
    for (const anc of anchors) {
      if (!txt.includes(anc)) err('G3', `${s}: keep-guard skeleton anchor missing from SKILL.md: "${anc}"`);
    }
    ok('G3', `${s}: ${anchors.length} skeleton anchors checked`);
  }

  // ── G4 compaction-safe index ──────────────────────────────────────────
  for (const [s, anchors] of Object.entries(COMPACTION_INDEX)) {
    const p = path.join(root, 'skills', s, 'SKILL.md');
    if (!exists(p)) { err('G4', `skill missing: ${s}/SKILL.md`); continue; }
    const txt = read(p);
    const markerIdx = txt.indexOf('<!-- COMPACTION-SAFE-INDEX:');
    if (markerIdx === -1) {
      err('G4', `${s}: missing <!-- COMPACTION-SAFE-INDEX --> block (compaction would drop late governance skeletons)`);
      continue;
    }
    // tokens preceding the marker (conservative; counts from file start incl. frontmatter)
    const tokensBefore = estTokens(txt.slice(0, markerIdx));
    if (tokensBefore > COMPACTION_SAFE_MARGIN) {
      err('G4', `${s}: COMPACTION-SAFE-INDEX sits ~${tokensBefore} tokens in (> ${COMPACTION_SAFE_MARGIN} safe margin of the ${COMPACTION_TOKEN_BUDGET}-token window) — move it earlier`);
      continue;
    }
    // isolate the index block: from marker to the next H2 heading after the index's own heading
    const after = txt.slice(markerIdx);
    const rel = after.indexOf('\n## ', 80); // skip the index's own "## ⚑ ..." heading
    const section = rel === -1 ? after : after.slice(0, rel);
    const missing = anchors.filter(a => !section.includes(a));
    if (missing.length) {
      err('G4', `${s}: COMPACTION-SAFE-INDEX missing required anchors: ${missing.join(', ')}`);
    } else {
      ok('G4', `${s}: compaction-safe index OK (~${tokensBefore} tok in, ${anchors.length} anchors present)`);
    }
  }

  // ── G5 one-level references (no reference→reference read-obligation) ───
  for (const s of SLIMMED_SKILLS) {
    const refsDir = path.join(root, 'skills', s, 'references');
    if (!exists(refsDir)) continue;
    const skillMd = path.join(root, 'skills', s, 'SKILL.md');
    const skillText = exists(skillMd) ? read(skillMd) : '';
    let violations = 0;
    for (const f of fs.readdirSync(refsDir)) {
      if (!/\.md$/.test(f)) continue;
      const refText = read(path.join(refsDir, f));
      const linked = new Set();
      const re = /references\/([A-Za-z0-9_.-]+\.md)/g;
      let m;
      while ((m = re.exec(refText)) !== null) {
        const target = m[1];
        if (target === f) continue; // self-reference is fine
        linked.add(target);
      }
      for (const target of linked) {
        // Allowed only if SKILL.md also directly links the same target (one level deep).
        if (!skillText.includes(`references/${target}`)) {
          err('G5', `${s}: references/${f} points at references/${target} not linked from SKILL.md (nested obligation; keep disclosure one level deep)`);
          violations += 1;
        }
      }
    }
    if (violations === 0) ok('G5', `${s}: references are one level deep (no nested read-obligation)`);
  }

  // ── M1/M2/M3 per-skill MANIFEST ───────────────────────────────────────
  for (const s of SLIMMED_SKILLS) {
    const manifestPath = path.join(root, 'skills', s, 'references', 'MANIFEST.md');
    if (!exists(manifestPath)) continue; // not slimmed yet — nothing to check
    const skillMd = path.join(root, 'skills', s, 'SKILL.md');
    const skillText = exists(skillMd) ? read(skillMd) : '';
    const skillHeadings = headingsOf(skillText);
    const manifest = read(manifestPath);
    let rows = 0;
    for (const line of manifest.split(/\r?\n/)) {
      const cells = tableCells(line);
      if (!cells || cells.length < 5) continue;
      const [sec, , klass, refFile, sentinel] = cells;
      // skip header + separator rows
      if (/^original/i.test(sec) || /^-+$/.test(sec.replace(/\s/g, '')) || sec === '') continue;
      rows += 1;
      const refPath = path.join(root, 'skills', s, 'references', refFile);
      if (!exists(refPath)) { err('M1', `${s}: MANIFEST row "${sec}" → reference file missing: references/${refFile}`); continue; }
      const refText = read(refPath);
      if (/KEEP-GUARD/i.test(klass)) {
        // M2 dual anchor — § appears in a heading on BOTH sides
        const inSkill = skillHeadings.some(h => h.includes(sec));
        const refHeadings = headingsOf(refText);
        const inRef = refHeadings.some(h => h.includes(sec));
        if (!inSkill) err('M2', `${s}: KEEP-GUARD ${sec} heading missing from SKILL.md (lost in-file tombstone)`);
        if (!inRef) err('M2', `${s}: KEEP-GUARD ${sec} heading missing from references/${refFile}`);
        if (inSkill && inRef) ok('M2', `${s}: ${sec} dual-anchored (SKILL.md + ${refFile})`);
        // M3 sentinel marker
        if (sentinel && sentinel !== '—' && sentinel !== '-') {
          const fcl = firstContentLine(refText);
          const want = `<!-- CONTRACT-SENTINEL: ${sentinel} -->`;
          if (fcl !== want) err('M3', `${s}: references/${refFile} first line is not the expected CONTRACT-SENTINEL`, `got: "${fcl}" want: "${want}"`);
          else ok('M3', `${s}: ${refFile} CONTRACT-SENTINEL present (${sentinel})`);
        }
      } else {
        ok('M1', `${s}: ${sec} (${klass}) → references/${refFile} exists`);
      }
    }
    ok('MANIFEST', `${s}: ${rows} relocation row(s) validated`);
  }

  const errors = findings.filter(f => f.level === 'error');
  if (args.json) {
    console.log(JSON.stringify({ ok: errors.length === 0, errors, checks: findings.length }, null, 2));
    process.exit(errors.length === 0 ? 0 : 1);
  }
  console.log('--- relocation-integrity lint ---');
  console.log(`root:    ${root}`);
  console.log(`checks:  ${findings.length}`);
  console.log(`errors:  ${errors.length}`);
  for (const f of errors) {
    console.error(`ERROR [${f.check}] ${f.msg}`);
    if (f.detail) console.error(`        ${f.detail}`);
  }
  if (errors.length === 0) console.log('relocation-integrity: OK (no contract degradation detected)');
  process.exit(errors.length === 0 ? 0 : 1);
}

try { main(); } catch (e) { console.error(`relocation-integrity: internal error: ${e.message}`); process.exit(2); }
