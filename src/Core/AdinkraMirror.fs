namespace Zeta.Core

open System.Numerics

/// **`AdinkraMirror` — layer one of the adinkra unfold: the [8,4,4] doubly-even self-dual code (Aaron 2026-06-19, shadow\*).**
///
/// The irreducible root of the cohomoiconic unfold (adinkra → Clifford → Cayley–Dickson → memetics), built
/// "one onion/egg layer at a time." This is **layer one: the adinkra MIRROR** — the **[8,4,4] extended-Hamming
/// code**, the smallest **doubly-even self-dual** binary code (the one Gates' adinkras carry as their ECC):
///
/// - **SELF-DUAL (the mirror):** `C = C⊥` — the code is *its own dual*. It reflects itself; that is what makes
///   it "the mirror" and why it's the root (nothing more primitive to reduce to — it is its own check).
/// - **DOUBLY-EVEN:** every codeword's Hamming weight ≡ 0 (mod 4).
/// - **THE GENERATOR *IS* THE ECC:** the same generator matrix both **generates** the 16 codewords *and*
///   **corrects** errors (syndrome = `G·x`, since `H = G` for a self-dual code). Generation and
///   error-correction are **dual** — exactly `only-the-irreducible-is-primitive` ("the generator IS the ECC;
///   regenerating from the irreducible IS the correction").
///
/// Anchors: S. James Gates Jr. (adinkras / doubly-even self-dual codes); the extended Hamming [8,4,4] /
/// `e8` lineage; the in-tree adinkra→Clifford→E8 research (ferry-26) + unfolding-as-the-common-seed (ferry-37).
[<RequireQualifiedAccess>]
module AdinkraMirror =

    /// Block length (bits) of the code.
    let n = 8

    /// The four generators of the [8,4,4] extended-Hamming doubly-even self-dual code (systematic `[I₄ | A]`).
    /// Each is weight-4 (doubly-even) and the rows are mutually orthogonal mod 2 (⇒ self-dual).
    let generators : int[] =
        [| 0b10000111; 0b01001011; 0b00101101; 0b00011110 |]

    /// Hamming weight (popcount).
    let weight (x: int) : int = BitOperations.PopCount(uint x)

    /// All 16 codewords — the **generation**: XOR-unfold every subset of the generators.
    let codewords : int[] =
        [| for m in 0..15 ->
               let mutable c = 0
               for i in 0..3 do
                   if (m >>> i) &&& 1 = 1 then c <- c ^^^ generators.[i]
               c |]

    /// Inner product mod 2.
    let private dot (a: int) (b: int) : int = weight (a &&& b) % 2

    /// **Syndrome** `= G·x` (mod 2), packed into 4 bits. `H = G` because the code is self-dual, so a word is a
    /// codeword **iff** its syndrome is `0`. (This is the generator acting AS the error-detector.)
    let syndrome (x: int) : int =
        let mutable s = 0
        for i in 0..3 do
            if dot generators.[i] x = 1 then s <- s ||| (1 <<< i)
        s

    /// `true` iff `x` is a codeword (syndrome `0`).
    let isCodeword (x: int) : bool = syndrome x = 0

    /// **Correct** a single-bit error (the code is `d=4`, so `t=1`): `Some` the unique codeword reachable by
    /// flipping ≤ 1 bit; `None` if uncorrectable (≥ 2 errors detected). Same generator that *made* the code
    /// now *repairs* it — generation = correction.
    let correct (x: int) : int option =
        if isCodeword x then
            Some x
        else
            let fixes = [ for p in 0 .. n - 1 do
                              let y = x ^^^ (1 <<< p)
                              if isCodeword y then yield y ]
            match fixes with
            | [ y ] -> Some y
            | _ -> None

    /// Minimum distance = the smallest nonzero codeword weight (the ECC distance; here 4).
    let minDistance : int =
        codewords |> Array.filter (fun c -> c <> 0) |> Array.map weight |> Array.min

    /// **Doubly-even:** every codeword's weight ≡ 0 (mod 4).
    let isDoublyEven : bool = codewords |> Array.forall (fun c -> weight c % 4 = 0)

    /// **Self-orthogonal:** every pair (including each with itself) is orthogonal mod 2.
    let isSelfOrthogonal : bool =
        codewords |> Array.forall (fun a -> codewords |> Array.forall (fun b -> dot a b = 0))

    /// **Self-dual (the mirror):** self-orthogonal **and** `|C| = 2^(n/2)` — i.e. `C = C⊥`.
    let isSelfDual : bool = isSelfOrthogonal && codewords.Length = (1 <<< (n / 2))
