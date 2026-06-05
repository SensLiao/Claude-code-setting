# Environment Variable Contract

> Source of truth for all environment variables used by this project.
> 与代码里的 env-validator（zod / pydantic-settings / envalid / @t3-oss/env-core）必须一一对应。
> CI 在 lint 阶段应校验 `.env.example` keys 与 schema 一致。

---

## 1. 命名规则

- 全大写 + 下划线：`DATABASE_URL` ✅；`databaseUrl` ❌
- 项目前缀（多服务 monorepo 时必须）：`APP_DATABASE_URL` / `WORKER_QUEUE_URL`
- 禁止缩写歧义：`DB_URL` ❌（DB 是哪个？）；`POSTGRES_URL` ✅
- secret 后缀清晰：`_SECRET_KEY` / `_TOKEN` / `_PASSWORD` / `_CREDENTIALS`
- 布尔值用 `_ENABLED` / `_DISABLED` 后缀，值用 `true` / `false`（小写）

---

## 2. 分类

| 类别 | 标记 | 进 `.env.example` | 进仓库 | 管理位置 |
|---|---|---|---|---|
| Required, non-secret | R | ✅（含 placeholder） | ✅ | n/a |
| Required, secret | RS | ✅（`KEY=` 空值） | ❌（值不进） | secret store |
| Optional, non-secret | O | ✅ | ✅ | n/a |
| Optional, secret | OS | ✅（`KEY=` 空值） | ❌（值不进） | secret store |
| Default-only | D | ✅（含默认值） | ✅ | n/a |

---

## 3. 来源（按环境）

| 环境 | 变量来源 | 备注 |
|---|---|---|
| local dev | `.env`（gitignored）| 开发者自己填，不进仓库 |
| test (CI) | GitHub Secrets 注入 + `.env.test`（可 commit，不含 secret）| `.env.test` 只放测试 fixtures |
| staging | GitHub Secrets / cloud secret manager / k8s Secret | secret 由部署平台注入 |
| production | cloud secret manager（AWS SM / GCP SM / HashiCorp Vault）/ k8s Secret | 绝不依赖 `.env` |

**禁止**：把 staging / prod secret 写进 `.env.staging` / `.env.production` 并 commit 到仓库。

---

## 4. 启动期 fail-fast 规则

- env validator 必须在 app 入口最先执行（在任何业务代码之前）
- 缺 R / RS → throw + `process.exit(1)` / `SystemExit(1)`
- 类型不匹配（如 `PORT` 不是数字） → throw + exit
- 未声明的变量 → strict 模式下警告或失败（pydantic `extra="forbid"`，zod `.strict()`）
- secret 不得有 default value（如果没设，应当 throw，不能 silent fallback 到弱默认）

---

## 5. CI 校验（GitHub Actions 示例）

```yaml
- name: env contract lint
  shell: bash
  run: |
    # 校验 .env.example 必须存在
    test -f .env.example || { echo "::error::.env.example missing"; exit 1; }

    # 校验 .env / .env.local 必须在 .gitignore
    grep -qE '^\.env(\.local)?$' .gitignore || { echo "::error::.env not in .gitignore"; exit 1; }

    # 校验 .env.example 不含真实 secret（高熵 prefix）
    if grep -E '=(sk_|ghp_|AKIA|xoxb-|xoxp-)[A-Za-z0-9]{10,}' .env.example; then
      echo "::error::.env.example contains real secret values"
      exit 1
    fi

    # 校验 .env.example keys 与代码 schema 一致（项目自定义脚本）
    # node scripts/verify-env-contract.mjs
```

---

## 6. 变量清单

> 项目按需填写。每行：`KEY | 类别 | 描述 | 默认值（D 才填）| secret 管理位置（RS/OS 才填）`

示例：

```
DATABASE_URL              | R   | Postgres connection string                     |     | n/a
STRIPE_SECRET_KEY         | RS  | Stripe API secret key                          |     | AWS Secrets Manager: prod/stripe/secret_key
SESSION_SECRET            | RS  | session cookie HMAC key (≥ 32 chars)           |     | AWS Secrets Manager: prod/app/session_secret
LOG_LEVEL                 | D   | logging verbosity                              | info| n/a
REDIS_URL                 | O   | Redis cache; if absent, in-memory cache used   |     | n/a
SENTRY_DSN                | OS  | error tracking DSN                             |     | GitHub Secrets: SENTRY_DSN
```

---

## 7. 风险审查 checklist

- [ ] 没有 secret 值出现在 `.env.example`（只有 `KEY=` 空值）
- [ ] `.env` / `.env.local` / `.env.*.local` 在 `.gitignore`
- [ ] env validator schema 与本 contract 文件键一一对应
- [ ] staging / prod secret 来自 secret store，**绝不**来自 `.env.production` commit
- [ ] Dockerfile 不用 `ARG SECRET_*` / `ENV SECRET_*`（必须用 BuildKit `--mount=type=secret`）
- [ ] k8s `ConfigMap` / `Secret` keys 与本 contract 一致
- [ ] systemd `Environment=` / `EnvironmentFile=` 与本 contract 一致
- [ ] 任何 log / error trace 不会打印 secret 值（Sanitizer 中间件）

---

## 参考

- Twelve-Factor III. Config: <https://12factor.net/config>
- Docker build secrets（正确用法）: <https://docs.docker.com/build/building/secrets/>
- Kubernetes Secret: <https://kubernetes.io/docs/concepts/configuration/secret/>
- pydantic-settings: <https://docs.pydantic.dev/latest/concepts/pydantic_settings/>
- Zod env validation (T3 env): <https://env.t3.gg/>
- envalid: <https://github.com/af/envalid>
