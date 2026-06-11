module Zeta.Tests.MagneticPortsTests

// The type system felt through the fingers: compatible pieces attract, incompatible repel, the snap
// is the click — no error messages, the pieces just don't want to.

open global.Xunit
open Zeta.Core

let private tvId = GeneratorRegistry.idOf "interface.universal-tv" 1
let private audioId = GeneratorRegistry.idOf "audio.saw" 1

[<Fact>]
let ``compatibility is source->sink with matching type ids; transforms face both ways`` () =
    let src = MagneticPorts.port 0 0 MagneticPorts.Source tvId
    let snk = MagneticPorts.port 9 0 MagneticPorts.Sink tvId
    let wrongType = MagneticPorts.port 9 0 MagneticPorts.Sink audioId
    let sameDir = MagneticPorts.port 9 0 MagneticPorts.Source tvId
    let xform = MagneticPorts.port 9 0 MagneticPorts.Transform tvId
    Assert.True(MagneticPorts.compatible src snk)
    Assert.False(MagneticPorts.compatible src wrongType)
    Assert.False(MagneticPorts.compatible src sameDir)
    Assert.True(MagneticPorts.compatible src xform)

[<Fact>]
let ``THE MAGNET: compatible pieces pull together; incompatible push apart (the kid feels the rule)`` () =
    let src = MagneticPorts.port 10 10 MagneticPorts.Source tvId
    let goodSink = MagneticPorts.port 20 10 MagneticPorts.Sink tvId
    let badSink = MagneticPorts.port 20 10 MagneticPorts.Sink audioId
    let (fxGood, _) = MagneticPorts.force src goodSink
    let (fxBad, _) = MagneticPorts.force src badSink
    Assert.True(fxGood > 0) // pulled toward the good fit (it's to the right)
    Assert.True(fxBad < 0) // pushed away from the wrong fit
    Assert.Equal((0, 0), MagneticPorts.force src src) // coincident: no NaN, no force

[<Fact>]
let ``dragging feels the field: a piece between a good and a bad fit drifts toward the good one`` () =
    let good = MagneticPorts.port 30 10 MagneticPorts.Sink tvId
    let bad = MagneticPorts.port 10 10 MagneticPorts.Sink audioId
    let mutable hand = MagneticPorts.port 20 10 MagneticPorts.Source tvId
    for _ in 1..30 do
        hand <- MagneticPorts.dragTick [ good; bad ] hand
    Assert.True(hand.Body.Pos.X > Chip9Phys.ofInt 20) // drawn rightward, toward the compatible piece

[<Fact>]
let ``the SNAP is the click: overlap + compatibility = connected; overlap without compatibility never snaps`` () =
    let src = MagneticPorts.port 20 10 MagneticPorts.Source tvId
    Assert.True(MagneticPorts.snapped src (MagneticPorts.port 20 10 MagneticPorts.Sink tvId))
    Assert.False(MagneticPorts.snapped src (MagneticPorts.port 20 10 MagneticPorts.Sink audioId))
    Assert.False(MagneticPorts.snapped src (MagneticPorts.port 40 10 MagneticPorts.Sink tvId)) // right type, too far: not yet

[<Fact>]
let ``registered and cost-declared; the shelf-wide budget lint still holds`` () =
    Assert.True(GeneratorRegistry.byName "ui.magnetic-ports" |> Option.isSome)
    Assert.Equal<string list>([], ComplexityRegistry.unstated ())

// ── the shader shelf + the A/V sync law ──

[<Fact>]
let ``the pixel-shader family is registered and cost-declared (post-generators over colorAt)`` () =
    for s in [ "shader.antialias"; "shader.xbr"; "shader.hq2x"; "shader.crt-scanline"; "shader.crt-phosphor"; "shader.crt-curvature"; "shader.ntsc" ] do
        Assert.True(GeneratorRegistry.byName s |> Option.isSome)
    Assert.Equal<string list>([], ComplexityRegistry.unstated ())

[<Fact>]
let ``A/V MATCH BY DEFAULT: one generator drives frames and samples in lockstep; MIX is a declared second clock`` () =
    let g = TimeGen.mk "av" 1 0xA7AUL TimeGen.PhasorTsirelson
    let anim = { AnimFlow.Name = "b"; AnimFlow.Cycle = [ "idle"; "blink" ] }
    // matched: same generator, same contributor — frame tick t pairs with sample tick t, always
    let frames = AnimFlow.observeWith g 7UL anim 6 |> List.map fst
    let samples = [ for t in 0..5 -> t, ChipAudio.voiceSample g 7UL ChipAudio.Square 250 t ]
    Assert.Equal<int list>(frames, samples |> List.map fst) // the SAME ticks: matched by default
    // mixed: a DIFFERENT generator for audio is allowed — but it is a different declared clock
    let g2 = TimeGen.mk "audio-only" 1 0xBEA7UL TimeGen.PhasorTsirelson
    Assert.NotEqual(ChipAudio.voiceSample g 7UL ChipAudio.Square 250 3, ChipAudio.voiceSample g2 7UL ChipAudio.Square 250 3)

[<Fact>]
let ``a snap makes a FOUR-CORNER connection: feedback open by default; closing it is an explicit act`` () =
    let src = MagneticPorts.port 20 10 MagneticPorts.Source tvId
    let snk = MagneticPorts.port 20 10 MagneticPorts.Sink tvId
    match MagneticPorts.connect src snk with
    | Some conn ->
        Assert.True(conn.FeedbackOpen) // the default: flow opens the feedback corners
        Assert.False((MagneticPorts.withoutFeedback conn).FeedbackOpen) // closing is visible, never an omission
    | None -> failwith "should snap"
    Assert.True(MagneticPorts.connect src (MagneticPorts.port 40 10 MagneticPorts.Sink tvId) |> Option.isNone)
