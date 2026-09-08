# Guarded hidden-switch compilation: first actual native slice replay

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: actual native hand-slice conformance; full hand and runtime admission pending

## Result and exact scope

The first actual native hand-core capture matches the independently authored
software binary64 reference in every supplied scalar, new episode and old
control field. The comparison executed once and exited zero. These are
untimed explicit hand cases under the unchanged
[compiled protocol](2026-09-07-hidden-switch-compiled-protocol.md); no registered
source generation, behavior or cost run occurred.

| Independently replayed slice | Exact completed counts |
| --- | --- |
| Scalar audit | 222 positions; 444 choice-work records |
| New hand episodes | 48 episodes; 768 choices; 816 observations |
| Old full controls | 24 episodes; 384 planning records; 408 observations; 1,944 numeric values |

The [pure scalar/new-hand checker](2026-09-07-hidden-switch-compiled-pure-replay-validation.md)
and [old full-control checker](2026-09-07-hidden-switch-compiled-old-replay-validation.md)
reconstructed their complete ordered rosters. Native Q and belief encodings
were checked at exact binary64 precision. Old-control replay retained both
Q arrays, every counter and the terminal observation. This actual native
input is distinct from the earlier Python-produced checker test fixtures.

The native capture itself reports `Complete=false`, `SlicesComplete=true`,
null falsifiers, zero source draws, and false runtime/body/closure admission
flags. Its missing categories are falsifiers, runtime body/closure, and full
source archive admission. This replay preserves those limits. The combined
scalar/new checker still reports old controls as pending in its own slice;
the separate old-control result discharges only that numerical slice.

## Preserved inputs, source and execution

The [evidence manifest](hidden-switch-compiled-validation/2026-09-07/native-slice-replay-attempt-1/manifest.json)
indexes the exact harness, result/stdout, empty stderr and native input.
All four artifacts are lossless gzip with both stored and decompressed
lengths and SHA256 values. Original attempt files were not overwritten.

- Native source: `e8753be7fd022e930d91f4342b57b9e534deb45e`.
- Native producer evidence: `3bd4843b8632b99081521f78183b95edeeeb1d48`.
- Independent reference tree: `5c6d40e66339077754f8f392390ab5befc5f3c8f`.
- Native input: 447,583 bytes, SHA256
  `48965F2CD70C40047772DA7E87DD462734D5A371D059BD30C6E1D8C0BFA17D32`.
- Replay result/stdout SHA256:
  `C3C3727FC9D626F13AB739157DE3CA2AA86E30EFE436DA724D2B0181C9C2522B`.

The native producer records .NET 10.0.11 and loaded assembly SHA256
`6FDF7ECA095C56A923FC657A8EC235740A4B35795513FABD3B5DCB12A71FFB61`.
These are retained producer observations; this replay does not establish
the executing native method-body or loaded-artifact admission premises.

The harness ran Python 3.14.6 in this writer's Interp.Python virtual
environment. Its retained result records the actual executable path,
interpreter version and loaded hidden-switch module file paths/hashes.
The evidence manifest additionally checks those observed source bytes
against the reference commit. This is a finite source/file observation,
not full `admit_python_identity` execution, an interpreter attestation,
a source-to-bytecode theorem or an unspecified dependency-closure claim.

The exact native input hash was checked before parsing; its bytes were
checked unchanged again after both replay calls. The small harness rejects
duplicate JSON object keys and nonfinite constants and preserves lexical
negative zero. It is not the final complete outer-envelope admission path.
It reconstructs and verifies the numeric certificate using precisely the
frozen protocol binding plus `hand-validation` with 64 zero characters.
The numeric certificate SHA256 matches the native capture:
`8883D8C91C18F5D53360C64579D6F5241A606E0907E57E06C0CD69941BC1CA7F`.
That placeholder source binding does not admit a complete implementation
archive. Full source/runtime, executable falsifier and coordinator negative
evidence remain prerequisites before the implementation archive and any
registered measurement or speed claim.

## Subsequent actual invocation and epsilon-tie slice

The first separate native invocation capture also passed independent replay,
once, with exit zero. Its ten ordered invocation rows matched the real
independent reference computation, including ten delegate entries and eight
evaluator entries. The two deliberately stubbed native choices were actually
compared with the ordinary reference contract and refused with `ValueMismatch`
at `Falsifiers.InvocationCases[8].Choice.Action` and the corresponding row 9.
These are actual retained native wrong-action outputs, distinct from the
earlier Python-generated mutation fixtures.

