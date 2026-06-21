#!/usr/bin/env python3
"""
i2r.py - deterministic ($0, no-LLM) SDK for idea-to-requirements-orchestrator (I2R).

Claude writes the stage artifacts; this script does the real, repeatable checks:
scaffold, state detection, schema validation, mode/evidence gating, assembly
(requirements.json + GSD-native PRD.md + ADRs), the final gate, and the eval harness.

Single source of truth for shapes/paths/enums: docs/CONTRACT.md.
Stdlib only. Uses `jsonschema` if installed, else a built-in subset validator.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEMAS_DIR = ROOT / "schemas"
RUNS_DIR = ROOT / "runs" / "i2r"
ARTIFACT_VERSION = "1.0"

# ---- CONTRACT-derived constants (docs/CONTRACT.md) ----
STAGE_SCHEMA = {
    "00-mode-routing": "00-mode-routing.schema.json",
    "01-intake": "01-intake.schema.json",
    "02-context": "02-context.schema.json",
    "02b-evidence": "02b-evidence.schema.json",
    "03-scope": "03-scope.schema.json",
    "03b-scope-debate": "03b-scope-debate.schema.json",
    "04-functional": "04-functional.schema.json",
    "05-nfr": "05-nfr.schema.json",
    "06-acceptance": "06-acceptance.schema.json",
    "07-review": "07-review.schema.json",
    "08-repair-notes": "08-repair-notes.schema.json",
    "requirements-handoff": "requirements-handoff.schema.json",
}
STAGE_OWNER = {
    "00-mode-routing": "i2r-orchestrator",
    "01-intake": "i2r-intake-clarifier",
    "02-context": "i2r-context-analyst",
    "02b-evidence": "i2r-evidence-researcher",
    "03-scope": "i2r-scope-architect",
    "03b-scope-debate": "i2r-orchestrator",
    "04-functional": "i2r-functional-author",
    "05-nfr": "i2r-nfr-author",
    "06-acceptance": "i2r-acceptance-author",
    "07-review": "i2r-completeness-critic",
    "08-repair-notes": "i2r-orchestrator",
}
STAGE_BY_NUM = {
    "0": "00-mode-routing", "1": "01-intake", "2": "02-context", "2b": "02b-evidence",
    "3": "03-scope", "3b": "03b-scope-debate", "4": "04-functional", "5": "05-nfr",
    "6": "06-acceptance", "7": "07-review", "8": "08-repair-notes",
}
# Santa-loop independence (gate.check): the two reviewers must be DISTINCT and never an author.
ALLOWED_REVIEWERS = {"claude", "codex", "fallback-critic"}
AUTHOR_AGENTS = {"i2r-intake-clarifier", "i2r-context-analyst", "i2r-evidence-researcher",
                 "i2r-scope-architect", "i2r-functional-author", "i2r-nfr-author", "i2r-acceptance-author"}
PLACEHOLDER_LITERAL = [
    "tbd", "todo", "fixme", "to be determined", "nice to have",
    "as appropriate", "as needed", "and so on",
]
PLACEHOLDER_VAGUE = [
    "fast", "secure", "scalable", "robust", "user-friendly", "user friendly",
    "performant", "flexible", "efficient",
]
PRD_AMBIGUITY_TARGET = 0.20
MAX_REPAIR_ITERS = 3


# ============================== tiny utilities ==============================
def iso_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def ts_dir() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")


def slugify(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip().lower()).strip("-")
    return s or "idea"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def dump_json(path: Path, obj) -> None:
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False), encoding="utf-8")


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def die(msg: str, code: int = 2):
    print(f"i2r: {msg}", file=sys.stderr)
    sys.exit(code)


def _latest_run_under(d: Path) -> Path | None:
    if not d.exists() or not d.is_dir():
        return None
    subs = sorted([s for s in d.iterdir() if s.is_dir() and (s / "00-raw").exists()])
    return subs[-1] if subs else None


def find_run_dir(run: str) -> Path | None:
    p = Path(run)
    # 1. a direct run dir (contains 00-raw)
    if p.exists() and (p / "00-raw").exists():
        return p
    # 2. a path to a slug dir holding timestamped runs (e.g. runs/i2r/<slug>)
    hit = _latest_run_under(p)
    if hit:
        return hit
    # 3. a bare slug resolved under RUNS_DIR
    hit = _latest_run_under(RUNS_DIR / run)
    if hit:
        return hit
    # 4. a timestamp name nested under some slug
    if RUNS_DIR.exists():
        for slug_dir in RUNS_DIR.iterdir():
            cand = slug_dir / run
            if slug_dir.is_dir() and cand.is_dir() and (cand / "00-raw").exists():
                return cand
    return None


def read_state(run_dir: Path) -> dict:
    f = run_dir / "state.json"
    return load_json(f) if f.exists() else {"stale": []}


def write_state(run_dir: Path, state: dict) -> None:
    dump_json(run_dir / "state.json", state)


def append_log(run_dir: Path, line: str) -> None:
    with (run_dir / "run-log.md").open("a", encoding="utf-8") as fh:
        fh.write(f"- {iso_now()} {line}\n")


# ============================== schema validation ==============================
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
    elif t in ("string",):
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
    try:
        import jsonschema  # type: ignore
        v = jsonschema.Draft7Validator(schema)
        return [f"{'.'.join(str(p) for p in e.path)}: {e.message}" for e in v.iter_errors(inst)]
    except Exception:
        errors: list = []
        _subset_validate(inst, schema, schema, "$", errors)
        return errors


def validate_stage(run_dir: Path, stage: str) -> list:
    schema_name = STAGE_SCHEMA.get(stage)
    if not schema_name:
        return [f"unknown stage '{stage}'"]
    fpath = run_dir / f"{stage}.json"
    if not fpath.exists():
        return [f"{stage}.json: not found"]
    schema = load_json(SCHEMAS_DIR / schema_name)
    errs = validate_instance(load_json(fpath), schema)
    return [f"{stage}.json {e}" for e in errs]


# ============================== routing / state ==============================
def routing(run_dir: Path) -> dict:
    f = run_dir / "00-mode-routing.json"
    return load_json(f) if f.exists() else {}


def required_stages(run_dir: Path) -> list:
    r = routing(run_dir)
    stages = ["01-intake", "02-context", "03-scope", "04-functional", "05-nfr", "06-acceptance"]
    if r.get("requires_local_search") or r.get("requires_external_search"):
        stages.insert(2, "02b-evidence")
    if r.get("requires_scope_debate"):
        stages.insert(stages.index("04-functional"), "03b-scope-debate")
    return stages


def reviews(run_dir: Path) -> dict:
    out = {}
    for name in ("07-review.json", "07-review.codex.json"):
        f = run_dir / name
        if f.exists():
            out[name] = load_json(f)
    return out


def detect_state(run_dir: Path) -> dict:
    if not (run_dir / "00-raw").exists():
        return {"state": "no-run", "next": "PHASE 0 i2r.py init", "gate": None}
    if not (run_dir / "00-mode-routing.json").exists():
        return {"state": "raw-only", "next": "PHASE 0.5 dispatch i2r-orchestrator -> 00-mode-routing.json", "gate": None}
    intake = run_dir / "01-intake.json"
    if not intake.exists():
        return {"state": "routed", "next": "PHASE 1 dispatch i2r-intake-clarifier -> 01-intake.json", "gate": None}
    intake_obj = load_json(intake)
    if intake_obj.get("clarification_status") == "needs_clarification":
        return {"state": "needs-clarification", "next": "CLARIFY-LOOP: ask user, append 00-raw/clarifications-<n>.md, re-run intake", "gate": "CLARIFY"}
    for stage in required_stages(run_dir):
        # 04/05 are the parallel authors (handled below); 06 acceptance comes AFTER them.
        # Skip all three here so a missing 06 never pre-empts the parallel-authoring dispatch.
        if stage in ("04-functional", "05-nfr", "06-acceptance"):
            continue
        if not (run_dir / f"{stage}.json").exists():
            return {"state": f"need-{stage}", "next": f"dispatch {STAGE_OWNER.get(stage, '?')} -> {stage}.json", "gate": None}
    scope = run_dir / "03-scope.json"
    if scope.exists():
        sc = load_json(scope)
        if sc.get("scope_confirmed") is not True:
            return {"state": "scope-unconfirmed", "next": "SCOPE-GATE: confirm boundary with user (set scope_confirmed=true)", "gate": "SCOPE"}
    missing_authors = [s for s in ("04-functional", "05-nfr") if not (run_dir / f"{s}.json").exists()]
    if missing_authors:
        return {"state": "need-authoring", "next": f"PHASE 4 dispatch IN PARALLEL: {', '.join(STAGE_OWNER[s] for s in missing_authors)}", "gate": None}
    if not (run_dir / "06-acceptance.json").exists():
        return {"state": "need-acceptance", "next": "PHASE 5 dispatch i2r-acceptance-author -> 06-acceptance.json", "gate": None}
    rev = reviews(run_dir)
    if len(rev) < 2:
        return {"state": "need-review", "next": "PHASE 6 dispatch BOTH reviewers (santa-loop): i2r-completeness-critic + Codex /codex:adversarial-review", "gate": None}
    if any(v.get("verdict") == "FAIL" for v in rev.values()):
        failed = next((v.get("failed_stage", "?") for v in rev.values() if v.get("verdict") == "FAIL"), "?")
        return {"state": "review-fail", "next": f"REVIEW-LOOP: i2r.py repair.plan -> rerun {failed} -> re-review (max {MAX_REPAIR_ITERS})", "gate": "REVIEW"}
    if not (run_dir / "PRD.md").exists():
        return {"state": "reviews-pass", "next": "PHASE 7 i2r.py assemble", "gate": None}
    if not (run_dir / "gate-result.yaml").exists():
        return {"state": "assembled", "next": "PHASE 8 i2r.py gate.check", "gate": "G"}
    return {"state": "complete", "next": "COMPLETE -> handoff PRD.md to GSD (/gsd:ingest-docs or /gsd:plan-phase --prd PRD.md)", "gate": None}


# ============================== placeholder / prd grade ==============================
def _scan_text(text: str, terms: list) -> list:
    hits = []
    low = text.lower()
    for term in terms:
        if re.search(r"(?<![a-z])" + re.escape(term) + r"(?![a-z])", low):
            hits.append(term)
    return hits


def placeholder_scan(run_dir: Path) -> list:
    findings = []
    fr = run_dir / "04-functional.json"
    if fr.exists():
        for r in load_json(fr).get("requirements", []):
            for field in ("system_response", "rendered", "trigger"):
                for term in _scan_text(str(r.get(field, "")), PLACEHOLDER_LITERAL):
                    findings.append({"id": r.get("id"), "where": field, "term": term, "class": "PLACEHOLDER", "severity": "BLOCKER"})
    nf = run_dir / "05-nfr.json"
    if nf.exists():
        for n in load_json(nf).get("nfrs", []):
            if n.get("coverage_status") == "required":
                fc = n.get("fit_criterion") or {}
                if not all(fc.get(k) for k in ("threshold", "environment", "period")):
                    findings.append({"id": n.get("id"), "where": "fit_criterion", "term": "missing", "class": "NFR_MISSING", "severity": "BLOCKER"})
                for term in _scan_text(str(n.get("description", "")), PLACEHOLDER_VAGUE):
                    if not fc.get("threshold"):
                        findings.append({"id": n.get("id"), "where": "description", "term": term, "class": "PLACEHOLDER", "severity": "MAJOR"})
    prd = run_dir / "PRD.md"
    if prd.exists():
        for term in _scan_text(prd.read_text(encoding="utf-8"), PLACEHOLDER_LITERAL):
            findings.append({"id": "PRD", "where": "PRD.md", "term": term, "class": "PLACEHOLDER", "severity": "BLOCKER"})
    return findings


def prd_grade(run_dir: Path) -> dict:
    """Read the critic's gsd_ambiguity_precheck; never fabricate a semantic score."""
    rev = reviews(run_dir)
    scores = [v["gsd_ambiguity_precheck"]["score"] for v in rev.values()
              if isinstance(v.get("gsd_ambiguity_precheck"), dict) and "score" in v["gsd_ambiguity_precheck"]]
    if not scores:
        return {"score": None, "present": False, "pass": False}
    worst = max(scores)
    return {"score": worst, "present": True, "pass": worst <= PRD_AMBIGUITY_TARGET}


