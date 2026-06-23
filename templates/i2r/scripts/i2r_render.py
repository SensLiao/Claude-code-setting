#!/usr/bin/env python3
"""
i2r_render.py - PURE Markdown rendering for I2R (no file IO, no path logic).

Takes already-loaded stage data + a run language and returns Markdown strings. i2r.py owns all
file IO and path resolution; this module only shapes data into the `out/` reading package, the
human-readable `audit/` documents, and READINESS / gate explanations. Keeping it pure makes the
rendering independently testable and keeps both files < 800 lines.

Single source of truth for shapes/paths/enums: docs/CONTRACT.md (§18 output package, §20 language).
Stdlib only.
"""
from __future__ import annotations

# ============================== i18n ==============================
# Two languages only (CONTRACT §20). One language per run; never simultaneous bilingual output.
L = {
    "en": {
        "lang_name": "English",
        # generic
        "status": "Status", "readiness": "Readiness", "source_idea": "Source idea",
        "generated_at": "Generated at", "run_id": "Run", "primary_doc": "Primary document",
        "source": "Source", "confidence": "Confidence", "priority": "Priority", "notes": "Notes",
        "none": "(none)", "na": "—",
        "derived_note": "(derived — not a direct quote; see QUESTIONS.md)", "assumed_default": "assumed default — pending confirmation",
        # README
        "pkg_title": "I2R Output Package",
        "pkg_what": "What This Package Contains",
        "pkg_order": "Recommended Reading Order",
        "pkg_notdo": "What This Package Does Not Do",
        "pkg_notdo_body": "This package does not define implementation architecture, task sequencing, "
                          "staffing, sprint planning, delivery mechanics, or ownership assignment. It describes "
                          "what should be true and why it matters; how to build it is derived downstream.",
        "pkg_reader": "Reader Model",
        "pkg_reader_body": "These Markdown documents are written for human readers, product teams, engineering "
                           "teams, and downstream AI orchestration alike. There is no separate downstream-specific "
                           "instruction file — downstream systems read the same documents and apply their own "
                           "routing and planning logic.",
        "pkg_quality": "Quality Basis",
        "pkg_quality_body": "This package uses lightweight requirement-writing and acceptance patterns: structured "
                            "requirement sentences, measurable quality criteria, acceptance scenarios, source "
                            "traceability, independent review, and deterministic readiness checks.",
        "doc_purpose": "Purpose", "doc_audience": "Audience",
        "audience_all": "Product, engineering, downstream orchestration",
        # PRD
        "prd_title": "PRD", "exec_summary": "Executive Summary",
        "problem": "Problem", "desired": "Desired outcome", "primary_users": "Primary users",
        "in_scope": "In scope", "out_scope": "Out of scope", "locked_decisions": "Locked decisions",
        "main_risks": "Main risks", "product_intent": "Product Intent",
        "goals": "Goals", "goal": "Goal", "success_signal": "Success signal", "target": "Target",
        "non_goals": "Non-Goals / Out of Scope", "scope": "Scope", "deferred": "Deferred",
        "users_actors": "Users, Actors, and Jobs", "actors": "Actors", "jtbd": "Jobs To Be Done",
        "req_overview": "Requirements Overview", "fr_summary": "Functional Requirements",
        "qr_summary": "Quality Requirements", "constraints_summary": "Constraints",
        "detailed_req": "Detailed Requirements", "acceptance_overview": "Acceptance Overview",
        "risks_questions": "Risks and Open Questions", "open_questions": "Open Questions",
        "known_risks": "Known Risks", "assumptions_fwd": "Assumptions Carried Forward",
        "see": "See", "purpose_line": "What we are trying to enable",
        # REQUIREMENTS
        "requirements": "Requirements", "reading_notes": "Reading Notes",
        "req_reading_note": "Each requirement describes what must be true and why it matters. It intentionally "
                            "avoids prescribing implementation architecture, storage model, framework, service "
                            "boundary, or UI layout.",
        "capability": "Capability", "requirement": "Requirement", "why_matters": "Why this matters",
        "acc_coverage": "Acceptance coverage", "impl_boundary": "Implementation boundary",
        "impl_boundary_body": "This requirement defines expected product behaviour. It does not prescribe the "
                              "implementation architecture, storage model, framework, service boundary, or UI layout.",
        "quality_attr": "Quality attribute", "fit_criterion": "Fit criterion",
        "measurement_ctx": "Measurement context", "validation_approach": "Validation approach",
        "satisfied_when": "The requirement is satisfied when", "coverage_na": "Not applicable",
        "readiness_pending": "This package has not yet been evaluated by the deterministic gate — run gate.check to populate the verdict, checks, and risks below.",
        # ACCEPTANCE
        "acceptance": "Acceptance Criteria", "acc_philosophy": "Acceptance Philosophy",
        "acc_phil_body": "Acceptance criteria describe observable outcomes. They avoid checking hidden "
                         "implementation details unless the original requirement explicitly demands them.",
        "covers": "Covers", "type": "Type", "plain_lang": "Plain-language explanation",
        "observable": "Observable evidence", "not_covered": "Out of scope for this scenario",
        "happy_path": "Happy path", "negative": "Negative / error path", "edge_case": "Edge case",
        # DECISIONS
        "decisions": "Locked Decisions", "decision_summary": "Decision Summary",
        "decision": "Decision", "why_locked": "Why Locked", "binding_note": "These are binding for this "
                    "requirement package. Downstream work should preserve these decisions unless a new explicit "
                    "decision supersedes them.",
        "preferences": "Preferences", "pref_note": "Desirable but not locked.",
        "assumptions": "Assumptions", "assum_note": "Not decisions; may be revised.",
        "adr_index": "ADR Index", "decision_boundaries": "Decision Boundaries",
        # CONSTRAINTS
        "constraints": "Constraints", "product_constraints": "Product Constraints",
        "quality_constraints": "Quality Constraints", "decision_constraints": "Decision Constraints",
        "not_constraints": "Not Constraints", "not_constraints_body": "These items are not locked by I2R and "
                           "should not be inferred as constraints.",
        "reason": "Reason", "affected_req": "Affected requirements",
        # GLOSSARY
        "glossary": "Glossary", "term": "Term", "meaning": "Meaning",
        "ambiguous_resolved": "Ambiguous Terms Resolved", "not_defined": "Terms Intentionally Not Defined",
        # QUESTIONS
        "questions_title": "Questions and Assumptions", "question": "Question",
        "why_it_matters_q": "Why it matters", "blocking": "Blocking?", "owner": "Owner / Resolver",
        "risk_if_wrong": "Risk if wrong", "assumption": "Assumption", "resolved_q": "Resolved Questions",
        "yes": "Yes", "no": "No",
        # READINESS
        "readiness_title": "Readiness Review", "verdict": "Verdict", "summary": "Summary",
        "why_verdict": "Why This Verdict Was Given", "blocking_issues": "Blocking Issues",
        "major_issues": "Major Issues", "minor_issues": "Minor Issues", "quality_checks": "Quality Checks",
        "check": "Check", "result": "Result", "reviewer_notes": "Reviewer Notes",
        "remaining_risks": "Remaining Non-blocking Risks", "follow_up": "Suggested Follow-up",
        "follow_up_body": "Review the constraints and locked decisions before implementation planning begins "
                          "downstream. No implementation workflow is prescribed by I2R.",
        # TRACEABILITY
        "trace_title": "Traceability", "src_to_req": "Source to Requirement",
        "req_coverage": "Requirement Coverage", "decision_impact": "Decision Impact",
        "source_claim": "Source Claim", "covered": "Covered", "uncovered": "Uncovered",
        # CHANGELOG
        "changelog": "Changelog", "added": "Added", "changed": "Changed", "removed": "Removed",
        "why_changed": "Why It Changed", "affected_docs": "Affected Documents",
        "first_gen": "First generation of this requirements package.",
        # ADR
        "context": "Context", "rationale": "Rationale", "alternatives": "Alternatives Considered",
        "tradeoffs": "Tradeoffs", "consequences": "Consequences", "reversibility": "Reversibility",
        "accepted": "Accepted",
        # audit
        "run_summary": "Run Summary", "review_summary": "Review Summary", "evidence_log": "Evidence Log",
        "repair_notes": "Repair Notes", "reviewer": "Reviewer", "findings": "Findings",
        "no_evidence": "No external evidence review was required for this run.",
        "no_repair": "No repair loop was required for this run.",
        "gate_explanation": "Gate Explanation",
    },
    "zh": {
        "lang_name": "中文",
        "status": "状态", "readiness": "就绪度", "source_idea": "来源想法",
        "generated_at": "生成时间", "run_id": "运行", "primary_doc": "主文档",
        "source": "来源", "confidence": "置信度", "priority": "优先级", "notes": "备注",
        "none": "（无）", "na": "—",
        "derived_note": "（推导得出，非原文直引；见 QUESTIONS.md）", "assumed_default": "工程默认值——待业务确认",
        "pkg_title": "I2R 需求输出包",
        "pkg_what": "本包包含什么",
        "pkg_order": "建议阅读顺序",
        "pkg_notdo": "本包不做什么",
        "pkg_notdo_body": "本包不定义实现架构、任务拆分、人员安排、排期、交付方式或归属。它描述"
                          "“应当成立什么、为什么重要”，至于“怎么做”由下游推导。",
        "pkg_reader": "读者模型",
        "pkg_reader_body": "这些 Markdown 文档同时面向人类读者、产品团队、工程团队与下游 AI 编排。"
                           "不存在单独的下游专用指令文件——下游系统读取与人相同的文档，并应用自己的路由与规划逻辑。",
        "pkg_quality": "质量依据",
        "pkg_quality_body": "本包采用轻量的需求书写与验收范式：结构化的需求句式、可度量的质量准则、"
                            "验收场景、来源可追溯、独立评审，以及确定性的就绪度检查。",
        "doc_purpose": "用途", "doc_audience": "读者",
        "audience_all": "产品、工程、下游编排",
        "prd_title": "PRD（产品需求文档）", "exec_summary": "执行摘要",
        "problem": "问题", "desired": "期望结果", "primary_users": "主要用户",
        "in_scope": "范围内", "out_scope": "范围外", "locked_decisions": "锁定决策",
        "main_risks": "主要风险", "product_intent": "产品意图",
        "goals": "目标", "goal": "目标", "success_signal": "成功信号", "target": "指标",
        "non_goals": "非目标 / 范围外", "scope": "范围", "deferred": "延后",
        "users_actors": "用户、角色与待办任务", "actors": "角色", "jtbd": "待办任务（JTBD）",
        "req_overview": "需求概览", "fr_summary": "功能需求",
        "qr_summary": "质量需求", "constraints_summary": "约束",
        "detailed_req": "详细需求", "acceptance_overview": "验收概览",
        "risks_questions": "风险与开放问题", "open_questions": "开放问题",
        "known_risks": "已知风险", "assumptions_fwd": "延续的假设",
        "see": "见", "purpose_line": "我们想要使能的是什么",
        "requirements": "需求", "reading_notes": "阅读说明",
        "req_reading_note": "每条需求描述“必须成立什么、为什么重要”。它刻意不规定实现架构、存储模型、"
                            "框架、服务边界或 UI 布局。",
        "capability": "能力", "requirement": "需求", "why_matters": "为什么重要",
        "acc_coverage": "验收覆盖", "impl_boundary": "实现边界",
        "impl_boundary_body": "本需求定义期望的产品行为，不规定实现架构、存储模型、框架、服务边界或 UI 布局。",
        "quality_attr": "质量属性", "fit_criterion": "符合准则（fit criterion）",
        "measurement_ctx": "度量语境", "validation_approach": "验证方式",
        "satisfied_when": "当满足以下条件时即视为达成：", "coverage_na": "不适用",
        "readiness_pending": "本包尚未经确定性门禁评估——运行 gate.check 才会填入下方的结论、检查项与风险。",
        "acceptance": "验收标准", "acc_philosophy": "验收原则",
        "acc_phil_body": "验收标准描述可观察的结果。除非原需求明确要求，否则不检查隐藏的实现细节。",
        "covers": "覆盖需求", "type": "类型", "plain_lang": "大白话解释",
        "observable": "可观察证据", "not_covered": "本场景不覆盖",
        "happy_path": "正常路径", "negative": "异常 / 错误路径", "edge_case": "边界情况",
        "decisions": "锁定决策", "decision_summary": "决策总览",
        "decision": "决策", "why_locked": "为何锁定", "binding_note": "以下决策对本需求包具有约束力。"
                    "下游工作应保留这些决策，除非有新的、明确的决策将其取代。",
        "preferences": "偏好", "pref_note": "可取但未锁定。",
        "assumptions": "假设", "assum_note": "不是决策，可被修订。",
        "adr_index": "ADR 索引", "decision_boundaries": "决策边界",
        "constraints": "约束", "product_constraints": "产品约束",
        "quality_constraints": "质量约束", "decision_constraints": "决策导出的约束",
        "not_constraints": "非约束", "not_constraints_body": "以下事项未被 I2R 锁定，不应被推断为约束。",
        "reason": "原因", "affected_req": "影响的需求",
        "glossary": "术语表", "term": "术语", "meaning": "含义",
        "ambiguous_resolved": "已澄清的歧义术语", "not_defined": "刻意未定义的术语",
        "questions_title": "问题与假设", "question": "问题",
        "why_it_matters_q": "为什么重要", "blocking": "是否阻塞", "owner": "负责人 / 解决人",
        "risk_if_wrong": "若判断有误的风险", "assumption": "假设", "resolved_q": "已解决的问题",
        "yes": "是", "no": "否",
        "readiness_title": "就绪度评审", "verdict": "结论", "summary": "概述",
        "why_verdict": "为何得出此结论", "blocking_issues": "阻塞项",
        "major_issues": "重要项", "minor_issues": "次要项", "quality_checks": "质量检查",
        "check": "检查项", "result": "结果", "reviewer_notes": "评审备注",
        "remaining_risks": "剩余的非阻塞风险", "follow_up": "建议的后续",
        "follow_up_body": "在下游开始实现规划之前，先审阅约束与锁定决策。I2R 不规定任何实现流程。",
        "trace_title": "可追溯性", "src_to_req": "来源到需求",
        "req_coverage": "需求覆盖", "decision_impact": "决策影响",
        "source_claim": "来源主张", "covered": "已覆盖", "uncovered": "未覆盖",
        "changelog": "变更记录", "added": "新增", "changed": "变更", "removed": "移除",
        "why_changed": "变更原因", "affected_docs": "影响的文档",
        "first_gen": "本需求包的首次生成。",
        "context": "背景", "rationale": "理由", "alternatives": "考虑过的替代方案",
        "tradeoffs": "取舍", "consequences": "后果", "reversibility": "可逆性",
        "accepted": "已接受",
        "run_summary": "运行摘要", "review_summary": "评审摘要", "evidence_log": "证据日志",
        "repair_notes": "修复记录", "reviewer": "评审官", "findings": "发现项",
        "no_evidence": "本次运行不需要外部证据检索。",
        "no_repair": "本次运行不需要修复循环。",
        "gate_explanation": "门禁说明",
    },
}

