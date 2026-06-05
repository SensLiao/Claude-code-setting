#!/usr/bin/env node
/**
 * verdict-validator.js — canonical, DEPENDENCY-FREE validator for harness verdict /
 * gate-result files against gate-decision.schema (the 7-value canonical vocabulary).
 *
 * WHY (codex decision-review, 2026-06-05): a verdict file can satisfy the existing
 * field-presence / regex Stop checks yet still violate the canonical schema (wrong
 * enum value, malformed gate_tag, missing provenance). This closes that hole. Per the
 * same review it MUST be usable at MULTIPLE points, not Stop-only (Stop hooks can be
 * skipped at max_turns and run too late):
 *   1. write-time  — SDK builds the object, calls validateVerdict(obj) BEFORE writing.
 *   2. read/promote — before a verdict is consumed into a release bundle.
 *   3. CI/preflight — `node verdict-validator.js <file>` exit 0/2, NO dependency on
 *      Claude Code hooks being configured (harness correctness must not depend on local
 *      hook config — codex "Missed" item #3).
 *
 * Dependency-free by design: the harness hooks are plain Node with no node_modules, so
 * this ships no ajv/js-yaml. It implements the small JSON-Schema subset the canonical
 * schema actually uses (type/enum/required/properties/additionalProperties/items/
 * pattern/minLength/minItems/uniqueItems/format:date-time). Schema is loaded from JSON
 * (gate-decision.schema.json) so there is a single source of constraints; a parity test
 * keeps that JSON in lockstep with the authoritative gate-decision.schema.yaml.
 *
 * Exit codes (Claude Code hook convention): 0 = valid · 2 = invalid OR internal error
 * (FAIL-CLOSED — an unreadable/unparseable verdict in a gate context is a block, never a pass).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SHA256_RE = /^sha256:[0-9a-f]{64}$/;

// ---------------------------------------------------------------------------
// Minimal JSON-Schema-subset evaluator (immutable: returns a fresh error list).
// Supports exactly the keywords gate-decision.schema uses. Unknown keywords are
// ignored (not silently "passed" — they simply add no constraint).
// ---------------------------------------------------------------------------
function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v; // 'string' | 'number' | 'boolean' | 'object'
}

// Single-line full match. NOTE (verified empirically 2026-06-05): JS '$' without /m already
// matches only absolute end-of-input, so the schema's ^...$ patterns already reject a trailing
// '\n' (codex's "regex-anchoring/$-trailing-newline" finding does NOT apply to JS — that is
// Python/PCRE behavior). This helper is belt-and-suspenders: explicit own-string + no-line-break
// + full-consume, so a forged multi-line value stays rejected even if a pattern ever gains /m.
function single(re, s) {
  if (typeof s !== 'string' || /[\r\n]/.test(s)) return false;
  const m = re.exec(s);
  return !!m && m.index === 0 && m[0] === s;
}

function isIsoDateTime(s) {
  if (typeof s !== 'string') return false;
  if (/[\r\n]/.test(s)) return false; // defensive (JS '$' is already end-strict)
  // RFC3339 / ISO-8601 with required date + time + offset (Z or ±HH:MM).
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(s);
  if (!m || m[0] !== s) return false;
  // Do NOT trust Date.parse as a backstop: it SILENTLY ROLLS OVER impossible dates
  // (2026-02-30 -> Mar 2; 24:00:00 -> next day), so a calendar-invalid timestamp would
  // FALSE-ACCEPT. Validate every component range explicitly instead. (stress-1 finding)
  const year = +m[1], month = +m[2], day = +m[3], hour = +m[4], min = +m[5], sec = +m[6];
  if (month < 1 || month > 12) return false;
  if (hour > 23 || min > 59 || sec > 59) return false; // strict: no leap-second :60
  const leap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > daysInMonth[month - 1]) return false;
  if (m[7] !== 'Z') {
    const offH = +m[7].slice(1, 3), offM = +m[7].slice(4, 6);
    if (offH > 23 || offM > 59) return false;
  }
  return true;
}

function evalSchema(value, schema, pathStr, errors) {
  if (!schema || typeof schema !== 'object') return errors;

  // type
  if (schema.type) {
    const t = typeOf(value);
    const want = Array.isArray(schema.type) ? schema.type : [schema.type];
    // JSON Schema: integer is a number; we only use string/array/object/number/boolean
    const ok = want.some((w) => (w === 'number' ? t === 'number' : t === w));
    if (!ok) {
      errors.push(`${pathStr}: expected type ${want.join('|')}, got ${t}`);
      return errors; // further keyword checks are meaningless on a wrong type
    }
  }

  // enum
  if (Array.isArray(schema.enum)) {
    if (!schema.enum.some((e) => e === value)) {
      errors.push(`${pathStr}: value ${JSON.stringify(value)} not in enum [${schema.enum.join(', ')}]`);
    }
  }

  // string constraints
  if (typeOf(value) === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      errors.push(`${pathStr}: string shorter than minLength ${schema.minLength}`);
    }
    if (typeof schema.pattern === 'string') {
      let re = null;
      // Fail-closed (codex): an unparseable pattern in the SCHEMA must surface as an error,
      // not silently disable the constraint.
      try { re = new RegExp(schema.pattern); }
      catch { errors.push(`${pathStr}: schema pattern is not a valid regex (fail-closed): ${schema.pattern}`); }
      // JS '$' (no /m) is end-of-input-strict, so a trailing '\n' is already rejected here.
      if (re && !re.test(value)) errors.push(`${pathStr}: string does not match pattern ${schema.pattern}`);
    }
    if (schema.format === 'date-time' && !isIsoDateTime(value)) {
      errors.push(`${pathStr}: not a valid ISO-8601 date-time`);
    }
  }

  // array constraints
  if (typeOf(value) === 'array') {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      errors.push(`${pathStr}: array shorter than minItems ${schema.minItems}`);
    }
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
      errors.push(`${pathStr}: array longer than maxItems ${schema.maxItems}`);
    }
    if (schema.uniqueItems === true) {
      const seen = new Set();
      for (const item of value) {
        const key = JSON.stringify(item);
        if (seen.has(key)) { errors.push(`${pathStr}: array items not unique (${key})`); break; }
        seen.add(key);
      }
    }
    if (schema.items) {
      value.forEach((item, i) => evalSchema(item, schema.items, `${pathStr}[${i}]`, errors));
    }
  }

  // object constraints
  if (typeOf(value) === 'object') {
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
          errors.push(`${pathStr}: missing required property '${key}'`);
        }
      }
    }
    const props = schema.properties || {};
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(props, key)) {
          errors.push(`${pathStr}: additional property '${key}' is not allowed`);
        }
      }
    }
    for (const key of Object.keys(props)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        evalSchema(value[key], props[key], pathStr === '$' ? key : `${pathStr}.${key}`, errors);
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Provenance check. HONEST SCOPE (codex): this checks the PRESENCE + FORMAT of an embedded
// run_fingerprint; it is NOT proof of authenticity on its own. A hand-authored verdict CAN
// supply a syntactically valid `sha256:<64hex>` and pass this check. Authenticity is closed
// downstream: stale-guard recomputes deps_hash over the actual evidence, and the cosign tier
// binds a human OIDC identity. This is the dependency-free baseline (presence/format), not the
// whole story. Reads are own-property only (codex) so a prototype-polluted object cannot
// satisfy provenance via inherited fields.
// ---------------------------------------------------------------------------
function hasOwn(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }

function validateProvenance(obj, errors) {
  const p = hasOwn(obj, 'provenance') ? obj.provenance : undefined;
  if (!p || typeOf(p) !== 'object') {
    errors.push('$.provenance: required when --require-provenance is set (embed { written_by, run_fingerprint } via the SDK write path)');
    return errors;
  }
  const writtenBy = hasOwn(p, 'written_by') ? p.written_by : '';
  const fp = hasOwn(p, 'run_fingerprint') ? p.run_fingerprint : '';
  if (!single(/^(appsec|qa|uiux|discoverability|gsd)-sdk@\S+$/, String(writtenBy))) {
    errors.push("$.provenance.written_by: must be '<subsystem>-sdk@<version>' (own property, single line)");
  }
  if (!single(SHA256_RE, String(fp))) {
    errors.push('$.provenance.run_fingerprint: must be sha256:<64hex> (format only — authenticity is cross-checked by stale-guard deps_hash / cosign tier, not here)');
  }
  if (hasOwn(p, 'spec_hash') && !single(SHA256_RE, String(p.spec_hash))) {
    errors.push('$.provenance.spec_hash: present but not sha256:<64hex>');
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Release-context semantics (codex #6 — "existing design ≠ enforced design").
// gate-decision x-release-semantics, enforced here when --release-context is set:
//   - STRATEGY_READY is NEVER a release decision.
//   - CONDITIONAL_PASS only releases with an explicit_risk_acceptance_ref.
// ---------------------------------------------------------------------------
function validateReleaseSemantics(obj, errors, schema) {
  // Driven off the schema's x-release-semantics (single source of truth, shared with
  // gate.check) with a hardcoded fail-closed fallback if that block is absent.
  const sem = (schema && schema['x-release-semantics']) || {};
  const blocks = Array.isArray(sem.blocks_release) ? sem.blocks_release : ['FAIL', 'BLOCKED', 'STALE'];
  const notRelease = Array.isArray(sem.not_release_decision) ? sem.not_release_decision : ['STRATEGY_READY'];
  const allows = Array.isArray(sem.allows_release) ? sem.allows_release : ['PASS', 'WARN', 'CONDITIONAL_PASS'];
  const d = hasOwn(obj, 'decision') ? obj.decision : undefined;
  if (notRelease.includes(d)) {
    errors.push(`$.decision: ${d} is a non-release (planning) outcome and MUST NOT appear in a release-context gate`);
  } else if (blocks.includes(d)) {
    // stress-2 finding (HIGH): FAIL/BLOCKED/STALE previously sailed through a
    // --release-context gate because only STRATEGY_READY + CONDITIONAL_PASS were checked.
    errors.push(`$.decision: ${d} BLOCKS release — a release-context gate must not pass on ${d}`);
  } else if (!allows.includes(d)) {
    // DEFAULT-DENY (codex): any decision not explicitly classified as releasable in
    // x-release-semantics cannot release — e.g. a future enum value added without updating
    // the semantics block.
    errors.push(`$.decision: ${JSON.stringify(d)} is not an approved release decision in x-release-semantics`);
  } else if (d === 'CONDITIONAL_PASS') {
    const ref = (hasOwn(obj, 'explicit_risk_acceptance_ref') && obj.explicit_risk_acceptance_ref)
      || (hasOwn(obj, 'provenance') && hasOwn(obj.provenance, 'explicit_risk_acceptance_ref') && obj.provenance.explicit_risk_acceptance_ref);
    if (!ref || String(ref).trim() === '') {
      errors.push('$.decision: CONDITIONAL_PASS requires an explicit_risk_acceptance_ref (ticket/ADR/signed risk-register entry) to release');
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
function validateVerdict(obj, opts = {}) {
  const errors = [];
  if (obj === null || typeOf(obj) !== 'object') {
    return { ok: false, errors: ['$: verdict must be a JSON/YAML object'] };
  }
  const schema = opts.schema || loadDefaultSchema();
  evalSchema(obj, schema, '$', errors);
  if (opts.requireProvenance) validateProvenance(obj, errors);
  if (opts.releaseContext) validateReleaseSemantics(obj, errors, schema);
  return { ok: errors.length === 0, errors };
}

function loadDefaultSchema() {
  const p = path.join(__dirname, 'gate-decision.schema.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// ---------------------------------------------------------------------------
// File reading. Write-time callers pass an already-parsed object and never touch this.
// CI/read callers get JSON natively, or the guarded flat-YAML reader (parseFlatYamlV2)
// for gate-result.yaml — fail-closed: it THROWS on any construct it doesn't understand
// rather than risk a silent mis-parse in a gate context.
// ---------------------------------------------------------------------------
function readVerdictFile(file) {
  let text = fs.readFileSync(file, 'utf8');
  // DEFECT A (stress-A1r2 finding): a leading UTF-8 BOM (U+FEFF) is valid and common on
  // Windows but breaks BOTH JSON.parse and the flat-YAML indent calc (trimStart counts the
  // BOM as whitespace -> spurious indent -> false-reject). Strip it once at the single read
  // entry point. The write-time validateVerdict(obj) path is unaffected (BOM is a file artifact).
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const ext = path.extname(file).toLowerCase();
  if (ext === '.json') return JSON.parse(text);
  if (ext === '.yaml' || ext === '.yml') return parseFlatYamlV2(text);
  // unknown extension: try JSON then flat-YAML, fail-closed
  try { return JSON.parse(text); } catch { return parseFlatYamlV2(text); }
}

/**
 * parseFlatYamlV2 — fail-closed flat-YAML reader for the gate-result.yaml shape. Handles:
 *   key: scalar  |  key: []  |  key: {}
 *   key:\n  - item            (block sequence of scalars)
 *   key:\n  subkey: scalar    (one-level nested map)
 * THROWS on anything else — a silent mis-parse in a gate is worse than a hard error.
 * Hardened per stress-3 findings: duplicate keys (last-wins flipped FAIL->PASS),
 * flow-style [a,b]/{x:1} silently stored as string, sequence-of-maps swallowed, and the
 * evidence_refs:[] false-reject. URIs/Windows paths in seq items (https://, C:/) are NOT
 * mistaken for maps (only ':' followed by whitespace/end is a map item).
 */
