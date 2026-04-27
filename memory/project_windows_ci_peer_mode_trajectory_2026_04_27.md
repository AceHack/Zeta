---
name: Windows CI seed → peer-mode-agent → green Windows legs trajectory (Aaron 2026-04-27)
description: New trajectory tracked separately from the broader CI cadence split. Goal — Windows build-and-test legs (windows-2025 + windows-11-arm) running green on per-merge so Zeta is provably cross-platform without manual verification. Stages — seed CI infrastructure with `continue-on-error: true` now, peer-mode agent on Aaron's Windows laptop polishes `tools/setup/install.ps1` + the bash-on-Windows path, flip `continue-on-error` to false once green. Trajectory composes with the peer-mode milestone, the 4-shell bash compat target (Otto-235), the post-install TypeScript / pre-install bash + PowerShell strategy, and the "Beacon-safe partial-state seeding" pattern (CI infrastructure mostly-ready before the dependent agent comes online).
type: project
---

# Windows CI seed → peer-mode-agent → green Windows legs

## Verbatim quotes (Aaron 2026-04-27)

The trajectory was opened in three messages:

> "we might as well got ahead and start the windows one as a per push to main too/merge to main, you can start slowly building that out befroe i get my windows laptop running the peer-mode agent, windows will be mostly raeady and they can just clean it up. not rush on this."

> "failures on the windows mode for now are fine untill we pass have the agent running on windows in peer-mode then we will want that working all the time"

And the explicit "this is a trajectory" framing:

> "the windows is a new trajectory"

That last message is the binding instruction to track Windows separately from the broader CI cadence work — different unlock conditions, different milestones, different "done" state.

## Why this is a separate trajectory (not just a CI-cadence sub-item)

The CI cadence split (per-PR fast / per-merge slow) is a single decision Aaron made and Otto implemented in one PR. The Windows work has multiple stages, multiple actors, and a long-tail polish phase:

| Stage | Owner | Unlock | Status |
|------:|:------|:-------|:-------|
| 1 | Otto | (none — start now) | DONE — gate.yml dynamic matrix includes windows-2025 + windows-11-arm on push-to-main, marked `continue-on-error: true` |
| 2 | Otto (or peer-agent) | Stage 1 lands | **TBD** — author `tools/setup/install.ps1` (PowerShell sibling to install.sh per Otto-235 4-shell target). Aaron: "not rush on this." |
| 3 | Peer-mode agent on Aaron's Windows laptop | Aaron's Windows laptop online + peer-mode protocol shipped | **BLOCKED ON PEER-MODE** — agent picks up where Stage 2 leaves off, fixes Windows-specific issues (path separators, line endings, etc.) until legs land green |
| 4 | Otto (or peer-agent) | Stage 3 produces consistently-green legs | **TBD** — flip `continue-on-error` to `false` in gate.yml so Windows failures gate per-merge; update memory + this trajectory file to reflect green state |

Each stage has different prerequisites and actors. That's the trajectory shape.

## What's "mostly ready" means concretely

Aaron's framing: when the peer-mode agent comes online, Windows infrastructure should be at the point where the peer-agent can focus on small Windows-specific fixes, not on bootstrapping the whole CI integration. After Stage 1:

- ✅ Windows runners in the matrix
- ✅ `continue-on-error: true` so failures don't block per-merge
- ✅ Memory file naming the trajectory (this file)
- ❌ `tools/setup/install.ps1` — Stage 2
- ❌ Verified `tools/setup/common/*.ps1` PowerShell siblings of the bash install scripts — Stage 2
- ❌ Verified Windows path separators / line endings throughout `tools/setup/` — Stage 2/3
- ❌ Real green legs on per-merge — Stage 3

Stage 2 is the next concrete unit of work. It's deferrable per Aaron ("not rush"); land when convenient or let the peer-agent draft and Otto review.

## Reference patterns to study (NOT copy verbatim)

Aaron 2026-04-27: *"when doing windows make sure to look at ../scratch they have good practices and are tested working"* — followed by *"understand it don't copy the code verbatium, you probably know that by know i'm just being repetivie to make sure"*.

