[<global.Xunit.Collection("ZetaFsAmbientFileSystem")>]
module Zeta.Tests.Circuit.ReverseIndexTests

open System
open System.IO
open System.Threading
open System.Threading.Tasks
open FsUnit.Xunit
open global.Xunit
open Zeta.Core
open Zeta.Tests.Support


let private ct = CancellationToken.None

let private cite fromId target rel : Reference =
    { From = fromId; Target = target; Relation = rel }

[<Fact>]
let ``tokenize drops stop words, folds ASCII, keeps identifiers`` () =
    ReverseIndex.tokenize "The ZetaId and HELLO, world!"
    |> should equal [| "hello"; "world"; "zetaid" |]
    ReverseIndex.isStopWord "the" |> should equal true
    ReverseIndex.isStopWord "zeta" |> should equal false


[<Fact>]
let ``cite after entity materializes cited-by via IncrementalJoin`` () =
    task {
        let idx = CitedByIndex()
        idx.SendEntities(ZSet.singleton "B" 1L)
        do! idx.StepAsync()
        idx.SendReferences(ZSet.singleton (cite "A" "B" "reviews") 1L)
        do! idx.StepAsync()
        idx.Current
        |> should equal (ZSet.singleton { Target = "B"; From = "A"; Relation = "reviews" } 1L)
    }


[<Fact>]
let ``cite BEFORE entity still lands — IncrementalJoin is retroactive`` () =
    // Falsifier: a plain Join on this tick's deltas misses this. Fairness
    // requires B to see cites that arrived before B was asserted.
    task {
        let idx = CitedByIndex()
        idx.SendReferences(ZSet.singleton (cite "A" "B" "contradicts") 1L)
        do! idx.StepAsync()
        idx.Current.IsEmpty |> should equal true
        idx.SendEntities(ZSet.singleton "B" 1L)
        do! idx.StepAsync()
        idx.Current
        |> should equal (ZSet.singleton { Target = "B"; From = "A"; Relation = "contradicts" } 1L)
    }


[<Fact>]
let ``retracting a cite retracts cited-by`` () =
    task {
        let idx = CitedByIndex()
        let r = cite "A" "B" "reviews"
        idx.SendEntities(ZSet.singleton "B" 1L)
        idx.SendReferences(ZSet.singleton r 1L)
        do! idx.StepAsync()
        idx.SendReferences(ZSet.singleton r -1L)
        do! idx.StepAsync()
        idx.Current.IsEmpty |> should equal true
    }


[<Fact>]
let ``standing search hits a document that arrives after the query`` () =
    task {
        let idx = SearchIndex()
        idx.SendQuery(ZSet.singleton "landauer" 1L)
        do! idx.StepAsync()
        idx.Current.IsEmpty |> should equal true
        idx.SendPostings(ReverseIndex.postings "doc/a.md" "Landauer bound and entropy")
        do! idx.StepAsync()
        idx.Current
        |> should equal (ZSet.singleton { Term = "landauer"; Doc = "doc/a.md" } 1L)
    }


[<Fact>]
let ``retracting a document withdraws its search hits`` () =
    task {
        let idx = SearchIndex()
        let text = "Landauer bound"
        idx.SendQuery(ZSet.singleton "landauer" 1L)
        idx.SendPostings(ReverseIndex.postings "doc/a.md" text)
        do! idx.StepAsync()
        idx.Current.IsEmpty |> should equal false
        idx.SendPostings(ReverseIndex.retractPostings "doc/a.md" text)
        do! idx.StepAsync()
        idx.Current.IsEmpty |> should equal true
    }


