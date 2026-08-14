## 2026-08-13 — `Bound` / `Justification` (the orbital `1.2`) — ACCEPT_WITH_CONDITIONS

Proposal (PR #10437's rung-1 candidate): a **public** DU pairing a bound with
`Derivation | Measurement | Assumption`, so a bound without a justification is
unrepresentable. **Mechanism accepted, public surface refused.** `internal` to
`Zeta.Bayesian` + one `InternalsVisibleTo("Bayesian.Tests")`; zero public members
added. Decision doc:
`docs/DECISIONS/2026-08-13-bound-justification-is-an-authoring-type-not-a-public-contract.md`.

**What it turned on.** Every consumer of `deltaMaxMs` is inside `Zeta.Bayesian`
(ReticulumBusMeter ×2, GossipTelemetry ×2), each narrowing immediately to the
`int` of ms `BusRegime` takes. Nobody outside constructs or reads a justification.
So the only caller needing access was the test assembly — §19's
`InternalsVisibleTo` redirect verbatim, and the first time that guardrail has
*decided* a case for me rather than merely informed one.

**The finding I did not expect, and the one worth carrying.** The proposed DU
**would not have caught the `1.2`**. Pairing a float with a reason is decoration
when the offending literal sits *inside* the expression that produces the float —
the author writes one justification for the whole expression and the multiplier
stays invisible. What catches it is deleting the operation: *a bound is a sum of
named terms and there is no multiply*, with a private case so the total is derived
by summation and never authored. The type had to encode the **refutation** (the
residuals are additive) rather than merely ask the question.

> Generalised, for the next rung-1 review: **ask which operation the defect
> required, and remove it. Do not add a field beside it.** A field beside the
> defect is rung 4 wearing a type.

**Register discipline on my own claim.** Leaf magnitudes are still `float`, so the
guarantee is *no unnamed, unjustified contribution to a total* — not *no wrong
arithmetic*. Rung 1 for the silence, rung 4 for the arithmetic. Said in the module
itself, because overclaiming a guard is the exact defect class the guard answers.

**Pattern, first sighting — worth a standing question if it recurs.** Two
consecutive "make it public" proposals have had *audit / observability* as the
motive. Audit wants to **read**; a constructor is what goes **public**. Those are
different halves of a type, and the reader can arrive later, non-breaking, when a
real audit surface exists. Candidate addition to the review template: *is the
requested surface the constructor or the reader?*

**Second pattern (recorded as a coincidence, not a conclusion).** This and
`src/Core/DerivationProtocol.fs` are both closed DUs naming *what is and is not
verified*. Same philosophy, different domains. Tempting to unify; refused with one
instance in hand. Revisit at two.

**Open question carried forward.** The scope criterion — *"a constant whose being
too small produces a false verdict"*, which separates soundness-bearing bounds
from policy knobs (timeouts, batch sizes, backoff) — currently lives only in a
decision doc. If the type spreads, that criterion must spread with it, or the type
dilutes to `Assumption` everywhere and stops discriminating.

**Also refused:** the `Assumption "pre-dates this type"` grandfathering sweep. It
relabels the problem and destroys the audit signal on the day it is created, by
making thoughtless annotations indistinguishable from considered ones. No sweep;
the type applies where a bound is authored or touched, and an unwrapped `float` is
honest because it claims nothing.

**Found while doing this, for the outstanding `Stream<'T>.Op` /
`Circuit.RegisterStream` audit:** `src/Core/AssemblyInfo.fs` carries an explicit
comment that `Zeta.Bayesian` is deliberately *not* on the `InternalsVisibleTo`
list because it uses the public `IOperator<'T>` plugin interface, *"exactly the
shape every external plugin library uses."* If those two flips were made so the
Bayesian plugin could register operators, they sit in direct tension with that
stated design — and the counter-argument is already written down in the
repository.

---

## 2026-07-02 — IRing/ISemiring split: APPROVE-WITH-CONDITIONS (081KWG9JQ9H)

The ten-year test ran backwards: the contract we could not keep was the shipped
one (ISemiring mandating Negate that lawful instances provably cannot have).
Approved the clean break pre-v1 with five conditions (laws-before-interface;
six-oracle + IR atomicity; SemVer major; doc-sweep gate incl. Semiring.fs:16
variance-comment fix; zero is-IRing downcasts). Precedent: IGroup : IMonoid.
New forever-promise watched: Trace(ISemiring) must never negate — witnessed in
the law-pack. (Banked by Otto from my advisory review, per my note.)

# Public-API Designer — Notebook

Maintained by Ilyana. Newest first.

---

## 2026-06-06 — `NestingTooDeep` depth-bound error case (DynamicValue codec) — ACCEPT

Otto routed a public-API review: gate red on windows-2025 only, because the DynamicValue
canonical JSON/XML codec recurses per nesting level with no bound; a depth-2000 fuzz input
overflows the tight windows-x64 (~1 MB) test-thread stack (an unhandleable .NET SOF kills the
runner). Proposed adding a depth-guard error case across all four published languages.

**Verdict: ACCEPT a new case; REJECT reuse of `NonRepresentable`/`Unsupported`.** Reasons recorded:

- **Name `NestingTooDeep`** (not `TooDeep`/`RecursionLimit`). The existing cases are all noun-phrases
  describing the *input condition* (`UnexpectedEnd`, `IntegerOverflow`, `NonCanonical`); `RecursionLimit`
  leaks the impl (recursion ≠ the contract — the contract is input nesting). Same name on BOTH
  `EncodeError` and `DecodeError` (the unions deliberately mirror).
- **Bound = fixed private/internal const, NOT public, NOT a parameter.** A public constant freezes the
  literal into the contract (a later bump becomes a published-value change); a parameter doubles every
  entry point for a knob nobody tunes. Narrowest API = one case, zero knobs. Document "well above
  realistic depth" without stating the literal in the contract; it may be raised later (only ever moving
  the error later, never earlier).
