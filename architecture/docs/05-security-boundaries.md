# Security Boundaries

这份文档专门描述安全边界，尤其是 AppSec 与 offensive capability 的边界。

## 1. Safety stance

```text
Default = defensive.
Active offensive = manual-only.
Production active scan = hard refused.
```

## 2. Passive vs active

| 类别 | 是否可自动 | 例子 | 条件 |
|---|---|---|---|
| Passive baseline | 可以 | ZAP baseline passive、headers check | 授权 staging/preview |
| Defensive review | 可以 | auth review、secret scan with redact、SCA | 不触碰真实攻击 |
| Planning-only red/purple | 可以 | MITRE ATT&CK mapping、detection coverage | 不执行攻击 |
| Active pentest | 不可以自动 | exploit validation、active scan | ROE + manual exact authorization |

## 3. ROE 必备字段

| 字段 | 说明 |
|---|---|
| target | 测试目标 |
| authorization_proof | 授权证明 |
| environment | staging / preview / test，不能是 production |
| scope | 明确 in-scope 资源 |
| allowed | 允许动作 |
| disallowed | 禁止动作 |
| time_window | 授权时间窗 |
| rate_limits | 速率限制 |
| test_accounts | 测试账号 |
| data_handling | 数据处理方式 |
| emergency_contact | 紧急联系人 |
| rollback | 回滚或停止计划 |
| reporting | 报告格式和交付对象 |

## 4. Active scan guard

Active scan guard 应拦截典型高风险命令，除非满足全部条件：

```text
ROE exists
AND target in scope
AND current time within time_window
AND environment is not production
AND exact human authorization phrase exists
```

## 5. 禁止行为

| 行为 | 处理 |
|---|---|
| 对 production host 主动扫描 | BLOCKED |
| 未授权 target | BLOCKED |
| scope 外资产 | BLOCKED |
| DoS / destructive payload | BLOCKED |
| credential theft / exfiltration | BLOCKED |
| persistence / stealth | BLOCKED |
| 绕过 redaction 的 secret 输出 | BLOCKED |

## 6. 安全文档展示建议

在 GitHub 上展示安全能力时，不要把重点放在“能攻击什么”，而要放在：

- 如何证明 scope；
- 如何确保不越界；
- 如何 redaction；
- 如何把发现映射到 ASVS / CSF；
- 如何用 evidence gate 做 release decision。
