namespace Zeta.Core

// One bounded overlap on an agreed phase line. Schema expand-into and key
// Previous acceptance are two callers of this gate, not two windows.
//
// Beacon: Hellerstein & Alvaro CALM (monotonic ⇒ coordination-free) does not
// apply here — dropping the old shape is non-monotone, so it is gated.
// KeyCustody R8: expiry needs no retract event. Same rule for a schema
// reader whose overlap window has closed.
//
// Named limits: not live catalog overlap. EvolutionWindow int readers remain
// for the legacy gate. Crash recovery stays toy.

[<RequireQualifiedAccess>]
module OverlapRotator =

    type Overlap =
        { Id: string
          Line: string
          Window: KeyCustody.PhaseWindow }

    type State = { ById: Map<string, Overlap> }

    let empty: State = { ById = Map.empty }

    let tryOpen
        (id: string)
        (line: string)
        (start: Versionstamp)
        (span: int64)
        (state: State)
        : Result<State, KeyCustody.WindowError> =
        match KeyCustody.tryWindow line start span with
        | Error e -> Error e
        | Ok w ->
            Ok
                { ById =
                    Map.add
                        id
                        { Id = id
                          Line = line
                          Window = w }
                        state.ById }

    let close (id: string) (state: State) : State =
        { ById = Map.remove id state.ById }

    let liveness
        (frame: TravelerFrame.Frame)
        (state: State)
        (id: string)
        : Policy.PolicyResult<KeyCustody.Liveness, KeyCustody.LivenessReason> option =
        match Map.tryFind id state.ById with
        | None -> None
        | Some o -> Some(KeyCustody.liveness o.Window frame)

    /// Key Previous: accept while this overlap is Live at the frame.
    let mayAcceptPrevious (frame: TravelerFrame.Frame) (state: State) (id: string) : bool =
        match liveness frame state id with
        | Some r -> r.Decision = KeyCustody.Live
        | None -> false

    /// Schema expand-into: refuse while any blocking overlap is still Live.
    let mayExpandInto (frame: TravelerFrame.Frame) (state: State) (blockingIds: string[]) : bool =
        blockingIds
        |> Array.forall (fun id ->
            match liveness frame state id with
            | Some r when r.Decision = KeyCustody.Live -> false
            | _ -> true)
