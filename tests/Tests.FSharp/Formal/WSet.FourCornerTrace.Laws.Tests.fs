module Zeta.Tests.Formal.WSetFourCornerTraceLawsTests

open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// THE FOUR-CORNER TRACE over WSet (081KYXE4W8808QG0R0011X8S70, increment 2)
//
// Increment 1 landed the comonoid corner (copy Δ / discard ! + the
// naturality discriminator). This pack lands the OTHER axis of the same
// object: the TRACE of a traced monoidal category (Joyal–Street–Verity
// 1996), realised as `FourCorner`'s input-channel feedback and emitted as
// DBSP RETRACTIONS (weight −1).
//
// What is proved here:
//   (L1) retraction cancels the superseded output — after ANY step the
//        cumulative emission equals the CURRENT reading of the history;
//        the superseded key's weight goes to 0 and it leaves the set;
//   (L2) replaying the same feedback is idempotent — an idempotent
//        interpretation update emits an EMPTY delta on replay and leaves
//        the loop state untouched (discipline #6);
//   (L3) mass bookkeeping — Σ(delta) = ε(after) − ε(before), and a pure
//        relabelling is mass-preserving (Σ delta = 0): the retraction pays
//        for the new emission exactly;
//   (L4) path-independence — the emission is a function of the FINAL
//        interpretation, not of the order feedback arrived in;
//   (L5) the C₄ corner witness over ℂ — retraction = i², so the amplitude
//        corner (i) and the retraction corner (−1) are two points of ONE
//        C₄ phase {1, i, −1, −i}. ALGEBRAIC identity in the ring; NOT a
//        claim the substrate is physically quantum.
//
// HONESTY (restated from the module docs, because a test file is read on
// its own): this is PSEUDO-retrocausality. The stored history is never
// mutated. Feedback moves only the generator's INTERPRETATION; the same
// history is re-read and the stale emission is retracted. No physical
// time-travel is claimed, implied, or needed.
//
// Anchors (Beacon): Joyal–Street–Verity 1996 (traced monoidal categories);
// Budiu et al. 2022 (DBSP — the −1 retraction); Fritz 2020 / Cho–Jacobs
// 2019 (the corner strata); Aji–McEliece 2000 (GDL — one circuit, N rings);
// FROZEN-CORE §A "Four-Corner = Traced Monoidal Category = ZSet Retraction
// = Weyl Reflection".
// ═══════════════════════════════════════════════════════════════════

// ── the ℤ '*'-ring (same boxing as the comonoid pack: IntegerRing is only
//    IRing<int64>, WSet's ops want IStarRing<int64>). ──
let private intStar: IStarRing<int64> =
    { new IStarRing<int64> with
        member _.Zero = 0L
        member _.One = 1L
        member _.Add(a, b) = a + b
        member _.Mul(a, b) = a * b
        member _.Negate a = -a
        member _.Conj a = a }

let private isZeroI (w: int64) = w = 0L

let private consolI (s: WSet.WSet<int, int64>) = WSet.consolidate intStar isZeroI s

// ── THE WORKED LOOP ─────────────────────────────────────────────────
// history  : raw observations, IMMUTABLE (never touched by feedback)
// interp   : a relabelling Map — "what we now think observation x means"
// reread   : the generator — re-reads the whole history under the current labels
//            (named `reread`, not `gen`, so it cannot shadow FsCheck's `gen { }`)
// update   : upsert-by-key (idempotent by construction — discipline #6)
// feedback : a relabel pair (raw, newLabel) arriving on the INPUT channel
type private Interp = Map<int, int>

let private reread: FourCornerTrace.Generator<int list, Interp, int, int64> =
    fun (interp: Interp) (history: int list) ->
        history
        |> List.map (fun x ->
            let label =
                match Map.tryFind x interp with
                | Some y -> y
                | None -> x
            label, 1L)

let private update (interp: Interp) ((raw, label): int * int) : Interp = Map.add raw label interp

let private stepT history fb st =
    FourCornerTrace.step intStar isZeroI reread update history fb st

let private foldT history fbs st =
    FourCornerTrace.fold intStar isZeroI reread update history fbs st

/// Open the loop on a history at the empty (identity) interpretation — the opening
/// emission is the first reading of the history, so the L1 invariant holds from turn zero.
let private startT (history: int list) =
    fst (FourCornerTrace.start intStar isZeroI reread history Map.empty)

