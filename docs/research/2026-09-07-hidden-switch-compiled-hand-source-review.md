# Guarded controller: incomplete hand collector source review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, independent protocol-review agent
Source: `e8753be7fd022e930d91f4342b57b9e534deb45e`
Disposition: source accepted for the separately authorized incomplete hand capture

The reviewer read the new hand module, fixed-center certificate addition,
entry-point and project wiring against protocol D and I and the separately
authored replay. The five reviewed files match their committed bytes at the
source above. No reviewer build, test, policy call, target launch, source
generation or measurement ran. The author reports the final CLI build passed
in 3.25 seconds with zero warnings/errors, with all five build attempts retained.
That is owner validation, not an independently repeated gate.

## Roster and policy chronology

The scalar roster preserves all 37 ordered belief positions, including both
zeros and duplicate values, crossed with effect true/false and depths 1/2/3.
The six fixed centers reuse exact rational-to-binary64 rounding helpers;
the addition exposes no general rational parser or arbitrary-center API.
Each of the 222 positions retains separate diagnostic Q bits and actual
native/compiled choices. The four explicit tapes, two effects and three
rendering configurations yield 48 new episodes and 24 frozen old controls
in the agreed order. Semantic episode indices match the pure replay.

The new episode passes projected observations and scalar state to the policy.
It commits the actual chosen action before reading private scorer state or
advancing the environment, then records feedback and the next observation.
The callback boundary is shared between strategies. These hand calls make no
cost claim and do not establish the final measured allocation/dispatch boundary.

The envelope deliberately retains `Complete=false`, with successful slices
reported separately by `SlicesComplete`. Falsifiers are absent and missing
runtime/body/closure/full-source admission categories are named. Placeholder
certificate bindings are explicit. A zero CLI exit for complete slices is
therefore not full hand or experimental admission. Source draws remain zero.

## Failure-retention findings and repairs

The initial all-at-once writer could lose completed slices on a later
interruption. The corrected source exclusively creates both final output and
a sibling checkpoint journal before computation. It flushes start/provenance,
current stage/index/strategy and each completed scalar/new episode/old control
as computation proceeds. The verified numeric certificate hash is journaled
immediately, correcting a second gap where later interruption could lose it.

Unexpected exceptions within a new episode are caught inside its accumulator,
so the available trace and hand strategy/index are returned. A further review
found that journaling an already-failed episode/control could replace that
computation failure with a later output error. The final source establishes
the primary failure before journaling and prefers it on that error path;
the outer writer likewise preserves an established computation failure.

The frozen old runner remains unchanged. If it unexpectedly throws, the
journal identifies the active old-control position and preserves earlier
completed controls; its inaccessible current inner trace is not invented.
Abrupt process termination may similarly leave only the current stage marker
for an unfinished operation. Storage failure can prevent new bytes from being
written. The source review does not claim exhaustive fault-injection coverage,
a filesystem durability theorem or a completed full hand envelope.

No material source finding remains within this incomplete capture scope.
Actual outputs must next undergo the independent 222/48/24 replay. Falsifiers,
source/runtime admission and refreshed final executing-graph evidence remain
separate prerequisites before any registered behavior or cost run.

| Reviewed file | SHA256 |
| --- | --- |
| `HiddenSwitchCompiledHand.fs` | `e1bdafe52b157fa5088b84fd76039d068ae9876283298d7e52c69296b8e9c282` |
| `HiddenSwitchCompiledCertificate.fs` | `f9ad3d527a179bb25c72d57b67e469f9045b65f6325347ec00ec63f6e8b8a609` |
| CLI `Program.fs` | `26f9a0af85b8d1b2abe99dcd80df95d23d7437330db938f4c43963fc66fb86fc` |
| CLI `HiddenSwitchCompiled.fsproj` | `6662b36750f5f178d77960548faba3790a8c51c9dbd004bb10d7784da334fbaf` |
| `Tests.FSharp.fsproj` | `2972846aaebea37f5915889fb629b273fa4bb17a57095ad5c0d60e5557905bad` |

## Invocation and supplied-Q witness source

The subsequent bounded witness source is
`8aede9982fc3ce1eb891c5d630710f778b3eff63`. The reviewer checked its new
`HiddenSwitchCompiledWitness.fs`, selector dispatcher and CLI/project wiring
against those exact committed bytes. The author reports its fifth CLI build
passed in 3.30 seconds with zero warnings/errors and retains all earlier
build attempts. No reviewer test, build or target ran.

The ten cases comprise six unsupported-runtime calls across both effects and
three depths, two real interior fallback calls, and two deliberately wrong
callbacks tied to the preceding real cases. Delegate entries are incremented
at the actual callback entry; evaluator entries are incremented immediately
before the real evaluator call through the shared native core. The wrong
callback is actually invoked and returns the opposite action with zero tree
work. Returned traversal counters remain distinct from these entry counters.
Normal unsupported dispatch still binds the actual native service.

A separate supplied-Q witness reads the verified certificate's epsilon,
executes the unchanged strict selector at `[0, epsilon]`, and executes the
explicit inclusive-comparison mutant. It is not an eleventh invocation case.
The raw-byte helper is now private to its verified caller, resolving the
reviewed exception path on a formerly public Result-returning helper.

An initial early metadata/certificate failure could bypass the terminal report.
The accepted repair retains available hashes, provenance and completed cases
in an incomplete report, attempts journal and final output independently, and
preserves an established computation failure through later write/disposal
errors. If the terminal journal fails, the final report's `SlicesComplete`
is false. Successful checkpoint retention is explicitly qualified for abrupt
termination and storage failure. Source review is not exhaustive injected-I/O
validation or a durability theorem.

The witness module's SHA256 is
`9aedcdd2e90715d27b49b6105ef218a21e6a2f6783c5041f9ddbafac03a5000a`.
No material source finding remains in this incomplete conformance scope.
Independent replay of actual output and the separate complete falsifier,
source and runtime boundaries remain required.

## Independent supplied-Q replay source

The pure checker at `16d2ac85bd00ce6664731470a3c5f8345f9df4fb`
(`hidden_switch_compiled_outer_negatives.py` and its test) is accepted for
this one witness. It admits the opaque certificate and exact nested input
shape and Q roster before decoding. It actually invokes the independent
software selector on those retained bits, checks the exact epsilon difference
and strict harvest result, then checks the inclusive mutant through the same
action boundary. A mutant that does not differ cannot earn coverage.

The source tests distinguish permissive action checking and an inclusive
reference selector, as well as wrong action types, altered Q bits and extra
fields. The author reports 23 focused cases passing after a retained static
typing correction. The reviewer read the immutable source and tests without
executing them. This acceptance covers neither actual native output replay
nor file, envelope or executing-runtime admission.
