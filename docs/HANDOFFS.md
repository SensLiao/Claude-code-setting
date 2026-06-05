# Cross-Subsystem Handoff Schemas

> Authority: CANONICALS.md (2026-05-25)
> Cross-references: [ORCHESTRATOR-MAP.md](ORCHESTRATOR-MAP.md) §4 | [L12-DISCOVERABILITY.md](L12-DISCOVERABILITY.md) §7 | `schemas/handoff.schema.yaml`
> Last reviewed: 2026-05-25

This document defines the payload structure for every cross-subsystem handoff. All handoffs are validated against `schemas/handoff.schema.yaml` (created by Agent A3 in PR-0). Producers must emit a payload that conforms; consumers must accept any conformant payload.

---

## Handoff catalog

| ID | From | To | Trigger |
|---|---|---|---|
| `gsd_to_uiux` | gsd-pipeline-orchestrator | uiux-product-orchestrator | Phase SPEC says WHAT = UI |
| `gsd_to_qa` | gsd-pipeline-orchestrator | enterprise-qa-testing | Phase reaches verify / ship |
| `gsd_to_appsec` | gsd-pipeline-orchestrator | appsec-security-orchestrator | Phase touches backend / API / auth / user-data / file-upload / payment / admin |
| `uiux_to_l12` | uiux-product-orchestrator | discoverability-orchestrator | UIUX phase ships public surface |
| `l12_to_appsec_escalation` | discoverability-orchestrator | appsec-security-orchestrator | L12 detects private content leaked to crawler |
| `qa_to_appsec` | enterprise-qa-testing | appsec-security-orchestrator | Security-relevant test failure |

All payloads MUST include the common header (see §0) and then handoff-specific fields.

---

## 0. Common header (all handoffs)

Every payload starts with:

```yaml
handoff_id: <ID from catalog above>        # e.g. "gsd_to_uiux"
schema_version: "1.0"                       # bumped on breaking change
emitted_at: "2026-05-25T03:00:00Z"          # ISO 8601 UTC second precision
emitted_by: <orchestrator>                  # e.g. "gsd-pipeline-orchestrator"
correlation_id: <string>                    # opaque; passed through to allow tracing
phase_ref: <string>                         # e.g. "v0.3/03-auth-system" (relative to .planning/)
release_tag: <string>                       # e.g. "v0.3.1" or "preview-abc1234"
```

Schema reference: `schemas/handoff.schema.yaml#/common_header`

---

## 1. `gsd_to_uiux`

### Trigger condition

A GSD phase's SPEC.md (via `gsd-spec-phase`) declares one of:
- WHAT contains UI surface (`ui_surface: true`)
- Phase classified as UI / frontend / design phase

### Payload fields

```yaml
# Common header (§0)
handoff_id: gsd_to_uiux
schema_version: "1.0"
# ... rest of header

# Handoff-specific
phase_kind: <"ui_only" | "ui_with_backend" | "design_only" | "frontend_refactor">
target_platform: <"web" | "ios" | "android" | "desktop" | "cross_platform">
viewports: <array of ints>                 # e.g. [320, 768, 1024, 1440]
themes: <array of strings>                 # e.g. ["light", "dark"]
constraints:
  brand_kit_ref: <path or null>             # e.g. ".planning/brand/kit.md" or null
  style_lock: <L3 style skill name or null> # e.g. "luxury" or null (one of: taste / luxury / brutalist; taste includes §11 variant modes A/B/C)
  accessibility_target: <"WCAG_2_2_AA" | "WCAG_2_2_A" | null>
  motion_preference: <"reduced" | "full" | "respect_user">
references:
  competitor_refs: <array of URLs>
  inspiration_refs: <array of URLs>
  internal_docs: <array of relative paths>
ui_spec_required: <bool>                    # if true, UIUX must produce UI-SPEC.md before plan-phase
```

### Schema reference

`schemas/handoff.schema.yaml#/gsd_to_uiux`

### Example

```yaml
handoff_id: gsd_to_uiux
schema_version: "1.0"
emitted_at: "2026-05-25T03:00:00Z"
emitted_by: gsd-pipeline-orchestrator
correlation_id: 7e9c4f2b-1234-5678
phase_ref: "v0.3/04-pricing-page"
release_tag: preview-pricing-v3

phase_kind: ui_only
target_platform: web
viewports: [320, 768, 1024, 1440]
themes: ["light", "dark"]
constraints:
  brand_kit_ref: ".planning/brand/kit.md"
  style_lock: luxury
  accessibility_target: WCAG_2_2_AA
  motion_preference: respect_user
references:
  competitor_refs:
    - "https://linear.app/pricing"
    - "https://vercel.com/pricing"
  inspiration_refs: []
  internal_docs:
    - ".planning/v0.2/03-design-system/PLAN.md"
ui_spec_required: true
```

