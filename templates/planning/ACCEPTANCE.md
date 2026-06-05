# Acceptance Standard

> 此文档定义本项目所有 milestone / phase / feature 的验收标准。
> 由 `claude-env-bootstrap` 从全局模板复制至项目 `.planning/`。
> 由 `gsd-pipeline-orchestrator`（尤其 `gsd-spec-phase` + `gsd-verify-work`）维护。
> 填写说明：per milestone 使用时，将 `{{...}}` 替换为实际内容，勾选完成项。

---

## Per Milestone — Required Dimensions

每个 milestone 验收必须覆盖以下 8 个维度。任一维度无 evidence → **不接受**。

---

### 1. Functional Acceptance

- [ ] 业务目标达成证据（数字或可观察事实，非主观描述）
- [ ] User scenario 全跑通 — covered scenarios：`{{list}}`
- [ ] Edge case 覆盖：`{{empty state / error path / boundary input}}`
- [ ] 已知 limitation 文档化（非隐瞒）

### 2. UX Acceptance

- [ ] 用户流程顺畅（截图 / video evidence 附上）
- [ ] Error / empty / loading states 全部有 UI（无孤立 undefined state）
- [ ] 反馈机制完整：toast / inline error / loading indicator
- [ ] Hover / focus / active states 已设计（非浏览器默认）
- [ ] Copy / labels / CTA 语言一致，无占位符残留

### 3. Responsive Acceptance

- [ ] 测试 viewport：320 / 375 / 768 / 1024 / 1440 / 1920
- [ ] 无 horizontal overflow（任意 viewport）
- [ ] Touch interactions 在 mobile 正常
- [ ] Light / dark theme（若双主题）均已验证
- [ ] 字体、图片、间距在各 viewport 无错位

### 4. Data / API Acceptance

- [ ] Schema validation server-side（Zod / Joi / Pydantic）
- [ ] Response format 一致（envelope pattern：`{success, data, error, meta}`）
- [ ] Pagination metadata 正确（total / page / limit）
- [ ] 4xx / 5xx / timeout / malformed response 全部有处理路径

### 5. Failure Handling Acceptance

- [ ] Network failure → graceful degradation（非白屏）
- [ ] Server error → user-friendly message（无 stack trace 泄露）
- [ ] Auth expiry → re-auth flow（非静默失败）
- [ ] Rate limit → backoff strategy 文档化
- [ ] Optimistic update → rollback on failure + visible feedback

### 6. Quality Gates（per QUALITY.md）

- [ ] Static：typecheck / lint / format / dep audit / secret scan — all pass
- [ ] Unit：coverage ≥ `{{target}}`%（terminal stdout attached）
- [ ] Component：critical interactions tested
- [ ] Integration：API + state + auth flow covered
- [ ] E2E：critical user journeys pass（含 async Server Components）
- [ ] Visual regression：theme / layout / breakpoint baseline OK（若启用）
- [ ] Accessibility：0 critical axe violations
- [ ] Performance：CWV targets met（或 documented exception for internal tools）
- [ ] Smoke：post-deploy verification green

### 7. Security Acceptance（若 AppSec triggers present）

- [ ] AppSec baseline complete（per QUALITY.md §AppSec）
- [ ] OWASP ASVS L1 mapping satisfied（V2 / V3 / V4 / V5 / V8 / V9）
- [ ] OWASP WSTG passive sections checked
- [ ] API Top 10 mapping satisfied（若有 API）
- [ ] Security headers verified（CSP / HSTS / SameSite / Secure / HttpOnly）
- [ ] No secrets in code / commits / logs（gitleaks report attached）
- [ ] 若 pentest 运行：ROE complete + report attached + remediations applied
- [ ] Risk register reviewed，remaining risks 有 owner + deadline

### 8. Delivery Evidence

- [ ] Implementation summary written（改了什么、为什么、影响范围）
- [ ] All commits 可追溯至 acceptance criteria 条目
- [ ] PR description 覆盖以上各维度 evidence
- [ ] CI green（全部 lanes，link attached）
- [ ] Preview deployment URL active
- [ ] Smoke test report attached
- [ ] Release notes drafted（user-visible changes only）

---

## Definition of Done (DoD)

一个 feature / phase / milestone **未完成**，除非以下全部满足：

- [ ] Implementation summary 已写
- [ ] 以上 8 个 dimension 全部 acceptance criteria checked
- [ ] 所有 quality gates passed（terminal evidence attached）
- [ ] 无 CRITICAL 或 HIGH open issue（或已有 risk acceptance + owner + deadline）
- [ ] Test evidence（测试运行 stdout）attached
- [ ] Remaining risks 文档化
- [ ] Rollback path verified
- [ ] User-visible behavior changes 文档化
- [ ] Recommended next action stated

---

## Anti-patterns

以下任意一项出现 → milestone **不接受**：

- ❌ 任何 dimension 的 acceptance criteria 缺失
- ❌ 系统级 feature 仅有 unit tests，无 integration / E2E
- ❌ 视觉改动后未更新 visual regression baseline（若 Layer 7 已启用）
- ❌ Preview deployment 但无 smoke test report
- ❌ Backend / API / auth 改动但未过 AppSec gate
- ❌ Active pentest 未有书面授权 + ROE + scope 文档
- ❌ "Tests pass" 声明但无 terminal stdout 证据
- ❌ Coverage 下降但无 justification
- ❌ Critical issues 标注 "fix later" 但无 owner + deadline

---

## How to Use This Template

| 使用场景 | 操作 |
|---|---|
| Per milestone 验收 | 复制此文件（或相关章节）到 milestone tracking |
| Per phase（gsd-plan-phase） | 将每个 phase 映射至适用的 dimension |
| Per feature | 用 DoD checklist 作为完成门控 |
| Per release | 用 §8 Delivery Evidence 作为 release notes 输入 |

**工作流串联：**
- `gsd-spec-phase` → 确定 WHAT，写入 §1 Functional 初稿
- `gsd-plan-phase` → 确定 HOW，映射 §6 Quality Gates
- `gsd-execute-phase` → 执行，持续勾选各 dimension
- `gsd-verify-work` → 最终 review，确认 DoD 全部满足
- `gsd-ship` → 以 §8 Delivery Evidence 为发布 checklist
