module Zeta.Tests.MetaControlTests

// The meta tier: nudge objective weights, the automated loop plays at machine speed, you watch.
// Deterministic nudges; the policy's care is monotone in the weight; meta-play is a compression
// (slow weight crossings instead of every twitch).

open global.Xunit
open Zeta.Core
module P = Zeta.Core.Chip9Phys

[<Fact>]
let ``nudges are clamped, deterministic, and total (replayable thumb)`` () =
    let o = Map.ofList [ "defense", 900 ]
    let o2 = MetaControl.apply (MetaControl.Nudge("defense", 200)) o
    Assert.Equal(1000, Map.find "defense" o2) // clamped at the ceiling
    Assert.Equal<MetaControl.Objectives>(o2, MetaControl.apply (MetaControl.Nudge("defense", 200)) o) // replays
    let o3 = MetaControl.apply (MetaControl.Nudge("brand-new", -700)) Map.empty
    Assert.Equal(0, Map.find "brand-new" o3) // unknown objective: defaults 500, clamps at floor

[<Fact>]
let ``Focus spotlights one objective and halves the rest; Watch changes nothing`` () =
    let o = Map.ofList [ "defense", 600; "explore", 800 ]
    let f = MetaControl.apply (MetaControl.Focus "defense") o
    Assert.Equal(1000, Map.find "defense" f)
    Assert.Equal(400, Map.find "explore" f)
    Assert.Equal<MetaControl.Objectives>(o, MetaControl.apply MetaControl.Watch o)

[<Fact>]
let ``the policy's care is MONOTONE in the weight: more defense, faster gap-closing`` () =
    let paddle = { P.Pos = P.v2 (P.ofInt 2) (P.ofInt 4); P.Size = P.v2 P.one (P.ofInt 6); P.Vel = P.v2 0 0 }
    let ball = { P.Pos = P.v2 (P.ofInt 30) (P.ofInt 20); P.Size = P.v2 P.one P.one; P.Vel = P.v2 0 0 }
    let v lo = MetaControl.pongPolicy (Map.ofList [ "defense", lo ]) paddle ball
    Assert.True(v 1000 > v 500 && v 500 > v 100 && v 100 > 0) // monotone care
    Assert.Equal(0, v 0) // zero defense ignores the ball entirely

[<Fact>]
let ``the meta scheme is ZetaId-addressed and its inputs translate to meta crossings on the wire`` () =
    Assert.Equal(32, MetaControl.gamepadMeta.ZetaId.Length)
    Assert.Equal(Some "meta:nudge:defense:+50", MetaControl.metaOf "l1" |> Option.map MetaControl.payload)
    Assert.Equal(Some "meta:watch", MetaControl.metaOf "start" |> Option.map MetaControl.payload)
    Assert.True(MetaControl.metaOf "f13" |> Option.isNone) // honest None, as always

[<Fact>]
let ``TWO TIERS, ONE MATCH: dad's nudge changes how the loop returns the son's serve (raw + meta coexist)`` () =
    // son serves raw; the automated paddle under LOW defense barely moves; dad nudges defense up; it tracks
    let paddle = { P.Pos = P.v2 (P.ofInt 2) (P.ofInt 4); P.Size = P.v2 P.one (P.ofInt 6); P.Vel = P.v2 0 0 }
    let ball = { P.Pos = P.v2 (P.ofInt 30) (P.ofInt 24); P.Size = P.v2 P.one P.one; P.Vel = P.v2 (-(P.ofInt 2)) 0 }
    let lazyV = MetaControl.pongPolicy (Map.ofList [ "defense", 100 ]) paddle ball
    let nudged = [ 1..6 ] |> List.fold (fun o _ -> MetaControl.apply (MetaControl.Nudge("defense", 150)) o) (Map.ofList [ "defense", 100 ])
    let keenV = MetaControl.pongPolicy nudged paddle ball
    Assert.True(keenV > lazyV) // the watch tier steered the outcome without touching the paddle once
