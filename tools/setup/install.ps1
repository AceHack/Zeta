#Requires -Version 5.1
# tools/setup/install.ps1 -- Windows user-mode, DECLARATIVE install-graph entry.
#
# Parity with tools/setup/install.sh -> macos.sh (B-0857 Windows parity). System CLI tools
# resolve scoop -> winget -> chocolatey (operator 2026-05-30; scoop primary = user-mode, no
# admin, AI-native). Runtimes via mise/.mise.toml; agent CLIs via manifests/from-bun-global +
# bun --global -- the IDENTICAL files Unix uses, so the tool set stays in sync + symmetric across
# OSes. Background loop registered via src/Core.TypeScript/persistence/windows/install-scheduled-task.ts
# (schtasks ~= launchd). No admin required.
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
# silent (e.g. a failed manifest-driven bun global install). So route native calls through here: run
# stderr-tolerant (ErrorActionPreference=Continue so merged stderr is just text), surface output,
# then fault ONLY on a real non-zero exit code.
function Invoke-Tool {
  param([Parameter(Mandatory)][scriptblock]$Cmd, [string]$What = 'native command')
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $Cmd 2>&1 | ForEach-Object { Write-Host "$_" } } finally { $ErrorActionPreference = $prev }
  if ($LASTEXITCODE -ne 0) { throw "$What failed (exit $LASTEXITCODE)" }
}

# NARROW retry for failures produced by an external service that never answered.
#
# Measured 2026-09-10, `build-and-test (windows-11-arm)` on `main`: mise refused to install
# kubeconform because GitHub's attestation service returned 503 "trust-metadata-api service
# unavailable". Failing closed on an unverifiable artifact is CORRECT and stays. Giving up
# after one attempt is not: the whole Windows lane went red on `main` for an outage measured
# in seconds.
#
# The distinction this rests on, and the reason the list is short: a verification that RAN and
# said no must never be retried away -- only one that COULD NOT RUN is re-attemptable. A 5xx is
# the server declining to answer, not an answer. A checksum mismatch, a 404, or "no matching
# attestation found" are answers, and they fail immediately here as they always did.
#
# The needles are mirrored from `src/Core.TypeScript/ci/transient-toolchain-failure.ts`, where
# the classification is unit-tested (11 falsifiers; mutating the default verdict to `retry` is
# killed by 5, truncating this needle to "attestation" by 1). `audit-transient-retry-parity.ts`
# fails if the two lists drift, because a retry predicate that is broader here than there is
# exactly how red quietly becomes intermittent green.
$script:TransientToolNeedles = @(
  'trust-metadata-api service unavailable',
  '503 Service Unavailable',
  '502 Bad Gateway',
  '504 Gateway Time-out'
)

