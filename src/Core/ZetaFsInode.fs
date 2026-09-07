namespace Zeta.Core

open System.Collections.Generic

/// POSIX inode projection (PR13). `st_ino` is a side table over EntityId,
/// not the EntityId itself. Write does not change it. Two FUSE nodes for
/// the same hub share `st_ino`. `..` is not stored here.
module ZetaFsInode =

    [<Literal>]
    let RootIno = 1UL

    type Table =
        { Next: uint64
          ByEntity: Dictionary<System.UInt128, uint64>
          ByIno: Dictionary<uint64, ZetaFsNamespace.EntityId> }

    let create (root: ZetaFsNamespace.EntityId) : Table =
        let byEntity = Dictionary<System.UInt128, uint64>()
        let byIno = Dictionary<uint64, ZetaFsNamespace.EntityId>()
        byEntity.[root.Raw] <- RootIno
        byIno.[RootIno] <- root

        { Next = 2UL
          ByEntity = byEntity
          ByIno = byIno }

    let ofEntity (table: Table) (id: ZetaFsNamespace.EntityId) : uint64 * Table =
        match table.ByEntity.TryGetValue id.Raw with
        | true, ino -> ino, table
        | false, _ ->
            let ino = table.Next
            table.ByEntity.[id.Raw] <- ino
            table.ByIno.[ino] <- id
            ino, { table with Next = ino + 1UL }

    let tryEntity (table: Table) (ino: uint64) : ZetaFsNamespace.EntityId option =
        match table.ByIno.TryGetValue ino with
        | true, id -> Some id
        | false, _ -> None
