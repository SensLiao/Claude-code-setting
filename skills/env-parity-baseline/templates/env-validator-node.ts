// === env-parity-baseline: Node/TypeScript env validator ===
// 启动期校验环境变量，缺失或类型错则 throw，禁止 silent default 兜底。
// 必须在 app 入口（src/index.ts / next.config.ts / server.ts）最先 import。
//
// 安装：
//   pnpm add zod
//   # 或 npm install zod / yarn add zod
//
// 用法：
//   1. 在 app 入口顶部：import './env'
//   2. 其它代码只用 `import { env } from './env'`
//   3. 严禁直接 process.env.XXX —— ESLint 规则可禁（@typescript-eslint/no-restricted-imports）
//
// 与 docs/env-contract.md 必须一一对应（CI 校验）。

import { z } from 'zod';

// ---- Schema ----
// 规则：
//   required:  z.string()         — 必须填值
//   optional:  .optional()        — 显式 optional
//   default:   .default(value)    — 显式默认值
//   secret:    schema 含 key，但 .env.example 留空（KEY=）
//   typed:     z.coerce.number() / z.enum([...]) 等

const EnvSchema = z
  .object({
    // 运行环境
    NODE_ENV: z
      .enum(['development', 'test', 'staging', 'production'])
      .default('development'),

    // 端口
    PORT: z.coerce.number().int().positive().max(65535).default(3000),

    // 数据库（required）
    DATABASE_URL: z
      .string()
      .url()
      .refine((v) => v.startsWith('postgres://') || v.startsWith('postgresql://'), {
        message: 'DATABASE_URL must be a postgres:// URL',
      }),

    // 例：optional secret（schema 必含 key，env.example 留空）
    // STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),

    // 例：required secret（必须由 secret store 注入）
    // SESSION_SECRET: z.string().min(32),

    // 日志级别（default-only）
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  })
  .strict(); // 拒绝未声明的变量（防 typo）— 若 .env 文件有多余变量会失败

// ---- Validate at startup（fail-fast） ----
const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // 不要 silent fallback；直接打印错误并 exit
  // eslint-disable-next-line no-console
  console.error('[env-parity-baseline] invalid environment variables:');
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  // eslint-disable-next-line no-console
  console.error('See docs/env-contract.md for required schema.');
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof EnvSchema>;
