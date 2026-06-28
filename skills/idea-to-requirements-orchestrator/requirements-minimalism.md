# Requirements Minimalism Ladder (RML)

> **What this is.** I2R's domain translation of the ponytail "laziness ladder" (vendored — see
> `docs/I2R-LEDGER.md`). ponytail forces the *minimum code that works*; RML forces the *minimum set of
> requirements that captures the intent*. Over-engineering is to code what over-specification is to a spec:
> wasted surface that someone downstream pays for. RML is the firewall against it.
>
> **Where it is read.** This is the single source of truth for requirements minimalism. It is referenced (not
> copied) by `i2r-scope-mode` (Step 5 anti-creep), `i2r-fr-authoring-mode` / `i2r-nfr-authoring-mode` (the
> author reflex), and `i2r-completeness-critic` / `i2r-debate-review-mode` (the `OVER_SPECIFICATION` review
> lens). The deterministic counterpart is `i2r.py`'s `minimalism_scan` (`DUPLICATE` / `OVER_SPECIFICATION` /
> `deferral_has_trigger`).

---

## The one rule

> Specify only what the idea needs. Never cut a requirement that protects security, data, accessibility,
> compliance, a trust boundary, or anything the user explicitly asked for.

Small spec because it is *necessary*, not because it is golfed. A short requirements package that drops a
must-have is not minimal, it is incomplete.

## Lazy about the spec, never about the idea

The ladder runs **after** you understand the idea, not instead of it. Read the raw idea, the context, and the
scope boundary; trace what the user is actually trying to achieve end to end; *then* climb. A requirement you
cut because you did not understand the idea is not minimalism — it is a confident wrong scope, the dangerous
kind. Read fully, then be minimal.

## The ladder

Before writing (or keeping) any FR / NFR / scope item, stop at the first rung that holds:

1. **Does this requirement need to exist at all?** A behaviour the user never asked for, a "nice to have", a
   quality target nobody needs → it is gold-plating. Cut it, or move it to `deferred` / `out_of_scope` with a
   reason. (YAGNI for requirements. Maps to existing scope anti-creep → `SCOPE_LEAK` if it slipped in.)
2. **Is it already covered by another requirement?** Same behaviour stated twice, an NFR that restates an FR,
   two capabilities that are one → merge or reference, do not duplicate. (Maps to `DUPLICATE`.)
3. **Is it already guaranteed by a platform / standard / regulation the project is bound to?** "The system
   shall use TLS", "passwords shall be hashed", "the API shall return JSON" when the chosen platform/standard
   already mandates it → state it **once** as a *constraint*, do not multiply it into N requirements. A
   requirement whose only content is a re-statement of a platform/standard given carries no incremental WHAT.
   (Maps to `OVER_SPECIFICATION`. This is RML's genuinely new lens — i2r's old anti-creep did not have it.)
4. **Is it already implied by a locked decision or an existing constraint?** Derive it in the reader's head;
   do not restate the consequence of a decision as a fresh requirement.
5. **Can it be one requirement instead of five?** One observable behaviour = one requirement (singularity
   already enforced) — but the inverse also holds: do not fragment one intent into a cloud of near-identical
   requirements that a reader has to reassemble. Atomic, not shredded.
6. **Only then:** write the minimum requirement that captures the intent — with its source, its acceptance,
   and (for NFRs) its measurable fit criterion. Minimal in count, never minimal in rigour.

Two rungs apply → take the higher one and move on. The ladder is a reflex, not a research project.

## The safety floor — never minimize these away

RML **never** cuts, defers, or weakens a requirement in these categories, even under an aggressive scope
stance:

- Input validation at trust boundaries.
- Error handling that prevents data loss or corruption.
- Security controls (authn/authz, secrets handling, injection defence, audit of sensitive actions).
- Accessibility basics.
- Regulatory / compliance obligations the project is bound to (privacy, payment, data-residency, …).
- Anything the user **explicitly asked to keep**. If the user insists on the fuller version, it stays — no
  re-arguing.

A floor item is a MoSCoW **MUST** by default. RML shrinks the *count* of requirements; it never lowers the
*floor*. (This is ponytail's "when NOT to be lazy", translated. Minimalism without this floor is negligence
wearing the costume of efficiency.)

## The deferral-with-trigger convention (anti-rot)

A cut is honest only if it can be revisited. Every `deferred[]` item carries, besides its `reason`, a
**`revisit_trigger`** — the concrete condition under which it should re-enter scope:

```
deferred:
  - item: "Bulk CSV import of contacts"
    reason: "Single-contact entry covers the stated jobs-to-be-done for v1."
    revisit_trigger: "A user imports >50 contacts manually, or a customer asks for batch onboarding."
```

A `deferred` item with **no** `revisit_trigger` is a deferral that will silently rot into "later means never".
The deterministic gate flags it (`deferral_has_trigger`, MAJOR → NEEDS_REVIEW, never BLOCKER — RML only
flags, it does not block). This is ponytail's `ponytail:` comment + `/ponytail-debt` ledger, translated to the
requirements domain: a deferral names its own upgrade trigger, so it cannot quietly become permanent.

## Output discipline

When you cut, deduplicate, or defer, say it in one line — what was removed and why — in the item's `reason`
or the scope rationale. Do not write a paragraph defending a simplification; a defence longer than the
requirement is complexity smuggled back in as prose. The exception is content the user explicitly asked for
(a rationale section, an ADR) — that is not debt, give it in full.

## How RML maps onto the harness (no new machinery)

RML is faithful to its own rung 1 — it does **not** add a parallel skill family. It reuses what i2r already
has:

| RML concern | Enforced by (existing component, extended) | Signal |
|---|---|---|
| Gold-plated / speculative requirement | `i2r-scope-mode` Step 5 anti-creep | `SCOPE_LEAK` |
| Duplicate requirement | `minimalism_scan` + critic | `DUPLICATE` |
| Re-specified platform/standard given | critic `OVER_SPECIFICATION` lens + `minimalism_scan` | `OVER_SPECIFICATION` |
| Unmotivated `assumed` NFR | `minimalism_scan` (advisory) | `OVER_SPECIFICATION` (MINOR) |
| Deferral with no revisit trigger | `minimalism_scan` over `03-scope` | `deferral_has_trigger` (MAJOR) |
| The safety floor | MoSCoW MUST + the never-cut list above | (review enforces; floor items immune) |

RML adds **zero** new agents and **zero** new skills. It is a discipline (this doc) + one new defect class +
one deterministic scan + one optional schema field.

---

*Vendored from: ponytail (DietrichGebert/ponytail, MIT) — the laziness ladder, the "when NOT to be lazy"
safety floor, and the `ponytail:`-comment / `ponytail-debt` deferral-ledger convention, translated from the
code domain to the requirements domain. I2R does not call ponytail at runtime (vendor-not-install, CONTRACT
§0).*
