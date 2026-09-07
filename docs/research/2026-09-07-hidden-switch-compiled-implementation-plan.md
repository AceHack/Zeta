# Guarded hidden-switch compilation: implementation ownership plan

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: implementation planning only; no new executable or guard computation

The [frozen protocol](2026-09-07-hidden-switch-compiled-protocol.md) at
`8710ae4f4e37b727ccc8bb79e212a7bed433bbd0` governs this plan. Registration
is remotely verified; the separate prior-study PR #16928 main landing and
source-byte check remain prerequisites to implementation. This note changes
no registered roster, threshold, timing prelude or evidence obligation.
Names below organize implementation; exact versioned wire shapes must be
shared between writers and archived before registered source generation.

## Three disjoint writing scopes

1. **Native owner: measured implementation and all build wiring.** Own
   `src/Research.FSharp/HiddenSwitchCompiledReceipt.fs`,
   `HiddenSwitchCompiledCertificate.fs`, `HiddenSwitchCompiledPolicy.fs`,
   `HiddenSwitchCompiledExperiment.fs`, `HiddenSwitchCompiledCost.fs` and
   `HiddenSwitchCompiledRuntime.fs`; a file-backed executable project such
   as `src/Research.FSharp.Cli/HiddenSwitchCompiled.fsproj` and its entry
   point; native tests; project/solution/test source ordering; and any
   derived build graph. Link unchanged archived `HiddenSwitchReceipt`,
   `HiddenSwitchObservation`, `HiddenSwitchCarrier`, `HiddenSwitchPolicy`,
   `HiddenSwitchExperiment` and `ResearchRandom` sources explicitly, with
   required direct helpers. Those archived research files are linked in
   `Tests.FSharp.fsproj`, not supplied by a Research library or `Core.dll`.
   Do not depend on a test assembly or load the FSI runtime. Keep normal
   warnings-as-errors; the existing general CLI's override is not a model.
2. **Independent Python owner: numerical truth and independent episodes.**
   Own `hidden_switch_compiled_ieee.py`, `hidden_switch_compiled_certificate.py`
   and `hidden_switch_compiled_reference.py` under
   `src/Interp.Python/zeta_interp/`, with matching tests. The IEEE module uses
   integer/sign/exponent/significand arithmetic and explicit nearest/even
   rounding, preserving signed zeros and subnormals; host float arithmetic
   is not its oracle. The certificate module independently reconstructs all
   ordered exact alpha candidates, envelopes, bound obligations and guard
   neighbor inequalities. The reference owns its independent source mixer,
   simulator/renderer, scalar filter/chooser and episode reconstruction.
   Reuse only previously independently authored source/renderer helpers
   when explicitly pinned; the new filter/evaluator use software binary64.
   Do not import native outputs or new native implementation to derive the
   reference.
3. **Coordinator: strict evidence admission, replay and verdict.** Own
   `hidden_switch_compiled_replay.py`, `hidden_switch_compiled_verdict.py`,
   shared evidence-only admission/schema helpers and their tests. Own the
   source manifest, archival/publication records, process launcher and quiet
   cost coordination. Strictly bind each complete envelope and raw artifact;
   replay every row/call in order using the independent model; recompute the
   verdict rather than accepting a `Passed` field. Native projection/filter,
   certificate arithmetic and Python numerical internals remain outside this
   writer's edit scope. The separate reviewer inspects all three lanes.

Only the native owner edits shared project/test/solution/build-graph files.
Any new co-claim precedes edits; every writer uses its own clone. Land pure
interfaces and hand contracts first, then independent implementation and
cross-language comparison. No registered source calls occur before the
separate reviewed implementation archive.

## Minimal shared interfaces and exact receipt necessities

**Pure choice service.** Admit strategy, effect, depth and one binary64
belief; the compiled strategy has previously admitted numeric constants.
Return `Action`, `Path` and six actual uint32 counts: `GuardComparisons`,
`RecursiveCalls`, `Nodes`, `ActionValues`, `Predictions`, `Updates`.
Both arms write the registered 28-byte little-endian record. Runtime handles,
source IDs, file paths, tapes and evaluator state never enter the policy.
The unsupported-runtime conformance dispatcher selects real recursion;
malformed certificate/input refusal stays distinct. No Q fields are added
to either timed strategy output.

**Common adapter.** Provide create/reset, observe, choose/commit and an
owned audit snapshot; use typed failure values. State contains one belief,
effect/geometry and chronology counters. Observe copies and validates the
admitted pixels and invokes the unchanged predictor/conditioner. Choice
commits its action before feedback. No scorer or environment capability is
accepted. The snapshot contains only admitted belief bits and actual
filter/choice work; it cannot expose evaluator state through a debug field.

