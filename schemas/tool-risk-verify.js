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
const HIGH = new Set(['T4', 'T5', 'T6']);

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
  for (const t of tools) {
    const id = t.tool_id || '(no id)';
    if (!t.risk_tier || !/^T[0-6]$/.test(t.risk_tier)) { fails.push(`${id}: invalid/missing risk_tier`); continue; }
    if (HIGH.has(t.risk_tier)) {
      high++;
      if (!Array.isArray(t.requires_approval) || !t.requires_approval.length) fails.push(`${id} (${t.risk_tier}): high-risk tool must declare requires_approval[]`);
      if ((t.risk_tier === 'T5' || t.risk_tier === 'T6') && (!Array.isArray(t.evidence_required) || !t.evidence_required.length)) fails.push(`${id} (${t.risk_tier}): must declare evidence_required[]`);
      if (t.risk_tier === 'T6' && t.default_policy !== 'roe-manual-only') fails.push(`${id} (T6 active-security): default_policy must be roe-manual-only (got '${t.default_policy}')`);
    }
  }
  console.log(`tool-risk-verify: tools=${tools.length} high-tier(T4+)=${high}`);
  if (fails.length) { console.error('tool-risk-verify: FAIL — tool-risk policy violations:'); fails.forEach((f) => console.error('  - ' + f)); process.exit(1); }
  console.log('tool-risk-verify: PASS — all high-risk tools are approval/evidence-bound.');
  process.exit(0);
}
main();
