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

    // ── auto-harmonize, no synchronization (Aaron 2026-06-11: "you should be able to auto-harmonize
    // with others that need things done in rhythm WITHOUT needing synchronization — like dancing, or
    // singing"). The common-cause seed makes it free: two voices on the same generator never exchange
    // a message — they are ALREADY in time. Harmony is then just a RATIO (the scale-free tuning law):
    // sing a fifth = play at 3:2 of the partner's frequency; dance a half-time = move at 1:2. The
    // consonance is structural — the periods coincide exactly every (num·den) of the base period,
    // forever, with zero coordination. Dancers don't message each other; they share the music. ──

    /// Derive a consonant partner frequency by an exact rational ratio (3:2 the fifth, 2:1 the
    /// octave, 1:2 half-time…) — integer milli, exact: harmony as arithmetic on the shared clock.
    let harmonize (num: int) (den: int) (freqMilli: int) : int =
        freqMilli * max 1 num / max 1 den

    /// FREESTYLE WITHIN THE HARMONY (Aaron, completing the figure: "then you can move in rhythm and
    /// use feedback channels in the moment to freestyle — within the harmony"): the clock is never
    /// touched (the band does not stop); the variation rides the FEEDBACK CORNER as a BOUNDED phase
    /// offset — `TimeGen.feedback` is already the right primitive (deterministic, clamped). Jazz, as
    /// architecture: the changes are shared (the common cause), the solo is feedback-driven (the open
    /// corners), and the bound keeps every excursion consonant (you bend the note, never the time).
    let freestyle (maxStep: float) (target: float) (observed: float) (phaseOffset: float) : float =
        TimeGen.feedback target observed maxStep phaseOffset

    /// Two voices on ONE generator at a rational ratio: returns tick indices (within `span`) where
    /// their phases COINCIDE (both at phase 0 mod 1000) — the downbeats both hit without ever
    /// speaking. Nonempty for any rational ratio: consonance is a theorem of the common cause.
    let coincidences (freqA: int) (freqB: int) (span: int) : int list =
        [ for t in 1 .. span do
              if (t * freqA) % 1000 = 0 && (t * freqB) % 1000 = 0 then yield t ]
