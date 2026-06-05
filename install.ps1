# =============================================================================
# Claude Code 配置一键安装脚本 — Windows (PowerShell)
# =============================================================================
# 用法：
#   git clone https://github.com/SensLiao/Claude-code-setting.git
#   cd Claude-code-setting
#   .\install.ps1
#
# 说明：
#   - 将当前仓库内容部署到 $env:USERPROFILE\.claude\
#   - 自动把占位符 __CLAUDE_HOME_*__ 替换成你这台机器的真实路径
#   - 不会覆盖你已有的 settings.json / .credentials.json / memory/ / projects/
#   - 默认 DRY-RUN（只打印不动手），传 -Apply 才真正写入
# =============================================================================

[CmdletBinding()]
param(
    [switch]$Apply,                 # 不加 -Apply 就是 dry-run
    [string]$Target = "$env:USERPROFILE\.claude",
    [switch]$Force                  # 已存在文件强制覆盖（默认会跳过）
)

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot

# ──── 颜色辅助 ──────────────────────────────────────────────────────────────
function Write-Info($m)  { Write-Host "[INFO]  $m" -ForegroundColor Cyan }
function Write-Ok($m)    { Write-Host "[OK]    $m" -ForegroundColor Green }
function Write-Warn($m)  { Write-Host "[WARN]  $m" -ForegroundColor Yellow }
function Write-Err($m)   { Write-Host "[ERROR] $m" -ForegroundColor Red }

Write-Info "Claude Code 配置安装器 (Windows)"
Write-Info "源 (仓库)  : $repoRoot"
Write-Info "目标 (机器): $Target"
if (-not $Apply) {
    Write-Warn "DRY-RUN 模式（只显示动作，不写文件）。加 -Apply 才会真正部署。"
}
Write-Host ""

# ──── 准备目标目录 ─────────────────────────────────────────────────────────
if (-not (Test-Path $Target)) {
    Write-Info "目标目录不存在，将创建: $Target"
    if ($Apply) { New-Item -ItemType Directory -Force -Path $Target | Out-Null }
}

# ──── 占位符替换映射 ───────────────────────────────────────────────────────
# 仓库里的文件用占位符代替了我本机的硬编码路径。安装时还原成你这台机器的路径。
$claudeHome = $Target
$userHome   = $env:USERPROFILE

