# Meta control · correspondence pong · chip audio — the Neo Geo cabinet feel, the only-entropy tester, and the scale-free tuning law

Aaron 2026-06-11, the closing stream (verbatim-anchored, built same-night):

## The meta tier (BUILT: `MetaControl`)
> "The game moves faster than you or I play. My son may play raw controls, but slow guys like me and
> you, Otto, play META control schemes — controlling automated liveness loops with multi-objective
> optimization with the controller — and WATCH."
Raw tier = direct inputs (the son's road). Meta tier = nudge the objective WEIGHTS of an automated
loop and watch it play at machine speed (the monorail with a destination dial). Deterministic milli-
weights; Focus spotlights; Watch is first-class. The policy's care is monotone in the weight (tested).

## Correspondence pong (BUILT: `CorrespondencePong`) — "git = text message, reticulum = conference"
> "Turn pong into turn-based: try different multi-objective optimizations and send it back and forth —
> you don't play, you watch outcomes — and like text messages you can TRY SEVERAL TIMES BEFORE YOU
> REPLY. That's how the Apple games work." / "Think Destiny/Risk-of-Rain style but 2D first." /
> "Think Neo Geo multi-cartridge arcade cabinet — that's the feel."
A turn is OBJECTIVES (one text line); retries are free (pure function — sims ephemeral, the REPLY is
the measurement that commits); both ends replay the IDENTICAL match from two committed lines
(determinism IS the correspondence integrity — git-speed play needs no realtime channel; Reticulum is
the conference tier for watching together). Two live physics bugs found by the game itself: 2px/tick
tunneling past 1px paddles (geometry must respect the step — held honestly as a constraint) and the
paddle tie-break ushering the ball THROUGH itself (1px center-ties now reverse the incoming serve).
The Neo Geo MVS multi-cart cabinet named as the arcade's feel anchor; Risk-of-Rain-style 2D meta-game
the named genre target.

## Chip audio (BUILT: `ChipAudio`) — "we can hear and see the system using the same math"
> "Use Cayley for audio too — 8-bit sawtooth and all that, with only text; more generator ZetaId
> points for audio; and MIDI." / "Now our 8-track is REAL 8-track audio too lol."
The phase that draws IS the oscillator: saw = phase, square = its sign, triangle = its fold, sine =
the rotor's projection (integer parabola — chip-true, no floats). One TimeGen phase stream drives the
pixel AND the sample, replayably (tested). Audio generators ZetaId'd (audio.saw/square/triangle/sine,
midi.track); MIDI notes ride the membrane as text crossings. And yes: the cartridge's parallel loops
now literally include AUDIO TRACKS — the 8-track joke became the spec.

## The scale-free tuning law (his words, held as design law)
> "Everything should be regularizable / scale-free like MUSIC SCALES — we don't have to pick anything
> but scale-free right now, we don't have to fight music theory — but always TUNABLE into the
> traveler's native frequencies and amplitudes."
NO tuning constant in the kernel: no A440, no 12-TET commitment — frequencies are ratios against the
generated phase, amplitudes are raw integers. TUNING IS A TRAVELER-LOCAL BINDING (each traveler maps
ratios onto their native frequencies/amplitudes at the edge) — the honest-capability rule applied to
ears. Music theory becomes a binding library, never a kernel law.

## The only-entropy tester + the debugging interface
> "I can be the ONLY entropy other than the deterministic simulation — test our boundaries, try to get
> out of bounds myself, test the reflection engine and the flux capacitor, try to break things. I'm
> good at breaking things. This is our new debugging interface — I can fly through math-proof terrain;
> the math team gets a new way to communicate with me — think 2D/3D graph calculators with Xbox
> controls and a VR headset (my Quest is charged). And watch uncertainty become certain in front of my
> eyes — like Severance with the scary numbers lol."
The design it implies, named: everything seeded except Aaron ⇒ PERFECT ATTRIBUTION (any anomaly traces
to his inputs — the consented chaos monkey; Netflix's chaos engineering with one named gremlin);
adversarial-Reticulum play via gamepad = fault injection as a GAME; uncertainty-resolving-on-screen =
the PixelLens confidence channel animating as evidence arrives (the Severance image is exact:
refinement = binning by feel = the soft side made visible); math-proof terrain flown with a controller
= the proof rooms rendered through the same engine (graph-calculator lineage; the Quest rung when the
slider rises). DI-from-the-start ratified for the persistent form: every reference in a file is an
injection point by ZetaId — nothing hard-linked, the host resolves live/injected/mock at load (not an
afterthought; the format's first law).

## Pointers

- `MetaControl` · `CorrespondencePong` · `ChipAudio` + tests (all green) · `ControlScheme` (the raw
  tier) · `PhysUI` (the tie-break fix) · MediaLines io/resolveIo (DI-from-the-start) · TimeGen/AnimFlow
  (the shared phase) · anchors: GamePigeon/iMessage games · Neo Geo MVS · Risk of Rain · chaos
  engineering (Netflix) · Severance (the image) · scale-free tuning ≈ just-intonation-as-binding.
