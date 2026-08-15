# Inject the scheduler at the evaluation seam, not the encoding seam — and what the `app`-free claim actually survives

**Register:** Mirror for the walk-through, Beacon for the Hughes anchor and the staging argument.
Three of the load-bearing lines are **corrections** — to the brief I was given, to a claim of Aaron's,
and to my own coordinator's framing — so they are stated flatly rather than softened.

Aaron, 2026-08-15, on PR #10828's finding that `apply ∘ reify` has no injected channel:

> *"we may need to inject a scheduler like our Zeta scheduler here, our IScheduler stuff that can
> predict its own future big-O in time and space and prune."*

and, on the enabling condition:

> *"yes this is the exact conclusion... we need to save this as a design constraint that makes our
> Vision monad and sensor fusion even possible."*

This is what the code actually says.

***

## 1. The layer split holds, and it is sharper than "don't parameterize the encoder"

`Bonsai.reify` / `Bonsai.apply` are total, channel-free `Expr ↔ DynamicValue`. The round-trip law
stands on that: `apply_reify_eq_self` (`src/Core.Lean4/Lean4/Bonsai.lean:154`) and the FsCheck
property (`tests/Tests.FSharp/Bonsai.Property.Tests.fs:75`). What makes the law byte-lockable is
that there is **no ambient door** (§13 noninterference) — which is exactly what leaves no room for a
tick. Nothing in this work parameterizes them, and nothing should.

Evaluation is the seam. `BonsaiSoft.evalSoft` is already the partial evaluator: it returns a
distribution and **declines** `Lambda` / `Call`. That decline turns out to be the load-bearing fact
of this whole document — see §4.

## 2. What already exists — measured, because the brief said this is probably wiring

It is wiring, and less of it than expected. The measurement, file by file:

| module | what it actually does | does it predict its own cost? |
|---|---|---|
| `src/Core/Vision.fs` | `BranchCost {SpaceBytes; TimeTicks; BytesPerTick; UncertaintyResolutionBits}`, `predictBranches` boards the affordable prefix and **defers** the rest, `IBranchForecaster` is the declared port | **No.** Every cost is *supplied by the caller*. It budgets and prunes costs it is told. |
| `src/Core/PredictionScheduler.fs` | bridges `PredictionInference` to `SoftScheduler.HandlerK`; threads a `SoftThrottle.Tank`, tick count, boarded/deferred byte totals | **No.** `CandidateEstimator` is caller-supplied. |
| `src/Core/SchedulerZeta.fs` | genuinely self-predicting — Artin–Mazur recurrence: `predict` iterates until a projected state repeats and reports `{Transient; Period; Reachable}`; `runToHorizon` makes it load-bearing (O(reachable), not O(horizon)) | **Partly.** It predicts its own *recurrence spectrum*, not its big-O in space. Different question, correctly answered. |
| `src/Core/CellScheduler.fs` | DoP=1 deterministic multiplexer; `softStep` runs `DurableYinYang.evolveSoft` → `BonsaiSoft.evalSoft` | **No cost model at all.** |

So: a scheduler is already on a Bonsai evaluation path (`CellScheduler.softStep`), and the budgeting
port already exists. The missing piece is narrow and specific:

> **Nothing in the repo derives a cost from a program.** `Vision.IBranchForecaster` has exactly one
> production implementation — `src/Bayesian/QuantumFusion.fs:421`, over Reticulum observable deltas.
> Every `BranchCost` anywhere is hand-supplied. A scheduler could budget a Bonsai evaluation only if
> someone already knew what that evaluation would cost.

**Correction to the brief.** It said "a PR that reimplements an existing scheduler is a failure" and
asked whether the capability Aaron described already exists. The scheduler exists; the *self*-prediction
does not, in the sense Aaron meant it. `Vision` is a budgeter, not a predictor. That distinction is the
whole gap.

## 3. `BonsaiCost` — the plug, and what is metered about it

