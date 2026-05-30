# Windows parity for the pre-install surface — design spec

**Date:** 2026-05-30
**Author:** Otto (Claude Code) + Aaron, on the ServiceTitan Windows laptop
**Status:** design — approved for spec-write (Aaron green-light 2026-05-30); slice 1 = build target
**Branch:** `feat/windows-parity-2026-05-30`

## Problem

Zeta's pre-install surface is macOS/Linux only. Two gaps:

1. **Install graph** — `tools/setup/install.sh` dispatches `Darwin → macos.sh`,
   `Linux → linux.sh`, and **errors on everything else** (`install.sh:159`:
   "unsupported OS … Windows backlogged"). A Windows developer cannot bootstrap.
2. **Persistent background-agent service** — the autonomous-loop / heartbeat worker
   is installed only as a **macOS launchd LaunchAgent** (`tools/shadow/launchd/`,
   `tools/kiro/launchd/`, `tools/ops/setup-dual-background-agents.ts`). There is no
   Windows equivalent, so the loop cannot survive session-exit/reboot on Windows.

Goal: **meet the Windows developer where they live** — a user-mode, client-workstation
solution at parity with the macOS surfaces.

## Operator constraints (Aaron, 2026-05-30)

- **User-mode preferred.** This is a *client workstation, not a server.* Admin is
  available on this PC but held in reserve; the clean solution must not require it.
- **Network is ServiceTitan's — off-limits.** Never remove the corporate AV/EDR agent
  (it is wired into network access control; removing it quarantines the machine).
- **scoop = primary** package manager (no-admin, AI-native); winget/choco = fallback
  only for the rare admin-only tool. (Governs slice 2.)
- **Git identity:** Zeta commits use the personal email, set repo-local (done).
- **IP boundary:** `../scratch` and `../SQLSharp` are citeable prior-art; the
  industry-vertical reference repo is look-only and is never named in Zeta.
- **Rule 0:** `.ps1` is the sanctioned Windows install-graph form (cf. `powershell-expert`
  skill); `.ts` (bun) for app-logic such as the service installer.

## Prior-art grounding

| Source | What it gives |
|---|---|
| `tools/shadow/launchd/install-launchagent.ts` | The TS-installer pattern to mirror: detect bun + repo-root, safe placeholder substitution (XML-escaped), validate, atomic write, optional bootstrap |
| `tools/kiro/launchd/com.lucent.zeta.kiro-loop.plist` + `install.sh` | The persistent-loop plist shape (StartInterval 60, RunAtLoad, log paths, `__REPO_ROOT__`/`__USER_HOME__` placeholders) + install flow (bootout → substitute → lint → bootstrap) |
| `tools/ops/setup-dual-background-agents.ts` | **The canonical Otto worker**: launchd runs `.claude/bin/claude-loop-tick.ts` with env `ZETA_CLAUDE_LOOP_RUN_CLAUDE=1` + `_MODEL` + `_WORKTREE` |
| `../scratch/scripts/setup/windows/*.ps1` | Cross-OS PowerShell install-graph template (slice 2): `bootstrap.ps1`, `common.ps1` (`Test-IsAdministrator`), `choco.ps1`, `mise.ps1`, `dotnet.ps1`, `services.ps1`, `PLATFORM_PARITY.md` |
| This machine's `OneDrive Startup Task` (exported XML) | Authoritative Task Scheduler XML schema for a real user-mode, Limited-privilege, logon-triggered task |

## Slices

