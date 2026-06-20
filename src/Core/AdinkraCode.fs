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

    /// GF(2) inner product of two equal-length words: (Σ aᵢ·bᵢ) mod 2. The bilinear form whose
    /// fixed point (C = C⊥) is self-duality.
    let dot (a: int[]) (b: int[]) : int =
        let mutable acc = 0
        for i in 0 .. (min a.Length b.Length) - 1 do
            acc <- acc ^^^ (a.[i] &&& b.[i])
        acc

    /// **Self-orthogonal**: every pair of generator rows is orthogonal under `dot` (and each row is
    /// orthogonal to itself, i.e. has even weight). By bilinearity this extends to all codewords, so
    /// `C ⊆ C⊥`. (Doubly-even ⇒ even weight ⇒ self-orthogonal on the diagonal; checked here directly.)
    let isSelfOrthogonal : bool =
        generator
        |> Array.forall (fun gi -> generator |> Array.forall (fun gj -> dot gi gj = 0))

    /// **Self-dual** — the `gen(gen) === gen` fixed point at the code level. The dual map `C ↦ C⊥` is an
    /// involution (`dual(dual C) = C` always); a *self-dual* code is its **fixed point** (`dual C = C`).
    /// A linear code is self-dual iff it is self-orthogonal (`C ⊆ C⊥`) **and** `dim C = n/2` (forcing
    /// `C⊥ ⊆ C`, hence equality). The [8,4] extended Hamming code satisfies both — it is the e8 code, the
    /// unique doubly-even self-dual binary code of length 8 — so the generator already sits on the
    /// duality fixed point (Face 1 of `gen(gen)=gen`; Faces 2/3 — the codespace projector Π²=Π and the
    /// Futamura `mix(mix,mix)=cogen` reflective fixpoint — remain in `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B).
    let isSelfDual : bool =
        isSelfOrthogonal && (2 * dimension = length)

    /// **Codespace projector** Π onto the code C — Face 2 of `gen(gen)===gen` as an honest endomorphism
    /// (`Π∘Π = Π`). Because the generator is systematic (`[I₄ | A]`), the projector onto C along the
    /// parity complement `D = {(0,p)}` is simply **re-encode the message coordinates**:
    /// `Π(v) = encode(v[0 .. k-1])`. It is linear, **idempotent (Π² = Π)**, fixes every codeword, and has
    /// image = C — the decode→re-encode "snap to the nearest codeword on the systematic split" operation,
    /// so re-running the generator on an already-generated word changes nothing.
    ///
    /// Honest scope (peel): this is the projector along the *parity* complement, **not** the orthogonal
    /// projector. Over GF(2) the code is self-orthogonal (`G·Gᵀ = 0`, singular), so the orthogonal
    /// projector `Gᵀ(GGᵀ)⁻¹G` is undefined; Π depends on the chosen complement (here, the systematic
    /// split). Idempotence and image = C hold for any complement. (Face 3 — the Futamura
    /// `mix(mix,mix)=cogen` reflective fixpoint — remains open in §B.)
    let project (v: int[]) : int[] =
        encode (Array.sub v 0 dimension)

    /// **Syndrome** `s(v) = G·v` over GF(2) (`k` bits). Because the code is **self-dual**, the generator is
    /// also a parity-check matrix (`H = G`), so `v` is a codeword **iff** `s(v) = 0`. The same generator that
    /// *generates* the code also *checks* it.
    let syndrome (v: int[]) : int[] =
        generator |> Array.map (fun gi -> dot gi v)

    /// `true` iff `v` is a codeword (zero syndrome).
    let isCodeword (v: int[]) : bool =
        syndrome v |> Array.forall (fun b -> b = 0)

    /// **Correct** a single-bit error (`d = 4 ⇒ t = 1`): `Some` the unique codeword reachable by flipping
    /// ≤ 1 bit, or `None` if uncorrectable (≥ 2 errors detected). The same generator that *generates* the
    /// code now *repairs* it — **generation = error-correction, dual** (`only-the-irreducible-is-primitive`:
    /// "the generator IS the ECC; regenerating from the irreducible IS the correction"). This is the
    /// code-level **backstop** for Kestrel's homoiconicity proof / the Futamura `gen(gen)=gen` self-hosting
    /// fixpoint (Face 3, open in §B): a self-dual generator that both emits and corrects its own image.
    let correct (v: int[]) : int[] option =
        if isCodeword v then
            Some v
        else
            let flips =
                [ for p in 0 .. length - 1 do
                      let y = Array.copy v
                      y.[p] <- y.[p] ^^^ 1
                      if isCodeword y then yield y ]
            match flips with
            | [ y ] -> Some y
            | _ -> None
