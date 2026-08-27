# Cross-frame confidence comparability is domain-dependent — the H3 rule does not transfer unchanged

**Register:** unmetered (local Ollama, gemma2:2b, no measured joule).
**Pre-registration:** `docs/research/decorrelation-preregistration-h4-crossdomain.md` (H4),
committed at `f4f5d86142` BEFORE this generation. **Raw log:**
`data/decorr-h4-crossdomain-raw.jsonl` (600 items). **Ledger:**
`data/decorrelation-research.jsonl` (`schema decorr/v2-h4-crossdomain`).
**Occasion:** Otto's cheapest-possible next test — run the H3 parameter-free rule,
unchanged, on a different question domain, to find out whether τ=0 is a property of the
model or of the H3 question set.

## The claim under test

H3 established, on the operator-priority menu domain, that the PARAMETER-FREE rule "pick the
config with higher token confidence" (τ=0) pays +3.2pp and survives CV with 0.0pp optimism —
because the confidence gap was bimodal straddling zero. The deeper claim: the model's
confidence is COMPARABLE ACROSS FRAMES (canonical-confidence and clause-swap-confidence on
the same scale, their difference has a meaningful sign). H4 tests whether that holds on a
DIFFERENT domain: arithmetic-constraint selection ("pick the largest even number", etc.) —
different reasoning, no shared rule text, same two prompt frames, same rule unchanged.

## Result (N=600, arithmetic domain): DOES NOT TRANSFER

| quantity | H3 (operator-priority) | H4 (arithmetic) |
|---|---|---|
| canonical / clause-swap accuracy | 90.7% / 88.5% | 29.3% / 31.7% |
| best single | 90.7% | 31.7% |
| oracle union (headroom) | 94.3% (+3.6pp) | 36.5% (**+4.8pp**) |
| Mann–Whitney on discordant gap | z=6.04, **rank-biserial=1.000** | z=2.20, **rank-biserial=0.307** |
| parameter-free selector lift | **+3.2pp, CI [1.8, 4.6]** | **+0.3pp, CI [−1.6, 2.3]** |
| McNemar resolved? | yes | **no** |
| 5-fold CV optimism | 0.0pp | 0.5pp |

**The parameter-free rule does not beat best-single on the arithmetic domain.** τ=0 was, in
substantial part, a property of the H3 question set — not a universal property of
frame-shifted confidence.

## Why — and the distinction that matters

This is NOT "the domain is too hard so there is nothing to gate." There IS headroom: best
31.7% → oracle 36.5% = **4.8pp**, even larger than H3's 3.6pp. The two frames are genuinely
complementary here too. What fails is the SIGNAL:

- On H3, the confidence gap separated the discordant groups PERFECTLY: all 19 clause-wins
  had gap>0, all 32 canon-wins had gap<0.
- On H4, the gap separates them only WEAKLY: 26/43 clause-wins have gap>0, 19/29 canon-wins
  have gap<0 — barely above chance. The gap distributions overlap almost entirely
  (clause-wins −0.46..+0.62, canon-wins −0.53..+0.51), medians +0.05 vs −0.06.

So confidence is still *weakly* comparable across frames on the arithmetic domain (the
Mann–Whitney rejects at z=2.20, medians ordered correctly), but nowhere near cleanly enough
for a parameter-free τ=0 rule to pay. **Cross-frame confidence comparability is real but
GRADED and DOMAIN-DEPENDENT, not universal.**

## What this does to the H3 result

It bounds it honestly, which is the point of running it:

- H3 stands as measured: on the operator-priority domain, the parameter-free rule pays
  +3.2pp and is CV-verified. That result is not retracted.
- But the GENERALIZATION "the model's confidence is comparable across frames" is now known
  to be domain-dependent: near-perfect on one domain, weak on another. The claim that
  graduates is narrower and truer — *confidence-comparability across prompt frames varies by
  domain, and is strong enough to pay on some domains and not others.*
- The practical consequence: a confidence-gated composition cannot be assumed to pay on a
  new task. It must be MEASURED per domain — the null result here is the standing warning
  against shipping the H3 rule as a general selector.

## The honest prior, revisited

H4's pre-registered falsifier fired (parameter-free rule does not beat best-single). The
prior it tested — "τ=0 might be domain-specific" — is confirmed. That the confidence signal
still weakly orders the groups (z=2.20) means the mechanism is not absent, just too noisy on
this domain to exploit without a tuned, domain-specific threshold — which would reintroduce
exactly the in-sample-optimism risk H3's CV was built to rule out.

## What this does NOT claim

- Not that confidence gating never transfers — only that it does not transfer UNCHANGED to
  this arithmetic domain. A third domain could land anywhere on the graded scale.
- Not that the arithmetic domain is unlearnable — best-single 31.7% is low, but the 4.8pp
  oracle headroom shows the frames disagree usefully; the failure is the selector signal,
  not the composition.
- No energy claim (unmetered), same logprob-portability limit as H3.

## Pointers

- `data/decorr-h4-crossdomain-raw.jsonl` — 600 rows; the weak separation (rank-biserial
  0.307) and the null lift both recompute from this without a model.
- `docs/research/2026-08-27-the-headroom-is-addressable-token-confidence-gating-pays.md` —
  H3, which this bounds.
- `src/Core.TypeScript/observe/decorrelation-stats.ts` — `mannWhitneyU`, `kFoldThresholdSelector`.
