namespace Zeta.Core

open System
open System.Text.Json

/// **`LiveLegs` — the live TMDB + Wikidata legs of the IMDb/Wikipedia type provider (Aaron 2026-06-19, shadow\*).**
///
/// The network-touching legs, built **in discipline**. The only door for network entropy is the **injected
/// `Fetch` port** — a `string -> Async<string>` passed in, never an ambient `HttpClient` (noninterference §13:
/// entropy/IO only through declared, metered channels). The leg *logic* (URL build → fetch via port → parse
/// JSON → typed rows) is **pure w.r.t. the port**, so it is fully **offline-testable** and **DST-replayable**:
/// a `recordedFetch` replays a captured `url → response` map deterministically (the record/replay membrane).
///
/// Results feed the SAME pipeline as `ImdbDataset` (the parsers emit `ImdbDataset.Principal`s → the co-star
/// graph / `CostarZSet` / `CostarFederations`) and should be wrapped in `TtlCache` (respect the sites).
///
/// **Honest scope (peel):** `liveFetch` (the real `HttpClient` adapter) is the **opt-in network edge** — it is
/// the *only* code here that touches the network, is **not exercised in CI** (determinism / noninterference),
/// and carries the ToS caveat (TMDB needs an API key; Wikidata WDQS has rate limits — always `TtlCache` it).
/// Same posture as the unverified-Q# lane: the capability is provided; the live call is opt-in. The parsers
/// model the subset needed for the co-star / entity graph, not the full APIs.
[<RequireQualifiedAccess>]
module LiveLegs =

    /// The injected network port — the single declared channel for external entropy. Inject a `recordedFetch`
    /// (tests / DST replay) or `liveFetch` (the opt-in real edge).
    type Fetch = string -> Async<string>

    /// A deterministic, OFFLINE `Fetch` that replays a captured `url → response` map (DST record/replay). A
    /// missing url is a replay-invariant violation (raised, not silently empty — no hidden gaps).
    let recordedFetch (responses: Map<string, string>) : Fetch =
        fun url ->
            async {
                match Map.tryFind url responses with
                | Some r -> return r
                | None -> return invalidOp (String.Concat("recordedFetch: no recording for ", url))
            }

    let private propString (el: JsonElement) (name: string) : string =
        match el.TryGetProperty name with
        | true, v ->
            match v.ValueKind with
            | JsonValueKind.String ->
                match v.GetString() with
                | null -> ""
                | s -> s
            | JsonValueKind.Null -> ""
            | _ -> v.GetRawText()
        | _ -> ""

    /// ── TMDB leg ──────────────────────────────────────────────────────────────────────────────────────
    [<RequireQualifiedAccess>]
    module Tmdb =

        /// `/movie/{id}/credits` URL (API key in the query — supply per call; never hard-code).
        let creditsUrl (apiKey: string) (movieId: string) : string =
            String.Concat("https://api.themoviedb.org/3/movie/", movieId, "/credits?api_key=", apiKey)

        /// Parse a TMDB `credits` response into `ImdbDataset.Principal`s (one per cast member): the title is the
        /// movie, the person is the cast id, namespaced `tmdb:` so TMDB and IMDb ids never collide.
        let parseCredits (movieId: string) (json: string) : ImdbDataset.Principal list =
            use doc = JsonDocument.Parse(json)

            match doc.RootElement.TryGetProperty "cast" with
            | true, cast when cast.ValueKind = JsonValueKind.Array ->
                [ for el in cast.EnumerateArray() do
                      match el.TryGetProperty "id" with
                      | true, idEl ->
                          yield
                              ({ Tconst = String.Concat("tmdb:", movieId)
                                 Nconst = String.Concat("tmdb:", idEl.GetRawText())
                                 Category = "cast" }
                              : ImdbDataset.Principal)
                      | _ -> () ]
            | _ -> []

        /// Fetch + parse a movie's credits via the injected port.
        let fetchCredits (fetch: Fetch) (apiKey: string) (movieId: string) : Async<ImdbDataset.Principal list> =
            async {
                let! json = fetch (creditsUrl apiKey movieId)
                return parseCredits movieId json
            }

    /// ── Wikidata leg ──────────────────────────────────────────────────────────────────────────────────
    [<RequireQualifiedAccess>]
    module Wikidata =

        /// The WDQS SPARQL endpoint URL for a query (JSON results; query percent-encoded).
        let sparqlUrl (query: string) : string =
            String.Concat("https://query.wikidata.org/sparql?format=json&query=", Uri.EscapeDataString query)

        /// Parse a SPARQL-JSON results document into one `Map<var, value>` per binding row.
        let parseBindings (json: string) : Map<string, string> list =
            use doc = JsonDocument.Parse(json)

            match doc.RootElement.TryGetProperty "results" with
            | true, results ->
                match results.TryGetProperty "bindings" with
                | true, bindings when bindings.ValueKind = JsonValueKind.Array ->
                    [ for row in bindings.EnumerateArray() ->
                          [ for p in row.EnumerateObject() -> p.Name, propString p.Value "value" ] |> Map.ofList ]
                | _ -> []
            | _ -> []

        /// Fetch + parse a SPARQL query via the injected port.
        let fetchBindings (fetch: Fetch) (query: string) : Async<Map<string, string> list> =
            async {
                let! json = fetch (sparqlUrl query)
                return parseBindings json
            }

    /// **The opt-in real network edge** (NOT exercised in CI). A shared `HttpClient` issuing the GET; this is the
    /// only code here that touches the network — wire it explicitly (and `TtlCache` the results) when going live.
    let private httpClient = lazy (new System.Net.Http.HttpClient())

    let liveFetch: Fetch =
        fun url ->
            async {
                let! body = httpClient.Value.GetStringAsync(url) |> Async.AwaitTask
                return body
            }
