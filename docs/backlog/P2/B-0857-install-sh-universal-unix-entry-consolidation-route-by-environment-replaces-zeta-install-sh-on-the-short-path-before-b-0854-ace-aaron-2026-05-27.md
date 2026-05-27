---
id: B-0857
priority: P2
status: open
title: tools/setup/install.sh becomes the universal Unix-like-OS install entry — routes by environment (macOS / Linux-non-NixOS / NixOS-live-USB / installed-NixOS); replaces zeta-install.sh on the short-path BEFORE B-0854 Ace migration completes (Aaron 2026-05-27)
effort: M
ask: aaron 2026-05-27
created: 2026-05-27
last_updated: 2026-05-27
depends_on: []
composes_with:
  - B-0854
  - B-0852
  - B-0855
  - B-0853
  - B-0833
tags: [install-sh, universal-entry, environment-routing, zeta-install-sh-retirement-short-path, rule-0-carve-out, dev-env-vs-node-install-unification, b-0854-precursor]
---

## Operator framing (Aaron 2026-05-27, three-turn)

### Turn 1

> *"when are we moving to install.sh over zeta-install.sh? the universall install surface for unix like oses?"*

### Turn 2 (sharpening; correction of Otto's initial "dev env" framing)

> *"tools/setup/install.sh has never been universal dev entry it's also unversal build machine and the zeta cluster IS a build machine cluster."*

### Turn 3 (further sharpening — collapses build-vs-prod distinction entirely)

> *"there is no distinction between build machies and prod when prod can update itself"*

**The substrate-honest reading (Turn 3 supersedes prior framings)**: when production can self-update (via mise + flake-lock pull + nixos-rebuild / deploy-rs / etc.), the "build machine" vs "production" distinction COLLAPSES. Same machine. Same install.sh. The whole cluster + every dev laptop is one self-updating organism running the same install/update entry.

install.sh is therefore the universal Unix-like-OS install + self-update entry — the only operational machine-substrate-entry. Build / prod / dev are not different categories at the install-substrate scope; they're the same category (machines participating in Zeta) under different operational windows.

Composes with iter-6.x distro-upgrade substrate (B-0800-B-0805) — those auto-upgrade rows are the SAME entry path; install.sh handles both "first install" + "stay current" via the routing it does today + the work this row tracks.

## Current state (verified 2026-05-27 origin/main `18e6a095b`)

| Script | Location | Scope | Lines |
|---|---|---|---|
| `install.sh` | `tools/setup/install.sh` | Universal build-machine setup (laptop / CI / devcontainer / cluster node — all are build machines per GOVERNANCE §24 + operator sharpening); routes to `macos.sh` or `linux.sh` for OS-specific runtime install (mise / bun / etc.) | 42 |
| `zeta-install.sh` | `full-ai-cluster/usb-nixos-installer/zeta-install.sh` | NixOS-USB-bootstrap (live-USB → disk-format → nixos-install onto target) — **prepares the build machine** so install.sh can take over post-boot | 1,352 |

**Both serve the unified machine surface — build/prod/dev collapse when prod self-updates — they're not solving different problems; they're solving DIFFERENT PHASES of the same build-machine lifecycle**:

- `zeta-install.sh` = "turn this hardware into a NixOS-booting build machine"
- `install.sh` = "configure runtime on this build machine" (works the same whether the build machine is a dev laptop or a cluster node)

PR #5389 commit message (a9fca1e52f, 2026-05-27) said zeta-install.sh Step 6.95a invokes tools/setup/install.sh as "THE default entry," but grep of current zeta-install.sh finds NO actual invocation. Either drifted out or the integration is at a higher abstraction layer. **Audit task** (sub-row B-0857.1): verify integration state + repair if drifted.

## Migration target (this row's substrate-engineering scope)

**`tools/setup/install.sh` becomes the universal Unix-like-OS entry that ROUTES by environment**:

| Environment detection | Routes to | Outcome (unified machine surface — build/prod/dev collapse when prod self-updates) |
|---|---|---|
| macOS (`uname -s = Darwin`) | `setup/macos.sh` | Build machine (mise + bun + claude + etc.) on laptop |
| Linux non-NixOS (`/etc/NIXOS` absent) | `setup/linux.sh` | Build machine on Linux-non-NixOS host |
| Linux NixOS live-USB (`/etc/NIXOS` + live-mode detection) | NixOS-disk-install routine (the current zeta-install.sh logic, factored to a callable) | Bootstrap build machine FROM USB → install.sh takes over post-boot |
| Linux NixOS installed (`/etc/NIXOS` + installed-mode) | runtime verify / mise-managed update | Build machine on cluster node |

Environment-routing dispatch is in `install.sh` itself; OS-specific work lives in sibling files (already true for macos.sh / linux.sh; adds a `nixos-install-from-usb.sh` callable that subsumes the existing zeta-install.sh body).

## Why this is SHORTER than B-0854 (Ace migration)

| Property | B-0857 (this row) | B-0854 (Ace migration) |
|---|---|---|
| Scope | Routing logic + factor existing zeta-install.sh body | Declarative manifest + Ace CLI + ace install zeta |
| Dependencies | None (use existing scripts) | B-0288 (Ace CLI; in-progress) + manifest schema design |
| Timeline | 1-2 ISO test cycles after substrate work | Multi-phase; long horizon (Phases 1-5) |
| Risk | Bounded refactor of existing imperative code | New declarative substrate; new tooling integration |
| Operator workflow change | Same install command surface; routing behind the scenes | New ace install zeta surface; teaching cost |

