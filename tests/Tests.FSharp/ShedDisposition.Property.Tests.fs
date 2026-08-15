module Zeta.Tests.ShedDispositionPropertyTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
//  The backpressure composition law, made checkable.
//
//  Model a shed operator as `m : Q -> Q * Q`, `m offered = (admitted, deferred)`. It is
//  CONSERVATIVE when `admitted ⊎ deferred = offered` — nothing destroyed, the unboarded tail handed
//  back to the caller.
//
//   • Conservative operators COMPOSE: closed under composition, associative, admit-all is the unit
//     (a monoid), and the deferred sets join by union — idempotent and order-independent, a
//     join-semilattice. This is a Kahn process network and is determinate independently of
//     scheduling (Kahn 1974; Kahn–MacQueen 1977 for the bounded-FIFO blocking-write case that
//     conservative backpressure actually is), which is why the throttle path replays under DST.
//   • Lossy operators compose into NOTHING: the conservation invariant that makes the monoid is not
//     preserved, and the input–output relation is not a compositional semantics
//     (Brock–Ackerman 1981).
//
//  §L7 is the one that pays for the typed field, and it is the only test here that can distinguish
//  a declared disposition from an inferred one. Read the honest-scope note above it before trusting
//  any of the rest.
//
//  HONEST SCOPE — what this file does NOT claim:
//  The Brock–Ackerman result is that the input–output RELATION fails to be compositional for
//  nondeterminate dataflow. That is a statement about behaviour in an arbitrary context, and it is
//  NOT reducible to "swapping two operators in a pipeline changes the answer" — for the
//  predicate/capacity operators modelled here, swapping does NOT change the admitted set, with or
//  without destruction. So there is deliberately no order-dependence witness below: manufacturing
//  one would be a rigged test. What IS checked is the part that genuinely holds and genuinely
//  matters — conservation is CLOSED under composition for deferral and NOT closed for destruction,
//  and only the conservative half can reconstruct its input.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════


// ── The model ──────────────────────────────────────────────────────────────────────────────────

/// A shed operator: it admits a prefix of what reaches it (a capacity bound) and sheds the rest.
/// `Disposition` says what happens to the shed tail — handed back, or destroyed.
type private Operator =
    { Name: string
      Capacity: int
      Disposition: ShedDisposition }

/// The observable of a run: what boarded, what was handed back, what is simply gone.
type private Outcome =
    { Admitted: int list
      Deferred: int list
      Destroyed: int list }

let private applyOne (op: Operator) (offered: int list) : Outcome =
    let admitted = offered |> List.truncate (max 0 op.Capacity)
    let shed = offered |> List.skip (List.length admitted)

    match op.Disposition with
    | ShedDisposition.Deferred ->
        { Admitted = admitted
          Deferred = shed
          Destroyed = [] }
    | ShedDisposition.Annihilated ->
        { Admitted = admitted
          Deferred = []
          Destroyed = shed }

/// Compose a pipeline: each operator sees only what the previous one ADMITTED. Deferred and
/// destroyed accumulate by union — this is the join whose semilattice structure §L3 pins.
let private run (pipeline: Operator list) (offered: int list) : Outcome =
    pipeline
    |> List.fold
        (fun acc op ->
            let step = applyOne op acc.Admitted

            { Admitted = step.Admitted
              Deferred = acc.Deferred @ step.Deferred
              Destroyed = acc.Destroyed @ step.Destroyed })
        { Admitted = offered
          Deferred = []
          Destroyed = [] }

/// `admitted ⊎ deferred = offered` — the conservation equation, as multisets.
let private isConservativeRun (offered: int list) (outcome: Outcome) : bool =
    let bag (xs: int list) = xs |> List.sort
    bag (outcome.Admitted @ outcome.Deferred) = bag offered

// Generators: bounded so shrinking stays legible, and never degenerate — capacities can bind.
let private opOf (name: string) (capacity: int) (disposition: ShedDisposition) =
    { Name = name
      Capacity = capacity
      Disposition = disposition }

// `abs` BEFORE `%` throws on Int32.MinValue, which FsCheck does generate. Modulo first.
let private capOf (n: int) = abs (n % 8)
let private offeredOf (n: int) = [ 0 .. abs (n % 12) ]


// ── L1. Conservative operators are CLOSED under composition ────────────────────────────────────

