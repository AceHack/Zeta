module Zeta.Tests.ObserveGridTests

open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.Observe
open Zeta.Core.FSharp.ObserveBridge

// ═══════════════════════════════════════════════════════════════════
// Bridge C — NextAction projected onto the 4x4 ActionGrid (C1: fixed home cell per kind).
// Geometry fixed (navigation label-independent — proven); World projects live cells + labels.
// ═══════════════════════════════════════════════════════════════════

let private item id ready amb needs =
    { Id = id; Title = id; Ready = ready; Ambiguous = amb; NeedsNewAction = needs }
let private world backlog op = { Backlog = backlog; Operator = op; Mode = None }
let private pos r c : ActionGrid.Position = { Row = r; Col = c }

let private nineKinds =
    [ "preserve_ferry"; "respond_to_operator"; "do_item"; "decompose"; "edit_grammar"
      "explore"; "play"; "self_reflect"; "free_time" ]

[<Fact>]
let ``each kind has a distinct fixed home cell (the C1 layout)`` () =
    let homes = nineKinds |> List.map (fun k -> (ObserveGrid.homeOfKind k).Value)
    Assert.Equal(9, homes |> Set.ofList |> Set.count)
    // spot-check the layout: free modes fill row 2; channel row 0; work row 1.
    Assert.Equal(pos 0 0, (ObserveGrid.homeOfKind "preserve_ferry").Value)
    Assert.Equal(pos 2 3, (ObserveGrid.homeOfKind "free_time").Value)
    Assert.Equal(pos 1 2, (ObserveGrid.homeOfKind "edit_grammar").Value)

[<Fact>]
let ``project labels all nine home cells; availability tracks the World`` () =
    let w = world [ item "r" true false false ] (Some { PendingMessage = true; PendingFerry = false })
    let grid = ObserveGrid.project w
    Assert.Equal(9, Map.count grid)
    let avail kind =
        match Map.tryFind (ObserveGrid.homeOfKind kind).Value grid with
        | Some(DynamicValue.Object kvs) ->
            kvs |> List.tryPick (fun (k, v) -> if k = "available" then Some v else None)
        | _ -> None
    Assert.Equal(Some(DynamicValue.Bool true), avail "respond_to_operator") // message pending
    Assert.Equal(Some(DynamicValue.Bool false), avail "preserve_ferry")     // no ferry
    Assert.Equal(Some(DynamicValue.Bool true), avail "do_item")             // ready item exists
    Assert.Equal(Some(DynamicValue.Bool false), avail "decompose")          // none ambiguous
    Assert.Equal(Some(DynamicValue.Bool true), avail "explore")             // free mode always live

[<Fact>]
let ``actionAt resolves a live cell to its action; dead/reserved cells -> None`` () =
    let w = world [ item "r" true false false ] None
    Assert.Equal(Some "do_item", ObserveGrid.actionAt (pos 1 0) w |> Option.map ObserveGrid.kindOf)
    Assert.Equal(Some "free_time", ObserveGrid.actionAt (pos 2 3) w |> Option.map ObserveGrid.kindOf)
    Assert.Equal(None, ObserveGrid.actionAt (pos 0 0) w) // no ferry -> dead
    Assert.Equal(None, ObserveGrid.actionAt (pos 3 3) w) // reserved

[<Fact>]
let ``the chooser's pick is always selectable at its own home cell`` () =
    // operator outranks: chooser picks RespondToOperator; selecting its home cell re-emits it.
    let w = world [ item "r" true false false ] (Some { PendingMessage = true; PendingFerry = false })
    let pick = Chooser.observe w
    Assert.Equal(Some(ObserveGrid.kindOf pick), ObserveGrid.actionAt (ObserveGrid.homeCell pick) w |> Option.map ObserveGrid.kindOf)
    // empty backlog: chooser picks explore; selectable at its cell.
    let w2 = world [] None
    let pick2 = Chooser.observe w2
    Assert.Equal(Some pick2, ObserveGrid.actionAt (ObserveGrid.homeCell pick2) w2)

[<Fact>]
let ``KEYSTONE: navigation stays label-independent across different World projections`` () =
    // Two very different Worlds -> two different projected label sets; geomNav must ignore them.
    let wA = ObserveGrid.project (world [ item "r" true false false ] (Some { PendingMessage = true; PendingFerry = true }))
    let wB = ObserveGrid.project (world [] None)
    Assert.True(ActionGrid.labelIndependentOver wA wB ActionGrid.geomNav)