function Invoke-ToolWithTransientRetry {
  param(
    [Parameter(Mandatory)][scriptblock]$Cmd,
    [string]$What = 'native command',
    [int]$MaxAttempts = 3
  )
  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { $out = @(& $Cmd 2>&1 | ForEach-Object { Write-Host "$_"; "$_" }) } finally { $ErrorActionPreference = $prev }
    if ($LASTEXITCODE -eq 0) { return }

    $joined = ($out -join "`n")
    $matched = $null
    foreach ($needle in $script:TransientToolNeedles) {
      if ($joined -like "*$needle*") { $matched = $needle; break }
    }
    # DEFAULT IS FAIL-NOW. A predicate that defaulted to retry would eventually swallow a
    # real defect, and turning red into slow-green is worse than staying red.
    if ($null -eq $matched) { throw "$What failed (exit $LASTEXITCODE)" }
    if ($attempt -ge $MaxAttempts) {
      throw "$What failed (exit $LASTEXITCODE) after $MaxAttempts attempts; last transient signature was '$matched'. An outage that outlasts the budget is an outage worth failing on."
    }
    $delayMs = 2000 * [math]::Pow(2, [math]::Min($attempt, 4) - 1)
    Write-Host "warn: $What hit a transient upstream failure ('$matched'); attempt $attempt of $MaxAttempts, retrying in $([int]$delayMs)ms"
    Start-Sleep -Milliseconds ([int]$delayMs)
  }
}
# Capture native output with the same PowerShell 5.1 stderr discipline as Invoke-Tool. Used when
# the output is data consumed by this script rather than progress intended for the console.
function Get-ToolOutput {
  param([Parameter(Mandatory)][scriptblock]$Cmd, [string]$What = 'native command')
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { $lines = @(& $Cmd 2>&1 | ForEach-Object { "$_" }) } finally { $ErrorActionPreference = $prev }
  if ($LASTEXITCODE -ne 0) { throw "$What failed (exit $LASTEXITCODE)" }
  return $lines
}
function Test-IsWindowsArm64 {
  $architectures = @($env:PROCESSOR_ARCHITECTURE, $env:PROCESSOR_ARCHITEW6432)
  return [bool]($architectures | Where-Object { $_ -eq 'ARM64' } | Select-Object -First 1)
}
function Get-MiseConfiguredToolSpecs {
  param([string[]]$ExcludedTools = @())

  $json = (Get-ToolOutput { mise ls --current --json } 'mise ls --current --json') -join [Environment]::NewLine
  $inventory = $json | ConvertFrom-Json
  $specs = New-Object System.Collections.Generic.List[string]

  foreach ($property in $inventory.PSObject.Properties) {
    if ($ExcludedTools -contains $property.Name) { continue }
    # `mise ls --current` already scopes the inventory to configured entries. On a clean host,
    # mise reports those entries as active=false until they are installed, so active is not an
    # admissibility signal here; requested_version is the declarative source of truth.
    $configured = @($property.Value | Where-Object { $_.requested_version } | Select-Object -First 1)
    if ($configured.Count -ne 1) {
      throw "mise did not report one configured requested version for $($property.Name)"
    }
    [void]$specs.Add("$($property.Name)@$($configured[0].requested_version)")
  }

  if ($specs.Count -eq 0) { throw 'mise returned no configured tools to install' }
  return $specs.ToArray()
}
function Publish-ZetaRuntimePaths {
  param([Parameter(Mandatory)][string[]]$Paths)

  $entries = @($Paths | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Select-Object -Unique)
  if ($entries.Count -eq 0) { throw 'mise returned no active runtime bin paths after install' }

  foreach ($entry in $entries) {
    if (-not (Test-Path -LiteralPath $entry -PathType Container)) {
      throw "mise runtime bin path does not exist: $entry"
    }
  }

  $separator = [System.IO.Path]::PathSeparator
  $current = @($env:PATH -split [regex]::Escape([string]$separator) | Where-Object { $_ })
  $remaining = @($current | Where-Object { $entries -notcontains $_ })
  $env:PATH = (@($entries) + $remaining) -join $separator

  # GitHub Actions starts each run step in a new process. GITHUB_PATH is the supported channel
  # for carrying these runtime directories into those later steps. UTF-8 without BOM works in
  # Windows PowerShell 5.1 as well as pwsh 7.
  if ($env:GITHUB_PATH) {
    $utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
    foreach ($entry in $entries) {
      [System.IO.File]::AppendAllText($env:GITHUB_PATH, "$entry$([Environment]::NewLine)", $utf8NoBom)
    }
  }
}

