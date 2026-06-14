---
name: security-app-mobile
canonical_id: security.app.mobile
aliases: [mobile-security, masvs, mastg, ios-security, android-security]
version: 1.0.0
status: stable
created_date: 2026-05-25
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
forbidden-tools: WebFetch
manual_gate_required: false
disable-model-invocation: false
standards_versions:
  - OWASP MASVS: 2.x (8 control groups; verification levels removed in v2.0.0 — see §3 review depth note)
  - OWASP MASTG: 2.x (Mobile Application Security Testing Guide)
  - OWASP MAS Testing Profiles: latest (replaces pre-v2 verification levels)
  - NIST CSF: 2.0
  - OWASP ASVS: 5.0 (web service components)
  - Apple App Store Review Guidelines: living reference, checked 2026-05-25
  - Google Play Developer Program Policies: living reference, checked 2026-05-25
  - iOS App Privacy & Privacy Manifest requirements
  - Android Manifest permissions / Scoped Storage
sensitive_data_rules:
  never_read: [".env*", "secrets/**", "*.pem", "*.key", "*.keystore", "*.jks", "*.mobileprovision", "*.p12"]
  never_write: ["actual signing keys", "production provisioning profiles"]
  redact_on_output: ["bundle ids in production accounts", "real device identifiers", "real user data"]
upstream:
  - appsec-security-orchestrator
  - security-governance-threat-modeling
downstream:
  - security-remediation
  - security-platform-secrets (mobile secret storage)
  - appsec-security-orchestrator (back with findings)
description: >
  Mobile application security overlay covering iOS and Android. Maps to OWASP
  MASVS 2.x verification standard + MASTG testing guide. Covers **8 MASVS 2.x
  control groups**: MASVS-STORAGE (local data) / MASVS-CRYPTO (mobile crypto) /
  MASVS-AUTH (mobile auth flows) / MASVS-NETWORK (TLS, cert pinning) /
  MASVS-PLATFORM (deep links, IPC, WebView) / MASVS-CODE (anti-tampering,
  obfuscation) / MASVS-RESILIENCE (jailbreak/root detection) / **MASVS-PRIVACY**
  (transparency, data minimization, app-specific privacy controls). Note:
  MASVS v2.0.0 removed verification levels; depth is now driven by MAS Testing
  Profiles. Activated for iOS / Android projects. Does NOT perform active
  reverse engineering of third-party apps. Coordinates with Apple HIG official
  docs for SwiftUI/HIG patterns and security-platform-secrets for Keychain / Keystore
  practices.
trigger_phrases:
  - mobile security / 移动安全 / iOS security / Android security
  - MASVS / MASTG / mobile app security
  - cert pinning / 证书锁定 / keychain / keystore
  - jailbreak detection / root detection / 越狱检测 / root 检测
  - deep link security / URL scheme / app link / universal link
  - WebView security / 移动 WebView
  - mobile crypto / mobile auth flow / mobile token storage
---

# Security App — Mobile (MASVS 2.x)

## 1. Mission

移动端攻击面与 web 完全不同：本地存储 / 设备指纹 / 证书锁定 / Jailbreak/Root 检测 / 反调试 / Deep link / IPC / WebView / **隐私透明度**等都是独立 capability。本 skill 把 OWASP MASVS 2.x **8 control groups** 映射成 actionable workflow。

**职责边界**：
- **owns**: MASVS 2.x **8 control groups** + MASTG passive review + mobile-specific threat patterns
- **不做**: Active reverse engineering of competitor / unauthorized apps
- **不做**: 替代 Apple HIG 官方规范 / `security-platform-secrets`（Keychain/Keystore 详细工程）

**MASVS v2.0.0 重要变化**：v2.0.0 起 MASVS **删除了 verification levels (L1/L2/L2+R)**；review depth 由独立的 **MAS Testing Profiles** 控制（按 app context 选 profile：consumer / financial / regulated / high-resilience）。本 skill 沿用 review-depth 标识但**不再**把它归到 MASVS 标准本身。

---

## 2. Activation Triggers