// ── generators: small histories over 0..4, relabels into a disjoint band ──
type private TraceArb =
    static member History() : Arbitrary<int list> =
        gen {
            let! n = Gen.choose (0, 6)
            return! Gen.listOfLength n (Gen.choose (0, 4))
        }
        |> Arb.fromGen

    static member Feedbacks() : Arbitrary<(int * int) list> =
        gen {
            let! n = Gen.choose (0, 5)
            return!
                Gen.listOfLength
                    n
                    (gen {
                        let! raw = Gen.choose (0, 4)
                        let! label = Gen.choose (10, 14) // disjoint band ⇒ visible relabels
                        return (raw, label)
                    })
        }
        |> Arb.fromGen

// ═══════════════════════════════════════════════════════════════════
// (L1) RETRACTION CANCELS THE SUPERSEDED OUTPUT
// ═══════════════════════════════════════════════════════════════════

// The load-bearing invariant: the cumulative emission is ALWAYS the current
// reading of the (unchanged) history. Anything the old interpretation said
// has been retracted out of existence, not merely shadowed.
[<Property(Arbitrary = [| typeof<TraceArb> |])>]
let ``L1 trace: cumulative emission equals the current reading of the history``
    (history: int list)
    (fbs: (int * int) list)
    =
    let st, _ = foldT history fbs (startT history)
    st.Emitted = consolI (reread st.Interpretation history)

// Concrete witness: the retraction weight is literally −n, and the superseded
// key leaves the consolidated set (weight 0 ⇒ dropped by `consolidate`).
[<Fact>]
let ``L1 witness: reinterpretation emits weight −2 and the old key's weight goes to 0`` () =
    let history = [ 3; 3; 5 ]
    let st0, opening = FourCornerTrace.start intStar isZeroI reread history Map.empty
    // the opening emission IS the first reading: two 3s and one 5
    opening |> should equal [ 3, 2L; 5, 1L ]
    let st1, d1 = stepT history (7, 70) st0 // 7 ∉ history ⇒ a no-op reinterpretation
    d1 |> should equal ([]: WSet.WSet<int, int64>) // nothing to retract, nothing new
    st1.Emitted |> should equal [ 3, 2L; 5, 1L ]
    // now relabel 3 ↦ 30: the old emission is RETRACTED (−2) and the new one emitted (+2)
    let st2, d2 = stepT history (3, 30) st1
    d2 |> should equal [ 3, -2L; 30, 2L ] // ← the −1-per-row retraction, explicit
    // the superseded key is GONE from the cumulative view (2 + (−2) = 0, dropped)
    st2.Emitted |> should equal [ 5, 1L; 30, 2L ]
    st2.Emitted |> List.map fst |> should not' (contain 3)
    // and the invariant holds pointwise
    st2.Emitted |> should equal (consolI (reread st2.Interpretation history))

// The history itself is never mutated — only its reading is. (The honesty claim,
// asserted rather than merely documented.)
[<Fact>]
let ``L1 witness: the stored history is untouched — only the reading moves`` () =
    let history = [ 3; 3; 5 ]
    let st, _ = foldT history [ (3, 30); (5, 50) ] (startT history)
    history |> should equal [ 3; 3; 5 ]
    st.Emitted |> should equal [ 30, 2L; 50, 1L ]

// ═══════════════════════════════════════════════════════════════════
// (L2) REPLAYING THE SAME FEEDBACK IS IDEMPOTENT
// ═══════════════════════════════════════════════════════════════════

// `update` is upsert-by-key, so re-delivering a feedback moves the interpretation
// nowhere; the generator re-reads the same history to the same emission; the delta
// is therefore EMPTY and the loop state is bit-identical. Safe redelivery (#6),
// which is what makes the trace DST-replayable (#4).
[<Property(Arbitrary = [| typeof<TraceArb> |])>]
let ``L2 trace: re-delivering a feedback emits an empty delta and moves nothing``
    (history: int list)
    (fbs: (int * int) list)
    (raw: int)
    =
    let fb = (abs raw % 5, 11)
    let st1, _ = foldT history fbs (startT history)
    let st2, _ = stepT history fb st1
    let st3, d3 = stepT history fb st2 // the replay
    d3 = [] && st3.Emitted = st2.Emitted && st3.Interpretation = st2.Interpretation

