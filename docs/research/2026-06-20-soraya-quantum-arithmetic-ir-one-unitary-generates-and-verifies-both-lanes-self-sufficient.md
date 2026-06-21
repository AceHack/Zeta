# Quantum-arithmetic IR over a register: ONE unitary that GENERATES and VERIFIES (both lanes self-sufficient)

*Soraya (formal-verification-expert), invoked by Otto as a peer. 2026-06-20.
Branch `alexa/phase-f-qsharp`. Companion sketch:
`src/Core.QSharp.ReferenceOracle/QuantumArithmeticMix.qs.sketch`.*

> Role distribution (four-ferry consensus): Gemini proposes, Grok critiques,
> Amara sharpens, Otto tests, Git decides. This note is my critique +
> sharpening, reasoned from my own understanding.
>
> **Revision (2026-06-20, same day).** Aaron corrected the first cut of this
> note, which concluded "verifier, NOT a faster oracle." That either/or was the
> error — not the physics. The goal is **not speed**: it is **complete lane
> independence** — the quantum lane must be able to *generate* (not just verify)
> without ever touching classical, and vice versa, with full representability in
> both directions. So both framings are correct: the lift **generates** (slowly,
> who cares) AND **verifies** (efficiently). This revision integrates that. The
> Holevo analysis stands as physics; its earlier *conclusion* is retracted (§4).

## 0. What is actually on main

