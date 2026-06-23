# Vulnerability Report

> Owned by: `security-remediation` + `compliance.reporting` capability
> Per finding produces one report. Multiple findings can be batched into Release Evidence.

---

## Summary

| Field | Value |
|---|---|
| Title | {{1-line description}} |
| Finding ID | {{YYYY-MM-DD-source-NNN}} |
| System / Module | {{repo + path}} |
| Found Date | {{YYYY-MM-DD}} |
| Found By | SAST / DAST / IAST / 手测 / 监控 / 外部披露 / pentest |
| Detector | {{tool name + version}} |
| Status | open / triaged / in_progress / mitigated / resolved / accepted |

---

## Risk Rating

按本 orchestrator §10 两段式分级：

| Dimension | Value |
|---|---|
| Technical Severity | Critical / High / Medium / Low |
| Business Impact | High / Medium / Low |
| Exposure | Internet / Internal / Admin surface / Supply chain |
| Data Class affected | Public / Internal / Confidential / Restricted |
| Exploit Likelihood | High / Medium / Low / Theoretical |
| **Final Risk** | **Critical / High / Medium / Low** |
| **Remediation SLA** | **24-72h / 7-14d / 30d / 90d** |

---

## Standards Mapping

- CWE: {{CWE-ID}}
- OWASP Top 10 2021: {{A0n}}
- OWASP API Top 10 2023: {{API0n}} (if API)
- OWASP ASVS 5.0: {{v5.0.0-<chapter>.<sub>}}   # version-pinned, e.g. v5.0.0-6.2.1
- NIST CSF 2.0 Function: GV / ID / **PR** / DE / RS / RC

---

## Details

### Affected Assets
- Files: {{path:line, path:line}}
- Components: {{component}}
- Environments: dev / staging / prod
- Tenants affected (if multi-tenant): {{tenant id list}}

### Preconditions
What must be true for this vulnerability to be exploited.

### Reproduction Steps
1. ...
2. ...
3. ...

### Attack Path / PoC
```
Attacker → Entry Point → Step 1 → Step 2 → Impact
```

For demo PoC: include redacted curl / browser steps. **Never** include real credentials, real PII, or actual exploit payloads in the persistent report.

### Actual Impact
- Confidentiality: ...
- Integrity: ...
- Availability: ...
- Accountability: ...

### Known Active Exploit?
- [ ] No public exploit known
- [ ] Public PoC available — {{link}}
- [ ] Active exploitation observed in the wild
- [ ] CVE assigned: {{CVE-YYYY-NNNNN}}

### Evidence
- Log excerpts (redacted): {{path or inline}}
- Screenshots: {{path}}
- Test output: {{path}}
- Network capture (redacted): {{path}}

---

## Root Cause Analysis

### Direct Cause
What the immediate technical defect is.

### Deeper Cause
Why the defect was introduced / not caught earlier (process gap, missing rule, missing test, design gap).

### Missing Controls
List which controls would have prevented OR detected this:
- [ ] SAST rule for {{pattern}}
- [ ] DAST scan for {{endpoint class}}
- [ ] Code review checklist item
- [ ] Threat model entry
- [ ] Regression test

### Affected Standards
- ASVS 5.0 control violated: {{v5.0.0-<chapter>.<sub>}}   # version-pinned
- CSF function gap: GV / ID / PR / DE / RS / RC

---

## Remediation

### Immediate Mitigation (within SLA)
What temporary control reduces risk while permanent fix is built.

### Permanent Fix
Code / config / architecture change.

### Regression Test
- Test name: {{test_id}}
- Location: {{tests/security/test_xxx.spec.ts}}
- RED state (vuln reproduces): test output snippet
- GREEN state (fix in place): test output snippet
- Test must be in CI: yes / no

### Secret / Credential Rotation Required?
- [ ] Yes — list secrets to rotate: {{list}}
- [ ] No

### Customer / Regulator Notification Required?
- [ ] Yes — notification path: {{contact / regulator}} — due date: {{date}}
- [ ] No

### Coordinated Disclosure?
- [ ] Internal only
- [ ] Coordinated disclosure with researcher — researcher: {{name}}
- [ ] Public disclosure scheduled: {{date}}

---

## Ownership & Timeline

| Field | Value |
|---|---|
| Primary Owner | {{name}} |
| Backup Owner | {{name}} |
| Approver (Risk Acceptance, if applicable) | {{name}} |
| Triaged Date | {{date}} |
| Started Date | {{date}} |
| ETA Fix Date | {{date}} |
| Actual Fix Date | {{date}} |
| Regression Verified Date | {{date}} |
| Closure Date | {{date}} |

---

## Risk Acceptance (if NOT fixing)

If user chooses to accept risk instead of fixing:

| Field | Value |
|---|---|
| Acceptance Reason | {{technical / business / regulatory}} |
| Compensating Controls | {{what reduces risk in place of fix}} |
| Approver | {{name + role}} |
| Approval Date | {{date}} |
| Review Date | {{date}} |
| Risk Register Entry | {{R-NNN}} |

---

## Related Records

- Risk Register entry: {{R-NNN}}
- Threat Model entry: {{T-NNN}}
- Incident Report (if escalated): {{INC-NNN}}
- Linked AppSec Release Evidence: {{link}}

---

## Notes

任何 future reviewer 需要知道的额外上下文。
