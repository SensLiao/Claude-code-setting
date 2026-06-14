---
name: qa-mobile-native-e2e
version: 1.0.0
status: dormant-backup   # 备选能力：仅在真实 mobile-app 项目激活；非主战场，不主推
created_date: 2026-06-15
allowed-tools: Read, Bash, Grep, Glob
parent: enterprise-qa-testing
references_agents: [qa-mobile-e2e-runner]
activation: conditional   # 见 §2.1 Activation Gate — 缺 mobile-app marker 一律不激活
description: >
  QA child skill (DORMANT / 备选) — native mobile E2E via Maestro (Apache-2.0,
  YAML flows, no compile, Android / iOS / RN / Flutter, simulator-first, real
  device optional). Mobile is this harness's BACKUP battlefield: build the
  capability, keep it dormant — it ONLY activates on real mobile-app projects
  (Android/iOS/React Native/Flutter markers present). Never fires on pure
  web / backend projects. Symmetric with `app-aso` + `security-app-mobile`.
  Owns parent §4 Layer "Mobile E2E" (new, conditional). Trigger phrases (only
  meaningful when a mobile app is present): "mobile e2e / native app test /
  Maestro / 移动端 E2E / 原生 App 测试 / Android 测试 / iOS 测试 / React Native
  测试 / Flutter 测试 / 真机测试 / emulator / simulator / mobile flow test /
  app UI 测试". Casual: "test my app on a phone / does the app flow work".
---

# qa-mobile-native-e2e

## 1. Position

原生移动 App 的端到端测试 skill，工具用 **Maestro**（Apache-2.0、YAML flow、免编译、跨 Android/iOS/RN/Flutter、模拟器优先真机可选）。

**这是一个备选 / dormant 能力。** 按 user 主战场画像（Web / 公司系统 / AI Agent 为主，Mobile 为备选不深研），本 skill **平时不触发**——只有当项目确实是移动 App 时才激活。它存在的意义是"做 App 时能力在、不用临时造"，而不是给每个项目都挂一道移动测试。

与现有移动相关能力对称：`app-aso`（App Store 上架优化）+ `security-app-mobile`（移动安全）—— 三者都是"做 App 才上"的备选层。

## 2. Triggers

- Parent §6 Step 5（**且** §2.1 Activation Gate 通过 —— 即项目确为移动 App）
- 关键移动 user journey（登录 → 核心操作 → 结果）需要在真机/模拟器验证
- App 发布前的 native flow 回归（启动、导航、表单、权限弹窗、深链）
- 独立触发：移动 release readiness（配合 `app-aso` 上架前）

## 2.1 Activation Gate（备选激活闸门 — 缺 marker 一律不激活）

本 skill **激活前必须**确认项目含至少一个 mobile-app marker，否则**不激活**、不产 evidence、不进 release gate：

| 平台 | marker（任一即可） |
|---|---|
| Android | `AndroidManifest.xml` / `build.gradle` 含 `com.android.application` / `*.apk` 产物 |
| iOS | `*.xcodeproj` / `*.xcworkspace` / `Info.plist` / `Podfile` |
| React Native | `package.json` 含 `react-native` 依赖 + `android/` 或 `ios/` 目录 |
| Flutter | `pubspec.yaml` 含 `flutter:` + `android/` 或 `ios/` |

**判定**：

- 无任何 marker（纯 Web / 纯 backend）→ skill 输出 `decision: NOT_APPLICABLE, reason: "no mobile-app marker; this is a backup/dormant skill"`，**绝不**为 web 项目硬跑移动测试。
- 有 marker → 正常走 §5 workflow。
- 这与 parent §10 Evidence-Gated Skip 一致：移动层的"跳过"以"无 mobile marker"为可证伪证据。

## 3. Responsibilities

- **Tool：Maestro**（`maestro test <flow.yaml>`）
  - **YAML flow，免编译**：flow 用声明式命令（`launchApp` / `tapOn` / `inputText` / `assertVisible` / `scroll` / `back` / `runFlow`），改测试不用重新编译 App。
  - **跨平台同一份 flow**：Android / iOS 多数命令通用；平台差异用 `runFlow: when:` 条件分流。
  - **selector 稳定性**：优先 `id`(accessibility id / testID) / `text`，避免脆弱的坐标 tap（坐标随分辨率漂移）。
- **设备策略**：
  - **模拟器/模拟机优先**（CI 友好、可复现）：Android Emulator / iOS Simulator。
  - **真机可选**：通过 Maestro 连真机或 device cloud（留档命令；本 skill 不强制真机）。
- **关键 flow 覆盖**：启动 → 登录/鉴权 → 核心 user journey → 结果断言；含权限弹窗处理、深链（deep link）、离线/弱网（如适用）。
- **产物**：Maestro 的 flow 执行日志 + 截图（`--debug-output`），失败时的 hierarchy dump。
- **栈适配**：按 RN / Flutter / 原生选 flow 编写约定（testID vs accessibility id vs Semantics label）。

## 4. Non-responsibilities

