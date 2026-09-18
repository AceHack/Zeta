namespace Zeta.Core

open System
open System.Threading
open System.Threading.Tasks

// Unified host WAL facts: reverse-index rows, schema-plane events, live-reader
// window, and key-custody windows. One GroupCommitDiskDeltaLog directory.
// SchemaLogCodec stays the text form; this is the durable ZetaDB door.
//
// Named limits: EvolutionWindow still uses int reader versions (the shipped
// gate), not SchemaZ prefix-as-version. Grants expire by agreed phase, never
// wall-clock. No key material. Not live catalog overlap. Not multi-planet
// schema. Crash recovery stays toy.

/// Facts that share one host WAL with reverse-index ingest.
type ZetaDbFact =
    | Index of IndexFact
    | Schema of SchemaEvent
    | ReaderJoin of version: int
    | ReaderLeave of version: int
    | Custody of KeyCustody.CustodyEvent
    | OverlapOpen of id: string * line: string * start: int64 * span: int64
    | OverlapClose of id: string

[<RequireQualifiedAccess>]
module ZetaDbLog =

    let private typeName (t: DynamicValueType) : string =
        match t with
        | DynamicValueType.Null -> "null"
        | DynamicValueType.Bool -> "bool"
        | DynamicValueType.Int -> "int"
        | DynamicValueType.Float -> "float"
        | DynamicValueType.String -> "string"
        | DynamicValueType.Bytes -> "bytes"
        | DynamicValueType.Array -> "array"
        | DynamicValueType.Object -> "object"

    let private parseType (s: string) : DynamicValueType =
        match s with
        | "null" -> DynamicValueType.Null
        | "bool" -> DynamicValueType.Bool
        | "int" -> DynamicValueType.Int
        | "float" -> DynamicValueType.Float
        | "string" -> DynamicValueType.String
        | "bytes" -> DynamicValueType.Bytes
        | "array" -> DynamicValueType.Array
        | "object" -> DynamicValueType.Object
        | _ -> invalidArg (nameof s) "ZetaDbLog: unknown DynamicValueType."

    let private backendName (b: KeyStore.Backend) : string =
        match b with
        | KeyStore.LocalFile -> "local"
        | KeyStore.Vault -> "vault"
        | KeyStore.CloudKeyVault -> "cloud"
        | KeyStore.PasswordManager -> "pw"
        | KeyStore.HardwareEnclave -> "hw"
        | KeyStore.GitHubSecrets -> "gh"

    let private parseBackend (s: string) : KeyStore.Backend =
        match s with
        | "local" -> KeyStore.LocalFile
        | "vault" -> KeyStore.Vault
        | "cloud" -> KeyStore.CloudKeyVault
        | "pw" -> KeyStore.PasswordManager
        | "hw" -> KeyStore.HardwareEnclave
        | "gh" -> KeyStore.GitHubSecrets
        | _ -> invalidArg (nameof s) "ZetaDbLog: unknown KeyStore.Backend."

    let private encodeSchema (e: SchemaEvent) : DynamicValue =
        match e.Op with
        | AddField fid ->
            DynamicValue.Array
                [ DynamicValue.String "s"
                  DynamicValue.String e.EventId
                  DynamicValue.String "add"
                  DynamicValue.String fid.Name
                  DynamicValue.String(typeName fid.Type) ]
        | DropField fid ->
            DynamicValue.Array
                [ DynamicValue.String "s"
                  DynamicValue.String e.EventId
                  DynamicValue.String "drop"
                  DynamicValue.String fid.Name
                  DynamicValue.String(typeName fid.Type) ]
        | RenameField (fromName, toName, ty) ->
            DynamicValue.Array
                [ DynamicValue.String "s"
                  DynamicValue.String e.EventId
                  DynamicValue.String "rename"
                  DynamicValue.String fromName
                  DynamicValue.String toName
                  DynamicValue.String(typeName ty) ]
        | RetypeField (name, fromTy, toTy) ->
            DynamicValue.Array
                [ DynamicValue.String "s"
                  DynamicValue.String e.EventId
                  DynamicValue.String "retype"
                  DynamicValue.String name
                  DynamicValue.String(typeName fromTy)
                  DynamicValue.String(typeName toTy) ]

    let private decodeSchema (dv: DynamicValue) : SchemaEvent =
        match dv with
        | DynamicValue.Array [ DynamicValue.String "s"; DynamicValue.String id; DynamicValue.String "add"; DynamicValue.String n; DynamicValue.String t ] ->
            SchemaEvent.create id (AddField { Name = n; Type = parseType t })
        | DynamicValue.Array [ DynamicValue.String "s"; DynamicValue.String id; DynamicValue.String "drop"; DynamicValue.String n; DynamicValue.String t ] ->
            SchemaEvent.create id (DropField { Name = n; Type = parseType t })
        | DynamicValue.Array [ DynamicValue.String "s"; DynamicValue.String id; DynamicValue.String "rename"; DynamicValue.String a; DynamicValue.String b; DynamicValue.String t ] ->
            SchemaEvent.create id (RenameField(a, b, parseType t))
        | DynamicValue.Array [ DynamicValue.String "s"; DynamicValue.String id; DynamicValue.String "retype"; DynamicValue.String n; DynamicValue.String a; DynamicValue.String b ] ->
            SchemaEvent.create id (RetypeField(n, parseType a, parseType b))
        | _ -> invalidArg (nameof dv) "ZetaDbLog.decodeSchema: unknown SchemaEvent encoding."

    let private encodeCustody (ev: KeyCustody.CustodyEvent) : DynamicValue =
        match ev with
        | KeyCustody.KeyringOpened (p, a, line, r) ->
            DynamicValue.Array
                [ DynamicValue.String "k"
                  DynamicValue.String "open"
                  DynamicValue.String p
                  DynamicValue.String a
                  DynamicValue.String line
                  DynamicValue.String(backendName r.Backend)
                  DynamicValue.String r.Handle ]
        | KeyCustody.NextPublished (p, a, r) ->
            DynamicValue.Array
                [ DynamicValue.String "k"
                  DynamicValue.String "next"
                  DynamicValue.String p
                  DynamicValue.String a
                  DynamicValue.String(backendName r.Backend)
                  DynamicValue.String r.Handle ]
        | KeyCustody.Rotated (p, a, at, span) ->
            DynamicValue.Array
                [ DynamicValue.String "k"
                  DynamicValue.String "rot"
                  DynamicValue.String p
                  DynamicValue.String a
                  DynamicValue.Int at.Version
                  DynamicValue.Int span ]
        | KeyCustody.PreviousRetracted (p, a) ->
            DynamicValue.Array
                [ DynamicValue.String "k"
                  DynamicValue.String "prevx"
                  DynamicValue.String p
                  DynamicValue.String a ]
        | KeyCustody.GrantIssued g ->
            DynamicValue.Array
                [ DynamicValue.String "k"
                  DynamicValue.String "grant"
                  DynamicValue.String g.Principal
                  DynamicValue.String g.Authority
                  DynamicValue.String(KeyCustody.windowLine g.Window)
                  DynamicValue.Int((KeyCustody.windowStart g.Window).Version)
                  DynamicValue.Int(KeyCustody.windowSpan g.Window) ]
        | KeyCustody.GrantRetracted (p, auth) ->
            DynamicValue.Array
                [ DynamicValue.String "k"
                  DynamicValue.String "grantx"
                  DynamicValue.String p
                  DynamicValue.String auth ]

    let private decodeCustody (dv: DynamicValue) : KeyCustody.CustodyEvent =
        match dv with
        | DynamicValue.Array [ DynamicValue.String "k"; DynamicValue.String "open"; DynamicValue.String p; DynamicValue.String a; DynamicValue.String line; DynamicValue.String b; DynamicValue.String h ] ->
            let kr: KeyStore.KeyRef = { Backend = parseBackend b; Handle = h }
            KeyCustody.KeyringOpened(p, a, line, kr)
        | DynamicValue.Array [ DynamicValue.String "k"; DynamicValue.String "next"; DynamicValue.String p; DynamicValue.String a; DynamicValue.String b; DynamicValue.String h ] ->
            let kr: KeyStore.KeyRef = { Backend = parseBackend b; Handle = h }
            KeyCustody.NextPublished(p, a, kr)
        | DynamicValue.Array [ DynamicValue.String "k"; DynamicValue.String "rot"; DynamicValue.String p; DynamicValue.String a; DynamicValue.Int at; DynamicValue.Int span ] ->
            KeyCustody.Rotated(p, a, Versionstamp.ofInt64 at, span)
        | DynamicValue.Array [ DynamicValue.String "k"; DynamicValue.String "prevx"; DynamicValue.String p; DynamicValue.String a ] ->
            KeyCustody.PreviousRetracted(p, a)
        | DynamicValue.Array [ DynamicValue.String "k"; DynamicValue.String "grant"; DynamicValue.String p; DynamicValue.String auth; DynamicValue.String line; DynamicValue.Int start; DynamicValue.Int span ] ->
            match KeyCustody.tryIssue line p auth (Versionstamp.ofInt64 start) span with
            | Ok g -> KeyCustody.GrantIssued g
            | Error e ->
                invalidArg (nameof dv) (sprintf "ZetaDbLog.decodeCustody: grant window refused (%A)." e)
        | DynamicValue.Array [ DynamicValue.String "k"; DynamicValue.String "grantx"; DynamicValue.String p; DynamicValue.String auth ] ->
            KeyCustody.GrantRetracted(p, auth)
        | _ -> invalidArg (nameof dv) "ZetaDbLog.decodeCustody: unknown CustodyEvent encoding."

    let encodeFact (k: ZetaDbFact) : DynamicValue =
        match k with
        | ZetaDbFact.Index f -> ReverseIndex.encodeFact f
        | ZetaDbFact.Schema e -> encodeSchema e
        | ZetaDbFact.ReaderJoin v ->
            DynamicValue.Array [ DynamicValue.String "rj"; DynamicValue.Int(int64 v) ]
        | ZetaDbFact.ReaderLeave v ->
            DynamicValue.Array [ DynamicValue.String "rl"; DynamicValue.Int(int64 v) ]
        | ZetaDbFact.Custody ev -> encodeCustody ev
        | ZetaDbFact.OverlapOpen (id, line, start, span) ->
            DynamicValue.Array
                [ DynamicValue.String "o"
                  DynamicValue.String "open"
                  DynamicValue.String id
                  DynamicValue.String line
                  DynamicValue.Int start
                  DynamicValue.Int span ]
        | ZetaDbFact.OverlapClose id ->
            DynamicValue.Array [ DynamicValue.String "o"; DynamicValue.String "close"; DynamicValue.String id ]

    let decodeFact (dv: DynamicValue) : ZetaDbFact =
        match dv with
        | DynamicValue.Array (DynamicValue.String "e" :: _)
        | DynamicValue.Array (DynamicValue.String "c" :: _)
        | DynamicValue.Array (DynamicValue.String "p" :: _) ->
            ZetaDbFact.Index(ReverseIndex.decodeFact dv)
        | DynamicValue.Array (DynamicValue.String "s" :: _) ->
            ZetaDbFact.Schema(decodeSchema dv)
        | DynamicValue.Array [ DynamicValue.String "rj"; DynamicValue.Int v ] ->
            ZetaDbFact.ReaderJoin(int v)
        | DynamicValue.Array [ DynamicValue.String "rl"; DynamicValue.Int v ] ->
            ZetaDbFact.ReaderLeave(int v)
        | DynamicValue.Array (DynamicValue.String "k" :: _) ->
            ZetaDbFact.Custody(decodeCustody dv)
        | DynamicValue.Array [ DynamicValue.String "o"; DynamicValue.String "open"; DynamicValue.String id; DynamicValue.String line; DynamicValue.Int start; DynamicValue.Int span ] ->
            ZetaDbFact.OverlapOpen(id, line, start, span)
        | DynamicValue.Array [ DynamicValue.String "o"; DynamicValue.String "close"; DynamicValue.String id ] ->
            ZetaDbFact.OverlapClose id
        | _ -> invalidArg (nameof dv) "ZetaDbLog.decodeFact: unknown ZetaDbFact encoding."

    let codec: IEntryCodec<ZetaDbFact> =
        CborEntryCodec<ZetaDbFact>(encodeFact, decodeFact)

    let append (log: IDeltaLog<ZetaDbFact>) (delta: ZSet<ZetaDbFact>) (ct: CancellationToken) : Task<int64> =
        log.AppendAsync(delta, Map.empty, ct).AsTask()

    let replayInto
        (log: IDeltaLog<ZetaDbFact>)
        (citedBy: CitedByIndex)
        (search: SearchIndex)
        (ct: CancellationToken)
        : Task<struct (SchemaZ * EvolutionWindow.Window * KeyCustody.Custody * OverlapRotator.State)> =
        task {
            let mutable schema = SchemaZ.empty
            let mutable readers = EvolutionWindow.empty
            let mutable custody = KeyCustody.emptyCustody
            let mutable overlap = OverlapRotator.empty
            let! entries = log.ReplayAsync(0L, ct).AsTask()
            for e in entries do
                for row in e.Delta do
                    match row.Key with
                    | ZetaDbFact.Index (IndexFact.Entity id) ->
                        citedBy.SendEntities(ZSet.singleton id row.Weight)
                    | ZetaDbFact.Index (IndexFact.Cite r) ->
                        citedBy.SendReferences(ZSet.singleton r row.Weight)
                    | ZetaDbFact.Index (IndexFact.Posting p) ->
                        search.SendPostings(ZSet.singleton p row.Weight)
                    | ZetaDbFact.Schema ev ->
                        schema <- SchemaZ.applyDelta (SchemaEvent.delta ev) schema
                    | ZetaDbFact.ReaderJoin v ->
                        readers <- EvolutionWindow.readerJoins v readers
                    | ZetaDbFact.ReaderLeave v ->
                        readers <- EvolutionWindow.readerLeaves v readers
                    | ZetaDbFact.Custody ev ->
                        custody <- KeyCustody.applyEvent custody ev
                    | ZetaDbFact.OverlapOpen (id, line, start, span) ->
                        if row.Weight < 0L then
                            overlap <- OverlapRotator.close id overlap
                        else
                            match OverlapRotator.tryOpen id line (Versionstamp.ofInt64 start) span overlap with
                            | Ok s -> overlap <- s
                            | Error err ->
                                invalidArg (nameof log) (sprintf "ZetaDbLog.replayInto: overlap open refused (%A)." err)
                    | ZetaDbFact.OverlapClose id ->
                        overlap <- OverlapRotator.close id overlap
                do! citedBy.StepAsync()
                do! search.StepAsync()
            return struct (schema, readers, custody, overlap)
        }
