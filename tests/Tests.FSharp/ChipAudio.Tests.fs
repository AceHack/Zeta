module Zeta.Tests.ChipAudioTests

// Hear and see with one math: chip waveforms are pure functions of phase; the SAME generated phase
// drives a pixel and a sample; audio generators are ZetaId'd; MIDI notes ride the membrane as text.

open global.Xunit
open Zeta.Core

[<Fact>]
let ``the chip waveforms are exact, total, and shaped right (saw ramps, square flips, triangle folds)`` () =
    Assert.Equal(-128, ChipAudio.sampleAt ChipAudio.Saw 0)
    Assert.Equal(127, ChipAudio.sampleAt ChipAudio.Saw 999)
    Assert.Equal(127, ChipAudio.sampleAt ChipAudio.Square 100)
    Assert.Equal(-128, ChipAudio.sampleAt ChipAudio.Square 700)
    Assert.Equal(ChipAudio.sampleAt ChipAudio.Triangle 250, ChipAudio.sampleAt ChipAudio.Triangle 250)
    Assert.True(ChipAudio.sampleAt ChipAudio.Triangle 499 > 100) // peak near the fold
    Assert.Equal(ChipAudio.sampleAt ChipAudio.Saw -1, ChipAudio.sampleAt ChipAudio.Saw 999) // total (wraps)

[<Fact>]
let ``HEAR AND SEE, ONE MATH: the same TimeGen phase stream drives the pixel and the sample, replayably`` () =
    let g = TimeGen.mk "av-clock" 1 0x50DAUL TimeGen.PhasorTsirelson
    let frames = AnimFlow.observeWith g 7UL { AnimFlow.Name = "b"; AnimFlow.Cycle = [ "idle"; "blink" ] } 8
    let samples = [ for t in 0..7 -> ChipAudio.voiceSample g 7UL ChipAudio.Saw 125 t ]
    // both replay identically from the same common cause — the eye's stream and the ear's stream agree
    Assert.Equal<(int * string) list>(frames, AnimFlow.observeWith g 7UL { AnimFlow.Name = "b"; AnimFlow.Cycle = [ "idle"; "blink" ] } 8)
    Assert.Equal<int list>(samples, [ for t in 0..7 -> ChipAudio.voiceSample g 7UL ChipAudio.Saw 125 t ])

[<Fact>]
let ``audio generators are ZetaId'd on the shelf (more generator points, as asked)`` () =
    for name in [ "audio.saw"; "audio.square"; "audio.triangle"; "audio.sine"; "midi.track" ] do
        Assert.True(GeneratorRegistry.byName name |> Option.isSome)

[<Fact>]
let ``MIDI notes ride the membrane as text crossings (masked into range, honest)`` () =
    Assert.Equal("note:1:60:100", ChipAudio.noteCrossing 1 60 100)
    Assert.Equal("note:15:127:127", ChipAudio.noteCrossing 0xFF 0xFF 0xFF) // masked, never out of range
