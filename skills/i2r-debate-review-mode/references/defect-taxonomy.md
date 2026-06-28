# Defect Taxonomy

The fixed `defect_class` set from CONTRACT §7 (the authoritative list and count live there). Every finding in
`07-review.json` and `07-review.codex.json` must use exactly one of these values.
Do not invent new classes; if a defect does not fit, use the closest match and
explain in `evidence`.

---

## Defect classes, definitions, and default severity

| `defect_class` | Default severity | Definition |
|----------------|-----------------|------------|
| `AMBIGUITY` | MAJOR | The requirement can be read in more than one way by a reasonable implementer. Includes vague intensifiers ("fast", "secure", "user-friendly"), pronoun ambiguity, and underspecified subjects. |
| `UNTESTABLE` | BLOCKER | No objective pass/fail criterion exists. Reviewer cannot write a test that definitively passes or fails based on the requirement text alone. |
| `UNSOURCED` | MAJOR | The requirement carries no `source_ref` tracing it to a user statement, `raw/` document, or `EV-NNN` evidence card. Assumptions silently promoted to stated facts. |
| `SCOPE_LEAK` | BLOCKER | A capability or constraint appears in a requirement that is not present in `03-scope.json` `in_scope[]` or `capability_inventory[]`. The requirement extends scope without authorisation. |
| `IMPLEMENTATION_LEAK` | BLOCKER | The requirement describes HOW to build rather than WHAT to deliver. Stack-swap test fails: if the DB or framework changed, this requirement would need rewriting. |
| `DUPLICATE` | MINOR | Two or more requirements describe the same behaviour. One is redundant; keeping both creates maintenance risk and contradictions. |
| `CONFLICT` | BLOCKER | Two requirements are mutually exclusive or cannot both be satisfied simultaneously (e.g. latency ceiling + required computation workload). |
| `NFR_MISSING` | MAJOR | A `required` NFR lacks its `fit_criterion` (the SDK `placeholder_scan` emits `NFR_MISSING` when any of `threshold`/`environment`/`period` is absent), OR an in-scope capability with observable quality attributes (latency, availability, security level, data retention) has no NFR at all in `05-nfr.json`. |
| `ACCEPTANCE_GAP` | MAJOR | A requirement in `04-functional.json` has no corresponding acceptance criterion in `06-acceptance.json`, or the existing criterion does not cover the requirement's boundary conditions. |
| `GSD_INCOMPATIBLE` | BLOCKER | The requirement cannot be acted upon by a GSD agent without re-deriving scope, making architecture decisions, or resolving ambiguity that should have been resolved here. GSD's contract is to receive READY requirements. |
| `DOWNSTREAM_REINTERPRETATION_RISK` | MAJOR | The requirement is technically unambiguous but is highly likely to be misread by implementers, reviewers, or downstream AI agents in a predictable way. Requires a `scope_risks` note or rewrite. |
| `READER_TEST_FAIL` | BLOCKER | A fresh reader seeing only `PRD.md` cannot independently infer goals, boundary, constraints, or acceptance criteria for this requirement. The PRD is not standalone-readable. |
| `PLACEHOLDER` | BLOCKER | A requirement, NFR, or acceptance criterion contains a placeholder value from the reject list (CONTRACT §9): `TBD`, `TODO`, `FIXME`, `nice to have`, `fast`, `secure`, `scalable`, `robust`, `user-friendly`, `performant`, `flexible`, `efficient`, `as appropriate`, `as needed`, `etc.`, `and so on`, `to be determined`. |
| `DOWNSTREAM_COMMAND_LEAK` | BLOCKER | Any `/gsd:*`, `plan-phase`, `ingest-docs`, or machine-contract field (`next_command_hint`, `consumer_contract_version`, `required_gsd_behavior`, `handoff.gsd`) in an `out/` document — the package must carry no downstream orchestration commands (CONTRACT §1, §18). |
| `OVER_SPECIFICATION` | MAJOR | The requirement/NFR carries no incremental WHAT: it restates a guarantee the platform / standard / regulation the project is bound to already provides (TLS, JSON responses, hashing the stack mandates), or it is an `assumed` engineered default nobody asked for. The RML lens (root skill `requirements-minimalism.md`). Distinct from `DUPLICATE` (restates *another requirement*) and `SCOPE_LEAK` (a *gold-plated capability* outside scope). NEVER applied to a safety-floor item (security / data-loss / accessibility / compliance / explicit ask) — those are protected even when terse. RML only flags; `OVER_SPECIFICATION` is never BLOCKER. |

