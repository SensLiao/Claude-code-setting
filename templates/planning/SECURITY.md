# Security Architecture & AppSec Mapping

> 由 `appsec-security-orchestrator` 维护。`claude-env-bootstrap` 从全局模板复制。
> 项目: {{project_name}}
> Last updated: {{date}}
> Owner: {{security_owner_name}}

## 1. Asset Inventory

| Asset | Type | Sensitivity | Storage | Access pattern |
|---|---|---|---|---|
| {{asset_name}} | data / code / infra | public / internal / confidential / restricted | {{db / file / cache}} | {{who can read/write}} |

(Add one row per system asset)

## 2. Data Classification

| Class | Examples | Storage requirement | Encryption | Retention |
|---|---|---|---|---|
| Public | marketing copy | any | optional | indefinite |
| Internal | system logs (no PII) | private DB / S3 | at rest TLS in transit | 90 days |
| Confidential | user PII / business data | encrypted DB / encrypted S3 | always encrypted | per regulation |
| Restricted | payment data / health data / credentials | dedicated vault | FIPS-compliant + KMS | per regulation |

> Note: 澳大利亚 Australian Privacy Principles (APP) — especially APP 11 (Security of personal info) — apply if storing personal info. 类似 GDPR/CCPA 视客户来源加入此表。

## 3. Trust Boundaries

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ Browser  │ → │  CDN /   │ → │ Server / │ → │ Database │
│(untrusted)│  │   WAF    │   │   API    │   │          │
└──────────┘   └──────────┘   └──────────┘   └──────────┘
              ↑              ↑              ↑
        Boundary 1      Boundary 2      Boundary 3
      (input validation) (auth/authz)  (encryption +
                                    parameterized query)
```

每个 boundary 列出 control mechanism。

## 4. Authentication Model

- Mechanism: {{magic link / OAuth / SSO / username+password / passkey}}
- Storage: {{bcrypt / argon2id / KMS}}
- MFA: {{enabled / not enabled}} — reason
- Session: {{cookie / JWT / opaque token}}
- Cookie flags: HttpOnly / Secure / SameSite={{Lax/Strict}}
- Session timeout: {{idle / absolute}}
- Token rotation: yes / no
- Recovery flow: {{magic link / SMS / security questions}}

## 5. Authorization Model

- Pattern: {{RBAC / ABAC / ACL}}
- Server-side enforcement: yes (mandatory) — no UI-only authz
- Resource ownership check: at every API call accessing user-owned resource
- Admin surface protection: separate auth or role gate

## 6. API Surface (if applicable)

| Endpoint | Auth | Authz | Rate limit | Input schema | Output redaction |
|---|---|---|---|---|---|
| GET /api/users/me | required | self only | 60/min | none | redact password/email |
| POST /api/orders | required | RBAC: customer | 30/min | Zod OrderSchema | no internal fields |

(列出主要 endpoints)

## 7. Admin Surface

- Location: {{/admin}}
- Access: {{IP allowlist / VPN / separate auth}}
- Audit log: every action logged
- Sensitive actions require re-auth: yes / no

## 8. File Upload (if applicable)

- Allowed types: {{whitelist of MIME + extension}}
- Max size: {{n MB}}
- Storage: {{S3 with private ACL / blob storage}}
- Virus scan: {{enabled / disabled}}
- Filename sanitization: yes
- Don't render uploaded files inline (Content-Disposition: attachment)

## 9. Payment (if applicable)

- Provider: {{Stripe / PayPal / etc.}}
- PCI scope: SAQ-{{A / D}} (default A = redirected checkout)
- Never store: PAN / CVV / track data / PIN
- Tokenization: yes

## 10. Dependency / Supply Chain

- Audit tool: {{npm audit / pip-audit / cargo audit}}
- Frequency: per PR + weekly cron
- Block severity: high+ (no merge with unresolved high+)
- Lockfile committed: yes
- Pin version range: {{exact or ~/^}}

## 11. Secret Management

- Storage: {{env vars / Vault / KMS}}
- Rotation: {{quarterly / on incident}}
- Never in: code / commits / logs / error messages
- Pre-commit hook: gitleaks / git-secrets enabled

## 12. Logging & Error Handling

- Logger: {{pino / winston / etc.}}
- Sensitive data redaction: PII / tokens / credentials
- Error message to user: friendly, no stack trace, no internal info
- Server-side log: full context + correlation ID

## 13. Security Headers

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: {{project-specific — never use 'unsafe-inline' for script-src in production}}
X-Content-Type-Options: nosniff
X-Frame-Options: DENY (or frame-ancestors in CSP)
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## 14. OWASP ASVS Mapping (target Level)

> 商业 MVP 默认 L1，含 user data 升 L2

- [ ] V2 Authentication (覆盖)
- [ ] V3 Session Management (覆盖)
- [ ] V4 Access Control (覆盖)
- [ ] V5 Validation / Sanitization / Encoding (覆盖)
- [ ] V8 Data Protection (覆盖)
- [ ] V9 Communications (覆盖)
- [ ] V11 Business Logic (如有)
- [ ] V13 API (如有)

## 15. OWASP WSTG Passive Checklist (本 skill 涵盖部分)

- [ ] WSTG-INFO Information Gathering (OSINT 范围内)
- [ ] WSTG-CONF Configuration / Deployment
- [ ] WSTG-IDNT Identity Management
- [ ] WSTG-INPV Input Validation (code review)
- [ ] WSTG-ERRH Error Handling
- [ ] WSTG-CRYP Weak Cryptography
- [ ] WSTG-CLNT Client-side

> Active sections (WSTG-ATHN/ATHZ/SESS/BUSL/API active) → 路由 authorized-pentest-validation

## 16. OWASP API Security Top 10 (2023) Mapping (if API present)

- [ ] API1: Broken Object Level Authorization (BOLA)
- [ ] API2: Broken Authentication
- [ ] API3: Broken Object Property Level Authorization (BOPA)
- [ ] API4: Unrestricted Resource Consumption
- [ ] API5: Broken Function Level Authorization (BFLA)
- [ ] API6: Unrestricted Access to Sensitive Business Flows
- [ ] API7: Server Side Request Forgery (SSRF)
- [ ] API8: Security Misconfiguration
- [ ] API9: Improper Inventory Management
- [ ] API10: Unsafe Consumption of APIs

## 17. Findings Log

| Date | Severity | Source | Description | Status |
|---|---|---|---|---|
| (each AppSec finding appended here; status: open / mitigated / resolved / accepted) | | | | |

## 18. Risk Acceptance Register

| Finding | Severity | Acceptance reason | Approver | Review date |
|---|---|---|---|---|
| | | | | |

## 19. Compliance / Regulatory (if applicable)

- [ ] Australian Privacy Principles (APP) — if storing PII of Australian users
- [ ] GDPR — if EU users
- [ ] CCPA — if California users
- [ ] HIPAA — if US health data
- [ ] PCI-DSS — if storing payment data (SAQ level)

## 20. Next AppSec Review Date

{{date}} (recommend quarterly or after major architectural change)
