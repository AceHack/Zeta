---
id: 081M00VMS1E087G0R0001SCSAH
type: bug
state: done
priority: P1
slug: four-of-five-agent-cells-have-been-dead-since-2026-06-13-ins
title: "Four of five agent cells have been dead since 2026-06-13: installed plists name tools/kiro/kiro-loop-wrapper.sh, deleted by PR #8088, launchctl reports exit 78 EX_CONFIG; host-loop-bootstrap.sh:142 still emits the dead path"
created: 2026-08-14T19:23:07.694Z
completed: 2026-08-15T22:48:14.194Z
depends_on: []
composes_with: []
---

# Four of five agent cells have been dead since 2026-06-13: installed plists name tools/kiro/kiro-loop-wrapper.sh, deleted by PR #8088, launchctl reports exit 78 EX_CONFIG; host-loop-bootstrap.sh:142 still emits the dead path

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00VMS1E087G0R0001SCSAH-*.md` glob. -->

## Re-verification, 2026-08-14 (the shadow)

Every claim in the title was independently re-checked on the live machine. All held,
with three corrections to the original framing.

| claim | verdict | evidence |
|---|---|---|
| four plists name **tools/kiro/kiro-loop-wrapper.sh** | confirmed | `launchctl print` → `program = /Users/acehack/.zeta/clones/<p>/tools/kiro/kiro-loop-wrapper.sh` for otto/alexa/vera/lior |
| deleted by PR #8088 on 2026-06-13 | confirmed | `git log --diff-filter=D` → `3430a032a`, 2026-06-13 18:52:45 -0400 |
| every clone `reset --hard`'d it away | confirmed | `tools/kiro/` absent in all four clones |
| `launchctl` reports exit 78, no PID | confirmed | `last exit code = 78: EX_CONFIG`, `state = spawn scheduled` |
| stderr zero-length since 2026-06-11 | confirmed | all four `launchd-stderr.log` 0 bytes, mtime Jun 11 19:25 |
| bootstrap still emits the dead path | confirmed | line 142, `${CLONE_DIR}/tools/kiro/kiro-loop-wrapper.sh` |
| healthy kiro runs `bun loop-tick.ts --persona kiro`, no shell wrapper | confirmed | `com.lucent.zeta.kiro-loop.plist` |

### Correction 1 — the bootstrap is at `tools/setup/`, not `tools/kiro/`

The line number is right; the path is not. `tools/kiro/` does not exist on `main` at
all. The file is `tools/setup/host-loop-bootstrap.sh`.

### Correction 2 — a sixth unit also names the dead wrapper

`com.lucent.zeta.kiro.plist` (distinct from the healthy `kiro-loop`) also points at
**tools/kiro/kiro-loop-wrapper.sh**, in the shared checkout. It is not loaded
(`launchctl print` → rc 113), so it is dormant rather than failing and does not appear
in `launchctl list`. It should be deleted, not repaired.

### Correction 3 — the TS wrapper that replaced the shell wrapper is ALSO gone

PR #8088 ported the shell wrapper to **src/Core.TypeScript/kiro/kiro-loop-wrapper.ts**.
That file was then deleted by **PR #8121** ("Wave 4 — delete superseded per-persona
loop scripts"). The correct target is neither wrapper: it is
`src/Core.TypeScript/service/loop-tick.ts`, which is what the healthy cell runs.

## Three further defects found while fixing, none previously named

**A. Label mismatch — the service manager reports the dead cells as `not-installed`.**
`persona-registry.ts` labels otto `com.lucent.zeta.otto-loop`; the bootstrap installs
`com.lucent.zeta.otto`. `launchctl print gui/501/com.lucent.zeta.otto-loop` → rc 113,
so `IServiceManager.status("otto")` answers `not-installed` for a cell whose plist is
installed and failing every 60 seconds.

**B. `alexa` and `vera` were never in the loop persona registry.**
`tools/setup/manifests/cluster-cells` provisions cells for otto, vera, lior, alexa.
`persona-registry.ts` knew otto, kiro, codex, riven, soraya, lior, tariq. So even with
the path fixed, `loop-tick.ts --persona alexa` would exit 1 on "Unknown persona" — two
of the four cells had a second, independent reason to be dead. Added, with harness
derived from two agreeing in-repo sources (`registry/personas.yaml` id=3 Kiro / id=5
Codex, and the manifest's own `harness=` column) rather than invented.

**C. The bootstrap's own health check could not fail.** Three ways at once: it globbed
`zeta-*/runner.log` and guarded each hit with the Bash `-f` file test, so a cell that never started
(no runner.log) was silently skipped; it only ever `echo`'d, never affecting exit
status; and it grepped for `"heartbeat complete"`, a string `loop-tick.ts` does not
emit — it logs `"tick complete"` (measured: 0 vs 33 matches in the live kiro log). A
healthy cell could only ever produce the ⚠ branch.

## The failure underneath the failure

Nothing reported persona-loop liveness, and the thing that looked like it did could not
fail. `ServiceState` is `installed-running | installed-stopped | not-installed`, and
`src/Core.TypeScript/service/adapters/launchd.ts` derives it from
`stdout.includes("state = running")`. Measured on
the live machine:

```text
healthy kiro-loop   ->  state = not running       ->  installed-stopped
dead otto (exit 78) ->  state = spawn scheduled   ->  installed-stopped
```

A `StartInterval` loop is *supposed* to be "not running" between ticks, so the only
state that could have carried the signal is the one that is normal for a healthy cell.
The discriminating fact — `last exit code = 78` — was in the same `launchctl print`
output the adapter already read, and nothing parsed it.

Fix: `src/Core.TypeScript/service/loop-liveness.ts` reads the launchd exit code AND the
heartbeat artifact `loop-tick.ts` already writes
(`<stateDir>/heartbeats/<persona>-tick.json`). It extends the `CLAUDE.md`
"heartbeat-via-commit = externalized idle counter" discipline — liveness read off an
external artifact the work had to produce — rather than inventing a parallel signal.

### The new check was itself fail-open on first run, and was caught by running it

The first cut probed only the registry label. Run against the live machine it reported
all four dead cells as `not-installed` and **exited 0** — it missed the very outage it
was written for. Fixed by probing both label forms (`candidateLabels`). Recording it
because it is the same defect class as the bug being fixed, one level up: a check
nobody ran against a known-bad input is indistinguishable from one that works.

## Remaining, NOT done here (machine-side, Aaron's)

The repo half is fixed; the four installed plists on this machine are still the old
broken ones. Reinstalling is the operator's action — see the PR body for exact commands.

## Resolution (2026-08-15)

Repo half already on main: bootstrap emits `loop-tick.ts`, alexa/vera are in
`persona-registry.ts`, `loop-liveness.ts` probes both label forms and the
heartbeat artefact. Work-item closed so the P1 queue stops offering a shipped
row. Machine-side reinstall of the four plists remains an operator action.