# Windows CMake is Microsoft's Visual Studio C++ CMake tools, not scoop/winget/choco.
# Aaron 2026-09-01: that package is built with the VS generator, matching Ninja, and
# the MSVC/Windows SDK options native crates (aws-lc-sys, Feldera) expect. A second
# Kitware cmake from scoop is a different binary. Prefer the vswhere-found copy when
# the component is present; warn and do not scoop when it is not (Server Core smoke
# has no VS -- failing install there would be a hole in the shield).
function Publish-VisualStudioCmakePath {
  $vswhereCandidates = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft Visual Studio\Installer\vswhere.exe')
  )
  $vswhere = $vswhereCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
  if (-not $vswhere) {
    Write-Host 'warn: vswhere.exe not found; Windows CMake comes from Visual Studio C++ CMake tools (Microsoft.VisualStudio.Component.VC.CMake.Project), not scoop/winget. Native crates that need cmake will fail until that VS component is installed.'
    return
  }

  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $cmakeExe = $null
  $ninjaExe = $null
  try {
    $cmakeExe = (& $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.CMake.Project -find 'Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe' | Select-Object -First 1)
    $ninjaExe = (& $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.CMake.Project -find 'Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja\ninja.exe' | Select-Object -First 1)
  } finally {
    $ErrorActionPreference = $prev
  }
  $cmakeExe = if ($cmakeExe) { "$cmakeExe".Trim() } else { '' }
  $ninjaExe = if ($ninjaExe) { "$ninjaExe".Trim() } else { '' }

  $dirs = @()
  if ($cmakeExe -and (Test-Path -LiteralPath $cmakeExe)) {
    $dirs += [System.IO.Path]::GetDirectoryName($cmakeExe)
  }
  if ($ninjaExe -and (Test-Path -LiteralPath $ninjaExe)) {
    $dirs += [System.IO.Path]::GetDirectoryName($ninjaExe)
  }
  $dirs = @($dirs | Where-Object { $_ } | Select-Object -Unique)
  if ($dirs.Count -eq 0) {
    Write-Host 'warn: Visual Studio C++ CMake tools (Microsoft.VisualStudio.Component.VC.CMake.Project) not installed. Not installing scoop cmake -- that binary lacks the VS generator/MSVC options. Install VS Build Tools with Desktop development with C++ / CMake tools.'
    return
  }

  $separator = [System.IO.Path]::PathSeparator
  $current = @($env:PATH -split [regex]::Escape([string]$separator) | Where-Object { $_ })
  $remaining = @($current | Where-Object { $dirs -notcontains $_ })
  $env:PATH = (@($dirs) + $remaining) -join $separator
  if ($env:GITHUB_PATH) {
    $utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
    foreach ($entry in $dirs) {
      [System.IO.File]::AppendAllText($env:GITHUB_PATH, "$entry$([Environment]::NewLine)", $utf8NoBom)
    }
  }
  Write-Host "ok Visual Studio CMake: $cmakeExe"
}

