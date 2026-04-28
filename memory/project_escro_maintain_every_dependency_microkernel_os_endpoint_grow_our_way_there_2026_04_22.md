---
name: Escro — maintain every dependency; microkernel-OS endpoint; grow-our-way-there cadence; absorb-and-contribute universalised
description: Aaron 2026-04-22 auto-loop-28 directive extending the absorb-and-contribute community-dependency discipline to its logical endpoint for Escro specifically — maintain EVERY dependency, which recursively ends at owning the microkernel OS. "we can grow our way there" — no-deadlines cadence, not a crash program.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Escro — maintain every dependency; microkernel-OS endpoint

**Source (verbatim, 2026-04-22 auto-loop-28):**

> *"for escro we should maintain every dependecy we have if you were to really push it that means we need our own microkernal os"*
>
> *"we can grow our way there"*

Two sibling messages in the same minute. The second qualifies the first.

## What the directive actually says

1. **Scope-tag = "escro"** — names a specific project (not
   the factory at large, not Zeta-core). Aaron's spelling is
   "escro"; likely typo for Escro or variant. Preserving
   exact spelling here so later disambiguation is
   auditable.
2. **Universal-maintenance rule for Escro** — *every*
   dependency maintained, not just community-substrate-class
   ones. This is a **strict superset** of the
   absorb-and-contribute discipline named auto-loop-27
   (community-MIT/Apache/BSD fork + run-from-source +
   upstream-fixes-as-peer-maintainer).
3. **Logical endpoint = microkernel OS** — when you trace
   "maintain every dependency" down the stack, the last thing
   you stand on is the OS kernel. Owning that means writing
   (or forking + fully maintaining) a microkernel. Aaron
   frames this as "if you were to really push it" — the limit
   case, not the immediate action item.
4. **Cadence = grow our way there** — not a crash program,
   not a refactor-the-world sprint. The factory's
   no-deadlines discipline (from earlier memory) applies. The
   microkernel endpoint is the asymptote; each tick moves
   incrementally toward it without a commit to arrive by date
   X.

## Why this is load-bearing

- **It generalises absorb-and-contribute from a substrate-class
  policy to a universal dependency policy** for one named
  project. Previously the discipline had three tiers
  (vendor-official / vendor-API / community-maintained) with
  absorb-and-contribute applying only to the third. For
  Escro, the tier collapses: all three get the same
  maintenance posture. Vendor-official becomes absorb-target
  too (read: fork .NET, Bun, Linux kernel, etc.).
- **It names the terminal state explicitly** — factory hasn't
  previously admitted that "maintain every dep" recurses into
  "write your own OS". Aaron named it. Now the factory has a
  long-horizon target state to evaluate each dependency
  choice against.
- **It distinguishes Escro from the factory at large** — the
  scope-tag is load-bearing. Zeta-core, the software factory
  itself, the auto-memory, the personas — none of these are
  named in the directive. *"for escro we should ..."* binds
  the discipline to Escro. Factory-level policy still defaults
  to the absorb-and-contribute tier-gated discipline unless
  Aaron extends the scope.

## Immediate vs long-horizon actions

**Immediate (this tick + next few ticks):**

- Log the directive to memory (this file).
- Note in tick-history so the decision is auditable in the
  committed record without requiring memory-access.
- No BACKLOG row filed yet — Aaron explicitly said "grow our
  way there"; filing a P0 "write microkernel OS" row would
  be honking past the grow-our-way-there cadence. Let the
  first concrete Escro dep-maintenance work (the first
  absorb-target touched under the Escro scope) carry the
  BACKLOG row itself.

**Long-horizon (months to years):**

- Each dependency Escro acquires gets evaluated under the
  maintain-every-dep lens: "can we own this?" Fork targets
  start small (library-level) and move down the stack as
  capacity grows.
