# Relocated from appsec-security-orchestrator/SKILL.md — §19. Test Plan

## 19. Test Plan（v3.0）

### §19.1 SDK Command Matrix

| 命令 | fixture | 退出码 | 落盘 |
|---|---|---|---|
| `init <tag>` | 新 `.appsec/` | 0 | `.appsec/{config,state}.json` + `evidence/<tag>/` |
| `init ../etc` | path-traversal | 2 | 无 |
| `finding.add` | schema 合法 YAML | 0 | `.appsec/findings/<tag>/<n>.yaml` |
| `finding.add` | ASVS 4.x `V2.1.1` | 2 | 无 |
| `finding.add` | 缺 `csf_function` | 2 | 无 |
| `finding.add` | 含 raw `AKIA...` 字串 | 2 | 无 |
| `gate.check` | 无 evidence | 2 BLOCKED | hard_block_reasons 非空 |
| `gate.check` | 6 function PASS + 0 critical | 0 PASS | decision PASS |
| `gate.check` | 1 critical 无 risk_accept | 1 FAIL | decision FAIL |
| `gate.check` | 1 critical 有完整 risk_accept | 3 CONDITIONAL_PASS | conditional_reasons 非空 |
| `gate.check --allow-conditional` | 同上 | 0 | （仅 exit code 改） |
| `redact` | stdin `AKIA...` | 0 | stdout `<REDACTED:aws_key>` |
| `roe.verify` | 13 字段全 | 0 | 无 |
| `roe.verify` | 缺 `emergency_contact` | 2 | stderr 指出缺项 |

### §19.2 Hook Fixture Matrix

| Hook | fixture | 期望 |
|---|---|---|
| §18.1 secret-redaction | chat 出现 `AKIA...` | stderr+exit2 |
| §18.1 secret-redaction | chat 出现 `<REDACTED:aws_key>` | pass |
| §18.2 active-scan-guard | `nmap -sV staging.example.com` 无 ROE | stderr+exit2 |
| §18.2 active-scan-guard | 同上，有 ROE in-scope + window 内 | pass |
| §18.2 active-scan-guard | `nmap -sV prod.example.com` 即使有 ROE | stderr+exit2 (production hard ban) |
| §18.3 pentest-auth | 13 字段全 + window 内 + sign-off 句式 | pass |
| §18.3 pentest-auth | 缺 `data_handling` | stderr+exit2 |
| §18.4 evidence-required (strict) | "appsec done" + decision.yaml PASS | pass |
| §18.4 evidence-required (strict) | "appsec done" + 无 decision.yaml | stdout decision block + exit 0 |
| §18.4 evidence-required (lax) | 同上 | stderr warn + exit 0 |
| §18.5a prewrite | 直接 Write `.appsec/findings/x.yaml` 无 marker | stderr+exit2 |
| §18.5a prewrite | `appsec-sdk`-marker 合法 YAML | pass |
| §18.5b postverify | 落盘后发现 schema 错 | quarantine + updatedToolOutput follow-up |
| §18.6 secret-access-guard | Read `.env` | stderr+exit2 |
| §18.6 secret-access-guard | Read `.env.example` | pass |
| §18.6 secret-access-guard | Bash `printenv` | stderr+exit2 |
| §18.6 secret-access-guard | Bash `cat ./credentials.json` | stderr+exit2 |

### §19.3 Agent Output Schema Tests

- classifier 输出 → `.appsec/state.json` schema（必含 `activate / asvs_level / csf_targets / overlays / lifecycle_stage`）
- triager 输出 → finding schema v1.0 全字段 + ASVS regex
- validator 输出 → `appsec_release_decision.yaml` schema（含 nested `redaction:{attested,method}`）

### §19.4 End-to-End

Toy project（Express + npm + jwt + 文件上传）走完 §16 Step 0-9，bundle 必须：
- `redaction.attested == true`
- `csf2_coverage.{GV,ID,PR,DE,RS,RC}.status != MISSING`
- `findings_summary.critical == 0`
- `overlays_evidence.file_upload` 存在

---
