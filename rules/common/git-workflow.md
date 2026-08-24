# Git Workflow

## Commit Message Format
```
<type>: <description>

<optional body>
```

Types: feat, fix, refactor, docs, test, chore, perf, ci

Note: Attribution disabled globally via ~/.claude/settings.json.

## Final-Output Hygiene

**交付文案只描述最终状态。** commit、PR 标题与正文、代码注释、发布说明只写最终 diff 里真实存在的东西。
读者没参与这次会话，不该从文案里读出会话的过程——我提过什么、你否了什么、改了几版。

**判据是「基线里真的发生过吗」，不是「有没有出现否定词」。** 基线按位置取：commit 看父 tree 或
staged diff，PR 看目标分支 merge-base，发布说明看上一个已发布版本。未提交 ≠ 被否：任务开始前就有的
改动保留归属，不算本次成果也不算被否草稿。

**否定性知识要留，只是别放在文案里。** 判别式：删掉这次会话，这句话还成立吗？成立的是知识——领域
边界、「X 不能定义成 Y」、以后会踩的不变量、持久的「不采用 X」决策——写进 ADR、设计文档或正文。
只在「有过这次纠正」的前提下才成立的，才是残留。真实发生的删除、迁移、安全与兼容信息同样照写。

**规则本身用正向措辞写。** 说「产物长什么样」，别列禁词清单——点名禁词等于把它放进模型的当前激活。

## Commit Granularity

**One commit = one unit the user approved, not one file you touched.** The unit is the decision, gate or
batch that was agreed — a ruling, an approved batch of edits, a verification pass — however many files,
tables or fetches it took to carry out.

Three consequences, in the order they are usually violated:

1. **Bookkeeping never gets its own commit.** Status stamps, index or ledger rows, regenerated generated
   files, cross-pointers — these record a change, so they ride in the commit that *makes* it.
2. **Multiple writes inside one gate collapse into one commit.** A pass that fetched six sources and edited
   three tables is one commit at the end of the pass, not one per source.
3. **The durable ledger commits about once per session, not after every work block.** Edit it freely and
   leave it dirty in between. Whether it rides inside the last content commit or lands as its own commit is a
   judgement call, **not a rule** (user ruling 2026-08-24) — what matters is that it is not committed after
   each block. (See the project memory that measured the original incident.)

**The one exception: reversing a conclusion you already committed gets its own commit.** A withdrawal or
correction of something already in history must be greppable on its own, and burying it inside an unrelated
change hides it. Correct forward — do not amend history that has been pushed or that others may hold.

If asked how many commits something cost, measure it (`git rev-list --count`), never estimate.

## Commit Discipline

> Vendored near-verbatim from the guidance Claude Code injects at session level (2026-08-24), so the rule
> holds regardless of harness version. Composes with §Commit Granularity: the approved unit is a commit's
> outer boundary — never split it by file, source or AI turn; engineering intent decides how many commits
> that unit yields — two independently revertible changes inside one approved batch still land separately.

Create commits by coherent engineering intent, not by AI turn, file, or editing step.

Before committing:

- follow repository-local conventions;
- inspect the staged diff;
- exclude unrelated and pre-existing user changes;
- run relevant checks and report only checks actually run.

Keep implementation, tests, and directly related documentation together by default.
Fold incidental fixes into the logical change they complete.
Separate independently reviewable or revertible changes.

Write concise commit messages that explain the resulting change and, when needed, its reason or
constraints. Do not copy the diff or include AI reasoning.

Never discard user changes, rewrite shared history, push, force-push, or bypass checks without explicit
permission. If commit permission is unclear, propose commits rather than creating them.

## Pull Request Workflow

When creating PRs:
1. Analyze full commit history (not just latest commit)
2. Use `git diff [base-branch]...HEAD` to see all changes
3. Draft comprehensive PR summary
4. Include test plan with TODOs
5. Push with `-u` flag if new branch

> For the full development process (planning, TDD, code review) before git operations,
> see [development-workflow.md](./development-workflow.md).
