# Evidence Ledger Rules

Rules for `i2r-evidence-researcher` when producing `02b-evidence.json`.

---

## Evidence card shape

Every entry in `evidence[]` must conform to this structure (all required unless noted):

```json
{
  "id": "EV-001",
  "claim": "The payment provider mandates TLS 1.2+ on all API calls.",
  "source_type": "official_doc",
  "source_ref": "https://docs.stripe.com/security#tls",
  "confidence": "high",
  "used_for": ["constraint", "nfr"],
  "not_allowed_for": ["scope — cannot add capabilities"]
}
```

### Field rules

**`id`** — Sequential `EV-NNN` (three-digit zero-padded). Never reuse within a run.

**`claim`** — One declarative sentence. State the fact, not an opinion.
Forbidden phrases: "it seems", "probably", "might be", "best practice to".

**`source_type`** — Must be one of:

| Value | Meaning |
|-------|---------|
| `official_doc` | Vendor documentation, RFC, ISO/IEC standard, regulatory text |
| `repo` | Source code, commit history, CI config in a public repository |
| `local_doc` | File inside `raw/` or a project-committed document |
| `user_material` | Anything the user provided directly (briefs, transcripts, emails) |
| `article` | Blog post, white paper, conference paper — always `confidence: low` unless corroborated |

**`source_ref`** — A URI or `raw/<filename>#L<line>` pointer. Must be verifiable.
Never invent a URL. If the source is from memory or model training, do not include
it — record a `GAP` instead.

**`confidence`** — One of:

| Value | When to assign |
|-------|----------------|
| `high` | `official_doc` or `user_material`; claim directly stated, not inferred |
| `medium` | `repo` or corroborated `article`; claim inferred from evidence but reasonable |
| `low` | Single `article`, uncorroborated, or paraphrased |

**`used_for`** — Array of one or more allowed values:
`context` · `constraint` · `nfr` · `terminology` · `pattern`

A card may be `used_for` multiple purposes. The array must never be empty.

**`not_allowed_for`** — Optional but recommended. Explicitly state what the card
may not be used to justify. Common entry: `"scope — cannot add capabilities"`.

---

## Gap records

Unanswered research questions become `GAP-NNN` records in `gaps[]`:

```json
{
  "id": "GAP-001",
  "question": "What is the rate limit on the upstream order API?",
  "impact": "blocking"
}
```

**`impact: "blocking"`** — downstream NFR or acceptance criterion cannot be written
without this answer. The `i2r-mode-gate` hook will prevent the NFR stage from
running until the gap is resolved or explicitly marked non-blocking by the human.

**`impact: "non_blocking"`** — downstream work can proceed with an assumption; the
assumption must be surfaced in `01-intake.json` as `source: assumed`.

---

## When to search vs when not to

Search is **conditional** — the L0 router decides. Do not invoke search logic
unless `search_mode != "not_required"`.

Search is warranted when at least one of:
- A regulatory or platform constraint is mentioned but not quantified
- A terminology is ambiguous and has a published canonical definition
- A comparable integration pattern exists in a widely-used open standard
- An NFR threshold (latency, availability, compliance level) cannot be sourced from `raw/`

Search is NOT warranted for:
- Product decisions (what to build, who to serve) — only the user decides
- Architecture choices (database, framework, deployment) — that is HOW, outside I2R
- Business model or pricing — outside I2R boundary
- Filling in missing user intent — surface a GAP and ask

---

## Citation gate compliance

What the `i2r-citation-gate` hook (SubagentStop / Stop) actually enforces: when `02b-evidence.json`
exists, it must be well-formed and **every evidence card must carry a verifiable `source_ref`** (the hook
runs `i2r.py evidence.validate`). If `02b-evidence.json` does not exist (search was `not_required`), the
hook is a no-op.

Linking a downstream requirement that relies on a search finding back to its `EV-NNN` (a requirement-level
`evidence_ref`) is **author discipline**, not gate-enforced — the gate does not check requirement-level
`evidence_ref`. Authors should still cite the `EV-NNN` so the trace survives review, but no hook blocks on
its absence.
