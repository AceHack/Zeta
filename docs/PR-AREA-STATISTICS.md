# PR area statistics

_12,985 merged PRs · 16 areas · temporal split · generated 2026-08-27T04:58:13.746Z_

**The BNN earns its place — but only under distribution shift.**

| model | accuracy | Δ vs baseline | macro F1 | where baseline abstains |
|---|---:|---:|---:|---:|
| closed-form baseline | 58.9% | — | 28.0% | 0.0% |
| majority class | 3.9% | -55.0pp | 0.5% | 2.3% |
| random forest | 69.2% | +10.3pp | 21.7% | 23.8% |
| BNN (ADF probit, one-vs-rest) | 73.8% | +14.9pp | 23.5% | 29.6% |
| hybrid: baseline where it speaks, forest elsewhere | 62.1% | +3.2pp | 27.9% | 23.8% |
| _NULL random forest (labels shuffled)_ | 4.3% | — | 0.9% | — |
| _NULL BNN (labels shuffled)_ | 5.6% | — | 2.8% | — |

Label-shuffle null: 5.6% against a majority-class floor of 3.9%.

| comparison | b | c | p | favours |
|---|---:|---:|---:|---|
| random forest vs closed-form baseline | 480 | 147 | 3.8e-42 | random forest |
| BNN (ADF probit, one-vs-rest) vs closed-form baseline | 616 | 133 | 4.5e-75 | BNN (ADF probit, one-vs-rest) |
| BNN (ADF probit, one-vs-rest) vs random forest | 236 | 86 | 2.6e-17 | BNN (ADF probit, one-vs-rest) |
| hybrid: baseline where it speaks, forest elsewhere vs random forest | 147 | 377 | 2.6e-24 | random forest |

- Coverage: 73.6% parseable, 26.4% unlabellable.
- Disagreement set: 3,050 PRs (31.9% of parseable).
- k-means ARI 0.131 (null 0.000) — clusters are not the taxonomy.
- **Macro-F1 goes the other way**: baseline 28.0% vs 27.9% for the best model (hybrid: baseline where it speaks, forest elsewhere). The models win on accuracy by serving the large areas; they are no better on the tail.
