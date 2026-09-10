# Rendered catch: independent carrier and replay source review

Date: 2026-09-06
Operational status: research-grade
Lifecycle: active
Work item: 081M1W8T690087G0R002DJ91MJ
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Delegated review identity: `codex/identity-formalization-review-20260906`
Artifact status: independent source review; no registered measurement by reviewer

## Scope and review outcome

This review checks the independent Python carrier, full replay reader, and
their tests against the
[registered protocol, including section K](2026-09-06-rendered-catch-actions-protocol.md)
and the native receipt/runner boundary. The coordinating contributor accepted
both findings below and repaired them before the implementation freeze.
The final source review finds no remaining material defect in this scope.
Measured return, timing, and promotion remain separate empirical questions.

The initial inspected integration was
`814236852f14f6be261a64c7b3bc804855ed0143`, containing Python carrier/replay
commit `787eff03df39b6b7cb99f5d2920684b26886e00f` and native implementation
commit `b4559e5b35da5b415dc6e4e7917633643f7f187a`. The final inspected repair
is `3094377a3e86efb89b291d1dd286f4ba9f008be3`; the file fingerprints below
were read from that commit in the reviewer's isolated clone.

The reviewer read the Python source and tests, the registered protocol and
design correction, the native `RenderedCatchReceipt`, `RenderedCatchCarrier`,
`RenderedCatchPolicy`, `RenderedCatchExperiment`, runtime and runners, and the
actual `GameEnvironment`, `Chip8Cow`, `FrameSignals`, `FrameMotion`, font, and
random-stream definitions. This was a separate contributor's source review;
the reviewer did not edit the implementation or execute registered panels.

## Findings retained through correction

| Finding | Initial defect or missing evidence | Reviewed correction |
| --- | --- | --- |
| P2: incomplete replay receipts lost attribution | The exception handler discarded the exact native/cost input hashes and admitted provenance even after successful source admission and partial replay. Failure panel, arm, and episode were always null. | A progressively populated attempt context retains each input hash once read, admitted source/runtime provenance, protocol/count identity when available, stage, and completed batch counts. Comparison failures retain their field path and recover the episode index; `EpisodeExecutionError` preserves the original corpus index for interpreter refusals, including cost rows beginning at 8. Values unavailable because reading or admission failed remain null. Existing output and partial files remain protected from replacement. |
| P2: full-envelope mutation coverage was missing | Existing tests checked compact batch helpers and exact equality, but did not exercise a successfully admitted full-shaped replay and its missing/duplicate arm, source/model, or cost-repetition mutations required by protocol H. | A synthetic four-panel, five-arm, 25-cost-row fixture exercises the real recorded-provenance validator, envelope validator, input-byte binding, and complete replay loops. Its own runtime manifest, archived-byte provider, source generator, and interpreter are explicitly substituted. No registered source/policy panel is run by this fixture. |

The envelope suite includes 15 hostile variants: missing/duplicate arms and
episodes; changed model input, count fingerprint, source symbols, ROM digest,
and source manifest; changed committed source bytes; wrong cost repetition or
rotation; missing/duplicate cost rows; and a changed cost runtime. Mutating
both native and cost source manifests identically still fails against the
separate admitted fixture roster. Each variant must refuse before the
interpreter stub is called.

The successful synthetic fixture checks all 70 calls: 20 behavioral batches
and 25 warmup/timed pairs, accounting for 20,480 behavioral, 200 warmup, and
1,600 timed episodes. A separate mutation after two completed arms records
the exact input hashes and admitted provenance with panel
`dot-three-quarter`, arm `last-beacon`, and episode 7. It also checks that a
second invocation cannot replace the failed receipt. An input-read failure
retains the first file's hash when the second file cannot be read. A malformed
hand-fixture row verifies original corpus index 8 on interpreter refusal.

The coordinator reported all 18 new envelope cases passing. This report's
acceptance is based on inspection of the implemented checks and their test
paths; it does not relabel the coordinator's test execution as the reviewer's.
The coordinator subsequently reported the complete Python gate at 258 passes
with one existing activation deprecation warning, clean lane lint/format/type
checks, and a native Release build with zero warnings/errors and 7,523 solution
test passes plus six existing skips. The native gate ran at `814236852`;
the later fixes changed Python, workflow, and claim files rather than native
implementation. These reported gates accompany the publication validation
record; this source review does not substitute for their retained output.

## Execution independence and information boundary

The Python carrier regenerates its source/action streams, compiles the
admitted ROM, fetches actual bytes from its own dense memory, interprets the
admitted instructions, and renders its own pixel buffer with local font data.
Its `FX0A` path distinguishes held key zero from no key; the latter stalls.
VX shifts, clipped XOR draws, collision capture, font selection, and the
17 advancing instructions per group agree with the inspected native subset.
ROM admission checks every byte, rather than allowing unknown opcodes to
become silent no-ops.

Both runners choose and record each scored key before the next environment
advance. Policy state receives only the already-rendered projected frame.
ROM/source truth and private registers are used for evaluator conformance
assertions; they do not provide fallback observations, choices, or rewards.
The hit is decoded from the rendered glyph after the key has been applied.

