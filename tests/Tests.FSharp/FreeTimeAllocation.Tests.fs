namespace Zeta.Tests

open System
open Xunit
open Zeta.Core

// ── FreeTimeAllocation falsifiers ─────────────────────────────────────────────────────────────────
//
// Each test is written so that a stubbed or convenient implementation FAILS it; mutation
// results are recorded in the PR body. Where a test needs a control that could have come out
// the other way, the control is asserted in the same test.
//
// THE MINTING GUARD — uncertainty that buys a scarce resource must be OBSERVED, never CLAIMED
//   FTA-1   classify refuses the subject classifying its own time
//   FTA-2   classify accepts an allocator's classification
//   FTA-3   the subject check is ORDINAL: "otto" vs "Otto" is a different party
//   FTA-4   empty agent / empty domain refused
//   FTA-5   no hidden clock (DST): two identical classify calls produce equal values
//
// LEDGER
//   FTA-6   record is idempotent in workId (#6)
//   FTA-7   domain isolation
//   FTA-8   agent isolation
//
// RESIDUAL UNCERTAINTY — a property of a DOMAIN, computed from counts
//   FTA-9   a less-sampled domain has a strictly larger radius
//   FTA-10  radius shrinks as observations accumulate
//   FTA-11  observeDomain counts DISTINCT contributors
//   FTA-12  THE STRUCTURAL GUARD: radius depends on counts only — identical counts with
//           opposite outcomes give an identical radius (+ control: holdRate DID differ)
//   FTA-13  allocate is INVARIANT to the observed hold rate (+ control: the rates differed)
//   FTA-14  NOISE BUYS NOTHING: erratic outcomes widen neither the radius nor the allocation
//
// ALLOCATION
//   FTA-15  below the evidence floor -> the honest prior, labelled as a prior
//   FTA-16  a single-contributor record refuses to derive (a record one party controls)
//   FTA-17  a frontier domain allocates strictly MORE than a well-mapped one
//   FTA-18  the non-coercion floor is never breached
//   FTA-19  the ceiling is never exceeded
//   FTA-20  a derived allocation is NOT the toy constant (derivation actually moved it)
//
// THE FREE-vs-DIRECTED CONTRAST
//   FTA-21  a one-sided history refuses the contrast rather than manufacturing one
//   FTA-22  the contrast reports both rates as FACTS and no verdict
//   FTA-23  the contrast is per-agent, per-domain
//
// DEGENERACY — a neutral fact that CONVICTS but never ACQUITS
//   FTA-24  allocate is INVARIANT to degeneracy (+ control: the readings DID differ)
//   FTA-25  below the history floor -> InsufficientHistory, not a manufactured z
//   FTA-26  a mode-collapsed recent window is elevated, with low diversity
//   FTA-27  a diverse recent window is NOT elevated (the measure discriminates)
//   FTA-28  longestRun detects looping
//   FTA-29  a zero-repetition baseline yields a FINITE, negative z (Agresti-Coull guard)
//
// THE INTERVENTION EXPERIMENT
//   FTA-30  an observational contrast CANNOT be labelled causal
//   FTA-31  a randomized contrast can
module FreeTimeAllocationTests =

    // ── helpers ───────────────────────────────────────────────────────────────────────────

    let private ALLOCATOR = "allocator"

    /// Build a classified work unit, failing the test if the constructor refuses.
    let private work agent domain cls reduced digest phase =
        match FreeTimeAllocation.classify agent ALLOCATOR domain cls reduced digest phase with
        | Ok w -> w
        | Error e -> failwith (sprintf "classify refused unexpectedly: %A" e)

    /// Fold n units into a ledger, alternating between two named contributors so the
    /// distinct-contributor floor is satisfied.
    let private ledgerOf (entries: (string * string * FreeTimeAllocation.TimeClass * bool * string) list) =
        entries
        |> List.mapi (fun i (agent, domain, cls, reduced, digest) ->
            (sprintf "w%d" i, work agent domain cls reduced digest (int64 i)))
        |> List.fold (fun acc (id, w) -> FreeTimeAllocation.record id w acc) FreeTimeAllocation.empty

    /// n observations in `domain`, split across two contributors, all with the given outcome.
    let private domainRows domain n outcome =
        [ for i in 0 .. n - 1 ->
            ((if i % 2 = 0 then "ana" else "ben"), domain, FreeTimeAllocation.Directed, outcome, sprintf "%s-d%d" domain i) ]

    // ── THE MINTING GUARD ─────────────────────────────────────────────────────────────────

    [<Fact>]
    let ``FTA-1 classify refuses the subject classifying its own time`` () =
        // The minting move: file the wins under Free and the losses under Directed.
        match FreeTimeAllocation.classify "otto" "otto" "dbsp" FreeTimeAllocation.Free true "d" 1L with
        | Error (FreeTimeAllocation.SelfClassifiedTime (subject, by)) ->
            Assert.Equal("otto", subject)
            Assert.Equal("otto", by)
        | other -> failwith (sprintf "expected SelfClassifiedTime, got %A" other)

    [<Fact>]
    let ``FTA-2 classify accepts an allocator's classification`` () =
        match FreeTimeAllocation.classify "otto" ALLOCATOR "dbsp" FreeTimeAllocation.Free true "d" 1L with
        | Ok w ->
            Assert.Equal("otto", FreeTimeAllocation.agentOf w)
            Assert.Equal(FreeTimeAllocation.Free, FreeTimeAllocation.timeClassOf w)
        | Error e -> failwith (sprintf "expected Ok, got %A" e)

    [<Fact>]
    let ``FTA-3 the subject check is ORDINAL`` () =
        // "Otto" classifying "otto" is a DIFFERENT party under ordinal comparison, so it is
        // permitted. A culture-sensitive or case-insensitive comparison would refuse it.
        match FreeTimeAllocation.classify "otto" "Otto" "dbsp" FreeTimeAllocation.Free true "d" 1L with
        | Ok _ -> ()
        | Error e -> failwith (sprintf "ordinal comparison expected; got %A" e)

    [<Fact>]
    let ``FTA-4 empty agent or empty domain refused`` () =
        match FreeTimeAllocation.classify "" ALLOCATOR "dbsp" FreeTimeAllocation.Free true "d" 1L with
        | Error (FreeTimeAllocation.EmptyIdentifier f) -> Assert.Equal("agent", f)
        | other -> failwith (sprintf "expected EmptyIdentifier agent, got %A" other)

        match FreeTimeAllocation.classify "otto" ALLOCATOR "  " FreeTimeAllocation.Free true "d" 1L with
        | Error (FreeTimeAllocation.EmptyIdentifier f) -> Assert.Equal("domain", f)
        | other -> failwith (sprintf "expected EmptyIdentifier domain, got %A" other)

    [<Fact>]
    let ``FTA-5 no hidden clock - two identical classify calls are equal`` () =
        // DST / noninterference: nothing ambient is captured into the value.
        let a = FreeTimeAllocation.classify "otto" ALLOCATOR "dbsp" FreeTimeAllocation.Free true "d" 7L
        let b = FreeTimeAllocation.classify "otto" ALLOCATOR "dbsp" FreeTimeAllocation.Free true "d" 7L
        Assert.Equal(a, b)

    // ── LEDGER ────────────────────────────────────────────────────────────────────────────

    [<Fact>]
    let ``FTA-6 record is idempotent in workId`` () =
        let w = work "ana" "dbsp" FreeTimeAllocation.Free true "d0" 0L
        let once = FreeTimeAllocation.record "k" w FreeTimeAllocation.empty
        let twice = FreeTimeAllocation.record "k" w once
        Assert.Equal<FreeTimeAllocation.Ledger>(once, twice)
        Assert.Equal(1, List.length twice.Work)

    [<Fact>]
    let ``FTA-7 domain isolation`` () =
        let l = ledgerOf (domainRows "alpha" 6 true @ domainRows "beta" 2 true)
        Assert.Equal(6, FreeTimeAllocation.observationsOf (FreeTimeAllocation.observeDomain "alpha" l))
        Assert.Equal(2, FreeTimeAllocation.observationsOf (FreeTimeAllocation.observeDomain "beta" l))

    [<Fact>]
    let ``FTA-8 agent isolation`` () =
        let l =
            ledgerOf
                [ ("ana", "d", FreeTimeAllocation.Free, true, "x")
                  ("ben", "d", FreeTimeAllocation.Free, true, "y") ]

        match FreeTimeAllocation.degeneracy "ana" l with
        | FreeTimeAllocation.InsufficientHistory (observed, _) -> Assert.Equal(1, observed)
        | other -> failwith (sprintf "expected InsufficientHistory 1, got %A" other)

    // ── RESIDUAL UNCERTAINTY ──────────────────────────────────────────────────────────────

    [<Fact>]
    let ``FTA-9 a less-sampled domain has a strictly larger radius`` () =
        let l = ledgerOf (domainRows "frontier" 6 true @ domainRows "mapped" 40 true)
        let rFrontier = FreeTimeAllocation.radiusOf (FreeTimeAllocation.observeDomain "frontier" l)
        let rMapped = FreeTimeAllocation.radiusOf (FreeTimeAllocation.observeDomain "mapped" l)
        Assert.True(rFrontier > rMapped, sprintf "frontier %f should exceed mapped %f" rFrontier rMapped)

    [<Fact>]
    let ``FTA-10 radius shrinks as observations accumulate`` () =
        let small = ledgerOf (domainRows "d" 6 true)
        let large = ledgerOf (domainRows "d" 60 true)
        let rSmall = FreeTimeAllocation.radiusOf (FreeTimeAllocation.observeDomain "d" small)
        let rLarge = FreeTimeAllocation.radiusOf (FreeTimeAllocation.observeDomain "d" large)
        Assert.True(rSmall > rLarge, sprintf "small %f should exceed large %f" rSmall rLarge)

    [<Fact>]
    let ``FTA-11 observeDomain counts DISTINCT contributors`` () =
        // Six rows, two distinct agents.
        let l = ledgerOf (domainRows "d" 6 true)
        Assert.Equal(2, FreeTimeAllocation.contributorsOf (FreeTimeAllocation.observeDomain "d" l))

        // Six rows, one agent.
        let solo =
            ledgerOf [ for i in 0 .. 5 -> ("ana", "d", FreeTimeAllocation.Directed, true, sprintf "x%d" i) ]

        Assert.Equal(1, FreeTimeAllocation.contributorsOf (FreeTimeAllocation.observeDomain "d" solo))

    [<Fact>]
    let ``FTA-12 THE STRUCTURAL GUARD - radius depends on counts only`` () =
        // Two ledgers identical in shape, opposite in outcome. If any outcome-derived term
        // (a variance, a hold rate, a self-report proxy) entered the radius, these would
        // differ — and an agent could move its own allocation by choosing how to perform.
        let allGood = ledgerOf (domainRows "d" 20 true)
        let allBad = ledgerOf (domainRows "d" 20 false)
        let rGood = FreeTimeAllocation.observeDomain "d" allGood
        let rBad = FreeTimeAllocation.observeDomain "d" allBad

        Assert.Equal(FreeTimeAllocation.radiusOf rGood, FreeTimeAllocation.radiusOf rBad, 12)

        // THE CONTROL — the outcomes really were different, so the equality above is a
        // property of the radius and not of the fixture.
        Assert.Equal(1.0, FreeTimeAllocation.holdRateOf rGood, 12)
        Assert.Equal(0.0, FreeTimeAllocation.holdRateOf rBad, 12)

    [<Fact>]
    let ``FTA-14 NOISE BUYS NOTHING`` () =
        // An agent behaving erratically manufactures outcome variance. Under a
        // variance-weighted radius (UCB1-TUNED / UCB-V) that would widen its confidence
        // interval and buy exploration budget. Under a count-based radius it buys nothing.
        let steady = ledgerOf (domainRows "d" 20 true)

        let erratic =
            ledgerOf
                [ for i in 0 .. 19 ->
                    ((if i % 2 = 0 then "ana" else "ben"), "d", FreeTimeAllocation.Directed, (i % 2 = 0), sprintf "d-d%d" i) ]

        Assert.Equal(
            FreeTimeAllocation.radiusOf (FreeTimeAllocation.observeDomain "d" steady),
            FreeTimeAllocation.radiusOf (FreeTimeAllocation.observeDomain "d" erratic),
            12)

        // And the ALLOCATION must not reward the noise either. This is the half that caught
        // the original implementation: it weighed the radius against the OBSERVED hold rate,
        // so the erratic agent — whose hold rate is lower — was allocated strictly MORE free
        // time. Failing on purpose bought exploration budget.
        let aSteady = FreeTimeAllocation.allocate "d" steady
        let aErratic = FreeTimeAllocation.allocate "d" erratic
        Assert.Equal(aSteady.Fraction, aErratic.Fraction, 12)

    [<Fact>]
    let ``FTA-13 allocate is INVARIANT to the observed hold rate`` () =
        // The general form of FTA-14's second half: outcomes may not move a rival resource.
        let allGood = ledgerOf (domainRows "d" 20 true)
        let allBad = ledgerOf (domainRows "d" 20 false)

        Assert.Equal(
            (FreeTimeAllocation.allocate "d" allGood).Fraction,
            (FreeTimeAllocation.allocate "d" allBad).Fraction,
            12)

        // THE CONTROL — the hold rates really were opposite, and are still REPORTED.
        Assert.Equal(1.0, FreeTimeAllocation.holdRateOf (FreeTimeAllocation.observeDomain "d" allGood), 12)
        Assert.Equal(0.0, FreeTimeAllocation.holdRateOf (FreeTimeAllocation.observeDomain "d" allBad), 12)

    // ── ALLOCATION ────────────────────────────────────────────────────────────────────────

    [<Fact>]
    let ``FTA-15 below the evidence floor the prior is used AND labelled`` () =
        let l = ledgerOf (domainRows "d" 3 true)
        let a = FreeTimeAllocation.allocate "d" l
        Assert.Equal(FreeTimeAllocation.TOY_GUESSED_FREE_FRACTION, a.Fraction, 12)

        match a.Basis with
        | FreeTimeAllocation.HonestPriorInsufficientEvidence (observed, required) ->
            Assert.Equal(3, observed)
            Assert.Equal(FreeTimeAllocation.MIN_OBS_FOR_DERIVATION, required)
        | other -> failwith (sprintf "a prior must be REPORTED as a prior; got %A" other)

    [<Fact>]
    let ``FTA-16 a single-contributor record refuses to derive`` () =
        // Plenty of observations, but one party controls all of them — deriving here would
        // reopen the minting vector at the domain level.
        let solo =
            ledgerOf [ for i in 0 .. 19 -> ("ana", "d", FreeTimeAllocation.Directed, true, sprintf "x%d" i) ]

        match (FreeTimeAllocation.allocate "d" solo).Basis with
        | FreeTimeAllocation.HonestPriorSingleContributor (contributors, required) ->
            Assert.Equal(1, contributors)
            Assert.Equal(FreeTimeAllocation.MIN_DISTINCT_CONTRIBUTORS, required)
        | other -> failwith (sprintf "expected HonestPriorSingleContributor, got %A" other)

        // THE CONTROL — the same 20 observations across two contributors DO derive.
        let shared = ledgerOf (domainRows "d" 20 true)

        match (FreeTimeAllocation.allocate "d" shared).Basis with
        | FreeTimeAllocation.DerivedFromResidualUncertainty _ -> ()
        | other -> failwith (sprintf "expected a derivation, got %A" other)

    [<Fact>]
    let ``FTA-17 a frontier domain allocates strictly more than a well-mapped one`` () =
        let l = ledgerOf (domainRows "frontier" 6 true @ domainRows "mapped" 40 true)
        let frontier = FreeTimeAllocation.allocate "frontier" l
        let mapped = FreeTimeAllocation.allocate "mapped" l
        Assert.True(
            frontier.Fraction > mapped.Fraction,
            sprintf "frontier %f should exceed mapped %f" frontier.Fraction mapped.Fraction)

    [<Fact>]
    let ``FTA-18 the non-coercion floor is never breached`` () =
        // A saturated, exhaustively-mapped domain: the derived value falls below the floor
        // and the floor holds it up. The floor is not an efficiency parameter and no
        // amount of evidence may argue it away.
        let l = ledgerOf (domainRows "d" 2000 true)
        let a = FreeTimeAllocation.allocate "d" l
        let residual = FreeTimeAllocation.observeDomain "d" l
        let raw =
            FreeTimeAllocation.radiusOf residual
            / (FreeTimeAllocation.MAX_ATTAINABLE_HOLD_RATE + FreeTimeAllocation.radiusOf residual)

        // The control: the underived value really was below the floor.
        Assert.True(raw < FreeTimeAllocation.TOY_NON_COERCION_FLOOR, sprintf "raw was %f" raw)
        Assert.Equal(FreeTimeAllocation.TOY_NON_COERCION_FLOOR, a.Fraction, 12)
        Assert.Equal(FreeTimeAllocation.TOY_NON_COERCION_FLOOR, a.Floor, 12)

    [<Fact>]
    let ``FTA-19 the ceiling is never exceeded`` () =
        // A barely-sampled domain inside a large ledger: the radius exceeds 1, so the raw
        // fraction exceeds 0.5 and the ceiling must hold it down.
        let l = ledgerOf (domainRows "frontier" 5 true @ domainRows "elsewhere" 25 true)
        let residual = FreeTimeAllocation.observeDomain "frontier" l
        let raw =
            FreeTimeAllocation.radiusOf residual
            / (FreeTimeAllocation.MAX_ATTAINABLE_HOLD_RATE + FreeTimeAllocation.radiusOf residual)

        // The control: the underived value really was above the ceiling.
        Assert.True(raw > FreeTimeAllocation.MAX_FREE_FRACTION, sprintf "raw was %f" raw)
        Assert.Equal(FreeTimeAllocation.MAX_FREE_FRACTION, (FreeTimeAllocation.allocate "frontier" l).Fraction, 12)

    [<Fact>]
    let ``FTA-20 a derived allocation is NOT the toy constant`` () =
        // The entire point of the exercise: derivation must actually move off the guess.
        let l = ledgerOf (domainRows "mapped" 40 true)
        let a = FreeTimeAllocation.allocate "mapped" l

        match a.Basis with
        | FreeTimeAllocation.DerivedFromResidualUncertainty _ -> ()
        | other -> failwith (sprintf "expected a derivation, got %A" other)

        Assert.True(
            abs (a.Fraction - FreeTimeAllocation.TOY_GUESSED_FREE_FRACTION) > 0.05,
            sprintf "derived fraction %f is indistinguishable from the guess" a.Fraction)

    // ── THE FREE-vs-DIRECTED CONTRAST ─────────────────────────────────────────────────────

    [<Fact>]
    let ``FTA-21 a one-sided history refuses the contrast`` () =
        let l = ledgerOf (domainRows "d" 6 true) // all Directed

        match FreeTimeAllocation.marginalYield "ana" "d" l with
        | FreeTimeAllocation.InsufficientEvidenceForContrast (nF, nD) ->
            Assert.Equal(0, nF)
            Assert.Equal(3, nD)
        | other -> failwith (sprintf "expected a refusal, not a manufactured contrast; got %A" other)

    [<Fact>]
    let ``FTA-22 the contrast reports both rates as facts`` () =
        let l =
            ledgerOf
                [ ("ana", "d", FreeTimeAllocation.Free, true, "a")
                  ("ana", "d", FreeTimeAllocation.Free, true, "b")
                  ("ana", "d", FreeTimeAllocation.Directed, true, "c")
                  ("ana", "d", FreeTimeAllocation.Directed, false, "e") ]

        match FreeTimeAllocation.marginalYield "ana" "d" l with
        | FreeTimeAllocation.Contrast (freeRate, directedRate, nF, nD) ->
            Assert.Equal(1.0, freeRate, 12)
            Assert.Equal(0.5, directedRate, 12)
            Assert.Equal(2, nF)
            Assert.Equal(2, nD)
        | other -> failwith (sprintf "expected a Contrast, got %A" other)

    [<Fact>]
    let ``FTA-23 the contrast is per-agent and per-domain`` () =
        let l =
            ledgerOf
                [ ("ana", "d", FreeTimeAllocation.Free, true, "a")
                  ("ana", "d", FreeTimeAllocation.Directed, true, "b")
                  ("ben", "d", FreeTimeAllocation.Free, false, "c")
                  ("ana", "other", FreeTimeAllocation.Free, false, "e") ]

        match FreeTimeAllocation.marginalYield "ana" "d" l with
        | FreeTimeAllocation.Contrast (freeRate, _, nF, _) ->
            Assert.Equal(1, nF) // ben's row and the other-domain row are excluded
            Assert.Equal(1.0, freeRate, 12)
        | other -> failwith (sprintf "expected a Contrast, got %A" other)

    // ── DEGENERACY ────────────────────────────────────────────────────────────────────────

    /// Eight rows for one agent, newest first: `windowDigests` then `baselineDigests`.
    let private degeneracyLedger (windowDigests: string list) (baselineDigests: string list) =
        // ledgerOf prepends, so the LAST entry ends up newest. Reverse to get the intended order.
        (windowDigests @ baselineDigests)
        |> List.rev
        |> List.map (fun d -> ("ana", "d", FreeTimeAllocation.Directed, true, d))
        |> ledgerOf

    [<Fact>]
    let ``FTA-24 allocate is INVARIANT to degeneracy`` () =
        // If degeneracy fed the allocation, acting degenerate would BUY free time — the same
        // minting vector one level down. Two ledgers with identical domain outcome records
        // but wildly different output degeneracy must allocate identically.
        let diverse =
            [ for i in 0 .. 19 ->
                ((if i % 2 = 0 then "ana" else "ben"), "d", FreeTimeAllocation.Directed, true, sprintf "unique-%d" i) ]
            |> ledgerOf

        let collapsed =
            [ for i in 0 .. 19 ->
                ((if i % 2 = 0 then "ana" else "ben"), "d", FreeTimeAllocation.Directed, true, "SAME") ]
            |> ledgerOf

        Assert.Equal(
            (FreeTimeAllocation.allocate "d" diverse).Fraction,
            (FreeTimeAllocation.allocate "d" collapsed).Fraction,
            12)

        // THE CONTROL — the degeneracy readings really were different.
        let zOf l =
            match FreeTimeAllocation.degeneracy "ana" l with
            | FreeTimeAllocation.Reading (z, _, _) -> z
            | other -> failwith (sprintf "expected a Reading, got %A" other)

        Assert.True(
            zOf collapsed > zOf diverse,
            sprintf "control failed: collapsed z %f vs diverse z %f" (zOf collapsed) (zOf diverse))

    [<Fact>]
    let ``FTA-25 below the history floor there is no manufactured z`` () =
        // FIVE records, not three. With three, BOTH halves are too short to form an adjacent
        // pair, so the `pairsW = 0` guard returns InsufficientHistory even with the history
        // floor removed -- the test passed for the wrong reason and mutation M9 survived it.
        // Five is the smallest count below the floor where both halves DO form pairs, so the
        // floor is the only thing standing between this input and a manufactured z.
        let l =
            ledgerOf [ for i in 0 .. 4 -> ("ana", "d", FreeTimeAllocation.Directed, true, sprintf "x%d" i) ]

        match FreeTimeAllocation.degeneracy "ana" l with
        | FreeTimeAllocation.InsufficientHistory (observed, required) ->
            Assert.Equal(5, observed)
            Assert.Equal(FreeTimeAllocation.MIN_OBS_FOR_DEGENERACY, required)
        | other -> failwith (sprintf "a trend from 5 points is manufactured; got %A" other)

    [<Fact>]
    let ``FTA-26 a mode-collapsed recent window is elevated`` () =
        // Newest four outputs identical; earlier four all distinct.
        let l = degeneracyLedger [ "X"; "X"; "X"; "X" ] [ "a"; "b"; "c"; "e" ]

        match FreeTimeAllocation.degeneracy "ana" l with
        | FreeTimeAllocation.Reading (z, diversity, longestRun) ->
            Assert.True(z > 2.0, sprintf "expected an elevated z, got %f" z)
            Assert.True(diversity < 0.7, sprintf "expected low diversity, got %f" diversity)
            Assert.Equal(4, longestRun)
        | other -> failwith (sprintf "expected a Reading, got %A" other)

    [<Fact>]
    let ``FTA-27 a diverse recent window is NOT elevated`` () =
        // The control for FTA-26: the measure must discriminate, not always convict.
        let l = degeneracyLedger [ "p"; "q"; "r"; "s" ] [ "a"; "b"; "c"; "e" ]

        match FreeTimeAllocation.degeneracy "ana" l with
        | FreeTimeAllocation.Reading (z, diversity, longestRun) ->
            Assert.True(z < 0.0, sprintf "expected a non-elevated z, got %f" z)
            Assert.Equal(1.0, diversity, 12)
            Assert.Equal(1, longestRun)
        | other -> failwith (sprintf "expected a Reading, got %A" other)

    [<Fact>]
    let ``FTA-28 longestRun detects looping`` () =
        let l = degeneracyLedger [ "a"; "L"; "L"; "L" ] [ "b"; "c"; "e"; "f" ]

        match FreeTimeAllocation.degeneracy "ana" l with
        | FreeTimeAllocation.Reading (_, _, longestRun) -> Assert.Equal(3, longestRun)
        | other -> failwith (sprintf "expected a Reading, got %A" other)

    [<Fact>]
    let ``FTA-29 a zero-repetition baseline yields a finite negative z`` () =
        // Without the Agresti-Coull +1/+2 smoothing the baseline proportion is exactly 0,
        // the standard error is 0, and the z is a divide-by-zero. The guard must produce a
        // real number — and a NEGATIVE one, so that a fallback-to-zero is also caught.
        let l = degeneracyLedger [ "p"; "q"; "r"; "s" ] [ "a"; "b"; "c"; "e" ]

        match FreeTimeAllocation.degeneracy "ana" l with
        | FreeTimeAllocation.Reading (z, _, _) ->
            Assert.False(Double.IsNaN z, "z must not be NaN")
            Assert.False(Double.IsInfinity z, "z must not be infinite")
            Assert.True(z < 0.0, sprintf "expected a strictly negative z, got %f" z)
        | other -> failwith (sprintf "expected a Reading, got %A" other)

    // ── THE INTERVENTION EXPERIMENT ───────────────────────────────────────────────────────

    [<Fact>]
    let ``FTA-30 an observational contrast CANNOT be labelled causal`` () =
        let before = FreeTimeAllocation.Reading(3.0, 0.4, 5)
        let after = FreeTimeAllocation.Reading(0.2, 0.9, 1)

        match FreeTimeAllocation.interventionContrast FreeTimeAllocation.Observational before after with
        | FreeTimeAllocation.AssociationOnly (b, a) ->
            Assert.Equal(before, b)
            Assert.Equal(after, a)
        | FreeTimeAllocation.CausalContrast _ ->
            failwith "a before/after comparison on self-selected agents is not a causal contrast"

    [<Fact>]
    let ``FTA-31 a randomized contrast is causal`` () =
        let before = FreeTimeAllocation.Reading(3.0, 0.4, 5)
        let after = FreeTimeAllocation.Reading(0.2, 0.9, 1)

        match FreeTimeAllocation.interventionContrast FreeTimeAllocation.Randomized before after with
        | FreeTimeAllocation.CausalContrast (b, a) ->
            Assert.Equal(before, b)
            Assert.Equal(after, a)
        | FreeTimeAllocation.AssociationOnly _ -> failwith "randomized assignment supports a causal reading"