# verdict gloss (shown next to the neutral token)
VERDICT_GLOSS = {
    "en": {"READY": "ready", "NEEDS_REVIEW": "needs human review", "BLOCKED": "blocked"},
    "zh": {"READY": "可交付", "NEEDS_REVIEW": "需人工复核", "BLOCKED": "被阻断"},
}


def t(lang: str, key: str) -> str:
    return L.get(lang, L["en"]).get(key, L["en"].get(key, key))


def _verdict(lang: str, v: str) -> str:
    """`**READY** (ready)` — drops the parens when there is no gloss (e.g. PENDING)."""
    gloss = VERDICT_GLOSS.get(lang, {}).get(v, "")
    return f"**{v}** ({gloss})" if gloss else f"**{v}**"


def _clean_source_ref(ref, lang: str) -> str:
    """Keep `raw/...` pointers (and explicit assumption / ADR markers); replace an internal stage id
    (OQ-/RQ-/GAP-/STATED-/ASSUMED-/DECISION- or a stage-file/field reference) that leaked into a
    source_ref with a reader-friendly note, so out/ never shows an unresolvable internal id."""
    r = str(ref if ref is not None else "").strip()
    if not r:
        return t(lang, "na")
    low = r.lower()
    if low.startswith("raw/") or low.startswith("(assumption") or low.startswith("adr-"):
        return r
    internal = ("oq-", "rq-", "gap-", "stated-", "assumed-", "decision-")
    stage = ("01-intake", "02-context", "02b-evidence", "03-scope", "03b-scope", "04-functional",
             "05-nfr", "06-acceptance", "decisions[", "success_metrics", "jobs_to_be_done")
    if low.startswith(internal) or any(s in low for s in stage):
        return t(lang, "derived_note")
    return r


