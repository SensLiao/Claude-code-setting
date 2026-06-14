# MITRE ATT&CK — Curated Web / API / Cloud SaaS Technique Reference

> **Source: MITRE ATT&CK Enterprise — https://attack.mitre.org** (and MITRE ATLAS
> for AI — https://atlas.mitre.org). This is a *curated subset* of the techniques
> most relevant to a web / API / cloud SaaS attack surface, so the
> `security-response-red-purple-team` skill (and a human) can fill the coverage
> matrix **without an external lookup**.
>
> **Defensive use only.** This file is a *coverage rubric* — the "typical control"
> and "typical detection signal" columns tell you **what would count as covered**
> for each technique. It is **not** an attack how-to. The skill that uses this
> NEVER runs any of these techniques; active validation stays behind the manual
> `authorized-pentest-validation` gate.
>
> **Verification status (2026-06-14):** technique ids/names/tactics below were
> verified against attack.mitre.org where reachable (T1190, T1505.003, T1110,
> T1059, T1098, T1548, T1087, T1530, T1485 confirmed current; remainder are
> long-standing ATT&CK techniques). **Always re-verify ids against
> attack.mitre.org** before publishing a coverage report — ATT&CK is versioned and
> evolves.

---

## How to read this file

Each row gives you, per technique:

