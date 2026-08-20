module Zeta.Tests.Formal.ErasureChargeLawsTests

open System
open System.Collections.Generic
open System.Globalization
open System.IO
open System.Threading.Tasks
open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// THE CHARGE SIDE — `ErasureCharge` folds the classification into a bill.
//
// `Erasure.Representation.Laws.Tests.fs` checks the DIAGNOSIS: every declared class agrees with an
// exhaustive sweep, in both directions, with a reflection drift guard. This pack checks the
// TREATMENT: that the declaration is what gets charged, that a measured zero and an unknown are
// never the same value, and that a shipped code path actually posts.
//
// Three properties carry the weight, and each has a mutation that reddens it (recorded in the PR):
//
//   1. THE CHARGE IS DERIVED, NOT RE-LISTED. `dispositionOf` may read `Classification` and
//      `Evidence` and nothing else. The test renames all three string fields of a real profile to
//      garbage and requires the disposition to be identical. A name-keyed special case — the list
//      that was written twice and was wrong twice — fails here the moment it is added.
//
//   2. `Unmeasured` IS NOT ZERO, AND THE TYPE ENFORCES IT. A `Reading` is `Complete` or
//      `LowerBound`, and `LowerBound` carries the holes with the number. There is no accessor
//      returning a bare total, so no caller can hold the sum without holding the fact that it is
//      partial. An unmeasured operation and a reversible one produce structurally different
//      values, not two zeros.
//
//   3. A SHIPPED PATH POSTS. `RecoverableSpine.CommitAsync` is the one genuine
//      snapshot-supersedes-log site in the repo (§11e named it as charging nothing). It charges
//      now, at the class the INJECTED backend declares — so the same code posts 3.700 bits over
//      `InMemoryDeltaLog`, a measured zero over `GroupCommitDiskDeltaLog`, and a HOLE over a
//      backend that declares nothing.
//
// Anchors (Beacon): Landauer 1961 (a floor — hence `LowerBound`); Bennett 1973 (a bijection pays
// nothing — hence `Free` requires a measured fibre of 1); del Rio et al. 2011 (the conditional
// H(A|B) this substrate cannot measure, declared as a hole rather than as a number).
// ═══════════════════════════════════════════════════════════════════════════════════════════════

// ── fixtures: three well-formed profiles, one per class ───────────────────────────────────────

let private erasingProfile: ErasureClass.Profile =
    { Representation = "Fixture"
      Operation = "collapse"
      Observation = "the returned value"
      RecoveryChannel = "nothing"
      Classification = ErasureClass.ThermodynamicClass.Erasing
      Evidence = ErasureClass.Evidence.ExhaustiveSweep("a four-point domain", 4, 2_000_000L) }

let private reversibleProfile: ErasureClass.Profile =
    { Representation = "Fixture"
      Operation = "relabel"
      Observation = "the returned value"
      RecoveryChannel = "everything — the operation is a bijection"
      Classification = ErasureClass.ThermodynamicClass.Reversible
      Evidence = ErasureClass.Evidence.ExhaustiveSweep("a four-point domain", 1, 0L) }

let private unmeasuredProfile: ErasureClass.Profile =
    { Representation = "Fixture"
      Operation = "vanish"
      Observation = "the returned value"
      RecoveryChannel = "unknown"
      Classification = ErasureClass.ThermodynamicClass.Unmeasured
      Evidence = ErasureClass.Evidence.NoAdmissibleMeasurement "nobody has swept this" }

// ═══ 1. The charge is DERIVED from the classification, never from a name ═══

[<Fact>]
let ``the disposition ignores every name field — renaming a profile cannot change its charge`` () =
    let garbled (p: ErasureClass.Profile) =
        { p with
            Representation = "zzzz-not-a-real-representation"
            Operation = "zzzz-not-a-real-operation"
            Observation = "zzzz-not-a-real-observation" }

    for p in [ erasingProfile; reversibleProfile; unmeasuredProfile ] do
        ErasureCharge.dispositionOf (garbled p) |> should equal (ErasureCharge.dispositionOf p)

[<Fact>]
let ``a measured erasing profile is charged exactly its declared bits`` () =
    ErasureCharge.dispositionOf erasingProfile
    |> should equal (ErasureCharge.Disposition.Charged 2_000_000L)

[<Fact>]
let ``a measured reversible profile is Free — and Free is reachable only from a measured fibre of one`` () =
    ErasureCharge.dispositionOf reversibleProfile |> should equal ErasureCharge.Disposition.Free

    // The converse: `Reversible` asserted over a wide fibre is not free, it is broken. Charging
    // zero there is exactly the closed-ledger free lunch, so the fold fails closed instead.
    let lying =
        { reversibleProfile with
            Evidence = ErasureClass.Evidence.ExhaustiveSweep("a four-point domain", 4, 2_000_000L) }

    match ErasureCharge.dispositionOf lying with
    | ErasureCharge.Disposition.Malformed _ -> ()
    | other -> failwithf "a Reversible declaration over fibre 4 must be Malformed, got %A" other

