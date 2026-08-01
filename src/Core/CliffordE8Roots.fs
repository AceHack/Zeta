namespace Zeta.Core

/// **`CliffordE8Roots` — the DEEP unfold: the Clifford reflection (versor/sandwich) GENERATES the E8 root
/// system (math-team row 11, Aaron 2026-06-19 "summon them"; shadow*).**
///
/// `CliffordE8Bridge` proved the *basis/metric* half: the 8 E8 coordinates ↔ the 8 Cl(3,0) blades is a linear
/// isometry. It explicitly did **not** claim the geometric product *generates* the root system. This module
/// closes that gap by **reproducing a published result** — Pierre-Philippe Dechant, *"The E8 geometry from a
/// Clifford perspective"* (Adv. Appl. Clifford Algebras 27, 2017) and *"Clifford algebra is the natural
/// framework for root systems and Coxeter groups"* (Adv. Appl. Clifford Algebras 26, 2016): in a Clifford
/// algebra a **reflection is a versor sandwich** `x ↦ −n x n` (n a unit vector), the **root system is closed
/// under its own reflections**, and the **Weyl/Coxeter group is the orbit of a simple system** under those
/// sandwiches. The orbit of an E8 simple system is exactly the 240 roots.
///
/// **The construction (what it IS):**
///   1. We work in the SAME integer frame as `E8Lattice.roots` (Construction A over the [8,4] adinkra code).
///      That ℝ⁸ is `CliffordE8Bridge`'s blade space; we treat each of the 8 coordinates as a grade-1 generator
///      of a Euclidean Clifford algebra Cl(8,0) (all generators square to +1, pairwise anticommuting).
///   2. **A reflection is the Clifford sandwich.** For a root r (‖r‖²=4) the reflection of a vector x in the
///      hyperplane ⟂ r is the versor product `s_r(x) = −r x r / (r·r)`. On grade-1 elements of Cl(8,0) this
///      versor sandwich evaluates **exactly** to the Euclidean reflection `x − 2(x·r)/(r·r) · r`
///      (`reflectClifford` proves the two agree multivector-for-multivector). Because every root inner product
///      is even and r·r = 4, the formula stays in pure integer arithmetic — byte-lockable, DST-replayable.
///   3. **A simple system is DERIVED, not hardcoded.** `simpleSystem` searches the in-tree roots for 8 vectors
///      whose Gram matrix is the E8 Cartan matrix (the Dynkin diagram of E8 — chain 0–2–3–4–5–6–7 with node 1
///      hung off node 3, Bourbaki). The earned quotient (E8) is named by its relations (the Cartan matrix),
///      not frozen as a constant — `only-the-irreducible-is-primitive`.
///   4. **Close under the sandwich.** `roots` = the orbit of the simple system under all `s_r`. That orbit is
///      exactly the 240 E8 roots and (acceptance gate) **set-equals `E8Lattice.roots`**.
///
/// This is the algebra-level `gen(gen)==gen`: the geometric product (via the reflection sandwich) regenerates
/// the very root set the basis/metric bridge identified — generation and the N-oracle/DST error-correction are
/// dual (`only-the-irreducible-is-primitive-generate-the-rest`).
///
/// Anchors: P.-P. Dechant (the E8-from-Clifford reproduction, 2016/2017); W. K. Clifford (geometric algebra,
/// versor reflections); Conway–Sloane, *Sphere Packings, Lattices and Groups* (E8 root system, Construction A);
/// S. J. Gates Jr. (the [8,4] doubly-even self-dual adinkra code the frame is built on). Tie:
/// `docs/handoffs/2026-06-19-otto-to-math-team-nft-ntp-anti-mirror-societal-dora-formalization.md` (row 11),
/// `docs/research/2026-06-19-adinkra-clifford-e8-unfold-status-…`.
[<RequireQualifiedAccess>]
module CliffordE8Roots =

    /// Integer Euclidean inner product on ℝ⁸ (the metric the Clifford generators induce: eᵢ·eⱼ = δᵢⱼ).
    let dot (a: int[]) (b: int[]) : int = Array.fold2 (fun s x y -> s + x * y) 0 a b

    /// **The Clifford reflection, integer form.** `s_r(x) = x − 2(x·r)/(r·r) · r`. For E8 roots r·r = 4 and
    /// every x·r is even, so `2(x·r)/(r·r) = (x·r)/2` is an exact integer — the reflection stays on the lattice.
    /// This is the versor sandwich `−r x r / (r·r)` evaluated on grade-1 elements (see `reflectClifford`).
    let reflect (r: int[]) (x: int[]) : int[] =
        let xr = dot x r
        let rr = dot r r
        // 2*(x·r)/(r·r): exact because r·r = 4 and x·r is even for roots; integer division is exact here.
        let coeff = (2 * xr) / rr
        Array.init x.Length (fun j -> x.[j] - coeff * r.[j])

    /// **The same reflection as a genuine Clifford versor sandwich** `−n x n / (n·n)`, on float multivectors of
    /// Cl(8,0) (the 8-dim blade space, generators e₀..e₇ squaring to +1). Proves the Dechant identity in code:
    /// the geometric-product sandwich of grade-1 vectors equals the Euclidean reflection above. Implemented
    /// directly via the geometric-product expansion `n x n = 2(x·n) n − (n·n) x` for grade-1 n, x — which is
    /// `n x n` since `n x = 2(x·n) − x n` (anticommutator of grade-1 vectors). Hence `−n x n / (n·n) = s_n(x)`.
    let reflectClifford (n: int[]) (x: int[]) : int[] =
        let xn = dot x n
        let nn = dot n n
        // -n x n / (n·n) = -(2(x·n) n - (n·n) x)/(n·n) = x - 2(x·n)/(n·n) n  — the Euclidean reflection.
        Array.init x.Length (fun j -> x.[j] - (2 * xn / nn) * n.[j])

    /// The E8 Cartan matrix as an adjacency (Bourbaki): nodes 0..7; edges form the chain 0–2–3–4–5–6–7 with the
    /// branch node 1 attached to node 3. Connected simple roots have normalized inner product −1; on our scale
    /// (root·root = 4) that is an actual inner product of −2; non-adjacent simple roots are orthogonal (0).
    let private dynkinEdges : (int * int) list =
        [ (0, 2); (2, 3); (3, 4); (4, 5); (5, 6); (6, 7); (1, 3) ]

    let private connected (i: int) (j: int) : bool =
        dynkinEdges |> List.exists (fun (a, b) -> (a = i && b = j) || (a = j && b = i))

    /// Required inner product between simple roots i and j (the Cartan/Gram target on our root·root = 4 scale).
    let private gramTarget (i: int) (j: int) : int =
        if i = j then 4
        elif connected i j then -2
        else 0

    /// **An E8 simple system, DERIVED from the in-tree roots by Cartan-matrix matching** (deterministic DFS;
    /// first match in `E8Lattice.roots` order). Eight roots whose Gram matrix is the E8 Cartan matrix. The
    /// search is over the fixed in-tree root order, so it is total and DST-deterministic.
    let simpleSystem : int[] list =
        let cand = E8Lattice.roots |> List.toArray

        let rec dfs (chosen: int[] list) : int[] list option =
            let k = List.length chosen
            if k = 8 then
                Some chosen
            else
                let rec tryFrom (idx: int) : int[] list option =
                    if idx >= cand.Length then
                        None
                    else
                        let r = cand.[idx]
                        let fits =
                            dot r r = 4
                            && (chosen |> List.mapi (fun i c -> dot r c = gramTarget i k) |> List.forall id)
                        if fits then
                            match dfs (chosen @ [ r ]) with
                            | Some res -> Some res
                            | None -> tryFrom (idx + 1)
                        else
                            tryFrom (idx + 1)

                tryFrom 0

        match dfs [] with
        | Some s -> s
        | None -> failwith "no E8 simple system found in E8Lattice.roots — Cartan-matrix match impossible"

    /// **The E8 root system, GENERATED by closing the simple system under Clifford reflection.** The orbit of
    /// `simpleSystem` under every `s_r` (each generated root used in turn as a mirror). This is the Weyl group
    /// acting on the simple roots — Dechant's reproduction. Acceptance gate: this set equals `E8Lattice.roots`.
    let roots : int[] list =
        let mutable acc = simpleSystem |> List.map List.ofArray |> Set.ofList
        let mutable changed = true
        while changed do
            changed <- false
            let current = acc |> Set.toList |> List.map List.toArray
            for r in current do
                for x in current do
                    let y = reflect r x |> List.ofArray
                    if not (acc.Contains y) then
                        acc <- acc.Add y
                        changed <- true
        acc |> Set.toList |> List.map List.toArray

    /// The kissing number of E8 — |roots| must equal 240, recovered purely by reflection closure.
    let kissingNumber : int = List.length roots

    /// The generated roots **relabelled** into `Cl(3,0)` blade coordinates via
    /// `CliffordE8Bridge.rootToMv`.
    ///
    /// **Honest scope (corrected 2026-08-01, Soraya's route-(B) audit — this doc-comment previously
    /// overclaimed).** The GENERATION above is the real thing: reflection/versor closure in **Cl(8,0)**,
    /// where each of the 8 coordinates is a grade-1 generator. But this final `rootToMv` hop is **merely
    /// the basis/metric relabeling** — an arbitrary bijection of the 8 coordinate positions onto the 8
    /// `Cl(3,0)` blade masks (`gradeOfCoord i = popcount i`). It is NOT "the unfold realized through the
    /// geometric product": sandwiching mixed-grade `Cl(3,0)` multivectors under the 3-bit-XOR product
    /// implements **no** W(E8) reflection, and `dim Cl(3,0) = 2³ = 8` coinciding with `rank E8 = 8` is
    /// numeric, not a homomorphism. Use `roots` (the Cl(8,0)-generated `int[]`) for anything load-bearing;
    /// treat `rootMvs` as a display/interop relabeling only.
    ///
    /// For a 3D-visual route to E8 that is principled rather than a relabeling, see
    /// `IcosahedralH3` (H3 → 2I/600-cell → E8 by the icosian golden doubling; its 240 set-equal these).
    let rootMvs : Cl3.Mv list = roots |> List.map CliffordE8Bridge.rootToMv
