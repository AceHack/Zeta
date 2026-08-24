module Zeta.Tests.DurableDiplomacyRankGateTests

open Xunit
open Zeta.Core

// ── Helpers ────────────────────────────────────────────────────────────────────────────────────────
let private makeCell (shape: string) : YinYang.Cell =
    { YinYang.Remains = DynamicValue.String shape
      YinYang.Acts = Bonsai.Const Bonsai.CNull }

/// A cell that actually EXPOSES capabilities: `Bonsai.Call` names ARE the capability surface
/// (`Diplomacy.capabilitiesOf`). `makeCell` above builds a `Bonsai.Const`, whose surface is
/// EMPTY -- which is why every gate result it produces is `RefusedNoExit`.
let private makeCellWithCaps (shape: string) (names: string list) : YinYang.Cell =
    let acts =
        names
        |> List.fold (fun acc n -> Bonsai.Binary(Bonsai.Add, Bonsai.Call(n, []), acc)) (Bonsai.Const Bonsai.CNull)
    { YinYang.Remains = DynamicValue.String shape
      YinYang.Acts = acts }

let private ZID = "traveler-gate-test"
let private DOMAIN = "hat-coding"

// ── DDRG-1: No rankLedger → gate is open ─────────────────────────────────────────────────────────
[<Fact>]
let ``DDRG-1 No rankLedger — gate is open`` () =
    let a = makeCell "circle"
    let b = makeCell "square"
    let result = DurableDiplomacyRankGate.recordEventGatedDefault a b ZID DOMAIN None
    Assert.True(DurableDiplomacyRankGate.isAllowed result)

// ── DDRG-2: Fresh identity (trustBand = 0.5) is above default threshold (0.3) → gate open ────────
[<Fact>]
let ``DDRG-2 Fresh identity trustBand 0.5 is above default threshold 0.3 — gate open`` () =
    let a = makeCell "circle"
    let b = makeCell "square"
    let ledger = TravelerRankLedger.empty
    let result = DurableDiplomacyRankGate.recordEventGatedDefault a b ZID DOMAIN (Some ledger)
    Assert.True(DurableDiplomacyRankGate.isAllowed result)

// ── DDRG-3: 10 misses → trustBand ≈ 0.08 < 0.3 → gate closed ────────────────────────────────────
[<Fact>]
let ``DDRG-3 10 misses trustBand below threshold — gate closed`` () =
    let a = makeCell "circle"
    let b = makeCell "square"
    let ledger =
        [ for _ in 1..10 -> false ]
        |> List.fold (fun l hit -> TravelerRankLedger.record ZID DOMAIN hit l) TravelerRankLedger.empty
    let tb = TravelerRankLedger.trustBandOf ZID DOMAIN ledger
    Assert.True(tb < 0.3, sprintf "Expected trustBand < 0.3, got %.4f" tb)
    let result = DurableDiplomacyRankGate.recordEventGatedDefault a b ZID DOMAIN (Some ledger)
    Assert.False(DurableDiplomacyRankGate.isAllowed result)

// ── DDRG-4: 10 hits → trustBand ≈ 0.92 > 0.3 → gate open ────────────────────────────────────────
[<Fact>]
let ``DDRG-4 10 hits trustBand above threshold — gate open`` () =
    let a = makeCell "circle"
    let b = makeCell "square"
    let ledger =
        [ for _ in 1..10 -> true ]
        |> List.fold (fun l hit -> TravelerRankLedger.record ZID DOMAIN hit l) TravelerRankLedger.empty
    let result = DurableDiplomacyRankGate.recordEventGatedDefault a b ZID DOMAIN (Some ledger)
    Assert.True(DurableDiplomacyRankGate.isAllowed result)

// ── DDRG-5: RefusedLowTrust carries the actual trustBand and threshold ────────────────────────────
[<Fact>]
let ``DDRG-5 RefusedLowTrust carries actual trustBand and threshold`` () =
    let a = makeCell "circle"
    let b = makeCell "square"
    let ledger =
        [ for _ in 1..10 -> false ]
        |> List.fold (fun l hit -> TravelerRankLedger.record ZID DOMAIN hit l) TravelerRankLedger.empty
    let result = DurableDiplomacyRankGate.recordEventGated a b ZID DOMAIN (Some ledger) 0.3
    match result with
    | DurableDiplomacyRankGate.RefusedLowTrust(tb, threshold) ->
        Assert.InRange(tb, 0.0, 0.3)
        Assert.Equal(0.3, threshold)
    | DurableDiplomacyRankGate.Allowed _ ->
        Assert.Fail("Expected RefusedLowTrust")

