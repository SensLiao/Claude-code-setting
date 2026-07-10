#!/usr/bin/env python3
"""
i2r_core.py - deterministic ($0, no-LLM) ENGINE for I2R (v2 Markdown-first).

The non-CLI half of the SDK: constants, the .i2r/ run-folder layout, run discovery, state/log,
stage IO + schema validation, routing + state detection, the semantic + Markdown-first structural
gate checks, the rendering model builder, and the YAML emitter. i2r.py is the thin CLI layer that
imports from here. Markdown rendering lives in i2r_render.py (pure); schema validation in i2r_validate.py.

Single source of truth for shapes/paths/enums: docs/CONTRACT.md. Stdlib only.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import i2r_render as R          # noqa: E402
from i2r_validate import validate_instance  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SCHEMAS_DIR = ROOT / "schemas"
I2R_HOME = ROOT / ".i2r"
RUNS_DIR = I2R_HOME / "runs"
ARTIFACT_VERSION = "2.0"

# ---- CONTRACT-derived constants (docs/CONTRACT.md) ----
STAGE_SCHEMA = {
    "00-mode-routing": "00-mode-routing.schema.json", "01-intake": "01-intake.schema.json",
    "02-context": "02-context.schema.json", "02b-evidence": "02b-evidence.schema.json",
    "03-scope": "03-scope.schema.json", "03b-scope-debate": "03b-scope-debate.schema.json",
    "04-functional": "04-functional.schema.json", "05-nfr": "05-nfr.schema.json",
    "06-acceptance": "06-acceptance.schema.json", "07-review": "07-review.schema.json",
    "08-repair-notes": "08-repair-notes.schema.json",
    "requirements-handoff": "requirements-handoff.schema.json",
}
STAGE_OWNER = {
    "00-mode-routing": "i2r-orchestrator", "01-intake": "i2r-intake-clarifier",
    "02-context": "i2r-context-analyst", "02b-evidence": "i2r-evidence-researcher",
    "03-scope": "i2r-scope-architect", "03b-scope-debate": "i2r-orchestrator",
    "04-functional": "i2r-functional-author", "05-nfr": "i2r-nfr-author",
    "06-acceptance": "i2r-acceptance-author", "07-review": "i2r-completeness-critic",
    "08-repair-notes": "i2r-orchestrator",
}
STAGE_BY_NUM = {
    "0": "00-mode-routing", "1": "01-intake", "2": "02-context", "2b": "02b-evidence",
    "3": "03-scope", "3b": "03b-scope-debate", "4": "04-functional", "5": "05-nfr",
    "6": "06-acceptance", "7": "07-review", "8": "08-repair-notes",
}
CONDITIONAL_STAGES = ("02b-evidence", "03b-scope-debate", "08-repair-notes")
ALLOWED_REVIEWERS = {"claude", "codex", "fallback-critic"}
AUTHOR_AGENTS = {"i2r-intake-clarifier", "i2r-context-analyst", "i2r-evidence-researcher",
                 "i2r-scope-architect", "i2r-functional-author", "i2r-nfr-author", "i2r-acceptance-author"}
PLACEHOLDER_LITERAL = ["tbd", "todo", "fixme", "to be determined", "nice to have",
                       "as appropriate", "as needed", "and so on"]
PLACEHOLDER_VAGUE = ["fast", "secure", "scalable", "robust", "user-friendly", "user friendly",
                     "performant", "flexible", "efficient"]
# out/ may never contain these (CONTRACT §1, §8, §18)
DOWNSTREAM_CMD_PAT = [r"/gsd:", r"gsd:plan", r"gsd:ingest", r"plan-phase", r"ingest-docs",
                      r"next_command_hint", r"handoff\.gsd"]
MACHINE_CONTRACT_PAT = [r"consumer[_ ]contract", r"next[_ ]command[_ ]hint",
                        r"required_gsd_behavior", r"handoff\.gsd"]
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
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False), encoding="utf-8")


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def die(msg: str, code: int = 2):
    print(f"i2r: {msg}", file=sys.stderr)
    sys.exit(code)


def load_config() -> dict:
    """OPTIONAL config (.i2r/config/i2r.config.yaml). Defaults apply if absent — I2R stays config-less by
    default (CONTRACT §2). Tolerant flat scan; only a few keys are honored."""
    cfg = {"max_ambiguity_score": PRD_AMBIGUITY_TARGET, "primary": "en"}
    f = I2R_HOME / "config" / "i2r.config.yaml"
    if f.exists():
        txt = f.read_text(encoding="utf-8")
        m = re.search(r"max_ambiguity_score:\s*([0-9.]+)", txt)
        if m:
            cfg["max_ambiguity_score"] = float(m.group(1))
        m = re.search(r"primary:\s*[\"']?([a-z]{2})", txt)
        if m and m.group(1) in ("en", "zh"):
            cfg["primary"] = m.group(1)
    return cfg


# ============================== run-folder layout (.i2r/) ==============================
def raw_dir(r: Path) -> Path: return r / "raw"
def out_dir(r: Path) -> Path: return r / "out"
def internal_dir(r: Path) -> Path: return r / "internal"
def stages_dir(r: Path) -> Path: return r / "internal" / "stages"
def audit_dir(r: Path) -> Path: return r / "audit"
def ops_dir(r: Path) -> Path: return r / "ops"
def stage_path(r: Path, stage: str) -> Path: return stages_dir(r) / f"{stage}.json"
def state_path(r: Path) -> Path: return ops_dir(r) / "state.json"


def is_run_dir(p: Path) -> bool:
    return p.is_dir() and (p / "raw").exists() and (p / "ops").exists()


def _latest_run_under(d: Path) -> Path | None:
    if not d.exists() or not d.is_dir():
        return None
    subs = sorted([s for s in d.iterdir() if is_run_dir(s)])
    return subs[-1] if subs else None


def find_run_dir(run: str) -> Path | None:
    p = Path(run)
    if is_run_dir(p):
        return p
    hit = _latest_run_under(p)
    if hit:
        return hit
    hit = _latest_run_under(RUNS_DIR / run)
    if hit:
        return hit
    if RUNS_DIR.exists():
        for slug_dir in RUNS_DIR.iterdir():
            cand = slug_dir / run
            if slug_dir.is_dir() and is_run_dir(cand):
                return cand
    return None


def read_state(r: Path) -> dict:
    f = state_path(r)
    return load_json(f) if f.exists() else {"stale": []}


def write_state(r: Path, state: dict) -> None:
    dump_json(state_path(r), state)


def append_log(r: Path, line: str) -> None:
    log = ops_dir(r) / "run-log.md"
    log.parent.mkdir(parents=True, exist_ok=True)
    with log.open("a", encoding="utf-8") as fh:
        fh.write(f"- {iso_now()} {line}\n")


def run_lang(r: Path) -> str:
    return read_state(r).get("lang", "en")


# ============================== stage loading + validation ==============================
def load_stage(r: Path, stage: str):
    f = stage_path(r, stage)
    return load_json(f) if f.exists() else None


def is_skipped(obj) -> bool:
    return isinstance(obj, dict) and obj.get("status") == "SKIPPED"


def validate_stage(r: Path, stage: str) -> list:
    schema_name = STAGE_SCHEMA.get(stage)
    if not schema_name:
        return [f"unknown stage '{stage}'"]
    fpath = stage_path(r, stage)
    if not fpath.exists():
        return [f"{stage}.json: not found"]
    obj = load_json(fpath)
    if is_skipped(obj):
        return []  # SKIPPED stub counts as satisfied-absent (CONTRACT §3)
    schema = load_json(SCHEMAS_DIR / schema_name)
    return [f"{stage}.json {e}" for e in validate_instance(obj, schema)]


# ============================== routing / state ==============================
def routing(r: Path) -> dict:
    obj = load_stage(r, "00-mode-routing")
    return obj or {}


def required_stages(r: Path) -> list:
    rt = routing(r)
    stages = ["01-intake", "02-context", "03-scope", "04-functional", "05-nfr", "06-acceptance"]
    if rt.get("requires_local_search") or rt.get("requires_external_search"):
        stages.insert(2, "02b-evidence")
    if rt.get("requires_scope_debate"):
        stages.insert(stages.index("04-functional"), "03b-scope-debate")
    return stages


def reviews(r: Path) -> dict:
    out = {}
    for name in ("07-review", "07-review.codex"):
        f = stages_dir(r) / f"{name}.json"
        if f.exists():
            obj = load_json(f)
            if not is_skipped(obj):
                out[f"{name}.json"] = obj
    return out


def detect_state(r: Path) -> dict:
    if not raw_dir(r).exists():
        return {"state": "no-run", "next": "PHASE 0 i2r.py init", "gate": None}
    if not stage_path(r, "00-mode-routing").exists():
        return {"state": "raw-only", "next": "PHASE 0.5 dispatch i2r-orchestrator -> internal/stages/00-mode-routing.json", "gate": None}
    intake = stage_path(r, "01-intake")
    if not intake.exists():
        return {"state": "routed", "next": "PHASE 1 dispatch i2r-intake-clarifier -> internal/stages/01-intake.json", "gate": None}
    intake_obj = load_json(intake)
    if intake_obj.get("clarification_status") == "needs_clarification":
        return {"state": "needs-clarification", "next": "CLARIFY-LOOP: ask user, append raw/clarifications-<n>.md, re-run intake", "gate": "CLARIFY"}
    for stage in required_stages(r):
        if stage in ("04-functional", "05-nfr", "06-acceptance"):
            continue
        if not stage_path(r, stage).exists():
            return {"state": f"need-{stage}", "next": f"dispatch {STAGE_OWNER.get(stage, '?')} -> internal/stages/{stage}.json", "gate": None}
    scope = load_stage(r, "03-scope")
    if scope and scope.get("scope_confirmed") is not True:
        return {"state": "scope-unconfirmed", "next": "SCOPE-GATE: confirm boundary with user (set scope_confirmed=true)", "gate": "SCOPE"}
    missing_authors = [s for s in ("04-functional", "05-nfr") if not stage_path(r, s).exists()]
    if missing_authors:
        return {"state": "need-authoring", "next": f"PHASE 4 dispatch IN PARALLEL: {', '.join(STAGE_OWNER[s] for s in missing_authors)}", "gate": None}
    if not stage_path(r, "06-acceptance").exists():
        return {"state": "need-acceptance", "next": "PHASE 5 dispatch i2r-acceptance-author -> internal/stages/06-acceptance.json", "gate": None}
    # Markdown-first order: ASSEMBLE the out/ package FIRST, because the reviewers (and Reader Test)
    # review the out/ package — not the raw stage JSON. Then dual-review, then gate.
    if not (out_dir(r) / "PRD.md").exists():
        return {"state": "need-assemble", "next": "PHASE 6 i2r.py assemble (build the out/ package for review)", "gate": None}
    rev = reviews(r)
    if len(rev) < 2:
        return {"state": "need-review", "next": "PHASE 7 dispatch BOTH reviewers (santa-loop) over the out/ package: i2r-completeness-critic + Codex /codex:adversarial-review", "gate": None}
    if any(v.get("verdict") == "FAIL" for v in rev.values()):
        failed = next((v.get("failed_stage", "?") for v in rev.values() if v.get("verdict") == "FAIL"), "?")
        return {"state": "review-fail", "next": f"REVIEW-LOOP: i2r.py repair.plan -> rerun {failed} -> re-assemble -> re-review (max {MAX_REPAIR_ITERS})", "gate": "REVIEW"}
    if not (audit_dir(r) / "gate-result.yaml").exists():
        return {"state": "reviewed", "next": "PHASE 8 i2r.py gate.check", "gate": "G"}
    return {"state": "complete", "next": "COMPLETE -> out/ Markdown package ready; read out/README.md (out/READINESS.md = verdict)", "gate": None}


# ============================== semantic checks ==============================
def _scan_text(text: str, terms: list) -> list:
    hits, low = [], text.lower()
    for term in terms:
        if re.search(r"(?<![a-z])" + re.escape(term) + r"(?![a-z])", low):
            hits.append(term)
    return hits


def placeholder_scan(r: Path) -> list:
    findings = []
    fr = load_stage(r, "04-functional")
    if fr and not is_skipped(fr):
        for req in fr.get("requirements", []):
            for field in ("system_response", "rendered", "trigger"):
                for term in _scan_text(str(req.get(field, "")), PLACEHOLDER_LITERAL):
                    findings.append({"id": req.get("id"), "where": field, "term": term, "class": "PLACEHOLDER", "severity": "BLOCKER"})
    nf = load_stage(r, "05-nfr")
    if nf and not is_skipped(nf):
        for n in nf.get("nfrs", []):
            if n.get("coverage_status") == "required":
                fc = n.get("fit_criterion") or {}
                if not all(fc.get(k) for k in ("threshold", "environment", "period")):
                    findings.append({"id": n.get("id"), "where": "fit_criterion", "term": "missing", "class": "NFR_MISSING", "severity": "BLOCKER"})
                for term in _scan_text(str(n.get("description", "")), PLACEHOLDER_VAGUE):
                    if not fc.get("threshold"):
                        findings.append({"id": n.get("id"), "where": "description", "term": term, "class": "PLACEHOLDER", "severity": "MAJOR"})
    prd = out_dir(r) / "PRD.md"
    if prd.exists():
        for term in _scan_text(prd.read_text(encoding="utf-8"), PLACEHOLDER_LITERAL):
            findings.append({"id": "PRD", "where": "out/PRD.md", "term": term, "class": "PLACEHOLDER", "severity": "BLOCKER"})
    return findings


def _norm_body(text) -> str:
    """Normalize a requirement body for exact-duplicate detection: lowercase, strip
    punctuation, collapse whitespace. Conservative — only an exact normalized match
    counts as a duplicate (no fuzzy matching -> no false positives)."""
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", str(text or "").lower())).strip()


def minimalism_scan(r: Path) -> list:
    """RML deterministic scan (vendored: ponytail laziness ladder -> requirements domain).
    Flags over-specification; NEVER blocks. Findings are shaped like placeholder_scan
    ({id, where, term, class, severity}); the SDK reads severity, not class enum.
      - DUPLICATE          (MAJOR): two FRs, or two required NFRs, with identical normalized bodies.
      - OVER_SPECIFICATION (MINOR): a required NFR sourced 'assumed' with no source_ref (unmotivated default).
      - deferral_has_trigger (MAJOR): a deferred[] scope item with no non-empty revisit_trigger.
    Severities are MAJOR/MINOR only — RML surfaces, it does not cut (safety floor stays intact)."""
    findings = []

    fr = load_stage(r, "04-functional")
    if fr and not is_skipped(fr):
        seen = {}
        for req in fr.get("requirements", []):
            key = _norm_body(req.get("system_response") or req.get("rendered"))
            if not key:
                continue
            if key in seen:
                findings.append({"id": req.get("id"), "where": "system_response",
                                 "term": "duplicate of " + str(seen[key]),
                                 "class": "DUPLICATE", "severity": "MAJOR"})
            else:
                seen[key] = req.get("id")

    nf = load_stage(r, "05-nfr")
    if nf and not is_skipped(nf):
        seen = {}
        for n in nf.get("nfrs", []):
            if n.get("coverage_status") != "required":
                continue
            key = _norm_body(n.get("description"))
            if key:
                if key in seen:
                    findings.append({"id": n.get("id"), "where": "description",
                                     "term": "duplicate of " + str(seen[key]),
                                     "class": "DUPLICATE", "severity": "MAJOR"})
                else:
                    seen[key] = n.get("id")
            if n.get("source") == "assumed" and not str(n.get("source_ref", "")).strip():
                findings.append({"id": n.get("id"), "where": "source",
                                 "term": "unmotivated assumed default",
                                 "class": "OVER_SPECIFICATION", "severity": "MINOR"})

    scope = load_stage(r, "03-scope")
    if scope and not is_skipped(scope):
        for d in scope.get("deferred", []):
            if not str(d.get("revisit_trigger", "")).strip():
                findings.append({"id": d.get("item", "?"), "where": "deferred.revisit_trigger",
                                 "term": "missing", "class": "deferral_has_trigger", "severity": "MAJOR"})

    return findings


def prd_grade(r: Path) -> dict:
    rev = reviews(r)
    scores = [v["gsd_ambiguity_precheck"]["score"] for v in rev.values()
              if isinstance(v.get("gsd_ambiguity_precheck"), dict) and "score" in v["gsd_ambiguity_precheck"]]
    if not scores:
        return {"score": None, "present": False, "pass": False}
    worst = max(scores)
    return {"score": worst, "present": True, "pass": worst <= load_config()["max_ambiguity_score"]}


def reader_test_verdict(r: Path) -> str:
    verdicts = [v["reader_test"]["verdict"] for v in reviews(r).values()
                if isinstance(v.get("reader_test"), dict) and "verdict" in v["reader_test"]]
    if not verdicts:
        return "MISSING"
    return "FAIL" if "FAIL" in verdicts else "PASS"


def orphan_acceptance(r: Path) -> list:
    fr, ac = load_stage(r, "04-functional"), load_stage(r, "06-acceptance")
    if not (fr and ac) or is_skipped(fr) or is_skipped(ac):
        return []
    fr_ids = {req.get("id") for req in fr.get("requirements", [])}
    return [s.get("id") for s in ac.get("scenarios", []) if s.get("requirement_id") not in fr_ids]


def downstream_risk(r: Path) -> bool:
    for v in reviews(r).values():
        if v.get("downstream_ai_ambiguity_risk") is True:
            return True
        gp = v.get("gsd_ambiguity_precheck")
        if isinstance(gp, dict) and gp.get("downstream_ai_ambiguity_risk") is True:
            return True
    return False


# ============================== structural checks (out/ Markdown-first) ==============================
def out_structural_checks(r: Path, lang: str) -> tuple:
    """Deterministic Markdown-first gate checks over out/ (CONTRACT §8/§18).
    Returns (checks, blockers, majors): checks = [{name,result,note}]; blockers/majors are reason strings."""
    od = out_dir(r)
    checks, blockers, majors = [], [], []

    def add(name, ok, note="", hard=True):
        checks.append({"name": name, "result": "PASS" if ok else "FAIL", "note": "" if ok else note})
        if not ok:
            (blockers if hard else majors).append(f"{name}: {note}" if note else name)

    if not od.exists():
        add("out_exists", False, "out/ directory missing")
        return checks, blockers, majors

    md_files = {p.name: p.read_text(encoding="utf-8") for p in od.rglob("*.md")}
    non_md = [p.name for p in od.rglob("*") if p.is_file() and p.suffix.lower() != ".md"]
    add("out_markdown_only", not non_md, ("non-markdown in out/: " + ", ".join(non_md[:5])) if non_md else "")

    all_text = "\n".join(md_files.values())
    cmd_hits = [p for p in DOWNSTREAM_CMD_PAT if re.search(p, all_text, re.IGNORECASE)]
    add("no_downstream_commands", not cmd_hits, ("found: " + ", ".join(cmd_hits)) if cmd_hits else "")
    mc_hits = [p for p in MACHINE_CONTRACT_PAT if re.search(p, all_text, re.IGNORECASE)]
    add("no_machine_contract_language", not mc_hits, ("found: " + ", ".join(mc_hits)) if mc_hits else "", hard=False)

    for fname, key in [("READINESS.md", "readiness_markdown_exists"), ("TRACEABILITY.md", "traceability_markdown_exists"),
                       ("CONSTRAINTS.md", "constraints_visible"), ("QUESTIONS.md", "questions_assumptions_visible")]:
        present = bool(md_files.get(fname, "").strip())
        add(key, present, "" if present else f"{fname} missing/empty")

    prd = md_files.get("PRD.md", "")
    add("prd_has_executive_summary", R.t(lang, "exec_summary") in prd,
        "PRD.md has no Executive Summary", hard=False)
    reqs = md_files.get("REQUIREMENTS.md", "")
    add("requirements_are_narrative", reqs.count("### ") >= 1,
        "REQUIREMENTS.md is not narrative (no per-requirement sections)", hard=False)
    acc = md_files.get("ACCEPTANCE.md", "")
    g_blocks = acc.count("```gherkin")
    plain = acc.count("**" + R.t(lang, "plain_lang") + "**")
    add("acceptance_has_plain_language", g_blocks == 0 or plain >= g_blocks,
        "Gherkin scenarios missing plain-language explanation", hard=False)
    return checks, blockers, majors


# ============================== rendering model builder ==============================
def load_all_stages(r: Path) -> dict:
    out = {}
    for s in ("01-intake", "02-context", "03-scope", "04-functional", "05-nfr", "06-acceptance"):
        obj = load_stage(r, s)
        out[s] = obj if (obj and not is_skipped(obj)) else None
    return out


def _clean_title(idea_restatement: str, slug: str) -> str:
    first = re.split(r"(?<=[.!?])\s+", (idea_restatement or "").strip(), maxsplit=1)[0].strip().rstrip(".")
    if first and len(first) <= 80:
        return first
    pretty = (slug or "Project").replace("-", " ").replace("_", " ").strip()
    return pretty.title() if pretty else "Project"


def _scrub(text):
    """Remove internal stage ids an author may have leaked into reader-facing prose (stage filenames /
    OQ-RQ-GAP ids / 'decisions[]' / 'actors'), so out/ stays standalone-readable (CONTRACT §18). Uses literal
    stage-name alternation (not 0\\d-\\w+) to avoid false positives like '03-second'."""
    s = str(text if text is not None else "")
    if not s:
        return s
    stage = r"(?:01-intake|02-context|02b-evidence|03-scope|03b-scope-debate|04-functional|05-nfr|06-acceptance)"
    s = re.sub(r"(?:见|参见|详见)\s*" + stage + r"[^，。；）)]*", "见 QUESTIONS.md", s)
    s = re.sub(r"see\s+" + stage + r"[^,.;)]*", "see QUESTIONS.md", s, flags=re.IGNORECASE)
    s = re.sub(r"[，,]?\s*" + stage + r"(?:\s*(?:decisions\[\]|actors|success_metrics|jobs_to_be_done))?(?:\s*(?:OQ|RQ|GAP)-\d+)?", "", s)
    s = re.sub(r"[（(]\s*(?:OQ|RQ|GAP)-\d+\s*[）)]", "", s)
    s = re.sub(r"\b(?:OQ|RQ|GAP)-\d+\b", "", s)
    for a, b in (("（）", ""), ("()", ""), ("，）", "）"), ("（，", "（"), ("  ", " ")):
        s = s.replace(a, b)
    return s.strip()


def build_model(r: Path, readiness: str = "PENDING") -> dict:
    st = load_all_stages(r)
    state = read_state(r)
    lang = state.get("lang", "en")
    intake = st["01-intake"] or {}
    ctx = st["02-context"] or {}
    scope = st["03-scope"] or {}
    funcs = (st["04-functional"] or {}).get("requirements", [])
    nfrs = (st["05-nfr"] or {}).get("nfrs", [])
    acc = (st["06-acceptance"] or {}).get("scenarios", [])
    metrics = ctx.get("success_metrics", [])
    goals = [{"goal": m["metric"], "target": m.get("target", "—"),
              "source": m.get("source_ref", "raw/idea.md"),
              "confidence": "high" if m.get("source_ref") else "medium"} for m in metrics]
    if not goals:
        goals = [{"goal": (intake.get("idea_restatement", "") or "")[:120],
                  "target": "—", "source": "raw/idea.md", "confidence": "medium"}]
    assumptions = [{"text": a.get("text", ""), "confidence": a.get("evidence", "—"),
                    "risk_if_wrong": a.get("risk", "—"), "category": a.get("category", "—"),
                    "importance": a.get("importance", "—")} for a in intake.get("assumed", [])]
    # each locked decision: deterministically attach the FR/NFR ids that cite the same source anchor

    def _affected(dref):
        if not dref:
            return []
        ids = [f.get("id") for f in funcs if f.get("source_ref") == dref]
        ids += [n.get("id") for n in nfrs if n.get("source_ref") == dref]
        return sorted({i for i in ids if i})
    decisions = [{**d, "affected": _affected(d.get("source_ref"))} for d in intake.get("decisions", [])]
    return {
        "lang": lang, "run_id": state.get("run_id", r.name), "readiness": readiness,
        "generated_at": iso_now(),
        "name": _clean_title(intake.get("idea_restatement", ""), state.get("slug", "")),
        "idea_restatement": intake.get("idea_restatement", ""),
        "goals": goals, "actors": ctx.get("actors", []), "jobs": ctx.get("jobs_to_be_done", []),
        "glossary": ctx.get("glossary", []), "constraints_ctx": ctx.get("constraints", []),
        "in_scope": scope.get("in_scope", []), "out_of_scope": scope.get("out_of_scope", []),
        "deferred": scope.get("deferred", []), "functional": funcs, "nfrs": nfrs, "acceptance": acc,
        "decisions": decisions, "assumptions": assumptions,
        "open_questions": intake.get("open_questions", []),
    }


def write_latest(run_dir: Path, slug: str, run_id: str, readiness: str, lang: str) -> None:
    dump_json(I2R_HOME / "latest.json", {
        "slug": slug, "run_id": run_id, "path": str(run_dir), "readiness": readiness,
        "lang": lang, "updated_at": iso_now(),
    })


# ============================== YAML emitter ==============================
def _yscalar(v) -> str:
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
    return ('"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"') if needs else s


def to_yaml(obj, indent=0) -> str:
    pad, out = "  " * indent, []
    for k, v in obj.items():
        if isinstance(v, list):
            if not v:
                out.append(f"{pad}{k}: []")
            else:
                out.append(f"{pad}{k}:")
                for item in v:
                    if isinstance(item, dict):
                        out.append(f"{pad}  -")
                        out.append(to_yaml(item, indent + 2))
                    else:
                        out.append(f"{pad}  - {_yscalar(item)}")
        elif isinstance(v, dict):
            out.append(f"{pad}{k}:")
            out.append(to_yaml(v, indent + 1))
        else:
            out.append(f"{pad}{k}: {_yscalar(v)}")
    return "\n".join(out)
