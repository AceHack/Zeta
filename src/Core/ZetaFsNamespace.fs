namespace Zeta.Core

open System
open System.Collections.Generic

/// Names-are-tags namespace: a Z-set of TagBindings, not git trees.
/// `write()` does not rewrite the parent directory EntityId (K5 / K8).
/// Unlink appends a Tombstone that wins argmax; it does not retract the live winner.
module ZetaFsNamespace =

    [<Literal>]
    let PhaseLine = "zetafs"

    [<Literal>]
    let RootFileName = "ROOT"

    /// Injected entropy for EntityId mint.
    type Entropy = Entropy of nextInt64: (unit -> int64)

    [<Struct>]
    type EntityId =
        { Raw: System.UInt128 }

        member this.Format() : string = Zeta.Core.FSharp.ZetaId.ZetaIdCodec.format this.Raw

    [<RequireQualifiedAccess>]
    module EntityId =

        let ofRaw (raw: System.UInt128) : EntityId = { Raw = raw }

        /// Mint a StoreEntity=13 id from injected entropy. Never reuse a returned id.
        let mint (Entropy nextInt64) : EntityId =
            let lo = uint64 (nextInt64 ())
            let hi = uint64 (nextInt64 ())
            let payload =
                (System.UInt128(hi, lo))
                &&& ((System.UInt128.One <<< 119) - System.UInt128.One)

            let packed =
                Zeta.Core.FSharp.ZetaId.ZetaIdCodec.packGeneric
                    Zeta.Core.FSharp.ZetaId.IdVersion.V1
                    Zeta.Core.FSharp.ZetaId.Category.StoreEntity
                    payload
            { Raw = packed }

        let format (id: EntityId) : string = Zeta.Core.FSharp.ZetaId.ZetaIdCodec.format id.Raw

        let tryParse (s: string) : EntityId option =
            try
                Some { Raw = Zeta.Core.FSharp.ZetaId.ZetaIdCodec.parse s }
            with _ ->
                None

        let compare (a: EntityId) (b: EntityId) : int = compare a.Raw b.Raw

    type ActorId = ActorId of string


    /// Volume-local agreed line + Clock.Versionstamp. Not a third Phase DU.
    type FsPhase =
        { Line: string
          Stamp: Versionstamp }

    type BindingTarget =
        | Live of EntityId
        | Tombstone

    type TagBinding =
        { Name: byte[]
          Parent: EntityId
          Target: BindingTarget
          Phase: FsPhase
          Asserter: ActorId }

    type EntityKind =
        | File
        | Directory
        | Essence
        | Symlink

    type BindError =
        | UnknownEntity of EntityId
        | NotDirectory of EntityId
        | Cycle of parent: EntityId * target: EntityId
        | SourceNotFound
        | Eisdir of dest: EntityId
        | Enotdir of dest: EntityId
        | Enotempty of dest: EntityId

    type State =
        { Root: EntityId
          Entities: Map<EntityId, EntityKind>
          Bindings: TagBinding list
          Next: Versionstamp
          Line: string }

    let private namesEqual (a: byte[]) (b: byte[]) : bool =
        a.Length = b.Length && MemoryExtensions.SequenceEqual(ReadOnlySpan<byte> a, ReadOnlySpan<byte> b)

    let private compareBytes (a: byte[]) (b: byte[]) : int =
        let n = min a.Length b.Length
        let mutable i = 0
        let mutable r = 0

        while i < n && r = 0 do
            r <- compare a.[i] b.[i]
            i <- i + 1

        if r <> 0 then r else compare a.Length b.Length

    let private targetEntity (t: BindingTarget) : EntityId option =
        match t with
        | Live id -> Some id
        | Tombstone -> None

    let private encodeBinding (b: TagBinding) : byte[] =
        let phaseBytes = Versionstamp.encode b.Phase.Stamp
        let kindByte, idBytes =
            match b.Target with
            | Tombstone -> 0uy, Array.empty
            | Live id ->
                let formatted = EntityId.format id
                1uy, Text.Encoding.ASCII.GetBytes formatted

        let buf = Array.zeroCreate (phaseBytes.Length + 1 + idBytes.Length + b.Name.Length)
        Buffer.BlockCopy(phaseBytes, 0, buf, 0, phaseBytes.Length)
        buf.[phaseBytes.Length] <- kindByte
        Buffer.BlockCopy(idBytes, 0, buf, phaseBytes.Length + 1, idBytes.Length)
        Buffer.BlockCopy(b.Name, 0, buf, phaseBytes.Length + 1 + idBytes.Length, b.Name.Length)
        buf

    let private compareBindings (a: TagBinding) (b: TagBinding) : int =
        match Versionstamp.compare a.Phase.Stamp b.Phase.Stamp with
        | 0 ->
            match compareBytes (encodeBinding a) (encodeBinding b) with
            | 0 ->
                match targetEntity a.Target, targetEntity b.Target with
                | Some ia, Some ib -> EntityId.compare ia ib
                | None, Some _ -> -1
                | Some _, None -> 1
                | None, None -> EntityId.compare a.Parent b.Parent
            | c -> c
        | c -> c

    let private forName (parent: EntityId) (name: byte[]) (bindings: TagBinding list) : TagBinding list =
        bindings
        |> List.filter (fun b -> b.Parent = parent && namesEqual b.Name name)

    /// Current title = max phase (tie-break: ordinal binding encoding, then EntityId).
    let winner (parent: EntityId) (name: byte[]) (bindings: TagBinding list) : TagBinding option =
        match forName parent name bindings with
        | [] -> None
        | xs -> xs |> List.sortWith compareBindings |> List.rev |> List.tryHead

    let liveResolve (parent: EntityId) (name: byte[]) (bindings: TagBinding list) : EntityId option =
        match winner parent name bindings with
        | Some { Target = Live id } -> Some id
        | Some { Target = Tombstone } -> None
        | None -> None

    let resolveAt (parent: EntityId) (name: byte[]) (at: Versionstamp) (bindings: TagBinding list) : BindingTarget option =
        let prior =
            forName parent name bindings
            |> List.filter (fun b -> b.Phase.Stamp.Version <= at.Version)

        match prior with
        | [] -> None
        | xs -> xs |> List.sortWith compareBindings |> List.rev |> List.tryHead |> Option.map (fun b -> b.Target)

    let private liveWinners (state: State) : TagBinding list =
        state.Bindings
        |> List.groupBy (fun b -> b.Parent, Convert.ToHexString b.Name)
        |> List.choose (fun (_, group) ->
            group
            |> List.sortWith compareBindings
            |> List.rev
            |> List.tryHead
            |> Option.filter (fun b ->
                match b.Target with
                | Live _ -> true
                | Tombstone -> false))

    let private parentsOf (state: State) (id: EntityId) : EntityId list =
        [ for b in liveWinners state do
              match b.Target with
              | Live child when child = id -> yield b.Parent
              | _ -> () ]

    /// True iff adding parent-contains-target (target a Directory) would cycle.
    let wouldCycle (state: State) (parent: EntityId) (target: EntityId) : bool =
        if parent = target then
            true
        else
            let seen = HashSet<System.UInt128>()
            let rec walk (current: EntityId) : bool =
                if current = target then
                    true
                elif not (seen.Add current.Raw) then
                    false
                else
                    parentsOf state current |> List.exists walk

            walk parent

    let private stamp (state: State) : FsPhase * Versionstamp =
        { Line = state.Line
          Stamp = state.Next },
        Versionstamp.tick state.Next

    let private mintFresh (state: State) (entropy: Entropy) : EntityId =
        let rec loop () =
            let id = EntityId.mint entropy
            if Map.containsKey id state.Entities then loop () else id

        loop ()

    let create (entropy: Entropy) : State =
        let empty =
            { Root = Unchecked.defaultof<EntityId>
              Entities = Map.empty
              Bindings = []
              Next = Versionstamp.zero
              Line = PhaseLine }

        let root = mintFresh empty entropy

        { Root = root
          Entities = Map.add root EntityKind.Directory Map.empty
          Bindings = []
          Next = Versionstamp.tick Versionstamp.zero
          Line = PhaseLine }

    let mint (state: State) (kind: EntityKind) (entropy: Entropy) : EntityId * State =
        let id = mintFresh state entropy
        id,
        { state with
            Entities = Map.add id kind state.Entities }

    let bind
        (state: State)
        (parent: EntityId)
        (name: byte[])
        (target: EntityId)
        (asserter: ActorId)
        : Result<State, BindError> =
        match Map.tryFind parent state.Entities, Map.tryFind target state.Entities with
        | None, _ -> Error(UnknownEntity parent)
        | _, None -> Error(UnknownEntity target)
        | Some EntityKind.Directory, Some kind ->
            let cyclic =
                match kind with
                | EntityKind.Directory -> wouldCycle state parent target
                | _ -> false

            if cyclic then
                Error(Cycle(parent, target))
            else
                let phase, next = stamp state

                let binding =
                    { Name = name
                      Parent = parent
                      Target = Live target
                      Phase = phase
                      Asserter = asserter }

                Ok
                    { state with
                        Bindings = binding :: state.Bindings
                        Next = next }
        | Some _, _ -> Error(NotDirectory parent)

    /// POSIX unlink: append Tombstone. Does not retract the previous Live.
    let unlink
        (state: State)
        (parent: EntityId)
        (name: byte[])
        (asserter: ActorId)
        : Result<State, BindError> =
        match Map.tryFind parent state.Entities with
        | None -> Error(UnknownEntity parent)
        | Some EntityKind.Directory ->
            let phase, next = stamp state

            let binding =
                { Name = name
                  Parent = parent
                  Target = Tombstone
                  Phase = phase
                  Asserter = asserter }

            Ok
                { state with
                    Bindings = binding :: state.Bindings
                    Next = next }
        | Some _ -> Error(NotDirectory parent)

    let private liveChildCount (state: State) (dir: EntityId) : int =
        liveWinners state
        |> List.filter (fun b -> b.Parent = dir)
        |> List.length

    /// Live non-tombstone names. No `.` / `..` — the adapter synthesizes those.
    let readdir (state: State) (dir: EntityId) : Result<(byte[] * EntityId)[], BindError> =
        match Map.tryFind dir state.Entities with
        | None -> Error(UnknownEntity dir)
        | Some k when k <> EntityKind.Directory -> Error(NotDirectory dir)
        | Some EntityKind.Directory ->
            liveWinners state
            |> List.choose (fun b ->
                if b.Parent = dir then
                    match b.Target with
                    | Live id -> Some(b.Name, id)
                    | Tombstone -> None
                else
                    None)
            |> List.sortWith (fun (a, _) (b, _) -> compareBytes a b)
            |> List.toArray
            |> Ok
        | Some _ -> Error(NotDirectory dir)

    let private isDirectoryKind (k: EntityKind) : bool =
        match k with
        | EntityKind.Directory -> true
        | _ -> false

    /// POSIX typed replace. Dest file+src file: tombstone dest. Dest dir+src
    /// file: Eisdir. Dest file+src dir: Enotdir. Dest empty dir+src dir:
    /// tombstone dest. Dest non-empty dir: Enotempty. Same parent+name: no-op.
    let rename
        (state: State)
        (srcParent: EntityId)
        (srcName: byte[])
        (dstParent: EntityId)
        (dstName: byte[])
        (asserter: ActorId)
        : Result<State, BindError> =
        if srcParent = dstParent && namesEqual srcName dstName then
            Ok state
        else
            match Map.tryFind srcParent state.Entities, Map.tryFind dstParent state.Entities with
            | None, _ -> Error(UnknownEntity srcParent)
            | _, None -> Error(UnknownEntity dstParent)
            | Some srcParentKind, _ when not (isDirectoryKind srcParentKind) -> Error(NotDirectory srcParent)
            | _, Some dstParentKind when not (isDirectoryKind dstParentKind) -> Error(NotDirectory dstParent)
            | Some EntityKind.Directory, Some EntityKind.Directory ->
                match liveResolve srcParent srcName state.Bindings with
                | None -> Error SourceNotFound
                | Some srcId ->
                    match Map.tryFind srcId state.Entities with
                    | None -> Error(UnknownEntity srcId)
                    | Some srcKind ->
                        let move (s: State) : Result<State, BindError> =
                            match bind s dstParent dstName srcId asserter with
                            | Error e -> Error e
                            | Ok s1 -> unlink s1 srcParent srcName asserter

                        match liveResolve dstParent dstName state.Bindings with
                        | None -> move state
                        | Some destId ->
                            match Map.tryFind destId state.Entities with
                            | None -> Error(UnknownEntity destId)
                            | Some destKind ->
                                match srcKind, destKind with
                                | (EntityKind.File | EntityKind.Symlink | EntityKind.Essence), EntityKind.Directory ->
                                    Error(Eisdir destId)
                                | EntityKind.Directory, (EntityKind.File | EntityKind.Symlink | EntityKind.Essence) ->
                                    Error(Enotdir destId)
                                | EntityKind.Directory, EntityKind.Directory when liveChildCount state destId > 0 ->
                                    Error(Enotempty destId)
                                | _ ->
                                    match unlink state dstParent dstName asserter with
                                    | Error e -> Error e
                                    | Ok s1 -> move s1
            | _ -> Error(NotDirectory srcParent)
