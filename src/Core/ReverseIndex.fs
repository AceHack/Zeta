namespace Zeta.Core

open System
open System.Collections.Generic
open System.IO
open System.Text
open System.Threading
open System.Threading.Tasks

// Reverse indexes as IncrementalJoin materialized views on the host log.
//
// Aaron 2026-09-11: git-native jsonl on main is a toy and costs tens of MB
// per rebuild in a full-history repo. The durable form is GroupCommitDiskDeltaLog
// on a host directory. The view is IncrementalJoin, not a committed shard.
//
// Two instances, one algebra:
//   cited-by  = entities ⋈ references   on Target   (agent fairness inbound)
//   search    = queryTerms ⋈ postings   on Term     (document reverse index)
//
// Beacon: Manning, Raghavan & Schütze, Introduction to IR (CUP 2008) ch. 1–2
// (inverted index); Shepard 1873 / Garfield SCI (cited-by); Budiu et al. VLDB
// 2023 (bilinear IncrementalJoin). The TS git-rev jsonl builder remains a
// local cache and must not flush to main.

/// A typed citation edge. `Target` is who was referenced.
[<Struct>]
type Reference =
    { From: string
      Target: string
      Relation: string }

/// One inbound cite, the reverse of `Reference`.
[<Struct>]
type CitedBy =
    { Target: string
      From: string
      Relation: string }

/// One term occurrence in one document. Weight in the Z-set is presence (1).
[<Struct>]
type TermPosting =
    { Term: string
      Doc: string }

/// A search hit: query term joined to a posting.
[<Struct>]
type SearchHit =
    { Term: string
      Doc: string }

/// Facts that ride the reverse-index WAL. Query terms are standing-query
/// state, not logged — they are local to a subscriber. Not a struct DU:
/// cases wrap different record types (F# FS3585).
type IndexFact =
    | Entity of entityId: string
    | Cite of Reference
    | Posting of TermPosting

[<RequireQualifiedAccess>]
module ReverseIndex =

    /// ASCII-only fold, codepoint arithmetic. Not `ToLowerInvariant`: that
    /// table can move under a runtime upgrade (same reason as the TS tokenizer).
    let asciiFold (text: string) : string =
        if String.IsNullOrEmpty text then
            text
        else
            let chars = text.ToCharArray()
            for i in 0 .. chars.Length - 1 do
                let c = chars.[i]
                if c >= 'A' && c <= 'Z' then
                    chars.[i] <- char (int c + 32)
            String chars

    /// Small English stop list (MRS 2008 §2.2.2, trimmed). Phrase search is a
    /// different index (positions). Ordinal membership.
    let stopWords: string[] =
        [| "an"; "and"; "are"; "as"; "at"; "be"; "but"; "by"; "can"; "do"
           "does"; "from"; "had"; "has"; "have"; "into"; "is"; "it"; "its"
           "of"; "or"; "that"; "the"; "their"; "them"; "then"; "there"
           "these"; "they"; "this"; "those"; "to"; "was"; "were"; "will"
           "with"; "would" |]

    let private stopSet =
        HashSet<string>(stopWords, StringComparer.Ordinal)

    let isStopWord (term: string) : bool =
        stopSet.Contains term

    let private isTokenChar (c: char) : bool =
        (c >= '0' && c <= '9')
        || (c >= 'A' && c <= 'Z')
        || (c >= 'a' && c <= 'z')
        || c = '_'

    /// Tokenize to unique terms, length 2..64, stop words dropped.
    /// Separators = everything that is not `[0-9A-Za-z_]`. Named limit: no CJK
    /// segmenter, no positions. Culture-invariant by construction.
    let tokenize (text: string) : string[] =
        if String.IsNullOrEmpty text then
            Array.empty
        else
            let folded = asciiFold text
            let acc = HashSet<string>(StringComparer.Ordinal)
            let buf = StringBuilder()
            let flush () =
                if buf.Length >= 2 && buf.Length <= 64 then
                    let t = buf.ToString()
                    if not (stopSet.Contains t) then
                        acc.Add t |> ignore
                buf.Clear() |> ignore
            for i in 0 .. folded.Length - 1 do
                let c = folded.[i]
                if isTokenChar c then
                    buf.Append c |> ignore
                else
                    flush ()
            flush ()
            let arr = Array.zeroCreate acc.Count
            acc.CopyTo arr
            Array.Sort(arr, StringComparer.Ordinal)
            arr

    let postings (docId: string) (text: string) : ZSet<TermPosting> =
        tokenize text
        |> Seq.map (fun t -> { TermPosting.Term = t; Doc = docId })
        |> ZSet.ofSet

    let retractPostings (docId: string) (text: string) : ZSet<TermPosting> =
        ZSet.neg (postings docId text)

    /// CBOR whole-entry codec for `IndexFact` on GroupCommitDiskDeltaLog.
    let encodeFact (k: IndexFact) : DynamicValue =
        match k with
        | IndexFact.Entity id ->
            DynamicValue.Array [ DynamicValue.String "e"; DynamicValue.String id ]
        | IndexFact.Cite r ->
            DynamicValue.Array
                [ DynamicValue.String "c"
                  DynamicValue.String r.From
                  DynamicValue.String r.Target
                  DynamicValue.String r.Relation ]
        | IndexFact.Posting p ->
            DynamicValue.Array
                [ DynamicValue.String "p"
                  DynamicValue.String p.Term
                  DynamicValue.String p.Doc ]

    let decodeFact (dv: DynamicValue) : IndexFact =
        match dv with
        | DynamicValue.Array [ DynamicValue.String "e"; DynamicValue.String id ] ->
            IndexFact.Entity id
        | DynamicValue.Array [ DynamicValue.String "c"; DynamicValue.String f; DynamicValue.String t; DynamicValue.String rel ] ->
            IndexFact.Cite { From = f; Target = t; Relation = rel }
        | DynamicValue.Array [ DynamicValue.String "p"; DynamicValue.String term; DynamicValue.String doc ] ->
            IndexFact.Posting { Term = term; Doc = doc }
        | _ ->
            invalidArg (nameof dv) "ReverseIndex.decodeFact: unknown IndexFact encoding."

    let codec: IEntryCodec<IndexFact> =
        CborEntryCodec<IndexFact>(encodeFact, decodeFact)

