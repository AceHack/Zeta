# Distributional rooms: independent evidence correspondence audit

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: active
Work item: 081M1Z63YMC087G0R003N5FH9X
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded archive and actual-return correspondence accepted

I audited the independent validator archive at
`6fefd143eb1a89f69844b4160ee6d2e02f15c3b9` and coordinator archive at
`6cd9a0803338eb878dc23a0fe0cc02d49487a89d`. Both are immutable cuts;
their current archive bytes match their Git blobs. This follows the
[validator source review](2026-09-08-distributional-learning-room-validator-review.md)
and [native source/exit review](2026-09-08-distributional-learning-zeta-room-source-review.md).
I executed only the retained stdlib audit scripts below, not the validator,
room APIs, tests, FSI, a dump reader or any registered source stream.

## Independent validator archive

The final tilde-fenced metadata/base64 blocks in the reference note decode to
78 files and 819,460 original file bytes. All names are unique and all exact
BytesHex lengths and hashes match. The gzip representation is 157,783 bytes,
SHA-256 1DA3D9C6BE9C62598E24518C2E4637067B557FCEB9562C32ACD63AD49A87043C;
its JSON capsule is 1,650,374 bytes,
SHA-256 E3DE5F8DBE0AC45911BFF612FC22B53821BD537049B9A20E88AC58F3B78ABF76.

Both attempt summaries bind all 22 of their named artifacts, 44 references
total. Source and test copies equal the immutable original validator
6512494eb359645c3038235e9cd6498a4235fe6e and repaired validator
40833d9e85796f22e500800389aa4a09ef672161. Each native source copy equals
2af8d581016d6c5a903aaba0335a3e73c8d5ac9b. Both attempts retain the same
five native stdout/stderr pairs, control metadata, native harness and
unchanged 4,304-byte exact finite reference. The latter remains SHA-256
3DF866A0745ED6873933BE5B9119FB596CDFB5FA722A0D76F545C7FDB8A3A2D4.

I read the capture harness: it calls the real imported validator, serializes
every actual dataclass field through its explicit Type/Fields/BytesHex
convention and observes the source before and after its calls. It saves each
result before the next call. This finite capture harness is not the general
bounded record store or a theorem about all loaded Python code.

Each of the ten top-level returned results has Raw bytes exactly equal to its
named supplied stdout. Checked counts and complete decoded Records agree with
the recorded result variant and summary. The three fault results retain their
complete corresponding ordinary validation return. In the corrected pass,
those nested values equal the standalone ordinary result, including its raw
input, records and content hash. No producer type is instantiated by this audit.

The original ordinary run retained 25 checked checkpoints but refused the
mistaken third assembly name; its three fault replays refused that ordinary
prerequisite, and invalid-control passed. The corrected five returns are:

| Mode | Checked checkpoints | Returned validation | Native exit |
| --- | ---: | --- | ---: |
| ordinary | 25 | RoomRunValidated, ten finite and sixteen Zeta rows | 0 |
| fault-2 | 2 | RoomRunValidated, fixed incomplete control | 2 |
| fault-12 | 12 | RoomRunValidated, fixed incomplete control | 2 |
| fault-25 | 25 | RoomRunValidated, fixed incomplete control | 2 |
| invalid-control | 0 | RoomRunValidated, fixed invalid-argument control | 2 |

Validated here means the fixed control content passed. Fault-mode validation
does not turn its Complete=false native terminal into ordinary success.
All fault checkpoint lines are byte-identical to the corresponding ordinary
prefix, both terminal counts match, pending fields are null, and no later
row appears. The actual finite receipt agrees exactly with the unchanged
independent reference. These checks corroborate the retained returns without
calling the numerical validator again.

## Coordinator process archive

All 31 artifacts match stored/decompressed hashes and immutable archive blobs:
33,531 stored bytes and 125,182 original bytes. The 14,960-byte manifest has
SHA-256 df2ba688bdd87179bc12f7a1ca89b70636cb59126562acd383c7e0cd614ae85d.
The earlier announced thirty-artifact draft predates the final added
124-test coordinator import log; this review targets only the final cut.

All five individual process records equal the aggregate FinalRuns and the
independent capsule's copied process metadata. All ten process streams match
that capsule exactly. Commands bind the selected modes and source; recorded
intervals are ordered and nonoverlapping, exits are 0/2/2/2/2, each final
TimedOut is false and stderr is empty. The ordinary stdout is 15,689 bytes;
fault stdout sizes are 545, 2,543 and 7,760, and invalid-control is 245.

All three source-version copies and the protocol copy match their immutable
commits. The first dd393 source has no stdout and retains 647 stderr bytes
with FS3886/FS0001. The 5475 ordinary run has 25 checkpoints and a complete
terminal. Its initial fault-2 has the same stdout as the final corrected
control but actual exit zero. That historical record does not contain a
TimedOut field; the later final-record shape must not be projected backward.
No missing earlier timestamps or uncaptured driver assertion are manufactured.

RuntimeObservations equal the actual terminal fields: .NET 10.0.11 and the
ordered Core/Bayesian/Core type-selected observations with exact repeated
Core metadata. Both runtime-closure flags remain false. These observed hashes
do not replace copied assembly bytes or establish source-to-binary closure.

The final coordinator test log reports 124 passes in 4.66 seconds at
ecb35bf73a669d2552af7d2dd53b1d94e4efc4c0. Its two imported Python files equal
the accepted 40833 source/test bytes. That test run is distinct from both
actual validator captures and the five native processes.

## Audit reproducibility and limits

The [independent-capsule auditor](hidden-switch-compiled-validation/2026-09-08/room-validator-independent-audit/audit.py)
and [result](hidden-switch-compiled-validation/2026-09-08/room-validator-independent-audit/result.json)
pass with empty stderr. The [coordinator auditor](hidden-switch-compiled-validation/2026-09-08/room-validator-independent-audit/root_audit.py)
and [final result](hidden-switch-compiled-validation/2026-09-08/room-validator-independent-audit/root_result_final.json)
also pass with empty final stderr. They use stdlib parsing/hashing and
read-only Git blob queries; no project module is imported.

The initial coordinator auditor incorrectly required TimedOut on the older
fault record. Its exact [source](hidden-switch-compiled-validation/2026-09-08/room-validator-independent-audit/root_audit_initial.py)
and [KeyError](hidden-switch-compiled-validation/2026-09-08/room-validator-independent-audit/root_stderr.txt)
remain retained. The only audit repair recognizes the actual absence of that
field and makes no historical timeout assertion. Earlier short schema-inventory
probes also assumed a Records key where these formats use Files/Artifacts;
those inspection errors did not modify evidence or imply successful checks.

This evidence supports the fixed known-answer engineering distinctions:
equal moments can hide different tail utility, repeated supplied messages
can change untracked-provenance consensus precision, and funded-branch
fractions differ from posterior mass. It establishes no learned performance,
state-of-the-art result, physical Liouville dynamics, full runtime closure,
registered compiled stream or benchmark-guided resource benefit.

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
Task: 081M1Z63YMC087G0R003N5FH9X
Co-Authored-By: Codex <noreply@openai.com>
```
