# Guarded controller: mapped extent source review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded 130-method offline query source accepted

This prelaunch source review binds native-writer commit
`af90bfc9e95fbdb8246c438da26e30a727bcbb5f`. I read all six changed files
and verified their exact committed/current bytes:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| MetadataProbe/Admission.fs | 14611 | aa2a97f0fc8e2e4160d3e8acbd8e75af9e8d14cf2406600471bb283fdbf35825 |
| MetadataProbe/Program.fs | 25760 | 904fe28e51671665bc56d4e47d411696a59b8b6fe93c6dbd2312fac4541a01d8 |
| probe_hidden_switch_metadata.py | 22353 | 9a3d1b8864f614598fb0b50b98604752fd80cb9fe8120ca3984c748a48ba79f0 |
| test_probe_hidden_switch_metadata.py | 11676 | 4655a9be4116f96cc0b2a65be855ebcc5c0c3b2f7a92ca834eb3c33b42830a7e |
| tests/Tests.FSharp/HiddenSwitchMetadata.Tests.fs | 13421 | 3dda07fcaf46ed4aaf414c64135477dd7d794cfdd6d5e25c10a71bf1f48ccc65 |
| tests/Tests.FSharp/Tests.FSharp.fsproj | 48304 | 01ffa6af2cf711139b3422d1233ba152aed5a93e35a5bd87170510f3910d20ae |

The first four paths are beneath src/Research.FSharp.Cli. The old three-method
input/command remains available. The distinct mapped-130 command requires the
exact 185,092-byte mapping with SHA-256
`0D22A5C3679B5F47F874E8C1C10CFD34B17E9E4B7E3B649E2590F22F0F25A39A`,
preserved at `39ee571c101bdd85101a6d7c569efaa3890d944c`. Its input has
exact typed fields, 130 ordered unique MethodDef tokens and disjoint aligned
candidate ranges totaling 34,660 bytes. Every obtainable input field is then
bound to the exact mapping row. The count is an explicit alternate scope,
not a general arbitrary-method query interface.

The copied PE corroboration follows each exact MethodDef token to its declaring
nested type, method name and IL bytes, comparing them with captured native
reflection. It retains the reflection signature while recording the full
actual ClrMD signature separately. No guessed signature grammar or nested-name
normalization is used. Actual DAC token/type/name/module path, current NativeCode
and hot/cold bounds must match the selected physical candidate. A local copied
PE MVID association remains distinct from a dump-proven module MVID or generic
instantiation proof. Missing or different metadata refuses with prior rows
retained.

The physical driver admits only the mapped 130 eight-byte callable stubs,
eight-byte pointer cells and 34,660 compiler-sized body bytes. It keeps the
existing exact observed stub decoder and file-backed Mach-O range checks.
No literal or extra-block read is introduced. The nine unprepared rows and
nine unmatched emitted blocks are retained in the plan as separate obligations.
Full-file hashing and ClrMD/DAC internal metadata reads remain part of the
already stated dump-analysis boundary; the explicit driver range restriction
is not a claim that those components read only these code bytes.

Two review findings were corrected before this source pin. First, a decoded
pointer target was previously lost if target validation or body reading failed.
The cell record now publishes DecodedTarget, TargetNonzeroAligned and
NextRequestedBodyBytes before either step. Synthetic missing-body and unaligned
cases require that prefix. Second, the driver now checks exact integer
RequestedMethods and AvailableMethods headers against the expected roster,
so contradictory or boolean counts cannot accompany a successful result.
Its refusal text also names the declared scope rather than mislabeling a
130-method failure as a three-method slice.

Before launch, the driver copies the bounded helper module/config roster with
the already reviewed same-descriptor exclusive custody helper and publishes
each row. Those originals must equal the prelaunch pins; both target and
helper copies are rechecked after the query. This preserves the executing
helper bytes through later rebuilds. Owned cleanup, first-failure retention,
finite read/output/process limits and the exact local runtime/DAC gates remain
in force. Copy custody does not establish a complete framework load closure.

I read the zero-warning/error helper build in 2.12 seconds and focused test
project build in 67.65 seconds. Independent parsing of the focused TRX confirms
50 passes, no failures/skips, including 13 metadata tests and 37 other compiled
cases; its SHA-256 is
`a9d782f9ce50ee9acb51fefc357d04e7a908ead69b1ee5030b8029318b6f234b`.
The retained Python instrumentation run reports 30 passes in 0.130 seconds;
Ruff passes after its retained import-whitespace correction. The owner's
capture recheck reports all 82 pins and 22 custody rows unchanged. I executed
none of these tests/builds and opened no raw dump, helper, target, policy,
registered source stream or measurement.

No material prelaunch source finding remains. This accepts the finite offline
extent procedure only. The actual query outcome still needs independent review;
all complete body/runtime/call-closure flags remain false. Guard data/register
association, literals, generated/framework/indirect calls, exception and control
flow, final source identity and scientific admission remain separate.

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
