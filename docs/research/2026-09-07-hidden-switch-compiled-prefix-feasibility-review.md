# Guarded controller: prefix feasibility evidence and next body check

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, independent protocol-review agent
Disposition: prefix collection demonstrated; method-body and runtime admission pending

This follows the [prelaunch review](2026-09-07-hidden-switch-compiled-graph-prelaunch-review.md).
The reviewer read source changes and existing native/LLDB records, checked
retained bytes and inspected installed diagnostic-tool metadata. No reviewer
build, test, debugger target/plugin load, policy invocation, registered stream,
guard computation or measurement occurred. Inline hash/record inspection was
executed without a separately retained original audit-script log.

## Separate failed attempts and successful prefix collection

Attempt 1, source `efc8dbe62d5580e1d02bb401eab815bdef6c8db3`, refused because
dyld counts changed during enumeration. It did not retain those counts and
establishes no cause for the change. Its original files remain separate.

The reviewed correction, source
`7e35075ebeb6496728ddeb58c6fbbf93497d50a4`, emits raw copied image names,
headers/slides and both counts before file-identity hashing. It retains a
collected prefix and typed failure on refusal. Later file-identity work has
a separate count; it cannot retrospectively expand the earlier image roster.
Earlier FP and method-callable observations now survive an image refusal.
The reviewed F# file was 16429 bytes with SHA256
`c84c5911dcbe2e6e8cb2c338f634346ef7f6c073b005aafb13371ea704f15d15`.

Attempt 2 at that source retained 90 method rows: 86 captured prefixes and
four explicit open-generic refusals. Completion then failed because LLDB
`PutSTDIN` did not accept the full handshake. The outcome records that first
failure and successful owned-process kill/terminal observation. This remains
a failed attempt despite the useful captured prefixes; its preservation
commit is `fd991be4c1d2b2b356ff0b839ff99dbca860d241`.

The next reviewed correction, source
`7ff6bc3cfa410e621fdf0e246efc3807d17ee601`, uses an exclusively written,
fsynced ASCII completion file naming the actual positive PID. The debugger
writes it only after prefix capture while the target is stopped; native code
checks absence before hand work and later reads its exact bounded bytes.
The graph-only polling deadline and outer process bound are operational
cleanup limits. No measured path or scientific criterion changed.

Attempt 3 at that source completed this prefix-only operation with process
15204 exiting zero. The exact 29-byte marker was
`graph-capture-complete:15204` followed by one LF; its SHA256 was
`828d4a98883c22fa1ed3c7396b0b33e2cc109932ff8c631bae6d25aba0b37f9d`.
The native finished record names that same PID. Again there were 90 method
rows, 86 captured prefixes and four generic refusals. The report records
28 fixed native preparation calls, zero source draws and
`RuntimeAdmitted=false`. This is successful collection, not runtime admission.

Both attempts 2 and 3 record raw dyld counts 352/352, followed by 357 after
file-identity work. These numbers demonstrate why the phases must remain
distinct. They do not prove atomic enumeration, identify each intervening
load or establish a complete later image roster. Both FP observations on
managed thread 1 report successful environment/rounding calls, FPCR zero,
FPSR `0000000008000010` and a 16-byte environment structure. These are
observations in the inspected process, not a proof of future-process modes.

## Independent read-only record checks

For each of the 86 captured prefixes in each attempt, the reviewer checked
its SHA256, every retained four-byte instruction's contiguous address and
exact byte equality to the corresponding raw prefix slice. All entries still
say `BodyResolved=false`. Every prepared prefix starts with the observed
ARM64 literal load into `x11` followed by `br x11`; subsequent prefix bytes
can belong to neighboring stubs and are not labeled a complete method.

The principal original-record fingerprints are:

| Attempt | Original file | Bytes | SHA256 |
| --- | --- | ---: | --- |
| 2 | `entry-prefixes.json` | 375878 | `0722499abd2f806c5446424d27f66426d3c5714d08db496ab15c5868bbf132cd` |
| 2 | `outcome.json` | 4238 | `69212963b61fe0da00099b314fef76a893e72313b02ffe1ac5bef32a06c4153f` |
| 2 | `native.jsonl` | 260951 | `64f4de680a2d1903f78f853e86f1a260964da6ff4ccf5351c1facc639b30758a` |
| 2 | `jit.log` | 630784 | `0b18eb7fd4edbc9b5c05daa94d6b2e957125f9dafa865f1d4774f5071bff7210` |
| 3 | `entry-prefixes.json` | 375878 | `8ffd5119ac2e8bf4631b7e5461205284c293d10ac6825e7f593a4da97899382f` |
| 3 | `outcome.json` | 3694 | `f3e2571736f2c972b9c717e028b639466a3be3b78faaa50a51d927c83ee673d3` |
| 3 | `native.jsonl` | 261209 | `e6fe61149bb0286a3b51d3958fa3cd64b0b370ae84c1393d2fb13a16caf70b1b` |
| 3 | `jit.log` | 636215 | `874027583ba6cdb01eb98447186372fe7a90426d17dce7ed52731c34aede8ae4` |

These are scoped record checks, not a claim that all author validation files
or the entire build derivation were independently verified in this pass.

## Next complete-body discriminator

The next proposed capture should decode only the exact observed stub form,
retain the addressed eight-byte literal pointer cell, and follow it to a
readable executable target. It must retain any additional indirection and
refuse unrecognized forms. Candidate method spans need unique method/module
identity, complete emitted offsets/length/bytes and independent decoding of
the matching live-memory range. A guessed adjacent-pointer boundary or a
matching short prefix is insufficient.

The actual diagnostic listing already shows two extra closure obligations:
the selector loads epsilon from a separate `RWD00` literal, and framework
`(dynamicClass):IL_STUB_StoreTailCallArgs` entries exist outside the reflected
task-method roster. Referenced constant data and generated dispatch/call
paths therefore need their own correspondence. Capturing a candidate body
still does not admit all arithmetic, inlined callers or external helpers.

An already installed optional diagnostic cross-check was identified without
loading it: the osx-arm64 SOS libraries bundled with `dotnet-dump` 9.0.661903,
under its `tools/net8.0/any/osx-arm64` directory. Installed help and
[official SOS documentation](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/sos-debugging-extension)
describe `ip2md` and `u -n -o` for method identity and complete annotated
managed-method disassembly. SOS 9 / runtime 10 / this LLDB compatibility is
untested. Native ownership selected the exact-stub/JIT approach first; any
later SOS use must separately pin its debugger-side dependencies, preserve
failures and avoid automatic symbol downloads or target-policy changes.

| Locally inspected optional artifact | Bytes | SHA256 |
| --- | ---: | --- |
| SOS `libsosplugin.dylib` | 201552 | `37ba4dc31dbef55ba961d56a63414d7ca3e8e0bd08343caa15cebc30216fb792` |
| SOS `libsos.dylib` | 793968 | `d6ba022e580d0e94ebacd5e2f60b58afbbeba668ee0d0218c88c87234bcecf92` |
| SOS `sosdocsunix.txt` | 66843 | `8a4ca323212a5a41570b275001532f66ac10bd6f1e73d9fb833338a7959b5f01` |
| Installed runtime 10.0.11 `libmscordaccore.dylib` | 2408704 | `f83d4ff7907e659312c49a730ac57aaca627eeed47828984c1e61bb2666307b2` |

The unchanged [protocol](2026-09-07-hidden-switch-compiled-protocol.md) still
requires complete reviewed arithmetic/caller correspondence and the declared
runtime/source/FP boundaries. Nothing in these three feasibility attempts
substitutes sampled policy agreement for those obligations.
