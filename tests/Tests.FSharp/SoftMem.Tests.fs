module Zeta.Tests.SoftMemTests

open global.Xunit
open Zeta.Core

let private mem () =
    SoftMem.empty
    |> SoftMem.store (Cl3.vector 0.0 0.0 0.0) "origin"
    |> SoftMem.store (Cl3.vector 10.0 0.0 0.0) "far-x"
    |> SoftMem.store (Cl3.vector 0.0 10.0 0.0) "far-y"

[<Fact>]
let ``nearest returns the closest entry by geometric distance`` () =
    let m = mem ()
    Assert.Equal(Some "origin", SoftMem.nearest (Cl3.vector 1.0 1.0 0.0) m)
    Assert.Equal(Some "far-x", SoftMem.nearest (Cl3.vector 9.0 1.0 0.0) m)

[<Fact>]
let ``softRead is a normalized distribution, nearer entries weigh more`` () =
    let m = mem ()
    let read = SoftMem.softRead 5.0 (Cl3.vector 1.0 0.0 0.0) m
    Assert.Equal(1.0, read |> List.sumBy snd, 9)
    let wOrigin = read |> List.find (fun (c, _) -> c = "origin") |> snd
    let wFarX = read |> List.find (fun (c, _) -> c = "far-x") |> snd
    Assert.True(wOrigin > wFarX) // origin is closer to (1,0,0)

[<Fact>]
let ``small tau sharpens toward nearest, large tau diffuses toward uniform`` () =
    let m = mem ()
    let q = Cl3.vector 1.0 0.0 0.0
    let sharp = SoftMem.softRead 0.01 q m |> List.find (fun (c, _) -> c = "origin") |> snd
    let diffuse = SoftMem.softRead 1000.0 q m |> List.find (fun (c, _) -> c = "origin") |> snd
    Assert.True(sharp > 0.99) // ~hard nearest
    Assert.True(abs (diffuse - (1.0 / 3.0)) < 0.05) // ~uniform over 3 entries

[<Fact>]
let ``forward-momentum prefetch lands on the entry in the access direction`` () =
    let m = mem ()
    // at origin, moving in +x -> should prefetch far-x
    let pos = Cl3.vector 0.0 0.0 0.0
    let mom = Cl3.momentum 1.0 0.0 0.0 8.0 // heading +x at speed 8 -> projected (8,0,0)
    Assert.Equal(Some "far-x", SoftMem.prefetch pos mom m)

[<Fact>]
let ``empty memory reads to nothing (no fabricated hit)`` () =
    let m: SoftMem.SoftMem<string> = SoftMem.empty
    Assert.Equal(None, SoftMem.nearest (Cl3.vector 0.0 0.0 0.0) m)
    Assert.Empty(SoftMem.softRead 1.0 (Cl3.vector 0.0 0.0 0.0) m)

[<Fact>]
let ``readPosition is the kernel-weighted centroid, biased toward the query`` () =
    let m = mem ()
    let q = Cl3.vector 1.0 0.0 0.0
    let p = SoftMem.readPosition 5.0 q m
    // effective address pulled toward origin (the nearest), so its x < midpoint and >= 0
    Assert.True(p.E1 >= 0.0 && p.E1 < 5.0)