def reader_test_verdict(run_dir: Path) -> str:
    rev = reviews(run_dir)
    verdicts = [v["reader_test"]["verdict"] for v in rev.values()
                if isinstance(v.get("reader_test"), dict) and "verdict" in v["reader_test"]]
    if not verdicts:
        return "MISSING"
    return "FAIL" if "FAIL" in verdicts else "PASS"


def orphan_acceptance(run_dir: Path) -> list:
    """Acceptance scenarios whose requirement_id matches no FR (silently lost in traceability)."""
    fr = run_dir / "04-functional.json"
    ac = run_dir / "06-acceptance.json"
    if not (fr.exists() and ac.exists()):
        return []
    fr_ids = {r.get("id") for r in load_json(fr).get("requirements", [])}
    return [s.get("id") for s in load_json(ac).get("scenarios", []) if s.get("requirement_id") not in fr_ids]


def downstream_risk(run_dir: Path) -> bool:
    """The standalone downstream_ai_ambiguity_risk flag (CONTRACT §10), wherever a reviewer set it."""
    for v in reviews(run_dir).values():
        if v.get("downstream_ai_ambiguity_risk") is True:
            return True
        gp = v.get("gsd_ambiguity_precheck")
        if isinstance(gp, dict) and gp.get("downstream_ai_ambiguity_risk") is True:
            return True
    return False


