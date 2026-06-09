module Zeta.Tests.GameCatalogTests

open global.Xunit
open Zeta.Core

let private fpA = GameFingerprint.fingerprint [| 0x6Auy; 0x05uy |]
let private fpB = GameFingerprint.fingerprint [| 0x12uy; 0x00uy |]

[<Fact>]
let ``assign + uncertainty: per-game uncertainty keyed by fingerprint`` () =
    let cat = GameCatalog.empty |> GameCatalog.assign fpA 5.0
    Assert.Equal(Some 5.0, GameCatalog.uncertainty fpA cat)
    Assert.Equal(None, GameCatalog.uncertainty fpB cat) // uncatalogued -> None (unknown, not zero)

[<Fact>]
let ``reduce lowers uncertainty (playing), clamped at 0`` () =
    let cat = GameCatalog.empty |> GameCatalog.assign fpA 5.0 |> GameCatalog.reduce fpA 2.0
    Assert.Equal(Some 3.0, GameCatalog.uncertainty fpA cat)
    let floored = GameCatalog.reduce fpA 100.0 cat
    Assert.Equal(Some 0.0, GameCatalog.uncertainty fpA floored) // can't go negative

[<Fact>]
let ``resolved: at/below threshold = sufficiently played; uncatalogued = false (unknown != resolved)`` () =
    let cat = GameCatalog.empty |> GameCatalog.assign fpA 0.5
    Assert.True(GameCatalog.resolved 1.0 fpA cat)
    Assert.False(GameCatalog.resolved 0.1 fpA cat)
    Assert.False(GameCatalog.resolved 1.0 fpB cat) // unknown game is NOT resolved

[<Fact>]
let ``total + mostUncertain drive what to play next`` () =
    let cat = GameCatalog.empty |> GameCatalog.assign fpA 2.0 |> GameCatalog.assign fpB 7.0
    Assert.Equal(9.0, GameCatalog.total cat, 9)
    Assert.Equal(Some(fpB.Sha256, 7.0), GameCatalog.mostUncertain cat) // B has the most -> play it next
    Assert.Equal(None, GameCatalog.mostUncertain GameCatalog.empty)