| Trigger | Action |
|---|---|
| 项目含 iOS app（.xcodeproj / Package.swift / SwiftUI 项目）| 默认激活 |
| 项目含 Android app（build.gradle / AndroidManifest.xml）| 默认激活 |
| KMP / React Native / Flutter / Capacitor 跨平台 | 激活 + 关注跨平台 native bridge |
| App 用 deep link / universal link / app link | 激活 deep link 安全审 |
| App 含 WebView | 激活 WebView 安全审 |
| App 处理 PII / payment / health data | 升 MASVS L2 + 隐私 manifest 审 |
| App 用第三方 SDK（analytics / ads / 等）| 激活 SDK supply chain 审 |
| App 上架前 | 升 readiness check（Apple / Google 政策合规） |

---

## 3. MASVS 2.x — 8 Control Groups

| Control Group | 关注点 | 默认 / 重风险 |
|---|---|---|
| **MASVS-STORAGE** | 本地数据：sensitive data 存哪、加密、缓存清理、剪贴板 | 默认 |
| **MASVS-CRYPTO** | 加密算法选择、密钥管理、随机源 | 默认 |
| **MASVS-AUTH** | 用户认证、session、token 存储、生物识别集成 | 默认 |
| **MASVS-NETWORK** | TLS 强制、cert pinning、HSTS、CT log | 默认 |
| **MASVS-PLATFORM** | IPC、deep link、WebView、剪贴板、screenshot 防护、accessibility 滥用 | 默认 |
| **MASVS-CODE** | 第三方依赖、签名验证、resource 完整性 | 默认 |
| **MASVS-RESILIENCE** | Jailbreak/Root 检测、反调试、obfuscation、反 hooking | 高资产 / 高反逆向场景 |
| **MASVS-PRIVACY** | 透明度（隐私政策 / 数据收集声明）、数据最小化、对外披露控制、第三方 SDK 数据使用控制、特定权限保护（contacts / photos / location / health / biometrics） | 默认（处理 PII / sensitive data 必检）|

### Review Depth（不再是 MASVS 标准本身的一部分；本 skill local label，映射到 MAS Testing Profiles）

| Local label | 适用 | 对齐的 MAS Testing Profile |
|---|---|---|
| **Default** | 普通 app（基础功能、无 sensitive data）| Consumer Application |
| **Enhanced** | 含 PII / payment / health / regulated industry | Financial / Regulated Application |
| **Enhanced + Resilience** | 高价值 / 高 attack surface / 抗逆向需求 | High-Resilience Application（含 MASVS-RESILIENCE）|

**Iron rule**: 不在新文档里把"L1/L2/L2+R"称为 MASVS 5.0 的层级 — 旧的 verification levels 已 removed。引用 review depth 用上表 local 标签 + 对应 MAS Testing Profile。

---

## 4. Standard Workflow