**Episode.** Share `Index`, `Complete`, `Failure`, `Cues`, `Actions`, `States`,
`Reward4`, `BeliefBits`, `ChoiceWork`, `FilterCounters`, `FrameSha256`,
`ProjectionSha256`, `TotalReward4`. Lengths are the fixed 17 observations and
16 actions. Use fixed-width uppercase 16-hex-digit binary64 patterns and
uppercase SHA256 strings, retaining negative-zero bits. Q bits belong only
to the separate untimed scalar/old-runner audit, where action order is
harvest then switch. Keep old control receipts unchanged; any added bit
audit wraps them rather than editing the old DTO. Failures carry available stage, panel, mode, strategy,
replicate, episode and call location plus the completed prefix.

**Certificate/scalar audit.** Separate raw candidate input from an opaque
verified numeric certificate. Bind source/model/protocol and epsilon bits;
retain complete ordered 2/8/128 candidate rosters, exact interval endpoints,
error/rho obligations and all four inward guard/neighbor inequalities.
Represent arbitrary rational numerators/positive denominators canonically
as decimal strings; this does not collapse binary64 signed zero. The
independent checker recomputes every candidate and obligation. Each of the
222 scalar positions retains roster index/input bits/effect/depth, native
Q bits, selected action, and both strategies' path/work. Include expected
refusals separately; booleans never substitute for recomputed evidence.

**Envelope and cost row.** Use a shared schema/version and exact required
key sets for kind, attempt, completion/failure, configuration, arguments,
source/archive/certificate identities, runtime/loaded-artifact roster,
start/end and input/output hashes. Retain the complete raw bytes, not only
those hashes. Cost rows identify mode/panel/replicate/order/strategy, counts,
integer wall/CPU/current-thread allocation/GC ledgers, warmup and measured
artifacts, and setup-stage records. Empty nullable locations and zero-CPU
ratio reasons are explicit. Keep raw JSON admission, bit-pattern parsing
and unbounded-integer verdict arithmetic separate from policy execution.

## Runtime and source-to-machine inspection boundary

The native runtime module owns read-only managed/native-image and FP-mode
collectors, strict archive/configuration admission, and typed refusal. It
must not supply policy capabilities. The separate graph/hand process emits
raw method/code/configuration evidence; the coordinator and independent
reviewer decide whether the recorded premise is sufficient. Production
code cannot self-certify its own `GraphPassed` boolean.

Enumerate the actual caller closure: entry-point dispatch; common adapter
observe/choose and frame copying; projection/decoder; predictor/conditioner;
recursive evaluator/selector; generated recursion, continuation and result
builder closures; numeric maximum/comparison helpers; guard/input admission;
and actual work/record writers. Include inlined bodies and concrete generic
instantiations, not only two selected Q methods. Identify relevant carrier,
source, runtime and serialization helpers in the finite manifest. Arithmetic
inspection covers filter operations as well as the tree; privacy/chronology
and output-accounting correctness require source/capability review too.

The [runtime feasibility note](2026-09-07-hidden-switch-compiled-runtime-feasibility.md)
limits macOS `Process.Modules`, non-atomic dyld snapshots, JIT diagnostic
output and FP-mode observations. Preserve those limits and actual file/
module/code identities. No unlisted task code or unknown arithmetic mode
is admitted by treating a missing observation as success. Keep all graph,
conformance and policy preparation outside the fresh cost process except
its frozen 144-old-runner prelude and row-specific warmups. Static/module
initialization must not hide policy execution or certificate validation
before the declared setup counters.

## Integration gates without a new experiment

First agree exact DTO keys, enums, numeric/bit encodings and typed failures.
Then establish independent arithmetic/certificate refusal tests, native
actual-work and copy/chronology tests, and the fixed 48-new/24-old hand
cases plus 222 scalar positions. Validate full-shaped envelope mutations
and nonvacuous replay using these hand inputs before any fresh source draws.
Archive complete source, build/runtime/graph, hand/certificate and review
artifacts only after all required admission and repository gates pass.

The registered later run remains 2,048 new ordinary episodes, 1,024 old
controls, 144 cost-setup trajectories, 1,440 whole-cost executions,
1,310,720 ordinary-choice and 409,600 stress-choice measured records, with
all specified warmup outputs separately retained. A pure scalar replay
cache includes every input bit, effect/depth and source/certificate identity
and still validates every repeated record. No new arm, seed, roster,
threshold, cost prelude or shortcut is introduced by this ownership plan.
