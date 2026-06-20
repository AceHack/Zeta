module Zeta.Tests.GeneratorRegistryTests

// Stable generators get ZetaIds; the filetype references artifacts by id. Content-addressed (the id
// is a pure function of name@version), so the same generator means the same id on every node — a
// treaty over generators. Plus the rotational (Cayley-Dickson) curve generator.

open global.Xunit
open Zeta.Core
module B = Zeta.Core.BoundaryLight

[<Fact>]
let ``ZetaIds are deterministic content-addresses: same name+version yields same 32-hex id, everywhere`` () =
    Assert.Equal(GeneratorRegistry.idOf "boundary.glow" 1, GeneratorRegistry.idOf "boundary.glow" 1)
    Assert.Equal(32, (GeneratorRegistry.idOf "boundary.glow" 1).Length)
    Assert.NotEqual<string>(GeneratorRegistry.idOf "boundary.glow" 1, GeneratorRegistry.idOf "boundary.glow" 2) // version bump = new id (never silent)
    Assert.NotEqual<string>(GeneratorRegistry.idOf "boundary.glow" 1, GeneratorRegistry.idOf "boundary.curve" 1)

[<Fact>]
let ``the registry round-trips: id <-> name, so a filetype can resolve either direction`` () =
    let e = GeneratorRegistry.byName "boundary.rotorCurve" |> Option.get
    Assert.Equal(Some e, GeneratorRegistry.byId e.ZetaId)
    Assert.True(GeneratorRegistry.byId "deadbeefdeadbeefdeadbeefdeadbeef" |> Option.isNone) // unknown id refused

[<Fact>]
let ``every known generator has a distinct id (no collisions in the stable set)`` () =
    let ids = GeneratorRegistry.known |> List.map (fun e -> e.ZetaId)
    Assert.Equal(List.length ids, ids |> List.distinct |> List.length)

[<Fact>]
let ``rng.splitmix64 is registered and its ZetaId is pinned (cross-verification byte-lock anchor)`` () =
    // The splitmix64 cross-verification oracle is `generated-from-ir`: it references
    // its generator by this content-addressed id. The id is byte-locked across TS
    // and F# in tests/cross-verification/generator-registry-id, so pin it here too —
    // any drift (a renamed generator, a changed hash) breaks this AND the oracle
    // reference at once, never silently.
    let e = GeneratorRegistry.byName "rng.splitmix64" |> Option.get
    Assert.Equal(1, e.Version)
    Assert.Equal("129c1fac3a48075b481c0f10f30deb06", e.ZetaId)
    Assert.Equal("129c1fac3a48075b481c0f10f30deb06", GeneratorRegistry.idOf "rng.splitmix64" 1)

[<Fact>]
let ``ROTOR: a quarter-turn unit rotor sweeps a seed vector around the center (the rotational generator)`` () =
    let re, im = B.rotorOf 1 4 1000 // 1/4 turn, unit growth (a circle)
    let curve = B.rotorCurve (B.p 10 10) 6.0 0.0 re im 4
    // seed (6,0) from center -> after 1/4 turns: (6,0),(0,6),(-6,0),(0,-6),(6,0) offset by center
    Assert.Equal(B.p 16 10, List.head curve) // start: center + (6,0)
    Assert.Equal(B.p 10 16, curve.[1]) // quarter turn -> +y
    Assert.Equal(B.p 4 10, curve.[2]) // half turn -> -x
    Assert.Equal(5, List.length curve)

[<Fact>]
let ``ROTOR spirals outward when growth > 1 (logarithmic boundary sweep, e.g. a hair strand)`` () =
    let re, im = B.rotorOf 1 12 1100 // 1/12 turn, 1.1x growth per step
    let curve = B.rotorCurve (B.p 0 0) 4.0 0.0 re im 6
    let d0 = let h = List.head curve in h.X * h.X + h.Y * h.Y
    let dn = let l = List.last curve in l.X * l.X + l.Y * l.Y
    Assert.True(dn > d0) // the strand grows away from the pivot as it turns
