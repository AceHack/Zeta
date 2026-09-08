# Guarded controller: actual mapped extent evidence review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: finite 130-method observation accepted; full admission remains false

This read-only review binds evidence `b672cd5b3c40423982ff7bdaed9439562f6f6e48`,
execution head `5a0ff905e947f2d7aa7ead394183098c2060f009` and reviewed source
`af90bfc9e95fbdb8246c438da26e30a727bcbb5f`. The earlier
[source review](2026-09-07-hidden-switch-compiled-mapped-extent-source-review.md)
and [finite mapping review](2026-09-07-hidden-switch-compiled-finite-method-mapping-review.md)
remain distinct from this actual-output review. No target, analyzer, policy,
decoder, test or benchmark was run by this reviewer. The local dump was not opened.

The retained [audit source](hidden-switch-compiled-validation/2026-09-07/mapped-extent-independent-audit/audit.py)
and its [actual result](hidden-switch-compiled-validation/2026-09-07/mapped-extent-independent-audit/result.json)
record the executed artifact/arithmetic checks. This is a fixed review script,
not a public admission API. Its run exited zero with empty stderr.

All 700 archived records match their compressed and original lengths/hashes,
and decompress to the existing local originals. The archive directory equals
the named evidence commit. Totals are 442,205 stored bytes and 1,560,883 original
bytes. Manifest SHA-256 is
`7C130526CB7981E209A5EF31AADA60194269BDE63213A1C4F91C3CCD25CBFE21`.
All 48 current helper/source/host pins, four capture-metadata pins, 31 helper
custody copies and the target module original/copy agree with their records.
This current-file check is not a guarantee about future files or loaded memory.

I reconstructed all 139 compiler blocks directly from the retained JIT word
listing, without importing the production mapper or decoder. Every selected
method has matching compiler bytes/length/hash, recorded physical-read
address/length/hash, request identity and actual current DAC hot start/size:
130 methods, 34,660 bytes, 8,665 four-byte words, maximum 1,664 bytes per method.
Every cold start/size is zero. All copied-definition token/type/name/IL and
reflection-signature fields agree with the input roster; actual DAC
token/type/name/module/current address agree with each request. Actual full
DAC signatures are retained separately from the reflection signature grammar.

The helper PID was 24347 and its exit code was zero. Driver completion is
2026-09-07T23:11:38.647443 UTC, without cleanup failures. The helper output is
84,120 bytes, SHA-256
`23A1A78D2DC80E5D4B370C890C4022C4FCCC5345879D23D90F8BD665F298F34B`.
The journal is 337,193 bytes and 787 rows, SHA-256
`92E5D6B859814630084936CD873E119C709F8F1461D500627F710640AA3A0850`.
It contains 130 copied definitions, 130 extent prefixes and 130 corresponding
method records. A separate read verified definitions precede target/runtime/DAC
steps and each extent prefix precedes its corresponding full method record.

The actual runtime path/base/version/build ID and loaded DAC path/file match
their independently supplied expectations. Complete runtime enumeration was
enabled and the DAC request used `IgnoreMismatch=false`; publisher-signature
verification remained explicitly disabled. Locator requests are zero. The dyld
observation is 358/358/358 and the two managed snapshots contain 23 and 28
assemblies. Equal image counts do not establish atomicity, a stable complete
load closure, loaded-memory/file identity or network isolation.

One reporting clarification was sent to the owner: physical JSON records retain
addresses, file offsets, lengths and hashes; physical bytes remain in the local
dump. Compiler bytes are independently retained in JIT text. This review
recomputed compiler bytes and matched physical-read identities and the driver's
executed exact-byte-comparison receipts; it did not independently re-read those
dump ranges. The report should preserve that distinction and update its opening
three-method status to acknowledge the later finite mapped result.

There is no additional implementation finding. The nine unprepared reflection
rows and nine extra compiler blocks remain separate obligations. No literal or
extra-block reads occurred in this mapped slice. These are prepared current
extents, not evidence that every method ran. Dump-derived MVID, generic
instantiation, independent decoding, complete reachable code/call closure,
arithmetic/data correspondence and guard-object/register association remain
unproved. `BodyResolved`, `ClosureAdmitted` and `RuntimeAdmitted` remain false;
the result does not admit registered behavior or cost execution.

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
