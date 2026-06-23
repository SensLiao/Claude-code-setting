# Threat Model — STRIDE

> Owned by: `security-governance-threat-modeling` skill
> Standards: NIST SP 800-154 (Threat Modeling) + OWASP Threat Modeling
> Output: one file per system / feature / major architecture change

---

## Identification

- System / Feature: {{name}}
- Trigger: 新系统 / 新接口 / 认证模型变化 / 第三方接入 / 文件上传 / 多租户 / 实时通信 / GenAI
- Date: {{YYYY-MM-DD}}
- Facilitator: {{security architect}}
- Participants: {{architect, dev lead, AppSec, product owner, ...}}
- Architecture version reviewed: {{commit / doc version}}
- Related ADRs: {{links}}

---

## 1. System Context

### Purpose
One paragraph: what does the system do, who uses it, what's the business value.

### Key Use Cases
1. {{use case 1}}
2. {{use case 2}}

### Components in Scope
| Component | Type | Owner | Trust Level |
|---|---|---|---|
| {{frontend SPA}} | client | team | untrusted |
| {{API gateway}} | edge | team | semi-trusted |
| {{auth service}} | internal | team | trusted |
| {{primary DB}} | data | team | trusted |
| {{third-party A}} | external | vendor | semi-trusted |

### Components Out of Scope
- {{component, reason}}

---

## 2. Data Flow Diagram (DFD)

```
[Browser] ──HTTPS──> [CDN/WAF] ──HTTPS──> [API Gateway] ──mTLS──> [App Service] ──TLS──> [DB]
                                                │
                                                └──> [Auth Service] (OAuth/OIDC)
                                                │
                                                └──> [Third-Party API] (HTTPS + API key)
```

Each arrow = data flow. Each box = process / data store / external entity.

**Trust boundaries**（关键边界，每个必须列出 control mechanism）:
- B1: Browser → CDN/WAF — DDoS / bot / TLS termination
- B2: CDN → API GW — mTLS / IP allowlist / WAF rules
- B3: API GW → App — JWT validation / rate limit / input schema
- B4: App → DB — least-priv DB user / parameterized queries / connection encryption

---

## 3. STRIDE Threat Register

For each (component, data flow, trust boundary), enumerate threats by STRIDE category:

| ID | Component / Flow | STRIDE Category | Threat Scenario | Existing Control | Gap / Mitigation Plan | Owner | Disposition |
|---|---|---|---|---|---|---|---|
| T-001 | B1 Browser→CDN | **S** Spoofing | Attacker impersonates CDN, MITM | TLS 1.2+, HSTS preload | None — control adequate | - | MITIGATED |
| T-002 | API GW | **T** Tampering | Modify JWT in transit | JWT signature, HTTPS | None — control adequate | - | MITIGATED |
| T-003 | App Service | **R** Repudiation | User denies action | App log only | Add signed audit log w/ user ID, timestamp, action | {{owner}} | OPEN |
| T-004 | DB | **I** Information Disclosure | SQL injection leaks user data | Parameterized queries (current) | Add SAST gate on PRs touching repo/sql/* | {{owner}} | OPEN |
| T-005 | App Service | **D** Denial of Service | Unbounded LIST endpoint | None | Add server-side pagination (max 50) + rate limit | {{owner}} | OPEN |
| T-006 | Auth Service | **E** Elevation of Privilege | Horizontal IDOR on /api/orders/:id | None | Add server-side ownership check per resource | {{owner}} | OPEN |

**STRIDE Reference**:
- **S** Spoofing — identity authenticity
- **T** Tampering — data integrity
- **R** Repudiation — non-deniability + audit
- **I** Information Disclosure — confidentiality
- **D** Denial of Service — availability
- **E** Elevation of Privilege — authorization

---

## 4. Abuse Cases / Misuse Cases

每个 use case 写一个 abuse case：

| Use Case | Abuse Case | Attacker Profile | Impact |
|---|---|---|---|
| User uploads CSV | Attacker uploads polyglot file (image + script) | external | RCE / XSS |
| User resets password | Attacker enumerates emails via reset endpoint | external | PII leak |
| Admin views audit log | Insider tampers log to cover trail | privileged insider | non-repudiation loss |

---

## 5. Attack Surface Inventory

| Entry Point | Auth | Authz | Rate Limit | Input Schema | Status |
|---|---|---|---|---|---|
| `GET /api/users/me` | required | self only | 60/min | n/a | ✅ |
| `POST /api/orders` | required | RBAC: customer | 30/min | Zod | ✅ |
| `POST /api/uploads` | required | RBAC: customer | 5/min | size + MIME whitelist | 🟡 missing content sniff |
| `GET /admin/users` | admin only | RBAC: admin | n/a | n/a | ✅ |
| `POST /webhook/stripe` | HMAC | HMAC + idempotency key | 1000/min | Stripe schema | ✅ |

---

## 6. Cryptography Decisions

- TLS: 1.2+ enforced, HSTS preload yes/no, cert validation strict
- Password storage: argon2id / bcrypt (cost factor)
- Token signing: RS256 (asymmetric) / HS256 (symmetric) — and key rotation policy
- Data at rest: AES-256-GCM via KMS — key rotation policy
- Random source: crypto.randomBytes (Node) / secrets.token_urlsafe (Python)

---

## 7. Control Gap Inventory

收尾时把表格里所有 `OPEN` 状态项 + abuse cases 没覆盖项 + attack surface 标 🟡 项汇总到这里：

| Gap ID | Description | Severity | Affected Capability | Linked Risk ID |
|---|---|---|---|---|
| G-001 | Audit log lacks user / timestamp | High | response.forensics | R-001 |
| G-002 | Upload content sniff missing | High | app.file_upload | R-002 |
| G-003 | Server-side ownership check missing | Critical | platform.iam | R-003 |

每个 Gap 必须有对应 Risk Register entry（`templates/risk-register.md`）。

---

## 8. Standards Mapping

| Standard | Section | Coverage |
|---|---|---|
| NIST CSF 2.0 | ID.RA (Risk Assessment), PR.AC (Access Control), PR.DS (Data Security) | covered / partial / not_covered |
| OWASP ASVS 5.0 | V2, V4, V6, V8, V11 | covered / partial / not_covered |
| NIST SP 800-154 | Threat modeling process | covered |

---

## 9. Re-modeling Triggers

本 threat model 在以下情况必须重做：

- [ ] 新增对外接口
- [ ] 认证模型变更
- [ ] 数据分类变化
- [ ] 引入新第三方
- [ ] 信任边界变化
- [ ] 重大架构调整
- [ ] 每 12 个月强制 review

下次 review 日期：{{YYYY-MM-DD}}

---

## 10. Sign-off

- [ ] Threat register 已审
- [ ] Abuse cases 已审
- [ ] Gap inventory 已纳入 risk register
- [ ] STRIDE 6 类全覆盖（每个核心 component）
- [ ] DFD 与当前架构一致

Signed: {{name}}
Date: {{date}}
