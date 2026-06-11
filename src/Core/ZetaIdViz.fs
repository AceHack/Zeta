namespace Zeta.Core

open Zeta.Core.FSharp.ZetaId

/// ZetaIdViz — **every ZetaId category gets a way to be SEEN** (Aaron 2026-06-11: "every zetaid
/// category should have a way to visualize it — they are all generators anyway").
///
/// "They are all generators anyway" is the design: a ZetaId is already a deterministic mint, so its
/// visualization is just ONE MORE GENERATOR — `glyphOf` derives an 8×8 identicon-style glyph from the
/// id's own bits (mirror-symmetric: the left half comes from the bits, the right half is the mirror —
/// the BoundaryLight `mirror` move, which is also why every glyph reads as a "face"), and the
/// CATEGORY picks the CHIP-9 plane color — so WHAT KIND of thing an id is, is visible at a glance
/// (safety/jurisdiction at a glance, extended to identity), and WHICH thing it is, is the pattern.
///
/// Deterministic end-to-end: same id ⇒ same glyph ⇒ same pixels on every node (the glyph is registered
/// in GeneratorRegistry as `zetaid.glyph` v1 — referenceable by its own ZetaId, shape A and proud).
/// Anchors: identicons (Park's visual hash, 2007 — gravatar lineage); our mirror/glyph primitives.
[<RequireQualifiedAccess>]
module ZetaIdViz =

    /// The CHIP-9 color mask for a category — the at-a-glance channel. Total over the registered
    /// categories; Extended/unknown render white (7: "all channels — tell me more").
    let colorOf (c: Category) : byte =
        match c with
        | Category.Observation -> 6uy // cyan — what crosses in (the shadow register)
        | Category.Emission -> 1uy // red — what goes out
        | Category.Workflow -> 2uy // green — work in motion
        | Category.Heartbeat -> 5uy // magenta — the pulse
        | Category.Batch -> 3uy // yellow — bulk transport
        | Category.FrictionTelemetry -> 1uy // red family — friction runs hot
        | Category.Bus -> 4uy // blue — the wire
        | Category.Spawn -> 2uy // green family — new life
        | Category.WorkItem -> 3uy // yellow family — the board
        | Category.ContentAddress -> 6uy // cyan family — content is observed, not commanded
        | _ -> 7uy // Extended / future: white until they earn a channel

    /// The glyph: 8 rows of 8 bits, mirror-symmetric, derived from the id's low 32 bits (4 bits per
    /// row → the left half; the right half mirrors). Deterministic; the id IS the picture.
    let glyphOf (id: System.UInt128) : byte[] =
        [| for row in 0..7 ->
               let nibble = byte ((id >>> (row * 4)) &&& System.UInt128.op_Implicit 0xFUL) &&& 0xFuy
               // left half = the nibble; right half = its bit-reverse (the mirror)
               let mutable rev = 0uy
               for b in 0..3 do
                   if nibble &&& (1uy <<< b) <> 0uy then rev <- rev ||| (1uy <<< (3 - b))
               (nibble <<< 4) ||| rev |]

    /// Render an id + category as MediaLines entries (a `glyph` row + a `palette` row) — the artifact
    /// form every surface (board, card, TV) consumes; the filetype refers to THIS generator by its
    /// registered ZetaId.
    let toMediaLines (name: string) (category: Category) (id: System.UInt128) : MediaLines.Entry list =
        let hex = glyphOf id |> Array.map (sprintf "%02x") |> String.concat ""
        [ { Kind = "glyph"; Name = name; Fields = [ hex ] }
          { Kind = "palette"; Name = name; Fields = [ string (colorOf category) ] } ]
