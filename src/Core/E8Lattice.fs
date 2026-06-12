namespace Zeta.Core

/// E8 — **Construction A over the in-tree [8,4] extended Hamming code: the adinkra code's
/// unfolding into the E8 root lattice, executable** (ferry 26 link 3 made code; Aaron 2026-06-12:
/// "I'm pretty sure this unfolds into clifford algebra and then that unfolds unto E8").
///
/// Construction A (Conway–Sloane, *Sphere Packings, Lattices and Groups* ch. 5): for a binary
/// code C of length n,  L_A(C) = { x ∈ ℤⁿ : x mod 2 ∈ C }.  For C = the doubly-even self-dual
/// [8,4] extended Hamming code (`AdinkraCode.generator` — the SAME object that encodes adinkra
/// chromotopologies), L_A(C) rescaled by 1/√2 is the **E8 root lattice** — the densest sphere
/// packing in 8 dimensions (Viazovska 2017, Fields Medal).
///
/// What this module makes checkable (all integer arithmetic; no floats, byte-lockable):
///   • membership: x ∈ L_A(C) ⟺ x mod 2 is a codeword.
///   • the EVEN-LATTICE law from doubly-evenness: every member's norm² ≡ 0 (mod 4)
///     (|x|² ≡ wt(x mod 2) mod 4, and the code is doubly-even — Gates' constraint IS the
///     lattice's evenness).
///   • the ROOT SYSTEM: exactly **240** minimal vectors (norm² = 4): 16 of shape (±2, 0⁷) from
///     the zero codeword, plus 14 weight-4 codewords × 2⁴ sign patterns = 224 of shape
///     (±1⁴, 0⁴) — the 240 roots of E8.
[<RequireQualifiedAccess>]
module E8Lattice =

    /// Euclidean norm² of an integer vector.
    let normSq (x: int[]) : int = Array.sumBy (fun v -> v * v) x

    /// The mod-2 reduction of an integer vector (entries to {0,1}).
    let mod2 (x: int[]) : int[] = x |> Array.map (fun v -> ((v % 2) + 2) % 2)

    /// Is the bit-vector a codeword of the [8,4] code? (Membership by exhaustive check against
    /// the 16 codewords — the code is small; this is the spec, not a fast path.)
    let private isCodeword (bits: int[]) : bool =
        AdinkraCode.allCodewords |> List.exists (fun c -> c = bits)

    /// Construction-A membership: x ∈ L_A(C) ⟺ (x mod 2) ∈ C.
    let isMember (x: int[]) : bool =
        x.Length = AdinkraCode.length && isCodeword (mod2 x)

    /// All minimal vectors (norm² = 4) of L_A(C) — the E8 root system, enumerated exactly:
    /// (a) the 16 vectors ±2·eᵢ (mod-2 reduction = the zero codeword);
    /// (b) for each weight-4 codeword, the 2⁴ sign assignments of ±1 on its support.
    let roots : int[] list =
        let n = AdinkraCode.length
        let evenRoots =
            [ for i in 0 .. n - 1 do
                for s in [ 2; -2 ] do
                    yield Array.init n (fun j -> if j = i then s else 0) ]

        let oddRoots =
            [ for c in AdinkraCode.allCodewords do
                if AdinkraCode.weight c = 4 then
                    let support = [ for j in 0 .. n - 1 do if c.[j] = 1 then yield j ]
                    for signs in 0 .. 15 do
                        yield
                            Array.init n (fun j ->
                                match List.tryFindIndex ((=) j) support with
                                | Some k -> if (signs >>> k) &&& 1 = 1 then -1 else 1
                                | None -> 0) ]

        evenRoots @ oddRoots

    /// The kissing number of E8 — |roots| must equal 240 (16 + 14·16).
    let kissingNumber : int = List.length roots
