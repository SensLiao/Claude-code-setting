#!/usr/bin/env node
/*
 * validate-crosswalk.js — dependency-free validator for standards-crosswalk.json
 *
 * Checks:
 *   1. The data file conforms to crosswalk.schema.json (a focused JSON-Schema
 *      subset: type, required, enum, const, pattern, minLength, minItems,
 *      minProperties, additionalProperties, properties, items, $ref/$defs).
 *   2. INDEPENDENT of the schema, every standard AND every mapping carries a
 *      non-empty `source` and a non-empty `verified_on`. (Belt-and-suspenders:
 *      this must hold even if someone loosens the schema.)
 *
 * Exit codes: 0 = OK, 2 = validation failed, 1 = usage / IO error.
 *
 * Usage: node validate-crosswalk.js [path-to-data.json] [path-to-schema.json]
 */

"use strict";

const fs = require("fs");
const path = require("path");

const errors = [];
function err(p, msg) {
  errors.push(`${p || "<root>"}: ${msg}`);
}

// ---- local $ref resolver against the root schema ----
function resolveRef(rootSchema, ref) {
  if (!ref.startsWith("#/")) {
    throw new Error(`Only local '#/' refs are supported, got: ${ref}`);
  }
  const parts = ref
    .slice(2)
    .split("/")
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
  let node = rootSchema;
  for (const part of parts) {
    if (node == null || typeof node !== "object" || !(part in node)) {
      throw new Error(`Cannot resolve ref ${ref} (missing segment '${part}')`);
    }
    node = node[part];
  }
  return node;
}

function typeOf(v) {
  if (Array.isArray(v)) return "array";
  if (v === null) return "null";
  return typeof v; // object | string | number | boolean
}

function matchesType(v, t) {
  if (t === "integer") return typeof v === "number" && Number.isInteger(v);
  if (t === "number") return typeof v === "number";
  return typeOf(v) === t;
}

// ---- core recursive schema validator (subset) ----
function validate(data, schema, root, p) {
  if (schema == null || typeof schema !== "object") return;

  if (schema.$ref) {
    let resolved;
    try {
      resolved = resolveRef(root, schema.$ref);
    } catch (e) {
      err(p, e.message);
      return;
    }
    validate(data, resolved, root, p);
    // fall through: a node could carry $ref plus siblings (we still honor them)
  }

  // type
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(data, t))) {
      err(p, `expected type ${types.join("|")}, got ${typeOf(data)}`);
      return; // further checks are meaningless on wrong type
    }
  }

  // const
  if (schema.const !== undefined && data !== schema.const) {
    err(p, `expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(data)}`);
  }

  // enum
  if (Array.isArray(schema.enum) && !schema.enum.includes(data)) {
    err(p, `value ${JSON.stringify(data)} not in enum [${schema.enum.join(", ")}]`);
  }

  // string facets
  if (typeof data === "string") {
    if (typeof schema.minLength === "number" && data.length < schema.minLength) {
      err(p, `string shorter than minLength ${schema.minLength}`);
    }
    if (schema.pattern) {
      let re;
      try {
        re = new RegExp(schema.pattern);
      } catch (e) {
        err(p, `bad pattern in schema: ${schema.pattern}`);
        re = null;
      }
      if (re && !re.test(data)) {
        err(p, `string ${JSON.stringify(data)} does not match pattern ${schema.pattern}`);
      }
    }
  }

  // array facets
  if (Array.isArray(data)) {
    if (typeof schema.minItems === "number" && data.length < schema.minItems) {
      err(p, `array shorter than minItems ${schema.minItems}`);
    }
    if (schema.items) {
      data.forEach((item, i) => validate(item, schema.items, root, `${p}[${i}]`));
    }
  }

  // object facets
  if (typeOf(data) === "object") {
    const keys = Object.keys(data);

    if (typeof schema.minProperties === "number" && keys.length < schema.minProperties) {
      err(p, `object has ${keys.length} properties, minProperties ${schema.minProperties}`);
    }

    if (Array.isArray(schema.required)) {
      for (const req of schema.required) {
        if (!(req in data)) err(p, `missing required property '${req}'`);
      }
    }

    const props = schema.properties || {};
    for (const key of keys) {
      const sub = `${p}.${key}`;
      if (props[key]) {
        validate(data[key], props[key], root, sub);
      } else if (schema.additionalProperties === false) {
        err(p, `additional property '${key}' not allowed`);
      } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        validate(data[key], schema.additionalProperties, root, sub);
      }
    }
  }
}

// ---- independent source/verified_on assertion (not schema-derived) ----
function nonEmptyStr(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function checkSourceAndVerified(data) {
  const standards = data && data.standards;
  if (standards && typeof standards === "object") {
    for (const [key, std] of Object.entries(standards)) {
      const base = `standards.${key}`;
      if (!nonEmptyStr(std && std.source)) err(base, "missing/empty 'source'");
      if (!nonEmptyStr(std && std.verified_on)) err(base, "missing/empty 'verified_on'");
    }
  } else {
    err("standards", "missing or not an object");
  }

  const cw = data && data.crosswalk;
  if (Array.isArray(cw)) {
    cw.forEach((m, i) => {
      const id = (m && m.id) || `index ${i}`;
      const base = `crosswalk[${i}] (${id})`;
      if (!nonEmptyStr(m && m.source)) err(base, "missing/empty 'source'");
      if (!nonEmptyStr(m && m.verified_on)) err(base, "missing/empty 'verified_on'");
    });
  } else {
    err("crosswalk", "missing or not an array");
  }
}

// ---- main ----
function main() {
  const dataPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, "standards-crosswalk.json");
  const schemaPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.resolve(__dirname, "crosswalk.schema.json");

  let data, schema;
  try {
    data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  } catch (e) {
    console.error(`FATAL: cannot read/parse data file '${dataPath}': ${e.message}`);
    process.exit(1);
  }
  try {
    schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  } catch (e) {
    console.error(`FATAL: cannot read/parse schema file '${schemaPath}': ${e.message}`);
    process.exit(1);
  }

  validate(data, schema, schema, "");
  checkSourceAndVerified(data);

  if (errors.length > 0) {
    console.error(`FAIL: ${errors.length} validation error(s) in ${path.basename(dataPath)}:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(2);
  }

  const stdCount = Object.keys(data.standards).length;
  const mapCount = data.crosswalk.length;
  const itemCount = Object.values(data.standards).reduce(
    (n, s) => n + (Array.isArray(s.items) ? s.items.length : 0),
    0
  );
  console.log(
    `OK: ${path.basename(dataPath)} conforms to schema and all source/verified_on present.`
  );
  console.log(
    `    crosswalk_version=${data.crosswalk_version}  standards=${stdCount}  taxonomy_items=${itemCount}  mappings=${mapCount}`
  );
  process.exit(0);
}

main();