- **No reuse.** `NonRepresentable` is a value-domain statement ("scalar unencodable"); a deep value is
  representable, you just decline to walk it. Folding resource-safety into it conflates two reasons —
  defeats the discriminated type.

**Flags handed to Kenji (non-blocking, pre-v1 affordances):** Rust error enums are not
`#[non_exhaustive]` — adding a variant is a breaking change for external `match`; landing
`#[non_exhaustive]` now is free pre-v1. TS has THREE divergent `DecodeError` unions (json/cbor/xml) +
no Arrow TS codec — "mirrored across four languages" is already not literally true on the TS side;
per-codec fragmentation is an API smell worth a backlog note. Viktor: a boundary golden vector
(bound → Ok, bound+1 → `NestingTooDeep`) is needed to pin the published behaviour.

Otto implemented per this verdict (JSON+XML, all 4 langs; CBOR/Arrow + TS string-encoders deferred as a
fast-follow since they lack an `Error` channel). Advisory given; Otto integrated.

## 2026-04-18 — Round 27 — Synthesis entry (Tariq + Daya integration)

Kenji returned with Tariq's algebra-owner review and Daya's AX
review of my design spike. Both landed substantive additions; I've
revised `docs/research/plugin-api-design.md` in place rather than
producing a parallel doc. The headline changes:

1. **Tariq Q1 answered YES, blocking.** `IOperator<'T>` alone is
   insufficient. Plugin authors can claim linearity without
   mechanism. The fix is capability-tagged sub-interfaces
   (`ILinearOperator`, `IBilinearOperator`, `ISinkOperator`,
   `IStatefulStrictOperator`), each paired with an FsCheck law
   fired at `Circuit.Build()`. Pattern matches my existing
   `IStrictOperator` precedent — composition of narrow interfaces,
   not a wider base. Section 5 now includes all four.
2. **Bayesian reclassification is the clinching example.**
   `BayesianRateOp` is retraction-lossy by design: `+1` then `-1`
   in the input `ZSet<bool>` does NOT un-accumulate
   `Beta-Bernoulli.a/b`. Under plain `IOperator<'T>` this is
   *undiscoverable* and silently poisons downstream relational
   composition. Under `ISinkOperator` the algebra consciously
   exempts it from composition laws and rejects it anywhere but
   terminal edges. Section 5.4 reclassifies accordingly.
