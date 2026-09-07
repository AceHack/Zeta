# Guarded hidden-switch compilation: preregistration draft

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Registration status: DRAFT; not frozen or permission to implement or measure
Draft basis: refreshed origin/main `3c937c006`, claim `92aba2466`

## Question, dependency and claim boundary

Can a certified guarded controller reproduce the selected actions of the
fixed native hidden-switch planner while using at most half its median
choice-only wall time and current-thread allocation on each declared
ordinary input panel? Exact action equivalence and certificate admission
are independently mandatory. Whole-episode and fallback-stress costs are
descriptive, with no speed threshold attached.

The prior experiment `081M1XK02XM087G0R00043EW05` is a separate dependency.
Its [archived protocol](https://github.com/Lucent-Financial-Group/Zeta/blob/4fc82b611012bd2620a26e02afe6baba491fe553/docs/research/2026-09-07-hidden-switch-protocol.md)
and [native policy](https://github.com/Lucent-Financial-Group/Zeta/blob/4fc82b611012bd2620a26e02afe6baba491fe553/src/Research.FSharp/HiddenSwitchPolicy.fs)
are fixed at `4fc82b611012bd2620a26e02afe6baba491fe553`. Its source/results
are remotely archived but not yet on this draft's main base. This task
waits for their main integration before new implementation, and checks
the imported dependency bytes against that archive. It does not copy or
modify the old study to make missing main paths appear present.

Unregistered paper design `4332b1bed` and its focused correction
`f47c9569c` are prospective provenance. Their mathematical review supports
the source-graph derivation under declared IEEE assumptions; it is not a
JIT theorem. Neither those notes nor this unfrozen draft authorizes guard
generation, implementation, new tapes or measurements. Freeze requires
accepted mathematical and complete-protocol reviews and a verified remote
registration tag for this new work item.

The model, representation, filter, action meanings and goal remain
supplied. This is compilation of one depth-limited controller, not learned
perception/dynamics, discovered goals, full-horizon optimality, general
planning efficiency or necessity of search. It cannot retroactively change
the previous experiment's behavior, costs, output schema or verdict.

## A. Unchanged environment and matched controller interface

An episode has sixteen actions and seventeen observations, including an
initial and unused terminal cue. Hidden state is binary with fair initial
state. Harvest key zero rewards `4*x` quarter-units; switch key one costs
one quarter-unit. Reward uses the pre-transition state. Next state is
`x XOR (effect AND action=1) XOR drift`, with independent drift probability
`1/8`; each cue is state XOR independent error with probability `1/4`.
Realized rewards remain private to the evaluator. The reward law is supplied.

Reuse the admitted 64-by-32 binary renderer, private lower eight rows,
projection/decoder, and declared dot/bar/palette hand modes from the pinned
dependency. Ordinary panels use dot/fixed rendering only. The common policy
adapter receives copied admitted cue pixels, the supplied effect flag,
its own committed action history and remaining horizon. It owns one belief,
observation/action chronology and filter counters. No tape, hidden state,
reward, source/episode identity, paths or runtime handles enter policy state.

Both strategies use the identical common observation/filter adapter,
calling the pinned native `predict` and `condition` in their original
operation order. Reset once to prior one-half, condition on the initial
cue, then choose/commit action before environment step and the next
observation. Process the terminal observation without another action.
Depth is `min(3,16-t)`. The adapter is new and must be checked against the
old complete runner rather than assumed equivalent because functions are
shared. No refactor of the frozen policy or original receipt is required.

The two strategies, always ordered `native-recursive`, `compiled-guarded`,
provide the same action-only service. Native calls the pinned `evaluate`
and `select`; compiled uses the certified guards or exactly those same
calls as fallback. Both return action, actual path and actual work counts.
Neither returns full Q arrays as part of the timed output service. Native
Q arrays allocated internally by the original evaluator remain real work
and real allocation. A separate untimed audit retains full native Q traces.

## B. Exact equivalence and proposed numerical certificate

Target equality of the selected key on every finite binary64 belief in
`[0,1]`, both effect flags and depths one through three, under the admitted
source/arithmetic graph. Include both signed zeros. Invalid beliefs,
depths, geometry, frames, chronology or certificate inputs refuse with
typed failure values. No NaN-comparison default, clipping or action repair.

Let `epsilon_N` be the exact rational represented by the native `1e-12`
literal. Native switches precisely when the rounded binary64 subtraction
`RN(Qhat_switch-Qhat_harvest)>epsilon_N`; equality harvests. Decode and
retain its bits from the admitted native artifact during conformance;
check they equal correctly rounded binary64 of exact decimal `1/10^12`.
The recursive value uses the numerical maximum, not a child action chosen
under tolerance.

The certificate uses `eta=2^-48`, with correctly rounded binary64
elementary operations, nearest/even, gradual underflow and the pinned
operation order. Intermediate exact operation results stay within absolute
value eight, so `eta` conservatively bounds each operation's rounding error.
The proof must explicitly establish that range and positive denominators.
The fixed model gives these registered analytical bounds:

| Quantity | Absolute error bound |
| --- | --- |
| Rounded action-predicted prior versus exact prior | `3*eta` |
| Computed evidence mass at the same binary64 prior | `4*eta` |
| Computed posterior at the same prior | `41*eta` |
| Posterior including prior prediction error | `50*eta` |
| Observation probability including prior prediction error | `6*eta` |

Mass is at least `1/4` before rounding; computed mass exceeds `1/8`.
Exact action-predicted posteriors lie in `[1/22,21/22]`, preserving recursive
admission with the above error. Exact depth-n Bellman value lies in `[0,n]`
and is Lipschitz with constant at most `5*n/4`, because every contingent
tree's hidden-state values lie in `[-n/4,n]`. The maximum operation is
nonexpansive in maximum absolute component error. Accounting for both
weighted continuations and the two left-associated additions yields:

```text
E_1 = 0
E_d = 4*E_(d-1) + (4+262*(d-1))*eta
E_2 = 266*eta; E_3 = 1592*eta
rho_d = 2*E_d+eta
rho_1 = eta; rho_2 = 533*eta; rho_3 = 3185*eta
abs(RN(Qhat_S-Qhat_H) - (Q_S-Q_H)) <= rho_d
```

The final `eta` includes selector subtraction rounding. Independent
certification must check the complete range/error derivation, not merely
these final constants. Constants are fixed analytical bounds, not fitted
thresholds. No tightening based on observed speed, beliefs or fallback
frequency is allowed in this version.

For effective depth two the exact gap is `1/2-5*b/2`. At depth three it
is `51/64-95*b/32` on `[0,17/42]`, `17/16-29*b/8` on
`[17/42,25/42]`, and `43/64-95*b/32` on `[25/42,1]`.
The pieces agree at boundaries and are strictly decreasing. Certify these
envelopes against every contingent alpha-vector candidate using exact
rational endpoint dominance, with complete interval coverage. No sampled
grid replaces this finite certificate.

Reconstruct the complete ordered contingent-tree roster independently from
the supplied transition/emission tables. Depth one lists root action zero
then one. At each later depth, loop root action zero then one, cue-zero
child index from zero through the previous roster's last index, then
cue-one child index through that same range. Child indices refer to the
entire previous-depth roster, not only trees sharing a root action. This
gives 2, 8 and 128 positions at depths one, two and three, with 1, 4 and
64 per fixed root action. Preserve duplicate vectors and their distinct
tree positions. The checker rebuilds every vector and compares the full
ordered roster, not a supplied count, selected extreme vectors or pass flag.

Define exact rational cuts:

```text
r_minus(2)=1/5-(2/5)*(epsilon_N+rho_2)
r_plus (2)=1/5-(2/5)*(epsilon_N-rho_2)
r_minus(3)=51/190-(32/95)*(epsilon_N+rho_3)
r_plus (3)=51/190-(32/95)*(epsilon_N-rho_3)
```

For each depth generate `Smax` as the largest binary64 value strictly
below `r_minus`, and `Hmin` as the smallest binary64 value at or above
`r_plus`. Decode stored bit patterns and check their neighbors with an
independent integer/rational binary64 converter. Verify strictness,
ordering, domain coverage and that the depth-three cuts precede `17/42`.
All three gap pieces are monotone, covering both continuation kinks.

After admission, effective depth two/three chooses switch if `b<=Smax`,
harvest if `b>=Hmin`, otherwise runs original `evaluate` then `select`.
Count actual guard comparisons in this stated order. Depth one and null
have exact gap `-1/4-b`; certify `-1/4+rho_d<=epsilon_N` over their entire
domain before using trivial harvest. Thus endpoints use their certified
paths; only the strict intermediate band requires the normal fallback.
The uniform bound covers maximizing-tree changes at kinks without adding
runtime piecewise Q evaluation.

The certificate includes exact source hashes, expression graph, all
candidate lines/intervals, exact literal and guard bits, all range/error
inequalities and checker identity. Its independent checker does not import
the compiled selector and rejects missing/extra fields, altered constants,
omitted envelope pieces, wrong strictness, nonfinite values or different
source identities. A source-bound rational/interval certificate plus the
recorded paper proof is the admission target; no proof-assistant or JIT
theorem is claimed unless separately actually established and reviewed.

## C. Runtime admission and setup

Admit one recorded runtime/architecture configuration for measurement.
Disable tier transitions and ReadyToRun with `DOTNET_TieredCompilation=0`,
`DOTNET_TieredPGO=0` and `DOTNET_ReadyToRun=0` from process launch. Record
the resolved dotnet/runtime binaries, version, architecture, OS, loaded
assembly SHA256/MVID and these exact settings in the implementation archive
and run receipts. Runtime drift refuses measurement under this archive.
These settings and the distinction between initial and optimized tiers
are documented in [.NET compilation configuration](https://learn.microsoft.com/en-us/dotnet/core/runtime-config/compilation).

Independently inspect the executing native evaluator/selector operation
graph and compiled guard comparisons. Record the code/disassembly evidence
and configuration that prevents later uninspected code versions. Any
fused operation, reassociation, extended precision, rounding-mode or
subnormal-mode difference must either satisfy the registered bound under
its actual graph or disable fast paths. A hash or spot probe is not a
source-to-binary or whole-JIT theorem. If the admitted graph cannot be
established, certificate admission fails and no speed claim follows.

A separately labeled `unsupported-runtime` conformance mode disables all
fast paths and calls original recursion on valid input. It is not a
measurement arm and cannot establish certificate coverage. A malformed or
changed certificate always refuses; it is not silently treated as an
unsupported runtime. Do not change environment variables after startup
and assume earlier JIT code was replaced.

Perform archive/certificate/runtime admission once before timed rows.
Retain setup wall/CPU/allocation separately, excluded symmetrically from
both strategies. Per-choice input admission, dispatch, comparisons,
actual recursion, work counting and output-record writes remain timed.
The closed process/prelude schedule in section F enumerates all policy
execution in the cost process. No extra data-driven warmup or hidden
per-arm setup exclusion is permitted.

Graph inspection and hand/negative conformance occur in a separate
admission process before implementation archival, under the same declared
runtime binaries, managed modules, concrete method/generic-instantiation
roster, settings and arithmetic mode as measurement. Retain their inspected
code-version/graph records. Measurement uses a compiled entry point, not
an FSI-generated task assembly, and checks that correspondence before any
policy call. Disabling tier transitions fixes the admitted configuration;
the recorded source/code/runtime correspondence remains an inspection
premise, not a theorem that arbitrary JIT executions agree. No disassembly,
test, dynamic instrumentation or graph-inspection policy call runs inside
the fresh cost process.

## D. Hand, boundary and negative conformance before source generation

The implementation archive retains complete hand outputs and independent
checks before the new behavior/cost streams are generated. Use the four
old explicit hand tapes (`zero`, `one`, `alternating`, `sparse`), both
effect flags, and dot-fixed/bar-fixed/dot-odd-complement rendering. Compare
both new strategies: 48 complete new hand episodes. Run the frozen old
`belief-depth3` full runner on each of the 24 semantic/render cases as
an untimed control. Actions, states, cues, reward4, frame/projection hashes,
native-versus-compiled belief bits and filter chronology must match exactly.
Independent replay reconstructs every case, not just aggregate return.

Define a 37-entry belief roster in the following order, retaining duplicates
and exact bits rather than deduplicating numerical zero or coincident cuts:

1. Seven fixed entries: negative zero, positive zero, least positive
   subnormal, largest subnormal, least positive normal, predecessor of
   one, one.
2. For rational centers `1/5`, `51/190`, `17/42`, `25/42` in that order,
   append predecessor/RN-nearest-even/successor: twelve entries.
3. For exact centers `1/5-(2/5)*epsilon_N` and
   `51/190-(32/95)*epsilon_N`, append the same triple: six entries.
4. For guard values `Smax_2`, `Hmin_2`, `Smax_3`, `Hmin_3`, append
   predecessor/value/successor: twelve entries.

Cross that ordered roster with effect true then false and depths one,
two, three: 222 unique roster positions, including repeated values. Retain
both strategies' actions/path/work and native diagnostic Q bits at every
position. An independent operation-by-operation binary64 model checks the
native scalar computation, including final subtraction and numeric maximum.
The exact alpha oracle checks the intended exact model separately. Action
agreement is exact; neither a numerical Q tolerance nor equality of a
`Passed` field substitutes for it.

Require these executable falsifiers: malformed input/certificate/source
refusal; valid signed-zero/subnormal handling; correct endpoint and kink
paths; actual recursion inside the uncertainty band; unsupported-runtime
recursion-only behavior; action-before-feedback; future-suffix and private
scorer/band noninterference; caller-copy isolation; executed-work counter
accuracy; common-filter/old-runner equivalence. Count actual native
calls and compiled paths, never substitute analytical expected totals.

Negative mutations must be detected: wrong epsilon bits, swapped or
outward-rounded guards, inclusive switch tie, omitted subtraction error,
altered depth/effect/model, missing alpha candidate/interval, ignored
fallback, fabricated counters, changed chronology, private-band leakage,
uninspected runtime/code identity, nonbinary/malformed frames, NaN/infinity
or out-of-range belief, invalid depth/action/order, reused output paths,
duplicate/nonfinite JSON, truncated/reordered data and altered hashes.
At least one strict-interior witness must call the real recursive function
and reject a deliberately stubbed/incorrect fallback. Valid private-band
interventions compare unchanged admitted upper pixels; malformed frames
may correctly refuse.

## E. New ordinary behavior roster

Use the pinned independent SplitMix64 convention: initial stream state is
the uint64 seed XOR domain times the existing golden-ratio constant modulo
2^64; use the same mixer and high-53-bit uniform conversion as the dependency.
Consume exactly 34 draws per tape: initial state, initial error, then
drift/next error for each of sixteen steps. Initial bit is `floor(2*u)`,
drift is `u<1/8`, cue error is `u>=3/4`. Consume all draws even in null.

| Panel, in order | Seed/domain | Tapes | Effect | Rendering |
| --- | --- | --- | --- | --- |
| `ordinary-effective` | `9307/931` | 512 | true | dot/fixed |
| `ordinary-null` | `9307/932` | 512 | false | dot/fixed |

These are chosen prospectively for this draft and are distinct from the
old experiment's seeds/domains. They are not secret from authors. Generate
each panel once, retain tape bits/digests, and reuse the immutable tape for
both strategies with fresh policy/environment state. Each panel consumes
17,408 draws; total 34,816. Execute panel/episode/strategy order as written.

There are 2,048 new strategy episodes, 32,768 actions and 34,816 observations.
An untimed old full-runner control executes each of the 1,024 tapes once.
All actions and semantic traces must agree at every corresponding position;
any disagreement is a failure even if returns match. Retain old native Q
traces separately. Ordinary returns describe the controller already supplied;
no new return-gain threshold or behavioral-superiority claim is registered.

## F. Fresh cost inputs and exact schedules

After complete native behavior/control receipts, generate two separate
72-tape cost corpora with seed/domain `9409/941` (effective) then `9409/942`
(null), both dot/fixed. Each consumes 2,448 draws, 4,896 total. The first
eight tapes are warmup, the next 64 measured. Never reuse behavior tapes.

Use a native behavior process and then exactly one fresh native cost
process for all fifty cost rows. The behavior process exits after its
complete behavior/control envelope is exclusively written and closed.
The coordinator waits for successful behavior-process exit and the closed
complete output before launching the fresh cost process. The cost process
itself admits and hashes that envelope before any policy execution. Its
prelude is exactly:

1. First capture this stage's starting wall, CPU and current-thread allocation
   counters. Then create the fresh attempt directory, read and admit the
   archived source/certificate, stored hand/graph records, native
   runtime/settings/artifact roster and complete behavior envelope.
   These are metadata operations with zero policy, simulator-step, filter,
   evaluator or selector calls. Static initialization may decode/validate
   constants but must not execute a policy or conformance fixture.
2. Generate the two 72-tape cost corpora in declared panel order and decode
   the ten already-defined stress tuples. This performs zero policy calls.
3. Run exactly the 144 old complete-runner trajectories described below,
   effective panel then null, tape indices zero through 71. This executes
   2,304 old policy choices and 2,448 old observations in total, with no new
   native-strategy or compiled-strategy calls. Write their untimed raw setup
   outputs and construct the ordered scalar input arrays.

The first measured mode follows immediately after that prelude. Its only
additional policy execution before a timed row is that row's specified
warmup. Do not repeat hand conformance, warmup probes, trial rows, graph
inspection or arbitrary method-preparation policy calls in this process.
Do not restart it between modes/panels/replicates. Capture each prelude
stage's start counters before any work in that stage and its end counters
after its work completes. Retain these stage wall/CPU/allocation totals,
calls and artifacts separately, including actual archive/certificate
validation in stage one. Process startup remains separately excluded. The old-runner prelude
warms shared native routines and is part of the fixed, disclosed setup;
it is not claimed to place both strategies in identical cache states.

Before timing, run the old full native controller once on each cost tape,
retaining the 144 complete untimed setup trajectories. Use its observed
binary64 belief bits/effect/depth at all sixteen choices as the common
choice input roster. Per panel this is 128 warmup tuples followed by 1,024
measured tuples, each in tape/time order. Setup oracle outputs and source
provenance are retained; policy calls never receive tape/state/score fields.
Independent replay reconstructs these tuples from source, not receipt trust.

Execute all modes in this order: ordinary choice-only, deterministic
boundary choice-only, whole episodes. In each mode use five replicates.
Panel order is always effective then null in ordinary/whole modes, with
one stress panel in the boundary mode. Rotate only strategy order:

```text
for mode in [ordinary-choice, boundary-choice, whole-episode]:
  for r in [0,1,2,3,4]:
    for panel in mode.fixed_panel_order:
      for strategy_index in [r mod 2, (r+1) mod 2]:
        run exactly that row's warmup, then that row's measured work
```

Strategy indices remain zero=native, one=compiled. Record one row per
mode/panel/replicate/strategy. Do not rotate panels or the flattened row
roster, interleave independent host workloads or collect replacement rows.

### Ordinary choice-only: twenty rows

For each of the two ordinary panels and each strategy/replicate, call the
128 warmup tuples once in order, then execute 64 full ordered passes over
the 1,024 measured tuples. That is 65,536 measured calls per row, 1,310,720
over twenty rows, plus 2,560 warmup calls. Each choice starts from the
tuple's supplied scalar input with no retained policy state or cache.
Pass order and duplicate tuple positions are preserved. Both strategies
consume and record every result; no optimizer-eliminated or assumed call.

### Deterministic boundary/fallback stress: ten rows

Use effect true only. For depth two then three, use these five beliefs in
order: successor of `Smax`, RN-nearest-even of `(r_minus+r_plus)/2`,
predecessor of `Hmin`, `Smax`, `Hmin`. This gives ten tuple positions.
The certificate must verify the first three are strictly inside the band
and the last two are the certified endpoints. Retain duplicates if any;
an interior-membership failure refuses this version instead of substituting
a convenient belief.

Each strategy/replicate warms with sixteen ordered passes over all ten
tuples (160 calls), then measures 4,096 ordered passes (40,960 calls).
There are 409,600 measured and 1,600 warmup calls over ten rows. Compiled
must actually recurse on six of ten positions per pass and use a certified
path on four. This is deliberate adversarial concentration, not an estimate
of ordinary fallback frequency. Report all stress costs descriptively.

### Whole episodes: twenty rows

Use the same two fresh cost corpora, reconstructing fresh policy/environment
state for every execution. Each strategy/panel/replicate runs eight warmup
then 64 timed episodes, with all seventeen observations and sixteen choices.
Totals are 160 warmup and 1,280 timed episodes, 1,440 combined. Timing
includes construction/reset, renderer/projection/decoder, common filter,
choices, environment/scorer, action-level traces/digests and actual counters.
Exclude source generation, archive/setup admission, process startup and
final JSON/compression, symmetrically. No hidden full-Q audit runs inside
one timed arm. Return, action and filter agreement remains mandatory.

## G. Equal outputs, raw work and timing

For each choice-only row allocate the complete measured output buffer
inside its timed region and write one fixed 28-byte little-endian record
per call: action byte, path byte, two zero reserved bytes, then six uint32
counts in order `GuardComparisons`, `RecursiveCalls`, `Nodes`,
`ActionValues`, `Predictions`, `Updates`. The path enum is native-recursion,
certified-switch, certified-harvest, certified-trivial-harvest,
fallback-recursion, numbered zero through four in that order. Both arms
write the same-sized service record. Serialize and hash/compress the raw
buffer only after timing; retain the lossless bytes and their hash.

Native always executes one recursive call with zero guard comparisons.
Compiled effective depth two/three performs one comparison on fast switch,
two on certified harvest/fallback. Depth-one/null trivial harvest performs
zero counted belief-to-guard comparisons; finite/range input admission
still executes and remains timed. Only real recursion contributes native tree
counters. A fallback executes one recursive call; a fast path executes
none. Validation/dispatch work remains timed despite not being classified
as tree or guard work. No expected-counter formula substitutes for executed
counts. Retain the analogous path/work sequence within every whole episode.

Whole-episode records have index, complete/failure, cue/action/state bit
strings, reward4 integer arrays, belief bit-pattern arrays, frame/projection
SHA256 arrays, actual filter and choice work, and total reward4. They use
a new schema; full Q fields are absent from both timed arms. The separate
old-runner audit is explicitly untimed. The two services cannot be presented
as identical to the old full-Q cost boundary.

For every row retain monotonic wall nanoseconds, process CPU nanoseconds
and current-thread allocated bytes, exact call/episode counts, start/end
timestamps, process/runtime/source identities, arguments, complete/failure,
and raw output hashes. Divide whole-episode totals by 64 and choice totals
by actual fixed call count when reporting per-unit figures. Do not infer
energy, resident memory or universal cost from these ledgers.

All measured wall/CPU/allocation totals, setup totals and GC generation
counts/deltas are integers in `[0,2^63-1]`, excluding JSON booleans.
Wall nanoseconds are strictly positive on every measured row; setup wall
and all CPU/allocation totals may be zero. Negative, nonfinite, fractional,
overflowed or missing measurements refuse. GC counts/deltas must remain
nonnegative; a negative delta cannot be repaired by taking its absolute
value. Retain actual zero compiled-allocation numerators without flooring
or imputation: with a positive native denominator the numeric ratio is
zero, still subject to independent matched-buffer/service and allocation
accounting conformance. A zero report does not waive the required real
buffer allocation or permit off-thread work.

One measuring thread performs the timed work; no tasks/threads may move
allocations out of its current-thread ledger. The raw buffer and ordinary
trace allocations stay timed. Fixed warmup outputs are retained separately
from measured outputs. No forced garbage collection, extra warmup,
replicate discard, retry replacement, changed tracing or changed operation
boundary follows observed cost. Record background activity and garbage
collection counts descriptively. Coordinate this team's builds/tests to
be idle during the whole cost phase, without claiming exclusive host control.

## H. Replay and decision rules

Independent replay uses a separately authored source simulator/renderer,
source mixer, filter and scalar arithmetic model, plus a certificate checker
that does not trust native pass flags. Reconstruct all 48 new hand episodes,
24 old hand controls, 222 scalar roster positions, 2,048 ordinary new
episodes and 1,024 old controls, 144 cost-input setup trajectories and all
1,440 whole-cost executions. Every ordinary/stress cost record is checked
in order against its tuple and actual expected path/work, including all
repeated passes; no summary-only or vacuous equality check.

The exact binary64 reference may memoize pure scalar outputs keyed by all
input bits/effect/depth and source/certificate identity while validating
every retained invocation record and total. This is an offline replay
optimization, never a measured strategy optimization. The certificate
remains universal over its arithmetic model; repeated scalar checking is
conformance/evidence validation, not the universal proof. Float differences
must not be hidden with a tolerance when exact action/bit equality is the
specified contract. No raw hidden state is used to choose an action.

The software binary64 model represents sign, exponent and significand,
including both zeros and subnormals. It preserves signed-zero results and
rounding-to-zero signs for each elementary operation, exact halfway
nearest/even behavior, underflow and the pinned maximum/selector behavior.
Mapping both zeros to an unsigned `Fraction(0)` is insufficient. Exact
rationals may supply magnitudes only alongside explicit sign/format state.
Retain bit-level hand witnesses for zero addition/subtraction,
multiplication/division and underflow, as well as both signed-zero policy
inputs. Float comparisons use the admitted numerical semantics while raw
records retain their distinct bits.

Replay records the SHA256 and length of the exact complete native hand,
certificate, graph/admission, behavior, cost and setup envelopes it reads,
in addition to each raw artifact they reference. It rejects altered
envelope metadata even if trace arrays are unchanged. The verdict binds
those exact native input bytes plus the exact replay envelope/artifacts,
recomputes their hashes and decision conditions, and rejects substitution.
Native admission, behavior and cost envelopes must agree on the admitted
implementation/protocol/certificate identities, native runtime/settings,
managed artifacts and declared native-image roster. Replay records those
same admitted native identities and its own separately identified Python
runtime; it does not pretend the two runtimes are identical.

Cost admission binds the complete behavior envelope read in prelude stage
one, before any cost-process policy execution. Require behavior completion
and successful process exit before cost startup, followed by the recorded
closed-file/read sequence and admission; all cost rows follow their
recorded prelude. Replay/verdict also validate this cross-phase chronology.
Bind the actual executing CLI, native entry point and loaded Python task
modules to the admitted source/artifact paths. A command or imported task
module from another checkout refuses even if its self-reported manifest
copies the expected identities.

Exact action equality, native-versus-compiled belief bits, semantic traces,
hashes, source/certificate/runtime admission, correct counters and every
falsifier are mandatory before any speed claim. Independent software
binary64 evaluation checks the numerical scalar contract; discrepancies
refuse the admitted-runtime claim rather than silently switching to a
different rounding target. Proof gaps or source drift remain failures
even if every finite test happens to agree.

For each ordinary choice-only panel separately, compute compiled/native
ratios of the medians of the five row wall totals and of the five row
allocation totals. Both ratios must be at most `0.5` on both panels to
earn the registered ordinary choice-cost claim. Require positive finite
native wall and allocation median denominators and the complete fixed row
roster. A zero required native allocation median refuses that cost claim.
Compute the five-row medians as exact integer order statistics and test
the required ratio by `2*compiled_median<=native_median` using unbounded
integer arithmetic. Retain exact numerator/denominator pairs. No pooling, median of
ratios, selected replicates or threshold relaxation is permitted. CPU,
whole-episode and stress ratios are descriptive, reported regardless of
outcome with all rows and fast/fallback counts.

For every descriptive ratio, a zero native CPU denominator produces
`null` with reason `zero-native-cpu`; a zero native allocation denominator
produces `null` with reason `zero-native-allocation`. Never fabricate zero
or infinity for division by zero. A zero numerator over a positive
denominator produces the actual ratio zero. Exact rational pairs are the
primary derived values; any displayed floating conversion must be finite
or be `null` with an explicit conversion reason. A descriptive missing
ratio does not weaken positive-wall or required allocation-denominator
admission and does not create a division exception.

If equivalence/certificate admission passes but the cost condition fails,
report an action-equivalent implementation without the registered speed
claim. If equivalence/admission fails, report the first failed attempt and
do not promote aggregate agreement or costs. Any measured improvement is
bounded to the supplied controller, matched new output contract, admitted
runtime and declared input roster. It neither proves the original search
necessary nor establishes general efficient compilation.

## I. Freeze, strict receipts, failure retention and publication

After complete review, freeze this exact protocol under
`archive/experiments/081M1XXWTTF087G0R000X1HMD0-registration` before any
compiled implementation, guard-bit computation or source generation.
The tag must be annotated, remotely verified and never moved. New native
and independent reference/certificate/replay/verdict implementation follows
only after that and after the old study's main integration. Hand and
certificate construction are allowed during implementation; all declared
new behavior/cost streams remain untouched until source freeze.

Preserve the complete reviewed source manifest, native/reference hand
outputs, guard/certificate evidence, runtime configuration and tests under
`archive/experiments/081M1XXWTTF087G0R000X1HMD0-implementation` before
behavior/cost generation. Freeze a finite enumerated dependency manifest:
all task source files and their direct repository helpers for the runner,
source, filter, policy, renderer, arithmetic, records, checker, replay and
verdict; the executing CLI/entry point and build wiring; declared managed
module files with SHA256/MVID; the dotnet host/runtime/JIT and Python
interpreter identities; the Python task-module/direct-helper import paths;
and the declared observed native-image/runtime-artifact roster with its
collection method. Every listed file has an exact path and hash, and
admission rejects an unlisted task module or helper rather than assuming
an unspecified dependency closure was checked. Pin old
dependency bytes against the archived old study and new bytes against the
new full source commit. Record fresh build evidence and loaded artifacts
without calling hashes a source-to-binary proof.

Task logic may not use Reflection.Emit, dynamically generated task
assemblies, dynamic native plugins or unlisted native calls. The compiled
measurement entry point and all task-managed modules are file-backed and
bound. JIT-generated machine code is explicitly the inspected conditional
runtime boundary in section C, not an immutable source artifact. Any
framework-generated dynamic method/image must be identified in the declared
runtime record and its role/collector limits disclosed; unexpected dynamic
task code refuses. Record managed/native loaded-image rosters before and
after each phase against the reviewed allowed roster. Unlisted loads that
can execute task logic refuse. Standard library, system native libraries,
kernel, loader and hardware remain the declared runtime/OS trust boundary;
record their available binary/OS identities and collection limitations.
This is not a full transitive source/toolchain or operating-system proof,
and it does not establish that all runtime code was formally verified.

Each envelope has schema/version, attempt ID, complete/failure, protocol
hash, resolved archive commits, full source/loaded-artifact identities,
arguments, runtime/environment, exact roster and hashes of lossless raw
artifacts. Strictly reject duplicate keys, extra/missing fields, booleans
where integers are required, nonfinite numbers, invalid bit strings or
paths, reordered/truncated/duplicate rows and changed hashes. Validate
actual files against the archived commit, not merely the live checkout.
Write exclusively to a new attempt directory; refuse overwrite and retain
partial output after failure. Record failure stage/panel/row/episode/call
and every already-admitted input/hash and completed output prefix.

Run phases are native behavior and untimed controls, native fixed costs,
independent replay, independently recomputed verdict, then publication.
Retain the first failed attempts and original source identities. A broken
version cannot be repaired by moving tags, silently replacing inputs,
rerunning a chosen row or changing the target. Any corrected version gets
a separately reviewed archive/registration disposition before new data.
There is no retry budget for replacement behavioral/cost measurements.

Index raw behavior, both cost modes, stress, replay, verdict, failure and
review from this task's durable research/work-item surfaces; publish with
required repository/PR gates and full attribution. Release the new claim
in the final PR. This draft remains unfrozen until the accepted review
record explicitly replaces its draft status.

## Prefreeze review history

Original complete draft `9c54bec7407edd19f3c5f0494d55a19f78dd7709` remains
preserved. The next revision closes the fresh-cost-process/prelude and
strategy-only rotation schedule; makes numeric/zero-denominator handling
total; specifies complete ordered alpha reconstruction and signed-zero
software arithmetic; enumerates the bounded source/runtime dependency
surface; and binds replay/verdict to exact envelope bytes and cross-phase
identities. These are prefreeze clarifications, not changes informed by
guard computation, implementation, generated tapes or measurements.

The final bounded review of `14786d2ae10c761eb2c51695c142da88408b3b6f`
accepted those closures and required two execution-order clarifications:
the coordinator waits for successful behavior exit and closed output,
then the fresh cost process admits that envelope before policy execution;
and each setup stage starts its counters before its work, including actual
archive/certificate validation. These changes preserve every declared
corpus, count, action contract and threshold. No implementation, guard
bits, source generation or measurement informed the correction.
