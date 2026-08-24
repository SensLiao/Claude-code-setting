# SKILLS-INDEX — 存活 skill 索引

> 2026-08-25 重写:orchestrator 全量退场后,库里只剩**工具型 skill**,人叫(`/名字`)为主、窄触发为辅。
> 旧的 13-Layer / 20-Route 路由体系随编排层删除,历史版本见 tag `pre-orchestrator-removal`。
> 可见性策略(`skillOverrides`)单一真相源:`manifests/skill-overrides.recommended.json`,由 `tools/skill-visibility/generate.js` 生成。

## UIUX 簇

### 基础(动手做 UI 前先过)
| skill | 干什么 |
|---|---|
| `ux-principles` | UX 基本原则 checklist,production UI 的前置关 |

### L3 主风格(一次只锁一个)
| skill | 风格 |
|---|---|
| `taste-skill` | premium/编辑感,含 Editorial / Double-Bezel / GSAP 三档变体 |
| `luxury` | 奢侈品质感 |
| `brutalist-skill` | brutalist |
| `emil-design-eng` | design-engineering 风 |
| `sens-frontend-design` | 自有前端设计体系 |
| `luxury-editorial-site-builder` | luxury editorial 整站构建(workflow 型的风格实现) |

### Workflow 型(不当主风格用)
| skill | 干什么 |
|---|---|
| `image-to-code-skill` | 截图 / 设计稿还原成代码 |
| `redesign-skill` | 既有 UI 重设计 |
| `prototyping-ui-directions` | 一个想法出多版方向原型供人选 |
| `anchor-prototype-wave` | 锁定 chassis 后并行铺全部页面(manual-first) |
| `imagegen-frontend-web` | 前端配图生成 |

### 设计系统 / 组件
| skill | 干什么 |
|---|---|
| `design-token-pipeline` | design token 流水线 |
| `theme-factory` | 主题生成 |
| `brandkit` | 品牌视觉套件 |
| `shadcn-registry` | shadcn 组件查询 |
| `canvas-design` | 画布类设计 |
| `motion-engineering` | 动效工程(Framer Motion / GSAP) |
| `ai-native-interface` | AI-native 界面范式 |

## 代码理解
| skill | 干什么 |
|---|---|
| `arch-viz` | 仓库 → 可提交的架构图 bundle(`docs/architecture/`) |
| `codegraph-cli` | callers / callees / 影响面 / 受影响测试(CLI-only) |

## 跨模型协作
| skill | 干什么 |
|---|---|
| `codex-dispatch` | 何时派活给 Codex + 跨模型 review playbook(官方 plugin,手动) |

## 制造器
| skill | 干什么 |
|---|---|
| `skill-creator` | 从 git 历史 / 会话提炼新 skill |
| `workflow-creator` | 编写 Workflow 工具的编排脚本 |

## 其他工具
| skill | 干什么 |
|---|---|
| `guide` | 本套配置的使用指南 |
| `meeting-analyzer` | 会议记录分析 |
| `competitive-teardown` | 竞品拆解 |
| `env-parity-baseline` | Docker / k8s / IaC 环境一致性基线 |
| `grill-with-docs` | 文档接地的连环追问 |
| `remotion-best-practices` | Remotion 视频最佳实践 |
| `output-skill` | 输出格式辅助 |
| `learned`(HOME-only) | /learn 沉淀的本机模式,不入库 |

## Evidence kit(不是 skill,是脚本 + agents)

`scripts/qa-sdk.sh` · `scripts/appsec-sdk.sh` · 顶层 `schemas/` 校验器 · agents:`qa-evidence-validator` / `appsec-evidence-validator` / `appsec-reviewer` / `appsec-finding-triager` / `security-remediation-engineer`。用法见 CLAUDE.md §4。
