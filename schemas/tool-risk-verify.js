#!/usr/bin/env node
'use strict';
/**
 * tool-risk-verify.js — tool / MCP risk registry gate (the AI-native permissions check).
 *
 * Audit C5 ("most real gap"): tools were a name in a list, not a permission
 * boundary. As Claude Code leans on MCP (direct read/write of GitHub/Jira/DB/
 * secrets), an unclassified high-risk tool is an ungoverned blast radius. This
 * enforces the T0-T6 ladder's high end:
 *   - every T4/T5/T6 tool MUST declare requires_approval[]
 *   - T5 (credential-data) / T6 (active-security) MUST also declare evidence_required[]
 *   - T6 default_policy MUST be roe-manual-only (active scanning is never auto)
 *   - --require-registry + missing file → BLOCKED (cannot prove tool safety)
 *
 * Dependency-free. JSON registry (tool-risk.schema.json).
 *
 * Usage:  node tool-risk-verify.js <registry.json> [--require-registry]
 * Exit:   0 PASS/SKIP · 1 FAIL (policy) · 2 BLOCKED (missing-when-required / unreadable)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const HIGH = new Set(['T4', 'T5', 'T6']);

// ★ R3 hardening (2026-06-14) — authoritative seed for anti-downgrade cross-check.
function loadSeed() {
  const candidates = [
    path.join(os.homedir(), '.claude', 'templates', 'harness', 'tool-risk.seed.json'),
    path.join(__dirname, '..', 'templates', 'harness', 'tool-risk.seed.json'),
  ];
  for (const p of candidates) {
    try { const d = JSON.parse(fs.readFileSync(p, 'utf8')); if (d && Array.isArray(d.tools)) return d.tools; } catch (_e) { /* try next */ }
  }
  return null;
}
function tierNum(t) { return (typeof t === 'string' && /^T[0-6]$/.test(t)) ? Number(t[1]) : null; }

function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const requireRegistry = args.includes('--require-registry');

  if (!file || !fs.existsSync(file)) {
    if (requireRegistry) { console.error(`tool-risk-verify: BLOCKED — registry required but missing: ${file || '(none)'}`); process.exit(2); }
    console.log('tool-risk-verify: SKIP — no registry present (not required at this level).');
    process.exit(0);
  }
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { console.error(`tool-risk-verify: BLOCKED — parse error: ${e.message}`); process.exit(2); }

  // A present-but-malformed registry must BLOCK, not silently pass: the schema requires tools[]
  // and gate.check treats a present registry as enforced (codex review P2, 2026-06-14).
  if (!Array.isArray(doc.tools)) {
    console.error('tool-risk-verify: BLOCKED — registry malformed: missing or non-array tools[] (schema requires it)');
    process.exit(2);
  }
  const tools = doc.tools;
  const fails = [];
  let high = 0;
  const seed = loadSeed();
  const seedMap = new Map();
  if (seed) for (const s of seed) { const n = tierNum(s.risk_tier); if (s.tool_id && n != null) seedMap.set(s.tool_id, n); }
  // empty-string elements ([""]) are not a real approver / evidence ref — require non-empty content.
  const nonEmptyArr = (a) => Array.isArray(a) && a.some((e) => typeof e === 'string' && e.trim().length > 0);
  for (const t of tools) {
    const id = t.tool_id || '(no id)';
    // ★ require risk_tier be a STRING enum — an array like ["T6"] coerces through the regex
    // (String(["T6"])==="T6") yet HIGH.has(["T6"]) is false, silently SKIPPING all T4+ checks.
    if (typeof t.risk_tier !== 'string' || !/^T[0-6]$/.test(t.risk_tier)) { fails.push(`${id}: invalid/missing risk_tier (must be a string "T0".."T6")`); continue; }
    // ★ anti-downgrade — a tool the authoritative seed classifies high cannot self-declare lower.
    // (NOTE residual: a project-specific tool ABSENT from the seed can still self-declare T0 — the
    // verifier cannot divine an unknown tool's true risk; the registry is authoritative for the
    // project's own surface. Anti-downgrade only binds tools the seed already knows.)
    const tid = typeof t.tool_id === 'string' ? t.tool_id.trim() : t.tool_id;
    const sn = seedMap.get(tid);
    const dn = tierNum(t.risk_tier);
    if (sn != null && dn != null && dn < sn) fails.push(`${id}: declared ${t.risk_tier} but the authoritative seed classifies it T${sn} (downgrade forbidden)`);
    // ★ tier-vs-capabilities consistency — catches an UNKNOWN tool self-declaring low while admitting
    // dangerous capabilities (the seed can only bind tools it knows; capabilities bind the rest).
    const cap = t.capabilities;
    if (cap && typeof cap === 'object' && dn != null) {
      // Seed-consistent floor: Bash is legitimately T2 with ALL caps true (local command-exec), so
      // capabilities booleans alone cannot pin a high tier (local vs external is in side_effect, not
      // the booleans). We therefore ONLY constrain the read-only tiers, which is unambiguous:
      //   T0 = strictly read-only (Read/Grep/Glob — every capability false)
      //   T1 = local-write only (Edit/Write — no secret/exec/network)
      // This still catches an unknown tool self-declaring T0/T1 while admitting dangerous capabilities.
      const danger = [];
      if (cap.write === true) danger.push('write');
      if (cap.secret === true) danger.push('secret');
      if (cap.exec === true) danger.push('exec');
      if (cap.network === true) danger.push('network');
      if (dn === 0 && danger.length) {
        fails.push(`${id}: risk_tier T0 (read-only) inconsistent with declared capabilities [${danger.join(',')}] — a tool with side effects cannot be T0`);
      } else if (dn === 1 && (cap.secret === true || cap.exec === true || cap.network === true)) {
        fails.push(`${id}: risk_tier T1 (local-write) inconsistent with secret/exec/network capability — classify higher`);
      }
    }
    if (HIGH.has(t.risk_tier)) {
      high++;
      if (!nonEmptyArr(t.requires_approval)) fails.push(`${id} (${t.risk_tier}): high-risk tool must declare a non-empty requires_approval[] (an empty/blank element does not count)`);
      if ((t.risk_tier === 'T5' || t.risk_tier === 'T6') && !nonEmptyArr(t.evidence_required)) fails.push(`${id} (${t.risk_tier}): must declare a non-empty evidence_required[]`);
      if (t.risk_tier === 'T6' && t.default_policy !== 'roe-manual-only') fails.push(`${id} (T6 active-security): default_policy must be roe-manual-only (got '${t.default_policy}')`);
    }
  }
  // ★ duplicate tool_id — a later T0 duplicate of an earlier T5 entry could downgrade governance
  // depending on the consumer; an ambiguous registry must be refused.
  {
    const seenTid = new Set();
    for (const t of tools) {
      const tid = typeof t.tool_id === 'string' ? t.tool_id.trim() : null;
      if (!tid) continue;
      if (seenTid.has(tid)) fails.push(`duplicate tool_id '${tid}' (ambiguous registry — refusing to guess which entry governs)`);
      seenTid.add(tid);
    }
  }
  console.log(`tool-risk-verify: tools=${tools.length} high-tier(T4+)=${high}`);
  if (fails.length) { console.error('tool-risk-verify: FAIL — tool-risk policy violations:'); fails.forEach((f) => console.error('  - ' + f)); process.exit(1); }
  console.log('tool-risk-verify: PASS — all high-risk tools are approval/evidence-bound.');
  process.exit(0);
}
main();
