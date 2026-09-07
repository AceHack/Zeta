# Guarded controller: runtime readiness and source provenance review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, independent protocol-review agent
Artifact status: metadata/source inspection; runtime graph admission remains pending

The [registered protocol](2026-09-07-hidden-switch-compiled-protocol.md)
and [prior runtime plan](2026-09-07-hidden-switch-compiled-runtime-feasibility.md)
remain unchanged. This pass began on the fresh implementation co-claim
`d6ec464f4e9898904c2af77fceaefb8b28b48683`, after the prior study's main
proof. It does not reuse the released prior-study claim.

## Installed binary identity is separate from public source guidance

The six candidate runtime file hashes were unchanged from the prior plan.
The retained [identity record](hidden-switch-compiled-validation/2026-09-07/runtime-readiness/identities.json)
records their absolute paths, lengths and SHA256 values at 15:35:18 UTC.
The [runtime report](hidden-switch-compiled-validation/2026-09-07/runtime-readiness/dotnet-info.txt)
reports SDK 10.0.400 and host/runtime 10.0.11. The installed
[`.version` bytes](hidden-switch-compiled-validation/2026-09-07/runtime-readiness/installed-version.txt)
name commit `e2f47b0110ed922f21a1522da67279133ce28f32`.

The live public `dotnet/runtime` tag `v10.0.11` instead resolved to
`79d0c463f1b55624c874a11585f7e47731e8d675`; the exact
[remote response](hidden-switch-compiled-validation/2026-09-07/runtime-readiness/runtime-tag.txt)
is retained. Fetching `runtimehandles.cpp` at the installed reported
commit returned [HTTP 404](hidden-switch-compiled-validation/2026-09-07/runtime-readiness/runtimehandles-installed-commit-http.txt)
with the retained [response body](hidden-switch-compiled-validation/2026-09-07/runtime-readiness/runtimehandles-installed-commit-response.txt).
The attempted URL was
`https://raw.githubusercontent.com/dotnet/runtime/e2f47b0110ed922f21a1522da67279133ce28f32/src/coreclr/vm/runtimehandles.cpp`.

Therefore, the public version-tag source is implementation guidance, not
proven provenance for these installed binaries. This difference establishes
neither tampering nor a cause of any observed failure. It also does not
automatically violate the protocol: actual runtime identities, inspected
code and the declared correspondence remain conditional admission premises.
No runtime was replaced or downloaded. References in the earlier plan to
version-pinned source must be read with this explicit distinction.

The retained [source verification](hidden-switch-compiled-validation/2026-09-07/runtime-readiness/public-source-verification.json)
checks that the public tag and full public commit returned identical bytes
for both relevant files. It retains URLs, status, length and SHA256; those
source bodies are not included in this artifact set. The
[executed collector](hidden-switch-compiled-validation/2026-09-07/runtime-readiness/verify-public-source.py)
and its [output](hidden-switch-compiled-validation/2026-09-07/runtime-readiness/public-source-verification.log)
are separate from the earlier metadata commands, whose original outputs
are retained without inventing an original collector script.

## Callable pointers need a separate body-resolution check

In the inspected public source,
[`RuntimeMethodHandle_GetFunctionPointer`](https://github.com/dotnet/runtime/blob/79d0c463f1b55624c874a11585f7e47731e8d675/src/coreclr/vm/runtimehandles.cpp#L1276)
prepares the method and requests a multicallable code address.
[`GetMultiCallableAddrOfCode` and its resolver](https://github.com/dotnet/runtime/blob/79d0c463f1b55624c874a11585f7e47731e8d675/src/coreclr/vm/method.cpp#L2030)
can return native code or an entrypoint/stub, depending on method state and
kind. The public API's pointer is consequently not by itself a certificate
of the final JIT body range. Actual installed behavior still needs inspection.

The admission collector should retain the original callable pointer,
stub/indirection bytes and resolution steps separately from each final
body's address, bounds and raw bytes. Bind those records to concrete
method/module/generic identities and the inspected process. Reconcile the
JIT's diagnostic listing with an independent decoder of actual memory;
do not silently infer a body span from an adjacent pointer.

The closure includes the old prediction, conditioning, evaluator and
selector, plus the new native wrapper, observation/filter adapter,
dispatch/choice callers and 28-byte writer. Generated result closures,
generic instantiations and inlined caller bodies need explicit coverage.
Reflection method names alone neither locate all generated executable code
nor establish that every measured caller is represented. The compiled
guard and its callers will need the same treatment when they exist.

The collection filter itself needs review. The public
[JIT guide](https://github.com/dotnet/runtime/blob/79d0c463f1b55624c874a11585f7e47731e8d675/docs/design/coreclr/jit/viewing-jit-dumps.md#specifying-method-names)
defines bare patterns as method-name patterns. A bare
`HiddenSwitchPolicy*` therefore does not establish coverage of methods in
that type. Use the documented class-qualified or assembly-qualified
syntax, record the actual matched identities, and reconcile every required
generated/inlined body. No diagnostic filter replaces the coverage check.

## Remaining admission boundary

No compiler, policy, guard generator, registered stream, benchmark,
P/Invoke observation or debugger attachment ran in this review. Tool
`--info`/`--version`, file hashes, metadata commands and source retrievals
do not show that LLDB can attach or that a complete graph can be collected.
The candidate entry point was inspected as source and currently refuses
study execution. Its first build and hand checks belong to the native
owner's separately retained evidence.

The next useful check is the declared separate graph process on the actual
file-backed implementation. Preserve any refusal. Verify the fixed launch
configuration, complete method/caller closure, instruction order and
precision, FP mode on the executing thread, and managed/native image
observations with their declared limits. This pass does not weaken the
prior plan's dyld snapshot/load-race, framework-generated code, FP-mode
snapshot or source-to-native correspondence boundaries. Missing evidence
cannot be replaced by numerical spot agreement or a version string.

The coordinating reviewer accepted the public-source/installed-binary
distinction before this record was committed. This is planning evidence
for the new study, not an implementation archive or fast-path admission.
