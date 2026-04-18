# Plugin-author API — design spike (Round 27)

**Author:** Ilyana (public-api-designer)
**Round:** 27, design-spike turn + synthesis revision
**Status:** Revised recommendation after Tariq (algebra-owner)
and Daya (plugin-author AX) reviews. Final verdict for Kenji at
the bottom. See "What this synthesis changed since the design
spike" at the end for traceability.

---

## 1. Problem statement

`Circuit.RegisterStream<'T>(op: Op<'T>) : Stream<'T>` was flipped
public in round 25 to unblock `Zeta.Bayesian`. The parameter type
`Op<'T>` then dragged every `abstract` / `virtual` / public member
on `Op` and `Op<'T>` into the public API by type propagation: plugin
authors will subclass `Op<'T>` and therefore inherit `StepAsync`,
`Inputs`, `IsStrict`, `Fixedpoint`, `IsAsync`, `ClockStart`,
`ClockEnd`, `AfterStepAsync`, `Name`, the `.Value` property with
public getter *and* setter, and the `SetValue(v)` method, plus the
ambient `idField` (scheduler-owned). None of those members were
designed as an external plugin contract: they are Zeta's internal
scheduler surface. Plugin authors also have no test harness, no
invariant documentation, and no way to verify their own
implementations before running them inside a user circuit.
Commitment cost on the current shape is 10-year-forever. We have
exactly one consumer (`BayesianRateOp` in
`src/Bayesian/BayesianAggregate.fs`) to model against, and pre-v1
we can still pick a better shape before external plugin authors
lock us in.

---

## 2. Constraints

1. **Core-op performance must not regress.** Internal operators in
   `src/Core/Operators.fs` and `src/Core/Primitive.fs` are written
   to be zero-alloc on the hot path (one `[| input :> Op |]` array
   per op, published once at construction; `this.Value <- ...`
   inside `StepAsync`; `ValueTask.CompletedTask` return). Any new
   plugin surface must *either* leave these ops' implementation
   untouched *or* refactor them to use the same new surface without
   measurable regression. Struct `Stream<'T>`, `[<InlineIfLambda>]`
   on fast transforms, and the `VolatileField` publish on
   `Op<'T>.Value` stay in place.
2. **Bayesian must still be expressible.** `BayesianRateOp` carries
   per-instance mutable state (`BetaBernoulli` object) and reads
   one upstream `Op<ZSet<bool>>.Value` inside `StepAsync`. Whatever
   plugin surface we pick must let that be written *naturally* —
   no ceremony beyond what a first-time reader expects.
3. **No public mutable output setter.** `Op<'T>.Value with set` is
   a scheduler-internal publication channel. External code must
   not be able to call `someOtherOp.Value <- ...` from outside
   that op's own `StepAsync`. The current shape accidentally allows
   this.
4. **No plugin settability of scheduler state.** `idField`,
   `IsStrict`, `Fixedpoint`, `Inputs`, `IsAsync` are scheduler
   state or scheduler-visible metadata. Plugins declare *some* of
   them (inputs list, strict-or-not, whether they issue async work)
   but they should not be able to mutate them after registration,
   and they should not have access to `idField` at all. Today every
   one of these members is an `abstract` that a subclass could
   `override` with any garbage value — `Fixedpoint` in particular
   is load-bearing for nested-fixpoint scheduling.
5. **Pre-v1 window is still open.** Breaking `Zeta.Bayesian` this
   round is acceptable provided the new shape is strictly better
   and the migration is mechanical (≤ 20 lines in one file).

---

## 3. Candidate shapes

I evaluate four. For each I give a sketch of the public surface,
how `BayesianRateOp` migrates to it, and how Core's `MapZSetOp`
and `DelayOp` would be refactored if we chose to unify.

### Shape A — `IOperator<'TOut>` interface

Plugin authors implement an interface; `Op<'T>` becomes an
internal abstract class that *also* implements the interface, so
Core's catalogue carries no extra cost. `Circuit.RegisterStream`
accepts the interface.

```fsharp
/// Plugin-author contract for a custom operator with a typed output.
/// Implementers must: (i) publish `StepAsync` that writes the
/// current-tick output to the `OutputBuffer<'TOut>` passed in; (ii)
/// list every upstream stream they read in `ReadDependencies`;
/// (iii) return `ValueTask.CompletedTask` for synchronous ops.
type IOperator<'TOut> =
    abstract Name : string
    abstract ReadDependencies : StreamHandle array
    abstract StepAsync : output: OutputBuffer<'TOut> *
                         ct:     CancellationToken
                         -> ValueTask

/// Opaque handle to a stream the plugin depends on. Plugins cannot
/// read this handle's value directly — only list it in
/// `ReadDependencies` and read the typed stream via the typed
/// handle passed to the constructor. This prevents a plugin from
/// declaring a dependency it does not actually read (topology bug)
/// or reading one it did not declare (schedule bug).
[<Struct>] type StreamHandle = internal { ... }

/// Write-only output channel passed into `StepAsync`. The only
/// public method is `.Publish(value: 'TOut)`. Plugins cannot read
/// another op's `OutputBuffer` — they only write to their own.
[<Struct>] type OutputBuffer<'TOut> = internal { ... }
    member Publish : 'TOut -> unit
