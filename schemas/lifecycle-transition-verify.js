#!/usr/bin/env node
'use strict';
/**
 * lifecycle-transition-verify.js — 9-state vulnerability lifecycle enforcement (audit C11).
 *
 * Two modes:
 *   1. transition: `node lifecycle-transition-verify.js <from> <to>`
 *      exit 0 legal · 1 illegal jump · 2 unknown state. Blocks e.g. OPEN->FIXED.
 *   2. sweep: `node lifecycle-transition-verify.js --sweep <findings.json|->`
 *      reads an array of {id,status,exception_expiry}; any ACCEPTED_RISK whose
 *      exception_expiry < now is an expired exception that MUST be reopened to
 *      EXPIRED_EXCEPTION. Prints them; exit 1 if any expired, 0 if clean, 2 on read error.
 *
 * Dependency-free. State machine mirrors schemas/vuln-lifecycle.schema.json x-transitions.
 */
const fs = require('fs');

const STATES = ['OPEN', 'TRIAGED', 'FIXING', 'FIXED', 'RETEST_REQUIRED', 'RETEST_FAILED', 'ACCEPTED_RISK', 'EXPIRED_EXCEPTION', 'CLOSED'];
const T = {
  OPEN: ['TRIAGED', 'ACCEPTED_RISK'],
  TRIAGED: ['FIXING', 'ACCEPTED_RISK'],
  FIXING: ['FIXED', 'RETEST_REQUIRED'],
  FIXED: ['RETEST_REQUIRED', 'CLOSED'],
  RETEST_REQUIRED: ['RETEST_FAILED', 'CLOSED'],
  RETEST_FAILED: ['FIXING', 'ACCEPTED_RISK'],
  ACCEPTED_RISK: ['EXPIRED_EXCEPTION', 'CLOSED', 'FIXING'],
  EXPIRED_EXCEPTION: ['FIXING', 'TRIAGED', 'ACCEPTED_RISK'],
  CLOSED: ['OPEN'],
};

function legal(from, to) { return STATES.includes(from) && STATES.includes(to) && (T[from] || []).includes(to); }

// ★ R3 adversarial-sweep hardening (2026-06-14): an ACCEPTED_RISK exception is only valid while
// it carries a PARSEABLE ISO-8601 expiry that is still in the future. Previously a MISSING expiry
// (eternal exception), an UNPARSEABLE/locale-ambiguous expiry (Date.parse→NaN, NaN<now is false),
// or a case-variant status ("accepted_risk") all silently passed the sweep = fail-open. Now all of
// those fail-closed (flagged) — you cannot prove an exception is still authorized without a real
// future ISO expiry. ISO_RE accepts date-only (2026-12-01) and full timestamps, rejects 01/02/2099.
const ISO_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
function sweep(findings, nowMs) {
  const expired = [];
  for (const f of (Array.isArray(findings) ? findings : [])) {
    if (!f || typeof f !== 'object') continue;
    const status = String(f.status == null ? '' : f.status).trim().toUpperCase();
    if (status !== 'ACCEPTED_RISK') continue;
    const id = f.id || f.finding_id || '(no id)';
    const raw = f.exception_expiry;
    if (raw == null || String(raw).trim() === '') { expired.push({ id, exception_expiry: '(missing)', reason: 'no exception_expiry — exception is not time-bound' }); continue; }
    const exp = String(raw).trim();
    const t = Date.parse(exp);
    if (!ISO_RE.test(exp) || Number.isNaN(t)) { expired.push({ id, exception_expiry: exp, reason: 'unparseable/non-ISO expiry — cannot prove still authorized' }); continue; }
    if (t < nowMs) { expired.push({ id, exception_expiry: exp, reason: 'expired' }); }
  }
  return expired;
}

module.exports = { legal, sweep, STATES, TRANSITIONS: T };

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv[0] === '--sweep') {
    const src = argv[1] || '-';
    let raw;
    try { raw = (src === '-') ? fs.readFileSync(0, 'utf8') : fs.readFileSync(src, 'utf8'); }
    catch (e) { console.error(`lifecycle sweep: BLOCKED — read error: ${e.message}`); process.exit(2); }
    let doc;
    try { doc = JSON.parse(raw); } catch (e) { console.error(`lifecycle sweep: BLOCKED — parse error: ${e.message}`); process.exit(2); }
    // ★ R3 hardening — a malformed audit (neither an array nor {findings:[...]}) must NOT be
    // silently coerced to "zero findings = clean". Fail-closed.
    const findings = Array.isArray(doc) ? doc : (doc && Array.isArray(doc.findings) ? doc.findings : null);
    if (findings === null) {
      console.error('lifecycle sweep: BLOCKED — input is neither a findings array nor {findings:[...]} (fail-closed; refusing to treat a malformed audit as clean)');
      process.exit(2);
    }
    const expired = sweep(findings, Date.now());
    if (expired.length) {
      console.error(`lifecycle sweep: ${expired.length} invalid/expired exception(s) — must reopen to EXPIRED_EXCEPTION:`);
      expired.forEach((e) => console.error(`  - ${e.id} (${e.reason || 'expired'}: ${e.exception_expiry})`));
      process.exit(1);
    }
    console.log('lifecycle sweep: clean — no ACCEPTED_RISK exception past its expiry.');
    process.exit(0);
  }
  const [from, to] = argv;
  if (!from || !to) { console.error('Usage: lifecycle-transition-verify.js <from> <to> | --sweep <findings.json|->'); process.exit(2); }
  if (!STATES.includes(from) || !STATES.includes(to)) { console.error(`lifecycle: BLOCKED — unknown state (valid: ${STATES.join(', ')})`); process.exit(2); }
  if (legal(from, to)) { console.log(`lifecycle: OK — ${from} -> ${to} is legal`); process.exit(0); }
  console.error(`lifecycle: ILLEGAL transition ${from} -> ${to} (allowed from ${from}: ${(T[from] || []).join(', ') || 'none'})`);
  process.exit(1);
}