/// Standing cited-by view: IncrementalJoin(entities, references) on Target.
/// Stream ⋈ stream is retroactive — a cite that arrives before the entity
/// still lands when the entity is asserted. That is the fairness property.
[<Sealed>]
type CitedByIndex() =
    let circuit = Circuit.create ()
    let entities = circuit.ZSetInput<string>()
    let refs = circuit.ZSetInput<Reference>()
    let joined =
        circuit.IncrementalJoin(
            entities.Stream,
            refs.Stream,
            Func<string, string>(id),
            Func<Reference, string>(fun r -> r.Target),
            Func<string, Reference, CitedBy>(fun target r ->
                { Target = target
                  From = r.From
                  Relation = r.Relation }))
    let view = circuit.IntegrateZSet joined
    let output = circuit.Output view

    member _.SendEntities(delta: ZSet<string>) : unit = entities.Send delta
    member _.SendReferences(delta: ZSet<Reference>) : unit = refs.Send delta
    member _.StepAsync() : Task = circuit.StepAsync()
    member _.Current: ZSet<CitedBy> = output.Current

/// Standing search: IncrementalJoin(queryTerms, postings) on Term.
/// A document that arrives after the query still hits (retroactive join).
[<Sealed>]
type SearchIndex() =
    let circuit = Circuit.create ()
    let query = circuit.ZSetInput<string>()
    let posts = circuit.ZSetInput<TermPosting>()
    let joined =
        circuit.IncrementalJoin(
            query.Stream,
            posts.Stream,
            Func<string, string>(id),
            Func<TermPosting, string>(fun p -> p.Term),
            Func<string, TermPosting, SearchHit>(fun term p ->
                { Term = term; Doc = p.Doc }))
    let view = circuit.IntegrateZSet joined
    let output = circuit.Output view

    member _.SendQuery(delta: ZSet<string>) : unit = query.Send delta
    member _.SendPostings(delta: ZSet<TermPosting>) : unit = posts.Send delta
    member _.StepAsync() : Task = circuit.StepAsync()
    member _.Current: ZSet<SearchHit> = output.Current

[<RequireQualifiedAccess>]
module ReverseIndexLog =

    let append (log: IDeltaLog<IndexFact>) (delta: ZSet<IndexFact>) (ct: CancellationToken) : Task<int64> =
        log.AppendAsync(delta, Map.empty, ct).AsTask()

    /// Replay the WAL into both views. Query terms stay with the subscriber.
    let replayInto
        (log: IDeltaLog<IndexFact>)
        (citedBy: CitedByIndex)
        (search: SearchIndex)
        (ct: CancellationToken)
        : Task =
        task {
            let! entries = log.ReplayAsync(0L, ct).AsTask()
            for e in entries do
                for row in e.Delta do
                    match row.Key with
                    | IndexFact.Entity id ->
                        citedBy.SendEntities(ZSet.singleton id row.Weight)
                    | IndexFact.Cite r ->
                        citedBy.SendReferences(ZSet.singleton r row.Weight)
                    | IndexFact.Posting p ->
                        search.SendPostings(ZSet.singleton p row.Weight)
                do! citedBy.StepAsync()
                do! search.StepAsync()
        }

