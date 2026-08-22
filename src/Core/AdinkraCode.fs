namespace Zeta.Core

/// **AdinkraCode — a concrete Adinkra generator, identified.**
/// (`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B, Adinkra row — generator identification.)
///
/// Adinkras (Gates, Iga, et al.) correspond to **doubly-even binary linear codes**: the off-shell SUSY
/// adinkra graph is encoded by a binary code every codeword of which has Hamming weight ≡ 0 (mod 4).
/// The canonical **N=8** example is the **[8,4,4] extended Hamming code** — doubly-even and self-dual.
/// This module pins that concrete generator matrix and proves the characterizing property.
///
/// ── **N is the code LENGTH, not the dimension** (label corrected 2026-08-15; see `supercharges`) ──
/// This docstring said "the canonical **N=4** example" until 2026-08-15. That was `k` (the dimension,
/// 4 generator rows) read as `N`. In the Doran–Faux–Gates–Hübsch–Iga–Landweber correspondence, an
/// adinkra with **N colours** (one edge colour per supercharge `Q_I`) is the **N-cube quotiented by a
/// doubly-even code of length N**, so `n = N` and `k` is the quotient's rank. Two different quantities
/// were living under one letter; both are named below (`supercharges`/`length` = N = 8, `dimension` =
/// k = 4), and the derived adinkra numbers are computed from N rather than asserted in prose.
///
/// The mislabel survived because of a genuine coincidence, worth naming so it does not recur: this
/// code's adinkra and the plain 4-cube adinkra of `AdinkraViz.fs` **both have 16 nodes**
/// (`2^(8−4) = 2^4`). Node count therefore does *not* discriminate them — **valence does**: this one
/// is 8-regular (8 colours/node, 64 edges), `AdinkraViz`'s is 4-regular (4 colours/node, 32 edges).
/// `AdinkraViz`'s N=4 is correct for what it draws; only the label on *this* code was wrong.
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

    /// The code dimension k (= 4 message bits / generator rows). **This is `k`, NOT `N`** — the
    /// adinkra's N is `supercharges` below. Keeping the two apart is the point of this block.
    let dimension = 4

    // ── The adinkra side of the correspondence: N, and what N forces ─────────────────────────────
    //
    // Doran, Faux, Gates, Hübsch, Iga, Landweber — *Relating doubly-even error-correcting codes,
    // graphs, and irreducible representations of N-extended supersymmetry* (J. Phys. A 2008;
    // arXiv:0806.0051). An adinkra for N supercharges has one EDGE COLOUR per supercharge, and its
    // topology is the N-cube `GF(2)^N` quotiented by a doubly-even code C ⊆ GF(2)^N. So the code's
    // LENGTH is N; its DIMENSION k is the rank of the quotient.
    //
    // Two invariants force N = 8 here, and neither is a count coincidence:
    //
    //  1. EXISTENCE. A doubly-even self-dual binary code exists ONLY at length ≡ 0 (mod 8)
    //     (Gleason; Mallows–Sloane). Reading N as the dimension would demand a doubly-even
    //     self-dual code of length 4, and there is none — `AdinkraIdentity.Tests` already searches
    //     lengths 2/4/6 exhaustively and finds nothing, then finds this code at 8. The N=4 reading
    //     contradicts the very existence theorem this module stands on.
    //  2. VALENCE. The quotient `GF(2)^8 / C` is `N`-regular exactly when the weight-1 vectors lie
    //     in distinct cosets, i.e. when `d ≥ 3`; here `d = 4`. So every node has 8 distinct
    //     neighbours — one per colour — which IS N, structurally. Node count cannot discriminate
    //     (the 4-cube also has 16 nodes); valence can.
    //
    // Supporting anchor, same degree: |Aut(C)| under coordinate permutations is AGL(3,2), order
    // 1344 — a permutation group of **degree 8**, acting on the 8 coordinates. The symmetry group
    // of this code permutes eight things, and those eight things are the supercharges.

    /// **N — the number of supercharges / edge colours of the adinkra this code encodes.**
    /// `N = length = 8`. Deliberately a separate name from `dimension` (k = 4): the two were
    /// conflated under the single letter "N" until 2026-08-15, and naming both is the fix.
    let supercharges = length

    /// Nodes of the adinkra: `2^(N − k) = 2^4 = 16` — the cosets of C in `GF(2)^N`.
    /// (Note this equals the 4-cube's node count; see the valence discriminator above.)
    let adinkraNodes = 1 <<< (length - dimension)

    /// Valence — edges per node, one per colour. Equals `N` (8), *not* k. Well-defined because
    /// `d = 4 ≥ 3` puts the eight weight-1 vectors in eight distinct cosets.
    let adinkraValence = supercharges

    /// Distinct anticommuting generator pairs `{Q_I, Q_J}`, `I < J`: `C(N,2) = C(8,2) = 28`.
    /// Under the retired "N=4" label this read as `C(4,2) = 6`. Nothing in-repo consumed either
    /// number, which is precisely why the mislabel survived — so it is computed and pinned here.
    let anticommutingPairs = supercharges * (supercharges - 1) / 2

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

    // ── Weight enumerator and MacWilliams fixed-point (gen(gen)=gen Face 1 discharge) ─────────────
    //
    // The **weight enumerator** of a binary code C is W_C(x,y) = Σ_{c∈C} x^{n-wt(c)} y^{wt(c)}.
    // For the [8,4] doubly-even self-dual code: W(x,y) = x^8 + 14·x^4·y^4 + y^8.
    //
    // The **MacWilliams transform** maps W_C to W_{C⊥}:
    //   W_{C⊥}[j] = (1/|C|) · Σ_i W_C[i] · K_j(i, n)
    // where K_j(i,n) is the Krawtchouk polynomial.
    //
    // For a **self-dual** code (C = C⊥), the weight enumerator is a fixed point of the transform:
    //   W_C = MacWilliams(W_C)
    // This is the algebraic statement of `gen(gen) = gen` at the weight-enumerator level.
    //
    // **Connection to SoftValue/NCI accumulation (§B open conjecture):**
    // The NCI-weighted product of Gaussian beliefs is a log-linear pool. In the Hadamard dual space,
    // this is a pointwise product of characteristic functions. The MacWilliams transform is the
    // Hadamard/Walsh transform on the weight distribution — the same operation. The self-dual
    // fixed point (W_C = MacWilliams(W_C)) is the reason the NCI accumulation converges without
    // bias: the code's self-duality guarantees the Hadamard transform of the weight distribution
    // is the weight distribution itself. Formal proof of this connection remains §B.

    /// The weight enumerator of the code as a list of (weight, count) pairs.
    /// For the [8,4] doubly-even self-dual code: [(0,1); (4,14); (8,1)].
    let weightEnumerator : (int * int) list =
        allCodewords
        |> List.groupBy weight
        |> List.map (fun (w, cws) -> w, List.length cws)
        |> List.sortBy fst

    /// Krawtchouk polynomial K_j(i, n) = Σ_{s=0}^{j} (-1)^s · C(i,s) · C(n-i, j-s).
    /// The kernel of the MacWilliams transform for binary codes of length n.
    let private krawtchouk (n: int) (j: int) (i: int) : float =
        let binom a b =
            if b < 0 || b > a then 0.0
            else
                let mutable r = 1.0
                for t in 1 .. b do
                    r <- r * float (a - b + t) / float t
                r
        let mutable acc = 0.0
        for s in 0 .. j do
            acc <- acc + (if s % 2 = 0 then 1.0 else -1.0) * binom i s * binom (n - i) (j - s)
        acc

    /// Apply the MacWilliams transform to a weight enumerator.
    /// Returns a list of (weight, transformed-coefficient) pairs (non-zero only).
    let macWilliamsTransform (wEnum: (int * int) list) : (int * float) list =
        let n = length
        let codeSize = float (List.length allCodewords)
        // Build coefficient array indexed by weight.
        let p = Array.zeroCreate<float> (n + 1)
        for (w, cnt) in wEnum do
            if w >= 0 && w <= n then p.[w] <- float cnt
        [ for j in 0 .. n ->
            let coeff = (1.0 / codeSize) * (Array.sumBy (fun i -> p.[i] * krawtchouk n j i) [| 0 .. n |])
            j, coeff ]
        |> List.filter (fun (_, c) -> abs c > 1e-9)

    /// **MacWilliams fixed-point property** — the algebraic statement of `gen(gen) = gen` at the
    /// weight-enumerator level. For a self-dual code, the MacWilliams transform of the weight
    /// enumerator equals the original weight enumerator (the code is its own dual's enumerator).
    /// Proven here exhaustively over all 16 codewords.
    let isMacWilliamsFixedPoint : bool =
        let original = weightEnumerator |> List.map (fun (w, c) -> w, float c) |> Map.ofList
        let transformed = macWilliamsTransform weightEnumerator |> Map.ofList
        [ 0 .. length ]
        |> List.forall (fun w ->
            let orig = original |> Map.tryFind w |> Option.defaultValue 0.0
            let trans = transformed |> Map.tryFind w |> Option.defaultValue 0.0
            abs (orig - trans) < 1e-6)
