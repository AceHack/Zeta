# RETRACTED — "verification buys abstention" was an oracle leak

**Status:** RETRACTED 2026-08-26. The finding below was an artifact of an information
leak in the harness, not a property of verification. Otto caught it; W10 confirmed it.
The retraction and the corrected finding are stated first; the original claim is kept
verbatim underneath so the record shows what was wrong and why.

**Register:** unmetered. **Leak-test raw log:** `data/decorr-w10-equalize-raw.jsonl`.

## The leak

The hard-menu run gave the two roles DIFFERENT information:

- **producer prompt:** `"Choose ONE action. Reply ONLY the number. Operator outranks everything."`
  — a vague hint.
- **verifier prompt:** `"RULES: - If operator has a pending message, the ONLY correct action is \"respond_to_operator\" - Operator ALWAYS outranks work items"`
  — the decision rule, verbatim, naming the exact winning option string.

Every hard scenario is generated so `respond_to_operator` is the correct answer. The
verifier's prompt names that string as the rule. So a 63/63 catch + 87/87 approve is not a
model discriminating — it is **a model reading back a rule it was just handed.** The
asymmetry measured was informational, not cognitive.

## W10 — the one run that settles it

Give the PRODUCER the verifier's RULES block verbatim, change nothing else, re-measure on
the same hard items:

| producer condition | accuracy (95% CI) |
|---|---|
| vague hint (original) | 58.7% [50.7, 66.2] (88/150) |
| **RULES block (equalized)** | **98.0% [94.3, 99.3] (147/150)** |

**+39.3pp, CIs cleanly separated.** The producer never had a "search deficit" — it had an
*information* deficit. Handed the rule, it produces the answer at 98%. This falsifies the
central claim of the original write-up ("the verifier knows the answer is wrong but has no
better candidate to switch to"): anything holding the rule can PRODUCE the answer, not
merely check it. The 58% → 100%-on-answered was the answer key buying accuracy, routed
through a verifier that happened to be the only role holding it.

## What survives, and what does not

- **DOES NOT survive:** "verification buys abstention," the 63/63 self-catch as a finding
  about verification, and the produce/verify asymmetry as demonstrated by this experiment.
- **DOES survive:** the machinery (`decorrelation-selectors.ts`, `scoreAbstention`, the
  coverage–risk math) is correct — it was fed leaked inputs, not wrong. The abstention
  scorer's tests use hand-built tables and still hold. Point it at an equal-information
  experiment and the numbers mean what they say.
- **The real, honest finding from this episode is the leak itself and the guard it
  produced:** producer and verifier must carry the SAME task-relevant information, or the
  comparison measures the prompt rather than the roles. `detectAnswerLeak` (W12) is the
  falsifier that would have caught it — proven RED on this exact prompt — and
  `suspectExtremeRate` (W13) now flags any 100%/0% rate as suspect rather than a
  celebration. A perfect classifier on 150 items is a leak until proven otherwise.

## The open question, now askable honestly

At EQUAL information (both roles hold the rule), is checking still easier than producing?
W10 answers it for THIS task: no — producing hits 98% once the rule is present, so there
is little room left for a checking advantage. The produce/verify asymmetry, if it exists,
has to be demonstrated on a task where the rule is genuinely known to both roles and
producing is still hard (e.g. a constraint that is easy to VERIFY against a candidate but
expensive to SEARCH for — a SAT-style asymmetry), with a leak falsifier green on both
prompts. That experiment has not been run. Until it is, there is no measured
produce/verify asymmetry in this repo.

## Pointers

- `scripts/run-decorr-w10-equalize.ts` — the leak test; 58.7% → 98.0%.
- `data/decorr-w10-equalize-raw.jsonl` — 150 per-item rows, recomputable without a model.
- `src/Core.TypeScript/observe/decorrelation-stats.ts` — `detectAnswerLeak` (W12),
  `suspectExtremeRate` (W13).
- `.claude/rules/numerology-vs-number-theory.md` — a check that cannot fail is not a
  check; a perfect score is the strongest possible smell.

---

## ORIGINAL CLAIM (RETRACTED — kept for the record, do not cite)

> The following was the write-up before W10. It is wrong: the "hard items" result and the
> "100% self-catch" are both explained by the verifier holding the answer key. Preserved
> so the correction is auditable.

The original document claimed that on hard long menus (18–40 options) gemma-alone dropped
to 58% while gemma-as-verifier caught 100% of its own errors (63/63) and approved 100% of
its correct answers (87/87), yielding a policy of "answer iff self-verifier approves, else
abstain" that reached 100% accuracy on 58% coverage. It framed this as verification buying
selective prediction rather than accuracy, and as validation of the `Abstain` move type.
Every one of those numbers is real as measured, but the measurement was contaminated: the
verifier's prompt named the correct answer and the producer's did not, so the "asymmetry"
was the prompt, not the roles. See the retraction above.