# Best-effort native call: surface merged output, return the exit code, NEVER throw -- for GRACEFUL
# steps that must not brick install (e.g. the local-LLM pull + `optional` manifest tools). Mirrors
# mechanisms/from-ollama.sh's warn-and-continue discipline (exceptions-as-signals: best-effort substrate).
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
function Repair-CodexConfigServiceTier {
  $codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
  $codexConfig = Join-Path $codexHome 'config.toml'
  if (-not (Test-Path -LiteralPath $codexConfig)) { return }

  try {
    $text = [System.IO.File]::ReadAllText($codexConfig)
    $updated = [regex]::Replace(
      $text,
      '(?m)^(\s*service_tier\s*=\s*)"default"(\s*(?:#.*)?$)',
      '${1}"flex"$2'
    )
    if ($updated -ne $text) {
      $utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
      [System.IO.File]::WriteAllText($codexConfig, $updated, $utf8NoBom)
      Write-Host "ok codex config: migrated deprecated service_tier=`"default`" -> `"flex`" ($codexConfig)"
    }
  } catch {
    Write-Host "warn: could not migrate deprecated Codex service_tier in $codexConfig ($($_.Exception.Message)); continuing"
  }
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
#
#    A line may carry the `optional` token => BEST-EFFORT install (warn + continue on failure,
#    NEVER throw). This mirrors Linux's mechanisms/from-ollama.sh, which installs the ollama BINARY
#    gracefully (a download/extract/disk failure warns + continues -- the local-LLM model is
#    best-effort substrate, not a hard dep). ollama is `optional` so a disk-constrained CI
#    container (e.g. the Server Core docker-windows shield, where the ~1GB ollama download can
#    exhaust the sandbox disk -- run 86a365916) does NOT brick the whole install: a real desktop
#    has room and installs it; the constrained container warns + the toolchain still provisions.
#    Required tools (e.g. git, no `optional` token) still throw on failure.
$manifest = Join-Path $RepoRoot 'tools\setup\manifests\windows'
foreach ($raw in Get-Content $manifest) {
  $line = ($raw -replace '#.*$', '').Trim(); if (-not $line) { continue }
  $parts = $line -split '\s+'
  $scoopId = $parts[0]
  $winget = ($parts | Where-Object { $_ -like 'winget=*' }) -replace 'winget=', ''
  $choco = ($parts | Where-Object { $_ -like 'choco=*' }) -replace 'choco=', ''
  $optional = $parts -contains 'optional'             # best-effort: warn, never throw
  $wid = if ($winget) { $winget } else { $scoopId }   # if/else (5.1-safe; NOT the 7+ ?: ternary)
  $cid = if ($choco) { $choco } else { $scoopId }
  # Build the WHOLE chain (scoop -> winget -> choco), then try each in order until one succeeds.
  #
  # This used to be an if/elseif that picked the FIRST AVAILABLE source and ran only that one --
  # so the "scoop -> winget -> choco" in the label and in step 1b's comment ("the THIRD resolver
  # source") described a fallback that could never fire: scoop is bootstrapped a few lines above,
  # so `Have scoop` was always true and winget/choco were never consulted. A fallback that cannot
  # execute is the vacuity class -- it reads as resilience and supplies none.
  #
  # It cost a main-branch outage on 2026-08-26: `www.gnupg.org:443` stopped answering, scoop's
  # `main/gnupg` manifest downloads the installer from that single origin, and BOTH windows-2025
  # and windows-11-arm failed the toolchain step on every commit ("URL https://www.gnupg.org/... is
  # not valid" -> "scoop install gnupg failed (exit 1)"). `choco: 2.7.3` was on the same runner,
  # ships its own gnupg package, and was never asked. One unreachable upstream host took the lane
  # down because three declared resolvers were structurally one.
  #
  # Falling THROUGH on a non-zero exit (not merely on a missing CLI) is what makes the sources
  # independent: distinct package sources fetch from distinct origins, so a dead mirror, an expired
  # cert, or a rate-limited CDN on one is survivable. Cost is honest and bounded: a genuinely
  # broken package now burns one attempt per available source before it reports, and the report
  # names every attempt instead of only the first.
  $candidates = @()
  if ($(Have scoop))  { $candidates += @{ Cmd = { scoop install $scoopId }; What = "scoop install $scoopId" } }
  if ($(Have winget)) { $candidates += @{ Cmd = { winget install --id $wid --silent --accept-package-agreements --accept-source-agreements }; What = "winget install $wid" } }
  if ($(Have choco))  { $candidates += @{ Cmd = { choco install $cid -y }; What = "choco install $cid" } }
  Write-Host "down $scoopId (scoop -> winget -> choco)$(if ($optional) { ' [optional/best-effort]' } else { '' })"
  if ($candidates.Count -eq 0) {
    if ($optional) { Write-Host "warn: no package source (scoop/winget/choco) for optional '$scoopId'; skipping (best-effort)"; continue }
    throw "no package source (scoop/winget/choco) available for $scoopId"
  }
  $installed = $false
  $attempts = @()
  foreach ($candidate in $candidates) {
    $code = Invoke-ToolSoft $candidate.Cmd
    if ($code -eq 0) { $installed = $true; break }
    $attempts += "$($candidate.What) exit $code"
    Write-Host "warn: $($candidate.What) failed (exit $code); falling through to the next package source"
  }
  if (-not $installed) {
    $detail = ($attempts -join '; ')
    if ($optional) {
      Write-Host "warn: optional '$scoopId' install failed on EVERY package source ($detail); continuing (best-effort substrate -- e.g. disk-constrained CI; real desktops have room)"
    } else {
      throw "$scoopId failed on every available package source: $detail"
    }
  }
}

# 2b. Windows long-path enablement (B-0947 / MAX_PATH 260). Zeta's persona-archive filenames exceed
#     260 chars; without long-path support git refuses to create them ("Filename too long") + some
#     tools choke. Two layers (WebSearch 2026-05-31:
#     https://learn.microsoft.com/windows/win32/fileio/maximum-file-path-limitation):
#       Layer 1 (NO admin, load-bearing): git core.longpaths -- git prepends the Windows extended-length
#         prefix + bypasses MAX_PATH ITSELF (no registry, no reboot). Fixes the actual problem (git
#         creating Zeta's long files). Set --global for this user; always-safe, best-effort.
#       Layer 2 (admin-only, broader bonus): the OS-wide LongPathsEnabled registry DWORD (Win10 1607+;
#         helps all longPathAware apps; takes effect after a RESTART). Admin-gated + GRACEFUL like the
#         choco step -- set only when elevated, else print how to enable it. NEVER force elevation.
if (Have git) {
  $lpCode = Invoke-ToolSoft { git config --global core.longpaths true }
  if ($lpCode -eq 0) { Write-Host "ok git core.longpaths=true (user-global; git bypasses MAX_PATH via the Windows extended-length path mechanism -- no admin/reboot)" }
  else { Write-Host "warn: 'git config --global core.longpaths true' failed (exit $lpCode); continuing (best-effort)" }
} else {
  Write-Host "warn: git not on PATH yet; skipping git core.longpaths (re-run after git installs)"
}
if (Test-IsAdmin) {
  try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'LongPathsEnabled' -Value 1 -Type DWord
    Write-Host "ok OS LongPathsEnabled=1 (HKLM FileSystem) -- effective for longPathAware apps after a RESTART"
  } catch {
    Write-Host "warn: could not set OS LongPathsEnabled ($($_.Exception.Message)); git core.longpaths above already fixes git -- continuing"
  }
} else {
  Write-Host "OS-wide LongPathsEnabled needs admin -- skipped (git core.longpaths above covers git). To enable OS-wide: run elevated, or set HKLM\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled=1 (DWORD) + restart."
}

