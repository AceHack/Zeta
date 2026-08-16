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
/// assignment) are the named next slice, and they belong on the retraction register (a dashed edge
/// = a −1: the CMYK reading was born for this).
///
/// **THE DASHING IS NOT THE CODE** (corrected 2026-08-15; the sentence here used to call dashings
/// "the actual Hamming-code content of AdinkraCode", which is false). An adinkra is TWO independent
/// GF(2) data on two different layers (Doran–Faux–Gates–Hübsch–Iga–Landweber, *Codes and
/// supersymmetry in one dimension*, ATMP 15 (2011) 1909):
///
/// * the **doubly-even code** `C ⊆ F₂^N` — a LINEAR SUBSPACE (contains 0) that fixes the
///   CHROMOTOPOLOGY, i.e. which N-cube quotient `F₂^N / C` the graph is. `AdinkraCode`'s [8,4,4]
///   extended Hamming code is this datum at **N = 8**: 16 codewords, quotient graph 16 nodes,
///   **8-regular, 64 edges**.
/// * the **dashing** — an odd 1-cochain on that graph, the datum THIS module carries at **N = 4**
///   with the TRIVIAL code `C = {0}`: the bare 4-cube, 16 nodes, **4-regular, 32 edges**. The valid
///   dashings form a **TORSOR** over the vertex-flip gauge group, not a code: **32768 = 2¹⁵** of
///   them, with **no distinguished zero** — the all-solid assignment is *not* a dashing, because
///   every face would carry 0 (even) dashes. A linear code always contains 0; a torsor never does.
///
/// The two layers are related by an EXISTENCE theorem, never by identity: doubly-evenness of `C` is
/// the condition under which a dashing exists on the quotient. **Node count cannot tell the two
/// graphs apart — both are 16. Valence can: 4 vs 8.** Pinned in `AdinkraViz.Tests.fs`
/// ("quotient code ≠ dashing torsor"). Prior diagnosis of the same conflation (filed P1, unfixed
/// until now): `docs/research/2026-06-12-the-dashed-braid-math-team-REPORT-5-restricted-span-writheparity-terminal.md` §3.
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
    let flippedBit (a: int) (b: int) : int =
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

    // ── DASHINGS (the retraction register — the named slice, landed via Aaron's adinkra↔Majorana
    // question 2026-06-12). An adinkra is not just colored edges: each edge carries a SIGN
    // (solid = +1, dashed = −1), and the Gates condition is that every 2-colored 4-cycle carries
    // an ODD number of dashed edges (this is gamma-matrix anticommutation drawn: γiγj = −γjγi).
    // The twist is GLOBAL: flipping all edges at a vertex (the gauge move) changes which edges
    // are dashed but can NEVER make a 4-cycle's dash count even — the same sentence THE STUCK LAW
    // says about the locked braid (no local move removes the twist). Rhyme, made testable;
    // the break stays honest (adinkra edges are involutions; braid generators remember). ──

    /// An edge of the N=4 hypercube, canonical form: (lower vertex, bit). 32 edges total.
    type Edge = int * int

    /// All 32 edges (vertex v < v ^^^ (1 <<< bit) — each edge once).
    let allEdges: Edge list =
        [ for v in 0..15 do
              for bit in 0..3 do
                  if v &&& (1 <<< bit) = 0 then yield v, bit ]

    /// A dashing: the set of DASHED edges (−1 signs); everything else solid (+1).
    type Dashing = Set<Edge>

    /// The standard (valise/Clifford) dashing: edge (v, i) is dashed iff v has an odd number of
    /// set bits BELOW bit i — exactly the sign rule of the standard gamma-matrix representation.
    let standardDashing: Dashing =
        Set.ofList
            [ for (v, bit) in allEdges do
                  if System.Numerics.BitOperations.PopCount(uint (v &&& ((1 <<< bit) - 1))) % 2 = 1 then
                      yield v, bit ]

    /// Canonicalize an arbitrary (vertex, bit) reference to the edge's stored form.
    let private canon (v: int) (bit: int) : Edge =
        (if v &&& (1 <<< bit) = 0 then v else v ^^^ (1 <<< bit)), bit

    /// Is the edge at (v, bit) dashed under d?
    let isDashed (d: Dashing) (v: int) (bit: int) : bool = Set.contains (canon v bit) d

    /// THE GATES CONDITION on one 2-colored face: the 4-cycle at v in colors (i, j) — edges
    /// v→v^i, v^i→v^i^j, v^i^j→v^j, v^j→v — must carry an ODD number of dashes.
    let faceOdd (d: Dashing) (v: int) (i: int) (j: int) : bool =
        let vi = v ^^^ (1 <<< i)
        let vj = v ^^^ (1 <<< j)
        let count =
            [ isDashed d v i; isDashed d vi j; isDashed d vj i; isDashed d v j ]
            |> List.filter id
            |> List.length
        count % 2 = 1

    /// Does the Gates condition hold on EVERY 2-colored 4-cycle? (16 vertices × 6 color pairs,
    /// each face counted from each corner — redundancy is fine, the law is per-face.)
    let allFacesOdd (d: Dashing) : bool =
        [ for v in 0..15 do
              for i in 0..3 do
                  for j in i + 1 .. 3 -> faceOdd d v i j ]
        |> List.forall id

    /// THE GAUGE MOVE: flip every edge at vertex v (the local sign change — relabeling one node's
    /// fermion phase). Toggles 4 edges; each adjacent 2-colored face sees exactly TWO of its
    /// edges toggle, so its dash parity is INVARIANT — the twist cannot be removed locally.
    let flipVertex (v: int) (d: Dashing) : Dashing =
        [ 0..3 ]
        |> List.fold
            (fun (acc: Dashing) bit ->
                let e = canon v bit
                if Set.contains e acc then Set.remove e acc else Set.add e acc)
            d
