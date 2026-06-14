# Glossary

| Term | Meaning |
|---|---|
| Orchestrator | 一条围绕某类任务设计的主流程，不只是单个 agent |
| GSD | Get Stuff Done，默认交付主线 |
| UIUX | 产品体验、视觉设计、交互质量主线 |
| QA | 测试、风险分级、发布准备度主线 |
| AppSec | 应用安全、平台安全、治理和证据裁决主线 |
| Hook | 执行强制层，用于拦截或校验高风险动作 |
| Evidence bundle | 发布裁决所需证据集合 |
| gate.check | 确定性门禁裁决入口 |
| spec_hash | 人工批准的 workflow spec 的哈希 |
| Sentinel | 表示某次批准在 TTL 内有效的标记 |
| ROE | Rules of Engagement，主动安全测试授权范围和规则 |
| Passive DAST | 只做被动检查，不发攻击 payload 的 baseline scan |
| Active scan | 会主动探测或验证漏洞的测试，必须 manual-only |
| Style lock | UIUX 中锁定单一设计方向的互斥文件 |
| Handoff | 一条主线把任务转交给另一条主线 |
| Deterministic runner | 按已批准 spec 执行的确定性 workflow runner |
| Dynamic workflow | 临时生成或动态编排的 workflow，只能用于侦察，不能裁决 release |
