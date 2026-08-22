// PROMOTED BACK TO CORE by operator decision (Aaron, 2026-06-11, PR #7805: "why are we keeping
// in tests? we need in real code"). Rodney's Razor (2026-06-11, PR #7802) had demoted this to a test fixture —
// "essential as mathematics, accidental as code; zero non-test consumers" — and that dissent
// stays on record as ADVISORY: the human maintainer set the product direction instead — the
// ring-generic type IS intended substrate for the quantum lane (081KTWJ1R0008QG0R001ZBWKTR), the inference port, and
// future ring instances; consumers arrive ON the shelf, not before it exists. Both registers are
// kept honestly: the razor's bar is now met by the source-side `QuantumObservableDbsp` bridge, which
// turns `MachZehnderWSet` output into observable rows and a `ZSet<QuantumObservableRow>`.
namespace Zeta.Core

open Zeta.Core.Abstractions

/// WSet — **the ring-generic weighted set: three rings, one circuit calculus** (081KTZ4EF0008QG0R001R3XPYV; Aaron
/// 2026-06-11, PR #7785: "can we connect ZSet circuit to quantum circuit?" / "Infer.NET circuits the same
/// way?" — same answer, one type). A `WSet<'K,'W>` is a Z-set whose weights live in ANY *-ring:
///
///   'W = ℤ  → the DBSP Z-set (signed counts; boundary nonlinearity = Distinct)
///   'W = ℂ  → amplitudes      (interference;  boundary nonlinearity = measurement/Born)
///   'W = ℝ≥0 → probabilities  (sum-product;   boundary nonlinearity = EP projection)
///
/// The unifying theorem is the Generalized Distributive Law (Aji–McEliece 2000): sum-product,
/// max-product, FFT and friends are ONE algorithm over different commutative semirings. The
/// circuit discipline carried over from `RecursiveSignedDelta`: every operator here is
/// 'W-LINEAR; the ring's nonlinear step (Distinct / measurement / projection) is applied at the
/// OUTER BOUNDARY only, never inside the loop.
///
/// Honest scope: this is the CONNECTION layer, kept lean — unconsolidated (key×weight) lists with
/// ring-parameterized consolidation. `ZSet` remains the optimized ℤ workhorse; `WSet` is where
/// the rings MEET (and the cross-oracle demos live). Float-weighted rings consolidate with an
/// epsilon `isZero` the CALLER supplies — exact cancellation is the ring's business, not ours.
[<RequireQualifiedAccess>]
module WSet =

    /// A weighted set: keys with ring weights, possibly unconsolidated (duplicate keys pending merge).
    type WSet<'K, 'W when 'K: comparison> = ('K * 'W) list

    /// Consolidate: sum weights per key under the ring's Add; drop keys whose total isZero.
    /// THIS is where interference/retraction happens — opposite weights annihilate here.
    /// And therefore THIS is the step that ERASES: it is non-injective (the annihilating pair and
    /// the empty set both land on `[]`), so it — not `negate` — is where the Landauer floor binds.
    /// See the HONESTY note on `FourCornerTrace` below, and WSet.ErasureClassification.Laws.Tests.fs.
    let consolidate (ring: IStarRing<'W>) (isZero: 'W -> bool) (s: WSet<'K, 'W>) : WSet<'K, 'W> =
        s
        |> List.groupBy fst
        |> List.map (fun (k, ws) -> k, ws |> List.map snd |> List.fold (fun a w -> ring.Add(a, w)) ring.Zero)
        |> List.filter (fun (_, w) -> not (isZero w))
        |> List.sortBy fst

    /// The linear-operator application (a matrix row per key): each key maps to a WSet of
    /// successors; incoming weight multiplies through (ring.Mul). 'W-linear by construction.
    let apply (ring: IStarRing<'W>) (op: 'K -> WSet<'K, 'W>) (s: WSet<'K, 'W>) : WSet<'K, 'W> =
        s |> List.collect (fun (k, w) -> op k |> List.map (fun (k2, w2) -> k2, ring.Mul(w, w2)))

    /// Pointwise sum (concatenate; consolidate at your boundary of choice).
    let plus (a: WSet<'K, 'W>) (b: WSet<'K, 'W>) : WSet<'K, 'W> = a @ b

    /// THE BOUNDARY MEASUREMENT (ℂ ring): Born probabilities |w|²/Σ|w|² per key — the ONE
    /// nonlinear step, outside the linear ops above (the same law as Distinct and EP projection).
    let bornProb (magSq: 'W -> float) (s: WSet<'K, 'W>) : ('K * float) list =
        let total = s |> List.sumBy (fun (_, w) -> magSq w)
        if total <= 1e-18 then []
        else s |> List.map (fun (k, w) -> k, magSq w / total)

    // ── Comonoid structure (081KYXE4W8808QG0R0011X8S70) — copy Δ / discard ! ─────────────
    // Read a `WSet<'K,'W>` as a 'W-vector over the basis 'K. Every object of the
    // Markov / CD hexagon (Fritz 2020; Cho–Jacobs 2019) carries a *commutative comonoid*:
    //   copy    Δ_A : A → A ⊗ A   the diagonal embedding  k ↦ (k,k)   (comultiplication)
    //   discard !_A : A → I       the sum of weights  Σ w            (counit ε, into I = 'W)
    // The CORNER of the hexagon is precisely WHICH naturalities these satisfy (Fritz's axis;
    // Fox 1976: cartesian ⟺ every morphism is a comonoid homomorphism). A deterministic
    // re-keying `arr g` IS a comonoid hom (copy- AND discard-natural); a signed/branching
    // `apply op` (a ↦ b + c) is NOT (copy-naturality grows cross terms; discard doubles the
    // mass). That discriminator is the load-bearing proof — see WSet.Comonoid.Laws.Tests.fs.

    /// **copy Δ : WSet<'K,'W> → WSet<'K*'K,'W>** — the comonoid comultiplication: each key
    /// `k ↦ (k,k)`, weight preserved (the diagonal embedding of the 'W-vector). Ring-free —
    /// Δ touches keys, never weights — so it is total over every '*'-ring, including ℂ where
    /// it is the *diagonal map*, NOT the clone `s ⊗ s` (the no-cloning gap the tests witness).
    let copy (s: WSet<'K, 'W>) : WSet<'K * 'K, 'W> =
        s |> List.map (fun (k, w) -> (k, k), w)

    /// **discard ! : WSet<'K,'W> → 'W** — the comonoid counit ε: the sum of all weights (the
    /// all-ones covector applied to the 'W-vector), landing in the monoidal unit `I = 'W`.
    /// Uses only the additive monoid (Add / Zero).
    let discard (ring: IStarRing<'W>) (s: WSet<'K, 'W>) : 'W =
        s |> List.fold (fun acc (_, w) -> ring.Add(acc, w)) ring.Zero

    /// The monoidal tensor ⊗ (Kronecker): `(a ⊗ b)[(ka,kb)] = a[ka]·b[kb]`. Generalises
    /// `ZSet.cartesian` to any '*'-ring; the bifunctor the comonoid laws are stated against
    /// (`Δ_B ∘ f = (f ⊗ f) ∘ Δ_A` is copy-naturality).
    let tensor (ring: IStarRing<'W>) (a: WSet<'A, 'W>) (b: WSet<'B, 'W>) : WSet<'A * 'B, 'W> =
        a |> List.collect (fun (ka, wa) -> b |> List.map (fun (kb, wb) -> (ka, kb), ring.Mul(wa, wb)))

    /// Deterministic re-keying `arr g` — the cartesian (Fox) morphism: a single-key image per
    /// key, weight carried unchanged. This is the arrow that IS a comonoid homomorphism (the
    /// discriminator's positive control), equivalently `apply ring (fun k -> [ g k, ring.One ])`.
    let mapKeys (g: 'K -> 'K2) (s: WSet<'K, 'W>) : WSet<'K2, 'W> =
        s |> List.map (fun (k, w) -> g k, w)

    /// **negate — THE RETRACTION** (`w ↦ −w`, the ring's additive inverse applied pointwise).
    /// Over ℤ this is exactly the DBSP retraction (weight −1 un-emits a past +1); over any
    /// `IRing` it is the same additive inverse, so `plus s (negate ring s) |> consolidate` is
    /// the empty set in EVERY corner. This is the operator the four-corner trace bends back
    /// around the loop — see `FourCornerTrace` below.
    let negate (ring: IStarRing<'W>) (s: WSet<'K, 'W>) : WSet<'K, 'W> =
        s |> List.map (fun (k, w) -> k, ring.Negate w)

/// **FourCornerTrace — the trace of the traced monoidal category, over `WSet`**
/// (081KYXE4W8808QG0R0011X8S70 increment 2; design: `docs/research/2026-08-01-markov-category-hexagon-
/// meno-message-third-corner-design.md` POST-VALIDATION §"The trace is the four-corner feedback interface").
///
/// The standard monadic interface puts feedback on the OUTPUT channel only. `FourCorner.FourCornerOwnership`
/// puts it on the **INPUT** channel too (`TInFeedback`, the co-owned corner). Bending that arrow back around
/// is the **trace** of a traced monoidal category (Joyal–Street–Verity 1996): feedback flows backward into
/// the **generator**, the generator **reinterprets the same history**, and the difference is emitted as a
/// delta that carries **retractions** — `WSet.negate`, weight −1 over ℤ (FROZEN-CORE §A note "Four-Corner =
/// Traced Monoidal Category = ZSet Retraction = Weyl Reflection").
///
/// **HONESTY — this is PSEUDO-retrocausality, not time travel.** Nothing physical is sent backwards. What
/// changes is the generator's *reinterpretation of the past*: later feedback updates the interpretation,
/// the same stored history is re-run through it, and the superseded emission is **retracted** (+w then −w
/// annihilate in `consolidate`) while the new one is emitted. The past *record* is immutable; only its
/// *reading* — and therefore the downstream conclusion — is corrected. Any stronger reading (the future
/// literally acting on the past) is not claimed and is not what this code does.
///
/// **HONESTY — "the quantum corner" is the ℂ-amplitude RING, an algebraic bridge only.** `'W = ℂ` gives
/// interference and a Born boundary, and `−1 = i²` places the retraction corner and the amplitude corner on
/// one C₄ phase `{1, i, −1, −i}` — that is an identity in the *ring*, matching `FourCorner`'s 2×2 compass.
/// It is NOT a claim that this substrate is physically quantum, nor that the trace exploits quantum
/// mechanics; it is the same GDL circuit (Aji–McEliece 2000) run over a different semiring.
///
/// **HONESTY — the retraction is Landauer-FREE, so Landauer does not meter it.** `WSet.negate` is a
/// self-inverse *bijection* of the state space, so by Bennett 1973 it erases nothing and costs nothing;
/// a Landauer meter placed on it must read zero for every input, forever. That is a property of the
/// operation, not a weak instrument — which is why "the retraction is reversible" is TRUE but carries no
/// thermodynamic content, and cannot be evidence that the fold as a whole runs reversibly. The erasure is
/// elsewhere: `consolidate`, `discard`, `bornProb`, `plus` and `tensor` are all non-injective, and
/// `consolidate` is the sharp case — the annihilation the comment on it describes (`+w` and `−w` cancel)
/// maps two distinct states to one, which is Landauer 1961's own example of an erasure. So the negation is
/// free and the *annihilation* is what pays; those two are easily read as one operation, and they are not.
/// Measured, not asserted: `tests/Tests.FSharp/Formal/WSet.ErasureClassification.Laws.Tests.fs` sweeps every
/// public op exhaustively, derives bits-erased = log2(largest fibre), and fails if a declared class drifts
/// or a new op is added unclassified. Formal sibling: `src/Core.Lean4/Lean4/LandauerFloor.lean`.
///
/// **Which corners admit the trace.** The retraction needs an ADDITIVE INVERSE, so the trace is available
/// exactly on the ring corners: ℤ (DBSP/CD) and ℂ (amplitudes). The *normalized* ℝ≥0 (Markov) corner and
/// the Boolean/tropical corners are inverse-free semirings — there is no `−w` to un-emit with, so this loop
/// simply does not instantiate there (a type-level refusal via `IRing`, not a runtime throw — see
/// `Zeta.Core.Abstractions.IStarRing` 2.0.0). Correcting a belief in those corners is re-normalisation,
/// not retraction; do not paper over the difference.
[<RequireQualifiedAccess>]
module FourCornerTrace =

    /// The generator: an interpretation `'I` reads a stored history `'H` and emits a `WSet`.
    /// Feedback never edits `'H` — it only ever moves `'I` (that is the whole honesty claim above).
    type Generator<'H, 'I, 'K, 'W when 'K: comparison> = 'I -> 'H -> WSet.WSet<'K, 'W>

    /// The traced loop's state: the generator's current interpretation, plus the CUMULATIVE emission
    /// downstream has observed (already consolidated, so annihilated pairs are gone, not merely paired).
    type Traced<'I, 'K, 'W when 'K: comparison> =
        { /// what the input-channel feedback updates (the four-corner `TInFeedback` lands here)
          Interpretation: 'I
          /// the consolidated running sum of the opening emission plus every delta since
          Emitted: WSet.WSet<'K, 'W> }

    /// One append-only observation of the loop. `Sequence` is logical order, not wall time:
    /// a later turn may retract an earlier interpretation, but it cannot rewrite this record.
    type TraceTurn<'F, 'K, 'W when 'K: comparison> =
        { Sequence: bigint
          Feedback: 'F
          Delta: WSet.WSet<'K, 'W> }

    /// A finite recorded batch. The trace is returned to the caller rather than retained in
    /// `Traced`, so storage and forgetting remain explicit policy decisions at the boundary.
    type RecordedFold<'I, 'F, 'K, 'W when 'K: comparison> =
        { State: Traced<'I, 'K, 'W>
          NextSequence: bigint
          Turns: TraceTurn<'F, 'K, 'W> list }

    /// An opt-in witness for modeling execution in either direction. Exact rewind is possible
    /// because the pre-consolidation information is retained in `Before`; it is not inferred
    /// from the non-injective materialized output. The ordinary trace does not pay this cost.
    type WitnessedTurn<'I, 'F, 'K, 'W when 'K: comparison> =
        { Sequence: bigint
          Feedback: 'F
          Before: Traced<'I, 'K, 'W>
          After: Traced<'I, 'K, 'W>
          Delta: WSet.WSet<'K, 'W> }

    /// A finite batch of witnessed turns. As with `RecordedFold`, the caller owns retention.
    type WitnessedFold<'I, 'F, 'K, 'W when 'K: comparison> =
        { State: Traced<'I, 'K, 'W>
          NextSequence: bigint
          Turns: WitnessedTurn<'I, 'F, 'K, 'W> list }

    /// An immutable-history read boundary. The caller supplies the retained history value and
    /// the last logical sequence it contains; later corrections may reinterpret this value but
    /// cannot claim to have happened at or before its boundary.
    type HistorySnapshot<'H> =
        { ThroughSequence: bigint
          History: 'H }

    /// Typed refusal for a correction that would place its cause at or before the history it reads.
    type CausalOrderError =
        | CorrectionDoesNotFollowHistory of throughSequence: bigint * correctionSequence: bigint

    /// A correction appended in the only execution direction. `ReinterpretsThrough` identifies
    /// the immutable history boundary being reread; `Sequence` is strictly greater by construction.
    type CausalCorrection<'I, 'F, 'K, 'W when 'K: comparison> =
        { Sequence: bigint
          ReinterpretsThrough: bigint
          Feedback: 'F
          Before: Traced<'I, 'K, 'W>
          After: Traced<'I, 'K, 'W>
          Delta: WSet.WSet<'K, 'W> }

    /// Pair a retained history value with the logical boundary it contains.
    let captureHistory (throughSequence: bigint) (history: 'H) : HistorySnapshot<'H> =
        { ThroughSequence = throughSequence
          History = history }

    /// Pure assembly functions shared by the reference trace and source-owned adapters.
    /// Consolidation remains at the caller boundary so adapters can meter that destructive phase.
    let internal openingUnconsolidated
        (gen: Generator<'H, 'I, 'K, 'W>)
        (history: 'H)
        (interpretation: 'I)
        : WSet.WSet<'K, 'W> =
        gen interpretation history

    let internal deltaUnconsolidated
        (ring: IStarRing<'W>)
        (gen: Generator<'H, 'I, 'K, 'W>)
        (history: 'H)
        (before: 'I)
        (after: 'I)
        : WSet.WSet<'K, 'W> =
        WSet.plus (WSet.negate ring (gen before history)) (gen after history)

    let internal cumulativeUnconsolidated
        (emitted: WSet.WSet<'K, 'W>)
        (delta: WSet.WSet<'K, 'W>)
        : WSet.WSet<'K, 'W> =
        WSet.plus emitted delta

    /// Open the loop: read the history once under the starting interpretation and EMIT it.
    /// Returns the state and that opening emission — opening is an emission like any other, so the
    /// invariant `Emitted = consolidate (gen interpretation history)` holds from turn zero (an
    /// opener that emitted nothing would leave the first retraction unmatched).
    let start
        (ring: IStarRing<'W>)
        (isZero: 'W -> bool)
        (gen: Generator<'H, 'I, 'K, 'W>)
        (history: 'H)
        (interpretation: 'I)
        : Traced<'I, 'K, 'W> * WSet.WSet<'K, 'W> =
        let emitted = openingUnconsolidated gen history interpretation |> WSet.consolidate ring isZero
        { Interpretation = interpretation; Emitted = emitted }, emitted

    /// The reinterpretation **delta**: `−gen(before, history) + gen(after, history)`, consolidated.
    /// Rows the reinterpretation did not touch cancel exactly (`w + (−w) = 0`) and are dropped; what
    /// survives is precisely the retractions of superseded rows and the new emissions.
    let delta
        (ring: IStarRing<'W>)
        (isZero: 'W -> bool)
        (gen: Generator<'H, 'I, 'K, 'W>)
        (history: 'H)
        (before: 'I)
        (after: 'I)
        : WSet.WSet<'K, 'W> =
        deltaUnconsolidated ring gen history before after |> WSet.consolidate ring isZero

    /// ONE turn of the trace: feedback arrives on the input channel, `update` moves the interpretation,
    /// the generator re-reads the SAME history, and the delta (retractions + new emissions) is both
    /// returned and folded into the cumulative emission.
    ///
    /// Invariant (proved in `WSet.FourCornerTrace.Laws.Tests.fs`): after `start` and after any step,
    /// `Emitted = consolidate (gen after history)` — the retraction exactly cancels the superseded
    /// output, so the cumulative view is always the CURRENT reading of the past, never a pile of
    /// stale rows. It follows that the emission is a pure function of the final interpretation
    /// (path-independent), and that replaying an idempotent feedback emits an empty delta.
    let step
        (ring: IStarRing<'W>)
        (isZero: 'W -> bool)
        (gen: Generator<'H, 'I, 'K, 'W>)
        (update: 'I -> 'F -> 'I)
        (history: 'H)
        (fb: 'F)
        (st: Traced<'I, 'K, 'W>)
        : Traced<'I, 'K, 'W> * WSet.WSet<'K, 'W> =
        let after = update st.Interpretation fb
        let d = delta ring isZero gen history st.Interpretation after
        let emitted = cumulativeUnconsolidated st.Emitted d |> WSet.consolidate ring isZero
        { Interpretation = after; Emitted = emitted }, d

    /// Append a correction that reinterprets a retained history snapshot. The correction is a
    /// new forward event: its sequence must be strictly greater than the snapshot boundary.
    /// Invalid order is returned as data before `update` or `gen` runs, so no computation is
    /// modeled as executing backward and no partial correction can escape.
    let appendCorrection
        (correctionSequence: bigint)
        (ring: IStarRing<'W>)
        (isZero: 'W -> bool)
        (gen: Generator<'H, 'I, 'K, 'W>)
        (update: 'I -> 'F -> 'I)
        (snapshot: HistorySnapshot<'H>)
        (fb: 'F)
        (st: Traced<'I, 'K, 'W>)
        : Result<CausalCorrection<'I, 'F, 'K, 'W>, CausalOrderError> =
        if correctionSequence <= snapshot.ThroughSequence then
            Error(CorrectionDoesNotFollowHistory(snapshot.ThroughSequence, correctionSequence))
        else
            let after, d = step ring isZero gen update snapshot.History fb st

            Ok
                { Sequence = correctionSequence
                  ReinterpretsThrough = snapshot.ThroughSequence
                  Feedback = fb
                  Before = st
                  After = after
                  Delta = d }

    /// Run a whole feedback sequence through the loop, keeping every emitted delta in order.
    /// Deterministic (a left fold over the given order): DST replays it byte-identically.
    let fold
        (ring: IStarRing<'W>)
        (isZero: 'W -> bool)
        (gen: Generator<'H, 'I, 'K, 'W>)
        (update: 'I -> 'F -> 'I)
        (history: 'H)
        (feedbacks: 'F list)
        (st0: Traced<'I, 'K, 'W>)
        : Traced<'I, 'K, 'W> * WSet.WSet<'K, 'W> list =
        let st, rev =
            feedbacks
            |> List.fold
                (fun (st, acc) fb ->
                    let st', d = step ring isZero gen update history fb st
                    st', d :: acc)
                (st0, [])
        st, List.rev rev

    /// Run a finite feedback batch and attach an append-only logical sequence to every turn.
    /// Empty deltas are still recorded: receiving idempotent feedback is part of the causal
    /// history even when it does not change the current materialized view. `bigint` keeps the
    /// sequence total without introducing an overflow exception at a long-lived boundary.
    let foldRecorded
        (firstSequence: bigint)
        (ring: IStarRing<'W>)
        (isZero: 'W -> bool)
        (gen: Generator<'H, 'I, 'K, 'W>)
        (update: 'I -> 'F -> 'I)
        (history: 'H)
        (feedbacks: 'F list)
        (st0: Traced<'I, 'K, 'W>)
        : RecordedFold<'I, 'F, 'K, 'W> =
        let state, nextSequence, revTurns =
            feedbacks
            |> List.fold
                (fun (st, sequence, acc) fb ->
                    let st', d = step ring isZero gen update history fb st

                    let turn =
                        { Sequence = sequence
                          Feedback = fb
                          Delta = d }

                    st', sequence + 1I, turn :: acc)
                (st0, firstSequence, [])

        { State = state
          NextSequence = nextSequence
          Turns = List.rev revTurns }

    /// Run a finite batch while retaining the information required for exact rewind/replay.
    /// This is a model of bidirectional execution over an immutable trace: no earlier record is
    /// edited, and no signal is sent to an earlier logical turn.
    let foldWitnessed
        (firstSequence: bigint)
        (ring: IStarRing<'W>)
        (isZero: 'W -> bool)
        (gen: Generator<'H, 'I, 'K, 'W>)
        (update: 'I -> 'F -> 'I)
        (history: 'H)
        (feedbacks: 'F list)
        (st0: Traced<'I, 'K, 'W>)
        : WitnessedFold<'I, 'F, 'K, 'W> =
        let state, nextSequence, revTurns =
            feedbacks
            |> List.fold
                (fun (before, sequence, acc) fb ->
                    let after, d = step ring isZero gen update history fb before

                    let turn =
                        { Sequence = sequence
                          Feedback = fb
                          Before = before
                          After = after
                          Delta = d }

                    after, sequence + 1I, turn :: acc)
                (st0, firstSequence, [])

        { State = state
          NextSequence = nextSequence
          Turns = List.rev revTurns }

    /// Move the modeled cursor to the state retained before this turn.
    let rewind (turn: WitnessedTurn<'I, 'F, 'K, 'W>) : Traced<'I, 'K, 'W> = turn.Before

    /// Move the modeled cursor forward to the state retained after this turn.
    let replay (turn: WitnessedTurn<'I, 'F, 'K, 'W>) : Traced<'I, 'K, 'W> = turn.After

    /// The compensating delta for traversing a witnessed turn backward.
    let inverseDelta
        (ring: IStarRing<'W>)
        (isZero: 'W -> bool)
        (turn: WitnessedTurn<'I, 'F, 'K, 'W>)
        : WSet.WSet<'K, 'W> =
        WSet.negate ring turn.Delta |> WSet.consolidate ring isZero

    /// Package one traced turn as the literal four-corner object: `TIn` = the history being reread,
    /// `TOut` = the emitted delta, `TInFeedback` = the co-owned feedback that caused the reread.
    /// `TOutFeedback` is `unit` here — this loop authors no forward control-flow of its own.
    let toFourCorner
        (history: 'H)
        (fb: 'F)
        (emitted: WSet.WSet<'K, 'W>)
        : FourCorner.FourCornerOwnership<'H, WSet.WSet<'K, 'W>, unit, 'F> =
        { TIn = history
          TOut = Some emitted
          TOutFeedback = None
          TInFeedback = Some fb }

/// The Mach-Zehnder interferometer as a TWO-KEY WSet circuit over the ℂ ring — the literal
/// ZSet↔quantum connection, cross-checked against THREE oracles (F# analytic, AmplitudeEmu,
/// Vera's Q# treaty transcript) in the suite. Convention matches the Q# treaty: H · R1(φ) · H on
/// |0⟩ ⇒ P(0) = cos²(φ/2).
[<RequireQualifiedAccess>]
module MachZehnderWSet =

    let private ring = ImaginaryStack.complex
    let private r (x: float) : Complex = Doubled.make x 0.0
    let private isZero (z: Complex) = abs z.Real < 1e-12 && abs z.Imag < 1e-12
    let private invSqrt2 = r (1.0 / sqrt 2.0)

    /// The Hadamard as a linear map on detector keys 0/1 (the real-valued H).
    let private hadamard (k: int) : WSet.WSet<int, Complex> =
        if k = 0 then [ 0, invSqrt2; 1, invSqrt2 ]
        else [ 0, invSqrt2; 1, ring.Negate invSqrt2 ]

    /// The phase plate: e^{iφ} on arm 1, identity on arm 0.
    let private phasePlate (phi: float) (k: int) : WSet.WSet<int, Complex> =
        if k = 1 then [ 1, Doubled.make (cos phi) (sin phi) ] else [ 0, ring.One ]

    /// The unconsolidated amplitudes immediately before the closed interferometer's erasing
    /// boundary. Assembly-internal so the heat adapter can meter the boundary without duplicating
    /// the circuit; public callers receive either the pure reference result or the metered bridge.
    let internal closedAmplitudes (phi: float) : WSet.WSet<int, Complex> =
        [ 0, ring.One ]
        |> WSet.apply ring hadamard
        |> WSet.apply ring (phasePlate phi)
        |> WSet.apply ring hadamard

    /// CLOSED interferometer: H · R1(φ) · H on |0⟩, consolidated (the interference), then the
    /// boundary measurement. Linear ops inside; Born at the edge — the discipline, demonstrated.
    /// This is the pure reference calculation. Production observable generation uses the
    /// injected-sink adapter in `MachZehnderWSetHeat`.
    let closed (phi: float) : (int * float) list =
        closedAmplitudes phi
        |> WSet.consolidate ring isZero
        |> WSet.bornProb (fun z -> z.Real * z.Real + z.Imag * z.Imag)

    /// The unconsolidated amplitudes immediately before the open interferometer's boundary.
    let internal openArmAmplitudes () : WSet.WSet<int, Complex> =
        [ 0, ring.One ]
        |> WSet.apply ring hadamard

    /// OPEN interferometer: one beamsplitter, no recombination — equal halves, no interference.
    /// This is the pure reference calculation; production generation uses the heat adapter.
    let openArm () : (int * float) list =
        openArmAmplitudes ()
        |> WSet.consolidate ring isZero
        |> WSet.bornProb (fun z -> z.Real * z.Real + z.Imag * z.Imag)
