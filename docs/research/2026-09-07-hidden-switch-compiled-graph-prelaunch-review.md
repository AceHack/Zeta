# Guarded controller: initial graph collector prelaunch review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, independent protocol-review agent
Disposition: accepted for initial callable-prefix feasibility; runtime admission pending

This read-only pass examines the graph collector's working source atop
`0b323c30f1b4fa5729f884a657b8839e0ad7e4c0`, before its first target launch,
then reconciles the final source commit
`efc8dbe62d5580e1d02bb401eab815bdef6c8db3` and its added input metadata.
The [frozen protocol](2026-09-07-hidden-switch-compiled-protocol.md),
[pure-boundary review](2026-09-07-hidden-switch-compiled-native-pure-review.md)
and [runtime-readiness review](2026-09-07-hidden-switch-compiled-runtime-readiness-review.md)
remain unchanged. No build, test, policy invocation, debugger target,
registered source, guard calculation or measurement ran in this review.
Installed API metadata and source bytes were inspected directly.

## Reviewed source identity

The five files in the final source commit have these SHA256 values. Their
committed bytes matched the inspected working files. The earlier pure-source
HEAD alone does not identify them.

| Repository-relative file | Bytes | SHA256 |
| --- | ---: | --- |
| `src/Research.FSharp/HiddenSwitchCompiledGraph.fs` | 14710 | `b3c39419afae2650328a62379245e3eb6d7acecdebcef300af93b43c545297a5` |
| `src/Research.FSharp.Cli/inspect_hidden_switch_graph.py` | 14372 | `a68d29e9f2236f7c538d1bbc48399a6eeafbbbffb31df4c6ba068e40e9f1214c` |
| `src/Research.FSharp.Cli/test_inspect_hidden_switch_graph.py` | 5749 | `f76db0afedcfcfba7b26472eb5935f965d6564a3b057a1a765cb08e1cb436354` |
| `src/Research.FSharp.Cli/Program.fs` | 737 | `6d33ebe7c7afe140938af4a796b132e3429f852362f7f05c5b76361cfdc7d049` |
| `src/Research.FSharp.Cli/HiddenSwitchCompiled.fsproj` | 1692 | `19ead249fd41540a49e38f9cf815863b44bc2a4b889f4cb042ba06dee0a2ec35` |

The metadata-only command `xcrun lldb -P` identified the installed Python
bindings under
`/Applications/Xcode.app/Contents/SharedFrameworks/LLDB.framework/Resources/Python`.
Its `lldb/__init__.py` was 796123 bytes with SHA256
`08d7c4c689459429ae660a2a3e9f8a9b39788fcc3754e9db3316efd3b3fab676`.
Direct source inspection confirms `AddOpenFileAction(fd, path, read, write)`,
`SBInstruction.GetData(target)`, `SBData.GetUnsignedInt8(error, offset)` and
`ReadInstructions(address, count)`. The official
[launch API](https://lldb.llvm.org/python_api/lldb.SBLaunchInfo.html),
[instruction API](https://lldb.llvm.org/python_api/lldb.SBInstruction.html)
and [data API](https://lldb.llvm.org/python_api/lldb.SBData.html) agree with
these signatures. This is API availability evidence, not proof that a
target can launch or that arbitrary callable prefixes decode successfully.
No standalone original audit command log is claimed for these inline reads.

The final helper addition records explicitly linked project source files,
project/global configuration and observed output artifacts before launch.
The checked-in project's concrete `Compile Include` paths resolve inside the
clone. This is a bounded working-source snapshot, not dependency discovery,
evaluation of arbitrary MSBuild items, an immutable implementation archive
or a source-to-binary derivation. No capture or policy logic changed in this
last metadata addition.

## Findings and corrections before launch

The initial helper used nonexistent standard-output/error setter methods.
The author identified that API error before execution and changed it to
checked `AddOpenFileAction` calls in the exclusively owned attempt directory.
The final installed-binding check above independently confirms that repair.

The independent source review identified four additional issues:

1. A successful memory read could be labeled captured even if the decoder
   returned zero, partial or nonmatching instructions. The final helper
   requires the exact instruction count, contiguous addresses, valid
   four-byte ARM64 widths and byte equality between each decoded instruction
   and the separate process-memory read. Decode refusal retains the raw prefix.
2. A later method's refusal could discard already captured prefixes because
   publication occurred only after the complete traversal. Raw prefixes now
   publish immediately, and each complete decoded prefix publishes before
   the next method. Synthetic later-entry refusal checks this boundary.
3. Cleanup, state inspection or debugger-mode restoration could throw before
   outcome retention and obscure the first failure. Individually guarded
   operations now retain the primary failure, list secondary failures and
   attempt outcome publication. A synthetic target failure plus restoration
   failure checks both retained identities. Filesystem failure can still
   prevent durable output; the final reporting fallback does not promise
   successful storage under such a failure.
4. Replacement UTF-8 decoding could silently alter a dyld image pathname.
   The collector now uses strict decoding and retains collection refusal.

The five synthetic test methods also cover existing-attempt refusal without
modification, valid prefix capture without body admission, and partial,
discontinuous, wrong-width and changed-byte decoding. Their source is
discriminating for the stated failure paths. The author reported five
passing synthetic tests and a successful focused native build; this reviewer
did not re-execute either and does not substitute this report for their raw
validation records.

## Accepted scope and remaining admission obligations

The only new CLI command is the separate `graph-hand` collector. It requests
the three registered zero-valued tier/PGO/ReadyToRun launch flags and limits
the platform to macOS ARM64. The fixed preparation comprises 24 scalar calls
and four adapter choices; no source stream is created. Before/after FP state,
managed identities, non-atomic dyld metadata and reflected IL/callable
identities accompany an exclusive start/ready/failure JSONL record.

The LLDB helper owns one target launch, binds the ready report to its PID,
interrupts that target, independently reads and decodes bounded callable
prefixes, then resumes it through the explicit completion handshake. Its
startup, interruption, exit and cleanup deadlines bound operational waiting;
they are not scientific timing observations. Cleanup concerns the owned
process, with no general descendant-isolation guarantee.

`Complete=true` means this limited collection completed. Every collected
prefix still says `BodyResolved=false`; every aggregate says
`RuntimeAdmitted=false`. Readable 64-byte prefixes may contain stubs or
literal data and need not constitute one method body. Region executable
status is recorded rather than elevated into body admission. The reflected
roster and qualified diagnostic patterns do not establish complete generated,
inlined, generic or external-call closure. Failed decoding is an allowed
feasibility outcome, not permission to invent a span or silently skip evidence.

FP return codes/raw registers and loaded-image snapshots are observations,
not an accepted floating-point mode or atomic load history. Equal dyld counts
do not exclude intervening load/unload; borrowed pointers assume the trusted
loader. Missing shared-cache backing files receive no invented hash. File
metadata does not establish immutable backing bytes, source-to-native
derivation or a future-process correspondence.

No material blocker remains to this initial probe within those limits.
Actual stub resolution, body spans and complete arithmetic/caller closure;
compiled guards and their certificate; runtime/FP correspondence; complete
conformance; and measurement orchestration remain separate pending review
and admission obligations under the unchanged protocol.
