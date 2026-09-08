# Guarded controller: independent native-dependent replay review

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded source acceptance after two retained findings

I read the complete implementation and tests at initial source
`e2dde77cf59de9fe435dcc69eb63cf842bc48578`, then the exact repair through
`e4946ec091981ccbd3057eb568d56069e79df4f2`. The final current files equal
their committed bytes:

| File under src/Interp.Python | Bytes | SHA-256 |
| --- | ---: | --- |
| zeta_interp/hidden_switch_compiled_native_replay.py | 27223 | 438d725d4b113628df1a2e373e03752bedad4ed94ce00efd8dcef8f3b81752ae |
| tests/test_hidden_switch_compiled_native_replay.py | 22533 | 24e848564c75f5b41eea243dc6a1a6f1800ffe3efe5381e0cc263b8057cca148 |

## Findings and discriminating repair

The initial implementation incremented PythonReturned only after admitting
Dispatched. A normal DispatchFailure, None or other returned object therefore
survived in the observation but was incorrectly counted as no return. The
repair increments every non-raised return before shape and completion checks.
Started, returned and matched counts remain separate; a raised dispatch does
not invent a normal return.

The initial code also accessed nested Call members without admitting their
type. A Dispatched carrying Call=None or a mapping escaped as AttributeError,
losing the typed replay failure. The repair requires exact Dispatched and
CallResult types, string case/operation/role fields, a tuple of roles, exact
integer call index and exact integer CompletedOperation=1 before comparison.
The short-circuit order protects all subsequent accesses. The added boolean
index fixture independently showed that False had previously matched index 0.

All six new regressions failed against the original source: three undercounts,
two escaped exceptions and the boolean-index false acceptance. I read that
retained failure log, the corrected 55-pass log (71.27 seconds), and the final
six-case pass (9.61 seconds). The five intervening mypy diagnostics were in
deliberately malformed test construction; explicit annotations/casts corrected
them. The final mypy-final.log, ruff-final.log and format-check-final.log are
clean. The production module is unchanged between the 55-pass run and the final
test typing cleanup. I did not rerun these tests.

## Accepted boundary

The independent caller supplies certificate/bindings and the exact prerequisite
bytes. Fresh fixed preparation selects the 38 cases and 74 slots; producer
labels never choose execution. The implementation performs 43 Python dispatches
and compares 31 independently supplied original native reports. It launches no
native process. Actual preparation and dispatch observations are retained before
recorded-result parsing, encoding or comparison. Late failures keep the prior
prefix and the actual active return.

Each native report requires the complete fixed 15-field schema, source-specific
success/count flags, matching input/binding hashes and the fixed accepted or
refused outcome. The nine failure fields retain their exact shape; the six
location fields must be null. Fixed mismatch/bytes details are exact, while
parser detail is retained from the independently supplied original report and
compared. Only then is the three-member expected case DTO derived. Metadata
strings and report flags alone do not authenticate process execution, timing,
source, host or runtime; independent raw-report provenance is a caller premise.

None native evidence yields Pending with explicit slots, while a supplied
missing, reordered or extra list refuses at its actual position. Both paths
can retain already returned Python calls. Complete canonical result comparison
preserves all Type/Fields/BytesHex values and distinguishes booleans, numbers
and signed zero. Producer type names are data and are never instantiated.

The one-MiB per-result/report and 128-MiB aggregate consumed-byte limits are
implementation bounds, not a peak-memory claim. Repeated consumed positions
are charged. Preparation exposes a named snapshot of its public fields instead
of pretending the private issued handle was durably serialized. The original
test fixtures' provisional binding composition remains separate from complete
joint source/runtime provenance.

No remaining material source finding was identified at the accepted pin. Actual
repaired capture inventory, whole outer artifact/source admission and full
runtime/body/call closure remain separate obligations. No registered source,
policy, target, dump query or measurement was executed by this review.

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
Task: 081M1XXWTTF087G0R000X1HMD0
Co-Authored-By: Codex <noreply@openai.com>
```
