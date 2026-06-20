namespace Zeta.Core

/// **`GraphSnapshot` — content-addressed MerkleFS persistence for the reified graphs (Aaron 2026-06-19, shadow\*).**
///
/// Closes the cache → durable-snapshot loop: a reified `CoEmpowerGraph.Graph` (the unified target both the IMDb
/// co-star leg and the Wikidata entity leg project to) is serialized to a **deterministic canonical JSON** blob
/// and stored in a **content-addressed store** (`ContentStore`, the primitive under `CasStore`/MerkleFS) — so a
/// snapshot is **hash-addressed, dedup'd, and content-equal ⇒ hash-equal** (same graph ⇒ same `MerkleHash`).
///
/// **Format choice:** canonical JSON (via `DynamicValue.toCanonicalJson`, whose proven inverse is
/// `fromCanonicalJson`) — deterministic, round-trippable, and **git-diffable** (the most git-native option; it
/// also sidesteps `no-binary-in-proof-lineage` entirely since the blob is text). Arrow/Parquet/CBOR remain
/// available alternatives for large fixtures (data snapshots may be binary; only verification golden vectors
/// must stay text). DST-clean: serialization is pure; the hash is `XxHash128` of the UTF-8 bytes.
[<RequireQualifiedAccess>]
module GraphSnapshot =

    let private asInt =
        function
        | DynamicValue.Int i -> Some(int i)
        | _ -> None

    let private asArray =
        function
        | DynamicValue.Array a -> Some a
        | _ -> None

    let private field (k: string) (dv: DynamicValue) : DynamicValue option =
        match dv with
        | DynamicValue.Object kvs -> kvs |> List.tryPick (fun (kk, v) -> if kk = k then Some v else None)
        | _ -> None

    /// Encode a graph as a `DynamicValue` record: `n`, `identity[]`, `adjacency[][]`, `role[]` (0=Creator, 1=Audience).
    let toDynamicValue (g: CoEmpowerGraph.Graph) : DynamicValue =
        DynamicValue.Object
            [ "n", DynamicValue.Int(int64 g.N)
              "identity", DynamicValue.Array [ for x in g.Identity -> DynamicValue.Int(int64 x) ]
              "adjacency",
              DynamicValue.Array
                  [ for row in g.Adjacency -> DynamicValue.Array [ for v in row -> DynamicValue.Int(int64 v) ] ]
              "role",
              DynamicValue.Array
                  [ for r in g.Role ->
                        DynamicValue.Int(
                            match r with
                            | CoEmpowerGraph.Creator -> 0L
                            | CoEmpowerGraph.Audience -> 1L
                        ) ] ]

    /// Decode a graph from its `DynamicValue` form (order-independent; validates lengths against `n`).
    let ofDynamicValue (dv: DynamicValue) : Result<CoEmpowerGraph.Graph, string> =
        match
            field "n" dv |> Option.bind asInt,
            field "identity" dv |> Option.bind asArray,
            field "adjacency" dv |> Option.bind asArray,
            field "role" dv |> Option.bind asArray
        with
        | Some n, Some idDv, Some adjDv, Some roleDv ->
            let identity = idDv |> List.choose asInt |> List.toArray

            let adjacency =
                adjDv
                |> List.choose asArray
                |> List.map (fun row -> row |> List.choose asInt |> List.toArray)
                |> List.toArray

            let role =
                roleDv
                |> List.choose asInt
                |> List.map (fun i -> if i = 0 then CoEmpowerGraph.Creator else CoEmpowerGraph.Audience)
                |> List.toArray

            if identity.Length = n && adjacency.Length = n && role.Length = n then
                Ok
                    { CoEmpowerGraph.N = n
                      CoEmpowerGraph.Identity = identity
                      CoEmpowerGraph.Adjacency = adjacency
                      CoEmpowerGraph.Role = role }
            else
                Error "GraphSnapshot.ofDynamicValue: array length ≠ n"
        | _ -> Error "GraphSnapshot.ofDynamicValue: missing or mistyped fields"

    /// Serialize a graph to its canonical-JSON snapshot blob.
    let serialize (g: CoEmpowerGraph.Graph) : Result<string, string> =
        DynamicValue.toCanonicalJson (toDynamicValue g) |> Result.mapError (sprintf "%A")

    /// Deserialize a snapshot blob back to a graph.
    let deserialize (json: string) : Result<CoEmpowerGraph.Graph, string> =
        DynamicValue.fromCanonicalJson json |> Result.mapError (sprintf "%A") |> Result.bind ofDynamicValue

    let private hashBytes: byte[] -> MerkleHash = ContentHasher.hashOf ContentHasher.defaultHasher
    let private hashOf (s: string) : MerkleHash = hashBytes (System.Text.Encoding.UTF8.GetBytes s)

    /// An empty content-addressed snapshot store (blobs keyed by the `XxHash128` of their canonical JSON).
    let emptyStore () : ContentStore.Store<string> = ContentStore.create hashOf

    /// Persist a graph: serialize → content-address. Returns the `MerkleHash` + the updated store (same graph ⇒
    /// same hash ⇒ dedup'd).
    let store (g: CoEmpowerGraph.Graph) (s: ContentStore.Store<string>) : Result<MerkleHash * ContentStore.Store<string>, string> =
        serialize g |> Result.map (fun json -> ContentStore.put json s)

    /// Load a graph by its content hash (`None` if absent; `Some (Error …)` if the blob is corrupt).
    let load (h: MerkleHash) (s: ContentStore.Store<string>) : Result<CoEmpowerGraph.Graph, string> option =
        ContentStore.get h s |> Option.map deserialize
