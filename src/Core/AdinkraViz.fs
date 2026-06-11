namespace Zeta.Core

/// AdinkraViz — **seeing the adinkras** (Aaron 2026-06-11: "does this make adinkras easy now? Can we
/// see what they look like? — with a generator SHINING, or prisming, or whatever they do when you use
/// it in that direction").
///
/// Yes — easy now, because the mapping is exact: an adinkra (Gates/Iga — the supersymmetry
/// chromotopology) is nodes + COLORED edges, one color per SUSY generator — and an N=4 adinkra's four
/// edge colors land on our four channels (R, G, B, cyan) one-to-one. Bosons (even weight) are filled
/// nodes, fermions (odd) open; flipping any one bit flips parity, so the 4×4 gray-code layout is a
/// perfect boson/fermion CHECKERBOARD — visible at a glance, which is the point.
///
/// **The SHINE**: using generator i in a direction lights its color — `render shine=Some i` draws
/// that generator's edges BRIGHT (its channel) and dims the rest. The prism reading is exact: the
/// adinkra holds all four colors superposed; shining selects one out — the soft prism applied to a
/// supersymmetry diagram.
///
/// Honest scope: the 4×4 gray-code grid shows the 24 grid-adjacent edges of the 4-cube (the 8 wrap
/// edges are stated, not drawn — a flat grid cannot show a tesseract whole); DASHINGS (the sign
/// assignment — the actual Hamming-code content of AdinkraCode) are the named next slice, and they
/// belong on the retraction register (a dashed edge = a −1: the CMYK reading was born for this).
[<RequireQualifiedAccess>]
module AdinkraViz =

    let private esc (c: int) = sprintf "[3%dm" c
    let private dim = "[2m"
    let private reset = "[0m"

    /// Gray code order for the 4×4 layout (adjacent cells differ in exactly one bit).
    let private gray = [| 0; 1; 3; 2 |]

    /// The 4-bit node at grid (col, row): low two bits from the column gray code, high two from row.
    let nodeAt (col: int) (row: int) : int = gray.[col &&& 3] ||| (gray.[row &&& 3] <<< 2)

    /// Which bit differs between two grid-adjacent nodes (the edge's GENERATOR = its color).
    let private flippedBit (a: int) (b: int) : int =
        let d = a ^^^ b
        [ 0..3 ] |> List.find (fun i -> d = (1 <<< i))

    /// The four generator colors on our channels: bit0=R(1), bit1=G(2), bit2=B(4), bit3=cyan(6).
    let colorOfBit (bit: int) : int =
        match bit with
        | 0 -> 1
        | 1 -> 2
        | 2 -> 4
        | _ -> 6

    /// Render the N=4 adinkra as ANSI lines. `shine = Some bit` lights that generator's edges bright
    /// and dims the others (the prism: one color selected out of the superposition). Bosons ●,
    /// fermions ○ — the checkerboard is the parity proof, visible.
    let render (shine: int option) : string list =
        let edgeStr (bit: int) (glyph: string) =
            let c = esc (colorOfBit bit)
            match shine with
            | Some s when s = bit -> c + glyph + reset // shining: bright in its channel
            | Some _ -> dim + glyph + reset // another generator selected: dimmed
            | None -> c + glyph + reset // no shine: all four colors live together

        [ for row in 0..3 do
              // the node row: nodes + horizontal edges (bit from the column gray flip)
              let nodes =
                  [ for col in 0..3 ->
                        let n = nodeAt col row
                        let glyph = if (System.Numerics.BitOperations.PopCount(uint n)) % 2 = 0 then "●" else "○"
                        let h =
                            if col < 3 then edgeStr (flippedBit n (nodeAt (col + 1) row)) "──"
                            else ""
                        glyph + h ]
                  |> String.concat ""
              yield nodes
              // the vertical-edge row (bit from the row gray flip)
              if row < 3 then
                  yield
                      [ for col in 0..3 ->
                            let bit = flippedBit (nodeAt col row) (nodeAt col (row + 1))
                            edgeStr bit "│" + "  " ]
                      |> String.concat "" ]
