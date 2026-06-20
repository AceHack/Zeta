namespace Zeta.Core

/// A room boundary composes finite admission, visibility, door traversal, and
/// host-facing heat without becoming a runtime of its own.
[<RequireQualifiedAccess>]
module RoomBoundary =

    type Boundary<'K when 'K : comparison> =
        { Source: string
          Occupants: ModuloGSet<'K>
          Visibility: GlassHalo.Visibility
          PrivacyBudget: int
          CurrentRoom: string }

    [<RequireQualifiedAccess>]
    type Feedback =
        | AdmissionFeedback of RoomAdmission.Feedback
        | PrivacyDenied of reason: string
        | DoorDenied of fromRoom: string * toRoom: string * reason: string
        | HeatFeedback of HeatSinkFeedback

    let create
        (source: string)
        (currentRoom: string)
        (privacyBudget: int)
        (occupants: ModuloGSet<'K>)
        : Boundary<'K> =
        { Source = source
          Occupants = occupants
          Visibility = GlassHalo.initial
          PrivacyBudget = max 0 privacyBudget
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
    let frost
        (sink: IHeatSink)
        (cost: int)
        (boundary: Boundary<'K>)
        : Result<Boundary<'K>, Feedback> =
        match GlassHalo.frost cost boundary.PrivacyBudget boundary.Visibility with
        | Ok(visibility, remaining) ->
            Ok { boundary with Visibility = visibility; PrivacyBudget = remaining }
        | Error reason -> privacyDenied sink boundary.Source reason

    /// Return the boundary to the clear default. This does not refund spent
    /// privacy budget; that budget bought the private interval that already ran.
    let clear (boundary: Boundary<'K>) : Boundary<'K> =
        { boundary with Visibility = GlassHalo.clear boundary.Visibility }

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