`src/Core/BonsaiCost.fs` derives a `Vision.BranchCost` from a `Bonsai.Expr`. It reads the expression
only; it is on no encode/decode path. The recurrence is read directly off `evalSoft`:

| node | width bound | pairs |
|---|---|---|
| `Const` | 1 | 0 |
| `Param p` | `widths[p]` (unbound ⇒ decline, as `evalSoft` declines) | 0 |
| `Binary(op, l, r)` | `w l * w r`, capped at **2** for `Eq/Lt/And/Or` | `p l + p r + w l * w r` |
| `Cond(t, a, b)` | `w a + w b` — soft `Cond` blends **both** branches | `p t + p a + p b` |
| `Lambda` / `Call` | **decline** | — |

The `2` cap is structural, not a fudge: `applyOp` returns `DynamicValue.Bool` on every success path
for those four ops, so at most two distinct candidates survive however wide the inputs. Note it
sharpens **space only** — the work is still `w l * w r` pairs, which is why a narrow `Eq` can still
decline on `PairsOverflow`. Keeping those two apart is the point.

Overflow **declines** rather than caps, because a capped bound is a bound that can be wrong. For a
scheduler the decline *is* the prune: *I cannot bound this, so I will not board it.*

### The falsifier, in both directions

A cost bound needs two independent properties, and they fail in opposite directions:

- **Soundness** — never under-predict. `actual > predicted` is a defect; `actual < predicted` is a
  loose bound and is fine. So the falsifier is *"actual exceeded predicted"*, never *"predicted ≠ actual"*.
- **Non-triviality** — never just predict the ceiling. A model answering `O(2ⁿ)` for everything is
  perfectly sound and completely useless, and useless *here specifically* because pruning runs on the
  predicted cost: a maximal bound prunes everything or nothing.

Mutation-proved, both directions (raw exit codes, `dotnet test … --filter FullyQualifiedName~BonsaiCostTests`):

| mutation | result |
|---|---|
| `Binary` width `wl * wr` → `wl + wr` | **6 / 11 fail**, incl. the soundness property |
| `Cond` width `wThen + wElse` → `max` | **2 / 11 fail**, incl. the soundness property |
| delete the predicate cap (`opWidthCap` → always `None`) | **2 / 11 fail** — soundness still **passes** (looser is still sound); the *tightness* test and the *prune-decision* test catch it |
| `predict` returns `Width = Int64.MaxValue` always (sound, trivial) | **6 / 11 fail** — soundness **passes**, exactly as it should; every non-triviality test fails |
| restored | **11 / 11 pass** |

The last two rows are the ones that matter. A sound-but-useless model passes the soundness property
and is caught only by the tightness cases and by the boarding decision changing. Building only the
obvious test would have shipped a check that a constant function satisfies.

**One defect found in my own test while mutating.** The soundness property originally compared
`actual <= int predicted.Width`; under the `Int64.MaxValue` mutant that `int` conversion wraps to `-1`
and the property failed *for the wrong reason* — a false red that would have read as "the check works."
Fixed to compare in `int64`. Recording it because a falsifier that fires for a reason other than the
one it names is the same class of defect as one that cannot fire at all.

### What is toy, and says so

`Cost.ToyPairs` is the time half — an upper bound on the candidate pairs `evalSoft` enumerates through
`applyOp`. `applyOp` is `private` and uninstrumented, so the actual count **cannot be observed** and
there is **no falsifier**. Per `toy-is-free-metered-must-be-earned.md` the prefix is in the identifier.
Promoting it means threading a counter through `evalSoft` itself (one implementation, never a second
evaluator) — deliberately not done: `BonsaiSoft.fs` is adjacent to contended work and the space half
does not need it.

So the honest register on the module is **split**: `Width` is metered, `ToyPairs` is toy, and the two
travel in the same record with different names precisely so nobody has to remember which is which.

## 4. The `app` verification — the property does NOT hold as stated, and there is still no check

The gate I was given was explicit: write the design constraint **only** if the property holds. It does
not hold in the form it would be written, so here is the measurement instead.

