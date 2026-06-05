# Relocated from enterprise-qa-testing/SKILL.md — §7. CI 集成模式

## 7. CI 集成模式（三阶段）

| 阶段 | 触发 | 跑什么 | 目标时长 |
|------|------|--------|---------|
| PR fast lane | 每次 push to PR | Static + Unit + Component + Integration | < 3 min |
| Merge full lane | merge to main | 上面全部 + E2E sharded + a11y | < 10 min |
| Release quality gate | tag / release branch | 上面全部 + Visual + Lighthouse + Smoke | < 20 min |

**关键 CI 决策：**

- Playwright sharding：`--shard=1/3 2/3 3/3` matrix job + `merge-reports` 合并
- Visual baseline 必须在 CI Docker 生成（不在本地 Mac/Windows，避免像素漂移）
- 只安装 Chromium（`--browser=chromium`），减少 CI 时间 50%+
- `npm audit --audit-level=high` 作为 Static 层的 hard fail 条件
- Playwright traces 与 HTML report 必须作为 CI artifact 上传，失败时可下载分析
- Vitest 必须使用 reporter 写入 file（json/junit），让 CI 可以归档证据

---