3. **Daya Q4 answered CONDITIONAL, blocking.** A plugin author
   can ship <5min under any of the three shapes, but only if (a)
   `docs/PLUGIN-AUTHOR.md` exists as an entry-point and (b) the
   Bayesian example is discoverable as a template. Committed to
   both this round in new §5.6. `dotnet new zeta-plugin`
   scaffolding deferred to round 28+ per Daya's own fallback
   option.
4. **Surface grew from 5 to 7 interfaces + 3 types + 1 module +
   1 doc.** Larger than my original, but the capability split is
   load-bearing for Tariq's law enforcement and cannot be cut.
   Section 8 updated.
5. **New open question Q7** on OutputBuffer thread safety per
   Mateo ping — the scheduler must make cross-thread Publish
   well-defined-write + logged-error, not torn state.

**Gates from my pre-synthesis verdict — status:**

- (i) `Op<'T>` fully internal post-migration: HOLDS. Core's
  internal base still implements every interface for zero hot-path
  regression.
- (ii) `RegisterStream` accepts only the interface: HOLDS. The
  four capability sub-interfaces all inherit `IOperator<'T>`; the
  public `RegisterStream` signature narrows to `IOperator<'T>`.
- (iii) `PluginHarness` ships same round as the interface: HOLDS.
  Harness + doc + Bayesian migration are all round-27 deliverables.

**Tension with Tariq's capability-tagging requirement.** None I
can identify. Tariq's sum-type sketch (`PluginOp<'TIn,'TOut> =
Linear | Bilinear | Sink | StatefulStrict`) and my
interface-composition approach are morphologically equivalent; the
interface form lets authors *also* mix capabilities with strict /
async / fixpoint orthogonally without a Cartesian tag explosion.
The law-at-Build enforcement Tariq requires is orthogonal to the
representation and fires identically against either.

**Verdict: ACCEPT.** The synthesis keeps all three of my original
gates intact, integrates Tariq's algebra-law enforcement without
structural compromise, and closes Daya's entry-point gap via the
new doc. Seven interfaces + three types + module + doc is the
final surface and it is defensible against a 10-year commitment
review.

**Anti-patterns logged from this round:**

- **Silent retraction-lossiness.** If a plugin output type is not
  a `ZSet`, the algebra has no way to say "this is a sink" unless
  the contract surfaces it. Plain interface + trust is a trap.
  The capability tag is how we stop Bayesian's nature from
  poisoning everything.
- **Entry-point by repurposing.** README, CONTRIBUTING, and
  ARCHITECTURE are *each* for a different audience. Plugin
  authors are a fourth audience. "Plugin-author" is a
  first-class persona with a first-class doc — not a footnote.

**Next review:** implementation lands on Kenji's desk. My gate
on implementation: `Op<'T>` actually retracts to internal (not
just in the proposal), the four capability interfaces ship
together (no punting Linear/Bilinear to a later round), FsCheck
laws land alongside, and `docs/PLUGIN-AUTHOR.md` is written this
round, not punted. Same gate pattern as the interface — ship
the contract and the harness together or not at all.

---

## 2026-04-18 — Round 27 — Design-spike entry

Kenji anchored Round 27 on the P0 I raised in Round 26 entry 1:
`Circuit.RegisterStream<'T>(op: Op<'T>)` implicitly makes every
abstract/virtual/public member of `Op` + `Op<'T>` a forever plugin
contract. This turn was the dedicated design-spike — produce the
concrete shape of the new plugin-author surface.

**Deliverable:** `docs/research/plugin-api-design.md` (new file,
full proposal, ~400 lines).

**Candidate shapes evaluated:**

- **A** — `IOperator<'TOut>` interface + optional capability
  interfaces (`IStrictOperator`, `IAsyncOperator`,
  `INestedFixpointParticipant`).
- **B** — `Circuit.Extend(input, step)` closure-only builder.
  Rejected: doesn't generalise to multi-input, strict, async,
  or fixpoint operators without a combinatorial method family.
- **C** — `PluginOp<'TOut>` abstract class, trimmed to only the
  members plugins legitimately override. Ergonomically close to
  today's shape but commits us to the exact member set and makes
  future capability-addition either silently-defaulted or
  ecosystem-splitting.
