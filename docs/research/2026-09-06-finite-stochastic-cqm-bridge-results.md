# Finite stochastic/WSet channel bridge: exact results and limits

Date: 2026-09-06
Operational status: research-grade
Lifecycle: active
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1WDDB6M087G0R002KN8DWQ
Status: first native/replay receipts complete; independent review and local gates passed

The first native and independent Fraction runs agree on all 957 registered
cases in fourteen groups. The result supports a narrow classical-channel
implementation and preserves the counterexamples to stronger identifications.
It does not establish a CQM/WSet equivalence, universality, a quantum computer,
Clifford structure, Lorentz invariance, or operational promotion.

The [contract and proofs](2026-09-06-finite-stochastic-cqm-bridge-protocol.md),
[implementation boundary](2026-09-06-finite-stochastic-cqm-bridge-implementation.md),
and [independent source review](2026-09-06-finite-stochastic-cqm-bridge-review.md)
define the claims and conventions. The
[validation index](finite-stochastic-cqm-bridge-validation/2026-09-06/README.md)
links the immutable native/replay bytes and retained gate outcomes.

## What is established

| Assignment | Identity and scope |
| --- | --- |
| Column-stochastic matrices to diagonal C*-algebras | A faithful symmetric monoidal inclusion with complex-linear CP, trace-preserving arrows; general statement follows the written proof. |
| `S -> E(S)` on ordinary full matrix objects | Fails identity preservation: `E(I_n)` is dephasing, not the full-system identity for n>=2. |
| `S -> E(S)` on dephasing Karoubi objects | Preserves the correct split-object identity, dephasing; symmetry is the dephasing-sandwiched swap. |
| Generic signed WSet weights to stochastic/CP arrows | Requires separate positive-cone and normalization admission. Signed weights alone do not supply it. |

The first statement uses the category with commutative algebra objects,
not merely ordinary full matrix algebras. The last refusal concerns the fixed
standard positive cone and leaves separately decoded signed representations
open. No general CP*/Karoubi equivalence is inferred. Primary sources and the
explicit amplified-map proof are in the contract; finite runs do not prove
arbitrary amplification positivity or category coherence.

## Complete fixed roster

| Group | Cases | Outcome |
| --- | ---: | --- |
| stochastic admission | 9 | Exact agreement |
| WSet propagation/discard | 27 | Exact agreement, mass one |
| commutative identity | 6 | Exact agreement for dimensions 1, 2, 3 |
| composition | 81 | Exact classical and matrix-unit agreement |
| associativity | 729 | Exact agreement |
| tensor | 81 | Exact agreement on all sixteen M4 matrix units per pair |
| CP/TP certificates | 9 | Exact diagonal Choi coefficients and output partial traces |
| dephasing sandwich/identity | 9 | Exact agreement |
| rectangular composition | 1 | All retained routes give `[7/18,11/18]` |
| naive quantum identity refusal | 1 | The claimed ordinary identity fails |
| signed normalized refusal | 1 | Positivity fails in the standard cone |
| positive but not CP | 1 | Bell partial transpose has a negative direction |
| dagger nonclosure | 1 | Transposed reset fails normalization |
| additive nonclosure | 1 | Sum of identities fails normalization |

A case can compare several matrices. The total 957 is an accounting count,
not a sample size for statistical significance or a number of independent
physical observations. Every matrix value, shape, case identifier, order and
pass bit is retained in the native JSON and recomputed by the reference.

All expected negative controls remain explicit:

- `rho_plus` becomes `diag(1/2,1/2)` under E of the classical identity. Its
  off-diagonal entry changes by exactly 1/2. The case passes because it
  detects the failed ordinary full-system identity.
- The signed matrix `[[2,0],[-1,1]]` sends the first basis distribution to
  `[2,-1]`. Its Choi diagonal contains -1 even though its output partial trace
  is identity. Normalization alone did not make it positive.
- Bell partial transpose has quadratic form -1 on unnormalized vector
  `(0,1,-1,0)`. Transpose's positivity on every PSD matrix remains the written
  factorization argument; its three sample states do not establish that theorem.
- The reset is stochastic; its transpose has column sums 2 and 0 and is not.
- `I_2+I_2` is entrywise nonnegative but has column sums 2 and is not stochastic.

Rational matrix-unit images determine the mathematically specified
complex-linear maps. The implementations do not execute arbitrary complex
inputs or independently test complex-linearity of an unknown program.
The Choi certificate checks exact diagonal structure before using entrywise
nonnegativity; this is not a general matrix PSD test.

## Arithmetic and provenance

The native guard recorded maximum absolute numerator 11, maximum denominator
18, and zero refusals under the fixed 1,000,000 operand/result limit. The
independent reference also found retained-coefficient maxima 11 and 18. It
checks those output lower bounds and the guarded ceiling; it does not replay
native operation order or establish a general overflow-safe rational library.