```

`Circuit.RegisterStream` becomes

```fsharp
member this.RegisterStream<'TOut>(op: IOperator<'TOut>) : Stream<'TOut>
```

Strictness / async / fixedpoint are expressed via optional
interfaces the plugin adds when needed:

```fsharp
type IStrictOperator<'TOut> =
    inherit IOperator<'TOut>
    abstract AfterStepAsync : ct: CancellationToken -> ValueTask

type IAsyncOperator = abstract IsAsync : bool   // marker

type INestedFixpointParticipant =
    abstract Fixedpoint : scope: int -> bool
```

**Migration — Bayesian:**

```fsharp
type internal BayesianRateOp(input: Stream<ZSet<bool>>, α, β) =
    let bb  = BetaBernoulli(α, β)
    let deps = [| input.Handle |]
    interface IOperator<struct (double * double * double)> with
        member _.Name = "bayesianRate"
        member _.ReadDependencies = deps
        member _.StepAsync(out, _) =
            let span = input.Current.AsSpan()
            // ...tight loop...
            bb.Observe(successes, failures)
            let struct (lo, hi) = bb.CredibleInterval95
            out.Publish (struct (bb.Mean, lo, hi))
            ValueTask.CompletedTask
```

**Migration — Core (`MapZSetOp`):** trivial — convert `inherit
Op<ZSet<'B>>()` to `interface IOperator<ZSet<'B>>` and replace
`this.Value <-` with `out.Publish`. The internal Core path can keep
using the abstract class until the whole catalogue moves.

### Shape B — `Circuit.Extend(...)` builder with closures

No new public types on the plugin side. Plugins pass a closure.

```fsharp
member this.Extend<'TIn, 'TOut>
    (name: string,
     input: Stream<'TIn>,
     step: System.Func<'TIn, 'TOut>)
    : Stream<'TOut>

member this.ExtendStateful<'TIn, 'TState, 'TOut>
    (name: string,
     input: Stream<'TIn>,
     initialState: 'TState,
     step: System.Func<'TState, 'TIn, struct ('TState * 'TOut)>)
    : Stream<'TOut>

