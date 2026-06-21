---
id: 081KSKBP80008QG0R002J03WGA
priority: P2
status: open
title: tools/setup/install.sh becomes the universal Unix-like-OS install entry — routes by environment (macOS / Linux-non-NixOS / NixOS-live-USB / installed-NixOS); replaces zeta-install.sh on the short-path BEFORE 081KSKBP80008QG0R002VRN56K Ace migration completes (Aaron 2026-05-27)
effort: M
ask: aaron 2026-05-27
created: 2026-05-27
last_updated: 2026-05-27
depends_on: []
composes_with:
  - 081KSKBP80008QG0R002VRN56K
  - 081KSKBP80008QG0R003AX2A69
  - 081KSKBP80008QG0R000GPC0TB
  - 081KSKBP80008QG0R000Y2B7HC
  - 081KSGS9H0008QG0R003JNSVR5
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

Composes with iter-6.x distro-upgrade substrate (081KSGS9H0008QG0R001EKTS5A-081KSGS9H0008QG0R002BC2ZR7) — those auto-upgrade rows are the SAME entry path; install.sh handles both "first install" + "stay current" via the routing it does today + the work this row tracks.

### Turn 4 (install.sh ≈ Ace — they're entangled)

> *"yes install.sh is ace basically we've not really seperated it all out ace and zeta are pretty intertangled"*

**The substrate-honest reading**: install.sh and Ace are NOT separate things in current substrate — install.sh IS the install-side of what Ace would be at the imperative-bash scope; Ace is the declarative evolution of the SAME substrate at package-manager scope. They've been operationally entangled since the project's earliest install-graph work; the framework hasn't separated them out explicitly.

Implication for 081KSKBP80008QG0R002J03WGA ↔ 081KSKBP80008QG0R002VRN56K relationship: these aren't sibling rows on adjacent tracks — they're the SAME work at different naming scopes. 081KSKBP80008QG0R002J03WGA ships the operator-facing unification ("install.sh is THE entry") at imperative-bash scope; 081KSKBP80008QG0R002VRN56K ships the declarative substrate-engineering that Ace package management enables. The Ace migration (081KSKBP80008QG0R002VRN56K) is the long-horizon trajectory; install.sh-as-universal-entry (081KSKBP80008QG0R002J03WGA) is the short-horizon precursor that the trajectory builds toward.

Same substrate. Different operational windows. Same entanglement Zeta has with everything else in the substrate-engineering surface.

### Turn 5 (homelab-edge to enterprise-restrictive spectrum; start unified, scale back later)

> *"basically we are going to push the build is prod conept all the way to the edge for homelab / open claw like setups and thing scale it back for enterprise like setup to be more restrictive but i don't want to start in the more restretive mode until we see what the new shape feels like where the difference between build and dev vanish"*

**The substrate-honest reading**: the build-is-prod unification (Turn 3) operates on a SPECTRUM, not as a single mode:

| Operational scope | Build-is-prod posture | install.sh routing |
|---|---|---|
| **Homelab / open-claw / single-operator clusters** | MAXIMALLY UNIFIED — every machine is build + prod + dev simultaneously; same install.sh; same self-update; no separation | Single routing path; minimal flags; self-update on every boot |
| **Small team / co-op / friendly multi-operator** | UNIFIED with minimal separation — most machines build + prod + dev; some specialization possible via flags but defaults to unified | Same routing path; opt-in specialization flags available |
| **Enterprise / institutional / compliance-bound** | RESTRICTIVE — build machines separated from prod; staged rollout; signed-artifact-only deploy; restricted self-update windows; audit-gated upgrades | Multiple routing paths; explicit flags required; restrictions enforced by the routing layer |

**Operator's explicit sequencing direction**: START in the MAXIMALLY UNIFIED mode (homelab/open-claw end of the spectrum) FIRST. Live in that shape. Discover what "build/dev/prod vanish" actually feels like in practice. Build operator-experience around the unified mode. THEN scale BACK toward more restrictive modes for enterprise scope.

DO NOT start in restrictive mode. The restrictive mode is the LATER evolution; the unified mode is the FIRST evolution. Substrate-engineering decisions through 081KSKBP80008QG0R002J03WGA implementation defer enterprise-restrictive considerations until the unified mode has empirical operator-experience under it.

