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
