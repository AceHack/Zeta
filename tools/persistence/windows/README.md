# Windows background-service loop — user-mode Task Scheduler installer

Windows parity for the macOS launchd autonomous-loop service (`tools/shadow/launchd/`,
`tools/kiro/launchd/`, `tools/ops/setup-dual-background-agents.ts`). Registers the Zeta
autonomous-loop tick as a **user-mode** Windows Scheduled Task — no admin, no UAC,
no Windows Service.

## What it does

`install-scheduled-task.ts` renders `scheduled-task.xml` (UTF-16) and registers it via
`schtasks /Create`. The task fires **at logon + every minute** (`PT1M` repetition) and
runs `otto-loop-wrapper.ps1`, which runs `.claude/bin/claude-loop-tick.ts` against a
**dedicated clone** at `%LOCALAPPDATA%\zeta-otto-loop\Zeta`.

### Why a dedicated clone (read this)

The tick does `git fetch origin` → **`git reset --hard origin/main`** every cycle (correct
for a background worker). It therefore **must never run against your working checkout** — it
would wipe uncommitted work and reset your branch each minute. The dedicated clone keeps the
loop fully isolated from the checkout you develop in. (Exact parity with the macOS dual-agent
setup, which clones to `~/.local/share/zeta-claude-loop-*/Zeta`.)

## Parity map (launchd → Task Scheduler)

| launchd (macOS) | Task Scheduler (Windows, user-mode) |
|---|---|
| LaunchAgent in `~/Library/LaunchAgents` | per-user task, no admin |
| `gui/$uid` domain | `<LogonType>InteractiveToken</LogonType>` |
| (user agent, never elevated) | **omit `<RunLevel>`** → `Limited` (no UAC) |
| `StartInterval` 60 | `<LogonTrigger>` + `<Repetition><Interval>PT1M</Interval>` |
| `RunAtLoad` true | logon trigger fires at sign-in |
| `KeepAlive` + `ThrottleInterval` | `<RestartOnFailure>` + `<MultipleInstancesPolicy>IgnoreNew` |
| `StandardOutPath`/`ErrorPath` | wrapper redirects to `%LOCALAPPDATA%\zeta-otto-loop\*.log` |
| plist UTF-8 | task XML **UTF-16** (`schtasks /Create /XML` requirement) |

## Install

```powershell
# Heartbeat-only (default — proves the mechanism). --ref defaults to main;
# use the feature branch until the loop-tick PATH fix merges to main.
bun tools/persistence/windows/install-scheduled-task.ts --register --ref feat/windows-parity-2026-05-30

# Dry-run (print the rendered XML, no clone, no register):
bun tools/persistence/windows/install-scheduled-task.ts

# Enable harness-launch instead of heartbeat-only:
#   uncomment ZETA_CLAUDE_LOOP_RUN_CLAUDE in otto-loop-wrapper.ps1, OR
bun tools/persistence/windows/install-scheduled-task.ts --register --run-claude --model sonnet
```

Flags: `--task-name <n>` (default `ZetaOttoLoop`) · `--ref <r>` (default `main`) ·
`--run-claude` · `--model <m>` · `--clone-dir <p>` · `--repo-root <p>` ·
`--dry-run` · `--register`.

## Verify

```powershell
schtasks /Query /TN ZetaOttoLoop /V /FO LIST          # Run As User, Logon Mode, Schedule
(Get-ScheduledTask -TaskName ZetaOttoLoop).Principal  # RunLevel=Limited, LogonType=InteractiveToken (user-mode)
schtasks /Run /TN ZetaOttoLoop                          # force one run
Get-Content "$env:LOCALAPPDATA\zeta-otto-loop\runner.log" -Tail 5   # heartbeat line
```

Logs + state: `%LOCALAPPDATA%\zeta-otto-loop\` (`runner.log`, `ticks.log`, `wrapper.log`,
`state\`). The dedicated clone: `%LOCALAPPDATA%\zeta-otto-loop\Zeta`.

## Uninstall

```powershell
schtasks /Delete /TN ZetaOttoLoop /F
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\zeta-otto-loop"   # optional: clone + logs
```

## Notes

- **Repetition fallback:** if `schtasks /Create /XML` rejects the `<Repetition>` without a
  `<Duration>`, add `<Duration>P3650D</Duration>` inside `<Repetition>` in
  `scheduled-task.xml` and re-register.
- **Cross-machine heartbeat (follow-up):** the tick writes a local
  `<clone>\.git\agent-heartbeats\claude-launchd-loop.json` — *not pushed*. Pushing it to the
  shared `agent-heartbeats` branch (append-only, no PR) would give cross-machine fleet
  visibility between this Windows loop and the macOS factory. Tracked as slice-1b.
- **Tests:** `bun test ./tools/persistence/windows/install-scheduled-task.test.ts` and
  `bun test ./tools/persistence/loop-subprocess-path.test.ts` (tests live under `tools/`
  because `bun test` does not discover dot-directories).
