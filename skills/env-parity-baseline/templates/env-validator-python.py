"""env-parity-baseline: Python env validator

启动期校验环境变量，缺失或类型错则 raise，禁止 silent default 兜底。

安装：
    pip install pydantic-settings
    # or `uv add pydantic-settings` / `poetry add pydantic-settings`

用法：
    1. 在 app 入口顶部：`from .env_config import settings`
    2. 其它代码只用 `settings.XXX`
    3. 严禁直接 `os.environ.get(...)` —— ruff 规则可禁（PLW1508）

与 docs/env-contract.md 必须一一对应（CI 校验）。
"""

from __future__ import annotations

import sys
from typing import Literal

from pydantic import Field, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Required: 必须填值
    Optional: 类型加 `| None` 且 `default=None`
    Default: 显式给值
    Secret: schema 含 key，但 .env.example 不放真实值
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="forbid",  # 拒绝未声明的变量（防 typo）
    )

    # 运行环境
    APP_ENV: Literal["development", "test", "staging", "production"] = "development"

    # 端口
    PORT: int = Field(default=8000, gt=0, le=65535)

    # 数据库（required）
    DATABASE_URL: PostgresDsn

    # 例：optional secret
    # STRIPE_SECRET_KEY: str | None = Field(default=None, pattern=r"^sk_")

    # 例：required secret（必须由 secret store 注入）
    # SESSION_SECRET: str = Field(min_length=32)

    # 日志级别（default-only）
    LOG_LEVEL: Literal["debug", "info", "warning", "error"] = "info"


# ---- fail-fast at import time ----
try:
    settings = Settings()  # type: ignore[call-arg]
except Exception as exc:
    print(f"[env-parity-baseline] invalid environment variables: {exc}", file=sys.stderr)
    print("See docs/env-contract.md for required schema.", file=sys.stderr)
    raise SystemExit(1) from exc
