# Handoff: unify named-agent loop + service machinery behind one parameterized tick + an `IServiceManager` port

**For:** Kiro (on `kiro/shell-to-ts-services`) + Riven (owns per-persona ticks / dev-cluster) ·
**From:** Otto (shadow) · **Date:** 2026-06-13 · **Status:** proposal / design target

## Why
Today every persona has its *own* copy of the same three things — a loop-tick, an
OS-service wrapper, and a service installer + plist. That's **persona-as-a-fork**
(the writer-actor-routing model says persona is a **value**, not a code path).
Converting each script 1:1 to TS preserves the duplication; the win is to
**collapse the matrix** so Otto, Kiro, Riven, Soraya, Lior, Codex, … are *the same
code with a different argument*.

## Full scope (all named-agent machinery in the tree, 2026-06-13)

**Per-persona loop-tick TS → should become ONE `loop-tick.ts --persona X`:**
- `src/Core.TypeScript/kiro/kiro-loop-tick.ts`
- `src/Core.TypeScript/riven/riven-loop-tick.ts`
- `src/Core.TypeScript/soraya/soraya-loop-tick.ts`
- `.claude/bin/claude-loop-tick.ts` (Otto/Claude)
- (`codex-loop-tick` per PR history)

**Wrappers → should be ELIMINATED** (the service definition invokes `bun` directly):
- `tools/kiro/kiro-loop-wrapper.sh` *(now ported to `.ts` by Kiro)*
- `.gemini/service/lior-loop.sh`
- `tools/persistence/windows/otto-loop-wrapper.ps1` *(now ported to `.ts`)*
- `tools/setup/host-loop-bootstrap.sh`

**Service installers + plists → should become ONE installer behind `IServiceManager`:**
- `src/Core.TypeScript/kiro/launchd/install.sh` + `com.lucent.zeta.kiro-loop.plist` *(ported)*
- `.gemini/launchd/com.zeta.lior-loop.plist` + `com.lucent.zeta.lior.plist`
- `.gemini/launchd/` bg services: `backlog-ready-notifier.plist`, `missed-substrate-detector.plist`
- `src/Core.TypeScript/shadow/launchd/install-launchagent.ts` + `com.zeta.shadow-observer.plist`
  ← **already TS — use as the reference impl / launchd-adapter seed**

## Target design

1. **One parameterized loop tick** — `loop-tick.ts --persona <kiro|otto|riven|soraya|lior|codex|…>`.
   Worktree / state / log dirs and the env-var prefix all *derive from* the persona
   value. Delete the per-persona tick scripts.
2. **`IServiceManager` port + adapters (hexagonal).** Define *our* install contract:
   `install / uninstall / status (persona, schedule)`. Adapters: **launchd** (macOS),
   **Task-Scheduler** (Windows), **systemd** (Linux). One `install --persona X` works on
   every OS. `shadow/install-launchagent.ts` is the launchd adapter seed.
3. **One env schema** — `ZETA_LOOP_WORKTREE / STATE_DIR / LOG_DIR / REF`, persona a value.
   Kill the `ZETA_KIRO_*` vs `ZETA_CLAUDE_*` divergence.
4. **No wrappers.** The installer *renders* the plist / Task-Scheduler action to call
   `bun loop-tick.ts --persona X` directly, with env set in the service definition.
   `install.sh` (the OS shield) already guarantees `bun` on PATH, so **no pre-bun shim
   is needed** — if any single OS genuinely can't set env + a full bun path in its
   service def, that's the *only* place a 2-line shim survives.
5. **Plists become one template** the installer fills per persona — not N hand-written
   plists.

## Principle anchors
- Shell only for pre-runtime bootstrap or direct dev/OS surfaces; **post-install is
  source** (Aaron 2026-06-13). These ticks/installers run *after* the shield → TS.
- **Cross-OS:** `.sh`/`.ps1` don't run everywhere; `bun` + `IServiceManager` adapters do.
- Ports & adapters: *we* own the install contract; launchd/Task-Scheduler/systemd are
  swappable adapters (the same hexagonal discipline as `IClock`/`IBackingStore`/…).

## Sequencing / ownership

- This **subsumes** the in-flight `kiro/shell-to-ts-services` — widen that branch to the
  unified shape rather than porting 3 files 1:1.
- **Collision watch:** Riven owns `riven-loop-tick.ts` + the dev-cluster area — coordinate
  the per-persona tick collapse with her.
- **Future (separate, Option-A async lane):** background-ferry determinism via explicit
  context threading (the Kleisli **Arrow** — `ISR`/`Traced.withCtx`), capturing context at
  the boundary and threading it as data (not the AsyncLocal hidden side channel). Prior
  art: the maintainer's Itron `Platform.Capability/Util/AsyncState.cs`.

## Done-when

- One `loop-tick.ts` (persona arg) — per-persona tick scripts deleted.
- One `IServiceManager` + launchd/Task-Scheduler/systemd adapters; one `install --persona X`.
- Wrappers gone; one plist/task template; one env schema.
- Every persona's loop installs + runs on macOS/Windows/Linux from the same code path.
