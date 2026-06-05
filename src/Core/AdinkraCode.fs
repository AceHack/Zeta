namespace Zeta.Core

/// **AdinkraCode — a concrete Adinkra generator, identified.**
/// (`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B, Adinkra row — generator identification.)
///
/// Adinkras (Gates, Iga, et al.) correspond to **doubly-even binary linear codes**: the off-shell SUSY
/// adinkra graph is encoded by a binary code every codeword of which has Hamming weight ≡ 0 (mod 4).
/// The canonical N=4 example is the **[8,4] extended Hamming code** — doubly-even and self-dual. This
/// module pins that concrete generator matrix and proves the characterizing property.
///
/// This is the *published* Adinkra↔doubly-even-code correspondence — the honest, provable form of
/// "which generator the Adinkra is". The earlier `ErasureDistance.rsCode` was a Reed-Solomon **MDS**
/// code used to prove the erasure-correction *principle*; the genuine **Adinkra** code is this
/// *doubly-even* binary code, a different object (binary, doubly-even, self-dual — not MDS). The erasure
/// principle holds for any linear code; the specific Adinkra generator is identified here.
///
/// Honest scope: this identifies the Adinkra code via the published doubly-even correspondence. The
/// further claim — that the *imaginary-stack multiplication table* (Cayley-Dickson) induces *this exact*
/// generator — needs the construction specifics (Vera's) and remains open in §B.
///
/// Proven (AdinkraCode.Tests, exhaustive over all 16 codewords): the code is **doubly-even** (every
/// codeword's weight ≡ 0 mod 4), **linear**, has **minimum distance 4**, and each generator row is a
/// weight-4 codeword.
[<RequireQualifiedAccess>]
module AdinkraCode =

    /// The generator matrix of the [8,4] extended Hamming code (systematic form `[I₄ | A]`), over GF(2).
    /// Four rows, eight columns; each row is a weight-4 codeword. The concrete Adinkra generator.
    let generator : int[][] =
        [| [| 1; 0; 0; 0; 0; 1; 1; 1 |]
           [| 0; 1; 0; 0; 1; 0; 1; 1 |]
           [| 0; 0; 1; 0; 1; 1; 0; 1 |]
           [| 0; 0; 0; 1; 1; 1; 1; 0 |] |]

    /// The code length n (= 8 columns).
    let length = 8

    /// The code dimension k (= 4 message bits / generator rows).
    let dimension = 4

    /// Encode a 4-bit message into an 8-bit codeword: the GF(2) combination of generator rows selected
    /// by the message bits (XOR of the rows where the message is 1).
    let encode (message: int[]) : int[] =
        Array.init length (fun j ->
            let mutable acc = 0
            for i in 0 .. dimension - 1 do
                acc <- acc ^^^ (message.[i] &&& generator.[i].[j])
            acc)

    /// The Hamming weight of a codeword (number of 1 bits).
    let weight (codeword: int[]) : int =
        Array.sumBy id codeword

    /// All 16 messages over GF(2)⁴ (the bit patterns 0..15).
    let allMessages : int[] list =
        [ for m in 0 .. 15 -> [| for i in 0 .. dimension - 1 -> (m >>> i) &&& 1 |] ]

    /// All 16 codewords of the code (the image of `allMessages` under `encode`).
    let allCodewords : int[] list =
        allMessages |> List.map encode

    /// Bitwise GF(2) XOR of two equal-length words (the linear-combination operation).
    let xor (a: int[]) (b: int[]) : int[] =
        Array.map2 (^^^) a b
