module Zeta.Tests.Formal.DemoPipelineTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core

module P = Zeta.Core.DemoPipeline
module L = Zeta.Core.LiveLegs
module M = Zeta.Core.MintPanel

// two recorded TMDB credits responses (Keanu/6384 is in both → the connector)
let private creds603 =
    """{"id":603,"cast":[{"id":6384,"name":"Keanu Reeves"},{"id":2975,"name":"Laurence Fishburne"}]}"""

let private creds604 =
    """{"id":604,"cast":[{"id":6384,"name":"Keanu Reeves"},{"id":1331,"name":"Carrie-Anne Moss"}]}"""

let private fetch =
    L.recordedFetch (
        Map.ofList
            [ L.Tmdb.creditsUrl "KEY" "603", creds603
              L.Tmdb.creditsUrl "KEY" "604", creds604 ]
    )

let private clock = { M.Phase = 1L; M.Utc = "2026-06-19T12:00:00Z"; M.UncertaintyMs = 2L }

[<Fact>]
let ``fetchPrincipals pulls + concatenates cast across movies (via the recorded port)`` () =
    let ps = P.fetchPrincipals fetch "KEY" [ "603"; "604" ] |> Async.RunSynchronously
    ps.Length |> should equal 4 // 2 cast × 2 movies
    ps |> List.map (fun p -> p.Nconst) |> List.contains "tmdb:6384" |> should equal true

[<Fact>]
let ``end-to-end: recorded fetch → principals → rendered dashboard (one DST path)`` () =
    let ps = P.fetchPrincipals fetch "KEY" [ "603"; "604" ] |> Async.RunSynchronously
    let html = P.renderDashboard clock true "TMDB" 4 7 ps
    html.StartsWith("<!DOCTYPE html>", System.StringComparison.Ordinal) |> should equal true
    html.Contains "<script" |> should equal false
    html.Contains "<svg" |> should equal true // the federation graph
    html.Contains "tmdb:6384" |> should equal true // a minted co-star link (the connector)
    html.Contains "phase 1" |> should equal true // Zeta-NTP clock

[<Fact>]
let ``snapshot persists the reified graph and round-trips by content hash`` () =
    let ps = P.fetchPrincipals fetch "KEY" [ "603"; "604" ] |> Async.RunSynchronously
    match P.snapshot 4 7 ps (GraphSnapshot.emptyStore ()) with
    | Ok(h, store) ->
        match GraphSnapshot.load h store with
        | Some(Ok g) -> g.N |> should equal 3 // 6384, 2975, 1331
        | other -> failwithf "expected Some(Ok graph), got %A" other
    | Error e -> failwith e

[<Fact>]
let ``the pipeline is deterministic (DST): same recordings → same dashboard`` () =
    let run () =
        let ps = P.fetchPrincipals fetch "KEY" [ "603"; "604" ] |> Async.RunSynchronously
        P.renderDashboard clock true "TMDB" 4 7 ps
    run () |> should equal (run ())
