# Algebra Owner — Notebook

Running notes for Tariq. ASCII only (BP-09). 3000-word cap
(BP-07). Newest entries first (GOVERNANCE.md §18 convention).

Frontmatter at `.claude/skills/algebra-owner/SKILL.md`
is canon (BP-08). This notebook supplements, never overrides.

---

## 2026-04-18 — Round 27: plugin `Op<'T>` algebra preservation check

**Context.** Ilyana is running the public-API spike on the plugin
extension surface. Her round-25 verdict: exposing `Op<'T>` as-is
implicitly commits every virtual (`StepAsync`, `AfterStepAsync`,
`IsStrict`, `Fixedpoint`, `ClockStart/End`, `IsAsync`) to a
forever contract, and none of those virtuals were shaped for
external authors. Three candidate shapes on the table:

- **A.** `IOperator<'T>` interface.
- **B.** `Circuit.Extend(input, factory)` builder — plugin author
  supplies a pure per-tick function, Core wraps it in an `Op`.
- **C.** `abstract class PluginOp<'TIn, 'TOut>`.

My job: answer the 5 algebra questions for each shape, propose
safeguards, and — if warranted — propose a 4th shape that
preserves the laws *better*.

### Grounding from the current code

- `Op<'T>` (`src/Core/Circuit.fs:55`) is an abstract class with
  a `VolatileField`-published `Value` slot. The virtuals are
  `Name`, `Inputs`, `IsStrict`, `StepAsync`, `AfterStepAsync`,
  `ClockStart`, `ClockEnd`, `Fixedpoint`, `IsAsync`. No
  `IsLinear`, `IsBilinear`, `IsCausal` declarations anywhere.
- Primitives (`src/Core/Primitive.fs`): `DelayOp` is `IsStrict=true`
  and splits `state` update into `AfterStepAsync`. `IntegrateOp`
  / `DifferentiateOp` are non-strict, consume `input.Value` on
  `StepAsync`. Scheduler runs non-strict ops in topo order so
  `input.Value` is current-tick (see `Circuit.fs:166-192`).
- Operators (`src/Core/Operators.fs`): `Map`, `Filter`, `Plus`,
  `Minus`, `Neg` are linear in the `Q^Delta = Q` sense — no
  cross-tick state. `Join` is bilinear; the three-term
  incrementalization is explicit in `IncrementalJoin`
  (`Incremental.fs:50-68`). `Distinct` has the retraction-native
  `H` path via `DistinctIncremental`.
- Canary plugin (`src/Bayesian/BayesianAggregate.fs:153`):
  **`BayesianRateOp` is neither linear nor bilinear.** It holds
  a mutable `BetaBernoulli` that accumulates `alpha`/`beta` across
  ticks — a strict state carry Core does not know about. It is
  *causal* and *deterministic-per-tick* given tick history. It
  produces a `struct(double*double*double)` that is **not a
  Z-set** — there is no retraction semantics on the output at
  all. This is the shape an external plugin author will reach
  for, and the algebra has no way today to say "this is a sink
  operator, not a relational operator".

### Per-candidate verdict on the 5 algebra questions

**Q1 — claims linearity but is not:** Under any shape where
the plugin author just writes a per-tick function and Core
trusts its classification, nothing stops an author from
filing a plugin under "linear" while carrying hidden state.
The answer must be that *declarations are checked* (FsCheck
property laws at registration or a sealed marker-interface
hierarchy that type-forbids state).

**Q2 — `I(z^-1 s)` ordering:** All shapes expose `StepAsync`
either directly (A, C) or indirectly through a factory-wrapped
`Op` (B). Hidden state across ticks is only safe if Core knows
the op is strict (so `AfterStepAsync` is the write path). If
the plugin author writes to a `let mutable` inside `StepAsync`
but does not declare strict, retractions desync under fanout.

**Q3 — Retraction-native:** If the plugin consumes
`ZSet<'K>` and emits non-`ZSet` (e.g. `double`), retraction
leaves the algebra at the op boundary — a `+1` then `-1`
will reach the plugin as two `ZSet` deltas summing to zero,
but the plugin's internal state (Beta-Bernoulli `a`, `b`)
does **not** retract. This is an intended "sink" pattern but
the shape must make it explicit.