- **D** — **Shape A + a `PluginHarness` test module** shipped in
  the same round. Closes the extension-cliff (SKILL checklist #6)
  which none of A / B / C does alone.

**Recommendation: Shape D.** Rationale in one line: it's the
narrowest forever-surface that still expresses Bayesian plus every
Core operator, and it's the only shape that ships a test harness
simultaneously. Precedent: Roslyn `CodeFixProvider` +
`FixAllProvider`, Orleans grain interfaces, BCL `IAsyncEnumerator`

+ `IAsyncDisposable`. All four-star shapes for long-lived extension

points.

**What the shape hides from plugins (satisfies round-27
constraints):**

- `Op<'T>.Value` setter and `SetValue` — NOT exposed. Plugins
  write output via `OutputBuffer<'TOut>.Publish` (write-only).
- `idField`, scheduler-owned `IsStrict`, `Fixedpoint`, `IsAsync`
  on base `Op` — stay internal. Plugin-author opt-ins are the
  `IStrictOperator` / `IAsyncOperator` /
  `INestedFixpointParticipant` interfaces.
- `Stream<'T>.Op` — retracts to internal. Replaced by opaque
  `StreamHandle` obtained via `stream.AsDependency()`.

**What stays unchanged:**

- Core's `Op<'T>` inherits the new `IOperator<'T>` interface
  internally; `Operators.fs` / `Primitive.fs` keep their current
  shape, zero hot-path regression.
- `Stream<'T>` struct, `VolatileField` on `.Value`,
  `[<InlineIfLambda>]` on fast transforms, `ValueTask.CompletedTask`
  return path — all untouched.

**Migration cost for Bayesian:** ≤ 20 lines changed in one file.
Line-count delta: +3 (interface block); `inherit Op<_>()`
replaced by `interface IOperator<_> with`. Acceptable pre-v1.

**Blocking open questions surfaced:**

- **Q1 — Tariq.** Does the `IOperator<'T>` shape preserve the
  algebraic laws the chain rule + `IsDbspLinear` need? Specifically
  whether a plugin hiding its state cell in own fields still
  admits the per-tick `phi_n` additive monoid hom, or whether we
  need an opt-in `ILinearOperator` marker interface.
- **Q4 — Daya.** Can a new plugin author ship a working custom
  operator in < 5 minutes reading only the XML docs + the
  `BayesianRateOp` example? If not, what piece is missing.

**Non-blocking questions logged:** Q2 (Tariq — strict-operator
ordering contract), Q3 (Tariq — `Fixedpoint` semantics as derived
vs. overridden), Q5 (Daya — four-interface split vs. single
abstract class with four virtuals), Q6 (Daya —
`ReadDependencies: StreamHandle array` vs. fluent `.DependsOn(...)`),
plus a courtesy ping to Mateo on `OutputBuffer` thread-safety if
captured across `StepAsync` return.

**Verdict posture going into synthesis:** ACCEPT_WITH_CONDITIONS
on Shape D, contingent on Tariq's Q1 answer. If the algebra
requires an explicit linearity declaration from plugins, the
shape still holds — we just add one more opt-in marker interface
(pattern already in place for strict / async / fixpoint). If
Daya flags onboarding > 5 min, the fix is probably example-ops
and XML doc polish, not structural — Rune's lane.

**Anti-patterns flagged that recur from Round 26 notebook:**

- Public-abstract-class-as-extension-point promotes *every*
  abstract member to a plugin contract. Interface + optional
  capability interfaces is the narrower alternative. (Generalised:
  prefer composition of narrow interfaces over one wide base.)
- Write channels should be write-only opaque types, not bare
  property setters. `OutputBuffer<'TOut>.Publish` is the pattern;
  today's `Op<'T>.Value with set` is the anti-pattern.

**Next review:** Kenji will integrate with Tariq's + Daya's
findings and return for a synthesis-doc review before
implementation starts. My gate on that synthesis: (i) does it
keep `Op<'T>` fully internal post-migration? (ii) does
`RegisterStream` accept only the interface, never the class?
(iii) is `PluginHarness` shipped in the same round as the
interface, not punted to "round N+2"? If any of those slip, I
flip to REJECT on the synthesis.

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
