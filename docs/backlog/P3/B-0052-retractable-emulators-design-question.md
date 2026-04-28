---
id: B-0052
priority: P3
status: open
title: Retractable emulators — design question (not implementation) for retractibility-preservation in Zeta's emulator surface
tier: design-question-research
effort: L
ask: Aaron 2026-04-21 — *"our emulators should be retractable backlog how"*
created: 2026-04-26
last_updated: 2026-04-26
composes_with: [B-0053, B-0051, feedback_no_permanent_harm_mathematical_safety_retractibility_preservation.md, feedback_see_the_multiverse_in_our_code_paraconsistent_superposition.md, docs/research/chain-rule-proof-log.md, tools/lean4/Lean4/DbspChainRule.lean]
tags: [emulator, retraction-native, save-state, deterministic-replay, jit-cache, bank-switching, view-clock, rng-reified, cycle-accurate, design-question]
---

# B-0052 — Retractable emulators design question

## Origin

AceHack commit `9c7f374` (2026-04-21). This row holds the **design question** (not the implementation). Assumes the parent emulator-ideas-absorption row B-0053 has landed enough absorbed patterns that Zeta has an emulator-shaped surface at all — this row is the retractibility-preservation design question layered on top.

## The ask in one sentence

An emulator that runs a VM deterministically already has a save-state layer (runtime snapshot) — but a *retractable* emulator in Zeta's sense (per math-safety memory and the retraction-native operator algebra) must additionally support the `Δ⁻¹` / `z⁻¹` / explicit retraction of arbitrary past operations in a way that **composes with Zeta's own operator algebra**.

Save-state ≠ retraction; save-state is checkpoint-and-rewind (restores to a labelled prior state), retraction is +k/-k additive cancellation (applies an inverse operation that commutes with the rest of the algebra). The design question is how to bridge.

## Design axes to explore

### Save-state as retract-witness rather than retract-primitive

An emulator save-state snapshots the VM at time t. If we reify the input-log (ROM + controller inputs + RNG seed) between save-states, then "retract events [t1..t2)" becomes "replay from save-state-before-t1 with `events \ retracted-events`, snapshot the new state, compute a `Δ` between new-state and save-state-at-t2, apply the `Δ` via Zeta's normal operator algebra." Save-states serve as *checkpoints for efficient retraction computation*, not as the retraction primitive themselves.

### TAS-grade deterministic replay as the retraction carrier

Tool-assisted-speedrun communities already distribute 10-hour input movies that reproduce byte-exact. That discipline is strictly stronger than property-based-testing's replay — every sub-cycle is determined by the input log + initial state. Retraction semantics drop in naturally: remove events from the log, replay, diff. The cost is replay-time; save-states are the optimization that amortizes it.

### Memory-bank switching ↔ View<T>@clock

The `View<T>@clock` surface is where paraconsistent-superposition semantics live. Emulator bank-switching is literally a view-selection over a superposed address space. Retractable-emulator design can reuse this surface: retract a bank-switch = retract a view-selection, and downstream computations using the prior view retract via the normal algebra.

### JIT recompile caches must be retract-aware

Dolphin / RPCS3 dynamically recompile hot blocks on memory-write; the recompile cache is invalidation-based. For retractibility, the cache must either (a) be inline-invalidated on retraction (every retracted write invalidates downstream recompiled blocks), or (b) maintain a per-block provenance tag that allows retraction-aware cache eviction. The engineering choice is whether to eagerly invalidate (simpler, slower) or lazily propagate (harder, faster).

### RNG state as first-class retract-target

Emulated games frequently read from the RNG at unpredictable cycles. If retraction must preserve determinism of unretracted events, the RNG draw-log must be reified the same way the input-log is. Most emulators don't do this — they treat RNG as VM-state-like rather than event-log-like. Retractable design flips this.

### Cycle-accurate scheduling preserves retraction granularity

The finest retraction unit is the cycle (or sub-cycle for DMA). Coarser retraction (frame, input) is valid but lossy. Make the granularity explicit in the API; refuse to quietly lose precision on retraction requests.

### Hardware-backed retractibility for peripherals

Emulated peripherals (sound, DMA buffers, graphics frame buffer) carry emulated-time state that doesn't live in CPU RAM. The retractable emulator design must either (a) fold all peripheral state into the save-state (heavy), (b) make each peripheral independently deterministic-replayable (the higan/bsnes approach), or (c) accept lossy retraction at peripheral boundaries (weakest). **Option (b) composes best with Zeta's algebra.**

## Composition with Zeta's retraction-native operator algebra

The big question this row opens: **is an emulator's `step()` function a Zeta operator?** If yes (the VM state is a ZSet-like structure over {cycle × (address,value)}) then the algebra composes natively and retraction "just works" via the existing +k/-k semantics. If no (VM state is fundamentally ordered / non-commutative in a way ZSet can't carry), we need either a **lifted algebra** that promotes ordering into the carrier, or a **restricted algebra** that refuses retraction past order-dependent boundaries. The answer likely lives in the chain-rule formalization already being proved in Lean applied to a trivial VM.

## Prior art to examine

- **Hypervisor / live-migration** — VMware / KVM / Xen do state-snapshots for VM migration; technique is mature but not retraction-oriented.
- **Deterministic replay systems research** — arrakis, ODR, DMP-compat literature from systems-PL overlap; the retraction semantic question is essentially "when-is-replay-composable-with-additive-inversion."
- **Time-travel debugging** — rr (Mozilla) does deterministic record-replay for native processes; gdb time-travel; UndoDB. All focus on reverse-execution, not retraction-as-inverse-operator. Studying their what-we-reify-and-what-we-don't decisions tells us where retraction semantics must diverge.
- **Functional-lenses / zippers** — pure-functional literature on navigating-and-updating nested state without mutation. Retractable emulator state is arguably a giant zipper over (time, memory, registers, peripheral-state).

## Composition with B-0053

This row does NOT supersede B-0053; the two compose. B-0053 absorbs engineering patterns *from* existing emulators. This row is the *design question Zeta faces when building an emulator shape of its own that is retractable in Zeta's algebraic sense.* B-0053 feeds candidate patterns in; this row works out how to glue them to Zeta's operator algebra.

## Owner / effort

- **Owner:** Architect (Kenji) to schedule; Soraya (formal-verification) for the "is-VM-step-a-Zeta-operator" question; Naledi (performance) for the save-state-as-retract-witness amortization analysis; Hiroshi (complexity) for retraction-granularity cost modeling.
- **Effort:** L. First deliverable is a `docs/research/retractable-emulator-design-YYYY-MM-DD.md` note that answers the is-VM-step-a-Zeta-operator question under simplifying assumptions (e.g. a 6502-like trivial VM without DMA or peripherals).

## Does NOT commit to

- Building an emulator (the design question is interesting regardless of whether Zeta ever ships one).
- Choosing save-state as the retraction primitive (the design question is open — save-state-as-witness-for-retract is the current leading candidate, not a decision).
- Reading proprietary-BIOS-bearing emulators to study their retractibility (the safe-target discipline from B-0053 applies here too).

## Cross-reference

- AceHack commit: `9c7f374`
- Parent: B-0053 (emulator-ideas-absorption)
- Composes with: B-0051 (isomorphism catalog — is-VM-step-a-Zeta-operator is literally an isomorphism question); chain-rule-proof-log + DbspChainRule.lean (formal carrier for VM-step-as-operator homomorphism); multiverse / View<T>@clock memory; math-safety memory
