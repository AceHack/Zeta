# Pre-registration — H5: is cross-frame confidence comparability COMPETENCE-dependent or DOMAIN-dependent

**Committed BEFORE generation.** H3 (operator-priority, best-single ~90%): the
parameter-free confidence rule pays +3.2pp, cross-frame separation rank-biserial 1.000.
H4 (arithmetic, best-single ~31%): the same rule does not pay (+0.3pp), cross-frame
separation collapses — but within-arm confidence IS predictive (confound resolved), so the
cross-frame failure is real. Two points, and they are confounded: H3 is BOTH a different
domain AND high-competence; H4 is BOTH a different domain AND near-chance. So "domain-
dependent" and "competence-dependent" are not yet separable.

## Hypothesis

**H5:** cross-frame confidence comparability is COMPETENCE-dependent, not merely domain-
dependent. On a THIRD domain that is DIFFERENT IN KIND from operator-priority but where
gemma2:2b is HIGHLY COMPETENT (best-single ≥ ~85%), the parameter-free τ=0 rule pays
(McNemar CI excludes zero) and the cross-frame gap is bimodal about zero (CV optimism ≈ 0) —
recovering the H3 pattern on a non-priority task.

## The design that separates the two explanations

The confound is broken by choosing a domain that differs from H3 in KIND but matches it in
COMPETENCE:

- **Different in kind from operator-priority:** not a priority/precedence rule.
- **High competence (best-single ≥ ~85%):** so the model is NOT near chance, unlike H4.

Candidate domain: **easy lookup / synonym selection** — "pick the option that means the same
as X" or "pick the odd one out" over short menus (4–6 options) where a 2B model is reliably
right. Different reasoning from both operator-priority and arithmetic; verifiable; tunable to
high accuracy by keeping menus short and distractors clear.

Outcomes and what each means:

| H5 result | interpretation |
|---|---|
| rule PAYS, gap bimodal | **competence-dependent** — comparability returns at high accuracy on a new domain; the axis is competence-gated, the more useful claim |
| rule does NOT pay, within-arm confidence still predictive | **domain-dependent** — high competence is not sufficient; operator-priority was special |
| within-arm confidence NOT predictive | inconclusive — this domain is a case-(b) non-test, pick another |

## FALSIFIER (pre-declared)

H5 (competence-dependence) is REJECTED if, on a high-competence (best-single ≥ 85%)
different-in-kind domain, the parameter-free rule does NOT beat best-single (McNemar CI
includes/below 0) WHILE within-arm confidence IS predictive (both arms' correct-vs-wrong
Mann–Whitney reject). That combination says high competence did not restore comparability,
so the effect is domain-specific, not competence-driven.

Confirmation requires: parameter-free lift with McNemar CI excluding zero AND CV optimism
≈ 0 AND within-arm confidence predictive (so it is a real test).

## Anti-numerology guard

Two consistent points (H3 works/high, H4 fails/low) are a coincidence of direction, not an
identification. H5 is the third point that would separate competence-dependence from domain-
dependence. Even a confirming H5 gives three points on one model; the claim stays
"consistent with competence-dependence on gemma2:2b," not "established," until a second model
or a fourth domain replicates. Register every step; do not round up.

## N, power, register

N=600, matching H3/H4. If best-single lands too high (≥ ~97%) the headroom is too small to
resolve — reported underpowered, not refutation. Register `unmetered`; same logprob-
portability limit. Leak falsifier green on both instruction regions, reported per-arm.

## Pointers

- `docs/research/2026-08-27-h4-confound-resolved-...md` — the confound resolution that
  motivates H5.
- `src/Core.TypeScript/observe/decorrelation-stats.ts` — `mannWhitneyU`, `mcNemar`,
  `kFoldThresholdSelector`, `detectAnswerLeak`.
