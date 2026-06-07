module Zeta.Tests.GlobalsTests

open global.Xunit
open Zeta.Core

module G = Zeta.Core.Globals

let private sample () =
    G.empty
    |> G.set [ "patient"; "1"; "name" ] "Ada"
    |> G.set [ "patient"; "1"; "enc"; "1" ] "visit-a"
    |> G.set [ "patient"; "1"; "enc"; "2" ] "visit-b"
    |> G.set [ "patient"; "2"; "name" ] "Grace"

[<Fact>]
let ``set then get round-trips a value at a subscript path`` () =
    let g = sample ()
    Assert.Equal<string option>(Some "Ada", G.get [ "patient"; "1"; "name" ] g)
    Assert.Equal<string option>(None, G.get [ "patient"; "1"; "missing" ] g)

[<Fact>]
let ``kill removes the node and all descendants (subtree)`` () =
    let g = sample () |> G.kill [ "patient"; "1" ]
    Assert.Equal<string option>(None, G.get [ "patient"; "1"; "name" ] g)
    Assert.Equal<string option>(None, G.get [ "patient"; "1"; "enc"; "1" ] g)
    Assert.Equal<string option>(Some "Grace", G.get [ "patient"; "2"; "name" ] g) // sibling untouched

[<Fact>]
let ``data reports 0/1/10/11 by value-and-children status`` () =
    // give "patient";"1";"enc" its own value too, so it is value+children (11)
    let g = sample () |> G.set [ "patient"; "1"; "enc" ] "enc-root"
    Assert.Equal(0, G.data [ "patient"; "9" ] g) // undefined
    Assert.Equal(1, G.data [ "patient"; "1"; "name" ] g) // value, no children
    Assert.Equal(10, G.data [ "patient"; "1" ] g) // no own value, has children
    Assert.Equal(11, G.data [ "patient"; "1"; "enc" ] g) // value AND children

[<Fact>]
let ``nextChild iterates immediate subscripts in ordinal order ($ORDER)`` () =
    let g = sample ()
    Assert.Equal<string option>(Some "1", G.nextChild [ "patient" ] None g) // first child
    Assert.Equal<string option>(Some "2", G.nextChild [ "patient" ] (Some "1") g) // next after "1"
    Assert.Equal<string option>(None, G.nextChild [ "patient" ] (Some "2") g) // end
    Assert.Equal<string option>(Some "1", G.nextChild [ "patient"; "1"; "enc" ] None g)
    Assert.Equal<string option>(Some "2", G.nextChild [ "patient"; "1"; "enc" ] (Some "1") g)

[<Fact>]
let ``nextNode walks every defined node depth-first ($QUERY) and terminates`` () =
    let g = sample ()
    // start before the first node; collect the full traversal
    let rec walk acc (p: G.Path) =
        match G.nextNode p g with
        | Some n -> walk (n :: acc) n
        | None -> List.rev acc

    let all = walk [] []
    Assert.Equal(4, List.length all)
    // ordinal-path order: enc subscripts sort before "name" ('e' < 'n')
    Assert.Equal<G.Path>([ "patient"; "1"; "enc"; "1" ], List.head all)
    Assert.Equal<G.Path>([ "patient"; "2"; "name" ], List.last all)

[<Fact>]
let ``children lists deduped immediate subscripts; count is defined-node count`` () =
    let g = sample ()
    Assert.Equal<string list>([ "1"; "2" ], G.children [ "patient" ] g)
    Assert.Equal<string list>([ "1"; "2" ], G.children [ "patient"; "1"; "enc" ] g)
    Assert.Equal(4, G.count g)