# ============================== small helpers ==============================
def _esc(s) -> str:
    """Escape a value for a Markdown table cell."""
    return str(s if s is not None else "").replace("|", "\\|").replace("\n", " ").strip()


def _bullets(items) -> str:
    items = [str(x).strip() for x in items if str(x).strip()]
    return "\n".join(f"- {x}" for x in items) if items else f"- "


def _bullets_or_none(items, lang) -> str:
    items = [str(x).strip() for x in items if str(x).strip()]
    return "\n".join(f"- {x}" for x in items) if items else f"- {t(lang, 'none')}"


def _table(headers, rows) -> str:
    head = "| " + " | ".join(headers) + " |"
    sep = "| " + " | ".join("---" for _ in headers) + " |"
    body = "\n".join("| " + " | ".join(_esc(c) for c in r) + " |" for r in rows)
    return "\n".join([head, sep, body]) if rows else head + "\n" + sep + "\n| " + " | ".join(
        t("en", "na") for _ in headers) + " |"


def _fm(model: dict, title: str) -> str:
    """Light frontmatter (CONTRACT §18) — no machine-contract fields."""
    return (
        "---\n"
        f"title: \"{title}\"\n"
        "source: i2r\n"
        f"run_id: \"{model.get('run_id','')}\"\n"
        f"readiness: \"{model.get('readiness','PENDING')}\"\n"
        f"lang: \"{model.get('lang','en')}\"\n"
        f"generated_at: \"{model.get('generated_at','')}\"\n"
        "---\n"
    )


