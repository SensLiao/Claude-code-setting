# Companion Skills

> **本 skill 不绑死任何外部 skill**。所有 companion 都是**可选**的；装了会增强，不装走降级路径。
>
> Program Director 在 Step 2（Companion 检测）跑一次 Skill 工具列表扫描，命中即用，没命中即 fallback。

## 推荐安装（按优先级）

### 1. `taste-skill` — Stage 3 红队 / anti-slop 守门
- **作用**：variant 生成后做 anti-slop 红队；找出 generic template / Lorem ipsum / 居中标题 + gradient blob 等死法
- **安装**：见原 skill 安装指引（https://github.com/... — 用户自己 source）
- **不装**：主线程按 `references/anti-patterns.md` 自审。这是降级，**自审弱于红队**，建议装。

### 2. `grill-with-docs` — Stage 0 压实模糊点
- **作用**：用户说"我做个 X"但 X 模糊时，做 grilling session 把 X 压到可执行
- **不装**：主线程用 AskUserQuestion 兜底，效果稍弱但能用

### 3. `frontend-design` — Stage 3 HTML 写得更有质感
- **作用**：避免默认 AI-slop 美学；写出 distinctive、production-grade 的 HTML
- **不装**：主线程写基础 HTML（能用，质感差一截）

### 4. `design-system` — Stage 2 调色板 / typography 候选输入
- **作用**：从 58 个真实 brand 里挑相近候选，给 Stage 2 direction 收敛更多输入
- **不装**：纯从 Stage 1 reference 提取，候选可能更狭窄

### 5. `competitive-teardown` — Stage 1 reference 选型 / Stage 2 对比
- **作用**：12 维 feature matrix + positioning map，帮选哪些 reference 值得深入
- **不装**：主线程手写 cross-reference matrix，效果可接受

### 6. `codex-dispatch` — Stage 3 多 variant 并行加速
- **作用**：把每个 variant 派给 Codex CLI 并行生成，省 Claude token + 提速
- **不装**：Claude subagent (Task) 并行，token 重一些但能跑

## 安装指引（统一）

每个 companion 都是独立 skill / plugin，安装方式：

```bash
# 方式 1：通过 Claude Code marketplace（部分 skill 适用）
/plugin install <skill-name>

# 方式 2：手动放进 ~/.claude/skills/
cd ~/.claude/skills
git clone <skill-repo-url> <skill-name>

# 方式 3：从 ~/.claude/skills-archive/ 移回（如果之前归档过）
mv ~/.claude/skills-archive/.../<skill-name> ~/.claude/skills/
```

> 本 skill 不替你装。用户自己挑装哪几个。

## 检测脚本（Program Director Step 2 跑）

伪代码：

```
for skill in [grill-with-docs, taste-skill, frontend-design, design-system, competitive-teardown, codex-dispatch]:
  detected = skill in available_skills_list
  state['companion_skills_detected'][skill] = detected
```

`available_skills_list` 来自每次会话开头的 `<system-reminder>` 里 `The following skills are available for use with the Skill tool` 段。

## 不强制依赖的好处

- **可分发**：把本 skill 集打包给别人用，对方不需要装 6 个其他 skill
- **可降级**：少装 / 漏装一个 companion 不卡流程
- **可替换**：以后出了更好的红队 skill / 设计 skill，替换 companion 名字即可，主流程不动