**The literal claim reproduces.** A bare `app` identifier appears **0 times** in F# sources:

```
rg --text --pcre2 '(?<![A-Za-z0-9_.])app(?![A-Za-z0-9_])' --glob '*.fs' src/     # exit 1, no matches
```

**And it is still a one-time grep.** PR #10821 established that the "formal check" was a grep recorded
in prose, specified the minimal lint, and explicitly did not build it. Nothing has changed: there is no
lint, no test, no CI wiring. `rg -l -i 'arrowapply|app-free' src/Core.TypeScript/` returns nothing. A
check that ran in a session and left no artefact is, one commit later, indistinguishable from a check
that never ran.

**The semantic property is false codebase-wide.** Hughes (2000): `ArrowApply ≅ Monad` — an arrow with
`app` has exactly monadic power, and conversely, so `app` is definable in one line over any monad's
Kleisli category. F# sources contain **seven** computation-expression `Bind` members:

```
src/Core/Dsl.fs:48            CircuitBuilder.Bind      ← this one is Vision's
src/Core/Meno.fs:170          MenoBuilder.Bind         ← selects the arrow from a runtime value
src/Core/Result.fs:14         src/Core/SagaBuilder.fs:19,28,37
src/Core/AgentIntegrate.fs:27 src/Core.FSharp.TriBoolean/TriBoolean.fs:80
```

So a rule reading *"the codebase is `app`-free, therefore cost is analysable"* would assert a property
the code violates, and the first reader who opens `Dsl.fs` would learn that the rules are decorative.
That is worse than no rule.

**Why does the grep pass — because nothing tried, or because nothing could?** The right question to ask
of a check that always passes, and it has a measured answer: **nothing tried.** `app` is expressible in
F# today over any of those seven monads, in one line, no HKT required — demonstrated compiling and
running below. So the check is not measuring the language's inability; it is measuring the absence of
anyone having written four tokens. That is a much weaker guarantee than "by construction," and it is
precisely why the enforcement belongs at the read boundary (§4, end) rather than in a spelling grep.

### The tension is real, and the resolution is staging — not nesting

My coordinator anticipated the tension and proposed the resolution as *"the arrow/IR layer stays
`app`-free; an **outer** layer may be monadic."* **That is right in spirit and wrong in direction, and
the direction is the entire safety argument.**

"Outer" says the monad *wraps* the arrow — which at run time would let a runtime value reach into arrow
selection, i.e. precisely the thing being forbidden. What actually holds is **staging**: the monadic
layer is not *around* the analysable layer, it is *earlier in time*, and it has already finished before
analysis begins.

`CircuitM<'T> = delegate of Circuit -> 'T` (`src/Core/Dsl.fs:41`) is a lawful **Reader monad**, and
`Vision`'s computation expression is literally that builder — `VisionComputation.vision = Dsl.circuit`
(`src/Core/Vision.fs:469`). So **Vision genuinely is a monad**; the tension is not dissolved by denying
it. What saves analysability is that `CircuitM.Invoke` runs **once, at graph-construction time**, and
its output is a first-order dataflow graph. The bind chooses *which operators to wire*; it never
chooses what a *datum* does at run time.

**The boundary, named concretely:** `CircuitM.Invoke` — before it, staged monadic construction; after
it, a first-order artefact. `Bonsai.Expr` is the same boundary in data form: the F# that *constructs*
an `Expr` may be arbitrarily monadic; the `Expr` itself has no field of function type, and that is what
`BonsaiCost` reads.

### "Is `Vision` a proper monad?" — instance yes, abstraction no, and only one of those matters here

Aaron 2026-08-15: *"it's probably not a proper monad — F# is not great at this, we probably hacked it
into a computation expression. More reason I think we need higher-kinded types to do proper monads like
Haskell."* He flagged it as a hedge, so it was measured rather than adopted. The answer splits, and the
two halves point opposite ways:

