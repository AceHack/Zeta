namespace Zeta.Core

/// ChipAudio — **hear and see the system with the same math** (Aaron 2026-06-11: "think about how to
/// use Cayley for audio too — 8-bit sawtooth and all that, with only text format; more generator
/// ZetaId points for audio; and MIDI; we can HEAR and SEE the system using the same math").
///
/// The unification is literal: the PHASE that draws (TimeGen's phasor, the Cayley rotor sweeping a
/// curve) IS the oscillator. A chip waveform is a pure function of phase — saw is the phase itself,
/// square its sign, triangle its fold, sine its projection (the rotor's real part). So one generated
/// phase stream renders BOTH a pixel position and an audio sample: same seed, same math, two senses.
/// Text-only (the storage law): an audio voice is a gen line — (waveform-zetaid, version, seed,
/// freq, …) — samples are never stored, always regenerated. MIDI rides as note events (a track is a
/// text section; notes are crossings — the membrane already carries them).
[<RequireQualifiedAccess>]
module ChipAudio =

    /// The chip waveforms — each a pure function of phase in [0, 1) milli-units (0..999), returning
    /// a signed 8-bit-style amplitude (−128..127): exact integers, byte-lockable, no drift.
    type Waveform =
        | Saw
        | Square
        | Triangle
        | SineApprox // the rotor's projection, quantized (integer parabola approximation — chip-true)

    /// Amplitude at a phase (phaseMilli wrapped into [0,1000)). Total, exact, deterministic.
    let sampleAt (w: Waveform) (phaseMilli: int) : int =
        let p = ((phaseMilli % 1000) + 1000) % 1000

        match w with
        | Saw -> (p * 255) / 999 - 128
        | Square -> if p < 500 then 127 else -128
        | Triangle -> if p < 500 then (p * 510) / 499 - 128 else 127 - ((p - 500) * 510) / 499
        | SineApprox ->
            // integer parabola: chip-true sine shape (the rotor's projection without floats)
            let q = if p < 500 then p else 999 - p
            let a = (q * (1000 - q)) / 980 // 0..~255 hump
            if p < 500 then a - 128 |> max -128 |> min 127 else 128 - a |> max -128 |> min 127

    /// A voice: a waveform generator at a frequency, phased from the COMMON-CAUSE seed via TimeGen —
    /// the phase at tick t is (t × freqMilli) mod 1000 offset by the generator's own phase.
    let voiceSample (g: TimeGen.Generator) (contributor: uint64) (w: Waveform) (freqMilli: int) (tick: int) : int =
        let t = TimeGen.at g contributor tick
        let basePhase = int (t.Phase * 159.154943) % 1000 // the generated phase, milli-mapped
        sampleAt w ((basePhase + tick * freqMilli) % 1000)

    /// A MIDI-style note event as a crossing payload (the membrane carries music like everything):
    /// `note:<channel>:<key>:<velocity>` — on the wire, in the text, replayable.
    let noteCrossing (channel: int) (key: int) (velocity: int) : string =
        sprintf "note:%d:%d:%d" (channel &&& 0xF) (key &&& 0x7F) (velocity &&& 0x7F)