The projection's majority computation reads only rows 0..23. Full-frame
binary-domain validation may inspect lower cells, but valid lower-band
changes cannot affect that majority. The projection replaces rows 24..31
with the upper-band background before policy decoding. Its four-neighbor,
single-component, single-half decoder matches the native rendered decoder
on this admitted domain. A tied upper-band majority is a shared refusal,
as clarified before measurement in protocol K.

Inspected conformance tests cover both keys against both next targets,
unrevealed suffix changes, upper-band changes, lower-band substitutions for
all five policies, palette inversion, dot/bar geometry, first/final groups,
malformed inputs, and continuing fair action streams across episodes.
Forked fair-policy witnesses include the stream state; they do not compare
successive draws from one evolving random stream. The live hand-fixture test
compares all 15 native/reference combinations using every episode field and
the raw frame, projection, ROM, and observed instruction-trace digests.

## Receipt and provenance assessment

The successful replay admits the fixed panel, arm, episode, and cost-row
rosters before entering its expensive loops. Recursive typed equality rejects
boolean/integer substitutions, missing or additional keys, and unequal list
lengths. Source symbols and raw ROM-byte hashes are reconstructed, while
every admitted behavioral batch and every cost warmup/timed batch is
independently executed and compared. Cost timed indices remain 8..71.
There is no successful empty-list join or selective row skip in this path.

Source admission checks the loaded Python modules' paths, the resolved
implementation archive bytes, the declared current commit's file bytes,
and registration-to-implementation ancestry. Recorded native/cost manifests
are validated against the same admitted roster and against the files in
their declared source commits. Native and cost runtime, operating system,
assembly identities, archive, and source fingerprints must agree. Replay
hashes the exact input bytes it checked. These checks are provenance and
consistency evidence, not a cryptographic attestation of the executing host
or a reproducible-build proof for the recorded native assemblies.

## Limits carried into later reporting

The Python reference executes **one** instruction path. Its primary/shadow
counter fields encode the expected native schedule checked against that
observed instruction stream. It does not execute two Python emulator paths
or independently instrument the native adapter's hidden individual steps.
The native implementation separately executes primary and shadow paths,
counts both, and checks complete group-end state equality; those two paths
share `Chip8Cow`. Python reproduces the admitted frame, policy, reward, and
PC/opcode-trace behavior. Its reference state omits unused constant timer
and other native-only fields, so its agreement is not an independent check
of every private native state field.

Elapsed time, CPU time, and allocation remain validated native metadata,
not independently reproduced Python quantities. The supplied goal and
target-band projection remain part of the experiment. The review supports
proceeding to the registered supplied-goal contextual-bandit comparison;
it establishes no acting result, learned representation, multi-step planning,
or ARC competence.

## Final source pin and publication

These are SHA256 hashes of the final inspected Python execution and test bytes:

| File | SHA256 |
| --- | --- |
| [`rendered_catch_carrier.py`](../../src/Interp.Python/zeta_interp/rendered_catch_carrier.py) | `E9341904BF33323C5982845D39DD2C205AF6E3BD7853ACF416C0D2E9075002A4` |
| [`rendered_catch_replay.py`](../../src/Interp.Python/zeta_interp/rendered_catch_replay.py) | `3E1770B4A18571E87E515E3CEFBB834C178BB5618B8ABA9B83073D8FA67E2918` |
| [`test_rendered_catch_carrier.py`](../../src/Interp.Python/tests/test_rendered_catch_carrier.py) | `1E2A6E4A73B2205C1AEFC5F6D3F7736162A0AA9C8C23D347F88332D711A2EF27` |
| [`test_rendered_catch_replay.py`](../../src/Interp.Python/tests/test_rendered_catch_replay.py) | `E95CB7971CFB33DBA28B13CB4079F4F16603194024238028101D9B0434E55F35` |
| [`test_rendered_catch_envelope.py`](../../src/Interp.Python/tests/test_rendered_catch_envelope.py) | `A6A84BD312606F8ACAE6CAEE787E65A11ABCFA1D9A42557A7BD519F877DE7922` |

The reviewer's documentation preflight completed with 15 passing checks and
one pre-existing non-equality arity-census failure at
`src/Core.TypeScript/formal-verification/nci-witness-receipt.test.ts:103`
(baseline commit `96fd5630ea3ef2fe9cad3beaa48332d7f203096f`, PR #16868).
That test asserted absence of one checker filename while claiming emitter
independence; the R5 gate correctly requested a stronger witness. Markdown
and all language lints passed. The coordinator received the exact failure
and owns its separate repair before integrated publication. This review does
not approve a census allowance for that unsupported independence claim.

The coordinating contributor publishes the final repair commit, this review,
the immutable implementation archive, and the complete validation record
together. This note is indexed from the
[follow-up design audit](2026-09-06-rendered-catch-followup-design-audit.md),
which is reachable from the acting protocol and handoff.
