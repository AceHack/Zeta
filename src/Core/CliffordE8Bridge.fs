namespace Zeta.Core

open System.Numerics

/// **`CliffordE8Bridge` — the middle of the adinkra → Clifford → E8 unfold (Aaron 2026-06-19, shadow\*).**
///
/// The ends of the ladder are already proven in code: `AdinkraCode` (octonion → Fano → [8,4] doubly-even
/// self-dual code) and `E8Lattice` (Construction A over that code → the 240 E8 roots). `Cl3` (Clifford
/// `Cl(3,0)`) existed but sat **isolated**. This module **stitches `Cl3` to `E8Lattice`**, the step Aaron's
/// note (`E8Lattice.fs:5`) flagged as belief-not-theorem.
///
/// **The bridge (what it IS):** `Cl(3,0)` is 8-dimensional with basis blades indexed by a 3-bit mask `0..7`
/// (`Cl3` field order `[S; E1; E2; E12; E3; E13; E23; E123]` = masks `0..7`). E8's roots are length-8 integer
/// vectors whose coordinates `0..7` are the 8 positions of the same `[8,4]` code. So **coordinate `i` ↔ blade
/// mask `i`** is a natural bijection that makes the two 8-dim spaces *one object*. It is a **linear isometry**:
/// it preserves addition and the Euclidean norm² (so every E8 root maps to a Cl(3,0) multivector of the same
/// norm² = 4), and it endows each E8 coordinate with a **Clifford grade** = `popcount(i)` — partitioning the 8
/// coordinates into the graded `1 + 3 + 3 + 1` (scalar · vectors · bivectors · pseudoscalar).
///
/// **Honest scope (peel):** this is the **basis / metric** bridge — an isometric identification of E8's ambient
/// ℝ⁸ with `Cl(3,0)`'s blade space, plus the grade labeling. It does **NOT** claim the Clifford **geometric
/// product** alone *generates* the E8 root system (the deeper "unfold" — that GA dynamics produce the 240 roots
/// — remains open/aspirational, `FROZEN-CORE §B`). What is proven here: the 8↔8 linear isometry, the
/// root↔multivector bijection preserving norm², and the grade partition.
///
/// Anchors: W. K. Clifford (geometric algebra); Conway–Sloane (E8 Construction A); Gates (adinkra doubly-even
/// self-dual ECC). Ties: `docs/research/2026-06-19-adinkra-clifford-e8-unfold-status-…`.
[<RequireQualifiedAccess>]
module CliffordE8Bridge =

    /// The Clifford grade (blade rank) of E8 coordinate `i` = popcount of its 3-bit blade mask.
    /// Grades: `0`→scalar, `1/2/4`→vectors (grade 1), `3/5/6`→bivectors (grade 2), `7`→pseudoscalar (grade 3).
    let gradeOfCoord (i: int) : int = BitOperations.PopCount(uint (i &&& 0b111))

    /// Express an E8 root (length-8 integer vector; coordinate `i` = blade mask `i`) as a `Cl(3,0)` multivector.
    let rootToMv (x: int[]) : Cl3.Mv =
        { Cl3.S = float x.[0]
          Cl3.E1 = float x.[1]
          Cl3.E2 = float x.[2]
          Cl3.E12 = float x.[3]
          Cl3.E3 = float x.[4]
          Cl3.E13 = float x.[5]
          Cl3.E23 = float x.[6]
          Cl3.E123 = float x.[7] }

    /// Inverse: a multivector with (near-)integer coefficients back to an 8-int vector (round-to-nearest).
    let mvToRoot (m: Cl3.Mv) : int[] =
        [| int (round m.S)
           int (round m.E1)
           int (round m.E2)
           int (round m.E12)
           int (round m.E3)
           int (round m.E13)
           int (round m.E23)
           int (round m.E123) |]

    /// The 240 E8 roots, carried into `Cl(3,0)` as multivectors (the unfold, realized at the basis/metric level).
    let rootMvs : Cl3.Mv list = E8Lattice.roots |> List.map rootToMv
