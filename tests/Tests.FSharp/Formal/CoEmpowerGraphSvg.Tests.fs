module Zeta.Tests.Formal.CoEmpowerGraphSvgTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core

module G = Zeta.Core.CoEmpowerGraph
module V = Zeta.Core.CoEmpowerGraphSvg

// a star: Creator centre + 4 Audience leaves
let private star () : G.Graph =
    { G.N = 5
      G.Identity = [| 1; 2; 3; 2; 3 |]
      G.Adjacency = [| [| 1; 2; 3; 4 |]; [| 0 |]; [| 0 |]; [| 0 |]; [| 0 |] |]
      G.Role = [| G.Creator; G.Audience; G.Audience; G.Audience; G.Audience |] }

[<Fact>]
let ``render is well-formed, scriptless SVG`` () =
    let svg = V.render 240 (star ())
    svg.Contains "<svg" |> should equal true
    svg.Contains "</svg>" |> should equal true
    svg.Contains "<line" |> should equal true // the 4 star edges
    svg.Contains "<circle" |> should equal true
    svg.Contains "<script" |> should equal false

[<Fact>]
let ``edges are drawn once per undirected pair (a star has 4)`` () =
    let svg = V.render 240 (star ())
    let count (needle: string) (s: string) =
        (s.Split([| needle |], System.StringSplitOptions.None)).Length - 1
    count "<line" svg |> should equal 4

[<Fact>]
let ``a Creator node is ringed; render is deterministic and integer-coordinate`` () =
    let a = V.render 240 (star ())
    let b = V.render 240 (star ())
    a |> should equal b // deterministic
    // the Creator's ring is the r="12" circle
    a.Contains "r=\"12\"" |> should equal true
    a.Contains "viewBox=\"0 0 240 240\"" |> should equal true // integer viewport → byte-lockable