[<Fact>]
let ``host GroupCommitDiskDeltaLog round-trips cited-by and search, not git`` () : Task =
    let dir = DeterministicTestPath.nextDir "revidx-wal"
    task {
        try
            use log = new GroupCommitDiskDeltaLog<IndexFact>(dir, ReverseIndex.codec)
            let dlog = log :> IDeltaLog<IndexFact>
            let r = cite "A" "B" "reviews"
            let! _ = ReverseIndexLog.append dlog (ZSet.singleton (IndexFact.Entity "B") 1L) ct
            let! _ = ReverseIndexLog.append dlog (ZSet.singleton (IndexFact.Cite r) 1L) ct
            let postingFacts =
                ReverseIndex.postings "doc/a.md" "hello landauer"
                |> ZSet.map (fun p -> IndexFact.Posting p)
            let! _ = ReverseIndexLog.append dlog postingFacts ct
            let cited = CitedByIndex()
            let search = SearchIndex()
            search.SendQuery(ZSet.singleton "landauer" 1L)
            do! search.StepAsync()
            do! ReverseIndexLog.replayInto dlog cited search ct
            cited.Current
            |> should equal (ZSet.singleton { Target = "B"; From = "A"; Relation = "reviews" } 1L)
            search.Current
            |> should equal (ZSet.singleton { Term = "landauer"; Doc = "doc/a.md" } 1L)
        finally
            try Directory.Delete(dir, true) with _ -> ()
    }


[<Fact>]
let ``fresh log instance recovers reverse-index facts from the host directory`` () : Task =
    let dir = DeterministicTestPath.nextDir "revidx-reopen"
    task {
        try
            do!
                task {
                    use log1 = new GroupCommitDiskDeltaLog<IndexFact>(dir, ReverseIndex.codec)
                    let d1 = log1 :> IDeltaLog<IndexFact>
                    let! _ = ReverseIndexLog.append d1 (ZSet.singleton (IndexFact.Entity "B") 1L) ct
                    let! _ = ReverseIndexLog.append d1 (ZSet.singleton (IndexFact.Cite(cite "A" "B" "reviews")) 1L) ct
                    return ()
                }
            use log2 = new GroupCommitDiskDeltaLog<IndexFact>(dir, ReverseIndex.codec)
            let cited = CitedByIndex()
            let search = SearchIndex()
            do! ReverseIndexLog.replayInto (log2 :> IDeltaLog<IndexFact>) cited search ct
            cited.Current
            |> should equal (ZSet.singleton { Target = "B"; From = "A"; Relation = "reviews" } 1L)
        finally
            try Directory.Delete(dir, true) with _ -> ()
    }


let private writeRel (root: string) (rel: string) (content: string) =
    let path = Path.Combine(root, rel.Replace('/', Path.DirectorySeparatorChar))
    let dir = Path.GetDirectoryName path
    if not (String.IsNullOrEmpty dir) then
        Directory.CreateDirectory dir |> ignore
    File.WriteAllText(path, content)
    path

let private writeRelBytes (root: string) (rel: string) (bytes: byte[]) =
    let path = Path.Combine(root, rel.Replace('/', Path.DirectorySeparatorChar))
    let dir = Path.GetDirectoryName path
    if not (String.IsNullOrEmpty dir) then
        Directory.CreateDirectory dir |> ignore
    File.WriteAllBytes(path, bytes)
    path

let private landauerWeight (search: SearchIndex) (doc: string) =
    ZSet.lookup { Term = "landauer"; Doc = doc } search.Current


[<Fact>]
let ``corpus predicate is an allowlist and exclusions beat it`` () =
    ReverseIndexCorpus.isIndexablePath "docs/x.md" |> should equal true
    ReverseIndexCorpus.isIndexablePath "src/a/b.ts" |> should equal true
    ReverseIndexCorpus.isIndexablePath "img/logo.png" |> should equal false
    ReverseIndexCorpus.isIndexablePath "docs/github/prs/shards/002/x.json" |> should equal false
    ReverseIndexCorpus.isIndexablePath "db/search-index/inverted/files.txt" |> should equal false
    ReverseIndexCorpus.isIndexablePath "README" |> should equal true
    ReverseIndexCorpus.isIndexablePath "Makefile" |> should equal true
    ReverseIndexCorpus.isIndexablePath ".git/objects/pack/foo.md" |> should equal false
    ReverseIndexCorpus.isIndexablePath "Note.MD" |> should equal false


