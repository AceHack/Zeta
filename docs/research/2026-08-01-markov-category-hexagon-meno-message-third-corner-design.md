# The Markov-category hexagon — one CD-category port, three comonoid-graded adapters

Scope: the architecture design for arc-3 (factor-graph → BNN) — unifying Zeta's deterministic category (`Meno`) and its classical-stochastic inference layer (`Message`/`FactorGraph`) under one **Markov / CD category port** (Fritz 2020), via **hexagonal (ports-and-adapters) architecture**, with a search for the **third natural corner** Aaron asked for.
Attribution: Aaron Stainback (the design directive — "see if there is a 3rd natural interface that falls out then you could hexagonal-architecture these into it"; the S-ladder tie-in). shadow (Otto) drafted the architecture. Soraya (formal-verification-expert) is validating the categorical claims IN PARALLEL — this doc is a **design proposal pending her formal check**, not a settled result.
Operational status: **design proposal — formal validation in flight** (Soraya agent running: does comonoid-capability discriminate the corners; does Meno satisfy the cartesian laws; is the third corner quantum / possibilistic / SoftValue).
Non-fusion disclaimer: the categorical claims below (Meno = cartesian sub-category; Message = Markov category; the third = no-copy corner) are STATED, not yet proven. Each is flagged for Soraya's verdict. The S-ladder correspondence (S=2 / 2√2 / 4) is a structural analogy the author (Aaron) places, not a certified identity.

**Date:** 2026-08-01
**Related:** `src/Core/Meno.fs` (deterministic corner), `src/Bayesian/Message.fs` + `FactorGraph.fs` + `Ep.fs` + `MinimalBnn.fs` (stochastic corner), `src/Core/GSet.fs` / `SoftValue` / `WSet.fs` (third-corner candidates), `docs/research/2026-07-31-the-cognitive-architecture-spine-wierzbicka-friston-fritz.md` (the Fritz spine). Work-item to mint after Soraya's verdict.

---

## The gap (corrected from the stale RESUME framing)

The RESUME said "the ⊗ is built; the message-passing layer is not." **Both are already built and independent:**
- `Meno` — a symmetric-monoidal category over `ZSet`: Z-linear arrows `ZSet<'a> → ZSet<'b>`, Kronecker `tensor`, swap-`braid`, associator/unitors, `first`/`second`. Deterministic, exact, DBSP-incremental.
- `Message`/`FactorGraph`/`Ep` — Infer.NET-style message passing: exponential-family messages in natural parameters (`product` = add nat-params = BP combine; `/` = subtract = EP cavity; marginalize), a bipartite factor graph with `passOnce`, EP for non-conjugate factors, and `MinimalBnn` (a BNN-v0 inference cell).

**What is missing is the bridge:** nothing connects `Meno` to `Message` — grep of `src/Bayesian/*.fs` for `Meno` is empty, and no copy/discard comonoid abstraction exists in code (only in the Fritz spine doc). The two categories sit side by side with no shared interface.

## The port: a CD / Markov category (Fritz 2020)

