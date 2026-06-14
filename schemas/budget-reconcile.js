#!/usr/bin/env node
'use strict';
/**
 * budget-reconcile.js — estimate-vs-actual budget reconciliation (audit C13). Dependency-free.
 *
 * commercial-cert already gates on an APPROVED estimate (sentinel approved_estimate_high);
 * this computes the ACTUAL-vs-approved variance after the run, as a record embeddable in a
 * run-ledger row's budget_variance field (schemas/budget.schema.json).
 *
 * Usage:
 *   node budget-reconcile.js --estimate-high N [--estimate-low N] --actual N \
 *       [--approved N] [--time-est S] [--time-actual S] [--agent-cost N] [--tool-cost N] \
 *       [--reason "..."] [--run-id ID]
 * Output: budget_variance JSON object to stdout.
 * Exit: 0 within budget · 1 OVERRUN (actual > approved||estimate_high) · 2 bad args.
 */
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
// ★ R3 hardening (2026-06-14): token counts in an AUDIT record must be plain non-negative integers.
// Number() silently accepts hex (0x10→16), scientific (9e4→90000), negatives, decimals, and Infinity,
// which poison the audit trail and can mask an overrun. Require a strict decimal-integer string.
function strictTokenCount(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

function main() {
  const a = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) { const k = a[i].slice(2); o[k] = (a[i + 1] && !a[i + 1].startsWith('--')) ? a[++i] : true; }
  }
  const estimate_high = strictTokenCount(o['estimate-high']);
  const actual_tokens = strictTokenCount(o.actual);
  if (estimate_high == null || actual_tokens == null) {
    console.error('budget-reconcile: bad args — require --estimate-high and --actual as plain non-negative integers (reject hex 0x.., scientific Ne.., negative, decimal, Infinity)');
    process.exit(2);
  }
  const approved = strictTokenCount(o.approved);
  // ★ when no approved ceiling is supplied, the attacker-supplied estimate must not silently become
  // the authoritative ceiling — flag it loudly in the record so a gate consumer can refuse.
  const approved_missing = approved == null;
  const ceiling = approved != null ? approved : estimate_high;
  const overrun = actual_tokens > ceiling;
  const overrun_pct = ceiling > 0 ? Math.round(((actual_tokens - ceiling) / ceiling) * 1000) / 10 : null;
  const rec = {
    run_id: typeof o['run-id'] === 'string' ? o['run-id'] : undefined,
    estimate_low: num(o['estimate-low']),
    estimate_high,
    approved_estimate_high: approved,
    approved_missing,
    actual_tokens,
    estimate_time_s: num(o['time-est']),
    actual_time_s: num(o['time-actual']),
    agent_cost: num(o['agent-cost']),
    tool_cost: num(o['tool-cost']),
    overrun,
    overrun_pct: overrun ? overrun_pct : 0,
    overrun_reason: overrun ? (typeof o.reason === 'string' ? o.reason : null) : null,
  };
  Object.keys(rec).forEach((k) => { if (rec[k] === undefined) delete rec[k]; });
  process.stdout.write(JSON.stringify(rec) + '\n');
  process.exit(overrun ? 1 : 0);
}
main();
