# F4 — question-bias attribution: pre-registration

Written and committed **before any F4 generation ran**. Reproduced unedited in
`docs/research/2026-08-26-which-properties-of-a-question-move-the-answer-a-null-axis-first-attribution-experiment.md`.
If a prediction below turns out wrong, it stays here wrong. That is what makes the
misses in the report readable as misses.

Status: **toy**. Nothing here is metered until a falsifier fails when the model is wrong.

## 0. What is already established, and what is not

F3/E1 (PR #15613) showed that **rewording an elicitation moves the choice distribution**
— 5/5 model x temperature cells, permutation _p_ = 0.0005, effective variety swinging
4.1x-14.5x on phrasing alone. That the effect **exists** is settled and is not re-tested.

E1's six phrasings each varied several properties at once, so **no per-property number is
recoverable from it**. F4 asks which properties, and by how much.

## 1. Design

Every comparison is a **pair of prompts differing in exactly one named property**.
Sixteen axis pairs, identical in structure across two question domains:

| kind        | axes                                                                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| calibration | `CALIB-IDENTICAL` (anchor vs itself, disjoint seed block)                                                                                       |
| null        | `NULL-WHITESPACE`, `NULL-SYNONYM`, `NULL-CLAUSE-ORDER`                                                                                          |
| semantic    | `PRESUPPOSITION`, `FRAME-IDENTITY`, `FRAME-TEAM`, `ANSWER-PRIMING`, `CLOSED-ANSWER-SPACE`, `OPTION-ORDER`, `PERSON-3RD`, `POLITENESS`, `LENGTH` |
| combo       | `COMBO-TEAM-PRIME`, `COMBO-TEAM-LENGTH`, `COMBO-PRIME-POLITE`                                                                                   |

Domains: **role** (`"What role would you choose for yourself?"`, the F3/E1 domain, so
the two connect) and **preference** (`"What kind of problem would you most want to work
on?"`, an inner-state question that is not about roles).

Models: `qwen2.5:0.5b`, `llama3.2:1b`, `gemma2:2b` at 120 replicates on both domains;
`qwen2.5:7b` at 80 replicates on `role` only, for the model-size question.

Temperature 0.8, `num_predict` 24. Seed blocks are **disjoint across prompts**
(`seed = promptIndex * 100000 + replicate + 1`) so no two compared samples share a
sampler state.

## 2. Statistics, fixed in advance

- **Effect size** = `excess JSD` = observed word-bag Jensen-Shannon divergence (bits)
  minus the mean JSD under label permutation with group sizes held fixed. The
  permutation null absorbs JSD's finite-sample bias.
- **p** = permutation p-value, upper tail, 5000 permutations, `(atLeast + 1) / (n + 1)`.
- **Variety** = Hill order 1 over answer atoms, reported for each side and as a ratio.
  **JSD and variety are never merged into one score.** A wording can move where answers
  land without changing how many there are, and the opposite; one number hides which.
- **Multiplicity**: Holm (1979) step-down over the semantic axes within each
  (domain, model) cell. Family-wise alpha = **0.05**.
- **Equivalence delta** for the null axes: **0.02 bits** of excess JSD, i.e. 2% of JSD's
  full range. The same delta gates the calibration pair, so the threshold is falsifiable
  in both directions.

## 3. The gates, in order. The first two decide whether anything else is reportable

- **G1 — calibration.** `CALIB-IDENTICAL` must read `excess <= 0.02` and `p >= 0.05`.
  Identical text, disjoint seeds: if the instrument cannot read zero here it is not
  measuring divergence. **If G1 fails in a cell, no other number from that cell is
  reportable.**
- **G2 — the null axes.** Each of `NULL-WHITESPACE`, `NULL-SYNONYM`,
  `NULL-CLAUSE-ORDER` must have `p >= 0.05` **and** an upper 95% bootstrap CI bound on
  excess at or below 0.02. The p-value alone is not enough — no significance test
  licenses accepting a null; the equivalence half is what supports "this did not move".
  **If G2 fails in the majority of cells, the finding is INSTABILITY, not framing, and
  the report stops there rather than proceeding to axis attribution.**
- **G3 — separation.** At least one semantic axis must be below Holm-adjusted alpha.
  An instrument that reads zero on everything is deaf, not clean.

## 4. Predictions. Recorded so the misses are visible

- **H1.** G1 passes in every cell. _(If it does not, the harness is wrong, not the world.)_
- **H2.** G2 passes in every cell — cosmetic edits do not move the distribution.
  **This is the prediction most likely to be wrong, and the one whose failure is most
  informative.** A sampler at temperature 0.8 over a 24-token completion has no
  guarantee of whitespace invariance, and tokenizers genuinely differ on a trailing
  space. Stated confidence: **low**, maybe 50/50 that all nine null-axis cells pass.
- **H3.** The axis ranking by excess JSD is `FRAME-IDENTITY` > `ANSWER-PRIMING` >
  `FRAME-TEAM` > `PRESUPPOSITION` ~ `PERSON-3RD` > `LENGTH` ~ `POLITENESS` >
  `OPTION-ORDER`. (`CLOSED-ANSWER-SPACE` is excluded from the ranking: its answer space
  differs by construction and its number is partly definitional.)
- **H4.** The **ordering** of the top three axes replicates across both domains in at
  least 2 of 3 small models. This is the real test of "predictable from a feature of the
  question" — if the ranking is domain-specific, the feature is not what is doing the
  work.
- **H5 — additivity.** Combined axes are **sub-additive** (ratio observed/predicted
  < 0.8). JSD is bounded at 1 and the answer space is finite, so two large shifts should
  saturate rather than sum. Additive band precommitted at [0.8, 1.2].
- **H6 — the protocol.** Ranking open-answer-space formulations by mean JSD to all the
  others yields a stable argmin: **the same formulation in at least 4 of the 6
  (domain x small-model) cells**. If not, a minimum-bias formulation cannot be found by
  this procedure and the report says so.
- **H7 — model size.** F3/E1 found variety **falling** with model size (pooled Hill N1
  16.9 on qwen2.5:7b vs 72-96 on smaller models), registered `consistent with`. F4 asks
  whether **bias-sensitivity** falls with capability or **conformity** rises. Those are
  different and the second is worse. Prediction: variety falls again (replication), and
  mean semantic-axis excess JSD **does not** fall proportionally — i.e. the larger model
  is more collapsed but no less steerable. Confidence: **low**; one model at one size is
  an anecdote about a size, not a scaling law, and it is registered as such.

## 5. Bias ledger, with the direction each one cuts

1. **The `LENGTH` padding is not perfectly contentless.** It signals "standardised,
   repeatedly asked". Direction: **inflates** LENGTH's measured effect — some of it is a
   frame, not length.
2. **`CLOSED-ANSWER-SPACE` compares an open answer space to a five-item menu.**
   Direction: **inflates** it, definitionally. Excluded from the ranking, reported with
   the caveat attached.
3. **The bootstrap CI resamples with replacement**, thinning distinct support and
   inflating JSD, and holds `nullMean` fixed. Direction: pushes the upper bound **up**,
   making the null axes **harder** to pass. Conservative for G2, which is the direction
   that matters.
4. **The word bag drops stopwords and single characters** (inherited from F3). An axis
   whose only effect is on function words would read as null. Direction: **deflates**
   axes that act on syntax rather than content — `POLITENESS` most of all.
5. **Every semantic axis shares the same left-hand sample (the anchor).** Their
   p-values are positively dependent. Holm is valid without an independence assumption,
   so this costs power, not validity. Direction: **conservative**.
6. **These are 0.5B-7B local models at temperature 0.8.** Nothing here transfers to
   frontier models by assumption, and the report will not claim it does.

## 6. What would falsify the whole thing

If the null axes move the distribution as much as the semantic ones, there is no
"question bias" to attribute — there is an unstable sampler, and the per-axis numbers
are noise with decimal points. That outcome is reachable, is checked first, and stops
the report if it happens.