The separate supplied-Q witness used exactly positive zero and admitted
epsilon bits `3D719799812DEA11`. Actual unchanged native strict selection
returned harvest 0; an explicitly executed inclusive-comparison mutant
returned switch 1. The independent software binary64 selector returned 0,
and its exact comparator rejected the native mutant at
`SelectorWitness.Mutation.Action`. This supplied-Q conformance neither adds
a belief sample/strategy nor demonstrates a registered behavioral outcome.

The [invocation replay manifest](hidden-switch-compiled-validation/2026-09-07/native-invocation-replay-attempt-1/manifest.json)
retains the exact harness, result/stdout, empty stderr and raw native capture,
again with lossless stored/decompressed identities:

- Native source: `8aede9982fc3ce1eb891c5d630710f778b3eff63`.
- Independent reference tree: `05ef2a04fca26f0fb2bb1750d634bcc123ac8168`.
- Native input: 7,457 bytes, SHA256
  `9EBBC621583A24BF45DB3AD50F665CCD3EF3D4A7070004F9CDF4E58D705FD78D`.
- Replay result/stdout SHA256:
  `094130ADFE4A8F445BABB156533ADFB92EA7B5EE664FA29418EA973FC8EAD7EC`.
- Producer-observed assembly SHA256:
  `AC676DB9E4C28AE85ADDE5DF86989FC1020E33AFAEA4E46314E063BF600C04B3`.

The small harness called the existing `_Checker.invocations` internal method
directly, then the software selector and exact comparator. It did not call or
claim success of the complete public falsifier API. Its explicit counts for
all other slices, intervention and refusal groups remain zero. The source/file
observations match the pinned reference tree; Python executable/version and
the placeholder certificate bindings are the same as in the earlier slice.
The input bytes were checked unchanged after replay. Full interventions,
refusals, whole-hand, source archive and runtime admission remain pending.

The independent [historical capture publication review](2026-09-07-hidden-switch-compiled-capture-publication-review.md)
checks the separate 2,550-record graph-evidence inventory at `11cd3368af8fbd0f20b45ae4a825372ed2144b3a`.
Its unchanged-byte preservation and source-history checks do not provide
runtime admission or extend these numerical slice results.

The later [native semantic source review](2026-09-07-hidden-switch-compiled-native-semantic-source-review.md)
accepts the ten-intervention/fifty-three-refusal collection boundary at
`7eaec2bf2312e04ff0fc936a4c28a09d1704b1f0`. It is read-only source review,
separate from the actual earlier slice captures and pending full semantic replay.

## First actual complete semantic prerequisite

The first actual native semantic receipt from source
`7eaec2bf2312e04ff0fc936a4c28a09d1704b1f0` passed the unchanged independent
six-member API at `cdcf34d759a74201aa5599f4556e07af00f6dc4a`.
The [lossless attempt-one manifest](hidden-switch-compiled-validation/2026-09-07/native-semantic-replay-attempt-1/manifest.json)
binds the complete 975,309-byte input, SHA256
`E83775583A18712E4495EB57EFAC80A61316129E85D4EFAC0D02C8E1AB6C1451`,
exact executed harness, result, identical stdout, empty stderr and preservation
script. It also pins the actually observed imported task-source files to the
reference checkout `0e0f8664765c7157b153bed86da217b8bf81a5e4`.

Replay checked all 222 scalar positions, 48 new episodes, 24 old controls,
10 invocation cases, 10 intervention cases and 15 groups comprising 53 invalid
operations. Actual delegate/evaluator-root counts were 10/8. The two deliberate
stub outputs were independently rejected at their `Choice.Action` fields.
The supplied-Q tie witness remains a separately retained earlier slice; it
was not silently added to this six-member receipt.

The replay process exited 0. Original input bytes and observed imported-file
snapshots remained unchanged. These snapshots record file/current-byte facts;
they are not complete loaded-module admission or a source-to-bytecode theorem.
The native receipt has `SlicesComplete=true`, `Complete=false`, and all
runtime/body/closure flags false. Certificate bindings remain the protocol
hash plus the explicit zero `hand-validation` placeholder. Actual semantic
agreement does not admit those placeholders as final archive/runtime evidence,
and outer-negative replay remains pending. No registered behavior/cost source
was generated or executed during this hand-only replay.
