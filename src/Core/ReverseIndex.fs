namespace Zeta.Core

open System
open System.Collections.Generic
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
