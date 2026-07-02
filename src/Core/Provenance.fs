namespace Zeta.Core

open System.Collections.Generic

// ═══════════════════════════════════════════════════════════════════
//  Provenance — how-provenance polynomials as a first-class IRing, so
//  lineage rides the atom's weight slot and DBSP retraction retracts it
//  BY CONSTRUCTION (R2 safe-fragment slice, 081KTF5F0A1).
//
//  Green–Karvounarakis–Tannen (PODS 2007) showed lineage is a SEMIRING
//  annotation: `⊕` = alternative derivations, `⊗` = joint derivation.
//  Their `ℕ[X]` how-semiring is absorptive on the ℕ side and CANNOT
//  retract (no additive inverse). The fix that makes incremental DBSP —
//  where a `+1` must be cancellable by a `−1` — work on the SAFE fragment
//  is to take the FREE COMMUTATIVE RING over the tokens, `ℤ[X]`: same
//  polynomials, integer coefficients, so `Negate` exists and
//  `poly ⊕ (−poly) = 0` retracts the exact lineage contribution
//  (081KWG9JQ9H: retraction is an IRing thing — provenance earns IRing).
//
//  NOT a claim to solve probabilistic query eval in general (#P-complete;
//  Dalvi–Suciu). This is the safe-plan piece: for plans expressible as
//  incremental Z-set operators, lineage is a `ZSetW<'K, ProvenancePoly>`
//  weight and the shared MergeKernel propagates + retracts it for free.
// ═══════════════════════════════════════════════════════════════════

/// A monomial: a multiset of provenance tokens (base-tuple ids) →
/// exponent. Canonical (sorted map ⇒ structural equality); the empty
/// monomial is the multiplicative unit (`1`).
type Monomial = { Factors: Map<string, int> }

/// A how-provenance polynomial in ℤ[X]: monomials → integer coefficient
/// (the derivation's multiplicity / Z-set weight). Zero-coefficient
/// monomials are dropped, so equality is structural and canonical.
type ProvenancePoly = { Terms: Map<Monomial, int64> }

[<RequireQualifiedAccess>]
module Provenance =

    let private emptyMonomial : Monomial = { Factors = Map.empty }

    /// The zero polynomial (no derivations) — additive identity.
    let zero : ProvenancePoly = { Terms = Map.empty }

    /// The unit polynomial `1` (the empty monomial, coeff 1) — multiplicative identity.
    let one : ProvenancePoly = { Terms = Map.ofList [ emptyMonomial, 1L ] }

    /// A single base token `x` as a provenance polynomial (`1·x`).
    let token (x: string) : ProvenancePoly =
        { Terms = Map.ofList [ { Factors = Map.ofList [ x, 1 ] }, 1L ] }

    /// Drop zero-coefficient terms (keep the canonical form).
    let private prune (m: Map<Monomial, int64>) : ProvenancePoly =
        { Terms = m |> Map.filter (fun _ c -> c <> 0L) }

    /// Polynomial addition (⊕): alternative derivations; coefficients sum.
    let add (a: ProvenancePoly) (b: ProvenancePoly) : ProvenancePoly =
        let mutable acc = a.Terms
        for kv in b.Terms do
            let c = (match Map.tryFind kv.Key acc with Some c0 -> c0 | None -> 0L) + kv.Value
            acc <- Map.add kv.Key c acc
        prune acc

    /// Additive inverse (Negate): negate every coefficient — the ℤ[X] ring
    /// operation that lets a retraction cancel a derivation exactly.
    let negate (a: ProvenancePoly) : ProvenancePoly =
        { Terms = a.Terms |> Map.map (fun _ c -> -c) }

    let private mulMonomial (x: Monomial) (y: Monomial) : Monomial =
        let mutable f = x.Factors
        for kv in y.Factors do
            let e = (match Map.tryFind kv.Key f with Some e0 -> e0 | None -> 0) + kv.Value
            f <- Map.add kv.Key e f
        { Factors = f }

    /// Polynomial multiplication (⊗): joint derivation — convolve terms.
    let mul (a: ProvenancePoly) (b: ProvenancePoly) : ProvenancePoly =
        let mutable acc = Map.empty
        for ka in a.Terms do
            for kb in b.Terms do
                let m = mulMonomial ka.Key kb.Key
                let c = (match Map.tryFind m acc with Some c0 -> c0 | None -> 0L) + ka.Value * kb.Value
                acc <- Map.add m c acc
        prune acc

    /// The set of base tokens appearing in a polynomial (its lineage support).
    let support (a: ProvenancePoly) : Set<string> =
        a.Terms |> Map.toSeq |> Seq.collect (fun (m, _) -> Map.toSeq m.Factors |> Seq.map fst) |> Set.ofSeq


/// **ProvenanceRing — how-provenance ℤ[X] as a first-class `IRing`.** The
/// weight algebra that carries lineage through the atom. Struct
/// (dual-register like `IntegerRing`); implements `IRing`, so
/// `ZSetW<'K, ProvenancePoly>` retracts lineage via `difference`/`negate`.
[<Struct>]
type ProvenanceRing =
    interface ISemiring<ProvenancePoly> with
        member _.Zero      = Provenance.zero
        member _.One       = Provenance.one
        member _.Add(a, b) = Provenance.add a b
        member _.Mul(a, b) = Provenance.mul a b
    interface IRing<ProvenancePoly> with
        member _.Negate(a) = Provenance.negate a

[<RequireQualifiedAccess>]
module ProvenanceRing =
    /// Boxed singleton at the ring tier.
    let Instance : IRing<ProvenancePoly> = ProvenanceRing()
