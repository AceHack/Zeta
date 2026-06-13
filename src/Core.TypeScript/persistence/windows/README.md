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
| `StartInterval` 60 | `<TimeTrigger>` (past `<StartBoundary>` + `StartWhenAvailable`) + `<Repetition>` `PT1M`/`P3650D` — wall-clock timer, ticks while logged on |
| `RunAtLoad` true | `TimeTrigger` past-boundary starts immediately on register; `LogonTrigger` also restarts at sign-in |
| `KeepAlive` + `ThrottleInterval` | `<RestartOnFailure>` + `<MultipleInstancesPolicy>IgnoreNew` |
| `StandardOutPath`/`ErrorPath` | wrapper redirects to `%LOCALAPPDATA%\zeta-otto-loop\*.log` |
| plist UTF-8 | task XML **UTF-16** (`schtasks /Create /XML` requirement) |

## Install

```powershell
# Heartbeat-only (default — proves the mechanism). --ref defaults to main,
# which is correct now that slice 1 + 1b are merged (#6108):
bun tools/persistence/windows/install-scheduled-task.ts --register

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
Get-Content "$env:LOCALAPPDATA\zeta-otto-loop\wrapper.log" -Tail 5   # heartbeat line
```

Logs + state: `%LOCALAPPDATA%\zeta-otto-loop\` (`wrapper.log`, `wrapper.err`,
`last-heartbeat-push.txt`, `loop-ref.txt`, `state\`). The dedicated clone:
`%LOCALAPPDATA%\zeta-otto-loop\Zeta`.

## Uninstall

```powershell
schtasks /Delete /TN ZetaOttoLoop /F
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\zeta-otto-loop"   # optional: clone + logs
```

## Notes

- **Loop-ref lifecycle (flip to `main` on merge):** the installer writes your `--ref` to
  `%LOCALAPPDATA%\zeta-otto-loop\loop-ref.txt`; the wrapper reads it and the tick resets the
  clone to `origin/<ref>` each cycle. If you install against a *feature branch* and that branch
  later merges and is deleted, the per-cycle `git reset --hard origin/<feature-branch>` starts
  failing (the ref is gone). Flip it to main:

  ```powershell
  $b = "$env:LOCALAPPDATA\zeta-otto-loop"
  Set-Content "$b\loop-ref.txt" main -NoNewline          # tick will reset to origin/main next cycle
  git -C "$b\Zeta" fetch origin                           # bring the clone onto main once
  git -C "$b\Zeta" checkout main
  git -C "$b\Zeta" reset --hard origin/main
  ```

  The default `--ref main` needs no flip — this only applies when you tracked a feature branch.
- **Triggers (why both `TimeTrigger` and `LogonTrigger`):** the XML uses a `TimeTrigger`
  with a past `<StartBoundary>` + `StartWhenAvailable` so the loop starts immediately on
  register and ticks every minute while logged on (true `StartInterval` parity), plus a
  `LogonTrigger` so it also restarts at sign-in. Both repetitions carry an explicit
  `<Duration>P3650D</Duration>` — without it, `schtasks /Create /XML` registers a degenerate
  `<Repetition>` that never fires (symptom: `Next Run Time: N/A`, runs once at logon then stops).
- **Cross-machine heartbeat (slice-1b — landed):** after each tick the wrapper pushes a
  ZetaID-keyed heartbeat to the shared `agent-heartbeats` branch (append-only, no PR, via the
  REST git-data API) using `tools/agent-heartbeats/write-heartbeat.ts --push --persona-name
  otto-windows --disposition loop-tick`. Gated to ~10 min (the per-minute tick covers local
  git-state; cross-machine "is-it-alive" visibility doesn't need every minute), stamped to
  `last-heartbeat-push.txt`, and best-effort — a failed push warns to `wrapper.err` and never
  fails the tick.
- **Windowless launch (`conhost --headless`):** the task action is `conhost.exe --headless pwsh.exe …`, not `pwsh.exe` directly. A Task Scheduler *interactive* task otherwise flashes a console window every fire (and the wrapper's git/bun children pop their own); the headless pseudoconsole is inherited by the whole process tree so nothing shows. Trade-off: `conhost --headless` swallows the child exit code, so the task's **Last Result is always 0** — the wrapper writes the real tick result to `last-tick-result.txt` (and the heartbeat reports health), so schtasks Last Result is *not* the health signal.
- **Tests:** `bun test ./tools/persistence/windows/install-scheduled-task.test.ts` and
  `bun test ./tools/persistence/loop-subprocess-path.test.ts` (tests live under `tools/`
  because `bun test` does not discover dot-directories).