// ── DDRG-6: toOutcome maps RefusedLowTrust to RefusedNoExit(false, false) ────────────────────────
[<Fact>]
let ``DDRG-6 toOutcome maps RefusedLowTrust to RefusedNoExit`` () =
    let a = makeCell "circle"
    let b = makeCell "square"
    let ledger =
        [ for _ in 1..10 -> false ]
        |> List.fold (fun l hit -> TravelerRankLedger.record ZID DOMAIN hit l) TravelerRankLedger.empty
    let result = DurableDiplomacyRankGate.recordEventGatedDefault a b ZID DOMAIN (Some ledger)
    let outcome = DurableDiplomacyRankGate.toOutcome result
    Assert.Equal(Diplomacy.RefusedNoExit(false, false), outcome)

// ── DDRG-7: Custom threshold — 0.6 blocks fresh identity ─────────────────────────────────────────
[<Fact>]
let ``DDRG-7 Custom threshold 0.6 blocks fresh identity with trustBand 0.5`` () =
    let a = makeCell "circle"
    let b = makeCell "square"
    let ledger = TravelerRankLedger.empty
    let result = DurableDiplomacyRankGate.recordEventGated a b ZID DOMAIN (Some ledger) 0.6
    Assert.False(DurableDiplomacyRankGate.isAllowed result)

// ── DDRG-8: Domain isolation — low trust in domain A does not block domain B ─────────────────────
[<Fact>]
let ``DDRG-8 Domain isolation — low trust in domain A does not block domain B`` () =
    let a = makeCell "circle"
    let b = makeCell "square"
    let ledger =
        [ for _ in 1..10 -> false ]
        |> List.fold (fun l hit -> TravelerRankLedger.record ZID "domain-A" hit l) TravelerRankLedger.empty
    // Domain B has no observations → fresh prior → trustBand = 0.5 > 0.3
    let result = DurableDiplomacyRankGate.recordEventGated a b ZID "domain-B" (Some ledger) 0.3
    Assert.True(DurableDiplomacyRankGate.isAllowed result, "Domain B should be open even if domain A is closed")

// ── DDRG-9: Allowed result carries the outcome and event ─────────────────────────────────────────
[<Fact>]
let ``DDRG-9 Allowed result carries outcome and event`` () =
    // ARITY. This test used to build capability-LESS cells (`makeCell`), so the gate could only
    // ever return `Allowed(RefusedNoExit …, _)` and the `Negotiated caps` arm below was NEVER
    // EXECUTED. What sat in that arm was `Assert.True(Set.count caps >= 0)` -- a tautology
    // (`Set.count` is non-negative by construction) whose comment claimed "not empty", i.e. a
    // property it did not test -- and the `| RefusedNoExit _ -> ()` arm beside it meant EITHER
    // outcome passed. So the match constrained nothing, and the dead arm made it arity ZERO
    // rather than merely weak. Measured, not supposed: sabotaging `negotiateFreedomFirst` to
    // stop excluding `ExitCapability` left this test GREEN.
    // Capability-bearing cells make the Allowed -> Negotiated path the one actually taken.
    let a = makeCellWithCaps "circle" [ Diplomacy.ExitCapability; "trade" ]
    let b = makeCellWithCaps "square" [ Diplomacy.ExitCapability; "trade" ]
    let result = DurableDiplomacyRankGate.recordEventGatedDefault a b ZID DOMAIN None
    match result with
    | DurableDiplomacyRankGate.Allowed(outcome, event) ->
        Assert.NotNull(event)
        Assert.True(event.Length > 0)
        match outcome with
        | Diplomacy.Negotiated caps ->
            // The gate passes the negotiated set through UNCHANGED: the shared capabilities
            // minus the `ExitCapability` freedom precondition.
            Assert.Equal<Set<string>>(Set.singleton "trade", caps)
        | Diplomacy.RefusedNoExit(aExit, bExit) ->
            Assert.Fail(
                sprintf
                    "both cells expose %s, so the gate must negotiate; got RefusedNoExit(%b,%b)"
                    Diplomacy.ExitCapability
                    aExit
                    bExit
            )
    | DurableDiplomacyRankGate.RefusedLowTrust _ ->
        Assert.Fail("Expected Allowed")
