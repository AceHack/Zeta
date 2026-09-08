# Exact finite-distribution room reference

Date: 2026-09-08 (UTC).
Operational status: research-grade.
Lifecycle: active, independent exact reference and comparison contract.
Task: 081M1Z63YMC087G0R003N5FH9X.
Author: Vera, OpenAI Codex using GPT-6 Astra.

## Purpose and ownership

This note fixes the finite model and case inventory before implementation or
execution. The coordinator accepted this schema in chat and remotely co-claimed
exactly this note, the new Python module and its dedicated existing-directory
test file in ccd068619bbc9f4ea80d3ddb56c75b37574805ee. The author independently
verified that claim ref before writing. The writer is
Zeta-relational-identity-20260906, branch
codex/distributional-rooms-reference-20260908, session
codex/20260907-c7b2a403. The coordinator owns the independent F# room harness and
integration evidence. This module will import no compiled-controller reference,
native source or learning implementation.

The [coordinator direction](https://github.com/Lucent-Financial-Group/Zeta/blob/bd229f56aafb9a387285f59b198bb4b1bc6d5c2e/docs/research/2026-09-08-distributional-learning-resource-aware-integration-direction.md)
is the source-grounded motivation. The present finite examples concern loss
from retaining only two moments outside a restricted distribution family,
finite transport, and conditioning. They are neither learned performance nor
state-of-the-art comparisons. They are not continuous Liouville dynamics,
physical experiments or a claim that Gaussian moments are insufficient within
the Gaussian family. The earlier frozen compiled-controller study and its
unopened source streams are unaffected.

## Fixed model and ordered case inventory

The common ordered support is [-2, -1, 0, 1, 2], retaining all zero masses.
P has masses [0, 1/2, 0, 1/2, 0]. Q has masses [1/8, 0, 3/4, 0, 1/8].
Both have exact mean 0 and variance 1. The tail event is strictly
absolute value greater than 3/2; its probabilities are 0 and 1/4.

Actions, in tie order, are steady then tail-exposed. Their utility rows are
[0, 0, 0, 0, 0] and [-7, 1, 1, 1, -7]. Expected utilities are [0, 1] for P
and [0, -1] for Q. Maximization chooses tail-exposed for P and steady for Q.
The utility is supplied, fixed and distribution-sensitive. This is a finite
counterexample to identifying decision utility from just these moments,
not a general optimal representation theorem.

Transport uses the source-index-to-destination-index convention: mass at index
i moves to permutation[i]. The fixed permutation is [1, 2, 3, 4, 0] and its
inverse is [4, 0, 1, 2, 3]. Both compositions must be the identity. The ordered
rows are P/cycle then Q/cycle. Record forward masses, recovered masses, forward
mean and forward variance. Total mass and exact inverse recovery are required;
moments need not be invariant under this relabeling of support positions.

Conditioning order is P then Q, each with unit, soft, tail likelihoods:

| Likelihood ID | Values on the full support |
| --- | --- |
| unit | [1, 1, 1, 1, 1] |
| soft | [1/4, 1/2, 3/4, 1, 1/2] |
| tail | [1, 0, 0, 0, 1] |

All are supplied probabilities of a single event conditional on each atom.
Evidence is the sum of prior mass times likelihood; posterior divides those
products by evidence. Row IDs are P/unit, P/soft, P/tail, Q/unit, Q/soft, Q/tail.
P/tail alone returns ZeroEvidence. The five other rows return exact normalized
posteriors. No posterior is invented for the zero-evidence event. Multiplication
and normalization are separate from transport and generally have no inverse.

## Exact public contract

The three owned paths are
[src/Interp.Python/zeta_interp/distributional_learning_rooms_reference.py](../../src/Interp.Python/zeta_interp/distributional_learning_rooms_reference.py),
[src/Interp.Python/tests/test_distributional_learning_rooms_reference.py](../../src/Interp.Python/tests/test_distributional_learning_rooms_reference.py)
and this note. The two source links name planned files until the implementation
commit. No package, dependency, native project or test-wiring edit is needed.

Public numerical APIs are distribution, moments, decide, transport, condition,
encode_rational, decode_rational and reference_receipt. They return an own
immutable Success with Value or Failure with Code and Message. Inputs use exact
int or Fraction values, excluding bool and float. Finite tuples are checked
before arithmetic; caller-created distribution records are revalidated on every
public operation. These are ordinary same-process mathematical APIs, not a
hostile-object or memory-allocation boundary.

A wire rational is exactly {Num: string, Den: string}. Both are canonical base10
integer strings; denominator is positive, numerator permits a leading minus
only when negative, the integers are coprime, and zero is exactly 0/1. No
leading zeros, plus signs, whitespace or unreduced fractions are admitted.
No JSON numeric precision enters an exact mathematical quantity. Index arrays
and ActionIndex remain ordinary integers, never booleans.

The successful reference_receipt Value is a JSON-compatible dictionary with
exact fields and order below. Object key order is descriptive; array order is
part of the contract. Every rational entry below has the Num/Den form.

- Schema: zeta.distributional-rooms.reference.v1.
- Support: five rationals; Actions: two strings; Utilities: two rows of five
  rationals; TailEvent: {Kind: absolute-greater-than, Threshold: rational}.
- Distributions: two rows with exact keys Id, Mass, Mean, SecondMoment, Variance,
  TailProbability, ExpectedUtilities, ActionIndex, Action. Arrays have the fixed
  five/two entries above.
- Transport: Convention, Permutation, Inverse, Rows. Convention is exactly
  source-index-to-destination-index. Each of two Rows has Id, Distribution,
  ForwardMass, RecoveredMass, ForwardMean, ForwardVariance.
- Conditioning: six rows, each with Id, Distribution, LikelihoodId, Likelihood,
  Outcome. Successful Outcome is exactly {Kind: conditioned, Evidence: rational,
  Posterior: five rationals}. Refused Outcome is exactly {Kind: refused,
  Code: ZeroEvidence, Message: conditioning evidence is zero}.

No native observations, timing, source-admission booleans or learned claims
are embedded. Root will compare this complete finite projection field-for-field
and retain its actual Zeta Gaussian/consensus/priority observations separately.

## Fixed validation inventory before execution

The following validation families are fixed before source execution:

1. Exact full receipt versus an independently written literal expected DTO,
   deterministic repeat, canonical JSON round trip, every rational canonical.
2. P/Q moments, strict tail threshold and both utility choices; a shifted
   distribution distinguishes variance from second moment; an equal-utility
   control exercises the declared first-action tie rule.
3. Both transport rows, both inverse compositions, direction versus reversed
   pushforward, exact round trips, and changed moments.
4. All six conditioning rows, exact evidence/posteriors, constant-one identity,
   zero-evidence refusal, and discrimination against omitted normalization,
   uniform normalization or confusing likelihoods with a posterior.
5. Canonical rational round trips including negative and zero; refusals for
   wrong keys/types, bool, float, signed/leading zero, plus/whitespace, negative
   or zero denominator and unreduced fractions.
6. Distribution refusals for non-tuples, empty/mismatched support and mass,
   duplicate/unsorted support, negative or nonunit mass, and float/bool atoms.
   Forged public records are revalidated by every mathematical operation.
7. Transport refusals for wrong length, duplicate/range/bool indices and an
   inverse that is a permutation but not the actual inverse.
8. Conditioning refusals for ragged likelihoods, negative/above-one values and
   bool/float values. Decision refusals for duplicate/empty action names, ragged
   utility rows and bool/float utility values; tail thresholds refuse negatives.
9. Load-bearing mutation checks use deliberately wrong finite calculations:
   second moment as variance, unweighted utility, inverse transport direction,
   omitted Bayes normalization, and likelihood-only posterior. Each must differ
   from the corresponding actual exact operation result. No mutation is a new
   scientific arm or source draw.

Only these fixed hand calculations and ordinary module tests run in this lane.
No target/native process, policy episode, RNG stream or resource measurement
is authorized by this note. Focused pytest, strict mypy and Ruff/format are the
relevant source checks. Root owns integrated cross-language/build validation.
Original diagnostics, source pins, exact observations and independent review
will be appended below rather than replacing this pre-execution inventory.