- **As an instance: it is a lawful monad, and the CE is not a hack.** `CircuitM<'T> = Circuit -> 'T`
  with `Bind(m, f) = fun c -> (f (m c)) c` and `Return x = fun _ -> x` is the textbook Reader monad,
  and `Bind`/`Return` is the standard CE desugaring, not a workaround. *Checked, not inferred* — an
  `fsi` probe reconstructing the exact builder shape from `src/Core/Dsl.fs:45-55` evaluates left
  identity, right identity and associativity to `true true true` (`dotnet fsi`, exit 0). The probe is
  reproduced in full at the end of this section so the check leaves an artefact rather than a memory.
- **As an abstraction: there is none, and Aaron is exactly right.** F# cannot write `'M<_>` as a type
  parameter, so there is no `Monad` typeclass — seven builders, seven unrelated `Bind`s resolved by
  *name* per builder type. That is the real HKT motivation and it stands.

**Correction to my coordinator's Consequence 1.** It was proposed that under Aaron's reading the tension
*dissolves* — that `Vision` is not a monad in the sense `ArrowApply ≅ Monad` is about, so there is
nothing to reconcile. **That inference does not hold.** Hughes's theorem is about a *particular* arrow
and a *particular* monad; it never quantifies over an abstraction. `app` for this monad's Kleisli arrow
is one concrete line, needs no HKT, compiles today, and **runs** — the same probe defines

```fsharp
type Arr<'a, 'b> = 'a -> CircuitM<'b>
let app<'a, 'b> : Arr<Arr<'a, 'b> * 'a, 'b> = fun (f, a) -> f a
```

and applies it, selecting the continuation from a value flowing through the arrow. So the tension is
real and is resolved by **staging** (above), not by the absence of an abstraction.

**Correction to Consequence 2 — the premise is false, the obligation is real.** It was put to me that
the `app`-free property is currently enforced by *the language's inability*, so HKT would flip it from
free to earned (`interfaces-free-classes-earned-under-rules.md` applied to expressive power). The framing
is a good one and the conclusion survives, but **the premise does not**: F# can express `app`
per-type today, in one line, as just demonstrated. Nothing has been preventing it. Nobody wrote it.

What HKT actually changes is **the scope of a single definition**. Today `app` costs one line *per
monad* and is therefore an explicit, local, reviewable act. After HKT it can be written **once,
generically**, and applies to every instance in the repo simultaneously — the blast radius goes from
opt-in-per-type to universal-by-default. So the honest statement is not *"language-enforced → earned"*
but:

> **Today `app` is per-type and unwritten; after HKT it is one generic definition away from everywhere.**
> The obligation the HKT work takes on is to keep the analysable fragment's read boundary enforced
> *explicitly*, because the cheapness of the violation goes up by the number of monads in the tree.

