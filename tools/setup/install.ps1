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
# Mirrors the macOS Homebrew flow: a fresh machine gets the full install; a re-run efficiently
# updates only what changed (scoop/mise/ollama all detect-first; the model pull checks `ollama
# list` and skips when present), so a 2nd run does NOT redo everything (operator 2026-05-31).
#
#   pwsh tools/setup/install.ps1                    # full install + register the per-minute loop
#   pwsh tools/setup/install.ps1 -SkipLoopRegister  # skip the scheduled-task registration (dev)
#
# Package-source pins per dep-pin-search-first-authority (WebSearch 2026-05-30):
#   scoop -- https://get.scoop.sh (canonical; download-then-exec, NOT pipe-to-shell). Refs:
#           https://scoop.sh/  https://github.com/ScoopInstaller/scoop
#   choco -- https://community.chocolatey.org/install.ps1 (canonical; download-then-exec). Ref:
#           https://docs.chocolatey.org/en-us/choco/setup/  (admin-only bootstrap)
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
function Test-IsAdmin {
  ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

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
# Best-effort native call: surface merged output, return the exit code, NEVER throw -- for GRACEFUL
# steps that must not brick install (e.g. the local-LLM pull). Mirrors common/local-llm.sh's
# warn-and-continue discipline (exceptions-as-signals: the model is best-effort substrate).
function Invoke-ToolSoft {
  param([Parameter(Mandatory)][scriptblock]$Cmd)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $Cmd 2>&1 | ForEach-Object { Write-Host "$_" } } finally { $ErrorActionPreference = $prev }
  return $LASTEXITCODE
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
    if (Test-IsAdmin) { & $scoopTmp -RunAsAdmin } else { & $scoopTmp }
  } finally { Remove-Item $scoopTmp -Force -ErrorAction SilentlyContinue }
}
# scoop shims on PATH for the rest of this process (scoop adds them to the user PATH for new
# shells, but this process needs them now -- mirrors macos.sh's brew/mise shim PATH export).
$scoopShims = Join-Path $env:USERPROFILE 'scoop\shims'
if ((Test-Path $scoopShims) -and ($env:PATH -notlike "*$scoopShims*")) { $env:PATH = "$scoopShims;$env:PATH" }
Write-Host "scoop: $(Get-ToolVersion { scoop --version })"

# 1b. chocolatey -- the THIRD resolver source (scoop -> winget -> choco), bootstrapped as part of
#     setup per operator 2026-05-31. choco's installer REQUIRES admin, and scoop (above) is the
#     non-elevated PRIMARY the operator prefers ("scoop ... all non-elevated user scope"), so this
#     is admin-gated + GRACEFUL: install choco ONLY when this process is already elevated AND choco
#     is missing; otherwise warn + skip cleanly (scoop+winget fully cover the non-admin desktop
#     flow -- NEVER force elevation). Download-then-exec (B-0063 pattern, like scoop above).
if (-not (Have choco)) {
  if (Test-IsAdmin) {
    Write-Host "downloading chocolatey (admin fallback source)..."
    $chocoTmp = Join-Path $env:TEMP "choco-install-$([guid]::NewGuid()).ps1"
    try {
      # choco's bootstrap wants TLS 1.2 on older .NET; set it for THIS process only (harmless on
      # modern Windows where it's already the default).
      try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}
      Invoke-RestMethod -Uri https://community.chocolatey.org/install.ps1 -OutFile $chocoTmp
      if (-not (Test-Path $chocoTmp) -or (Get-Item $chocoTmp).Length -eq 0) { throw "chocolatey installer empty; refusing to run" }
      & $chocoTmp
      # choco installs to $env:ProgramData\chocolatey\bin; surface it on PATH for this process.
      $chocoBin = Join-Path $env:ProgramData 'chocolatey\bin'
      if ((Test-Path $chocoBin) -and ($env:PATH -notlike "*$chocoBin*")) { $env:PATH = "$chocoBin;$env:PATH" }
    } catch {
      Write-Host "could not bootstrap chocolatey ($($_.Exception.Message)); continuing (scoop/winget cover the resolver chain)"
    } finally { Remove-Item $chocoTmp -Force -ErrorAction SilentlyContinue }
  } else {
    Write-Host "chocolatey absent + not elevated -> skipping choco bootstrap (scoop is the non-elevated primary; re-run from an elevated shell to add choco as a fallback source)"
  }
}
if (Have choco) { Write-Host "choco: $(Get-ToolVersion { choco --version })" }