- **Slice 1 (this spec's build target): user-mode Windows background-service installer.**
- **Slice 2 (follow-up): install-graph `windows.ps1` + `install.sh` dispatch** (scoop-primary, port from `../scratch`).
- **Slice 3 (follow-up, thin): elevation/biometric parity doc** — user-mode needs no
  runtime elevation; Windows Hello = the *interactive* Touch ID parity only.

---

## Slice 1 design — Windows user-mode background-service installer

### Parity map (launchd → Task Scheduler)

| launchd (macOS) | Task Scheduler (Windows, user-mode) |
|---|---|
| LaunchAgent in `~/Library/LaunchAgents` | Per-user task, no admin |
| `gui/$uid` domain | `<Principal><LogonType>InteractiveToken</LogonType></Principal>` |
| (user agent, never elevated) | **OMIT `<RunLevel>`** → resolves to `Limited` (least-privilege; no UAC) |
| `StartInterval` 60 | `<LogonTrigger>` + `<Repetition><Interval>PT1M</Interval><StopAtDurationEnd>false</StopAtDurationEnd></Repetition>` |
| `RunAtLoad` true | logon trigger fires at sign-in |
| `KeepAlive` + `ThrottleInterval` | `<RestartOnFailure>` + `<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>` |
| `StandardOutPath`/`StandardErrorPath` | wrapper redirects to `%LOCALAPPDATA%\zeta-otto-loop\*.log` |
| plist is UTF-8 | **task XML must be UTF-16** (`schtasks /Create /XML` requirement) |

For a dev laptop the OneDrive-default settings are flipped: `RunOnlyIfNetworkAvailable=false`,
`StopIfGoingOnBatteries=false`, `DisallowStartIfOnBatteries=false`, `StopOnIdleEnd=false`
— so the tick keeps firing on battery / offline / idle.

### Keystone: reuse the existing tick script (no new tick needed)

`.claude/bin/claude-loop-tick.ts` is **~90% cross-platform already**, by design:

- `worktree` / `stateDir` / `logDir` default to macOS paths but are **overridable** via
  `ZETA_CLAUDE_LOOP_WORKTREE` / `_STATE_DIR` / `_LOG_DIR`. The Windows task sets these to
  `%LOCALAPPDATA%\zeta-otto-loop\…`.
- `home = process.env.HOME ?? homedir()` — `homedir()` returns the correct Windows home.
- `process.kill(pid, 0)` stale-lock check works on Windows.
- All subprocesses (git/gh/bun/claude) are cross-platform.
- The **heartbeat-vs-harness-launch** behaviour is just the `ZETA_CLAUDE_LOOP_RUN_CLAUDE`
  env var (unset = light heartbeat; `=1` = launch `claude -p`). Not a fork — a setting.

**The one real code gap:** `claude-loop-tick.ts` (~line 60) hardcodes a POSIX `PATH`
(`/opt/homebrew/bin:/usr/local/bin:…`) and **replaces** `process.env.PATH` with it. On
Windows that erases the PATH so git/gh/bun/claude are not found. Fix = OS-conditional:
on Windows, inherit `process.env.PATH` (set up by the wrapper) instead of replacing it;
on macOS keep current behaviour.

### Components (new dir `tools/persistence/windows/`)

1. **`scheduled-task.xml`** — Task Scheduler XML template (the `.plist` analog).
   Placeholders: `{{REPO_ROOT}}`, `{{BUN_PATH}}`, `{{WRAPPER_PATH}}`, `{{USER_ID}}`,
   `{{LOG_DIR}}`. Written UTF-16. Schema per the verified OneDrive reference.
2. **`otto-loop-wrapper.ps1`** — `Set-StrictMode`; ensure mise/bun/dotnet + inherited
   PATH; source the PowerShell zeta-shellenv if present; `cd $RepoRoot`; set the
   `ZETA_CLAUDE_LOOP_*` env (Windows paths + `RUN_CLAUDE`/`MODEL`); `bun .claude/bin/claude-loop-tick.ts`;
   redirect output to `%LOCALAPPDATA%\zeta-otto-loop\`. (`.ps1` = install-graph-adjacent → Rule-0 OK.)
3. **`install-scheduled-task.ts`** — TS installer **mirroring `install-launchagent.ts`**:
   `parseArgs` (`--bun-path` / `--repo-root` / `--task-name` / `--run-claude` / `--model`
   / `--dry-run` / `--register`); detect bun (`where.exe bun` / `Get-Command`) + repo-root
   (`git rev-parse --show-toplevel`); XML-escaped placeholder substitution; refuse on any
   leftover `{{…}}`; write **UTF-16**; then `schtasks /Delete /TN <name> /F` →
   `schtasks /Create /TN <name> /XML <file>`. `--dry-run` prints the XML.
4. **`install-scheduled-task.test.ts`** — bun test on the pure functions (`parseArgs`,
   `substitutePlaceholders`, `xmlEscape`, UTF-16 encoding), same shape as the launchd test.
5. **`README.md`** — install / verify (`schtasks /Query /TN <name> /XML`,
   `Get-ScheduledTask -TaskName <name>`) / uninstall (`schtasks /Delete /TN <name> /F`).
6. **`.claude/bin/claude-loop-tick.ts` PATH fix** — the OS-conditional change above.

### Error handling

- Installer refuses on leftover placeholders; validates bun is an executable file and
  repo-root is a directory; validates the XML parses before registering.
- Wrapper runs under `Set-StrictMode`; logs and exits non-zero on failure
  (`IgnoreNew` prevents tick pile-up).
- Tick already has a lock-dir mutex (overlapping-run guard) + zero-PR backoff.

### Testing

- **Unit:** `bun test tools/persistence/windows/install-scheduled-task.test.ts`
  (pure functions; no registration side effects).
- **Manual on this laptop (tooling already present):** `--dry-run` prints valid XML →
  `--register` creates the task → `schtasks /Query /TN <name>` shows it with
  `RunLevel=Limited` / `LogonType=InteractiveToken` → wrapper runs the tick → heartbeat
  appears in `%LOCALAPPDATA%\zeta-otto-loop\runner.log`.
- **Acceptance:** task registered **user-mode** (no admin/UAC), fires at-logon + every
  minute, the tick writes a heartbeat, and `schtasks /Delete` cleanly removes it.

### Out of scope (slice 1)

- Install-graph `windows.ps1` (slice 2).
- Elevation/biometric parity doc (slice 3).
- Hardening the headless `claude -p` launch on Windows beyond what `RUN_CLAUDE` already
  provides (follow-up once the mechanism is proven).

## Convention / discipline compliance

- **Rule 0:** `.ps1` wrapper (install-graph-adjacent) + `.ts` installer (app-logic) —
  same split the launchd installer uses.
- **Canonical home:** `tools/persistence/windows/` — sibling concept to
  `tools/shadow/launchd/` and `tools/kiro/launchd/`.
- **IP boundary:** all prior-art cited is `../scratch`, `../SQLSharp`, or Zeta's own
  artifacts; the industry-vertical repo is not referenced.
- **Identity:** committed under the personal email on `feat/windows-parity-2026-05-30`.

## Open questions for review

1. **Spec home** — `docs/plans/` (chosen over the brainstorming-default `docs/superpowers/`
   to respect Zeta's canonical-home discipline). OK, or prefer `docs/research/` / a backlog row?
2. **Component home** — `tools/persistence/windows/`. Or co-locate under an existing
   `tools/<persona>/` tree?
3. **Backlog row** — file a `B-NNNN` to track the 3-slice feature (`install.sh:159` already
   says "Windows backlogged"), or run it off this spec + direct operator direction?
4. **`RUN_CLAUDE` default** for the registered task — start with heartbeat-only
   (`RUN_CLAUDE` unset) to prove the mechanism, then flip to `=1`? (Recommended.)
