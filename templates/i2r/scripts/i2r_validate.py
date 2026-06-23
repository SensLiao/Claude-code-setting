#!/usr/bin/env python3
"""
i2r_validate.py - PURE JSON-Schema validation for I2R (no file IO).

Uses `jsonschema` if installed, else a built-in subset validator covering the draft-07 features the
I2R schemas actually use (type / required / properties / enum / pattern / min-max / items /
additionalProperties / $ref to local #/definitions). i2r.py owns reading the files; this module only
takes (instance, schema) and returns a list of human-readable error strings.
"""
from __future__ import annotations

import re


def _resolve_ref(root: dict, ref: str):
    if not ref.startswith("#/"):
        return None
    node = root
    for part in ref[2:].split("/"):
        node = node.get(part, {})
    return node


def _subset_validate(inst, schema: dict, root: dict, path: str, errors: list) -> None:
    if "$ref" in schema:
        schema = _resolve_ref(root, schema["$ref"]) or {}
    t = schema.get("type")
    if t == "object":
        if not isinstance(inst, dict):
            errors.append(f"{path}: expected object")
            return
        for req in schema.get("required", []):
            if req not in inst:
                errors.append(f"{path}: missing required '{req}'")
        props = schema.get("properties", {})
        for k, sub in props.items():
            if k in inst:
                _subset_validate(inst[k], sub, root, f"{path}.{k}", errors)
        ap = schema.get("additionalProperties")
        if isinstance(ap, dict):
            for k, v in inst.items():
                if k not in props:
                    _subset_validate(v, ap, root, f"{path}.{k}", errors)
    elif t == "array":
        if not isinstance(inst, list):
            errors.append(f"{path}: expected array")
            return
        items = schema.get("items")
        if isinstance(items, dict):
            for i, el in enumerate(inst):
                _subset_validate(el, items, root, f"{path}[{i}]", errors)
    elif t == "string":
        if not isinstance(inst, str):
            errors.append(f"{path}: expected string")
            return
        if "enum" in schema and inst not in schema["enum"]:
            errors.append(f"{path}: '{inst}' not in enum {schema['enum']}")
        if "pattern" in schema and not re.search(schema["pattern"], inst):
            errors.append(f"{path}: '{inst}' fails pattern {schema['pattern']}")
    elif t in ("number", "integer"):
        if isinstance(inst, bool) or not isinstance(inst, (int, float)):
            errors.append(f"{path}: expected {t}")
            return
        if t == "integer" and not float(inst).is_integer():
            errors.append(f"{path}: expected integer")
        if "minimum" in schema and inst < schema["minimum"]:
            errors.append(f"{path}: {inst} < minimum {schema['minimum']}")
        if "maximum" in schema and inst > schema["maximum"]:
            errors.append(f"{path}: {inst} > maximum {schema['maximum']}")
    elif t == "boolean":
        if not isinstance(inst, bool):
            errors.append(f"{path}: expected boolean")
    if "enum" in schema and t not in ("string",) and inst not in schema.get("enum", [inst]):
        errors.append(f"{path}: '{inst}' not in enum")


def validate_instance(inst, schema: dict) -> list:
    """Return a list of error strings ([] == valid)."""
    try:
        import jsonschema  # type: ignore
        v = jsonschema.Draft7Validator(schema)
        return [f"{'.'.join(str(p) for p in e.path)}: {e.message}" for e in v.iter_errors(inst)]
    except Exception:
        errors: list = []
        _subset_validate(inst, schema, schema, "$", errors)
        return errors
