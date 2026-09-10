# Guarded hidden-switch compilation: six-member semantic replay

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: implementation and bounded source review complete; outer/runtime admission pending

## Result and acyclic interface

Source `cdcf34d759a74201aa5599f4556e07af00f6dc4a` adds
`replay_semantic_falsifiers(scalars, episodes, old_controls, semantic, certificate)`
to the existing pure falsifier module. It follows the independently accepted
[coordinator evidence design](2026-09-07-hidden-switch-compiled-outer-negative-design.md)
without changing the [frozen experiment](2026-09-07-hidden-switch-compiled-protocol.md).

The semantic object has exactly `Schema, ScalarCoverage, HandCoverage,
InvocationCases, InterventionCases, RefusalCases`. The API accepts no outer
descriptor and constructs none. This lets the coordinator admit standalone
semantic evidence before producing the outer-negative envelope that the final
complete hand will reference. Complete hand assembly must still compare its
semantic members/slices with that admitted prerequisite and admit its actual
outer descriptor. This API alone performs neither operation.

Success contains a distinct `SemanticFalsifierReplay` with
`NumericCertificateSha256, Completed, MutantRefusals`, fixed scope
`pure-six-member-semantic-falsifier-replay`,
`OuterNegativeAdmission=pending-separate-coordinator-replay`, and
`RuntimeAdmission=not-performed-by-pure-replay`. There is no
`OuterNegativeEvidence` field. Failure is a distinct `SemanticFalsifierFailure`
subclass of the numerical `Failure`, retaining `Code, Message, Path, Completed`
and the same scope fields. No exception-based public error path was introduced.

Both APIs invoke the same actual full-slice and witness implementations.
Shared coverage and final-completeness checks were extracted without changing
the original complete API's order: slices, seven-key shape, coverage,
descriptor shape, witnesses. The new API uses six-key shape and no descriptor
step. Both require all 222 scalar positions, 48 new episodes, 24 full old
controls, ten invocation cases, ten interventions and 53 refusal operations
in 15 groups, plus both actual wrong-stub comparator refusals. Expected output
prefixes and the distinction between delegate/evaluator entries and tree work
remain unchanged. No source generator, filesystem or runtime collector was
added to either pure path.

## Executed validation and source observations

The [manifest and five retained logs](hidden-switch-compiled-validation/2026-09-07/semantic-api/manifest.json)
bind the exact source/test and six direct checking/fixture dependencies to the
source commit. All logs are lossless gzip with stored and decompressed hashes
and byte lengths. The focused run passed **72 tests in 52.25 seconds**, including
the original 63 cases and nine new API cases. Ruff, format checking, strict
source mypy, test-file mypy and diff checking passed. This source change required
no native build or registered source run; the coordinator owns integrated gates.

The added cases establish:

- Complete live new/old slice replay, exact final counts and both actual
  mutant refusals while a descriptor-helper trap would fail if invoked.
- A distinct success type with no descriptor field and explicit pending scope.
- Refusal of an extra descriptor, missing refusal/coverage members and a
  non-object input, preserving the already checked 222/48/24 slice prefix.
- Refusal of an altered final old-control Q value, preserving 23 whole old
  episodes, and a late bool-for-int refusal retaining 52 operations/14 groups.
- Refusal when the actual refusal-checking method is skipped, and typed
  empty-prefix failure for an unissued certificate.

Inputs in this focused suite remain owned Python/synthetic fixtures from the
earlier full-API tests. Their certificate uses the explicit fixture binding,
not a complete archived source map. These 72 tests are not native-produced
conformance, full outer-negative validation, runtime admission or cost evidence.
The separately retained [actual native slice/invocation comparisons](2026-09-07-hidden-switch-compiled-native-slice-replay.md)
keep their own original sources, inputs and narrower admission status.

## Independent exact-pin review

The independently co-claimed reviewer accepted source
`cdcf34d759a74201aa5599f4556e07af00f6dc4a` after a read-only pass, with no
material finding. The reviewer verified reuse of actual slice/coverage/witness
checks, distinct result types and pending scopes, absence of descriptor
construction, the original complete API's unchanged order and the nine
discriminating API regressions. The reviewer ran no tests, native code,
policy, source generator or measurement.

The earlier 92-case outer-negative design was accepted at
`7da46c7f1d2aea9fb4ee721aeb9fd34a7c438681`; its separate signed review is
`7a2519953843ac077b44efa798b0a45524b972ea`, retained by the coordinator.
That design acceptance does not imply its 92 cases or separate runtime/final
actual-envelope validators have been implemented or executed. The original
63-case full-API record and its prior repaired band-hash finding remain
[preserved separately](2026-09-07-hidden-switch-compiled-falsifier-validation.md).
