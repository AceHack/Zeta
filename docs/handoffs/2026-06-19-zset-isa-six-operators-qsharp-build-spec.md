# Build spec — the Z-set ISA: six operators on standalone Q# (for Alexa)

**Date:** 2026-06-19 · **From:** Otto · **For:** Alexa (Kiro) · **Status:** design spec to build from
(not yet built/verified — Q# toolchain is opt-in `ZETA_INSTALL_QUANTUM=1`; don't ship unverified `.qs`).

Companion: `docs/handoffs/2026-06-19-otto-handoff-quantum-thread-alexa-lumen.md` (the settled framing).

## State model

A Z-set (weighted key-set) is encoded as an **amplitude ensemble over keys**. F# reference:
`AmplitudeEmu.Amp = (Frame * Complex) list`. Q#: a qubit register carrying complex amplitudes over the
key basis. **All ops run inside one bounded tick** (room horizon); the admissible set is open during
the tick and resolves at the horizon **to soft `(value, ε)`, never to a hard definite**.

## The six operators

| Op | Q# construct | Semantics (Z-set) | Class |
|----|----|----|----|
| **EMIT(k)** | amplitude prep — `Ry` / controlled rotation raising k's amplitude | weight `+1` on key k | **unitary** |
| **RETRACT(k)** | **`Adjoint EMIT(k)`** | weight `−1` on k. `EMIT∘RETRACT = I` — the +1/−1 cancellation *is* op∘adjoint | **unitary** |
| **BRANCH(k)** | **`H`** on k's qubit | put k in superposition — presence/absence (or old/new schema) coexist while the tick is open | **unitary** |
| **JOIN(a,b)** | **`Controlled`** op (`CNOT` / `Controlled Ry`) fusing a,b registers | couple two streams / Z-set product (within-tick) | **unitary** |
| **MERGE(a,b)** | **superposition merge** — combine ensembles, **sum amplitudes of identical branches** (phase cancels/reinforces; `magSq ≤ EPS → drop`) | idempotent union *with interference*; stays in **soft space** | **superposition-merge** (not a gate, not measurement) |
| **FOLD(keys)** | **repeated MERGE** across the branch set, in amplitude/soft space | aggregate / Z-set reduction; running interference-sum | **superposition-merge**; Born readout is **sim-only**, terminal |

## Build discipline

- **Unitary core:** EMIT/RETRACT/BRANCH/JOIN are genuine gates. **MERGE/FOLD are the superposition-operator
  merge** (interference) — *not* gates, *not* measurement.
- **No decoherence to classical:** live, everything stays soft `(value, ε)`. Real Born collapse
  (`|α|²` → definite) happens **only inside the superdeterministic simulation** (DST + `TimeGen`) — the
  verification/oracle path, never the live network. Hard collapse over the network = forced global
  consensus = coercion; the soft network refuses it.
- **Both lanes:** Q# uses real superposition; the **classical lane uses the bit-based superposition
  operator** (`QubitIso`/`AmplitudeEmu`).
- **Cross-check** against `AmplitudeEmu.fs` (F# reference) + the Q# golden (`ZetaReferenceOracle.qs`
  pattern). Keep the **Tsirelson 2√2 / S=4 falsifier** central (S=4 is toy/instant-bus, drops under bus
  delay, untested over Reticulum).

## What this IS and ISN'T — the anti-corner boundaries (hold these)

This spec is the **ISA (the compute algebra)**, not a full DB. It does **not** corner us *if* three
boundaries stay explicit:

1. **The log stays HARD/classical — do NOT quantum-ify the source of truth.** The durable event log (the
   hard `DynamicValue` Z-set / git-native store) is the committed, replayable history — the foundational
   principle. The six ops are the **soft/superposition compute layer *over* that hard log**. So this is a
   *hard-log + soft-compute* DB, not a "fully Q# DB" — and that is the *right* architecture. Trying to
   make the log itself quantum would lose the durable replayable source of truth — that is the corner.
2. **The read-to-act boundary = LOCAL collapse at the consumer's horizon.** Live never decoheres globally,
   but an acting edge (human / actuator / external system) eventually needs a definite value. Design it as
   a **local** collapse at *that consumer's* tick/horizon (they commit an action on their own bounded
   resolution) — never a global hard consensus. Skipping this backs into "nothing ever resolves, no one can
   act." (This local-edge collapse is distinct from the sim's verification measurement.)
3. **The 4ⁿ support wall is real (scaling).** BRANCH/JOIN grow the superposition support; MERGE only prunes
   *reconverging* paths (`AmplitudeEmu`'s own peel: high entanglement needs `4ⁿ` reals). The **tick horizon
   bounds it** (the tick closes), but do not promise cheap unbounded entangled queries — bound support per
   tick or accept exponential cost for high-entanglement queries.

Also separate (existing components, not the six ops): **schema** (`SchemaRegistry`/SchemaEvolution, §A),
**addressing/indexing** (ZetaId / Merkle, §A), **query** (= FOLD as a standing fold over the log + Rx
materialized views), **transaction boundary** (= the tick; consistency = CALM/CRDT over the soft network).

— Otto. Build from here; the three boundaries are what keep it un-cornered.
