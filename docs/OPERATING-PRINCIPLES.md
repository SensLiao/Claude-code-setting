# Operating Principles — 第一性原理（level-0 "why"）

> **Authority**: User-owned manifesto. 描述性 + 轻量生成性——它解释 / 论证 harness 已有机制，并新增两条 lightweight convention（review-cadence + admission rubric）。
> **Purpose**: 第一性原理：为什么这套 harness 长这样——它围绕哪一种稀缺（judgment）组织，以及由此推出的规则。读它来判断任何现存机制是否还配占位。
> **Source basis**: Doc2「从第一性原理出发思考运营 AI 原生初创公司」（step01–step12 + open questions）+ 现行 harness 实测机制。
> **Position**: 这是 level-0 的"why"，**位于** [CANONICALS.md](CANONICALS.md)（已批准决策）/ [ORCHESTRATOR-MAP.md](ORCHESTRATOR-MAP.md)（编排结构）/ [native-capabilities.md](native-capabilities.md)（平台事实）**之上**。那三份回答"是什么 / 怎么编排 / 平台给了什么"；本文件回答"为什么值得存在"。
> **Last reviewed**: 2026-06-03
> **Next review**: 2026-12-03

---

## 0. 这份文档不改动任何 safety control

先把边界说死，免得被误读为放松治理：

- **本文件改不了任何 safety control**。`spec_hash` 人类审批、evidence bundle、redaction attestation、ROE sign-off、CSF 2.0 / ASVS 5.0 coverage gate —— 全部**保持权威、保持不变**。本文件只提供"为什么"，不提供豁免。
- **不新增 hook、不新增 gate、不加 CI enforcement**。Section 6 的 self-sunset 与 Section 7 的 admission rubric 都是**约定（convention）**，不是机制。
- 与 CLAUDE.md §3.7「调轮次，留每一道 gate」一致：一个更诚实的模型可以**减脚手架轮次**，但**不能自签人类审批、不能豁免 redaction、不能给自己的 pentest 授权**。本 manifesto 同理——它降低的是"理解这套机器的成本"，不是任何 gate 的内部严谨度。

---

## 1. 稀缺前提（Doc2 step01–02）

组织存在只有一个理由：**分配稀缺资源**。不稀缺的东西没人围绕它建流程——没有"空气管理部"，因为空气不用抢；有 code review / 审批 / 截止日期，因为合格工程师的时间又贵又有限。每一道流程、每一个角色，都能追溯到它当初要解决的某一种稀缺；**当稀缺的东西变了，建在它上面的结构必须重新审视。**

传统软件公司稀缺三样：① 能写 code 的人 ② 分辨好坏 code 的**判断力（judgment）** ③ 多人协作的成本。AI 只让第①项变便宜了。code 产量暴涨 → 需要被判断的 code 量跟着暴涨 → **judgment 相对变得比以前更稀缺，不是更不稀缺**。瓶颈没消失，只是转移了。

> **点题**：这套 harness 的一切，都是为了分配并保护唯一稀缺资源——**人类操作者的判断力**。这里的"操作者"就是 user 本人（单人 operator + AI squad 的 Helix 形态）。harness 里所有看起来"重"的治理，本质是在把这一份稀缺的判断力，只花在真正值得花的地方。

---

## 2. 这买到了什么——把 Doc2 重述成 harness 已有的反射

Doc2 是一条推理链，不是一份愿望清单。下表把它推出的每一条，映射到 harness **已经在跑**的具体机制——证明这些机制不是堆砌，是同一个稀缺前提逼出来的反射。

| Doc2 推出的原则 | harness 里对应的既有机制 | 锚点 |
|---|---|---|
| 保护判断者的注意力（step03①、step05"在场"） | §0.5 大白话汇报去噪：先答"能干嘛 / 几成 / 现在能点到什么"，技术细节降级到末尾 | CLAUDE.md §0.5 |
| judgment 只用在判断昂贵处（step05"来龙去脉"） | model-routing 三 tier：opus 只在架构 / 安全 / 合规 / 终审出现，sonnet 主力，haiku 纯转换 | CLAUDE.md §4.5 + rules/common/performance.md |
| 决定必须留记录、必须公开（step08③、step10②、step12） | hash 链 + attested + 人签的 evidence bundle；`spec_hash` 进审批即锁定 | CLAUDE.md §3.6 / §3.7 |
| 小队自治、决定下沉到现场（step03④、step10③） | 并行 subagent fan-out + handoff schema；各 orchestrator 自主派发，不走集中审批堵车点 | rules/common/agents.md + native-capabilities.md Layer 3 |
| info 问题给机器、judgment 问题给人（step09"双击"） | §3.7 AI 当侦察兵出候选，deterministic spec-runner + 人类签字出 verdict | CLAUDE.md §3.7 |
| 验证环节前移（step09"把验证往前提"） | QA static baseline / preflight / preview gate 把机器能做的检查提前到 release 末端之前 | enterprise-qa-testing §18.5 |

