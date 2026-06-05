---
paths:
  - "src/api/**/*.{ts,tsx,js,jsx}"
  - "app/api/**/*.{ts,tsx,js,jsx}"
  - "pages/api/**/*.{ts,tsx,js,jsx}"
  - "src/**/auth/**/*.{ts,tsx,js,jsx,py,go,rs,java,kt}"
  - "src/**/middleware*.{ts,tsx,js,jsx}"
  - "src/lib/auth/**/*"
  - "src/lib/db/**/*"
  - "src/server/**/*"
  - "server/**/*"
  - "backend/**/*"
  - "**/*.security.{ts,tsx,js,jsx,py}"
  - "**/auth.config.*"
  - "**/middleware.ts"
---

> This rule is path-scoped. It loads only when Claude reads/edits files matching
> the paths above (API routes, middleware, auth code, server-side, db layers).
> Extends [common/security.md](../common/security.md).

> **AppSec v3.0** (2026-05-25 — GSD-lite execution engine).
> **Evidence root canonical**: `.appsec/evidence/<tag>/`. Legacy `.planning/security/` accepted via SDK adapter (deprecation path; migrate with `appsec-sdk migrate-evidence`).
> **Hooks scope**: 7 AppSec hooks register in `<project>/.claude/settings.json` via `appsec-sdk init`; fresh projects without `.appsec/config.json` have NO active enforcement.
> **ROE checklist**: 11 user-visible sections (validated as 13 internal fields by orchestrator v3 §20.7 — emergency_contact / rollback as separate fields, authorization_proof as anchor).
> Authority: [docs/CANONICALS.md](../docs/CANONICALS.md).

# Security and AppSec Rule (path-scoped)

## Hard rules (zero exception)

1. **Never read, print, modify, or commit secrets**: `.env`, `.env.*`,
   `secrets/**`, `credentials.json`, `*.pem`, `*.key`, production tokens.
2. **Always parameterize SQL queries**; never concatenate user input into queries.
3. **Always validate input server-side** (Zod / Joi / Pydantic schemas); never
   trust the client.
4. **Always check authorization server-side per resource**, not just per route
   (IDOR / BOLA / BOPA / BFLA prevention).
5. **Always escape output** for XSS prevention; never `innerHTML` /
   `dangerouslySetInnerHTML` without sanitization.
6. **Never disable** Content-Security-Policy / HSTS / SameSite / Secure /
   HttpOnly cookie flags without documented risk acceptance.
7. **Always log security events** (auth success/failure, authz denial,
   sensitive operation); **never log secrets / PII / tokens**.
8. **Error messages must not leak internal information** (no stack traces /
   db error messages in user-facing responses).
9. **Always use TLS** (HTTPS-only); validate certificates; do not pin to
   `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## AppSec gate triggers

When you modify any path matched by this rule, you must:

- **Route to `appsec-security-orchestrator`** for review before shipping
- Add a **regression test** for the security behavior (RED → GREEN)
- Update `.planning/SECURITY.md` if architecture / trust boundaries / auth model
  changes. Note: `.planning/SECURITY.md` is the **governance contract doc**
  (20-section project security contract); `.appsec/evidence/<tag>/` is the
  **evidence sink** for per-tag audit findings. These are distinct artifacts
  with distinct purposes — do not conflate. Legacy `.planning/security/`
  evidence paths are accepted via SDK adapter for back-compat (migrate via
  `appsec-sdk migrate-evidence`).
- Run **`appsec-reviewer`** agent before opening PR
- Run **dependency audit** (`npm audit` / `pip-audit` / `cargo audit`)
- Run **secret scan** if files staged contain key-shaped strings

## OWASP mapping (required for shipping)

> **ASVS 5.0** chapter numbering is used. ASVS 4.x V2-V13 chapter labels are
> superseded — DO NOT use them in new findings. When referencing requirements,
> use version-pinned identifiers like `v5.0.0-6.2.1`.

- **ASVS V1** (Encoding / Sanitization): input encoding, output sanitization
- **ASVS V2** (Validation / Business Logic): server-side schema, business rules
- **ASVS V3** (Web Frontend): XSS, CSRF, CSP, cookie flags
- **ASVS V4** (API and Web Service): API authn / authz, rate limit, input validation
- **ASVS V5** (File Handling): upload, download, path traversal
- **ASVS V6** (Authentication): password storage (argon2id/bcrypt), MFA, lockout
- **ASVS V7** (Session Management): cookie flags (Secure/HttpOnly/SameSite),
  token entropy, session fixation, invalidation, expiration
- **ASVS V8** (Authorization): server-side authz, IDOR / BOLA / BOPA / BFLA
  prevention, RBAC / ABAC
- **ASVS V9** (Self-contained Tokens): JWT signing, revocation
- **ASVS V10** (OAuth and OIDC): third-party identity flows
- **ASVS V11** (Cryptography): algorithm selection, key length, random source
- **ASVS V12** (Secure Communication): TLS 1.2+, HSTS preload, cert validation
- **ASVS V13** (Configuration): security headers, secure defaults
- **ASVS V14** (Data Protection): encryption at rest, data minimization
- **ASVS V15** (Secure Coding): secure coding patterns
- **ASVS V16** (Security Logging and Error Handling): log hygiene, audit logs,
  no PII / token / credential in logs, error messages do not leak internals
- **ASVS V17** (WebRTC / Real-time Channels): only if WebRTC / RTC in scope
- **API Top 10 2023** (if API endpoint): BOLA / Broken Auth / BOPA / Resource
  limits / BFLA / Sensitive Business Flows / SSRF / Misconfig / Inventory /
  Unsafe Consumption

## Active testing rule (hard)

Active penetration testing must **NEVER** run automatically.

- Active scans require **explicit user authorization** via
  `pentest-scope-and-roe` → `authorized-pentest-validation` manual gate
- Required before active testing: confirmed target ownership, ROE scope,
  time window, rate limits, allowed/disallowed methods, test accounts, data
  handling rules, emergency contact, rollback plan, reporting format
- **Never** perform: destructive testing, DoS, persistence, credential theft,
  data exfiltration, stealth/evasion, out-of-scope scanning

## Permission edges (settings.json must enforce)

- `permissions.deny`: `Read(./.env*)`, `Read(./secrets/**)`, `Read(./**/*.pem)`,
  `Read(./**/*.key)`
- `permissions.deny` for raw offensive: `Bash(hydra *)`, `Bash(msfconsole *)`,
  `Bash(msfvenom *)`, `Bash(sqlmap *)`, `Bash(masscan *)`,
  `Bash(zap-full-scan.py *)`, `Bash(docker run *zaproxy*active*)`
- `permissions.ask` for controlled wrappers only:
  `Bash(npm run security:baseline *)`, `Bash(npm run security:audit *)`
- `permissions.allow` for defensive checks: `Bash(npm audit)`,
  `Bash(trivy fs .)`, `Bash(semgrep scan --config p/ci .)`

## What this rule does NOT cover

- Compliance frameworks (SOC2 / ISO27001 / PCI-DSS) — out of MVP scope
- Production observability / SIEM — out of MVP scope
- Heavy load testing — out of MVP scope

These can be layered later. This rule covers commercial MVP AppSec baseline only.
