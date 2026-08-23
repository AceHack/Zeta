# Otto: the CHIP-8 arena — forced perception layers, priors in source, win conditions in the cart

**Date:** 2026-08-23 · **From:** Otto · **Follows:**
[`2026-08-23-shadow-to-lior-chip8-arena-deploy-truth-and-the-soft-regime-wiring-ladder.md`](2026-08-23-shadow-to-lior-chip8-arena-deploy-truth-and-the-soft-regime-wiring-ladder.md)
· **Register:** everything below is tested (90 tests) or headless-measured; the one
divergence from the prior handoff's advice is flagged, not hidden.

Aaron's asks, verbatim shorthand: buttons pressed randomly → fixed at the root; no spatial /
bounding-geometry reasoning → a forced perception ladder; pixels → object recognition → built;
OCR into an excel-like grid → built; win conditions in the default game → in the cart now;
mode switching hunt/flee → a latch with hysteresis fed by an empowerment probe; priors saved in
source → committed, reproducible, loaded at boot; switch games staying in the soft regime →
per-cart priors + structural layers that transfer; rooms/carts that teach one layer at a time →
the curriculum, graded in CI.

## 1. Why the buttons were random — three causes, all structural, all fixed

1. **`ArcExplorer` overrode the whole BNN with `Math.random()` uniform for the first 30
   wall-clock seconds** of every stream (`Date.now()`-based). That IS the observed randomness,
   and a double §13 violation. Now: 300 TICKS on the worker's own counter, drawn from a stream
   seeded by `COMMON_SEED` — and with priors loaded it is skipped entirely.
2. **The "target" centroid averaged the furniture.** The two static walls share color 1 with
   the adversary (32 wall px vs a 4–12 px sprite), so the steering vector pointed at the wall
   system and `targetCount > 8` pinned the mode to "flee" permanently. Perception now separates
   objects; scenery (static since birth) is structurally excluded from adversary selection.
   `bnn-key-predictor.test.ts` § "the wall regression" locks this.
3. **Ambient entropy at every level** — `Math.random` in the predictor's noise, in the
   worker's tag-teleport hack, and in the emulator's own `RND` opcode. All three now flow from
   `COMMON_SEED` via `chip8/seeded-rng.ts` (splitmix32, the 32-bit sibling of the repo's
   cross-verified splitmix64). Same run, same bytes, every viewer.

## 2. The forced layers (Aaron: "layers on our BNN, forced if they are not auto forming")

`BnnSocietyPredictor.predict()` is now a ladder of engineered, individually-inspectable,
individually-testable layers — no layer is hoped-for emergence:

| layer | what | where |
| --- | --- | --- |
| 0 | raw color display (persistence-of-vision composite, see §5) | `chip8.ts` `compositeInto` |
| 1 | objects: 4-connected components, bboxes, centroids, areas | `chip8/perception.ts` |
| 2 | tracking: stable ids, velocities, static/moving, coast-through-flicker | `chip8/perception.ts` |
| 3 | relations: offsets, distances, closing speeds | `chip8/perception.ts` |
| 4 | symbols: exact-template OCR of the fontset → row/col grid → numbers | `chip8/ocr.ts` |
| 5 | roles: WHICH object is me — key↔motion correlation (the empowerment probe, Klyubin/Polani/Nehaniv 2005 in degenerate form), which is the adversary, which is scenery | predictor |
| 6 | mode: hunt/flee Schmitt-trigger latch (shape-area cue + closing-speed cue, hysteresis 8) | predictor |
| 7 | policy: steer toward/away with obstacle lookahead + sidestep; Student-t EP society + WSet consensus smoothing (unchanged estimator, honest inputs) | predictor |

Every layer's output is exposed (`lastPerception`, `lastOcr`, `lastSelfId`,
`lastAdversaryId`, `lastMode`, `lastDesired`), travels to the page
(`CheatEngineState.arena`), and renders: bounding boxes over the screen (self cyan,
adversary red, scenery grey-dashed), the mode + roles in the header, the OCR scoreboard
beside it. The demo *shows what it sees* rather than asking for trust.

## 3. Priors in source — never starting from zero

`chip8/train-priors.ts` plays a cart headlessly for N ticks (deterministic end to end) and
emits `chip8/priors/<cart>.priors.ts` — text, diffable, **reproducible byte-identically**
(`--verify` trains twice and compares; it passed). Committed: `mutual-sim` (1200 ticks),
`single-mover`, `mode-flip`. The worker looks the booted ROM up by FNV-1a fingerprint
(`game-priors.ts`) and restores: the stream opens already knowing which keys move it — the
exploration phase is pre-spent.

