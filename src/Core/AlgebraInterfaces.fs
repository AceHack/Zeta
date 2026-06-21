namespace Zeta.Core

/// The full algebraic interface stack for F# (complements CayleyDickson.fs IStarRing).
/// IStarRing/ISemiring already live in CayleyDickson.fs. These add the rest.

/// Group: identity + combine + inverse. Minimal structure for undo/retract.
[<Interface>]
type IGroup<'T> =
    abstract member Identity: 'T
    abstract member Combine: 'T * 'T -> 'T
    abstract member Inverse: 'T -> 'T

/// Monoid: identity + combine. No inverse. The CRDT merge floor.
[<Interface>]
type IMonoid<'T> =
    abstract member Identity: 'T
    abstract member Combine: 'T * 'T -> 'T

/// Join-semilattice: idempotent, commutative, associative join.
[<Interface>]
type IJoinSemilattice<'T> =
    abstract member Join: 'T * 'T -> 'T

/// Full lattice: join (LUB) + meet (GLB).
[<Interface>]
type ILattice<'T> =
    inherit IJoinSemilattice<'T>
    abstract member Meet: 'T * 'T -> 'T

/// Codec: encode/decode pair. The serialization contract.
[<Interface>]
type ICodec<'TDomain, 'TWire> =
    abstract member Encode: 'TDomain -> 'TWire
    abstract member Decode: 'TWire -> 'TDomain

/// Read-only port (covariant — can widen output).
[<Interface>]
type IReadPort<'T> =
    abstract member Read: unit -> 'T

/// Write-only port (contravariant — can narrow input).
[<Interface>]
type IWritePort<'T> =
    abstract member Write: 'T -> unit

/// Hexagonal port: read + write. Invariant on T.
[<Interface>]
type IPort<'T> =
    inherit IReadPort<'T>
    inherit IWritePort<'T>

// ─── Instances ───────────────────────────────────────────────────────────

/// Additive group over float.
module AdditiveGroupFloat =
    let instance: IGroup<float> =
        { new IGroup<float> with
            member _.Identity = 0.0
            member _.Combine(a, b) = a + b
            member _.Inverse a = -a }

/// Max join-semilattice over float.
module MaxSemilattice =
    let instance: IJoinSemilattice<float> =
        { new IJoinSemilattice<float> with
            member _.Join(a, b) = max a b }
