# CHSH coverage repair and public API review

Date: 2026-09-06
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade
Lifecycle: active
Work item: 081M1W8PRK0087G0R000T7C4X8

## Preserved defect and repair

The [pre-fix audit](2026-09-06-audit.md), executable witness and original
receipt were pushed at `d0a4fbbd7` before production code changed. The
immutable ref is `archive/chsh-coverage/081M1W8PRK0087G0R000T7C4X8-before`.
It retains the missing-setting and sparse-setting false merge witnesses,
the complete local control, and fresh native build evidence.

`chshS` retains its descriptive numerical behavior. The stream-based margin
now validates the paired prefix, rejects absent setting buckets, and uses
`min(previousHacEffectiveRounds, 4*minimumBucketCount)`. Missing or malformed
coverage returns the existing infinite-margin sentinel. Both calibrated
component paths check eligibility before evaluating the raw score. Balanced
valid buckets keep their old margin; no valid input gets a smaller margin.

The direct meter maps a nonfinite margin to an explicit `Unmeasured` state.
This prevents an absent setting from becoming either an above-bound claim or
an observed within-bound result. It also prevents the internal infinite
sentinel from entering public JSON as a number.

The cap follows a worst-bucket comparison of independent bucket-mean variance
proxies. It is an engineering refinement, not a proof of HAC concentration
under arbitrary dependence. Randomized settings, locality, fair sampling and
two-sided error accounting remain separate assumptions. The repair earns no
physical-controller or general calibrated-CHSH theorem.

## Public API rationale

Review lens:
[public-api-designer](../../../.claude/skills/api-and-protocols/blueprints/public-api-designer.md).
The implementation author supplies this rationale; independent review and
validation outcomes are recorded below before landing.

### `DecorrelationMeter.PairVerdict`: add `Unmeasured`

**Why public?** The existing public classifier must distinguish unavailable
evidence from an observed statistic within a finite bound. The previous two
cases cannot represent that distinction.

**Alternative considered?** Reusing `WithinClassicalBound` would hide the
coverage refusal. Throwing an exception would turn a normal input limitation
into an exception path. A new wrapper API would leave the existing unsafe
classification surface available. Extending the result union is the narrower
change to the existing call contract.

**Commitment cost.** This pre-v1 change requires source callers with exhaustive
matches to handle the third case and recompile. No compatibility alias is
added. Repository search found callers only in the meter and its tests; the
historical witness checks equality with `AboveClassicalBound` and remains valid
only on its archived source.

### `DecorrelationMeter.Reading`: explicit missing observations

**Why public?** `UnmeasuredPairs` makes refused nonempty probe pairs observable.
`Bound` and `WithinBoundFraction` become `float option`, representing absence
without NaN/infinity. `System.Text.Json` emits ordinary numbers for `Some`
and null for `None` with the project's current runtime.

**Alternative considered?** Clamping unknown bounds to zero or four would
invent a measured bound. Retaining NaN/infinity breaks default JSON
serialization. Omitting refused pairs completely would discard evidence.

**Commitment cost and migration.** This is a source and binary API change:
record construction needs `UnmeasuredPairs`; consumers unwrap the two options
and JSON consumers accept null. Repository search found the existing meter
tests as the only typed consumers. The separate TypeScript observation module
does not consume this native record. No production users or compatibility
requirement exist under the repository's pre-v1 contract.

`SpacelikePairs` continues counting pairs with nonempty probes on both ends.
The partition is `AboveBound + WithinBound + UnmeasuredPairs = SpacelikePairs`.
The finite `Bound` covers eligible pairs only. The fraction denominator is
`SpacelikePairs - UnmeasuredPairs`; it is absent if that count is zero. In a
mixed reading, neither the bound nor the fraction applies to refused pairs.
Missing probe endpoints retain their existing skip behavior.

**Test coverage.**
[ChshCoverage.Tests.fs](../../../tests/Tests.FSharp/ChshCoverage.Tests.fs)
pins both component APIs, direct classification, malformed probes, balanced
controls, sparse coverage, old-margin refinement, paired-prefix truncation,
and serialization for empty, wholly unmeasured and mixed readings.
Existing meter tests are updated for explicit absence. The new helper stays
private; tests exercise the public contracts.

**Extension point claim.** None. This changes existing measurement results;
it introduces no plugin or authentication extension point.

## Review and validation

Independent review by the parent Vera agent accepted the cap, eligibility
short-circuit and explicit JSON absence within their stated engineering scope.
It found one material documentation contradiction in the historical meter
header and public result comments: DAG concurrency and HAC were being promoted
to physical validity and a general error guarantee. Those comments now state
the external-assumption boundary; the dated audit preserves the finding.

The independent reviewer re-read the corrected header and public comments and
accepted the public API change: ACCEPT, subject to the ordinary integration
checks. Consumer search found no unmigrated typed callers. The 55 focused
CHSH/meter tests passed, including nine new public-contract facts and default
JSON serialization. The full repair suite passed 7,475 tests with six existing
skips; Release build ended with zero warnings and zero errors.

Implementation commit: `a46143f6b`. The final integration merges
`origin/main` at `0e3456d60` (including relational identity PR #16857) via
`66d0121ce`. The integration build passed with zero warnings/errors; its full suite
passed 7,487 tests with six existing skips. All 16 quick-preflight checks passed.

[Validation commands and retained output](validation/README.md) distinguish
local build/test evidence from GitHub's merge matrix. The formatter supports
C# and VB; it explicitly skips F# projects and is not claimed as F# formatting
validation.
