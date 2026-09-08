# Guarded controller: actual three-method extent evidence review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: three-method evidence accepted; complete graph remains unadmitted

This bounded read-only audit covers evidence
`dd6fc286b02b9346f0f5b78dfb273e4f267ba4f4` from reviewed source
`c1cf790218d0584330743cf0178f9dc75772c439`. I independently verified all
42 startup, 26 first-failure and 28 successful-query records against both
stored and decompressed lengths/hashes and their local originals. All 48
current helper/source/host input pins match. The
[retained audit snapshot](hidden-switch-compiled-validation/2026-09-07/clrmd-extent-review/manifest.json)
records the exact comparisons. I launched no helper, analyzer, target or
measurement and did not read the raw dump or query any memory range.

The actual second helper and driver exited zero at
2026-09-07T22:27:03.119799Z, helper PID 86223. Each current NativeCode and
complete hot range agrees with its fresh physical-file/compiler candidate:

| Method | Current hot start | Bytes | Cold start/bytes |
| --- | --- | ---: | --- |
| predict | `0x10BCB0BC0` | 252 | 0 / 0 |
| condition | `0x10BCB1190` | 532 | 0 / 0 |
| select | `0x10BCAEF00` | 224 | 0 / 0 |

The total is 1,008 hot bytes. Input, reflected and returned metadata tokens,
full declared signatures, module path and file-MVID association agree. Each
physical record reports unique file backing for the declared stub, pointer
cell and body, with identical body/compiler SHA-256 and length. This audit
compares the preserved observations; it does not independently re-read dump
segments. The accepted physical-reader and helper source remain premises of
the correspondence. No cold-range expansion or historical-code substitution
was admitted.

The actual 2,003-byte helper output hashes to
`92cb4c006e9f7bb4b0910e83788f235ae1cabf235a0d8dd74c3bddc33e125f43`.
Its 74,297-byte journal contains 402 records, including explicit complete
runtime enumeration, the exact thirteen ClrMD assets and separate FSharp.Core
identity, three incremental method prefixes and three full method records.
Actual target version/build identity are 10.0.1126.37416 and
`6CB64FF242FF30EABC454640FA3B0D03`, matching the expectation bound to the
unchanged installed runtime bytes. The exact requested DAC path/header/file
identity is observed, with zero locator requests. Signature verification was
explicitly disabled; file identity is not loaded-memory equality.

Dyld counts are 358 before enumeration, 358 after copying and 358 after file
identity work. Those are non-atomic observations. Managed-assembly counts
change from 23 to 28; selected helper-local/corelib file rows change from four
to five. No complete stable framework-load closure is inferred. Original
and copied target files, helper custody and source/host pins are separately
retained. Local PE MVID/native reflection remain a file association rather
than a dump-derived MVID theorem.

The first missing-FSharp.Core startup failure, no-argument expected-exit-2
loading regression and three earlier SOS-host refusals remain separate.
The report now states the read boundary accurately: full hashing reads the
file, and ClrMD/DAC may read additional internal module/type/thread metadata.
Only explicit driver memory-range queries and unrelated memory publication
are restricted. Raw dumps and copied executable files remain local-only.
I found no remaining material evidence/reporting issue in this narrow slice.

## Next bounded inspection proposal

A read-only count of the fresh dump2 ready metadata gives 139 roster rows:
130 prepared and nine explicitly unprepared generic/absent-IL rows. Historical
123-candidate/four-generic counts must not replace these current identities.
The next source proposal should first map this exact finite prepared roster to
unique token/MVID/type/name and compiler-block identities offline, preserving
all missing or ambiguous mappings and binding the roster bytes before any
helper or physical-reader expansion. Input/output ceilings should remain
explicit and tested against the declared finite roster.

The nine unprepared rows stay visible. Generic template or inline-body absence
is not proof that a path is irrelevant; any such disposition requires actual
caller/body evidence. A later separately reviewed helper can compare the
mapped current extents under the same pinned original/copy/runtime/DAC
premises. Framework/generated/indirect targets, complete arithmetic/control
flow, guard-object/selector-register association and exception edges remain
separate closure work. This proposal authorizes no new query by itself.

The observed three-method route is feasible. It establishes neither complete
reachable-call closure nor correctness of the helper/library, and does not
admit a final policy/runtime or scientific outcome. Actual `RuntimeAdmitted`,
`BodyResolved` and `ClosureAdmitted` remain false. Full source/runtime/outer
review and the immutable implementation archive are still required before
registered source generation or cost measurement.

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
