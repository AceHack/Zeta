namespace Zeta.Core

/// **`SoftSession` — the end-to-end autonomous soft-play session (Aaron 2026-06-08, shadow*).**
///
/// The capstone that ties the live soft stack into one runnable call: load a ROM, then drive it by **empowerment**
/// (the unsupervised objective — agency) through the **frame-aware** MPC loop, capturing a watchable **trace** of
/// observables per frame. No external state; deterministic (DST §7) — same `seed`+`rom` ⇒ same trace, byte-for-byte.
///
/// Pipeline per frame: `SoftDrive.bestFrameAction (empowerment)` (plan in soft probability space) → commit one
/// `Chip8Cow.frameStep` (the live hard step + 60 Hz tick) → record `Tick`. This is `Chip8Cow` + `SoftEmu`
/// (`softFrame`) + `SoftDrive` (frame-aware) + `SoftDashboard` (empowerment / litPixels) composed.
///
/// **Honest scope (peel):** greedy first-action search over the 17 actions (`none`+16 keys), not full tree
/// search; `empowerment` horizon (`lookahead`) must be deep enough to see input value or the driver idles
/// (the 2026-06-08 finding — what you watch is right, the horizon is the knob). The `Tick` trace is the
/// observable summary; for the full ghost-screen heatmap use `SoftScope.render` on `SoftEmu.pure1 frame`.
/// Cost scales as `frames · actions · width · depth` soft frames — keep them modest for interactive runs.
[<RequireQualifiedAccess>]
module SoftSession =

    /// One frame of the autonomous play: the frame index, the committed `PC`, the key pressed (`-1` = none), the
    /// expected lit-pixel count, and the empowerment (reachable-futures / agency) at that frame.
    type Tick =
        { Frame: int
          PC: int
          Key: int
          LitPixels: float
          Empowerment: float }

    /// **Play `frames` autonomous frames**, driving by empowerment through the live frame-aware loop. Returns the
    /// per-frame `Tick` trace. Deterministic for a given `seed`/`rom`.
    let play
        (cyclesPerFrame: int)
        (lookahead: int)
        (depth: int)
        (width: int)
        (frames: int)
        (seed: uint64)
        (rom: byte[])
        : Tick list =
        let value = SoftDashboard.empowerment lookahead
        let mutable cur = Chip8Cow.create seed |> Chip8Cow.loadRom rom
        [ for i in 1 .. max 0 frames do
              let keys = SoftDrive.bestFrameAction value cyclesPerFrame depth width cur
              let k = keys |> Array.tryFindIndex id |> Option.defaultValue -1
              cur <- Chip8Cow.frameStep cyclesPerFrame { cur with Keys = keys }
              { Frame = i
                PC = int cur.PC
                Key = k
                LitPixels = SoftDashboard.litPixels cur
                Empowerment = value cur } ]

    /// Play and return the final hard frame (e.g. to render its ghost via `SoftScope.render (SoftEmu.pure1 f)`).
    let playToFrame
        (cyclesPerFrame: int)
        (lookahead: int)
        (depth: int)
        (width: int)
        (frames: int)
        (seed: uint64)
        (rom: byte[])
        : Chip8Cow.Frame =
        let value = SoftDashboard.empowerment lookahead
        let mutable cur = Chip8Cow.create seed |> Chip8Cow.loadRom rom
        for _ in 1 .. max 0 frames do
            let keys = SoftDrive.bestFrameAction value cyclesPerFrame depth width cur
            cur <- Chip8Cow.frameStep cyclesPerFrame { cur with Keys = keys }
        cur

    /// A compact one-line digest of a trace (last frame's observables) — for logging an autonomous run.
    let digest (trace: Tick list) : string =
        match List.tryLast trace with
        | None -> "empty session"
        | Some t ->
            System.String.Format(
                System.Globalization.CultureInfo.InvariantCulture,
                "frames={0} final PC=0x{1:X3} lastKey={2} E[lit]={3:F1} empowerment={4:F0}",
                List.length trace,
                t.PC,
                t.Key,
                t.LitPixels,
                t.Empowerment
            )