# ============================== individual documents ==============================
def render_readme(model: dict) -> str:
    lang = model["lang"]
    rows = [
        ["PRD.md", t(lang, "prd_title"), t(lang, "audience_all")],
        ["REQUIREMENTS.md", t(lang, "requirements"), t(lang, "audience_all")],
        ["ACCEPTANCE.md", t(lang, "acceptance"), t(lang, "audience_all")],
        ["DECISIONS.md", t(lang, "decisions"), t(lang, "audience_all")],
        ["CONSTRAINTS.md", t(lang, "constraints"), t(lang, "audience_all")],
        ["QUESTIONS.md", t(lang, "questions_title"), t(lang, "audience_all")],
        ["GLOSSARY.md", t(lang, "glossary"), t(lang, "audience_all")],
        ["TRACEABILITY.md", t(lang, "trace_title"), t(lang, "audience_all")],
        ["CHANGELOG.md", t(lang, "changelog"), t(lang, "audience_all")],
        ["READINESS.md", t(lang, "readiness_title"), t(lang, "audience_all")],
    ]
    order = [
        "1. `PRD.md`", "2. `REQUIREMENTS.md`", "3. `ACCEPTANCE.md`",
        "4. `DECISIONS.md` + `decisions/ADR-*.md`", "5. `CONSTRAINTS.md`",
        "6. `QUESTIONS.md`", "7. `TRACEABILITY.md`", "8. `READINESS.md`",
    ]
    v = model.get("readiness", "PENDING")
    return f"""{_fm(model, t(lang,'pkg_title'))}# {t(lang,'pkg_title')}

## {t(lang,'status')}
- {t(lang,'readiness')}: {_verdict(lang, v)}
- {t(lang,'run_id')}: `{model.get('run_id','')}`
- {t(lang,'source_idea')}: `raw/idea.md`
- {t(lang,'generated_at')}: {model.get('generated_at','')}

## {t(lang,'pkg_what')}
{_table([t(lang,'primary_doc'), t(lang,'doc_purpose'), t(lang,'doc_audience')], rows)}

## {t(lang,'pkg_order')}
{chr(10).join(order)}

## {t(lang,'pkg_notdo')}
{t(lang,'pkg_notdo_body')}

## {t(lang,'pkg_reader')}
{t(lang,'pkg_reader_body')}

## {t(lang,'pkg_quality')}
{t(lang,'pkg_quality_body')}
"""


