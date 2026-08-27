# PR area statistics

_13,039 merged PRs · 16 areas · temporal split · generated 2026-08-27T16:19:53.478Z_

**The BNN earns its place — but only under distribution shift.**

| model | accuracy | Δ vs baseline | macro F1 | where baseline abstains |
|---|---:|---:|---:|---:|
| closed-form baseline | 58.7% | — | 28.2% | 0.0% |
| majority class | 3.9% | -54.8pp | 0.5% | 2.3% |
| random forest | 70.1% | +11.3pp | 22.4% | 24.8% |
| BNN (ADF probit, one-vs-rest) | 73.3% | +14.6pp | 26.1% | 23.7% |
| hybrid: baseline where it speaks, forest elsewhere | 62.0% | +3.3pp | 28.0% | 24.8% |
| _NULL random forest (labels shuffled)_ | 5.5% | — | 1.5% | — |
| _NULL BNN (labels shuffled)_ | 7.7% | — | 2.8% | — |

Label-shuffle null: 7.7% against a majority-class floor of 3.9%.

| comparison | b | c | p | favours |
|---|---:|---:|---:|---|
| random forest vs closed-form baseline | 502 | 132 | 1.1e-51 | random forest |
| BNN (ADF probit, one-vs-rest) vs closed-form baseline | 617 | 142 | 2.4e-71 | BNN (ADF probit, one-vs-rest) |
| BNN (ADF probit, one-vs-rest) vs random forest | 223 | 118 | 1.4e-8 | BNN (ADF probit, one-vs-rest) |
| hybrid: baseline where it speaks, forest elsewhere vs random forest | 132 | 395 | 1.8e-31 | random forest |

- Coverage: 73.7% parseable, 26.3% unlabellable.
- Disagreement set: 3,068 PRs (31.9% of parseable).
- k-means ARI 0.120 (null -0.001) — clusters are not the taxonomy.
- **Macro-F1 goes the other way**: baseline 28.2% vs 28.0% for the best model (hybrid: baseline where it speaks, forest elsewhere). The models win on accuracy by serving the large areas; they are no better on the tail.
