namespace Zeta.Core

open System.Threading.Tasks

/// MeshPong — **pong over the mesh: the first playable integration artifact** (the demo named in the
/// game-physics-over-Reticulum doc).
///
/// The **lockstep model** (Age of Empires "1500 archers" / GGPO's core trick), on our substrate: **only
/// INPUTS travel as membrane crossings; the seed carries the world.** Two rooms each replay the SAME
/// recorded input crossings (`RecordedSource`) and independently simulate the WHOLE game. Because the
/// physics is a pure **integer** fold (no floats ⇒ byte-stable), their final states must agree exactly —
/// **agreement = the treaty holding; divergence = desync = a treaty violation, detected by comparison**.
/// A tampered crossing is caught the same way: **anti-cheat = noninterference, demonstrated in a test.**
///
/// This demo also EARNED a substrate improvement: lockstep needs the crossing's PAYLOAD, which exposed
/// that `SoftScheduler.Handler` never received the arrival — hence the additive `HandlerK`/`driveK` +
/// `SimFramework.RoomK` (arrival-aware rooms). Pure module; deterministic; DST throughout. The integer
/// game is portable to the other three oracles (a future game-state treaty).
[<RequireQualifiedAccess>]
module MeshPong =

    [<Literal>]
    let Width = 16

    [<Literal>]
    let Height = 9

    [<Literal>]
    let PaddleLen = 3

    /// The whole game — small, integer, byte-stable.
    type Game =
        { BallX: int
          BallY: int
          VX: int
          VY: int
          PaddleA: int // top row of paddle A (left wall)
          PaddleB: int // top row of paddle B (right wall)
          ScoreA: int
          ScoreB: int }

    /// Center serve, heading right-down.
    let create () : Game =
        { BallX = Width / 2
          BallY = Height / 2
          VX = 1
          VY = 1
          PaddleA = Height / 2 - 1
          PaddleB = Height / 2 - 1
          ScoreA = 0
          ScoreB = 0 }

    let private clampPaddle (p: int) = max 0 (min (Height - PaddleLen) p)

    let private serve (vx: int) (g: Game) =
        { g with BallX = Width / 2; BallY = Height / 2; VX = vx; VY = 1 }

    /// One lockstep tick: both players' inputs (each clamped to {-1,0,+1}) + the pure physics fold.
    let step (inputA: int) (inputB: int) (g: Game) : Game =
        let g =
            { g with
                PaddleA = clampPaddle (g.PaddleA + max -1 (min 1 inputA))
                PaddleB = clampPaddle (g.PaddleB + max -1 (min 1 inputB)) }

        let nx = g.BallX + g.VX
        let nyRaw = g.BallY + g.VY
        // bounce top/bottom
        let vy, ny =
            if nyRaw < 0 || nyRaw >= Height then -g.VY, g.BallY - g.VY else g.VY, nyRaw

        if nx <= 0 then
            if ny >= g.PaddleA && ny < g.PaddleA + PaddleLen then
                { g with BallX = 1; BallY = ny; VX = 1; VY = vy } // A saves
            else
                serve -1 { g with ScoreB = g.ScoreB + 1 } // B scores; serve toward A
        elif nx >= Width - 1 then
            if ny >= g.PaddleB && ny < g.PaddleB + PaddleLen then
                { g with BallX = Width - 2; BallY = ny; VX = -1; VY = vy } // B saves
            else
                serve 1 { g with ScoreA = g.ScoreA + 1 } // A scores; serve toward B
        else
            { g with BallX = nx; BallY = ny; VY = vy }

    // ── The mesh wiring: inputs are the ONLY crossings ──

    /// Deterministic input pair for a tick (each ∈ {-1,0,+1}) — the stand-in "controllers"; with real
    /// players the wire shape is identical (a Reticulum packet carrying the same payload).
    let inputsAt (seed: int64) (tick: int) : int * int =
        let h = SplitMix64.mix (uint64 seed + uint64 tick * SplitMix64.GoldenRatio)
        (int (h % 3UL)) - 1, (int ((h >>> 8) % 3UL)) - 1

    /// Encode a tick's input pair as the crossing payload (text — the treaty register).
    let encodeInputs (a: int) (b: int) : string = sprintf "pong:%d,%d" a b

    /// Parse a crossing payload back to the input pair (None = not a pong input — honest refusal).
    let parseInputs (payload: string) : (int * int) option =
        if payload.StartsWith "pong:" then
            match payload.Substring(5).Split(',') with
            | [| a; b |] ->
                match System.Int32.TryParse a, System.Int32.TryParse b with
                | (true, ia), (true, ib) -> Some(ia, ib)
                | _ -> None
            | _ -> None
        else
            None

    /// The "controllers" membrane: each tick, both players' inputs cross as ONE message.
    let inputsSource (seed: int64) : SoftScheduler.Source =
        fun tick ->
            let a, b = inputsAt seed tick
            [ OperatorMessageArrived(encodeInputs a b) ]

    /// The lockstep handler — arrival-AWARE: reads the crossing's payload, steps the pure physics.
    /// A non-pong payload is skipped (state unchanged) — the membrane may carry other traffic.
    let lockstepHandler: SoftScheduler.HandlerK<Game> =
        SoftScheduler.handlerK
            "pong-lockstep"
            (function
            | OperatorMessageArrived _ -> true
            | _ -> false)
            (fun intr _ctx g ->
                match intr with
                | OperatorMessageArrived payload ->
                    match parseInputs payload with
                    | Some (a, b) -> Task.FromResult(Ok(step a b g))
                    | None -> Task.FromResult(Ok g)
                | _ -> Task.FromResult(Ok g))

    /// A pong room over a given membrane. Resolves (signs off) when anyone scores `toWin` points.
    let room (name: string) (source: int64 -> SoftScheduler.Source) (budget: int) (toWin: int) : SimFramework.RoomK<Game> =
        { Name = name
          Initial = fun _ -> create ()
          HandlersK = [ lockstepHandler ]
          Source = source
          Budget = budget
          Resolved = fun g -> g.ScoreA >= toWin || g.ScoreB >= toWin }

    /// **Play a match over the mesh**: record the input crossings once (the "network session"), then TWO
    /// rooms each replay the same recording and simulate independently. Returns (recording, reportA,
    /// reportB) — the lockstep treaty check is `reportA.Final = reportB.Final` (byte-equal worlds).
    let playMatch (seed: int64) (budget: int) (toWin: int) =
        task {
            let recording = RecordedSource.record (inputsSource seed) budget
            let replay = fun (_: int64) -> RecordedSource.replay recording
            let! reportA = SimFramework.runK (room "pong-room-A" replay budget toWin) seed
            let! reportB = SimFramework.runK (room "pong-room-B" replay budget toWin) seed
            return recording, reportA, reportB
        }

    // ── The GAME-STATE TREATY codec (Aaron 2026-06-11: "yes on the game treaty") ──
    // Canonical text line for the Game state; all four oracles replay the shared session
    // (src/Core.TypeScript/mesh-pong/golden-vectors.lines) through their own pure `step` and must hit
    // byte-identical checkpoint lines. Integer fields, tab-separated, versioned tag.

    /// Serialize the game state to its canonical treaty line (byte-deterministic).
    let gameToLine (g: Game) : string =
        sprintf
            "ponggame1\t%d\t%d\t%d\t%d\t%d\t%d\t%d\t%d"
            g.BallX
            g.BallY
            g.VX
            g.VY
            g.PaddleA
            g.PaddleB
            g.ScoreA
            g.ScoreB

    /// Parse a canonical game-state line (None = malformed — honest refusal).
    let gameOfLine (line: string) : Game option =
        match line.Split('\t') with
        | [| "ponggame1"; bx; by; vx; vy; pa; pb; sa; sb |] ->
            let p (s: string) =
                match System.Int32.TryParse s with
                | true, v -> Some v
                | _ -> None
            match p bx, p by, p vx, p vy, p pa, p pb, p sa, p sb with
            | Some bx, Some by, Some vx, Some vy, Some pa, Some pb, Some sa, Some sb ->
                Some
                    { BallX = bx
                      BallY = by
                      VX = vx
                      VY = vy
                      PaddleA = pa
                      PaddleB = pb
                      ScoreA = sa
                      ScoreB = sb }
            | _ -> None
        | _ -> None
