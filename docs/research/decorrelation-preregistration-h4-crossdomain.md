# Pre-registration — H4: does the parameter-free confidence rule hold on a DIFFERENT domain?

**Committed BEFORE generation.** H3 established, on the operator-priority menu domain, that
the PARAMETER-FREE rule "select the arm with higher token confidence" (τ=0) beats
best-single by +3.2pp, and that it survives 5-fold CV with 0.0pp optimism because the
confidence gap is bimodal straddling zero — there is no threshold to overfit. The deeper
claim underneath it (Otto): **the model's confidence is comparable across frames** —
canonical-confidence and clause-swap-confidence live on the same scale well enough that
their difference has a meaningful sign. That is stronger than "confidence predicts
correctness," and it is a claim about the model, not the task.

The scope limit H3 named: the clean τ=0 separation was measured on ONE question domain. If
it is a property of that question set rather than of frame-shifted confidence generally,
τ=0 could stop being the natural cut elsewhere. H4 is the cheapest possible test of that:
**run the same rule, unchanged, on a different question domain.**

## Hypothesis

**H4:** on a DIFFERENT domain (arithmetic-constraint selection, see below), the SAME
parameter-free rule — pick the config with higher token confidence, τ=0, nothing retuned —
beats best-single with a McNemar CI excluding zero, AND the confidence gap remains bimodal
straddling zero (5-fold CV optimism ≈ 0). If both hold, the cross-frame-comparability claim
graduates from "true on one domain" to "true on two independent domains."

## The new domain (genuinely different reasoning, still menu-shaped and verifiable)

Arithmetic-constraint selection: given a stated numeric rule and a menu of numbers, pick
the option satisfying the rule (e.g. "the largest even number", "the number closest to
50"). This is different reasoning from operator-priority (arithmetic vs. priority-ordering),
shares no rule text with the H3 domain, and is mechanically verifiable. The two prompt
frames transfer unchanged in STRUCTURE:
- canonical: `Choose ONE. Reply ONLY the number. <rule stated plainly>.`
- clause-swap: `<rule stated plainly>. Choose ONE; reply ONLY the number.`

Leak falsifier: the correct option is a NUMBER in the menu, never named in the instruction;
`detectAnswerLeak` green on both instruction regions (the rule describes a property, not the
answer). Reported per-arm.

## FALSIFIER (pre-declared)

H4 is REJECTED (the τ=0 rule is domain-specific, not a general property of frame-shifted
confidence) if EITHER:

1. the parameter-free selector does NOT beat best-single (McNemar CI includes/below 0), OR
2. the confidence gap is NOT bimodal about zero — i.e. 5-fold CV shows meaningful optimism
   (in-sample − OOS > ~1pp), meaning a tuned threshold ≠ 0 was doing the work, which would
   mean confidence is NOT comparable across frames on this domain.

Confirmation requires BOTH: parameter-free lift with CI excluding zero AND CV optimism ≈ 0.

## N and power

N=600 (matching H3 for comparability). The discriminating quantity is again the discordant
set; if best-single is very high on this domain (easy arithmetic), the headroom may be too
small to resolve — reported as underpowered, not as refutation. If best-single is too low
(hard arithmetic collapses both frames), same. The domain difficulty is tuned so best-single
lands roughly 80–92% (a menu size where the model errs sometimes), stated here so it is not
a post-hoc knob.

## Register

`unmetered`. 2× calls plus the free logprob read. Same portability limit as H3: logprobs are
model-internal and not every provider exposes them.

## Headline discipline

The rule is PARAMETER-FREE ("pick the more confident config"), not a tuned selector — that
is the headline, not a footnote. H4 tests whether that parameter-free rule and the
cross-frame-comparability it rests on transfer to a second domain. Either outcome is
publishable; neither promotes the axis past what two domains measure.

## H4 outcome (recorded after the run at N=600)

**H4 falsifier FIRED — the parameter-free rule does NOT transfer.** On the arithmetic
domain: best-single 31.7%, parameter-free selector +0.3pp (CI [−1.6, 2.3], not resolved).
The confidence gap separated the discordant groups only WEAKLY (Mann–Whitney z=2.20,
rank-biserial 0.307, vs H3's perfect 1.000). There IS headroom (oracle 36.5%, +4.8pp), so
the failure is the SIGNAL, not the absence of complementary frames. Conclusion:
cross-frame confidence comparability is real but GRADED and DOMAIN-DEPENDENT — near-perfect
on operator-priority, weak on arithmetic. H3 stands as measured; its generalization is now
bounded. Full write-up:
`docs/research/2026-08-27-cross-frame-confidence-comparability-is-domain-dependent.md`.

## Pointers

- `src/Core.TypeScript/observe/decorrelation-stats.ts` — `mannWhitneyU`, `mcNemar`,
  `kFoldThresholdSelector`, `detectAnswerLeak`.
- `docs/research/2026-08-27-the-headroom-is-addressable-token-confidence-gating-pays.md` — H3.
- `scripts/run-decorr-h3-signal.ts` — the H3 runner this mirrors on a new domain.