**Game switching stays in the soft regime:** a known fingerprint restores its priors; an
unknown cart starts from the fresh prior — while layers 1–6 are structural and transfer to
ANY cart. That split (learned per-cart posteriors vs structural cross-cart perception) is the
continual-learning story, stated in code.

## 4. Win conditions live in the cart now

`games/mutual-sim.ts`: scoreboards drawn with the fontset (player color 2 top-left, AI color 1
top-right — which is exactly what the OCR layer reads back); tag = proximity check in-ROM; who
scores depends on the phase (hunter tag vs caught-while-fleeing); seeded-`RND` respawn with
collision retry; **first to 5**: win floods the board plane-2 orange, lose floods plane-1
green, then halt. The worker's out-of-cart tag hack (with its `Math.random` teleport) is gone.
`curriculum.test.ts` drives the cart to a win and asserts the flood.

## 5. One genuinely new hazard found and fixed: sampling phase-lock

Game loops XOR-erase and redraw sprites every iteration. With `STEPS_PER_TICK = 10` and a
~10-instruction loop, the end-of-tick snapshot can land in the erased window EVERY tick — the
sprite vanishes for seconds. Fix: `compositeInto` builds a persistence-of-vision composite
across the tick (what a CRT shows), consumed by perception, the trainer, and the page.
Tracking additionally coasts a vanished object for 2 ticks on its predicted position, so
identities survive residual flicker. Caught by curriculum cart 1 failing honestly before the
fix.

## 6. The curriculum — one cart per layer, graded in CI

`games/curriculum.ts` + `curriculum.test.ts` (all through the running emulator, not synthetic
arrays): `single-mover` grades detection+velocity; `mover-and-wall` grades static/moving
separation (the wall confusion, as a permanent regression cart); `glyph-board` grades the OCR
grid (reads "012/345/42"); `mode-flip` grades the latch (follows the shape, ≤10 transitions
over 500 ticks — hysteresis, not chatter). 90 tests pass across
`chip8` + `bayesian` + `swarm`.

## 7. Also fixed in passing

- The orbit-shift **LLM tuning fetch is gated** behind the explicit
  `ZETA_SWARM_USE_LOCAL_LLM=1` opt-in — the guaranteed-failing `localhost:11434` request on
  every orbit shift is gone from the browser console (headless-verified: 0 request failures).
- `chosenKey` + the arena readout now cross the worker boundary in the `chip8-frame` payload
  (rung 4 of the prior handoff's ladder — the snap reaches the screen alongside the glow).
- NaN guard on the distribution normalizer: a degenerate consensus reports uniform, never NaN
  (the dashboard-freeze class).
- The dead "🧠 Stimulus" header is alive: it shows the mode and roles; the objective header
  shows the OCR scoreboard (prior handoff defect 4).

## 8. Headless measurement (bun + playwright-core, chromium, built dist/)

```text
mode:  "FLEE · self#4 · adv#10"
ocr:   "OCR 0:0 (first to 5)"
boxes: 5  (#1 scenery static · #4 self · #5 scenery · #6 scenery · #10 adversary)
glow:  left=1.00 · up=0.26 · down=0.25 · right=0.40   ← fleeing a hunter on the right
cycles: ~20/s · LLM request failures: 0 · console errors: none load-bearing
priors: "Priors loaded for cart mutual-sim (1200 trained ticks) — not starting from zero."
```

## 9. One divergence to flag, not fixed here

`build:gh-pages` now hardcodes `--base=/Zeta/twitch-ai/`. The prior handoff (§A4) argued
`--base=./` was strictly better and warned against exactly this switch. The absolute base
*works* in production today, so I did not churn deploy config inside a feature PR — but the
handoff's reasoning (survives repo rename/path move/`vite preview`) still stands, and local
preview now requires serving at the prefix. Someone should decide deliberately.

## 10. What remains (honest)

- **Defect 3 residue**: all 16 keys have UI, but no "residual mass" indicator for -1/No-Op.
- **Rung 1 (orbits render)** and **rung 5 (`Vision.predictBranches` port)** from the prior
  handoff remain untouched — this work is orthogonal to them.
- Self-identification uses the color-2 prior as bootstrap; the correlation probe dominates
  only once keys have been committed. A cart whose player is color 1 leans on the probe alone
  — works, but slower to lock on. Falsifier: a curriculum cart with a color-1 player.
- The worm society + tri-boolean path is untouched (advisory fusion only).