---

## 2. `gsd_to_qa`

### Trigger condition

A GSD phase reaches the verify / ship stage (`gsd-verify-work` or `gsd-ship` invocation), and the project has any non-trivial implementation surface.

### Payload fields

```yaml
# Common header (§0)
handoff_id: gsd_to_qa

# Handoff-specific
qa_kind: <"phase_verify" | "release_readiness" | "ci_gate" | "post_incident_regression">
risk_profile:
  has_auth: <bool>
  has_payments: <bool>
  has_pii: <bool>
  has_external_api: <bool>
  has_ui: <bool>
  has_concurrency: <bool>
test_layers_required: <array of layer names>
  # Subset of: ["static", "unit", "component", "integration", "contract", "e2e", "visual", "a11y", "perf", "smoke"]
coverage_target: <number 0.0-1.0>           # e.g. 0.80 (matches common/testing.md)
evidence_bundle_required: <bool>
ci_gate_required: <bool>
existing_evidence_refs: <array of paths>     # e.g. [".qa/v0.3/04-pricing/coverage.json"]
```

### Schema reference

`schemas/handoff.schema.yaml#/gsd_to_qa`

### Example

```yaml
handoff_id: gsd_to_qa
schema_version: "1.0"
emitted_at: "2026-05-25T03:05:00Z"
emitted_by: gsd-pipeline-orchestrator
correlation_id: 7e9c4f2b-1234-5678
phase_ref: "v0.3/04-pricing-page"
release_tag: v0.3.1

qa_kind: phase_verify
risk_profile:
  has_auth: false
  has_payments: true
  has_pii: false
  has_external_api: true
  has_ui: true
  has_concurrency: false
test_layers_required: ["static", "unit", "component", "integration", "e2e", "visual", "a11y"]
coverage_target: 0.80
evidence_bundle_required: true
ci_gate_required: true
existing_evidence_refs: []
```

---

## 3. `gsd_to_appsec`

### Trigger condition

A GSD phase touches any of: backend code, API surface, authentication flow, authorization rules, user data persistence, file upload, payment processing, admin interface, production deployment, secrets, IaC, threat model surface.

See `manifests/skill-routing-policy.json#/appsec_defensive` for the full trigger word list.

### Payload fields

```yaml
# Common header (§0)
handoff_id: gsd_to_appsec

# Handoff-specific
csf_function_focus: <array>
  # Subset of: ["govern", "identify", "protect", "detect", "respond", "recover"]
capability_layers_activated: <array>
  # Subset of: ["governance", "app", "platform", "operations", "response", "compliance"]
trigger_signals: <array of strings>          # e.g. ["api_endpoint_added", "auth_logic_changed", "user_data_table_new"]
sensitive_surface:
  has_auth_change: <bool>
  has_user_data: <bool>
  has_payment: <bool>
  has_file_upload: <bool>
  has_admin_interface: <bool>
  has_production_deploy: <bool>
  has_external_integration: <bool>
asvs_5_chapters_in_scope: <array of strings>
  # ASVS 5.0 chapter identifiers like "v5.0.0-1" through "v5.0.0-17"
compliance_targets: <array>
  # e.g. ["pci_dss_4", "gdpr", "china_pipl", "hipaa", null]
pentest_required: <bool>                     # if true, route via dual gate (pentest-scope-and-roe → authorized-pentest-validation)
existing_evidence_refs: <array of paths>     # e.g. [".appsec/evidence/v0.3.1/threat-model.json"]
```

### Schema reference

`schemas/handoff.schema.yaml#/gsd_to_appsec`

### Example

```yaml
handoff_id: gsd_to_appsec
schema_version: "1.0"
emitted_at: "2026-05-25T03:10:00Z"
emitted_by: gsd-pipeline-orchestrator
correlation_id: 7e9c4f2b-1234-5678
phase_ref: "v0.3/05-payment-flow"
release_tag: v0.3.2

csf_function_focus: ["identify", "protect", "detect"]
capability_layers_activated: ["governance", "app", "compliance"]
trigger_signals: ["payment_integration_added", "stripe_api_used", "checkout_endpoint_new"]
sensitive_surface:
  has_auth_change: false
  has_user_data: true
  has_payment: true
  has_file_upload: false
  has_admin_interface: false
  has_production_deploy: false
  has_external_integration: true
asvs_5_chapters_in_scope: ["v5.0.0-1", "v5.0.0-3", "v5.0.0-8", "v5.0.0-13"]
compliance_targets: ["pci_dss_4"]
pentest_required: false
existing_evidence_refs: []
```

