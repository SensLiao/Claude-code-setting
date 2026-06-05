# Incident Response — Initial Report

> Owned by: `security-response-incident-response` capability (planned skill)
> Standards: NIST SP 800-61 Rev. 3 (Incident Handling, CSF 2.0 aligned) + NIST CSF 2.0 RS function

This is the **initial report** issued within minutes of incident declaration. Subsequent updates use the same structure with version bumps.

---

## Incident Identification

| Field | Value |
|---|---|
| Incident ID | INC-{{YYYY-MM-DD}}-{{NNN}} |
| Initial report version | 1.0 |
| Time declared | {{ISO 8601}} |
| Time of initial report | {{ISO 8601}} |
| Reporter | {{name + role}} |
| Discovery channel | monitoring alert / user report / external disclosure / pentest finding / log review / third-party |
| Current state | active / contained / recovering / closed |
| Severity（initial estimate） | SEV-1 (critical) / SEV-2 (high) / SEV-3 (medium) / SEV-4 (low) |
| Incident commander | {{name}} |
| Communications lead | {{name}} |

---

## Severity Definitions

| SEV | Definition | Initial Response Time |
|---|---|---|
| SEV-1 | Confirmed breach / large-scale outage / regulatory-reportable | Immediate（pager） |
| SEV-2 | Suspected breach / partial outage / critical vuln being exploited | Within 1 hour |
| SEV-3 | Limited impact / no confirmed breach / contained scope | Within 4 hours |
| SEV-4 | Minor / informational | Within 24 hours |

---

## 1. Affected Scope

### Systems / Services
- {{system A}} — environment: prod / staging
- {{system B}}

### Environments
- [ ] Production
- [ ] Staging / preview
- [ ] Development
- [ ] CI/CD pipeline
- [ ] Internal corporate

### User / Tenant Impact
- Estimated affected users: {{N}} / unknown
- Estimated affected tenants: {{N}} / unknown
- Customer-facing impact visible: yes / no

### Data Impact
- [ ] No data accessed (so far)
- [ ] Internal data accessed
- [ ] Confidential data accessed (PII)
- [ ] Restricted data accessed (payment / health / credentials)
- [ ] Data integrity affected (modification / deletion)
- [ ] Data exfiltration confirmed

---

## 2. Facts and Evidence

### Confirmed Facts
What we know to be true based on hard evidence.

### Working Hypotheses (NOT confirmed)
What we suspect but have not verified.

### Initial Evidence Locations
- Logs: {{path / SIEM query / time range}}
- Network captures: {{path}}
- System snapshots: {{path}}
- Screenshots: {{path}}
- External reports / disclosures: {{link}}

### Evidence Hash Record
```
sha256  evidence_bundle_init.tar.gz  →  {{hash}}
```

> Why hash early: per NIST SP 800-86, evidence integrity must be preservable from first collection. Hash before any analysis.

---

## 3. Containment Actions Already Taken

### Immediate Containment
- [ ] Affected system isolated from network
- [ ] Compromised credentials disabled / rotated
- [ ] Vulnerable endpoint disabled
- [ ] WAF rule deployed
- [ ] Backup of evidence taken (with hash)
- [ ] Production deploy frozen

### Temporary Mitigations
- {{describe — what's bridging the gap until permanent fix}}

### Access Controls / Key Rotations
- [ ] User passwords forced reset
- [ ] API keys rotated: {{list}}
- [ ] OAuth tokens revoked
- [ ] Database credentials rotated
- [ ] Third-party API tokens rotated

### External Notification Status
- [ ] Internal stakeholders notified
- [ ] Customers notified — required by: {{regulation / SLA}}
- [ ] Regulators notified — required by: {{GDPR 72h / PIPL / SEC / state breach laws}}
- [ ] Partners / vendors notified
- [ ] Law enforcement contacted（如适用）
- [ ] Press / public statement issued

---

## 4. Next Steps

### Root Cause Analysis Owner
{{name + ETA}}

### Recovery Owner
{{name + ETA}}

### Legal / Compliance Participation
- [ ] Legal counsel engaged
- [ ] Privacy officer engaged
- [ ] Compliance officer engaged
- [ ] External counsel needed: yes / no

### Communications Plan
- Internal cadence: {{e.g. updates every 30min during active, every 4h once contained}}
- External cadence: {{customer comms / status page / press}}
- Next update due: {{datetime}}

### Investigation Scope
- [ ] Determine root cause
- [ ] Determine attack timeline
- [ ] Determine data accessed / exfiltrated
- [ ] Determine attacker capabilities still present
- [ ] Determine lateral movement
- [ ] Determine persistence mechanisms

---

## 5. Risk to Other Systems

哪些相关系统也可能受影响 / 需要 preemptive check：

| System | Why at Risk | Preemptive Action |
|---|---|---|
| {{system X}} | Shares same auth | Force re-auth |
| {{system Y}} | Uses same dependency | Patch / verify |

---

## 6. Decision Log

每个 incident command 决策记录：

| Time | Decision | Decision-maker | Rationale | Reversible? |
|---|---|---|---|---|
| {{HH:MM}} | Take system X offline | IC | Prevent further exfil | Yes (re-enable) |
| {{HH:MM}} | Force user password reset | CISO | Suspected credential compromise | Yes (users re-set) |

---

## 7. Recovery Criteria（NIST CSF 2.0 RC function）

事件可以从 RESPONSE → RECOVERY 切换的条件：

- [ ] Root cause confirmed
- [ ] Vulnerability patched / mitigated
- [ ] Attacker access confirmed terminated
- [ ] Backups validated（如使用 backup 恢复）
- [ ] Restore tested in isolated environment first
- [ ] Monitoring deployed for recurrence detection
- [ ] Affected stakeholders notified of recovery plan
- [ ] BCP / DR procedures documented for similar future event

---

## 8. Post-Incident Deliverables（do NOT skip）

事件关闭后 7-30 天内必须产出：

- [ ] Full timeline / forensic report
- [ ] Root cause analysis (RCA) document
- [ ] Customer / regulator final report (如有 reporting obligation)
- [ ] Vulnerability report(s) for each underlying defect (vuln-report.md)
- [ ] Risk register entries for any accepted residual risk (risk-register.md)
- [ ] Lessons learned / blameless post-mortem
- [ ] Updates to: SECURITY.md, threat model, IR runbook, monitoring rules, test cases

---

## 9. Reference Documents

- IR Runbook: {{link}}
- Backup & Recovery Procedure: {{link}}
- Data Breach Notification Procedure: {{link}}
- Communications Plan Template: {{link}}
- Forensics Procedure（NIST SP 800-86）: {{link}}
- Related SECURITY.md: {{link}}
- Related Risk Register entries: {{R-NNN, R-NNN}}

---

## 10. Sign-off (rolling)

| Update | Time | Signed | New Information |
|---|---|---|---|
| 1.0 | {{ISO}} | {{IC name}} | Initial declaration |
| 1.1 | {{ISO}} | {{IC name}} | {{what changed}} |
