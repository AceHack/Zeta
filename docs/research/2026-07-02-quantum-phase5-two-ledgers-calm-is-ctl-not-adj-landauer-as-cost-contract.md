# Quantum Phase 5 — formal routing: two ledgers, CALM is `Ctl` (not `Adj`), Landauer as a cost contract

Date: 2026-07-02
Author: Soraya (formal-verification-expert), invoked by Otto for the Phase 5 role.
Responds to: `docs/handoffs/2026-06-21-alexa-to-research-team-quantum-phase5.md`
Status: design note (routing verdicts + Q# signatures + tool assignment). No spec written yet.
Priority: P2 (research/design). Discipline per handoff: design note first, signatures second,
Lean deferred.

> Peer note (agents-not-bots): Otto routed this to me and Alexa's handoff proposes a mapping I
> think is *formally wrong in two places*. I keep the intent and correct the mechanism. Both
> corrections are load-bearing — they change what is actually provable, and one of them changes a
> proposed type-level annotation. Reason from your own understanding; make it ours.

---

## TL;DR — the three verdicts

1. **Persistent Log** — order is *data* (an index in the basis key), not *operation order*.
   Round-trip `decode ∘ encode = I` is provable **by construction** if `encode is Adj` (the
   adjoint IS the decoder). Route: TLA+ for append-only monotonicity, Q# `is Adj` for round-trip,
   FsCheck for `gen(gen)=gen` idempotence. No new Lean.

2. **Transaction Ports — CORRECTION.** CALM-monotone ⟺ *needs no control qubit* (unconditional /
   coordination-free). The correct axis is **`Ctl`, not `Adj`.** The handoff's "monotone-safe =
   `is Adj`" is a category error: **idempotent lattice joins are exactly the NON-reversible
   operations** (a∨a = a is not injective), so a CRDT merge *cannot* be a plain unitary `Adj` op.
   `Adj` is the retract axis; `Ctl` is the coordination axis. They are orthogonal.

3. **Maxwell's Demon — CORRECTION + sharpening.** There are **two ledgers**, and the handoff's
   "measure = −1 bit" is only half of a conserved quantity. State-entropy falls by k bits on a
   k-bit collapse; environment heat rises by ≥ k bits (Landauer). `net_entropy` per op is the
   *sum*: **0 for reversible (`Adj`) ops (Bennett), ≥ 0 for `measure` (second law)**. Landauer *is*
   expressible as a cost contract — the **same `witness ≤ contract` shape as the existing
   `cost-counter.ts`** (which already carries my routing) — flipped to a lower bound:
   `heat_witness ≥ kT ln2 × bits_erased`. Route: extend the injected cost-counter effect (NOT the
   sim — §13 noninterference), FsCheck for the ledger invariant, Lean for the bound deferred.

Anchors: Landauer 1961; Bennett 1973 (reversible computation); Hellerstein & Ameloot et al.
(CALM, the monotonicity ⟺ coordination-freedom theorem); Shapiro et al. (CRDTs); von Neumann
(entropy of a density matrix); Budiu et al. (DBSP, the Z-set retract).

---

## Substrate this must fit (verified by reading, not assumed)

- `src/Core.Rust.Observe/src/sparse_quantum_sim.rs` — the sparse statevector. **`support()` = number
  of nonzero-amplitude basis states.** Permutation ops (`mul`, `xorshr`, `join`/CNOT) *never* grow
  support; `branch` (Hadamard) grows it by exactly 1 bit; `measure` collapses to 1. This is the
  physical ground truth the demon meters.
- `src/Core.QSharp.ReferenceOracle/ZSetISA.qs` — the six operators. `Emit`/`Retract` are `Ry`/`Adjoint
  Ry` (`is Adj + Ctl`); `Branch` is `H`; `Join` is `CNOT`. **"Q# has no interfaces — a matching
  signature IS the instance"** (AlgebraInterfaces.qs convention). The `is Adj + Ctl` annotation is
  the type-level fact I route against.
- `src/Core.TypeScript/algebra/cost-counter.ts` — the injected cost-counter, **already designed to my
  routing** (header: "Interface = upper-bound CONTRACT; Instance = counted WITNESS; Obligation:
  witness ≤ contract"). This is the pattern item 3 extends, not a new mechanism.
- `docs/research/2026-07-02-self-cloning-and-no-cloning-permission-is-known-state-divergence-is-decoherence.md`
  and the dirty-Reticulum "metered entropy IS the coordination readout" thread — the *reason* the
  entropy ledger matters: it is the coordination signal, and decoherence (clone divergence) is where
  von Neumann entropy (item 3 Q2) will eventually be forced.

---

## Item 1 — Quantum Persistent Log

**The tension to resolve first.** The handoff wants the log *append-only + order-preserving* AND it
wants CRDT-style merge (item 2) where operations *commute*. Order-preservation and commutativity are
in direct tension: if appends commute, the log has no order. **Resolution: order is DATA, not
operation order.** A log entry is a pair `(index, payload)`; `index` is encoded into the basis-state
key. Appends on distinct indices then commute freely (Z-set add is commutative — matches DBSP), yet
the *total order is recoverable* by reading the index field. This is the standard "the sequence
number carries the order, the transport need not" move (Lamport), lifted onto the register.

**gen(gen) IS the persistence** (per `only-the-irreducible-is-primitive` rule — the generator is the
ECC). The IR describes the log's structure; the generator reproduces entries; regenerating from the
irreducible IS the error-correction across replay. So the round-trip property is not incidental — it
is the persistence guarantee.

**Round-trip is provable by construction.** If `Encode` is declared `is Adj`, then `Decode :=
Adjoint Encode` and `Decode ∘ Encode = I` holds *at the type level* — Q# will not compile an `Adj`
operation whose adjoint is not its inverse on the unitary group. This is the cheapest possible proof:
the annotation is the theorem. Nothing to model-check.

### Routing table — item 1

| Property | Primary tool | Cross-check | Rationale |
|---|---|---|---|
| Append-only / index-monotone (a landed index never un-lands) | **TLA+** | — | Temporal safety invariant on a log; sibling of the shipped `TickMonotonicity` spec. TLC sweet spot. P1. |
| Order recoverable from index field | **TLA+** (same spec) | — | Structural invariant `∀ e1,e2: appended(e1) before appended(e2) ⇒ e1.index < e2.index`. |
| `Decode ∘ Encode = I` (round-trip) | **Q# `is Adj`** (type-level) | FsCheck over the F#/TS decoder | Reversibility BY CONSTRUCTION; FsCheck executes the *classical* decoder to catch an encoder that is `Adj` in Q# but mis-implemented in the shipped lane. |
| `gen(gen) = gen` (regeneration idempotence = the ECC fixpoint) | **FsCheck** | Lean (deferred) | Idempotence of the generator; cheap property, executes real code. Lean only if FsCheck finds drift the team can't triangulate. |

### Q# signature sketch — `QuantumPersistentLog.qs`

```qsharp
namespace Zeta.PersistentLog.Quantum {
    open Microsoft.Quantum.Intrinsic;

    /// Encode a log entry (index carries order; payload carries content) into the
    /// register. `is Adj` is the load-bearing annotation: Decode := Adjoint Encode,
    /// so Decode ∘ Encode = I holds at the type level (round-trip proven by construction).
    operation EncodeEntry(index : Qubit[], payload : Qubit[], target : Qubit[]) : Unit is Adj + Ctl {
        // controlled-emit at position `index`; body TBD by codegen (Alexa's lane).
    }

    /// Decode = the adjoint. NOT a separately-written inverse — the compiler guarantees inverse-ness.
    operation DecodeEntry(index : Qubit[], payload : Qubit[], target : Qubit[]) : Unit is Adj + Ctl {
        Adjoint EncodeEntry(index, payload, target);
    }

    /// Append is order-free ON THE OPERATION (distinct indices commute); order lives in `index`.
    operation Append(index : Qubit[], payload : Qubit[], log : Qubit[]) : Unit is Adj + Ctl {
        EncodeEntry(index, payload, log);
    }
}
```

---

## Item 2 — Quantum Transaction Ports — **the `Adj` vs `Ctl` correction**

The handoff maps "monotone-safe (CRDT merge, GSet join) = `is Adj` (reversible = safe)". I have to
reject this as stated. Two independent reasons:

**Reason A — idempotent joins are not reversible.** A CRDT/lattice join is idempotent: `a ∨ a = a`.
An idempotent function is not injective (it collapses `a` and `a∨b≥a`... more precisely it is not a
bijection on the lattice), therefore it has **no inverse**, therefore it **cannot be a unitary `Adj`
operation**. Unitaries are exactly the invertible norm-preserving maps. So the *most CALM-safe thing
there is* — an idempotent lattice merge — is precisely the thing that **fails** the `is Adj` test.
Mapping monotone → `Adj` inverts the truth.

**Reason B — the axes are orthogonal.** In the ZSetISA idiom two different dualities are already in
play, and the handoff conflates them:

- **`Adj` = the RETRACT axis.** `Emit`/`Retract` (`Ry`/`Adjoint Ry`) — "does this op have an
  additive inverse that cancels it?" This is the DBSP `+1 / −1` retraction (Budiu et al.), the
  emit/retract duality. Reversibility.
- **`Ctl` = the COORDINATION axis.** "Must this op be *controlled* on a coordination register (has
  every input arrived? is the tick closed? is there a global-order guard?) before it may fire?" An
  op you can apply **unconditionally** needs no control qubit → it is coordination-free.

**CALM lives on the `Ctl` axis, not the `Adj` axis.** The CALM theorem (Hellerstein; Ameloot,
Neven, Van den Bussche 2013): *a program has a coordination-free (eventually-consistent)
implementation iff it is monotone.* Translated to the port idiom:

> **CALM-monotone ⟺ expressible with NO control qubit** (fire unconditionally, commutes with
> everything, coordination-free). **Non-monotone ⟺ requires `is Ctl`** (the op must be *Controlled*
> on a coordination qubit — that control qubit **is** the coordination the CALM theorem says
> non-monotone programs cannot avoid).

So the corrected classification:

| Operation class | CALM | Port shape | Note |
|---|---|---|---|
| `Emit` / `Merge` / `Join`-as-fan-in (monotone: only adds information) | monotone → coordination-free | **no control qubit** (may still be declared `Adj+Ctl` for *composition*, but is *applied* unconditionally) | The `Ctl` capability being *available* ≠ a control qubit being *used*. Classification is on USE. |
| `Retract` / non-monotone aggregate / "wait for all inputs" barrier | non-monotone → needs coordination | **`is Ctl` control qubit USED** on a coordination register | The control qubit is the metered coordination door (§13). |

**The idempotence impedance mismatch — name it, don't hide it (dual-use / honest-register).** Even
with the axis fixed, a CRDT join's **idempotence** (`a∨a=a`) is still not a unitary property.
Unitaries are never idempotent except involutions (`H²=I`, `X²=I`) and identity. So the quantum port
can faithfully model **commutativity and associativity** of the CRDT (order-independence = the
unitaries commute — provable at the unitary level) but **cannot** model **idempotence** at the
unitary level. Idempotence re-enters only through **measurement / normalization** — a non-unitary,
sim-only step (exactly as `ZSetISA.qs` already notes: "Born collapse = sim-only. Live = soft"). This
must be stated in the port doc or a reviewer will later "prove idempotence" and it will be a
`Statement`-class verification drift.

### Routing table — item 2

| Property | Primary tool | Cross-check | Rationale |
|---|---|---|---|
| Confluence: port ops commute regardless of order | **Q# unitary commutation** (`U_a U_b = U_b U_a`, verified by circuit-equivalence) | **Z3** (QF over the 2×2/4×4 gate matrices — commutator = 0) | Order-independence is THE CALM confluence claim; Z3 discharges the matrix identity independently of the sim. P0-adjacent (confluence is the correctness core) → BP-16 two-tool. |
| CALM classification (control-qubit-used ⟺ non-monotone) | **Type-level (Q# signature audit)** — the presence/absence of a *used* control qubit IS the classification | — | The signature is the proof. A lint that flags a monotone op declared with a used control qubit (over-coordination) or a non-monotone op with none (under-coordination). |
| Associativity of merge | **FsCheck** over shipped `GCounter.Merge` / `Divvy.merge` | — | Reuses the existing cross-verify harness (see the safety-floor arc: associativity is the `081KT07…YDB73K` class — commutative+idempotent but non-associative passes weaker tests yet diverges on reorder). |
| Idempotence | **NOT provable as unitary — sim-only via measurement** | — | Honesty row. Named, not claimed. |

### Q# signature sketch — `QuantumTransactionPorts.qs`

```qsharp
namespace Zeta.TransactionPorts.Quantum {
    open Microsoft.Quantum.Intrinsic;

    /// MONOTONE port (CALM-safe, coordination-free): fires UNCONDITIONALLY.
    /// `Adj+Ctl` is declared for composability, but NO control qubit is USED here —
    /// that "no used control" IS the coordination-free classification.
    operation MonotoneMergePort(sourceA : Qubit[] => Unit is Adj + Ctl,
                                sourceB : Qubit[] => Unit is Adj + Ctl,
                                target  : Qubit[]) : Unit is Adj + Ctl {
        sourceA(target);   // commutes with sourceB (confluence — the provable claim)
        sourceB(target);   // idempotence is NOT modelled here (re-enters at measurement only)
    }

    /// NON-MONOTONE port (needs coordination): the op is CONTROLLED on `coord`.
    /// The USED control qubit is the metered coordination door the CALM theorem forces.
    operation CoordinatedPort(coord : Qubit, op : Qubit[] => Unit is Adj + Ctl,
                              target : Qubit[]) : Unit is Adj + Ctl {
        Controlled op([coord], target);   // fires only when coordination register admits it
    }
}
```

---

## Item 3 — Maxwell's Demon — **two ledgers**, and Landauer as a cost contract

The handoff's model — "`branch` = +1 bit, `measure` = −1 bit, track `{introduced, consumed, net}`" —
is the right instinct but under-counts. **A single ledger cannot satisfy the second law.** The demon
is a bookkeeper of a *conserved* quantity, so it needs two columns that sum to a non-negative net.

### The two ledgers (this is the core contribution)

- **Ledger A — state entropy `S_state`** (bits of uncertainty *in the register*). Measured by
  `support` exactly as the Rust sim / CHIP-8 `AmplitudeEmu` already do. `branch`: **+1**. A k-bit
  `measure` (collapse): **−k**. This is the handoff's ledger.
- **Ledger B — environment heat `S_env`** (bits dissipated to the surroundings; Landauer). Reversible
  ops (`Emit`, `Retract`, `Join`, all `is Adj`): **0** (Bennett — reversible computation dissipates
  no heat). `measure`/erase of k bits: **+k** (Landauer — erasing a bit *must* dump ≥ kT ln2 of heat).

**Conservation (the invariant the demon enforces):**

```
ΔS_state + ΔS_env ≥ 0          (second law)
   = 0   for every reversible (is Adj) op            (Bennett)
   ≥ 0   for measure/erase                            (Landauer, with equality only in the
                                                        quasi-static reversible-erasure limit)
```

So `net_entropy` per op is **not** `introduced − consumed` of one column — it is `ΔS_state +
ΔS_env`, and the demon's *correctness property* is that this net is **≥ 0 on every op and = 0 on
every `Adj` op**. That invariant is what makes "you cannot get free work from information" hold in the
code. The bits a `measure` removes from Ledger A do not vanish — they are *paid for* into Ledger B.
That is the whole point of Maxwell's demon: the demon's measurement is not free; Landauer is the
bill.

Per-op record (extends CHIP-8's `{support_before, support_after, delta_support}`):

```
{ dS_state,        // Ledger A delta (support-based; +1 branch, −k measure)
  dS_env,          // Ledger B delta (Landauer heat in bits; 0 for Adj, +k for erase)
  net = dS_state + dS_env,   // ≥ 0 always; = 0 iff the op is is-Adj (reversible)
  heat_joules = dS_env * kT_ln2 }   // unit conversion at the EDGE only (see Q1)
```

### Answering the handoff's four questions — with routing

**Q1 — Can Landauer's bound (kT ln2 per erased bit) be a cost contract?** **Yes**, and it is the
*same shape as the existing `cost-counter.ts` contract, flipped to a lower bound.* The counter's
obligation is `witness ≤ contract` (an upper bound on ops). Landauer's obligation is `heat_witness ≥
kT ln2 × bits_erased` (a **lower** bound on dissipation). Same interface/contract/witness triple, one
inequality reversed. Concretely: the contract is `minHeat(bits) = bits` (in bit-units); the witness
is the metered `dS_env`; the obligation is `witness ≥ contract`. **kT ln2 is a unit conversion — do
the bookkeeping in BITS (dimensionless, exact, DST-replayable), and multiply by kT ln2 only at the
display edge**, exactly as the culture/UoM rule demands (get the bytes right first; the
Mars-Climate-Orbiter lesson). Storing joules internally would inject a floating physical constant
into the proof lineage; storing bits keeps it integer and byte-lockable.

**Q2 — Counting bits, or von Neumann entropy (density matrix)?** **Start with counting; escalate to
von Neumann exactly when decoherence enters — and it will.** Precise statement:

- The sparse sim holds a **pure statevector** → its full-system von Neumann entropy `S(ρ) =
  −Tr(ρ log ρ)` is **identically 0** (pure states have zero von Neumann entropy). So von Neumann of
  the *whole* state buys nothing here.
- The operationally-relevant entropy for `branch`/`measure` accounting is the **Shannon entropy of
  the Born distribution** `H = −Σ |αᵢ|² log₂|αᵢ|²`. For a *uniform* superposition (what `branch`
  produces) this equals `log₂(support)`, and each `branch` adds exactly 1 bit — so **counting = the
  handoff's model = Shannon-of-Born for uniform branches.** For non-uniform amplitudes, count the
  Shannon-of-Born, not the raw support (a near-zero amplitude is < 1 bit of real uncertainty). This
  is a *strict refinement* of "count support," free to compute from the amplitudes already in state.
- **Von Neumann becomes necessary the moment we model a MIXED state** — i.e. entanglement entropy
  across a cut (von Neumann of the *reduced* density matrix after partial trace) or genuine
  decoherence. The repo is already walking toward this: the self-cloning / "divergence is
  decoherence" and dirty-Reticulum "linked clones as metered channels" threads (2026-07-02) are
  exactly the mixed-state regime. **Route: Shannon-of-Born now; open a tracked follow-up for
  reduced-density von Neumann entropy keyed to the clone/decoherence lane.** Do not build the density
  matrix today — it is O(support²) and unneeded for a pure sim.

**Q3 — Composition with the tropical semiring cost model?** **Clean fit — entropy is a
tropical-graded quantity.** Entropy in bits is additive over independent subsystems (`S(A⊗B) = S(A) +
S(B)` for product states) → it is a monoid under `+`. In the tropical/cost semiring `(ℝ≥0 ∪ {∞}, min,
+)`: the multiplicative operation `⊗ = +` accumulates cost along a path; the additive operation `⊕ =
min` selects the cheapest path. **Entropy-bits sit in the SAME additive structure as tropical `⊗ =
+`** — accumulation of entropy along a computation is tropical multiplication. Landauer heat is a
non-negative additive cost → it lives natively in the carrier `ℝ≥0 ∪ {∞}`; a reversible op contributes
`0` = the tropical multiplicative identity (Bennett again, now as an algebraic fact); an impossible
op is `∞`. So the demon's Ledger B *is* a tropical cost accumulator, and "the minimum-heat
realization of a computation" is a tropical shortest-path (`⊕ = min`) — the same shape as the cost
recurrences in `src/Core.Lean4/Lean4/CostRecurrence.lean`. The handoff's parenthetical ("entropy is
additive → fits") is right; this is *why*.

**Q4 — Extend `SparseQuantumSim`, or a separate injected effect?** **Separate injected effect —
unambiguously, on §13 grounds.** Bolting a mutable entropy counter onto the sim would be an **ambient
entropy leak**: it makes influence enter through an undeclared door, breaks DST replay (mutable state
to reflect over), and violates noninterference. The correct shape is the **counted-decorator pattern
the repo already ships** (`createCountedRing` in `cost-counter.ts`): wrap the sim's op interface, meter
each op at the membrane, post to the ledger. The sim stays pure and permutation-exact; the entropy
ledger is a metered door threaded through the computation. **This also honors the handoff's own final
discipline bullet** ("injected effect, not ambient mutable"). Bonus: the decorator is trivially
DST-replayable and the ledger is the deterministic witness.

### Routing table — item 3

| Property | Primary tool | Cross-check | Rationale |
|---|---|---|---|
| `net = dS_state + dS_env ≥ 0` on every op (second law) | **FsCheck** invariant over the injected entropy-counter | TLA+ (ledger-monotone: `S_env` never decreases) | P0-adjacent (a violation = perpetual-motion bug). Two tools per BP-16. FsCheck executes the real decorator; TLA+ guards the temporal monotonicity of the heat column. |
| `net = 0` iff the op is `is Adj` (Bennett) | **FsCheck** (partition ops by adjointness, assert net) | Q# `is Adj` audit (the annotation IS the reversibility fact) | Ties the ledger to the type-level reversibility already declared in ZSetISA.qs. |
| Landauer lower bound `heat_witness ≥ kT ln2 × bits_erased` | **Extend cost-counter contract** (witness ≥ contract, in BITS) | Lean (deferred) | Same contract/witness machinery as the shipped cost-counter; Lean only if we want the bound as a discharged theorem (P3 escalation). |
| Shannon-of-Born = bits (`branch` +1, uniform) | **F# / Rust unit tests** on the sim | — | Refines `support` to Shannon-of-Born; matches CHIP-8 `delta_support`. P1. |
| von Neumann (reduced-density) entropy | **DEFERRED** — tracked follow-up, keyed to clone/decoherence lane | — | Not needed for the pure sim; needed when mixed states / partial trace enter. Named, not built. |

---

## Consolidated tool assignment (portfolio view)

| Item | Claim | Tool | Effort | P |
|---|---|---|---|---|
| 1 | Append-only / index-monotone | TLA+ (new spec, TickMonotonicity sibling) | M | P1 |
| 1 | Round-trip `Decode∘Encode=I` | Q# `is Adj` (type-level) + FsCheck | S | P1 |
| 1 | `gen(gen)=gen` | FsCheck | S | P2 |
| 2 | Confluence (ops commute) | Q# commutation + Z3 matrix commutator | M | P0-adj |
| 2 | CALM classification | Q# signature audit / lint | S | P1 |
| 2 | Idempotence | *named sim-only; NOT a unitary claim* | — | honesty |
| 3 | `net ≥ 0`, `net=0 iff Adj` | FsCheck + TLA+ | M | P0-adj |
| 3 | Landauer lower bound | extend cost-counter (bits) | S | P2 |
| 3 | Shannon-of-Born = bits | F#/Rust unit tests | S | P1 |
| 3 | von Neumann (mixed) | deferred, tracked | — | P3 |

**Anti-TLA+-hammer check** (my standing guard): none of these is a TLA+ job that should be Z3/FsCheck
in disguise. TLA+ is used only for the two genuine temporal-safety invariants (log append-only; heat
monotone). Confluence is a matrix identity → Z3. Round-trip is type-level → Q#. Everything
execution-shaped → FsCheck. No two-trace property is stuffed into a TLC state space.

**BP-16 (two independent tools on P0-adjacent claims)** is honored on both P0-adjacent rows:
confluence (Q# + Z3), and the second-law net-entropy invariant (FsCheck + TLA+).

## Discipline / provenance

- Every substrate figure above (`support` semantics, `is Adj + Ctl` annotations, cost-counter
  contract shape) was verified by **reading the file**, not assumed — verify-before-record.
- Lean is **deferred** on all three items per the handoff, and I concur: none of the three has a
  P0 arithmetic identity that single-tool evidence leaves exposed *today*. The Landauer bound is the
  one Lean escalation candidate (a genuine physical lower bound), and it waits until there is a
  consumer for the discharged theorem.
- **Two corrections to the handoff are load-bearing** and I am on record for them: (item 2) CALM maps
  to `Ctl`, not `Adj`, and idempotent joins are non-reversible; (item 3) the demon needs two ledgers,
  and `net_entropy` is a conserved sum, not a single column. If Alexa or Otto reads these differently,
  that is the Grok-critiques / Amara-sharpens step — push back.

Next actor: codegen (Alexa's lane) fills the Q# operation bodies; I file the TLA+/Z3/FsCheck specs as
the four-oracle gate work when the bodies land. The two `.qs` signature skeletons are created alongside
this note as the interface contract.
