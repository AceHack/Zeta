namespace Zeta.Core

open System.Collections.Generic

/// FUSE opcode dispatcher over Fake VFS (PR13). Requests are a function
/// of (session, opcode). No `/dev/fuse`, no kernel, no FUSE-T binary.
module ZetaFsFuse =

    type Errno =
        | ENOENT
        | EEXIST
        | ENOTDIR
        | EISDIR
        | EINVAL
        | ENOTEMPTY

    let code (e: Errno) : int =
        match e with
        | ENOENT -> 2
        | EEXIST -> 17
        | ENOTDIR -> 20
        | EISDIR -> 21
        | EINVAL -> 22
        | ENOTEMPTY -> 39

    type Request =
        | Lookup of parent: uint64 * name: byte[]
        | Getattr of id: uint64
        | Readdir of id: uint64
        | Create of parent: uint64 * name: byte[]
        | Open of id: uint64
        | Read of fh: uint64 * offset: int64 * size: int
        | Write of fh: uint64 * offset: int64 * data: byte[]
        | Release of fh: uint64

    type Reply =
        | Node of ZetaFsPosixNode.Node
        | Stat of stat: ZetaFsPosixMeta.PosixStat * ino: uint64
        | Dirents of ZetaFsPosixVfs.Dirent[]
        | Fh of uint64
        | Bytes of byte[]
        | Written of int
        | Released
        | Fail of Errno

    type Session =
        { mutable Mount: ZetaFsPosixVfs.Mount
          Fds: Dictionary<uint64, ZetaFsPosixVfs.Fd>
          mutable NextFd: uint64 }

    let create (mount: ZetaFsPosixVfs.Mount) : Session =
        { Mount = mount
          Fds = Dictionary<uint64, ZetaFsPosixVfs.Fd>()
          NextFd = 1UL }

    let private ofVfs (e: ZetaFsPosixVfs.Error) : Errno =
        match e with
        | ZetaFsPosixVfs.NotFound -> ENOENT
        | ZetaFsPosixVfs.NotDirectory _ -> ENOTDIR
        | ZetaFsPosixVfs.Enotdir _ -> ENOTDIR
        | ZetaFsPosixVfs.Eisdir _ -> EISDIR
        | ZetaFsPosixVfs.Enotempty _ -> ENOTEMPTY
        | ZetaFsPosixVfs.Confusable _ -> EEXIST
        | ZetaFsPosixVfs.Mutbuf _ -> EINVAL
        | ZetaFsPosixVfs.UnknownEntity _ -> ENOENT
        | ZetaFsPosixVfs.Bind _ -> ENOENT

    let private nodeOf (session: Session) (id: uint64) : Result<ZetaFsPosixNode.Node, Errno> =
        match ZetaFsPosixNode.tryNode session.Mount.Cache id with
        | Some n -> Result.Ok n
        | None -> Result.Error ENOENT

    let dispatch (session: Session) (req: Request) : Reply =
        match req with
        | Lookup(parentId, name) ->
            match nodeOf session parentId with
            | Result.Error e -> Fail e
            | Result.Ok parent ->
                match ZetaFsPosixVfs.lookup session.Mount parent name with
                | Result.Error e -> Fail(ofVfs e)
                | Result.Ok(node, mount) ->
                    session.Mount <- mount
                    Node node

        | Getattr id ->
            match nodeOf session id with
            | Result.Error e -> Fail e
            | Result.Ok node ->
                match ZetaFsPosixVfs.getattr session.Mount node with
                | Result.Error e -> Fail(ofVfs e)
                | Result.Ok stat -> Stat(stat, node.Ino)

        | Readdir id ->
            match nodeOf session id with
            | Result.Error e -> Fail e
            | Result.Ok node ->
                match ZetaFsPosixVfs.readdir session.Mount node with
                | Result.Error e -> Fail(ofVfs e)
                | Result.Ok(entries, mount) ->
                    session.Mount <- mount
                    Dirents entries

        | Create(parentId, name) ->
            match nodeOf session parentId with
            | Result.Error e -> Fail e
            | Result.Ok parent ->
                match ZetaFsPosixVfs.create session.Mount parent name with
                | Result.Error e -> Fail(ofVfs e)
                | Result.Ok(node, mount) ->
                    session.Mount <- mount
                    Node node

        | Open id ->
            match nodeOf session id with
            | Result.Error e -> Fail e
            | Result.Ok node ->
                match ZetaFsPosixVfs.openFile session.Mount node with
                | Result.Error e -> Fail(ofVfs e)
                | Result.Ok fd ->
                    let fh = session.NextFd
                    session.NextFd <- fh + 1UL
                    session.Fds.[fh] <- fd
                    Fh fh

        | Read(fh, offset, size) ->
            match session.Fds.TryGetValue fh with
            | false, _ -> Fail ENOENT
            | true, fd ->
                let dst = Array.zeroCreate (max 0 size)

                match ZetaFsPosixVfs.preadFd session.Mount fd offset dst with
                | Result.Error e -> Fail(ofVfs e)
                | Result.Ok n ->
                    if n >= dst.Length then
                        Bytes dst
                    else
                        let slice = Array.zeroCreate n
                        if n > 0 then
                            System.Buffer.BlockCopy(dst, 0, slice, 0, n)
                        Bytes slice

        | Write(fh, offset, data) ->
            match session.Fds.TryGetValue fh with
            | false, _ -> Fail ENOENT
            | true, fd ->
                match ZetaFsPosixVfs.pwriteFd session.Mount fd offset data with
                | Result.Error e -> Fail(ofVfs e)
                | Result.Ok n -> Written n

        | Release fh ->
            match session.Fds.TryGetValue fh with
            | false, _ -> Fail ENOENT
            | true, fd ->
                match ZetaFsPosixVfs.close session.Mount fd with
                | Result.Error e -> Fail(ofVfs e)
                | Result.Ok() ->
                    session.Fds.Remove fh |> ignore
                    Released