[<Property>]
let ``L1 a pipeline of deferring operators is conservative — admitted union deferred = offered``
    (c1: int)
    (c2: int)
    (c3: int)
    (n: int)
    =
    let offered = offeredOf n

    let pipeline =
        [ opOf "a" (capOf c1) ShedDisposition.Deferred
          opOf "b" (capOf c2) ShedDisposition.Deferred
          opOf "c" (capOf c3) ShedDisposition.Deferred ]

    isConservativeRun offered (run pipeline offered)


// ── L2. Monoid: associativity, and admit-all is the unit ───────────────────────────────────────

/// Admit-all: a capacity no offered list can reach.
let private identityOp = opOf "id" 1_000 ShedDisposition.Deferred

[<Property>]
let ``L2a composition is associative — (a then b) then c = a then (b then c)`` (c1: int) (c2: int) (c3: int) (n: int) =
    let offered = offeredOf n
    let a = opOf "a" (capOf c1) ShedDisposition.Deferred
    let b = opOf "b" (capOf c2) ShedDisposition.Deferred
    let c = opOf "c" (capOf c3) ShedDisposition.Deferred

    let left = run ([ a; b ] @ [ c ]) offered
    let right = run ([ a ] @ [ b; c ]) offered

    List.sort left.Admitted = List.sort right.Admitted
    && List.sort left.Deferred = List.sort right.Deferred

[<Property>]
let ``L2b admit-all is a two-sided unit`` (c1: int) (n: int) =
    let offered = offeredOf n
    let a = opOf "a" (capOf c1) ShedDisposition.Deferred

    let alone = run [ a ] offered
    let leftUnit = run [ identityOp; a ] offered
    let rightUnit = run [ a; identityOp ] offered

    List.sort alone.Admitted = List.sort leftUnit.Admitted
    && List.sort alone.Admitted = List.sort rightUnit.Admitted
    && List.sort alone.Deferred = List.sort leftUnit.Deferred
    && List.sort alone.Deferred = List.sort rightUnit.Deferred


// ── L3. The deferred sets join as a semilattice ────────────────────────────────────────────────

[<Property>]
let ``L3a the deferred join is idempotent — applying the same deferring operator twice adds nothing``
    (c1: int)
    (n: int)
    =
    let offered = offeredOf n
    let a = opOf "a" (capOf c1) ShedDisposition.Deferred

    let once = run [ a ] offered
    let twice = run [ a; a ] offered

    List.sort once.Deferred = List.sort twice.Deferred
    && List.sort once.Admitted = List.sort twice.Admitted

[<Property>]
let ``L3b the deferred join is order-independent — swapping two deferring operators is invisible``
    (c1: int)
    (c2: int)
    (n: int)
    =
    let offered = offeredOf n
    let a = opOf "a" (capOf c1) ShedDisposition.Deferred
    let b = opOf "b" (capOf c2) ShedDisposition.Deferred

    let ab = run [ a; b ] offered
    let ba = run [ b; a ] offered

    List.sort ab.Admitted = List.sort ba.Admitted
    && List.sort ab.Deferred = List.sort ba.Deferred


// ── L4. Destruction is NOT closed — "lossy operators form nothing", in its testable form ───────

[<Property>]
let ``L4 a pipeline containing an annihilating operator breaks conservation exactly when it sheds``
    (c1: int)
    (n: int)
    =
    let offered = offeredOf n
    let a = opOf "a" (capOf c1) ShedDisposition.Annihilated
    let outcome = run [ a ] offered

    // Conservation holds iff nothing was destroyed. The invariant that makes the monoid is lost the
    // moment the operator actually annihilates something — so the structure does not survive.
    isConservativeRun offered outcome = List.isEmpty outcome.Destroyed

[<Fact>]
let ``L4b anti-vacuity — the annihilating pipeline really does destroy on the corpus used above`` () =
    let offered = [ 0..9 ]
    let outcome = run [ opOf "a" 3 ShedDisposition.Annihilated ] offered
    Assert.NotEmpty(outcome.Destroyed)
    Assert.False(isConservativeRun offered outcome)


// ── L5/L6. Only the conservative half can reconstruct its input (the DST/replay half) ──────────

[<Property>]
let ``L5 a deferring pipeline can re-offer its deferred tail and recover the whole input`` (c1: int) (c2: int) (n: int) =
    let offered = offeredOf n

    let pipeline =
        [ opOf "a" (capOf c1) ShedDisposition.Deferred
          opOf "b" (capOf c2) ShedDisposition.Deferred ]

    let outcome = run pipeline offered
    // Re-offering the handed-back tail alongside what boarded reconstructs the input exactly.
    List.sort (outcome.Admitted @ outcome.Deferred) = List.sort offered

