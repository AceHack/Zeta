module Zeta.Tests.Formal.LiveLegsTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core

module L = Zeta.Core.LiveLegs
module I = Zeta.Core.ImdbDataset

// ═══════════════════════════════════════════════════════════════════
// LiveLegs — TMDB + Wikidata legs behind the injected Fetch port. All
// OFFLINE here: parsers on fixture JSON + recordedFetch (DST replay).
// The live HttpClient edge is opt-in and not exercised in CI.
// ═══════════════════════════════════════════════════════════════════

let private tmdbCredits =
    """{"id":603,"cast":[{"id":6384,"name":"Keanu Reeves","character":"Neo"},{"id":2975,"name":"Laurence Fishburne","character":"Morpheus"}]}"""

let private sparqlJson =
    """{"results":{"bindings":[{"item":{"value":"http://www.wikidata.org/entity/Q42"},"itemLabel":{"value":"Douglas Adams"}}]}}"""

[<Fact>]
let ``TMDB creditsUrl builds the documented endpoint`` () =
    L.Tmdb.creditsUrl "KEY" "603"
    |> should equal "https://api.themoviedb.org/3/movie/603/credits?api_key=KEY"

[<Fact>]
let ``TMDB parseCredits yields one namespaced principal per cast member`` () =
    let ps = L.Tmdb.parseCredits "603" tmdbCredits
    ps.Length |> should equal 2
    ps.[0]
    |> should equal ({ Tconst = "tmdb:603"; Nconst = "tmdb:6384"; Category = "cast" }: I.Principal)
    ps.[1].Nconst |> should equal "tmdb:2975"

[<Fact>]
let ``TMDB fetchCredits goes through the injected (recorded) port — DST replay, no network`` () =
    let url = L.Tmdb.creditsUrl "KEY" "603"
    let fetch = L.recordedFetch (Map.ofList [ url, tmdbCredits ])
    let ps = L.Tmdb.fetchCredits fetch "KEY" "603" |> Async.RunSynchronously
    ps.Length |> should equal 2
    // and it feeds the SAME pipeline: a 2-cast movie → one co-star link
    let _, adj = I.coStarAdjacency ps
    adj.[0] |> should equal [| 1 |]

[<Fact>]
let ``Wikidata sparqlUrl percent-encodes the query`` () =
    let u = L.Wikidata.sparqlUrl "SELECT ?x WHERE {}"
    u.StartsWith("https://query.wikidata.org/sparql?format=json&query=", System.StringComparison.Ordinal)
    |> should equal true
    u.Contains "%20" |> should equal true // spaces encoded

[<Fact>]
let ``Wikidata parseBindings yields var→value rows`` () =
    let rows = L.Wikidata.parseBindings sparqlJson
    rows.Length |> should equal 1
    rows.[0].["itemLabel"] |> should equal "Douglas Adams"
    rows.[0].["item"] |> should equal "http://www.wikidata.org/entity/Q42"

[<Fact>]
let ``recordedFetch replays a captured response (the DST membrane)`` () =
    let fetch = L.recordedFetch (Map.ofList [ "u", "body" ])
    (fetch "u" |> Async.RunSynchronously) |> should equal "body"