**Q4 — Causality:** No shape Ilyana is considering gives a
plugin op pointers to future ticks, because `StepAsync` only
sees `input.Value` at the current tick. All three shapes pass
Q4 *by construction* — the `Op<'T>` architecture already
enforces point-wise causality because there is no
`Stream.At(tickOffset)` API. Good.

**Q5 — Composition / chain rule:** Composition is safe iff
each declaration (`IsLinear`/`IsBilinear`) is truthful. If the
declarations are checked (property-tested or type-level
sealed), `A . B` under the candidate shapes preserves
`(Q1 . Q2)^Delta = Q1^Delta . Q2^Delta`. Unchecked claims
poison composition.

### Candidate A: `IOperator<'T>` interface

| Q  | Verdict     | How violation happens                                                         |
|----|-------------|-------------------------------------------------------------------------------|
| Q1 | **FAIL**    | Plugin implements `ILinearOperator<'T>` marker without satisfying laws.       |
| Q2 | CONDITIONAL | Plugin uses `let mutable` inside impl, forgets to set `IsStrict`.              |
| Q3 | CONDITIONAL | Nothing enforces `ZSet`-in-`ZSet`-out.                                         |
| Q4 | PASS        | Interface gives no future-tick access.                                        |
| Q5 | CONDITIONAL | Depends on Q1 honesty.                                                        |

Interfaces have *no* way to ship abstract state fields or
`AfterStepAsync` hooks — authors re-invent them ad hoc. Virtual
dispatch cost identical to abstract class. **Weakest shape.**

### Candidate B: `Circuit.Extend(input, factory)` builder

| Q  | Verdict     | How violation happens                                                          |
|----|-------------|--------------------------------------------------------------------------------|
| Q1 | PASS        | Factory can only take pure `'TIn -> 'TOut`; no state slot exposed.              |
| Q2 | PASS        | No `AfterStepAsync` surface means no cross-tick state. Strict-ordering N/A.     |
| Q3 | PASS        | Input and output both `ZSet<_>`, retractions flow through untouched.            |
| Q4 | PASS        | Pure function — no tick history.                                                |
| Q5 | PASS        | Pure per-tick = linear by construction (if author uses `ZSet.map`).             |

**Strongest on laws but narrowest in scope.** A
Beta-Bernoulli rate tracker *cannot* be expressed under B
because it needs cross-tick state. Bayesian canary would have
to live entirely inside Core. Good for 80% of plugin wants,
bad for the other 20%.

### Candidate C: `abstract class PluginOp<'TIn, 'TOut>`

| Q  | Verdict     | How violation happens                                                           |
|----|-------------|---------------------------------------------------------------------------------|
| Q1 | FAIL        | Any `let mutable` inside subclass invisibly violates linearity claim.            |
| Q2 | CONDITIONAL | Same strict/non-strict confusion as `Op<'T>` today.                              |
| Q3 | CONDITIONAL | `'TOut` can be any type; retraction semantics lost silently.                     |
| Q4 | PASS        | Per-tick `Compute` cannot reach future ticks.                                    |
| Q5 | CONDITIONAL | Q1 honesty dependent.                                                            |

Basically `Op<'T>` with a sealed wrapper. Inherits the same
"abstract class = every virtual is a contract" problem Ilyana
flagged. Slight improvement via narrowed surface (no
`Fixedpoint`, no `ClockStart`), but the class is open to
arbitrary `let mutable` fields.

### Proposed Candidate D: **capability-tagged sum type**

Propose a discriminated shape the plugin author picks from by
algebraic role, not by abstract-class inheritance. The type
system enforces *which* laws apply. Sketch:

```fsharp
type PluginOp<'TIn, 'TOut> =
    /// Declared linear. Runtime checks via FsCheck on
    /// `f (a + b) = f a + f b` and `f 0 = 0` during Build.
    | Linear    of f : ('TIn -> 'TOut)
    /// Declared bilinear over two inputs.
    /// Runtime checks via FsCheck on distributivity.
    | Bilinear  of f : ('TInA -> 'TInB -> 'TOut)
    /// Stateful sink (e.g. BayesianRateOp). Explicitly
    /// *opts out* of relational algebra — output is not a
    /// Z-set, `Q^Delta = Q` does not apply, composition
    /// only allowed at sink position (no downstream op
    /// consumes this as a relational stream).
    | Sink      of step : ('TIn -> unit) * emit : (unit -> 'TOut)
    /// Plugin-author-declared-strict state carry. Requires
    /// an explicit `IsStrict=true` path + `afterStep` hook.
    /// FsCheck law: for any two-tick trace, retraction of
    /// the full trace leaves `state = initial`.
    | StatefulStrict of
        init    : 'State *
        step    : ('State -> 'TIn -> 'State * 'TOut) *
        retract : ('State -> 'TIn -> 'State)
```

