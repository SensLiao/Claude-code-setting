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

> **Post-orchestrator (2026-08-25, evidence kit 2026-08-28)**: the AppSec orchestrator, its enforcement
> hooks, the entire active-testing line and the evidence SDK are all removed. Defensive review runs
> through the `security-reviewer` agent. There is no evidence SDK left to call — when a paper trail is
> needed, write the findings and the commands you actually ran into a dated report in the repo.

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

## AppSec review triggers

When you modify any path matched by this rule, you must:

- Run the **`appsec-reviewer`** agent before shipping / opening the PR
  (`security-reviewer` for a lighter pass)
- Add a **regression test** for the security behavior (RED → GREEN)
- Run **dependency audit** (`npm audit` / `pip-audit` / `cargo audit`)
- Run **secret scan** if files staged contain key-shaped strings
  (`gitleaks` with `--redact` — raw secrets never appear in chat / logs / reports)
- When an audit trail matters (client delivery / compliance), record the findings and
  the exact commands run in a dated report committed with the change

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

Active penetration testing must **NEVER** run from this machine.

- The active-testing tooling (pentest / DAST skills, agents and their ROE gates)
  was removed on 2026-08-25. The prohibition outlives the tooling — it is a
  behavior red line, not a gate artifact.
- **Never** perform: destructive testing, DoS, persistence, credential theft,
  data exfiltration, stealth/evasion, out-of-scope scanning — with or without
  local tooling, regardless of who asks.

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
