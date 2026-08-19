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

    /// Fold a 128-bit id down to the 32 bits the glyph can actually carry.
    ///
    /// WHY THIS EXISTS (fixed 2026-08-19). `glyphOf` used to read `id >>> (row * 4)` for rows 0..7,
    /// i.e. **bits 0-31 only** — it discarded 96 of 128 bits. On the Observation layout that is not
    /// a generic truncation, it is a specific one: `BitLayout` puts `Randomness` at offset 0 width
    /// 32 (`GeneratedBitLayout.RandomnessOffset = 0<bit>`), so the picture was derived from the
    /// **nonce and nothing else**. Two ids differing in timestamp, category, authority, persona,
    /// location — every semantically meaningful field — drew the *identical* glyph. The header's
    /// claim that "WHICH thing it is, is the pattern" was true only of the random field.
    ///
    /// XOR of the four 32-bit lanes is the minimal repair: every input bit now reaches the output,
    /// and the mirror-symmetric 8x8 "face" (BoundaryLight `mirror`, and the reason a glyph reads as
    /// a face) is untouched. XOR is chosen over a hash because this must stay O(1), allocation-free
    /// and byte-identical across the F#/C#/TS oracles — a hash would need a fourth byte-lock.
    ///
    /// THE RESIDUAL IS REAL AND IS DECLARED, NOT PAPERED OVER. An 8x8 mirror-symmetric bitmap holds
    /// 32 bits, so this removes the *truncation* and cannot remove the *pigeonhole*: 2^96 ids still
    /// share each glyph and the birthday bound is ~2^16 = 65,536 ids. What changes is that a
    /// collision is now a function of the whole id rather than "these two share a nonce", and that
    /// the bound is a measured, tested fact rather than an accident. **Nothing may treat this glyph
    /// as an identity.** It is a recognition aid; `ZetaId` itself is the identity.
    /// (Widening it means dropping the mirror — which doubles capacity to 64 bits and costs the
    /// face. That is a design call, not a defect fix: 081M0DNCXZK087G0R003DEY5KF.)
    let internal foldTo32 (id: System.UInt128) : uint32 =
        let lane (shift: int) = uint32 ((id >>> shift) &&& System.UInt128.op_Implicit 0xFFFFFFFFUL)
        lane 0 ^^^ lane 32 ^^^ lane 64 ^^^ lane 96

    /// The number of distinct glyphs this generator can draw. Stated so a caller can check the
    /// bound instead of assuming the picture identifies an id. See `foldTo32`.
    let GlyphSpaceBits = 32

    /// The glyph: 8 rows of 8 bits, mirror-symmetric, derived from ALL 128 bits of the id folded to
    /// 32 (4 bits per row → the left half; the right half mirrors). Deterministic; the id IS the
    /// picture — up to the declared 32-bit glyph space, which is `GlyphSpaceBits`.
    let glyphOf (id: System.UInt128) : byte[] =
        let folded = foldTo32 id
        [| for row in 0..7 ->
               let nibble = byte ((folded >>> (row * 4)) &&& 0xFu) &&& 0xFuy
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
