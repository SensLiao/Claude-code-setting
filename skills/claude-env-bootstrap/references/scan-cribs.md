# Relocated from claude-env-bootstrap/SKILL.md — §SCAN 检测速查 + env_baseline_gaps cribs

### 3.3 关键 signal 检测速查

| Signal | 检测命令(示例) |
|---|---|
| `lang` | `Glob "**/*.{ts,tsx}"` / `Read package.json` / `Glob "**/*.py"` |
| `framework` | `Read package.json` deps / `Read pubspec.yaml` / `Read pom.xml` |
| `deploy_target` | `Glob {vercel.json,netlify.toml,k8s/**,compose.yaml,Package.swift,android/**}` |
| `risk_surface.auth` | `Grep "(NextAuth|passport|authMiddleware|jsonwebtoken)" --type ts` |
| `risk_surface.payment` | `Grep "(stripe|alipay|wechatpay)" package.json` |
| `risk_surface.multitenant` | `Grep "tenant_id|org_id" --type sql,ts,py` 或 schema 文件 |
| `risk_surface.file-upload` | `Grep "(multer\|formidable\|busboy\|<input type=\"file\")" --type ts` |
| `risk_surface.websocket` | `Grep "(socket\.io\|ws://\|WebSocket\|SignalR)"` |
| `risk_surface.llm-agentic` | `Grep "(tools=\|tool_use\|@tool\|AgentExecutor)" --type ts,py` |
| `cn_data_signal` | `Read README*` 中文比例 / `Grep "(\.cn\|阿里云\|腾讯云\|PIPL)"` |
| `multitenant_signal` | 同 risk_surface.multitenant + Row-Level Security policy |
| `payment_signal` | 同 risk_surface.payment |
| `mobile_native_signal` | 存在 `Package.swift` / `android/` / `ios/` / `pubspec.yaml` |
| `env_baseline_gaps` | 见 §3.4 完整列表 |

### 3.4 env_baseline_gaps 检测

| 缺失项 | severity | 检测 |
|---|---|---|
| `missing-nvmrc` | MED | Node 项目无 `.nvmrc` / `.node-version` |
| `missing-lockfile` | HIGH | 有 manifest 无对应 lockfile |
| `missing-env-example` | HIGH | 代码访问 `process.env` / `os.environ` 但无 `.env.example` |
| `missing-validator` | MED | 有 env 访问但无 zod/pydantic/envalid schema |
| `missing-gitattributes` | LOW | 无 `.gitattributes` |
| `missing-editorconfig` | LOW | 无 `.editorconfig` |
| `missing-healthz` | HIGH | 部署 k8s/compose 但无 `/healthz` `/readyz` endpoint |
| `missing-migration-tool` | HIGH | 有 DB 无 migration 工具(drizzle/alembic/flyway/liquibase) |
| `secret-in-dockerfile` | CRITICAL | Dockerfile 用 `ARG SECRET_*` / `ENV SECRET_*` 传 secret |
