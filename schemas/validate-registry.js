#!/usr/bin/env node
'use strict';
/**
 * validate-registry.js — dependency-free JSON-Schema-subset validator for
 * manifests/harness.registry.json against schemas/harness-registry.schema.json.
 *
 * WHY: the audit (C3) found harness-registry.schema.json was dead AND drifted —
 * it described a never-realized idealized shape, nothing validated the live
 * registry against it. This is the engine that closes that: the schema is
 * realigned to the live 2.0.0 shape and tests/harness/registry-schema.test.js
 * runs this validator so the registry can never silently drift from its schema
 * again. No ajv (harness ships no node_modules).
 *
 * Subset supported: type / required / properties / additionalProperties(bool|schema)
 * / patternProperties / items / enum / const / minItems / maxItems / minLength /
 * uniqueItems / pattern / $ref(#/$defs/*).
 *
 * Usage:  node validate-registry.js [<registry.json>] [<schema.json>]
 * Exit:   0 valid · 1 invalid · 2 infra (read/parse).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

function typeOf(v) { if (v === null) return 'null'; if (Array.isArray(v)) return 'array'; return typeof v; }
function typeOk(v, t) {
  if (Array.isArray(t)) return t.some((tt) => typeOk(v, tt));
  if (t === 'integer') return typeof v === 'number' && Number.isInteger(v);
  return typeOf(v) === t;
}
function stripComments(s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1'); }

function resolveRef(ref, root) {
  if (!ref.startsWith('#/')) return null;
  let cur = root;
  for (const p of ref.slice(2).split('/')) { if (cur == null) return null; cur = cur[p]; }
  return cur || null;
}

function validate(data, schema, root, p, errors) {
  if (schema == null) return;
  if (schema.$ref) {
    const r = resolveRef(schema.$ref, root);
    if (!r) { errors.push(`${p}: unresolved $ref ${schema.$ref}`); return; }
    return validate(data, r, root, p, errors);
  }
  if (schema.type && !typeOk(data, schema.type)) {
    errors.push(`${p}: expected type ${JSON.stringify(schema.type)}, got ${typeOf(data)}`);
    return;
  }
  if (schema.enum && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(data))) {
    errors.push(`${p}: value ${JSON.stringify(data)} not in enum ${JSON.stringify(schema.enum)}`);
  }
  if ('const' in schema && JSON.stringify(schema.const) !== JSON.stringify(data)) {
    errors.push(`${p}: must equal ${JSON.stringify(schema.const)}`);
  }
  if (typeof data === 'string') {
    if (schema.minLength != null && data.length < schema.minLength) errors.push(`${p}: shorter than minLength ${schema.minLength}`);
    if (schema.pattern) { try { if (!new RegExp(schema.pattern).test(data)) errors.push(`${p}: '${data}' fails pattern ${schema.pattern}`); } catch (_e) { /* ignore bad pattern */ } }
  }
  if (Array.isArray(data)) {
    if (schema.minItems != null && data.length < schema.minItems) errors.push(`${p}: fewer than minItems ${schema.minItems}`);
    if (schema.maxItems != null && data.length > schema.maxItems) errors.push(`${p}: more than maxItems ${schema.maxItems}`);
    if (schema.uniqueItems) {
      const seen = new Set();
      for (const it of data) { const k = JSON.stringify(it); if (seen.has(k)) { errors.push(`${p}: duplicate items violate uniqueItems`); break; } seen.add(k); }
    }
    if (schema.items) data.forEach((it, i) => validate(it, schema.items, root, `${p}[${i}]`, errors));
  }
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    if (Array.isArray(schema.required)) for (const k of schema.required) if (!(k in data)) errors.push(`${p}: missing required '${k}'`);
    const props = schema.properties || {};
    const patterns = schema.patternProperties || {};
    for (const [k, v] of Object.entries(data)) {
      if (k in props) { validate(v, props[k], root, `${p}.${k}`, errors); continue; }
      let matched = false;
      for (const [pat, sub] of Object.entries(patterns)) { if (new RegExp(pat).test(k)) { validate(v, sub, root, `${p}.${k}`, errors); matched = true; break; } }
      if (matched) continue;
      if (schema.additionalProperties === false) errors.push(`${p}: additional property '${k}' not allowed`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') validate(v, schema.additionalProperties, root, `${p}.${k}`, errors);
    }
  }
}

function run(regPath, schPath) {
  let data, schema;
  try { data = JSON.parse(stripComments(fs.readFileSync(regPath, 'utf8'))); }
  catch (e) { return { code: 2, errors: [`cannot read/parse registry ${regPath}: ${e.message}`] }; }
  try { schema = JSON.parse(stripComments(fs.readFileSync(schPath, 'utf8'))); }
  catch (e) { return { code: 2, errors: [`cannot read/parse schema ${schPath}: ${e.message}`] }; }
  const errors = [];
  validate(data, schema, schema, '$', errors);
  return { code: errors.length ? 1 : 0, errors };
}

module.exports = { validate, run };

if (require.main === module) {
  const HOME = os.homedir();
  const regPath = process.argv[2] || path.join(HOME, '.claude', 'manifests', 'harness.registry.json');
  const schPath = process.argv[3] || path.join(HOME, '.claude', 'schemas', 'harness-registry.schema.json');
  const { code, errors } = run(regPath, schPath);
  if (code === 2) { console.error('validate-registry: BLOCKED — ' + errors.join('; ')); process.exit(2); }
  if (code === 1) { console.error(`validate-registry: INVALID (${errors.length} errors):`); errors.slice(0, 60).forEach((e) => console.error('  - ' + e)); process.exit(1); }
  console.log('validate-registry: VALID — harness.registry.json conforms to harness-registry.schema.json');
  process.exit(0);
}
