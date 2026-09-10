# Guarded compilation: macOS ARM64 runtime inspection plan

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, independent protocol-review agent
Artifact status: read-only capability/source inspection; no runtime admission yet

The [accepted protocol](2026-09-07-hidden-switch-compiled-protocol.md),
reviewed at `75718b9a82b9e5d1d303d6a3f2cf5f83792bca1a`, admits a
conditional, inspected runtime. This note makes its sections C and I
actionable on the current host. It changes no protocol requirement and
does not establish any guard, source-to-native correspondence or JIT theorem.
The [complete protocol review](2026-09-07-hidden-switch-compiled-protocol-review.md)
remains the separate mathematical/experimental admission review.

The candidate has the tools needed to attempt admission. Two shortcuts
would be invalid: macOS `Process.Modules` does not enumerate all native
images, and release `JitDisasm` is not an independent decoder of final
machine memory. Floating-point mode also needs an observed, declared
boundary; three environment variables do not certify it.

## Observed host and tool capabilities

Read-only commands reported macOS 26.6.2, build `25G83`, Darwin 25.6.0,
ARM64; .NET SDK 10.0.400, SDK commit `14fbf8d527`; host/runtime 10.0.11,
runtime `.version` commit `e2f47b0110ed922f21a1522da67279133ce28f32`.
`dotnet` resolves under `/Users/acehack/.local/share/mise/dotnet-root`.
Other SDK/runtime versions and an x64 installation exist, so PATH/version
labels alone cannot establish the runtime selected by a future process.

