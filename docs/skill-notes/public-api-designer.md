# Public-API Designer — Notebook

Maintained by Ilyana. Newest first.

---

## 2026-04-18 — Round 26 — Entry 1

First review. Two `internal` → `public` flips from round 25 that
landed without a review. Auditing both as a retroactive gate.

### Change 1 — `src/Core/Circuit.fs:75` — `Stream<'T>.Op` field promoted from `internal` to `public`

**Why public?** (reconstructed)
- `Zeta.Bayesian.BayesianRateOp` (constructor param `input: Op<ZSet<bool>>`)
  needs to read a `Stream<ZSet<bool>>`'s producing `Op<'T>` so that the
  new operator can list it in its `Inputs` array. Every internal operator
  in `Operators.fs` does the same — they consume `stream.Op` at
  construction. The round-25 InternalsVisibleTo audit removed
  `Zeta.Bayesian` from Core's IVT list; Bayesian therefore can no longer
  see the internal field and must either get a public replacement or
  stop being a plugin.

**Alternative considered?** (author did not document one; reconstructed)
- None on record. The natural alternatives:
  1. Ship a public read-only property `Stream<'T>.Op : Op<'T>` (what
     landed, modulo F# field-vs-property distinction).
  2. Ship a public `Stream.AsInput(this) : Op<'T>` method — semantic
     naming that communicates "use this as an input to your new op."
  3. Ship an `IStreamProducer<'T>` interface on `Stream<'T>` that
     exposes only the `Op` handle and hides the class lineage.
  4. Flip the model: instead of plugin authors constructing
     `MyOp(stream.Op, …)` and calling `RegisterStream`, expose a
     `circuit.AddOperator<'T>(inputs: Stream[], make: Op[] -> Op<'T>) :
     Stream<'T>` factory that never puts a raw `Op<'T>` in the plugin
     author's hands at all.
- The landed shape (raw public field) is the lowest-friction for the
  internal call sites in `Operators.fs` because they were already
  touching the field. It is also the widest commitment.

**Verdict: ACCEPT_WITH_CONDITIONS** (leaning REJECT on the field-exposure
shape; accept the *access*, reject the *field*).

**Summary:** Plugin libraries legitimately need a handle to a
stream's producing operator — that's the whole point of a plugin
registration surface. The *access* is justified. The *shape*
(raw public `val` field on a struct) commits us to more than the
use case requires and couples the public surface to the exact
field layout of the struct.

**Findings:**
- **[P1]** `val Op: Op<'T>` (a public struct field) is a stronger
  commitment than the equivalent `member this.Op : Op<'T>` property.
  A field fixes the layout: we cannot later add a wrapper, add a
  backing interface, or lazy-compute the operator without breaking
  binary compat. A property is source/binary-compat with all three
  future refactors. **Precedent:** .NET BCL convention — public
  fields on structs are vanishingly rare; `ValueTuple<T1,T2>`'s
  `Item1`/`Item2` are the notable exception and exist for a
  specific tuple-interop reason we do not share. See FxCop rule
  CA1051 ("Do not declare visible instance fields"). Roslyn
  explicitly warns on public fields in library code.
- **[P1]** Exposing `Op<'T>` publicly makes `Op<'T>` itself part of
  the public API. That means every member of `Op<'T>` and its base
  `Op` — `Name`, `Inputs`, `IsStrict`, `StepAsync`, `AfterStepAsync`,
  `ClockStart`, `ClockEnd`, `Fixedpoint`, `IsAsync`, `Id`, `Value`,
  `SetValue` — is now a forever-contract. `SetValue` is
  particularly concerning: it lets a plugin author mutate another
  operator's output slot from outside the operator's own
  `StepAsync`. That's a correctness footgun that was previously
  impossible from outside Core. `Op<'T>.SetValue` should be
  revisited before we commit to `Stream.Op` being public.