def render_prd(model: dict) -> str:
    lang = model["lang"]
    g = model
    # executive summary
    es = [
        f"**{t(lang,'problem')}**  \n{g.get('idea_restatement','')}",
        f"**{t(lang,'desired')}**  \n{'; '.join(m['target'] for m in g['goals']) or t(lang,'na')}",
        f"**{t(lang,'primary_users')}**  \n{', '.join(a['name'] for a in g['actors']) or t(lang,'na')}",
        f"**{t(lang,'in_scope')}**  \n{', '.join(c['capability'] for c in g['in_scope']) or t(lang,'na')}",
        f"**{t(lang,'out_scope')}**  \n{', '.join(o['item'] for o in g['out_of_scope']) or t(lang,'na')}",
        f"**{t(lang,'locked_decisions')}**  \n{'; '.join(d['text'] for d in g['decisions']) or t(lang,'none')}",
        f"**{t(lang,'main_risks')}**  \n{'; '.join(a['text'] for a in g['assumptions'][:3]) or t(lang,'none')}",
        f"**{t(lang,'readiness')}**  \n{g.get('readiness','PENDING')}",
    ]
    goal_rows = [[m["goal"], m["target"], _clean_source_ref(m["source"], lang), m["confidence"]] for m in g["goals"]]
    nongoals = [f"{o['item']} — {o['reason']}" for o in g["out_of_scope"]] + \
               [f"({t(lang,'deferred')}) {d['item']} — {d['reason']}" for d in g["deferred"]]
    in_rows = [[c["capability"], c["moscow"], _clean_source_ref(c.get("source_ref"), lang)] for c in g["in_scope"]]
    actor_rows = [[a["name"], a.get("description", t(lang, "na"))] for a in g["actors"]]
    jtbd = [j["job"] for j in g["jobs"]]
    fr_cats = sorted({f["id"].split("-")[0] for f in g["functional"]})
    return f"""{_fm(model, t(lang,'prd_title') + ': ' + g.get('name',''))}# {t(lang,'prd_title')}: {g.get('name','')}

## 1. {t(lang,'exec_summary')}
{(chr(10)+chr(10)).join(es)}

## 2. {t(lang,'product_intent')}
{t(lang,'purpose_line')}: {g.get('idea_restatement','')}

## 3. {t(lang,'goals')}
{_table([t(lang,'goal'), t(lang,'target'), t(lang,'source'), t(lang,'confidence')], goal_rows)}

## 4. {t(lang,'non_goals')}
{_bullets_or_none(nongoals, lang)}

## 5. {t(lang,'scope')}
### {t(lang,'in_scope')}
{_table([t(lang,'capability'), 'MoSCoW', t(lang,'source')], in_rows)}

### {t(lang,'out_scope')}
{_bullets_or_none([o['item'] + ' — ' + o['reason'] for o in g['out_of_scope']], lang)}

### {t(lang,'deferred')}
{_bullets_or_none([d['item'] + ' — ' + d['reason'] for d in g['deferred']], lang)}

## 6. {t(lang,'users_actors')}
### {t(lang,'actors')}
{_table([t(lang,'actors'), t(lang,'notes')], actor_rows)}

### {t(lang,'jtbd')}
{_bullets_or_none(jtbd, lang)}

## 7. {t(lang,'req_overview')}
- {t(lang,'fr_summary')}: {len(g['functional'])} ({', '.join(fr_cats) or t(lang,'na')})
- {t(lang,'qr_summary')}: {sum(1 for n in g['nfrs'] if n.get('coverage_status')=='required')} required / {len(g['nfrs'])} total
- {t(lang,'constraints_summary')}: {len(g['constraints_ctx'])}

## 8. {t(lang,'detailed_req')}
{t(lang,'see')} `REQUIREMENTS.md`.

## 9. {t(lang,'acceptance_overview')}
{t(lang,'see')} `ACCEPTANCE.md` ({len(g['acceptance'])}).

## 10. {t(lang,'decisions')}
{t(lang,'see')} `DECISIONS.md`.

## 11. {t(lang,'risks_questions')}
{t(lang,'see')} `QUESTIONS.md`.

## 12. {t(lang,'readiness')}
{t(lang,'see')} `READINESS.md`.
"""


def render_requirements(model: dict) -> str:
    lang = model["lang"]
    out = [_fm(model, t(lang, "requirements")), f"# {t(lang,'requirements')}\n",
           f"## {t(lang,'reading_notes')}\n{t(lang,'req_reading_note')}\n",
           f"## {t(lang,'fr_summary')}\n"]
    for f in model["functional"]:
        body = f.get("rendered") or f.get("system_response", "")
        acc = ", ".join(f.get("acceptance_ids", [])) or t(lang, "none")
        out.append(
            f"### {f['id']} — {f.get('capability','')}\n\n"
            f"**{t(lang,'requirement')}**  \n{body}\n\n"
            f"**{t(lang,'why_matters')}**  \n{f.get('rationale', t(lang,'na'))}\n\n"
            f"**{t(lang,'source')}**  \n{f.get('source','')} · {_clean_source_ref(f.get('source_ref'), lang)}\n\n"
            f"**{t(lang,'priority')}**  \n{f.get('priority','')}\n\n"
            f"**{t(lang,'acc_coverage')}**  \n{acc}\n\n"
            f"**{t(lang,'impl_boundary')}**  \n{t(lang,'impl_boundary_body')}\n\n---\n"
        )
    out.append(f"\n## {t(lang,'qr_summary')}\n")
    for n in model["nfrs"]:
        if n.get("coverage_status") == "not_applicable":
            out.append(
                f"### {n['id']} — {n.get('iso25010_category','')}\n\n"
                f"**{t(lang,'quality_attr')}**  \n{n.get('iso25010_category','')}\n\n"
                f"**{t(lang,'coverage_na')}**  \n{n.get('na_reason') or t(lang,'na')}\n\n---\n"
            )
            continue
        fc = n.get("fit_criterion") or {}
        if fc:
            fitline = f"{t(lang,'satisfied_when')} {fc.get('threshold','')} · {fc.get('environment','')} · {fc.get('period','')}"
        elif n.get("coverage_status") == "deferred":
            fitline = t(lang, "deferred") + ((": " + n["deferred_missing_info"]) if n.get("deferred_missing_info") else "")
        else:
            fitline = t(lang, "na")
        if n.get("source") == "assumed":
            fitline += f" ({t(lang, 'assumed_default')})"
        out.append(
            f"### {n['id']} — {n.get('iso25010_category','')}\n\n"
            f"**{t(lang,'quality_attr')}**  \n{n.get('iso25010_category','')}\n\n"
            f"**{t(lang,'requirement')}**  \n{n.get('description','')}\n\n"
            f"**{t(lang,'fit_criterion')}**  \n{fitline}\n\n"
            f"**{t(lang,'measurement_ctx')}**  \n{n.get('measurement_method') or t(lang,'na')}\n\n"
            f"**{t(lang,'source')}**  \n{_clean_source_ref(n.get('source_ref'), lang)}\n\n"
            f"**{t(lang,'priority')}**  \n{n.get('priority','')}\n\n---\n"
        )
    return "\n".join(out)