Preservation preceded execution:

1. Reviewed contract `86205e52d65b2aa9dd43eff8c02a2bca9852f797` was remotely
   preserved under the immutable `-contract` tag before implementation.
2. Source `52b43d3e3fdb2916fc17096e9f003a478ba85eb4` received separate review.
   The implementation and indexed review were remotely preserved at
   `ce7fcffd496d8dcdea55f99d9919519276b35bd9` under immutable tag
   `archive/experiments/081M1WDDB6M087G0R002KN8DWQ`.
3. The tag's remote peeled commit was verified before the first native call.
   Execution checkout `0d09ebd6724aff07b79c25024edeb37fb2299302` also included
   the upstream NCI test repair. That repair changed none of the eight admitted
   protocol/scientific source files. `SourceCommit` names the admitted archive
   snapshot, as specified before execution; neither tag moved.
4. The first native receipt completed; the first Fraction replay then checked
   its exact bytes and completed. No failed scientific run preceded these files.

| Receipt | Bytes | SHA-256 |
| --- | ---: | --- |
| [Native](finite-stochastic-cqm-bridge-validation/2026-09-06/native.json) | 475255 | `CAA481CBB41956BC6FAE56A4ACECEFED14B300B51AEBEDB332E447B025683B64` |
| [Replay](finite-stochastic-cqm-bridge-validation/2026-09-06/replay.json) | 2674 | `340733433B7689038B62512138DF0C039E53D1879225D105D51F72858BDC501F` |

The replay's `InputSha256` equals the native digest above. Both receipts bind
the same eight source/protocol fingerprints to the resolved archive. Native
runtime was .NET 10.0.11 on macOS 26.6.2; its actual Core/Core.Abstractions
binary SHA-256 and MVID appear in the envelope. Source hashes and binary
fingerprints are distinct evidence, not a source-to-binary theorem.
Python records its actual runtime and executing-source hash. The arithmetic
implementations have a shared author and different algorithms/representations;
the separate reviews provide independent contributor scrutiny.

## Review and validation

The coordinating Vera agent (`codex/01a0783bc64f70e1`) independently read the
native/replay envelopes and implementation boundary. That read-only audit
verified the input digest from native bytes, identical provenance, all eight
fingerprints against archive and working source, every group/case count and
pass bit, and all five negative-control bodies. It found no evidence/admission
issue. It was not a third algorithm or another execution of the experiment.

The separate reviewer (`codex/finite-stochastic-review-20260906-741c`) also
accepted the receipt/source bindings, all negative-control bodies and final
local validation, as retained in the indexed review. Neither read-only receipt
audit was a third algorithm or a re-execution of the scientific witnesses.

Final integration `5957b1ad8aa3ea9f4507b29221b2e8c63aa6103d`, after merging
refreshed main, passed the full Release build with zero warnings/errors in
53.03 seconds and the full solution suite with 7,515 passed, six skipped and
zero failed tests (6,525 F# plus 990 other tests). All eight admitted scientific
source/protocol files remain byte-identical to the immutable implementation
archive. Full Python validation passed: 198 tests in 86.11 seconds, with one
existing HookedTransformer deprecation warning. `dotnet format
--verify-no-changes` exited zero, with its existing notice that F# projects are
outside that formatter's support. F# lint passed through the sixteen-check
quick preflight.

Validation failures are preserved separately from scientific outcomes:

- An incremental build exited 139 in the F# compiler. The serial affected
  project build and subsequent full Release build both passed with zero
  warnings/errors. The logs do not establish the crash's mechanism.
- Initial preflight failed on the inherited NCI R5 assertion at
  `nci-witness-receipt.test.ts:103`. Upstream PR #16881 strengthened that test;
  its unchanged repair was incorporated before publication. All sixteen
  checks then passed. No gate was bypassed.
- The first full .NET suite reported a BftConsensus TLC pool-file read error,
  `ValueInputStream: Can not unpickle a value of kind -98`, after 2,035,257
  distinct states. That run did not complete the pinned 4,665,495-state check.
  The error is not an invariant counterexample, but it is a failed gate.
  The runner uses a unique temporary metadata directory and retains its
  registry-pinned JVM flags, worker count, completion and state-count checks.
  No test, model, pin, or retry policy was changed for recovery. An isolated
  invocation of that exact pinned theory then passed in 2 minutes 55 seconds,
  including the original completion and 4,665,495-state checks. The subsequent
  fresh-main full build and solution test passed as recorded above. The logs
  establish successful bounded recovery, not the original failure's cause.

These outcomes preserve the bounded classical connection requested by the
handoff. Further quantum or signed-coordinate claims require their own objects,
arrows, positive cone/decoder, identities, and falsifiers.
