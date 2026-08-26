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
if (-not (Have mise)) { Invoke-Tool { scoop install mise } 'scoop install mise' }
Write-Host "mise: $(Get-ToolVersion { mise --version })"

# 4. runtimes from .mise.toml (dotnet/python/java/bun/uv) -- IDENTICAL file to Unix (symmetric).
Push-Location $RepoRoot
try {
  Invoke-Tool { mise trust --all --yes } 'mise trust --all --yes'
  # HOST TIERS (workitem 081KTWQZY7F): Windows boxes are dev machines -- full tier unless
  # explicitly declared otherwise; full merges .mise.full.toml (the k8s set) via MISE_ENV.
  if (-not $env:ZETA_HOST_TIER) { $env:ZETA_HOST_TIER = 'full' }
  if (-not $env:ZETA_HOST_TIER -or $env:ZETA_HOST_TIER -eq 'full') {
    $env:MISE_ENV = 'full'
  }
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
      'java' = 'mise has no Java 26 metadata for Windows ARM64'
      'pipx:semgrep' = 'cryptography has no compatible wheel and its source build requires OpenSSL'
      '1password-cli' = 'the upstream Windows ARM64 archive is unavailable'
    }
    foreach ($tool in @($unsupported.Keys | Sort-Object)) {
      Write-Host "warn: Windows ARM64 omits optional mise tool '$tool': $($unsupported[$tool])"
    }
    $miseInstallSpecs = @(Get-MiseConfiguredToolSpecs -ExcludedTools @($unsupported.Keys))
    Invoke-Tool { mise install --yes @miseInstallSpecs } 'mise install --yes (Windows ARM64 supported tool graph)'
    $runtimeBinPaths = @(Get-ToolOutput { mise bin-paths --quiet @miseInstallSpecs } 'mise bin-paths --quiet (Windows ARM64 supported tool graph)')
    # Later bootstrap steps use `mise exec -- bun ...`. Its default exec_auto_install setting
    # otherwise expands back to the whole config and retries the three unsupported tools before
    # launching Bun. The supported graph is explicit and complete at this point, so disable only
    # that implicit expansion for the remainder of this Windows ARM64 process.
    $env:MISE_EXEC_AUTO_INSTALL = 'false'
  } else {
    Invoke-Tool { mise install --yes } 'mise install --yes'
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

Write-Host ""
Write-Host "=== Install complete ==="
Write-Host "Runtime paths are active now; open a new shell to pick up persistent scoop shims."
