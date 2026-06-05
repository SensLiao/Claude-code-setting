# Standards Crosswalk

A machine-readable cross-mapping index linking AppSec / QA / UX standards, so any
finding can be traced across taxonomies (e.g. an authorization finding ties
`ASVS V8` <-> `OWASP Top 10:2025 A01` <-> `CWE-284` <-> `CSF PR` <->
`ISO/IEC 25010 Security`). This replaces the previous prose-only mapping.

`crosswalk_version`: **1.0.0** · all entries `verified_on`: **2026-06-05**

## Files

| File | Purpose |
| --- | --- |
| `standards-crosswalk.json` | The data artifact: a `standards` object + a `crosswalk` array of cross-mappings. |
| `crosswalk.schema.json` | JSON Schema (draft-07 subset) describing the data file. |
| `validate-crosswalk.js` | Dependency-free Node validator. Exit `0` ok / `2` fail. |
| `README.md` | This file. |

## Structure

### Top level

```jsonc
{
  "crosswalk_version": "1.0.0",   // semver, pinned
  "generated_for": "harness",
  "do_not_auto_refresh": true,    // MUST be true — see governance
  "governance": { ... },
  "standards": { ... },
  "crosswalk": [ ... ]
}
```

### `standards` (object, keyed by standard id)

Each standard:

```jsonc
{
  "id": "owasp_top10_2025",
  "name": "OWASP Top 10",
  "version": "2025",
  "source": "https://owasp.org/Top10/",   // required, non-empty URL
  "verified_on": "2026-06-05",             // required, YYYY-MM-DD
  "items": [ { "id": "A01", "title": "Broken Access Control" }, ... ]
}
```

Standards indexed (9): OWASP Top 10:2025, OWASP ASVS 5.0, OWASP LLM Top 10 (2025),
OWASP Agentic Top 10 (ASI, 2025-12-09), NIST CSF 2.0, NIST SSDF (SP 800-218),
ISO/IEC 25010:2023 (nine product-quality characteristics), WCAG 2.2, Core Web Vitals.

> Only **IDs and short official titles** are stored — no copyrighted standard
> body text / prose paragraphs. The value here is the *mappings*, not the
> reproduced standard.

### `crosswalk` (array of cross-mappings)

Each mapping:

```jsonc
{
  "id": "CW-001-access-control",
  "links": {                        // at least one key; only known taxonomy keys allowed
    "asvs": "V8",
    "owasp_top10_2025": "A01",
    "owasp_asi": "ASI03",
    "cwe_family": "CWE-284",
    "csf": "PR",
    "ssdf": "PW",
    "iso25010": "Security"
    // also allowed: owasp_llm, wcag
  },
  "confidence": "high",             // high | medium | low
  "note": "why these line up",
  "source": "https://owasp.org/Top10/A01_2025-Broken_Access_Control/",
  "verified_on": "2026-06-05"
}
```

`confidence` is honest signal, not decoration:

- **high** — direct, well-established 1:1 (or near-1:1) correspondence.
- **medium** — the closest anchor, but the source concept spans multiple targets
  (e.g. API security `V4` -> `A01` is the *dominant* but not *only* API risk).
- **low** — speculative. **Low-confidence mappings are NOT shipped in v1.0.0.**
  Candidates that did not clear the bar are recorded in the build summary instead,
  so they are visible without polluting the index.

## Validation

```bash
node validate-crosswalk.js standards-crosswalk.json
# OK: ... conforms to schema and all source/verified_on present.
#     crosswalk_version=1.0.0  standards=9  taxonomy_items=73  mappings=27
```

The validator does two independent things:

1. Validates the data against `crosswalk.schema.json` (type / required / enum /
   const / pattern / minItems / minProperties / additionalProperties / `$ref`).
2. **Independently** asserts every standard AND every mapping has a non-empty
   `source` and `verified_on` — this holds even if the schema is later loosened.

Exit code `0` = valid, `2` = validation failure (with a list of errors), `1` =
IO/usage error. It has no third-party dependencies; plain Node only.

## Governance — DO NOT AUTO-REFRESH WITHOUT HUMAN REVIEW

This artifact is **human-curated and live-verified**. `do_not_auto_refresh` is
`true` by contract.

- **No model may auto-regenerate, auto-refresh, or silently rewrite the mappings
  or taxonomy IDs.** Any change requires explicit human review.
- Taxonomy ordering is **pinned** and must not be "corrected" from a model's
  training memory. In particular, for **OWASP Top 10:2025**:
  - `A03` = **Software Supply Chain Failures** (new in 2025) — **NOT** Injection.
  - `A05` = **Injection** (it was `A03` in the obsolete 2021 list).
  - `A10` = **Mishandling of Exceptional Conditions** (new in 2025).
  Writing `A03 = Injection` is the stale-2021 taxonomy and is a defect.
- Other pinned facts: ASVS 5.0 chapters are `V1`–`V17` with the 5.0 titles;
  ISO/IEC 25010:**2023** has **nine** characteristics (adds *Safety*, renames
  *Usability* -> *Interaction Capability* and *Portability* -> *Flexibility*);
  Core Web Vitals use **INP** (which replaced FID on 2024-03-12), not FID.
- When a standard genuinely revises (e.g. a future OWASP Top 10), bump
  `crosswalk_version`, re-verify each `source`, set a new `verified_on`, and have
  a human review the diff. Do not edit in place without versioning.

## Provenance / future home

This is built in a sandbox as a **seed** for a future canonical reference at:

```
~/.claude/skills/appsec-security-orchestrator/references/standards-crosswalk.json
```

When promoted, the downstream `appsec-security-orchestrator` (and its
standardized finding schema) can resolve any finding's primary taxonomy ID into
its cross-mapped peers via this index. Promotion is a deliberate, human-reviewed
step — not an automatic copy.