// ═══ 2. `Unmeasured` is not zero — structurally, not by convention ═══

[<Fact>]
let ``an unmeasured profile is never Free and never Charged`` () =
    match ErasureCharge.dispositionOf unmeasuredProfile with
    | ErasureCharge.Disposition.Unmeasured reason -> reason |> should equal "nobody has swept this"
    | other -> failwithf "an unmeasured profile must be a hole, got %A" other

[<Fact>]
let ``a reversible posting and an unmeasured posting produce different readings — zero is not unknown`` () =
    let reversibleOnly = ErasureCharge.Ledger.Empty.Post reversibleProfile
    let unmeasuredOnly = ErasureCharge.Ledger.Empty.Post unmeasuredProfile

    // Both have posted nothing chargeable. If `Unmeasured` defaulted to `0`, these two readings
    // would be equal — which is precisely the demon. They are not equal, and the difference is
    // visible in the TYPE, not in a side channel a caller can skip reading.
    reversibleOnly.Reading |> should equal (ErasureCharge.Reading.Complete 0L)

    match unmeasuredOnly.Reading with
    | ErasureCharge.Reading.LowerBound(bits, holes) ->
        bits |> should equal 0L
        holes |> List.length |> should equal 1
        (snd holes.[0]) |> should haveSubstring "nobody has swept this"
    | other -> failwithf "an unmeasured posting must read as a LowerBound, got %A" other

    reversibleOnly.Reading |> should not' (equal unmeasuredOnly.Reading)

[<Fact>]
let ``one hole makes the whole reading a LowerBound, and the measured charge survives inside it`` () =
    let ledger =
        ErasureCharge.Ledger.Empty.Post(erasingProfile).Post(reversibleProfile).Post(unmeasuredProfile)

    ledger.ChargedPostings |> should equal 1
    ledger.FreePostings |> should equal 1
    ledger.HolePostings |> should equal 1

    match ledger.Reading with
    | ErasureCharge.Reading.LowerBound(bits, holes) ->
        // The real charge is not thrown away by the presence of a hole — refusing to fold the
        // unknown is not refusing to report the known.
        bits |> should equal 2_000_000L
        holes |> List.length |> should equal 1
    | other -> failwithf "expected a LowerBound, got %A" other

[<Fact>]
let ``re-posting the same hole is idempotent in identity and cumulative in invocations`` () =
    let ledger =
        ErasureCharge.Ledger.Empty.Post(unmeasuredProfile).Post(unmeasuredProfile).Post(unmeasuredProfile)

    // The hole SET is keyed (§12 idempotency): the same unknown operation is one unknown.
    ledger.Holes |> List.length |> should equal 1
    // The invocation COUNT is not: a hole hit three times is visibly not a hole hit once.
    ledger.HolePostings |> should equal 3

[<Fact>]
let ``readingParts cannot hand over the number without the completeness flag`` () =
    // A type-level property, asserted so a later "convenience" accessor that drops the flag has to
    // delete this test to land. `readingParts` returns a pair; there is no `int64` route.
    ErasureCharge.readingParts (ErasureCharge.Reading.Complete 7L) |> should equal (7L, true)
    ErasureCharge.readingParts (ErasureCharge.Reading.LowerBound(7L, [ "k", "why" ])) |> should equal (7L, false)

// ═══ 3. Bits are never summed across observations ═══

[<Fact>]
let ``two observations of one operation settle separately — the account offers no way to average them`` () =
    let readSurface =
        { erasingProfile with Observation = "the log's own read surface" }

    let commitDag =
        { reversibleProfile with Observation = "the commit DAG including the parent edge" }

    let account = ErasureCharge.Account.Empty.PostAll [ readSurface; commitDag ]

    account.Observations |> List.length |> should equal 2
    account.Readings
    |> List.map snd
    |> should equal [ ErasureCharge.Reading.Complete 0L; ErasureCharge.Reading.Complete 2_000_000L ]

// ═══ 4. The witness-correlation declaration: measured marginal, declared hole for the conditional ═══
//
// The sweep below is the check on row 1. Row 2 is not swept — that is the claim, and what makes it
// honest rather than evasive is that row 1 IS swept: the declaration does not use `Unmeasured` to
// avoid measuring something measurable, it uses it for the one observation this substrate has no
// instrument for.

let private witnessProfiles =
    (WitnessCorrelationErasureDeclaration() :> IErasureDeclaring).ErasureProfiles