---

## Severity override rules

Default severity may be overridden by a reviewer with explicit justification in `evidence`:

- `AMBIGUITY` may be upgraded to BLOCKER if the ambiguity is in a security or
  safety-critical requirement.
- `UNSOURCED` may be downgraded to MINOR if the fact is self-evident and
  universally accepted (e.g. "the system must not return HTTP 5xx to the user
  without logging the error").
- `NFR_MISSING` may be downgraded to MINOR if the capability is explicitly `COULD`
  or `WONT` in scope.
- `OVER_SPECIFICATION` may be downgraded to MINOR for an unmotivated `assumed` NFR (advisory — confirm it is
  wanted), or upgraded to MAJOR for a platform/standard re-statement that misleads downstream. Never BLOCKER.

BLOCKER defects can never be downgraded below MAJOR. If a reviewer disagrees with
a BLOCKER classification, they must record it as MAJOR with full justification;
the gate resolves the discrepancy.

---

## Completeness checklist (per review pass)

Before producing `findings[]`, the reviewer runs this checklist. Each class
is checked independently; a failure generates one or more findings.

1. **Singularity** — Does each requirement describe exactly one behaviour?
   (Hidden `and`/`or` conjunctions → AMBIGUITY or DUPLICATE.)

2. **Testability** — Is there an objective, binary pass/fail criterion?
   (ISO 29148: requirements must be verifiable. Failure → UNTESTABLE.)

3. **Traceability** — Does every requirement have `source` + `source_ref`?
   (Femmer ambiguity smell: ungrounded facts. Failure → UNSOURCED.)

4. **Boundary conformance** — Does every requirement trace to `capability_inventory[]`?
   (Failure → SCOPE_LEAK.)

5. **WHAT purity** — Does no requirement prescribe implementation?
   (Stack-swap test. Failure → IMPLEMENTATION_LEAK.)

6. **NFR coverage** — Does every FR with observable quality attributes have
   a matching NFR with a real `fit_criterion`? (Failure → NFR_MISSING.)

7. **Acceptance coverage** — Does every FR have at least one AC, and does each
   AC cover the boundary conditions? (Failure → ACCEPTANCE_GAP.)

8. **GSD handoff readiness** — Can a GSD agent act on every requirement without
   making scope, architecture, or ambiguity decisions?
   (GSD rubric. Failure → GSD_INCOMPATIBLE.)

9. **Minimalism** — Does every requirement carry incremental WHAT, or does it
   restate a platform/standard given or duplicate another requirement?
   (RML ladder, root skill `requirements-minimalism.md`. Failure → OVER_SPECIFICATION,
   or DUPLICATE / SCOPE_LEAK where those fit. Safety-floor items are exempt.)

---

## GSD ambiguity precheck weights (CONTRACT §10)

Run after the completeness checklist. Score each dimension 0.0–1.0 (0 = no ambiguity):

```
goal       × 0.35   — Is the business purpose clear and specific?
boundary   × 0.25   — Is the scope boundary unambiguous?
constraint × 0.20   — Are all non-functional ceilings quantified?
acceptance × 0.20   — Can a reviewer write a binary pass/fail test?
────────────────────
score = weighted sum   target ≤ 0.20
```

Score > 0.20 → MAJOR finding with `defect_class: "AMBIGUITY"` referencing the
specific dimension that drove the score above threshold.
