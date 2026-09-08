# Exact finite rooms: independent reference review

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: active
Work item: 081M1Z63YMC087G0R003N5FH9X
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded Python reference acceptance; actual-Zeta draft review separate

I read the full Python module and dedicated test at
`cc857317c0645f8ce99ff8823d0b30e7e8b309f6`, against the fixed schema in
`43941b976` and the coordinator-agreed model. Current bytes match the immutable
source:

| File under src/Interp.Python | Bytes | SHA-256 |
| --- | ---: | --- |
| zeta_interp/distributional_learning_rooms_reference.py | 13024 | 7cc06550d62564b73c240da0a85ff89f499e9b6b843518cb2ad00838ebc6da6d |
| tests/test_distributional_learning_rooms_reference.py | 12324 | ceb650a441c1df1048c740c25931a9bc185853398b48561ef86afdb8aa1b9285 |

## Exact mathematics and wire values

Both distributions have mean zero, second moment one and variance one on the
same five-atom ordered support. Their strict absolute-tail probabilities are
zero and one quarter. Expected utility for the tail-exposed action is one for
P and minus one for Q, against zero for steady. The declared first-maximum
tie rule is explicit. Thus the fixed supplied decision problem distinguishes
these distributions despite equal first two moments; it makes no claim about
insufficiency within the Gaussian family or a universal representation choice.

Transport assigns source mass at i to permutation[i], checks both inverse
compositions and retains the unchanged ordered support. Forward P is
[0, 0, 1/2, 0, 1/2], with mean one and variance one. Forward Q is
[1/8, 1/8, 0, 3/4, 0], with mean 3/8 and variance 79/64. Exact inverse
recovery and total mass preservation are separate from moment invariance;
these moved moments are correctly allowed to change.

Conditioning multiplies each mass by its event likelihood, sums the evidence,
then divides by that evidence. Soft evidence is 3/4 for P and 21/32 for Q;
the corresponding posteriors are [0, 1/3, 0, 2/3, 0] and
[1/21, 0, 6/7, 0, 2/21]. Unit likelihood preserves each prior. P/tail alone
refuses ZeroEvidence; Q/tail has evidence 1/4 and equal mass on the outer atoms.
No uniform or likelihood-only posterior substitutes for an impossible event.

The two distribution, two transport and six conditioning rows match the exact
schema and independently written literal expected receipt. Rational numerators
and denominators are canonical decimal strings, with positive denominator,
coprime values and zero exactly 0/1. JSON numeric rounding does not enter these
quantities. Canonical JSON comparison also distinguishes booleans, integers
and strings; array order remains part of the contract.

## API and validation limits

Each public mathematical operation revalidates ordinary Distribution values.
Inputs require exact tuples and exact int/Fraction values; booleans and floats
refuse. Support is strictly increasing, mass is nonnegative and sums to one,
likelihoods are within [0,1], and utility/action dimensions match. Explicit
inverse validation rejects a permutation paired with the wrong inverse.
This is an ordinary same-process mathematical API, not a hostile-object,
concurrency, allocation-quota or arbitrary loaded-source admission boundary.

The author's original wire encoder let Python's integer-text conversion limit
raise ValueError. The preserved discriminator sets a finite 640-digit limit
and records that actual exception before repair. The final encoder and decoder
map conversion refusal to InvalidRational and restore the test's interpreter
setting in finally. No interpreter setting was changed by this review.

I read the initial 74-test pass, the separate one-test integer-limit failure,
all five initial typing diagnostics, the initial import-style finding and the
final 75-test pass (3.23 seconds). Final strict two-file mypy, Ruff and format
checks pass. Shifted variance, strict threshold, reversed transport, omitted
normalization and likelihood-only mutants discriminate the intended formulas.
No project test or reference receipt was executed by this review.

## Actual-Zeta draft findings, awaiting immutable source

The coordinator separately requested source inspection of its private
DistributionalLearningRooms.fsx draft. Its exact finite projection agrees with
this reference schema. PS.Rational has finite int64 arithmetic, but all fixed
operands and intermediate products in these rooms are small; no generic
overflow-safe rational API is claimed.

One independent retention finding applies to that draft: mutable error fields
could replace the first failure, and returning only Error discarded previously
returned room rows. Its top-level pair evaluation also ran both room groups
before discarding a successful prefix when the other group failed. The
coordinator accepted sequential designated API checkpoints and an explicit
terminal prefix, including later hash/output failures where the sink remains
usable. Those changes require a separate immutable source reread; this note
does not accept or execute the draft.

The actual PredictionInference/Vision source keeps attention-weighted boarding
order separate from posterior ranking. At capacity six, both confidence values
are one half, while boarded posterior mass is 3/4 with neutral priority and
1/4 with attention ten. Best stays likely and shares stay [3/4, 1/4]. At
capacities zero and twelve, confidence/mass are zero/zero and one/one.
Full PredictionReport equality with direct prediction is false for all three
attention rows because the report retains ordered request/board/defer lists,
even when their sets match. Six budget rows perform twelve prediction calls,
including six direct controls, plus one inference call.

Gaussian moment projection and repeated supplied Gaussian-message product are
separate observations. The latter would move precision from two to three across
the threshold 2.5; it does not establish independent evidence or provenance
enforcement. Six-byte branch costs are supplied forecasts, not measured memory.
The proposed absolute 1e-12 SoftValue comparison remains an explicit later
validation step. Final tracked script paths must resolve their relative assembly
references from src/Research.FSharp, not from the temporary draft directory.

No learning, SOTA comparison, continuous Liouville flow, physical experiment,
registered controller stream or full runtime closure is established here.

```text
Agency-Signature-Version: 1
Agent: Vera
Agent-Runtime: OpenAI Codex
Agent-Model: GPT-6 Astra
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: not-implied-by-credential
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: 081M1Z63YMC087G0R003N5FH9X
Co-Authored-By: Codex <noreply@openai.com>
```