# 3. mise (runtime manager) via scoop -- mirrors macos.sh step 4 (brew install mise).
#
# PINNED, and pinned to the SAME version tools/setup/linux.sh pins. `scoop install mise`
# without a version installs whatever is current, which means the tool that enforces every
# other pin is itself unpinned. Measured 2026-08-29: linux.sh pins 2026.6.12 with six
# SHA256 hashes, .mise.toml declares `min_version = "2026.6.12"`, and Windows had drifted
# to 2026.8.14 -- a version that enforces aube's supply-chain trust policy, which the
# pinned Linux version does not. `build-and-test (windows-2025)` and `(windows-11-arm)`
# had been red on every commit for that reason, failing at install.ps1:52 on a policy no
# other platform applies.
#
# This does not weaken anything: it makes Windows match what the repo already DECLARES
# everywhere else. Whether the fleet should move UP to a mise that enforces the trust
# policy is a separate and still-open question -- see the PR body. Today that policy is
# enforced on exactly one platform, and it is the one that does not gate merges.
$MisePinVersion = '2026.6.12' # keep in sync with tools/setup/linux.sh MISE_PIN_VERSION
if (-not (Have mise)) {
  Invoke-Tool { scoop install "mise@$MisePinVersion" } "scoop install mise@$MisePinVersion"
}
Write-Host "mise: $(Get-ToolVersion { mise --version })"

# Fail LOUDLY on drift rather than silently running a different mise than Linux does.
# A version mismatch here is what produced the red Windows lane, and it was invisible
# because nothing compared the two.
$miseActual = (Get-ToolVersion { mise --version }) -replace '^\s*v?', '' -replace '\s.*$', ''
if ($miseActual -and $miseActual -ne $MisePinVersion) {
  Write-Host "WARNING: mise is $miseActual but tools/setup/linux.sh pins $MisePinVersion."
  Write-Host "         Three-way parity (GOVERNANCE.md SS24) requires the same version on"
  Write-Host "         every platform; a drifted mise applies different policies to the"
  Write-Host "         same .mise.toml. If this is intentional, bump BOTH together."
}