**Where this needs to land, and it is not only here.** The HKT effort carries its own design goals, and
a constraint that changes cost under a planned language change is exactly what gets discovered after the
guarantee is gone. Two existing in-repo surfaces are the right homes —
`docs/backlog/P2/081KRMEXM0008QG0R001VGNET5-intelligent-compiler-recursive-hkt-clifford-fsharp-fork-rosl.md`
(the F#-fork / recursive-HKT row) and
`docs/backlog/P1/081KT2T2J0008QG0R0038CRFJM-conform-everything-to-the-minimal-hkt-composing-vocabulary-i.md`
(the minimal HKT-composing vocabulary row). Neither is edited here: adding a design obligation to
someone else's open row is not inside standing authority for this task, and no HKT design doc is created
unilaterally. **Flagged for Aaron to route.**

### The probe, in full — so the check leaves an artefact

PR #10821's finding was that a check run in a session and recorded in prose is indistinguishable, one
commit later, from a check that never ran. This one is therefore reproduced rather than reported.
`dotnet fsi` on the following exits 0 and prints `app applied: probe:42` /
`monad laws (left/right/assoc): true true true`:

```fsharp
type Circuit = { Name: string }
type CircuitM<'T> = delegate of Circuit -> 'T

// The exact builder shape from src/Core/Dsl.fs:45-55.
type CircuitBuilder() =
    member inline _.Return(x: 'T) = CircuitM(fun _ -> x)
    member inline _.Bind([<InlineIfLambda>] m: CircuitM<'T>, [<InlineIfLambda>] f: 'T -> CircuitM<'U>) =
        CircuitM(fun c -> (f (m.Invoke c)).Invoke c)
let circuit = CircuitBuilder()

// The Kleisli arrow of that monad, and Hughes 2000's `app :: a (a b c, b) c`.
type Arr<'a, 'b> = 'a -> CircuitM<'b>
let app<'a, 'b> : Arr<Arr<'a, 'b> * 'a, 'b> = fun (f, a) -> f a

let c = { Name = "probe" }
let chooser : Arr<int, string> = fun n -> CircuitM(fun ctx -> sprintf "%s:%d" ctx.Name n)
printfn "app applied: %s" ((app (chooser, 42)).Invoke c)

let run (m: CircuitM<'T>) = m.Invoke c
let ret x = circuit.Return x
let k (x: int) = ret (x + 1)
let h (x: int) = ret (x * 2)
let leftId  = run (circuit.Bind(ret 5, k)) = run (k 5)
let rightId = run (circuit.Bind(ret 5, fun x -> ret x)) = run (ret 5)
let assocL = run (circuit.Bind(circuit.Bind(ret 5, k), h))
let assocR = run (circuit.Bind(ret 5, fun x -> circuit.Bind(k x, h)))
printfn "monad laws (left/right/assoc): %b %b %b" leftId rightId (assocL = assocR)
```

Honest limit on it: the law checks are at **one sample point**, not a property test — enough to refute
*"probably not a proper monad"*, not enough to be called a proof. The `app` definition needs no such
caveat: it either compiles and applies or it does not, and it does.

### The constraint that IS true, and is mechanically enforced today

Stated at the scope where it holds:

> Cost is statically analysable exactly over the fragment in which **no runtime value selects the next
> computation**. Enforce it *where the analysis reads*, not globally: the analysed artefact must be
> first-order defunctionalized data, and every higher-order constructor must **decline** rather than be
> silently costed.

For the Bonsai fragment this is not aspirational — it is executable. `Expr`'s higher-order
constructors are `Lambda` and `Call`; `BonsaiSoft.evalSoft` declines both, and `BonsaiCost.predict`
declines both with `UnsupportedNode`. The test `predict declines exactly where evalSoft declines
structurally` pins the agreement. If someone implements `Call` in `evalSoft`, that test goes red and
the cost model's domain becomes an explicit decision rather than a silent mis-prediction. **That is
the falsifier PR #10821 specified, built at the one place the analysis actually depends on it** — a
40-line allowlist lint over module names would have been a proxy for the property; this is the property.

Note the honest limit: it guards *this* analysis. It says nothing about `Meno.fs` or `SagaBuilder.fs`,
and it should not pretend to.

### Draft carved sentence — **not added as a rule; Aaron calls it**

Per `rules-are-small-carved-sentences-pointing-to-docs.md` and the razored-additions convention, the
candidate is drafted here only:

> **Static cost analysis is a property of the artefact, not of the codebase.** A scheduler can predict
> its own big-O and prune only over a fragment where no runtime value selects the next computation
> (Hughes: `ArrowApply ≅ Monad`, so granting `app` grants exactly the power that destroys it). Monadic
> *builders* are fine and we have seven — they run at an earlier stage and emit a first-order artefact.
> Enforce at the read boundary: the analysed artefact is first-order, and every higher-order
> constructor **declines**. `app` is one line per monad today and one generic line after HKT — the
> guard is the read boundary, never the absence.

Note what the last clause is doing: it keeps the sentence true both before and after HKT lands, so the
rule does not need rewriting at the moment its cost model changes. A carved sentence whose truth depends
on the current language version is a sentence that expires silently.

## 5. Correction: sensor fusion does not depend on this at all

Aaron's framing was that the constraint is *"what makes our Vision monad and sensor fusion even
possible."* The Vision half is supported once restated as staging (§4). **The sensor-fusion half is
not supported.**

`src/Core.TypeScript/bayesian/sensor-fusion-oracle.ts` is 218 lines of first-order pure functions —
`computePlv`, `ivFuse`, `detectTangle`, `fuseSensors` — over plain numeric records. No arrow, no monad,
no computation expression, nothing higher-order anywhere; there is no F# sibling (`rg` for
`fuseSensors|ivFuse|sensorFusion` across `src/` and `tests/` hits only that file and its test). It
satisfies the constraint **vacuously**, because it never had the opportunity to violate it. It would
work identically if `app` existed in every module in the repo.

