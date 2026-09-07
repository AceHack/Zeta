# Guarded hidden-switch compilation: bounded public-result encoding

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: reviewed record primitive; whole-attempt recorder pending

The [record encoder](../../src/Interp.Python/zeta_interp/hidden_switch_compiled_record_encoding.py)
streams the complete existing `Type`, `Fields` and `BytesHex` convention into
bounded ASCII JSON, including its final newline. It checks the required space
before constructing each expanded string or hexadecimal chunk, and before every
append. It preserves all actual dataclass fields, canonical scalar spelling,
signed floating zero and exact integers. Labels remain evidence, not instructions
to instantiate a producer-named type or proof that an operation executed.

The caller's per-record byte quota is a positive exact integer at most 256 MiB.
Additional finite bounds are depth 128, 100,000 visited nodes, 16 MiB of UTF8
string or original byte-field content, 4,096 key characters and 13,600 integer
bits. The integer bound controls decimal serialization, not scientific numeric
admission. String chunks contain at most 512 Unicode characters; their expanded
ASCII representation is checked before construction. Cycles, unsupported
objects, surrogate characters and nonfinite floating values refuse.

This is a logical output-byte bound. The final immutable bytes conversion can
briefly coexist with the capped bytearray. Input objects, Python overhead and
the bounded temporary chunks are separate from that quota. A failed private
JSON buffer is not published as a complete result artifact. The actual recorder
must retain earlier artifacts and report serialization failure separately from
the operation it was attempting to record.

At `ba5359b726b10521f5573b09d5ad73bcdfd7f668`, all 43 tests pass in
2.12 seconds, with strict source/test mypy and configured Interp Ruff/format
checks passing. The suite compares exact bytes with the prior complete public
projection for all 36 actual static-operation results, plus nested results,
all ASCII escapes, Unicode boundaries, every byte value and numeric edge cases.
An exact-size quota succeeds and one byte less refuses. Instrumented traps
check that exhausted quota prevents expanded-chunk construction and that no
appended prefix exceeds the bound.

The [lossless inventory](hidden-switch-compiled-validation/2026-09-07/record-encoding/manifest.json)
retains 14 records and both source identities. The first 43-case suite passed
in 3.81 seconds while mypy flagged two test imports of an unexported module
alias, and Ruff flagged the surrogate test table and a nonreturning test method.
The final tests use the directly imported JSON module, retain separate high/low
surrogate coverage and raise on prohibited implicit conversion. A subsequent
Ruff invocation from the repository root classified the import group differently;
the unchanged source passed from the configured Interp working directory.
Both observations remain preserved.

Independent source review accepted this exact encoder pin. Complete attempt
retention, operation-outcome replay, source/runtime admission and the registered
experiment remain separate obligations. No registered source was generated.