[<Fact>]
let ``every excluded tree carries a dated measurement`` () =
    ReverseIndexCorpus.excludedTrees.Length |> should be (greaterThan 0)
    for t in ReverseIndexCorpus.excludedTrees do
        t.Prefix.EndsWith("/", StringComparison.Ordinal) |> should equal true
        t.Measurement.Length |> should be (greaterThan 40)
        t.Measurement |> Seq.exists Char.IsDigit |> should equal true


[<Fact>]
let ``host ingest hits landauer in fixture docs and skips excluded oversized binary`` () : Task =
    let corpus = DeterministicTestPath.nextDir "revidx-ingest-corpus"
    let wal = DeterministicTestPath.nextDir "revidx-ingest-wal"
    task {
        try
            writeRel corpus "docs/note.md" "Landauer bound and entropy" |> ignore
            writeRel corpus "src/code.ts" "export const landauer = 1" |> ignore
            writeRel corpus "README" "landauer mentioned in the readme" |> ignore
            writeRel corpus "docs/github/prs/shards/002/x.json" "landauer in a PR shard" |> ignore
            writeRelBytes corpus "img/logo.png" [| 0x89uy; 0x50uy; 0uy |] |> ignore
            let huge = Array.create (ReverseIndexCorpus.MaxBlobBytes + 1) (byte 'x')
            let prefix = Text.Encoding.UTF8.GetBytes "landauer "
            Array.Copy(prefix, huge, prefix.Length)
            writeRelBytes corpus "docs/huge.md" huge |> ignore
            let nulBytes =
                Array.append [| byte 'l'; byte 'a'; 0uy |] (Text.Encoding.UTF8.GetBytes "landauer")
            writeRelBytes corpus "docs/nul.md" nulBytes |> ignore

            use log = new GroupCommitDiskDeltaLog<IndexFact>(wal, ReverseIndex.codec)
            let dlog = log :> IDeltaLog<IndexFact>
            let! report = ReverseIndexIngest.ingestHostDirectory corpus dlog ct
            report.FilesIndexed |> should equal 3
            report.SkippedNotIndexable |> should be (greaterThan 0)
            report.SkippedOversize |> should equal 1
            report.SkippedBinary |> should equal 1
            report.PostingsAppended |> should be (greaterThan 0)

            let search = SearchIndex()
            let cited = CitedByIndex()
            search.SendQuery(ZSet.singleton "landauer" 1L)
            do! search.StepAsync()
            do! ReverseIndexLog.replayInto dlog cited search ct
            landauerWeight search "docs/note.md" |> should equal 1L
            landauerWeight search "src/code.ts" |> should equal 1L
            landauerWeight search "README" |> should equal 1L
            landauerWeight search "docs/huge.md" |> should equal 0L
            landauerWeight search "docs/nul.md" |> should equal 0L
            landauerWeight search "docs/github/prs/shards/002/x.json" |> should equal 0L
            landauerWeight search "img/logo.png" |> should equal 0L
        finally
            try Directory.Delete(corpus, true) with _ -> ()
            try Directory.Delete(wal, true) with _ -> ()
    }


[<Fact>]
let ``explicit file list does not walk sibling documents`` () : Task =
    let corpus = DeterministicTestPath.nextDir "revidx-ingest-listed"
    let wal = DeterministicTestPath.nextDir "revidx-ingest-listed-wal"
    task {
        try
            let keep = writeRel corpus "docs/keep.md" "Landauer bound"
            writeRel corpus "docs/sibling.md" "landauer in a sibling that must not be walked" |> ignore
            use log = new GroupCommitDiskDeltaLog<IndexFact>(wal, ReverseIndex.codec)
            let dlog = log :> IDeltaLog<IndexFact>
            let fs = PhysicalFileSystem() :> IFileSystem
            let! report = ReverseIndexIngest.ingestPaths fs corpus [| keep |] dlog ct
            report.FilesIndexed |> should equal 1
            let search = SearchIndex()
            let cited = CitedByIndex()
            search.SendQuery(ZSet.singleton "landauer" 1L)
            do! search.StepAsync()
            do! ReverseIndexLog.replayInto dlog cited search ct
            landauerWeight search "docs/keep.md" |> should equal 1L
            landauerWeight search "docs/sibling.md" |> should equal 0L
        finally
            try Directory.Delete(corpus, true) with _ -> ()
            try Directory.Delete(wal, true) with _ -> ()
    }


