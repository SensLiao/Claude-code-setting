#!/usr/bin/env node
// canon-bundle.js — canonicalize a qa/appsec release bundle for the gate readers.
//
// EvidenceBundle / evidence-validator agents emit StructuredOutput JSON (indented, quoted keys),
// but gate.check (_qa_assert_canonical_gate_yaml / _qa_extract_scalar) and the Stop hook require a
// COL-0, UNQUOTED, SINGLE `release_decision:` scalar. This converts a JSON bundle to canonical YAML:
//   - release_decision emitted FIRST, at column 0, unquoted (the verdict scalar the gate extracts)
//   - every other top-level key kept; objects/arrays rendered FLOW-STYLE (valid YAML, single line,
//     so nested "decision" keys never collide with the col-0 release_decision dup-key guard)
//   - strings JSON-quoted (safe for non-critical keys); numbers/bools/null bare
//
// Idempotent + safe: non-JSON input (already-canonical YAML, or anything unparseable) is passed
// through UNCHANGED, and a missing release_decision is passed through too — so wiring this into
// evidence.append can never corrupt or drop a bundle.
//
// Usage: node canon-bundle.js < bundle.json   (reads stdin, writes canonical YAML to stdout)
'use strict';

let raw = '';
try { raw = require('fs').readFileSync(0, 'utf8'); } catch (e) { process.exit(0); }

let b;
try { b = JSON.parse(raw); } catch (e) { process.stdout.write(raw); process.exit(0); }
if (!b || typeof b !== 'object' || Array.isArray(b) || !('release_decision' in b)) {
  process.stdout.write(raw);
  process.exit(0);
}

const lines = [];
lines.push('release_decision: ' + String(b.release_decision)); // col-0, unquoted, FIRST
for (const k of Object.keys(b)) {
  if (k === 'release_decision') continue;
  const v = b[k];
  if (v === null) lines.push(k + ': null');
  else if (typeof v === 'number' || typeof v === 'boolean') lines.push(k + ': ' + v);
  else lines.push(k + ': ' + JSON.stringify(v)); // strings quoted; objects/arrays flow-style YAML
}
process.stdout.write(lines.join('\n') + '\n');