[<Property>]
let ``L6 an annihilating pipeline cannot — the destroyed part is unreachable from the observable``
    (c1: int)
    (n: int)
    =
    let offered = offeredOf n
    let outcome = run [ opOf "a" (capOf c1) ShedDisposition.Annihilated ] offered

    // Whenever it destroyed anything, no function of (admitted, deferred) reaches `offered`.
    List.isEmpty outcome.Destroyed
    || List.sort (outcome.Admitted @ outcome.Deferred) <> List.sort offered


// ═══════════════════════════════════════════════════════════════════════════════════════════════════
//  L7. THE SOUNDNESS BRIDGE — the property that pays for the typed field.
//
//  Every law above is stated over `ShedDisposition`. That is only worth anything if the disposition
//  attached to a real `HeatSignature` is TRUE of the operator that emitted it. This section runs
//  both routes to that bit over one corpus and compares each against the operator's MEASURED
//  behaviour:
//
//    • DECLARED  — `HeatSignal.dispositionOfSignature` on a signature whose emitter set the field.
//    • INFERRED  — `HeatSignal.dispositionOfKind`, the substring classifier, which is what every
//                  route was before the field existed.
//
//  The inferred route substring-matches the WHOLE dotted kind, source prefix included. So a
//  destroying operator emitted by a subsystem whose NAME carries a pressure token reads as
//  `Deferred` — it claims a composition law it does not satisfy. Note these witnesses carry ONE
//  token class, not two, so a lint that refuses dual-token kind literals does not catch them.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

/// (kind, what the emitting operator ACTUALLY does). The ground truth column is the operator's
/// behaviour, not a second opinion about the string.
let private corpus: (string * ShedDisposition) list =
    [
      // ── live kinds enumerated from the emitters on main ──
      "room-admission.backpressure", ShedDisposition.Deferred
      "room-horizon.backpressure", ShedDisposition.Deferred
      "room-boundary.privacy-backpressure", ShedDisposition.Deferred
      "meta-cart.policy-backpressure", ShedDisposition.Deferred
      "darkhall.backpressure", ShedDisposition.Deferred
      "room-boundary.door-denied", ShedDisposition.Deferred
      "meta-cart.denied", ShedDisposition.Deferred
      "darkhall.machine.denied", ShedDisposition.Deferred
      "room-horizon.forgotten", ShedDisposition.Annihilated
      "room-admission.forgotten", ShedDisposition.Annihilated
      "wset.consolidate.forgotten", ShedDisposition.Annihilated
      "soft-emu.prune", ShedDisposition.Annihilated
      "darkhall.storage-error", ShedDisposition.Annihilated
      "invalid", ShedDisposition.Annihilated
      "forgotten", ShedDisposition.Annihilated
      "backpressure", ShedDisposition.Deferred

      // ── constructible kinds whose SOURCE PREFIX carries a pressure token ──
      // Each destroys; each reads `Deferred` under the substring classifier.
      "reject-cache.overwritten", ShedDisposition.Annihilated
      "denied-list.compacted", ShedDisposition.Annihilated
      "rejection-sampler.evicted", ShedDisposition.Annihilated
      "backpressure-meter.erased", ShedDisposition.Annihilated ]

/// The emitter declares, exactly as `SchedulerShedHeat` and `WSetHeat` now do.
let private declaredSignature (kind: string, truth: ShedDisposition) : HeatSignature =
    HeatSignature.ofMassWithDisposition truth "test-emitter" kind 1 1.0 "corpus probe"

/// A conservation-checking run driven by a signature's disposition, so the law and the field are
/// wired to each other rather than merely adjacent.
let private runUnder (disposition: ShedDisposition) =
    let offered = [ 0..9 ]
    let outcome = run [ opOf "probe" 4 disposition ] offered
    isConservativeRun offered outcome