```
Step 1  Project type detection
        → iOS / Android / cross-platform？
        → Pick Review Depth profile (Default / Enhanced / Enhanced+Resilience) per §3

Step 2  Threat surface inventory
        → 列 entry points: launcher, deep links, IPC receivers, share extensions, widgets, watch apps, notifications
        → 列 data classes: local storage, keychain/keystore, cache, clipboard, screenshots, biometric, location, contacts, photos, health
        → 列 third-party SDK: analytics, ads, push, CMP, attribution, payment, social login

Step 3  MASVS-STORAGE review
        → Sensitive data 位置：Keychain (iOS) / Keystore (Android) / SharedPreferences (encrypt!) / Core Data (encrypt!) / SQLite (SQLCipher)
        → 检查：不写 sensitive data 到 NSUserDefaults / SharedPreferences plain / clipboard 默认
        → 检查：禁止 screenshot in sensitive screens（iOS isSecureView / Android FLAG_SECURE）
        → 检查：cache 清理策略，logout 清 sensitive cache
        → 检查：unencrypted .plist / sqlite 文件

Step 4  MASVS-CRYPTO review
        → 算法：AES-256-GCM / ChaCha20-Poly1305；禁用 DES / RC4 / MD5 / SHA1 for signing
        → 密钥派生：PBKDF2 / Argon2 / scrypt（不要 MD5(password)）
        → 密钥存储：Secure Enclave / StrongBox / Keymaster
        → 随机源：SecRandomCopyBytes / SecureRandom（不 Math.random / arc4random simple）

Step 5  MASVS-AUTH review
        → Token storage：Keychain (iOS) accessControl + biometryAny / Keystore (Android) hardware-backed
        → Biometric integration：require fresh auth (LAContext, BiometricPrompt) 不是 cached
        → Session：refresh + revocation，logout 强制 server-side invalidation
        → Step-up auth 对 high-risk actions（payment / settings change）

Step 6  MASVS-NETWORK review
        → TLS 1.2+ enforced，禁用 HTTP fallback
        → Cert pinning（如适用：高价值 endpoint + 频繁更新机制 + backup pin）
        → ATS (iOS App Transport Security) 不放宽
        → Network Security Config (Android) 严格
        → CT log validation 如适用

Step 7  MASVS-PLATFORM review
        → Deep link / universal link / app link:
          - iOS: associated domains + apple-app-site-association 文件
          - Android: assetlinks.json + autoVerify=true
          - 检查：deep link handler 验证 input，不直接 trust query params
          - 检查：deep link 不直接触发 sensitive action 无 re-auth
        → IPC:
          - iOS: URL scheme handler / NSExtension validation
          - Android: exported components default false，intent filter 验证 caller
        → WebView:
          - 禁用 JavaScript bridge 暴露 sensitive API
          - 不加载 untrusted HTML / URL
          - HTTPS only
          - Disable file:// access
        → Clipboard: 标记 sensitive clipboard（iOS 14+ 自动报警；Android 减少使用）
        → Screenshots: sensitive screen 防截屏（FLAG_SECURE / isSecureView）
        → Accessibility: 不滥用 accessibility service 读屏

Step 8  MASVS-CODE review
        → 依赖：scan iOS Package.swift / Podfile / Android build.gradle
        → SDK 审：每个 SDK 检查 privacy policy + data collection
        → 资源完整性：签名验证 build artifact，反 tamper

Step 9  MASVS-RESILIENCE review（Enhanced + Resilience profile only）
        → Jailbreak/Root 检测：组合多个 indicator（不单一）
        → 反调试 / 反 hooking / 反 Frida
        → Code obfuscation（高价值 app）
        → Runtime integrity check
        → 注意：resilience ≠ security，它增加 attacker 成本但不是 hard barrier

Step 9.5 MASVS-PRIVACY review（处理 PII / sensitive data 必检）
        → 透明度：隐私政策内容 + 易于访问 + 用户语言适配
        → 数据收集声明：每项 collected data class 都有清晰说明
        → 数据最小化：collected data 严格匹配业务必要
        → 第三方 SDK 数据使用控制：列出每个 SDK 收集什么 + 数据流向 + privacy review
        → 平台特定隐私要求：
          - iOS Privacy Manifest (PrivacyInfo.xcprivacy) 完整 + Required Reason API
          - iOS App Tracking Transparency (ATT) 合规
          - Android Data Safety form 与实际行为一致（不 aspirational）
          - Android scoped storage + 敏感权限 (READ_PHONE_STATE / READ_CONTACTS / location) 必须 justify
        → 用户控制：opt-out 机制易用、export 数据、delete 账号
        → 与 orchestrator §5.4 privacy capability + compliance.cn_data + compliance.payment 协作

Step 10 Platform-specific compliance
        → iOS:
          - Privacy Manifest (PrivacyInfo.xcprivacy) 完整
          - Required Reason API 使用声明
          - App Tracking Transparency (ATT) 合规
          - App Store Review Guidelines 5.x privacy 章节
        → Android:
          - Data safety form (Google Play) 完整
          - Foreground service type 正确声明
          - Scoped Storage 合规
          - Sensitive permissions justification（READ_PHONE_STATE / READ_CONTACTS / etc.）

Step 11 输出 + 路由（权威契约见 §8 Output Contract + §8.1 Overlay Evidence Contract）
        → Findings 全部走 `appsec-sdk finding.add`（canonical；不直写 .appsec/findings/**）→ security-remediation
        → Secret storage 高危 → security-platform-secrets
        → Privacy issues → orchestrator §5.4 privacy capability + 合规 (cn_data 如有)
        → `appsec-sdk overlay.activate <tag> mobile` + 写 overlay-mobile/checklist.yaml（§8.1，缺则 release BLOCK）
        → 更新 SECURITY.md mobile-specific section
        → 写到 AppSec Release Evidence §12 叠加层
```

---

## 5. iOS vs Android Quick Reference

