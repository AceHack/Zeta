namespace Zeta.Core

/// ZetaMax — **the ZetaMax Spectrum palette render binding** (Aaron 2026-06-11: "zetamax spectrum
/// color" → "lets do the zetamax spectrum palette render on the board"). Renders a CHIP-9 frame to
/// ANSI terminal lines — the board/TV's color channel for the lens.
///
/// **The arithmetic identity that makes this binding almost free:** CHIP-9's plane mask is R=1, G=2,
/// B=4 — and ANSI's 3-bit color codes are exactly the same bit order (30+mask: 31=red, 32=green,
/// 33=yellow, 34=blue, 35=magenta, 36=cyan, 37=white). So `colorAt` IS the ANSI color, offset by 30.
/// The 8 colors are the ZX Spectrum palette (Sinclair 1982) — the name is literal.
///
/// **Capability-honest dispatch** (`universal/color.md`): a frame that never used the higher planes
/// (`Extra` empty) binds at **Mono1** — classic white-on-black, the original look — while a frame with
/// color binds at **Indexed8** with the literal palette. No mode flag: the frame's own state declares
/// its capability (mono is the zero case, structurally — same law as the opcodes).
///
/// Pixel doubling: two display rows per text line via the upper-half block `▀` (fg = top pixel,
/// bg = bottom pixel) — 64×32 renders as 64×16 characters, the classic terminal-emulator move.
[<RequireQualifiedAccess>]
module ZetaMax =

    /// The frame's honest capability: Mono1 iff no higher plane ever materialized.
    type Capability =
        | Mono1
        | Indexed8

    let capabilityOf (f: Chip8Cow.Frame) : Capability =
        if Map.isEmpty f.Extra then Mono1 else Indexed8

    /// The palette name for a mask (the ZX Spectrum set — documentation + tests speak it).
    let colorName (mask: byte) : string =
        match mask &&& 7uy with
        | 0uy -> "black"
        | 1uy -> "red"
        | 2uy -> "green"
        | 3uy -> "yellow"
        | 4uy -> "blue"
        | 5uy -> "magenta"
        | 6uy -> "cyan"
        | _ -> "white"

    /// ANSI foreground SGR for a mask — the identity: 30 + mask (Mono1 lit renders white, 37).
    let private fg (mask: byte) = sprintf "\u001b[3%dm" (int (mask &&& 7uy))
    /// ANSI background SGR for a mask: 40 + mask.
    let private bg (mask: byte) = sprintf "\u001b[4%dm" (int (mask &&& 7uy))
    let private reset = "\u001b[0m"

    /// The mask to render at a pixel under the frame's capability: Mono1 lifts lit⇒white (7).
    let private renderMask (cap: Capability) (f: Chip8Cow.Frame) (x: int) (y: int) : byte =
        match cap with
        | Mono1 -> if Chip8Cow.pixel x y f then 7uy else 0uy
        | Indexed8 -> Chip8Cow.colorAt x y f

    /// Render the frame as ANSI lines (64×16 chars; two pixel rows per line via ▀). Deterministic:
    /// same frame, same bytes. Black-on-black cells emit a plain space (no useless SGR noise).
    let render (f: Chip8Cow.Frame) : string list =
        let cap = capabilityOf f

        [ for ty in 0 .. (Chip8.DisplayH / 2) - 1 ->
              let sb = System.Text.StringBuilder()

              for x in 0 .. Chip8.DisplayW - 1 do
                  let top = renderMask cap f x (ty * 2)
                  let bot = renderMask cap f x (ty * 2 + 1)

                  if top = 0uy && bot = 0uy then
                      sb.Append ' ' |> ignore
                  else
                      sb.Append(fg top).Append(bg bot).Append('▀').Append(reset) |> ignore

              sb.ToString() ]

    /// The plain (SGR-stripped) render — the structural zero case: same layout, color absent.
    let plain (f: Chip8Cow.Frame) : string list =
        render f
        |> List.map (fun l -> System.Text.RegularExpressions.Regex.Replace(l, "\u001b\[[0-9;]*m", ""))
