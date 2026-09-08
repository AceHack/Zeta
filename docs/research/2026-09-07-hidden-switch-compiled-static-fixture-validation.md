# Guarded hidden-switch compilation: static fixture operations

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: fixed preparation and actual call dispatch; outer coordinator pending

The [static fixture module](../../src/Interp.Python/zeta_interp/hidden_switch_compiled_static_fixtures.py)
prepares immutable source-fixed inputs for 32 reviewed cases and dispatches
their 36 top-level operations individually. Its families are strict JSON,
in-memory artifact binding, complete-input links, schedule headers and exact
resource comparisons. Filesystem and child-process cases remain separate.
Preparation performs no counted operation. A caller can retain an operation's
complete actual result before starting the next operation.

Dispatch calls the real shared admission functions over the supplied bytes;
it never regenerates preparation to replace a malformed actual input. The
tested descriptor is separate from the descriptor that will retain those
test-input bytes. Link cases require an explicit four-field context and seven
additional complete support artifacts. Both lexical substitutions preserve
the decoded replay subject while failing the independent original-byte binding.
Executed fixture-only omission mutants admit both substitutions, and the real
witness checker refuses those actual acceptances. No production bypass exists.

At `fa1d34a89bc6bb2f40b6be66a10cde32d9698e1c`, all 59 source/test cases
pass in 2.07 seconds; strict mypy, Ruff and format checks pass. Tests exercise
all 36 actual operations, exact refusal boundaries, complete public-result
encoding, isolated metadata substitutions, negative-zero decoding and the
integer half-threshold discriminator above binary64's exact integer range.
An injected shared-boundary result is returned by identity, proving that
dispatch preserves the actual result and executes only the selected call.

The [lossless inventory](hidden-switch-compiled-validation/2026-09-07/static-fixtures/manifest.json)
retains 13 records and both source identities. The first source mypy pass
caught four incorrect positional uses of the keyword-only strict JSON API;
the calls were corrected before execution. The next suite passed 59 tests
in 4.03 seconds while mypy flagged the deliberately malformed bytearray test's
annotation. An explicit malformed-value annotation preserves that runtime
test, and the final strict pass and 59-case run are retained. The earlier
diagnostic dispatch log uses clearly synthetic context values and is not an
outer-envelope artifact.

This module does not authenticate prepared input identity, judge complete
conformance, perform file retention, enforce an aggregate output quota or admit
scientific/runtime phases. The outer recorder and independent replay must
compare the exact source-fixed inputs, retain all referenced support bytes,
check every actual outcome and complete the separate four-operation omission
audit. The registered source streams remain unopened. Independent source
review is pending at this checkpoint.
