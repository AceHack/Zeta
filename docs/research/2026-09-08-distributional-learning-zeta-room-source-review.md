# Fixed distribution rooms: actual-Zeta harness source review

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: active
Work item: 081M1Z63YMC087G0R003N5FH9X
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded source acceptance after sequential failure-retention repairs

I reviewed the private draft, complete tracked source
`dd39304b9f95e0bd7c2522b491b1999e69fe5b71`, and final correction
`5475ec0f409076d379ad962c600db45b57e510a9`. The final
src/Research.FSharp/DistributionalLearningRooms.fsx is 19,552 bytes, SHA-256
103cb2895034a55ccae026ad2aedae002eb12c558d8fe0ed0df647605c7f37a9;
current bytes equal that immutable blob. The separately committed small-room
protocol at 9e64ab3 fixes the mathematical and execution roster before the
first F# attempt.

## Mathematical and API correspondence

The complete ten-row rational projection matches the independently
[reviewed Python reference](2026-09-08-distributional-learning-room-reference-review.md).
It retains all support positions and zero masses, exact string rationals,
strict absolute-tail comparison, first-action tie order, source-index transport
and separate evidence normalization. Existing PS.Rational uses int64 arithmetic;
these fixed intermediate values remain small. This is not a general
overflow-safe rational implementation.

I read the actual Gaussian, LocalConsensus, SoftValue, PredictionInference,
Vision and SoftThrottle source used by the harness. Gaussian moment projection
retains the same two moments for P and Q. Reusing the supplied Gaussian value
through the message product raises precision across the fixed 2.5 threshold;
the source annotation does not create provenance enforcement. Neither result
establishes physical or learning behavior.

The six SoftValue observations use the same supplied likelihoods; only P/tail
has zero evidence. The sixteen final Zeta observation rows comprise two Gaussian,
two consensus, six SoftValue and six budget rows. The 25 designated checkpoints
add two SoftValue constructors, one inference and six direct prediction controls.
There are twelve actual prediction calls, not six. These checkpoints deliberately
do not enumerate every internal accessor or constructor.

Priority affects boarding order while inference ranking and posterior shares
remain fixed. At capacity six, confidence is one half in both priority modes,
but boarded posterior mass is 3/4 versus 1/4. Full direct-report equality is
false for every attention row because ordered request/board/defer lists differ.
Six-byte branch costs are forecasts consumed by the port, not measurements.
The independently implemented validator still owns full-value comparison,
including the sole absolute 1e-12 relaxation for SoftValue probabilities.

## Findings and corrected failure ordering

The private draft evaluated room groups before checking their combined result,
discarded earlier successful rows on failure and could overwrite the first error.
Tracked dd393 introduced sequential guards and designated stdout checkpoints.
That fixed the group-prefix loss but exposed two remaining failure paths.

First, unexpected returned refusals were judged after their checkpoint. A
publication exception or injected fault could become the reported primary
failure even though a constructor/inference/prediction refusal had already
returned. Final 5475 establishes that operation failure before the one
checkpoint attempt. The checkpoint may still publish its observed result;
the firstFailure setter cannot replace the prior operation failure. Subsequent
designated calls remain guarded.

Second, dd393 retained the current event in memory before writing but emitted
only observed/written counts in a terminal failure. A one-shot sink failure
could therefore lose the actual unwritten value even if the terminal sink
became usable. The correction sets PendingCheckpoint before serialization,
records actual encoded bytes when available, and clears pending state only
after the write returns successfully. A fitting pending event appears in the
terminal. If it cannot fit, its omission record carries sequence, actual
encoded-byte length/hash and an explicit reason. If serialization never produced
bytes, length/hash stay null; no hypothetical byte identity is invented.

Unexpected runtime and I/O exceptions are translated at the CLI boundary;
earlier NDJSON remains a raw prefix. The terminal cannot erase an established
first failure. Pending-byte identity excludes the separately counted newline.
The line/count/aggregate checks do not imply an exact allocation bound, kernel
cancellation, a reliable broken sink or crash-proof publication. Terminal
publication can itself fail; raw stdout/stderr and actual process exit must
remain part of later evidence admission.

## Validation read and limits

I read the first tracked attempt's retained compile-only output: zero stdout,
647 stderr bytes with FS3886 and FS0001 identifying a list/tuple layout error.
That is a compiler refusal, not a room observation. The final source makes the
tuple/list separators explicit while retaining the semantic repairs above.

I also read the second attempt's 15,689-byte ordinary stdout and empty stderr.
It contains exactly 25 checkpoints in the declared order, followed by one
terminal: Complete=true, observed/written counts 25/25, and both pending fields
null. This limited local shape inspection is not a full-value independent
validation or a durable actual-run archive audit. I did not run the harness,
compiler or fault controls.

The source's preregistered fault-after-2/12/25 modes stop after the designated
written checkpoint and retain its prefix. Their actual observations and the
malformed-control case remain separate validation work. Those modes alone do
not prove every ordinary I/O, unexpected API refusal or serialization failure
path; this note accepts the reviewed source ordering without inventing executed
regressions for those paths.

The three selected assembly file hashes in a successful receipt are observations,
not full loaded-module, bytecode or runtime closure. Relative references now
resolve from the intended tracked src/Research.FSharp path. No registered
compiled-controller source/timing, learned generalization, SOTA result, physical
Liouville flow or end-to-end scheduler/Ferry/CHIP-8 behavior follows from these
fixed known-answer engineering rooms.

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
