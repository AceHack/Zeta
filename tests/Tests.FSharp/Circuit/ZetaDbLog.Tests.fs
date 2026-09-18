[<global.Xunit.Collection("ZetaFsAmbientFileSystem")>]
module Zeta.Tests.Circuit.ZetaDbLogTests

open System
open System.IO
open System.Threading
open System.Threading.Tasks
open FsUnit.Xunit
open global.Xunit
open Zeta.Core
open Zeta.Tests.Support

let private ct = CancellationToken.None

let private line = "issuer"

let private at (n: int64) : TravelerFrame.Frame =
    TravelerFrame.observe line (Versionstamp.ofInt64 n) TravelerFrame.origin

let private keyRef (handle: string) : KeyStore.KeyRef =
    { Backend = KeyStore.LocalFile
      Handle = handle }


[<Fact>]
let ``schema delta and reader window round-trip on the host WAL`` () : Task =
    let dir = DeterministicTestPath.nextDir "zetadb-schema-wal"
    task {
        try
            do!
                task {
                    use log1 = new GroupCommitDiskDeltaLog<ZetaDbFact>(dir, ZetaDbLog.codec)
                    let d1 = log1 :> IDeltaLog<ZetaDbFact>
                    let add =
                        SchemaEvent.create "e1" (AddField { Name = "title"; Type = DynamicValueType.String })
                    let! _ = ZetaDbLog.append d1 (ZSet.singleton (ZetaDbFact.Schema add) 1L) ct
                    let! _ = ZetaDbLog.append d1 (ZSet.singleton (ZetaDbFact.ReaderJoin 0) 1L) ct
                    return ()
                }
            use log2 = new GroupCommitDiskDeltaLog<ZetaDbFact>(dir, ZetaDbLog.codec)
            let cited = CitedByIndex()
            let search = SearchIndex()
            let! struct (schema, readers, _, _) =
                ZetaDbLog.replayInto (log2 :> IDeltaLog<ZetaDbFact>) cited search ct
            SchemaZ.wellFormed schema |> should equal true
            SchemaZ.fields schema
            |> List.map (fun f -> f.Name)
            |> should equal [ "title" ]
            EvolutionWindow.mayExpandInto 1 readers |> should equal false
        finally
            try Directory.Delete(dir, true) with _ -> ()
    }


[<Fact>]
let ``reader leave unblocks expand-into; grant expires by phase with no retract`` () : Task =
    let dir = DeterministicTestPath.nextDir "zetadb-window-wal"
    task {
        try
            use log = new GroupCommitDiskDeltaLog<ZetaDbFact>(dir, ZetaDbLog.codec)
            let dlog = log :> IDeltaLog<ZetaDbFact>
            let! _ = ZetaDbLog.append dlog (ZSet.singleton (ZetaDbFact.ReaderJoin 0) 1L) ct
            let! _ = ZetaDbLog.append dlog (ZSet.singleton (ZetaDbFact.ReaderLeave 0) 1L) ct
            match KeyCustody.tryIssue line "ani" "signer" (Versionstamp.ofInt64 0L) 256L with
            | Error e -> failwith (sprintf "tryIssue refused: %A" e)
            | Ok g ->
                let! _ = ZetaDbLog.append dlog (ZSet.singleton (ZetaDbFact.Custody(KeyCustody.GrantIssued g)) 1L) ct
                let cited = CitedByIndex()
                let search = SearchIndex()
                let! struct (_, readers, custody, _) = ZetaDbLog.replayInto dlog cited search ct
                EvolutionWindow.mayExpandInto 1 readers |> should equal true
                KeyCustody.liveGrants (at 10L) custody |> List.map (fun x -> x.Principal) |> should equal [ "ani" ]
                KeyCustody.liveGrants (at 256L) custody |> should equal List.empty<KeyCustody.Grant>
        finally
            try Directory.Delete(dir, true) with _ -> ()
    }