`../scratch` (laptop-only, Aaron's adjacent project — see the laptop-only-source-integration memory) has a mature PowerShell-based Windows setup pattern that's worth studying:

- `../scratch/scripts/setup/windows/bootstrap.ps1` — entry point (PowerShell sibling of our bash `install.sh`)
- `../scratch/scripts/setup/windows/{common,profiles,github-env,bun-tools,choco,dotnet,git,gnupg,mise,powershell-modules,python-tools,vs-build-tools}.ps1` — per-component installers, dot-sourced from bootstrap with idempotent `_LOADED` guards
- `../scratch/declarative/windows/{choco,powershell,vs}` — declarative-state manifests (parallel to our `tools/setup/manifests/`)
- `../scratch/scripts/test/run-pester.ps1` + `../scratch/scripts/test/run-powershell-lint.ps1` — Pester unit tests + PowerShell linting
- `../scratch/docker/github-windows-latest/bootstrap.ps1` — containerised Windows-latest CI bootstrap

**Pattern shapes to absorb (not lines):**

- `Set-StrictMode -Version Latest` + `$ErrorActionPreference = 'Stop'` at every script head — the Windows equivalent of `set -euo pipefail`
- `$script:NAME_LOADED` idempotent guard so dot-sourced scripts can be re-entered safely (parallel to bash `[ -n "${VAR:-}" ] && return` patterns we already use)
- Decomposition into small per-component files (`choco.ps1`, `dotnet.ps1`, `mise.ps1`) rather than one monolithic script — same shape as our `tools/setup/common/*.sh`
- Path-entry collection via a list-builder pattern (`Get-WindowsBootstrapManagedPathEntries`) — the PowerShell equivalent of our `tools/setup/common/shellenv.sh` PATH composition
- Tested with Pester (real CI assertions, not just "did the script run") — Zeta's equivalent would be wiring `tools/setup/install.ps1` exit code into the gate.yml Windows leg

**What this means in practice for Stage 2:**

Per the laptop-only-source-integration rule (Tactic A "port the feature" vs Tactic B "write detailed design"): for Windows install, Tactic A applies — port the bootstrap pattern + decomposition shape into Zeta's `tools/setup/` (with file names matching Zeta's bash conventions: `tools/setup/install.ps1`, `tools/setup/windows.ps1`, `tools/setup/common/*.ps1` siblings of the existing `*.sh` files). The `../scratch` reference goes away when Stage 2 lands in-repo.

**Aaron's "understand don't copy" framing:**

The pattern is rich; the literal code may not fit (Zeta uses different toolchain pins, different `.mise.toml`, different per-step semantics). Read for shape. Verbatim copy would inflate the repo with code that doesn't compose with what's already here.

## Composes with

- **CI cadence split memory** (`feedback_ci_cadence_split_per_pr_fast_per_merge_slow_aaron_2026_04_27.md`) — the broader CI design this trajectory sits inside
- **Otto-215** — Windows via peer harness, not CI matrix; Bun-TS post-install migration before Windows work. Refines: now Windows IS in the CI matrix (per-merge only); Bun-TS is unrelated
- **Otto-235** — bash compatibility target: macOS 3.2 / Ubuntu / git-bash / WSL. PowerShell install path is the alternative to bash on Windows; Stage 2 picks one
- **Otto-357** (no directives) — Aaron framing this as "you can start slowly building that out" not "you must build" — autonomy on pace
- **Trajectory-registry backlog** (`feedback_substrate_optimized_for_single_agent_speed_collaboration_speed_hardening_iterative_2026_04_27.md`) — once `docs/TRAJECTORIES.md` exists, this trajectory lands as a row there. Until then, this file is the registry entry

## Forward-action

- Stage 1 already landed in PR #651 (`gate.yml` matrix + Windows continue-on-error)
- Stage 2 — file as low-priority BACKLOG row: "Author `tools/setup/install.ps1` (PowerShell sibling of install.sh per Otto-235)". No deadline; peer-agent may draft first
- Stage 3 — track when peer-mode milestone ships; this trajectory is one of its consumers
- Stage 4 — when 3 consecutive per-merge runs land green, flip `continue-on-error` to `false`; update this file's status table

## What this trajectory does NOT mean

- Does NOT mean rush — Aaron explicit: "not rush on this"
- Does NOT mean Windows blocks anything pre-Stage-3 — `continue-on-error: true` ensures failures are visible-not-blocking
- Does NOT couple this work to other in-flight trajectories — Windows can fail independently of factory-demo, Aurora, AgencySignature, etc.
- Does NOT obligate Otto to finish all stages before peer-mode arrives — Stage 1 is the only mandatory pre-peer-mode stage; Stages 2-4 are sequenced after