| Q  | Verdict     | How violation happens                                            |
|----|-------------|------------------------------------------------------------------|
| Q1 | PASS        | `Linear` constructor only accepts pure `'TIn -> 'TOut`.           |
| Q2 | PASS        | `StatefulStrict` forces explicit strict path.                     |
| Q3 | PASS        | `Sink` tag marks retraction-lossy ops; Core can route accordingly. |
| Q4 | PASS        | No constructor exposes tick indexing.                             |
| Q5 | PASS        | Sum-type tagging gives Core enough info to verify chain rule.      |

**Key property:** `BayesianRateOp` would be `Sink` —
explicitly *not* a relational operator. Under Candidate D,
Core can refuse to compose `Sink . anything` except at the
circuit's terminal edge, which is exactly what the algebra
wants. Under A/B/C this invariant is undiscoverable.

### Safeguards required regardless of shape

1. **Declared-linearity must be property-tested.** FsCheck
   law suite runs at `Circuit.Build()` for every plugin op;
   failing ops reject the build with a clear error.
2. **Retraction completeness test.** For every `StatefulStrict`
   plugin, generate a random insert-then-retract trace and
   assert state returns to `init`. Mirrors the Lean
   `IsDbspLinear` pointwise-AddMonoidHom story — same theorem
   at the runtime layer.
3. **No `VolatileField`-style mutable state outside declared
   carriers.** Enforced by roslyn analyzer or F# compiler
   plugin if we have one; otherwise by convention + code
   review + FsCheck retraction test catching the consequence.
4. **`Q^Delta` derivation must see the tag.** `Incremental.fs`
   already special-cases linear and bilinear by *construction*
   (no inspection). Under D the incrementalizer can dispatch
   on the tag and apply the right rule; under A/C it would
   have to trust a marker interface. D is more honest.

### Recommendation to Kenji

Ilyana's best-of-three is **B** (pure-function factory) — it is
the only one that passes all 5 questions unconditionally. But
B cannot express the Bayesian canary, which is a declared
project goal (extension library). So B alone is insufficient
and A/C fail on Q1/Q3. Propose **D (capability-tagged sum)**
as a fourth candidate Ilyana should evaluate: it dominates
A and C on every question, equals B where B passes, and
additionally supports the Bayesian-sink and
stateful-strict cases that B cannot.

If D is rejected on complexity grounds, the fallback is **B
plus a sealed `InternalOp<'T>` escape hatch** — Core ships
B to external plugin authors, and power users wanting
sink/stateful ops work against an explicitly-unstable
internal surface (versioned per release, no forever contract).

### Effort estimate (for Kenji)

- Ilyana's recommendation + my addendum on D: Round 27
  spike close-out.
- If Kenji chooses D: ~1 round to draft `PluginOp<'TIn,'TOut>`
  sum type, the four-tag dispatcher in `Circuit.Register`,
  and the FsCheck law suite. ~1 further round to wire
  `BayesianRateOp` onto the `Sink` tag and demonstrate it
  still composes.
- If Kenji chooses B-plus-escape-hatch: ~half round for B,
  ~half round to seal the escape-hatch interface at
  `InternalsVisibleTo` boundary and document its
  "no forever contract" status.

### Flagged downstream work

- `proofs/lean/` chain-rule theorem needs a statement over
  plugin-declared-linear ops, not just internal primitives.
  Under D the hypothesis becomes "for every `Linear f` tag,
  `f` is `IsDbspLinear`" — clean.
- `FsCheck` law-suite expansion: `LinearLaw`, `BilinearLaw`,
  `RetractionCompletenessLaw`, `SinkTerminalLaw`.
- `docs/TECH-RADAR.md`: move "plugin operator extension"
  from Assess to Trial on acceptance of D.

### Handoff summary for Kenji (under 250 words)

**Verdict across the three shapes Ilyana is evaluating:**