# ============================== commands ==============================
def cmd_init(args) -> int:
    src = Path(args.idea)
    if not src.exists():
        die(f"idea path not found: {src}")
    slug = slugify(args.slug or src.stem)
    run_dir = RUNS_DIR / slug / ts_dir()
    raw = run_dir / "00-raw"
    raw.mkdir(parents=True, exist_ok=True)
    manifest = {}
    if src.is_dir():
        for f in sorted(src.rglob("*")):
            if f.is_file():
                rel = f.relative_to(src)
                dest = raw / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                data = f.read_bytes()
                dest.write_bytes(data)
                manifest[str(rel).replace("\\", "/")] = sha256_bytes(data)
    else:
        data = src.read_bytes()
        (raw / "idea.md").write_bytes(data)
        manifest["idea.md"] = sha256_bytes(data)
    run_id = f"i2r-{slug}-{run_dir.name}"
    dump_json(run_dir / "MANIFEST.json", {"run_id": run_id, "slug": slug, "created_at": iso_now(), "raw": manifest})
    write_state(run_dir, {"run_id": run_id, "slug": slug, "created_at": iso_now(), "stale": []})
    (run_dir / "run-log.md").write_text(f"# I2R run log - {run_id}\n", encoding="utf-8")
    append_log(run_dir, f"init: mirrored {len(manifest)} raw file(s) from {src}")
    print(f"run_id: {run_id}")
    print(f"run_dir: {run_dir}")
    print("next: PHASE 0.5 dispatch i2r-orchestrator -> 00-mode-routing.json")
    return 0


def cmd_status(args) -> int:
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    st = detect_state(run_dir)
    state = read_state(run_dir)
    print(f"run: {run_dir}")
    if state.get("stale"):
        print(f"STALE: {', '.join(state['stale'])}")
    print(f"state: {st['state']}")
    if st["gate"]:
        print(f"gate:  {st['gate']}")
    print(f"next:  {st['next']}")
    return 0


