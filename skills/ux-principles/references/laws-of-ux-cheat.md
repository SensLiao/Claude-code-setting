# Laws of UX — Cheat Sheet（缓存版 25 条）

> 来源：[lawsofux.com](https://lawsofux.com) — Jon Yablonski 维护。
> 用法：MODE A 选 4-6 条适用 law 写进 brief 头部；MODE C 跑完 prototype 后统计命中数 + 列违例。
> 冷门内容查具体页：`WebFetch https://lawsofux.com/<slug>/`

---

## 顶层 8 条（覆盖 80% 场景，必看）

### 1. Hick's Law — 选择越多决策越慢
- **定义**：决策时间 = 选项数 + 选项复杂度的对数函数
- **UI 应用**：单屏一级选项 ≤ 5；超过就分组 / 隐藏 / 默认
- **反例**：landing page 顶部一排 12 个导航 link
- **正例**：5 个一级 + "More" 折叠剩余

### 2. Fitts's Law — 目标越大越近越容易点
- **定义**：到达时间 = log2(distance / size + 1) × 系数
- **UI 应用**：clickable 区 ≥ 44×44px（移动）/ 32×32px（桌面 icon button）；最重要 action 放屏幕角 / 边（无穷大目标）
- **反例**：12px × 12px 的"close" icon
- **正例**：44px 行 + 16px icon padding-around

### 3. Miller's Law — 短期记忆 7±2 chunks
- **定义**：人能短期记住 7±2 个 chunk
- **UI 应用**：单工具栏 ≤ 7 按钮；单 chip 排 ≤ 7；超出分组
- **反例**：toolbar 上 12 个 button 平铺
- **正例**：6 个 button + 1 个 overflow ⋯

### 4. Doherty Threshold — 400ms 是用户耐心边界
- **定义**：response time < 400ms 用户感到"流畅"
- **UI 应用**：超过 100ms 给 loading；超过 400ms 用 skeleton / optimistic update
- **反例**：点提交后页面空白 2 秒
- **正例**：点提交后立刻 optimistic 显示成功 + 后台校验

### 5. Aesthetic-Usability Effect — 好看 = 用户认为更好用
- **定义**：视觉上 pleasing 的界面用户感知为更易用，且更宽容缺陷
- **UI 应用**：信息架构再清晰，视觉烂用户依然放弃；不要"先做对再美化"
- **反例**：功能全但 default Tailwind 灰白卡 + 居中 hero
- **正例**：哪怕 MVP 也要 visual chassis 一次到位

### 6. Jakob's Law — 用户已习惯别家产品
- **定义**：用户在你产品上的大部分时间是在 OTHER 产品上
- **UI 应用**：custom 模式收敛到行业 convention（搜索框在顶部 / 设置在右上 / save 在底部右侧）；不要在导航位置原创
- **反例**：把"Save"放左上角
- **正例**：CRUD 用 GitHub Issues / Notion / Linear 的位置约定

### 7. Peak-End Rule — 体验记忆 = 峰值 + 结尾
- **定义**：用户记一次体验主要靠"最强烈瞬间 + 结束瞬间"两个点
- **UI 应用**：优化关键操作的 success 瞬间（peak）+ 任务结束的最后一步（end）；过程烂没事，end 要好
- **反例**：流程顺，提交后 toast "已提交"就结束
- **正例**：提交后给个 "12 个 task 已分配 / 预计 3 天完成" 的 summary screen

### 8. Tesler's Law — 复杂性守恒
- **定义**：每个系统都有不可削减的复杂度；要么用户承担，要么开发者承担
- **UI 应用**：能在后端隐藏的复杂度不要露给用户；露给用户的部分要明确教育
- **反例**：让用户填 OAuth scope 名（开发者应该 default）
- **正例**：勾选 capabilities（read / write / subscribe）就够，scope 自动派生

---

## 第二层 9 条（高频）

### 9. Goal-Gradient Effect — 越接近目标越快
- 进度条 / step indicator / "still 2 to go"
- 反例：8 步表单全平铺无进度
- 正例：top 显 progress bar + "Step 3 of 5"

### 10. Pareto Principle (80/20) — 20% 功能服务 80% 用户
- 把 20% 高频功能放主路径，80% 长尾收 advanced
- 反例：settings 顶层 12 tab 全平铺
- 正例：3 顶层 + "Advanced" 展开 9 个

### 11. Law of Proximity — 接近的元素被感知为一组
- 用 spacing 而不是 border / shadow 分组
- 反例：每个 card 都 1px 黑边
- 正例：相关 group 间距 8px，组间间距 32px

### 12. Law of Similarity — 同形 = 同类
- 同 status 用同 chip 风格；不同 status 必须可视区分
- 反例：所有 chip 一个色，靠 text 区分
- 正例：amber-bg = blocked / red-bg = error / mono = neutral

### 13. Law of Common Region — 同区域被感知为一组
- 不必每组都画边框；浅 sunken 背景 / 短分割线足够
- 反例：3 个 group 各画一圈 box
- 正例：背景 #f5f5f5 sunken + 内部 transparent

### 14. Von Restorff Effect — 异类突出
- 突出关键 action 用"和周围不同"（不是用更鲜艳）
- 反例：12 个等大 button 排一行，最右一个红色突出（视觉噪音）
- 正例：12 个 ghost button + 1 个 filled primary

### 15. Serial Position Effect — 首尾被记住中间被忘
- 关键信息放列表首尾；不要把 primary CTA 埋中间
- 反例：8 个 step 的 wizard，关键 step 在 #5
- 正例：关键 step 放 #1 或 #last

### 16. Zeigarnik Effect — 未完成任务在记忆中更活跃
- 给"未完成"的事一个明显的入口（红 dot / inbox 数字 / progress bar）
- 反例：通知中心不显未读数
- 正例：sidebar 红 dot + 数字

### 17. Chunking — 把信息拆成 chunk 更易记
- 电话号码分段；密码强度分组；表单 step 分块
- 反例：把 8 个字段塞一个长 form
- 正例：2-2-3 分组 step

---

## 第三层 8 条（情境性）

### 18. Cognitive Load — 工作记忆负担
- 一屏总信息量上限；老用户也会因疲劳出错
- 措施：信息 progressive disclosure / contextual help

### 19. Postel's Law — 输入宽容，输出严格
- 接受用户多种输入格式，自己输出 canonical
- 例：日期输入接受 "May 14, 2026" / "2026-05-14" / "今天"；输出统一 ISO

### 20. Paradox of the Active User — 用户跳过教程直接用
- 不要假设用户读完 onboarding；UI 自身要可学
- 措施：empty state 教学 / contextual tooltip / 第一次 hover hint

### 21. Selective Attention — 注意力是稀缺资源
- 一屏只一个 primary action；hover 才显次要
- 反例：8 个等高度 CTA
- 正例：1 primary + 1 secondary ghost

### 22. Working Memory — 容量 ≈ 4 items
- Miller 是 7±2 的近似，实测 working memory 约 4
- 措施：复杂表单 < 4 字段一屏；不行用 wizard

### 23. Flow — 进入沉浸状态的条件
- 难度匹配能力；明确目标；即时反馈
- 措施：keyboard shortcut / 不打断 / response < 100ms

### 24. Occam's Razor — 简单解释优先
- 不要为边缘情况堆 UI；为 main path 优化
- 反例：5 种 edge case 都做 modal
- 正例：toast + 文档链接

### 25. Mental Model — 用户头脑里的产品工作模型
- 用户行为遵循其 mental model 而不是真实系统
- 措施：用户调研 / Jakob's Law 默认约定 / 早期 testing

---

## 在 prototype writeup 里如何标注命中

每个 prototype writeup §4 "Laws of UX Applied"：

```markdown
4 conditional + 2 universal hit:

- **Hick's Law**: 4-tab Marketplace nav (NODE / WORKFLOW / SOP / CONNECTOR) capped at 4 top-level categories, "More" available via search.
- **Fitts's Law**: every clickable row 44px+, primary CTA 36px height in bottom-right corner.
- **Miller's Law**: filter chip strip max 6 chips per row, additional via "+N more".
- **Aesthetic-Usability**: visual chassis (Inter + 8px radius + hairline + mono accent) applied consistently across all 38 surfaces.
- **Doherty Threshold**: progress bar 2px height on every running agent_run; loading skeleton on all data fetches > 100ms (mocked).
- **Peak-End Rule**: case-create stepper ends with "12 nodes / 4 modules / 6 roles created — start work?" summary CTA.
```

**目标**：4-6 hit per surface。少于 4 = brief 没想清楚；多于 8 = 套话。

---

## 与项目 anti-pattern 关联（agent-console 专用扩展）

- 违反 Hick → Marketplace 顶层 chip > 4 类（已修，HARD RULE #6 锁定 4 类）
- 违反 Jakob → 把 "Save" 放在左侧（Settings 多 tab 必须右下 floating action）
- 违反 Tesler → 让用户填 GitHub installation ID（已修，auto-discover）
- 违反 Peak-End → 任务结束只 toast"已完成"（要 summary card）
- 违反 Doherty → agent run 没 progress bar（已修，2px progress strip）