# 4. runtimes from .mise.toml (dotnet/python/java/bun/uv) -- IDENTICAL file to Unix (symmetric).
Push-Location $RepoRoot
try {
  Invoke-Tool { mise trust --all --yes } 'mise trust --all --yes'
  # HOST TIERS (workitem 081KTWQZY7F; narrowed by 081M25QNJ49087G0R000CRS6MN).
  #
  # WHAT THE TIER ACTUALLY BUYS ON WINDOWS. The only thing ZETA_HOST_TIER changes in this
  # script is MISE_ENV=full, which merges `.mise.full.toml`. Measured 2026-09-10 against
  # that file: over `.mise.toml` it adds exactly five tools -- k3d, kind, kubectl, helm and
  # `github:yannh/kubeconform` -- plus `zig` and `rust` entries that are deliberate
  # byte-identical mirrors of the base tier and so install the same versions either way.
  # No manifest this script reads (`manifests\windows`, `manifests\from-bun-global`,
  # `manifests\local-llm`) carries a `tier=` token, and install.ps1 drives no dotnet-global
  # manifest. So the tier's ENTIRE Windows payload is those five Kubernetes tools.
  #
  # NOTHING ON WINDOWS USES THEM. Every consumer is a Linux lane: gate.yml's
  # `lint (yaml/k8s)` installs its own kubeconform with `go install`, helm-validate.yml is
  # `ubuntu-24.04`, and k8s-argocd-health-test.yml (k3d/kind/kubectl) is `ubuntu-24.04`.
  # The Windows leg of `build-and-test` runs `dotnet build` + `dotnet test` over Zeta.sln
  # and invokes none of the five.
  #
  # Aaron 2026-09-10: "full k8s can't run on windows ... the only windows would be from our
  # vms inside k8s, eventually we may support windows non control nodes but today we don't".
  # So `full` here was never a capability claim about the host. It was a default nobody had
  # a reason to narrow.
  #
  # WHAT IT COST. `build-and-test (windows-11-arm)` on main failed at this very step because
  # `github:yannh/kubeconform@0.7.0` could not be installed -- GitHub's attestation service
  # returned 503. An outage in a Kubernetes tool took down a Windows build-and-test leg that
  # has no Kubernetes in it. Same shape as the `qemu` row in `manifests\windows`: a
  # dependency nothing on this platform invokes is still a way for this platform to go red.
  #
  # `standard` AND NOT `slim`, because this is a WORKLOAD statement rather than a capacity
  # one. The ranks are read as host SIZE elsewhere (`common/host-tier.sh` detects `slim`
  # below 8 GB), and a Windows dev box -- or a 16 GB GitHub runner -- is not a small host.
  # `standard` drops precisely the k8s set and keeps every standard-tier entry (the dotnet
  # diagnostics suite, stryker, fsharp-analyzers in `manifests/from-dotnet-global`)
  # available for the day Windows wires that manifest up.
  #
  # A DECLARATION STILL WINS, exactly as `common/host-tier.sh` specifies. Anyone who wants
  # the k8s set on Windows -- the "eventually" above -- exports ZETA_HOST_TIER=full and gets
  # it unchanged. The capability stays discoverable; it stops being the unasked-for default.
  if (-not $env:ZETA_HOST_TIER) { $env:ZETA_HOST_TIER = 'standard' }
  if ($env:ZETA_HOST_TIER -eq 'full') {
    $env:MISE_ENV = 'full'
  } else {
    # Loud, named, with both tiers -- the skip discipline at the top of
    # tools/setup/common/host-tier.sh, which this script cannot source (it is bash).
    Write-Host "-> k3d/kind/kubectl/helm/kubeconform skipped: require tier=full, host is $env:ZETA_HOST_TIER"
  }
  $miseEnvLabel = if ($env:MISE_ENV) { $env:MISE_ENV } else { '<none: base .mise.toml only>' }
  Write-Host "host tier: $env:ZETA_HOST_TIER (MISE_ENV=$miseEnvLabel)"
  if (-not $env:MISE_TRUSTED_CONFIG_PATHS) {
    $env:MISE_TRUSTED_CONFIG_PATHS = $RepoRoot
  } elseif ($env:MISE_TRUSTED_CONFIG_PATHS -notlike "*$RepoRoot*") {
    $env:MISE_TRUSTED_CONFIG_PATHS = "$($env:MISE_TRUSTED_CONFIG_PATHS);$RepoRoot"
  }
  # Parity with tools/setup/common/mise.sh: old NixOS mise cannot parse
  # python.github_attestations in .mise.toml (v2026.3.18+ only); env works everywhere.
  if (-not $env:MISE_PYTHON_GITHUB_ATTESTATIONS) { $env:MISE_PYTHON_GITHUB_ATTESTATIONS = '0' }
  $miseInstallSpecs = @()
  if (Test-IsWindowsArm64) {
    # These tools are optional for the Windows build/test lane and currently have no usable
    # Windows ARM64 install path: mise has no Java 26 metadata, semgrep's cryptography wheel falls
    # back to a source build without OpenSSL, and 1Password publishes no archive at the URL its
    # mise backend selects. Keep the exception narrow and visible; every other version still comes
    # from the active .mise.toml/.mise.full.toml graph rather than being duplicated here.
    $unsupported = @{
      'pipx:semgrep' = 'cryptography has no compatible wheel and its source build requires OpenSSL'
      '1password-cli' = 'the upstream Windows ARM64 archive is unavailable'
    }
    # Java is NO LONGER omitted here. It used to be, with the reason 'mise has no Java 26
    # metadata for Windows ARM64' -- which is true and remains true, but omitting the tool
    # left this platform with NO JAVA AT ALL rather than an older one. Measured 2026-09-09
    # against the vendor APIs, controlling against windows/x64 so a zero means absence and
    # not a broken query:
    #
    #   windows/x64      Adoptium: 21 yes, 25 yes, 26 yes
    #   windows/aarch64  Adoptium: 21 yes, 25 NO,  26 NO
    #   windows/aarch64  Azul Zulu: 21 yes, 25 yes, 26 NO
    #
    # So 26 genuinely does not exist for Windows-on-ARM from either vendor, and the newest
    # that does is Zulu 25. The pin in .mise.toml is deliberately NOT changed: every other
    # platform keeps 26, and this is a platform-coverage fallback, not a downgrade.
    #
    # VENDOR-QUALIFIED ON PURPOSE. A bare '25' resolves to Oracle OpenJDK, which publishes
    # no Windows ARM64 build, so it would fail the same way 26 does.
    #
    # BEST-EFFORT BY DESIGN: the current behaviour on this platform is no Java, so a failed
    # install here can only restore the status quo. It must never fail the bootstrap -- a
    # hard failure would make this change strictly worse than the omission it replaces.
    $armJavaSpec = 'java@zulu-25'
    try {
      Invoke-Tool { mise install --yes $armJavaSpec } "mise install --yes $armJavaSpec (Windows ARM64 Java fallback)"
      Write-Host "note: Windows ARM64 uses $armJavaSpec; .mise.toml's java 26 has no build for this platform."
    } catch {
      Write-Host "warn: Windows ARM64 Java fallback '$armJavaSpec' did not install: $($_.Exception.Message)"
      Write-Host "warn: this platform continues with no Java, as it did before this fallback existed."
    }
    foreach ($tool in @($unsupported.Keys | Sort-Object)) {
      Write-Host "warn: Windows ARM64 omits optional mise tool '$tool': $($unsupported[$tool])"
    }
    $miseInstallSpecs = @(Get-MiseConfiguredToolSpecs -ExcludedTools (@($unsupported.Keys) + @('java')))
    Invoke-ToolWithTransientRetry { mise install --yes @miseInstallSpecs } 'mise install --yes (Windows ARM64 supported tool graph)'
    $runtimeBinPaths = @(Get-ToolOutput { mise bin-paths --quiet @miseInstallSpecs } 'mise bin-paths --quiet (Windows ARM64 supported tool graph)')
    # Later bootstrap steps use `mise exec -- bun ...`. Its default exec_auto_install setting
    # otherwise expands back to the whole config and retries the three unsupported tools before
    # launching Bun. The supported graph is explicit and complete at this point, so disable only
    # that implicit expansion for the remainder of this Windows ARM64 process.
    $env:MISE_EXEC_AUTO_INSTALL = 'false'
  } else {
    Invoke-ToolWithTransientRetry { mise install --yes } 'mise install --yes'
    $runtimeBinPaths = @(Get-ToolOutput { mise bin-paths --quiet } 'mise bin-paths --quiet')
  }
  Publish-ZetaRuntimePaths $runtimeBinPaths
  Write-Host "ok mise runtimes on PATH: $($runtimeBinPaths.Count) active bin path(s)"
} finally { Pop-Location }

