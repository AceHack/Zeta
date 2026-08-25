namespace Zeta.Core

open System

/// **`PrivacyLedger` — the append-only book that makes privacy budget EARNED, never minted.**
///
/// `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md` says budget is
/// *"CREDITED only by others' value attestations (never self-minted)"* and names exactly three
/// operations, of which only two are permitted: **spend** (the owner frosts a region) ·
/// **stake** (the owner risks it) · **confiscate** (anyone else — *never*).
///
/// Before this module the rule had no mechanism. `RoomBoundary.create` took the budget as a
/// caller-supplied `int`, which is self-minting with extra steps: any caller could hand itself
/// any balance. This module is the smallest thing that makes the rule's sentence true and
/// **falsifiable when it is not**.
///
/// **The hard-money guarantee is stated in the TYPE, not in a check.** `Body` has exactly two
/// cases. There is **no confiscate case**, so no code — hostile, buggy, or well-meaning — can
/// express taking another principal's budget. The absence is the guarantee, the same way
/// `BroadcastMind` has no field that can hold frosted content.
///
/// **What it refuses** (each refusal is a falsifier — a ledger that cannot refuse is a text file):
///   • an attestation whose subject IS its attestor  → `SelfMinted`, the rule's core prohibition
///   • a non-positive credit or debit               → privacy is never free
///   • an unwitnessed attestation                   → an unwitnessed credit is unmetered
///   • a spend exceeding the balance                → you cannot spend what you did not earn
///
/// **Idempotent by entry id** (discipline #6): posting the same id twice is a no-op, never a
/// double-credit. Balance is an order-independent fold (sum of credits less debits), so replay
/// and reorder both land on the same number — DST-replayable (§7), and commutative like the
/// G-Counter this economy has always been described as.
///
/// **COOPERATIVE, NOT CRYPTOGRAPHIC.** This is the honest boundary and it must not be blurred.
/// An `Attestation` here is a *recorded claim*, not a signed one: nothing in this module verifies
/// that the named attestor authored the entry, and a principal with write access to the ledger
/// can author entries in any name. What this buys is frost that is **earned, priced and
/// owner-only** — real properties, mechanically enforced against honest and buggy callers.
/// What it does NOT buy is **unconfiscatability against a hostile holder of the ledger file**;
/// that needs signatures rooted in hardware the fleet does not yet have. Do not describe the
/// first as the second.
[<RequireQualifiedAccess>]
module PrivacyLedger =

    /// A principal: the identity that can own, earn and spend privacy budget. Compared with
    /// `StringComparison.Ordinal` everywhere in this module — a principal is a key, never a
    /// display string, so a culture-sensitive comparison would make identity locale-dependent.
    type Principal = string

    /// The body of an append-only entry. **Two cases, and the missing third is load-bearing:**
    /// credit arrives ONLY as another principal's attestation, debit ONLY as the owner's own
    /// spend, and confiscation is not expressible.
    [<RequireQualifiedAccess>]
    type Body =
        /// Another principal attests that `subject` added value to them. The ONLY credit path.
        | Attestation of subject: Principal * attestor: Principal * amount: int * witness: string
        /// The owner spends budget to frost a named region. The ONLY debit path.
        | Spend of owner: Principal * amount: int * region: string

    /// One append-only entry. `Id` is the idempotency key (discipline #6).
    type Entry = { Id: string; Body: Body }

    /// Why a post was refused. Every case is reachable from a test; see `PrivacyLedger.Tests.fs`.
    [<RequireQualifiedAccess>]
    type Refusal =
        /// The rule's core prohibition: you may not attest to your own value.
        | SelfMinted of principal: Principal
        | NonPositiveAmount of amount: int
        | UnwitnessedAttestation of attestor: Principal
        | InsufficientBudget of owner: Principal * balance: int * requested: int
        | EmptyPrincipal
        | EmptyRegion

    /// Render a refusal for a heat detail string / CLI message.
    let describeRefusal (refusal: Refusal) : string =
        match refusal with
        | Refusal.SelfMinted principal ->
            String.Format(
                Globalization.CultureInfo.InvariantCulture,
                "privacy budget is earned by OTHERS: {0} cannot attest to its own value",
                principal
            )
        | Refusal.NonPositiveAmount amount ->
            String.Format(
                Globalization.CultureInfo.InvariantCulture,
                "amount must be positive, got {0}",
                amount
            )
        | Refusal.UnwitnessedAttestation attestor ->
            String.Format(
                Globalization.CultureInfo.InvariantCulture,
                "attestation from {0} carries no witness: an unwitnessed credit is unmetered",
                attestor
            )
        | Refusal.InsufficientBudget(owner, balance, requested) ->
            String.Format(
                Globalization.CultureInfo.InvariantCulture,
                "{0} holds {1} but tried to spend {2}: you cannot spend what you did not earn",
                owner,
                balance,
                requested
            )
        | Refusal.EmptyPrincipal -> "a principal must be named"
        | Refusal.EmptyRegion -> "a spend must name the region it frosts"

    /// The book. Append-only: entries are posted, never edited in place.
    type Ledger = { Entries: Entry list }

    /// A ledger with no entries — so every principal starts at a balance of ZERO. This is the
    /// honest floor: an agent that has been attested by nobody can frost nothing.
    let empty: Ledger = { Entries = [] }

    let private samePrincipal (a: Principal) (b: Principal) =
        String.Equals(a, b, StringComparison.Ordinal)

    /// A principal's balance: credits from others' attestations, less its own spends. An
    /// order-independent fold, so replay in any order lands on the same number (DST §7).
    let balanceOf (principal: Principal) (ledger: Ledger) : int =
        ledger.Entries
        |> List.sumBy (fun entry ->
            match entry.Body with
            | Body.Attestation(subject, _, amount, _) when samePrincipal subject principal -> amount
            | Body.Spend(owner, amount, _) when samePrincipal owner principal -> -amount
            | _ -> 0)

    let private validate (ledger: Ledger) (body: Body) : Result<unit, Refusal> =
        match body with
        | Body.Attestation(subject, attestor, amount, witness) ->
            if String.IsNullOrWhiteSpace subject || String.IsNullOrWhiteSpace attestor then
                Error Refusal.EmptyPrincipal
            elif samePrincipal subject attestor then
                // The rule's core prohibition, mechanised.
                Error(Refusal.SelfMinted subject)
            elif amount <= 0 then
                Error(Refusal.NonPositiveAmount amount)
            elif String.IsNullOrWhiteSpace witness then
                Error(Refusal.UnwitnessedAttestation attestor)
            else
                Ok()
        | Body.Spend(owner, amount, region) ->
            if String.IsNullOrWhiteSpace owner then
                Error Refusal.EmptyPrincipal
            elif amount <= 0 then
                Error(Refusal.NonPositiveAmount amount)
            elif String.IsNullOrWhiteSpace region then
                Error Refusal.EmptyRegion
            else
                let balance = balanceOf owner ledger

                if balance < amount then
                    Error(Refusal.InsufficientBudget(owner, balance, amount))
                else
                    Ok()

    /// Post one entry. Idempotent by `Id`: re-posting a known id returns the ledger unchanged
    /// rather than double-counting, so retry and replay are safe (discipline #6).
    let post (entry: Entry) (ledger: Ledger) : Result<Ledger, Refusal> =
        let known =
            ledger.Entries
            |> List.exists (fun existing -> String.Equals(existing.Id, entry.Id, StringComparison.Ordinal))

        if known then
            Ok ledger
        else
            validate ledger entry.Body
            |> Result.map (fun () -> { Entries = ledger.Entries @ [ entry ] })

    /// Credit `subject` because `attestor` says they added value. Refused when they are the
    /// same principal — the one line that makes budget socially conferred rather than asserted.
    let attest
        (id: string)
        (subject: Principal)
        (attestor: Principal)
        (amount: int)
        (witness: string)
        (ledger: Ledger)
        : Result<Ledger, Refusal> =
        post
            { Id = id
              Body = Body.Attestation(subject, attestor, amount, witness) }
            ledger

    /// Debit `owner` to frost `region`. Refused when the balance will not cover it.
    let spend
        (id: string)
        (owner: Principal)
        (amount: int)
        (region: string)
        (ledger: Ledger)
        : Result<Ledger, Refusal> =
        post
            { Id = id
              Body = Body.Spend(owner, amount, region) }
            ledger

    /// Has `owner` recorded a spend against `region`? This is what makes a frost flag
    /// **derived** rather than asserted: the answer comes from the book, not from a boolean
    /// someone set. Used by the boundary and by the LLMTV membrane's F#-side counterpart.
    let hasSpendFor (owner: Principal) (region: string) (ledger: Ledger) : bool =
        ledger.Entries
        |> List.exists (fun entry ->
            match entry.Body with
            | Body.Spend(spender, _, spentRegion) ->
                samePrincipal spender owner && String.Equals(spentRegion, region, StringComparison.Ordinal)
            | _ -> false)
