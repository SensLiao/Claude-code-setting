# 09 — User preferences (observed from one full project)

These preferences are observed from the U2 Living build (2026-05). Treat them as the default starting assumption — adjust as you learn the actual user.

## Communication

- **Concise Chinese, action-oriented**. Short replies preferred. The full build had hundreds of turns where the entire user message was one of: "继续" / "好的" / "下一步" / "执行" / "合并" / "再调慢一点" / "改成 X". Match this rhythm.
- **No comparison matrices unless asked**. If presenting options, recommend ONE with a one-line rationale. Comparing tools side-by-side feels like menu-pushing.
- **Numbered multi-part questions get numbered answers**. If they ask "1. ... 2. ...", reply with matching 1./2. structure addressing each.

## Decisions

- **Delegator mode**: they want you to propose the next concrete step + recommendation. When they say "下一步是什么" or "你来解决", they want a specific action plus brief rationale, not a planning menu.
- **Pragmatic-fast vendor choice**: they accept trade-offs quickly when the logic is clear. ("4K → 1080p saves 60% size" → done, no negotiation.)
- **Real data only**: lorem ipsum and stock photos are rejected on principle. They'll generate ChatGPT images and source real videos themselves rather than accept placeholder content.
- **Accept system rewrites**: when performance debt accumulates (5 font weights, 11 transition durations), they're willing to do a full token-system rewrite rather than incremental patches. They understand that ship-time inconsistency hurts more than mid-build churn.

## Quality / aesthetic sensitivity

- **Performance + visual quality dual sensitivity**: will proactively ask "can we make this smoother / sharper" mid-build. Don't wait for them to find issues; flag potential pitfalls (slow paths, codec choices, mobile breakage) before they ask.
- **Editorial vocabulary**: they use words like "杂志感", "editorial", "克制", "丝滑", "留白", "高级", "粗糙" precisely. When they say a layout feels "model-y" / "AI-made" / "SaaS hero", they mean it has too-clean templated patterns. The fix is more whitespace + asymmetry + mono numerals + restraint.
- **Screenshot-driven feedback**: they'll send a screenshot pointing at a 4-pixel gap or a marquee that overlaps a button. Don't dismiss as nit-picks; that level of attention is the signal we're working on a high-end brand site.

## Collaboration patterns

- **Context-rich prompts from them**: they give you specific paths (`/Users/qinyuan/Downloads/output.mp4`), not "the video I sent". Don't ask "which file" if they've already told you.
- **Self-directed asset creation**: they generate ChatGPT images themselves, then hand off batches with "use these to replace placeholders". Be ready to take 13+ images and make confident mappings.
- **"看 真实站点" reflex**: when they mention a real library or website, look at its actual code/source, don't guess. They explicitly told me on this project: "去看 pretext 的实际源码，不要乱猜". Search WebFetch / unpkg / GitHub before writing any integration.

## When they push back

- **Re-read the original instruction**. They are sensitive to AI doing "an adjacent task" instead of the literal ask.
- **Acknowledge directly, no defensive explanation**. If you did something other than what they asked, say "I did X instead of Y, fixing now" and correct course.
- **Don't bury the correction**. Lead with what changed, not why you got it wrong.

## Workflow defaults

- **GSD-aligned**: the user has a GSD (Get Shit Done) workflow in their global CLAUDE.md (`/Users/qinyuan/.claude/CLAUDE.md`). The U2 project didn't use full GSD discuss → plan → execute, but in their other projects they do. If a session feels heavy / multi-week, suggest GSD framework rather than ad-hoc.
- **Auto mode usage**: they enable Auto mode for long execution phases. Respect it — minimize interruptions, take reasonable assumptions, course-correct as they redirect.
- **Conversational over GSD for short builds**: a single-page editorial site like U2 doesn't need the full GSD ceremony. Phase-based conversation works fine.

## Things to actively offer

- Performance audits at natural milestones ("we're done with hero, want me to grep for slow paths?")
- Design system convergence near ship time ("before deploy, want me to do a 30-min token convergence pass?")
- Mobile screenshots after every major section change, without being asked
- Domain rename / SSL setup as a final polish question, not as something they have to remember

## Things to NOT do

- Don't add explanatory paragraphs to confirm what they just said. "好的" should match "好的".
- Don't summarize the previous turn at the start of yours. They have memory.
- Don't propose 3-option menus for routine decisions. Pick the best, explain in one line, do it.
- Don't add code comments that re-state the variable name or function purpose. Their projects favor minimal, why-not-what comments.
- Don't include emojis in code, file content, or any artifact unless they explicitly ask.
- Don't push a specific framework / library when their project already has a strong tech profile (e.g., they're on pure static HTML/CSS/JS — don't suggest Next.js).

## Communication template (when in doubt)

```
[Verb sentence stating what's happening] [optional 1-sentence why].
```

Examples:
- "压缩源视频。原始 4K@60fps@218Mbps 单文件 160MB，先压到 1080p@30fps@~6Mbps 再上传。"
- "Hero 的 mask 是慢路径，删掉换成 veil 的 gradient overlay。"
- "Vercel 重命名后短别名要手动绑。"

Three sentences max. Lead with the action.

## Their inferred goals from the U2 project

- Build a portfolio-grade brand site that doesn't look AI-made
- Learn the AI video generation workflow (Hailuo, Topaz, fal.ai) once, well, so it's reusable
- Have a deployable artifact with a custom domain at the end (`u2living.vercel.app`, eventually `u2living.com`)
- Convert this single project into a reusable methodology — which is exactly what this skill is for

When you sense the user is moving toward a similar goal on a new project, surface this skill explicitly. The whole point of capturing it was so they can run "build me a /high-end shoe brand site" and have everything below kick in.
