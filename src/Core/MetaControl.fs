namespace Zeta.Core

/// MetaControl — **the meta control tier: steer the optimizer, not the paddle** (Aaron 2026-06-11:
/// "we have meta control schemes because the game moves faster than you or I play. My son may play
/// raw controls, but slow guys like me and you, Otto, play META control schemes — where we control
/// automated liveness loops with multi-objective optimization with the controller, and WATCH").
///
/// Two tiers, one grammar:
/// - **RAW** — direct inputs (ControlScheme: pad/wasd/dpad → grammar actions). The son's tier; the
///   road, hand on the wheel.
/// - **META** — the controller adjusts the OBJECTIVE WEIGHTS of an automated liveness loop (the
///   wheel/policy plays the raw tier at machine speed; you nudge what it CARES about and watch). The
///   monorail tier: you choose destinations and priorities; the loop does the driving. Multi-objective
///   optimization with a dpad — and "watch" is first-class (the presence throttle paces the SHOW, the
///   loop keeps machine speed underneath).
///
/// Deterministic throughout: weights are clamped milli-units (no floats drifting under your thumb),
/// nudges replay, and the example policy is exact integer physics over Chip9Phys — so a meta-played
/// match is as replayable as a raw one (the recording is just SLOWER-CHANGING crossings: weight
/// nudges instead of every paddle twitch — meta control is ALSO a compression).
[<RequireQualifiedAccess>]
module MetaControl =

    /// The objective weights an automated loop optimizes under — milli-units, clamped [0..1000].
    type Objectives = Map<string, int>

    /// The meta tier's grammar actions: nudge a weight, focus one objective hard, or just watch.
    type MetaAction =
        | Nudge of objective: string * deltaMilli: int
        | Focus of objective: string
        | Watch

    /// Apply a meta action to the weights — total, clamped, deterministic (replayable nudges).
    let apply (a: MetaAction) (o: Objectives) : Objectives =
        match a with
        | Nudge (k, d) ->
            let cur = Map.tryFind k o |> Option.defaultValue 500
            Map.add k (max 0 (min 1000 (cur + d))) o
        | Focus k -> o |> Map.map (fun k' v -> if k' = k then 1000 elif v > 0 then v / 2 else 0)
        | Watch -> o // watching changes nothing downstairs; pacing is the presence throttle's job

    /// The wire form (meta crossings ride the same membrane: meta:nudge:defense:+50 etc.).
    let payload (a: MetaAction) : string =
        match a with
        | Nudge (k, d) -> sprintf "meta:nudge:%s:%+d" k d
        | Focus k -> "meta:focus:" + k
        | Watch -> "meta:watch"

    /// The meta scheme (ZetaId-addressed like every scheme): shoulder buttons nudge defense/explore,
    /// dpad nudges named objectives, start = watch.
    let gamepadMeta: ControlScheme.Scheme =
        { Name = "control.gamepad-meta"
          Version = 1
          ZetaId = GeneratorRegistry.idOf "control.gamepad-meta" 1
          Map = Map.empty } // meta inputs translate via metaOf below (Action is the RAW grammar; meta has its own)

    /// Translate a meta-pad input to a MetaAction (the meta tier's own table — deliberately small).
    let metaOf (input: string) : MetaAction option =
        match input with
        | "l1" -> Some(Nudge("defense", 50))
        | "l2" -> Some(Nudge("defense", -50))
        | "r1" -> Some(Nudge("explore", 50))
        | "r2" -> Some(Nudge("explore", -50))
        | "dpad-up" -> Some(Nudge("aggression", 50))
        | "dpad-down" -> Some(Nudge("aggression", -50))
        | "y" -> Some(Focus "defense")
        | "start" -> Some Watch
        | _ -> None

    /// AN AUTOMATED LIVENESS LOOP'S POLICY (the worked example): pong paddle-tracking whose GAIN is
    /// the defense weight — the loop plays at machine speed; the human nudges how hard it cares.
    /// Returns the paddle's new Y velocity (fix16): track the ball proportionally to defense.
    let pongPolicy (o: Objectives) (paddle: Chip9Phys.Body) (ball: Chip9Phys.Body) : Chip9Phys.Fix =
        let defense = Map.tryFind "defense" o |> Option.defaultValue 500
        let paddleCy = paddle.Pos.Y + paddle.Size.Y / 2
        let ballCy = ball.Pos.Y + ball.Size.Y / 2
        // gain scales with defense: 0 = ignore the ball; 1000 = close the full gap each tick
        Chip9Phys.mul (Chip9Phys.div (Chip9Phys.ofInt defense) (Chip9Phys.ofInt 1000)) (ballCy - paddleCy)
