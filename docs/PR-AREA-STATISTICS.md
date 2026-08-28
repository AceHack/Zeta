# PR area statistics

_13,142 merged PRs · 16 areas · temporal split · generated 2026-08-28T03:30:14.111Z_

**The BNN earns its place — but only under distribution shift.**

| model | accuracy | Δ vs baseline | macro F1 | where baseline abstains |
|---|---:|---:|---:|---:|
| closed-form baseline | 58.2% | — | 28.6% | 0.0% |
| majority class | 3.8% | -54.4pp | 0.5% | 2.2% |
| random forest | 66.2% | +8.0pp | 22.0% | 25.1% |
| BNN (ADF probit, one-vs-rest) | 73.8% | +15.6pp | 25.8% | 24.9% |
| hybrid: baseline where it speaks, forest elsewhere | 61.7% | +3.4pp | 28.6% | 25.1% |
| _NULL random forest (labels shuffled)_ | 4.6% | — | 1.5% | — |
| _NULL BNN (labels shuffled)_ | 4.8% | — | 1.9% | — |

Label-shuffle null: 4.8% against a majority-class floor of 3.8%.

| comparison | b | c | p | favours |
|---|---:|---:|---:|---|
| random forest vs closed-form baseline | 591 | 329 | 4.6e-18 | random forest |
| BNN (ADF probit, one-vs-rest) vs closed-form baseline | 704 | 192 | 2.6e-69 | BNN (ADF probit, one-vs-rest) |
| BNN (ADF probit, one-vs-rest) vs random forest | 432 | 182 | 2.1e-24 | BNN (ADF probit, one-vs-rest) |
| hybrid: baseline where it speaks, forest elsewhere vs random forest | 329 | 478 | 1.8e-7 | random forest |

- Coverage: 73.6% parseable, 26.4% unlabellable.
- Disagreement set: 3,085 PRs (31.9% of parseable).
- k-means ARI 0.128 (null -0.001) — clusters are not the taxonomy.
- **Macro-F1 goes the other way**: baseline 28.6% vs 28.6% for the best model (hybrid: baseline where it speaks, forest elsewhere). The models win on accuracy by serving the large areas; they are no better on the tail.
