# manifest.json — Schema 与示例

> `.claude/manifest.json` 是 bootstrap 后的"装配记录",用于:
> 1. 让用户/团队成员知道项目装了什么
> 2. 让 `claude-env-bootstrap --update` 知道怎么 diff 全局变更
> 3. 让 user_modified=true 的本地改动不被覆盖

---

## Schema

```json
{
  "$schema_version": "2.0.0",
  "bootstrap": {
    "skill": "claude-env-bootstrap",
    "skill_version": "1.0.0",
    "created_at": "2026-05-23T10:30:00+10:00",
    "last_update_check": null,
    "compose_context": {
      "user_description": "Educational website proposal demo for an Australian after-school center",
      "delivery_form": "proposal_demo",
      "detected_tech_stack": ["nextjs", "typescript", "tailwind", "supabase"],
      "detected_workflows": ["sens-frontend-design", "gsd"],
      "ui_style_choice": "taste-skill",
      "rules_strategy": "copy_common_and_lang"
    }
  },
  "skills": [
    {
      "name": "sens-frontend-design",
      "source_path": "~/.claude/skills/sens-frontend-design",
      "target_path": ".claude/skills/sens-frontend-design",
      "global_version_at_install": "1.0.0",
      "global_version_at_last_update": "1.0.0",
      "installed_at": "2026-05-23T10:30:01+10:00",
      "last_updated_at": null,
      "user_modified": false,
      "user_modified_files": [],
      "selector_evidence": {
        "predicate": "ui_present == true",
        "matched_signal": "ui_present",
        "signal_value": true
      },
      "install_reason": "Project has Design/ folder with 3-stage structure — primary methodology",
      "tier": "T1"
    },
    {
      "name": "ux-principles",
      "source_path": "~/.claude/skills/ux-principles",
      "target_path": ".claude/skills/ux-principles",
      "global_version_at_install": "1.x.x",
      "global_version_at_last_update": "1.x.x",
      "installed_at": "2026-05-23T10:30:02+10:00",
      "last_updated_at": null,
      "user_modified": false,
      "user_modified_files": [],
      "install_reason": "Default base for any UI project",
      "tier": "T0"
    },
    {
      "name": "gsd-new-project",
      "source_path": "~/.claude/skills/gsd-new-project",
      "target_path": ".claude/skills/gsd-new-project",
      "global_version_at_install": "n/a",
      "global_version_at_last_update": "n/a",
      "installed_at": "2026-05-23T10:30:03+10:00",
      "last_updated_at": null,
      "user_modified": false,
      "user_modified_files": [],
      "install_reason": "Default GSD core",
      "tier": "T0"
    }
  ],
  "rules": {
    "strategy": "copy_common_and_lang",
    "copied": [
      {
        "source": "~/.claude/rules/common",
        "target": ".claude/rules/common",
        "files": ["coding-style.md", "git-workflow.md", "testing.md", "performance.md", "patterns.md", "hooks.md", "agents.md", "security.md", "principles.md", "task-execution-protocol.md", "development-workflow.md", "code-review.md"]
      },
      {
        "source": "~/.claude/rules/typescript",
        "target": ".claude/rules/typescript",
        "files": ["coding-style.md", "testing.md", "patterns.md", "hooks.md", "security.md"]
      },
      {
        "source": "~/.claude/rules/web",
        "target": ".claude/rules/web",
        "files": ["coding-style.md", "design-quality.md", "hooks.md", "patterns.md", "performance.md", "security.md", "testing.md"]
      }
    ]
  },
  "files_generated": [
    ".claude/CLAUDE.md",
    ".claude/manifest.json"
  ],
  "files_user_modified": []
}
```

---

## 字段含义

### `bootstrap.compose_context`

记录**为什么这样装** —— `--update` 时如果用户说"重新组合一遍",可以从这里抽出决策依据,不用重新问用户。

### `skills[].global_version_at_install`

复制时全局 SKILL.md frontmatter 的 `version:` 字段。

如果 skill 没有 frontmatter version(很多 gsd-* 没有),写 `"n/a"`。

### `skills[].user_modified`

`--update` 第一次跑时自动检测:
- 对比 `.claude/skills/{X}/` 内容与 `~/.claude/skills/{X}/`
- 若 hash 不同 → `user_modified = true`
- 列出哪些文件被改在 `user_modified_files`
- 后续 `--update` 跳过 user_modified=true 的 skill,除非用户强制 `--force`

### `skills[].selector_evidence`（v2 新增）

记录该 skill 被选中的依据:哪个 selector predicate 命中、命中的 signal key 与值。
VERIFY 阶段(§7.5.1)检查 `$schema_version >= 2.0.0` 且每个 skill 条目存在本字段,
缺失 → `manifest_v2_valid = false` → BLOCK。

### `skills[].install_reason`

一句话说"为什么装这个"。给未来的自己 / 团队成员看。

### `skills[].tier`

