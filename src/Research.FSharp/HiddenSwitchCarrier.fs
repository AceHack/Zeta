namespace Zeta.Research

open Zeta.Core

/// Evaluator-owned state and noise. No member of this module is a policy argument.
[<RequireQualifiedAccess>]
module HiddenSwitchCarrier =
    type Tape = { Initial: int; Drift: int[]; Errors: int[] }
    type State = private { Hidden: int; Cue: int; Index: int; Reward4: int option }
    type Audit = { Hidden: int; Cue: int; Index: int; Reward4: int option }
    let private feedback detail = Error(GameEnvironment.InvalidConfiguration detail)
    let validateTape tape =
        if obj.ReferenceEquals(tape, null) || isNull tape.Drift || isNull tape.Errors
           || tape.Drift.Length <> 16 || tape.Errors.Length <> 17 then feedback "requires sixteen drift bits and seventeen cue-error bits"
        elif tape.Initial < 0 || tape.Initial > 1 || Array.exists (fun bit -> bit < 0 || bit > 1) tape.Drift
             || Array.exists (fun bit -> bit < 0 || bit > 1) tape.Errors then feedback "all source bits must be zero or one"
        else Ok()
    let private bit value = value = 0 || value = 1
    let transition effect x action drift =
        if not (bit x && bit action && bit drift) then feedback "state, action and drift must be binary"
        else Ok(x ^^^ (if effect && action = 1 then 1 else 0) ^^^ drift, if action = 0 then 4 * x else -1)
    let cue x error = if bit x && bit error then Ok(x ^^^ error) else feedback "state and cue-error must be binary"
    let audit (state: State) : Audit = { Hidden = state.Hidden; Cue = state.Cue; Index = state.Index; Reward4 = state.Reward4 }
    let render geometry palette (state: State) =
        result {
            let! _ = HiddenSwitchObservation.geometry geometry |> Result.mapError (fun reason -> GameEnvironment.InvalidConfiguration reason.Detail)
            if palette <> "fixed" && palette <> "odd-complement" then return! feedback "requires fixed or odd-complement palette"
            let cells = Array.zeroCreate<byte> 2048
            let x = if state.Cue = 0 then 16 else 48
            let y, width = if geometry = "dot" then 8, 1 else 20, 3
            Array.fill cells (y * 64 + x) width 1uy
            match state.Reward4 with
            | Some reward -> cells.[26 * 64 + (if reward = 0 then 4 elif reward = 4 then 12 else 20)] <- 1uy
            | None -> ()
            if palette = "odd-complement" && state.Index % 2 = 1 then
                Array.iteri (fun index value -> cells.[index] <- 1uy - value) cells
            return ({ W = 64; H = 32; Palette = 2; Cells = cells } : GameEnvironment.Frame)
        }
    /// One persistent adapter per episode. Constructor defensively copies the private noise arrays.
    type Adapter(tape: Tape, effect: bool, geometry: string, palette: string) =
        let admitted =
            validateTape tape |> Result.map (fun () -> { Initial = tape.Initial; Drift = Array.copy tape.Drift; Errors = Array.copy tape.Errors })
        interface GameEnvironment.IEnvironment<State> with
            member _.Scheme = ControlScheme.chip9Pad
            member _.Reset() =
                result {
                    let! source = admitted
                    let! _ = HiddenSwitchObservation.geometry geometry |> Result.mapError (fun reason -> GameEnvironment.InvalidConfiguration reason.Detail)
                    if palette <> "fixed" && palette <> "odd-complement" then return! feedback "requires fixed or odd-complement palette"
                    let initial: State = { Hidden = source.Initial; Cue = source.Initial ^^^ source.Errors.[0]; Index = 0; Reward4 = None }
                    return initial
                }
            member _.Step(state, action) =
                result {
                    let! source = admitted
                    if state.Index < 0 || state.Index >= 16 then return! Error(GameEnvironment.AdapterFailure "episode has no remaining decisions")
                    let! key =
                        match action with
                        | ControlScheme.Pad key when key = 0 || key = 1 -> Ok key
                        | _ -> Error(GameEnvironment.UnsupportedAction "hidden switch accepts only Pad0 and Pad1")
                    let! next, reward = transition effect state.Hidden key source.Drift.[state.Index]
                    return { Hidden = next; Cue = next ^^^ source.Errors.[state.Index + 1]; Index = state.Index + 1; Reward4 = Some reward }
                }
            member _.Frame state = render geometry palette state
            member _.Info state =
                { SchemeId = ControlScheme.chip9Pad.ZetaId; AvailableInputs = ["0"; "1"]; EpisodeId = None
                  Status = (if state.Index < 16 then "running" else "complete"); Detail = None }

    /// Generation is called only after measurement-runner archival admission. Hand fixtures never call it.
    let corpus (seed: int) (domain: int) count =
        if seed < 0 || domain < 0 || count < 1 || count > 1024 then feedback "requires nonnegative seed/domain and source corpus size 1..1024"
        else
            let stream = ResearchRandom.Stream(ResearchRandom.domain (uint64 seed) domain)
            Array.init count (fun _ ->
                let initial = int (2.0 * stream.Next())
                let errors = Array.zeroCreate<int> 17
                let drift = Array.zeroCreate<int> 16
                errors.[0] <- if stream.Next() >= 0.75 then 1 else 0
                for index in 0 .. 15 do
                    drift.[index] <- if stream.Next() < 0.125 then 1 else 0
                    errors.[index + 1] <- if stream.Next() >= 0.75 then 1 else 0
                { Initial = initial; Drift = drift; Errors = errors }) |> Ok
    let handTapes () =
        [| "zero", { Initial = 0; Drift = Array.zeroCreate 16; Errors = Array.zeroCreate 17 }
           "one", { Initial = 1; Drift = Array.zeroCreate 16; Errors = Array.zeroCreate 17 }
           "alternating", { Initial = 0; Drift = Array.init 16 (fun t -> t % 2); Errors = Array.init 17 (fun j -> j % 2) }
           "sparse", { Initial = 1; Drift = Array.init 16 (fun t -> if Set.contains t (Set.ofList [0;7;15]) then 1 else 0)
                       Errors = Array.init 17 (fun j -> if Set.contains j (Set.ofList [0;2;8;16]) then 1 else 0) } |]
