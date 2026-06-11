module Zeta.Tests.DevRoomTests

open global.Xunit
open Zeta.Core

[<Fact>]
let ``the dev room hangs all four landmark doors`` () =
    Assert.Equal<string list>([ "salon"; "darkhall"; "bowling alley"; "skatium" ], DevRoom.landmarks)

[<Fact>]
let ``enter opens a door by landmark; unknown -> None`` () =
    match DevRoom.enter "salon" with
    | Some d -> Assert.Equal("salon", d.Landmark)
    | None -> Assert.Fail "salon door must hang"
    match DevRoom.enter "darkhall" with
    | Some d -> Assert.True(d.Stations |> List.exists (fun s -> s.Name = "play"))
    | None -> Assert.Fail "darkhall door must hang"
    Assert.True((DevRoom.enter "casino").IsNone)

[<Fact>]
let ``the boundary is the UNION of every room's stations`` () =
    let expected =
        Salon.stations.Length
        + Arcade.cabinets.Length
        + BowlingAlley.lanes.Length
        + Skadium.rinks.Length
    Assert.Equal(expected, DevRoom.boundary.Length)
    // a station from each room shows up in the union
    let names = DevRoom.boundary |> List.map (fun s -> s.Name)
    Assert.Contains("tie", names) // salon
    Assert.Contains("play", names) // darkhall
    Assert.Contains("score", names) // bowling alley
    Assert.Contains("weave", names) // skatium

[<Fact>]
let ``liveStations are the working slices across all rooms (a subset of the boundary)`` () =
    Assert.True(DevRoom.liveStations |> List.forall (fun s -> s.Live))
    Assert.True(DevRoom.liveStations.Length <= DevRoom.boundary.Length)
    let live = DevRoom.liveStations |> List.map (fun s -> s.Name)
    Assert.Contains("tie", live)
    Assert.Contains("score", live)

[<Fact>]
let ``self-measurement: resolution is live-coverage in (0,1] and matches the counts (BigFloat-for-devops)`` () =
    let r = DevRoom.resolution ()
    Assert.True(r > 0.0 && r <= 1.0)
    let expected = float DevRoom.liveStations.Length / float DevRoom.boundary.Length
    Assert.Equal(expected, r, 12)