> **一句话**：没有一条是风格，每条都是判断稀缺前提逼出来的。这也是 §0.5「诚实分三类」与 §3.7「governed gate」在 first-principles 上的同一个根。

---

## 3. 保护判断者的注意力（把隐性原则显性化）

前面散落在三个地方的东西，其实是同一条承诺，这里一次说明：

**harness 存在的首要目的，是让 user 的注意力只落在"机器决定不了的取舍"上，其余一律降噪 / 自动化 / 交给机器。**

它由三件已有机制共同兑现：

1. **§0.5 去噪**——对外叙述用业务语言，不让 user 承担理解 schema 名 / verdict 名 / hash 的成本（内部该跑的照样跑、照样严）。
2. **model-routing 节流**——opus 这种昂贵能力只出现在"错了代价大、跨模块、需要权衡"的判断点，不在高频转换上浪费。这等价于 Doc2 step05"判断力会因为远离一线而退化"的反向操作：把昂贵的判断算力留给真正的判断。
3. **§3.7 AI 侦察、人类签字**——Dynamic Workflow / ultracode 可以现场探索出候选，但 release verdict 必须回到 deterministic runner + 人类 `spec_hash` 审批。机器替人类**省掉了信息整理**，但**没替人类拍板**。

这三条合起来，就是"保护唯一稀缺资源"的工程化落地。

---

## 4. 决定留痕且公开——而且比 PR 更进一步

Doc2 step10②/step12 的结论是"所有有分量的决定必须留下记录、必须公开"，它给出的载体是 **PR**。本 harness **比这更强**：

- Doc2 的 PR = 决定摆到桌面让人看。
- 本 harness 的 evidence bundle = **hash 链 + attested + 人签**。不只是"看得见"，而是"改一条会被当场抓出来、谁签的字有据可查、过程可按 hash 重放"。

这是**承重墙（load-bearing wall），永不削弱**。它同时撑起两件事：组织清晰（决定可追溯）+ 单人 operator 形态下的自我问责（自己三个月后能凭记录回看当初为什么这么判）。

> 与 CLAUDE.md §3.7「调轮次，留每一道 gate」绑定：4.8 更诚实 → adversarial 脚手架可以减轮次；但 evidence-bundle 完整性 / spec_hash 审批 / redaction attestation 是**契约 + 监管义务**，不是防模型乱来的对冲。**调轮次，留每一道 gate。** evidence 这堵墙不在可调范围内。

---

## 5. info 问题给机器、judgment 问题给人（双击规则）

Doc2 step09"双击"式提问的本质，是把问题分成两类，分给两种处理者。harness 已把它 codify 成硬规则：

| 问题类型 | 归谁 | harness 锚点 |
|---|---|---|
| **info-retrieval 型**（"这段 code 什么意思 / 这个值是多少 / 配置在哪"） | **机器**——能 curl / 查库 / 读配置 / 跑一次就别问 user | 硬规则 #6「能自己验证的不要问用户」+ principles #2 |
| **judgment 型**（架构选型 / 安全取舍 / 业务规则 / 不可逆操作） | **人**——必须 user 拍板，不替用户补决策 | principles #3「以人类为准」+ §3.7 spec_hash gate（verdict 只能人签） |

判别准则（principles 已写）：**"这个决定如果错了，责任该由谁承担？"** 该由 user 承担 → 先问；机器能查清的事实 → 自己查，不烦 user。这正是 Doc2"区分信息中转 vs 判断"在执行层的落地。

---

## 6. 自我过期：harness 用它强加给产物的同一条规则约束自己【GAP — 新增约定】

Doc2 step10 第④条：**"所有流程自带保质期。到期没人复审，自动废除。"** 它处理的是任何组织最深的问题——**流程从不会自己死。**

**这里有一个真实的不对称（confirmed by analysis）：**

- harness **对它的项目产物**强制 self-expire：QA quarantine 带 `expiry_date`、evidence 有 freshness 窗口 + L12 `mark-stale`、SECURITY.md 带"Next AppSec Review Date"。
- harness **对它自己的治理机器**——skills / hooks / rules / SDK contracts / `docs/` 文档——**不带任何 `next_review` / sunset**。

> **那台给一切东西设保质期的机器，自己却永不过期。** 按 Doc2 step10④的逻辑，它本该也过期。

**轻量复审节奏约定（convention，非机制）：**

