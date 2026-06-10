# Canvas — Reference Anchors

> **5-7 个真实的 gold-standard 节点编辑器 / 白板范例**，供 reference-grounding pipeline（Stage 1）消费，把 variant 锚定到真实设计智慧，而不是 AI 默认审美。
>
> 每个锚点 = **name / where（哪里看得到）/ why exemplary（为何是标杆）/ study ONE thing（只学这一件事）**。
>
> 用法（Stage 1）：从下表选 **至少 2 个**与目标产品最接近的范例，把"study ONE thing"作为该 variant 必须体现的具体技法。不要泛泛说"参考 tldraw"，要落到具体那一件事。
>
> 注意：这些是**交互范式与空间结构**的标杆。它们各自的视觉皮肤（色、字、质感）不是你要照搬的——皮肤由锁定的 L3 决定。你锚定的是它们**怎么组织画布、怎么做选择与拖拽、怎么处理 zoom 与 auto-layout**。

---

## 1. tldraw

- **where**：`tldraw.com`（开箱即用的公开白板；开源 `github.com/tldraw/tldraw`，前端实现可直接读）
- **why exemplary**：无限画布交互的天花板。selection / 多选框选 / 拖拽 / resize handle / 旋转 / snap-to-guide / 缩放手感全部丝滑到像原生 app；空白画布也不让人无措。空间化直接操作（direct manipulation）的范本。
- **study ONE thing**：**selection + resize/rotate handle + snap 对齐线** —— 选中一个或多个对象后浮出八向 handle，拖动时实时吸附到其它对象的边/中线并画出 guide。学它"选中即可精确操作、对齐有反馈"（对应 interaction.md 的选择模型 + six-rules #2 创意只在反馈层）。

---

## 2. Excalidraw

- **where**：`excalidraw.com`（公开免登录；开源 `github.com/excalidraw/excalidraw`）
- **why exemplary**：手绘风白板的代表，但交互模型极其克制扎实。工具切换（选择/矩形/箭头/文字）、元素绑定箭头（箭头跟随被连接对象移动）、键盘快捷键、协作光标——所有"画图工具该有的"它都做到了零学习成本。
- **study ONE thing**：**箭头/连线与节点的绑定关系（move 节点连线自动跟随）** —— 连线两端 attach 到对象后，移动对象时连线自动重算端点与路径。学它把"连接不是画上去的死线、而是活的关系"做实（对应 interaction.md 的 edge / 连接语义 + patterns-index 的边/信号）。

---

## 3. n8n

- **where**：`n8n.io`（开源 workflow 自动化；可自托管或 cloud，进真实 workflow editor）
- **why exemplary**：节点流程编辑器（pipeline / DAG）的代表。节点 = 卡片，端口 = 连接锚点，连线 = 数据流；节点的输入/输出 port、执行状态、内嵌配置面板的组织是 workflow designer 的成熟形态。
- **study ONE thing**：**节点 port 连接 + 数据流方向的可视化** —— 每个节点左入右出的 port 明确，从一个 output port 拖到另一个 input port 建连，连线带方向感，执行时高亮数据流路径。学它"节点是带类型端口的盒子、连线是有向数据流"（对应 patterns-index 的边/信号 + layout-engines.md 的 Structured/dagre 有向布局）。

---

## 4. Dify

- **where**：`dify.ai`（开源 LLM app 平台；进 workflow / agent 编排画布）
- **why exemplary**：AI agent / LLM pipeline 编排画布的代表。在 n8n 式 DAG 基础上叠了"节点 = LLM/工具/逻辑步骤"的语义；节点配置抽屉、分支条件节点、变量在节点间传递的呈现，是 agent 工作面（agentic canvas）的当代范本。
- **study ONE thing**：**节点配置抽屉（点节点开 side drawer 编辑，不离开画布）** —— 双击/点击节点从右侧滑出配置面板，编辑参数时画布上下文仍在，关掉即回。学它"在画布上就地编辑节点、不跳页破坏空间感"（对应 interaction.md 的不可阻塞操作 + six-rules #5）。

---

## 5. Flowise

- **where**：`flowiseai.com`（开源 LLM flow builder；进 chatflow / agentflow 画布）
- **why exemplary**：拖拽式 LLM flow 搭建的代表。左侧节点库（拖出即用）、画布上按类型分色的节点、节点间强类型连接校验（不兼容的 port 拒绝连）——把"积木式搭 pipeline"的可发现性做得很直白。
- **study ONE thing**：**左侧节点库拖拽入画布 + 强类型连接校验** —— 从分类节点库把节点拖到画布，连线时按 port 类型校验、不兼容直接拒绝并给反馈。学它"组件可发现（库里能找到）+ 连接有类型纪律（连错会被挡）"（对应 patterns-index 的 Seed Create + six-rules #1 操作语义保持传统）。

---

## 锚定执行规则（Stage 1 必读）

1. **选 ≥2 个**与目标产品类型最接近的范例：
   - 自由白板 / 手绘 → tldraw + Excalidraw
   - 通用 workflow / DAG 自动化 → n8n + Flowise
   - AI agent / LLM pipeline 编排 → Dify + Flowise + n8n
   - 空间化直接操作（拖拽/缩放/对齐为主）→ tldraw + Excalidraw
2. 把选中范例的 **"study ONE thing"** 写进 Stage 2 提取卡的 "canvas pattern observed"，并要求 Stage 3 variant **具体体现**这件事
3. **锚定的是交互范式与空间结构，不是皮肤** —— 颜色/字体/质感跟随锁定的 L3，不照搬范例的视觉
4. 禁止"泛泛参考"：必须落到具体一件可验证的技法（如"像 Excalidraw 那样做连线跟随节点移动"），红队会核 variant 是否真的做到了（对应 `six-rules.md` gate）
