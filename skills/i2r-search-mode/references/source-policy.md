# Source Policy

Governs how `i2r-evidence-researcher` selects, ranks, and trusts sources.

---

## Core principle

> Search **informs**, never decides scope.

A piece of evidence can raise the confidence of a constraint or NFR already implied
by user intent. It cannot introduce a new capability, override a user decision, or
substitute for a missing clarification.

---

## Source type ranking (preference order)

1. **`user_material`** — anything the user provided directly (always `confidence: high`)
2. **`official_doc`** — vendor docs, RFCs, ISO/IEC/NIST standards, regulatory text
3. **`local_doc`** — committed project documents, ADRs, existing specs in `00-raw/`
4. **`repo`** — public source code or CI configs demonstrating a pattern
5. **`article`** — blog posts, white papers, conference proceedings (lowest trust)

When two sources conflict, prefer the higher-ranked source. If `user_material`
conflicts with an `official_doc`, always surface the conflict as a GAP and ask the
user — never silently prefer the official doc over stated user intent.

---

## Confidence assignment rules

| Source type | Default confidence | Can be upgraded? |
|-------------|-------------------|------------------|
| `user_material` | `high` | N/A — always high |
| `official_doc` | `high` | — |
| `local_doc` | `high` (if from `00-raw/`) / `medium` (if project doc) | — |
| `repo` | `medium` | to `high` if the claim is directly in code (not inferred) |
| `article` | `low` | to `medium` if corroborated by a second independent article |

A single `low`-confidence card cannot promote an `assumed` requirement to `stated`.
It records the evidence for audit purposes only.

---

## What search may produce vs what it may not

| Allowed output | Forbidden output |
|----------------|-----------------|
| Canonical term for a domain concept | A new product feature or capability |
| Published performance threshold (e.g. PCI DSS p95 SLA) | A business model decision |
| Regulatory requirement not mentioned by user but applicable | An architecture choice (database, framework) |
| A comparable integration pattern from a public reference | A statement that overrides the user's stated intent |
| A compliance level for a standard already referenced | Any scope addition |

---

## Fabrication prohibition

**Never fabricate a source.**

If the researcher cannot locate a real, verifiable source for a claim:
- Do not invent a URL.
- Do not paraphrase training-data knowledge as if it were a located document.
- Record a `GAP-NNN` with `impact` set appropriately.
- In `run-log.md` note: "RQ-NNN: no verifiable source found; recorded as GAP-NNN."

The `i2r-citation-gate` hook will reject any `source_ref` that points to a
non-existent URL or a file not present in the run folder.

---

## Search scope by mode

| `search_mode` | What may be searched |
|---------------|----------------------|
| `local` | Only `runs/i2r/<slug>/<ts>/00-raw/` and committed project docs |
| `web` | External URLs, official vendor docs, RFCs, regulatory portals |
| `mixed` | Local first; web only for questions that local docs cannot answer |
| `unavailable` | No search; all open questions become GAPs |

In `local` mode, do not make external network calls. In `web` or `mixed` mode,
prefer `official_doc` sources; treat `article` sources with skepticism and always
record confidence as `low` unless corroborated.
