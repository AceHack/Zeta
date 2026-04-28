# Emulator substrate research — first-pass public-source survey

**Status:** first-pass, 2026-04-22, auto-loop-32. Pending
BACKLOG row #249 (emulator substrate research). Public-source
only — no private-archive access invoked.

**Scope:** architectural survey of three mature open-source
emulator projects (RetroArch/libretro, MAME, Dolphin) from
their public documentation and source trees, focused on the
patterns that map to Zeta's factory substrate. Not a how-to,
not a port plan. Read-the-wine-list before ordering.

**Why this research matters for Zeta:** the factory is
accumulating primitives (substrate-gap-report, soulsnap/SVF,
UI-DSL class-vs-instance semantics, retraction-native operator
algebra, capability-limited bootstrap) that the emulator
community has had production-grade answers to for 20+ years
at 30M+ LoC scale. Cheaper to absorb their solved shape than
to re-derive from zero. Composes with BACKLOG #213
(Chronovisor), #241 (soulsnap/SVF), #239 (capability-limited
bootstrap), and Aaron's 20-year preservationist archive
context (`memory/project_aaron_icedrive_pcloud_substrate_access_20_years_preservationist_archive_2026_04_22.md`).

## Three projects, three architectural answers

### libretro + RetroArch — capability-negotiation substrate

**What it is:** libretro is a C ABI plugin interface; RetroArch
is the reference frontend. Emulator implementations ("cores")
ship as dynamic libraries exporting a fixed set of entrypoints
(`retro_init`, `retro_run`, `retro_serialize_size`,
`retro_serialize`, `retro_unserialize`, `retro_reset`,
`retro_set_environment`, etc.). Frontends handle
input/video/audio/UI; cores handle emulation.

**The architectural move:** strict frontend/core separation
with capability negotiation via the `retro_environment`
callback. Cores declare required capabilities (pixel format,
input descriptors, variables, achievements); frontends
declare what they provide. Capabilities the frontend can't
satisfy either degrade gracefully or surface as errors.

**Zeta analog:** this is the *exact* shape of the factory's
substrate-gap-report pattern and the five-concept distribution
substrate (cluster / local-mode / declarative / git-native /
distributable). Cores-to-frontends maps to capabilities-to-
substrates. The libretro playbook — one narrow ABI, many
cores, one frontend handles everything-not-emulation — is a
proof-point that the factory's substrate-agnostic-by-design
shape scales to a thousand-core ecosystem.

**Key absorbed patterns:**

- **Capability negotiation by callback**, not static manifest.
  Cores ask for what they need at runtime; frontends answer
  yes/no/degraded. Lets the ecosystem evolve without lockstep
  upgrades.
- **Core-as-dynamic-library** + frontend-as-host — the load-
  boundary enforces the ABI and isolates core crashes from
  frontend UI/session state.
- **Serialization primitives in the core ABI** —
  `retro_serialize_size` / `retro_serialize` /
  `retro_unserialize` are first-class, not an afterthought.
  Every core must implement them; every frontend can rely on
  them.

**License:** libretro API is MIT-class; cores vary (many
GPL-2). **Absorb-and-contribute disposition:** MIT ABI + GPL
cores fits the tier-gated discipline (community-maintained
substrate, fork-and-upstream eligible).

### MAME — driver-per-machine, accuracy-first

**What it is:** Multiple Arcade Machine Emulator. C++, BSD-3
for newer code / GPL-2 legacy, tens of thousands of drivers
targeting specific arcade machines, home consoles, and
microcomputers. Organized around "one driver per machine"
with a shared device/CPU/sound emulation layer
(`src/devices/`).

**The architectural move:** prioritize accuracy over
performance. Drivers model the machine at cycle-accurate
granularity where the underlying hardware needs it; shared
CPU cores (`src/devices/cpu/`) are reused across drivers.
State-save framework (`state_save.cpp`) serializes every
registered device-state field automatically.

**Zeta analog:** driver-per-machine is the instance-level
extreme of the UI-DSL class-vs-instance semantics directive
(`memory/project_ui_dsl_compressed_class_not_instance_semantics_not_bit_perfect_2026_04_22.md`).
Where libretro says "ship the class, derive the instance",
MAME says "ship the instance, share the primitives". Both
are valid; the choice is about where fidelity matters.

