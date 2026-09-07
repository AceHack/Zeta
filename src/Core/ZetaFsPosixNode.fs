namespace Zeta.Core

open System.Collections.Generic

/// FUSE/FUSE-T node cache (E4 / PR13 merge gate). Path-contextual `..`
/// lives here, not on the volume. `Handle` is EntityId only — no
/// ArrivalParent. Two nodes for one hub may disagree about `..`. Root
/// `..` is root. No kernel FUSE.
module ZetaFsPosixNode =

    /// Volume Open/Lookup key. Arrival parent is adapter-only.
    type Handle = { Entity: ZetaFsNamespace.EntityId }

    type Node =
        { Id: uint64
          Ino: uint64
          Entity: ZetaFsNamespace.EntityId
          ArrivalParent: uint64 }

    type Cache =
        { Root: Node
          Inodes: ZetaFsInode.Table
          NextId: uint64
          ById: Dictionary<uint64, Node> }

    let create (rootEntity: ZetaFsNamespace.EntityId) : Cache =
        let root =
            { Id = ZetaFsInode.RootIno
              Ino = ZetaFsInode.RootIno
              Entity = rootEntity
              ArrivalParent = ZetaFsInode.RootIno }

        let byId = Dictionary<uint64, Node>()
        byId.[root.Id] <- root

        { Root = root
          Inodes = ZetaFsInode.create rootEntity
          NextId = 2UL
          ById = byId }

    let handle (entity: ZetaFsNamespace.EntityId) : Handle = { Entity = entity }

    let tryNode (cache: Cache) (id: uint64) : Node option =
        match cache.ById.TryGetValue id with
        | true, n -> Some n
        | false, _ -> None

    /// Intern a lookup of `entity` arrived via `parent`. Same hub from two
    /// parents gets two node ids and one `st_ino`.
    let intern (cache: Cache) (parent: Node) (entity: ZetaFsNamespace.EntityId) : Node * Cache =
        let ino, inodes = ZetaFsInode.ofEntity cache.Inodes entity
        let node =
            { Id = cache.NextId
              Ino = ino
              Entity = entity
              ArrivalParent = parent.Id }

        cache.ById.[node.Id] <- node

        node,
        { cache with
            Inodes = inodes
            NextId = cache.NextId + 1UL }

    /// `lookup("..")`. Root `..` is root. Otherwise the arrival parent node.
    let lookupDotDot (cache: Cache) (node: Node) : Node =
        if node.Ino = ZetaFsInode.RootIno then
            cache.Root
        else
            match cache.ById.TryGetValue node.ArrivalParent with
            | true, parent -> parent
            | false, _ -> cache.Root
