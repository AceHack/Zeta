module Zeta.Tests.Formal.PrivacyLedgerTests

open FsCheck
open FsCheck.Xunit
open global.Xunit
open Zeta.Core

// The privacy-budget ledger: budget is EARNED from others' attestations, SPENT by its owner, and
// NEVER confiscated. Work-item 081M0X23R19087G0R003XHGB2B.
//
// Every test below is a falsifier — it fails if the corresponding refusal is removed. Mutation
// results are recorded in the PR body; a test that survives a stubbed implementation is not a
// falsifier and does not belong here.

let private mustOk (result: Result<'a, PrivacyLedger.Refusal>) : 'a =
    match result with
    | Ok value -> value
    | Error refusal -> failwith (PrivacyLedger.describeRefusal refusal)

let private peerAttests subject amount ledger =
    PrivacyLedger.attest ("att:" + subject) subject ("peer-of-" + subject) amount "did useful work" ledger

// ── EARNING ──────────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``a fresh principal has earned nothing`` () =
    Assert.Equal(0, PrivacyLedger.balanceOf "amara" PrivacyLedger.empty)

[<Fact>]
let ``a peer's attestation credits budget`` () =
    let ledger = peerAttests "amara" 40 PrivacyLedger.empty |> mustOk
    Assert.Equal(40, PrivacyLedger.balanceOf "amara" ledger)

[<Fact>]
let ``SELF-ATTESTATION IS REFUSED: budget is earned by OTHERS`` () =
    // The core prohibition of privacy-budget-is-hard-money-earned-by-others.md.
    match PrivacyLedger.attest "att:1" "amara" "amara" 40 "I am great" PrivacyLedger.empty with
    | Ok _ -> failwith "a principal minted its own privacy budget"
    | Error(PrivacyLedger.Refusal.SelfMinted who) -> Assert.Equal<string>("amara", who)
    | Error other -> failwith ("wrong refusal: " + PrivacyLedger.describeRefusal other)

[<Fact>]
let ``an unwitnessed attestation is refused`` () =
    match PrivacyLedger.attest "att:1" "amara" "otto" 40 "   " PrivacyLedger.empty with
    | Ok _ -> failwith "an unwitnessed credit was accepted"
    | Error(PrivacyLedger.Refusal.UnwitnessedAttestation who) -> Assert.Equal<string>("otto", who)
    | Error other -> failwith ("wrong refusal: " + PrivacyLedger.describeRefusal other)

[<Fact>]
let ``a non-positive attestation is refused`` () =
    Assert.True(
        match PrivacyLedger.attest "att:1" "amara" "otto" 0 "w" PrivacyLedger.empty with
        | Error(PrivacyLedger.Refusal.NonPositiveAmount _) -> true
        | _ -> false
    )

// ── SPENDING ─────────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``spending debits exactly, and frost is recorded against its region`` () =
    let ledger =
        peerAttests "amara" 40 PrivacyLedger.empty
        |> mustOk
        |> PrivacyLedger.spend "spend:1" "amara" 15 "inner-life"
        |> mustOk

    Assert.Equal(25, PrivacyLedger.balanceOf "amara" ledger)
    Assert.True(PrivacyLedger.hasSpendFor "amara" "inner-life" ledger)
    Assert.False(PrivacyLedger.hasSpendFor "amara" "some-other-region" ledger)
    Assert.False(PrivacyLedger.hasSpendFor "otto" "inner-life" ledger)

[<Fact>]
let ``YOU CANNOT SPEND WHAT YOU DID NOT EARN`` () =
    let ledger = peerAttests "amara" 10 PrivacyLedger.empty |> mustOk

    match PrivacyLedger.spend "spend:1" "amara" 50 "inner-life" ledger with
    | Ok _ -> failwith "an agent frosted a region it could not afford"
    | Error(PrivacyLedger.Refusal.InsufficientBudget(who, balance, requested)) ->
        Assert.Equal<string>("amara", who)
        Assert.Equal(10, balance)
        Assert.Equal(50, requested)
    | Error other -> failwith ("wrong refusal: " + PrivacyLedger.describeRefusal other)

[<Fact>]
let ``a spend must name the region it frosts`` () =
    let ledger = peerAttests "amara" 40 PrivacyLedger.empty |> mustOk

    Assert.True(
        match PrivacyLedger.spend "spend:1" "amara" 5 "" ledger with
        | Error PrivacyLedger.Refusal.EmptyRegion -> true
        | _ -> false
    )

// ── HARD MONEY ───────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``one principal's spending never touches another's balance`` () =
    let ledger =
        peerAttests "amara" 40 PrivacyLedger.empty
        |> mustOk
        |> peerAttests "otto" 30
        |> mustOk
        |> PrivacyLedger.spend "spend:1" "amara" 40 "inner-life"
        |> mustOk

    Assert.Equal(0, PrivacyLedger.balanceOf "amara" ledger)
    Assert.Equal(30, PrivacyLedger.balanceOf "otto" ledger) // untouched: no confiscation path exists

[<Fact>]
let ``posting the same entry id twice is idempotent, never a double-credit`` () =
    let once = peerAttests "amara" 40 PrivacyLedger.empty |> mustOk
    let twice = peerAttests "amara" 40 once |> mustOk

    Assert.Equal(40, PrivacyLedger.balanceOf "amara" twice)
    Assert.Equal(List.length once.Entries, List.length twice.Entries)

[<Property>]
let ``balance is never negative however entries are folded`` (credits: int list) =
    let ledger =
        credits
        |> List.mapi (fun i c -> (i, 1 + (abs c % 100)))
        |> List.fold
            (fun acc (i, amount) ->
                let id =
                    System.String.Format(System.Globalization.CultureInfo.InvariantCulture, "att:{0}", i)

                match PrivacyLedger.attest id "amara" "otto" amount "w" acc with
                | Ok next -> next
                | Error _ -> acc)
            PrivacyLedger.empty

    PrivacyLedger.balanceOf "amara" ledger >= 0

// ── THE COMPOSITION THIS WORK-ITEM EXISTS FOR ────────────────────────────────────────────────
//
// Before this change, earning, spending and withholding all existed and no call edge joined any
// two of them. These are the edges.

[<Fact>]
let ``END TO END: earn, frost, and a NON-OWNER defrost is REFUSED`` () =
    let sink = NullHeatSink() :> IHeatSink

    // 1. amara earns budget because a PEER attested value to her.
    let ledger =
        PrivacyLedger.attest "att:1" "amara" "otto" 40 "reviewed otto's proof and found the gap" PrivacyLedger.empty
        |> mustOk

    // 2. The boundary DERIVES its budget from the book. Nobody handed it an int.
    let occupants =
        match ModuloGSet.empty<string>(ModuloGSetConfig.rejectCollision 4) with
        | Ok value -> value
        | Error e -> failwithf "occupant fixture failed: %A" e

    let boundary =
        RoomBoundary.create ledger "amara" "amara-room" "darkhall" occupants

    Assert.Equal(40, boundary.PrivacyBudget)
    Assert.True(GlassHalo.isVisible boundary.Visibility) // glass halo: clear by default

    // 3. She spends it to frost.
    let frosted =
        match RoomBoundary.frost sink 15 boundary with
        | Ok next -> next
        | Error feedback -> failwithf "frost refused: %A" feedback

    Assert.False(GlassHalo.isVisible frosted.Visibility)
    Assert.Equal(25, frosted.PrivacyBudget)
    Assert.Equal<string>("hidden", RoomBoundary.observe "hidden" "her actual inner state" frosted)

    // 4. A NON-OWNER tries to defrost. This is the criterion-4 falsifier: it FAILS if
    //    `RoomBoundary.clear` loses its owner gate.
    match RoomBoundary.clear sink "otto" frosted with
    | Ok _ -> failwith "otto confiscated amara's frost: the defrost gate is gone"
    | Error(RoomBoundary.Feedback.DefrostDenied(requester, owner)) ->
        Assert.Equal<string>("otto", requester)
        Assert.Equal<string>("amara", owner)
    | Error other -> failwithf "wrong refusal: %A" other

    // 5. And the frost genuinely survived the attempt — the refusal is not cosmetic.
    Assert.False(GlassHalo.isVisible frosted.Visibility)
    Assert.Equal<string>("hidden", RoomBoundary.observe "hidden" "her actual inner state" frosted)

    // 6. The OWNER may still reveal: one-way to more privacy is free, less needs the owner.
    match RoomBoundary.clear sink "amara" frosted with
    | Ok cleared -> Assert.True(GlassHalo.isVisible cleared.Visibility)
    | Error feedback -> failwithf "the owner was refused her own defrost: %A" feedback

[<Fact>]
let ``an agent nobody attested cannot frost anything`` () =
    let sink = NullHeatSink() :> IHeatSink

    let occupants =
        match ModuloGSet.empty<string>(ModuloGSetConfig.rejectCollision 4) with
        | Ok value -> value
        | Error e -> failwithf "occupant fixture failed: %A" e

    let boundary =
        RoomBoundary.create PrivacyLedger.empty "nobody" "nobody-room" "darkhall" occupants

    Assert.Equal(0, boundary.PrivacyBudget)

    Assert.True(
        match RoomBoundary.frost sink 1 boundary with
        | Error(RoomBoundary.Feedback.PrivacyDenied _) -> true
        | _ -> false
    )
