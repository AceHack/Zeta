# Selectors turn the oracle into a system — and the hat lift is underpowered at N=150

**CAVEAT (added 2026-08-26):** the `third-call-verifier` selector here used the SAME
verifier prompt later shown to leak the answer key (see
`2026-08-26-verification-buys-abstention-not-accuracy.md`, RETRACTED, and W10:
58.7% → 98.0% when the producer is handed the rule). On these EASY short menus the effect
is muted (gemma-alone is already 95%, leaving no room), so the "matches-best-single,
underpowered" conclusion still stands — but any verifier number in this doc must be read
with the leak in mind. The selector *machinery* is correct; the verifier *inputs* were
contaminated.

**Register:** unmetered (local Ollama, qwen2.5:0.5b + gemma2:2b, no measured joule).
**Raw per-item log:** `data/decorr-selectors-raw.jsonl` (150 rows, recomputable without a
model). **Ledger:** `data/decorrelation-research.jsonl` (`schema decorr/v2-selector`).
**Occasion:** Otto's W4 (implement real selectors) and W5 (re-examine the hat lift under
the honest stats). The earlier hat headline was "28% → 93%."

## The correction W4 forces: the union was never a system

`unionUpperBound` — "A OR B correct" — is an ORACLE. It assumes a selector that always
picks the correct member when either is right. No such selector exists. A real system has
to decide which answer to take using only decision-time information (the two answers,
their confidences, or a third verifier call) — never the ground truth. `decorrelation-
selectors.ts` implements the real selectors and scores them against two honest bars:
**max(A,B)** (the stronger model alone) and the **union oracle**.

## What the hat pipeline actually measures (N=150)

| config | accuracy (95% CI) |
|---|---|
| qwen2.5:0.5b alone (producer) | 22.7% [16.7, 30.0] |
| gemma2:2b alone (co-producer) | 95.3% [90.7, 97.7] |
| **agreement-gating** (fallback to gemma) | 95.3% [90.7, 97.7] — **matches best-single** |
| **third-call-verifier** (gemma verifies on disagreement) | 97.3% [93.3, 99.0] — **matches best-single** |
| union oracle (unattainable) | 97.3% [93.3, 99.0] |

Reading, honestly:

- **The "28% → 93%" framing compared the pipeline to the WEAK producer (qwen), not to the
  strong one.** The honest bar is gemma-alone at 95.3%. Against that bar:
  - agreement-gating gets **0.0pp lift** and pays a 2.0pp selection tax.
  - third-call-verifier gets **+2.0pp lift** and reaches the oracle exactly (0.0pp tax) —
    the verifier is a *perfect* selector on the disagreement items here.
- **But +2.0pp at N=150 is UNDERPOWERED.** 95.3% [90.7, 97.7] and 97.3% [93.3, 99.0] have
  overlapping CIs. The verdict is `matches-best-single`, not `beats`. Resolving a 2pp lift
  needs thousands of items, not 150.
- **And it costs ~3× energy.** 938ms/item across three model calls (qwen produce + gemma
  produce + gemma verify) versus a single 250ms gemma call. Three times the compute for a
  gain that is currently inside the noise.

## Why this is the honest version of a real result, not a debunking

The verifier IS a perfect selector on this item set — it reaches the union oracle. That is
genuinely the produce/verify asymmetry working: gemma, given a candidate, decides correctly
whether it satisfies the rules even on items a weak producer botches. The asymmetry is real
(F1 established it; this confirms it as a *selector*, not just a catch-rate).

What is NOT yet established is that the asymmetry PAYS. The lift over the best single model
is 2pp and underpowered, at 3× energy. The correct next move is the one the honest stats
point at:

1. **Raise N** to resolve the 2pp lift (power calc: a 2pp lift near p=0.95 needs
   N ≈ several thousand — smaller than the p=0.5 case because variance is lower near the
   boundary, but still far above 150).
2. **Find gemma's failure region.** At 95.3% gemma-alone, the task barely discriminates —
   there is almost no room for a selector to add value. The pipeline can only earn its 3×
   cost where the best single model actually fails. That is where to point the next item
   set (harder/adversarial menus where gemma-alone drops below ~80%).
3. **Measure the joule** before any "intelligence-per-watt" claim. 3× calls is 3× energy
   only if the calls cost the same; the latencies (938ms total) are recorded and waiting
   for a real power denominator.

## What the numbers do NOT license

- No claim that the hat pipeline beats gemma-alone. The lift is +2.0pp with overlapping
  CIs — `matches-best-single`.
- No intelligence-per-watt claim. Energy is unmeasured; on latency alone the pipeline is
  ~3× more expensive for a within-noise gain.
- The "28% → 93%" headline is retired: it measured lift over the weak producer, which is
  not the bar. The bar is the strongest single model, and against it the lift is small and
  unresolved.

## Pointers

- `src/Core.TypeScript/observe/decorrelation-selectors.ts` — the real selectors, scored
  against max(A,B) and the union oracle with 95% CIs. Pure functions of per-item
  observations, recomputable from the raw log without a model.
- `scripts/run-decorr-selectors.ts` — the runner that produced this table.
- `data/decorr-selectors-raw.jsonl` — 150 per-item observations (choices, verifier
  verdicts, latencies).
- `docs/research/2026-08-26-the-tiny-agent-society-on-free-runners-vote-was-the-wrong-operator.md`
  — F2 (the catch-rate framing this supersedes with a full accuracy + CI).