---

## 4. `uiux_to_l12`

### Trigger condition

A UIUX phase ships public surface (web page / docs site / store listing / marketing site / blog).

### Payload fields

```yaml
# Common header (§0)
handoff_id: uiux_to_l12

# Handoff-specific
surface_type: <"web" | "docs" | "app_store_listing" | "marketing_site" | "blog" | "mixed">
project_type: <string>                       # matches discoverability-orchestrator/project-types.yaml entries
urls:
  - canonical: <URL>                         # primary canonical URL
    locales: <array of locale strings>       # e.g. ["en-US", "zh-CN"]
has_physical_presence: <bool>                # gates web-local-seo activation
target_search_engines: <array>
  # Subset of: ["google", "bing", "yandex", "baidu", "naver", "duckduckgo"]
target_ai_engines: <array>
  # Subset of: ["chatgpt_search", "claude_search", "perplexity", "gemini", "you"]
app_store_targets: <array>
  # Subset of: ["ios_app_store", "google_play", "huawei", "apple_arcade"]
release_kind: <"first_launch" | "feature_release" | "rebrand" | "url_structure_change" | "metadata_only">
freshness_window_hours: <int>                # how long evidence remains FRESH; default 24 (override via harness.evidence_freshness_hours)
existing_evidence_refs: <array of paths>     # e.g. ["evidence/discoverability/v0.3.0/seo.json"]
```

### Schema reference

`schemas/handoff.schema.yaml#/uiux_to_l12`

### Example

```yaml
handoff_id: uiux_to_l12
schema_version: "1.0"
emitted_at: "2026-05-25T03:15:00Z"
emitted_by: uiux-product-orchestrator
correlation_id: 7e9c4f2b-1234-5678
phase_ref: "v0.3/04-pricing-page"
release_tag: v0.3.1

surface_type: web
project_type: saas_landing
urls:
  - canonical: "https://example.com/pricing"
    locales: ["en-US", "zh-CN"]
has_physical_presence: false
target_search_engines: ["google", "bing"]
target_ai_engines: ["chatgpt_search", "claude_search", "perplexity"]
app_store_targets: []
release_kind: feature_release
freshness_window_hours: 24
existing_evidence_refs: []
```

---

## 5. `l12_to_appsec_escalation`

### Trigger condition

L12 detects **private content leaked to a crawler** — e.g., authenticated route exposed via robots.txt, draft page in sitemap, internal URL in llms.txt, internal path hinted by robots.txt rule.

**Critical boundary**: this is NOT a robots.txt / noindex / llms.txt fix request. Those crawler-policy files are not access control. The leak is a **symptom of an access control failure** that AppSec must fix at the source.

### Payload fields

```yaml
# Common header (§0)
handoff_id: l12_to_appsec_escalation

# Handoff-specific
leak_type: <enum>
  # One of:
  #   - "noindex_misconfig_with_authenticated_route"
  #   - "sitemap_exposed_draft"
  #   - "sitemap_exposed_authenticated_route"
  #   - "llms_txt_exposes_private_url"
  #   - "robots_txt_hints_internal_path"
  #   - "structured_data_leaks_pii"
  #   - "metadata_leaks_internal_identifier"
affected_urls: <array of URL>
discovered_by: <"web-seo" | "web-aeo" | "web-local-seo" | "app-aso">
evidence_ref: <string>                        # JSON pointer into the narrow-skill evidence
                                              # e.g. "evidence/discoverability/v0.3.1/seo.json#/findings/4"
severity: <"blocker" | "warn">
recommended_appsec_capability: <array>
  # Suggested AppSec child skill routing, e.g.:
  #   - "security-app-multitenant" (tenant isolation issue)
  #   - "security-platform-iac-cloud" (cloud config issue)
  #   - "security-platform-secrets" (secret leaked in metadata)
  #   - "security-app-file-upload" (upload exposed)
context_summary: <string>                     # short human-readable description
risk_acceptance_if_present: <string or null>  # if non-null, blocker → CONDITIONAL_PASS
```

### Schema reference

`schemas/handoff.schema.yaml#/l12_to_appsec_escalation`

### Example

```yaml
handoff_id: l12_to_appsec_escalation
schema_version: "1.0"
emitted_at: "2026-05-25T03:20:00Z"
emitted_by: discoverability-orchestrator
correlation_id: 7e9c4f2b-1234-5678
phase_ref: "v0.3/04-pricing-page"
release_tag: v0.3.1

leak_type: sitemap_exposed_authenticated_route
affected_urls:
  - "https://example.com/admin/billing-reports"
  - "https://example.com/account/secret-promo"
discovered_by: web-seo
evidence_ref: "evidence/discoverability/v0.3.1/seo.json#/findings/3"
severity: blocker
recommended_appsec_capability:
  - "security-app-multitenant"
context_summary: "Sitemap.xml includes authenticated admin and account routes; sitemap generator is not filtering by route auth metadata."
risk_acceptance_if_present: null
```

