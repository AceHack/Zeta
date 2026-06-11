# What the snap is for — the adapter economy (use cases across the system)

Aaron 2026-06-12: "keep the snap useful — what can we use it for in our system?" The honest
answer: `findAdapter` is a small function with a long reach, because "two ports that don't speak
the same type + the toolbox piece that completes the flow" recurs everywhere we compose:

1. **Capability resolution (SHIPPED today):** `MediaLines.resolveIoWith` — the ladder grows a
   rung: Live → Injected → **Adapted** (host has a different capability + the piece; the binding
   names BOTH — never a silent substitution) → Mock. A cartridge on a host without the exact
   interface degrades to the nearest honest fit instead of straight to Mock.
2. **Format bridges (the four-oracle treaty):** .lines ↔ SVG dialect ↔ hex-in-JSON goldens —
   serializers ARE adapter pieces; a missing converter is a NAMED toolbox gap, not a crash.
3. **Phase-space pivots:** time-domain port → frequency-domain port; the adapter is the DFT
   (SpectralPivot), cost-tagged O(n²) hard / O(n) soft — the O-parametrized strategy picker and
   the adapter finder are the same decision.
4. **Units of measure (the Mars Climate Orbiter lesson):** lbf-out → N-in REPELS; the unit
   conversion is the piece. The snap refusing incompatible units at a glance is the MCO collision
   prevented at the UI layer, for kids.
5. **Audio/tempo joins:** two voices at different tempos snap through the rational-ratio piece
   (harmonize) — the multitrack law's sprocket as a toolbox shape.
6. **Version bridges:** ZetaId version bump = new id (never silent) — a v1 consumer meeting a v2
   provider needs an explicit migration piece; findAdapter makes upgrade paths visible and
   refusable instead of implicit.
7. **Room doors (XMS-door register):** two rooms with different interfaces connect through a
   declared adapter door — the boundary stays society's, the adaptation stays explicit.
8. **Pedagogy (the GraphEdit feel):** when blocks repel, the system can SAY which piece is
   missing — constructive refusal; the toolbox gap is the lesson.

The economics: every verified module (Q#-ratified, math-signed) becomes a TRUSTABLE toolbox
piece — verification feeds the adapter economy. Vera/math items: brief addendum §8–10.
