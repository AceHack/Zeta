#Requires -Version 5.1
# otto-loop-wrapper.ps1 -- per-tick entry point for the Zeta autonomous loop on Windows.
# Task Scheduler runs this each minute (at-logon trigger + PT1M repetition, user-mode).
#
# Parity with tools/kiro/kiro-loop-wrapper.sh. Runs the loop tick against a DEDICATED
# CLONE under %LOCALAPPDATA%\zeta-otto-loop\Zeta -- NEVER the operator checkout, because
# the tick does `git reset --hard origin/<ref>` which would wipe a working checkout.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Base   = Join-Path $env:LOCALAPPDATA 'zeta-otto-loop'
$Clone  = Join-Path $Base 'Zeta'
$LogDir = $Base
New-Item -ItemType Directory -Force -Path $Base | Out-Null

# Which ref the dedicated clone tracks. The installer writes loop-ref.txt (--ref);
# default 'main' once the loop substrate is merged. The tick resets to origin/<ref>.
$refFile = Join-Path $Base 'loop-ref.txt'
$ref = if (Test-Path $refFile) { (Get-Content $refFile -Raw).Trim() } else { 'main' }

$git = (Get-Command git -ErrorAction SilentlyContinue).Source
$bun = (Get-Command bun -ErrorAction SilentlyContinue).Source
if (-not $git) { "$(Get-Date -Format o) ERROR git not on PATH" | Out-File -Append (Join-Path $LogDir 'wrapper.err'); exit 1 }
if (-not $bun) { "$(Get-Date -Format o) ERROR bun not on PATH" | Out-File -Append (Join-Path $LogDir 'wrapper.err'); exit 1 }

# Clone-if-missing safety net (the installer normally creates the clone at the chosen
# --ref; this only fires if the dir vanished). Never touches the operator checkout.
if (-not (Test-Path (Join-Path $Clone '.git'))) {
    & $git clone https://github.com/Lucent-Financial-Group/Zeta.git $Clone *>> (Join-Path $LogDir 'wrapper.log')
    & $git -C $Clone checkout $ref *>> (Join-Path $LogDir 'wrapper.log')
}

# The tick reads these to override its macOS-default paths onto Windows locations.
$env:ZETA_CLAUDE_LOOP_WORKTREE  = $Clone
$env:ZETA_CLAUDE_LOOP_STATE_DIR = Join-Path $Base 'state'
$env:ZETA_CLAUDE_LOOP_LOG_DIR   = $LogDir
$env:ZETA_CLAUDE_LOOP_REF       = $ref
# Heartbeat-only by default (slice 1 -- proves the mechanism). Uncomment for harness-launch:
# $env:ZETA_CLAUDE_LOOP_RUN_CLAUDE = '1'
# $env:ZETA_CLAUDE_LOOP_MODEL      = 'sonnet'

Set-Location $Clone
$tick = Join-Path $Clone '.claude\bin\claude-loop-tick.ts'
& $bun $tick *>> (Join-Path $LogDir 'wrapper.log')
$tickExit = $LASTEXITCODE

# slice-1b -- cross-machine heartbeat-push to the shared agent-heartbeats branch (PR-free,
# REST, ZetaID-keyed via tools/agent-heartbeats/write-heartbeat.ts). Gated to ~10 min to be
# host-considerate: the per-minute tick covers local git-state; cross-machine "is-it-alive"
# visibility doesn't need every minute. Best-effort -- never fails the tick.
$hbStamp = Join-Path $Base 'last-heartbeat-push.txt'
$pushHb = $true
if (Test-Path $hbStamp) {
    try {
        $last = [datetime]::Parse((Get-Content $hbStamp -Raw).Trim())
        if (((Get-Date) - $last).TotalMinutes -lt 10) { $pushHb = $false }
    } catch { $pushHb = $true }
}
if ($pushHb) {
    # NOTE: PowerShell try/catch does NOT trap non-zero exits from native exes
    # (bun.exe here); $ErrorActionPreference='Stop' only governs cmdlets, and
    # $PSNativeCommandUseErrorActionPreference is PS 7.3+ (this script floors at
    # 5.1). So check $LASTEXITCODE explicitly and only stamp $hbStamp on success --
    # stamping on failure would suppress retries for ~10 min (see gate above).
    & $bun (Join-Path $Clone 'src\Core.TypeScript\agent-heartbeats\write-heartbeat.ts') `
        --push --persona-name otto-windows --disposition loop-tick *>> (Join-Path $LogDir 'wrapper.log')
    if ($LASTEXITCODE -eq 0) {
        (Get-Date -Format o) | Out-File -Encoding utf8 $hbStamp
    } else {
        "$(Get-Date -Format o) WARN heartbeat-push failed (exit $LASTEXITCODE)" | Out-File -Append (Join-Path $LogDir 'wrapper.err')
    }
}

# slice-2b -- optional desktop install.ps1 smoke (gated, best-effort, never fails the tick).
# Asserts install.ps1's outcomes on this real Win desktop (scoop/git/mise/bun/claude +
# ZetaOttoLoop health). Default OFF -- opt in by setting ZETA_RUN_DESKTOP_SMOKE on the task.
if ($env:ZETA_RUN_DESKTOP_SMOKE) {
    $smoke = Join-Path $Clone 'src\Core.TypeScript\ci\windows-install-ps1-smoke.ts'
    if (Test-Path $smoke) {
        & $bun $smoke --mode desktop *>> (Join-Path $LogDir 'desktop-smoke.log')
        "$(Get-Date -Format o) exit=$LASTEXITCODE" | Out-File -Encoding utf8 (Join-Path $Base 'desktop-smoke-result.txt')
    }
}
# The conhost --headless launcher (scheduled-task action) swallows this exit code, so the
# task's Last Result always reads 0. Write the real tick result for health observability.
"$(Get-Date -Format o) exit=$tickExit" | Out-File -Encoding utf8 (Join-Path $Base 'last-tick-result.txt')

exit $tickExit
