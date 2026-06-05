#!/usr/bin/env bash
# =============================================================================
# Claude Code 配置一键安装脚本 — Mac / Linux / WSL / Git-Bash
# =============================================================================
# 用法：
#   git clone https://github.com/SensLiao/Claude-code-setting.git
#   cd Claude-code-setting
#   bash install.sh           # 默认 dry-run，只显示动作
#   bash install.sh --apply   # 真正部署
#
# 说明：
#   - 将仓库内容部署到 $HOME/.claude/
#   - 自动还原占位符 __CLAUDE_HOME_*__ 为本机真实路径
#   - 不会覆盖你已有的 settings.json / .credentials.json / memory / projects
# =============================================================================

set -euo pipefail

APPLY=0
FORCE=0
TARGET="$HOME/.claude"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --apply)  APPLY=1; shift ;;
        --force)  FORCE=1; shift ;;
        --target) TARGET="$2"; shift 2 ;;
        -h|--help)
            sed -n '2,18p' "$0"
            exit 0
            ;;
        *) echo "unknown arg: $1"; exit 1 ;;
    esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ──── 颜色 ─────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
    C_INFO="\033[36m"; C_OK="\033[32m"; C_WARN="\033[33m"; C_ERR="\033[31m"; C_DIM="\033[90m"; C_RST="\033[0m"
else
    C_INFO=""; C_OK=""; C_WARN=""; C_ERR=""; C_DIM=""; C_RST=""
fi
info() { printf "${C_INFO}[INFO]${C_RST}  %s\n" "$*"; }
ok()   { printf "${C_OK}[OK]${C_RST}    %s\n" "$*"; }
warn() { printf "${C_WARN}[WARN]${C_RST}  %s\n" "$*"; }
err()  { printf "${C_ERR}[ERROR]${C_RST} %s\n" "$*"; }
dim()  { printf "${C_DIM}%s${C_RST}\n" "$*"; }

info "Claude Code 配置安装器 (Unix)"
info "源 (仓库)  : $REPO_ROOT"
info "目标 (机器): $TARGET"
[[ $APPLY -eq 0 ]] && warn "DRY-RUN 模式（不写文件）。加 --apply 才真正部署。"
echo ""

# ──── 占位符 ───────────────────────────────────────────────────────────────
CLAUDE_HOME="$TARGET"
USER_HOME="$HOME"

# JSON-escaped 形式（在 Windows 上 $TARGET 用反斜杠；Unix 上无所谓但保留逻辑一致）
escape_json() { printf '%s' "$1" | sed 's|\\|\\\\|g'; }
to_posix()    { printf '%s' "$1"; }   # Unix 上本身就是 posix

CLAUDE_HOME_JSON="$(escape_json "$CLAUDE_HOME")"
USER_HOME_JSON="$(escape_json "$USER_HOME")"
CLAUDE_HOME_WIN="$CLAUDE_HOME"
USER_HOME_WIN="$USER_HOME"
CLAUDE_HOME_POSIX="$CLAUDE_HOME"
USER_HOME_POSIX="$USER_HOME"

# ──── 不部署的项 ──────────────────────────────────────────────────────────
SKIP_NAMES=("install.sh" "install.ps1" "README.md" ".gitignore" ".git" ".github" "settings.example.json")

# ──── 永不覆盖的目标（即使 --force） ──────────────────────────────────────
PRESERVE_ALWAYS=(".credentials.json" "settings.json" "settings.local.json"
                 "memory" "projects" "sessions" "tasks" "history.jsonl"
                 "plugins" "tools" "mcp-servers")

# ──── 帮助函数 ─────────────────────────────────────────────────────────────
in_array() {
    local needle="$1"; shift
    for item in "$@"; do [[ "$item" == "$needle" ]] && return 0; done
    return 1
}

COPIED=0
SKIPPED=0
SUBSTITUTED=0