def _ac_type_label(s: dict, lang: str) -> str:
    """Use the author-supplied scenario `type` when present; otherwise infer from the then/prose so a
    negative/error path is never mislabeled 'Happy path'."""
    typ = s.get("type")
    if typ in ("happy_path", "negative", "edge_case"):
        return t(lang, typ)
    text = " ".join(list(s.get("then", [])) + [s.get("prose", "")]).lower()
    neg = ["passes when not", "reject", "denie", "deny", "withh", "no longer", "missing", "refuse",
           "blocked", "prevent", "cannot", "no working", "fully booked", "no availab", "not exposed",
           "拒绝", "没有", "缺少", "阻止", "禁止", "无法", "未授权", "不予", "未登录"]
    return t(lang, "negative") if any(k in text for k in neg) else t(lang, "happy_path")


def render_acceptance(model: dict) -> str:
    lang = model["lang"]
    out = [_fm(model, t(lang, "acceptance")), f"# {t(lang,'acceptance')}\n",
           f"## {t(lang,'acc_philosophy')}\n{t(lang,'acc_phil_body')}\n"]
    for s in model["acceptance"]:
        given = "\n".join(f"  Given {x}" if i == 0 else f"  And {x}" for i, x in enumerate(s.get("given", [])))
        when = "\n".join(f"  When {x}" if i == 0 else f"  And {x}" for i, x in enumerate(s.get("when", [])))
        then = "\n".join(f"  Then {x}" if i == 0 else f"  And {x}" for i, x in enumerate(s.get("then", [])))
        gherkin = "\n".join(x for x in [f"Scenario: {s.get('scenario','')}", given, when, then] if x)
        obs = "; ".join(x for x in s.get("then", []) if x) or s.get("prose", "")
        out.append(
            f"### {s['id']} — {s.get('scenario','')}\n\n"
            f"**{t(lang,'covers')}**  \n{s.get('requirement_id','')}\n\n"
            f"**{t(lang,'type')}**  \n{_ac_type_label(s, lang)}\n\n"
            f"```gherkin\n{gherkin}\n```\n\n"
            f"**{t(lang,'plain_lang')}**  \n{s.get('prose','')}\n\n"
            f"**{t(lang,'observable')}**  \n{obs}\n\n---\n"
        )
    return "\n".join(out)


def render_decisions(model: dict) -> str:
    lang = model["lang"]
    rows = [[f"ADR-{i:04d}", d["text"], t(lang, "accepted"), _clean_source_ref(d.get("source_ref"), lang)]
            for i, d in enumerate(model["decisions"], 1)]
    idx = [f"`decisions/ADR-{i:04d}.md` — {d['text'][:60]}" for i, d in enumerate(model["decisions"], 1)]
    prefs = [a["text"] for a in model["assumptions"] if a.get("importance") == "high"]
    return f"""{_fm(model, t(lang,'decisions'))}# {t(lang,'decisions')}

## {t(lang,'decision_summary')}
{_table(['ID', t(lang,'decision'), t(lang,'status'), t(lang,'source')], rows)}

## {t(lang,'decision_boundaries')}
{t(lang,'binding_note')}

## {t(lang,'preferences')}
{t(lang,'pref_note')}
{_bullets_or_none(prefs, lang)}

## {t(lang,'assumptions')}
{t(lang,'assum_note')} {t(lang,'see')} `QUESTIONS.md`.

## {t(lang,'adr_index')}
{_bullets_or_none(idx, lang)}
"""


