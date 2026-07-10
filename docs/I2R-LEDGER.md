# I2R Ledger — vendored source map

> **Vendor-not-install (CONTRACT §0).** External projects are a source of proven *patterns*, never runtime
> dependencies. For each: `research external → extract pattern → implement as our own i2r-* component → cite
> here → add examples/tests`. I2R never installs or calls an external skill at runtime. This file is the
> source map the contract references.

## Source map

| Pattern (as vendored into I2R) | External source | Lands in |
|---|---|---|
| Spec-phase / clarify discipline, scope gates | Spec Kit (specify/clarify) | `i2r-scope-mode`, gate logic |
| Product-brief scope taxonomy | BMAD product brief | `i2r-scope-mode` |
| EARS requirement patterns | EARS (Alistair Mavin) | `i2r-fr-authoring-mode` |
| INVEST story framework | PM Skills | `i2r-fr-authoring-mode` |
| Volere fit criterion (threshold/environment/period) | Volere (Robertson & Robertson) | `i2r-nfr-authoring-mode` |
| ISO/IEC 25010:2023 quality model | ISO/IEC 25010:2023 | `i2r-nfr-authoring-mode` |
| Multi-agent debate | AutoGen | `i2r-debate-review-mode` (scope debate) |
| Adversarial dual-review loop | Superpowers review loop | `i2r-debate-review-mode` (santa-loop) |
| Finding shape (severity/evidence/blocking/fix) | `/code-review` report shape | `07-review` schema, defect taxonomy |
| Reader Test (standalone-readable doc) | Anthropic doc-coauthoring | Reader Test Gate (CONTRACT §11) |
| Placeholder / PRD-grade ambiguity scan | PRD Taskmaster | `placeholder_scan`, `prd_grade` |
| Cold-start interview / fluff filter | The Mom Test | `i2r-elicitation-mode` |
| Anchoring (template + good/bad example) | product-on-purpose / pm-skills | author mode `references/` |
| **Requirements Minimalism Ladder (RML)** | **ponytail (DietrichGebert/ponytail, MIT)** | **`requirements-minimalism.md` + scope/author/critic + `minimalism_scan` + `OVER_SPECIFICATION`** |

## RML migration note (ponytail → I2R)

ponytail forces the *minimum code that works* via a 7-rung laziness ladder and a "never lazy about
security/validation/accessibility" floor. I2R's analog is over-**specification**: gold-plated requirements,
re-stated platform/standard givens, duplicate or fragmented requirements. The vendored translation:

- **Ladder** → `requirements-minimalism.md` (root orchestration skill), referenced by `i2r-scope-mode` Step 5,
  `i2r-fr-authoring-mode`, `i2r-nfr-authoring-mode`.
- **Safety floor** → the never-minimize list (security / data-loss / accessibility / compliance / explicit
  asks); floor items are MoSCoW MUST and exempt from every minimalism flag.
- **`ponytail:` comment + `/ponytail-debt` ledger** → the `revisit_trigger` field on deferred scope items +
  the `deferral_has_trigger` gate check (a deferral must name its upgrade trigger or it rots).
- **ponytail-review / ponytail-audit** → the `OVER_SPECIFICATION` defect class (critic) + the deterministic
  `minimalism_scan` (SDK). Redundancy reuses `DUPLICATE`; gold-plating reuses `SCOPE_LEAK`.

Deliberately **not** vendored (faithful to ponytail's own rung 1, YAGNI): no separate review/audit/debt/gain/
help skill family (i2r's critic = review, gate = audit already cover it), no always-on activation hook (I2R is
already an auto-activated orchestrator), no per-run "savings" scoreboard (meaningless for requirements;
ponytail itself forbids inventing per-repo numbers). Zero new agents, zero new skills.