def cmd_route(args) -> int:
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    if not (run_dir / "00-mode-routing.json").exists():
        print("no 00-mode-routing.json yet; orchestrator must author it first")
        return 2
    errs = validate_stage(run_dir, "00-mode-routing")
    if errs:
        print("INVALID routing:\n  " + "\n  ".join(errs))
        return 2
    req = required_stages(run_dir)
    print("routing OK. required stage artifacts for this run:")
    for s in req:
        mark = "ok" if (run_dir / f"{s}.json").exists() else "--"
        print(f"  [{mark}] {s}.json")
    return 0


def cmd_validate(args) -> int:
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    if args.stage == "all":
        stages = [s for s in STAGE_SCHEMA if (run_dir / f"{s}.json").exists()]
    else:
        stage = STAGE_BY_NUM.get(args.stage, args.stage)
        stages = [stage]
    all_errs = []
    for s in stages:
        errs = validate_stage(run_dir, s)
        # owner check
        fpath = run_dir / f"{s}.json"
        if fpath.exists() and s in STAGE_OWNER:
            obj = load_json(fpath)
            got = (obj.get("_meta") or {}).get("generated_by_agent")
            if got and got != STAGE_OWNER[s]:
                errs.append(f"{s}.json _meta.generated_by_agent '{got}' != owner '{STAGE_OWNER[s]}'")
        if errs:
            all_errs.extend(errs)
            print(f"FAIL {s}:\n  " + "\n  ".join(errs))
        else:
            print(f"PASS {s}")
    codex = run_dir / "07-review.codex.json"
    if "07-review" in stages and codex.exists():
        schema = load_json(SCHEMAS_DIR / STAGE_SCHEMA["07-review"])
        cerrs = [f"07-review.codex.json {e}" for e in validate_instance(load_json(codex), schema)]
        if cerrs:
            all_errs.extend(cerrs)
            print("FAIL 07-review.codex:\n  " + "\n  ".join(cerrs))
        else:
            print("PASS 07-review.codex")
    return 2 if all_errs else 0


def cmd_mode_check(args) -> int:
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    r = routing(run_dir)
    if not r:
        print("no routing file; nothing to gate")
        return 0
    missing = []
    if (r.get("requires_local_search") or r.get("requires_external_search")) and not (run_dir / "02b-evidence.json").exists():
        missing.append("02b-evidence.json (routing requires search)")
    if r.get("requires_scope_debate") and not (run_dir / "03b-scope-debate.json").exists():
        missing.append("03b-scope-debate.json (routing requires scope debate)")
    if r.get("requires_discussion") == "blocking" and not list((run_dir / "00-raw").glob("clarifications-*.md")):
        missing.append("00-raw/clarifications-*.md (routing requires blocking discussion)")
    if r.get("requires_codex_review") and not (run_dir / "07-review.codex.json").exists() and (run_dir / "06-acceptance.json").exists():
        missing.append("07-review.codex.json (routing requires codex/adversarial review)")
    if missing:
        print("MODE-GATE blocked; missing:\n  " + "\n  ".join(missing))
        return 2
    print("MODE-GATE ok: all routing-required artifacts present")
    return 0


def cmd_evidence_validate(args) -> int:
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    if not (run_dir / "02b-evidence.json").exists():
        print("no evidence file (search mode not used)")
        return 0
    errs = validate_stage(run_dir, "02b-evidence")
    ev = load_json(run_dir / "02b-evidence.json")
    for e in ev.get("evidence", []):
        if not e.get("source_ref"):
            errs.append(f"evidence {e.get('id')}: missing source_ref")
    blocking_gaps = [g for g in ev.get("gaps", []) if g.get("impact") == "blocking"]
    if errs:
        print("FAIL evidence:\n  " + "\n  ".join(errs))
        return 2
    print(f"PASS evidence ({len(ev.get('evidence', []))} cards, {len(blocking_gaps)} blocking gap(s))")
    return 1 if blocking_gaps else 0


def cmd_discuss_record(args) -> int:
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    src = Path(args.file)
    if not src.exists():
        die(f"clarification file not found: {src}")
    existing = list((run_dir / "00-raw").glob("clarifications-*.md"))
    n = len(existing) + 1
    dest = run_dir / "00-raw" / f"clarifications-{n:03d}.md"
    dest.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
    # upstream changed -> mark intake+downstream stale
    state = read_state(run_dir)
    for s in ("01-intake", "02-context", "03-scope", "04-functional", "05-nfr", "06-acceptance"):
        if s not in state.setdefault("stale", []):
            state["stale"].append(s)
    write_state(run_dir, state)
    append_log(run_dir, f"discuss.record: added {dest.name}; marked downstream stale")
    print(f"recorded {dest.name}; re-run intake (downstream marked STALE)")
    return 0


def cmd_mark_stale(args) -> int:
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    state = read_state(run_dir)
    targets = [args.file] if args.file else ["01-intake", "02-context", "03-scope", "04-functional", "05-nfr", "06-acceptance"]
    for t in targets:
        if t not in state.setdefault("stale", []):
            state["stale"].append(t)
    write_state(run_dir, state)
    append_log(run_dir, f"mark-stale: {', '.join(targets)} ({args.reason})")
    print(f"marked STALE: {', '.join(targets)}")
    return 0