/// The bounded model named in the declaration: a 2-source, 2-value quorum universe.
let private quorumUniverse: QuorumAlgebra.Quorum<string> list =
    let c (v: string) : QuorumAlgebra.Contribution<string> = [ v, { Real = 1.0; Imag = 0.0 } ]

    [ QuorumAlgebra.empty<string>
      QuorumAlgebra.single "a" (c "x")
      QuorumAlgebra.single "a" (c "y")
      QuorumAlgebra.single "b" (c "x") ]

let private renderQuorum (q: QuorumAlgebra.Quorum<string>) : string =
    let contributions =
        q.Contributions
        |> Map.toList
        |> List.map (fun (k, v) ->
            let parts =
                v
                |> List.map (fun (f, z) ->
                    String.Format(CultureInfo.InvariantCulture, "{0}:{1}+{2}i", f, z.Real, z.Imag))

            String.Format(CultureInfo.InvariantCulture, "{0}=[{1}]", k, String.Join(",", parts)))

    String.Format(
        CultureInfo.InvariantCulture,
        "C[{0}] X[{1}]",
        String.Join(";", contributions),
        String.Join(";", q.Conflicted |> Set.toList)
    )

[<Fact>]
let ``QuorumAlgebra.join measures the fibre its declaration claims`` () =
    let pairs =
        [ for a in quorumUniverse do
              for b in quorumUniverse -> a, b ]

    // A sweep over fewer than two inputs cannot exhibit a collision, so it cannot report erasing.
    pairs |> List.length |> should equal 16

    let fibre =
        pairs
        |> List.map (fun (a, b) -> renderQuorum (QuorumAlgebra.join a b))
        |> List.groupBy id
        |> List.map (snd >> List.length)
        |> List.max

    let declared =
        witnessProfiles
        |> List.find (fun p -> p.Observation = "the Quorum returned by join")

    ErasureClass.ofLargestFibre fibre |> should equal declared.Classification
    ErasureClass.largestFibre declared |> should equal (Some fibre)
    ErasureClass.bitsErasedPpm declared |> should equal (Some(ErasureClass.bitsPpmOfLargestFibre fibre))

[<Fact>]
let ``the conditional row is a declared hole, and folding it yields a LowerBound naming del Rio's H(A|B)`` () =
    let account = ErasureCharge.Account.Empty.PostAll witnessProfiles

    // Two observations, and they do not average.
    account.Observations |> List.length |> should equal 2

    let incomplete = account.IncompleteObservations
    incomplete |> List.length |> should equal 1

    let observation, holes = incomplete.[0]
    observation |> should haveSubstring "H(A|B)"
    holes |> List.length |> should equal 1
    (snd holes.[0]) |> should haveSubstring "invented coefficient"

[<Fact>]
let ``every witness-correlation declaration is internally well formed`` () =
    witnessProfiles |> List.collect ErasureClass.inconsistencies |> should be Empty

// ═══ 5. A SHIPPED PATH POSTS — RecoverableSpine, the one snapshot-supersedes-log site ═══

// ── the fixtures the shipped-path section needs ───────────────────────────────────────────────

let private tempDirectory () =
    let d = Path.Combine(Path.GetTempPath(), "zeta-erasure-charge-" + Guid.NewGuid().ToString("N"))
    Directory.CreateDirectory d |> ignore
    d

let private keyEnc (i: int) = DynamicValue.Int(int64 i)

let private keyDec =
    function
    | DynamicValue.Int v -> int v
    | other -> failwithf "key not Int: %A" other

let private codec () = CborEntryCodec<int>(keyEnc, keyDec) :> IEntryCodec<int>

/// A delta log that deliberately does **not** implement `IErasureDeclaring`.
///
/// This is the caller-supplied backend the reflection drift guard cannot see: it lives in the test
/// assembly, so no scan of `Zeta.Core` will ever find it. What must happen when a spine is handed
/// one is that the composite reports a HOLE — the runtime half of the guard. If this type ever
/// starts declaring, the test that uses it stops testing anything, which is why it is defined here
/// beside its one consumer rather than in a shared fixture file.
type private UndeclaredDeltaLog<'K when 'K: comparison>() =
    let entries = ResizeArray<DeltaLogEntry<'K, ZSet<'K>>>()
    let mutable highWater = 0L

    interface IDeltaLog<'K> with
        member _.AppendAsync(delta, captured, _ct) =
            highWater <- highWater + 1L
            entries.Add(DeltaLogEntry<'K, ZSet<'K>>(highWater, delta, captured))
            ValueTask<int64>(highWater)

        member _.ReplayAsync(fromSeqExclusive, _ct) =
            ValueTask<DeltaLogEntry<'K, ZSet<'K>>[]>(
                entries |> Seq.filter (fun e -> e.Seq > fromSeqExclusive) |> Seq.toArray
            )

        member _.HighWater = highWater

        member _.TruncateAsync(throughSeqInclusive, _ct) =
            entries.RemoveAll(fun e -> e.Seq <= throughSeqInclusive) |> ignore
            ValueTask()