### iOS Specific
- **Storage**: Keychain (`SecItemAdd` with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`)
- **Crypto**: CryptoKit / CommonCrypto
- **Biometric**: LAContext with `LAPolicy.deviceOwnerAuthenticationWithBiometrics`
- **Pinning**: URLSessionDelegate `urlSession(_:didReceive:completionHandler:)`
- **Anti-screenshot**: `view.isSecureView = true` (iOS 14+) or hide on `applicationWillResignActive`
- **Privacy**: PrivacyInfo.xcprivacy + App Tracking Transparency
- **Cert lifecycle**: Trust store updates via OS, plan for cert rotation

### Android Specific
- **Storage**: EncryptedSharedPreferences / EncryptedFile (Jetpack Security) + Keystore-backed
- **Crypto**: javax.crypto + Keystore-backed keys (StrongBox if available)
- **Biometric**: BiometricPrompt (AndroidX) with `BIOMETRIC_STRONG`
- **Pinning**: Network Security Config XML or OkHttp CertificatePinner
- **Anti-screenshot**: `window.setFlags(WindowManager.LayoutParams.FLAG_SECURE)`
- **IPC**: Exported components default false; PendingIntent FLAG_IMMUTABLE; ContentProvider permissions
- **Permissions**: Runtime permissions + per-feature justification
- **Data safety form**: Match actual app behavior, not aspirational

---

## 6. Hard Rules

- ❌ **不**做未授权 app 的 reverse engineering / dynamic analysis
- ❌ **不**读 .keystore / .jks / .mobileprovision / .p12 文件内容
- ❌ **不**把 Resilience（jailbreak detect / obfuscation）当 security 替代品
- ❌ **不**在 sensitive screen 不加 anti-screenshot
- ❌ **不**用 NSUserDefaults / plain SharedPreferences 存 token
- ❌ **不**禁用 ATS / Network Security Config 简化开发
- ❌ **不**让 deep link 直接执行 sensitive action 无 re-auth
- ❌ **不**在 WebView 暴露 sensitive JS bridge
- ❌ **不**用 MD5/SHA1/HMAC-MD5 for new mobile crypto
- ❌ **不**忽略 iOS Privacy Manifest / Android Data Safety form

---

## 7. Anti-patterns

- ❌ "App 上架就够了" — 上架审核不是安全审，过审 ≠ 安全
- ❌ "用了 HTTPS 就安全" — TLS 是 baseline，pinning + CT + 应用层 token 都要
- ❌ "Keystore/Keychain 万能" — 配置错（如 wrong accessControl）等于明文
- ❌ "Jailbreak detection 阻挡攻击" — 已 jailbreak 的 device 可 bypass detection
- ❌ "WebView 加 setAllowFileAccess(false) 就够" — JS bridge 还有大量攻击面
- ❌ "Third-party SDK 我们信任的" — 依赖审 + SDK behavior audit + privacy policy 强制
- ❌ "Cert pinning 严格越好" — 错了会 brick app（cert 轮换不及时），必须 backup pin + 远程 kill switch
- ❌ "Deep link 是 feature，不是 attack surface" — 不验证 input = open redirect / IDOR
- ❌ "App in production 6 个月没更新" — 第三方 SDK / OS 都在变，定期 re-audit

---

## 8. Output Contract

每次 review 产出：

1. Review Depth profile（Default / Enhanced / Enhanced+Resilience）+ 决定 rationale + 对应 MAS Testing Profile
2. **8 control group** coverage matrix（每个 group 通过 / 部分 / 未覆盖 + evidence）— STORAGE / CRYPTO / AUTH / NETWORK / PLATFORM / CODE / RESILIENCE / **PRIVACY**
3. iOS/Android specific issues 分组
4. Privacy compliance status（iOS Privacy Manifest / Android Data Safety）
5. Third-party SDK inventory + audit status
6. Resilience controls 清单（Enhanced+Resilience profile）
7. SECURITY.md mobile section 更新
8. AppSec Release Evidence §12 叠加层填表
9. Cert pinning rotation plan（如适用）
10. **Findings** —— 全部经 `appsec-sdk finding.add <file>`（canonical path，redact-first）落 `.appsec/findings/<tag>/`，符合 orchestrator §9 finding schema v1.0：
    - `source`（`manual_review` 或扫描命中）；`severity` **小写**；`cwe`；`reproduction_steps`（**禁含 raw signing key / 真实 device 标识 / 真实 user data**——脱敏；且本 skill 永不读 `.keystore`/`.jks`/`.mobileprovision`/`.p12`）
    - `asvs_mapping`：mobile 主体走 **MASVS 2.x**（8 control groups），ASVS 仅适用 web service 组件——有 ASVS clause 时用版本化三段 `v5.0.0-<ch>.<sec>.<req>`（正则 `^v5\.0\.0-\d+\.\d+\.\d+$`），否则在 finding/`notes` 标 MASVS group（如 `MASVS-STORAGE`），**绝不**用 4.x 旧标签也不硬塞不存在的 ASVS 号
    - **绝不** Write 直写 `.appsec/findings/**`（orchestrator hook §18.5a 拦 Write/Edit/MultiEdit）；只走 sdk
    - high+ finding → `security-remediation`；secret storage 高危 → `security-platform-secrets`；privacy → orchestrator §5.4 privacy + 合规（cn_data 如有）

### 8.1 Overlay Evidence Contract（满足 release gate — 不可省）

> 起因：appsec-evidence-validator（orchestrator §16.9 check #3）对**每个激活的 overlay** HARD-REQUIRE `.appsec/evidence/<tag>/overlay-<name>/checklist.yaml`，缺一即 release **BLOCKED**。本 overlay 的 `<name>` = `mobile`。

每次 review 结束，**两步落盘**（按序）：

1. **标记 overlay active**：
   ```bash
   appsec-sdk overlay.activate "<release-tag>" mobile
   # → 建 .appsec/evidence/<tag>/overlay-mobile/ + 写 .activated 标记
   ```
2. **写 overlay checklist evidence**（validator 真正校验的文件）：
   - 写 `.appsec/evidence/<release-tag>/overlay-mobile/checklist.yaml`
   - 直接 Write 即可（evidence 路径不被 hook 拦；只有 `.appsec/findings/**` + `.appsec/decisions/**` 被 §18.5a 拦）
   - 内容：把 §3 的 **8 MASVS 2.x control groups**（STORAGE / CRYPTO / AUTH / NETWORK / PLATFORM / CODE / RESILIENCE / PRIVACY）逐组转成 `items[]`。**因 mobile 走 MASVS 而非 ASVS**：`asvs_ref` 置 `null`，把 MASVS group 写进 `notes`（如 `MASVS-STORAGE`）；仅当某项确属 web service 组件且有 ASVS clause 时才填版本化 ASVS 号。每项另含 `id` / `requirement` / `status: pass|fail|na|not_tested` / `evidence_ref` + `summary{total, pass, fail, na}`。先在 checklist 顶部 `notes` 记本次 Review Depth profile（Default / Enhanced / Enhanced+Resilience）——RESILIENCE 组在非-Resilience profile 下应标 `na`
   - 任何 `status: fail` 在 `evidence_ref`/`notes` 引用对应 `finding.add` 出的 finding id（finding 本体走 sdk，不塞 checklist）
   - 模板：[`appsec-security-orchestrator/templates/overlay-checklist.template.yaml`](../appsec-security-orchestrator/templates/overlay-checklist.template.yaml)（含 mobile 示例 items：按 8 MASVS groups，asvs_ref null + MASVS group in notes）

无此 checklist.yaml → §16.9 validator BLOCK 整个 release。

---

## 9. References

- [OWASP MASVS 2.x](https://mas.owasp.org/MASVS/)
- [OWASP MASTG](https://mas.owasp.org/MASTG/)
- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple Privacy Manifest](https://developer.apple.com/documentation/bundleresources/privacy_manifest_files)
- [Google Play Developer Program Policies](https://play.google.com/about/developer-content-policy/)
- [Android Jetpack Security](https://developer.android.com/topic/security/data)
- [Android Network Security Config](https://developer.android.com/training/articles/security-config)
- [iOS Cryptographic Services Guide](https://developer.apple.com/documentation/cryptokit)
- [appsec-security-orchestrator](../appsec-security-orchestrator/SKILL.md) — §9 finding schema / §16.3 overlay activation / §16.9 evidence validation / §18.5a finding-path hook
- [overlay-checklist.template.yaml](../appsec-security-orchestrator/templates/overlay-checklist.template.yaml) — overlay-mobile/checklist.yaml 模板（MASVS group in notes, asvs_ref null）
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/) — iOS HIG reference (本地 apple-ios-hig skill 已移除，改用 Apple 官方文档)
- [security-platform-secrets](../security-platform-secrets/SKILL.md) — Keychain/Keystore engineering
