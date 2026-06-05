#!/usr/bin/env node
//
// unit-resolve-model.js — Patch A.4 unit test
//
// Verifies:
//   1. resolveModel() alias → literal mapping is correct
//   2. Per-project override wins over default mapping
//   3. Legacy literals (haiku/sonnet/opus) pass through
//   4. null/undefined/inherit all map to 'inherit'
//   5. Fingerprint invalidation: same alias + different override map → different fingerprint
//      (this is the "alias remap = intentional cache invalidation" semantic)
//
// Run: node ~/.claude/orchestrator-runtime/appsec/tests/unit-resolve-model.js

'use strict';

// Inline the function being tested (mirror of workflows/appsec-orchestrator.js)
function resolveModel(specModel, overrides) {
  if (overrides && typeof overrides === 'object' && specModel in overrides) {
    return overrides[specModel];
  }
  switch (specModel) {
    case 'cheap_fast':            return 'haiku';
    case 'balanced':              return 'sonnet';
    case 'strongest_available':   return 'opus';
    case 'inherit':
    case null:
    case undefined:               return 'inherit';
    default:                      return specModel;
  }
}

function stableStringify(o) {
  if (o === null || o === undefined) return 'null';
  if (typeof o !== 'object') return JSON.stringify(o);
  if (Array.isArray(o)) return '[' + o.map(stableStringify).join(',') + ']';
  const k = Object.keys(o).sort();
  return '{' + k.map(x => JSON.stringify(x) + ':' + stableStringify(o[x])).join(',') + '}';
}
function djb2(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16).padStart(8, '0'); }

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log(`  PASS  ${name}`); pass++; }
  else    { console.log(`  FAIL  ${name}  expected=${JSON.stringify(expected)}  got=${JSON.stringify(actual)}`); fail++; }
}

console.log('unit-resolve-model.js — Patch A.4 alias resolution\n');

// ── 1. default alias resolution ─────────────────────────────────────────
check('cheap_fast → haiku',          resolveModel('cheap_fast', null),          'haiku');
check('balanced → sonnet',            resolveModel('balanced', null),            'sonnet');
check('strongest_available → opus',   resolveModel('strongest_available', null), 'opus');
check('inherit → inherit',            resolveModel('inherit', null),             'inherit');
check('null → inherit',               resolveModel(null, null),                  'inherit');
check('undefined → inherit',          resolveModel(undefined, null),             'inherit');

// ── 2. legacy literals pass through ─────────────────────────────────────
check('legacy haiku → haiku',         resolveModel('haiku', null),               'haiku');
check('legacy sonnet → sonnet',       resolveModel('sonnet', null),              'sonnet');
check('legacy opus → opus',           resolveModel('opus', null),                'opus');
check('legacy haiku-4.5 → haiku-4.5', resolveModel('haiku-4.5', null),           'haiku-4.5');

// ── 3. per-project override wins ────────────────────────────────────────
const override1 = { cheap_fast: 'haiku-5.0', balanced: 'sonnet-5.0', strongest_available: 'opus-5.0' };
check('override cheap_fast',          resolveModel('cheap_fast', override1),     'haiku-5.0');
check('override balanced',            resolveModel('balanced', override1),       'sonnet-5.0');
check('override strongest',           resolveModel('strongest_available', override1), 'opus-5.0');
check('no override → default',        resolveModel('inherit', override1),        'inherit');

// ── 4. fingerprint invalidation (the load-bearing cache semantic) ────────
// A spec with the same alias should fingerprint differently if the override map
// changes the resolved literal. This is Patch A.4's key correctness claim.
const node = { name: 'Scope', type: 'single', model: 'cheap_fast', agentType: 'appsec-risk-classifier' };

function hashWithOverrides(node, overrides) {
  return djb2(stableStringify({
    name: node.name,
    type: node.type,
    model: resolveModel(node.model, overrides),
    agentType: node.agentType,
  }));
}

const fpDefault  = hashWithOverrides(node, null);              // model resolves to 'haiku'
const fpOverride = hashWithOverrides(node, { cheap_fast: 'haiku-5.0' });  // model resolves to 'haiku-5.0'

check('fingerprint differs when alias remapped',
      fpDefault !== fpOverride,
      true);
console.log(`  (info) default fp=${fpDefault}  override fp=${fpOverride}`);

// ── 5. fingerprint stable when alias matches literal (cross-form equivalence test) ──
// Important sanity check: a spec using literal "haiku" and a spec using alias "cheap_fast"
// (no override) BOTH resolve to literal "haiku" → SAME fingerprint.
// That means migrating from literal → alias does NOT invalidate cache, which is correct:
// the executed configuration is identical, only the spec syntax changed.
const nodeLiteral = { ...node, model: 'haiku' };
const fpAlias   = hashWithOverrides(node, null);          // alias cheap_fast → haiku
const fpLiteral = hashWithOverrides(nodeLiteral, null);   // literal haiku → haiku
check('alias and literal both resolve to same fingerprint (migration safety)',
      fpAlias === fpLiteral,
      true);

// ── 6. unknown alias passes through (validator catches it elsewhere) ────
check('unknown alias passes through',  resolveModel('very_strong', null), 'very_strong');

// ── summary ──────────────────────────────────────────────────────────────
console.log(`\nPASS: ${pass}   FAIL: ${fail}`);
if (fail > 0) {
  process.exit(1);
}
