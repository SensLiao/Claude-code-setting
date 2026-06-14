#!/usr/bin/env node
'use strict';
/**
 * control-matrix-verify.js — turn a control-check-map into a gate input.
 *
 * The audit (C15) found control-matrix.template.yaml + a 24KB crosswalk existed
 * but fed 0 gate ("governance theater"). This is the missing teeth. It reads a
 * control-check-map.json (schema: control-check-map.schema.json) and enforces:
 *   - status:covered MUST have a resolvable evidence_ref (file on disk, or a
 *     non-file anchor #.../urn:.../http...). Covered-without-proof → FAIL.
 *   - at gate_level=regulated, a critical/high control left gap/not_assessed → BLOCKED.
 *
 * Dependency-free (no ajv/js-yaml — harness convention). JSON in; the YAML
 * authoring template (control-matrix.template.yaml) is converted to this JSON
 * machine form upstream.
 *
 * Usage:  node control-matrix-verify.js <map.json> [project-root] [--level baseline|elevated|regulated]
 * Exit:   0 PASS · 1 FAIL (covered w/o evidence) · 2 BLOCKED (unreadable / regulated high gap)
 */
const fs = require('fs');
const path = require('path');

// ★ R3 adversarial-sweep hardening (2026-06-14, Codex+main cross-review): evidence_ref previously
// accepted (a) ABSOLUTE paths to any existing system file, (b) `../`-TRAVERSAL escaping the project,
// (c) DIRECTORIES (existsSync, no isFile), (d) symlinks pointing outside the project. A covered
// control's evidence MUST be a real FILE contained within the project root. We realpath BOTH sides
// (defeats symlink escape) then use path.relative containment (defeats `repo` vs `repo-evil` prefix
// tricks, absolute paths, Windows extended/UNC/drive-relative paths, mixed separators).
function resolveContainedFile(root, ref) {
  let rootReal;
  try { rootReal = fs.realpathSync.native(root); } catch (_e) { rootReal = path.resolve(root); }
  const abs = path.isAbsolute(ref) ? ref : path.join(rootReal, ref);
  let targetReal;
  try { targetReal = fs.realpathSync.native(abs); } catch (_e) { return { ok: false, reason: 'not found on disk (covered evidence must exist)' }; }
  let st;
  try { st = fs.statSync(targetReal); } catch (_e) { return { ok: false, reason: 'not found on disk' }; }
  if (!st.isFile()) return { ok: false, reason: 'is not a file (directory/special — not an evidence artifact)' };
  const rel = path.relative(rootReal, targetReal);
  if (rel === '' || rel === '..' || rel.startsWith('..' + path.sep) || rel.startsWith('../') || path.isAbsolute(rel)) {
    return { ok: false, reason: `escapes the project root (resolves to ${targetReal})` };
  }
  return { ok: true };
}
// Severity match is case-insensitive + trimmed (a "Critical"/"HIGH" label must not evade regulated block).
function isHighSeverity(s) { return ['critical', 'high'].includes(String(s == null ? '' : s).toLowerCase().trim()); }

function main() {
  const args = process.argv.slice(2);
  const mapFile = args.find((a) => !a.startsWith('--'));
  let projectRoot = process.cwd();
  let level = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--level') level = args[++i];
    else if (!args[i].startsWith('--') && args[i] !== mapFile) projectRoot = args[i];
  }
  if (!mapFile) { console.error('control-matrix-verify: BLOCKED — missing <map.json>'); process.exit(2); }
  let doc;
  try { doc = JSON.parse(fs.readFileSync(mapFile, 'utf8')); }
  catch (e) { console.error(`control-matrix-verify: BLOCKED — cannot read/parse ${mapFile}: ${e.message}`); process.exit(2); }

  const bindings = Array.isArray(doc.bindings) ? doc.bindings : [];
  level = level || doc.gate_level || 'baseline';
  const fails = [];
  const blocks = [];
  let covered = 0, gaps = 0, notAssessed = 0, na = 0;

  for (const b of bindings) {
    const id = b.control_id || '(no id)';
    const sev = b.severity_if_gap;
    if (b.status === 'covered') {
      covered++;
      const ref = b.evidence_ref;
      if (!ref || !String(ref).trim()) { fails.push(`${id}: status=covered but evidence_ref is empty`); continue; }
      const refStr = String(ref).trim();
      if (/^(#|urn:|https?:)/.test(refStr)) {
        // Non-file anchors are accepted at baseline/elevated (documented design), but at the
        // regulated level a critical/high control "covered" by a bare anchor = zero resolvable
        // evidence — require a real in-project file. (Otherwise https://example.com is the new "#".)
        if (level === 'regulated' && isHighSeverity(sev)) {
          fails.push(`${id}: regulated ${sev} control marked covered by a non-file anchor evidence_ref (${refStr}) — requires resolvable in-project FILE evidence`);
        }
      } else {
        const c = resolveContainedFile(projectRoot, refStr);
        if (!c.ok) fails.push(`${id}: evidence_ref ${c.reason}: ${refStr}`);
      }
    } else if (b.status === 'gap') {
      gaps++;
      if (level === 'regulated' && isHighSeverity(sev)) blocks.push(`${id}: ${sev} gap not allowed at regulated level`);
    } else if (b.status === 'not_applicable') {
      na++;
    } else {
      notAssessed++;
      if (level === 'regulated' && isHighSeverity(sev)) blocks.push(`${id}: ${sev} control not_assessed at regulated level`);
    }
  }

  console.log(`control-matrix-verify: level=${level} bindings=${bindings.length} covered=${covered} gap=${gaps} not_assessed=${notAssessed} n/a=${na}`);
  if (blocks.length) { console.error('control-matrix-verify: BLOCKED'); blocks.forEach((v) => console.error('  - ' + v)); process.exit(2); }
  if (fails.length) { console.error('control-matrix-verify: FAIL — covered controls missing evidence:'); fails.forEach((v) => console.error('  - ' + v)); process.exit(1); }
  console.log('control-matrix-verify: PASS — every covered control has resolvable evidence.');
  process.exit(0);
}
main();