- **不在非移动项目激活**（§2.1 闸门）—— Web E2E 走 `qa-e2e-coverage-gate`（Playwright）
- 不做移动**单元/组件**测试（XCTest / Espresso / JUnit / Flutter widget test 属各自原生工具链 + `qa-test-design-tdd-bridge`）
- 不做移动**安全**审计（→ `security-app-mobile`）
- 不做 App Store 上架/ASO（→ `app-aso`）
- 不做移动性能 profiling（Instruments / Android Profiler，非本 skill）
- 不替代真机兼容性矩阵云测（BrowserStack / Firebase Test Lab —— 留档，本 skill 只跑 flow）

## 5. Workflow

1. **Activation Gate（§2.1）**：探测 mobile-app marker；无 → `NOT_APPLICABLE`，结束。
2. 识别平台（Android / iOS / RN / Flutter）+ 现有 Maestro flows（`.maestro/` / `*.yaml` flow）
3. 圈定关键 native journey（按 risk + acceptance criteria）
4. 选设备 target（模拟器优先；真机仅在 dispatch 显式提供时）
5. dispatch `qa-mobile-e2e-runner`（它装/探 Maestro、起模拟器、跑 flow、抓 stdout+exit_code+截图）
6. 验收 `MOBILE_E2E_SCHEMA`：flow 是否真跑、断言是否真触发、selector 是否稳定（非坐标）、截图 artifact 是否在
7. Output `mobile_native_e2e` YAML

## 6. Output Contract

```yaml
mobile_native_e2e:
  activation:
    mobile_marker_found: true            # false → NOT_APPLICABLE，下面不填
    platform: android | ios | react-native | flutter
    marker_evidence: <e.g. pubspec.yaml flutter: + android/>
  tool: maestro
  device:
    type: emulator | simulator | real-device
    identifier: <e.g. Pixel_7_API_34 / iPhone 15 sim>
  flows_run:
    - flow_file: .maestro/login_and_checkout.yaml
      steps: [launchApp, tapOn(id=login), inputText, assertVisible(id=home)]
      result: pass | fail
      selector_strategy: id | text | accessibility   # 非坐标
  assertions:
    total: <N>
    passed: <N>
    failed: <N>
  artifacts:
    maestro_log: <path>
    screenshots_dir: <path --debug-output>
    hierarchy_dump_on_fail: <path or none>
  flakiness_note: <若 retry-pass，交 qa-flaky-governance>
  decision: PASS | FAIL | BLOCKED | NOT_APPLICABLE
  blockers: []
```

## 7. Parent Integration

- Triggered by: parent §6 Step 5（reference agent 模式 — 本 skill prepare input → `qa-mobile-e2e-runner` execute → 本 skill validate），**且**通过 §2.1 闸门
- Returns: `mobile_native_e2e` YAML
- Consumed by: `qa-evidence-bundle` → `child_skill_results.mobile_e2e` (evidence layer key: `mobile_e2e`)
- Runner emits `MOBILE_E2E_SCHEMA.v1`（workflow-spec mode）
- 落盘：`bash "$HOME/.claude/scripts/qa-sdk.sh" evidence.append <tag> mobile_e2e <result>` → `.qa/evidence/<tag>/mobile_e2e.yaml`
- **NOT_APPLICABLE 也要落盘**（记录"为什么没跑移动测试"= 无 marker），与 web 项目的诚实 skip 一致

## 8. Forbidden patterns

- **在纯 Web / backend 项目激活移动测试**（违反 §2.1；这是 dormant 备选 skill）
- 用脆弱的**坐标 tap** 代替 `id`/`text` selector（分辨率漂移 → flaky；与 parent §14 CSS-locator 反模式同源）
- 硬 `waitForTimeout` 式固定等待代替 `assertVisible` 轮询（与 parent §14 硬睡反模式同源）
- 声称 flow 通过但无 Maestro 日志 + 截图 artifact（违反 Hard Rule §2.1）
- retry-pass 当干净通过（移动 flow 易 flaky；retry-pass 必须交 `qa-flaky-governance` 挂账）
- 把本 skill 当主战场能力主推（它是备选；主战场是 Web/系统/Agent）
- 对生产后端发真实写请求（移动 E2E 打 staging 后端；勿污染生产数据，与 §2.6 同源）

## 9. References

- [Maestro — mobile UI testing (Apache-2.0)](https://maestro.dev/) · [docs](https://docs.maestro.dev/)
- [Maestro install (`curl -fsSL https://get.maestro.mobile.dev | bash`)](https://docs.maestro.dev/getting-started/installing-maestro)
- [Maestro commands (launchApp / tapOn / assertVisible / runFlow)](https://docs.maestro.dev/api-reference/commands)
- [Maestro selectors (id / text / accessibility)](https://docs.maestro.dev/api-reference/selectors)
- Sibling backup skills: `app-aso` (store optimization) · `security-app-mobile` (mobile security)
- Parent §4 Layer matrix · §10 Evidence-Gated Skip (no-marker = falsifiable skip) · §14 anti-patterns
