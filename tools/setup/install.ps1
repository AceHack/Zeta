#Requires -Version 5.1
# tools/setup/install.ps1 -- Windows user-mode, DECLARATIVE install-graph entry.
#
# Parity with tools/setup/install.sh -> macos.sh (B-0857 Windows parity). System CLI tools
# resolve scoop -> winget -> chocolatey (operator 2026-05-30; scoop primary = user-mode, no
# admin, AI-native). Runtimes via mise/.mise.toml; claude via bun --global -- the IDENTICAL files
# Unix uses, so the tool set stays in sync + symmetric across OSes. Background loop registered via
# tools/persistence/windows/install-scheduled-task.ts (schtasks ~= launchd). No admin required.
#
# Idempotent (detect-first-install-else-update) -- safe to run repeatedly to keep tools fresh.
#
#   pwsh tools/setup/install.ps1                    # full install + register the per-minute loop
#   pwsh tools/setup/install.ps1 -SkipLoopRegister  # skip the scheduled-task registration (dev)
#
# Package-source pins per dep-pin-search-first-authority (WebSearch 2026-05-30):
#   scoop -- https://get.scoop.sh (canonical; download-then-exec, NOT pipe-to-shell). Refs:
#           https://scoop.sh/  https://github.com/ScoopInstaller/scoop
#   git   -- scoop: git | winget: Git.Git | choco: git
[CmdletBinding()] param([switch]$SkipLoopRegister)
# Deliberately NO `Set-StrictMode -Version Latest`: this installer shells out (via the call
# operator) to third-party bootstrap scripts -- scoop's get.scoop.sh + the scoop shim -- which run
# in child scopes that INHERIT strict mode. scoop reads $LASTEXITCODE before any native command has
# set it, which throws under StrictMode (Server-Core Docker run #5, 2026-05-30). Keep this script
# lenient so third-party bootstraps run cleanly; $ErrorActionPreference=Stop still catches our own
# cmdlet failures.
$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
function Have($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }

# Native-tool invocation helper. Native tools (scoop/mise/bun) write progress + benign notes to
# STDERR; PS 5.1 promotes native stderr to a fatal NativeCommandError under
# $ErrorActionPreference='Stop' the moment the tool emits ANY stderr line -- even with 2>$null or
# 2>&1 (Server-Core build 2026-05-31: `mise trust` printing "mise trusted ..." to stderr crashed
# install). Conversely, Stop does NOT catch a native non-zero EXIT in 5.1, so real failures went
# silent (e.g. a failed `bun install -g claude-code`). So route native calls through here: run
# stderr-tolerant (ErrorActionPreference=Continue so merged stderr is just text), surface output,
# then fault ONLY on a real non-zero exit code.
function Invoke-Tool {
  param([Parameter(Mandatory)][scriptblock]$Cmd, [string]$What = 'native command')
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $Cmd 2>&1 | ForEach-Object { Write-Host "$_" } } finally { $ErrorActionPreference = $prev }
  if ($LASTEXITCODE -ne 0) { throw "$What failed (exit $LASTEXITCODE)" }
}
# Cosmetic version probe -- best-effort, never fatal (stderr-tolerant, ignores exit code).
function Get-ToolVersion {
  param([Parameter(Mandatory)][scriptblock]$Cmd)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'SilentlyContinue'
  try { (& $Cmd 2>&1 | Select-Object -First 1) } finally { $ErrorActionPreference = $prev }
}

Write-Host "=== Zeta install -- Windows user-mode entry (scoop-primary, declarative) ==="
Write-Host "Repo root: $RepoRoot"