Its actual enabling conditions are different ones: inverse-variance weighting needs the two sources to
be *independent* (hence the PLV > 0.9 groupthink block, which is a statistical-independence guard, not
a type-theoretic one) and Student-t / Kuramoto robustness weights for heavy tails. Independence of
evidence and app-freeness of arrows are unrelated properties that both happen to be about "one thing
not secretly determining another." Recording the correction because a constraint justified by an
example that does not depend on it is a constraint nobody will believe the second time.

## 6. What remains — and the distinction that makes it a real gap

Aaron, 2026-08-15:

> *"for prune to fully be realized we have to tie our Bayesian factor graphs and/or our BNNs into the
> scheduler so different alternative futures can be theorized and pruned. I don't think we have this
> yet — this is future work, but very very important for implementation of Rodney's Razor."*

**The distinction is real and must not be conflated:**

- **Cost-bound pruning** — drop a branch whose predicted cost blows up. Prunes *within one plan*.
  Needs only a cost model. That is what `BonsaiCost` + `Vision.predictBranches` do.
- **Possibility-space pruning (Rodney's Razor)** — choose among alternative plans *that do not exist
  yet*. Requires representing counterfactual futures, which is inference, not bookkeeping.

**A scheduler with a perfect cost model still cannot do Rodney's Razor**, because it has nothing to
compare against. Nothing shipped here should be read as satisfying it.

**Correction to my coordinator's premise, from measurement.** The gap was framed as "is there
genuinely no path from the Bayesian layer to any scheduler?" There is one, and it is complete on the
F# side:

```
PredictionInference.Candidate {Prior; Likelihood; Cost}      (src/Core/PredictionInference.fs:16)
  → infer          exact rational posterior = prior × likelihood, deterministically ranked
  → rankWithPriority   boarding weight = posterior × attention × gravity
  → Vision.predictBranches       board the affordable prefix, DEFER the rest
  → PredictionScheduler.Planned  → SoftScheduler.HandlerK
```

So the scheduler **already takes a distribution rather than a scalar cost** — exact rationals via
`ProbabilitySemiring`, and `QuantumFusion.reticulumForecaster` (`src/Bayesian/QuantumFusion.fs:421`)
already feeds it Beta posteriors through the declared port. The direction of dependency is
`Bayesian → Core.Vision`, which is the right way round.

What is actually missing is narrower, and therefore cheaper:

1. **The candidate generator.** `PredictionScheduler.CandidateEstimator` is caller-supplied, and there
   is no production implementation that *derives* candidates with priors from a learned generative
   model. Priors and likelihoods are hand-supplied at every call site. That is the "alternative futures
   are theorized" half, and it is genuinely absent.
2. **The TypeScript Bayesian layer is disjoint.** `src/Core.TypeScript/bayesian/` — `bnn-persistence.ts`,
   `shiva-weak-factor-graph.ts`, `categorical-bayesian-planner.ts` (which contains
   `BayesianHierarchicalSearch`, an actual candidate search) — contains **zero** references to
   `Vision`, `BranchCost`, `FutureBranch`, `predictBranches`, or any scheduler. It is consumed only by
   `planning/society-bnn.ts` and `planning/society-heat-readout.ts`.

So the item is **"finish it," not "build it."** The missing edge is one `CandidateEstimator` backed by
a generative model, against a scheduler-side interface that already exists and already accepts a
posterior. Minted as a work-item rather than implemented, per Aaron's scoping.

### On the "three gaps of the same shape" observation — coincidence, kept as one

It was put to me that this is the third instance of a pattern: Bonsai↔codegen (four oracles, zero
emitters — PR #10829), Bonsai↔scheduler (this work), BNN↔scheduler. **My own measurement weakens it.**
The third instance is *not* two rungs with no edge — the F# edge exists and carries a posterior; only
the TS half is disjoint and only the generator is missing. And I did not verify the first instance at
all.

Per `numerology-vs-number-theory.md`: a count of three similar-looking gaps, one of which I measured
to be a different shape and one of which I did not measure, is a **coincidence-index entry**, not a
structural finding. Recorded with its register attached so it can be promoted later if someone supplies
the structure — and so it never silently becomes a belief. The generator half of coincidence-spotting
is doing its job here; the conclusion half is not licensed.

## 6b. One process note: this file is not lint-covered, and that is deliberate

`bunx markdownlint-cli2` on this file exits **0 having linted nothing** — verified by appending a
deliberate MD022/MD009 violation, re-running, and getting exit 0 with empty output both times, with the
literal-path (`:path`) form too. The cause is not a tooling bug: `.markdownlint-cli2.jsonc` ignores
`docs/research/2026-*-*.md` by explicit decision (081KQ8P5D0008QG0R002SBGJXX, 2026-05-10 — the
date-prefix *is* the verbatim-ferry naming convention, and 82+ such files carry legitimate violations
because they are preserved verbatim).

Recorded because "I linted it and it passed" would have been a false report of the same shape this
document is otherwise about: a check that cannot fail, reported as one that succeeded. Anyone verifying
prose under `docs/research/2026-*` must read it, not lint it.

## 7. Anchors (checked, not merely cited)

- **John Hughes, *Generalising Monads to Arrows*, Sci. Comput. Program. 37(1–3), 2000.** Source of
  `arr`/`>>>`/`first`, of `app` / `ArrowApply`, of `ArrowApply ≅ Monad`, and of static analysability as
  the stated motivation for the weaker interface. *Entailment checked:* the paper supports every use
  made of it above, including `Kleisli m` as an `ArrowApply` instance for any monad `m` — which is why
  §4's seven `Bind` members are load-bearing evidence and not a technicality.
- **Reynolds, *Definitional Interpreters* (1972) — defunctionalization.** The reason a first-order
  `Expr` is analysable where a closure is not: the higher-order part has been replaced by a data
  constructor, and `BonsaiSoft` declining `Lambda`/`Call` is that boundary drawn at the evaluator.
- **Artin–Mazur zeta** — `SchedulerZeta.predict`'s recurrence spectrum; cited here only to distinguish
  it from big-O prediction, which it is not.

## 8. Pointers

- `src/Core/BonsaiCost.fs` — the cost model and the `Vision.IBranchForecaster` wiring
- `tests/Tests.FSharp/Bonsai/BonsaiCost.Tests.fs` — soundness property + tightness + prune-decision tests
- `src/Core/Vision.fs:155,288,195` — `BranchCost`, `predictBranches` (the prune), `IBranchForecaster` (the port)
- `src/Core/PredictionInference.fs:16-31` — the posterior-ranked candidate path that already exists
- `src/Core/SchedulerZeta.fs:36,59` — recurrence self-prediction (a different question, correctly answered)
- `src/Core/Dsl.fs:41-55` · `src/Core/Vision.fs:469` — the Reader monad, and Vision re-exporting it
- `docs/research/2026-08-15-the-app-free-fragment-was-a-one-time-grep-not-a-check-and-by-construction-is-false-for-isr.md` (PR #10821) — the prior measurement this confirms and extends
- `.claude/rules/toy-is-free-metered-must-be-earned.md` · `.claude/rules/numerology-vs-number-theory.md` — the registers applied above
