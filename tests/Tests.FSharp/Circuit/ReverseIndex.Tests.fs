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
