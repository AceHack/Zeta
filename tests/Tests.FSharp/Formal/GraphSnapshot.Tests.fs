module Zeta.Tests.Formal.GraphSnapshotTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core

module S = Zeta.Core.GraphSnapshot
module G = Zeta.Core.CoEmpowerGraph

// ═══════════════════════════════════════════════════════════════════
// GraphSnapshot — content-addressed MerkleFS persistence of the reified
// CoEmpowerGraph: canonical-JSON blob → ContentStore (XxHash128). Same
// graph ⇒ same hash (content-addressing); round-trips losslessly.
// ═══════════════════════════════════════════════════════════════════

// a small mixed-role graph (a 3-node path; node 1 a Creator)
let private g () : G.Graph =
    { G.N = 3
      G.Identity = [| 2; 1; 3 |]
      G.Adjacency = [| [| 1 |]; [| 0; 2 |]; [| 1 |] |]
      G.Role = [| G.Audience; G.Creator; G.Audience |] }

[<Fact>]
let ``serialize → deserialize round-trips losslessly`` () =
    match S.deserialize (S.serialize (g ()) |> function Ok j -> j | Error e -> failwith e) with
    | Ok back -> back |> should equal (g ())
    | Error e -> failwith e

[<Fact>]
let ``content-addressing: the same graph stores to the same hash (dedup)`` () =
    let s0 = S.emptyStore ()
    match S.store (g ()) s0 with
    | Ok(h1, s1) ->
        match S.store (g ()) s1 with
        | Ok(h2, _) -> h1 |> should equal h2 // identical graph → identical content hash
        | Error e -> failwith e
    | Error e -> failwith e

[<Fact>]
let ``store then load returns the graph by its content hash`` () =
    let s0 = S.emptyStore ()
    match S.store (g ()) s0 with
    | Ok(h, s1) ->
        match S.load h s1 with
        | Some(Ok back) -> back |> should equal (g ())
        | other -> failwithf "expected Some(Ok graph), got %A" other
    | Error e -> failwith e

[<Fact>]
let ``different graphs get different content hashes`` () =
    let s0 = S.emptyStore ()
    let g2 = { (g ()) with G.Identity = [| 9; 1; 3 |] } // perturb one identity
    match S.store (g ()) s0, S.store g2 s0 with
    | Ok(h1, _), Ok(h2, _) -> h1 |> should not' (equal h2)
    | _ -> failwith "store failed"

[<Fact>]
let ``load of an absent hash is None`` () =
    let s0 = S.emptyStore ()
    // hash some other graph, then look it up in the EMPTY store
    match S.store (g ()) (S.emptyStore ()) with
    | Ok(h, _) -> S.load h s0 |> should equal (None: Result<G.Graph, string> option)
    | Error e -> failwith e
