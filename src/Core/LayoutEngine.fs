namespace Zeta.Core

/// LayoutEngine — **boundary-aware auto-layout tools, each a ZetaId** (Aaron 2026-06-11: "imagine
/// disk-defrag on Windows or WinDirStat — that kind of view — for our most complicated data formats:
/// the merkle, branching time… some fuzzy rendering, and graphviz-like auto-layout; ZetaIds for
/// different boundary-aware auto-layout tools").
///
/// The layout family registers like every artifact (content-addressed ids; a file references its
/// layout BY id): `layout.treemap` (the WinDirStat view — size-weighted nesting), `layout.defrag`
/// (the block grid — allocation made visible), `layout.dag` (graphviz lineage — merkle/dependency),
/// `layout.timeline` (branching time — worldlines and weaves), `layout.force` (the fuzzy one —
/// positions carry UNCERTAINTY on the deep-pixel channel: a node not yet settled is VISIBLY
/// provisional, the StrokeAnim register at graph scale).
///
/// Built today: the treemap's core — SLICE-AND-DICE (Shneiderman 1992): weights → nested rectangles,
/// exact integers, alternating axis per depth. The rest are registered, named slices.
[<RequireQualifiedAccess>]
module LayoutEngine =

    /// The registered layout tools (the shelf — boundary-aware, each addressable by id).
    let known: GeneratorRegistry.Entry list =
        [ GeneratorRegistry.register "layout.treemap" 1
          GeneratorRegistry.register "layout.defrag" 1
          GeneratorRegistry.register "layout.dag" 1
          GeneratorRegistry.register "layout.timeline" 1
          GeneratorRegistry.register "layout.force" 1 ]

    /// A laid-out rectangle: the item's name, its box (x, y, w, h) — exact integers.
    type Rect = { Name: string; X: int; Y: int; W: int; H: int }

    /// SLICE-AND-DICE treemap: divide (x,y,w,h) among weighted items along one axis, proportionally,
    /// exact-integer remainders pushed left-to-right (no pixel lost, no pixel invented: the boxes
    /// tile the boundary EXACTLY — boundary-aware by construction).
    let treemap (x: int) (y: int) (w: int) (h: int) (horizontal: bool) (items: (string * int) list) : Rect list =
        let total = items |> List.sumBy (fun (_, w) -> max 0 w) // clamp HERE too (Kira r3 P0: raw sum + clamped walk let one box tile TWICE the boundary on negative weights)
        if total <= 0 then []
        else
            let span = if horizontal then w else h
            let mutable offset = 0
            let mutable used = 0
            let mutable acc = 0

            [ for (name, weight) in items do
                  acc <- acc + max 0 weight
                  let upTo = int (int64 span * int64 acc / int64 total)
                  let size = upTo - used
                  let r =
                      if horizontal then { Name = name; X = x + offset; Y = y; W = size; H = h }
                      else { Name = name; X = x; Y = y + offset; W = w; H = size }
                  offset <- offset + size
                  used <- upTo
                  yield r ]