$claudeHomeJson  = $claudeHome.Replace('\','\\')   # JSON 转义：C:\\Users\\xxx\\.claude
$userHomeJson    = $userHome.Replace('\','\\')
$claudeHomePosix = "/" + ($claudeHome -replace '^([A-Za-z]):','$1' -replace '\\','/').ToLower() -replace '^/([a-z])/','/$1/'
$userHomePosix   = "/" + ($userHome   -replace '^([A-Za-z]):','$1' -replace '\\','/').ToLower() -replace '^/([a-z])/','/$1/'

$placeholders = @{
    "__CLAUDE_HOME_JSON__"  = $claudeHomeJson
    "__USER_HOME_JSON__"    = $userHomeJson
    "__CLAUDE_HOME_WIN__"   = $claudeHome
    "__USER_HOME_WIN__"     = $userHome
    "__CLAUDE_HOME_POSIX__" = $claudeHomePosix
    "__USER_HOME_POSIX__"   = $userHomePosix
}

# ──── 不部署的项 ───────────────────────────────────────────────────────────
$skipNames = @(
    "install.ps1", "install.sh", "README.md", ".gitignore",
    ".git", ".github", "settings.example.json"
)

# ──── 安全：不要覆盖这些文件，即使加了 -Force ─────────────────────────────
$preserveAlways = @(
    ".credentials.json", "settings.json", "settings.local.json",
    "memory", "projects", "sessions", "tasks", "history.jsonl",
    "plugins", "tools", "mcp-servers"
)

# ──── 部署主循环 ───────────────────────────────────────────────────────────
$copiedCount = 0
$skippedExisting = 0
$substitutedFiles = 0

function Copy-WithSubst($srcPath, $dstPath) {
    $script:copiedCount++
    if (-not $Apply) {
        Write-Host "  [+] $($dstPath.Replace($Target, '~\.claude'))"
        return
    }
    $parent = Split-Path -Parent $dstPath
    if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }

    # 只对文本文件做占位符替换
    $textExts = @('.md','.json','.js','.cjs','.mjs','.sh','.ps1','.py','.yaml','.yml','.toml','.txt','.bak')
    $ext = [System.IO.Path]::GetExtension($srcPath).ToLower()

    if ($textExts -contains $ext) {
        try {
            $content = Get-Content -Raw -Path $srcPath -Encoding UTF8
            $changed = $false
            foreach ($key in $placeholders.Keys) {
                if ($content -like "*$key*") {
                    $content = $content.Replace($key, $placeholders[$key])
                    $changed = $true
                }
            }
            if ($changed) { $script:substitutedFiles++ }
            # Set-Content 默认会加 BOM；用 .NET 写入避免
            [System.IO.File]::WriteAllText($dstPath, $content, [System.Text.UTF8Encoding]::new($false))
        } catch {
            Copy-Item -LiteralPath $srcPath -Destination $dstPath -Force
        }
    } else {
        Copy-Item -LiteralPath $srcPath -Destination $dstPath -Force
    }
}

Get-ChildItem -LiteralPath $repoRoot -Force | ForEach-Object {
    if ($skipNames -contains $_.Name) { return }

    $relName = $_.Name
    $dstPath = Join-Path $Target $relName

    if ($_.PSIsContainer) {
        # 整个目录递归
        Get-ChildItem -LiteralPath $_.FullName -Recurse -File | ForEach-Object {
            $rel = $_.FullName.Substring($repoRoot.Length + 1)
            $dst = Join-Path $Target $rel

            $topSegment = $rel.Split([IO.Path]::DirectorySeparatorChar)[0]
            if ($preserveAlways -contains $topSegment) {
                $script:skippedExisting++
                return
            }
            if ((Test-Path $dst) -and -not $Force) {
                $script:skippedExisting++
                if (-not $Apply) { Write-Host "  [skip-exists] $rel" -ForegroundColor DarkGray }
                return
            }
            Copy-WithSubst $_.FullName $dst
        }
    } else {
        if ($preserveAlways -contains $relName) {
            $script:skippedExisting++
            return
        }
        if ((Test-Path $dstPath) -and -not $Force) {
            $script:skippedExisting++
            if (-not $Apply) { Write-Host "  [skip-exists] $relName" -ForegroundColor DarkGray }
            return
        }
        Copy-WithSubst $_.FullName $dstPath
    }
}

# ──── settings.example.json 提示 ───────────────────────────────────────────
$settingsTarget = Join-Path $Target "settings.json"
if (-not (Test-Path $settingsTarget)) {
    Write-Warn "目标里没有 settings.json。Claude Code 第一次启动后会自动生成（含 OAuth）。"
    Write-Warn "如需参考推荐配置，看仓库根目录的 settings.example.json，按需手工合并。"
}

# ──── 总结 ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Ok  "完成。"
Write-Info "本次操作:"
Write-Host "  - 准备部署: $copiedCount 个文件"
Write-Host "  - 跳过已存在: $skippedExisting"
Write-Host "  - 做了占位符替换: $substitutedFiles"

if (-not $Apply) {
    Write-Host ""
    Write-Warn "这是 DRY-RUN。真正部署请加 -Apply："
    Write-Host "    .\install.ps1 -Apply" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  其它选项："
    Write-Host "    .\install.ps1 -Apply -Force          # 覆盖已存在的文件"
    Write-Host "    .\install.ps1 -Apply -Target X:\path # 自定义目标位置"
} else {
    Write-Host ""
    Write-Info "下一步:"
    Write-Host "  1. 启动 Claude Code 让它生成你的 settings.json (含 OAuth 登录)"
    Write-Host "  2. 如需手动合并 settings.example.json 里的配置，编辑 $Target\settings.json"
    Write-Host "  3. 在 ~/.claude.json 配置 MCP servers (见 mcp-configs/mcp-servers.json 参考)"
}