This is substrate-honest sequencing per `.claude/rules/edge-defining-work-not-speculation.md`: the edge-defining work IS living in the unified mode first; enterprise-restrictive design is downstream of that empirical work, not parallel to it.

### Turn 6 (attack-surface concern tempered by internal-access prerequisite)

> *"the biggest issue i see is larger attack surface becasue more deps but this one is not as bad as it seems cause it requires internal access to network and box so you are already kind of fucked if they are this deep."*

**The substrate-honest reading**: the operator's named primary concern with the unified mode is **larger attack surface** — every machine carries build-tooling + dev-tooling + prod-runtime + self-update capability, which means more dependencies present on every node = more CVE surface = more supply-chain risk.

BUT the threat-model is bounded by precondition: exploiting this expanded attack surface **requires internal access to network + box**. An attacker has to already be inside the perimeter (network access to the cluster) AND have shell-level access to a node (box access). Once an attacker is that deep, they've already bypassed the perimeter defenses + node-level isolation; the additional surface from build-tooling-on-prod is a marginal escalation path, not a primary entry vector.

The substrate-honest framing: *"you are already kind of fucked if they are this deep."* The unified-mode attack surface is real but operates in the post-perimeter-breach scope, not the perimeter-breach scope. Perimeter defenses (firewall + VPN + Reticulum/AllJoyn-style mesh + OIDC + cosign artifact-signing per 081KSKBP80008QG0R000Y2B7HC + signed-update enforcement) carry the primary security load; the expanded build-on-prod surface is downstream of those.

**Implications for 081KSKBP80008QG0R002J03WGA implementation**:

| Threat scope | Mitigation owner | Status for unified mode |
|---|---|---|
| Perimeter breach (external attacker gets network access) | Network architecture (firewall + VPN + mesh + auth) | Primary defense; carries the security load |
| Node-level intrusion (attacker on the box) | OS-level isolation + signed-binary enforcement + Touch-ID-gated privileged ops | Primary defense; carries the security load |
| Post-intrusion privilege escalation via build-tooling surface | Reduced surface (081KSKBP80008QG0R000Y2B7HC signed-artifacts; cosign keyless OIDC; signed self-update) | Secondary defense; accepted reduced posture for homelab/open-claw scope; tightened for enterprise scope |

Composes with 081KSKBP80008QG0R000Y2B7HC (cosign keyless OIDC artifact signing) + 081KSKBP80008QG0R003AX2A69 (declarative cred-persistence with operator authority over creds) + 081KSKBP80008QG0R002J03WGA.5 (operator-facing CLI conventions) + the enterprise-restrictive spectrum end (Turn 5 above) — the enterprise mode IS where the additional surface gets tightened back down via attestation + signed-update enforcement + restricted self-update windows.

The operator's threat-model acknowledgement is itself substrate-engineering: naming the concern explicitly + naming the precondition that bounds it + accepting the bounded risk for homelab/open-claw scope + deferring enterprise-restrictive tightening to Turn 5 spectrum's enterprise end.

## Current state (verified 2026-05-27 origin/main `18e6a095b`)

| Script | Location | Scope | Lines |
|---|---|---|---|
| `install.sh` | `tools/setup/install.sh` | Universal build-machine setup (laptop / CI / devcontainer / cluster node — all are build machines per GOVERNANCE §24 + operator sharpening); routes to `macos.sh` or `linux.sh` for OS-specific runtime install (mise / bun / etc.) | 42 |
| `zeta-install.sh` | `full-ai-cluster/usb-nixos-installer/zeta-install.sh` | NixOS-USB-bootstrap (live-USB → disk-format → nixos-install onto target) — **prepares the build machine** so install.sh can take over post-boot | 1,352 |

**Both serve the unified machine surface — build/prod/dev collapse when prod self-updates — they're not solving different problems; they're solving DIFFERENT PHASES of the same build-machine lifecycle**:

- `zeta-install.sh` = "turn this hardware into a NixOS-booting build machine"
- `install.sh` = "configure runtime on this build machine" (works the same whether the build machine is a dev laptop or a cluster node)