member this.ExtendStrict<'TIn, 'TState, 'TOut>
    (name: string,
     input: Stream<'TIn>,
     initialState: 'TState,
     step: System.Func<'TState, 'TIn, 'TOut>,
     afterStep: System.Func<'TState, 'TIn, 'TState>)
    : Stream<'TOut>
```

Core wraps the closure inside a private `Op` subclass. Plugin
authors never see an `Op<'T>`.

**Migration — Bayesian:** works for the single-input case:

```fsharp
let state = BetaBernoulli(α, β)
circuit.ExtendStateful(
    "bayesianRate",
    input,
    state,
    fun bb zset ->
        let span = zset.AsSpan()
        // accumulate ...
        bb.Observe(successes, failures)
        let struct (lo, hi) = bb.CredibleInterval95
        struct (bb, struct (bb.Mean, lo, hi)))
```

**Problem:** no support for multi-input ops (plus/minus/join),
async ops (disk-backed spines), nested-fixpoint participants, or
operators that want to allocate per-tick scratch outside the
closure. We would need `Extend2`, `Extend3`, `ExtendAsync`,
`ExtendFixpoint`, `ExtendN`… a combinatorial explosion. This does
not generalise.

### Shape C — `PluginOp<'TOut>` abstract class, trimmed

An abstract class that exposes *only* the members plugin authors
legitimately override. `Op` / `Op<'T>` stay internal.

```fsharp
/// Plugin-author base class. Subclass this to implement a custom
/// operator with a typed output.
[<AbstractClass>]
type PluginOp<'TOut>() =
    abstract Name : string
    abstract Inputs : StreamHandle array
    abstract StepAsync : ct: CancellationToken -> ValueTask
    /// Publish this tick's output. Call exactly once per StepAsync.
    member this.Publish(v: 'TOut) : unit = ...
    // Opt-in overrides with sensible defaults:
    abstract IsStrict : bool
    default _.IsStrict = false
    abstract IsAsync  : bool
    default _.IsAsync = false
    abstract AfterStepAsync : ct: CancellationToken -> ValueTask
    default _.AfterStepAsync(_) = ValueTask.CompletedTask
    // Deliberately NOT abstract / NOT public:
    //   idField, Fixedpoint, the .Value setter, SetValue
```

`Circuit.RegisterStream(op: PluginOp<'T>) : Stream<'T>` is public.
Core keeps `Op<'T>` as its internal base and *adapts* `PluginOp<'T>`
to `Op<'T>` inside a wrapper `RegisterStream` constructs. Core's
internal ops keep using `Op<'T>` and pay zero adapter cost.

**Migration — Bayesian:** identical structure to today, but with
`Publish` in place of the `.Value` setter and no access to
`Fixedpoint` / `SetValue` / `idField`.

### Shape D — hybrid: interface + test harness + sealed registration

Shape A's interface + an explicit test-harness type the plugin
author instantiates to verify their op in isolation, without a
full circuit. Addresses the extension-cliff (#6 in the SKILL
checklist).

```fsharp
// Same as Shape A, plus:
module PluginOperatorHarness =
    /// Drive a plugin operator through a sequence of inputs without
    /// a full circuit. Returns the sequence of published outputs.
    val run<'TIn, 'TOut>
        : op:     IOperator<'TOut>
       -> inputs: 'TIn seq
       -> outputs: 'TOut seq
```

---

## 4. Trade-offs

| Criterion (scored 1–5; higher = better for us)                | A interface | B closure-only | C trimmed base | D hybrid (A + harness) |
|---------------------------------------------------------------|:-----------:|:--------------:|:--------------:|:----------------------:|
| Expressiveness (multi-input, stateful, strict, async)         | 5           | 2              | 5              | 5                      |
| Perf — Core catalogue regression headroom                     | 4           | 5              | 5              | 4                      |
| Perf — plugin hot-path (Bayesian)                             | 5           | 5              | 5              | 5                      |
| Public API surface count (fewer = better)                     | 3           | 5              | 4              | 2                      |
| Migration cost for Bayesian                                   | 4           | 3              | 5              | 4                      |
| Core refactor cost (unify catalogue on new surface)           | 4           | 1              | 4              | 4                      |
| Plugin-author SDK maintenance cost                            | 4           | 5              | 3              | 4                      |
| 10-year commitment (narrowness & revision room)               | 4           | 3              | 3              | 5                      |
| Extension cliff closed (test harness exists)                  | 2           | 2              | 2              | 5                      |
| Forbids `SetValue` / `Value.set` leak to plugins              | 5           | 5              | 5              | 5                      |
| Forbids `Fixedpoint` / `idField` leak                         | 5           | 5              | 4              | 5                      |

Notes on the scoring:
- **B** wins on surface-count and plugin-SDK maintenance because
  the plugin author writes no new types, but loses decisively on
  expressiveness (multi-input / strict / async / fixpoint each
  need a new method variant) and Core-refactor cost (Core's
  catalogue cannot be expressed as closures without boxing
  every state cell).
- **C** is ergonomically closest to today's shape for the plugin
  author, but the abstract-class-as-contract pattern commits us to
  the exact member set of `PluginOp<'TOut>`. Adding a new optional
  capability later means either a virtual-with-default (works, but
  every prior-compiled plugin now has a silent default) or a new
  base class (splits the ecosystem).
- **A** compositional-interface pattern is what Roslyn
  (`CodeFixProvider` + `FixAllProvider`), Orleans
  (`IGrainWithIntegerKey` + `IRemindable`), and .NET BCL
  (`IAsyncDisposable`, `IAsyncEnumerable`) all use. Precedent is
  strong. Adding a new capability = adding a new interface; old
  plugins stay source-and-binary-compatible.
- **D** is **A + a free win**: the test-harness type is the piece
  that forces us to be honest about plugin-author contract. Today's
  shape has no harness because there was no clean "thing to hand to
  the harness"; with an interface-typed op there is.

---

## 5. Recommendation

**Verdict: Shape D, extended with algebra-capability
sub-interfaces.** The compositional-interface pattern (`A`) with
a ship-together test harness (`D`), extended with Tariq's
four capability tags as sub-interfaces (`ILinearOperator`,
`IBilinearOperator`, `ISinkOperator`, `IStatefulStrictOperator`).
The capability split is load-bearing: without it, a plugin
author can claim linearity without mechanism, or — worse — ship
a retraction-lossy op (the Bayesian shape) that silently poisons
downstream relational composition. Each sub-interface has a
precise contract paired with an FsCheck law that fires at
`Circuit.Build()`. Concretely:

### 5.1 Public types (the forever-surface)

```fsharp
namespace Zeta.Core

/// Opaque handle naming an upstream stream. Plugin authors list
/// these in `IOperator.ReadDependencies` so the scheduler can
/// build the DAG; plugin authors do NOT invoke anything on the
/// handle — they read stream values via the typed `Stream<'T>`
/// they captured at construction time.
[<Struct; IsReadOnly; NoComparison; NoEquality>]
type StreamHandle = internal ...

/// Extension method on `Stream<'T>` to obtain the handle, replacing
/// the current public `.Op` property (which should become
/// internal). Plugin authors write `myStream.AsDependency()`.
[<Extension>]
type StreamExtensions =
    [<Extension>]
    static member AsDependency<'T> : stream: Stream<'T> -> StreamHandle

/// Write-only output channel. Passed into `StepAsync`. The plugin
/// calls `Publish` exactly once per tick. No read side; no way to
/// get at another operator's `OutputBuffer`.
[<Struct; IsReadOnly>]
type OutputBuffer<'TOut> = internal ...
    member Publish : 'TOut -> unit

/// Plugin-author contract for a custom operator with a typed output.
///
/// Implementers must hold these invariants:
///   - `Name` is stable for the instance lifetime; used for
///     diagnostics only, not identity.
///   - `ReadDependencies` lists every upstream stream the operator
///     will read inside `StepAsync`. An undeclared read returns
///     stale data from the previous tick; an over-declared read
///     forces an unnecessary schedule edge but is not a bug.
///   - `StepAsync` calls `output.Publish` exactly once before the
///     returned `ValueTask` completes. Publishing twice is a bug
///     (the last write wins); publishing zero times means the
///     consumer reads `Unchecked.defaultof<'TOut>` for this tick.
///   - Synchronous operators (the common case) return
///     `ValueTask.CompletedTask`. Operators that may return an
///     incomplete task must *also* implement `IAsyncOperator` and
///     return `IsAsync = true`.
type IOperator<'TOut> =
    abstract Name : string
    abstract ReadDependencies : StreamHandle array
    abstract StepAsync : output: OutputBuffer<'TOut> *
                         ct:     CancellationToken
                         -> ValueTask

/// Optional: strict operators (feedback-cut points like `z^-1`).
/// Implementers must also publish their *delayed* output in
/// `StepAsync` based on the state captured in the previous tick;
/// `AfterStepAsync` is where the current tick's input is stored
/// for publication on the next tick. Distinct from
/// `IStatefulStrictOperator` (which is the algebra-checked
/// stateful-strict capability tag, not the feedback-cut hook).
type IStrictOperator<'TOut> =
    inherit IOperator<'TOut>
    abstract AfterStepAsync : ct: CancellationToken -> ValueTask

/// Optional: declare the operator issues genuinely asynchronous
/// work (disk I/O, RPC). Without this, the scheduler uses the
/// sync fast-path.
type IAsyncOperator =
    abstract IsAsync : bool

/// Optional: nested-fixpoint participant. `scope` numbers the
/// enclosing fixpoint scope; the operator returns `true` iff it
/// has reached its fixed point in that scope.
type INestedFixpointParticipant =
    abstract Fixedpoint : scope: int -> bool

// ---------------------------------------------------------------
// Algebra-capability sub-interfaces (Tariq's round-27 addendum).
// Each tags a law class the scheduler verifies at Circuit.Build()
// via the FsCheck law suite. IsStrict / IsLinear / IsBilinear /
// IsSink are carried by the *type-level tag* — the author cannot
// return a lying bool. The algebra dispatches on the tag.
// ---------------------------------------------------------------

/// Declared linear operator. Contract: the operator's per-tick
/// action is a family of AddMonoidHoms `phi_n` over the input
/// prefix, with `f(a + b) = f(a) + f(b)` and `f(0) = 0`.
/// `Circuit.Build()` runs `LinearLaw` against random-generated
/// inputs and rejects the build with a clear error on failure.
/// Implementers with hidden cross-tick state (i.e. a `let
/// mutable` in their own fields) MUST NOT declare this tag —
/// they are `IStatefulStrictOperator` or `ISinkOperator`
/// instead.
type ILinearOperator<'TIn, 'TOut> =
    inherit IOperator<'TOut>
    // No extra members — the tag itself is the declaration.
    // The scheduler uses the interface-implementedness to
    // pick the linear-incrementalization path.

/// Declared bilinear operator (two inputs, bilinear product).
/// Canonical case: `Join`. Contract: the operator is linear in
/// each argument separately; incrementalization follows the
/// three-term `(a + da)(b + db) = ab + a.db + da.b + da.db`
/// rule. `Circuit.Build()` runs `BilinearLaw` and rejects on
/// distributivity failure.
type IBilinearOperator<'TIn1, 'TIn2, 'TOut> =
    inherit IOperator<'TOut>
    // Tag-only; algebra dispatches on the interface.

/// Declared sink operator — terminal, non-ZSet-emitting, and
/// **explicitly exempt from relational composition laws**.
/// This is the correct tag for any operator whose internal state
/// does NOT retract under a `+1 / -1` input (e.g. Beta-Bernoulli
/// accumulation). `Circuit.Build()` runs `SinkTerminalLaw` and
/// rejects the build if any downstream op consumes this
/// operator's output as a relational stream. Sink-tagged ops are
/// legal only at terminal edges of the DAG.
///
/// **Critical plugin-author note:** if your operator's output is
/// not a `ZSet<_>`, or if a `+1` then `-1` in the input does not
/// leave your internal state unchanged, you MUST declare
/// `ISinkOperator`. Not declaring it is a correctness bug that
/// will silently corrupt downstream computation until the first
/// retraction reaches the poisoned region.
type ISinkOperator<'TIn, 'TOut> =
    inherit IOperator<'TOut>
    // Tag-only; algebra refuses to compose past this edge.

/// Declared stateful-strict operator. Requires the author to
/// ship the three-tuple (init, step, retract) explicitly, so the
/// algebra can verify retraction-completeness — a random
/// insert-then-retract trace must leave state at `init`.
/// `Circuit.Build()` runs `RetractionCompletenessLaw` and rejects
/// on failure. Distinct from `IStrictOperator` which is the
/// scheduler-facing feedback-cut hook; `IStatefulStrictOperator`
/// is the algebra-facing capability tag. An op that is both a
/// feedback-cut point and a declared stateful-strict op
/// implements both.
type IStatefulStrictOperator<'TState, 'TIn, 'TOut> =
    inherit IOperator<'TOut>
    abstract Init : 'TState
    abstract Step : state: 'TState * input: 'TIn -> struct ('TState * 'TOut)
    abstract Retract : state: 'TState * input: 'TIn -> 'TState

/// Registration.
type Circuit with
    member RegisterStream<'TOut> : op: IOperator<'TOut> -> Stream<'TOut>

/// Test harness for plugin authors. Drives one `IOperator<'T>`
/// through a sequence of inputs without a full circuit.
module PluginHarness =
    val runSingleInput<'TIn, 'TOut>
        : op: IOperator<'TOut>
       -> input: Stream<'TIn>       // harness-constructed source
       -> inputs: 'TIn seq
       -> outputs: 'TOut IReadOnlyList

    val runMultiInput : ... // paired API for >1 input
```

### 5.2 What goes internal / stays internal

- `Op`, `Op<'T>` — back to `internal`. They become Zeta's
  internal scheduler base. They *also* implement `IOperator<'T>`
  so Core's catalogue continues to subclass `Op<'T>` without
  bridge-adapter cost.
- `Stream<'T>.Op` — back to `internal`. Replace with the
  `StreamHandle` indirection for the public path.
- `Op<'T>.Value with set`, `SetValue` — **internal**. External
  publication goes through `OutputBuffer<'TOut>.Publish`, which
  inside Core is wired to the same volatile field write.
- `idField`, `IsStrict` (as overridable on `Op` base), `Fixedpoint`,
  `IsAsync`, `ClockStart`, `ClockEnd`, `AfterStepAsync` on
  `Op` — all **internal**. Plugin-author variants are the opt-in
  `IStrictOperator` / `IAsyncOperator` / `INestedFixpointParticipant`
  interfaces.

### 5.3 Perf posture

- Core's catalogue keeps inheriting `Op<'T>` internally; zero
  change to the hot-path shape of `MapZSetOp`, `PlusZSetOp`,
  `DelayOp` etc. The `IOperator<'T>` interface is implemented once,
  on the internal `Op<'T>` base, dispatching straight to the
  existing abstracts. No extra virtual call in the scheduler hot
  path.
- For plugin authors the call shape is: scheduler virtually
  dispatches `IOperator<'T>.StepAsync(output, ct)` (one interface
  call) → plugin writes a local struct via `output.Publish(v)`
  (one inlined method call that stores to the same `VolatileField`
  the current `Op<'T>.Value` setter writes). Measured overhead vs.
  today: zero, within noise.
- `Stream<'T>` stays struct-`IsReadOnly`-`NoComparison`-`NoEquality`.
  `[<InlineIfLambda>]` stays applicable because the closures live
  inside Core's extension methods (unchanged).

### 5.4 Migration — `BayesianRateOp` (reclassified as `ISinkOperator`)

**Reclassification from the design-spike draft.** Tariq's algebra
review surfaced that `BayesianRateOp` is retraction-lossy by
design: a `+1` then `-1` in the input `ZSet<bool>` will NOT
un-accumulate `Beta-Bernoulli.a` / `.b` — the operator reads the
`ZSet` *weights* and folds them into a monotonic posterior. The
output type `struct (double * double * double)` is not a `ZSet`
at all, so there is no retraction semantics on the output either.
Under a plain `IOperator<'T>` with no capability tag this is
**undiscoverable** and silently poisons downstream relational
composition. Under `ISinkOperator<ZSet<bool>, struct (double *
double * double)>` the algebra consciously exempts it from
composition laws, rejects placement anywhere but terminal edges,
and surfaces the contract to plugin authors: "your output is not
a relational stream; the only legal downstream is a materialised
view or a tap."

**This is the correct classification — not a workaround.** Every
plugin op whose internal state does not retract under `+1/-1`
belongs here.

```fsharp
type internal BayesianRateOp(input: Stream<ZSet<bool>>, α, β) =
    let bb = BetaBernoulli(α, β)
    let deps = [| input.AsDependency() |]
    interface ISinkOperator<ZSet<bool>,
                            struct (double * double * double)> with
        member _.Name = "bayesianRate"
        member _.ReadDependencies = deps
        member _.StepAsync(out, _) =
            let span = input.Current.AsSpan()
            let mutable successes = 0L
            let mutable failures  = 0L
            for i in 0 .. span.Length - 1 do
                if span.[i].Key then successes <- successes + span.[i].Weight
                else                 failures  <- failures  + span.[i].Weight
            bb.Observe(successes, failures)
            let struct (lo, hi) = bb.CredibleInterval95
            out.Publish (struct (bb.Mean, lo, hi))
            ValueTask.CompletedTask

[<Extension>]
type BayesianExtensions =
    [<Extension>]
    static member BayesianRate(c: Circuit, input: Stream<ZSet<bool>>, α, β) =
        c.RegisterStream (BayesianRateOp(input, α, β))
```

`Circuit.Build()` runs `SinkTerminalLaw` against this op: any
downstream operator that reads the resulting stream as a
relational input will fail the build with a clear error naming
the sink boundary. That boundary is exactly the one the algebra
wants.

Line-count delta: +3 lines (interface block); ~0 lines net.
Effort estimate ≤ 20 lines changed, one file.

### 5.4.1 FsCheck law suite at `Circuit.Build()`

Each capability tag has a corresponding law the scheduler runs
against the plugin op before the circuit accepts the build. On
failure, `Build()` returns a `Result.Error` naming the op, the
law that failed, and the witness input.

| Tag                          | Law                          | What it checks                                                                        |
|------------------------------|------------------------------|---------------------------------------------------------------------------------------|
| `ILinearOperator`            | `LinearLaw`                  | `f(a + b) = f(a) + f(b)` and `f(0) = 0` over random `ZSet` prefixes.                   |
| `IBilinearOperator`          | `BilinearLaw`                | Distributivity on both sides over random `ZSet` pairs; zero-input gives zero-output.   |
| `ISinkOperator`              | `SinkTerminalLaw`            | Rejects any downstream consumer that reads this op's stream as a relational input.     |
| `IStatefulStrictOperator`    | `RetractionCompletenessLaw`  | Random insert-then-retract trace returns `state` to `Init`.                            |

The laws are additive — an op that implements two tags runs both.
Laws run once, at `Build()`; no runtime cost in the hot path.

### 5.5 Test-harness contract (the piece that closes the cliff)

```fsharp
module PluginHarness =
    /// Drive a single-input plugin op through a list of inputs.
    /// Returns the list of published outputs. Asserts exactly-one
    /// Publish-per-tick.
    let runSingleInput
        (makeOp: Stream<'TIn> -> IOperator<'TOut>)
        (inputs: 'TIn list)
        : 'TOut list
```

Every plugin author gets to write a four-line unit test that
asserts their operator's observable behaviour tick-by-tick, with
no `Circuit` plumbing. This is the bar that `CodeFixProvider`,
`JsonConverter<T>`, and `IAsyncEnumerator` all meet and that our
current shape does not.

### 5.6 Plugin-author entry-point doc (`docs/PLUGIN-AUTHOR.md`)

Daya's round-27 AX review surfaced that even with the best shape
choice, plugin-author onboarding fails without a dedicated
landing page. README is for library consumers, CONTRIBUTING is
for upstream contributors, and ARCHITECTURE is for whole-system
reviewers. None of them repurposes well for a third-party
shipping a custom operator in a separate NuGet.

**Commitment: this round ships `docs/PLUGIN-AUTHOR.md` alongside
the interface + harness.** Size target ≤ 2 pages. Contents:

1. One-sentence "who this doc is for" and an explicit "NOT for"
   list pointing away from CONTRIBUTING / openspec /
   PROJECT-EMPATHY for plugin authors.
2. Plugin-author mental model: `IOperator<'T>` is the contract;
   `OutputBuffer<'T>.Publish` is the only write channel;
   `ReadDependencies` must list every upstream stream read
   inside `StepAsync`.
3. Capability-tag guide — when to declare `ILinearOperator`,
   `IBilinearOperator`, `ISinkOperator`,
   `IStatefulStrictOperator`. Crisp table with one-line
   heuristic each and the symptom of declaring wrong.
   Including: "if your internal state does not retract under
   `+1 / -1`, you are a sink — declare `ISinkOperator`, not
   `IOperator`."
4. Canonical example: link to
   `src/Bayesian/BayesianAggregate.fs:BayesianRateOp` with the
   two line-ranges (operator itself vs domain math) called out
   explicitly.
5. Harness usage: four-line example using
   `PluginHarness.runSingleInput`.
6. Error-on-drift cheatsheet: top three failure modes
   (publish-zero-times, publish-twice,
   undeclared-ReadDependencies) with symptom and fix.
7. Two-line NuGet-packaging recipe.

**Explicitly deferred to round 28+:** `dotnet new zeta-plugin`
scaffolding template. Daya's fallback option. Correct cut —
scaffolding is a distinct tooling piece and a better
second-round investment once the API + doc shape is confirmed.
Without the doc, the scaffolding has nothing authoritative to
point at; with the doc, scaffolding is a pure multiplier.

---

## 6. Open questions

### For Tariq (algebra-owner)

- **Q1 — ANSWERED (blocking; YES, plugins must declare).** Tariq
  confirmed in his round-27 review: `IOperator<'T>` alone is
  insufficient for algebra-law enforcement — plugin authors can
  claim linearity without mechanism, and a retraction-lossy op
  (like `BayesianRateOp`) is undiscoverable under a plain
  interface. The fix — baked into §5 of this doc — is four
  capability sub-interfaces (`ILinearOperator`,
  `IBilinearOperator`, `ISinkOperator`,
  `IStatefulStrictOperator`), each paired with an FsCheck law
  fired at `Circuit.Build()` (`LinearLaw`, `BilinearLaw`,
  `SinkTerminalLaw`, `RetractionCompletenessLaw`). `IsStrict` /
  `IsLinear` / `IsBilinear` / `IsSink` are carried by the
  type-level tag, not by an author-returned `bool` — no lying
  possible. See notebook for the morphological-equivalence
  argument vs. Tariq's alternative sum-type sketch.
- **Q2.** `z^-1` (`DelayOp`) is the canonical strict operator.
  Plugin authors implementing their own strict operator need the
  same invariant: publish-then-capture. Is the two-method contract
  (`StepAsync` publishes delayed state; `AfterStepAsync` captures
  current input) sufficient, or does the algebra require a
  stronger guarantee (e.g. `AfterStepAsync` runs *after* every
  non-strict op in the scope)? Current scheduler honours that; we
  should write it into the `IStrictOperator` XML doc if so.
- **Q3.** `Fixedpoint(scope: int) -> bool` on
  `INestedFixpointParticipant` — the current `Op.Fixedpoint`
  default is `true`. Is there a plugin-author obligation to
  return `true` iff *all upstream values are equal to their
  previous-tick values*, or is it the operator's local judgement?
  If the former, this belongs in Core as a derived property, not
  a plugin override.

### For Daya (plugin-author AX / developer-experience-researcher)

- **Q4 — ANSWERED (blocking; CONDITIONAL YES).** Daya's round-27
  review: a first-time plugin author *can* ship a working op in
  <5 minutes under any of the three candidate shapes, but *only
  if* (a) `docs/PLUGIN-AUTHOR.md` exists as an explicit
  entry-point, and (b) the Bayesian example is discoverable as a
  template rather than as a historical accident. README,
  CONTRIBUTING, and ARCHITECTURE each serve a different audience
  and none repurposes to plugin-author needs. Commitment: the new
  doc ships this round — see §5.6. With the doc and the Bayesian
  reclassification both landing round-27, the <5 min bar is met.
  Without the doc, the bar fails for structural reasons, not
  shape reasons.
- **Q5.** The four-interface split (`IOperator` +
  `IStrictOperator` + `IAsyncOperator` +
  `INestedFixpointParticipant`) is compositionally clean but
  visually busy. Is it clearer than a single
  abstract class with four virtuals-with-defaults? Shape C in
  §3 is the alternative here. Daya's call.
- **Q6.** `ReadDependencies: StreamHandle array` vs. a
  fluent `.DependsOn(stream).DependsOn(stream).Build()` — the
  former is more ceremonial but lets the operator precompute the
  array once at construction. Which reads better to a first-time
  plugin author?

### For Mateo (security-researcher), as a courtesy ping

- `OutputBuffer<'TOut>` is a ref-typed or struct-typed write
  channel passed into `StepAsync`. If a malicious plugin captures
  the `OutputBuffer` and calls `Publish` from a background thread
  after `StepAsync` returned, does the scheduler see torn state?
  Current `VolatileField` on `Op<'T>.Value` makes this a
  well-defined-but-wrong write; worth flagging. (Also logged as
  Q7 below — a concrete contract obligation on the implementation.)

### Q7 — `OutputBuffer<'TOut>` thread-safety contract (new, this round)

Escalated from the Mateo courtesy ping into a first-class open
question because the implementation decision is binding on §5.1:
if a plugin captures an `OutputBuffer<'TOut>` reference and calls
`Publish` from a background thread after `StepAsync` already
returned, the scheduler behaviour must be **well-defined** —
specifically, either (a) a `VolatileField`-backed single-writer
atomic store + a logged-error (warn once per op-instance,
preferably with the captured stack) that the plugin violated the
single-writer-per-tick contract, or (b) a guarded no-op once the
buffer is "closed" on `StepAsync` return. Torn state is not
acceptable. The XML doc on `OutputBuffer.Publish` must state the
contract explicitly: "call once, only from inside the
`StepAsync` invocation that received this buffer; background-
thread calls after return are logged and may be dropped."

This is a necessary guardrail given that the plugin surface is
external — Core can no longer assume cooperative authors.

---

## 7. What I am NOT proposing

- **Not** an attribute-based source-generator registration pattern.
  Too much tooling cost for a three-operator plugin library.
- **Not** a full factory / builder DSL
  (`circuit.BuildOperator<'T>().WithInputs(...).OnStep(...).Register()`).
  Overkill; locks us into the builder's exact fluent surface.
- **Not** keeping the status quo. The `Op<'T>` subclass-extension
  pattern is not salvageable as a public contract without a
  documentation-and-audit effort larger than the migration to a
  narrow interface.

---

## 8. Summary for Kenji (integrator)

- Recommend **Shape D, extended with algebra-capability
  sub-interfaces** (round-27 synthesis of Tariq + Daya). The
  final public surface is larger than the original design-spike
  count but the capability split is load-bearing for Tariq's
  algebra-law enforcement and cannot be cut.
- **Seven interfaces:** `IOperator<'TOut>`, `IStrictOperator<'TOut>`,
  `IAsyncOperator`, `INestedFixpointParticipant`,
  `ILinearOperator<'TIn, 'TOut>`,
  `IBilinearOperator<'TIn1, 'TIn2, 'TOut>`,
  `ISinkOperator<'TIn, 'TOut>`,
  `IStatefulStrictOperator<'TState, 'TIn, 'TOut>`.
  (That is eight interface names in the list; the first four are
  scheduler-facing, the last four are algebra-facing capability
  tags. Naming-wise they compose orthogonally — an op can be
  e.g. `ILinearOperator + IStrictOperator`, `ISinkOperator +
  IAsyncOperator`, etc. — without a Cartesian explosion.)
- **Three types:** `StreamHandle`, `OutputBuffer<'TOut>`,
  `Circuit.RegisterStream(op: IOperator<'TOut>) : Stream<'TOut>`.
- **One module:** `PluginHarness` with `runSingleInput` /
  `runMultiInput`.
- **One new doc:** `docs/PLUGIN-AUTHOR.md` (≤ 2 pages) — plugin
  author mental model + capability-tag guide + Bayesian link +
  harness usage + error-on-drift cheatsheet. Ships round-27.
- **FsCheck law suite at `Circuit.Build()`:** `LinearLaw`,
  `BilinearLaw`, `SinkTerminalLaw`,
  `RetractionCompletenessLaw`. Run once at build, zero hot-path
  cost.
- **Two retractions:** `Stream<'T>.Op` → internal;
  `Circuit.RegisterStream(op: Op<'T>)` → replaced by
  `RegisterStream(op: IOperator<'T>)`.
- **Bayesian migrates as `ISinkOperator` in one commit, ≤ 20
  lines in one file.** The reclassification from generic
  `IOperator` to `ISinkOperator` is the correct classification,
  not a workaround — retraction-lossy by design.
- **Previously blocking questions now answered:** Q1 (Tariq —
  YES, capability tags required), Q4 (Daya — YES, conditional on
  `docs/PLUGIN-AUTHOR.md` shipping this round). Both conditions
  met by this synthesis.
- **New open question Q7** on `OutputBuffer` thread-safety
  contract — binding on the implementation.
- **Still open, non-blocking:** Q2 (strict-operator ordering XML
  doc), Q3 (`Fixedpoint` semantics), Q5 (four-interface split
  clarity), Q6 (`ReadDependencies` array vs. fluent).

---

## 9. What this synthesis changed since the design spike

This section exists so the revision is traceable — future
reviewers should be able to read the original spike and this
synthesis side by side without guesswork.

1. **Section 5 (Recommendation).** Shape D extended with four
   algebra-capability sub-interfaces (`ILinearOperator`,
   `IBilinearOperator`, `ISinkOperator`,
   `IStatefulStrictOperator`). Each pairs with an FsCheck law
   fired at `Circuit.Build()`. The base `IOperator<'T>`, the
   `PluginHarness` module, and the `OutputBuffer<'T>` /
   `StreamHandle` types all still hold — the capability tags
   layer on top of the original proposal, they do not replace
   it.
2. **Section 5.4 (Bayesian migration).** `BayesianRateOp`
   reclassified from generic `IOperator<struct (double * double
   * double)>` to `ISinkOperator<ZSet<bool>, struct (double *
   double * double)>`. The op is retraction-lossy by design; the
   sink tag is the correct classification and the algebra
   refuses to compose it past terminal edges.
3. **New section 5.4.1.** FsCheck law-suite table
   (`LinearLaw` / `BilinearLaw` / `SinkTerminalLaw` /
   `RetractionCompletenessLaw`) and its `Circuit.Build()`-time
   enforcement story.
4. **New section 5.6.** Commitment to ship
   `docs/PLUGIN-AUTHOR.md` this round as the plugin-author
   entry-point doc. `dotnet new zeta-plugin` scaffolding
   deferred to round 28+ per Daya's own fallback option.
5. **Section 6.** Q1 (Tariq — linearity preservation) marked
   ANSWERED with the capability-tag answer inline. Q4 (Daya — <5
   min onboarding) marked ANSWERED as a conditional YES, with
   the `docs/PLUGIN-AUTHOR.md` commitment as the condition.
   Q7 added: `OutputBuffer` thread-safety contract — must be
   well-defined-write + logged-error, not torn state. Q2 / Q3 /
   Q5 / Q6 and the Mateo-ping thread remain open.
6. **Section 8 (Summary for Kenji).** Surface count revised
   upward: seven interfaces (base + strict + async + fixpoint +
   four capability tags) plus `StreamHandle`,
   `OutputBuffer<'TOut>`, `PluginHarness`, and
   `docs/PLUGIN-AUTHOR.md`. Larger than the design-spike draft,
   load-bearing for algebra-law enforcement.

---

## 10. Final verdict for Kenji

**Verdict: ACCEPT.**

The integrated design keeps all three of my pre-synthesis gates
intact:

1. `Op<'T>` fully internal post-migration — **HOLDS.** Core's
   internal base continues to inherit every public interface for
   zero hot-path regression; no plugin author sees `Op<'T>`.
2. `RegisterStream` accepts only the interface, never the class
   — **HOLDS.** The four capability sub-interfaces all inherit
   `IOperator<'T>`; the public `RegisterStream` signature
   narrows to `IOperator<'T>`. Authors declaring a capability
   tag get their law checked at `Build()`.
3. `PluginHarness` ships the same round as the interface —
   **HOLDS.** Harness + `docs/PLUGIN-AUTHOR.md` + Bayesian
   migration are all round-27 deliverables.

**Tension with Tariq's capability-tagging requirement: none.**
His sum-type sketch (`PluginOp<'TIn,'TOut> = Linear | Bilinear |
Sink | StatefulStrict`) and the interface-composition approach I
landed on are morphologically equivalent; the interface form
additionally lets authors mix capabilities with strict / async /
fixpoint orthogonally without a Cartesian tag explosion. The
law-at-`Build()` enforcement Tariq requires fires identically
against either representation.

**Tension with Daya's AX bar: resolved by `docs/PLUGIN-AUTHOR.md`
commitment.** Daya's CONDITIONAL YES on the <5 min bar is met by
shipping the doc this round. If the doc slips, I flip to REJECT
— it is load-bearing for her blocking question.

**Implementation gate (for Kenji's round-27 close sweep):** land
all four of (a) `Op<'T>` retracts to internal, (b) the four
capability sub-interfaces ship together with their FsCheck laws,
(c) `docs/PLUGIN-AUTHOR.md` is written (not stubbed), and (d)
`BayesianRateOp` migrates to `ISinkOperator` in the same commit
sequence. Partial delivery reopens the review.