let private spineOver (log: IDeltaLog<int>) =
    let spine = RecoverableSpine.create log (InMemorySnapshotStore<int>() :> ISnapshotStore<int>)
    spine.AutoSnapshotEvery <- 2
    spine

let private deltaOf (k: int) (w: int64) = ZSet.ofSeq [ (k, w) ]

[<Fact>]
let ``the fold is charged on every commit, not once per snapshot cadence`` () : Task =
    task {
        let spine = spineOver (InMemoryDeltaLog<int>() :> IDeltaLog<int>)
        let! _ = spine.CommitAsync(deltaOf 1 1L)

        let foldReading =
            spine.ErasureAccount.Readings
            |> List.find (fun (o, _) -> o = "the folded state returned by Consolidate()")
            |> snd

        // One commit, no snapshot yet: the fold's 2.322 bits are already on the books. This is
        // §11a's headline as an assertion — the erasure is in the ordinary arithmetic.
        foldReading |> should equal (ErasureCharge.Reading.Complete 2_321_928L)

        let! _ = spine.CommitAsync(deltaOf 1 -1L)

        let after =
            spine.ErasureAccount.Readings
            |> List.find (fun (o, _) -> o = "the folded state returned by Consolidate()")
            |> snd

        after |> should equal (ErasureCharge.Reading.Complete 4_643_856L)
    }

[<Fact>]
let ``truncation is charged at the class the INJECTED backend declares — same code, different bill`` () : Task =
    task {
        let inMemory = spineOver (InMemoryDeltaLog<int>() :> IDeltaLog<int>)
        let! _ = inMemory.CommitAsync(deltaOf 1 1L)
        let! _ = inMemory.CommitAsync(deltaOf 2 1L) // cadence 2 -> snapshot + truncate

        // The observation string is the BACKEND's, inherited verbatim by the composite — so it is
        // read off the spine's own declaration rather than restated here. A test that hard-codes
        // it would be a third copy of the thing this module refuses to keep a second copy of.
        let truncationObservationOf (spine: RecoverableSpine<int>) =
            spine.ErasureProfiles
            |> List.find (fun p -> p.Operation.Contains("snapshot-triggered log truncation", StringComparison.Ordinal))
            |> fun p -> p.Observation

        let charged =
            inMemory.ErasureAccount.Readings
            |> List.tryFind (fun (o, _) -> o = truncationObservationOf inMemory)

        match charged with
        | Some(_, ErasureCharge.Reading.Complete bits) ->
            // `InMemoryDeltaLog.TruncateAsync` is `list.RemoveAll` — fibre 13, 3.700 bits.
            bits |> should equal 3_700_440L
        | other -> failwithf "InMemoryDeltaLog truncation must post a measured charge, got %A" other

        // …and the same code path over a backend whose truncation is a no-op posts a MEASURED
        // zero. Note this is `Complete 0L`, not a `LowerBound` — measured-free and unknown are
        // different readings, which is the whole point.
        use groupCommit = new GroupCommitDiskDeltaLog<int>(tempDirectory (), codec ())
        let noop = spineOver (groupCommit :> IDeltaLog<int>)
        let! _ = noop.CommitAsync(deltaOf 1 1L)
        let! _ = noop.CommitAsync(deltaOf 2 1L)

        let noopCharge =
            noop.ErasureAccount.Readings
            |> List.tryFind (fun (o, _) -> o = truncationObservationOf noop)

        match noopCharge with
        | Some(_, reading) ->
            match reading with
            | ErasureCharge.Reading.Complete bits -> bits |> should equal 0L
            | other -> failwithf "a no-op truncation is measured-free, not unknown; got %A" other
        | None -> failwith "the no-op backend must still post its (zero) row — silence is not a charge"
    }

[<Fact>]
let ``an undeclared backend posts a HOLE, never a zero`` () : Task =
    task {
        // The runtime half of the drift guard: a reflection test over our own assembly cannot
        // reach a caller-supplied `IDeltaLog`, so the composite must refuse to invent a class for
        // one. `UndeclaredDeltaLog` below deliberately does NOT implement `IErasureDeclaring`.
        let spine = spineOver (UndeclaredDeltaLog<int>() :> IDeltaLog<int>)
        let! _ = spine.CommitAsync(deltaOf 1 1L)
        let! _ = spine.CommitAsync(deltaOf 2 1L)

        let holes = spine.ErasureAccount.IncompleteObservations
        holes |> List.isEmpty |> should equal false

        let _, reasons = holes |> List.head
        (snd reasons.[0]) |> should haveSubstring "declares no erasure profile"
    }