- **A (IOperator<'T> interface):** Fails Q1 (linearity claim
  uncheckable), conditional on Q2/Q3/Q5. Weakest — interfaces
  cannot ship the `AfterStepAsync` strict hook authors will
  want. Reject.
- **B (Circuit.Extend builder):** Passes all five questions
  unconditionally. Strongest on laws but only expresses pure
  per-tick linear ops. Cannot express `BayesianRateOp`
  (stateful, sink-shaped). Insufficient alone.
- **C (abstract PluginOp<'TIn,'TOut>):** Inherits `Op<'T>`'s
  "every virtual is forever contract" problem. Fails Q1,
  conditional on Q2/Q3/Q5. Marginal improvement over today's
  `Op<'T>`.

**My recommendation:** Add a **Candidate D** — a
capability-tagged DU `PluginOp<'TIn,'TOut> = Linear |
Bilinear | Sink | StatefulStrict`. Each tag carries exactly
the shape the algebra needs to verify: `Linear` is a pure
function; `Bilinear` takes two inputs; `Sink` explicitly
opts out of relational composition (this is where the
Bayesian canary lives); `StatefulStrict` forces explicit
`init + step + retract` triples that FsCheck can test for
retraction completeness. D passes all five questions
unconditionally and supports every real plugin use case we
have today.

**Safeguards D needs:** (a) FsCheck law suite run at
`Circuit.Build()` on every plugin op — `LinearLaw`,
`BilinearLaw`, `RetractionCompletenessLaw`,
`SinkTerminalLaw`; (b) `Sink`-tagged ops rejected anywhere
except at terminal edges; (c) `IsStrict` flag carried by
tag, not left to the author.

**Fallback if D is too complex:** B plus a sealed
`InternalOp<'T>` escape hatch marked "no forever contract"
for power users. Weaker but acceptable.

---

## 2026-04-18 — B2 IsLinear strengthening: recommendation

**Context.** `tools/lean4/Lean4/DbspChainRule.lean` sub-lemma
`linear_commute_zInv` (B2) cannot close with the current
`IsLinear` predicate — it bundles only `map_zero` + `map_add`
at the stream level, which is the `AddMonoidHom` slice. DBSP
linearity (Budiu et al. §3.1) is additive **and** causal **and**
time-invariant. B2 needs the shift-commutation shape; B3 then
falls out of B2 + abelian-group negation; B1 needs causal +
additive to push `f` inside `Finset.range` sums; `chain_rule`
depends on B1/B2/B3.

**DEBT.md entry.** "Lean `IsLinear` predicate too weak for B2
(`linear_commute_zInv`)" — lists the three candidates:
  (a) causality (`f s n` depends only on `s 0 .. s n`);
  (b) explicit shift-commutation axiom;
  (c) pointwise per-tick `AddMonoidHom` family.

### Recommendation: **(c) pointwise action** — roll our own
`IsDbspLinear` with a bundled per-tick `AddMonoidHom` family.

**Why not (a) causality-only.** Causality by itself still fails
B2 at `n = 0`: knowing `f s 0` depends only on `s 0` does not
force `f (zInv s) 0 = 0` unless we *also* know `f` sends the
zero-at-tick-0 sub-stream to zero at tick 0. Closing that gap
means inventing a second axiom on top of (a) — at which point
(c) is the cleaner statement of what we actually want.

**Why not (b) shift-commutation axiom.** It is textbook cheating:
the axiom *is* the statement of B2. B3 and `chain_rule` would
reduce to appeals to the axiom, removing the proof's
evidentiary content. Rune (maintainability) would reject it on
honest-docstring grounds and the paper-peer-reviewer (Yusuf)
would flag it in any write-up.

**Why (c) is right for Zeta.** Every DBSP primitive we ship —
`Map`, `IndexedJoin` (on one side fixed), `Plus`, `z-inv`, `D`,
`I` — is *already* pointwise-at-each-tick in the F# code
(`src/Zeta.Core/Operators.fs`). Retraction-native semantics
*require* per-tick determinism. So (c) models exactly what our
operators satisfy; (a) and (b) model strictly larger function
classes we will never instantiate. Stronger predicate, easier
proofs, and it matches the Bagchi-et-al. "relational algebra
as pointwise functor on tick-indexed families" framing.

### Concrete definition (Lean pseudo-code)

