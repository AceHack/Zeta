# RNN allocation test: ARM witness and steady-state discriminator

Date: 2026-09-06
Operational status: research-grade
Lifecycle: active
Work item: 081M1W41PKD087G0R0024JFXHT
Author: Vera, OpenAI Codex using GPT-6 Astra
Scope: test-harness repair; no inference-source or experimental-receipt change

## CI witness and source audit

The unchanged allocation test failed on **ubuntu-24.04-arm**, not macOS, in
[run 34060359580 / job 101560251247](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/34060359580/job/101560251247):

```text
2026-09-06T21:22:38Z
RNN inference allocation does not grow with context length [FAIL]
Expected: 39936
Actual:   39952
FactoredPredictive.Tests.fs:line 99
```

The assertion compared one 128-call interval for an empty context with one
for a length-256 context after inference-only warmup. The extra 16 bytes are
one interval-level difference; `39936 = 128*312`. The log does not identify
which runtime event caused the difference, and this review does not claim a
specific cause or infer a new context-proportional allocation from it.

[`SmallRnn.afterUnchecked`](../../../../src/Research.FSharp/SmallRnn.fs)
allocates two hidden-width arrays and one alphabet-width output array outside
the token loop. That loop writes and swaps its two hidden buffers.
Before this repair, PR #16858 changed neither this source nor the previous
assertion. The public
GC counter reports managed allocations attributed to the current thread,
so an interval covers more than an isolated named function invocation.
See the [Microsoft API contract](https://learn.microsoft.com/en-us/dotnet/api/system.gc.getallocatedbytesforcurrentthread).

## Repair and regression discriminator

[`FactoredPredictive.Tests.fs`](../../../../tests/Tests.FSharp/FactoredPredictive.Tests.fs)
now uses exactly five short/long batch samples, alternating order. It warms
the actual counter/checksum/inference batch path with 32 fixed alternating
short/long pairs, then compares the two minimum
steady-state batch allocations with **exact equality and no byte tolerance**.
All five samples appear in an assertion failure. There is no retry-until-pass
loop or threshold adjustment. The existing
[`Runtime/Allocation.Tests.fs`](../../../../tests/Tests.FSharp/Runtime/Allocation.Tests.fs)
already uses fixed minimum-of-five sampling for steady-state allocation;
its array-pool explanation is not asserted as this failure's cause.

A separate negative-control test runs the same sampler while retaining an
`Array.copy` of the context through inference. It requires the long-context
minimum to exceed the short minimum by at least the copied payload:
`128 calls * 256 int32 elements * 4 bytes = 131072 bytes`. The copy has the
same output semantics and is kept alive explicitly. This retained-copy
witness demonstrates rejection of that specific persistent regression class
by the fixed sampled steady-state check. It does not prove that warmup and
five minima detect every possible context-dependent allocation or runtime
phase variation.

The claim is steady-state allocation independence, not that every runtime
interval has identical incidental allocations. No experimental cost receipt,
promotion threshold, model parameter, or `SmallRnn` implementation changes.

## Bounded local diagnostic

A source-loaded optimized FSI prototype ran ten trials on the local macOS
ARM64 host, with the same fixed alternating five-sample rule and retained-copy
discriminator. All ten executed trials passed exact minimum equality, and
the copy excess was 131072 bytes in every trial. No Linux ARM reproduction
is claimed. The prototype's first invocation had an F# tuple-binding syntax
error; correcting its annotation permitted execution without changing the
inference source under audit.

| Trial | Empty-context batches, bytes | Length-256 batches, bytes | Exact minima equal | Copy excess, bytes |
| --- | --- | --- | --- | --- |
| 1 | 39936, 39936, 39936, 39936, 39936 | 39936, 39936, 39936, 39936, 39936 | yes | 131072 |
| 2 | 39936, 39936, 39936, 39936, 39936 | 39936, 39936, 39936, 39936, 39936 | yes | 131072 |
| 3 | 39936, 35840, 35840, 35840, 35840 | 36224, 35840, 35840, 35840, 35840 | yes | 131072 |
| 4..10, each | 35840, 35840, 35840, 35840, 35840 | 35840, 35840, 35840, 35840, 35840 | yes | 131072 |

These samples show allocation levels changing during the process, including
one mixed interval. They support testing a fixed steady-state sample roster;
they do not identify the original Ubuntu 16-byte event. This is a bounded
test-harness diagnostic, not a replacement registered experiment.

The first compiled focused-test attempt passed the constant-allocation Fact
but failed the retained-copy lower-bound Fact. Its counter/checksum path had
only one warmup pair, and the raw samples were:

```text
short = 43008, 43008, 43008, 43008, 43008
long  = 174080, 174080, 174080, 174080, 171744
minimum difference = 128736; required copied payload = 131072
```

The later long batch changed allocation level without a matching later short
sample. This failure is retained: five samples alone do not guarantee both
paths have reached the same runtime phase. The repair therefore warms the
actual batch method with 32 fixed alternating pairs before recording five
samples. Exact equality and the full 131072-byte discriminator remain
unchanged; no tolerance or adaptive retry was introduced.

The revised compiled focused suite passed all eight tests. Eight subsequent
fresh-process `--no-build --no-restore` runs also passed all eight tests each,
with no skips. This bounded local repetition checks the revised instrument;
the Ubuntu ARM CI rerun remains separate evidence, not a claimed local result.

The focused committed tests are reproducible with:

```bash
dotnet test tests/Tests.FSharp/Tests.FSharp.fsproj -c Release --filter FullyQualifiedName~FactoredPredictiveTests
```

The coordinating PR integrates this note into its existing validation index.
