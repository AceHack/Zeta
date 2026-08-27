# The headroom IS addressable — token-confidence gating pays where agreement-gating did not

**Register:** unmetered (local Ollama, gemma2:2b, no measured joule).
**Pre-registration:** `docs/research/decorrelation-preregistration-h3-selector-signal.md`
(H3), committed at `9bf21efb19` BEFORE this generation. **Raw log:**
`data/decorr-h3-signal-raw.jsonl` (600 items: both configs' chosen index + token
confidence, recomputable without a model). **Ledger:** `data/decorrelation-research.jsonl`
(`schema decorr/v2-h3-signal`).

## The arc across three experiments

- **H2 — agreement-gating does NOT pay** (0.0pp lift). It falls back to the stronger config
  on disagreement, discarding any per-item information.
- **H3 — token-confidence gating PAYS** (+3.2pp lift, CI [1.8, 4.6]). Picking whichever
  config is more confident per item recovers nearly the whole oracle headroom.

The two are not in tension: H2 showed the headroom is real (an oracle reaches 94.3% vs
best-single 90.7%); H3 asked Otto's sharper question — is that headroom ADDRESSABLE by an
observable signal? — and the answer is yes.

## The result (N=600)

| quantity | value |
|---|---|
| canonical accuracy | 90.7% |
| clause-swap accuracy | 88.5% |
| best single | 90.7% |
| discordant items | 51 (19 clause-wins, 32 canon-wins) |
| Mann–Whitney on the confidence gap between the two groups | z=6.04, rank-biserial=1.000, rejects |
| **confidence-gated selector** | **93.8% [91.6, 95.5]** |
| McNemar (selector vs canonical) | +3.2pp, CI [1.8, 4.6], resolved |
| oracle ceiling (union) | ~94.3% |

**The confidence-gated selector captures ~3.1 of the 3.6pp oracle headroom.** The model's
own token confidence identifies which prompt is right, per item, well enough to pay.

## The perfect separation is REAL — checked, because a perfect score is suspect (W13)

rank-biserial = 1.000 is a perfect separation, and the standing rule (`suspectExtremeRate`,
W13) says treat that as a leak or degeneracy until proven otherwise. So it was interrogated
against the raw log:

- **On all 19 clause-wins, clause-swap was the more confident config (gap +0.043 to +0.662).
  On all 32 canon-wins, canonical was the more confident (gap −0.307 to −0.039).** The
  confidence gap predicts the winner on every discordant item.
- **It is NOT a constant bias.** Canonical is the more confident config on 387/600 items
  overall, yet the signal still tracks per-item correctness — so "always trust canonical"
  would be wrong 19 times and the confidence signal is not just picking one config.
- **The gaps are bounded away from zero** on both sides (nearest to zero: +0.043 and
  −0.039), so the separation is not a knife-edge that a few flipped items would erase.

That said, the separation is measured on **51 discordant items** — small. The honest claim
is "perfect on this sample," not "perfectly calibrated in general." At larger N the
separation will almost certainly soften; the load-bearing result is the SELECTOR accuracy
(+3.2pp, CI [1.8, 4.6] over all 600 items), which does not depend on the separation being
literally perfect — only on confidence being a usefully-correlated signal.

## Why this is a real intelligence-per-watt lever

The whole decorrelation program exists to find ways to make the same models do more at the
same energy by composing them differently. H3 is the first axis that PAYS under the honest
stats: two prompt framings of one 2B model, gated by the model's own confidence, reach
93.8% where either alone reaches ~90%. No larger model, no new training — just a second
framing and a confidence read that is free with the same call.

The composition is: run canonical and clause-swap, take the higher-confidence answer. That
is the produce/verify asymmetry's honest cousin — not "checking is easier than producing"
(the leaked claim, retracted), but "the model is calibrated enough that its confidence
ranks its own framings correctly."

## What this does NOT claim

- **Not metered.** It is 2× calls (canonical + clause-swap). The +3.2pp accuracy is real;
  whether it beats spending that same 2× compute another way (a bigger model, more items)
  is an energy question, and the register stays `unmetered` until a joule is measured. The
  next experiment is the metered one: accuracy-per-runner-second, confidence-gated pair vs.
  a single larger model at matched wall-clock.
- **Not general calibration.** The perfect group separation is an N=51 sample property, not
  a claim that gemma2:2b confidence is calibrated everywhere.
- **Not "clause-swap is good."** clause-swap alone is WORSE (88.5% < 90.7%). The value is
  entirely in the confidence-gated COMPOSITION, which is the point: a weaker second framing
  still pays when a signal knows when to trust it.

## The honest headline, updated

clause-swap DECORRELATES (proven, H2). The headroom it opens is ADDRESSABLE by token
confidence (proven, H3: +3.2pp, CI [1.8, 4.6]). Whether it PAYS PER WATT is the next,
metered question. The axis is now the first in the program to earn "pays" on accuracy —
one step short of "pays per watt."

## Pointers

- `data/decorr-h3-signal-raw.jsonl` — 600 rows (both configs' index + confidence); the
  Mann–Whitney separation and the +3.2pp selector both recompute from this without a model.
- `src/Core.TypeScript/observe/decorrelation-stats.ts` — `mannWhitneyU`, `mcNemar`,
  `suspectExtremeRate` (the W13 rule that forced the perfect-separation check).
- `docs/research/2026-08-26-clause-swap-decorrelates-but-does-not-pay.md` — H2, the 0.0pp
  agreement-gating result this completes.
