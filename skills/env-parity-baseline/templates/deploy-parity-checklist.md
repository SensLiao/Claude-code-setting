# Deploy Parity Checklist

> 每次 deploy 前过一遍。任何 ❌ 都是 risk，必须 fix 或 risk-accept（书面）。
> 这个清单是**人工 review 工具**，不是 CI 自动化（CI 校验是另一回事）。

---

## 1. 工具链 & 构建

- [ ] CI 使用的 Node / Python / Rust / Go 版本与 production 一致（精确到 minor）
- [ ] CI 用 lockfile-driven clean install：
  - Node: `npm ci` / `pnpm install --frozen-lockfile` / `yarn install --frozen-lockfile`
  - Python: `pip install --require-hashes -r requirements.txt` / `poetry install --no-update` / `uv sync --frozen`
  - Rust: `cargo build --locked`
  - Go: `GOFLAGS=-mod=readonly go build`
- [ ] 没有 `latest` tag 作为基础镜像（Dockerfile `FROM node:20.11-alpine`，不是 `FROM node` / `FROM node:latest`）
- [ ] 多架构构建（amd64 + arm64）覆盖目标（用 `docker buildx`）
- [ ] Build artifact 在 staging 和 prod 一致（不重新 build，promote 同一 image digest）

## 2. Secrets

- [ ] secret 不在仓库（`.env` / `.env.production` / `secrets.yml` / `*.pem` 不 commit）
- [ ] Dockerfile 没有 `ARG SECRET_*=...` 或 `ENV SECRET_*=...`（改用 `RUN --mount=type=secret,id=xxx,target=/run/secrets/xxx`）
- [ ] CI workflow 使用 GitHub Secrets / OIDC，不是 plain env
- [ ] production secret 在 secret manager（AWS Secrets Manager / GCP Secret Manager / HashiCorp Vault / k8s Secret）
- [ ] secret rotation 流程存在（≥ 1 次/季度，文档化）
- [ ] log / error trace 不会打印 secret 值（Sanitizer 中间件 / structured log 过滤）
- [ ] container image 不含 secret（用 `dive` / `trivy` 扫 image layer）

## 3. 环境变量契约

- [ ] env validator 在 app 启动期 throw，不 silent fallback
- [ ] `.env.example` 与 validator schema 一致（CI 校验）
- [ ] dev / test / staging / prod 的 env 来源已在 `docs/env-contract.md` 明确
- [ ] k8s `ConfigMap` / `Secret` 的 keys 与 env validator 一致
- [ ] systemd unit 的 `Environment=` / `EnvironmentFile=` 与 env validator 一致
- [ ] compose `environment:` / `env_file:` 与 env validator 一致

## 4. Backing Services（Twelve-Factor IV）

- [ ] 本地 / CI / staging / prod 的 postgres / redis / queue / 对象存储版本一致（同 minor）
- [ ] `compose.yaml` / k8s manifests 显式 pin 版本（不用 `:latest`）
- [ ] 数据库连接通过 URL 注入（`DATABASE_URL`），不写死 host/port/credentials
- [ ] 服务发现机制明确（k8s Service / Consul / 静态 DNS）
- [ ] 外部 API 客户端有超时 + retry + circuit breaker

## 5. 网络层

- [ ] Nginx / Caddy / ALB 的 `client_max_body_size` 与 app upload 期望一致
- [ ] proxy timeout（read / send / connect）与 app SLA 一致（不要 60s vs 10s 这种）
- [ ] CORS headers 只在一处设置（reverse proxy OR app，不双重）
- [ ] CSP headers 单一来源
- [ ] TLS 证书自动续期（Let's Encrypt / ACM / cert-manager）
- [ ] WebSocket / SSE / HTTP/2 / HTTP/3 在 proxy 正确启用（buffering off, timeout 长）
- [ ] 端口在 dev / staging / prod 一致（或用 `PORT` env 配）

## 6. 健康 & 可观测