# Allow running local scripts for THIS user (no admin) -- scoop + mise need it. Check the
# EFFECTIVE policy (most-specific scope wins): if the process can already run scripts
# (RemoteSigned/Unrestricted/Bypass -- e.g. a container launched with -ExecutionPolicy Bypass, or
# pwsh's default), leave it alone. Only attempt a CurrentUser set when the effective policy is
# restrictive, and TOLERATE a more-specific override (e.g. a corporate GPO scope on a managed
# laptop) rather than dying: Set-ExecutionPolicy emits a non-terminating "overridden by a more
# specific scope" error that this script's $ErrorActionPreference='Stop' would promote to fatal.
$eff = Get-ExecutionPolicy
if ($eff -notin @('RemoteSigned', 'Unrestricted', 'Bypass')) {
  Write-Host "effective ExecutionPolicy is '$eff'; setting CurrentUser -> RemoteSigned (no admin)"
  try { Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force }
  catch { Write-Host "could not set CurrentUser policy ($($_.Exception.Message)); effective policy '$eff' may be GPO-pinned -- continuing" }
}

# 1. scoop (user-mode; no admin). Download-then-exec (NOT pipe-to-shell) -- mirrors macos.sh's
#    Homebrew B-0063 pattern: fetch to a temp .ps1, verify non-empty, run the local file.
if (-not (Have scoop)) {
  Write-Host "downloading scoop (user-mode)..."
  $scoopTmp = Join-Path $env:TEMP "scoop-install-$([guid]::NewGuid()).ps1"
  try {
    Invoke-RestMethod -Uri https://get.scoop.sh -OutFile $scoopTmp
    if (-not (Test-Path $scoopTmp) -or (Get-Item $scoopTmp).Length -eq 0) { throw "scoop installer empty; refusing to run" }
    # scoop refuses admin by default (desktop = non-admin). In an admin context (CI / a Windows
    # container runs as ContainerAdministrator) pass -RunAsAdmin so the bootstrap proceeds; on a
    # normal user desktop this branch is skipped.
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if ($isAdmin) { & $scoopTmp -RunAsAdmin } else { & $scoopTmp }
  } finally { Remove-Item $scoopTmp -Force -ErrorAction SilentlyContinue }
}
# scoop shims on PATH for the rest of this process (scoop adds them to the user PATH for new
# shells, but this process needs them now -- mirrors macos.sh's brew/mise shim PATH export).
$scoopShims = Join-Path $env:USERPROFILE 'scoop\shims'
if ((Test-Path $scoopShims) -and ($env:PATH -notlike "*$scoopShims*")) { $env:PATH = "$scoopShims;$env:PATH" }
Write-Host "scoop: $(Get-ToolVersion { scoop --version })"

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
  if ($(Have scoop)) { Invoke-Tool { scoop install $scoopId } "scoop install $scoopId" }
  elseif ($(Have winget)) { Invoke-Tool { winget install --id $wid --silent --accept-package-agreements --accept-source-agreements } "winget install $wid" }
  elseif ($(Have choco)) { Invoke-Tool { choco install $cid -y } "choco install $cid" }
  else { throw "no package source (scoop/winget/choco) available for $scoopId" }
}

# 3. mise (runtime manager) via scoop -- mirrors macos.sh step 4 (brew install mise).
if (-not (Have mise)) { Invoke-Tool { scoop install mise } 'scoop install mise' }
Write-Host "mise: $(Get-ToolVersion { mise --version })"

# 4. runtimes from .mise.toml (dotnet/python/java/bun/uv) -- IDENTICAL file to Unix (symmetric).
Push-Location $RepoRoot
try {
  Invoke-Tool { mise trust } 'mise trust'
  Invoke-Tool { mise install } 'mise install'
} finally { Pop-Location }

# 5. claude-code via bun --global (bun provided by mise) -- identical to Unix.
Invoke-Tool { mise exec -- bun install --global '@anthropic-ai/claude-code' } 'bun install -g claude-code'

# 6. register the per-minute (windowless, conhost --headless) loop unless skipped.
if (-not $SkipLoopRegister) {
  Invoke-Tool { mise exec -- bun "$RepoRoot\tools\persistence\windows\install-scheduled-task.ts" --register } 'register loop task'
}

Write-Host ""
Write-Host "=== Install complete ==="
Write-Host "Open a new shell to pick up scoop + mise shims on PATH."
