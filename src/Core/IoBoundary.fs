namespace Zeta.Core

open System.Runtime.CompilerServices

/// Typed inside/outside boundary for the signed-ledger-to-grow-only transition.
///
/// `Inside` may hold a signed Z-set ledger: emits and retracts can cancel before
/// observation. `Outside` holds only the fused G-set view: monotone presence,
/// with multiplicity, negative evidence, and the path that produced the result
/// kept behind the boundary.
[<RequireQualifiedAccess>]
module IoBoundary =

    [<Struct; IsReadOnly>]
    type Inside<'K when 'K : comparison> =
        val internal Ledger: ZSet<'K>
        internal new(ledger: ZSet<'K>) = { Ledger = ledger }

    [<Struct; IsReadOnly>]
    type Outside<'K when 'K : comparison> =
        val internal View: GSet<'K>
        internal new(view: GSet<'K>) = { View = view }

    let emptyInside<'K when 'K : comparison> : Inside<'K> =
        Inside ZSet.empty

    let emptyOutside<'K when 'K : comparison> : Outside<'K> =
        Outside GSet.empty

    /// Enter the boundary with an already-composed signed ledger.
    let input (z: ZSet<'K>) : Inside<'K> =
        Inside z

    /// Enter the boundary with add-only genesis facts.
    let genesis (keys: 'K seq) : Inside<'K> =
        keys |> ZSet.ofKeys |> Inside

    /// One positive internal event.
    let emit (key: 'K) : Inside<'K> =
        ZSet.singleton key 1L |> Inside

    /// One negative internal event.
    let retract (key: 'K) : Inside<'K> =
        ZSet.singleton key -1L |> Inside

    /// Compose signed interiors before any exterior observation occurs.
    let compose (left: Inside<'K>) (right: Inside<'K>) : Inside<'K> =
        ZSet.add left.Ledger right.Ledger |> Inside

    let composeAll (insides: Inside<'K> seq) : Inside<'K> =
        let mutable acc = ZSet.empty
        for inside in insides do
            acc <- ZSet.add acc inside.Ledger
        Inside acc

    /// Cross the I/O boundary: only positive support becomes exterior identity.
    let fuse (inside: Inside<'K>) : Outside<'K> =
        inside.Ledger |> FusionReconstruction.fuse |> Outside

    /// Leave the boundary with the public grow-only view.
    let output (outside: Outside<'K>) : GSet<'K> =
        outside.View

    let toArray (outside: Outside<'K>) : 'K[] =
        GSet.toArray outside.View

    let toList (outside: Outside<'K>) : 'K list =
        GSet.toList outside.View

    let contains (key: 'K) (outside: Outside<'K>) : bool =
        GSet.contains key outside.View

    let count (outside: Outside<'K>) : int =
        GSet.count outside.View

    let isEmpty (outside: Outside<'K>) : bool =
        GSet.isEmpty outside.View