# 文本类后缀
is_text_file() {
    case "$1" in
        *.md|*.json|*.js|*.cjs|*.mjs|*.sh|*.ps1|*.py|*.yaml|*.yml|*.toml|*.txt|*.bak) return 0 ;;
        *) return 1 ;;
    esac
}

deploy_file() {
    local src="$1" dst="$2" rel="$3"
    COPIED=$((COPIED + 1))
    if [[ $APPLY -eq 0 ]]; then
        echo "  [+] ~/.claude/$rel"
        return
    fi
    mkdir -p "$(dirname "$dst")"
    if is_text_file "$src"; then
        # 检测占位符是否存在
        if grep -lq "__CLAUDE_HOME_\|__USER_HOME_" "$src" 2>/dev/null; then
            sed \
                -e "s|__CLAUDE_HOME_JSON__|$CLAUDE_HOME_JSON|g" \
                -e "s|__USER_HOME_JSON__|$USER_HOME_JSON|g" \
                -e "s|__CLAUDE_HOME_WIN__|$CLAUDE_HOME_WIN|g" \
                -e "s|__USER_HOME_WIN__|$USER_HOME_WIN|g" \
                -e "s|__CLAUDE_HOME_POSIX__|$CLAUDE_HOME_POSIX|g" \
                -e "s|__USER_HOME_POSIX__|$USER_HOME_POSIX|g" \
                "$src" > "$dst"
            SUBSTITUTED=$((SUBSTITUTED + 1))
        else
            cp -f "$src" "$dst"
        fi
    else
        cp -f "$src" "$dst"
    fi
}

# ──── 主循环 ───────────────────────────────────────────────────────────────
[[ $APPLY -eq 1 ]] && mkdir -p "$TARGET"

while IFS= read -r -d '' src; do
    rel="${src#$REPO_ROOT/}"
    top="${rel%%/*}"

    in_array "$top" "${SKIP_NAMES[@]}" && continue
    in_array "$top" "${PRESERVE_ALWAYS[@]}" && { SKIPPED=$((SKIPPED + 1)); continue; }

    dst="$TARGET/$rel"

    if [[ -e "$dst" && $FORCE -eq 0 ]]; then
        SKIPPED=$((SKIPPED + 1))
        [[ $APPLY -eq 0 ]] && dim "  [skip-exists] $rel"
        continue
    fi

    deploy_file "$src" "$dst" "$rel"
done < <(find "$REPO_ROOT" -type f -not -path "$REPO_ROOT/.git/*" -print0)

# ──── settings.example.json 提示 ───────────────────────────────────────────
if [[ ! -f "$TARGET/settings.json" ]]; then
    warn "目标里没有 settings.json — Claude Code 第一次启动会自动生成 (含 OAuth)。"
    warn "如需参考推荐配置，看仓库 settings.example.json，按需手工合并。"
fi

# ──── 总结 ─────────────────────────────────────────────────────────────────
echo ""
ok "完成。"
info "本次操作:"
echo "  - 准备部署: $COPIED 个文件"
echo "  - 跳过已存在: $SKIPPED"
echo "  - 做了占位符替换: $SUBSTITUTED"

if [[ $APPLY -eq 0 ]]; then
    echo ""
    warn "这是 DRY-RUN。真正部署请加 --apply："
    echo "    bash install.sh --apply"
    echo ""
    echo "  其它选项："
    echo "    bash install.sh --apply --force          # 覆盖已存在的文件"
    echo "    bash install.sh --apply --target /path   # 自定义目标位置"
else
    echo ""
    info "下一步:"
    echo "  1. 启动 Claude Code，登录生成 ~/.claude/settings.json (含 OAuth)"
    echo "  2. 如需手动合并 settings.example.json 里的配置，编辑 ~/.claude/settings.json"
    echo "  3. 在 ~/.claude.json 配置 MCP servers (见 mcp-configs/mcp-servers.json 参考)"
fi
