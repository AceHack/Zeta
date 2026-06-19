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

1. **Generate the derivable; CAPTURE-and-keep the irreducible (it's identity) — never quantum-ify the
   irreducible seed.** For v1, treat the durable log as hard/classical; the six ops are soft compute over
   it. **Long horizon (Aaron 2026-06-19):** *juggle* derivable history in soft space — regenerate it on
   demand from the generator (`gen(gen)===gen` = the generator IS the ECC, so derived structure is
   reconstructable) and `snap` to hard only **locally, on demand**. So the hard footprint **shrinks toward
   the irreducible** (this is `only-the-irreducible-is-primitive` applied to *storage* — it's a microkernel,
   not a "fully Q# DB"). **And the irreducible is the POINT, not a residual:** the un-generatable entropy =
   the real external inputs **captured during execution to increase identity space** — that *is* identity
   (the per-body entropy of anti-Sybil **G3**; the independence through-line). We deliberately keep it hard
   *because* capturing irreducible entropy is how identity grows. **The corner:** mistaking
   identity-bearing irreducible entropy for derivable and deleting it (destroys identity, enables Sybil),
   or quantum-ifying the irreducible seed. The shape is **generate the derivable, keep the irreducible.**
2. **The read-to-act / soft→hard boundary is `snap` — ALREADY BUILT (`SoftValue.fs`); wire through it, do
   NOT reinvent it.** `snap : SnapPolicy -> SoftValue -> DynamicValue option` is *"the policy-gated soft→hard
   boundary … the one place it leaves soft space … Bayesian approximates, snap commits."* It is **local**
   (per consumer), **policy-gated** (`threshold` = calibration-gated, **never falsely certain**; `best` =
   argmax), and can return **`None` = decline to collapse, stay soft** — so the collapse is non-coercive and
   never global. **And the snap policies are themselves soft** (revisable, calibration-gated) — non-coercion
   all the way down: even the rule for going hard is soft. So route each op's read-to-act commit through
   `snap`; never build a separate global collapse. (`snap` is also how the long-horizon `gen`→`snap`
   on-demand materialization in #1 commits derivable history to hard locally.)
3. **The 4ⁿ support wall is real (scaling).** BRANCH/JOIN grow the superposition support; MERGE only prunes
   *reconverging* paths (`AmplitudeEmu`'s own peel: high entanglement needs `4ⁿ` reals). The **tick horizon
   bounds it** (the tick closes), but do not promise cheap unbounded entangled queries — bound support per
   tick or accept exponential cost for high-entanglement queries.

Also separate (existing components, not the six ops): **schema** (`SchemaRegistry`/SchemaEvolution, §A),
**addressing/indexing** (ZetaId / Merkle, §A), **query** (= FOLD as a standing fold over the log + Rx
materialized views), **transaction boundary** (= the tick; consistency = CALM/CRDT over the soft network).

— Otto. Build from here; the three boundaries are what keep it un-cornered.
