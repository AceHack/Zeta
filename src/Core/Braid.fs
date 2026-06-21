namespace Zeta.Core

/// Braid — **the braid group made executable, so "topology is hairdressing" can be TESTED** (081KTSZN10008QG0R001BW91GT's
/// falsifiable item: do the Artin relations hold?).
///
/// Representation: **Artin's action on the free group Fₙ** — faithful (Artin 1925), exact, integer-only
/// (byte-lockable; no floats). A strand-crossing σᵢ acts as the automorphism
///
///     σᵢ:  xᵢ ↦ xᵢ xᵢ₊₁ xᵢ⁻¹,   xᵢ₊₁ ↦ xᵢ,   others fixed
///
/// and a braid word (a sequence of crossings, sign = over/under) acts by composition. Because the
/// action is faithful, two braid words are EQUAL iff they act identically on the generators — so the
/// braid relations become executable equalities:
///
///   - **Artin relation:**      σᵢ σᵢ₊₁ σᵢ  =  σᵢ₊₁ σᵢ σᵢ₊₁          (the hairdresser's move)
///   - **far commutativity:**   σᵢ σⱼ = σⱼ σᵢ            for |i−j| ≥ 2 (distant strands don't care)
///   - **NOT the symmetric group:** σᵢ² ≠ identity — crossing twice is not un-crossing: WHO crossed
///     OVER WHOM is remembered. (This is the whole point: a braid is a permutation PLUS history —
///     order-sensitivity is what makes it computation, not shuffling.)
///
/// A free-group element is a reduced word of (generator, ±1) letters; reduction (xx⁻¹ ⇒ ε) is the only
/// rewriting needed, and it is confluent — equality is literal list equality after reduction.
[<RequireQualifiedAccess>]
module Braid =

    /// A letter: generator index (0-based strand) with exponent sign (+1 / −1).
    type Letter = int * int

    /// A reduced free-group word (no adjacent x·x⁻¹ pairs).
    type Word = Letter list

    /// Reduce a word (cancel adjacent inverse pairs until none remain) — confluent, terminating.
    let reduce (w: Word) : Word =
        let push (acc: Word) (l: Letter) =
            match acc, l with
            | (g1, e1) :: rest, (g2, e2) when g1 = g2 && e1 + e2 = 0 -> rest
            | _ -> l :: acc

        w |> List.fold push [] |> List.rev

    /// Concatenate and reduce.
    let mul (a: Word) (b: Word) : Word = reduce (a @ b)

    /// The inverse word.
    let inv (w: Word) : Word =
        w |> List.rev |> List.map (fun (g, e) -> g, -e)

    /// One generator as a word.
    let gen (i: int) : Word = [ i, 1 ]

    /// Apply ONE crossing's automorphism to ONE letter. `c` > 0 means σ_{c−1}; `c` < 0 its inverse
    /// (1-based in the sign-carrying int so 0 is never ambiguous).
    let private applyCrossingToLetter (c: int) (g: int, e: int) : Word =
        let i = abs c - 1 // the crossing acts on strands i, i+1

        let image =
            if c > 0 then
                // σᵢ: xᵢ ↦ xᵢ xᵢ₊₁ xᵢ⁻¹ ; xᵢ₊₁ ↦ xᵢ
                if g = i then [ i, 1; i + 1, 1; i, -1 ]
                elif g = i + 1 then [ i, 1 ]
                else [ g, 1 ]
            else
                // σᵢ⁻¹: xᵢ ↦ xᵢ₊₁ ; xᵢ₊₁ ↦ xᵢ₊₁⁻¹ xᵢ xᵢ₊₁
                if g = i then [ i + 1, 1 ]
                elif g = i + 1 then [ i + 1, -1; i, 1; i + 1, 1 ]
                else [ g, 1 ]

        if e = 1 then image else inv image

    /// Apply one crossing to a word (homomorphic extension), reduced.
    let applyCrossing (c: int) (w: Word) : Word =
        w |> List.collect (applyCrossingToLetter c) |> reduce

    /// Apply a braid word (crossings left-to-right) to a free-group word.
    let act (braid: int list) (w: Word) : Word =
        braid |> List.fold (fun acc c -> applyCrossing c acc) w

    /// Is every crossing in range for n strands? (σᵢ needs 1 ≤ |c| ≤ n−1; c = 0 is no crossing at
    /// all.) P1 guard (Kira, math tear-down 2026-06-12): without this, `equal 3 [5] []` returned
    /// true — σ₅ fixes x₀..x₂, so an out-of-range word masqueraded as the identity. Faithfulness
    /// only holds for valid words; validity is now checked, never assumed.
    let validWord (n: int) (b: int list) : bool =
        b |> List.forall (fun c -> c <> 0 && abs c <= n - 1)

    /// Are two braid words EQUAL as braids? (Faithful action ⇒ equal iff they act identically on
    /// every generator of Fₙ.) Invalid words (out-of-range crossings) are never equal to anything —
    /// refusal, not a false identity.
    let equal (n: int) (b1: int list) (b2: int list) : bool =
        validWord n b1
        && validWord n b2
        && ([ 0 .. n - 1 ] |> List.forall (fun i -> act b1 (gen i) = act b2 (gen i)))

    /// The identity test (valid words only — an invalid word is not the identity, it is refused).
    let isIdentity (n: int) (b: int list) : bool = equal n b []

    /// The writhe-parity character (Soraya's signable mod2 statement, made code): the unique
    /// homomorphism B_n → Z/2 with χ(σᵢ^±1) = 1 — exponent-sum (writhe) mod 2, which equals the
    /// underlying permutation's sign character. A projection (order forgotten, parity kept).
    let writheParity (b: int list) : int = List.length b % 2

    /// The writhe: the exponent sum of the braid word (+1 per positive crossing, −1 per negative).
    /// The unique homomorphism Bₙ → ℤ; `writheParity` is this, mod 2. Ferry-12 density axis, ℤ side.
    let writhe (b: int list) : int =
        b |> List.sumBy (fun c -> if c > 0 then 1 else -1)

    /// Per-pair SIGNED crossing load: (positive, negative) crossing counts per adjacent
    /// strand-pair. REPORT #5 §2's refinement of `pairLoad` — the word-level sign record (NOT a
    /// braid invariant: H₁(Bₙ) = ℤ means only the writhe survives the Artin relations; this is
    /// word data, which is exactly where the dashed-walk span lives).
    let signedPairLoad (n: int) (b: int list) : Map<int, int * int> =
        let counts =
            b
            |> List.groupBy (fun c -> abs c - 1)
            |> List.map (fun (i, cs) ->
                i, (cs |> List.filter (fun c -> c > 0) |> List.length, cs |> List.filter (fun c -> c < 0) |> List.length))
            |> Map.ofList
        [ 0 .. n - 2 ] |> List.map (fun i -> i, defaultArg (counts.TryFind i) (0, 0)) |> Map.ofList

    /// Per-pair crossing load: how many crossings (either sign) act on each adjacent strand-pair
    /// (generator index i = the pair (i, i+1), 0-based). The ferry-12 dense-vs-sparse measure:
    /// dense braiding = high load concentrated on pairs; sparse = load near zero. Sums to word length.
    let pairLoad (n: int) (b: int list) : Map<int, int> =
        let counts =
            b |> List.countBy (fun c -> abs c - 1) |> Map.ofList
        [ 0 .. n - 2 ] |> List.map (fun i -> i, defaultArg (counts.TryFind i) 0) |> Map.ofList

    /// The underlying permutation (position → strand id): forget over/under, keep WHERE strands end.
    /// This is the quotient Bₙ ↠ Sₙ that `writheParity` factors through — the order-forgetting map
    /// whose kernel (the pure braid group) is exactly what the braid remembers beyond shuffling.
    let permutation (n: int) (b: int list) : int list =
        let arr = Array.init n id
        for c in b do
            let i = abs c - 1
            if i + 1 < n then
                let t = arr.[i]
                arr.[i] <- arr.[i + 1]
                arr.[i + 1] <- t
        List.ofArray arr

    /// The sign of a permutation via inversion count — independent of how the permutation was made,
    /// so it can CHECK (not assume) that writheParity equals the sign character (the commuting square
    /// from math REPORT #3 §2: χ = sign ∘ (Bₙ ↠ Sₙ)).
    let permutationSign (p: int list) : int =
        let a = List.toArray p
        let mutable inv = 0
        for i in 0 .. a.Length - 2 do
            for j in i + 1 .. a.Length - 1 do
                if a.[i] > a.[j] then inv <- inv + 1
        inv % 2

    /// DELETE one strand from a braid word (n strands, 0-based strand index by STARTING position):
    /// the surviving (n−1)-braid. Position-tracked: a crossing involving the deleted strand's
    /// current position vanishes from the word (the survivor passes straight) but still swaps the
    /// positions; other crossings reindex past the deleted strand's lane. This is the BRUNNIAN
    /// probe: a link is Brunnian iff deleting ANY component trivializes the rest.
    let deleteStrand (n: int) (strand: int) (braid: int list) : int list =
        let mutable pos = strand // the deleted strand's current position
        let out = ResizeArray<int>()
        for c in braid do
            let i = abs c - 1 // acts on positions i, i+1
            if pos = i then pos <- i + 1 // deleted strand crosses: no surviving crossing, position moves
            elif pos = i + 1 then pos <- i
            else
                // both crossing strands survive; reindex if the deleted lane sits left of them
                let j = if pos < i then i - 1 else i
                out.Add(if c > 0 then j + 1 else -(j + 1))
        List.ofSeq out
