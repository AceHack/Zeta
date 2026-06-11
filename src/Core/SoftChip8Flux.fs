namespace Zeta.Core

open System.Threading.Tasks

/// SoftChip8Flux — **flux-metered speculation + input as a membrane crossing** (the RESUME queue's #3;
/// the flux-capacitor doc's named next slice: "SoftValue/tank-funded lookAhead depth").
///
/// Two pieces, both additive over proven code:
///
/// 1. **`lookAheadFunded`** — `SoftChip8.lookAhead` with the depth knob replaced by the **flux tank**:
///    each speculated step must be *funded* (the Bennett/byte budget — "it meters the future in bytes,
///    literally"). Idle ticks recharge the tank ⇒ after quiet periods the emulator can speculate DEEPER
///    (banked time-travel capacity discharging in a burst) — the resonant behavior, not a fixed ceiling.
///    Speculation still stops early at an input branch (the only genuine fork).
///
/// 2. **Input as a crossing** — CHIP-8 keys arrive as `OperatorMessageArrived "key:<idx>:<0|1>"` membrane
///    crossings (arrival-aware `HandlerK`), wired to the frame's `Keys`. This is the **present-crossing
///    leg of the flux capacitor**: the input arriving is what RESOLVES the speculative forks
///    (`SoftChip8.branchesOnInput` waits on exactly this). With real players, the same payload rides a
///    Reticulum packet — the wire shape is identical (the MeshPong pattern).
[<RequireQualifiedAccess>]
module SoftChip8Flux =

    // ── 1. Flux-funded speculation ──

    /// Speculate ahead while (a) the tank funds each step at `costPerStep` and (b) no input branch is
    /// hit. Returns (frame', hitBranch, stepsTaken, tank'). The depth is no longer a constant — it is
    /// whatever the banked flux affords RIGHT NOW (deep after idle, shallow under load).
    let lookAheadFunded
        (costPerStep: float)
        (tank: SoftThrottle.Tank)
        (f: Chip8Cow.Frame)
        : Chip8Cow.Frame * bool * int * SoftThrottle.Tank =
        let mutable state = f
        let mutable t = tank
        let mutable steps = 0
        let mutable stop = false
        let mutable hitBranch = false

        while not stop do
            if SoftChip8.branchesOnInput state then
                hitBranch <- true
                stop <- true
            else
                match SoftThrottle.discharge costPerStep t with
                | Some t' ->
                    state <- Chip8Cow.step state
                    t <- t'
                    steps <- steps + 1
                | None -> stop <- true // out of flux — the future is metered

        state, hitBranch, steps, t

    // ── 2. Input as a membrane crossing ──

    /// Encode a key event as the crossing payload (text — the treaty register).
    let encodeKey (idx: int) (down: bool) : string =
        sprintf "key:%d:%d" (idx &&& 0xF) (if down then 1 else 0)

    /// Parse a key-event payload (None = not a key event — honest refusal; other traffic passes by).
    let parseKey (payload: string) : (int * bool) option =
        if payload.StartsWith "key:" then
            match payload.Substring(4).Split(':') with
            | [| i; d |] ->
                match System.Int32.TryParse i, System.Int32.TryParse d with
                | (true, idx), (true, down) when idx >= 0 && idx <= 15 && (down = 0 || down = 1) ->
                    Some(idx, (down = 1))
                | _ -> None
            | _ -> None
        else
            None

    /// Apply a key event to a frame (COW — fresh Keys array; parent untouched).
    let applyKey (idx: int) (down: bool) (f: Chip8Cow.Frame) : Chip8Cow.Frame =
        let keys = Array.copy f.Keys
        keys.[idx &&& 0xF] <- down
        { f with Keys = keys }

    /// The input handler — arrival-AWARE: a key crossing updates the frame's Keys (the present arriving;
    /// the speculative forks resolve against exactly this). Non-key traffic is skipped unchanged.
    let inputHandler: SoftScheduler.HandlerK<Chip8Cow.Frame> =
        SoftScheduler.handlerK
            "chip8-input"
            (function
            | OperatorMessageArrived _ -> true
            | _ -> false)
            (fun intr _ctx f ->
                match intr with
                | OperatorMessageArrived payload ->
                    match parseKey payload with
                    | Some (idx, down) -> Task.FromResult(Ok(applyKey idx down f))
                    | None -> Task.FromResult(Ok f)
                | _ -> Task.FromResult(Ok f))

    /// The 60Hz timer handler in arrival-aware form (timers tick + CPU advances a fixed batch) — so a
    /// full CHIP-8 room can run input + timer on ONE `driveK` loop.
    let timerHandler (cyclesPerTick: int) : SoftScheduler.HandlerK<Chip8Cow.Frame> =
        SoftScheduler.handlerK
            "chip8-60hz"
            (function
            | TimerElapsed _ -> true
            | _ -> false)
            (fun _ _ctx f ->
                let ticked = Chip8Cow.tick f
                let advanced, _ = SoftChip8.lookAhead cyclesPerTick ticked
                Task.FromResult(Ok advanced))
