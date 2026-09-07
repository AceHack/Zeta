namespace Zeta.Core

open System

/// Userspace POSIX adapter (PR13 Fake VFS). Mount operations are a
/// function of (request, volume, node cache, collator). `.` / `..`
/// are synthesized here. Volume Handle stays EntityId-only.
/// No kernel FUSE. No FUSE-T binary.
module ZetaFsPosixVfs =

    let dot = [| 46uy |]
    let dotDot = [| 46uy; 46uy |]

    type Error =
        | NotFound
        | NotDirectory of ZetaFsNamespace.EntityId
        | UnknownEntity of ZetaFsNamespace.EntityId
        | Confusable of existing: byte[]
        | Bind of ZetaFsNamespace.BindError

    type Mount =
        { Volume: ZetaFsFreeze.Volume
          Collator: ZetaFsCollator.Kind
          Cache: ZetaFsPosixNode.Cache }

    type Dirent =
        { Name: byte[]
          Node: ZetaFsPosixNode.Node }

    let tryCreate (volume: ZetaFsFreeze.Volume) (collator: ZetaFsCollator.Kind) : Mount option =
        match volume.Root with
        | None -> None
        | Some root ->
            Some
                { Volume = volume
                  Collator = collator
                  Cache = ZetaFsPosixNode.create root }

    let linux (volume: ZetaFsFreeze.Volume) : Mount option =
        tryCreate volume ZetaFsCollator.linuxDefault

    let fuseT (volume: ZetaFsFreeze.Volume) : Mount option =
        tryCreate volume ZetaFsCollator.fuseTDefault

    let root (mount: Mount) : ZetaFsPosixNode.Node = mount.Cache.Root

    let private sameBytes (a: byte[]) (b: byte[]) : bool =
        a.Length = b.Length
        && MemoryExtensions.SequenceEqual(ReadOnlySpan<byte> a, ReadOnlySpan<byte> b)

    let private ofBind (e: ZetaFsNamespace.BindError) : Error =
        match e with
        | ZetaFsNamespace.NotDirectory id -> NotDirectory id
        | ZetaFsNamespace.UnknownEntity id -> UnknownEntity id
        | other -> Bind other

    let private liveNames
        (mount: Mount)
        (dir: ZetaFsNamespace.EntityId)
        : Result<(byte[] * ZetaFsNamespace.EntityId)[], Error> =
        match ZetaFsFreeze.readdir mount.Volume dir with
        | Error e -> Error(ofBind e)
        | Ok names -> Ok names

    /// Lookup `.` / `..` / a live name. Ascii folds A-Z; two live names
    /// that fold equal are Confusable (never a silent merge). Ordinal is
    /// exact bytes.
    let lookup
        (mount: Mount)
        (parent: ZetaFsPosixNode.Node)
        (name: byte[])
        : Result<ZetaFsPosixNode.Node * Mount, Error> =
        if sameBytes name dot then
            Ok(parent, mount)
        elif sameBytes name dotDot then
            Ok(ZetaFsPosixNode.lookupDotDot mount.Cache parent, mount)
        else
            match liveNames mount parent.Entity with
            | Error e -> Error e
            | Ok live ->
                let folded = ZetaFsCollator.fold mount.Collator name
                let hits =
                    live
                    |> Array.filter (fun (n, _) ->
                        sameBytes (ZetaFsCollator.fold mount.Collator n) folded)

                match hits with
                | [||] -> Error NotFound
                | [| _, id |] ->
                    let node, cache = ZetaFsPosixNode.intern mount.Cache parent id
                    Ok(node, { mount with Cache = cache })
                | many -> Error(Confusable(fst many.[0]))

    /// Live names plus synthesized `.` and `..`. `.` is this node; `..`
    /// is the arrival parent (root `..` is root).
    let readdir
        (mount: Mount)
        (parent: ZetaFsPosixNode.Node)
        : Result<Dirent[] * Mount, Error> =
        match liveNames mount parent.Entity with
        | Error e -> Error e
        | Ok live ->
            let acc = ResizeArray<Dirent>(live.Length + 2)
            acc.Add({ Name = dot; Node = parent })
            acc.Add(
                { Name = dotDot
                  Node = ZetaFsPosixNode.lookupDotDot mount.Cache parent }
            )

            let mutable cache = mount.Cache
            let mutable i = 0

            while i < live.Length do
                let name, id = live.[i]
                let node, next = ZetaFsPosixNode.intern cache parent id
                cache <- next
                acc.Add({ Name = name; Node = node })
                i <- i + 1

            Ok(acc.ToArray(), { mount with Cache = cache })

    /// Adapter oracle for create. Store bind is a later call.
    let refuseCreate
        (mount: Mount)
        (parent: ZetaFsPosixNode.Node)
        (name: byte[])
        : Result<unit, Error> =
        match liveNames mount parent.Entity with
        | Error e -> Error e
        | Ok live ->
            let names = live |> Array.map fst

            match ZetaFsCollator.refuseCreate mount.Collator names name with
            | Ok() -> Ok()
            | Error(ZetaFsCollator.ConfusableWithExisting existing) -> Error(Confusable existing)