# 4b. Root JavaScript/TypeScript dependencies. Keep local setup aligned with CI and fail
# loudly when package.json and bun.lock disagree instead of allowing Bun to rewrite the lock.
Push-Location $RepoRoot
try {
  if (-not (Test-Path 'package.json') -or -not (Test-Path 'bun.lock')) {
    throw 'package.json and bun.lock are required for the root Bun install'
  }
  Invoke-Tool { mise exec -- bun install --frozen-lockfile } 'bun install --frozen-lockfile'
  Write-Host 'ok root JavaScript/TypeScript dependencies installed'
} finally { Pop-Location }

# 5. agent + peer-AI CLIs via bun --global (bun provided by mise) -- identical manifest to Unix.
$agentCliManifest = Join-Path $RepoRoot 'tools\setup\manifests\from-bun-global'
if (Test-Path $agentCliManifest) {
  foreach ($raw in Get-Content $agentCliManifest) {
    $line = ($raw -replace '#.*$', '').Trim(); if (-not $line) { continue }
    $parts = $line -split '\s+'
    $packageId = $parts[0] # later key=value qualifiers are metadata for smoke tests / adapters
    Invoke-Tool { mise exec -- bun install --global $packageId } "bun install -g $packageId"
  }
} else {
  Write-Host "warn: agent-clis manifest missing; skipping agent CLI install"
}
Repair-CodexConfigServiceTier

