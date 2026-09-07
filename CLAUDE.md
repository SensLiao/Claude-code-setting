# Claude-code-setting — 本仓维护规则

> 这是**这个仓库自己**的 project instructions,只在本仓工作时注入。
> 通用行为规则(沟通语言 / 汇报方式 / 预览卡 / 账本 / 硬规则 / 执行纪律)不在这里,在 `CLAUDE.global.md`。

---

## 1. 两份 CLAUDE.md 的分工(先读这条)

| 文件 | 身份 | 谁读到 |
|---|---|---|
| `CLAUDE.md`(本文件) | 本仓的维护契约 | 只在本仓工作时,作为 project instructions 注入 |
| `CLAUDE.global.md` | 全局通用行为规则 | 由 installer 部署为 `~/.claude/CLAUDE.md`,**任何项目**都读到 |

**改规则前先分清改的是哪一份**:与"在任意项目里怎么干活"有关的 → `CLAUDE.global.md`;与"怎么维护这套配置"有关的 → 本文件。

机制上靠 `claude-config.js` 的两处支撑,改 installer 时别碰坏:

- `SKIP` 含 `'CLAUDE.md'` —— 本文件**永不**部署,否则会覆盖全局那份。
- `RENAME` 把 `CLAUDE.global.md` 映射成部署路径 `CLAUDE.md`;`expectedBytes()` / `deployFile()` 用 `srcOf()` 反查真实源文件名。

---

## 2. 这个仓库是什么

`~/.claude` 的源。仓库里的 `agents/` `commands/` `skills/` `hooks/` `scripts/` `rules/` `docs/` `manifests/` `schemas/` `templates/` `orchestrator-runtime/` `tools/` 等目录整体同步过去;`settings.json` / `memory/` / `projects/` / `sessions/` 等属于用户本机,installer 从不写也从不删(`PRESERVE`)。

- 安装:`node claude-config.js install --apply`(首次,增量)
- 更新:`node claude-config.js update --apply --no-clean`(强制同步)
- 对账:`node claude-config.js status`
- 测试:`npm run test:harness`

**~/.claude 里有、仓库里没有的文件不在 GitHub 回滚通道内**——本机独有的东西改动前自己留份。

---

## 3. 库的形态(post-orchestrator)

没有编排主线、没有 auto-trigger 的重管线、没有 governed gate。两类资产,全部**人叫为主**:

| 资产 | 数量 | 怎么用 |
|---|---|---|
| 工具型 skills | 31 | `/名字` 显式调,或窄触发词自起(单一工具级);索引见 [SKILLS-INDEX.md](SKILLS-INDEX.md) |
| 通用 agents | 37 | `Agent` tool 派发,model 必 explicit(`CLAUDE.global.md` §3) |

另有 5 个接线 hook(`config-protection` / `block-no-verify` / `post-edit-format` / `design-quality-check` / `ledger-autolog`),清单与 dormant 项见 [manifests/hook-registry.json](manifests/hook-registry.json)。

skill 的 name + description 会自动进 context,SKILL.md 正文按需加载;`SKILLS-INDEX.md` **不会**自动加载,要用得主动读。

---

## 4. 已退场的东西(别找替身)

- **2026-08-25**:GSD / I2R / QA / AppSec / L12 / UIUX 编排层 / bootstrap 六线及下游共 ~250 件移除。整体快照在 tag `pre-orchestrator-removal`。
- **2026-08-28**:QA/AppSec evidence kit 移除(两个 SDK + 10 个 parser + 5 个 agent + 13 个 gate/verdict schema + 3 个专属测试)。它是已删编排器的证据接收器,从未产出过任何证据目录。`orchestrator-runtime/shared/` 下 `run-ledger.js`(ledger hook 用)、`git-context.js`(前者的依赖)、`preview-template.md`(预览卡模板)**保留**。
- **2026-09-07**:hash 承重残留清零。`orchestrator-runtime/shared/` 只剩上条那 3 个保留件,其余 11 个孤儿全删(`qa-recompute-gate.js` · `qa-aggregate-decision.js` · `spec-hash.js` · `run-fingerprint.js` · `validate-spec.js` · `resolve-capabilities.js` · `orchestrator-spec.v1.json` · `model-policy.md` · `lint-model-policy.js` · `install-subsystem-hooks.js` · `node-types.md`);`preview-template.md` 重写成纯指令层(去掉 workflow-spec 分支 / sentinel / spec_hash 校验);`schemas/run-ledger.schema.json` 与唯一活写入者 `ledger-autolog` 对齐(删 3 个永远为 null 的 hash 字段);`rules/security-appsec.md` 与 `docs/native-capabilities.md` 的死引用改正。**全库不再有任何用文件 sha 当 gate 的机制。**

需要那类流程时按 `CLAUDE.global.md` §0.6 出计划卡现场编排,**不要凭记忆调用已不存在的 skill 或脚本**。

---

## 5. 应急回滚

- **首选**:GitHub `SensLiao/Claude-code-setting`(private)按 commit 粒度回滚任意文件;要整体退回 orchestrator 时代用 tag `pre-orchestrator-removal`(checkout tag + `node claude-config.js update --apply --no-clean`)。
- 本地兜底:`~/.claude/backups/`(按日期目录)+ `settings.json.known-good-*.bak`。
- settings.json 治理键:`node ~/.claude/tools/ccswitch-guard/ccswitch-guard.js --check`(对账)/ `--capture`(重打快照)。`--restore` 会整体覆盖治理键——**先 `--check` 确认快照新鲜再用**。