def cmd_unstale(args) -> int:
    """Clear a stale flag after the orchestrator has genuinely re-authored the stage(s).
    The gate blocks on any STALE artifact, so this is how a re-run clears its debt."""
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    state = read_state(run_dir)
    stale = state.get("stale", [])
    if args.all:
        cleared, state["stale"] = stale[:], []
    elif args.stage:
        cleared = [s for s in stale if s == args.stage]
        state["stale"] = [s for s in stale if s != args.stage]
    else:
        die("unstale needs --stage <name> or --all", 2)
    write_state(run_dir, state)
    append_log(run_dir, f"unstale: cleared {', '.join(cleared) or '(none)'}")
    print(f"cleared stale: {', '.join(cleared) or '(none)'}")
    return 0


def cmd_repair_plan(args) -> int:
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    rev = reviews(run_dir)
    fails = [v for v in rev.values() if v.get("verdict") == "FAIL"]
    if not fails:
        print("no failing review; nothing to repair")
        return 0
    prev = sorted((run_dir).glob("08-repair-notes*.json"))
    iteration = len(prev) + 1
    if iteration > MAX_REPAIR_ITERS:
        die(f"repair loop exhausted (>{MAX_REPAIR_ITERS}); surface to human", 2)
    findings, stages = [], set()
    for v in fails:
        for f in v.get("findings", []):
            findings.append(f)
        if v.get("failed_stage"):
            stages.add(v["failed_stage"])
    failed_stage = sorted(stages)[0] if stages else "04-functional"
    notes = {
        "_meta": {"artifact_version": ARTIFACT_VERSION, "stage": "08-repair-notes",
                  "run_id": read_state(run_dir).get("run_id", ""), "generated_by_agent": "i2r-orchestrator",
                  "created_at": iso_now()},
        "iteration": iteration, "failed_stage": failed_stage, "findings": findings,
        "repair_prompt": f"Only rewrite artifacts for {failed_stage}. Do NOT modify accepted scope or unrelated NFRs. Address each finding by id.",
        "new_attempt_required": True,
    }
    dump_json(run_dir / "08-repair-notes.json", notes)
    state = read_state(run_dir)
    if failed_stage not in state.setdefault("stale", []):
        state["stale"].append(failed_stage)
    write_state(run_dir, state)
    append_log(run_dir, f"repair.plan: iter {iteration}, failed_stage {failed_stage}, {len(findings)} finding(s)")
    print(f"repair plan iter {iteration}: rerun {failed_stage} ({len(findings)} findings) then re-review")
    return 0


def _md_list(items):
    return "\n".join(f"- {x}" for x in items) if items else "- (none)"


def _clean_title(idea_restatement: str, slug: str) -> str:
    """A clean PRD/project title: the first sentence of the idea restatement when it is short
    enough to read as a title, else a tidy slug-derived title. Never a mid-word [:80] cut."""
    first = re.split(r"(?<=[.!?])\s+", (idea_restatement or "").strip(), maxsplit=1)[0].strip().rstrip(".")
    if first and len(first) <= 80:
        return first
    pretty = (slug or "Project").replace("-", " ").replace("_", " ").strip()
    return pretty.title() if pretty else "Project"