The SDK contains `FSharp/fsc.dll`, `FSharp.Compiler.Service.dll`, F# build
targets and runtime/dependency configuration. The repository already has a
file-backed executable project at `src/Core.FSharp.Cli/Zeta.Cli.fsproj`;
its project-specific warning override is not a template for this study.
The supported SDK route is a compiled F# project, rather than FSI.
[Microsoft F# command-line guidance](https://learn.microsoft.com/en-us/dotnet/fsharp/get-started/get-started-command-line)
documents that route.

Installed `otool`, LLDB and Xcode `llvm-objdump` were located. Strings in
the installed release JIT include `JitDisasm`, `JitDisasmSummary`,
`JitDisasmWithCodeBytes` and `JitStdOutFile`. This is capability evidence,
not an executed disassembly. No task executable, P/Invoke probe, debugger
attachment, benchmark, guard computation or registered stream was run.
No compiler was invoked. Commands read metadata, source/header/export text
and hashes; `dotnet --info` supplied the runtime report.

## Freeze and inspect one concrete code configuration

1. Preserve the reviewed project, ordered F# source, dependency closure,
   effective compiler/build settings, output DLLs, symbols, `.deps.json`
   and `.runtimeconfig.json`. Bind actual loaded files to that build.
   `global.json` selects an SDK, not the runtime of the eventual executable.
   A recorded exact framework version with testing-only roll-forward
   `Disable`, followed by actual loaded-runtime identity checks, is one
   candidate. No silent runtime substitution is admissible.
   [Microsoft version-selection documentation](https://learn.microsoft.com/en-us/dotnet/core/versions/selection)
   distinguishes these selections.
2. Set the protocol's three startup values exactly to `0`: tiered
   compilation, tiered PGO and ReadyToRun. The repository defaults enable
   tiering and PGO, so explicitly false project/runtime configuration makes
   admission clearer. Record both effective files and the relevant launch
   environment. In upstream 10.0.11, an explicit legacy environment value
   takes priority over the runtime configuration knob; the existing true
   project defaults do not themselves demonstrate an override bug.
   [Compilation settings](https://learn.microsoft.com/en-us/dotnet/core/runtime-config/compilation),
   [configuration precedence source](https://raw.githubusercontent.com/dotnet/runtime/v10.0.11/src/coreclr/utilcode/configuration.cpp)
   and [tiering initialization](https://raw.githubusercontent.com/dotnet/runtime/v10.0.11/src/coreclr/vm/eeconfig.cpp)
   support this distinction.
3. Admit a finite relevant environment/configuration roster, including
   conflicting `COMPlus_` values, alternative JIT/profiler/startup-hook
   settings and loader overrides. Do not dump unrelated environment data.
   `DOTNET_` precedes `COMPlus_` in the pinned
   [runtime environment parser](https://raw.githubusercontent.com/dotnet/runtime/v10.0.11/src/coreclr/utilcode/clrconfig.cpp).
   Unknown code-changing settings require refusal or explicit review.

The separate graph process should launch the already built entry DLL via
the exact host. Using `dotnet run` also exposes build tools to diagnostic
settings. A proposed release collection uses `DOTNET_JitDisasm` with the
actual method roster, `DOTNET_JitDisasmSummary=1`,
`DOTNET_JitDisasmWithCodeBytes=1` and an owned `DOTNET_JitStdOutFile`.
Do not combine code bytes with diffable output. Preserve complete raw
output and concrete method/generic identities, including F# generated
closures and callers containing inlined bodies. Missing or interleaved
method output is not affirmative coverage.
[The JIT inspection guide](https://github.com/dotnet/runtime/blob/main/docs/design/coreclr/jit/viewing-jit-dumps.md)
describes these diagnostics and their output limits.

The version-pinned
[10.0.11 JIT configuration declarations](https://raw.githubusercontent.com/dotnet/runtime/v10.0.11/src/coreclr/jit/jitconfigvalues.h)
make the preceding four switches release-supported. `JitDump`,
`JitLateDisasm` and `JitDisasmAssemblies` are debug/checked configuration
entries. Do not silently replace the candidate runtime with a checked JIT,
or change inlining only for inspection and then claim configuration
identity with measurement.

Ordinary `JitDisasm` formats the JIT's instruction representation. The
guide distinguishes a late disassembler that independently decodes emitted
bytes. LLDB offers address-range disassembly and binary memory export;
these are candidate additional checks in the admission process, with
explicit method-address, range and process binding. Installed tools do not
prove attach permission or successful coverage. Record raw bytes before
any derived address normalization. File disassembly of a managed DLL is
not inspection of its later JIT body.
[LLVM's LLDB command reference](https://lldb.llvm.org/use/map.html)
documents those memory/disassembly operations.

Inspect operand widths, operation order, constants, comparison strictness,
branch selection, inlined helpers and every executable fallback path.
The pinned [ARM64 code generator](https://raw.githubusercontent.com/dotnet/runtime/v10.0.11/src/coreclr/jit/codegenarm64.cpp)
maps ordinary floating add/subtract/multiply/divide to separate instructions;
its combined multiply/add path explicitly requires integral types. This
supports feasibility, not a proof that all earlier transforms preserve the
registered graph. FMA has different rounding from multiply followed by add,
as [Microsoft's FMA contract](https://learn.microsoft.com/en-us/dotnet/api/system.math.fusedmultiplyadd?view=net-10.0)
specifies. Actual fused, reassociated, narrowed or otherwise different
arithmetic requires the protocol's bound under that graph, or refusal.
Hand-vector agreement cannot replace this inspection premise.

## Declared system-library observation candidates

The local SDK headers and export stubs below support these prospective
macOS ARM64 signatures. They are a plan for reviewed P/Invoke declarations,
not an implemented collector or permission to add an undeclared helper.
Use the system library, exact entry point and C calling convention; record
the resolved native image. The inspected stubs name `/usr/lib/libSystem.B.dylib`
(including the fenv exports) and `/usr/lib/system/libdyld.dylib` for
the dyld calls. Resolving these actual runtime images remains an admission
check. Mach-O symbol listings add an ABI underscore:
for example, exported `__dyld_image_count` corresponds to entry point
`_dyld_image_count`, while `_fegetenv` corresponds to `fegetenv`.

| Observation | Native signature | Proposed managed representation |
| --- | --- | --- |
| FP environment | `int fegetenv(fenv_t *envp)` | `int`, pointer/byref to sequential two `uint64` fields: FPSR then FPCR; 16 bytes, 8-byte alignment |
| Rounding | `int fegetround(void)` | `int`; retain negative failure values |
| Image count | `uint32_t _dyld_image_count(void)` | `uint32` |
| Image header | `const struct mach_header* _dyld_get_image_header(uint32_t)` | native pointer |
| Image name | `const char* _dyld_get_image_name(uint32_t)` | borrowed native pointer, bounded copied string, never freed by caller |
| Image slide | `intptr_t _dyld_get_image_vmaddr_slide(uint32_t)` | signed native integer |

The SDK ARM64 `fenv.h` defines rounding mask `0x00c00000`, nearest mode
`0`, and flush-to-zero mask `0x01000000`. Read the full raw FPCR/FPSR and
return codes; retain all other bits rather than pretending those masks
exhaust current architectural modes. `fegetround` alone cannot observe
flush mode. Cross-check its result against FPCR and refuse unknown or
contradictory mode observations. Trap enables and any additional mode bits
also need the admitted-mode policy. Do not confuse FPSR exception flags
with FPCR controls, or clear/set flags while claiming a read-only check.
The SDK explicitly says flush mode treats denormal inputs/results as zero.

Observation belongs to the calling thread at the sample point. Perform it
on the actual policy thread within the declared admission metadata phase,
without task-policy calls or an unrecorded helper task. Matching before/after
observations cannot rule out an intervening mode change. A fixed synchronous
thread, reviewed call graph and declared runtime/native trust boundary are
still premises. No `fesetenv`, `fesetround`, generated assembly shim or
native task plugin is proposed here. The inspected public Apple Libm ARM
source is an older 32-bit FPSCR implementation, so it is not evidence for
the current ARM64 implementation; the exact local SDK supplies this ABI
evidence. Actual symbol resolution and ABI checks remain future work.

For native images, upstream
[ProcessManager.BSD.GetModules](https://raw.githubusercontent.com/dotnet/runtime/v10.0.11/src/libraries/System.Diagnostics.Process/src/System/Diagnostics/ProcessManager.BSD.cs)
returns only the executable or an empty collection. It cannot stand in for
a native-image roster. The SDK `dyld.h` and
[Apple's dyld manual](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man3/dyld.3.html)
explicitly warn that count/index iteration races concurrent load/unload.
Bounds, null checks and comparing counts may detect some changes; equal
counts do not prove a stable snapshot. Any bounded collector must disclose
that limitation and refuse detected inconsistencies. Load/unload callbacks
offer additional observations, but require separately reviewed lifetime,
reentrancy, storage bounds and cost accounting; they are not assumed here.

Record image paths and available Mach-O identities, with file hashes where
actual files are available. SDK `.tbd` files are link-time export stubs,
not hashes of the running system dylibs or shared cache. System-cache
images, inaccessible files and the loader need explicit available-identity
records and collection limits, never invented hashes. This is consistent
with the protocol's system-library/OS trust boundary.

For managed code, enumerate actual loaded assemblies/modules with load
context, dynamic status, MVID and available file identity. Microsoft states
that [Assembly.Location](https://learn.microsoft.com/en-us/dotnet/api/system.reflection.assembly.location?view=net-10.0)
can be empty for byte-loaded or bundled assemblies and unsupported for
dynamic assemblies. [MVID](https://learn.microsoft.com/en-us/dotnet/api/system.reflection.module.moduleversionid?view=net-10.0)
is metadata identity, not a machine-code hash. Before/after
[assembly snapshots](https://learn.microsoft.com/en-us/dotnet/api/system.appdomain.getassemblies?view=net-10.0)
do not enumerate every transient dynamic method. Identify framework
generated-code roles and collector gaps explicitly; an empty file location
does not excuse unexpected dynamic task code.

## Exact local evidence and next check

These are observed candidate-file hashes, not vendor authentication, a
complete dependency manifest or runtime admission. `D` below expands to
`/Users/acehack/.local/share/mise/dotnet-root`; `S` expands to
`/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk`.

| File beneath the stated root | Bytes | SHA256 |
| --- | ---: | --- |
| `D/dotnet` | 141392 | `2ff302a3c5cecc4a371fd6482d2f5547c57d93eff9fe19919ef729a54f69ce04` |
| `D/host/fxr/10.0.11/libhostfxr.dylib` | 425456 | `0470d25c71ba36f1e7491e5a11f6ba489924f52e9cf60e5fa87135dafced8433` |
| `D/shared/Microsoft.NETCore.App/10.0.11/libhostpolicy.dylib` | 423040 | `511e01af076a9c8b4f982c202f389bc8e5b19d77b2d2b2c8b713a240dc93b031` |
| `D/shared/Microsoft.NETCore.App/10.0.11/libcoreclr.dylib` | 6217584 | `10b24d0b11c7f6d838114744097bf10df9b08b906afc9016567631a1c009dfd0` |
| `D/shared/Microsoft.NETCore.App/10.0.11/libclrjit.dylib` | 3100992 | `f7a10d53425c1fc3bd871e6d893d6ac531f7719b045c3a4488ec38550e29f367` |
| `D/shared/Microsoft.NETCore.App/10.0.11/System.Private.CoreLib.dll` | 17088296 | `9ed74c2e2efeee87f1f2d7ffe1736b7e9164ce248516ea39402a725eedc87af6` |
| `D/sdk/10.0.400/FSharp/fsc.dll` | 107816 | `36ee76a297943f1e8285eb1a0528c72ebe6fba94f9805fc93a529be010e2509f` |
| `D/sdk/10.0.400/FSharp/FSharp.Compiler.Service.dll` | 45602088 | `7d9c28f8dd1edbdc34a5c5c7757805fff3490a45f169c452f7ae6d14370d5d1e` |
| `S/usr/include/fenv.h` | 19641 | `810c6384b279de3c3f49889bcec98dccec98062fc6757d4ab42b1e6e9aa61292` |
| `S/usr/include/mach-o/dyld.h` | 18233 | `7c8583f2b4edcfcde7da60ffe02c75974ec87f885fecc4e8d40761fe0b553a80` |
| `S/usr/lib/libSystem.tbd` | 334178 | `20cfce043f11a083e2eb6111efe3579919a8082fa4cc912a7bd839af2010ec57` |
| `S/usr/lib/system/libsystem_m.tbd` | 20050 | `1ae3b7bd7bcdc271a938841f77bc1a2df458890e180424ff5473f289af16d7e2` |
| `S/usr/lib/system/libdyld.tbd` | 9396 | `c9d4aaa58a50cd544b8f583c4368d23f8c299e39dc8145e1c3f8ecf9b32becf4` |

After the reviewed registration dependency, the smallest useful admission
check is the declared file-backed implementation's separate graph/hand
process: exact source/build/runtime/configuration binding, complete concrete
method coverage, arithmetic/FP-mode observations and honest image rosters.
Preserve any failure and refuse the measured fast-path claim when a required
premise is unavailable. Successful admission would still be conditional on
the recorded correspondence, not a proof over arbitrary JIT executions.
The fresh cost process must retain its frozen prelude, setup counters and
row warmups; this planning pass introduces no extra policy calls there.