T0 / T1 / T2 / T3 / T4 / T5 / T6 / T7 / T8 / T9 / T10 / T11 — 对应 SKILL.md §7 的分类。`--update` 时可用 tier 做粗筛(例:"我只想看 T2 风格层的变更")。

### `rules.strategy`

- `copy_common_and_lang` — 复制 common + 检测到的语言 rules
- `copy_common_only` — 只复制 common
- `reference_global` — 不复制,在 CLAUDE.md 里引用 ~/.claude/rules/ 路径

### `files_user_modified`

记录用户后来手动改过的项目内文件(不限于 skill 内)。`--update` 不会动这些。

---

## `--update` 时的对比逻辑

```python
# pseudocode
manifest = read_json(".claude/manifest.json")

for skill in manifest.skills:
    global_path = skill.source_path
    local_path = skill.target_path

    # 1. 检测本地是否被改过
    if files_differ(local_path, frozen_snapshot(skill)):
        skill.user_modified = True
        skill.user_modified_files = diff_files(local_path, frozen_snapshot)

    # 2. 检测全局是否更新
    current_global_version = read_skill_md_version(global_path)
    if current_global_version > skill.global_version_at_last_update:
        propose_update.append(skill)

    # 3. 如果 user_modified 且全局也更新 → 警告冲突
    if skill.user_modified and skill in propose_update:
        warn_user_conflict(skill)

# 用户选哪些 update,然后:
for skill in user_selected:
    copy_dir(skill.source_path, skill.target_path)
    skill.global_version_at_last_update = current_global_version
    skill.last_updated_at = now()
    skill.user_modified = False  # 用户接受了覆盖
    skill.user_modified_files = []
```

---

## 完整示例(本教育网站项目可能长这样)

```json
{
  "$schema_version": "2.0.0",
  "bootstrap": {
    "skill": "claude-env-bootstrap",
    "skill_version": "1.0.0",
    "created_at": "2026-05-23T10:30:00+10:00",
    "last_update_check": null,
    "compose_context": {
      "user_description": "Educational website proposal for Australian after-school center — needs WordPress landing + internal teaching system + clickable HTML prototype",
      "delivery_form": "proposal_demo",
      "detected_tech_stack": [],
      "detected_workflows": ["sens-frontend-design"],
      "ui_style_choice": "user_will_decide_in_stage_1",
      "rules_strategy": "copy_common_and_lang"
    }
  },
  "skills": [
    { "name": "sens-frontend-design",    "tier": "T1", "install_reason": "Has Design/ with 3-stage structure",        "user_modified": false },
    { "name": "ux-principles",            "tier": "T0", "install_reason": "Default for any UI project",                "user_modified": false },
    { "name": "emil-design-eng",          "tier": "T9", "install_reason": "Animation detail review for proposal demo", "user_modified": false },
    { "name": "grill-with-docs",          "tier": "T5", "install_reason": "Client requirements still emerging",         "user_modified": false },
    { "name": "competitive-teardown",     "tier": "T5", "install_reason": "Need competitor analysis for proposal",      "user_modified": false },
    { "name": "gsd-new-project",          "tier": "T0", "install_reason": "GSD core",                                    "user_modified": false },
    { "name": "gsd-spec-phase",           "tier": "T0", "install_reason": "GSD core",                                    "user_modified": false },
    { "name": "gsd-discuss-phase",        "tier": "T0", "install_reason": "GSD core",                                    "user_modified": false },
    { "name": "gsd-plan-phase",           "tier": "T0", "install_reason": "GSD core",                                    "user_modified": false },
    { "name": "gsd-execute-phase",        "tier": "T0", "install_reason": "GSD core",                                    "user_modified": false },
    { "name": "gsd-verify-work",          "tier": "T0", "install_reason": "GSD core",                                    "user_modified": false },
    { "name": "gsd-ship",                 "tier": "T0", "install_reason": "GSD ship phase",                              "user_modified": false },
    { "name": "gsd-resume-work",          "tier": "T0", "install_reason": "Cross-session continuity",                    "user_modified": false }
  ],
  "rules": {
    "strategy": "copy_common_and_lang",
    "copied": [
      { "source": "~/.claude/rules/common", "target": ".claude/rules/common" },
      { "source": "~/.claude/rules/web",    "target": ".claude/rules/web"    }
    ]
  },
  "files_generated": [
    ".claude/CLAUDE.md",
    ".claude/manifest.json"
  ],
  "files_user_modified": []
}
```

---

## 注意事项

- **路径**:Windows 用正斜杠 `/` 或双反斜杠 `\\`,JSON 解析才不出错
- **时间戳**:用 ISO 8601 带时区(项目可能多人多时区协作)
- **大小**:这文件应该 < 50KB。如果膨胀过大,说明装了太多 skill,需要复审
- **git-tracked**:`.claude/manifest.json` 应该 commit 到仓库,team 共享
- **不要手改**:用户改动应该通过 `claude-env-bootstrap --update` 处理,直接手改 manifest 会破坏 `--update` 的 diff 逻辑
