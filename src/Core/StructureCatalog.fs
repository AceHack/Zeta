namespace Zeta.Core


/// Shape-indexed catalog for querying structures by fingerprint.
///
/// A `StructureCatalog` maps `StructureFingerprint.Shape` values
/// to collections of entries, enabling query-by-shape and
/// query-by-similarity without relying on labels.
///
/// This is the second child (081KR2E4K0008QG0R000Z7EM4Y) of the structure recognizer
/// (081KQZVQW0008QG0R002QZAFB2). It consumes the fingerprint library from 081KR2E4K0008QG0R0031E5PR8.
[<RequireQualifiedAccess>]
module StructureCatalog =

    /// A catalog entry: a named structure plus its fingerprint.
    type Entry<'N when 'N: comparison> =
        { Id: string
          Graph: Graph<'N>
          Fingerprint: StructureFingerprint.Fingerprint }

    /// A shape-indexed catalog. Entries are grouped by their
    /// classified shape for O(1) shape-exact lookups.
    type Catalog<'N when 'N: comparison> =
        { ByShape: Map<StructureFingerprint.Shape, Entry<'N> list> }

    /// An empty catalog.
    let empty<'N when 'N: comparison> : Catalog<'N> =
        { ByShape = Map.empty }

    /// Add a graph to the catalog under the given id.
    let add (id: string) (graph: Graph<'N>) (catalog: Catalog<'N>) : Catalog<'N> =
        let fp = StructureFingerprint.fingerprint graph
        let entry = { Id = id; Graph = graph; Fingerprint = fp }
        let existing =
            catalog.ByShape
            |> Map.tryFind fp.Shape
            |> Option.defaultValue []
        { ByShape = catalog.ByShape |> Map.add fp.Shape (entry :: existing) }

    /// Query all entries with an exact shape match.
    let queryByShape
        (shape: StructureFingerprint.Shape)
        (catalog: Catalog<'N>)
        : Entry<'N> list =
        catalog.ByShape
        |> Map.tryFind shape
        |> Option.defaultValue []

    /// Query entries whose fingerprint similarity to the probe
    /// meets or exceeds the given threshold.
    let queryBySimilarity
        (probe: StructureFingerprint.Fingerprint)
        (threshold: float)
        (catalog: Catalog<'N>)
        : (Entry<'N> * float) list =
        catalog.ByShape
        |> Map.toList
        |> List.collect (fun (_shape, entries) ->
            entries
            |> List.choose (fun entry ->
                let sim = StructureFingerprint.similarity probe entry.Fingerprint
                if sim >= threshold then Some(entry, sim) else None))
        |> List.sortByDescending snd

    /// Total number of entries in the catalog.
    let count (catalog: Catalog<'N>) : int =
        catalog.ByShape
        |> Map.toList
        |> List.sumBy (fun (_shape, entries) -> List.length entries)
