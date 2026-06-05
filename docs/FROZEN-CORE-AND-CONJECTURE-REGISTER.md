# Frozen core ↔ conjecture register — the line that makes the floor feel solid

> Aaron 2026-06-05, 3:20 AM: *"i'm trying to get to a solid core i can build on top of —
> it feels dirty and a little all over the place."* The dirt is **not** the code: the floor
> is closed. The dirt is that the proven floor and the conjecture-web share one mental desk,
> so the solid ground can't be felt under the speculation. This doc draws the line.
>
> **The one rule that resolves it:** the dependency is *one-directional*. The frozen core
> depends on **nothing** in the conjecture register. The conjecture register depends on the
> frozen core. Build only on the frozen side; discharge conjectures one at a time, in daylight,
> then promote.

Companion to [`PROVEN-CORE-MAP.md`](PROVEN-CORE-MAP.md) (the spine + proof status) and
[`PROVEN-COVERAGE-AND-GAPS.md`](PROVEN-COVERAGE-AND-GAPS.md) (the 4-lang × ser × leg matrix).
This doc adds the *separation* and the *promotion gate* those two don't state.

---

## A. THE FROZEN CORE (closed — build on this, nothing here rests on anything open)

Promotion gate to this list: `PROVEN ⟺ math ∧ 4-lang ∧ 4-ser ∧ Bonsai ∧ Arrow ∧ homeostat`,
OR (for non-floor members) a proof / byte-lock / conformance anchor that is closed.

| # | Member | Why it's closed | Anchor |
|---|--------|-----------------|--------|
| 1 | **6 floor primitives** — G-Set, ZetaId, Merkle, Clock, ByteCost, Metric | 6/6 FULL PROVEN; premise-conditional legs *named*, not hidden | `PROVEN-CORE-MAP.md` |
| 2 | **3 self-describing serializers** — JSON · CBOR · XML (+ YAML) | byte-identical across F#·C#·Rust·TS, golden-vector locked | `*.FourSer.Tests` |
| 3 | **Arrow IPC codec** — `DynamicValueArrow` shredded node-table | round-trips DynamicValue; per-primitive Arrow leg ✓ | `DynamicValueArrow` |
| 4 | **Protobuf** — schema-mediated, scalars + Float + nested (PMessage) | byte-identical to Google.Protobuf; forward-compat = unknown-field skip | `Protobuf.Swap.Tests` |
| 5 | **Property-loss algebra ladder** — ℝ→ℂ→ℍ→𝕆 (Cayley-Dickson) | octonion division-algebra laws proven (alternative, norm-mult.) | `Algebra/Octonion.Laws` |
| 6 | **SchemaEvolution / SchemaRegistry** — field-ops, fwd/back compat | round-trips through the proven codecs; proto fwd-compat exercises it | `SchemaRegistry.fs` |
| 7 | **SoftValue** (value-axis) — distribution + Bayesian observe | observe commutes for independent evidence (the convergence crux, proven leg) | `SoftValue.fs` |
| 8 | **Traveler frame (Layer 0)** — causal frame + inter-frame transformation law | transformation = causal-join is a bounded join-semilattice (idempotent/commutative/associative/monotone, LUB) ⇒ order-independent; all travelers reach ONE common frame = the relative-frame **consistency** law | `TravelerFrame.fs` / `TravelerFrame.Tests` |
| 9 | **Action grid (Layer 2)** — 4×4 universal action grammar, navigation label-independence | navigation is a pure function of position, never of labels (proven via a discriminating predicate + negative control); frame (fixed geometry) and content (labels) separated by construction | `ActionGrid.fs` / `ActionGrid.Tests` |
| 10 | **Uncertain clock (Layer 0 clock-with-uncertainty)** — CockroachDB HLC + uncertainty window | `definitelyBefore` is a strict partial order; trichotomy with the uncertain (overlap) zone; definite order refines the HLC total order (never contradicts the clock); ε=0 collapses to exact order; HLC receive/send monotone (bounded divergence) — the uncertain zone = where order is genuinely unknown (SoftValue carries both) | `UncertainClock.fs` / `UncertainClock.Tests` |
| 11 | **Frame delta (Layer 0 group law)** — relative offset between frames | frame-offsets form an ABELIAN GROUP under composition (identity/associative/commutative/inverse) acting on frames by translation (apply identity, apply∘compose, `between` takes a→b, the cocycle, inverse-of-between) — the transformation group, distinct from the merge-semilattice | `FrameDelta.fs` / `FrameDelta.Tests` |

