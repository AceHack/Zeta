module Zeta.Samples.FactoryDemo.Api.Program

open System
open Microsoft.AspNetCore.Builder
open Microsoft.AspNetCore.Http
open Microsoft.Extensions.DependencyInjection

// Minimal F# ASP.NET Core Web API serving the seed data for the
// factory-demo. Stack-independent — any frontend choice (Blazor /
// React / Vue / Svelte / curl) consumes the same JSON.
//
// V0 scope: in-memory seed only, no DB wiring. A Postgres backing
// with schema.sql + seed-data.sql is a planned follow-up PR; until
// then this API carries its own in-memory seed so the sample runs
// with zero external dependencies.

let private pipelineFunnel () =
    Seed.opportunities
    |> List.groupBy (fun o -> o.Stage)
    |> List.map (fun (stage, opps) ->
        {| Stage = stage
           Count = opps |> List.length
           TotalCents = opps |> List.sumBy (fun o -> o.AmountCents) |})

let private duplicateEmails () =
    Seed.customers
    |> List.groupBy (fun c -> c.Email)
    |> List.filter (fun (_, xs) -> xs |> List.length > 1)
    |> List.map (fun (email, xs) ->
        {| Email = email
           CustomerIds = xs |> List.map (fun c -> c.Id) |})

[<EntryPoint>]
let main args =
    let builder = WebApplication.CreateBuilder(args)
    // Emit consistent JSON for an external consumer — default
    // System.Text.Json options are fine; documented for future tuning.
    builder.Services.AddEndpointsApiExplorer() |> ignore
    let app = builder.Build()

    // Trivial root — lets a browser confirm the API is up. The
    // `endpoints` list is the full contract surface (all 9 paths
    // listed, including parameterised routes).
    app.MapGet("/", Func<_>(fun () ->
        {| name = "Factory-demo API (F#)"
           version = "0.0.1"
           endpoints =
               [ "/"
                 "/api/customers"
                 "/api/customers/{id}"
                 "/api/customers/{id}/activities"
                 "/api/opportunities"
                 "/api/opportunities/{id}"
                 "/api/activities"
                 "/api/pipeline/funnel"
                 "/api/pipeline/duplicates" ] |} :> obj))
        |> ignore

    app.MapGet("/api/customers", Func<_>(fun () -> Seed.customers :> obj)) |> ignore
    app.MapGet("/api/customers/{id:long}", Func<int64, IResult>(fun id ->
        Seed.customers
        |> List.tryFind (fun c -> c.Id = id)
        |> function
           | Some c -> Results.Ok c
           | None -> Results.NotFound()))
        |> ignore

    app.MapGet("/api/opportunities", Func<_>(fun () -> Seed.opportunities :> obj)) |> ignore
    app.MapGet("/api/opportunities/{id:long}", Func<int64, IResult>(fun id ->
        Seed.opportunities
        |> List.tryFind (fun o -> o.Id = id)
        |> function
           | Some o -> Results.Ok o
           | None -> Results.NotFound()))
        |> ignore

    app.MapGet("/api/activities", Func<_>(fun () -> Seed.activities :> obj)) |> ignore
    app.MapGet("/api/customers/{id:long}/activities", Func<int64, obj>(fun id ->
        Seed.activities
        |> List.filter (fun a -> a.CustomerId = id)
        :> obj))
        |> ignore

    // Derived views that a frontend would otherwise compute client-
    // side. Landing them server-side keeps the API contract tight.
    app.MapGet("/api/pipeline/funnel", Func<_>(fun () -> pipelineFunnel () :> obj)) |> ignore
    app.MapGet("/api/pipeline/duplicates", Func<_>(fun () -> duplicateEmails () :> obj)) |> ignore

    app.Run()
    0