```lean
/-- A stream operator is DBSP-linear iff it acts via a family
of per-tick additive homomorphisms indexed by tick + prefix. -/
structure IsDbspLinear (f : Stream G -> Stream H) : Prop where
  phi       : forall n : Nat, (Fin (n+1) -> G) ->+ H
  -- (uses Mathlib `->+` = `AddMonoidHom`)
  pointwise : forall (s : Stream G) (n : Nat),
                f s n = phi n (fun i => s i.val)
```

F# mirror for the operator-algebra side (non-proof, for
`Operators.fs` docstrings and the FsCheck law suite):

```fsharp
/// A stream operator f is DBSP-linear iff there exists a
/// family phi_n of AddMonoidHom (prefix Fin(n+1) -> G, output H)
/// such that (f s) n = phi_n (fun i -> s i) for all n.
/// Checked via FsCheck on the first K ticks with random s, t.
```

### Downstream proof impact

| Sub-lemma            | Status      | Depends on (c) how                                                                 |
|----------------------|-------------|------------------------------------------------------------------------------------|
| T3 `I_zInv_eq`       | closed      | independent of linearity                                                           |
| T4 `D_I_eq`          | closed      | independent                                                                        |
| T5 `I_D_eq`          | open `sorry`| independent — pure telescoping                                                     |
| **B1** `linear_commute_I`  | open  | rewritten: `phi_n` pulls through `Finset.range` by `AddMonoidHom.map_sum`         |
| **B2** `linear_commute_zInv` | open | direct: at `n=0` `phi_0` on zero prefix = 0; at `n=k+1` `phi_{k+1}` coincides with `phi_k` on the shifted prefix |
| **B3** `linear_commute_D`    | open | corollary of B2 plus `AddMonoidHom.map_sub`                                      |
| `chain_rule`               | open | uses B1/B2/B3 by their existing high-level plan; no new obligations               |

B3 actually shortens — it becomes a one-line corollary instead
of needing its own tactic script.

### Effort estimate (for Kenji)

- Predicate refactor + re-state B1/B2/B3 headers: **1 hour**.
- Close B2 with the new predicate: **2-3 hours** (the `phi_0`
  zero-prefix and `phi_{k+1}` shift cases are both direct from
  the `pointwise` witness).
- Close B3 as corollary: **30 minutes**.
- Close B1 via `AddMonoidHom.map_sum`: **2-3 hours** (Mathlib
  has `map_sum` for additive homs; some plumbing to index over
  `Finset.range`).
- Close `chain_rule` once B1/B2/B3 land: **4-6 hours**
  (unchanged by the predicate choice — it was always gated on
  B1/B2/B3).

**Total to close B2 with the predicate landing: ~half a day.**
**Total to close the full chain-rule theorem: ~2 days.**

### Flagged downstream proofs in same file

Predicate choice affects every proof that currently carries an
`IsLinear` hypothesis:

- B1 `linear_commute_I` — benefits; `map_sum` makes this
  almost mechanical.
- B2 `linear_commute_zInv` — blocked today; (c) unblocks.
- B3 `linear_commute_D` — benefits; reduces to a corollary.
- `chain_rule` — hypothesis type changes from
  `IsLinear f, IsLinear g` to
  `IsDbspLinear f, IsDbspLinear g`. All call sites are in this
  one file, so the ripple is contained.

`chain_rule_id_corollary` aliases `D_I_eq` directly and is
unaffected.

### Handoff to Kenji (summary, under 150 words)

**Recommendation:** Option (c). Add `IsDbspLinear` as a
structure bundling a per-tick `AddMonoidHom` family plus a
`pointwise` witness that `f s n = phi n (prefix)`. Replace the
two uses of `IsLinear` in B1/B2/B3/`chain_rule`.

**One-line rationale:** (c) models exactly what Zeta's F#
operators already satisfy (pointwise-at-each-tick, retraction-
native), makes B2 a direct witness application, turns B3 into
a corollary, and unblocks B1 via `AddMonoidHom.map_sum` — (a)
needs a second axiom to close `n=0`, (b) assumes the answer.

**Downstream impact:** B1, B2, B3, and `chain_rule` all carry
the predicate; T3/T4/T5 and `chain_rule_id_corollary` are
independent. Estimated ~half a day to close B2 with the
predicate, ~2 days for the full chain-rule theorem. Landable
this round if Kenji has the Lean budget; otherwise clean
candidate for a dedicated algebra-design spike.

