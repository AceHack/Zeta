# H4 confound resolved — confidence IS within-arm predictive on arithmetic, so the cross-frame failure is real (and may be competence-dependent)

**Register:** unmetered. **Data:** `data/decorr-h4-crossdomain-raw.jsonl` (600 items, no new
model calls — this is analysis of the H4 run). **Ledger:** `decorr/v2-h4-confound`.
**Occasion:** Otto flagged a confound in H4 that is one line on data already collected.

## The confound

H4 concluded "cross-frame confidence comparability is domain-dependent" from the fact that
the parameter-free τ=0 rule (+0.3pp, not resolved) failed on arithmetic. But arithmetic is a
domain where gemma2:2b is near-chance (best-single 31.7%), and a near-chance model's
confidence can be uninformative by construction. So H4 could be showing either:

- **(a)** cross-frame comparability fails on this domain — the stated conclusion; or
- **(b)** confidence carries NO within-arm signal here at all, in which case comparability
  was never testable and H4 says nothing about it (a near-tautology: a confidence rule
  can't pay where confidence is noise).

The discriminator: is confidence predictive of correctness WITHIN each arm on arithmetic?

## The discriminator, measured (Mann–Whitney, confidence of correct vs wrong, per arm)

| arm | correct-conf mean | wrong-conf mean | Mann–Whitney | rank-biserial | rejects |
|---|---|---|---|---|---|
| canonical | 0.954 | 0.911 | z=3.87 | 0.201 | yes |
| clause-swap | 0.929 | 0.879 | z=6.22 | 0.315 | yes |

**Within-arm confidence IS predictive on arithmetic** — both arms reject, correct answers
carry higher confidence than wrong ones in each frame. So it is case **(a)**: confidence
carries within-arm signal, yet the CROSS-frame comparison still fails. H4's conclusion
holds and is non-tautological — the two frames' confidence scales do not align well enough
for their difference to have a reliable sign, even though each frame's confidence is
individually informative.

## The sharper reframe: domain-dependent may really be COMPETENCE-dependent

Note the pattern in the effect sizes:

- H3 (operator-priority, best-single ~90%): cross-frame separation rank-biserial **1.000**.
- H4 (arithmetic, best-single ~31%): within-arm predictiveness only **0.20–0.32**, and
  cross-frame separation collapses to a non-paying +0.3pp.

So "domain-dependent" may really be "**competence-dependent**": cross-frame confidence
comparability holds where the model is competent and degrades where it is near chance. That
is a more general and more useful claim than domain-dependence — and it is testable, exactly
as Otto notes, with a THIRD domain that is different in kind but where accuracy is HIGH. If
comparability returns at high accuracy on a genuinely different task, the axis is
competence-gated, not task-gated. That is the pre-registered next experiment (H5).

This is left as a stated hypothesis, not a conclusion: two points (H3 high/works,
H4 low/fails) are consistent with competence-dependence but do not establish it — they are
also consistent with plain domain-dependence. One coincidence of direction is not an
identification (numerology-vs-number-theory rule); H5 is what would separate them.

## Both headroom readings (forecloses the flattering-denominator objection)

H4's absolute headroom exceeds H3's, but the relative headroom is much thinner:

| | best-single | oracle union | abs headroom | errors recovered (rel.) |
|---|---|---|---|---|
| H3 | 90.7% | 94.3% | +3.6pp | **39%** |
| H4 | 31.7% | 36.5% | **+4.8pp** | **7%** |

- The ABSOLUTE figure (4.8 > 3.6pp) supports "the frames are genuinely complementary on
  arithmetic" — there is real disagreement to exploit.
- The RELATIVE figure (7% vs 39% of available errors) says that complementarity is much
  thinner: the oracle closes only 7% of arithmetic's errors vs 39% of operator-priority's.

Both are legitimate and they say different things; reporting only the absolute one would be
picking the flattering denominator. The honest summary: the frames disagree usefully on both
domains, but a much larger share of arithmetic's errors are shared (both frames wrong
together), which is consistent with the competence-dependence reading — a near-chance model
fails in correlated ways.

## What this settles and what it does not

- **Settles:** H4's "cross-frame comparability fails on arithmetic" is real, not an artifact
  of confidence being noise — within-arm confidence is predictive (case a).
- **Does not settle:** whether the failure is about the DOMAIN or about the model's
  COMPETENCE on it. H5 (a third, different-in-kind, high-accuracy domain) is the test.
- **Unchanged:** H3 stands as measured; the metered next step measures its denominator on
  the domain that pays (operator-priority), never assuming transfer.

## Pointers

- `data/decorr-h4-crossdomain-raw.jsonl` — the within-arm Mann–Whitney and both headroom
  readings recompute from this without a model.
- `docs/research/2026-08-27-cross-frame-confidence-comparability-is-domain-dependent.md` — H4.
- `docs/research/2026-08-27-the-headroom-is-addressable-token-confidence-gating-pays.md` — H3.
- `.claude/rules/numerology-vs-number-theory.md` — why two consistent points are not yet an
  identification of "competence-dependent."