def render_constraints(model: dict) -> str:
    lang = model["lang"]
    prod = [f"{c['what']}" for c in model["constraints_ctx"] if c.get("type") in ("product", "business", "ux")]
    other_ctx = [f"{c['type']}: {c['what']}" for c in model["constraints_ctx"]
                 if c.get("type") not in ("product", "business", "ux")]
    qual = [f"{n['id']} [{n.get('iso25010_category','')}]: {n.get('description','')}"
            for n in model["nfrs"] if n.get("coverage_status") == "required"]
    dec = [d["text"] for d in model["decisions"]]
    return f"""{_fm(model, t(lang,'constraints'))}# {t(lang,'constraints')}

## {t(lang,'product_constraints')}
{_bullets_or_none(prod + other_ctx, lang)}

## {t(lang,'quality_constraints')}
{_bullets_or_none(qual, lang)}

## {t(lang,'decision_constraints')}
{_bullets_or_none(dec, lang)}

## {t(lang,'not_constraints')}
{t(lang,'not_constraints_body')}
"""


def render_glossary(model: dict) -> str:
    lang = model["lang"]
    rows = [[gl["term"], gl.get("definition", ""), _clean_source_ref(gl.get("source_ref"), lang)]
            for gl in model["glossary"]]
    return f"""{_fm(model, t(lang,'glossary'))}# {t(lang,'glossary')}

{_table([t(lang,'term'), t(lang,'meaning'), t(lang,'source')], rows)}

## {t(lang,'ambiguous_resolved')}
{_bullets_or_none([], lang)}

## {t(lang,'not_defined')}
{_bullets_or_none([], lang)}
"""


def render_questions(model: dict) -> str:
    lang = model["lang"]
    oq = [[q["question"], q.get("why", t(lang, "na")),
           t(lang, "yes") if q.get("blocking") else t(lang, "no"), t(lang, "na")]
          for q in model["open_questions"]]
    asm = [[a["text"], a.get("confidence", t(lang, "na")), a.get("risk_if_wrong", t(lang, "na")),
            t(lang, "na")] for a in model["assumptions"]]
    return f"""{_fm(model, t(lang,'questions_title'))}# {t(lang,'questions_title')}

## {t(lang,'open_questions')}
{_table([t(lang,'question'), t(lang,'why_it_matters_q'), t(lang,'blocking'), t(lang,'owner')], oq)}

## {t(lang,'assumptions_fwd')}
{_table([t(lang,'assumption'), t(lang,'confidence'), t(lang,'risk_if_wrong'), t(lang,'affected_req')], asm)}

## {t(lang,'resolved_q')}
{_bullets_or_none([], lang)}
"""


def render_traceability(model: dict) -> str:
    lang = model["lang"]
    s2r = [[_clean_source_ref(f.get("source_ref"), lang), f["id"], ", ".join(f.get("acceptance_ids", [])) or t(lang, "none")]
           for f in model["functional"]]
    cov = [[f["id"], ", ".join(f.get("acceptance_ids", [])) or t(lang, "none"),
            t(lang, "covered") if f.get("acceptance_ids") else t(lang, "uncovered")]
           for f in model["functional"]]
    dec = [[f"ADR-{i:04d}", d["text"][:50], ", ".join(d.get("affected", [])) or t(lang, "na")] for i, d in enumerate(model["decisions"], 1)]
    return f"""{_fm(model, t(lang,'trace_title'))}# {t(lang,'trace_title')}

## {t(lang,'src_to_req')}
{_table([t(lang,'source_claim'), t(lang,'requirement'), t(lang,'covers')], s2r)}

## {t(lang,'req_coverage')}
{_table([t(lang,'requirement'), t(lang,'acc_coverage'), t(lang,'status')], cov)}

## {t(lang,'decision_impact')}
{_table(['ID', t(lang,'decision'), t(lang,'affected_req')], dec)}
"""


def render_changelog(model: dict) -> str:
    lang = model["lang"]
    return f"""{_fm(model, t(lang,'changelog'))}# {t(lang,'changelog')}

## {model.get('run_id','')} — {model.get('generated_at','')}

### {t(lang,'added')}
- {t(lang,'first_gen')}

### {t(lang,'changed')}
- {t(lang,'none')}

### {t(lang,'removed')}
- {t(lang,'none')}

### {t(lang,'why_changed')}
- {t(lang,'first_gen')}

### {t(lang,'affected_docs')}
- PRD.md, REQUIREMENTS.md, ACCEPTANCE.md, DECISIONS.md, CONSTRAINTS.md
"""


def render_adr(model: dict, idx: int, decision: dict) -> str:
    lang = model["lang"]
    return f"""---
type: adr
status: {t(lang,'accepted')}
id: ADR-{idx:04d}
source: i2r
---
# ADR-{idx:04d}: {decision['text'][:70]}

## {t(lang,'status')}
{t(lang,'accepted')}

## {t(lang,'context')}
{decision.get('context') or t(lang,'na')}

## {t(lang,'decision')}
{decision['text']}

## {t(lang,'rationale')}
{decision.get('rationale') or t(lang,'na')}

## {t(lang,'alternatives')}
{decision.get('alternatives') or t(lang,'na')}

## {t(lang,'tradeoffs')}
{decision.get('tradeoffs') or t(lang,'na')}

## {t(lang,'consequences')}
{decision.get('consequences') or t(lang,'na')}

## {t(lang,'reversibility')}
{decision.get('reversibility') or t(lang,'na')}

## {t(lang,'affected_req')}
{', '.join(decision.get('affected', [])) or t(lang,'na')}

## {t(lang,'source')}
{_clean_source_ref(decision.get('source_ref','(intake decision)'), lang)}
"""