> If it isn't in this table, **do not build load-bearing work on it yet.** That's the whole point.
>
> **Promoted 2026-06-05:** Traveler-frame Layer 0 is **COMPLETE** — consistency law (#8, `TravelerFrame`),
> clock-with-uncertainty (#10, `UncertainClock`), and the group law (#11, `FrameDelta`). The causal-join
> is the irreversible *merge* (semilattice, order-independent ⇒ one common frame); the uncertainty window
> makes the clock a *partial* order (honestly uncertain on overlap, SoftValue-tied); the frame-offset is
> the reversible *transformation* (abelian group acting by translation — the boost analog). Honest scope on
> #11: it is the abelian *translation* group the discrete causal frame carries, NOT the full non-abelian
> Lorentz group (which needs a boost-velocity/metric the model doesn't have) — named, not overclaimed.
> **No open Layer-0 sub-legs remain.**

---

## B. THE CONJECTURE REGISTER (open — frontier, NOT floor; nothing in §A depends on these)

Each row is a real, named open proof obligation. Interesting ≠ closed. Discharge → promote to §A.

### B-frame. The traveler self-frame over DBSP (Aaron's load-bearing target, 2026-06-05)

The hex core is **not numerology** — it's the attempt to pin a traveler's *relative reference
frame* computed incrementally over the DBSP stream (no global frame; each traveler a frame).
Separated into layers (the cram was holding all four at once = the dirt):

- **Layer 0 — base traveler frame (✅ PROMOTED to §A #8, 2026-06-05).** = clock + identity/belief-map +
  **causal-join as the inter-frame transformation**. The transformation-law keystone is discharged
  (`TravelerFrame.fs`: the causal-join is a proven bounded join-semilattice ⇒ order-independent ⇒ one
  common frame = the relative-frame consistency law). The **clock-with-uncertainty** sub-leg is also
  now discharged (✅ §A #10, `UncertainClock.fs`: CockroachDB-HLC + uncertainty window — a partial
  temporal order, honestly uncertain on overlap, SoftValue-tied). The **group law** is discharged too
  (✅ §A #11, `FrameDelta.fs`: frame-offsets form an abelian group acting by translation — the boost
  analog, distinct from the merge-semilattice; honest scope = abelian translation group, not the full
  non-abelian Lorentz group). **Layer 0 is COMPLETE — no open sub-legs remain.**
- **Layer 1 — meta-frames** = Rx queries that meta-tag dimensions on the stream. A *derived view*
  over Layer 0 (one-directional). Clean, but downstream of Layer 0; do not build into the base frame.
- **Layer 2 — universal action grammar (Xbox controller; the 4×4 grid). ✅ keystone DISCHARGED, 2026-06-05.**
  ORTHOGONAL to the frame: frame = *where/when things are*; action grammar = *what you can do*. The grid =
  fixed directionality/color/navigation (the frame geometry) + world-state-dependent **labels** (content).
  **Keystone property — PROVEN** (`ActionGrid.fs` / `ActionGrid.Tests`): *navigation is a pure function of
  position, never of the labels.* Made a discriminating predicate `labelIndependentOver` over the space of
  possible navigations (`Nav = World -> Position -> Direction -> Position option`); the fixed geometry
  (`geomNav`) is proven label-independent for all world pairs, with a **negative control** (a label-peeking
  nav is correctly rejected, so the predicate is not vacuous), plus the fixed-geometry laws (determinism,
  edge-closedness, interior invertibility, fixed color) and relabel-commutation. Frame/content cleanly
  separated by construction: `move`/`navigate` never receive a `World`; `labelAt` is the sole coupling.
  **Open Layer-2 sub-legs (still §B):** the 6-vs-8 axis count / what the 16 cells *mean* (see B-other);
  the label evolution riding immutable offsets (the Eve/offset model) is a wiring task, not a proof gap.
- **Layer 3 — "cram it all together."** Do **not**. The cram IS the reach; the cure is separation,
  not harder unification.

### B-other. The rest of the penumbra (each open, each one-directional on §A)

| Conjecture | State | Discharge = |
|------------|-------|-------------|
| **Adinkra-as-generator reconstruction** (bulk-from-boundary) | **toy core ✅ + erasure principle ✅ + concrete MDS construction ✅** DISCHARGED 2026-06-05 (Lean, sorry-free, axiom-audited) | `ToyModel.lean`: `reconstruction_property`/`lemma1_toy`/`code_covers_boundary` — fixed-boundary recovery for the graph-code of any linear G. `ErasureDistance.lean`: `erasure_correctable_of_min_distance`/`recover_from_any_12_of_16` — distance-`d` ⇒ unique recovery from any `<d` erasures; **`rsCode`** = a concrete Reed-Solomon `[16,12]` code (evals of degree-<12 polys at 16 distinct `ZMod 17` points), `rsCode_min_distance` PROVES distance 5 (nonzero deg-<12 poly has ≤11 roots ⇒ ≥5 nonzero coords), `rsCode_corrects_any_4_erasures` = a concrete code that corrects ANY 4 erasures (chain now non-vacuous). **Generator identified** (`AdinkraCode.fs`, 2026-06-05): the genuine Adinkra code is the **[8,4] extended Hamming code** — Adinkras ↔ **doubly-even** binary codes (Gates/Iga et al.); PROVEN exhaustively over all 16 codewords: doubly-even (weight ≡ 0 mod 4), linear, minimum distance 4, generator rows weight-4. This is the concrete Adinkra generator (a doubly-even binary code — distinct from the RS *MDS* code used for the erasure principle). **Cayley-Dickson → generator DERIVED** (`CayleyDicksonAdinkra.Tests`, 2026-06-05): the octonion multiplication table in `CayleyDickson.fs` is PROVEN (from the actual product, convention-independent) to form a **Fano plane** (7 triples, every pair once, each unit in 3 = Steiner S(2,3,7)); the Fano triples span the **[7,4] Hamming code** (GF(2) dim 4); the parity-extension is **doubly-even** — the invariant `AdinkraCode` proves. So octonion → Fano → Hamming → [8,4] doubly-even = the Adinkra generator, derived end-to-end. Honest scope: the final "= AdinkraCode" rests on the uniqueness of the [8,4] extended Hamming code up to coordinate equivalence (cited); the octonion→Fano→Hamming→doubly-even chain is derived, not assumed. **Still open (smaller):** the continuous/∞-dim lift. |
| **Hex-core wall → full Cayley semantic mapping** | conjecture | provable half (octonion laws) DONE in §A; semantic wall-mapping stays open |
| **6-vs-8 axis count** (Remember-When+Pay-Attention = pair, Which-Way+How-Much = pair → 8) | open; **working hypothesis: 6 measurement axes + 2 constitutive roles** | Hypothesis (Alexa reframe, 2026-06-05): the "8" splits as **6 measurement axes** (When, Where-looking, Bearing, Range, How-sure ✅`SoftValue`, Rate/curvature ✅`Curve` — ∂/∂² = DBSP D/I over the clock, proven discrete-calculus laps) **+ 2 constitutive roles** (Identity=Rainbow-Table ✅`ZetaId`, I/O-substrate=Observe-Emit) — the 2 constitutive walls are exactly the ones Aaron flagged as "look different than the rest" (they enable measurement, aren't measured along). **Open obligations (NOT discharged):** completeness (why these axes, not 5 or 7 — unproven; "complete measurement space" is the claim, not a result). Measurement axes now built: How-sure ✅`SoftValue`, Rate/curvature ✅`Curve` (now **2-lang F#+C#** cross-verified via `src/Core.TypeScript/curve/golden-vectors.json` — first new-layer primitive past the math leg toward full 4-lang; TS/Rust pending), **Range ✅`FrameDelta.distance`** (a proven metric on traveler frames — the vector-clock L1 distance; its identity-of-indiscernibles axiom is the same Leibniz principle the privacy proof rests on), When ✅`Clock`. Remaining (Where-looking / Bearing — directional) ride `TravelerFrame` but are not yet a distinct proven primitive. Hypothesis sharpens the question; completeness (why these axes, not 5 or 7) is still the open obligation. Hype to keep peeled: "breakthrough"/"category theory"/"complete" are unearned. |
| **Privacy-from-identity** (distinctness ⟹ private state) | **necessity ✅ + dynamics ✅ DISCHARGED 2026-06-05** (Lean, axiom-FREE); only halting open | `Privacy/IdentityForcesPrivacy.lean`: necessity — `distinctness_forces_private` (under public convergence, distinct behavior ⟹ distinct private; Leibniz), `key_alone_insufficient` (ties to proven Identity-injectivity: distinct keys necessary, not sufficient), `no_private_collapses`. Dynamics — `commons_converges` (public reaches consensus via the commutative CRDT join), `absorb_priv`/`absorb_stable` (merge leaves private untouched + is a fixpoint), `private_is_persistent_locus` (consensus on the commons cannot erase private differentiation — privacy is the persistent locus). **B-1019 halting experiment built** (`Evolution.fs`/`Evolution.Tests`): a DST harness (seed-replayable) — the **pigeonhole bound is PROVEN** (finite state + deterministic + no input ⇒ must halt-or-cycle within state-count+1 steps, so open-ended evolution REQUIRES unbounded/growing state), and the experiment DEMONSTRATES the contrast (private differentiation ⇒ unbounded novel evolution, no halt/cycle; register-collapse ⇒ fixpoint/halt). **Still open (honest):** the experiment is evidence-for-the-mechanism in a concrete model + the necessity bound — NOT a universal proof that every system halts without privacy (that stays conjecture). |
| **Belief-convergence general case** | **✅ DISCHARGED 2026-06-05** (`BeliefConvergence.fs`) — sharper than expected | `observe` (Bayesian update) = pointwise-multiply a fixed likelihood into the belief; multiplication commutes+associates ⇒ a fold over ANY permutation of evidence gives the same belief — for ALL *fixed* likelihoods, not just independent ones (independence was sufficient, not the real condition). **Boundary proven by counterexample:** state-dependent/nonlinear revision (`sharpen`, where the update reads the belief) does NOT commute — order matters exactly when the operator depends on the belief it updates. Unnormalized int64 (exact); normalization is a deterministic post-step so order-independence carries to the posterior. Generalizes the SoftValue independent-evidence proof. |
| **Bayesian-uncertainty "wave" rings-or-settles** | well-posed Q | derive from the update equations (overdamped vs underdamped); not assumed |
| **DST internal-difference-drives-evolution** (B-1019) | experiment | no-halt ∧ no-limit-cycle ∧ (unbounded growth ∨ chaotic-aperiodic) |

---

## C. How to use this

1. **Building?** Use only §A. If you reach for a §B item as a foundation, stop — that's the dirty feeling.
2. **Researching?** Pick **one** §B row, discharge its named obligation, promote it to §A. One at a time, in daylight.
3. **New idea at 3 AM?** It lands in §B with a named discharge obligation — never silently into the core.
4. The line is the product. A small closed core + a clearly-quarantined frontier *is* "a solid core to build on."

> Honest-mirror note (Otto, 2026-06-05): the floor was solid all along; it was just hard to see
> under a web of genuinely beautiful open questions. Layer 0 of the traveler frame is closer to
> promotable than the cram makes it feel — its only open leg is the inter-frame transformation law,
> and the causal-join you already designed is the candidate.