- Stack layers to traverse (top to bottom, indicative):
  1. App libraries (MIT/Apache) — absorb-and-contribute
     already covers.
  2. Framework libraries (React, OpenTUI, ASP.NET Core) —
     fork + maintain as factory gains familiarity.
  3. Language runtimes (Bun, Node.js, .NET, Python) — fork
     only with serious cause; upstream-only until then.
  4. Language compilers (F#, Rust, TypeScript) — upstream-only
     for a long time; fork only for terminal cases.
  5. OS userland (glibc, musl, coreutils) — research target.
  6. Kernel (Linux) — fork + maintain when the factory has
     the capacity.
  7. Microkernel (new or forked — seL4, Mach variants, etc.) —
     the endpoint Aaron named.
- **Compose with no-deadlines** — each layer-down is a move
  the factory makes when the factory can, not on a schedule.
- **Compose with capability-limited bootstrap** (BACKLOG
  #239) — this is the bootstrap frontier pushed down the
  stack; each capability-limited tier that can build the next
  layer is a valid rest-point.

## Why microkernel specifically

Aaron said **microkernel**, not "kernel" or "OS". The choice
is meaningful:

- **Microkernel = smaller trusted-compute-base** (seL4 is
  ~10 KLoC fully formally verified; Linux monolithic is
  ~30 MLoC unverifiable). Maintainability at the
  small-kernel tier is orders of magnitude easier than at
  the monolithic-kernel tier.
- **Microkernel = message-passing IPC** — aligns with the
  Zeta retraction-native operator algebra (D/I/z⁻¹/H) which
  already treats state as message-like deltas. Not
  coincidental.
- **Formal-verification-compatible** — Soraya's
  formal-verification routing would have more surface to
  work with on a microkernel than on a monolithic kernel.
- **Coherent with the factory's ALIGNMENT measurability
  focus** — small kernel = provable properties = alignment-
  relevant at the substrate layer.

This is not a commitment to ship a microkernel. It is
recording that Aaron's word-choice was precise, not casual.

## Open questions (to Aaron, not self-resolved)

1. **What is "escro"?** — confirm spelling, confirm whether
   this names an existing product/repo or a future one. Don't
   assume.
2. **Scope boundary between Escro and the factory** — does
   the microkernel-endpoint apply to Zeta-core-the-library
   too, or only to Escro-the-product? (The directive said
   "escro" only; leaving Zeta-core under the tier-gated
   absorb-and-contribute discipline.)
3. **Initial layer to start absorbing for Escro** — does
   Aaron want a specific layer prioritised, or left to
   bottom-up factory choice as work surfaces?
4. **Dependency inventory gate** — before maintaining every
   dep, the factory needs to enumerate Escro's deps. Does a
   dep-inventory spike land as the first Escro-scoped task?
5. **Relationship to `submit-nuget`** (existing 62-NuGet-
   component inventory) — is submit-nuget the seed of the
   Escro dep-inventory, or is Escro a separate scope?

Flag these to Aaron rather than self-resolving.

## What this is NOT

- **NOT a commitment to ship a microkernel in round 45**. Aaron
  explicitly said "grow our way there".
- **NOT a factory-wide policy change**. Scope-tag "escro" is
  load-bearing; factory at large still operates under the
  tier-gated absorb-and-contribute discipline from
  auto-loop-27.
- **NOT a directive to stop using existing deps**. Each dep
  stays in place until a concrete maintenance move lands; the
  directive is about maintenance posture, not withdrawal.
- **NOT in conflict with the no-deadlines discipline**. "grow
  our way there" is explicit acknowledgment that this is a
  multi-year trajectory, not a sprint.
- **NOT limited to Zeta-core deps**. Escro may depend on
  things Zeta-core doesn't; those count too under the Escro
  scope.

## Composes with

- `feedback_absorb_and_contribute_community_dependency_discipline_2026_04_22.md`
  — the base discipline this directive generalises.
- `project_five_concept_distribution_substrate_cluster_local_mode_declarative_git_native_distributable_graceful_degradation_2026_04_22.md`
  — five-tier degradation ladder; owning-the-kernel pushes
  the floor of local-mode-compatible-floor down one layer.
- BACKLOG #239 capability-limited bootstrap — each layer-down
  is a capability-limited-bootstrap instance.
- BACKLOG #249 emulator substrate research — one example of
  where absorb-and-contribute lands in practice.
- `memory/no-deadlines*` feedback — governs the "grow our
  way there" cadence.
- `docs/ALIGNMENT.md` measurability focus — small kernel =
  more formally-verifiable surface = stronger measurable
  alignment claim at the substrate layer.