def render_readiness(model: dict, gate: dict) -> str:
    """Human-readable readiness (out/READINESS.md). `gate` is the gate-result dict from i2r.py."""
    lang = model["lang"]
    v = gate.get("verdict", "PENDING")
    pend = f"\n\n> {t(lang, 'readiness_pending')}" if v == "PENDING" else ""
    checks = gate.get("checks", [])  # list of {name, result, note}
    rows = [[c["name"], c["result"], c.get("note", "")] for c in checks]
    reasons = gate.get("reasons", [])
    blocking = [r for r in reasons if "BLOCK" in r.upper() or "missing" in r.lower()]
    return f"""{_fm({**model, 'readiness': v}, t(lang,'readiness_title'))}# {t(lang,'readiness_title')}

## {t(lang,'verdict')}
{_verdict(lang, v)}{pend}

## {t(lang,'why_verdict')}
{_bullets_or_none(reasons, lang)}

## {t(lang,'blocking_issues')}
{_bullets_or_none(blocking, lang)}

## {t(lang,'quality_checks')}
{_table([t(lang,'check'), t(lang,'result'), t(lang,'notes')], rows)}

## {t(lang,'remaining_risks')}
{_bullets_or_none([a['text'] for a in model['assumptions'] if a.get('risk_if_wrong')=='high'], lang)}

## {t(lang,'follow_up')}
{t(lang,'follow_up_body')}
"""


# ============================== audit documents ==============================
def render_run_summary(model: dict) -> str:
    lang = model["lang"]
    return f"""# {t(lang,'run_summary')} — {model.get('run_id','')}

- {t(lang,'readiness')}: {model.get('readiness','PENDING')}
- {t(lang,'fr_summary')}: {len(model['functional'])}
- {t(lang,'qr_summary')}: {len(model['nfrs'])}
- {t(lang,'acceptance')}: {len(model['acceptance'])}
- {t(lang,'locked_decisions')}: {len(model['decisions'])}
- {t(lang,'generated_at')}: {model.get('generated_at','')}

## {t(lang,'pkg_quality')}
{t(lang,'pkg_quality_body')}
"""


def render_review_summary(model: dict, reviews: list) -> str:
    lang = model["lang"]
    out = [f"# {t(lang,'review_summary')} — {model.get('run_id','')}\n"]
    for r in reviews:
        out.append(f"## {t(lang,'reviewer')}: {r.get('reviewer','?')} — {r.get('verdict','?')}\n")
        for f in r.get("findings", []):
            out.append(f"- [{f.get('severity')}] {f.get('defect_class')}"
                       f"{(' ' + f.get('requirement_id')) if f.get('requirement_id') else ''}: {f.get('evidence','')}")
        out.append("")
    return "\n".join(out)


def render_evidence_log(model: dict, evidence: list) -> str:
    lang = model["lang"]
    if not evidence:
        return f"# {t(lang,'evidence_log')}\n\n{t(lang,'no_evidence')}\n"
    rows = [[e.get("id", ""), e.get("claim", e.get("summary", "")), e.get("source_ref", "")] for e in evidence]
    return f"# {t(lang,'evidence_log')}\n\n{_table(['ID', t(lang,'requirement'), t(lang,'source')], rows)}\n"


def render_repair_notes(model: dict, repair) -> str:
    lang = model["lang"]
    if not repair or repair.get("status") == "SKIPPED":
        return f"# {t(lang,'repair_notes')}\n\n{t(lang,'no_repair')}\n"
    out = [f"# {t(lang,'repair_notes')}\n"]
    out.append(f"- iteration: {repair.get('iteration')}")
    out.append(f"- failed_stage: {repair.get('failed_stage')}")
    for f in repair.get("findings", []):
        out.append(f"- [{f.get('severity')}] {f.get('defect_class')}: {f.get('evidence','')}")
    return "\n".join(out) + "\n"


def render_gate_md(model: dict, gate: dict) -> str:
    lang = model["lang"]
    rows = [[c["name"], c["result"], c.get("note", "")] for c in gate.get("checks", [])]
    return f"""# {t(lang,'gate_explanation')} — {model.get('run_id','')}

## {t(lang,'verdict')}
**{gate.get('verdict','')}**

## {t(lang,'why_verdict')}
{_bullets_or_none(gate.get('reasons', []), lang)}

## {t(lang,'quality_checks')}
{_table([t(lang,'check'), t(lang,'result'), t(lang,'notes')], rows)}
"""


# ============================== package assembler ==============================
def render_package(model: dict) -> dict:
    """Return {relative_path_under_out: markdown_content} for the whole reading package
    (READINESS.md is written provisionally here; gate.check overwrites it with the final verdict)."""
    pkg = {
        "README.md": render_readme(model),
        "PRD.md": render_prd(model),
        "REQUIREMENTS.md": render_requirements(model),
        "ACCEPTANCE.md": render_acceptance(model),
        "DECISIONS.md": render_decisions(model),
        "CONSTRAINTS.md": render_constraints(model),
        "GLOSSARY.md": render_glossary(model),
        "QUESTIONS.md": render_questions(model),
        "TRACEABILITY.md": render_traceability(model),
        "CHANGELOG.md": render_changelog(model),
        "READINESS.md": render_readiness(model, {"verdict": model.get("readiness", "PENDING"),
                                                 "reasons": [], "checks": []}),
    }
    for i, d in enumerate(model["decisions"], 1):
        pkg[f"decisions/ADR-{i:04d}.md"] = render_adr(model, i, d)
    return pkg