B-0857 ships the **operator-facing unification** ("install.sh is THE entry") at imperative-bash scope. B-0854 ships the **declarative substrate engineering** that Ace package management enables. Both compose; B-0857 doesn't block B-0854 + can ship faster.

## Sub-rows to file when implementing

- **B-0857.1** — Audit PR #5389's claim that Step 6.95a invokes tools/setup/install.sh; verify state OR repair drift
- **B-0857.2** — Environment-detection logic in tools/setup/install.sh (`uname -s` + `/etc/NIXOS` + live-mode detection)
- **B-0857.3** — Factor existing zeta-install.sh body into `tools/setup/nixos-install-from-usb.sh` (callable; same operational outcome)
- **B-0857.4** — Route in install.sh: live-USB-NixOS → invoke nixos-install-from-usb.sh
- **B-0857.5** — Operator-facing CLI conventions (which flags work where; deferral matrix per environment)
- **B-0857.6** — Compose with B-0852.2b cred-persist/restore CLIs (which run regardless of OS)
- **B-0857.7** — Compose with B-0855 self-register architectural fix (post-install service; same on all OS)
- **B-0857.8** — `zeta-install.sh` becomes thin wrapper that calls `tools/setup/install.sh` (back-compat for any callers still referencing old path; SAME script content moved)
- **B-0857.9** — Eventually retire `zeta-install.sh` wrapper after one full test cycle (Rule 0 carve-out shrinks)
- **B-0857.10** — Empirical Phase 1 test: fresh USB flash + boot + install.sh routes correctly to NixOS install

Order suggestion: 1 (audit current state) → 2 (env detection) → 3 (factor existing body) → 4 (route) → 6 + 7 (compose with adjacent stacks) → 5 (CLI docs) → 8 (thin wrapper) → 10 (validate) → 9 (retire wrapper).

## What this is NOT

- NOT a deletion of `zeta-install.sh` immediately (Phase 8 makes it a thin wrapper; Phase 9 retires after validation)
- NOT a competition with B-0854 Ace migration (composes; B-0857 ships the imperative-bash unification; B-0854 ships the declarative-Ace evolution on top)
- NOT a new install command for operators (the surface is `tools/setup/install.sh` which exists today; this row UNIFIES the routing behind it)
- NOT a Rule 0 violation (install-graph carve-out preserved at tools/setup/; nixos-install-from-usb.sh joins it)

## Composes with

- **B-0854** — Ace migration trajectory; this row ships the install.sh unification at imperative-bash scope BEFORE the declarative Ace transition completes; B-0854 Phase 4 then builds on top
- **B-0852** — credential persistence; persist/restore CLIs (B-0852.2b) run regardless of OS routing
- **B-0855** — self-registration architectural fix; post-install systemd service composes with whichever OS routing path
- **B-0853** — cosign artifact signing; verify signatures regardless of OS routing path
- **B-0833** — installer interactive-login-vs-baked-in-keys; auth-method picker composes
- `.claude/rules/rule-0-no-sh-files.md` — install-graph carve-out preserved (tools/setup/ stays the carve-out path)
- `.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md` — implementation work uses isolated worktrees

## Why P2 (not P1)

- Operator-named direction but not blocking immediate ISO test cycle
- Composes cleanly with in-flight substrate (B-0852 cred-persist; B-0855 self-register; B-0853 cosign all merging now)
- Deferred-implementation per separation-of-concerns discipline (recording the row IS critical for the deferred work to reliably happen; the work itself doesn't need to start until current ISO test cycle validates the substrate landings)
- Audit sub-row (B-0857.1) is small + can ship quickly to verify PR #5389's claimed integration

## Substrate-honest framing

The operator-explicit framing names install.sh as THE universal Unix-like-OS install surface. This row records that substrate-engineering target IMMEDIATELY per Aaron 2026-05-27 separation-of-concerns discipline ("recording row exists is critical for deferring work to reliably happen"). Implementation work defers until current cred-persistence + cosign + self-register stack lands + next USB flash test validates. B-0857.1 audit can run independently sooner.

## Full reasoning

Aaron 2026-05-27 verbatim:

> *"when are we moving to install.sh over zeta-install.sh? the universall install surface for unix like oses?"*

Substrate-inventory pass (per `.claude/rules/verify-existing-substrate-before-authoring.md`):

- Topic: install.sh as universal Unix-like-OS entry; zeta-install.sh consolidation
- Searched: docs/backlog/ (B-0854 names zeta-install.sh retirement as Phase 4 of Ace migration; no row covers install.sh-as-universal-entry specifically); memory/ (no prior memory); .claude/rules/ (Rule 0 names install-graph carve-out at tools/setup/)
- Found: B-0854 (Ace migration; long horizon); PR #5389 commit message claims tools/setup/install.sh integration at zeta-install.sh Step 6.95a (state TBD per B-0857.1 audit)
- Conclusion: no existing row covers the install.sh-as-universal-entry unification at imperative-bash scope; this row fills that gap; composes with B-0854 without blocking