`mix` is the **MurmurHash3 `fmix64` finalizer** (`tests/cross-verification/fmix64/`),
emitted classically by `emitQSharp` (#8811, `32be7d044`) as `Int` with `&&& MASK`:

```
z ^= z >> 33          # xorshr  s=33
z *= 0xff51afd7ed558ccd   # mul    (odd)
z ^= z >> 33          # xorshr
z *= 0xc4ceb9fe1a85ec53   # mul    (odd)
z ^= z >> 33          # xorshr
```

all mod 2⁶⁴. The classical Q# runs on a classical simulator — no qubits. Aaron's
next tier: run the **same IR ops** on a **qubit register**, so the quantum lane
is a self-sufficient generator+verifier of the same vectors, independent of the
classical lane.

## 1. The lift is real

Every step of `fmix64` is a **bijection on ℤ/2⁶⁴**, so `mix` is a **permutation**,
so it lifts to a unitary `U_mix |z⟩ = |mix(z)⟩` in place, and by linearity
`U_mix ( N^(-1/2) Σ_z |z⟩ ) = N^(-1/2) Σ_z |mix(z)⟩`. The two ops lift cleanly:

- **`xorshr` → CNOT cascade, in-place, ancilla-free, EXACT.** `z ↦ z ⊕ (z≫s)` is
  GF(2)-linear: bit `i` of `z≫s` is bit `i+s` of `z`, so `new z_i = z_i ⊕ z_{i+s}`.
  The map is `M = I + Sˢ` (`S` = down-shift, nilpotent `Sⁿ=0`), invertible over
  GF(2). Realise it as `CNOT(z_{i+s} → z_i)` for `i = 0…n−1−s`, processed
  **low-to-high** so every source `i+s` is still unmodified when read. `n−s` CNOTs,
  no ancilla, **byte-exact** — no tier drop.

- **`mul` by odd constant → in-place modular multiplier (Draper/Beauregard).** `C`
  odd ⇒ unit in `(ℤ/2ⁿ)ˣ` ⇒ bijection. Not GF(2)-linear (carries), so: out-of-place
  multiply into an n-qubit ancilla via controlled modular adders in the Fourier
  basis, controlled-SWAP, then uncompute the input by multiplying by `C⁻¹ mod 2ⁿ`
  (exists *because* `C` is odd). One clean ancilla register. **This is where the
  conformance tier genuinely drops** (see §6).

## 2. The decisive refinement: ONE unitary, TWO input regimes

The first cut treated "generate" and "verify" as rival uses of the lift. They are
not rivals — they are the **same circuit `U_mix` fed two different input states**:

| | Input state | Run | Read out | What you get |
|---|---|---|---|---|
| **Generator** | basis state `|z⟩` | `U_mix` | measure | `mix(z)` w.p. **1** — deterministic, exact, no superposition, never touches classical |
| **Verifier** | uniform superposition `N^{-1/2} Σ|z⟩` | `U_mix` | Simon / Deutsch–Jozsa | one global structural certificate over all `N` inputs at once |

Feed `U_mix` a **point** → it generates. Feed it the **whole space** → it certifies.
That is the generation/error-correction duality made literal at the input-state
level (`only-the-irreducible-is-primitive` — the generator IS the ECC;
`gen(gen)==gen` is both). The quantum lane is therefore fully self-sufficient in
**both** directions from one operator: it produces output (generator path) and
checks global structure (verifier path) with no classical dependency.

The generator path is the answer to "can quantum stand alone?": yes — `|z⟩ → U_mix
→ measure` returns `mix(z)` with certainty, classical-free. It is *slower* than the
`Int`-masking emitter (ancilla, modular-mult depth, decoherence). Per Aaron: **who
cares** — speed is not the goal, independence is. A correct slow generator is a
generator.

## 3. The sketch's old sampler was the worst-of-both path

`SampleOneMixPair` (first cut) did `ApplyToEach(H)` then **one** measurement. That
is neither path: it returns a *uniformly random* `z` (so it is not a usable
generator — you cannot ask it for `mix(z)` of a chosen `z`) and it extracts *no*
structure (so it is not a verifier). It is exactly the "try to be a bulk oracle"
move that Holevo kills (§4). Fixed in the sketch: a deterministic `GenerateMixOf(z)`
generator (basis-state in, `mix(z)` out) plus a superposition-input op reserved for
the Simon/DJ verifier.

## 4. Holevo, correctly scoped (the retraction)

Holevo (1973): an `n`-qubit measurement yields ≤ `n` classical bits. This bounds
**one thing only — the throughput of reading the golden-vector TABLE out of a
superposition**. Measuring `N^{-1/2} Σ_z |z⟩|mix(z)⟩` gives **one** random pair, so
you cannot harvest the whole table faster than `N` classical evals.

What Holevo does **not** bound, and what the first cut wrongly inferred it did:

- It does **not** say the quantum lane cannot generate. The generator path feeds a
  *basis* state, extracts `n` bits from `n` qubits — Holevo **saturated, not
  violated** — and returns `mix(z)` deterministically.
- It does **not** make the lift "not a generator." It makes it a *non-faster bulk*
  generator. Different claim. Speed ≠ capability.

So the honest scope: Holevo forbids "all golden vectors in one measurement," and
nothing more. Generation (per-shot, exact) and verification (global, `O(n)`) both
live entirely outside its reach.

## 5. The ZSet bridge — faithful on the group, lossy on the ring

`ZSetISA.qs` fixes the repo's encoding: `Branch = H`, **weight → phase**
(`Emit = Rz(θ)`, `Retract = Rz(−θ)`), `Join = CNOT`, `JoinWeighted = Ctl Rz`. So
`mul`/`xorshr` **are** Z-set operators when keys are in superposition:

- A uniform `Branch` over the key register = the indicator Z-set `Σ_k 1·[k]`.
- `U_mix` permutes the key basis ⇒ it is the Z-set **rekey / map** operator.

But the homomorphism is a **functor on the group structure, lossy on the ring
structure**:

- Z-set weights live in **ℤ** (add, negate = retract, *and* multiplicity `|w|>1`).
- `ℤ → U(1)` via `w ↦ e^{iθw}` is a group homomorphism: merge (add weights) ↔ phase
  compose (`Rz(θ)∘Rz(θ)=Rz(2θ)`) — **faithful**.
- Not injective: periodic (aliases `w` and `w + 2π/θ`), discards magnitude. Z-set
  **multiplicity** does **not** survive into a single phase.

Verdict: the ZSet→Q# map is a **faithful representation of the additive-group /
key-permutation structure** and a **lossy one of the ring/multiplicity structure**.
Build on the former; do not claim the latter.

## 6. Verification routing (my actual deliverable)

The corrected framing costs **zero new tools** for the generator path — generator
correctness reduces to the per-basis-state circuit-equivalence obligations the
verifier path already needs. One genuinely new row: the **cross-lane equivalence**
that makes Aaron's "pick the better lane at runtime" *sound*.

| Claim | Serves | Primary tool | Cross-check | Why |
|---|---|---|---|---|
| `XorShr` CNOT cascade ≡ classical `z ⊕ (z≫s)` | generator + verifier | **Z3 QF_BV** (extend #8805 / `3d79f12db` denotation proofs) | — | Exact bit-vector functions; SMT discharges equality over all 2⁶⁴ with no enumeration. **Keep at byte-lock — it is free.** |
| `MulByOddConstantMod2n` circuit ≡ `C·z mod 2ⁿ` | generator + verifier | **bounded exhaustive simulation** at small `n` (e.g. 8) + cite the QDK primitive's own correctness lemma | Lean lemma on the adder if we self-host it | Full n=64 sim is 2⁶⁴-dim — infeasible. **Behavioral-equivalence tier** (matches #8811's stated Q# tier). NOT a TLA+ job (no concurrency). |
| `measure(U_mix|z⟩) = mix(z)` w.p. 1 (**generator-path correctness**) | generator | `⊢` from the two rows above + Born rule on a basis state | — | Deterministic generation reduces to per-basis-state equivalence; no new machinery, just the composition lemma. |
| `measure(U_mix|z⟩) == classicalMix(z)` ∀z (**cross-lane equivalence**) | runtime substitution | FsCheck over the **shared hex-in-JSON golden table** (both lanes checked against one oracle) | — | This is what makes "pick the better lane / inject a better version at runtime" *sound* — the two lanes are provably interchangeable on every vector. `no-binary-in-proof-lineage`: golden table stays text. **NEW.** |
| `U_mix` is a permutation (generator hits **every** vector; bijectivity) | generator (surjectivity) + verifier | `⊢` from unitarity + basis-preservation; Lean lemma `(I+Sˢ)` invertible ∧ odd-unit | — | Structural; no model-checking. |
| QDK modular-multiply API symbol | both | **read the pinned QDK**, record in registry | — | Name-class drift trap (NOTEBOOK r35). Do not assert from memory (SEAM #1). |
| `mix` has no Simon XOR-period (**verifier-path bonus**) | verifier | classical FsCheck linear-cryptanalysis probe **now**; quantum Simon aspirational | — | Honest tiering: don't claim a quantum advantage we can't run on hardware/sim yet. Simon certifies the odd-multiply layers destroy the GF(2)-linear structure of the xorshr layers. |

**Tier asymmetry:** keep `xorshr` **byte-exact** (Z3-proven CNOT ≡ shift-xor — free);
accept **behavioral-equivalence** only for `mul`; document the asymmetry rather than
letting the whole circuit silently inherit the weaker tier. BP-16 (two independent
tools on a P0) relaxes here because the Q# target is declared behavioral-equiv, not
byte-lock — but `xorshr` should not coast on that relaxation when an exact proof is
one Z3 lemma away.

## 7. Anchors (Beacon)

- **fmix64 / finalizer reversibility** — Austin Appleby, MurmurHash3 (the "unmix"
  inverse is a documented known result).
- **Quantum modular arithmetic** — Draper (*Addition on a Quantum Computer*,
  arXiv:quant-ph/0008033); Beauregard (*Circuit for Shor's algorithm using 2n+3
  qubits*, arXiv:quant-ph/0205095) — the in-place modular multiplier.
- **Extraction limit (scope, not veto)** — Holevo (1973), accessible-information bound.
- **Structural distinguishers** — Deutsch–Jozsa (1992); Simon (1994, hidden XOR
  subgroup) — "verify global structure in `O(n)` queries."
- **Generate/verify duality** — `only-the-irreducible-is-primitive-generate-the-rest`
  (the generator IS the ECC); `interfaces-free-classes-earned`.

## 8. One-line verdict

ONE unitary `U_mix`, two input regimes: fed a **basis state** it is a **complete,
exact, classical-free generator** (slower than the `Int` emitter — and that is fine,
speed is not the goal); fed a **superposition** it is an **`O(n)` structural
verifier** (balancedness, no-hidden-period). Holevo bounds only bulk-table readout,
not generation or certification. Route `xorshr` to Z3 at byte-lock, `mul` to
bounded-sim at behavioral-equiv, add the **cross-lane equivalence** row (FsCheck vs
the shared golden table) so the two lanes are provably interchangeable at runtime,
and treat the ZSet bridge as a faithful **group** functor, lossy on multiplicity.
Ship both.
