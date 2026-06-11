namespace Zeta.Core

/// StrokeAnim — **the animation library applied to a line AS IT DRAWS** (Aaron 2026-06-11: "if we
/// have pixels drawing curves and lines, our animation library should apply to the line as it's
/// drawing, step by step — driving it and its color, with context of what it WOULD have looked like.
/// This allows riding the uncertainty edge/wave, and recoloring it").
///
/// The stroke has three phases at every tick, and the DRAW HEAD rides the boundary between them:
/// - **Drawn** — behind the head: committed, certain (full color, uncertainty 0).
/// - **Head** — the edge itself: the wave front (exactly one cell — where drawing IS happening).
/// - **Foreseen** — ahead of the head: "what it would have looked like" — the curve's own speculation
///   about itself, rendered in the uncertainty register (dim/spec channel, high uncertainty) so the
///   viewer SEES the future as provisional. As the head advances, cells RECOLOR foreseen→head→drawn —
///   uncertainty becoming certain in front of your eyes, pixel by pixel (the Severance image, on a
///   pencil line).
///
/// Driven by generated time (AnimFlow's discipline: the tick indexes the stroke — pure, replayable,
/// distributed-identical); packs straight into PixelLens cells (the per-phase uncertainty IS the deep
/// pixel's field).
[<RequireQualifiedAccess>]
module StrokeAnim =

    /// A cell's phase in the living stroke.
    type Phase =
        | Drawn
        | Head
        | Foreseen

    /// The stroke at a tick: each curve point with its phase. `speed` = points drawn per tick
    /// (clamped ≥1). Total over all time: before t=0 everything is Foreseen+Head-at-start; after the
    /// end, everything is Drawn.
    let strokeAt (speed: int) (tick: int) (curve: BoundaryLight.Curve) : (BoundaryLight.P * Phase) list =
        let s = max 1 speed
        let headIx = min (List.length curve - 1) (max 0 (tick * s))

        curve
        |> List.mapi (fun i p ->
            p,
            if i < headIx then Drawn
            elif i = headIx then Head
            else Foreseen)

    /// RECOLOR: a phase to (display color mask, uncertaintyMilli) under a base color — the committed
    /// past keeps the full color at certainty; the head burns brightest (white — the wave front); the
    /// foreseen future shows on the speculation channel (B) at high uncertainty: honest provisional.
    let recolor (baseMask: byte) (phase: Phase) : byte * int =
        match phase with
        | Drawn -> baseMask, 0
        | Head -> 7uy, 0 // the edge: all channels — where the work is
        | Foreseen -> 4uy, 900 // the future: blue, provisional, visibly uncertain

    /// Pack one stroked cell straight into a deep pixel (PixelLens cell) — payload carries the curve
    /// index (provenance riding the pixel), uncertainty carries the phase's honesty.
    let toCell (baseMask: byte) (index: int) (phase: Phase) : PixelLens.Cell =
        let mask, u = recolor baseMask phase
        PixelLens.pack mask index u

    // ── calculus riding the wave (Aaron 2026-06-11: "you can run derivatives and integration/
    // derivations riding that wave, one tick at a time"). The head is a CALCULUS CURSOR: at every
    // tick, the local derivative (the slope at the edge) and the running integral (the area swept so
    // far) are computed over ONLY the committed points — no peeking past the wave (the honest
    // calculus: the future is foreseen, not differentiated). Exact integers throughout (doubled area
    // for the trapezoid rule — no halves, no floats). ──

    /// The derivative at the head: (dx, dy) between the head and the point behind it — the stroke's
    /// instantaneous direction. None before anything is drawn (no slope from one point: honest).
    let derivativeAt (speed: int) (tick: int) (curve: BoundaryLight.Curve) : (int * int) option =
        let s = max 1 speed
        let headIx = min (List.length curve - 1) (max 0 (tick * s))
        if headIx = 0 then None
        else
            let a = curve.[headIx - 1]
            let b = curve.[headIx]
            Some(b.X - a.X, b.Y - a.Y)

    /// The running integral up to the head: TWICE the signed area under the drawn polyline
    /// (trapezoid rule, doubled to stay in exact integers). Grows tick by tick as the wave commits.
    let integralTo (speed: int) (tick: int) (curve: BoundaryLight.Curve) : int =
        let s = max 1 speed
        let headIx = min (List.length curve - 1) (max 0 (tick * s))
        curve
        |> List.truncate (headIx + 1)
        |> List.pairwise
        |> List.sumBy (fun (a, b) -> (b.X - a.X) * (a.Y + b.Y)) // 2 × trapezoid area, exact
