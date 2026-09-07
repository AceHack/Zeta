# Hidden-switch registered result records

Date: 2026-09-07
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade
Lifecycle: active

See the [result and limits](../../2026-09-07-hidden-switch-results.md),
[frozen protocol](../../2026-09-07-hidden-switch-protocol.md) and
[premeasurement validation](../../hidden-switch-validation/2026-09-07/README.md).
These are the original once-collected native receipts and independently
computed replay/verdict. Keep emitted JSON bytes unchanged; formatter
exclusions protect their raw hash identities.

| Record | Bytes | SHA256 |
| --- | ---: | --- |
| [behavior-attempt-1.json](behavior-attempt-1.json) | 78026027 | `F15CA0D41B1437B5E05A6CA402A8A8609F85D8B0E1C6218C316460257F450C2E` |
| [cost-attempt-1.json](cost-attempt-1.json) | 6868985 | `6AF9CF36F4CFC1C5E38F236E8922025CD845481D9E2E18DAFF58E5BE191B9DF3` |
| [replay-attempt-1.json](replay-attempt-1.json) | 7553 | `04C282C7EEA51E9672362427D36E4238F10897074CA9B691BA9C3A534E9137FB` |
| [verdict-attempt-1.json](verdict-attempt-1.json) | 11871 | `D0FBFFE371155002A204BAE3959B788A4E1B54D1AD83761D0E5933CB9CB67222` |

## Execution and preservation

- [Remote archive verification](archive-verification.json) records annotated
  tag objects, peeled commits and registration ancestry before generation.
- [Implementation push](implementation-push.log) retains all sixteen hook
  checks and remote ref creation. The remote dependency advisory in its
  output is not an experiment test failure.
- [Behavior log](behavior-attempt-1.log) and [cost log](cost-attempt-1.log)
  retain exact commands, start/finish times, receipt hashes and exit codes.
- [Measurement execution](measurement-attempt-1.json) binds both commands,
  observed file hashes, source commit and before/after DLL byte identities.
- [Replay log](replay-attempt-1.log), [verdict log](verdict-attempt-1.log) and
  [replay execution record](replay-execution-attempt-1.json) retain both
  independent reconstruction invocations. Verdict does not trust the supplied
  replay's success flag; it reconstructs the observations again.
- Process-name snapshots disclose sampled host activity before and after
  [behavior, before](behavior-processes-before.log),
  [behavior, after](behavior-processes-after.log),
  [cost, before](cost-processes-before.log) and
  [cost, after](cost-processes-after.log). No process arguments are included.
- The [archived native launcher](../../hidden-switch-validation/2026-09-07/measurement-launcher.py.txt)
  and [executed replay launcher](replay-launcher.py.txt) expose orchestration.
  These wrappers add no scientific policy, retries, extra warmups or discarded
  rows. Native and Python scientific CLIs are in the nineteen-file archive.

The behavior receipt is 78,026,027 bytes; its exact emitted bytes are
retained with compact serialization. The cost receipt is separately
retained. No `.partial` or incomplete registered attempt was produced; the
older failed hand/admission/native gate records remain in the validation
index and are not erased by this result.

## Reproduction boundary

Use a fresh writer-owned clone at the annotated implementation tag
`archive/experiments/081M1XK02XM087G0R00043EW05-implementation`, peeled to
`4fc82b611012bd2620a26e02afe6baba491fe553`. Fetch the registration and
implementation tags and preserve their annotated objects. Supply these
original behavior/cost/replay files by absolute paths from the result
checkout. Use new output paths, never overwrite the retained attempts.

From that clone's `src/Interp.Python`, replay with:

```text
uv run python -m zeta_interp.hidden_switch_replay ORIGINAL-BEHAVIOR ORIGINAL-COST --root WRITER-ROOT --output NEW-REPLAY
uv run python -m zeta_interp.hidden_switch_verdict ORIGINAL-BEHAVIOR ORIGINAL-COST ORIGINAL-REPLAY --root WRITER-ROOT --output NEW-VERDICT
```

The source modules, strict admission logic and exact dependencies are in the
archived clone. Source/contract/hand-file bytes must match the archive and
declared source commit; a different source or renamed canonical runner must
refuse. Replaying reconstructs observations and verifies the original costs'
roster/accounting, but does not remeasure costs or reproduce historical host
timing. A fresh native replication is a new run with its own binary/runtime,
source provenance and new filenames; it cannot replace this result.

The [publication preflight](publication-preflight.log) passed all sixteen
checks after result/report assembly. The [record manifest](records-manifest.json)
binds retained original receipts, logs, snapshots and orchestration source.
The [postmeasurement review](../../2026-09-07-hidden-switch-result-review.md)
records the separate provenance/roster/scalar audit and final wording fixes.
