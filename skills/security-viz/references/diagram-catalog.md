# Security Visualization — 12-Diagram Catalog

> The enterprise security-visualization body-of-knowledge enumerates 12 diagram
> types. `security-viz` renders a diagram **only when its fact-source already
> exists** in the harness — it never collects new data and never parses code
> (that is `arch-viz`'s axis). This catalog is the single source of truth for
> which diagrams are **LIVE** (buildable today) vs **PLANNED** (blocked on a
> fact-source that another skill/SDK must emit first).
>
> Provenance: A5 audit Part 5. Status legend — **LIVE** = implemented in
> `scripts/security-viz.js` with a real reader; **PLANNED** = fact-source not
> yet produced by any skill/SDK (rendering it now would mean fabricating nodes,
> which is forbidden).

---

## Quick status table

| # | Diagram | Status | Subcommand | Fact-source | Produced by |
|---|---|---|---|---|---|
| 1 | AI Agent Risk Graph | **LIVE** | `agent-risk-graph` | `manifests/skills.manifest.json` + `agents/*.md` + AppSec `skills/*/SKILL.md` frontmatter | the harness registry itself (already exists) |
| 2 | Vulnerability Lifecycle Board | **LIVE** | `vuln-board <tag>` | `.appsec/findings/<tag>/*.yaml` | `appsec-finding-triager` agent + `appsec-sdk finding.add` |
| 3 | Security Evidence Dashboard | **LIVE** | `evidence-dashboard <tag>` | `.appsec/decisions/<tag>/appsec_release_decision.yaml` | `appsec-evidence-validator` agent + `appsec-sdk gate.check` |
| 4 | Pentest Scope Map | **LIVE** | `pentest-scope-map [<roe>]` | `.planning/PENTEST-ROE.md` (YAML frontmatter) | `pentest-scope-and-roe` skill + `pentest-scope-planner` agent |
| 5 | DFD / Trust-Boundary Diagram | PLANNED | _(future)_ | structured data-flow + trust-boundary inventory (machine-readable, not prose STRIDE) | `security-governance-threat-modeling` (must emit structured DFD fact-source) |
| 6 | Attack Surface Map | PLANNED | _(future)_ | structured attack-surface inventory (entry points × exposure × auth) | `appsec-risk-classifier` (must persist its surface inventory as a fact-source) |
| 7 | Auth / Authorization Matrix | PLANNED | _(future)_ | role × resource × permission matrix | _no producer yet_ — needs an authz-model fact-source |
| 8 | API Security Map | PLANNED | _(future)_ | structured endpoint inventory (method × path × authn × authz × rate-limit) | `security-app-api` (must emit endpoint inventory fact-source, not prose) |
| 9 | Data Classification Map | PLANNED | _(future)_ | data-store × classification (public / internal / confidential / restricted) | _no producer yet_ — needs a data-inventory fact-source |
| 10 | MITRE ATT&CK Coverage Matrix | PLANNED (producer exists) | _(future)_ | `attack-coverage.yaml` (technique × control_status × detection_status) | `security-response-red-purple-team` skill via `appsec-sdk attack.coverage <tag>` — **once stable, promote this row to LIVE** |
| 11 | Control Coverage Matrix | PLANNED | _(future)_ | control (CSF/ASVS) × status, full control list | `appsec_release_decision.yaml.csf2_coverage` is an embryo (6 CSF functions only); needs expansion to a full control inventory |
| 12 | Security Architecture Diagram | PLANNED | _(future)_ | security-component topology (WAF / IAM / secret-store / network boundary / data-store) | _no producer yet_ — needs a security-topology fact-source (distinct from `arch-viz`'s code graph) |

---

## LIVE diagrams — detail

### 1. AI Agent Risk Graph  `agent-risk-graph`

**What it shows.** Every agent × the AppSec-family & safety-critical skills ×
the tools/permissions they hold, with the harness's *control surface* flagged:
- 🔒 `disable-model-invocation: true` (manual hard gate — never auto-fires)
- ⚠ `manual_gate_required: true`
- ⛔ `forbidden-tools` (a tool the skill is explicitly denied)

**Fact-source (already exists, zero new collection).**
- `~/.claude/manifests/skills.manifest.json` — parsed with `JSON.parse`. Pulls
  the AppSec-family buckets (`appsec_governance`, `appsec_platform`,
  `appsec_app`, `appsec_app_overlay`, `appsec_response`, `appsec_compliance`,
  `appsec_governance_visible`, `appsec_manual_only`, `appsec_gsd_adapter`,
  `qa_supporting`), the `name_freeze` list, and the primary appsec orchestrator.
- `~/.claude/agents/*.md` frontmatter — `name`, `model`, `tools` (handles both
  `tools: ["A","B"]` and `tools: A, B`), `disable-model-invocation`.
- AppSec-family `~/.claude/skills/<name>/SKILL.md` frontmatter — `allowed-tools`,
  `forbidden-tools`, `disable-model-invocation`, `manual_gate_required`,
  `upstream`, `downstream`.

**Why highest value.** It is the first single picture of the whole harness's
permission + safety-gate topology, and it requires **no** new data — the
registry *is* the fact-source. It answers "which agents/skills can never
auto-fire?" and "which skills are denied which tools?" directly from declared
config.

**Render.** Mermaid `graph LR` (agents subgraph, skills subgraph, shared tool
nodes) + a safety-gate summary table. Manual-only = red, manual-gate = amber,
forbidden = purple.

---

### 2. Vulnerability Lifecycle Board  `vuln-board <tag>`

**What it shows.** A Kanban of findings across lifecycle lanes with SLA flags.

**Fact-source.** `<project>/.appsec/findings/<tag>/*.yaml` — finding schema
v1.0 (flat top-level keys). Fields read: `id`, `severity`, `computed_risk`,
`status`, `verification_status`, `sla_due`, `source`, `owner`.

**Lane mapping (canonical `status` enum → board lane).** The canonical finding
schema status enum is `open | in_progress | mitigated | resolved | accepted`.
security-viz maps it to a four-stage board (the conceptual `open → in_remediation
→ verified → closed` lifecycle):

| Schema `status` | Board lane |
|---|---|
| `open` | Open |
| `in_progress` | In Remediation |
| `mitigated` | Verified |
| `resolved` | Closed |
| `accepted` | Closed (risk-accepted) |

> Honesty note: security-viz renders the **canonical** schema values (it does not
> invent statuses the schema doesn't define). The board uses the canonical enum
> as ground truth and documents the lane mapping inline in every generated file.

**SLA flags.** Computed against the run date: 🔴 OVERDUE (past `sla_due`,
non-closed), 🟠 due ≤3d, 🟢 due >3d, ✅ closed, ⚠ unparseable `sla_due`.

**Render.** Mermaid `flowchart TB` (lanes as subgraphs, cards colored by
severity, breaches outlined) **plus** a markdown findings table (always present,
survives non-Mermaid viewers).

---

### 3. Security Evidence Dashboard  `evidence-dashboard <tag>`

**What it shows.** A traffic-light view of the release decision + CSF coverage +
findings summary + redaction attestation + a plain-language "what this means".

**Fact-source.** `<project>/.appsec/decisions/<tag>/appsec_release_decision.yaml`
(§16.9 schema). Fields read: `decision` (PASS / FAIL / BLOCKED /
CONDITIONAL_PASS), `asvs_level`, `asvs_version`, `decided_at`, `decided_by`,
`csf2_coverage.{GV,ID,PR,DE,RS,RC}.status` (PASS / PARTIAL / MISSING),
`redaction.{attested,method,proof_path}`, `findings_summary.{total,critical,
high,medium,low}`, `overlays_activated`, `pentest_status`.

**Render.** Headline decision light (🟢/🟡/🔴/⛔) + a field table + a CSF coverage
table & Mermaid (PASS green, PARTIAL amber, MISSING red) + findings summary +
a decoded "what this means" section that translates gate-blocking conditions
into consequences (e.g. "redaction not attested → a release gate will hold").

> Honesty note: `csf2_coverage` is an **internal evidence-completeness gate**,
> NOT a NIST CSF certification claim — the dashboard states this explicitly.

---

### 4. Pentest Scope Map  `pentest-scope-map [<roe-file>]`

**What it shows.** A scope-boundary diagram: in-scope vs out-of-scope assets,
environment, allowed vs disallowed (hard-limit) methods, time window.

**Fact-source.** `<project>/.planning/PENTEST-ROE.md` — the machine-readable
YAML **frontmatter** (the "parser surface" the ROE template defines, kept in
sync with the 11 prose sections). Fields read: `target_identification`,
`authorization_proof`, `environment`, `in_scope[]`, `out_of_scope[]`,
`allowed_methods[]`, `disallowed_methods[]`, `time_window` /
`time_window_start` / `time_window_end`, `rate_limits`, `authorization_signoff`.

**Render.** Mermaid `flowchart TB` — a context node (target / env / window) →
✅ IN-SCOPE subgraph and a `-. forbidden .->` edge to the ⛔ OUT-OF-SCOPE
subgraph, plus allowed/disallowed method subgraphs + method bullet lists.

> Honesty note: if any required field is missing or still holds a `REPLACE_…`
> placeholder, the map is stamped **"ROE NOT READY"** with the unfilled fields
> listed — and the output states it is **not an authorization**. Active
> validation runs only via `authorized-pentest-validation` (manual hard gate)
> after full sign-off; a diagram never gates access.

---

## PLANNED diagrams — what unblocks each

The 8 PLANNED diagrams are blocked purely on **fact-source availability**. None
require new capability in security-viz beyond a reader + subcommand once the
upstream fact-source exists.

- **#5 DFD / Trust-Boundary** — needs `security-governance-threat-modeling` to
  emit a *structured* data-flow + trust-boundary document (today its STRIDE
  output is prose-oriented). When a machine-readable DFD fact-source lands,
  add a reader → LIVE.
- **#6 Attack Surface Map** — needs `appsec-risk-classifier` to persist its
  attack-surface inventory (entry points × exposure × auth) as a structured
  fact-source under `.appsec/`.
- **#7 Auth / Authorization Matrix** — needs an authz-model fact-source
  (role × resource × permission). No producer today.
- **#8 API Security Map** — needs `security-app-api` to emit a structured
  endpoint inventory (method × path × authn × authz × rate-limit), not prose.
- **#9 Data Classification Map** — needs a data-inventory fact-source
  (data-store × classification). The finding schema's
  `affected.data_classes` is a hint but not a store-level inventory.
- **#10 MITRE ATT&CK Coverage Matrix** — **producer already exists**:
  `security-response-red-purple-team` emits `attack-coverage.yaml` via
  `appsec-sdk attack.coverage <tag>`. This is the closest PLANNED diagram to
  LIVE — once that fact-source shape stabilizes, add an `attack-coverage`
  subcommand + reader and promote row #10.
- **#11 Control Coverage Matrix** — `appsec_release_decision.yaml.csf2_coverage`
  is an embryonic version (6 CSF functions). A full control coverage matrix
  needs an expanded control inventory (ASVS chapter × requirement × status).
- **#12 Security Architecture Diagram** — needs a security-component topology
  fact-source (WAF / IAM / secret-store / network boundary / data-store).
  Distinct from `arch-viz`'s code graph — this is the *security control*
  topology, which no skill produces today.

---

## Maintenance rule

When a PLANNED diagram's fact-source becomes available from a skill/SDK:
1. Add a reader + subcommand in `scripts/security-viz.js`.
2. Flip the row in the quick-status table above from PLANNED → LIVE.
3. Update `SKILL.md` §3 (LIVE table) and §4 (roadmap).
4. Never render a diagram whose fact-source is absent — report the gap honestly.
