#r "nuget: System.Text.Json"
#r "../../../src/Core/bin/Debug/net10.0/Zeta.Core.dll"

open System
open System.IO
open System.Text.Json
open Zeta.Core

type Response = {
    agent: string
    model: string
    persona: string
    itemId: string
    truth: bool
    error: int
    raw: string
}

let lines = File.ReadAllLines("db/costume-rho/responses.jsonl")
let responses = 
    lines 
    |> Array.map (fun line -> JsonSerializer.Deserialize<Response>(line, JsonSerializerOptions(PropertyNameCaseInsensitive = true)))

let agents = responses |> Array.map (fun r -> r.agent) |> Array.distinct
let n = agents.Length
printfn "Found %d distinct agents (hats)." n

let lineages = 
    agents 
    |> Array.map (fun a -> Provenance.token a) 
    |> Array.toList

let rho_ancestry = LineageDisjointnessEstimator.lineageDisjointness lineages
let nEff_ancestry = DeclaredStanceLedger.effectiveIndependentCount n rho_ancestry

printfn "Lineage Disjointness Estimator (Jaccard Ancestry): rho = %f, N_eff = %f" rho_ancestry nEff_ancestry
printfn "Measured Behavioral N_eff (F3) = 1.2"
printfn "Overstatement factor: %f x" (nEff_ancestry / 1.2)

let responsesByAgent = 
    responses 
    |> Array.groupBy (fun r -> r.agent) 
    |> Array.map (fun (a, rs) -> a, rs |> Array.sortBy (fun r -> r.itemId))
    |> Map.ofArray

let mutable totalRhoOwe = 0.0
let mutable pairCount = 0

for i in 0 .. agents.Length - 1 do
    for j in i + 1 .. agents.Length - 1 do
        let agent1 = agents.[i]
        let agent2 = agents.[j]
        let r1 = responsesByAgent.[agent1]
        let r2 = responsesByAgent.[agent2]
        let pairs12 = Array.zip r1 r2 |> Array.map (fun (x, y) -> x.raw, y.raw)
        let pairs21 = Array.zip r2 r1 |> Array.map (fun (x, y) -> x.raw, y.raw)
        let rho12 = Decorrelation.ownEntropyFraction2 pairs12
        let rho21 = Decorrelation.ownEntropyFraction2 pairs21
        totalRhoOwe <- totalRhoOwe + rho12 + rho21
        pairCount <- pairCount + 2

let avgRhoOwe = if pairCount = 0 then 0.0 else totalRhoOwe / float pairCount
let behavioralCorrelation = 1.0 - avgRhoOwe
let nEff_behavioral = DeclaredStanceLedger.effectiveIndependentCount n behavioralCorrelation
printfn "Behavioral Estimator (Alexa's ownEntropyFraction2): rho = %f, N_eff = %f" behavioralCorrelation nEff_behavioral
