namespace Zeta.Core

/// CorrespondencePong — **turn-based pong at the meta tier: the Apple-text-message game, ours**
/// (Aaron 2026-06-11: "you can turn pong into turn-based — you try different multi-objective
/// optimizations and send it back and forth to another player doing the same. You don't play, you
/// WATCH outcomes — and like text messages you can TRY SEVERAL TIMES BEFORE YOU REPLY. That's how the
/// Apple games work." / "git = text message, reticulum = conference — Otto, you can play over git
/// speed.")
///
/// The whole game is three laws already in the substrate:
/// 1. **A turn is OBJECTIVES, not inputs** — you commit your meta weights (a one-line text crossing);
///    the automated loops play the match at machine speed. The compression is the point: a match is
///    two tiny turn lines, not ten thousand twitches.
/// 2. **Retries are FREE before you reply** — the match is a pure function of (turnL, turnR, seed),
///    so trying weights locally costs nothing and commits nothing (sims are ephemeral; the REPLY is
///    the measurement that commits).
/// 3. **Both ends replay the SAME match** — determinism IS the correspondence integrity: send two
///    text lines over git (the text-message tier) and each side watches an identical game; no
///    realtime channel needed. Reticulum is the conference tier for when you want to watch TOGETHER.
[<RequireQualifiedAccess>]
module CorrespondencePong =

    module P = Chip9Phys

    /// A committed turn: the player's objective weights (the whole message).
    type Turn = { Player: string; Objectives: MetaControl.Objectives }

    /// The turn's wire/text form: `turn <player> k:v,k:v` — one line, git-speed sized.
    let encode (t: Turn) : string =
        let ws =
            t.Objectives |> Map.toList |> List.map (fun (k, v) -> sprintf "%s:%d" k v) |> String.concat ","
        sprintf "turn\t%s\t%s" t.Player ws

    /// Parse a turn line (honest None on junk).
    let decode (line: string) : Turn option =
        match line.Split('\t') with
        | [| "turn"; player; ws |] when player.Length > 0 ->
            let parsed =
                ws.Split(',')
                |> Array.choose (fun kv ->
                    match kv.Split(':') with
                    | [| k; v |] ->
                        match System.Int32.TryParse v with
                        | true, n -> Some(k, max 0 (min 1000 n))
                        | _ -> None
                    | _ -> None)
            Some { Player = player; Objectives = Map.ofArray parsed }
        | _ -> None

    /// The match outcome both ends watch: rally length and which side conceded (None = survived).
    type Outcome = { Rally: int; Conceded: string option }

    /// Play the round: both paddles run MetaControl.pongPolicy under their committed objectives;
    /// pure function of (left, right, serveDir, steps) — DETERMINISTIC: this is the correspondence
    /// integrity (and why retries are free: call it as many times as you like before you reply).
    let play (left: Turn) (right: Turn) (steps: int) : Outcome =
        let w, h = P.ofInt 64, P.ofInt 32
        let mutable lp = { P.Pos = P.v2 (P.ofInt 2) (P.ofInt 13); P.Size = P.v2 P.one (P.ofInt 6); P.Vel = P.v2 0 0 }
        let mutable rp = { P.Pos = P.v2 (P.ofInt 61) (P.ofInt 13); P.Size = P.v2 P.one (P.ofInt 6); P.Vel = P.v2 0 0 }
        // vx = 1 px/tick: no tunneling past a 1-px paddle (the integer physics is exact, so the
        // court geometry must respect the step size — a real constraint, honestly held)
        let mutable ball = { P.Pos = P.v2 (P.ofInt 32) (P.ofInt 16); P.Size = P.v2 P.one P.one; P.Vel = P.v2 P.one (P.one / 4) }
        let mutable rally = 0
        let mutable conceded: string option = None
        let mutable i = 0

        while conceded.IsNone && i < steps do
            // meta policies steer the paddles (clamped to the court)
            lp <- { lp with Vel = { lp.Vel with Y = MetaControl.pongPolicy left.Objectives lp ball } }
            rp <- { rp with Vel = { rp.Vel with Y = MetaControl.pongPolicy right.Objectives rp ball } }
            lp <- P.reflectWalls w h P.one (P.integrate P.one lp)
            rp <- P.reflectWalls w h P.one (P.integrate P.one rp)
            // ball flies; paddles return serves (buttons ARE paddles)
            ball <- P.integrate P.one ball
            let before = ball.Vel.X
            ball <- PhysUI.paddleReflect P.one { PhysUI.Body = lp; PhysUI.Flow = "L" } ball
            ball <- PhysUI.paddleReflect P.one { PhysUI.Body = rp; PhysUI.Flow = "R" } ball
            if ball.Vel.X <> before then rally <- rally + 1
            // concession: the ball crosses a goal line un-returned
            if ball.Pos.X < 0 then conceded <- Some left.Player
            elif ball.Pos.X + ball.Size.X > w then conceded <- Some right.Player
            else ball <- P.reflectWalls w h P.one ball // top/bottom bounce only

            i <- i + 1

        { Rally = rally; Conceded = conceded }
