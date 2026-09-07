# Guarded hidden-switch compilation: native-dependent pure fixtures

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra, independent reference writer
Artifact status: corrected implementation validation and bounded source acceptance

The [new pure fixture module](../../src/Interp.Python/zeta_interp/hidden_switch_compiled_native_fixtures.py)
implements the 38 native-dependent cases in the
[accepted outer-negative design](2026-09-07-hidden-switch-compiled-outer-negative-design.md).
It prepares exact immutable `NamedInput` bytes and dispatches 43 actual Python
operations. The other 31 defined slots return explicit `NativeCallPending`
requests; none executes native code or substitutes a Python certificate result.
The 74 defined slots are not 74 completed calls.

## Public boundary and preparation

`prepare_native_fixtures` requires an independently issued numerical certificate,
its independently expected bindings, and raw certificate/binding/hand-slice/
semantic/selector/context bytes. The coordinator separately admits the source,
actual native producer and artifact provenance. Strict binding JSON must match
the expected map and issued certificate identity. The supplied certificate's
complete decoded content must match the independently reconstructed corpus
baseline. Raw binding bytes remain unchanged, including admitted whitespace.

An issued `PreparedNativeFixtures` handle contains the immutable case roster,
input bytes and actual helper results. Its internal certificate/issuance token
is not an evidence DTO; the coordinator records the named public components.
Issuance protects ordinary same-process use and makes no hostile-Python claim.
A typed `PreparationFailure` retains already prepared cases, input bytes and
actual helper results, with zero completed operations. Preparation helpers,
including the constructor's existing Python checks, remain separate from the
74 case slots. The dispatch calls each required checker freshly; cached
constructor outcomes cannot stand in for those calls.

Choice buffers use actual native scalar positions 0 and 1, their exact signed
binary64 input bits, and their Native/Compiled records. Both strategies retain
two passes of the two-position cycle. Packing preserves action/path bytes,
two zero reserved bytes and all six uint32 work fields. Fixed mutations change
record 2's Nodes value without wrapping, remove the last record, swap records
0/1, or change the first reserved byte. Exact context keys bind the certificate
prerequisite ID, caller-admitted source/native-record hashes and two passes;
these context hashes do not themselves establish source or runtime admission.

`dispatch_native_fixture` returns one `Dispatched` actual public Python result,
a `NativeCallPending` request, or a typed zero-call `DispatchFailure`. A returned
checker refusal still counts as one actual Python call. Existing semantic and
choice checkers perform their required independent reference computations;
preparation itself runs no policy or source entrypoints. No separate study
input generation, standalone policy run, native launch or timing is added.

## Initial source and retained validation

Initial source/test pin: `113afdb5a96e0df9894af49de102843d7caacacd`.
The [lossless initial manifest](hidden-switch-compiled-validation/2026-09-07/native-fixtures-attempt-1/manifest.json)
preserves the first 37-case pass (14.00 seconds), expanded 42-case pass
(15.62 seconds), initial import/type diagnostics and source snapshots, and
clean final strict source/test mypy, Ruff and format checks. The typing
corrections renamed a reused local, clarified JSON types and annotated a
mixed test tuple. Initial Ruff ran once from repository root; the project
run's diagnostic and final checks use the Interp.Python working directory.

An exact retained harness also prepared the full roster and wrote every one
of its 43 actual Python returns and 31 unexecuted native requests before
proceeding to the next slot. Its separate preparation record retains raw
input/case bytes and helper results. Tests derive role-byte fixtures from the
already preserved actual native semantic and selector captures, with their
original hashes checked. The supplied numerical bindings and context hashes
are explicitly provisional test fixtures, not final source/runtime admission.
No native certificate-call output is manufactured by this validation.

The tests check all case/role/operation order, distinct raw certificate inputs,
strict binding correspondence, exact choice bytes and retained failure prefixes.
They discriminate skipped/cached dispatch, native-slot Python substitution,
changed terminal old-control data, unissued handles and late preparation
failures. These are implementation checks, not the completed 92-case outer
record or a source-to-runtime theorem.

## Self-review finding before final source admission

The initial preparation decoder uses the role `certificate-corpus-baseline`
for the constructor's actual baseline bytes. Those bytes are preserved inside
the complete constructor result, but the role is absent from the flat
preparation input roster. This leaves an avoidable implicit link in the helper
ledger. Initial source and raw results above were preserved before correction.

## Corrected source and independent disposition

Correction `cb0f7868eae2d467901fa3800416f0ac8a28892c` adds that exact constructor
output as an immutable named input before its decode. The new regression
requires every preparation helper role to resolve to retained bytes and checks
the baseline against both the constructor output and baseline case input. It
first failed against the initial implementation at the missing role; after
repair, all 43 focused tests passed in 18.45 seconds. Strict source/test mypy,
Ruff and format checks passed.

The [separate lossless repair manifest](hidden-switch-compiled-validation/2026-09-07/native-fixtures-repair/manifest.json)
binds 13 source/test/helper files and preserves 91 artifacts, including the
original failing regression, corrected checks, exact harness and each newly
returned result. The corrected validation again prepared 38 cases, dispatched
43 actual Python calls and retained 31 pending native requests. All 74 returned
call artifacts are byte-identical to the initial capture. All other preparation
fields are equal; the one added flat input is the only preparation change. The
retained comparison checks those statements directly.

All 16 quick-preflight checks passed for the corrected source and this evidence
tree; its complete raw log is preserved in the same repair manifest. Full
solution and final integration gates remain the coordinator's separate work.

The independent reviewer, Vera, OpenAI Codex using GPT-6 Astra, accepted the
exact correction pin after reading source/test bytes, the failing regression
and recovery logs; signed review commit
`5f422d1da3a6ccd8bd5ccdbd2a6d7c65a520bb4e` preserves that disposition in the
review writer for coordinator integration. The review confirmed the 38/74
roster, fresh 43/31 split,
actual scalar positions and mutation offsets, retained failure prefixes and
ordinary-process issuance boundary. No additional material source or scope
finding remained. The reviewer executed no tests, native code or source streams.

This acceptance covers the pure fixture slice. The coordinator still must
admit actual native certificate-call outcomes, full input/source identities,
outer envelope and runtime evidence. Neither these tests nor their observed
loaded-module metadata establish those separate obligations.