// Duplicating the WHOLE feedback stream is likewise a no-op on the conclusion.
[<Property(Arbitrary = [| typeof<TraceArb> |])>]
let ``L2 trace: folding the feedback stream twice equals folding it once``
    (history: int list)
    (fbs: (int * int) list)
    =
    let once, _ = foldT history fbs (startT history)
    let twice, _ = foldT history (fbs @ fbs) (startT history)
    once.Emitted = twice.Emitted && once.Interpretation = twice.Interpretation

// ═══════════════════════════════════════════════════════════════════
// (L3) MASS BOOKKEEPING — the retraction pays for the new emission
// ═══════════════════════════════════════════════════════════════════

// ε(delta) = ε(after) − ε(before): `discard !` from increment 1, applied to the
// trace. Linearity of the ring makes this exact, not approximate.
[<Property(Arbitrary = [| typeof<TraceArb> |])>]
let ``L3 trace: discarded mass of the delta is ε(after) − ε(before)``
    (history: int list)
    (fbs: (int * int) list)
    (raw: int)
    =
    let st, _ = foldT history fbs (startT history)
    let fb = (abs raw % 5, 12)
    let before = st.Interpretation
    let after = update before fb
    let d = FourCornerTrace.delta intStar isZeroI reread history before after
    WSet.discard intStar d
    = WSet.discard intStar (reread after history) - WSet.discard intStar (reread before history)

// A pure RELABELLING conserves mass: every retraction is matched by an emission,
// so Σ(delta) = 0. (A generator that dropped rows would not — hence L3 above is
// stated in the general form and this is its corollary for this loop.)
[<Property(Arbitrary = [| typeof<TraceArb> |])>]
let ``L3 trace: a pure relabelling is mass-preserving (Σ delta = 0)``
    (history: int list)
    (fbs: (int * int) list)
    =
    let _, deltas = foldT history fbs (startT history)
    deltas |> List.forall (fun d -> WSet.discard intStar d = 0L)

// ═══════════════════════════════════════════════════════════════════
// (L4) PATH-INDEPENDENCE — the conclusion is a function of the final reading
// ═══════════════════════════════════════════════════════════════════

// Two orders of the same (key-disjoint) feedback reach the same interpretation,
// therefore the same conclusion — even though the intermediate deltas differ.
// This is the trace's confluence: retraction erases the path.
[<Fact>]
let ``L4 trace: feedback order does not change the conclusion`` () =
    let history = [ 3; 3; 5; 5; 5 ]
    let a, da = foldT history [ (3, 30); (5, 50) ] (startT history)
    let b, db = foldT history [ (5, 50); (3, 30) ] (startT history)
    a.Emitted |> should equal b.Emitted
    a.Emitted |> should equal [ 30, 2L; 50, 3L ]
    // the PATHS genuinely differ — this is not a vacuous equality
    da |> should not' (equal db)

// The four-corner packaging is the literal `FourCornerOwnership` object: history in,
// delta out, feedback on the co-owned input channel (the corner that closes the loop).
[<Fact>]
let ``L4 trace: one turn packages as a FourCornerOwnership with feedback on the input channel`` () =
    let history = [ 3; 5 ]
    let st, d = stepT history (3, 30) (startT history)
    let corner = FourCornerTrace.toFourCorner history (3, 30) d
    corner.TIn |> should equal history
    corner.TOut |> should equal (Some d)
    corner.TInFeedback |> should equal (Some(3, 30))
    FourCorner.hasOutput corner |> should equal true
    FourCorner.hasFeedback corner |> should equal true
    st.Emitted |> should equal [ 5, 1L; 30, 1L ]

// The trace fixes logical direction independently of the materialized view. A later
// interpretation can retract what an earlier turn emitted, but it appends that correction
// at a larger sequence; it never rewrites the earlier evidence.
[<Fact>]
let ``L4 trace: later reinterpretation appends a correction without rewriting the past`` () =
    let history = [ 3 ]

    let first =
        FourCornerTrace.foldRecorded 12I intStar isZeroI reread update history [ (3, 30) ] (startT history)

    let earlierTurn = first.Turns |> List.exactlyOne
    earlierTurn.Sequence |> should equal 12I
    earlierTurn.Feedback |> should equal (3, 30)
    earlierTurn.Delta |> should equal [ 3, -1L; 30, 1L ]

    let later =
        FourCornerTrace.foldRecorded
            first.NextSequence
            intStar
            isZeroI
            reread
            update
            history
            [ (3, 40) ]
            first.State

    // The old turn is immutable; the correction is a new turn in the only time direction.
    first.Turns |> List.exactlyOne |> should equal earlierTurn
    let correction = later.Turns |> List.exactlyOne
    correction.Sequence |> should equal 13I
    correction.Delta |> should equal [ 30, -1L; 40, 1L ]
    later.NextSequence |> should equal 14I
    later.State.Emitted |> should equal [ 40, 1L ]
    history |> should equal [ 3 ]