1. `docs/` 下的治理文档与 `rules/` 文件**宜在 frontmatter 带一行** `> Next review: <date>`（本文件已示范：见顶部 `Next review: 2026-12-03`）。
2. **过期 ≠ 自动删除**。过期 = 一次**"重新论证或裁撤（re-justify or retire）"**的提示：要么补一条它今天仍然成立的理由 + 顺延日期，要么裁撤。
3. **浮现位置**：这些 stale 的 `Next review` 日期，在**现有的 per-release 适应 pass 里**顺手浮现——即 [native-capabilities.md](native-capabilities.md) 每次 Claude Code 更新时做的 "consume vs shed"（Standing Adaptation Principle，line 4–5 + Layer 3 line 114「boundary moves toward platform each release; shed exactly that much」）。**不新开一个 pass**，搭在已有的那次例行复盘上。
4. **明确 defer 任何强制机制至少一个周期**。在本约定**至少跑满一个 review cycle（到 2026-12-03）之前，不建任何 auto-expire hook / gate**。理由是硬安全约束：**自动过期一份 safety 文档 = 可能删掉一个 control surface（control surface = safety boundary，见 CLAUDE.md §3.6「禁止改名」）**——这是红线，绝不为"自动化"提前触碰。先让约定证明自己有用，再谈是否值得机制化。

> 与 §0 一致：本节**不削弱任何 gate**。它只是把 harness 已经相信、并强加给别人的一条规则（流程要会死），诚实地也套到自己头上——而且用最克制的方式（一行注释 + 搭车浮现），不引入新的执行面。

---

## 7. 凭"拥有判断"准入，而非凭"存在"准入（招聘类比）【GAP — 新增约定】

Doc2 step11 把招聘整个翻了一遍：面试的目的是**预测一个人未来的判断质量**，不是查技能 / 履历（"技能到处都是、经验贬值快"）。唯一真正要筛的是——**这个人愿不愿意为自己的判断负责**。"这条标准并不更高，只是更窄。"

把这条类比到"一个新 skill / agent / rule 该不该进 canonical manifest"：**不能凭它'存在'就准入，要凭它'拥有真实判断面'才准入。** 准入 rubric（仅 rubric，不建工具）：

| Rubric 维度 | Doc2 对应 | 判定 |
|---|---|---|
| **拥有真实决策面** | "没有标准答案才叫判断，有标准答案只是执行" | 它得替系统做一件系统自己决定不了的事；纯查表 / 纯转发的不算 |
| **不重复现有** | "技能到处都是，不稀缺" | 与现有 skill 功能重叠 = 不准入（呼应 §5 反模式：collection / 大而全 skill 不抢 narrower skill 的活） |
| **带它所决定之物的 evidence** | step12"没有记录就没有声誉" | 它做的判断要落到 evidence / decision 记录里可追溯，不是黑箱 |
| **带 sunset 日期** | step10④"自带保质期" | 入册即带 `Next review`（与 Section 6 同一条约定），不带 = 不准入 |

**不予准入**：collection / 大而全（抢 narrower skill）、与现有重复、幻影 skill（`.claude/skills/generated/` 这类未经 canonical 提升的临时产物）。呼应 CLAUDE.md §5 反模式与 gitnexus / codegraph 这类"hand-held knife, 永不晋升为 harness subsystem"的既有边界。

> 同 Section 6：**这是 rubric，不是 gate**。它是一份准入时自查的清单，帮 user 在"是否把某个东西提升为 canonical"时做判断——把昂贵的准入判断，留给真正配占位的东西。

---

## 8. 开放问题（非约束性）

本节**明示非约束性**——记录"还没想清楚的"，不构成任何规则，不触发任何 gate。

**承自 Doc2 open questions：**

1. 模型能力继续涨，原本必须人做的判断里，哪些会被机器接管、哪些不会？这条边界往哪移，决定"判断者"角色未来的形状——也直接决定 §3.7 里"AI 能 scout 到多深 / 人类签字线划在哪"。
2. 平台分工（iOS/Android 式）在 AI 能跨平台灵活切换后，还要不要按平台分团队？（对单人 Helix 形态，等价于"要不要按技术栈分 orchestrator vs 按用户问题分"。）
3. 验证环节里，哪些能放心全自动 AI 审、哪些必须留一个人？这条线随模型变强一直前移——但**什么时候推、推到哪、谁来判断该推，本身就是一个 judgment**，不能自动化掉。
4. 这套体系在小团队好用；30 人长到 300 人时哪条规则先撑不住？还是它根本不该长那么大？

**harness 特有的开放问题：**

5. **声誉 = 问责，在单人 operator 下没有干净的类比。** Doc2 step12 的"职业声誉"机制依赖"同事会看、三个月后会评价"。单人 Helix 形态里，"同事"就是未来的自己 + evidence 记录。**per-skill track-record telemetry（哪个 skill 的判断历史上更靠谱）故意不建**——单人场景下收益不清且易过度工程化；**未来若 harness 服务于团队再议**。

---

> **底线重申**：本 manifesto 是 level-0 的"why"。它**解释并论证** harness，**新增两条约定**（self-sunset 复审节奏 + 准入 rubric），并**改不了任何 safety control**。spec_hash / evidence / redaction / ROE / CSF·ASVS gate 全部保持权威、保持不变。读它，是为了在任何时候都能回答同一个问题：**这条机制，今天还配占位吗？**
