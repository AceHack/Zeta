module Zeta.Tests.SalonTests

open System.Text
open global.Xunit
open Zeta.Core

let private b (s: string) = Encoding.UTF8.GetBytes s

[<Fact>]
let ``the salon door gathers its stations (the navigable floorplan entry)`` () =
    let names = Salon.stations |> List.map (fun s -> s.Name)
    Assert.Contains("tie", names)
    Assert.Contains("braid", names)
    Assert.Contains("weave", names)
    Assert.Contains("bob", names)
    // every station points at a module (the code pointer is never empty)
    Assert.True(Salon.stations |> List.forall (fun s -> s.Module.Length > 0))

[<Fact>]
let ``the salon's signage names the quantum/topology-is-hairdressing work`` () =
    Assert.Equal("salon", Salon.name)
    Assert.Contains("topology is hairdressing", Salon.does)

[<Fact>]
let ``the live entrance: Salon.tie works and matches the SoftTie fitting it delegates to`` () =
    let a = b "the quick brown fox jumps over the lazy dog"
    let c = b "the quick brown fox JUMPED over the lazy dog"
    Assert.Equal<SoftTie.SoftTie<byte[]> option>(SoftTie.tieBytes 0.6 a c, Salon.tie 0.6 a c)
    // identical strands tie at full strength through the door
    match Salon.tie 0.6 a a with
    | Some t -> Assert.Equal(1.0, t.Strength, 10)
    | None -> Assert.Fail "identical strands must tie at the salon door"

[<Fact>]
let ``liveStations are the working slices (tie is live; braid/weave/bob await wiring)`` () =
    let live = Salon.liveStations |> List.map (fun s -> s.Name)
    Assert.Contains("tie", live)
    Assert.DoesNotContain("braid", live) // stub verb, not a working slice yet
    Assert.True(Salon.liveStations |> List.forall (fun s -> s.Live))
