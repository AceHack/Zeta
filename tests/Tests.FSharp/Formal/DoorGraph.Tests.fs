module Zeta.Tests.Formal.DoorGraphTests

open FsCheck.Xunit
open global.Xunit
open Zeta.Core

// The door model (#8775): rooms = leaves, doors = first-class permission-gated portals (#13 metered
// channels), Universal Exit Principle (a room with a door out is a room you can leave).

/// A small vault: keys → triage → forecast, with a back door triage → keys.
let private sample () =
    let v =
        DoorGraph.empty
        |> DoorGraph.addRoom "keys"
        |> DoorGraph.addRoom "triage"
        |> DoorGraph.addRoom "forecast"
    let v = match DoorGraph.addDoor (DoorGraph.door "keys" "triage" "k1") v with Ok x -> x | Error e -> failwith e
    let v = match DoorGraph.addDoor (DoorGraph.door "triage" "forecast" "k2") v with Ok x -> x | Error e -> failwith e
    let v = match DoorGraph.addDoor (DoorGraph.door "triage" "keys" "k1") v with Ok x -> x | Error e -> failwith e
    v

[<Fact>]
let ``addRoom is idempotent`` () =
    let v = DoorGraph.empty |> DoorGraph.addRoom "a" |> DoorGraph.addRoom "a"
    Assert.Equal(1, v.Rooms.Length)

[<Fact>]
let ``a door only connects rooms that exist in this vault (intra-vault)`` () =
    let v = DoorGraph.empty |> DoorGraph.addRoom "a"
    Assert.True(match DoorGraph.addDoor (DoorGraph.door "a" "ghost" "k") v with Error _ -> true | _ -> false)
    Assert.True(match DoorGraph.addDoor (DoorGraph.door "ghost" "a" "k") v with Error _ -> true | _ -> false)

[<Fact>]
let ``a door cannot self-loop (a room is not contained in itself)`` () =
    let v = DoorGraph.empty |> DoorGraph.addRoom "a"
    Assert.True(match DoorGraph.addDoor (DoorGraph.door "a" "a" "k") v with Error _ -> true | _ -> false)

[<Fact>]
let ``traverse is permission-gated: needs the door's key`` () =
    let v = sample ()
    // hold k1 → can go keys→triage; cannot go triage→forecast (needs k2)
    Assert.Equal(Ok "triage", DoorGraph.traverse (Set.ofList [ "k1" ]) "keys" "triage" v)
    Assert.True(match DoorGraph.traverse (Set.ofList [ "k1" ]) "triage" "forecast" v with Error _ -> true | _ -> false)
    // hold both → can go triage→forecast
    Assert.Equal(Ok "forecast", DoorGraph.traverse (Set.ofList [ "k1"; "k2" ]) "triage" "forecast" v)

[<Fact>]
let ``traverse fails when no door exists (no teleporting)`` () =
    let v = sample ()
    // there is no direct keys→forecast door
    Assert.True(match DoorGraph.traverse (Set.ofList [ "k1"; "k2" ]) "keys" "forecast" v with Error _ -> true | _ -> false)

[<Fact>]
let ``exits lists a room's lateral doors`` () =
    let v = sample ()
    let triageExits = DoorGraph.exits "triage" v |> List.map (fun d -> d.To) |> List.sort
    Assert.Equal<string list>([ "forecast"; "keys" ], triageExits)
    Assert.Equal<string list>([ "triage" ], DoorGraph.exits "keys" v |> List.map (fun d -> d.To))

[<Fact>]
let ``Universal Exit Principle: a room with no door out is flagged (a trap)`` () =
    let v = sample () // forecast has no outgoing door
    Assert.Equal<string list>([ "forecast" ], DoorGraph.roomsWithoutExit v)
    // give forecast a way back → no traps
    let v2 = match DoorGraph.addDoor (DoorGraph.door "forecast" "triage" "k2") v with Ok x -> x | Error e -> failwith e
    Assert.True(List.isEmpty (DoorGraph.roomsWithoutExit v2))

[<Property>]
let ``canTraverse holds iff a door exists and its key is held`` (hasKey: bool) =
    let v =
        DoorGraph.empty |> DoorGraph.addRoom "a" |> DoorGraph.addRoom "b"
        |> (fun g -> match DoorGraph.addDoor (DoorGraph.door "a" "b" "secret") g with Ok x -> x | Error e -> failwith e)
    let keys = if hasKey then Set.ofList [ "secret" ] else Set.empty
    DoorGraph.canTraverse keys "a" "b" v = hasKey