# 2. system CLI tools from manifests/windows (scoop -> winget -> choco). Strips `#` comments +
#    trims (parity with the awk in macos.sh's brew-manifest loop). Each `scoop install` /
#    `winget install` / `choco install` is itself detect-first (no-op when already present), so a
#    re-run only fetches what's missing/stale -- the idempotent-update property.
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

# 6. local-LLM core primitive -- pull the pinned model (the ollama BINARY was installed by the
#    manifest loop in step 2, since `ollama` is now in manifests/windows). Mirrors
#    common/local-llm.sh: idempotent (skip when the model is already present) + GRACEFUL (a
#    registry/network/daemon failure WARNS and continues -- it must NEVER brick install; the
#    primitive's tests skip-if-absent -> mock-only, per exceptions-as-signals). Reads model/host
#    from manifests/local-llm (the OS-agnostic shared contract Unix reads too).
$llmManifest = Join-Path $RepoRoot 'tools\setup\manifests\local-llm'
if (Test-Path $llmManifest) {
  $llm = @{}
  foreach ($raw in Get-Content $llmManifest) {
    $line = ($raw -replace '#.*$', '').Trim(); if (-not $line) { continue }
    $kv = $line -split '\s+', 2
    if ($kv.Count -eq 2) { $llm[$kv[0]] = $kv[1] }
  }
  $model = $llm['model']
  $llmHost = if ($llm['host']) { $llm['host'] } else { 'http://127.0.0.1:11434' }
  function Test-OllamaUp {
    param([string]$Base)
    try { Invoke-WebRequest -UseBasicParsing -Uri "$Base/api/version" -TimeoutSec 3 | Out-Null; return $true } catch { return $false }
  }
  if (-not $model) {
    Write-Host "warn: local-llm manifest has no 'model'; skipping local-LLM pull"
  } elseif (-not (Have ollama)) {
    Write-Host "warn: ollama not on PATH after the manifest step; skipping local-LLM (tests fall back to mock)"
  } else {
    if (-not (Test-OllamaUp -Base $llmHost)) {
      Write-Host "down starting ollama serve (background)..."
      Start-Process -FilePath ollama -ArgumentList 'serve' -WindowStyle Hidden -ErrorAction SilentlyContinue
      for ($i = 0; $i -lt 30; $i++) { if (Test-OllamaUp -Base $llmHost) { break }; Start-Sleep -Seconds 1 }
    }
    if (-not (Test-OllamaUp -Base $llmHost)) {
      Write-Host "warn: ollama daemon not reachable at $llmHost; skipping model pull (tests fall back to mock)"
    } else {
      # idempotent: only pull if the pinned model is absent (`ollama list` first column).
      $present = $false
      try {
        $listed = & ollama list 2>$null | Select-Object -Skip 1
        $present = [bool]($listed -match "^$([regex]::Escape($model))\s")
      } catch { $present = $false }
      if ($present) {
        Write-Host "ok local-LLM model $model already present"
      } else {
        Write-Host "down pulling $model (~400MB, one-time)..."
        $code = Invoke-ToolSoft { ollama pull $model }
        if ($code -ne 0) { Write-Host "warn: 'ollama pull $model' failed (exit $code); skipping (tests fall back to mock)" }
        else { Write-Host "ok local-LLM primitive ready: $model" }
      }
    }
  }
}

# 7. register the per-minute (windowless, conhost --headless) loop unless skipped.
if (-not $SkipLoopRegister) {
  Invoke-Tool { mise exec -- bun "$RepoRoot\tools\persistence\windows\install-scheduled-task.ts" --register } 'register loop task'
}

Write-Host ""
Write-Host "=== Install complete ==="
Write-Host "Open a new shell to pick up scoop + mise shims on PATH."
