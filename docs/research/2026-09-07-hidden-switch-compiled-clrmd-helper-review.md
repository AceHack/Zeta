# Guarded controller: isolated ClrMD helper source review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: corrected helper source accepted; capture and query remain separate

This read-only pass covers `MetadataProbe/Admission.fs`, `Program.fs`,
`NativeImages.fs`, the explicit helper project/dependency manifest, the pure
metadata tests and their test-project links. The
[inspection manifest](hidden-switch-compiled-validation/2026-09-07/clrmd-helper-static-inspection/manifest.json)
binds the corrected working-source bytes and six losslessly compressed static
inspection records. These working fingerprints are not an executed-source
commit claim. The helper is isolated from the study CLI and links no study
assembly. Final source publication and focused build/test outcomes belong to
the native author's preparation record; this review does not substitute for them.

Final source verification binds
`2f068ba34da612f82370c64cef4e38a909e7edd5`: all seven retained working
fingerprints exactly match those committed files. I independently read the
two focused TRX files: initial 46 Passed/one PathMap failure; recovery 47 Passed,
including exactly ten metadata-class tests and 37 compiled-native cases, with
no skips or failures. Logs show helper build7 in 2.21 seconds and test-project
build3 in 26.63 seconds, both zero warnings/errors. These are read-only
verification of the author's executions. The
[preparation record](hidden-switch-compiled-validation/2026-09-07/clrmd-physical-preparation.md)
retains the full earlier failure chronology.

Four material source findings were repaired before this acceptance:

1. The original DAC collector used `Process.Modules`. Installed macOS
   `ProcessManager.GetModules` IL returns only the executable path, so it cannot
   establish that the DAC is loaded. The corrected collector records bounded
   dyld names/header/slide rows and before/after counts before hashing the exact
   DAC pathname. A later post-file-identity count is separate. Equal counts are
   not an atomic image snapshot or an exclusion of load/unload races.
2. `ForceCompleteRuntimeEnumeration` originally retained its default false.
   Installed ClrMD IL then permits a special diagnostic-header shortcut before
   full runtime enumeration. The correction sets it true before constructing
   `DataTarget` and records that setting, then requires exactly one candidate
   matching the declared path, base, actual version and build identity.
3. The dependency manifest was initially read without a finite byte bound and
   only its row count was enforced. The correction checks the exact reviewed
   3,329-byte manifest hash before JSON use, binding all thirteen names,
   lengths and hashes. The journal's original ceiling omitted each newline;
   subtraction-based admission now includes it without arithmetic overflow.
4. A bounded journal did not bound final output: an unexpected large method
   signature could still enter the final report. The corrected `finalOutput`
   reserves the newline under a separate one-MiB write ceiling. Oversized
   diagnostics produce a compact explicit size refusal, available method/byte
   counts and `MethodMetadataOmitted=true`, preserving an earlier primary
   failure and forcing `Complete=false`. Serialization allocation precedes
   this write admission and is not claimed to have the same memory bound.

The native author copied the initial inspected draft before repair. Its original
`Program.fs` was 20,178 bytes, SHA-256
`c7981e6bdba92593a10ed5809b852dcc7759f6a2ef119569d030653765e9e679`;
`Admission.fs` was 6,543 bytes, SHA-256
`41f6d4b5ee66b52c7847b14a3306cd09f8da6c0a6fccb613b8e407428b2d0393`.
The revised pure fixtures distinguish newline/overflow refusal, exact-manifest
substitution, changed-count and invalid-row dyld prefixes, and oversized final
metadata with and without an existing primary failure. A first focused run's
manifest fixture failed because PathMap rewrote `__SOURCE_DIRECTORY__` to `/_/`;
the author retained that failure and changed the fixture to an explicitly copied
output manifest. This path correction is included in the reviewed fingerprints.

The two additional static inspections used the already installed ildasm host,
each with a fifteen-second bound, and exited zero with empty stderr. They
inspected installed assemblies only. The
[version-specific process source](https://github.com/dotnet/runtime/blob/v10.0.11/src/libraries/System.Diagnostics.Process/src/System/Diagnostics/ProcessManager.BSD.cs)
and [ClrMD enumeration source](https://github.com/microsoft/clrmd/blob/41c1e91786141d37b26cfdfb8059fc522e81fb8d/src/Microsoft.Diagnostics.Runtime/DataTarget.cs)
provide readable guidance; retained installed IL provides the concrete branch
observations. Source tags alone are not installed-binary provenance.

The admitted helper shape remains narrow: exact reflected Mach-O reader
constructor, held and boundedly hashed dump stream, deny-all locator supplied
before target construction, exact local DAC with `ignoreMismatch=false`, and
three fixed current method/token/signature/hot-extent comparisons. Zero,
overflowing, unaligned, different or unexpected cold extents refuse rather than
expanding memory access. Local PE MVID and native reflection are explicitly a
file association, not a dump-derived MVID. Physical file-backed code bytes must
still be independently compared by the separately reviewed driver.

Incremental metadata precedes later judgments where available. Resource cleanup
attempts the runtime, one ownership-chain head and held dump; an internal library
disposal exception does not establish that every internal resource closed.
First failures survive later cleanup/output errors. Failed publication cannot
promise a complete journal. The copied dependency roster, selected managed-load
snapshot and dyld rows are not complete framework closure, loaded-file byte
equivalence or process-wide network isolation. Direct local-image fallback,
borrowed-pointer observation races, unsigned DAC loading and metadata reads
inside the library retain the limits of the
[settled plan](2026-09-07-hidden-switch-compiled-sos-feasibility-review.md) and
[module review](2026-09-07-hidden-switch-compiled-clrmd-module-review.md).

I found no remaining material source defect within these stated boundaries.
No helper, analyzer, dump query, study target, policy, source stream or
measurement was executed in this review. Fresh dump custody and physical-driver
orchestration require a separate source pass before launch. All full method,
body, closure and runtime admission claims remain unestablished.

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
