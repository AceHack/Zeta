# Native graph prefix feasibility: prelaunch record

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: reviewed initial collector; no live graph capture yet

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
corrected graph builds finish with zero warnings/errors. Raw build/test/API logs
will be indexed with the first capture, including every failed attempt.

Source guidance remains distinct from installed binary provenance: the public
.NET v10.0.11 source pin is `79d0c463f1b55624c874a11585f7e47731e8d675`, while the
installed runtime reports `e2f47b0110ed922f21a1522da67279133ce28f32`. Public source
cannot certify the installed graph. LLDB independently decodes the actual observed
prefix bytes; JitDisasm remains separate compiler-emitted evidence. See the
[official JIT guide](https://github.com/dotnet/runtime/blob/main/docs/design/coreclr/jit/viewing-jit-dumps.md)
and [LLDB launch API](https://lldb.llvm.org/python_api/lldb.SBLaunchInfo.html).