MAME's `state_save` framework is prior art for soulsnap /
SVF (BACKLOG #241): a system-wide, automatically-captured
snapshot of all registered state, with schema-versioned
compatibility. The soul-over-bit-compat discipline is
MAME's bread-and-butter — when a CPU core changes its
internal representation, `state_save` handles the
migration.

**Key absorbed patterns:**

- **Shared-primitive layer + per-instance drivers** — the
  CPU cores / sound chips / video chips are shared; drivers
  compose them. Maps directly to the operator-algebra
  (shared primitives D/I/z⁻¹/H) + per-domain pipelines.
- **Automatic state-save via field registration** — drivers
  don't hand-write serialization; they register fields and
  the framework does the rest. Same discipline as DV-2.0
  frontmatter + capture-everything.
- **Deliberate complexity budget** — MAME explicitly accepts
  that some machines need cycle-accurate emulation and pays
  the runtime cost. Maps to the "no-deadlines" cadence
  (factory's `memory/no-deadlines*` feedback): fidelity beats
  ship-date where fidelity matters.

**License:** BSD-3 (modern) / GPL-2 (legacy). Absorb-and-
contribute tier: community-maintained, fork-eligible.

### Dolphin — JIT recompilation + HLE/LLE spectrum

**What it is:** GameCube / Wii emulator. C++, GPL-2. JIT
recompilers for PowerPC-to-{x64, AArch64}. Modular split:
`Source/Core/` (CPU, memory, HW registers),
`Source/Core/VideoCommon/` (GPU command stream translation),
`Source/Core/VideoBackends/` (OGL / Vulkan / D3D11 / D3D12 /
Metal / Software / Null). HLE (high-level emulation) for
some Wii IOS subsystems; LLE (low-level emulation) for cases
that need it.

**The architectural move:** dynamic binary translation
(JIT) to make full-speed emulation feasible on commodity
hardware, plus a tunable fidelity axis (HLE fast default,
LLE fallback for games that care).

**Zeta analog:** the HLE/LLE spectrum is a perfect instance
of the class-level-vs-instance-level fidelity tradeoff the
UI-DSL directive names. HLE says "implement the observable
behavior of this subsystem at the API boundary"; LLE says
"emulate the actual instructions of the subsystem's firmware".
Factory translation: class-level-DSL is HLE, pinned-instance
blocks are LLE. Dolphin proves the escape-hatch pattern
scales — most games are fine with HLE, a few need LLE, both
live in the same binary, users toggle per-game.

JIT recompilation is also the instance-level analog of the
factory's shipped-kernel-library directive
(`memory/project_ui_dsl_function_calls_shipped_kernels_algebraic_or_generative_2026_04_22.md`):
at emulator runtime, PowerPC instruction sequences are
"compiled down" to host ISA. The DSL-as-calling-convention +
shipped-kernels shape is directly mirrored in emulator JIT
compilation pipelines.

**Key absorbed patterns:**

- **Per-backend graphics abstraction** (`VideoCommon` +
  `VideoBackends/*`) — the rendering pipeline is
  backend-agnostic, each backend satisfies the same
  interface. Same shape as five-concept distribution
  substrate for Zeta.
- **HLE/LLE toggle per-game** — fidelity is a per-instance
  knob, not a project-wide commit. Maps to the UI-DSL
  `pinned` escape hatch at UI layer and to BACKLOG #249
  emulator-substrate posture generally.
- **Netplay via deterministic lockstep** — Dolphin's netplay
  assumes deterministic emulation, rollbacks resync on
  divergence. Same discipline as retraction-native operator
  algebra + capability-limited bootstrap's restart-with-
  subset-state pattern.

**License:** GPL-2. Absorb-and-contribute tier: community-
maintained, fork-eligible.

## Cross-project patterns — factory-relevant synthesis

### 1. Save-state serialization as a first-class ABI primitive

All three projects (libretro, MAME, Dolphin) treat
save-state serialization as a *core ABI primitive*, not an
optional feature. Every emulator/core/driver must be able to
freeze its complete soul and restore it. Schema-versioning,
migration on load, and backward-compatibility windows are
all solved.

**For Zeta:** soulsnap/SVF (BACKLOG #241) has 20 years of
prior art to learn from. Specifically:

- **Register-then-serialize** beats hand-written
  serializers (MAME's `state_save_register_item` pattern).
- **Schema version in the header** + per-version migration
  functions is the industry-standard migration story.
- **Size-query-before-serialize** (`retro_serialize_size`)
  lets hosts pre-allocate and discover state footprint
  without forcing full serialization.
- **Determinism matters more than compression** for rollback
  use-cases — save-state format choices prioritize
  determinism and restore-speed over on-disk compression.

### 2. Class-vs-instance fidelity as a deliberate axis

libretro (core-per-class), MAME (driver-per-instance),
Dolphin (HLE class + LLE instance per-game) each pick a
different point on the same axis. The axis itself is load-
bearing: no project claims "one fidelity level is right for
all cases". Fidelity is a tunable, per-consumer knob.

**For Zeta:** UI-DSL class-vs-instance directive is already
this axis at the UI layer. Emulators prove the axis
generalizes to stateful systems. soulsnap/SVF should pick
its fidelity posture explicitly (which it seems to already
do — soul-compat-over-bit-compat).

### 3. Capability negotiation > static manifest

libretro's `retro_environment` callback is capability
negotiation at runtime, not a static plugin manifest.
Dolphin's backend selection is runtime (OGL/Vulkan/D3D/etc.
chosen at start). MAME's device registration is runtime.

**For Zeta:** substrate-gap-report should be a runtime
negotiation, not a compile-time feature flag. Composes with
the five-concept distribution substrate and the prevention-
layer discipline.

### 4. Absorb-and-contribute is the emulator default

All three projects are community-maintained (BSD/GPL/MIT),
all three accept upstream contributions via standard PR
workflows, all three have long-tail contributor communities.
For Escro's "maintain every dependency → microkernel OS
endpoint" directive
(`memory/project_escro_maintain_every_dependency_microkernel_os_endpoint_grow_our_way_there_2026_04_22.md`),
the emulator substrate is a textbook absorb-and-contribute
opportunity.

## What this research is NOT

- **NOT a port of an emulator to Zeta.** The research
  absorbs patterns, not code. Actual emulator integration
  (if ever) is a separate BACKLOG item.
- **NOT a recommendation to use a specific emulator in
  production.** Chronovisor and SVF are format-family work;
  emulator integration is downstream, not upstream.
- **NOT a claim that Zeta should be an emulator.** The
  patterns are what transfer — the factory stays the
  factory.
- **NOT exhaustive.** This is a public-source first-pass;
  deep architectural study (e.g., reading `retroarch.c` end-
  to-end, profiling MAME state-save overhead) is follow-up
  work when a specific factory item needs it.

## Pending follow-ups

- **Second-pass**: deep-dive into libretro `retro_environment`
  extensions list (the "what capabilities exist" vocabulary is
  itself a useful substrate-gap-report seed vocabulary).
- **Second-pass**: MAME `state_save` schema-version migration
  patterns — read enough of `state.cpp` to absorb the
  migration-function shape.
- **Second-pass**: Dolphin netplay rollback mechanism —
  determinism-enforcement and divergence-recovery shape is
  directly relevant to retraction-native-operator-algebra's
  rollback semantics.
- **BACKLOG candidacy**: should `#249` gain a row, or should
  this research stand alone until a concrete factory item
  needs the patterns? Flag to Architect for round-45 triage.

## Composes with

- BACKLOG #213 Chronovisor — emulator save-state frameworks
  are prior art for preservation-infrastructure.
- BACKLOG #241 soulsnap/SVF — retro_serialize / state_save /
  Dolphin snapshots are the three production-grade answers
  to the "soul compat over bit compat" question.
- BACKLOG #239 capability-limited bootstrap — HLE/LLE toggle
  + libretro capability negotiation are the same shape.
- `memory/project_ui_dsl_*` — class-vs-instance fidelity axis
  generalizes from UI to state.
- `memory/project_escro_maintain_every_dependency_microkernel_os_endpoint_grow_our_way_there_2026_04_22.md`
  — emulator substrate is a textbook absorb-and-contribute
  layer.
- `memory/project_aaron_icedrive_pcloud_substrate_access_20_years_preservationist_archive_2026_04_22.md`
  — Aaron's 20-year archive includes material emulators would
  read; preservationist context makes the research doubly
  relevant.
- `docs/research/stacking-risk-decision-framework.md` — this
  research is public-source only, so no stacking-risk
  invocation needed. Pre-validation anchor for future
  archive-gated emulator research.
