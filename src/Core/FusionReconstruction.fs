namespace Zeta.Core

open System.Collections.Immutable

/// Algebraic fusion at the boundary: reconstruct the monotone exterior fact
/// from a signed interior ledger.
///
/// This is intentionally separate from `Fusion.fs`, which optimizes query
/// operators. Here "fusion" means: compose signed Z-set evidence first, then
/// expose only the resulting G-set identity. Multiplicity, negative evidence,
/// and the component ledgers remain inside the Z-set; the outside receives a
/// grow-only set of currently-positive support.
[<RequireQualifiedAccess>]
module FusionReconstruction =

    /// Reconstruct the exterior G-set from a composed Z-set by taking positive
    /// support. Weights greater than one and the signed path that produced them
    /// do not leak through the boundary; weights less than or equal to zero are
    /// absent from the exterior.
    let fuse (z: ZSet<'K>) : GSet<'K> =
        let span = z.AsSpan()
        if span.IsEmpty then
            GSet.empty
        else
            let items = ImmutableArray.CreateBuilder<'K>(span.Length)
            for i in 0 .. span.Length - 1 do
                if span.[i].Weight > 0L then
                    items.Add(span.[i].Key)

            if items.Count = 0 then
                GSet.empty
            else
                GSet<'K>(items.ToImmutable())

    /// Alias that names the DBSP/CRDT reading directly: after signed
    /// composition, only positive support becomes visible as monotone presence.
    let positiveSupport (z: ZSet<'K>) : GSet<'K> =
        fuse z