# 5a. The from-url realizer -- the ONE mechanism manifest Windows was silently
# skipping. `install.ps1` re-implements `manifests\windows` and
# `manifests\from-bun-global` inline and drove NO Bun realizer at all, so a
# Windows box provisioned by this script never got `src/Core.Alloy/alloy.jar`
# and, since 081M23ESC5B087G0R002HJ39DG, would never get
# `src/Core.TLA/tla2tools.jar` either. That was invisible rather than loud:
# Alloy's gate leg only asserts the jar on Linux-x64 CI, so Windows just
# skipped the checks and reported green.
#
# Scope is DELIBERATELY one mechanism, not `--all`. The other fourteen `from-*`
# realizers were written against Unix hosts and have never run here; turning
# them all on in a fix for the jars would be shipping fourteen untested code
# paths under one commit. `from-url` is curl-to-a-digest-pinned-path, which is
# platform-neutral, and it is the mechanism the verifier jars actually use.
#
# GRACEFUL, matching every other optional step in this file: a network failure
# WARNS and continues rather than bricking a dev laptop's install. The jars'
# absence is not silent afterwards -- the F# gate-leg tests and
# `lint-verifier-jar-provenance.ts` are what turn a missing jar red, and they
# are the right place for that verdict.
$setupRealize = Join-Path $RepoRoot 'src\Core.TypeScript\ace\setup-realize.ts'
if (Test-Path $setupRealize) {
  Push-Location $RepoRoot
  try {
    $urCode = Invoke-ToolSoft { mise exec -- bun src/Core.TypeScript/ace/setup-realize.ts from-url }
    if ($urCode -eq 0) { Write-Host 'ok from-url realizer -- digest-pinned verifier jars fetched' }
    else { Write-Host "warn: from-url realizer failed (exit $urCode); verifier jars may be absent; continuing" }
  } finally { Pop-Location }
} else {
  Write-Host 'warn: setup-realize.ts missing; skipping from-url realizer'
}

# 5b. Expose the repo's package bins (ace, zeta-shadow) on PATH via `bun link` (the package.json
# `bin` map declares them). Best-effort + GRACEFUL (Invoke-ToolSoft): a failure WARNS and
# continues -- convenience commands, not hard deps; never brick install. Parity with
# mechanisms/from-bun-link.sh on Unix.
Push-Location $RepoRoot
try {
  $rbCode = Invoke-ToolSoft { mise exec -- bun link }
  if ($rbCode -eq 0) { Write-Host "ok bun link -- ace + zeta-shadow linked (open a new shell to pick up bun's global bin on PATH)" }
  else { Write-Host "warn: 'bun link' failed (exit $rbCode); run it in the repo root manually; continuing" }
} finally { Pop-Location }

# 6. local-LLM core primitive -- pull the pinned model (the ollama BINARY is installed by the
#    manifest loop in step 2; ollama is `optional` there, so on a disk-constrained container it may
#    be ABSENT -- this step already handles that gracefully via the `-not (Have ollama)` branch).
#    Mirrors mechanisms/from-ollama.sh: idempotent (skip when the model is already present) + GRACEFUL (a
#    registry/network/daemon failure WARNS and continues -- it must NEVER brick install; the
#    primitive's tests skip-if-absent -> mock-only, per exceptions-as-signals). Reads model/host
#    from manifests/from-ollama (the OS-agnostic shared contract Unix reads too).
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
    Write-Host "warn: ollama not on PATH after the manifest step (optional; may be disk-skipped in CI); skipping local-LLM (tests fall back to mock)"
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
  Invoke-Tool { mise exec -- bun "$RepoRoot\src\Core.TypeScript\persistence\windows\install-scheduled-task.ts" --register } 'register loop task'
}

Publish-VisualStudioCmakePath

Write-Host ""
Write-Host "=== Install complete ==="
Write-Host "Runtime paths are active now; open a new shell to pick up persistent scoop shims."