/// Corpus policy ported from `src/Core.TypeScript/search/inverted/format.ts`.
/// Allowlist, not denylist. Each excluded tree carries a measurement — an
/// exclusion without a number is folklore (the prior-art-mirror miss).
[<Struct>]
type ExcludedTree =
    { Prefix: string
      Measurement: string }

[<Struct>]
type IngestReport =
    { FilesIndexed: int
      PostingsAppended: int
      SkippedNotIndexable: int
      SkippedOversize: int
      SkippedBinary: int
      SkippedMissing: int }

[<RequireQualifiedAccess>]
module ReverseIndexCorpus =

    /// Blobs larger than this are skipped. Same cap as the TS builder.
    [<Literal>]
    let MaxBlobBytes = 512 * 1024

    let indexedExtensions: string[] =
        [| "bicep"; "c"; "cfg"; "cjs"; "conf"; "cpp"; "cs"; "css"; "csproj"
           "csx"; "editorconfig"; "env"; "fs"; "fsi"; "fsproj"; "fsx"; "go"
           "gradle"; "graphql"; "h"; "hpp"; "hs"; "html"; "ini"; "java"; "js"
           "json"; "jsonc"; "jsonl"; "kt"; "lean"; "lock"; "md"; "mjs"; "nix"
           "php"; "props"; "proto"; "ps1"; "py"; "rb"; "rs"; "scala"; "sh"
           "sql"; "svg"; "swift"; "targets"; "tf"; "tla"; "toml"; "ts"; "tsx"
           "txt"; "vue"; "wat"; "xml"; "yaml"; "yml"; "zig" |]

    /// Extensionless (or odd) names worth indexing, matched on basename.
    let indexedBasenames: string[] =
        [| "AGENTS.md"; "CLAUDE.md"; "Dockerfile"; "GOVERNANCE.md"; "Makefile"; "README" |]

    let excludedTrees: ExcludedTree[] =
        [| { Prefix = "docs/github/prs/"
             Measurement =
               "9,652 files / 10.53 MiB at 6426eacf (2026-08-23) — machine-generated PR-mirror JSON shards. Indexing them roughly doubles the postings for content nobody searches by term; the PR mirror has its own manifest.jsonl lookup." }
           { Prefix = "references/"
             Measurement =
               "13 tracked files / 1.84 MiB at 6426eacf, but the directory is the mount point for the gitignored multi-gigabyte prior-art mirror (CLAUDE.md: 'a naive grep -r . is a 2-hour runaway'). Excluded so a checkout that HAS the mirror indexes the same corpus as one that does not — otherwise the artifact stops being a function of the rev." }
           { Prefix = "db/search-index/"
             Measurement =
               "the index's OWN OUTPUT — 54.96 MiB / 40 files at 01050c8b. Caught 2026-08-23: 7 of its own files sit UNDER the 512 KiB blob cap, so the next rebuild would have indexed the previous rebuild. A feedback loop, not a corpus." }
           { Prefix = "node_modules/"
             Measurement =
               "not tracked in git at 6426eacf, so this excludes nothing today. Kept because a vendored dependency tree is the classic way an index silently triples, and the cost of the guard is one string comparison." }
           { Prefix = ".git/"
             Measurement =
               "host walk is not git ls-files; a checkout .git/objects pack is hundreds of MB (often > 200 MB) and is not a document. The TS builder never sees it because it lists git-tracked blobs only." } |]

    let private extSet =
        HashSet<string>(indexedExtensions, StringComparer.Ordinal)

    let private basenameSet =
        HashSet<string>(indexedBasenames, StringComparer.Ordinal)

    let slashNormalize (path: string) : string =
        if isNull path then
            ""
        else
            path.Replace('\\', '/')

    let basenameOf (path: string) : string =
        let p = slashNormalize path
        let slash = p.LastIndexOf '/'
        if slash < 0 then p else p.Substring(slash + 1)

    /// TS `extensionOf`: last dot in the basename, empty when the dot is at 0.
    /// Not lowercased — the allowlist is lowercase, so `Note.MD` is not indexed.
    let extensionOf (path: string) : string =
        let baseName = basenameOf path
        let dot = baseName.LastIndexOf '.'
        if dot <= 0 then "" else baseName.Substring(dot + 1)

    let isExcluded (path: string) : bool =
        let p = slashNormalize path
        let rec loop i =
            if i >= excludedTrees.Length then
                false
            else
                let prefix = excludedTrees.[i].Prefix
                if p.StartsWith(prefix, StringComparison.Ordinal) then
                    true
                elif p.IndexOf("/" + prefix, StringComparison.Ordinal) >= 0 then
                    true
                else
                    loop (i + 1)
        loop 0

    /// Path-only predicate. Size and NUL are checked at ingest.
    let isIndexablePath (path: string) : bool =
        if isExcluded path then
            false
        elif basenameSet.Contains(basenameOf path) then
            true
        else
            extSet.Contains(extensionOf path)

    let toDocId (root: string) (path: string) : string =
        let r = (slashNormalize root).TrimEnd '/'
        let p = slashNormalize path
        if
            p.Length > r.Length
            && p.StartsWith(r, StringComparison.Ordinal)
            && p.[r.Length] = '/'
        then
            p.Substring(r.Length + 1)
        elif String.Equals(p, r, StringComparison.Ordinal) then
            String.Empty
        else
            p.TrimStart '/'

    let isUnderRoot (root: string) (path: string) : bool =
        let r = (slashNormalize root).TrimEnd '/'
        let p = slashNormalize path
        String.Equals(p, r, StringComparison.Ordinal)
        || p.StartsWith(r + "/", StringComparison.Ordinal)