[<Fact>]
let ``cite extract keeps closed relations, skips unknown, skips http`` () =
    let text =
        "cite A B reviews\n"
        + "cite A B not-a-rel\n"
        + "See [note](docs/b.md) and 081M26HWSZ6087G0R00373BN0Q plus [x](https://example.com/x)\n"
    let struct (refs, unknown) = ReverseIndexCite.extract "docs/a.md" text
    unknown |> should equal 1
    ReverseIndexCite.isRelation "reviews" |> should equal true
    ReverseIndexCite.isRelation "not-a-rel" |> should equal false
    refs
    |> Array.exists (fun r -> r.From = "A" && r.Target = "B" && r.Relation = "reviews")
    |> should equal true
    refs
    |> Array.exists (fun r -> r.From = "docs/a.md" && r.Target = "docs/b.md" && r.Relation = "see-also")
    |> should equal true
    refs
    |> Array.exists (fun r -> r.Target = "081M26HWSZ6087G0R00373BN0Q" && r.Relation = "see-also")
    |> should equal true
    refs |> Array.exists (fun r -> r.Target.StartsWith("https://", StringComparison.Ordinal)) |> should equal false


[<Fact>]
let ``host cite ingest materializes inbound cited-by for B`` () : Task =
    let corpus = DeterministicTestPath.nextDir "revidx-cite-corpus"
    let wal = DeterministicTestPath.nextDir "revidx-cite-wal"
    task {
        try
            writeRel corpus "docs/a.md" "cite A B reviews\nSee [b](docs/b.md)\n" |> ignore
            writeRel corpus "docs/b.md" "B is the target entity.\n" |> ignore
            use log = new GroupCommitDiskDeltaLog<IndexFact>(wal, ReverseIndex.codec)
            let dlog = log :> IDeltaLog<IndexFact>
            let! report = ReverseIndexCiteIngest.ingestHostDirectory corpus dlog ct
            report.CitesAppended |> should be (greaterThan 0)
            report.EntitiesAppended |> should be (greaterThan 0)
            let cited = CitedByIndex()
            let search = SearchIndex()
            do! ReverseIndexLog.replayInto dlog cited search ct
            ZSet.lookup { Target = "B"; From = "A"; Relation = "reviews" } cited.Current
            |> should equal 1L
            ZSet.lookup { Target = "docs/b.md"; From = "docs/a.md"; Relation = "see-also" } cited.Current
            |> should equal 1L
        finally
            try Directory.Delete(corpus, true) with _ -> ()
            try Directory.Delete(wal, true) with _ -> ()
    }


[<Fact>]
let ``fairness inbox drain is local and a reply does not overwrite the cite`` () : Task =
    task {
        let inboxB = FairnessInbox("B")
        do! inboxB.StepAsync()
        inboxB.SendReferences(ZSet.singleton (cite "A" "B" "reviews") 1L)
        do! inboxB.StepAsync()
        let first = inboxB.Drain()
        first.Length |> should equal 1
        first.[0] |> should equal { Target = "B"; From = "A"; Relation = "reviews" }
        inboxB.Drain().Length |> should equal 0
        inboxB.SendReferences(ZSet.singleton (cite "B" "A" "replies") 1L)
        do! inboxB.StepAsync()
        ZSet.lookup { Target = "B"; From = "A"; Relation = "reviews" } inboxB.Current
        |> should equal 1L
        inboxB.Drain().Length |> should equal 0
        let inboxA = FairnessInbox("A")
        do! inboxA.StepAsync()
        inboxA.SendReferences(ZSet.singleton (cite "B" "A" "replies") 1L)
        do! inboxA.StepAsync()
        inboxA.Drain()
        |> should equal [| { Target = "A"; From = "B"; Relation = "replies" } |]
    }
