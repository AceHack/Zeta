module Zeta.Tests.Formal.DemoDashboardTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core

module D = Zeta.Core.DemoDashboard
module M = Zeta.Core.MintPanel
module G = Zeta.Core.CoEmpowerGraph
module F = Zeta.Core.CostarFederations
module I = Zeta.Core.ImdbDataset

let private graph () : G.Graph =
    { G.N = 3
      G.Identity = [| 1; 2; 3 |]
      G.Adjacency = [| [| 1 |]; [| 0; 2 |]; [| 1 |] |]
      G.Role = [| G.Creator; G.Audience; G.Audience |] }

let private links =
    F.reverseMint (
        I.parsePrincipals
            [ "tconst\tordering\tnconst\tcategory\tjob\tcharacters"
              "tt001\t1\tnm0001\tactor\t\\N\t\\N"
              "tt001\t2\tnm0002\tactress\t\\N\t\\N" ]
    )

let private clock = { M.Phase = 7L; M.Utc = "2026-06-19T12:00:00Z"; M.UncertaintyMs = 5L }

let private dora: SocietalDora.Metrics =
    { EmpowermentFrequency = 0.7
      CaptureRate = 0.3
      MeanRecoveryLength = 1.5
      MirrorRate = 0.1
      MeanCoupledGain = 0.4
      MeanQpg = 0.3
      QpgWeightedEmpowerment = 0.25 }

[<Fact>]
let ``the dashboard is one complete scriptless HTML page composing graph + clock + grounding + minted links`` () =
    let html = D.renderPage clock true "IMDb" (graph ()) links (Some dora)
    html.StartsWith("<!DOCTYPE html>", System.StringComparison.Ordinal) |> should equal true
    html.Contains "</html>" |> should equal true
    html.Contains "<script" |> should equal false
    html.Contains "<svg" |> should equal true // the federation graph
    html.Contains "phase 7" |> should equal true // Zeta-NTP clock
    html.Contains "grounded — backed by IMDb" |> should equal true
    html.Contains "nm0001" |> should equal true // a minted link
    html.Contains "Societal-DORA health" |> should equal true // the dials section

[<Fact>]
let ``dora = None omits the dials section`` () =
    let html = D.renderPage clock true "IMDb" (graph ()) links None
    html.Contains "Societal-DORA health" |> should equal false
    html.Contains "<svg" |> should equal true // graph still present

[<Fact>]
let ``the dashboard render is deterministic`` () =
    D.renderPage clock true "IMDb" (graph ()) links (Some dora)
    |> should equal (D.renderPage clock true "IMDb" (graph ()) links (Some dora))