def cmd_assemble(args) -> int:
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    need = ["01-intake", "02-context", "03-scope", "04-functional", "05-nfr", "06-acceptance"]
    for s in need:
        if not (run_dir / f"{s}.json").exists():
            die(f"cannot assemble: missing {s}.json", 2)
    intake = load_json(run_dir / "01-intake.json")
    context = load_json(run_dir / "02-context.json")
    scope = load_json(run_dir / "03-scope.json")
    func_doc = load_json(run_dir / "04-functional.json")
    funcs = func_doc.get("requirements", [])
    nfrs = load_json(run_dir / "05-nfr.json").get("nfrs", [])
    acc = load_json(run_dir / "06-acceptance.json").get("scenarios", [])
    state = read_state(run_dir)
    run_id = state.get("run_id", run_dir.name)
    name = _clean_title(intake.get("idea_restatement", ""), state.get("slug", ""))

    # ---- requirements.json (rigorous bundle) ----
    ac_by_fr = {}
    for s in acc:
        ac_by_fr.setdefault(s.get("requirement_id"), []).append(s.get("id"))
    # backfill each FR's acceptance_ids from the AC side (contract: the orchestrator links FR<->AC at assemble)
    for f in funcs:
        f["acceptance_ids"] = ac_by_fr.get(f.get("id"), [])
    dump_json(run_dir / "04-functional.json", func_doc)
    bundle = {
        "_meta": {"artifact_version": ARTIFACT_VERSION, "stage": "requirements-handoff", "run_id": run_id,
                  "generated_by_agent": "i2r.py-assemble", "created_at": iso_now()},
        "project": {"name": name, "slug": state.get("slug", ""), "run_id": run_id},
        "artifacts": {s: f"{s}.json" for s in need},
        "requirements_summary": {"fr_count": len(funcs), "nfr_count": len(nfrs), "ac_count": len(acc)},
        "traceability": [{"story": f.get("capability", ""), "fr_id": f.get("id"),
                          "ac_ids": ac_by_fr.get(f.get("id"), [])} for f in funcs],
        "constraints": [n.get("id") for n in nfrs if n.get("coverage_status") == "required"],
        "locked_decisions": [d.get("text") for d in intake.get("decisions", [])],
        "handoff_status": "PENDING_GATE",
    }
    dump_json(run_dir / "requirements.json", bundle)

    # ---- PRD.md (GSD-native projection) ----
    cats = {}
    for f in funcs:
        cats.setdefault(f.get("id", "X-00").split("-")[0], []).append(f)
    req_lines = []
    for cat in sorted(cats):
        req_lines.append(f"### {cat}")
        for f in cats[cat]:
            prose = f.get("rendered") or f.get("system_response", "")
            req_lines.append(f"{f.get('id')}: {prose}")
        req_lines.append("")
    ac_lines = [f"{s.get('id')}: {s.get('prose','')}" for s in acc]
    goals = [intake.get("idea_restatement", "")] + [f"{m.get('metric')}: {m.get('target')}" for m in context.get("success_metrics", [])]
    nongoals = [f"{o.get('item')} — {o.get('reason')}" for o in scope.get("out_of_scope", [])] + \
               [f"(deferred) {d.get('item')}" for d in scope.get("deferred", [])]
    constraints = [f"{n.get('id')} [{n.get('iso25010_category')}]: {n.get('description')}" +
                   (f" (fit: {n['fit_criterion'].get('threshold')} @ {n['fit_criterion'].get('environment')}, {n['fit_criterion'].get('period')})"
                    if n.get("coverage_status") == "required" and n.get("fit_criterion") else "")
                   for n in nfrs if n.get("coverage_status") == "required"] + \
                  [f"{c.get('type')}: {c.get('what')}" for c in context.get("constraints", [])]
    decisions = [d.get("text") for d in intake.get("decisions", [])]
    open_qs = [q.get("question") for q in intake.get("open_questions", []) if not q.get("blocking")]
    prd = f"""---
type: prd
source: idea-to-requirements-orchestrator
handoff_status: PENDING_GATE
---
# {name}

## Goals
{_md_list([g for g in goals if g])}

## Non-Goals / Out of Scope
{_md_list(nongoals)}

## Requirements
{chr(10).join(req_lines)}
## Acceptance Criteria
{_md_list(ac_lines)}

## Constraints
{_md_list(constraints)}

## Locked Decisions
{_md_list(decisions)}

## Open Questions
{_md_list(open_qs)}

## How to feed GSD
- /gsd:ingest-docs            (full bootstrap; classified as PRD)
- /gsd:plan-phase --prd PRD.md (lightweight single-doc)
"""
    (run_dir / "PRD.md").write_text(prd, encoding="utf-8")

    # ---- ADR projection (one per locked decision) ----
    dec_dir = run_dir / "decisions"
    dec_dir.mkdir(exist_ok=True)
    for i, d in enumerate(intake.get("decisions", []), 1):
        adr = f"""---
type: adr
status: Accepted
id: ADR-{i:04d}
---
# ADR-{i:04d}: {d.get('text','')[:70]}

## Decision
{d.get('text','')}

## Source
{d.get('source_ref','(intake decision)')}
"""
        (dec_dir / f"ADR-{i:04d}.md").write_text(adr, encoding="utf-8")
    append_log(run_dir, f"assemble: requirements.json + PRD.md ({len(funcs)} FR / {len(nfrs)} NFR / {len(acc)} AC) + {len(intake.get('decisions', []))} ADR")
    print(f"assembled: PRD.md, requirements.json, {len(intake.get('decisions', []))} ADR(s)")
    print("next: i2r.py gate.check")
    return 0