- [ ] `/healthz`（liveness，不检查 DB）+ `/readyz`（readiness，检查 DB / cache 连通）endpoint 存在
- [ ] k8s `livenessProbe` / `readinessProbe` 配置（`initialDelaySeconds` 合理，不要太短）
- [ ] compose `healthcheck:` 配置
- [ ] structured JSON logging（不是 plain text，便于 grep 和聚合）
- [ ] log shipping 到中央（Loki / CloudWatch / Datadog / Splunk）
- [ ] metrics 暴露（Prometheus `/metrics` 或 OTEL）
- [ ] traces 启用（OTEL / Sentry tracing / Jaeger）
- [ ] error tracking（Sentry / Rollbar / Bugsnag）
- [ ] 关键业务指标有 alert（latency p99 / error rate / queue lag）

## 7. 数据库 & 持久化

- [ ] migration 工具确定（drizzle / alembic / flyway / liquibase / sqlx）
- [ ] migration 用 expand-contract，零停机兼容老版本 app（先 add column nullable → backfill → app 读新列 → drop 旧列分开两次 release）
- [ ] 备份策略（自动 + 异地 + 定期恢复演练 ≥ 1 次/季度）
- [ ] 读写分离 / connection pool 配置（避免 connection 耗尽）
- [ ] 数据库时区 = UTC（避免 dev/prod 时区差）
- [ ] 字符集 = utf8mb4（MySQL）/ UTF8（Postgres）
- [ ] 重要表有索引覆盖常见查询（pg_stat_user_indexes / EXPLAIN ANALYZE 跑过）

## 8. OS / 容器层

- [ ] timezone = UTC（容器内 + 数据库 + log）
- [ ] locale = `C.UTF-8` 或 `en_US.UTF-8`
- [ ] 文件权限：app 用非 root 用户运行（Dockerfile `USER app`）
- [ ] 工作目录 / data 卷 / log 卷在容器内挂载明确
- [ ] limits（CPU / memory）配置（k8s `resources.requests/limits` / compose `deploy.resources`）
- [ ] graceful shutdown：SIGTERM 处理，drain in-flight 请求（`terminationGracePeriodSeconds` 足够长）
- [ ] init process（`tini` / `dumb-init`）防止 zombie process
- [ ] 镜像最小化（distroless / alpine / 自建 slim base）

## 9. 回滚

- [ ] rollback 路径明确（k8s `kubectl rollout undo` / blue-green switch / canary 回滚）
- [ ] migration 可回滚（down migration 或 expand-contract 不需要回滚）
- [ ] 上一版本镜像保留 ≥ 3 个（registry retention 配置）
- [ ] rollback SLA（< 5 min 完成）
- [ ] rollback 演练 ≥ 1 次/季度（不能上线时第一次试）

## 10. 跨平台开发

- [ ] `.gitattributes` 锁行尾符（`* text=auto eol=lf` + 显式 `.sh`、`.bat` 例外）
- [ ] `.editorconfig` 锁缩进 / charset / final newline
- [ ] 路径用 `path.join` / `pathlib` / `filepath.Join`，不字符串拼接 `"a/b/c"`
- [ ] shell 脚本统一 bash（Windows 用 WSL / git-bash），Windows 特定脚本 `.ps1`
- [ ] CI 在 ubuntu + windows 双跑（如果开发者用 Windows）
- [ ] 大小写敏感性：所有 import 路径与文件名大小写完全一致（macOS / Windows 不敏感，Linux 敏感）

## 11. 合规 / 法律（按业务）

- [ ] PII 数据脱敏 / 加密（按 GDPR / 个保法）
- [ ] log 不打印 PII
- [ ] 数据 retention 策略明确
- [ ] 备份加密
- [ ] audit log 写入不可变存储

---

## 用法

1. **首次部署 prep**：本清单全部 review，未达项纳入 PLAN.md 作为 phase deliverable
2. **每次 release 前**：高优先级项（Secrets / Migrations / Rollback）必须确认
3. **季度 audit**：全部走一遍，更新 risk register

参考：
- Twelve-Factor App: <https://12factor.net/>
- Docker build secrets: <https://docs.docker.com/build/building/secrets/>
- Kubernetes ConfigMap & Secret: <https://kubernetes.io/docs/concepts/configuration/configmap/>
- Database evolutionary patterns (expand-contract): <https://martinfowler.com/articles/evodb.html>