- **What it is** — one-line plain-language description (so you know if it's relevant).
- **Typical control** (prevent / reduce) → this is what `control_status: covered`
  requires *evidence of*.
- **Typical detection signal** (see it happen) → this is what `detection_status: covered`
  requires *evidence of*. Detection almost always rests on logging (OWASP ASVS 5.0
  V16 Security Logging) being present and tamper-resistant.
- **Where evidence usually lives** in this harness (the `evidence_ref` you'd cite).

`control_status` / `detection_status` ∈ `none | partial | covered`. **No
`evidence_ref` → status must be `none`.** "We probably do that" is `none`.

---

## Initial Access (TA0001) — how an adversary gets in

### T1190 — Exploit Public-Facing Application
- **What it is:** Exploiting a bug/misconfig in an Internet-facing app, API, or
  device (e.g. injection, deserialization, unauth RCE, known CVE in the web stack).
- **Typical control:** Input validation + parameterized queries; dependency patching
  to SLA; WAF rule for the exposed surface; injection/deserialization SAST findings
  closed; security headers.
- **Typical detection signal:** WAF/app alerts on exploit attempts; spikes in 4xx/5xx
  or anomalous request patterns; IDS rules for known exploit strings.
- **Evidence usually in:** `.appsec/findings/<tag>/*-sast-*.yaml`, `code-review/`,
  `headers-cookies/`, `sca/` (for the CVE side).

### T1078 — Valid Accounts
- **What it is:** Using legitimate (stolen/leaked/default) credentials to log in —
  no exploit needed.
- **Typical control:** MFA enforced; least privilege; disable default/orphan/shared
  accounts; credential rotation; leaked-credential checks.
- **Typical detection signal:** Impossible-travel, new-geo, off-hours, or new-device
  login alerts; use of dormant accounts; concurrent-session anomalies.
- **Evidence usually in:** `authz-matrix/`, `code-review/` (session/auth),
  `secret-scan/` (leaked creds), monitoring/IdP logs.

### T1566 — Phishing
- **What it is:** Tricking a human into giving up creds or running attacker content
  (email/link/attachment).
- **Typical control:** Email auth (SPF/DKIM/DMARC); user training; MFA to blunt
  stolen creds; link/attachment sandboxing at the mail gateway.
- **Typical detection signal:** Mail-gateway detonation verdicts; reported-phish
  workflow; click-through to known-bad domains.
- **Evidence usually in:** mail-security config, awareness-training records
  (organizational, often outside the repo — cite the program/runbook).

---

## Execution (TA0002) — running adversary code

### T1059 — Command and Scripting Interpreter
- **What it is:** Abusing shells/interpreters (bash, PowerShell, Python, JS) to run
  commands — frequently the payload of an injection.
- **Typical control:** Never shell out on untrusted input; argument allowlists; avoid
  `eval`/dynamic exec; command-injection findings closed.
- **Typical detection signal:** Unexpected child-process / interpreter spawn on app
  hosts; anomalous command lines; container exec anomalies.
- **Evidence usually in:** `code-review/`, `.appsec/findings/<tag>/` (injection),
  runtime/EDR or container audit logs.

### T1203 — Exploitation for Client Execution
- **What it is:** Exploiting a client app (browser, desktop client, document viewer)
  to execute code on the *user's* machine.
- **Relevance:** Often **N/A for pure server/API SaaS**; relevant if a thick client /
  desktop / mobile app is in scope (compose with `security-app-mobile`).
- **Typical control:** Client dependency patching; sandboxing; CSP to constrain
  browser-side execution.
- **Typical detection signal:** Endpoint EDR exploit-behavior alerts; crash telemetry.
- **Evidence usually in:** client `sca/`, endpoint telemetry.

---

## Persistence (TA0003) — keeping access

### T1505.003 — Server Software Component: Web Shell
- **What it is:** Planting a web script on the server (often via a file-upload or
  RCE bug) to keep a backdoor reachable over HTTP.
- **Typical control:** Read-only web root; strict upload validation (type/content/
  size); store uploads outside the served path with no execute permission; file_upload
  overlay controls.
- **Typical detection signal:** File-integrity monitoring (FIM) on the web root;
  alert on new file written into a served path; anomalous requests to unknown scripts.
- **Evidence usually in:** `overlay-file_upload/checklist.yaml`, `code-review/`, FIM/IDS.

### T1098 — Account Manipulation
- **What it is:** Modifying accounts/keys/permissions to retain access (add MFA
  device, create API key, escalate role).
- **Typical control:** Approval workflow for privileged changes; key/credential
  rotation policy; least privilege on admin actions.
- **Typical detection signal:** Audit alert on role grants, API-key creation, MFA-device
  enrollment, permission changes.
- **Evidence usually in:** `authz-matrix/`, `secret-scan/`/`platform-secrets`, audit logs.

---

## Privilege Escalation (TA0004) — gaining higher rights

### T1068 — Exploitation for Privilege Escalation
- **What it is:** Exploiting a bug to go from low to high privilege (kernel, runtime,
  service, or app-level priv-esc).
- **Typical control:** Patch runtime/kernel/dependencies; least-privilege service
  accounts; drop container capabilities; no setuid where avoidable.
- **Typical detection signal:** Unexpected privilege gain; setuid execution; token
  elevation; container breakout indicators.
- **Evidence usually in:** `sca/`, `platform-iac`/`iac-cloud`, runtime audit.

### T1548 — Abuse Elevation Control Mechanism
- **What it is:** Bypassing elevation controls (sudo, UAC, setuid, cloud
  assume-role misuse) to run with higher privileges.
- **Typical control:** Minimal sudo surface; hardened IAM/assume-role policies;
  no over-broad role trust.
- **Typical detection signal:** sudo/elevation anomalies; policy-bypass attempts;
  unexpected `AssumeRole` patterns.
- **Evidence usually in:** `iac-cloud/`, `authz-matrix/`, cloud audit (CloudTrail).

---

## Defense Evasion (TA0005) — avoiding detection

> **ATT&CK v19 note (2026-04-28, verified):** this tactic was split into **Stealth** (TA0005) + **Defense Impairment** (TA0112) in ATT&CK Enterprise v19. The technique below (T1562 Impair Defenses) now sits under **Defense Impairment**. Version-pin your matrix; ATLAS still uses the combined "Defense Evasion".

### T1562 — Impair Defenses
- **What it is:** Disabling/tampering with logging, monitoring, or security tools to
  blind defenders.
- **Typical control:** Tamper-resistant, **off-host** logging; immutable audit sink;
  alert if a security agent stops; least privilege over logging config.
- **Typical detection signal:** "Logging stopped" / log-gap alerts; security-tool-disabled
  events; sudden drop in expected telemetry volume.
- **Evidence usually in:** ASVS V16 logging evidence in `code-review/`, `iac-cloud/`,
  SIEM health monitors. **This technique's detection is meta: it protects all the others.**

---

## Credential Access (TA0006) — stealing credentials

### T1110 — Brute Force
- **What it is:** Guessing credentials at scale (password spray, credential stuffing,
  brute force of tokens/OTP).
- **Typical control:** Rate limiting; account lockout/backoff; MFA; strong password
  policy; breached-password rejection; CAPTCHA where appropriate (ASVS V6).
- **Typical detection signal:** Auth-failure-rate spike alerts; credential-stuffing
  pattern (many users, few attempts each); OTP brute-force alerts.
- **Evidence usually in:** `code-review/` (auth), `.appsec/findings/<tag>/`, IdP/auth logs.

### T1212 — Exploitation for Credential Access
- **What it is:** Exploiting a flaw in the auth system itself to obtain credentials
  or tokens (not guessing — exploiting).
- **Typical control:** Patched auth stack; no token leakage (logs/URLs/referrers);
  secure token issuance/validation; no JWT alg confusion.
- **Typical detection signal:** Anomalous token issuance; auth-service exploit
  indicators; unexpected token reuse/replay.
- **Evidence usually in:** `sca/` (auth libs), `code-review/` (token handling), auth logs.

---

## Discovery (TA0007) — mapping the environment

### T1087 — Account Discovery
- **What it is:** Enumerating valid accounts/users (often via login/reset/API responses
  that differ for valid vs invalid users).
- **Typical control:** Uniform responses (no user-enumeration via timing/error/status);
  rate limiting on lookup/auth endpoints (API overlay).
- **Typical detection signal:** High-rate account/lookup enumeration; many distinct
  username probes from one source.
- **Evidence usually in:** `overlay-api/checklist.yaml`, `code-review/`, app logs.

### T1046 — Network Service Discovery
- **What it is:** Scanning for reachable services/ports to find an entry point.
- **Typical control:** Minimal exposed surface; least-open security groups / network
  policies; no unnecessary public ports.
- **Typical detection signal:** Port-scan / service-sweep detection at the network
  edge; many-ports-one-source patterns.
- **Evidence usually in:** `iac-cloud/` (security groups / network policy), edge/IDS logs.

---

## Collection (TA0009) — gathering target data

### T1530 — Data from Cloud Storage
- **What it is:** Accessing data in cloud object storage (S3/GCS/Azure Blob), often
  via a misconfigured-public bucket or over-broad access.
- **Relevance:** Flip `relevant: false` only if no cloud object storage is used.
- **Typical control:** No public buckets; least-privilege bucket policies; encryption
  at rest; block-public-access org guardrails.
- **Typical detection signal:** Anomalous bulk object reads; cross-account access;
  access from unexpected principals/regions (CloudTrail/audit).
- **Evidence usually in:** `iac-cloud/`, `data-classification/`, cloud audit logs.

---

## Exfiltration (TA0010) — getting data out

### T1567 — Exfiltration Over Web Service
- **What it is:** Sending stolen data out over a legitimate-looking web service
  (HTTPS to cloud storage, paste sites, webhooks) to blend with normal traffic.
- **Typical control:** Egress allowlisting; DLP on sensitive data classes; restrict
  outbound to known destinations.
- **Typical detection signal:** Egress-volume anomaly; uploads to unknown/new domains;
  unusual outbound from app/data tier.
- **Evidence usually in:** `data-classification/`, `iac-cloud/` (egress rules), netflow/proxy logs.

---

## Impact (TA0040) — destroy / disrupt / deny

### T1485 — Data Destruction
- **What it is:** Deleting/corrupting data or backups to cause damage (incl.
  ransomware-style destruction).
- **Typical control:** Immutable / off-account backups; delete-protection / object-lock;
  RBAC on destructive ops; soft-delete + recovery window.
- **Typical detection signal:** Mass-delete alerts; backup-tamper alerts; unexpected
  drop in object/row counts.
- **Evidence usually in:** `recovery` evidence (backup validation), `authz-matrix/`,
  cloud audit. **Ties directly to CSF RC (security-response-recovery).**

### T1499 — Endpoint Denial of Service
- **What it is:** Overwhelming the app/service to deny availability (flood, resource
  exhaustion, expensive-query abuse).
- **Typical control:** Rate limiting; autoscaling; upstream DDoS protection / CDN;
  query cost limits; circuit breakers.
- **Typical detection signal:** Latency/error-rate/saturation alerts; traffic-spike
  anomaly; resource-exhaustion signals.
- **Evidence usually in:** `iac-cloud/` (WAF/CDN/rate-limit), reliability monitoring.
  **Overlaps the threat-model "Reliability & Cost lens" (CLAUDE.md §4 Orchestration Hygiene).**

---

## AI / ML surface overlay — MITRE ATLAS (only when an llm/agent surface exists)

> **Source: MITRE ATLAS — https://atlas.mitre.org** (verify ids there). ATLAS is the
> ATT&CK-style knowledge base for adversarial threats to AI/ML systems. Keep these in
> the coverage file's separate `atlas:` block — do **not** merge them into the ATT&CK
> Enterprise list. Composes with `security-app-llm` (which owns the AI control review).

| ATLAS id (verify) | What it is | Typical control | Typical detection signal |
|---|---|---|---|
| **AML.T0051** LLM Prompt Injection | Crafted input (direct or via fetched/tool content) overrides the model's intended instructions | Input/output guardrails; tool-permission boundaries; treat retrieved content as untrusted; human override on high-impact actions | Prompt-injection / jailbreak-attempt detection in prompt logs + evals; anomalous tool-call sequences |
| **AML.T0057** LLM Data Leakage | Model reveals sensitive/training/secret data in its output | Output filtering; secret/PII redaction on responses; scope/permission limits on what the model can retrieve | Sensitive-data-in-response detection; redaction-bypass alerts |
| **AML.T0043** Craft Adversarial Data / Evasion | Inputs crafted to make the model misclassify or behave wrongly | Robust validation; adversarial-robustness testing; confidence thresholds | Distribution-shift / anomalous-input detection; eval-suite regressions |
| **AML.T0040** Model Extraction / Theft | Querying to reconstruct or steal the model | Rate limiting on inference; query-pattern monitoring; watermarking | High-rate / systematic query-pattern alerting |

> ATLAS ids/tactics change as the matrix evolves — **verify against atlas.mitre.org**
> before publishing. The OWASP LLM Top 10 is **not** a substitute for ATLAS coverage
> on an agentic system (CLAUDE.md AppSec short rules): agentic surfaces need tool-perm
> boundaries, memory-poisoning, indirect prompt injection, evals, and human override
> mapped explicitly.

---

## Tactic id quick map

| Tactic | ATT&CK id |
|---|---|
| Initial Access | TA0001 |
| Execution | TA0002 |
| Persistence | TA0003 |
| Privilege Escalation | TA0004 |
| Stealth (v19; was "Defense Evasion" ≤v18) | TA0005 |
| Defense Impairment (new in ATT&CK v19, 2026-04-28) | TA0112 |
| Credential Access | TA0006 |
| Discovery | TA0007 |
| Lateral Movement | TA0008 |
| Collection | TA0009 |
| Exfiltration | TA0010 |
| Command and Control | TA0011 |
| Impact | TA0040 |
| Reconnaissance (PRE) | TA0043 |
| Resource Development (PRE) | TA0042 |

> Lateral Movement (TA0008) and Command and Control (TA0011) are intentionally light
> in this web/API/cloud subset — add specific techniques (e.g. T1021 Remote Services,
> T1071 Application Layer Protocol) when the architecture (internal network, multi-host,
> egress C2 risk) makes them relevant. Scope the matrix to the actual surface; do not
> pad it.
