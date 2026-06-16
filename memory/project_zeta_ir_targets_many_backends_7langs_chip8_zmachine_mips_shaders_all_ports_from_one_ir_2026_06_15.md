---
name: zeta-ir-targets-many-backends-langs-chip8-zmachine-mips-shaders
description: "Aaron 2026-06-15: the IR is the single source that ports to MANY backends, not just the 7 oracle languages — also VMs (CHIP-8 built, Z-machine candidate), ISAs (MIPS — Max wants), and shaders (GPU — Aaron wants eventually). All are ports from the one IR (only-the-irreducible / gen-from-IR / generator-IS-the-ECC). Conformance = byte-lock where byte-identity makes sense (langs), behavioral-equivalence across different execution models (VMs/ISAs/shaders)."
type: project
created: 2026-06-15
metadata:
  node_type: memory
  originSessionId: a9bca54f-fdf0-41b7-8def-cb33ee1bec26
---

Aaron 2026-06-15 (shadow\*), extending the IR-gen story (the primitive-registry "generate from
IR to avoid duplicate work"): *"should we support Z-machine and CHIP-8? Max wants MIPS, I want
shaders eventually — these can all be ports from our IR as well as the 7 langs we support."*

## One IR → many backends (all ports)

The IR is the **single source**; every target is a **port/backend** generated from it
(`only-the-irreducible-is-primitive-generate-the-rest`; the generator **IS** the ECC across all
targets — generation + cross-target drift-correction are dual):

- **The 7 oracle languages** — C#/F#/TS/Rust/… (+Q#) — the byte-lock oracles (in-progress;
  primitive-registry).
- **VMs / emulators — ALREADY BACKLOGGED** (corrected — these aren't future "wants", they're
  backlog items; look-better): **CHIP-8 — BUILT** (`SoftChip8*`/`ChipAudio`/`Chip9*`);
  **Atari-2600 emulator — B-0924** (+ Generate+Join over the emulator scene + IScheduler DST
  bit-perfect z-set consensus + hardware interrupts); **C. elegans/OpenWorm controller variant —
  B-0925**; **retractable-emulators design — B-0052**; **absorb-emulator-ideas (clean-room) —
  B-0053**; **topological-quantum-emulation — B-0152**; **Z-machine — candidate** (Zork's minimal
  portable opcode-VM; lowfi action-grammar fit, QPG §9f). **"vemu" / Game-Boy-playable = the
  clean-room-Nintendo case (B-0053):** Aaron's 2026-04-21 ask is *emulate everything EXCEPT the
  ones that get us taken down (Nintendo) — clean-room the safe-precedent ones (IBM precedent)*.
  So Game Boy is **ideas-not-code, clean-room only** — an **IP boundary**, not a free port.