[<Fact>]
let ``one host directory holds postings, cites, schema, and a key window`` () : Task =
    let dir = DeterministicTestPath.nextDir "zetadb-unified-wal"
    task {
        try
            use log = new GroupCommitDiskDeltaLog<ZetaDbFact>(dir, ZetaDbLog.codec)
            let dlog = log :> IDeltaLog<ZetaDbFact>
            let posting =
                ReverseIndex.postings "docs/a.md" "landauer bound"
                |> ZSet.map (fun p -> ZetaDbFact.Index(IndexFact.Posting p))
            let! _ = ZetaDbLog.append dlog posting ct
            let cite: Reference = { From = "A"; Target = "B"; Relation = "reviews" }
            let! _ = ZetaDbLog.append dlog (ZSet.singleton (ZetaDbFact.Index(IndexFact.Entity "B")) 1L) ct
            let! _ = ZetaDbLog.append dlog (ZSet.singleton (ZetaDbFact.Index(IndexFact.Cite cite)) 1L) ct
            let add = SchemaEvent.create "e1" (AddField { Name = "body"; Type = DynamicValueType.String })
            let! _ = ZetaDbLog.append dlog (ZSet.singleton (ZetaDbFact.Schema add) 1L) ct
            let opened = KeyCustody.KeyringOpened("ani", "acct", line, keyRef "k1")
            let! _ = ZetaDbLog.append dlog (ZSet.singleton (ZetaDbFact.Custody opened) 1L) ct
            let cited = CitedByIndex()
            let search = SearchIndex()
            search.SendQuery(ZSet.singleton "landauer" 1L)
            do! search.StepAsync()
            let! struct (schema, _, custody, _) = ZetaDbLog.replayInto dlog cited search ct
            ZSet.lookup { Term = "landauer"; Doc = "docs/a.md" } search.Current |> should equal 1L
            ZSet.lookup { CitedBy.Target = "B"; From = "A"; Relation = "reviews" } cited.Current
            |> should equal 1L
            SchemaZ.fields schema |> List.map (fun f -> f.Name) |> should equal [ "body" ]
            custody.Keyrings.ContainsKey(("ani", "acct")) |> should equal true
        finally
            try Directory.Delete(dir, true) with _ -> ()
    }


[<Fact>]
let ``one overlap rotator: expand-into refused while live, Previous accepted then expires`` () =
    let schemaId = "schema-reader-0"
    let keyId = "key-previous-ani-acct"
    match OverlapRotator.tryOpen schemaId line (Versionstamp.ofInt64 0L) 256L OverlapRotator.empty with
    | Error e -> failwith (sprintf "schema overlap refused: %A" e)
    | Ok s0 ->
        match OverlapRotator.tryOpen keyId line (Versionstamp.ofInt64 0L) 256L s0 with
        | Error e -> failwith (sprintf "key overlap refused: %A" e)
        | Ok st ->
            let blocking = [| schemaId |]
            OverlapRotator.mayExpandInto (at 10L) st blocking |> should equal false
            OverlapRotator.mayAcceptPrevious (at 10L) st keyId |> should equal true
            OverlapRotator.mayExpandInto (at 256L) st blocking |> should equal true
            OverlapRotator.mayAcceptPrevious (at 256L) st keyId |> should equal false
            let closed = OverlapRotator.close schemaId st
            OverlapRotator.mayExpandInto (at 10L) closed blocking |> should equal true
            OverlapRotator.mayAcceptPrevious (at 10L) closed keyId |> should equal true


[<Fact>]
let ``overlap open and close round-trip on the host WAL`` () : Task =
    let dir = DeterministicTestPath.nextDir "zetadb-overlap-wal"
    task {
        try
            use log = new GroupCommitDiskDeltaLog<ZetaDbFact>(dir, ZetaDbLog.codec)
            let dlog = log :> IDeltaLog<ZetaDbFact>
            let! _ =
                ZetaDbLog.append
                    dlog
                    (ZSet.singleton (ZetaDbFact.OverlapOpen("schema-reader-0", line, 0L, 256L)) 1L)
                    ct
            let cited = CitedByIndex()
            let search = SearchIndex()
            let! struct (_, _, _, overlap) = ZetaDbLog.replayInto dlog cited search ct
            OverlapRotator.mayExpandInto (at 10L) overlap [| "schema-reader-0" |] |> should equal false
            let! _ = ZetaDbLog.append dlog (ZSet.singleton (ZetaDbFact.OverlapClose "schema-reader-0") 1L) ct
            let cited2 = CitedByIndex()
            let search2 = SearchIndex()
            let! struct (_, _, _, overlap2) = ZetaDbLog.replayInto dlog cited2 search2 ct
            OverlapRotator.mayExpandInto (at 10L) overlap2 [| "schema-reader-0" |] |> should equal true
        finally
            try Directory.Delete(dir, true) with _ -> ()
    }
