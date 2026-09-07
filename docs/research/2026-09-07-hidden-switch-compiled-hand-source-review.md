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