[<RequireQualifiedAccess>]
module ReverseIndexIngest =

    let private hasNul (bytes: byte[]) : bool =
        Array.IndexOf(bytes, 0uy) >= 0

    /// Host-tree listing. Not `git ls-files`. Skips descending into excluded
    /// prefixes. Sort is by slash-normalized relative doc id (ordinal).
    let listHostFiles (root: string) : string[] =
        let rootFull = Path.GetFullPath root
        if not (Directory.Exists rootFull) then
            Array.empty
        else
            let acc = ResizeArray<string>()
            let rec walk (dir: string) =
                let rel = ReverseIndexCorpus.toDocId rootFull dir
                let asPrefix =
                    if String.IsNullOrEmpty rel then
                        ""
                    else
                        rel.TrimEnd('/') + "/"
                if asPrefix <> "" && ReverseIndexCorpus.isExcluded asPrefix then
                    ()
                else
                    for f in Directory.GetFiles dir do
                        acc.Add f
                    for d in Directory.GetDirectories dir do
                        walk d
            walk rootFull
            acc.ToArray()
            |> Array.sortWith (fun a b ->
                StringComparer.Ordinal.Compare(
                    ReverseIndexCorpus.toDocId rootFull a,
                    ReverseIndexCorpus.toDocId rootFull b))

    let ingestPaths
        (fs: IFileSystem)
        (root: string)
        (paths: string[])
        (log: IDeltaLog<IndexFact>)
        (ct: CancellationToken)
        : Task<IngestReport> =
        task {
            let mutable indexed = 0
            let mutable postings = 0
            let mutable skipNot = 0
            let mutable skipOver = 0
            let mutable skipBin = 0
            let mutable skipMiss = 0
            let ordered =
                paths
                |> Array.sortWith (fun a b ->
                    StringComparer.Ordinal.Compare(
                        ReverseIndexCorpus.slashNormalize a,
                        ReverseIndexCorpus.slashNormalize b))
            for path in ordered do
                ct.ThrowIfCancellationRequested()
                if not (ReverseIndexCorpus.isUnderRoot root path) then
                    skipNot <- skipNot + 1
                else
                    let docId = ReverseIndexCorpus.toDocId root path
                    if
                        String.IsNullOrEmpty docId
                        || not (ReverseIndexCorpus.isIndexablePath docId)
                    then
                        skipNot <- skipNot + 1
                    elif not (fs.Exists path) then
                        skipMiss <- skipMiss + 1
                    else
                        match FileSystemIo.tryReadBytesCapped fs (int64 ReverseIndexCorpus.MaxBlobBytes) path with
                        | None -> skipOver <- skipOver + 1
                        | Some bytes when hasNul bytes -> skipBin <- skipBin + 1
                        | Some bytes ->
                            let text = Encoding.UTF8.GetString bytes
                            let posts = ReverseIndex.postings docId text
                            let n = ZSet.count posts
                            if n > 0 then
                                let facts = ZSet.map IndexFact.Posting posts
                                let! _ = ReverseIndexLog.append log facts ct
                                postings <- postings + n
                            indexed <- indexed + 1
            return
                { FilesIndexed = indexed
                  PostingsAppended = postings
                  SkippedNotIndexable = skipNot
                  SkippedOversize = skipOver
                  SkippedBinary = skipBin
                  SkippedMissing = skipMiss }
        }

    /// Walk a host directory and append postings. Does not take
    /// `FileSystem.Current` for the walk — listing is `System.IO` so it
    /// recurses (Physical `GetFiles` is one-level). Reads go through
    /// `PhysicalFileSystem`.
    let ingestHostDirectory
        (root: string)
        (log: IDeltaLog<IndexFact>)
        (ct: CancellationToken)
        : Task<IngestReport> =
        let rootFull = Path.GetFullPath root
        let fs = PhysicalFileSystem() :> IFileSystem
        ingestPaths fs rootFull (listHostFiles rootFull) log ct

