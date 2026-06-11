namespace Zeta.Core

/// MagneticPorts — **puzzle pieces that want to fit** (Aaron 2026-06-11: "for a kid it should feel
/// like puzzle pieces that just want to fit together — drawn to each other MAGNETICALLY when
/// compatible, REPELLED when not. Interface-speaking: source→sink flows and transforms, GraphEdit-
/// like auto-snapping when trying to connect incompatible things").
///
/// The type system, felt through the fingers: a PORT is a physics body (PhysUI's law — one engine)
/// with a direction (Source emits, Sink receives, Transform is both) and an interface type BY ZetaId.
/// The force between two dragged ports is the COMPATIBILITY CHECK made physical:
/// - source→sink with MATCHING type ids ⇒ ATTRACT (the snap: they pull together and click);
/// - mismatched types or same-direction ⇒ REPEL (the polite no: the pieces push apart — a child
///   learns the rule without reading an error message).
/// The kid-feel law from the charter: the system never says "type error" — the pieces just don't
/// want to. (GraphEdit/visual-flow lineage: LabVIEW/Scratch/Blueprints — ours runs on the same exact
/// integer physics as pong, and the compatibility oracle is the ZetaId, so the magnet IS the treaty.)
[<RequireQualifiedAccess>]
module MagneticPorts =

    type Direction =
        | Source
        | Sink
        | Transform // both faces: sink on one side, source on the other

    /// A port: a body + direction + the interface type it speaks (by ZetaId).
    type Port =
        { Body: Chip9Phys.Body
          Dir: Direction
          TypeId: string }

    let port (x: int) (y: int) (dir: Direction) (typeId: string) : Port =
        { Body =
            { Pos = Chip9Phys.v2 (Chip9Phys.ofInt x) (Chip9Phys.ofInt y)
              Size = Chip9Phys.v2 Chip9Phys.one Chip9Phys.one
              Vel = Chip9Phys.v2 0 0 }
          Dir = dir
          TypeId = typeId }

    /// CAN they connect? source→sink (or either side of a transform) with the same type id.
    let compatible (a: Port) (b: Port) : bool =
        let flows =
            match a.Dir, b.Dir with
            | Source, Sink | Sink, Source -> true
            | Transform, _ | _, Transform -> true
            | _ -> false
        flows && a.TypeId = b.TypeId

    /// THE MAGNET: the force on `a` toward/away from `b` — attract when compatible, repel when not,
    /// scaled by 1/distance (closer = stronger feel; exact integers; zero at coincidence — no NaN).
    let force (a: Port) (b: Port) : Chip9Phys.Fix * Chip9Phys.Fix =
        let dx = b.Body.Pos.X - a.Body.Pos.X
        let dy = b.Body.Pos.Y - a.Body.Pos.Y
        if dx = 0 && dy = 0 then 0, 0
        else
            // d² in int64 (Kira r3: fix16 mul wrapped negative past ~181px separation, the clamp
            // collapsed the divisor to one, and the "magnet" teleported ports 800px/tick)
            let d2L = (int64 dx * int64 dx + int64 dy * int64 dy) >>> 16
            let d2 = int (min d2L (int64 System.Int32.MaxValue))
            let sign = if compatible a b then 1 else -1
            let k = Chip9Phys.ofInt (sign * 4) // the feel constant: WHAT = snap strength; WHY = strong enough to feel, weak enough to escape
            Chip9Phys.mul k (Chip9Phys.div dx (max Chip9Phys.one d2)),
            Chip9Phys.mul k (Chip9Phys.div dy (max Chip9Phys.one d2))

    /// SNAPPED? — close enough and compatible: the click (the connection is MADE; GraphEdit's snap).
    let snapped (a: Port) (b: Port) : bool =
        compatible a b && Chip9Phys.overlaps a.Body b.Body

    /// One drag tick: apply the magnetic forces from every other port to `a` and integrate — the
    /// piece in the kid's hand FEELS the field of everything it could (or couldn't) connect to.
    let dragTick (others: Port list) (a: Port) : Port =
        let fx, fy =
            others
            |> List.fold (fun (sx, sy) o -> let (x, y) = force a o in (sx + x, sy + y)) (0, 0)
        let moved =
            { a.Body with Vel = Chip9Phys.v2 fx fy }
            |> Chip9Phys.integrate Chip9Phys.one
        { a with Body = { moved with Vel = Chip9Phys.v2 0 0 } }

    // ── feedback channels (Aaron 2026-06-11: "they all need feedback channels if flow goes through —
    // it's just a good idea most times"). A snap doesn't make a pipe; it makes a FOUR-CORNER
    // connection: once flow runs, the feedback corners are OPEN BY DEFAULT (TInFeedback/TOutFeedback —
    // the Itron lineage). "Most times" honored: it is a DEFAULT, not a law — a connection may declare
    // feedback closed, but it must SAY so (the declared-not-assumed discipline). ──

    /// A made connection: the two ports + whether the feedback corners are open (default: yes).
    type Connection =
        { From: Port
          To: Port
          FeedbackOpen: bool }

    /// Connect two ports: Some iff snapped (compatible + touching) — feedback open by default.
    let connect (a: Port) (b: Port) : Connection option =
        if snapped a b then Some { From = a; To = b; FeedbackOpen = true } else None

    /// Close the feedback corners EXPLICITLY — allowed when (Aaron's conditions, verbatim): "you are
    /// really trying to OPTIMIZE and you know it's not COERCIVE, or you don't need the feedback
    /// channel because the MATH GUYS told us" (a proof on the docket, not a hunch). The closing is a
    /// visible act, never an omission.
    let withoutFeedback (c: Connection) : Connection = { c with FeedbackOpen = false }

    // ── THE MISSING PIECE (Aaron 2026-06-12: "is there a lens we could slap on, like the old
    // GraphEdit, that would make these snap together using a missing piece from the toolbox — the
    // shape that completes the graph flow?"). GraphEdit's move, made ours: when two ports do NOT
    // speak the same type, search the toolbox for the ADAPTER whose in-face matches the source and
    // whose out-face matches the sink. The first real adapter is algebra.mod2 — the quotient
    // Z → Z/2 that snaps braid memory (crossing ORDER, Artin) into adinkra parity (the dashing
    // bit, Gates): order forgotten, parity kept. Not an inverse — a projection; the lens that
    // completes the flow is the map that forgets exactly the register the sink cannot hear. ──

    /// A toolbox piece: one body, two faces — a sink it listens on and a source it speaks from.
    type Piece =
        { Name: string
          ZetaId: string
          In: Port
          Out: Port }

    let piece (name: string) (zetaId: string) (x: int) (y: int) (inType: string) (outType: string) : Piece =
        { Name = name
          ZetaId = zetaId
          In = port x y Sink inType
          Out = port (x + 1) y Source outType }

    /// Does this piece complete the flow a → piece → b?
    let adapts (p: Piece) (a: Port) (b: Port) : bool =
        compatible a p.In && compatible p.Out b

    /// THE LENS: when a and b cannot connect directly, the first toolbox piece that completes the
    /// flow — None means the toolbox is honestly missing the shape (a named gap, not a forced fit).
    let findAdapter (toolbox: Piece list) (a: Port) (b: Port) : Piece option =
        if compatible a b then None // nothing missing: they already snap
        else toolbox |> List.tryFind (fun p -> adapts p a b)
