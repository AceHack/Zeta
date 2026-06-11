namespace Zeta.Core

/// FluxView — **seeing the flux capacitor and the interrupt handler** (Aaron 2026-06-11: "I really
/// want to see what the flux capacitor looks like in soft and hard mode — and the interrupt handler
/// too. We can have MANY VIEWS of those until we get it right").
///
/// Four views (each a registered, cost-declared generator — many views is the point; none canonical
/// yet, all candidates "until we get it right"):
/// 1. **the admission curve** — P(admit) vs pressure, SOFT (the logistic gradient — a smooth ramp:
///    you can SEE the harmonic give) and HARD (the k→∞ step: a cliff) side by side. The difference
///    between the two modes IS the picture.
/// 2. **the tank gauge** — one line: charge bar + heat spent (the glass-blowing thermometer as a
///    glanceable strip).
/// 3. **the flux timeline** — charge level over ticks under a load pattern (the LC breathing: drain
///    on bursts, recover while idle — the capacitor's heartbeat as block columns).
/// 4. **the interrupt grid** — handlers × ticks: which handler matched which crossing when (driveK's
///    dispatch made visible — the membrane's switchboard as a defrag-style grid).
/// All plain text (renderable through any binding), exact/deterministic, total.
[<RequireQualifiedAccess>]
module FluxView =

    /// VIEW 1: the admission curve — `rows` high, `cols` wide; '#' marks the curve. Soft = logistic
    /// at steepness k; hard = the step at pressure 1.0 (drawn over pressure 0..2).
    let admissionCurve (soft: bool) (k: float) (rows: int) (cols: int) : string list =
        let h = max 2 rows
        let w = max 4 cols
        let pAt c = 2.0 * float c / float (w - 1) // pressure 0..2 across the width
        let prob p = if soft then SoftThrottle.admissionProbability k p
                     elif p < 1.0 then 1.0 else 0.0
        [ for r in 0 .. h - 1 ->
            let yTop = 1.0 - float r / float (h - 1) // row 0 = P=1.0
            System.String(
                [| for cIx in 0 .. w - 1 ->
                       let p = prob (pAt cIx)
                       // the curve passes through this cell if p is within half a row of yTop
                       if abs (p - yTop) <= 0.5 / float (h - 1) then '#'
                       elif p > yTop then ':' // under the curve: admitted mass
                       else ' ' |]) ]

    /// VIEW 2: the tank gauge — `[████░░░░] charge/capacity · heat <spent>` in one line.
    let tankGauge (width: int) (t: SoftThrottle.Tank) : string =
        let w = max 4 width
        let avail = SoftThrottle.available t
        let cap = t.Capacity
        let filled = if cap <= 0.0 then 0 else int (avail / cap * float w + 0.5) |> max 0 |> min w
        sprintf "[%s%s] %.1f/%.1f · heat %.1f"
            (String.replicate filled "█") (String.replicate (w - filled) "░")
            avail cap (SoftThrottle.heatSpent t)

    /// VIEW 3: the flux timeline — charge level per tick under a load pattern (`load tick` = the
    /// burst cost demanded that tick; idle ticks recharge). Returns one block-column per tick
    /// (8 levels) — the capacitor's heartbeat.
    let timeline (ticks: int) (load: int -> float) (t0: SoftThrottle.Tank) : string =
        let blocks = [| ' '; '▁'; '▂'; '▃'; '▄'; '▅'; '▆'; '▇'; '█' |]
        let mutable t = t0
        let cap = t0.Capacity
        System.String(
            [| for tick in 0 .. max 0 ticks - 1 ->
                   let demand = load tick
                   t <-
                       if demand > 0.0 then
                           match SoftThrottle.discharge demand t with
                           | Some t' -> t'
                           | None -> t // starved: the demand bounces, the level shows why
                       else SoftThrottle.charge t
                   let level = if cap <= 0.0 then 0 else int (SoftThrottle.available t / cap * 8.0 + 0.5) |> max 0 |> min 8
                   blocks.[level] |])

    /// VIEW 4: the interrupt grid — one row per handler name, one column per tick; '■' where that
    /// handler's `matches` accepted a crossing that tick, '·' where it saw traffic but passed,
    /// ' ' where the tick was silent. driveK's switchboard, visible.
    let interruptGrid
        (handlers: (string * (InterruptKind -> bool)) list)
        (source: SoftScheduler.Source)
        (ticks: int)
        : string list =
        [ for (name, matches) in handlers ->
            let cells =
                System.String(
                    [| for tick in 0 .. max 0 ticks - 1 ->
                           let arrivals = source tick
                           if List.isEmpty arrivals then ' '
                           elif arrivals |> List.exists matches then '■'
                           else '·' |])
            sprintf "%-16s %s" name cells ]