- **[P1]** The `internal new(op: Op<'T>) = { Op = op }` constructor
  is still internal. That's fine for the *construction* direction
  (plugin can't fabricate a `Stream<'T>` from nowhere) but it's
  an asymmetric commitment: read access is public, write access
  internal. That's the right asymmetry, but it should be expressed
  via a `get-only property`, not a `val` field, to make the shape
  self-documenting.
- **[P2]** `Stream<'T>` is `[<NoComparison; NoEquality>]` — good,
  doesn't leak structural-equality pressure onto the public surface.
- **[P2]** The XML doc names Zeta.Bayesian explicitly. That's
  accurate but ties a contract commitment to a specific consumer
  by name; better to say "plugin libraries that define custom
  operators."  (Aesthetic/docstring — forward to Rune.)

**Proposed alternative:**

```fsharp
[<Struct; IsReadOnly; NoComparison; NoEquality>]
type Stream<'T> =
    val private op: Op<'T>
    internal new(op: Op<'T>) = { op = op }
    member this.Current = this.op.Value
    /// Producing operator handle. Intended for plugin-library
    /// operator construction — a custom `Op<'T>` subclass lists
    /// its upstream streams as `Inputs` by reading this handle.
    /// Treat as opaque; do not invoke methods on it outside an
    /// `Op`'s own lifecycle.
    member this.Op : Op<'T> = this.op
```

This keeps the same caller ergonomics (`stream.Op` works
identically) but leaves us the room to later (a) wrap the
returned object, (b) insert an interface, or (c) lazy-compute,
without a binary break. Cost: one property-dispatch call where
the field-read was previously direct. On a struct this
inlines in release builds; the perf delta is zero in practice
(verified by convention — no measurement this session).

**Questions for the author (Kenji):**
- Is there a reason `val` over `member`? Was a perf measurement
  taken that justifies field-over-property, or is this carry-over
  from the pre-flip shape?
- Is `Op<'T>.SetValue` intended to be callable by plugin authors,
  or is exposing it a side-effect of flipping `Stream.Op` public?
  If the latter, it should be sealed off before this lands (e.g.
  `SetValue` moves to an internal member and `Op<'T>` exposes a
  `protected` setter pattern for subclass use only).

**Tests missing:**
- No test pins `Stream<'T>.Op` as public contract today. Before
  the round closes, add a test under `tests/Tests.FSharp/` that
  constructs an op referencing `stream.Op`, registers it, steps
  the circuit, and reads back the output. This pins the
  plugin-author workflow as a tested contract (not "happens to
  work because Bayesian uses it").

---

### Change 2 — `src/Core/Circuit.fs:122` — `Circuit.RegisterStream<'T>` method promoted from `internal` to `public`

**Why public?** (reconstructed)
- This is the single entry point for attaching an externally-defined
  operator into the circuit DAG. With `Zeta.Bayesian` out of
  `InternalsVisibleTo`, Bayesian's `BayesianRate` extension method
  has nowhere else to call: `Circuit.Register<'O>` is generic over
  `'O :> Op` and returns the op itself, not a `Stream<'T>`, but it
  is also internal. The `Register + Stream wrap` combination is
  what plugin authors need.

**Alternative considered?** (author did not document one)
- None on record. Possible alternatives:
  1. Keep the current shape: `RegisterStream(op) : Stream<'T>`
     (what landed).
  2. Narrower: require plugin authors to *also* implement an
     `IOperatorFactory<'T>` that produces the op, so `Circuit`
     does the construction and plugin code never holds a raw
     `Op<'T>`. More ceremony; unlocks validation hooks later.
  3. Builder: `circuit.BuildOperator<'T>().WithInputs(…).OnStep(…).
     Register()` — fluent. Heavy; overkill for the current three
     conjugate-update ops, and invites a builder API commitment
     we'll regret.
  4. Attribute-based registration + source generation: plugin
     author declares `[<ZetaOperator>]`, a source generator wires
     it up. Cute, high tooling cost; wrong now.

**Verdict: ACCEPT_WITH_CONDITIONS.**

**Summary:** The method itself is the right shape (name, return
type). The condition is that *what it accepts* — an `Op<'T>` — is
only as useful as the `Op<'T>` base class's public surface, and
that surface has not been reviewed as a forever-contract. We are
committing to `Op<'T>` as a plugin-author subclass target by
making `RegisterStream` public. Treat `Op<'T>`'s public shape as
co-landed with this change.

**Findings:**
- **[P0]** By making `RegisterStream(op: Op<'T>)` public, we are
  implicitly making `Op<'T>` a **public inheritance extension
  point**. Plugin authors will subclass `Op<'T>` (as
  `BayesianRateOp` already does). Every abstract/virtual member
  they override — `Name`, `Inputs`, `IsStrict`, `StepAsync`,
  `AfterStepAsync`, `ClockStart`, `ClockEnd`, `Fixedpoint`,
  `IsAsync` — is part of the plugin contract. None of these were
  designed as a plugin-author contract: they were designed for
  Core's internal operators. Open questions the author did not
  answer: (a) what invariants does a plugin-author `StepAsync`
  need to hold? (b) are plugin authors allowed to have non-
  strict ops with no inputs? (c) what happens if
  `Fixedpoint(scope)` returns `false` forever — is that a bug in
  plugin code or an undefined-behaviour footgun in Core? Without
  documented answers, every future plugin author will inherit
  our lack of answer as "documented behaviour." **Precedent:**
  Rust `async_trait` gates, .NET `IAsyncEnumerator`'s documented
  contract, and Roslyn's `CodeFixProvider` all ship with
  explicit "implementers must" contracts on their virtual
  members. We have not.
- **[P1]** The public signature `RegisterStream<'T>(op: Op<'T>) :
  Stream<'T>` has a subtle generic-inference risk: callers who
  pass a subclass `MyOp : Op<ZSet<X>>` will have `'T` inferred
  as `ZSet<X>`, not `MyOp`. That is the intended behaviour, but
  it means `RegisterStream` discards the subclass identity on
  the return side. Fine for now; flag so we don't later "fix"
  it and break the contract. **Precedent:** `Task.FromResult<T>`
  does the same discard; common .NET pattern, not a problem
  in isolation.
- **[P1]** `RegisterStream` has no async/cancellation variant.
  That's correct today (registration is sync and must happen
  before `Build`), but the contract doesn't say so. If we ever
  need an async-registering operator, the signature shape
  available to us is constrained by what we commit here. Name
  `RegisterStream` locks us into "there is exactly one way to
  register."  Acceptable but worth knowing.
- **[P1]** There is no `Unregister` / `Remove` counterpart. The
  circuit is append-only pre-`Build`, and immutable post-
  `Build`. That's the right semantic. But the public API
  doesn't say so. A plugin author reading `RegisterStream`'s
  XML doc will correctly intuit append semantics only because
  of the "before `Build`" line in `Register`'s error message —
  not because the public contract documents it. Pin the
  contract in XML, not just in an error string.
- **[P1]** `Circuit.Register<'O when 'O :> Op>(op: 'O) : 'O`
  remains internal. Good — `RegisterStream` is the narrower
  public choice. But note: plugin authors whose operator type
  is `Op` (non-typed-output) have no public entry point. That
  is almost certainly the right cut (typed-output ops are the
  only thing plugin authors build in practice), but flag it
  as a deliberate narrowing for the record.
- **[P2]** The XML doc on `RegisterStream` names "plugin
  libraries that implement custom operators." Accurate. The
  companion claim "need to hook them into the circuit graph"
  is slightly redundant with the method name — Rune's
  territory.

**Proposed alternative — none to `RegisterStream` itself.** The
method shape is defensible. The binding condition is that
`Op<'T>` and `Op` must be reviewed and documented as a
plugin-author contract in the same round, because making
`RegisterStream` public effectively makes them part of the
public surface by type-propagation.

**Specific conditions for full ACCEPT:**
1. **Document the plugin-author contract on `Op` / `Op<'T>`.**
   At minimum, XML doc each abstract/virtual member with
   "Implementers must …" clauses answering: required
   idempotency of `StepAsync`, what `Inputs` must contain
   (all operators read in `StepAsync`, or a superset is
   allowed?), `Fixedpoint`'s meaning for a custom op, and
   whether `IsAsync` can change over the op's lifetime.
2. **Audit `Op<'T>.SetValue` and `.Value` setter visibility.**
   External subclasses need to write into `.Value` during
   their own `StepAsync`, but nothing else should. The
   current shape is `member _.Value with get() … and set v …`
   public getter + public setter. The setter should be
   reviewed — if plugin-author code is the only writer,
   consider a `protected internal` pattern or a `SetValue`
   method that's internal + `[<CLIMutable>]`-equivalent. If
   a public setter is correct, document the rule: "write
   only from your own `StepAsync` / `AfterStepAsync` / ctor;
   never from outside."
3. **Pin the plugin author workflow in a test.** Not
   "Bayesian happens to work." A dedicated test under
   `tests/Tests.FSharp/` named something like
   `CircuitRegisterStream_CustomOpPlugin_Tests.fs` that
   subclasses `Op<'T>`, registers via `RegisterStream`,
   and asserts the stream publishes the expected value.
   Without this, the extension-cliff checklist item (#6)
   trips: plugin authors can't verify their
   implementations against a reference harness.
4. **Decide whether `Op.Inputs` is a promise about
   dependencies.** Core's `Build()` uses it for topological
   ordering — if a plugin author's op reads another op's
   `.Value` during `StepAsync` but *doesn't* list it in
   `Inputs`, the schedule may run the wrong order and the
   read returns stale data. This is a plugin-author footgun
   if undocumented; it's a contract if documented.

**Questions for the author (Kenji):**
- Was this shape tested against a plugin author who is *not*
  Bayesian? Bayesian is built by us; it is not a realistic
  third-party plugin. The contract's usability is only
  knowable from the outside.
- Is `Circuit.Nest` (not reviewed here — grep hit in the file)
  the right name for child-circuit construction, given the
  paper uses "subcircuit"? Out of this review's scope but
  flagged as I passed through.
- Is the plan to keep `Circuit.Register<'O>` internal forever,
  or does it become public once we have a use case for
  attaching an untyped `Op` (e.g. a side-effect-only sink op)?

**Tests missing:**
- Plugin-author-style workflow test (condition #3 above).
- A negative test: a plugin-author op that declares wrong
  `Inputs` and demonstrates the current behaviour
  (misordered schedule / stale reads). Not necessarily a bug
  to fix, but worth documenting what happens when the plugin
  author holds the contract wrong.

---

### Cross-cutting anti-patterns worth naming

1. **Public field over public property.** CA1051. Struct field
   layout is binary-fragile; property is not. Default-flag every
   future `val pub` on a struct in a published library.
2. **Subclass inheritance as extension point, with no contract.**
   Making a concrete registration method public silently
   promotes every abstract member of the parameter type to
   plugin contract. Treat them as co-landed.
3. **Internal-and-hole-punched as a design smell.** The
   underlying pattern we just corrected: if a production-grade
   sibling library needs access to an internal member via
   `InternalsVisibleTo`, that member is almost certainly
   public-in-disguise. The fix is not always "make it public" —
   sometimes it's "change the boundary so the sibling doesn't
   need it" — but it's never "keep the IVT hack." The round-25
   audit got the diagnosis right; the prescription (flip both
   members public with no ceremony) landed faster than the
   full review would have. That's the governance gap this
   retroactive review exists to surface.
4. **Rationale not recorded at the flip site.** Neither the
   commit message nor an ADR captured "Alternative considered"
   for the two flips. The round-25 win writeup in
   `docs/WINS.md` §4 covers the *why* at the pattern level but
   not the per-change alternative analysis. Going forward, the
   template in `.claude/skills/public-api-designer/SKILL.md`
   should be filled in *at flip time*, not reconstructed
   in review.

### Open questions I'll track across future reviews

- Should there be a `ZetaOperator` base class distinct from
  `Op` — Core uses `Op` internally, plugins use
  `ZetaOperator`, with a one-way adapter? Defers the "every
  `Op` member is a plugin contract" commitment until we see
  real third-party plugins. Flag for Round 27 discussion if
  Kenji has cycles.
- `Op<'T>.SetValue` — public for historical reasons, or
  because subclasses in other assemblies genuinely need it?
  Visibility-reduction is a breaking change, but pre-v1 the
  cost is docs-and-refactor, not users. Raise when the
  `Op<'T>` contract review happens.
- Precedent worth citing when next plugin surface proposed:
  .NET's `DependencyProperty.Register` pattern,
  `CodeFixProvider`'s implementer contract,
  `System.Text.Json`'s `JsonConverter<T>` interface. All
  three are public subclass-extension points with explicit
  implementer contracts in their XML docs. Set that bar.

### Notebook hygiene

First entry; nothing to prune. Next review's first action:
check whether conditions on Change 2 were applied before round
close. If not, escalate to REJECT for the round-close sweep.
