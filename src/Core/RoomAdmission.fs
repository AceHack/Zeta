namespace Zeta.Core

/// Room-facing admission policy for finite exterior views.
///
/// `ModuloGSet` owns the algebraic finite-slot projection. This module names
/// the room boundary semantics around it: no-forget collision becomes
/// backpressure, replacement emits forgotten occupants as heat, and both flow
/// through the same injected heat sink used by DarkHall/CHIP rooms.
[<RequireQualifiedAccess>]
module RoomAdmission =

    [<RequireQualifiedAccess>]
    type SlotOutcome =
        | Admitted
        | AlreadyPresent
        | Replaced
        | Backpressured

    [<RequireQualifiedAccess>]
    type Feedback =
        | SlotFeedback of ModuloGSetError
        | HeatFeedback of HeatSinkFeedback

    type SlotReport<'K when 'K : comparison> =
        { Before: ModuloGSet<'K>
          After: ModuloGSet<'K>
          Key: 'K
          Slot: int
          Outcome: SlotOutcome
          Backpressured: GSet<'K>
          Heat: BoundedGSetHeat<'K> }

    let private positiveSignature (source: string) (kind: string) (units: int) (detail: string) : HeatSignature option =
        if units <= 0 then
            None
        else
            Some(HeatSignature.ofMass source kind units (float units) detail)

    let private outcomeOf =
        function
        | ModuloGSetAdmission.Admitted -> SlotOutcome.Admitted
        | ModuloGSetAdmission.AlreadyPresent -> SlotOutcome.AlreadyPresent
        | ModuloGSetAdmission.Replaced -> SlotOutcome.Replaced
        | ModuloGSetAdmission.RejectedByCollision -> SlotOutcome.Backpressured

    let private backpressured (key: 'K) =
        function
        | ModuloGSetAdmission.RejectedByCollision -> GSet.singleton key
        | ModuloGSetAdmission.Admitted
        | ModuloGSetAdmission.AlreadyPresent
        | ModuloGSetAdmission.Replaced -> GSet.empty

    /// Admit one key into a finite modulo-slot room view.
    let admitWithSlot
        (rawSlot: int64)
        (key: 'K)
        (current: ModuloGSet<'K>)
        : Result<SlotReport<'K>, Feedback> =
        result {
            let! added =
                ModuloGSet.addWithSlot rawSlot key current
                |> Result.mapError Feedback.SlotFeedback

            return
                { Before = current
                  After = added.State
                  Key = key
                  Slot = added.Slot
                  Outcome = outcomeOf added.Admission
                  Backpressured = backpressured key added.Admission
                  Heat = added.Heat }
        }

    /// Admit one key using a caller-owned slot function.
    let admit
        (slotOf: 'K -> int64)
        (key: 'K)
        (current: ModuloGSet<'K>)
        : Result<SlotReport<'K>, Feedback> =
        admitWithSlot (slotOf key) key current

    /// Host-facing heat signatures for finite room admission.
    ///
    /// Algebraic `ModuloGSet` rejection stays cold; room admission can still
    /// expose an explicit backpressure signature so the scheduler/debugger sees
    /// why a paid candidate could not enter the finite exterior view.
    let heatSignatures (source: string) (report: SlotReport<'K>) : HeatSignature list =
        [ BoundedHeat.signature
              source
              "room-admission.forgotten"
              (sprintf "finite room admission forgot occupant at slot=%d" report.Slot)
              report.Heat
          positiveSignature
              source
              "room-admission.backpressure"
              (GSet.count report.Backpressured)
              (sprintf "finite room admission rejected candidate at slot=%d" report.Slot) ]
        |> List.choose id

    /// Emit room-admission heat through an injected host/room boundary.
    let emitHeat (sink: IHeatSink) (source: string) (report: SlotReport<'K>) : Result<unit, Feedback> =
        let rec loop signatures =
            result {
                match signatures with
                | [] -> return ()
                | signature :: tail ->
                    do!
                        sink.Emit signature
                        |> Result.mapError Feedback.HeatFeedback

                    return! loop tail
            }

        report |> heatSignatures source |> loop

    /// Admit and immediately export any generated heat/backpressure signal.
    let admitWithHeat
        (sink: IHeatSink)
        (source: string)
        (rawSlot: int64)
        (key: 'K)
        (current: ModuloGSet<'K>)
        : Result<SlotReport<'K>, Feedback> =
        result {
            let! report = admitWithSlot rawSlot key current
            do! emitHeat sink source report
            return report
        }
