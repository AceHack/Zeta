# PR area statistics

_13,010 merged PRs · 16 areas · temporal split · generated 2026-08-27T09:44:37.596Z_

**The BNN earns its place — but only under distribution shift.**

| model | accuracy | Δ vs baseline | macro F1 | where baseline abstains |
|---|---:|---:|---:|---:|
| closed-form baseline | 58.8% | — | 28.1% | 0.0% |
| majority class | 3.9% | -54.9pp | 0.5% | 2.3% |
| random forest | 66.6% | +7.8pp | 21.0% | 22.0% |
| BNN (ADF probit, one-vs-rest) | 71.9% | +13.2pp | 23.5% | 17.9% |
| hybrid: baseline where it speaks, forest elsewhere | 61.7% | +2.9pp | 27.6% | 22.0% |
| _NULL random forest (labels shuffled)_ | 5.2% | — | 1.6% | — |
| _NULL BNN (labels shuffled)_ | 4.5% | — | 2.9% | — |

Label-shuffle null: 5.2% against a majority-class floor of 3.9%.

| comparison | b | c | p | favours |
|---|---:|---:|---:|---|
| random forest vs closed-form baseline | 545 | 291 | 1.2e-18 | random forest |
| BNN (ADF probit, one-vs-rest) vs closed-form baseline | 591 | 163 | 9.0e-58 | BNN (ADF probit, one-vs-rest) |
| BNN (ADF probit, one-vs-rest) vs random forest | 347 | 173 | 1.9e-14 | BNN (ADF probit, one-vs-rest) |
| hybrid: baseline where it speaks, forest elsewhere vs random forest | 291 | 450 | 5.7e-9 | random forest |

- Coverage: 73.6% parseable, 26.4% unlabellable.
- Disagreement set: 3,061 PRs (32.0% of parseable).
- k-means ARI 0.112 (null -0.000) — clusters are not the taxonomy.
- **Macro-F1 goes the other way**: baseline 28.1% vs 27.6% for the best model (hybrid: baseline where it speaks, forest elsewhere). The models win on accuracy by serving the large areas; they are no better on the tail.
