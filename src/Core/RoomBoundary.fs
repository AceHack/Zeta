namespace Zeta.Core

/// A room boundary composes finite admission, visibility, door traversal, and
/// host-facing heat without becoming a runtime of its own.
[<RequireQualifiedAccess>]
module RoomBoundary =

    type Boundary<'K when 'K : comparison> =
        { Source: string
          /// The principal that OWNS this boundary — the only one who may defrost it.
          Owner: string
          Occupants: ModuloGSet<'K>
          Visibility: GlassHalo.Visibility
          /// **Derived, never supplied.** Read from the ledger by `create`; see its remarks.
          PrivacyBudget: int
          CurrentRoom: string }

    [<RequireQualifiedAccess>]
    type Feedback =
        | AdmissionFeedback of RoomAdmission.Feedback
        | PrivacyDenied of reason: string
        | DoorDenied of fromRoom: string * toRoom: string * reason: string
        | HeatFeedback of HeatSinkFeedback
        /// A non-owner tried to defrost. The refusal the hard-money rule requires.
        | DefrostDenied of requester: string * owner: string

    /// Open a boundary owned by `owner`, with its privacy budget **DERIVED from the ledger**.
    ///
    /// This signature is the fix for the first of the two defects recorded in work-item
    /// `081M0X23R19087G0R003XHGB2B`. It used to take `(privacyBudget: int)` from the caller,
    /// which meant the boundary minted budget out of an integer somebody passed it — precisely
    /// what `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md` forbids
    /// (*"CREDITED only by others' value attestations (never self-minted)"*). Now the only way
    /// a boundary has budget to spend is that some OTHER principal attested value to its owner
    /// and that attestation is in the book.
    ///
    /// An owner nobody has attested opens at zero and can frost nothing. That is the intended,
    /// honest floor, not a bug.
    let create
        (ledger: PrivacyLedger.Ledger)
        (owner: string)
        (source: string)
        (currentRoom: string)
        (occupants: ModuloGSet<'K>)
        : Boundary<'K> =
        { Source = source
          Owner = owner
          Occupants = occupants
          Visibility = GlassHalo.initial
          PrivacyBudget = max 0 (PrivacyLedger.balanceOf owner ledger)
          CurrentRoom = currentRoom }

    let private admissionFeedback =
        function
        | RoomAdmission.Feedback.HeatFeedback feedback -> Feedback.HeatFeedback feedback
        | feedback -> Feedback.AdmissionFeedback feedback

    let private emitRefusalHeat
        (sink: IHeatSink)
        (source: string)
        (kind: string)
        (detail: string)
        : Result<unit, Feedback> =
        let heat = HeatSignature.ofMass source kind 1 1.0 detail
        sink.Emit heat |> Result.mapError Feedback.HeatFeedback

    let private privacyDenied
        (sink: IHeatSink)
        (source: string)
        (reason: string)
        : Result<'T, Feedback> =
        result {
            do! emitRefusalHeat sink source "room-boundary.privacy-backpressure" reason
            return! Error(Feedback.PrivacyDenied reason)
        }

    let private doorDenied
        (sink: IHeatSink)
        (source: string)
        (fromRoom: string)
        (toRoom: string)
        (reason: string)
        : Result<'T, Feedback> =
        result {
            let detail = sprintf "%s -> %s refused: %s" fromRoom toRoom reason
            do! emitRefusalHeat sink source "room-boundary.door-denied" detail
            return! Error(Feedback.DoorDenied(fromRoom, toRoom, reason))
        }

    /// Admit one occupant through the finite room view and export any heat.
    let admitWithSlot
        (sink: IHeatSink)
        (rawSlot: int64)
        (key: 'K)
        (boundary: Boundary<'K>)
        : Result<Boundary<'K> * RoomAdmission.SlotReport<'K>, Feedback> =
        result {
            let! report =
                RoomAdmission.admitWithHeat sink boundary.Source rawSlot key boundary.Occupants
                |> Result.mapError admissionFeedback

            return { boundary with Occupants = report.After }, report
        }

    /// Spend earned privacy budget to frost the boundary.
    ///
    /// **Honest limit — this does NOT write back to the book.** `create` derives the starting
    /// budget from the ledger, so what is spent here was genuinely earned; but the debit lands on
    /// this record's in-memory `PrivacyBudget` field and no `PrivacyLedger.Spend` entry is posted.
    /// The TypeScript path (`ledger/privacy-budget.ts` `spend`) does close that loop. Closing it
    /// here means threading the ledger back out of `frost`, which changes `applyBoundaryCommand`
    /// and the tick signature — a separate slice, deliberately not smuggled into this one.
    /// Recorded here so the gap is discovered by reading the function, not by trusting it.
    let frost
        (sink: IHeatSink)
        (cost: int)
        (boundary: Boundary<'K>)
        : Result<Boundary<'K>, Feedback> =
        match GlassHalo.frost cost boundary.PrivacyBudget boundary.Visibility with
        | Ok(visibility, remaining) ->
            Ok { boundary with Visibility = visibility; PrivacyBudget = remaining }
        | Error reason -> privacyDenied sink boundary.Source reason

    /// Return the boundary to the clear default — **owner-only, and refusable.**
    ///
    /// The second of the two defects in `081M0X23R19087G0R003XHGB2B`: this used to take no
    /// principal and return a `Boundary` unconditionally, so any code holding the value could
    /// strip another agent's frost and could not be told no. `BoundaryCommand.Clear` was nullary
    /// for the same reason. A defrost another party can force is confiscation, which the
    /// hard-money rule says may never happen.
    ///
    /// Does not refund spent budget; that budget bought the private interval that already ran.
    ///
    /// **Cooperative, not cryptographic:** `requester` is a claimed name. This refuses an honest
    /// or buggy non-owner; a caller that lies about its identity is out of scope until the
    /// signing hardware lands. See `PrivacyLedger`'s header.
    let clear
        (sink: IHeatSink)
        (requester: string)
        (boundary: Boundary<'K>)
        : Result<Boundary<'K>, Feedback> =
        match GlassHalo.clear requester boundary.Owner boundary.Visibility with
        | Ok visibility -> Ok { boundary with Visibility = visibility }
        | Error reason ->
            result {
                do! emitRefusalHeat sink boundary.Source "room-boundary.defrost-denied" reason
                return! Error(Feedback.DefrostDenied(requester, boundary.Owner))
            }

    let observe (placeholder: 'A) (content: 'A) (boundary: Boundary<'K>) : 'A =
        GlassHalo.observe placeholder content boundary.Visibility

    /// Traverse one declared door. Permission failures and missing doors are
    /// typed refusals and also exported as heat for host/debug visibility.
    let traverse
        (sink: IHeatSink)
        (heldKeys: Set<string>)
        (toRoom: string)
        (vault: DoorGraph.Vault)
        (boundary: Boundary<'K>)
        : Result<Boundary<'K>, Feedback> =
        match DoorGraph.traverse heldKeys boundary.CurrentRoom toRoom vault with
        | Ok destination -> Ok { boundary with CurrentRoom = destination }
        | Error reason -> doorDenied sink boundary.Source boundary.CurrentRoom toRoom reason