PR #5389 commit message (a9fca1e52f, 2026-05-27) said zeta-install.sh Step 6.95a invokes tools/setup/install.sh as "THE default entry." **Audit verified (081KSKBP80008QG0R002EKF67B, 2026-05-27)**: integration IS present at `full-ai-cluster/usb-nixos-installer/zeta-install.sh:1097-1099` inside Step 6.95a-bootstrap; no drift; no repair needed. The prior row-body authoring claim that "grep finds NO actual invocation" was an authoring error caught by the 081KSKBP80008QG0R002EKF67B audit sub-row (substrate-drift catch per `.claude/rules/verify-existing-substrate-before-authoring.md`).

## Migration target (this row's substrate-engineering scope)

**`tools/setup/install.sh` becomes the universal Unix-like-OS entry that ROUTES by environment**:

| Environment detection | Routes to | Outcome (unified machine surface — build/prod/dev collapse when prod self-updates) |
|---|---|---|
| macOS (`uname -s = Darwin`) | `setup/macos.sh` | Build machine (mise + bun + claude + etc.) on laptop |
| Linux non-NixOS (`/etc/NIXOS` absent) | `setup/linux.sh` | Build machine on Linux-non-NixOS host |
| Linux NixOS live-USB (`/etc/NIXOS` + live-mode detection) | NixOS-disk-install routine (the current zeta-install.sh logic, factored to a callable) | Bootstrap build machine FROM USB → install.sh takes over post-boot |
| Linux NixOS installed (`/etc/NIXOS` + installed-mode) | runtime verify / mise-managed update | Build machine on cluster node |

Environment-routing dispatch is in `install.sh` itself; OS-specific work lives in sibling files (already true for macos.sh / linux.sh; adds a `nixos-install-from-usb.sh` callable that subsumes the existing zeta-install.sh body).

## Why this is SHORTER than 081KSKBP80008QG0R002VRN56K (Ace migration)

| Property | 081KSKBP80008QG0R002J03WGA (this row) | 081KSKBP80008QG0R002VRN56K (Ace migration) |
|---|---|---|
| Scope | Routing logic + factor existing zeta-install.sh body | Declarative manifest + Ace CLI + ace install zeta |
| Dependencies | None (use existing scripts) | 081KR2E4K0008QG0R002YE3MMD (Ace CLI; in-progress) + manifest schema design |
| Timeline | 1-2 ISO test cycles after substrate work | Multi-phase; long horizon (Phases 1-5) |
| Risk | Bounded refactor of existing imperative code | New declarative substrate; new tooling integration |
| Operator workflow change | Same install command surface; routing behind the scenes | New ace install zeta surface; teaching cost |

081KSKBP80008QG0R002J03WGA ships the **operator-facing unification** ("install.sh is THE entry") at imperative-bash scope. 081KSKBP80008QG0R002VRN56K ships the **declarative substrate engineering** that Ace package management enables. Both compose; 081KSKBP80008QG0R002J03WGA doesn't block 081KSKBP80008QG0R002VRN56K + can ship faster.

## Sub-rows to file when implementing

- **081KSKBP80008QG0R002EKF67B** — Audit PR #5389's claim that Step 6.95a invokes tools/setup/install.sh; verify state OR repair drift
- **081KSKBP80008QG0R002J03WGA.2** — Environment-detection logic in tools/setup/install.sh (`uname -s` + `/etc/NIXOS` + live-mode detection)
- **081KSKBP80008QG0R002J03WGA.3** — Factor existing zeta-install.sh body into `tools/setup/nixos-install-from-usb.sh` (callable; same operational outcome)
- **081KSKBP80008QG0R002J03WGA.4** — Route in install.sh: live-USB-NixOS → invoke nixos-install-from-usb.sh
- **081KSKBP80008QG0R002J03WGA.5** — Operator-facing CLI conventions (which flags work where; deferral matrix per environment)
- **081KSKBP80008QG0R002J03WGA.6** — Compose with 081KSKBP80008QG0R003AX2A69.2b cred-persist/restore CLIs (which run regardless of OS)
- **081KSKBP80008QG0R002J03WGA.7** — Compose with 081KSKBP80008QG0R000GPC0TB self-register architectural fix (post-install service; same on all OS)
- **081KSKBP80008QG0R002J03WGA.8** — `zeta-install.sh` becomes thin wrapper that calls `tools/setup/install.sh` (back-compat for any callers still referencing old path; SAME script content moved)
- **081KSKBP80008QG0R002J03WGA.9** — Eventually retire `zeta-install.sh` wrapper after one full test cycle (Rule 0 carve-out shrinks)
- **081KSKBP80008QG0R002J03WGA.10** — Empirical Phase 1 test: fresh USB flash + boot + install.sh routes correctly to NixOS install

