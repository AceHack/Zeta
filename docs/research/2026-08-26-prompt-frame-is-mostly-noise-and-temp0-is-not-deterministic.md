# Prompt-frame is mostly noise — and temp=0 is not deterministic

**Register:** unmetered (local Ollama, gemma2:2b, no measured joule).
**Pre-registration:** `docs/research/decorrelation-preregistration.md` (H1), committed
before generation. **Raw ledger:** `data/decorrelation-research.jsonl` (`schema decorr/v2`).
**Occasion:** the corrected re-run after Otto's review reset the prompt-frame program.

## The finding the null arm forced into view

Before measuring any axis, the harness runs a NULL ARM: the identical prompt sent twice.
At temperature 0 with a fixed seed it *should* return the identical answer every time. It
did not.

> **gemma2:2b flipped its answer on 4 of 150 items (2.7%) when given a byte-identical
> prompt twice.** temp=0/seed=42 is not deterministic. That 2.7% is the intrinsic noise
> floor, and it is the bar every candidate axis must clear to count as anything at all.

This is why the null arm exists (Otto's W6). Without it, a 1–3% "decorrelation" reads as
a discovery; against the floor, it reads as the model disagreeing with itself.

## The candidate arms, measured against the floor

All arms perturb ONLY the instruction text and leave option ordering and indices
byte-identical (the contamination check enforces this, so the universal-controller
button interface is never broken). N=150 per arm on gemma2:2b.

| arm | kind | flip rate | vs 2.7% floor | φ/φ_max | verdict |
|---|---|---|---|---|---|
| null-identity | null | 2.7% | — (the floor) | — | baseline |
| blank-line | candidate | 1.3% | below | ~1.0 | within noise |
| synonym choose→pick | candidate | 2.7% | at floor | ~1.0 | within noise |
| trailing-whitespace | candidate | 1.3% | below | ~1.0 | within noise |
| clause-swap | candidate | **7.3%** | **above** | 0.632 | exceeds floor, **underpowered** |
| menu-reversed | reference-ceiling | 26.0% | far above | 0.324 | correlated (interface-breaking) |

Reading, honestly:

- **Three of four text perturbations are indistinguishable from doing nothing.** Adding a
  blank line, swapping one word, or appending whitespace moves the model no more than the
  model already moves against itself. As decorrelation axes, they are void.
- **clause-swap is the one text arm that moves the distribution** (7.3% > 2.7%). But its
  union-over-best gain (96% vs 94%) is UNDERPOWERED: resolving that 2pp gap at 80% power
  needs N≈1,861, not 150. So "clause-swap decorrelates" is a live hypothesis, not a
  result — the correct verdict is *underpowered*, and it must not be rounded up.
- **menu-reversed is the reference ceiling, not a candidate.** Reversing the menu flips
  26% of answers — that is how much decorrelation is physically on the table — but it
  moves the buttons, so it breaks the interface and cannot ship. It bounds the prize; it
  does not claim it.

## Why this is a real upgrade to the program, not a null result

The point of the decorrelation program is intelligence-per-watt: an axis that provably
decorrelates lets the same models do more at the same energy. This run did not find a
free axis in prompt text — and that is worth exactly as much as finding one, because it
stops the society from spending 2× energy on a second call that a blank line was supposed
to decorrelate. The honest negative closes a door that the earlier "φ=0.112, decorrelates
usefully" reading had left ajar.

It also produced a reusable instrument. `decorrelation-stats.ts` now reports φ, φ_max,
φ/φ_max, Yule's Q, κ, and Wilson CIs, and every axis is judged against a measured null
arm. The next axis — hat, model family, quantization, memory load, persona — runs through
the same gate, and the anti-sybil privacy boundaries (personas cannot see each other's
frosted/private state) make the persona axis genuinely engineered independence rather than
hoped-for independence.

## What the numbers do NOT license

- No claim that clause-swap decorrelates. It exceeds the floor; it is underpowered.
- No accuracy improvement from any candidate arm — the union is an ORACLE upper bound, not
  a system, and no real selector was measured here.
- No energy claim. Latency was recorded (≈240ms/call) but never converted to a joule; the
  register stays `unmetered` until a real power denominator is measured.

## Pointers

- `src/Core.TypeScript/observe/decorrelation-stats.ts` — φ_max, Yule's Q, κ, Wilson CIs,
  power N. Every number recomputable from the committed 2×2 tables without a model.
- `src/Core.TypeScript/observe/decorrelation-harness.ts` — arms, contamination check,
  honest verdict (no "decorrelates-usefully" without a measured selector and energy).
- `scripts/run-decorr-promptframe.ts` — the runner that produced this table.
- `.claude/rules/numerology-vs-number-theory.md` — "too many correlations is a WARNING";
  the null arm is the applied form of "a check that cannot fail is not a check."
