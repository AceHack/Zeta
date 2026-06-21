namespace Zeta.Core

/// Additional algebraic instances for F# (the interfaces themselves live in
/// Zeta.Core.Abstractions — ISemiring, IStarRing, IGroup, IMonoid, ISemilattice).
/// This file provides F#-idiomatic object-expression instances.

/// Additive group over float (implements C#'s IGroup<float>).
module AdditiveGroupFloat =
    let instance: IGroup<float> =
        { new IGroup<float> with
            member _.Identity = 0.0
            member _.Combine(a, b) = a + b
            member _.Inverse a = -a }

/// Max semilattice over float (implements C#'s ISemilattice<float>).
module MaxSemilattice =
    let instance: ISemilattice<float> =
        { new ISemilattice<float> with
            member _.Identity = System.Double.NegativeInfinity
            member _.Combine(a, b) = max a b }

/// Float monoid under addition (implements C#'s IMonoid<float>).
module AdditiveMonoidFloat =
    let instance: IMonoid<float> =
        { new IMonoid<float> with
            member _.Identity = 0.0
            member _.Combine(a, b) = a + b }