Order suggestion: 1 (audit current state) → 2 (env detection) → 3 (factor existing body) → 4 (route) → 6 + 7 (compose with adjacent stacks) → 5 (CLI docs) → 8 (thin wrapper) → 10 (validate) → 9 (retire wrapper).

## What this is NOT

- NOT a deletion of `zeta-install.sh` immediately (Phase 8 makes it a thin wrapper; Phase 9 retires after validation)
- NOT a competition with 081KSKBP80008QG0R002VRN56K Ace migration (composes; 081KSKBP80008QG0R002J03WGA ships the imperative-bash unification; 081KSKBP80008QG0R002VRN56K ships the declarative-Ace evolution on top)
- NOT a new install command for operators (the surface is `tools/setup/install.sh` which exists today; this row UNIFIES the routing behind it)
- NOT a Rule 0 violation (install-graph carve-out preserved at tools/setup/; nixos-install-from-usb.sh joins it)

## Composes with

- **081KSKBP80008QG0R002VRN56K** — Ace migration trajectory; this row ships the install.sh unification at imperative-bash scope BEFORE the declarative Ace transition completes; 081KSKBP80008QG0R002VRN56K Phase 4 then builds on top
- **081KSKBP80008QG0R003AX2A69** — credential persistence; persist/restore CLIs (081KSKBP80008QG0R003AX2A69.2b) run regardless of OS routing
- **081KSKBP80008QG0R000GPC0TB** — self-registration architectural fix; post-install systemd service composes with whichever OS routing path
- **081KSKBP80008QG0R000Y2B7HC** — cosign artifact signing; verify signatures regardless of OS routing path
- **081KSGS9H0008QG0R003JNSVR5** — installer interactive-login-vs-baked-in-keys; auth-method picker composes
- `.claude/rules/rule-0-no-sh-files.md` — install-graph carve-out preserved (tools/setup/ stays the carve-out path)
- `.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md` — implementation work uses isolated worktrees

## Why P2 (not P1)

- Operator-named direction but not blocking immediate ISO test cycle
- Composes cleanly with in-flight substrate (081KSKBP80008QG0R003AX2A69 cred-persist; 081KSKBP80008QG0R000GPC0TB self-register; 081KSKBP80008QG0R000Y2B7HC cosign all merging now)
- Deferred-implementation per separation-of-concerns discipline (recording the row IS critical for the deferred work to reliably happen; the work itself doesn't need to start until current ISO test cycle validates the substrate landings)
- Audit sub-row (081KSKBP80008QG0R002EKF67B) is small + can ship quickly to verify PR #5389's claimed integration

## Substrate-honest framing

The operator-explicit framing names install.sh as THE universal Unix-like-OS install surface. This row records that substrate-engineering target IMMEDIATELY per Aaron 2026-05-27 separation-of-concerns discipline ("recording row exists is critical for deferring work to reliably happen"). Implementation work defers until current cred-persistence + cosign + self-register stack lands + next USB flash test validates. 081KSKBP80008QG0R002EKF67B audit can run independently sooner.

## Full reasoning

Aaron 2026-05-27 verbatim:

> *"when are we moving to install.sh over zeta-install.sh? the universall install surface for unix like oses?"*

Substrate-inventory pass (per `.claude/rules/verify-existing-substrate-before-authoring.md`):

- Topic: install.sh as universal Unix-like-OS entry; zeta-install.sh consolidation
- Searched: docs/backlog/ (081KSKBP80008QG0R002VRN56K names zeta-install.sh retirement as Phase 4 of Ace migration; no row covers install.sh-as-universal-entry specifically); memory/ (no prior memory); .claude/rules/ (Rule 0 names install-graph carve-out at tools/setup/)
- Found: 081KSKBP80008QG0R002VRN56K (Ace migration; long horizon); PR #5389 commit message claims tools/setup/install.sh integration at zeta-install.sh Step 6.95a (state TBD per 081KSKBP80008QG0R002EKF67B audit)
- Conclusion: no existing row covers the install.sh-as-universal-entry unification at imperative-bash scope; this row fills that gap; composes with 081KSKBP80008QG0R002VRN56K without blocking
