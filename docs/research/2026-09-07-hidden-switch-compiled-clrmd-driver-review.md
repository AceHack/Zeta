# Guarded controller: fresh dump custody and metadata driver review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded prelaunch source accepted

This review binds four Python files at
`a03852a28415c5d8ffffbcb39a852e7ad6b175f9`, the isolated helper at
`2f068ba34da612f82370c64cef4e38a909e7edd5`, and preparation evidence
`f3d9229ed88425826798da7ccb3ff416429ac85e`. I read the capture custody
refinement, complete new metadata driver and their tests, and checked the
accepted helper fingerprints against its committed bytes. This is a source
and existing-record review; I executed no helper, analyzer, dump query, study
target, policy, source stream or measurement.

The [driver inventory](hidden-switch-compiled-validation/2026-09-07/clrmd-driver-preparation/manifest.json)
binds all four Python source/test lengths and hashes, which match the current
and committed bytes. I independently verified every stored gzip, decompressed
record and local original for six driver records and all 26
[helper records](hidden-switch-compiled-validation/2026-09-07/clrmd-helper-preparation/manifest.json).
The exact final focused tests and original PathMap failure are recorded in the
[helper review](2026-09-07-hidden-switch-compiled-clrmd-helper-review.md).
Four custody, four driver and fifteen reused physical-helper fixtures are
reported passing in the author's retained preparation; these are not live
metadata queries.

The earlier dump's same-path target DLL was rebuilt without an available exact
custody copy. This source requires a new, separately named capture. Before
launch, each finite adjacent target DLL/config file is copied exclusively from
one regular descriptor that supplies both bytes and hash. Completed copy rows
are immediately retained; original and copy identities are rechecked. Files
must be nonempty and at most 64 MiB, the adjacent roster at most 64 entries,
and copy work has a checked ten-second deadline. Existing identity observations
assume stable writer paths; this is not hostile-namespace, concurrent-write
snapshot or kernel-I/O cancellation protection.

Two first-failure findings were repaired in unexecuted prelaunch drafts.
Nested custody stream disposal could replace an established read/write/fsync
failure. Corrected ownership closes each stream once, keeps the original
failure, records cleanup separately and refuses cleanup-only failure. A real
close followed by injected OSError distinguishes prior-fsync and cleanup-only
outcomes. The driver had the analogous nested output-stream issue on timeout
or output-limit failure. It now records the primary before guarded cleanup,
attempts owned kill/join first, then closes each stdout/stderr/dump stream once.
A real-file/fake-process fixture checks ordering and both secondary failures.
A failed join does not establish quiescence, and any cleanup error prevents
`Complete=true`.

The driver requires a complete closed fresh capture, exact original/copy file
identity and native reflection association. It hashes a held dump descriptor,
then uses the separate strict Mach-O physical reader for only the three named
predict/condition/select callable stubs, pointer cells and compiler-sized body
ranges. Each selected prefix record precedes the next dependent read. Unique
file backing and exact compiler-byte equality are established independently
of ClrMD memory views. No SOS Session is instantiated. Raw dump memory remains
local; no unrelated memory is displayed or published by this procedure.

The prior runtime version/build metadata is used only as an explicit expected
value bound to the unchanged installed libcoreclr hash. A new dyld observation
supplies the fresh base, and ClrMD must independently match actual runtime and
current method identities. Directory labels do not determine actual version.
The helper's exact current hot extents must equal these physically checked
candidates; cold, different, malformed or incomplete results refuse. Local PE
MVID/native reflection remain a file association, not a dump-derived MVID.

The helper child has a 180-second process bound, checked 120-second dump hash
bound and polled two-MiB output-file limit. Overshoot is retained; these are
not filesystem quotas, general descendant containment or cancellation of a
blocked kernel read. Original/copy/source/host bytes and the held descriptor
are rechecked. Direct library local-image fallback, internal metadata reads,
loaded-image snapshot limits and missing complete call closure retain the
[settled helper limits](2026-09-07-hidden-switch-compiled-clrmd-helper-review.md).

No remaining material source defect was found within this finite scope. The
parent's authorization for one fresh capture/query is separate from this
prelaunch review. This document reports neither its outcome nor a complete
method graph, runtime admission or scientific result. All full admission flags
remain false even if the three extent comparisons later succeed.

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