/// HONEST NOTE on L7a/L7b: `declaredSignature` sets the field FROM the truth column, so these two
/// do not prove "declaring is sound" — an emitter can declare wrongly, and nothing here stops it.
/// What they prove is that the declaration is HONOURED end to end: mutate `dispositionOfSignature`
/// to ignore `Disposition` and both go red on the four collision kinds, because inference cannot
/// reach the truth for those without renaming them. That asymmetry — declaration CAN be right,
/// inference CANNOT — is the entire case for the field, and L7c is its other half.
[<Fact>]
let ``L7a DECLARED disposition matches the emitter's real behaviour on every corpus kind`` () =
    let mismatches =
        corpus
        |> List.filter (fun entry ->
            let declared = entry |> declaredSignature |> HeatSignal.dispositionOfSignature
            declared <> snd entry)
        |> List.map fst

    Assert.Equal<string list>([], mismatches)

[<Fact>]
let ``L7b DECLARED disposition predicts measured conservation on every corpus kind`` () =
    let mismatches =
        corpus
        |> List.filter (fun entry ->
            let declared = entry |> declaredSignature |> HeatSignal.dispositionOfSignature
            // What the law says this operator does, vs what it measurably does.
            ShedDisposition.isConservative declared <> runUnder (snd entry))
        |> List.map fst

    Assert.Equal<string list>([], mismatches)

[<Fact>]
let ``L7c INFERRED disposition is UNSOUND — it calls four destroying operators conservative`` () =
    // This pins the defect the field exists to remove. It is deliberately an equality against the
    // exact witness list: if the classifier is ever fixed or the tokens change, this goes red and
    // someone has to look, rather than the guard quietly passing on a corpus that moved.
    let unsound =
        corpus
        |> List.filter (fun (kind, truth) ->
            let inferred = HeatSignal.dispositionOfKind kind
            // Unsound direction only: inferred says it composes, truth says it destroys.
            inferred = ShedDisposition.Deferred && truth = ShedDisposition.Annihilated)
        |> List.map fst
        |> List.sortWith (fun a b -> System.String.CompareOrdinal(a, b))

    Assert.Equal<string list>(
        [ "backpressure-meter.erased"
          "denied-list.compacted"
          "reject-cache.overwritten"
          "rejection-sampler.evicted" ],
        unsound
    )

[<Fact>]
let ``L7d the declared field is INTRINSIC — relabelling the Kind cannot change the disposition`` () =
    // The whole difference between a law and a convention: a declared disposition is a property of
    // the value, so renaming the kind to its own opposite is invisible to it. Under the inferred
    // route the same relabelling flips the bit, which is what makes it a convention someone has to
    // maintain rather than a property that holds.
    let annihilating =
        HeatSignature.ofMassWithDisposition ShedDisposition.Annihilated "s" "cache.forgotten" 1 1.0 "d"

    let relabelled =
        { annihilating with
            Kind = "room-admission.backpressure" }

    Assert.Equal(ShedDisposition.Annihilated, HeatSignal.dispositionOfSignature annihilating)
    Assert.Equal(ShedDisposition.Annihilated, HeatSignal.dispositionOfSignature relabelled)

    // ...and the inferred route does flip, which is the contrast that makes the above non-vacuous.
    Assert.Equal(ShedDisposition.Annihilated, HeatSignal.dispositionOfKind annihilating.Kind)
    Assert.Equal(ShedDisposition.Deferred, HeatSignal.dispositionOfKind relabelled.Kind)

[<Fact>]
let ``L7e an undeclared signature still falls back to inference — the absent-reading is unchanged`` () =
    // The field is optional with a declared absent-reading: `None` means "infer from Kind", which is
    // byte-for-byte the behaviour every emitter had before the field existed. This is what makes the
    // change additive.
    let undeclared = HeatSignature.ofMass "s" "room-admission.backpressure" 1 1.0 "d"
    Assert.Equal<ShedDisposition option>(None, undeclared.Disposition)
    Assert.Equal(HeatSignal.dispositionOfKind undeclared.Kind, HeatSignal.dispositionOfSignature undeclared)

[<Fact>]
let ``L7f anti-vacuity — the corpus actually exercises both dispositions and the probe really sheds`` () =
    let deferred = corpus |> List.filter (fun (_, d) -> d = ShedDisposition.Deferred) |> List.length
    let annihilated = corpus |> List.length |> fun total -> total - deferred

    Assert.True(deferred >= 8, "corpus must exercise deferral")
    Assert.True(annihilated >= 8, "corpus must exercise annihilation")

    // The probe operator must genuinely bind, or L7b would pass on an operator that never sheds and
    // is therefore conservative either way.
    let offered = [ 0..9 ]
    let shedding = run [ opOf "probe" 4 ShedDisposition.Annihilated ] offered
    Assert.NotEmpty(shedding.Destroyed)