[<Property(Arbitrary = [| typeof<TraceArb> |])>]
let ``L4 trace: recorded turns preserve fold order including empty deltas``
    (history: int list)
    (fbs: (int * int) list)
    =
    let start = startT history
    let expectedState, expectedDeltas = foldT history fbs start
    let recorded = FourCornerTrace.foldRecorded 100I intStar isZeroI reread update history fbs start

    recorded.State = expectedState
    && recorded.NextSequence = 100I + bigint fbs.Length
    && (recorded.Turns |> List.map _.Sequence) = [ for i in 0 .. fbs.Length - 1 -> 100I + bigint i ]
    && (recorded.Turns |> List.map _.Feedback) = fbs
    && (recorded.Turns |> List.map _.Delta) = expectedDeltas

// Backward execution is modeled by retaining the information consolidation erased. The model
// traverses immutable witnesses; it does not infer a unique past from a non-injective output.
[<Fact>]
let ``L4 trace: a witnessed turn can be rewound and replayed exactly`` () =
    let history = [ 3 ]
    let start = startT history

    let witnessed =
        FourCornerTrace.foldWitnessed
            20I
            intStar
            isZeroI
            reread
            update
            history
            [ (3, 30); (3, 40) ]
            start

    let first, second = witnessed.Turns.[0], witnessed.Turns.[1]
    first.Sequence |> should equal 20I
    second.Sequence |> should equal 21I
    FourCornerTrace.rewind second |> should equal first.After
    FourCornerTrace.replay second |> should equal second.After
    FourCornerTrace.rewind first |> should equal start
    witnessed.State |> should equal second.After

[<Property(Arbitrary = [| typeof<TraceArb> |])>]
let ``L4 trace: inverse delta reconstructs each witnessed prior view``
    (history: int list)
    (fbs: (int * int) list)
    =
    let witnessed =
        FourCornerTrace.foldWitnessed 0I intStar isZeroI reread update history fbs (startT history)

    witnessed.Turns
    |> List.forall (fun turn ->
        let inverse = FourCornerTrace.inverseDelta intStar isZeroI turn

        WSet.plus turn.After.Emitted inverse
        |> WSet.consolidate intStar isZeroI
        |> (=) turn.Before.Emitted)

// A correction may read an earlier immutable history boundary, but the correction itself is
// appended later. This is the executable distinction between retrospective recomputation and
// information flowing backward.
[<Fact>]
let ``L4 trace: causal correction reinterprets earlier history as a later event`` () =
    let history = [ 3 ]
    let before = startT history
    let snapshot = FourCornerTrace.captureHistory 12I history

    let correction =
        match
            FourCornerTrace.appendCorrection
                13I
                intStar
                isZeroI
                reread
                update
                snapshot
                (3, 30)
                before
        with
        | Ok value -> value
        | Error error -> failwithf "unexpected causal-order refusal: %A" error

    correction.Sequence |> should equal 13I
    correction.ReinterpretsThrough |> should equal 12I
    (correction.Sequence > correction.ReinterpretsThrough) |> should equal true
    correction.Before |> should equal before
    correction.Delta |> should equal [ 3, -1L; 30, 1L ]
    correction.After.Emitted |> should equal [ 30, 1L ]
    history |> should equal [ 3 ]

// Invalid order refuses before either caller-supplied function runs. Besides being Result-only,
// this prevents a failed correction from leaking a partial reinterpretation.
[<Fact>]
let ``L4 trace: causal correction refuses equal or earlier sequence without executing`` () =
    let mutable calls = 0

    let guardedReread: FourCornerTrace.Generator<int list, Interp, int, int64> =
        fun _ _ ->
            calls <- calls + 1
            []

    let guardedUpdate (interp: Interp) (_: int * int) =
        calls <- calls + 1
        interp

    let snapshot = FourCornerTrace.captureHistory 12I [ 3 ]

    let before: FourCornerTrace.Traced<Interp, int, int64> =
        { Interpretation = Map.empty
          Emitted = [] }

    for correctionSequence in [ 11I; 12I ] do
        let actual =
            FourCornerTrace.appendCorrection
                correctionSequence
                intStar
                isZeroI
                guardedReread
                guardedUpdate
                snapshot
                (3, 30)
                before

        match actual with
        | Error(FourCornerTrace.CorrectionDoesNotFollowHistory(throughSequence, refusedSequence)) ->
            throughSequence |> should equal 12I
            refusedSequence |> should equal correctionSequence
        | Ok correction -> failwithf "unexpected correction at sequence %A" correction.Sequence

    calls |> should equal 0

