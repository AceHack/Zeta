# Native graph prefix feasibility: prelaunch record

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: two live captures refused; second retains actual callable prefixes

This bounded next step follows the [pure boundary](native-pure-validation.md) and
[runtime inspection plan](../../2026-09-07-hidden-switch-compiled-runtime-feasibility.md).
It does not admit a runtime, claim complete body coverage, generate a registered
stream, or execute a compiled guard. The initial CLI exposes `graph-hand` only.
It prepares 24 scalar native calls (effect false/true, depth 1..3, beliefs
0, 1/4, 1/2, 1) and four adapter-native calls (effect false/true and cue 0/1).
Its `SourceDraws` is zero. These 28 calls are feasibility preparation, not the
registered 222-scalar/48-new/24-old hand payload or any measured prelude.

The file-backed collector exclusively opens a JSONL record before hand work,
records FP state through the declared system ABI, hashes available loaded managed
and native files, and retains unavailable shared-cache identities explicitly.
Dyld names use strict UTF-8; count equality does not make the image snapshot atomic.
The actual method roster includes relevant static module methods and generated
`Invoke` methods, their IL, and prepared callable pointers. Open generic or missing
IL entries remain unresolved. A callable pointer is never labeled a body span.

The separate LLDB helper atomically creates its owned attempt directory, launches
the exact file-backed host/DLL with the required three startup flags and qualified
JitDisasm patterns, waits for the owned ready record, and interrupts that process.
It preserves each raw callable prefix before decoding and checks every decoded
instruction's contiguous address, four-byte width and exact bytes against the
separate memory read. Later refusal preserves earlier prefix files. Prefixes may
contain stubs or literal data; they are not assumed to be complete method bodies.
`RuntimeAdmitted=false` and `BodyResolved=false` remain mandatory. Capture completion
alone is the meaning of `Complete=true` here.

The owning debugger supplies the completion handshake, resumes and observes exit,
and attempts bounded cleanup on failure. Guarded cleanup/restoration retains the
primary failure and secondary details. Startup, interrupt and exit waits have
60/10/30-second operational bounds; the external process owner must also bound the
LLDB invocation itself. Successful launch would not prove attach support or general
descendant isolation. No policy-specific native shim or changed arithmetic method
attribute is introduced. The only new native imports are the declared fenv/dyld
metadata calls. Unknown actual body/FP/closure premises will require refusal.

The independent protocol reviewer accepted this initial prefix scope after finding
and reviewing repairs for incomplete decoder admission, loss of earlier prefixes,
cleanup exceptions masking primary failures, and UTF-8 replacement of image names.
Five synthetic tests passed, covering those relevant Python writer/decoder paths
without launching LLDB targets, policies or streams. Live LLDB API introspection
confirmed the used methods on lldb-2100.0.17.203; that introspection created no
debug target. One initial F# `For`-builder compile failure is retained locally;
corrected graph builds finish with zero warnings/errors. The
[lossless evidence inventory](native-graph-attempt-1/manifest.json) retains the
first capture and all preceding build/test/API logs, including failed attempts.

## First capture and observation-order correction

The first actual launch used source `efc8dbe62d5580e1d02bb401eab815bdef6c8db3`
from 16:22:38.817266 to 16:22:40.381745 UTC. LLDB launched native process 95365;
the native collector returned exit 2 with `native-images / changed-count` and
LLDB returned 1. No ready record or independent memory-prefix capture completed.
The original failure did not retain the two numeric counts. Its 603,673-byte JIT
log and every output remain unchanged in the inventory. This establishes a
working launch path, not attach support, body coverage or runtime admission.

The original collector interleaved raw loader enumeration and file identity work.
Lazy loading during metadata work is a possible explanation for the count change;
the first record does not establish its cause. The reviewed correction copies
only image names, headers and slides first, then publishes that raw prefix,
both actual counts and any refusal before hashing files. A separate
`CountAfterFileIdentity` records the later observation. Equal counts do not imply
an atomic loader snapshot. Earlier FP and callable-method observations now publish
immediately so a later loader refusal cannot discard them.

The independent protocol reviewer accepted the exact 16,429-byte corrected source
SHA256 `C84C5911DCBE2E6E8CB2C338F634346EF7F6C073B005AAFB13371EA704F15D15`
by source inspection, without executing a target. Fresh mapped Release build 6
then passed in 4.56 seconds with zero warnings/errors. Its prelaunch source record
is retained. Build 5 overlapped subsequent source edits and is not treated as the
final source binding. The next capture must use a fresh attempt directory and
retain `RuntimeAdmitted=false` and `BodyResolved=false`.

The first JIT output also exposes later closure obligations: the selector's
epsilon is a separately referenced `RWD00` literal, and dynamic
`IL_STUB_StoreTailCallArgs` entries are outside the reflected method roster.
Complete admission must bind relevant data and classify actual generated helper
paths as well as resolve callable stubs and body spans. The present probe does
none of that; the compiler text alone is not a complete graph certificate.

## Second capture: retained prefixes, refused completion

Attempt 2 used committed correction `7e35075ebeb6496728ddeb58c6fbbf93497d50a4`
from 16:37:17.473758 to 16:37:19.384357 UTC. Its
[188-record lossless inventory](native-graph-attempt-2/manifest.json) includes
every raw/decoded prefix, the native JSONL, compiler text and failed outcome.
The raw loader counts were 352 before and 352 after enumeration; the separately
recorded count after file identity work was 357. This observes a later difference
without attributing individual loads or retroactively completing the earlier set.
Both recorded FP snapshots have FPCR zero, `fegetround` zero and return zero.

The debugger stopped its actual process and retained 90 method-roster rows:
86 prepared callable prefixes passed contiguous ARM64 instruction/byte equality,
and four open-generic entries remain explicitly unresolved. All 86 prepared
prefixes begin a decoded literal load into x11 followed by an indirect branch
through x11. They are indirections, not resolved arithmetic bodies. The initial
64-byte reads also include neighboring entries; no method extent is inferred.

The attempt then refused at stage `resume` because `PutSTDIN` did not report the
full completion handshake write. Its original message did not record the returned
byte count. The owned process 8263 was killed and observed terminal with exit 9;
LLDB exited 1. The final outcome is `Complete=false`, `RuntimeAdmitted=false`.
The earlier successful capture stages do not change that failure classification.
The next instrument correction will use an explicitly owned completion channel
and preserve the exact handshake observation, without changing a measured path.

Source guidance remains distinct from installed binary provenance: the public
.NET v10.0.11 source pin is `79d0c463f1b55624c874a11585f7e47731e8d675`, while the
installed runtime reports `e2f47b0110ed922f21a1522da67279133ce28f32`. Public source
cannot certify the installed graph. LLDB independently decodes the actual observed
prefix bytes; JitDisasm remains separate compiler-emitted evidence. See the
[official JIT guide](https://github.com/dotnet/runtime/blob/main/docs/design/coreclr/jit/viewing-jit-dumps.md)
and [LLDB launch API](https://lldb.llvm.org/python_api/lldb.SBLaunchInfo.html).
