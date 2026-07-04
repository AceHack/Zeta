namespace Zeta.Core

open Zeta.Core.Optics

/// PixelLens — **data and uncertainty travel WITH the pixels; lens overlays reveal the sub-pixel
/// layer** (Aaron 2026-06-11: "lens overlays will allow shifting of this and revealing of sub-pixel
/// data where applicable — data storage in sub-pixel data… data and uncertainty can travel with the
/// pixels in a way our soft side can understand and predict with, and colorize too").
///
/// The room was already there: the physics runs 65,536× finer than the display (Chip9Phys 16.16), so
/// a pixel's coarse color is a PROJECTION of a deeper cell. This module makes the deeper cell
/// addressable — a 32-bit sub-pixel cell:
///
///     bits 0-2   color (the CHIP-9 mask — what the display shows)
///     bits 3-15  payload (13 bits of data riding WITH the pixel)
///     bits 16-31 uncertainty (16-bit milli-scale: 0 = certain … 65535 ≈ unknown)
///
/// Three lawful LENSES (Optics.ILens — get-put/put-get hold by construction) focus the three fields:
/// the display reads `color`; the soft side reads `(payload, uncertainty)` and can PREDICT (a
/// SoftValue-shaped read: value + how sure) and COLORIZE — uncertainty rendered honestly as visual
/// texture (a certain pixel shows its color; an uncertain one declares itself). The "lens overlay
/// shift" is exactly the ILens composition: same frame, a different focus, the sub-pixel layer
/// revealed where applicable — and a mono consumer never sees any of it (bits 3+ are invisible to
/// `colorOf` — the zero case holds).
[<RequireQualifiedAccess>]
module PixelLens =

    /// A sub-pixel cell: the 32-bit deep pixel.
    type Cell = uint32

    /// Pack (color, payload, uncertainty) into a cell — MASKED to their fields. Total in the
    /// never-throws sense ONLY: out-of-range inputs silently truncate to field width (pack _ -1 _
    /// round-trips payload as 8191 — r3 doc fix: "no overflow" overstated this as no-loss).
    /// Callers needing refusal-on-overflow validate before packing.
    let pack (color: byte) (payload: int) (uncertaintyMilli: int) : Cell =
        (uint32 color &&& 0x7u)
        ||| ((uint32 payload &&& 0x1FFFu) <<< 3)
        ||| ((uint32 uncertaintyMilli &&& 0xFFFFu) <<< 16)

    /// Try to pack (color, payload, uncertainty) without loss. Returns Error if any input is out of range.
    let tryPack (color: byte) (payload: int) (uncertaintyMilli: int) : Result<Cell, string> =
        if color > 7uy then Error "color out of 3-bit range (0..7)"
        elif payload < 0 || payload > 8191 then Error "payload out of 13-bit range (0..8191)"
        elif uncertaintyMilli < 0 || uncertaintyMilli > 65535 then Error "uncertainty out of 16-bit range (0..65535)"
        else Ok (pack color payload uncertaintyMilli)

    /// The color lens — what the DISPLAY sees (the projection; bits 3+ invisible: the zero case).
    let color: ILens<Cell, byte> =
        { new ILens<Cell, byte> with
            member _.Get c = byte (c &&& 0x7u)
            member _.Set v c = (c &&& ~~~0x7u) ||| (uint32 v &&& 0x7u) }

    /// The payload lens — the data riding with the pixel (the sub-pixel storage).
    let payload: ILens<Cell, int> =
        { new ILens<Cell, int> with
            member _.Get c = int ((c >>> 3) &&& 0x1FFFu)
            member _.Set v c = (c &&& ~~~(0x1FFFu <<< 3)) ||| ((uint32 v &&& 0x1FFFu) <<< 3) }

    /// The uncertainty lens — how sure the soft side is about this pixel (milli-scale).
    let uncertainty: ILens<Cell, int> =
        { new ILens<Cell, int> with
            member _.Get c = int ((c >>> 16) &&& 0xFFFFu)
            member _.Set v c = (c &&& 0x0000FFFFu) ||| ((uint32 v &&& 0xFFFFu) <<< 16) }

    /// The soft read: the pixel as (payload, confidence) — SoftValue-shaped, ready for prediction.
    let softRead (c: Cell) : int * float =
        payload.Get c, 1.0 - float (uncertainty.Get c) / 65535.0

    /// COLORIZE the uncertainty honestly: a certain pixel shows its color; an uncertain pixel
    /// DECLARES itself — above the threshold its color is dimmed to the mono bit only (the display's
    /// way of saying "don't lean on me"). Honest rendering: uncertainty is visible as texture,
    /// never silently painted over.
    let colorize (thresholdMilli: int) (c: Cell) : byte =
        let v = color.Get c
        if uncertainty.Get c <= thresholdMilli then v
        else v &&& 0x1uy // uncertain: collapse to the mono bit — visibly humbler

    /// The overlay SHIFT: focus the same lens family on a neighboring cell of a frame map —
    /// the lens-overlay move (same world, shifted focus; sub-pixel revealed where applicable).
    let shift (dx: int) (dy: int) (w: int) ((x, y): int * int) : int * int =
        (((x + dx) % w) + w) % w, y + dy
