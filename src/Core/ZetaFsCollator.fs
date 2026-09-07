namespace Zeta.Core

open System

/// Mount-view collator (C7 / PR13). The store stays ordinal UTF-8. Linux
/// FUSE default is `Ordinal`. FUSE-T / Finder-shaped default is `Ascii`
/// (A-Z only) and refuses a second live name that collides under the fold.
/// `UnicodeSimple-<ver>` is a later named view, not a default. Detection
/// reports `ConfusableWithExisting` as a fact; the mount oracle refuses
/// create. Never silent-merge.
module ZetaFsCollator =

    type Kind =
        | Ordinal
        | Ascii

    type Collision = ConfusableWithExisting of existing: byte[]

    let linuxDefault = Ordinal
    let fuseTDefault = Ascii

    let fold (kind: Kind) (name: byte[]) : byte[] =
        match kind with
        | Ordinal -> name
        | Ascii ->
            let copy = Array.copy name
            let mutable i = 0

            while i < copy.Length do
                let b = copy.[i]

                if b >= 65uy && b <= 90uy then
                    copy.[i] <- b + 32uy

                i <- i + 1

            copy

    let private sameBytes (a: byte[]) (b: byte[]) : bool =
        a.Length = b.Length
        && MemoryExtensions.SequenceEqual(ReadOnlySpan<byte> a, ReadOnlySpan<byte> b)

    /// Refuse creating `name` when a live sibling collides under this
    /// collator, including exact same bytes. Never picks a winner.
    let refuseCreate (kind: Kind) (liveNames: byte[] seq) (name: byte[]) : Result<unit, Collision> =
        let folded = fold kind name
        let mutable hit: byte[] option = None

        for existing in liveNames do
            if hit.IsNone && sameBytes (fold kind existing) folded then
                hit <- Some existing

        match hit with
        | None -> Ok()
        | Some e -> Error(ConfusableWithExisting e)

    /// Distinct raw names that fold equal. Existing imported collisions
    /// surface as facts; they are not merged.
    let confusablePairs (kind: Kind) (liveNames: byte[][]) : (byte[] * byte[])[] =
        let acc = ResizeArray<byte[] * byte[]>()
        let mutable i = 0

        while i < liveNames.Length do
            let a = liveNames.[i]
            let fa = fold kind a
            let mutable j = i + 1

            while j < liveNames.Length do
                let b = liveNames.[j]

                if not (sameBytes a b) && sameBytes fa (fold kind b) then
                    acc.Add(a, b)

                j <- j + 1

            i <- i + 1

        acc.ToArray()