def _yscalar(v) -> str:
    """YAML-safe scalar. Quotes strings that would otherwise misparse (e.g. reasons containing ': '),
    but leaves bare word values (verdict, stage names) unquoted so simple regex consumers still match."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v)
    needs = (s == "" or s != s.strip() or s[:1] in "-?:,[]{}#&*!|>%@\"'`"
             or ": " in s or s.endswith(":") or "#" in s
             or s.lower() in ("true", "false", "null", "yes", "no", "~", "on", "off"))
    if needs:
        return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'
    return s


def _yaml(obj, indent=0) -> str:
    pad = "  " * indent
    out = []
    for k, v in obj.items():
        if isinstance(v, list):
            if not v:
                out.append(f"{pad}{k}: []")
            else:
                out.append(f"{pad}{k}:")
                for item in v:
                    out.append(f"{pad}  - {_yscalar(item)}")
        elif isinstance(v, dict):
            out.append(f"{pad}{k}:")
            out.append(_yaml(v, indent + 1))
        else:
            out.append(f"{pad}{k}: {_yscalar(v)}")
    return "\n".join(out)


def cmd_gate_check(args) -> int:
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    reasons, missing = [], []
    for s in required_stages(run_dir):
        errs = validate_stage(run_dir, s)
        if errs:
            missing.append(s)
            reasons.append(f"{s}: {errs[0]}")
    rev = reviews(run_dir)
    rev_objs = list(rev.values())
    # schema-validate the review artifacts themselves (they are NOT in required_stages)
    review_schema = load_json(SCHEMAS_DIR / STAGE_SCHEMA["07-review"])
    for rname, robj in rev.items():
        rerrs = validate_instance(robj, review_schema)
        if rerrs:
            missing.append(rname)
            reasons.append(f"{rname}: {rerrs[0]}")
    reviewers = [v.get("reviewer") for v in rev_objs]
    both_pass = len(rev) >= 2 and all(v.get("verdict") == "PASS" for v in rev_objs)
    # santa-loop independence: two DISTINCT reviewers in the allowed set, neither an author
    independent = (len(rev) >= 2
                   and len({r for r in reviewers if r}) >= 2
                   and all(r in ALLOWED_REVIEWERS for r in reviewers)
                   and all((v.get("_meta") or {}).get("generated_by_agent") not in AUTHOR_AGENTS for v in rev_objs))
    if len(rev) < 2:
        reasons.append(f"only {len(rev)}/2 reviews present")
    else:
        if not both_pass:
            reasons.append("not both reviews PASS")
        if not independent:
            reasons.append("reviews not independent (need two distinct reviewers in {claude,codex,fallback-critic}, neither an author)")
    findings = [f for v in rev_objs for f in v.get("findings", [])]
    blockers = [f for f in findings if f.get("severity") == "BLOCKER"]
    majors = [f for f in findings if f.get("severity") == "MAJOR"]
    ph = placeholder_scan(run_dir)
    ph_block = [f for f in ph if f.get("severity") == "BLOCKER"]
    grade = prd_grade(run_dir)
    reader = reader_test_verdict(run_dir)
    stale = read_state(run_dir).get("stale", [])
    orphans = orphan_acceptance(run_dir)
    dstream = downstream_risk(run_dir)
    if not grade["present"]:
        reasons.append("gsd_ambiguity_precheck missing")
    elif not grade["pass"]:
        reasons.append(f"prd ambiguity {grade['score']} > target {PRD_AMBIGUITY_TARGET}")
    if reader == "FAIL":
        reasons.append("reader-test FAILED (PRD not standalone-readable)")
    elif reader == "MISSING":
        reasons.append("reader-test missing (required precondition)")
    if blockers:
        reasons.append(f"{len(blockers)} open BLOCKER finding(s)")
    if ph_block:
        reasons.append("placeholder/NFR blocker(s): " + ", ".join(f"{f['id']}.{f['where']}='{f['term']}'" for f in ph_block[:5]))
    if majors:
        reasons.append(f"{len(majors)} open MAJOR finding(s)")
    if stale:
        reasons.append("STALE artifacts pending re-run: " + ", ".join(stale))
    if orphans:
        reasons.append("orphan acceptance (no matching FR): " + ", ".join(orphans[:5]))
    if dstream:
        reasons.append("downstream_ai_ambiguity_risk flagged by a reviewer")

    blocked = (bool(missing) or bool(blockers) or bool(ph_block) or reader in ("FAIL", "MISSING")
               or not both_pass or not independent or bool(stale))
    if blocked:
        verdict, code = "BLOCKED", 2
    elif majors or (grade["present"] and not grade["pass"]) or not grade["present"] or orphans or dstream:
        verdict, code = "NEEDS_REVIEW", 1
    else:
        verdict, code = "READY", 0

    result = {
        "verdict": verdict, "generated_at": iso_now(), "run_id": read_state(run_dir).get("run_id", ""),
        "both_reviews_pass": both_pass, "open_blockers": len(blockers) + len(ph_block),
        "open_majors": len(majors), "placeholder_hits": len(ph),
        "reader_test": reader, "prd_ambiguity_score": grade["score"],
        "missing_or_invalid_stages": missing, "reasons": reasons or ["all gate checks passed"],
    }
    (run_dir / "gate-result.yaml").write_text(_yaml(result) + "\n", encoding="utf-8")
    # patch PRD frontmatter status
    prd = run_dir / "PRD.md"
    if prd.exists():
        txt = prd.read_text(encoding="utf-8")
        txt = re.sub(r"handoff_status:\s*\w+", f"handoff_status: {verdict}", txt, count=1)
        prd.write_text(txt, encoding="utf-8")
    append_log(run_dir, f"gate.check: {verdict} (blockers={result['open_blockers']} majors={len(majors)} reader={reader})")
    print(f"GATE: {verdict}")
    for r in result["reasons"]:
        print(f"  - {r}")
    return code


def cmd_diff(args) -> int:
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    state = read_state(run_dir)
    print(f"run: {run_dir}")
    print(f"stale/needs-rerun: {', '.join(state.get('stale', [])) or '(none)'}")
    present = [s for s in STAGE_SCHEMA if (run_dir / f'{s}.json').exists()]
    print(f"present stages: {', '.join(present) or '(none)'}")
    return 0


def cmd_explain_fail(args) -> int:
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    gr = run_dir / "gate-result.yaml"
    if not gr.exists():
        print("no gate-result.yaml; run gate.check first")
        return 2
    print(gr.read_text(encoding="utf-8"))
    ph = placeholder_scan(run_dir)
    if ph:
        print("placeholder/NFR findings (root cause first):")
        for f in ph:
            print(f"  - {f['severity']} {f['class']} {f['id']}.{f['where']}: '{f['term']}'")
    return 0


def cmd_evals_run(args) -> int:
    """Harness sanity check: schemas parse + a scenario manifest exists. Not an LLM run."""
    ok = True
    for p in sorted(SCHEMAS_DIR.glob("*.schema.json")):
        try:
            load_json(p)
            print(f"PASS schema parses: {p.name}")
        except Exception as e:
            ok = False
            print(f"FAIL schema: {p.name}: {e}")
    ps = ROOT / "evals" / "pressure-scenarios"
    scen = sorted(ps.glob("*.md")) if ps.exists() else []
    print(f"pressure scenarios found: {len(scen)}")
    for s in scen:
        print(f"  - {s.name}")
    return 0 if ok else 2


def cmd_install(args) -> int:
    """Install the I2R toolchain into a project: copy the SDK + schemas + hooks, then register the hooks
    in <project>/.claude/settings.json (additive + idempotent). Run from the global template
    (~/.claude/templates/i2r) to provision a new project. init scaffolds runs; install wires enforcement."""
    proj = Path(args.project).resolve() if args.project else ROOT
    hook_src = (ROOT / "hooks") if (ROOT / "hooks").exists() else (ROOT / ".claude" / "hooks")
    if proj != ROOT.resolve():
        (proj / "scripts").mkdir(parents=True, exist_ok=True)
        if (ROOT / "scripts" / "i2r.py").exists():
            shutil.copy(ROOT / "scripts" / "i2r.py", proj / "scripts" / "i2r.py")
        (proj / "schemas").mkdir(parents=True, exist_ok=True)
        for s in (ROOT / "schemas").glob("*.json"):
            shutil.copy(s, proj / "schemas" / s.name)
        (proj / ".claude" / "hooks").mkdir(parents=True, exist_ok=True)
        for h in hook_src.glob("*.js"):
            shutil.copy(h, proj / ".claude" / "hooks" / h.name)
        contract = ROOT / "docs" / "CONTRACT.md"
        if contract.exists():
            (proj / "docs").mkdir(parents=True, exist_ok=True)
            shutil.copy(contract, proj / "docs" / "CONTRACT.md")
    events = {
        "SessionStart": [("i2r-session-context", None)],
        "UserPromptSubmit": [("i2r-auto-trigger-boundary", None)],
        "PreToolUse": [("i2r-write-boundary", "Write|Edit|MultiEdit")],
        "PostToolUse": [("i2r-mark-stale", "Write|Edit|MultiEdit")],
        "Stop": [("i2r-mode-gate", None), ("i2r-handoff-gate", None), ("i2r-citation-gate", None)],
        "SubagentStop": [("i2r-subagent-output-gate", None), ("i2r-citation-gate", None)],
    }
    sp = proj / ".claude" / "settings.json"
    sp.parent.mkdir(parents=True, exist_ok=True)
    settings = load_json(sp) if sp.exists() else {}
    hooks = settings.setdefault("hooks", {})
    added = 0
    for event, entries in events.items():
        ev = hooks.setdefault(event, [])
        for name, matcher in entries:
            cmd = f'node "${{CLAUDE_PROJECT_DIR}}/.claude/hooks/{name}.js"'
            exists = any(isinstance(blk, dict) and any(h.get("command") == cmd for h in blk.get("hooks", [])) for blk in ev)
            if exists:
                continue
            block = {"hooks": [{"type": "command", "command": cmd}]}
            if matcher:
                block["matcher"] = matcher
            ev.append(block)
            added += 1
    dump_json(sp, settings)
    print(f"installed I2R toolchain + {added} hook registration(s) into {proj}")
    return 0


# ============================== CLI ==============================
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="i2r.py", description="I2R deterministic SDK ($0, no-LLM)")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("init"); s.add_argument("idea"); s.add_argument("--slug"); s.set_defaults(fn=cmd_init)
    for nm, fn in (("status", cmd_status), ("route", cmd_route), ("mode.check", cmd_mode_check),
                   ("evidence.validate", cmd_evidence_validate), ("repair.plan", cmd_repair_plan),
                   ("assemble", cmd_assemble), ("gate.check", cmd_gate_check), ("diff", cmd_diff),
                   ("explain-fail", cmd_explain_fail)):
        sp = sub.add_parser(nm); sp.add_argument("run"); sp.set_defaults(fn=fn)
    s = sub.add_parser("validate"); s.add_argument("run"); s.add_argument("--stage", required=True); s.set_defaults(fn=cmd_validate)
    s = sub.add_parser("discuss.record"); s.add_argument("run"); s.add_argument("--file", required=True); s.set_defaults(fn=cmd_discuss_record)
    s = sub.add_parser("mark-stale"); s.add_argument("run"); s.add_argument("--reason", required=True); s.add_argument("--file"); s.set_defaults(fn=cmd_mark_stale)
    s = sub.add_parser("unstale"); s.add_argument("run"); s.add_argument("--stage"); s.add_argument("--all", action="store_true"); s.set_defaults(fn=cmd_unstale)
    s = sub.add_parser("install"); s.add_argument("--project"); s.set_defaults(fn=cmd_install)
    s = sub.add_parser("evals.run"); s.set_defaults(fn=cmd_evals_run)
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
