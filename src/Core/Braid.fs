namespace Zeta.Core

/// Braid — **the braid group made executable, so "topology is hairdressing" can be TESTED** (B-1027's
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
