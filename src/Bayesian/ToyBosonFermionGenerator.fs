namespace Zeta.Bayesian

/// **A toy generator for boson/fermion-labelled structures, with a metered entropy channel.**
///
/// TOY MODEL. Nothing here is metered against physics; the word "boson"/"fermion" names a
/// **Z₂ grading**, which is what Clifford algebras and adinkras actually carry. No claim is
/// made that these 16 objects are particles. Register: `toy` per
/// `.claude/rules/toy-is-free-metered-must-be-earned.md`, and the `toy` prefix stays until
/// something here beats a closed form at something the closed form cannot do at all.
///
/// ## What is generated, never stored
///
/// A **generator + a seed**, not a dataset. `generate` emits `(structure, label)` pairs on
/// demand; the only checked-in data are hex-in-JSON golden vectors that byte-lock a handful of
/// seeds (`no-binary-in-proof-lineage`). Same seed ⇒ byte-identical output on every replay
/// (discipline #4, DST); a different seed ⇒ different output, which is the half a
/// seed-ignoring generator would pass trivially.
///
/// ## Path 1 (primary) — Cl(4)'s 16 blades, 8 even + 8 odd
///
/// `Cl(4,0)` has 2⁴ = 16 basis blades indexed by a 4-bit mask (bit *i* = e_(i+1)), exactly as
/// `Zeta.Core.Cl3` indexes its 8 blades by a 3-bit mask. Grade = `popcount(mask)`, so the Z₂
/// grading is `popcount(mask) &&& 1`: **8 even blades (grade 0,2,4) and 8 odd (grade 1,3)**.
///
/// The count 16 identifies nothing on its own (`numerology-vs-number-theory`): an N=8 adinkra
/// has 16 nodes, `SO(10)`'s spinor representation is 16-dimensional, and one Standard Model
/// generation of Weyl fermions counts 16. **The invariant that separates this object from a
/// bare 8/8 split of 16 things is that the even part is CLOSED UNDER THE PRODUCT** — blades
/// multiply by mask XOR, and `popcount(a ^^^ b) ≡ popcount a + popcount b (mod 2)`, so the
/// even blades form an 8-dimensional subalgebra (`Cl⁺(4) ≅ Cl(3)`). A random 8/8 split does
/// not. That is checked in `evenPartIsClosed`, not asserted.
///
/// ## Path 2 (independent) — the N=8 adinkra's 16 nodes
///
/// Aaron 2026-08-26: *"there is often many paths to the same destination, so the 2nd might be
/// valuable too."* The second path is the chromotopology of `Zeta.Core.AdinkraCode`'s [8,4,4]
/// extended Hamming code: the 16 cosets of C in GF(2)⁸, bipartitioned by coset weight parity.
/// Well-defined because C is doubly-even, hence every codeword has even weight.
///
/// The two paths **agree**, and the agreement is a derivation rather than a count match:
///
///   * `1 = 11111111 ∈ C` (the weight-8 codeword), and `C = C⊥`, so `⟨1, c⟩ = 0` for every
///     codeword — weight parity is therefore constant on cosets and is a linear functional of
///     the syndrome;
///   * the four rows of `H = [Aᵀ | I₄]` sum to `1` (each row is weight 4; the first block sums
///     coordinatewise to 3 ≡ 1, the second to 1), so that functional is `popcount(syndrome)`;
///   * hence **coset parity = `popcount(syndrome) &&& 1` = the Cl(4) grade parity of the blade
///     with that mask.** Checked exhaustively in `pathsAgree`.
///
/// ## The channel: chaos fluctuations through a declared, metered boundary
///
/// Aaron 2026-08-26: *"RNG is theory, metered channels is physics."* Entropy enters ONLY
/// through `Source` (discipline #13, noninterference), and the amount is **measured** at the
/// membrane and carried in the datum, so a degradation curve can be plotted against *bits
/// actually injected* rather than against a unitless ordinal.
///
/// The channel applies `k` independent uniform bit-flip **operations** to the transmitted
/// 8-bit codeword. Each operation costs exactly `log₂ 8 = 3` bits (8 is a power of two, so the
/// accounting is exact — no rejection-sampling waste to explain away). Realized damage is
/// `popcount` of the accumulated error, which is `≤ k`: **two operations landing on the same
/// bit cancel.** Metered bits and realized damage therefore diverge, and that divergence is a
/// finding rather than an accounting nuisance — a study indexed by `k` silently mixes
/// uncorrupted samples into its corrupted bucket (at `k = 2`, one sample in eight).
///
/// Anchors: Clifford 1878 (geometric algebra); Lounesto, *Clifford Algebras and Spinors*
/// (2001) §3 for the Z₂ grading and the even subalgebra; Doran, Faux, Gates, Hübsch, Iga,
/// Landweber, *Relating doubly-even error-correcting codes, graphs, and irreducible
/// representations of N-extended supersymmetry* (J. Phys. A 2008, arXiv:0806.0051) for the
/// hypercube-quotient-by-a-doubly-even-code chromotopology; Gleason / Mallows–Sloane for the
/// length ≡ 0 (mod 8) existence theorem the repo's `AdinkraCode` already stands on;
/// Steele 1997 / Vigna's SplitMix64 for the seed expander.
[<RequireQualifiedAccess>]
module ToyBosonFermionGenerator =

    // ── The metered entropy channel (discipline #13) ─────────────────────────────────────────

    /// An immutable, declared entropy source. Every crossing is metered: `BitsDrawn` is the
    /// running total of bits taken at the membrane and `Draws` the number of crossings.
    /// Threading the state (rather than mutating) keeps replay deterministic and the source
    /// weight-free — there is no ambient RNG anywhere in this module.
    type Source =
        { /// SplitMix64 internal state.
          State: uint64
          /// Total bits drawn through this source since `sourceOfSeed`.
          BitsDrawn: int
          /// Number of separate crossings of the membrane.
          Draws: int }

    /// Open a metered source at `seed`. Same seed ⇒ same stream, forever.
    let sourceOfSeed (seed: uint64) : Source =
        { State = seed; BitsDrawn = 0; Draws = 0 }

    let private splitMix (s: uint64) : uint64 * uint64 =
        let next = s + 0x9E3779B97F4A7C15UL
        let mutable z = next
        z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9UL
        z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBUL
        (z ^^^ (z >>> 31)), next

    /// Draw `bits` bits (1..32) through the membrane, metering the cost. Returns the value in
    /// `[0, 2^bits)` and the advanced source. The cost is exact — no rejection sampling — so
    /// `BitsDrawn` is a measurement rather than an estimate.
    let draw (bits: int) (source: Source) : int * Source =
        if bits < 1 || bits > 32 then
            invalidArg "bits" "draw takes 1..32 bits"

        let value, next = splitMix source.State
        let mask = (1UL <<< bits) - 1UL

        int (value &&& mask),
        { State = next
          BitsDrawn = source.BitsDrawn + bits
          Draws = source.Draws + 1 }

    // ── Path 1 (primary): Cl(4) ─────────────────────────────────────────────────────────────

    /// Number of basis blades of Cl(4,0): 2⁴.
    let bladeCount = 16

    /// Population count of a non-negative int.
    let popcount (x: int) : int =
        let mutable n = x
        let mutable c = 0

        while n <> 0 do
            c <- c + (n &&& 1)
            n <- n >>> 1

        c

    /// Grade of the basis blade with this 4-bit mask (`popcount`). Grade 0 = scalar,
    /// 1 = vector, 2 = bivector, 3 = trivector, 4 = pseudoscalar.
    let grade (mask: int) : int = popcount mask

    /// **The label.** `true` = even grade = "bosonic"; `false` = odd = "fermionic". This is the
    /// Z₂ grading and nothing more — it is `popcount &&& 1`, a total one-line function of the
    /// input, which is exactly why a classifier reproducing it on clean data demonstrates
    /// nothing (see `ToyBosonFermionBnn.closedFormBaseline`).
    let isBosonic (mask: int) : bool = grade mask % 2 = 0

    /// The 8 even (bosonic) blade masks.
    let evenBlades : int list = [ 0 .. bladeCount - 1 ] |> List.filter isBosonic

    /// The 8 odd (fermionic) blade masks.
    let oddBlades : int list = [ 0 .. bladeCount - 1 ] |> List.filter (isBosonic >> not)

    /// Reordering sign for the geometric product of two basis blades, generalised from
    /// `Zeta.Core.Cl3.reorderSign` to 4 generators (all squares +1). Counts anticommuting
    /// swaps. Present so the grading below is a statement about an ALGEBRA rather than about
    /// sixteen labelled integers.
    let reorderSign (a: int) (b: int) : int =
        let mutable swaps = 0

        for i in 0 .. 3 do
            if (b &&& (1 <<< i)) <> 0 then
                for j in i + 1 .. 3 do
                    if (a &&& (1 <<< j)) <> 0 then swaps <- swaps + 1

        if swaps % 2 = 0 then 1 else -1

    /// **The invariant that discriminates this object from any other 8/8 split of 16 things.**
    /// Basis blades multiply by mask XOR, and grade parity is additive under XOR, so the even
    /// blades are closed under the product (an 8-dimensional subalgebra, `Cl⁺(4) ≅ Cl(3)`)
    /// while the odd blades are not closed (odd·odd is even). Returns
    /// `(evenClosed, oddClosed, evenDimension)`; a valid Cl(4) grading gives
    /// `(true, false, 8)`.
    let evenPartIsClosed () : bool * bool * int =
        let closedUnder (part: int list) =
            part
            |> List.forall (fun a -> part |> List.forall (fun b -> List.contains (a ^^^ b) part))

        closedUnder evenBlades, closedUnder oddBlades, List.length evenBlades

    // ── Path 2 (independent): the N=8 adinkra of the [8,4,4] extended Hamming code ──────────

    /// Generator matrix `G = [I₄ | A]` of the [8,4,4] extended Hamming code, as 8-bit masks
    /// (bit *j* = coordinate *j*). Replicated from `Zeta.Core.AdinkraCode.generator` and
    /// `src/Core.TypeScript/research/adinkra-ecc/adinkra-ecc-prototype.ts`, which agree.
    let generatorRows : int list =
        [ [ 1; 0; 0; 0; 0; 1; 1; 1 ]
          [ 0; 1; 0; 0; 1; 0; 1; 1 ]
          [ 0; 0; 1; 0; 1; 1; 0; 1 ]
          [ 0; 0; 0; 1; 1; 1; 1; 0 ] ]
        |> List.map (List.mapi (fun j bit -> bit <<< j) >> List.fold (|||) 0)

    /// Encode a 4-bit message (the Cl(4) blade mask) as an 8-bit codeword: the XOR of the
    /// generator rows selected by the message bits. Systematic, so the low 4 bits of the
    /// codeword are the message.
    let encode (message: int) : int =
        generatorRows
        |> List.mapi (fun i row -> if (message >>> i) &&& 1 = 1 then row else 0)
        |> List.fold (^^^) 0

    /// All 16 codewords.
    let codewords : int list = [ 0 .. 15 ] |> List.map encode

    /// Parity-check rows `H = [Aᵀ | I₄]`, derived from `generatorRows` rather than transcribed:
    /// `H_i` has the *i*-th A-column in its low block and `e_i` in its high block.
    let parityCheckRows : int list =
        [ for i in 0 .. 3 ->
            let mutable row = 0

            for r in 0 .. 3 do
                // bit (4+i) of generator row r is A[r][i]; it becomes bit r of H_i.
                if (generatorRows.[r] >>> (4 + i)) &&& 1 = 1 then row <- row ||| (1 <<< r)

            row ||| (1 <<< (4 + i)) ]

    /// Syndrome of an 8-bit word: the 4-bit vector of parity checks. Constant exactly on the
    /// cosets of C, so it **is** the adinkra node index.
    let syndrome (word: int) : int =
        parityCheckRows
        |> List.mapi (fun i row -> (popcount (word &&& row) &&& 1) <<< i)
        |> List.fold (|||) 0

    /// Weight parity of an 8-bit word (`popcount &&& 1`). Constant on cosets because C is
    /// doubly-even, which is what makes the adinkra bipartition well-defined.
    let wordParityIsEven (word: int) : bool = popcount word % 2 = 0

    /// **The join between the two paths.** For every one of the 256 words of GF(2)⁸, does the
    /// adinkra node's parity (`popcount(word) &&& 1`) equal the Cl(4) grade parity of the blade
    /// whose mask is the node's syndrome? Returns `(agreements, total)`. A derivation is given
    /// in the module doc; this is the exhaustive check of it.
    ///
    /// Under `anti-babel-preserve-reconcilability` a disagreement would be recorded with both
    /// paths intact rather than reconciled by picking a winner.
    let pathsAgree () : int * int =
        let agreements =
            [ 0 .. 255 ]
            |> List.filter (fun w -> wordParityIsEven w = isBosonic (syndrome w))
            |> List.length

        agreements, 256

    /// The all-ones word `11111111`, and whether it is a codeword. Load-bearing for the
    /// derivation: `1 ∈ C = C⊥` is what makes weight parity constant on cosets.
    let allOnesIsCodeword () : bool = List.contains 255 codewords

    /// Weight enumerator of the code as `(weight, count)` pairs, sorted by weight. For the
    /// [8,4,4] extended Hamming code this is `[(0,1); (4,14); (8,1)]` — computed, not cited.
    let weightEnumerator () : (int * int) list =
        codewords
        |> List.countBy popcount
        |> List.sortBy fst

    /// Minimum distance of the code: the minimum non-zero codeword weight (the code is linear).
    let minimumDistance () : int =
        codewords |> List.filter (fun c -> c <> 0) |> List.map popcount |> List.min

    // ── The channel and the generated datum ─────────────────────────────────────────────────

    /// One generated sample. Nothing is stored: this is what `generate` yields.
    type Sample =
        { /// The true Cl(4) blade mask (0..15) — also the adinkra node index / 4-bit message.
          TrueBlade: int
          /// The 8-bit codeword actually transmitted, `encode TrueBlade`.
          Transmitted: int
          /// What the receiver saw after the channel.
          Observed: int
          /// `true` = even grade = bosonic. The label, from the TRUE blade.
          Bosonic: bool
          /// Entropy measured at the membrane for this sample, in bits.
          MeteredBits: int
          /// Number of flip operations requested.
          FlipOperations: int
          /// Hamming weight of the realized error — `≤ FlipOperations`, because two operations
          /// on the same bit cancel. The gap between this and `FlipOperations` is the finding
          /// the metering buys.
          RealizedDamage: int }

    /// Bits metered per flip operation: `log₂ 8`, exact.
    let bitsPerFlip = 3

    /// Apply `flips` uniform bit-flip operations to an 8-bit word, drawing every one of them
    /// through the metered source. Returns the corrupted word, the realized error pattern, and
    /// the advanced source.
    let corrupt (flips: int) (word: int) (source: Source) : int * int * Source =
        let mutable error = 0
        let mutable src = source

        for _ in 1 .. flips do
            let position, next = draw bitsPerFlip src
            src <- next
            error <- error ^^^ (1 <<< position)

        word ^^^ error, error, src

    /// Generate one sample: draw a blade uniformly (4 metered bits), encode it, push it through
    /// the channel. Deterministic in the source.
    let generateOne (flips: int) (source: Source) : Sample * Source =
        let before = source.BitsDrawn
        let blade, afterBlade = draw 4 source
        let transmitted = encode blade
        let observed, error, afterChannel = corrupt flips transmitted afterBlade

        { TrueBlade = blade
          Transmitted = transmitted
          Observed = observed
          Bosonic = isBosonic blade
          MeteredBits = afterChannel.BitsDrawn - before
          FlipOperations = flips
          RealizedDamage = popcount error },
        afterChannel

    /// Generate `count` samples at a fixed number of flip operations. **The generator is the
    /// artifact; the samples are not stored.** `seed` fully determines the output.
    let generate (seed: uint64) (flips: int) (count: int) : Sample list =
        let mutable src = sourceOfSeed seed

        [ for _ in 1 .. count ->
            let sample, next = generateOne flips src
            src <- next
            sample ]

    /// The complete, uncorrupted 16-node structure — both paths at once. This is the "8+8"
    /// itself: 8 bosonic and 8 fermionic, with no channel and no entropy.
    let cleanStructure () : Sample list =
        [ for blade in 0 .. bladeCount - 1 ->
            { TrueBlade = blade
              Transmitted = encode blade
              Observed = encode blade
              Bosonic = isBosonic blade
              MeteredBits = 0
              FlipOperations = 0
              RealizedDamage = 0 } ]

    /// Lowercase hex of a sample's `(TrueBlade, Observed, label)` triple, for the hex-in-JSON
    /// golden vectors. Text, never binary (`no-binary-in-proof-lineage`).
    let toHex (sample: Sample) : string =
        System.String.Format(
            System.Globalization.CultureInfo.InvariantCulture,
            "{0:x1}{1:x2}{2:x1}",
            sample.TrueBlade,
            sample.Observed,
            (if sample.Bosonic then 0 else 1)
        )
