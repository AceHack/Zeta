# PR area statistics

_13,093 merged PRs · 16 areas · temporal split · generated 2026-08-27T21:51:06.506Z_

**The BNN does not beat the forest. Both beat the baseline.**

| model | accuracy | Δ vs baseline | macro F1 | where baseline abstains |
|---|---:|---:|---:|---:|
| closed-form baseline | 58.7% | — | 28.2% | 0.0% |
| majority class | 3.9% | -54.8pp | 0.5% | 2.3% |
| random forest | 74.5% | +15.8pp | 23.4% | 27.9% |
| BNN (ADF probit, one-vs-rest) | 73.1% | +14.4pp | 24.0% | 26.1% |
| hybrid: baseline where it speaks, forest elsewhere | 62.4% | +3.7pp | 28.2% | 27.9% |
| _NULL random forest (labels shuffled)_ | 5.3% | — | 1.6% | — |
| _NULL BNN (labels shuffled)_ | 22.9% | — | 5.4% | — |

Label-shuffle null: 22.9% against a majority-class floor of 3.9%.

| comparison | b | c | p | favours |
|---|---:|---:|---:|---|
| random forest vs closed-form baseline | 662 | 144 | 4.3e-80 | random forest |
| BNN (ADF probit, one-vs-rest) vs closed-form baseline | 608 | 136 | 5.0e-72 | BNN (ADF probit, one-vs-rest) |
| BNN (ADF probit, one-vs-rest) vs random forest | 146 | 192 | 0.0143 | random forest |
| hybrid: baseline where it speaks, forest elsewhere vs random forest | 144 | 540 | 9.7e-55 | random forest |

- Coverage: 73.7% parseable, 26.3% unlabellable.
- Disagreement set: 3,074 PRs (31.9% of parseable).
- k-means ARI 0.116 (null 0.001) — clusters are not the taxonomy.
