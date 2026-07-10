#!/usr/bin/env python3
"""
i2r.py - CLI for idea-to-requirements-orchestrator (I2R), v2 Markdown-first ($0, no-LLM).

The thin command layer. Claude writes the stage artifacts (internal/stages/*.json); this CLI scaffolds
the .i2r/ run, detects state, validates schemas, gates modes/evidence, ASSEMBLEs the Markdown reading
package (out/*.md) + internal machine artifacts, runs the deterministic gate (audit/ + READINESS.md),
archives/exports, installs the toolchain, and runs the eval harness.

Engine: i2r_core.py · Markdown rendering: i2r_render.py · schema validation: i2r_validate.py.
Single source of truth for shapes/paths/enums: docs/CONTRACT.md. Stdlib only.
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import i2r_render as R                       # noqa: E402
from i2r_validate import validate_instance   # noqa: E402
from i2r_core import (                        # noqa: E402
    ROOT, SCHEMAS_DIR, I2R_HOME, RUNS_DIR, ARTIFACT_VERSION,
    STAGE_SCHEMA, STAGE_OWNER, STAGE_BY_NUM, CONDITIONAL_STAGES,
    ALLOWED_REVIEWERS, AUTHOR_AGENTS, MAX_REPAIR_ITERS,
    iso_now, ts_dir, slugify, load_json, dump_json, sha256_bytes, die, load_config, to_yaml,
    raw_dir, out_dir, internal_dir, stages_dir, audit_dir, ops_dir, stage_path, state_path,
    is_run_dir, find_run_dir, read_state, write_state, append_log, run_lang,
    load_stage, is_skipped, validate_stage, routing, required_stages, reviews, detect_state,
    placeholder_scan, minimalism_scan, prd_grade, reader_test_verdict, orphan_acceptance, downstream_risk,
    out_structural_checks, load_all_stages, build_model, write_latest, _scrub,
)


# ============================== commands: scaffold / inspect ==============================
def cmd_init(args) -> int:
    src = Path(args.idea)
    if not src.exists():
        die(f"idea path not found: {src}")
    lang = args.lang or load_config()["primary"]
    if lang not in ("en", "zh"):
        die("lang must be 'en' or 'zh'")
    slug = slugify(args.slug or src.stem)
    run_dir = RUNS_DIR / slug / ts_dir()
    for d in (raw_dir(run_dir), out_dir(run_dir), stages_dir(run_dir), audit_dir(run_dir), ops_dir(run_dir)):
        d.mkdir(parents=True, exist_ok=True)
    manifest = {}
    if src.is_dir():
        for f in sorted(src.rglob("*")):
            if f.is_file():
                rel = f.relative_to(src)
                dest = raw_dir(run_dir) / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                data = f.read_bytes()
                dest.write_bytes(data)
                manifest[str(rel).replace("\\", "/")] = sha256_bytes(data)
    else:
        data = src.read_bytes()
        (raw_dir(run_dir) / "idea.md").write_bytes(data)
        manifest["idea.md"] = sha256_bytes(data)
    run_id = f"i2r-{slug}-{run_dir.name}"
    dump_json(ops_dir(run_dir) / "MANIFEST.json", {"run_id": run_id, "slug": slug, "created_at": iso_now(), "raw": manifest})
    write_state(run_dir, {"run_id": run_id, "slug": slug, "lang": lang, "created_at": iso_now(), "stale": []})
    (ops_dir(run_dir) / "run-log.md").write_text(f"# I2R run log - {run_id}\n", encoding="utf-8")
    append_log(run_dir, f"init: lang={lang}, mirrored {len(manifest)} raw file(s) from {src}")
    write_latest(run_dir, slug, run_id, "PENDING", lang)
    print(f"run_id: {run_id}")
    print(f"run_dir: {run_dir}")
    print(f"lang: {lang}")
    print("next: PHASE 0.5 dispatch i2r-orchestrator -> internal/stages/00-mode-routing.json")
    return 0


def cmd_status(args) -> int:
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    st = detect_state(run_dir)
    state = read_state(run_dir)
    print(f"run: {run_dir}")
    print(f"lang: {state.get('lang', 'en')}")
    if state.get("stale"):
        print(f"STALE: {', '.join(state['stale'])}")
    print(f"state: {st['state']}")
    if st["gate"]:
        print(f"gate:  {st['gate']}")
    print(f"next:  {st['next']}")
    return 0


def cmd_route(args) -> int:
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    if not stage_path(run_dir, "00-mode-routing").exists():
        print("no 00-mode-routing.json yet; orchestrator must author it first")
        return 2
    errs = validate_stage(run_dir, "00-mode-routing")
    if errs:
        print("INVALID routing:\n  " + "\n  ".join(errs))
        return 2
    print("routing OK. required stage artifacts for this run:")
    for s in required_stages(run_dir):
        mark = "ok" if stage_path(run_dir, s).exists() else "--"
        print(f"  [{mark}] internal/stages/{s}.json")
    return 0


def cmd_validate(args) -> int:
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    if args.stage == "all":
        stages = [s for s in STAGE_SCHEMA if stage_path(run_dir, s).exists()]
    else:
        stages = [STAGE_BY_NUM.get(args.stage, args.stage)]
    all_errs = []
    for s in stages:
        errs = validate_stage(run_dir, s)
        fpath = stage_path(run_dir, s)
        if fpath.exists() and s in STAGE_OWNER:
            obj = load_json(fpath)
            if not is_skipped(obj):
                got = (obj.get("_meta") or {}).get("generated_by_agent")
                if got and got != STAGE_OWNER[s]:
                    errs.append(f"{s}.json _meta.generated_by_agent '{got}' != owner '{STAGE_OWNER[s]}'")
        if errs:
            all_errs.extend(errs)
            print(f"FAIL {s}:\n  " + "\n  ".join(errs))
        else:
            print(f"PASS {s}")
    codex = stages_dir(run_dir) / "07-review.codex.json"
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
    rt = routing(run_dir)
    if not rt:
        print("no routing file; nothing to gate")
        return 0
    missing = []
    if (rt.get("requires_local_search") or rt.get("requires_external_search")) and not stage_path(run_dir, "02b-evidence").exists():
        missing.append("02b-evidence.json (routing requires search)")
    if rt.get("requires_scope_debate") and not stage_path(run_dir, "03b-scope-debate").exists():
        missing.append("03b-scope-debate.json (routing requires scope debate)")
    if rt.get("requires_discussion") == "blocking" and not list(raw_dir(run_dir).glob("clarifications-*.md")):
        missing.append("raw/clarifications-*.md (routing requires blocking discussion)")
    if rt.get("requires_codex_review") and not (stages_dir(run_dir) / "07-review.codex.json").exists() and stage_path(run_dir, "06-acceptance").exists():
        missing.append("07-review.codex.json (routing requires codex/adversarial review)")
    if missing:
        print("MODE-GATE blocked; missing:\n  " + "\n  ".join(missing))
        return 2
    print("MODE-GATE ok: all routing-required artifacts present")
    return 0


def cmd_evidence_validate(args) -> int:
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    ev_obj = load_stage(run_dir, "02b-evidence")
    if not ev_obj or is_skipped(ev_obj):
        print("no evidence file (search mode not used)")
        return 0
    errs = validate_stage(run_dir, "02b-evidence")
    for e in ev_obj.get("evidence", []):
        if not e.get("source_ref"):
            errs.append(f"evidence {e.get('id')}: missing source_ref")
    blocking_gaps = [g for g in ev_obj.get("gaps", []) if g.get("impact") == "blocking"]
    if errs:
        print("FAIL evidence:\n  " + "\n  ".join(errs))
        return 2
    print(f"PASS evidence ({len(ev_obj.get('evidence', []))} cards, {len(blocking_gaps)} blocking gap(s))")
    return 1 if blocking_gaps else 0


def cmd_discuss_record(args) -> int:
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    src = Path(args.file)
    if not src.exists():
        die(f"clarification file not found: {src}")
    n = len(list(raw_dir(run_dir).glob("clarifications-*.md"))) + 1
    dest = raw_dir(run_dir) / f"clarifications-{n:03d}.md"
    data = src.read_bytes()
    dest.write_bytes(data)
    mf = ops_dir(run_dir) / "MANIFEST.json"          # refresh manifest with the new raw file
    if mf.exists():
        m = load_json(mf)
        m.setdefault("raw", {})[dest.name] = sha256_bytes(data)
        dump_json(mf, m)
    state = read_state(run_dir)
    for s in ("01-intake", "02-context", "03-scope", "04-functional", "05-nfr", "06-acceptance"):
        if s not in state.setdefault("stale", []):
            state["stale"].append(s)
    write_state(run_dir, state)
    append_log(run_dir, f"discuss.record: added {dest.name}; refreshed MANIFEST; marked downstream stale")
    print(f"recorded {dest.name}; re-run intake (downstream marked STALE)")
    return 0


def cmd_mark_stale(args) -> int:
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    state = read_state(run_dir)
    targets = [args.file] if args.file else ["01-intake", "02-context", "03-scope", "04-functional", "05-nfr", "06-acceptance"]
    for tg in targets:
        if tg not in state.setdefault("stale", []):
            state["stale"].append(tg)
    write_state(run_dir, state)
    append_log(run_dir, f"mark-stale: {', '.join(targets)} ({args.reason})")
    print(f"marked STALE: {', '.join(targets)}")
    return 0


def cmd_unstale(args) -> int:
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
    prev = sorted(stages_dir(run_dir).glob("08-repair-notes*.json"))
    iteration = len([p for p in prev if not is_skipped(load_json(p))]) + 1
    if iteration > MAX_REPAIR_ITERS:
        die(f"repair loop exhausted (>{MAX_REPAIR_ITERS}); surface to human", 2)
    findings, stages = [], set()
    for v in fails:
        findings.extend(v.get("findings", []))
        if v.get("failed_stage"):
            stages.add(v["failed_stage"])
    failed_stage = sorted(stages)[0] if stages else "04-functional"
    notes = {
        "_meta": {"artifact_version": ARTIFACT_VERSION, "stage": "08-repair-notes",
                  "run_id": read_state(run_dir).get("run_id", ""), "generated_by_agent": "i2r-orchestrator",
                  "created_at": iso_now(), "lang": run_lang(run_dir)},
        "iteration": iteration, "failed_stage": failed_stage, "findings": findings,
        "repair_prompt": f"Only rewrite artifacts for {failed_stage}. Do NOT modify accepted scope or unrelated NFRs. Address each finding by id.",
        "new_attempt_required": True,
    }
    dump_json(stage_path(run_dir, "08-repair-notes"), notes)
    state = read_state(run_dir)
    if failed_stage not in state.setdefault("stale", []):
        state["stale"].append(failed_stage)
    write_state(run_dir, state)
    append_log(run_dir, f"repair.plan: iter {iteration}, failed_stage {failed_stage}, {len(findings)} finding(s)")
    print(f"repair plan iter {iteration}: rerun {failed_stage} ({len(findings)} findings) then re-review")
    return 0


# ============================== commands: assemble / gate ==============================
def _write_skipped_stubs(run_dir: Path) -> None:
    req = set(required_stages(run_dir))
    for s in CONDITIONAL_STAGES:
        if s not in req and not stage_path(run_dir, s).exists():
            dump_json(stage_path(run_dir, s), {
                "_meta": {"artifact_version": ARTIFACT_VERSION, "stage": s,
                          "run_id": read_state(run_dir).get("run_id", ""),
                          "generated_by_agent": "i2r.py-assemble", "created_at": iso_now(),
                          "lang": run_lang(run_dir)},
                "status": "SKIPPED"})


def cmd_assemble(args) -> int:
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    for s in ("01-intake", "02-context", "03-scope", "04-functional", "05-nfr", "06-acceptance"):
        if not stage_path(run_dir, s).exists():
            die(f"cannot assemble: missing internal/stages/{s}.json", 2)
    _write_skipped_stubs(run_dir)

    # backfill FR.acceptance_ids from the AC side (contract: assemble links FR<->AC)
    func_doc = load_stage(run_dir, "04-functional")
    acc = (load_stage(run_dir, "06-acceptance") or {}).get("scenarios", [])
    ac_by_fr = {}
    for s in acc:
        ac_by_fr.setdefault(s.get("requirement_id"), []).append(s.get("id"))
    for f in func_doc.get("requirements", []):
        f["acceptance_ids"] = ac_by_fr.get(f.get("id"), [])
    dump_json(stage_path(run_dir, "04-functional"), func_doc)

    model = build_model(run_dir, readiness="PENDING")
    lang = model["lang"]

    # ---- out/ Markdown package (Markdown ONLY) ----
    od = out_dir(run_dir)
    for rel, content in R.render_package(model).items():
        dest = od / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(_scrub(content), encoding="utf-8")  # final pass: no internal stage ids in out/

    # ---- internal/ machine artifacts ----
    nfrs = model["nfrs"]
    bundle = {
        "_meta": {"artifact_version": ARTIFACT_VERSION, "stage": "requirements-handoff", "run_id": model["run_id"],
                  "generated_by_agent": "i2r.py-assemble", "created_at": iso_now(), "lang": lang},
        "project": {"name": model["name"], "slug": read_state(run_dir).get("slug", ""), "run_id": model["run_id"]},
        "artifacts": {s: f"internal/stages/{s}.json" for s in
                      ("01-intake", "02-context", "03-scope", "04-functional", "05-nfr", "06-acceptance")},
        "requirements_summary": {"fr_count": len(model["functional"]), "nfr_count": len(nfrs), "ac_count": len(acc)},
        "traceability": [{"story": f.get("capability", ""), "fr_id": f.get("id"),
                          "ac_ids": ac_by_fr.get(f.get("id"), [])} for f in model["functional"]],
        "constraints": [n.get("id") for n in nfrs if n.get("coverage_status") == "required"],
        "locked_decisions": [d.get("text") for d in model["decisions"]],
        "handoff_status": "PENDING_GATE",
    }
    dump_json(internal_dir(run_dir) / "requirements.json", bundle)
    dump_json(internal_dir(run_dir) / "traceability-matrix.json", {
        "_meta": {"run_id": model["run_id"], "created_at": iso_now()},
        "source_to_requirement": [{"source_ref": f.get("source_ref"), "fr_id": f.get("id"),
                                   "ac_ids": f.get("acceptance_ids", [])} for f in model["functional"]],
        "decision_impact": [{"id": f"ADR-{i:04d}", "decision": d.get("text")} for i, d in enumerate(model["decisions"], 1)],
    })
    dump_json(internal_dir(run_dir) / "claim-ledger.json", {
        "_meta": {"run_id": model["run_id"], "created_at": iso_now()},
        "claims": ([{"id": f"STATED-{i:03d}", "kind": "STATED", "text": s.get("text"), "source_ref": s.get("source_ref"), "confidence": "high"}
                    for i, s in enumerate((load_stage(run_dir, "01-intake") or {}).get("stated", []), 1)]
                   + [{"id": f"ASSUMED-{i:03d}", "kind": "ASSUMED", "text": a["text"], "confidence": a.get("confidence", "medium")}
                      for i, a in enumerate(model["assumptions"], 1)]
                   + [{"id": f"DECISION-{i:03d}", "kind": "DECISION", "text": d.get("text"), "source_ref": d.get("source_ref")}
                      for i, d in enumerate(model["decisions"], 1)]),
    })

    # ---- audit/ human documents ----
    (audit_dir(run_dir) / "run-summary.md").write_text(R.render_run_summary(model), encoding="utf-8")
    rev = list(reviews(run_dir).values())
    (audit_dir(run_dir) / "review-summary.md").write_text(R.render_review_summary(model, rev), encoding="utf-8")
    ev_obj = load_stage(run_dir, "02b-evidence")
    (audit_dir(run_dir) / "evidence-log.md").write_text(
        R.render_evidence_log(model, (ev_obj or {}).get("evidence", []) if ev_obj and not is_skipped(ev_obj) else []), encoding="utf-8")
    (audit_dir(run_dir) / "repair-notes.md").write_text(
        R.render_repair_notes(model, load_stage(run_dir, "08-repair-notes")), encoding="utf-8")

    append_log(run_dir, f"assemble: out/ package ({len(model['functional'])} FR / {len(nfrs)} NFR / {len(acc)} AC) + {len(model['decisions'])} ADR + internal/audit artifacts")
    print(f"assembled: out/ Markdown package ({len(model['functional'])} FR / {len(nfrs)} NFR / {len(acc)} AC, {len(model['decisions'])} ADR)")
    print("next: i2r.py gate.check")
    return 0


def cmd_gate_check(args) -> int:
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    lang = run_lang(run_dir)
    reasons, missing, checks = [], [], []

    for s in required_stages(run_dir):
        errs = validate_stage(run_dir, s)
        if errs:
            missing.append(s)
            reasons.append(f"{s}: {errs[0]}")
    checks.append({"name": "required_stages_valid", "result": "FAIL" if missing else "PASS",
                   "note": ", ".join(missing)})

    rev = reviews(run_dir)
    rev_objs = list(rev.values())
    review_schema = load_json(SCHEMAS_DIR / STAGE_SCHEMA["07-review"])
    for rname, robj in rev.items():
        rerrs = validate_instance(robj, review_schema)
        if rerrs:
            missing.append(rname)
            reasons.append(f"{rname}: {rerrs[0]}")
    reviewers = [v.get("reviewer") for v in rev_objs]
    both_pass = len(rev) >= 2 and all(v.get("verdict") == "PASS" for v in rev_objs)
    independent = (len(rev) >= 2 and len({r for r in reviewers if r}) >= 2
                   and all(r in ALLOWED_REVIEWERS for r in reviewers)
                   and all((v.get("_meta") or {}).get("generated_by_agent") not in AUTHOR_AGENTS for v in rev_objs))
    if len(rev) < 2:
        reasons.append(f"only {len(rev)}/2 reviews present")
    else:
        if not both_pass:
            reasons.append("not both reviews PASS")
        if not independent:
            reasons.append("reviews not independent (need two distinct reviewers in {claude,codex,fallback-critic}, neither an author)")
    checks.append({"name": "dual_independent_review_pass", "result": "PASS" if (both_pass and independent) else "FAIL", "note": ""})

    findings = [f for v in rev_objs for f in v.get("findings", [])]
    blockers = [f for f in findings if f.get("severity") == "BLOCKER"]
    majors = [f for f in findings if f.get("severity") == "MAJOR"]
    ph = placeholder_scan(run_dir)
    ph_block = [f for f in ph if f.get("severity") == "BLOCKER"]
    ms = minimalism_scan(run_dir)
    ms_major = [f for f in ms if f.get("severity") == "MAJOR"]
    grade = prd_grade(run_dir)
    reader = reader_test_verdict(run_dir)
    stale = read_state(run_dir).get("stale", [])
    orphans = orphan_acceptance(run_dir)
    dstream = downstream_risk(run_dir)
    struct_checks, struct_block, struct_major = out_structural_checks(run_dir, lang)
    checks.extend(struct_checks)
    checks.append({"name": "no_open_blockers", "result": "PASS" if not (blockers or ph_block) else "FAIL", "note": ""})
    checks.append({"name": "placeholder_scan_clean", "result": "PASS" if not ph_block else "FAIL", "note": ""})
    checks.append({"name": "minimalism_scan_clean", "result": "PASS" if not ms_major else "FAIL",
                   "note": ", ".join(f"{f['id']}.{f['where']}" for f in ms_major[:5])})
    checks.append({"name": "reader_test", "result": reader, "note": ""})
    checks.append({"name": "prd_ambiguity_within_target",
                   "result": "PASS" if (grade["present"] and grade["pass"]) else "FAIL",
                   "note": str(grade["score"]) if grade["present"] else "missing"})

    if not grade["present"]:
        reasons.append("gsd_ambiguity_precheck missing")
    elif not grade["pass"]:
        reasons.append(f"prd ambiguity {grade['score']} > target {load_config()['max_ambiguity_score']}")
    if reader == "FAIL":
        reasons.append("reader-test FAILED (out/ package not standalone-readable)")
    elif reader == "MISSING":
        reasons.append("reader-test missing (required precondition)")
    if blockers:
        reasons.append(f"{len(blockers)} open BLOCKER finding(s)")
    if ph_block:
        reasons.append("placeholder/NFR blocker(s): " + ", ".join(f"{f['id']}.{f['where']}='{f['term']}'" for f in ph_block[:5]))
    reasons.extend(struct_block)
    if majors:
        reasons.append(f"{len(majors)} open MAJOR finding(s)")
    reasons.extend(struct_major)
    if ms_major:
        reasons.append("RML minimalism (advisory): " + ", ".join(f"{f['id']}.{f['where']}({f['class']})" for f in ms_major[:5]))
    if stale:
        reasons.append("STALE artifacts pending re-run: " + ", ".join(stale))
    if orphans:
        reasons.append("orphan acceptance (no matching FR): " + ", ".join(orphans[:5]))
    if dstream:
        reasons.append("downstream_ai_ambiguity_risk flagged by a reviewer")

    blocked = (bool(missing) or bool(blockers) or bool(ph_block) or reader in ("FAIL", "MISSING")
               or not both_pass or not independent or bool(stale) or bool(struct_block))
    if blocked:
        verdict, code = "BLOCKED", 2
    elif majors or struct_major or ms_major or (grade["present"] and not grade["pass"]) or not grade["present"] or orphans or dstream:
        verdict, code = "NEEDS_REVIEW", 1
    else:
        verdict, code = "READY", 0

    result = {
        "verdict": verdict, "generated_at": iso_now(), "run_id": read_state(run_dir).get("run_id", ""),
        "lang": lang, "both_reviews_pass": both_pass, "open_blockers": len(blockers) + len(ph_block) + len(struct_block),
        "open_majors": len(majors) + len(struct_major) + len(ms_major), "placeholder_hits": len(ph),
        "minimalism_findings": len(ms),
        "reader_test": reader, "prd_ambiguity_score": grade["score"],
        "missing_or_invalid_stages": missing, "reasons": reasons or ["all gate checks passed"],
    }
    dump_json(internal_dir(run_dir) / "quality-report.json", {**result, "checks": checks})
    (audit_dir(run_dir) / "gate-result.yaml").write_text(to_yaml(result) + "\n", encoding="utf-8")

    model = build_model(run_dir, readiness=verdict)
    gate_for_render = {"verdict": verdict, "reasons": result["reasons"], "checks": checks}
    (audit_dir(run_dir) / "gate-result.md").write_text(R.render_gate_md(model, gate_for_render), encoding="utf-8")
    (out_dir(run_dir) / "READINESS.md").write_text(_scrub(R.render_readiness(model, gate_for_render)), encoding="utf-8")

    # finalize verdict-dependent docs by re-rendering with the final readiness (no fragile patching)
    (out_dir(run_dir) / "PRD.md").write_text(_scrub(R.render_prd(model)), encoding="utf-8")
    (out_dir(run_dir) / "README.md").write_text(_scrub(R.render_readme(model)), encoding="utf-8")
    reqf = internal_dir(run_dir) / "requirements.json"
    if reqf.exists():
        rj = load_json(reqf)
        rj["handoff_status"] = verdict
        dump_json(reqf, rj)
    write_latest(run_dir, read_state(run_dir).get("slug", ""), result["run_id"], verdict, lang)

    append_log(run_dir, f"gate.check: {verdict} (blockers={result['open_blockers']} majors={result['open_majors']} reader={reader})")
    print(f"GATE: {verdict}")
    for rs in result["reasons"]:
        print(f"  - {rs}")
    return code


# ============================== commands: diff / explain / archive / export ==============================
def cmd_diff(args) -> int:
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    state = read_state(run_dir)
    print(f"run: {run_dir}")
    print(f"stale/needs-rerun: {', '.join(state.get('stale', [])) or '(none)'}")
    present = [s for s in STAGE_SCHEMA if stage_path(run_dir, s).exists()]
    print(f"present stages: {', '.join(present) or '(none)'}")
    return 0


def cmd_explain_fail(args) -> int:
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    gr = audit_dir(run_dir) / "gate-result.yaml"
    if not gr.exists():
        print("no audit/gate-result.yaml; run gate.check first")
        return 2
    print(gr.read_text(encoding="utf-8"))
    ph = placeholder_scan(run_dir)
    if ph:
        print("placeholder/NFR findings (root cause first):")
        for f in ph:
            print(f"  - {f['severity']} {f['class']} {f['id']}.{f['where']}: '{f['term']}'")
    return 0


def cmd_archive(args) -> int:
    """Move older runs to .i2r/archive/<slug>/, keeping the newest --keep per slug."""
    keep = max(1, args.keep)
    archive = I2R_HOME / "archive"
    moved = 0
    slugs = [Path(args.slug)] if args.slug else ([d for d in RUNS_DIR.iterdir() if d.is_dir()] if RUNS_DIR.exists() else [])
    for slug_dir in slugs:
        sd = slug_dir if slug_dir.is_absolute() else (RUNS_DIR / slug_dir)
        if not sd.exists():
            continue
        runs = sorted([r for r in sd.iterdir() if is_run_dir(r)])
        for r in runs[:-keep]:
            dest = archive / sd.name / r.name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(r), str(dest))
            moved += 1
    print(f"archived {moved} run(s) to {archive} (kept newest {keep} per slug)")
    return 0


def cmd_export(args) -> int:
    """Emit a sanitized share package (out/ only, no raw/internal/ops) to .i2r/exports/<run-id>/."""
    run_dir = find_run_dir(args.run) or die(f"no run found for '{args.run}'")
    run_id = read_state(run_dir).get("run_id", run_dir.name)
    dest = I2R_HOME / "exports" / run_id
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(out_dir(run_dir), dest / "out")
    print(f"exported sanitized package (out/ only) to {dest}")
    return 0


# ============================== commands: install / evals ==============================
def _git_exclude(proj: Path) -> None:
    """Keep .i2r/ out of commits: append to .git/info/exclude and .gitignore (idempotent)."""
    line = ".i2r/"
    gi = proj / ".gitignore"
    if not gi.exists() or line not in gi.read_text(encoding="utf-8"):
        with gi.open("a", encoding="utf-8") as fh:
            fh.write(("\n" if gi.exists() else "") + "# I2R local developer workspace\n.i2r/\n")
    gitdir = proj / ".git"
    if gitdir.is_dir():
        ex = gitdir / "info" / "exclude"
        ex.parent.mkdir(parents=True, exist_ok=True)
        if not ex.exists() or line not in ex.read_text(encoding="utf-8"):
            with ex.open("a", encoding="utf-8") as fh:
                fh.write(("\n" if ex.exists() else "") + ".i2r/\n")


def cmd_install(args) -> int:
    proj = Path(args.project).resolve() if args.project else ROOT
    hook_src = (ROOT / "hooks") if (ROOT / "hooks").exists() else (ROOT / ".claude" / "hooks")
    if proj != ROOT.resolve():
        (proj / "scripts").mkdir(parents=True, exist_ok=True)
        for mod in ("i2r.py", "i2r_core.py", "i2r_render.py", "i2r_validate.py"):
            if (ROOT / "scripts" / mod).exists():
                shutil.copy(ROOT / "scripts" / mod, proj / "scripts" / mod)
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
        "Stop": [("i2r-mode-gate", None), ("i2r-readiness-gate", None), ("i2r-citation-gate", None)],
        "SubagentStop": [("i2r-subagent-output-gate", None), ("i2r-citation-gate", None)],
    }
    sp = proj / ".claude" / "settings.json"
    sp.parent.mkdir(parents=True, exist_ok=True)
    settings = load_json(sp) if sp.exists() else {}
    hooks = settings.setdefault("hooks", {})
    # prune stale i2r hook registrations from a prior install (renamed-away files, e.g. i2r-handoff-gate.js)
    stale = ["i2r-handoff-gate.js"]
    for ev_name, blocks in list(hooks.items()):
        hooks[ev_name] = [b for b in blocks if not (isinstance(b, dict)
                          and any(any(s in h.get("command", "") for s in stale) for h in b.get("hooks", [])))]
    added = 0
    for event, entries in events.items():
        ev = hooks.setdefault(event, [])
        for name, matcher in entries:
            cmd = f'node "${{CLAUDE_PROJECT_DIR}}/.claude/hooks/{name}.js"'
            if any(isinstance(blk, dict) and any(h.get("command") == cmd for h in blk.get("hooks", [])) for blk in ev):
                continue
            block = {"hooks": [{"type": "command", "command": cmd}]}
            if matcher:
                block["matcher"] = matcher
            ev.append(block)
            added += 1
    dump_json(sp, settings)
    _git_exclude(proj)
    print(f"installed I2R toolchain + {added} hook registration(s) into {proj}; .i2r/ git-excluded")
    return 0


def cmd_evals_run(args) -> int:
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


# ============================== CLI ==============================
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="i2r.py", description="I2R deterministic SDK ($0, no-LLM)")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("init"); s.add_argument("idea"); s.add_argument("--slug"); s.add_argument("--lang", choices=["en", "zh"]); s.set_defaults(fn=cmd_init)
    for nm, fn in (("status", cmd_status), ("route", cmd_route), ("mode.check", cmd_mode_check),
                   ("evidence.validate", cmd_evidence_validate), ("repair.plan", cmd_repair_plan),
                   ("assemble", cmd_assemble), ("gate.check", cmd_gate_check), ("diff", cmd_diff),
                   ("explain-fail", cmd_explain_fail), ("export", cmd_export)):
        sp = sub.add_parser(nm); sp.add_argument("run"); sp.set_defaults(fn=fn)
    s = sub.add_parser("validate"); s.add_argument("run"); s.add_argument("--stage", required=True); s.set_defaults(fn=cmd_validate)
    s = sub.add_parser("discuss.record"); s.add_argument("run"); s.add_argument("--file", required=True); s.set_defaults(fn=cmd_discuss_record)
    s = sub.add_parser("mark-stale"); s.add_argument("run"); s.add_argument("--reason", required=True); s.add_argument("--file"); s.set_defaults(fn=cmd_mark_stale)
    s = sub.add_parser("unstale"); s.add_argument("run"); s.add_argument("--stage"); s.add_argument("--all", action="store_true"); s.set_defaults(fn=cmd_unstale)
    s = sub.add_parser("archive"); s.add_argument("--slug"); s.add_argument("--keep", type=int, default=3); s.set_defaults(fn=cmd_archive)
    s = sub.add_parser("install"); s.add_argument("--project"); s.set_defaults(fn=cmd_install)
    s = sub.add_parser("evals.run"); s.set_defaults(fn=cmd_evals_run)
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