function parseFlatYamlV2(text) {
  const out = Object.create(null); // null-proto: a stray __proto__ key becomes an own key
  const lines = text.split(/\r?\n/);
  const stripComment = (s) => {
    let inS = false, inD = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === "'" && !inD) inS = !inS;
      else if (c === '"' && !inS) inD = !inD;
      else if (c === '#' && !inS && !inD && (i === 0 || s[i - 1] === ' ' || s[i - 1] === '\t')) return s.slice(0, i);
    }
    return s;
  };
  const isQuoted = (t) => (t.length >= 2)
    && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")));
  const coerce = (v) => {
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (v === 'null' || v === '~') return null;
    if (/^-?\d+$/.test(v)) return parseInt(v, 10);
    if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
    return v;
  };
  // Trimmed value token -> JS value. Empty flow collections [] / {} become real empties
  // (evidence_refs:[] must round-trip). Any OTHER YAML-special leading char THROWS — flow
  // collections, block scalars (| >), tags (!), anchors/aliases (& *), and unbalanced quotes
  // must never be silently stored as an opaque string (codex fail-closed finding). The SDK
  // quotes any value that would otherwise begin with a YAML indicator.
  const scalarValue = (t) => {
    if (isQuoted(t)) return t.slice(1, -1);
    if (t === '[]') return [];
    if (t === '{}') return Object.create(null);
    const c0 = t.charAt(0);
    if (c0 === '[' || c0 === '{') throw new Error(`flat-YAML: flow-style collections not supported: ${JSON.stringify(t)}`);
    if (c0 === '|' || c0 === '>') throw new Error(`flat-YAML: block scalars not supported: ${JSON.stringify(t)}`);
    if (c0 === '!' || c0 === '&' || c0 === '*') throw new Error(`flat-YAML: tags/anchors/aliases not supported: ${JSON.stringify(t)}`);
    if (c0 === '"' || c0 === "'") throw new Error(`flat-YAML: unbalanced quote: ${JSON.stringify(t)}`);
    return coerce(t);
  };
  // Prototype-pollution guard (codex HIGH): refuse keys that mutate the prototype chain.
  const POISON = new Set(['__proto__', 'constructor', 'prototype']);
  const safeKey = (k) => {
    if (POISON.has(k)) throw new Error(`flat-YAML: refusing prototype-pollution key '${k}'`);
    return k;
  };

  let currentKey = null;     // top-level key whose block we are filling
  let blockKind = null;      // null | 'seq' | 'map'

  for (const raw of lines) {
    const noC = stripComment(raw);
    if (noC.trim() === '') continue;
    const indent = noC.length - noC.trimStart().length;
    const line = noC.trim();

    if (indent === 0) {
      const m = line.match(/^([A-Za-z0-9_]+):(.*)$/);
      if (!m) throw new Error(`flat-YAML: unparseable top-level line: ${JSON.stringify(raw)}`);
      const key = safeKey(m[1]);
      if (Object.prototype.hasOwnProperty.call(out, key)) {
        throw new Error(`flat-YAML: duplicate key '${key}' (mapping keys must be unique)`);
      }
      const rest = m[2].trim();
      if (rest === '') { out[key] = undefined; currentKey = key; blockKind = null; }
      else { out[key] = scalarValue(rest); currentKey = null; blockKind = null; }
      continue;
    }

    // indented line belongs to currentKey's block
    if (currentKey === null) throw new Error(`flat-YAML: indented line without parent: ${JSON.stringify(raw)}`);

    if (line === '-' || line.startsWith('- ')) {
      if (blockKind === null) { out[currentKey] = []; blockKind = 'seq'; }
      if (blockKind !== 'seq') throw new Error(`flat-YAML: mixed seq/map under '${currentKey}'`);
      const item = line === '-' ? '' : line.slice(2).trim();
      // seq-of-maps detection (codex: broaden beyond [A-Za-z0-9_]). A map item is a key-ish
      // prefix (may contain - and .) then optional space then ':' then space/end. URIs and
      // Windows paths ("https://x", "C:/x") have ':' followed by non-space, so are NOT flagged.
      if (!isQuoted(item) && /^[\w.-]+\s*:(\s|$)/.test(item)) {
        throw new Error(`flat-YAML: sequence of maps not supported: ${JSON.stringify(raw)}`);
      }
      out[currentKey].push(scalarValue(item));
      continue;
    }

    const mm = line.match(/^([A-Za-z0-9_]+):(.*)$/);
    if (!mm) throw new Error(`flat-YAML: unparseable nested line: ${JSON.stringify(raw)}`);
    if (blockKind === null) { out[currentKey] = Object.create(null); blockKind = 'map'; }
    if (blockKind !== 'map') throw new Error(`flat-YAML: mixed seq/map under '${currentKey}'`);
    const subKey = safeKey(mm[1]);
    if (Object.prototype.hasOwnProperty.call(out[currentKey], subKey)) {
      throw new Error(`flat-YAML: duplicate nested key '${subKey}' under '${currentKey}'`);
    }
    const subRest = mm[2].trim();
    if (subRest === '') throw new Error(`flat-YAML: deep nesting not supported: ${JSON.stringify(raw)}`);
    out[currentKey][subKey] = scalarValue(subRest);
  }

  // normalize any top-level key left as undefined (declared but empty block) to null
  for (const k of Object.keys(out)) if (out[k] === undefined) out[k] = null;
  return out;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function main(argv) {
  const args = argv.slice(2);
  const files = [];
  let schemaPath = null;
  let requireProvenance = false;
  let releaseContext = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--schema') schemaPath = args[++i];
    else if (a === '--require-provenance' || a === '--provenance') requireProvenance = true;
    else if (a === '--release-context' || a === '--release') releaseContext = true;
    else if (a === '--help' || a === '-h') { printHelp(); return 0; }
    else if (a.startsWith('--')) { process.stderr.write(`[verdict-validator] unknown flag ${a}\n`); return 2; }
    else files.push(a);
  }
  if (files.length === 0) { printHelp(); return 2; }

  let schema;
  try { schema = schemaPath ? JSON.parse(fs.readFileSync(schemaPath, 'utf8')) : loadDefaultSchema(); }
  catch (e) { process.stderr.write(`[verdict-validator] FAIL-CLOSED: cannot load schema (${e.message})\n`); return 2; }

  let anyFail = false;
  for (const f of files) {
    let obj;
    try { obj = readVerdictFile(f); }
    catch (e) {
      anyFail = true;
      process.stderr.write(`[verdict-validator] BLOCK ${f}: unreadable/unparseable — ${e.message}\n`);
      continue;
    }
    const { ok, errors } = validateVerdict(obj, { schema, requireProvenance, releaseContext });
    if (ok) {
      process.stdout.write(`[verdict-validator] OK ${f}\n`);
    } else {
      anyFail = true;
      process.stderr.write(`[verdict-validator] BLOCK ${f}:\n  - ${errors.join('\n  - ')}\n`);
    }
  }
  return anyFail ? 2 : 0;
}

function printHelp() {
  process.stdout.write([
    'verdict-validator — validate harness gate-result/verdict files against gate-decision.schema',
    '',
    'Usage: node verdict-validator.js <file...> [--schema <path>] [--require-provenance] [--release-context]',
    '',
    '  --require-provenance   require provenance.{written_by, run_fingerprint(sha256)} (SDK-only write path)',
    '  --release-context      enforce release semantics (STRATEGY_READY rejected; CONDITIONAL_PASS needs explicit_risk_acceptance_ref)',
    '',
    'Exit: 0 valid · 2 invalid or error (fail-closed). Works standalone in CI — no Claude Code hook dependency.',
  ].join('\n') + '\n');
}

module.exports = { validateVerdict, evalSchema, validateProvenance, validateReleaseSemantics, readVerdictFile, parseFlatYamlV2, loadDefaultSchema };

if (require.main === module) {
  process.exit(main(process.argv));
}
