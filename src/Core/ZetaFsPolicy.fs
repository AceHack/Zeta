namespace Zeta.Core

open System
open System.Globalization
open System.Text

/// Per-entity / prefix policy as a Z-set satellite (E6 / PR5).
/// Policy is of the EntityId, not of a path. `Policy.fs` SELECTS; this module
/// stores the selected decision as a fact. Later ByPrefix edits do not rewrite
/// existing hubs. Rolling caps stay named and unmetered (C1).
///
/// Alloc: the catalog is an append-only list. `effective` scans once (no sort,
/// no ToHex). Copy-at-first-bind appends ByEntity rows; it does not clone hubs.
module ZetaFsPolicy =

    type HistoryPolicy =
        | KeepAll
        | Rolling of maxVersions: int option * maxPhaseSpan: uint64 option * maxBytes: uint64 option
        /// Spec name `none` — not `option.None`.
        | KeepNone
        | Regen of generatorId: string * inputs: byte[] list

    type DurabilityClass =
        | Buffered
        | Journaled
        | Durable

    type PlacementProfile =
        | Single
        | SinglePlusParity
        | Stripe
        | Mirror

    type Kind =
        | History of HistoryPolicy
        | Placement of PlacementProfile
        | DurabilityDefault of DurabilityClass

    type Subject =
        | ByPrefix of parent: ZetaFsNamespace.EntityId * namePrefix: byte[]
        | ByEntity of ZetaFsNamespace.EntityId
        | VolumeDefault

    type Binding =
        { Subject: Subject
          Kind: Kind
          Phase: ZetaFsNamespace.FsPhase
          Asserter: ZetaFsNamespace.ActorId }

    type Catalog = { Bindings: Binding list }

    type KindTag =
        | HistoryTag
        | PlacementTag
        | DurabilityTag

    let tagOf (k: Kind) : KindTag =
        match k with
        | History _ -> HistoryTag
        | Placement _ -> PlacementTag
        | DurabilityDefault _ -> DurabilityTag

    /// Volume rolling default: maxVersions=32, other caps unset (C1, unmetered).
    let rollingDefault: HistoryPolicy = Rolling(Some 32, None, None)

    let empty: Catalog = { Bindings = [] }

    let assertBinding (catalog: Catalog) (binding: Binding) : Catalog =
        { Bindings = binding :: catalog.Bindings }

    let private startsWith (name: byte[]) (prefix: byte[]) : bool =
        prefix.Length <= name.Length
        && MemoryExtensions.SequenceEqual(ReadOnlySpan<byte>(name, 0, prefix.Length), ReadOnlySpan<byte> prefix)

    let private compareBindings (a: Binding) (b: Binding) : int =
        match Versionstamp.compare a.Phase.Stamp b.Phase.Stamp with
        | 0 ->
            match compare (tagOf a.Kind) (tagOf b.Kind) with
            | 0 ->
                match a.Subject, b.Subject with
                | ByEntity ia, ByEntity ib -> ZetaFsNamespace.EntityId.compare ia ib
                | ByPrefix(pa, na), ByPrefix(pb, nb) ->
                    match ZetaFsNamespace.EntityId.compare pa pb with
                    | 0 ->
                        let n = min na.Length nb.Length
                        let mutable i = 0
                        let mutable r = 0

                        while i < n && r = 0 do
                            r <- compare na.[i] nb.[i]
                            i <- i + 1

                        if r <> 0 then r else compare na.Length nb.Length
                    | c -> c
                | VolumeDefault, VolumeDefault -> 0
                | ByEntity _, _ -> 1
                | _, ByEntity _ -> -1
                | ByPrefix _, VolumeDefault -> 1
                | VolumeDefault, ByPrefix _ -> -1
            | c -> c
        | c -> c

    let private better (a: Binding) (b: Binding) : bool = compareBindings a b < 0

    let private winnerFor (catalog: Catalog) (pred: Binding -> bool) : Binding option =
        let mutable best: Binding option = None

        for b in catalog.Bindings do
            if pred b then
                match best with
                | None -> best <- Some b
                | Some prev ->
                    if better prev b then
                        best <- Some b

        best

    let byEntity (catalog: Catalog) (id: ZetaFsNamespace.EntityId) (tag: KindTag) : Binding option =
        winnerFor catalog (fun b ->
            match b.Subject with
            | ByEntity e when e = id && tagOf b.Kind = tag -> true
            | _ -> false)

    let volumeDefault (catalog: Catalog) (tag: KindTag) : Binding option =
        winnerFor catalog (fun b ->
            match b.Subject with
            | VolumeDefault when tagOf b.Kind = tag -> true
            | _ -> false)

    let nearestPrefix
        (catalog: Catalog)
        (parent: ZetaFsNamespace.EntityId)
        (name: byte[])
        (tag: KindTag)
        : Binding option =
        let mutable best: Binding option = None
        let mutable bestLen = -1

        for b in catalog.Bindings do
            match b.Subject with
            | ByPrefix(p, prefix) when p = parent && tagOf b.Kind = tag && startsWith name prefix ->
                if prefix.Length > bestLen then
                    best <- Some b
                    bestLen <- prefix.Length
                elif prefix.Length = bestLen then
                    match best with
                    | None -> best <- Some b
                    | Some prev ->
                        if better prev b then
                            best <- Some b
            | _ -> ()

        best

    /// SELECT the stored decision for one kind. ByEntity wins; else none (not yet copied).
    let effectiveKind (catalog: Catalog) (id: ZetaFsNamespace.EntityId) (tag: KindTag) : Kind option =
        match byEntity catalog id tag with
        | Some b -> Some b.Kind
        | None -> None

    /// Policy.fs kernel: SELECT history for a hub. Does not mutate the catalog.
    let selectHistory: Policy.Policy<Catalog * ZetaFsNamespace.EntityId, HistoryPolicy option, string> =
        fun (catalog, id) ->
            match effectiveKind catalog id HistoryTag with
            | Some(History h) -> Policy.result (Some h) "ByEntity"
            | Some _ -> Policy.result None "ByEntity has a different kind"
            | None -> Policy.result None "no ByEntity; not yet copied at first bind"

    let effectiveHistory (catalog: Catalog) (id: ZetaFsNamespace.EntityId) : HistoryPolicy option =
        (selectHistory (catalog, id)).Decision

    let private template
        (catalog: Catalog)
        (parent: ZetaFsNamespace.EntityId)
        (name: byte[])
        (tag: KindTag)
        : Kind option =
        match nearestPrefix catalog parent name tag with
        | Some b -> Some b.Kind
        | None ->
            match volumeDefault catalog tag with
            | Some b -> Some b.Kind
            | None -> None

    let private firstBindTags = [| HistoryTag; PlacementTag; DurabilityTag |]

    /// At mint / first Bind: copy nearest ByPrefix or VolumeDefault onto ByEntity.
    /// Existing ByEntity rows are left alone. Same hub, one policy (two-parent fixture).
    let copyAtFirstBind
        (catalog: Catalog)
        (entity: ZetaFsNamespace.EntityId)
        (parent: ZetaFsNamespace.EntityId)
        (name: byte[])
        (phase: ZetaFsNamespace.FsPhase)
        (asserter: ZetaFsNamespace.ActorId)
        : Catalog =
        let mutable acc = catalog

        for tag in firstBindTags do
            match byEntity acc entity tag with
            | Some _ -> ()
            | None ->
                match template acc parent name tag with
                | None -> ()
                | Some kind ->
                    acc <-
                        assertBinding
                            acc
                            { Subject = ByEntity entity
                              Kind = kind
                              Phase = phase
                              Asserter = asserter }

        acc

    /// Suggested consumer fixtures — tests and volume setup, not OS dogma.
    let sourceHistory = History KeepAll
    let targetHistory = History KeepNone
    let sourceDurability = DurabilityDefault Durable
    let targetDurability = DurabilityDefault Buffered

    let private opt64 (n: uint64 option) : string =
        match n with
        | None -> "-"
        | Some x -> x.ToString(CultureInfo.InvariantCulture)

    let formatKind (k: Kind) : string =
        match k with
        | History KeepAll -> "history keep-all"
        | History KeepNone -> "history keep-none"
        | History(Rolling(None, _, _)) -> "history keep-all"
        | History(Rolling(Some n, phase, bytes)) ->
            "history rolling "
            + n.ToString(CultureInfo.InvariantCulture)
            + " "
            + opt64 phase
            + " "
            + opt64 bytes
        | History(Regen(generatorId, _)) ->
            if String.IsNullOrEmpty generatorId then
                "history regen -"
            else
                "history regen " + Convert.ToHexString(Encoding.UTF8.GetBytes generatorId)
        | Placement Single -> "placement single"
        | Placement SinglePlusParity -> "placement single-plus-parity"
        | Placement Stripe -> "placement stripe"
        | Placement Mirror -> "placement mirror"
        | DurabilityDefault Buffered -> "durability buffered"
        | DurabilityDefault Journaled -> "durability journaled"
        | DurabilityDefault Durable -> "durability durable"

    let private parseOpt64 (s: string) : uint64 option =
        if String.Equals(s, "-", StringComparison.Ordinal) then
            None
        else
            match UInt64.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture) with
            | true, n -> Some n
            | _ -> None

    let parseKind (parts: string[]) : Kind option =
        if parts.Length < 2 then
            None
        elif String.Equals(parts.[0], "history", StringComparison.Ordinal) then
            match parts.[1] with
            | "keep-all" -> Some(History KeepAll)
            | "keep-none" -> Some(History KeepNone)
            | "rolling" when parts.Length >= 3 ->
                match Int32.TryParse(parts.[2], NumberStyles.Integer, CultureInfo.InvariantCulture) with
                | true, n when n >= 1 ->
                    let phase = if parts.Length >= 4 then parseOpt64 parts.[3] else None
                    let bytes = if parts.Length >= 5 then parseOpt64 parts.[4] else None
                    Some(History(Rolling(Some n, phase, bytes)))
                | _ -> None
            | "regen" when parts.Length >= 3 ->
                if String.Equals(parts.[2], "-", StringComparison.Ordinal) then
                    Some(History(Regen("", [])))
                else
                    try
                        let id = Encoding.UTF8.GetString(Convert.FromHexString parts.[2])
                        Some(History(Regen(id, [])))
                    with _ ->
                        None
            | _ -> None
        elif String.Equals(parts.[0], "placement", StringComparison.Ordinal) then
            match parts.[1] with
            | "single" -> Some(Placement Single)
            | "single-plus-parity" -> Some(Placement SinglePlusParity)
            | "stripe" -> Some(Placement Stripe)
            | "mirror" -> Some(Placement Mirror)
            | _ -> None
        elif String.Equals(parts.[0], "durability", StringComparison.Ordinal) then
            match parts.[1] with
            | "buffered" -> Some(DurabilityDefault Buffered)
            | "journaled" -> Some(DurabilityDefault Journaled)
            | "durable" -> Some(DurabilityDefault Durable)
            | _ -> None
        else
            None

    let formatBinding (b: Binding) : string =
        let asserter =
            match b.Asserter with
            | ZetaFsNamespace.ActorId a -> a

        let ver = b.Phase.Stamp.Version.ToString(CultureInfo.InvariantCulture)
        let payload = formatKind b.Kind

        match b.Subject with
        | VolumeDefault -> "volume-default " + payload + " " + asserter + " " + ver
        | ByEntity id ->
            "entity "
            + ZetaFsNamespace.EntityId.format id
            + " "
            + payload
            + " "
            + asserter
            + " "
            + ver
        | ByPrefix(parent, prefix) ->
            "prefix "
            + ZetaFsNamespace.EntityId.format parent
            + " "
            + Convert.ToHexString prefix
            + " "
            + payload
            + " "
            + asserter
            + " "
            + ver

    let parseBinding (raw: string) : Binding option =
        let parts = raw.Split(' ')

        if parts.Length < 5 then
            None
        else
            let asserter = ZetaFsNamespace.ActorId parts.[parts.Length - 2]

            match Int64.TryParse(parts.[parts.Length - 1], NumberStyles.Integer, CultureInfo.InvariantCulture) with
            | false, _ -> None
            | true, ver ->
                let phase: ZetaFsNamespace.FsPhase =
                    { Line = ZetaFsNamespace.PhaseLine
                      Stamp = Versionstamp.ofInt64 ver }

                if String.Equals(parts.[0], "volume-default", StringComparison.Ordinal) then
                    match parseKind parts.[1 .. parts.Length - 3] with
                    | None -> None
                    | Some kind ->
                        Some
                            { Subject = VolumeDefault
                              Kind = kind
                              Phase = phase
                              Asserter = asserter }
                elif String.Equals(parts.[0], "entity", StringComparison.Ordinal) && parts.Length >= 6 then
                    match ZetaFsNamespace.EntityId.tryParse parts.[1], parseKind parts.[2 .. parts.Length - 3] with
                    | Some id, Some kind ->
                        Some
                            { Subject = ByEntity id
                              Kind = kind
                              Phase = phase
                              Asserter = asserter }
                    | _ -> None
                elif String.Equals(parts.[0], "prefix", StringComparison.Ordinal) && parts.Length >= 7 then
                    match ZetaFsNamespace.EntityId.tryParse parts.[1], parseKind parts.[3 .. parts.Length - 3] with
                    | Some parent, Some kind ->
                        try
                            let name = Convert.FromHexString parts.[2]

                            Some
                                { Subject = ByPrefix(parent, name)
                                  Kind = kind
                                  Phase = phase
                                  Asserter = asserter }
                        with _ ->
                            None
                    | _ -> None
                else
                    None

    /// Oldest first on disk; load prepends so newest stays head.
    let formatCatalog (catalog: Catalog) : string =
        let sb = StringBuilder()

        for b in List.rev catalog.Bindings do
            sb.Append(formatBinding b).Append('\n') |> ignore

        sb.ToString()

    let parseCatalog (text: string) : Catalog =
        let mutable acc = empty
        let lines = text.Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n')

        for raw in lines do
            if raw.Length > 0 then
                match parseBinding raw with
                | None -> ()
                | Some b -> acc <- { Bindings = b :: acc.Bindings }

        acc
