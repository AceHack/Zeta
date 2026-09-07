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
        | Eisdir of ZetaFsNamespace.EntityId
        | Enotdir of ZetaFsNamespace.EntityId
        | Enotempty of ZetaFsNamespace.EntityId
        | Confusable of existing: byte[]
        | Bind of ZetaFsNamespace.BindError
        | Mutbuf of ZetaFsMutbuf.MutbufError

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
        | ZetaFsNamespace.Eisdir id -> Eisdir id
        | ZetaFsNamespace.Enotdir id -> Enotdir id
        | ZetaFsNamespace.Enotempty id -> Enotempty id
        | ZetaFsNamespace.SourceNotFound -> NotFound
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
    /// `.` and `..` are never created; they are synthesized on readdir.
    let refuseCreate
        (mount: Mount)
        (parent: ZetaFsPosixNode.Node)
        (name: byte[])
        : Result<unit, Error> =
        if sameBytes name dot || sameBytes name dotDot then
            Error(Confusable name)
        else
            match liveNames mount parent.Entity with
            | Error e -> Error e
            | Ok live ->
                let names = live |> Array.map fst

                match ZetaFsCollator.refuseCreate mount.Collator names name with
                | Ok() -> Ok()
                | Error(ZetaFsCollator.ConfusableWithExisting existing) -> Error(Confusable existing)

    let private internChild
        (mount: Mount)
        (parent: ZetaFsPosixNode.Node)
        (id: ZetaFsNamespace.EntityId)
        : ZetaFsPosixNode.Node * Mount =
        let node, cache = ZetaFsPosixNode.intern mount.Cache parent id
        node, { mount with Cache = cache }

    /// Create a File under `parent` after the collator oracle.
    let create
        (mount: Mount)
        (parent: ZetaFsPosixNode.Node)
        (name: byte[])
        : Result<ZetaFsPosixNode.Node * Mount, Error> =
        match refuseCreate mount parent name with
        | Error e -> Error e
        | Ok() ->
            match ZetaFsFreeze.bindFileUnder mount.Volume parent.Entity name with
            | Error e -> Error(ofBind e)
            | Ok id -> Ok(internChild mount parent id)

    /// Create a Directory under `parent` after the collator oracle.
    let mkdir
        (mount: Mount)
        (parent: ZetaFsPosixNode.Node)
        (name: byte[])
        : Result<ZetaFsPosixNode.Node * Mount, Error> =
        match refuseCreate mount parent name with
        | Error e -> Error e
        | Ok() ->
            match ZetaFsFreeze.bindDirectory mount.Volume parent.Entity name with
            | Error e -> Error(ofBind e)
            | Ok id -> Ok(internChild mount parent id)

    /// Create a Symlink under `parent`. Target bytes are not resolved.
    let symlink
        (mount: Mount)
        (parent: ZetaFsPosixNode.Node)
        (name: byte[])
        (target: byte[])
        : Result<ZetaFsPosixNode.Node * Mount, Error> =
        match refuseCreate mount parent name with
        | Error e -> Error e
        | Ok() ->
            match ZetaFsFreeze.bindSymlink mount.Volume parent.Entity name target with
            | Error e -> Error(ofBind e)
            | Ok id -> Ok(internChild mount parent id)

    let getattr
        (mount: Mount)
        (node: ZetaFsPosixNode.Node)
        : Result<ZetaFsPosixMeta.PosixStat, Error> =
        match ZetaFsFreeze.getattr mount.Volume node.Entity with
        | Error e -> Error(ofBind e)
        | Ok stat -> Ok stat

    let setattr
        (mount: Mount)
        (node: ZetaFsPosixNode.Node)
        (patch: ZetaFsPosixMeta.PosixSetattr)
        : Result<unit, Error> =
        match ZetaFsFreeze.setattr mount.Volume node.Entity patch with
        | Error e -> Error(ofBind e)
        | Ok() -> Ok()

    let private ifreg = 0o100000u
    let private ifdir = 0o040000u
    let private iflnk = 0o120000u
    let private ifmt = 0o170000u

    let private requireFile (mount: Mount) (node: ZetaFsPosixNode.Node) : Result<unit, Error> =
        match getattr mount node with
        | Error e -> Error e
        | Ok stat ->
            match stat.Meta.Mode &&& ifmt with
            | mode when mode = ifreg -> Ok()
            | mode when mode = ifdir -> Error(Eisdir node.Entity)
            | _ -> Error NotFound

    let private withHandle
        (mount: Mount)
        (node: ZetaFsPosixNode.Node)
        (f: ZetaFsMutbuf.Handle -> Result<'a, ZetaFsMutbuf.MutbufError>)
        : Result<'a, Error> =
        match requireFile mount node with
        | Error e -> Error e
        | Ok() ->
            let h = ZetaFsMutbuf.openHandle mount.Volume.Mutbuf node.Entity

            match f h with
            | Error e -> Error(Mutbuf e)
            | Ok v -> Ok v

    /// Shared mutbuf pwrite. Default Fake VFS coherence is Shared (E5).
    let pwrite
        (mount: Mount)
        (node: ZetaFsPosixNode.Node)
        (offset: int64)
        (src: byte[])
        : Result<int, Error> =
        withHandle mount node (fun h -> ZetaFsMutbuf.pwrite mount.Volume.Mutbuf h offset src)

    let pread
        (mount: Mount)
        (node: ZetaFsPosixNode.Node)
        (offset: int64)
        (dst: byte[])
        : Result<int, Error> =
        withHandle mount node (fun h -> ZetaFsMutbuf.pread mount.Volume.Mutbuf h offset dst)

    let truncate
        (mount: Mount)
        (node: ZetaFsPosixNode.Node)
        (len: int64)
        : Result<unit, Error> =
        withHandle mount node (fun h -> ZetaFsMutbuf.truncate mount.Volume.Mutbuf h len)

    let readlink (mount: Mount) (node: ZetaFsPosixNode.Node) : Result<byte[], Error> =
        match getattr mount node with
        | Error e -> Error e
        | Ok stat when (stat.Meta.Mode &&& ifmt) = iflnk ->
            match ZetaFsFreeze.readSymlink mount.Volume node.Entity with
            | Some bytes -> Ok bytes
            | None -> Error NotFound
        | Ok _ -> Error NotFound

    let unlink
        (mount: Mount)
        (parent: ZetaFsPosixNode.Node)
        (name: byte[])
        : Result<unit, Error> =
        if sameBytes name dot || sameBytes name dotDot then
            Error(Confusable name)
        else
            match lookup mount parent name with
            | Error e -> Error e
            | Ok(node, _) ->
                match getattr mount node with
                | Error e -> Error e
                | Ok stat when (stat.Meta.Mode &&& ifmt) = ifdir -> Error(Eisdir node.Entity)
                | Ok _ ->
                    match ZetaFsFreeze.unlinkUnder mount.Volume parent.Entity name with
                    | Error e -> Error(ofBind e)
                    | Ok() -> Ok()

    let rmdir
        (mount: Mount)
        (parent: ZetaFsPosixNode.Node)
        (name: byte[])
        : Result<unit, Error> =
        if sameBytes name dot || sameBytes name dotDot then
            Error(Confusable name)
        else
            match lookup mount parent name with
            | Error e -> Error e
            | Ok(node, _) ->
                match getattr mount node with
                | Error e -> Error e
                | Ok stat when (stat.Meta.Mode &&& ifmt) <> ifdir -> Error(Enotdir node.Entity)
                | Ok _ ->
                    match liveNames mount node.Entity with
                    | Error e -> Error e
                    | Ok live when live.Length > 0 -> Error(Enotempty node.Entity)
                    | Ok _ ->
                        match ZetaFsFreeze.unlinkUnder mount.Volume parent.Entity name with
                        | Error e -> Error(ofBind e)
                        | Ok() -> Ok()

    /// POSIX typed replace via the volume. Dest exact-name replace is
    /// allowed. A dest that only collides under the collator is Confusable.
    let rename
        (mount: Mount)
        (srcParent: ZetaFsPosixNode.Node)
        (srcName: byte[])
        (dstParent: ZetaFsPosixNode.Node)
        (dstName: byte[])
        : Result<unit, Error> =
        if sameBytes srcName dot || sameBytes srcName dotDot then
            Error(Confusable srcName)
        elif sameBytes dstName dot || sameBytes dstName dotDot then
            Error(Confusable dstName)
        else
            match liveNames mount dstParent.Entity with
            | Error e -> Error e
            | Ok live ->
                let exact =
                    live
                    |> Array.exists (fun (n, _) -> sameBytes n dstName)

                let proceed () =
                    match
                        ZetaFsFreeze.rename
                            mount.Volume
                            srcParent.Entity
                            srcName
                            dstParent.Entity
                            dstName
                    with
                    | Error e -> Error(ofBind e)
                    | Ok() -> Ok()

                if exact then
                    proceed ()
                else
                    match refuseCreate mount dstParent dstName with
                    | Error e -> Error e
                    | Ok() -> proceed ()
