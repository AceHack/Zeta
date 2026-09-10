namespace Zeta.Core

open System
open System.Globalization
open System.Text

/// POSIX metadata satellite (PR13). Display mtime/ctime are unix-ns
/// attribute data, not fold keys. Auto-stamps come from the injected
/// `ISimulationEnvironment` clock. Never the ambient wall clock.
/// `utimensat` writes caller-supplied unix-ns. atime is view-local
/// and is not stored.
module ZetaFsPosixMeta =

    /// S_IFREG | 0644
    let fileMode = 0o100644u

    /// S_IFDIR | 0755
    let directoryMode = 0o040755u

    /// S_IFLNK | 0777
    let symlinkMode = 0o120777u

    type PosixMeta =
        { Entity: ZetaFsNamespace.EntityId
          Mode: uint32
          Uid: uint32
          Gid: uint32
          Size: uint64
          MtimeNs: int64
          CtimeNs: int64 }

    type PosixSetattr =
        { Mode: uint32 option
          Uid: uint32 option
          Gid: uint32 option
          MtimeNs: int64 option
          CtimeNs: int64 option }

    type PosixStat =
        { Meta: PosixMeta
          Nlink: int64
          Size: uint64 }

    let unixNs (env: ISimulationEnvironment) : int64 =
        env.UtcNow().ToUnixTimeMilliseconds() * 1_000_000L

    let modeOf (kind: ZetaFsNamespace.EntityKind) : uint32 =
        match kind with
        | ZetaFsNamespace.EntityKind.Directory -> directoryMode
        | ZetaFsNamespace.EntityKind.Symlink -> symlinkMode
        | ZetaFsNamespace.EntityKind.File
        | ZetaFsNamespace.EntityKind.Essence -> fileMode

    let born (id: ZetaFsNamespace.EntityId) (kind: ZetaFsNamespace.EntityKind) (nowNs: int64) : PosixMeta =
        { Entity = id
          Mode = modeOf kind
          Uid = 0u
          Gid = 0u
          Size = 0UL
          MtimeNs = nowNs
          CtimeNs = nowNs }

    let emptyPatch: PosixSetattr =
        { Mode = None
          Uid = None
          Gid = None
          MtimeNs = None
          CtimeNs = None }

    /// Omitted Mode/Uid/Gid stay. Omitted times stamp from `nowNs`
    /// (setattr-without-times / touch). Caller-supplied times are utimensat.
    let apply (meta: PosixMeta) (patch: PosixSetattr) (nowNs: int64) : PosixMeta =
        { meta with
            Mode = defaultArg patch.Mode meta.Mode
            Uid = defaultArg patch.Uid meta.Uid
            Gid = defaultArg patch.Gid meta.Gid
            MtimeNs = defaultArg patch.MtimeNs nowNs
            CtimeNs = defaultArg patch.CtimeNs nowNs }

    let format (meta: PosixMeta) : string =
        ZetaFsNamespace.EntityId.format meta.Entity
        + " "
        + meta.Mode.ToString(CultureInfo.InvariantCulture)
        + " "
        + meta.Uid.ToString(CultureInfo.InvariantCulture)
        + " "
        + meta.Gid.ToString(CultureInfo.InvariantCulture)
        + " "
        + meta.Size.ToString(CultureInfo.InvariantCulture)
        + " "
        + meta.MtimeNs.ToString(CultureInfo.InvariantCulture)
        + " "
        + meta.CtimeNs.ToString(CultureInfo.InvariantCulture)

    let parse (raw: string) : PosixMeta option =
        let parts = raw.Split(' ')

        if parts.Length < 7 then
            None
        else
            match
                ZetaFsNamespace.EntityId.tryParse parts.[0],
                UInt32.TryParse(parts.[1], NumberStyles.Integer, CultureInfo.InvariantCulture),
                UInt32.TryParse(parts.[2], NumberStyles.Integer, CultureInfo.InvariantCulture),
                UInt32.TryParse(parts.[3], NumberStyles.Integer, CultureInfo.InvariantCulture),
                UInt64.TryParse(parts.[4], NumberStyles.Integer, CultureInfo.InvariantCulture),
                Int64.TryParse(parts.[5], NumberStyles.Integer, CultureInfo.InvariantCulture),
                Int64.TryParse(parts.[6], NumberStyles.Integer, CultureInfo.InvariantCulture)
            with
            | Some id, (true, mode), (true, uid), (true, gid), (true, size), (true, mtime), (true, ctime) ->
                Some
                    { Entity = id
                      Mode = mode
                      Uid = uid
                      Gid = gid
                      Size = size
                      MtimeNs = mtime
                      CtimeNs = ctime }
            | _ -> None