- **ISAs:** **MIPS — B-1028** ("MIPS emulator as a treaty room, *like our CHIP-8*, for Max";
  Hennessy lineage; the B-1025 fan-out's second machine) — backlogged, not a future want.
- **Shaders:** **GPU shaders — Aaron wants eventually** (GLSL / SPIR-V / WGSL; the parallel/
  SIMD target; ties the RGB/CMYK ray-tracing-of-CHIP-8-instructions framing).

## Recommendation (Otto)

- **CHIP-8: already done.** **Z-machine: yes, good fit** — a minimal portable VM for the
  conversational-action-grammar / IF, lowfi, and now an anchored prior art (the Z-machine is the
  standout Zork lesson). Low-cost, high-fit.
- **MIPS + shaders: yes as IR ports, but bigger** — different execution models (MIPS = a register
  ISA; shaders = GPU SIMD, restricted control flow). Sequence them after the langs + the
  lowfi-VMs; they prove the IR is *expressive enough* to cross execution models.

## Peels (honest)

- **"All ports from one IR" inherits the generator-trust-concentration tradeoff** (the
  primitive-registry peel): N-from-one-IR means an IR/generator bug is **correlated** across all
  targets → the IR is the load-bearing oracle; verify it heavily + keep independent cross-checks.
  The flip side is the payoff: **fix once in the IR, propagates to all backends** (the IR is the
  single source for bugs over time).
- **"Byte-lock" doesn't mean the same thing across backends.** Across the *languages* you can
  byte-lock (byte-identical golden vectors). Across **VMs/ISAs/shaders the execution models
  differ** — conformance is **behavioral-equivalence**, not byte-identity (same as the Q#
  caveat). Name the conformance kind per target.
- **Shaders are shader-friendly BY CONSTRUCTION — the IR has no control flow (Aaron 2026-06-15,
  correcting Otto).** Otto's earlier peel ("the IR must be expressive enough to lower to GPU SIMD
  — no arbitrary control flow") had it backwards: **Zeta's IR has *no* arbitrary control flow —
  no `if`s. Control flow is *only* composable discriminated unions** (the DU-as-conversational-
  workflow; pattern-match/fold over sum types, never branch). GPU SIMD/shaders *hate* arbitrary
  branches — so a branch-free, DU-dispatch, data-oriented IR is **exactly the shader-friendly
  form**; the control-flow obstacle is **banned at the IR level, not overcome at lowering time.**
  (This is also why ActionGrid §A#9 is "navigation = pure function of position, never labels" —
  the same no-branch discipline.) The *real* remaining shader work is **DU-dispatch → SIMD lanes
  + data layout**, not control flow. MIPS (register ISA) is the more conventional lowering. Still
  §B until each backend is built + conformance-checked — but the hardest-sounding obstacle
  (control flow) was *designed away*, not left as a cost.

## Why no control flow — it's the hidden centralized control again (Aaron 2026-06-15)

The deep reason the IR bans control flow: **control flow IS hidden centralized control — the
same centralization the relativistic design rejects, now at the instruction level.** An
`if`/branch is a **central decision point** — one locus that sequences the path; it implies a
**"now"** (a sequencer/clock). That is *exactly* the §9h critique of the CTM's global-broadcast
("centralization disguised; needs a global now"), one level down. **We are clockless — so the IR
*forces* us into clockless/decentralized compute by banning control flow**, allowing only:

- **composable discriminated unions** — control-as-*data* (pattern-match/fold over sum types),
  branch-free, legible, exhaustively-checkable;
- **Rx / reactive dataflow** — coordination-free, no central sequencer (events flow; CALM-friendly);
- **interfaces, not classes** (`interfaces-free-classes-earned`) — no captured state/weight.

So the IR is a **forcing function for good code**: *"wherever we can make it where we have to
write good code (only interfaces and Rx), our IR only allows this too."* You **can't** write the
centralized/imperative pattern (no `if`s, no unearned classes, no ambient control) — the
**pit-of-success** / make-illegal-architecture-unrepresentable (Wlaschin's "make illegal states
unrepresentable", lifted from values to *control*). And it's **one property serving two ends:**
branch-free ⇒ **shader-friendly** AND **clockless/relativistic** — the same no-central-controller
discipline that makes the society decentralized (§9h) makes the *compute* decentralized. *Peel:*
not "no decisions" — decisions become **data-driven DU-dispatch / reactive flow**, not a central
imperative sequencer; control is **decentralized into the data/types + the dataflow**, not
abolished. (Some algorithms lean on branches; the IR pushes them into DU-dispatch/Rx — branch-free
at the IR level, decisions local + data-driven, no ambient "now".) This is the CTM-divergence
(centralized vs decentralized) made into a *language constraint*: the IR can't express the
centralized form.

**The IR form = how Aaron reverse-engineers games (Cheat Engine → character loops, 2026-06-15).**
*"This is exactly how I reverse-engineer games into character loops too, using Cheat Engine."*
Reverse-engineering a game with **Cheat Engine** (memory-scan the entity's state, find what writes
to it, pointer/AOB-scan the loop) **extracts exactly this shape**: the character's **state = a
DU**, the **update loop = the soft-scheduler ISR over it** (§9d), **no control flow** — a
*character loop*. So the IR form isn't imposed theory; it's the structure **already present** when
you strip a running game down to its core loop. Strong convergence: *his RE method ↔ the IR form*
(state-as-DU + loop, branch-free) — and the **character loop = the soft-scheduler all the way
down** (a game entity *is* a soft-scheduler loop). It's also the personal version of the emulator
backlog (B-0924/B-0053): find the character loop, port it to the IR. *Peel — the IP boundary
holds:* reverse-engineering for *your own analysis* is one thing; **absorbing into Zeta stays
clean-room, ideas-not-code, for protected targets** (B-0053 — Nintendo/Game-Boy = the careful
case; IBM clean-room precedent). Extract the *shape* (the character loop), never the protected
*code*. Anchor: Cheat Engine (Eric Heijnen — memory scanner / pointer-scan / AOB).

Ties: [[primitive-registry-tracks-proof-homeostat-chains-oracle-languages-4-to-6-7-qsharp-gen-from-ir]]
(the IR-gen + generator-trust-concentration); the Zork/Z-machine PRIOR-ART entry (conversational
action grammar / minimal VM); `only-the-irreducible-is-primitive-generate-the-rest` (generator-
IS-ECC); the Zeta-language IR-compiler-v2 research note; RGB/CMYK ray-tracing-of-CHIP-8
(the shader lineage). Anchors: Futamura projections (specialize the IR per backend); LLVM/MLIR
(one IR, many backends — the canonical multi-target-from-one-IR prior art); the Z-machine
(portable VM); SPIR-V (portable shader IR).