// ═══════════════════════════════════════════════════════════════════
// (L5) THE C₄ CORNER WITNESS over ℂ — retraction = i²
// ═══════════════════════════════════════════════════════════════════
// FourCorner's 2×2 is {1, i, −1, −i} = C₄. Over the ℂ ring that compass is a
// literal ring identity: multiplying weights by i four times is the identity, and
// twice is exactly `WSet.negate` — the retraction. So the amplitude corner and the
// retraction corner are two points of ONE phase. ALGEBRA, not physics: nothing
// here claims the substrate is quantum, only that ℂ is the ring in that corner.

let private cRing = ImaginaryStack.complex
let private isZeroC (z: Complex) = abs z.Real < 1e-12 && abs z.Imag < 1e-12
let private consolC (s: WSet.WSet<int, Complex>) = WSet.consolidate cRing isZeroC s
let private imagUnit = Doubled.make 0.0 1.0

let private rotI (s: WSet.WSet<int, Complex>) =
    s |> List.map (fun (k, w) -> k, cRing.Mul(w, imagUnit))

let private closeC (a: WSet.WSet<int, Complex>) (b: WSet.WSet<int, Complex>) =
    List.length a = List.length b
    && List.forall2 (fun (k1, (w1: Complex)) (k2, (w2: Complex)) -> k1 = k2 && isZeroC (cRing.Add(w1, cRing.Negate w2))) a b

[<Fact>]
let ``L5 C₄: i² = −1 — the retraction IS two quarter-turns of the four-corner phase`` () =
    let amp = Doubled.make (1.0 / sqrt 2.0) 0.0
    let s: WSet.WSet<int, Complex> = [ 0, amp; 1, amp ]
    // i² = −1 : two quarter-turns == the retraction
    closeC (consolC (rotI (rotI s))) (consolC (WSet.negate cRing s)) |> should equal true
    // i⁴ = 1 : four quarter-turns == identity (C₄ closes)
    closeC (consolC (rotI (rotI (rotI (rotI s))))) (consolC s) |> should equal true
    // and the retraction annihilates in the amplitude corner exactly as it does over ℤ
    WSet.plus s (WSet.negate cRing s) |> consolC |> should equal ([]: WSet.WSet<int, Complex>)

// The trace itself runs at the ℂ corner: reinterpreting which detector an amplitude
// belongs to retracts the stale amplitude and emits the new one, with the same
// annihilation `consolidate` already performs for interference.
[<Fact>]
let ``L5 C₄: the trace instantiates at the ℂ corner — stale amplitude is retracted`` () =
    let amp = Doubled.make (1.0 / sqrt 2.0) 0.0
    let genC: FourCornerTrace.Generator<int list, Map<int, int>, int, Complex> =
        fun interp history ->
            history
            |> List.map (fun x ->
                (match Map.tryFind x interp with
                 | Some y -> y
                 | None -> x),
                amp)
    let updateC (interp: Map<int, int>) ((raw, label): int * int) = Map.add raw label interp
    let history = [ 0; 1 ]
    let st0, _ = FourCornerTrace.start cRing isZeroC genC history Map.empty
    let st1, _ = FourCornerTrace.step cRing isZeroC genC updateC history (9, 90) st0
    let st2, d = FourCornerTrace.step cRing isZeroC genC updateC history (0, 7) st1
    // the delta retracts the amplitude on detector 0 and emits it on detector 7
    closeC (consolC d) (consolC [ 0, cRing.Negate amp; 7, amp ]) |> should equal true
    // the cumulative amplitude vector is the CURRENT reading; detector 0 is gone
    closeC st2.Emitted (consolC (genC st2.Interpretation history)) |> should equal true
    st2.Emitted |> List.map fst |> should not' (contain 0)
