#!/usr/bin/env node
/**
 * Self-test for verdict-validator.js. Run: node test/run.js
 * Exit 0 = all pass, 1 = any failure. No external deps.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const V = require('../verdict-validator.js');

let pass = 0, fail = 0;
const fails = [];
function check(name, cond) {
  if (cond) { pass++; }
  else { fail++; fails.push(name); process.stderr.write(`  ✗ ${name}\n`); }
}

const FP = 'sha256:' + 'a'.repeat(64);
const goodProv = { written_by: 'qa-sdk@3.2.0', run_fingerprint: FP };

function base(extra) {
  return Object.assign({
    decision: 'PASS',
    reason: 'all green',
    evidence_refs: ['evidence/qa/rel/layers.json'],
    timestamp: '2026-06-05T10:00:00Z',
    gate_tag: 'release-v1.4.0',
    subsystem: 'qa',
  }, extra || {});
}

// ---- Part 1: schema cases ----
const schemaCases = [
  ['valid minimal', base(), {}, true],
  ['valid all-fields + provenance', base({ schema_version: '1.0.0', provenance: goodProv }), {}, true],
  ['bad enum value', base({ decision: 'APPROVED' }), {}, false],
  ['missing required gate_tag', (() => { const o = base(); delete o.gate_tag; return o; })(), {}, false],
  ['missing required reason', (() => { const o = base(); delete o.reason; return o; })(), {}, false],
  ['empty reason (minLength)', base({ reason: '' }), {}, false],
  ['bad gate_tag (space)', base({ gate_tag: 'release v1' }), {}, false],
  ['bad gate_tag (illegal char #)', base({ gate_tag: 'rel#1' }), {}, false],
  ['bad timestamp (not iso)', base({ timestamp: 'yesterday' }), {}, false],
  ['bad timestamp (impossible date)', base({ timestamp: '2026-13-99T99:99:99Z' }), {}, false],
  ['additionalProperty rejected', base({ sneaky: true }), {}, false],
  ['evidence_refs not unique', base({ evidence_refs: ['a', 'a'] }), {}, false],
  ['evidence_refs empty allowed', base({ evidence_refs: [] }), {}, true],
  ['subsystem bad enum', base({ subsystem: 'marketing' }), {}, false],
  ['schema_version bad pattern', base({ schema_version: '1.0' }), {}, false],
  ['decision wrong type (number)', base({ decision: 5 }), {}, false],
  ['STRATEGY_READY ok without release-context', base({ decision: 'STRATEGY_READY' }), {}, true],
  // stress-1 regressions: calendar-invalid timestamps must be REJECTED (Date.parse rollover fixed)
  ['ts Feb 30 invalid', base({ timestamp: '2026-02-30T10:00:00Z' }), {}, false],
  ['ts Apr 31 invalid', base({ timestamp: '2026-04-31T10:00:00Z' }), {}, false],
  ['ts hour 24 invalid', base({ timestamp: '2026-06-05T24:00:00Z' }), {}, false],
  ['ts min 60 invalid', base({ timestamp: '2026-06-05T10:60:00Z' }), {}, false],
  ['ts Feb 29 non-leap 2025 invalid', base({ timestamp: '2025-02-29T10:00:00Z' }), {}, false],
  ['ts Feb 29 century non-leap 1900 invalid', base({ timestamp: '1900-02-29T10:00:00Z' }), {}, false],
  ['ts Feb 29 leap 2024 valid', base({ timestamp: '2024-02-29T10:00:00Z' }), {}, true],
  ['ts with +08:00 offset valid', base({ timestamp: '2026-06-05T10:00:00+08:00' }), {}, true],
  ['ts with bad +25:00 offset invalid', base({ timestamp: '2026-06-05T10:00:00+25:00' }), {}, false],
];
for (const [name, obj, opts, expectOk] of schemaCases) {
  const r = V.validateVerdict(obj, opts);
  check(`schema: ${name} (expect ok=${expectOk})`, r.ok === expectOk);
}

// ---- Part 2: provenance cases (--require-provenance) ----
const provCases = [
  ['valid provenance', base({ provenance: goodProv }), true],
  ['no provenance block', base(), false],
  ['spoofed fingerprint (not sha256)', base({ provenance: { written_by: 'qa-sdk@3', run_fingerprint: 'trust-me' } }), false],
  ['short hex fingerprint', base({ provenance: { written_by: 'qa-sdk@3', run_fingerprint: 'sha256:abc' } }), false],
  ['written_by not an sdk', base({ provenance: { written_by: 'claude', run_fingerprint: FP } }), false],
  ['written_by gsd-sdk accepted (subsystem enum includes gsd)', base({ provenance: { written_by: 'gsd-sdk@1.0', run_fingerprint: FP } }), true],
  ['written_by wrong subsystem prefix', base({ provenance: { written_by: 'marketing-sdk@1', run_fingerprint: FP } }), false],
  ['bad spec_hash if present', base({ provenance: { written_by: 'qa-sdk@3', run_fingerprint: FP, spec_hash: 'nope' } }), false],
];
for (const [name, obj, expectOk] of provCases) {
  const r = V.validateVerdict(obj, { requireProvenance: true });
  check(`provenance: ${name} (expect ok=${expectOk})`, r.ok === expectOk);
}

// ---- Part 3: release-context semantics ----
const relCases = [
  ['PASS in release', base({ decision: 'PASS' }), true],
  ['STRATEGY_READY rejected in release', base({ decision: 'STRATEGY_READY' }), false],
  ['CONDITIONAL_PASS without ref rejected', base({ decision: 'CONDITIONAL_PASS' }), false],
  ['CONDITIONAL_PASS with top-level ref', base({ decision: 'CONDITIONAL_PASS', explicit_risk_acceptance_ref: 'JIRA-123' }), false],
  ['CONDITIONAL_PASS with ref allowed (additionalProps off → must be in provenance)', base({ decision: 'CONDITIONAL_PASS', provenance: Object.assign({}, goodProv, { explicit_risk_acceptance_ref: 'ADR-9' }) }), true],
  // stress-2 regressions: blocks_release decisions must NOT pass a release-context gate
  ['FAIL blocked in release', base({ decision: 'FAIL' }), false],
  ['BLOCKED blocked in release', base({ decision: 'BLOCKED' }), false],
  ['STALE blocked in release', base({ decision: 'STALE' }), false],
  ['WARN allowed in release', base({ decision: 'WARN' }), true],
];
// NOTE: top-level explicit_risk_acceptance_ref is an additionalProperty (schema additionalProperties:false)
// so it fails schema; the canonical place is inside provenance. This case documents that.
for (const [name, obj, expectOk] of relCases) {
  const r = V.validateVerdict(obj, { releaseContext: true });
  check(`release: ${name} (expect ok=${expectOk})`, r.ok === expectOk);
}

// ---- Part 4: file reading (JSON + flat-YAML + fail-closed) ----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vv-'));
function writeF(name, content) { const p = path.join(tmp, name); fs.writeFileSync(p, content, 'utf8'); return p; }

const jf = writeF('v.json', JSON.stringify(base({ provenance: goodProv })));
check('read JSON file', V.readVerdictFile(jf).decision === 'PASS');

const yamlGood = [
  '# written-by: qa-sdk@3.2.0',
  'decision: PASS',
  'reason: "all green"',
  'gate_tag: release-v1.4.0',
  'timestamp: 2026-06-05T10:00:00Z',
  'subsystem: qa',
  'evidence_refs:',
  '  - evidence/qa/rel/layers.json',
  '  - evidence/qa/rel/a11y.json',
  'provenance:',
  '  written_by: qa-sdk@3.2.0',
  '  run_fingerprint: ' + FP,
].join('\n');
const yf = writeF('v.yaml', yamlGood);
const yObj = V.readVerdictFile(yf);
check('read YAML: decision', yObj.decision === 'PASS');
check('read YAML: seq parsed', Array.isArray(yObj.evidence_refs) && yObj.evidence_refs.length === 2);
check('read YAML: nested map parsed', yObj.provenance && yObj.provenance.run_fingerprint === FP);
check('read YAML: comment stripped (no extra key)', !('written-by' in yObj));
check('YAML validates ok with provenance', V.validateVerdict(yObj, { requireProvenance: true, releaseContext: true }).ok === true);

// fail-closed: malformed / unsupported YAML must THROW (never silently mis-parse)
const badYaml = writeF('bad.yaml', 'decision: PASS\n\tweird: [a, b, {x: 1}]\n  - dangling');
let threw = false;
try { V.readVerdictFile(badYaml); } catch { threw = true; }
check('fail-closed: malformed YAML throws', threw);

// deep nesting unsupported → throws
const deepYaml = writeF('deep.yaml', 'provenance:\n  nested:\n    too: deep');
let threw2 = false;
try { V.readVerdictFile(deepYaml); } catch { threw2 = true; }
check('fail-closed: deep nesting throws', threw2);

// ---- Part 5: stress-3 regressions (silent mis-parse / false-reject) ----
function throwsCase(name, content) {
  const p = writeF(name.replace(/[^a-z0-9]/gi, '_') + '.yaml', content);
  let t = false; try { V.readVerdictFile(p); } catch { t = true; }
  check(name, t);
}
throwsCase('fail-closed: duplicate top-level key throws',
  'decision: FAIL\ndecision: PASS\nreason: x\ngate_tag: r\ntimestamp: 2026-06-05T10:00:00Z\nevidence_refs: []\n');
throwsCase('fail-closed: duplicate nested key throws',
  'provenance:\n  written_by: qa-sdk@1\n  written_by: qa-sdk@2\n');
throwsCase('fail-closed: flow-style seq value throws', 'reason: [a, b, c]\n');
throwsCase('fail-closed: flow-style map value throws', 'reason: {summary: ok}\n');
throwsCase('fail-closed: sequence-of-maps throws', 'evidence_refs:\n  - key: val\n');

// evidence_refs: [] must round-trip to a REAL empty array (was a false-reject) and validate
const emptyRefs = writeF('empty.yaml', [
  '# written-by: qa-sdk@3.2.0',
  'decision: PASS', 'reason: ok', 'gate_tag: r', 'timestamp: 2026-06-05T10:00:00Z',
  'subsystem: qa', 'evidence_refs: []',
  'provenance:', '  written_by: qa-sdk@3.2.0', '  run_fingerprint: ' + FP,
].join('\n'));
const er = V.readVerdictFile(emptyRefs);
check('evidence_refs:[] -> real empty array', Array.isArray(er.evidence_refs) && er.evidence_refs.length === 0);
check('evidence_refs:[] validates ok', V.validateVerdict(er, { requireProvenance: true, releaseContext: true }).ok === true);

// URI / Windows-path seq items must NOT be mis-detected as maps
const uriRefs = writeF('uri.yaml', [
  'decision: PASS', 'reason: ok', 'gate_tag: r', 'timestamp: 2026-06-05T10:00:00Z',
  'evidence_refs:', '  - https://example.com/report', '  - C:/evidence/x.json',
].join('\n'));
const ur = V.readVerdictFile(uriRefs);
check('URI/Windows-path seq items parse as 2 strings (not maps)',
  Array.isArray(ur.evidence_refs) && ur.evidence_refs.length === 2 && ur.evidence_refs[0] === 'https://example.com/report');

// '#' inside a quoted value must NOT be stripped as a comment
const hashInVal = writeF('hash.yaml',
  'reason: "done # not-a-comment"\ndecision: PASS\ngate_tag: r\ntimestamp: 2026-06-05T10:00:00Z\nevidence_refs: []\n');
const hv = V.readVerdictFile(hashInVal);
check('# inside quotes preserved', hv.reason === 'done # not-a-comment');

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}

// ---- Part 6: round-3 hardening regressions (codex code-review + BOM re-attack) ----
const tmp6 = fs.mkdtempSync(path.join(os.tmpdir(), 'vv6-'));
const w6 = (n, c) => { const p = path.join(tmp6, n); fs.writeFileSync(p, c, 'utf8'); return p; };
function throws6(name, n, c) { let t = false; try { V.readVerdictFile(w6(n, c)); } catch { t = true; } check(name, t); }

// trailing-newline must not false-accept (JS $ is end-strict; verify the guards)
check('r3: run_fingerprint trailing-newline rejected', V.validateVerdict(base({ provenance: { written_by: 'qa-sdk@3', run_fingerprint: FP + '\n' } }), { requireProvenance: true }).ok === false);
check('r3: timestamp trailing-newline rejected', V.validateVerdict(base({ timestamp: '2026-06-05T10:00:00Z\n' }), {}).ok === false);
check('r3: gate_tag trailing-newline rejected', V.validateVerdict(base({ gate_tag: 'rel-1\n' }), {}).ok === false);

// prototype pollution
throws6('r3: __proto__ YAML key throws', 'proto.yaml', '__proto__: x\n');
const inh = Object.create({ provenance: { written_by: 'qa-sdk@1', run_fingerprint: FP } });
Object.assign(inh, { decision: 'PASS', reason: 'x', evidence_refs: [], timestamp: '2026-06-05T10:00:00Z', gate_tag: 'r' });
check('r3: inherited provenance NOT honored (hasOwn)', V.validateVerdict(inh, { requireProvenance: true }).ok === false);
fs.writeFileSync(path.join(tmp6, 'p.json'), '{"__proto__":1,"decision":"PASS","reason":"x","evidence_refs":[],"timestamp":"2026-06-05T10:00:00Z","gate_tag":"r"}', 'utf8');
check('r3: JSON __proto__ own-key rejected by additionalProperties', V.validateVerdict(V.readVerdictFile(path.join(tmp6, 'p.json'))).ok === false);

// YAML scalar strictness
throws6('r3: block scalar throws', 'b.yaml', 'reason: |\n');
throws6('r3: tag throws', 't.yaml', 'reason: !!str x\n');
throws6('r3: anchor throws', 'an.yaml', 'reason: &a x\n');
throws6('r3: unbalanced quote throws', 'uq.yaml', 'reason: "oops\n');

// broadened seq-of-map: hyphen/space keys throw; URIs/paths still OK
throws6('r3: seq-of-map hyphen-key throws', 'h.yaml', 'evidence_refs:\n  - gate-tag: x\n');
throws6('r3: seq-of-map space-before-colon throws', 'sp.yaml', 'evidence_refs:\n  - key : x\n');
const okRefs = V.readVerdictFile(w6('ok.yaml', 'evidence_refs:\n  - https://x/y\n  - C:/e/a.json\n'));
check('r3: URI/path seq items still parse (not flagged as maps)', Array.isArray(okRefs.evidence_refs) && okRefs.evidence_refs.length === 2);

// BOM-prefixed files parse (DEFECT A) — construct the BOM explicitly to avoid invisible chars
const BOM = String.fromCharCode(0xFEFF);
check('r3: leading-BOM yaml parses', V.readVerdictFile(w6('bom.yaml', BOM + 'decision: PASS\nreason: ok\ngate_tag: r\ntimestamp: 2026-06-05T10:00:00Z\nevidence_refs: []\n')).decision === 'PASS');
check('r3: leading-BOM json parses', V.readVerdictFile(w6('bom.json', BOM + JSON.stringify(base()))).decision === 'PASS');

// default-deny: a valid-enum decision not classified in x-release-semantics is blocked
const schemaCopy = JSON.parse(JSON.stringify(V.loadDefaultSchema()));
schemaCopy.properties.decision.enum.push('MAYBE');
check('r3: default-deny unclassified decision blocked in release', V.validateVerdict(base({ decision: 'MAYBE' }), { schema: schemaCopy, releaseContext: true }).ok === false);

try { fs.rmSync(tmp6, { recursive: true, force: true }); } catch {}

// ---- summary ----
process.stdout.write(`\nverdict-validator self-test: ${pass} passed, ${fail} failed\n`);
if (fail) { process.stderr.write(`FAILURES:\n  - ${fails.join('\n  - ')}\n`); process.exit(1); }
process.exit(0);