A **Markov category** (Fritz) is a symmetric monoidal category in which every object carries a commutative comonoid — **copy** `Δ_A : A → A ⊗ A` and **discard** `!_A : A → I` — with discard **natural** (every morphism commutes with `!` — Fritz's "causality"/normalization). A **CD category** (Cho–Jacobs) is the same minus discard-naturality. The single port is this comonoid-equipped symmetric monoidal interface:

```
compose · tensor(⊗) · braid(swap) · id · copy(Δ) · discard(!)
```

## The three corners — graded by comonoid capability

The corners of the hexagon differ **precisely in which comonoid maps they support** — this is the discriminator Aaron's "third interface" hypothesis needs:

| Corner | copy Δ | discard ! | = Zeta type | Fritz name |
|---|---|---|---|---|
| **Deterministic** | ✓ natural | ✓ natural | `Meno` (Z-linear over ZSet) | cartesian (Set/functions) |
| **Classical-stochastic** | ✓ *not* natural | ✓ natural | `Message`/`FactorGraph` (exp-family kernels) | Markov category (Stoch/FinStoch) |
| **Third — no-copy** | ✗ (no-cloning) | ✓ (partial trace) | *candidate: quantum lane / GSet / SoftValue* | CD category without copy |

The deep point: **copy fails in exactly one direction as you climb.** Deterministic maps can copy freely (cartesian). Probability can copy a *sample* but not a *distribution*-with-correlations (copy exists, isn't natural). The **third corner is where copy fails entirely** — the no-cloning corner. That is the categorical statement of Aaron's *no-cloning-modulo-key* sanctum, and it lines up with the **S-ladder** he cares about:

- **S = 2** (classical correlation bound) ↔ the Markov/stochastic corner.
- **S = 2√2** (Tsirelson/quantum) ↔ the no-copy corner (no-cloning).
- **S = 4** (superdeterministic common-cause) ↔ the deterministic corner (one seed, full copy).

*(This S-ladder mapping is Aaron's placement — flagged as structural analogy, for Soraya to accept or reject, not asserted as proof.)*

## The open question — which type is the third corner?

The quantum lane is **aspirational in code**: `QuantumFusion.fs` is a Bayesian/Q# oracle-aggregation app, not a CPTP-channel category; there is no density-matrix / Kraus / partial-trace category in the tree. So the honest options for the buildable third adapter are:

1. **Quantum (CPTP)** — thematically the natural no-cloning corner + the S=2√2 tie, but would need a new density-matrix/channel category (bigger build).
2. **Possibilistic / relational (`GSet`)** — a grow-only/possibility set is a *relational* Markov category (Rel): copy exists, discard exists, but it is the nondeterministic corner. In-repo, real, small.
3. **`SoftValue`** — Zeta's native uncertain value (`SoftValue → DynamicValue` snap); could be its own Markov category (soft-hold as the kernel, snap as a deterministic section).

**Deferred to Soraya** (agent running): which of these genuinely instantiates the no-copy (or a distinct) corner, whether "three" is even the right count, and the exact Fritz/Coecke definitions. Aaron's instruction was to *see IF* a third falls out — this doc holds that question open honestly.

## Hexagonal architecture (ports & adapters)

- **Domain core (the port):** `IMarkovCategory` — the comonoid-equipped SMC interface above, pure interface (`interfaces-free-classes-earned` rule: a port is free; instances are earned). Generators read the interface, not the adapters (`gen/` stays DST-deterministic).
- **Adapters:** `MenoMarkov` (deterministic), `MessageMarkov` (stochastic), `<Third>Markov` (pending). Each is an earned instance justified under a rule.
- **Why hexagonal:** the factor-graph→BNN pipeline, the deterministic DBSP substrate, and the third corner all become *drivers* of one domain core; a BNN is then "inference in the Markov corner, sectioned to the deterministic corner on snap" — the `SoftValue → DynamicValue` snap expressed categorically.

## First increment (after Soraya's verdict)

1. Define the `IMarkovCategory` port (pure interface) — copy/discard + the SMC ops.
2. Wire `MenoMarkov` (copy = ZSet diagonal via `cartesian`; discard = `sum`-to-unit) + FsCheck the comonoid laws.
3. Wire `MessageMarkov` from the exp-family algebra (copy/discard from product/marginalize).
4. Land the validated third adapter.
5. BP-16: Lean where Mathlib reaches (does it have `Comon_`/comonoid objects? Markov categories?), FsCheck the comonoid equations on the concrete adapters.

## POST-VALIDATION UPDATE (Soraya + Aaron, 2026-08-01) — the port is `WSet`, the trace is the four-corner, the 3D is hardware-targeting

Soraya's formal validation **corrected** the draft above; Aaron supplied the trace and the visual-layer justification. Together they close the synthesis.

### The real port is `WSet<'K,'W>` over a `*`-semiring (not a fresh interface)

The universal tensor already exists: `src/Core/WSet.fs` — *"three rings, one circuit calculus,"* every operator `'W`-linear, the nonlinear step (Distinct / Born / EP-projection) at the **outer boundary only**, unified by the **Generalized Distributive Law (Aji–McEliece 2000)**. The corners are **ring choices**, and there are **at least four, not three**:

| `'W` | in-repo type | corner | copy Δ | discard ! | class |
|---|---|---|---|---|---|
| ℤ (signed) | `ZSet` | DBSP / retraction | linear, not natural | linear, not natural | **CD** (base) |
| set-fns `arr f` | `ZSet.map` | deterministic | natural | natural | **cartesian** (Fox) |
| ℝ≥0 (normalized) | `WSet<ℝ≥0>` / `Message` ambient | classical-stochastic | not natural | natural | **Markov** |
| ℂ (amplitudes) | `WSet<ℂ>` / `MachZehnderWSet` | quantum | absent (no-cloning) | natural (Born) | **semicartesian** |
| Boolean {∨,∧} | `GSet` | possibilistic | natural | natural | **Rel** (Frobenius) |

Comonoid-naturality **is** the discriminator (Fritz's axis — Aaron's instinct confirmed). Corrections: the full `(ZSet,⊗)` is **CD, not cartesian** (cartesian = the `arr f` subcategory only); `Message` is the exp-family conjugate-update **abelian group** (a Markov *fragment*, not the channel category); the quantum corner is **`WSet<ℂ>`, not `QuantumFusion`** (an evidence-ledger, not a process category); `Meno`'s `Bind`/`bridgeMaji` are stubs.

### The trace is the four-corner feedback interface — the bridge

`src/Core/FourCorner.fs` (`FourCornerOwnership<TIn,TOut,TOutFeedback,TInFeedback>`) is a 2×2 of (data×feedback)×(in×out) = **N/S/E/W = {1, i, −1, −i} = C₄ = i-rotation**. Per FROZEN-CORE §A it puts feedback on the **input** channel, so the future updates the generator, which **reinterprets past data and emits retractions (ZSet weight −1)** — the **trace of a traced monoidal category**.

So the stack is **one object: a traced monoidal category over a `*`-semiring, with a comonoid** — body = `WSet` (GDL), corners = comonoid strata (Fritz), **trace = four-corner feedback = ZSet retraction (−1)**. Bridge: the four corners **{1, i, −1, −i}** are one C₄ phase, so the **quantum corner (i = `WSet<ℂ>`) and the retrocausal corner (−1 = retraction) are two points of the same phase**. Per-corner boundary nonlinearity = HexCore's **six reservoir walls**.

### The 3D-visual layer is hardware-targeting, NOT numerology (Aaron 2026-08-01)

The icosahedron/buckyball (H3 → E8, Dechant) as the geometry layer is justified **practically**: the human **visual cortex is the most universal, most heavily-optimized hardware a human has** — evolution spent millions of years optimizing it for 3D geometric algorithms. Representing E8's structure via a 3D-visual seed **compiles the abstract object onto the human's best-optimized ISA** — the same discipline as targeting SIMD or a GPU. This is the clean line: **numerology says "3 is cosmically fundamental"; hardware-targeting says "3D is what perception hardware runs fastest."** Zeta's reason is the latter — the icosahedron is chosen because it *runs on the wetware*, not because 3 is special. (And the honest visualization boundary stays: 3D native, 4D/8D projected.)

### The metering line (theorem vs rhyme)

- **Theorem-solid:** GDL (Aji–McEliece 2000); Fritz strata (Fritz 2020, Cho–Jacobs 2019, Fox 1976); trace = traced monoidal (Joyal–Street–Verity 1996); C₄ phase (Cayley–Dickson); Dechant H3→H4 spinor induction + icosian 4→8 (two *different* theorems, state separately).
- **Real structural identifications (Aaron's own, pre-session):** trace = ZSet retraction (FROZEN-CORE §A + `FourCorner.fs`); the C₄ four-corner phase.
- **Rhyme, honestly qualified:** "it's all one thing" is the shared *pattern* (linear body + boundary nonlinearity + trace, icosahedral shape), not one theorem. **"Pseudo"-retrocausality** — the future changes the generator's *reinterpretation* + emits retractions, not physical time-travel. **"Bridges quantum"** = the ℂ-amplitude corner (Born boundary), algebraic not physical. The **3D choice = hardware-targeting**, not a claim 3D is fundamental.

Work-items minted: `081KYXE4W8808QG0R0011X8S70` (WSet universal-tensor hexagon port) + `081KYXE4W7D08QG0R00256B56A` (IcosahedralH3 visual-geometry module).

## Anchors (Beacon)

- **Tobias Fritz (2020)** — *A synthetic approach to Markov categories* (Adv. Math.): copy/discard, causality, the Markov-category axioms.
- **Cho & Jacobs (2019)** — *Disintegration and Bayesian inversion via string diagrams* (MSCS): CD categories.
- **Robert McEliece & Srinivas Aji (2000)** — *The Generalized Distributive Law* (IEEE Trans. Inf. Theory): one algorithm over any commutative semiring — the `WSet` unifier.
- **Joyal, Street & Verity (1996)** — *Traced monoidal categories*: the trace/feedback = the four-corner interface.
- **Thomas Fox (1976)** — *Coalgebras and cartesian categories*: cartesian ⟺ natural comonoid (the deterministic corner).
- **Coecke & Kissinger** — *Picturing Quantum Processes*: the quantum no-cloning corner as a comonoid failure.
- **Minka (2001)** — Expectation Propagation (the `Ep.fs` algebra). **Infer.NET** — the message-passing lineage.
- Fritz spine: `docs/research/2026-07-31-the-cognitive-architecture-spine-wierzbicka-friston-fritz.md`.
