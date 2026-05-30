#Requires -Version 5.1
# tools/setup/install.ps1 — Windows user-mode, DECLARATIVE install-graph entry.
#
# Parity with tools/setup/install.sh -> macos.sh (B-0857 Windows parity). System CLI tools
# resolve scoop -> winget -> chocolatey (operator 2026-05-30; scoop primary = user-mode, no
# admin, AI-native). Runtimes via mise/.mise.toml; claude via bun --global — the IDENTICAL files
# Unix uses, so the tool set stays in sync + symmetric across OSes. Background loop registered via
# tools/persistence/windows/install-scheduled-task.ts (schtasks ~= launchd). No admin required.
#
# Idempotent (detect-first-install-else-update) — safe to run repeatedly to keep tools fresh.
#
#   pwsh tools/setup/install.ps1                    # full install + register the per-minute loop
#   pwsh tools/setup/install.ps1 -SkipLoopRegister  # skip the scheduled-task registration (dev)
#
# Package-source pins per dep-pin-search-first-authority (WebSearch 2026-05-30):
#   scoop — https://get.scoop.sh (canonical; download-then-exec, NOT pipe-to-shell). Refs:
#           https://scoop.sh/  https://github.com/ScoopInstaller/scoop
#   git   — scoop: git | winget: Git.Git | choco: git
[CmdletBinding()] param([switch]$SkipLoopRegister)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
function Have($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }

Write-Host "=== Zeta install — Windows user-mode entry (scoop-primary, declarative) ==="
Write-Host "Repo root: $RepoRoot"

# Allow running local scripts for THIS user (no admin) — scoop + mise need it.
$cur = Get-ExecutionPolicy -Scope CurrentUser
if ($cur -notin @('RemoteSigned', 'Unrestricted', 'Bypass')) {
  Write-Host "setting CurrentUser ExecutionPolicy -> RemoteSigned (no admin)"
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
}

# 1. scoop (user-mode; no admin). Download-then-exec (NOT pipe-to-shell) — mirrors macos.sh's
#    Homebrew B-0063 pattern: fetch to a temp .ps1, verify non-empty, run the local file.
if (-not (Have scoop)) {
  Write-Host "downloading scoop (user-mode)..."
  $scoopTmp = Join-Path $env:TEMP "scoop-install-$([guid]::NewGuid()).ps1"
  try {
    Invoke-RestMethod -Uri https://get.scoop.sh -OutFile $scoopTmp
    if (-not (Test-Path $scoopTmp) -or (Get-Item $scoopTmp).Length -eq 0) { throw "scoop installer empty; refusing to run" }
    & $scoopTmp
  } finally { Remove-Item $scoopTmp -Force -ErrorAction SilentlyContinue }
}
# scoop shims on PATH for the rest of this process (scoop adds them to the user PATH for new
# shells, but this process needs them now — mirrors macos.sh's brew/mise shim PATH export).
$scoopShims = Join-Path $env:USERPROFILE 'scoop\shims'
if ((Test-Path $scoopShims) -and ($env:PATH -notlike "*$scoopShims*")) { $env:PATH = "$scoopShims;$env:PATH" }
Write-Host "scoop: $((scoop --version 2>$null | Select-Object -First 1))"

# 2. system CLI tools from manifests/windows (scoop -> winget -> choco). Strips `#` comments +
#    trims (parity with the awk in macos.sh's brew-manifest loop).
$manifest = Join-Path $RepoRoot 'tools\setup\manifests\windows'
foreach ($raw in Get-Content $manifest) {
  $line = ($raw -replace '#.*$', '').Trim(); if (-not $line) { continue }
  $parts = $line -split '\s+'
  $scoopId = $parts[0]
  $winget = ($parts | Where-Object { $_ -like 'winget=*' }) -replace 'winget=', ''
  $choco = ($parts | Where-Object { $_ -like 'choco=*' }) -replace 'choco=', ''
  $wid = if ($winget) { $winget } else { $scoopId }   # if/else (5.1-safe; NOT the 7+ ?: ternary)
  $cid = if ($choco) { $choco } else { $scoopId }
  Write-Host "down $scoopId (scoop -> winget -> choco)"
  if ($(Have scoop)) { scoop install $scoopId }
  elseif ($(Have winget)) { winget install --id $wid --silent --accept-package-agreements --accept-source-agreements }
  elseif ($(Have choco)) { choco install $cid -y }
  else { throw "no package source (scoop/winget/choco) available for $scoopId" }
}

# 3. mise (runtime manager) via scoop — mirrors macos.sh step 4 (brew install mise).
if (-not (Have mise)) { scoop install mise }
Write-Host "mise: $((mise --version 2>$null))"

# 4. runtimes from .mise.toml (dotnet/python/java/bun/uv) — IDENTICAL file to Unix (symmetric).
Push-Location $RepoRoot
try {
  mise trust 2>$null | Out-Null
  mise install
} finally { Pop-Location }

# 5. claude-code via bun --global (bun provided by mise) — identical to Unix.
mise exec -- bun install --global '@anthropic-ai/claude-code'

# 6. register the per-minute (windowless, conhost --headless) loop unless skipped.
if (-not $SkipLoopRegister) {
  mise exec -- bun "$RepoRoot\tools\persistence\windows\install-scheduled-task.ts" --register
}

Write-Host ""
Write-Host "=== Install complete ==="
Write-Host "Open a new shell to pick up scoop + mise shims on PATH."