---

## 6. `qa_to_appsec`

### Trigger condition

A QA test failure is security-relevant — e.g., E2E test detects an auth bypass, contract test detects unauthenticated access, integration test detects SQL/XSS payload reaching backend, performance test detects rate-limit bypass.

### Payload fields

```yaml
# Common header (§0)
handoff_id: qa_to_appsec

# Handoff-specific
failure_kind: <enum>
  # One of:
  #   - "auth_bypass_detected"
  #   - "authorization_failure"
  #   - "injection_payload_reached_backend"
  #   - "xss_payload_rendered"
  #   - "csrf_protection_missing"
  #   - "rate_limit_bypassed"
  #   - "sensitive_data_in_error_response"
  #   - "missing_security_headers"
  #   - "tls_misconfiguration"
  #   - "session_fixation"
  #   - "other_security_relevant"
test_layer: <"e2e" | "integration" | "contract" | "component" | "static" | "smoke">
test_id: <string>                             # stable test identifier
evidence_ref: <string>                        # JSON pointer into QA evidence
                                              # e.g. ".qa/v0.3/04-pricing/e2e-report.json#/failures/2"
severity: <"critical" | "high" | "medium" | "low">
asvs_5_chapter_affected: <string or null>     # e.g. "v5.0.0-3" (Session) or null if not mapped
suggested_appsec_capability: <array>
  # Subset of: appsec child skill names like "security-remediation", "security-app-multitenant", etc.
reproduction_steps: <string>                  # short text or markdown
context_summary: <string>
should_block_release: <bool>                  # if true, QA gate FAIL until AppSec acknowledges
```

### Schema reference

`schemas/handoff.schema.yaml#/qa_to_appsec`

### Example

```yaml
handoff_id: qa_to_appsec
schema_version: "1.0"
emitted_at: "2026-05-25T03:25:00Z"
emitted_by: enterprise-qa-testing
correlation_id: 7e9c4f2b-1234-5678
phase_ref: "v0.3/05-payment-flow"
release_tag: v0.3.2

failure_kind: authorization_failure
test_layer: e2e
test_id: e2e.payment.access_other_user_invoice
evidence_ref: ".qa/v0.3/05-payment/e2e-report.json#/failures/2"
severity: critical
asvs_5_chapter_affected: "v5.0.0-4"
suggested_appsec_capability:
  - "security-app-multitenant"
  - "security-remediation"
reproduction_steps: |
  1. Login as user-a
  2. Note invoice ID 12345
  3. Login as user-b
  4. Navigate to /invoices/12345 → returns user-a's invoice (BUG)
context_summary: "IDOR: invoice route does not check ownership; user-b can read user-a's invoice."
should_block_release: true
```

---

## Schema validation

All payloads are validated against `schemas/handoff.schema.yaml` (created by Agent A3). The schema:

- Enforces common header presence + correct type
- Enforces handoff-specific field types
- Enforces enum membership where declared
- Permits additional optional fields (forward-compat) but flags unknown required-shaped fields

Test fixtures (under `tests/handoff-roundtrip/`) round-trip-validate every example in this document.

---

## Versioning

- Schema bumps follow semver-style. `schema_version: "1.0"` is the current baseline.
- Adding optional fields = non-breaking, no version bump.
- Adding required fields or removing fields = breaking, bump major.
- Renaming a field = breaking, bump major.

Consumers should accept future minor schema versions (`1.x`) but warn on major mismatch (`2.x` etc).

---

## Cross-references

| Doc / file | Purpose |
|---|---|
| [docs/ORCHESTRATOR-MAP.md](ORCHESTRATOR-MAP.md) | §4 handoff matrix summary |
| [docs/L12-DISCOVERABILITY.md](L12-DISCOVERABILITY.md) | §7 L12-specific handoffs detail |
| [docs/CANONICALS.md](CANONICALS.md) | §3 gate decision vocabulary used in payloads |
| `schemas/handoff.schema.yaml` | Machine-readable schema (Agent A3 deliverable) |
| `tests/handoff-roundtrip/` | Round-trip validation tests (Wave 3 deliverable) |
| [manifests/skill-routing-policy.json](../manifests/skill-routing-policy.json) | Source of trigger signals for `gsd_to_*` handoffs |
