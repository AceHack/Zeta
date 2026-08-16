# The TypeScript half of the candidate-generator item has no far shore — and no near shore either

**Date:** 2026-08-15 · **Author:** shadow (Otto's shadow-work role) · **Register:** measurement + a refusal to build
· **Status:** **metered** as a statement about the import graph — every number below is a re-runnable `rg` over a
named commit, and each is falsified by a single counter-example anyone can produce. **No model, no estimator, and no
crossing was built**, so nothing here carries a `toy`/`unmetered` claim about prediction quality.

**Measured at:** `71af4c447` (`origin/main`, 2026-08-15).

Reads on: work item `081M03CKBBX087G0R003M24FGG` (gap 2, the TypeScript crossing) · PR #10845 (the F# half, open) ·
PR #10835 (`BonsaiCost`, open) ·
`docs/research/2026-08-15-inject-the-scheduler-at-the-evaluation-seam-not-the-encoding-seam-and-what-the-app-free-claim-actually-survives.md`
(**deliberately not a link — that file is on #10845's branch and does not exist on `main` yet**) ·
`.claude/rules/interfaces-free-classes-earned-under-rules.md` ·
`.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md` ·
`.claude/rules/toy-is-free-metered-must-be-earned.md`

***

## 0. The short version

The work item's gap (2) reads: *"the TypeScript Bayesian layer is disjoint — `src/Core.TypeScript/bayesian/` has zero
references to `Vision`, `BranchCost`, `FutureBranch`, `predictBranches`, or any scheduler."* That statement is
**true**, and it was written as though it named a missing edge. Measured from both ends, it names a missing
**graph**: there is no scheduler on the TypeScript side to cross *to*, and two of the three modules named as the
thing to cross *from* have no callers of any kind.

1. **No far shore.** Zero TypeScript files reference any scheduler-side vocabulary — `predictBranches`,
   `FutureBranch`, `BranchCost`, `SoftScheduler`, `PredictionScheduler`, `CandidateEstimator`, `IBranchForecaster`,
   `rankWithPriority`. Not one. The four things named `*scheduler*` in TypeScript schedule **lanes, cron ticks and
   Windows tasks**; none of them accepts a candidate set, a prior, a likelihood, or a cost.
2. **No near shore.** Of the three modules the item names, `shiva-weak-factor-graph.ts` and
   `categorical-bayesian-planner.ts` have **zero importers anywhere in the repo**, and `sensor-fusion-oracle.ts` has
   zero as well. The whole directory has exactly **two** inbound module specifiers, both to `bnn-persistence.ts` and
   both from `planning/society-bnn.{ts,test.ts}` — and that is **serialization, not inference**.
3. **The one "candidate search" in the directory structurally cannot supply a candidate set.**
   `BayesianHierarchicalSearch` argmaxes internally and returns **one plan**. The alternatives are destroyed inside
   the function. A scheduler cannot rank, board, or defer what it is never handed.
4. **Redundant, not missing.** `src/Bayesian/` is **43 F# modules** including `FactorGraph.fs`, `Ep.fs`,
   `MinimalBnn.fs`, `MultilayerBnn.fs`, and `QuantumFusion.fs` already feeds the declared `Vision.IBranchForecaster`
   port. The Bayesian-layer-to-scheduler edge the item asks for **already exists, in F#**. The TypeScript directory
   is a parallel partial reimplementation, not the layer that is missing a wire.

**So gap (2) is mis-specified, and the item should close on it rather than stay open waiting for a bridge whose
far bank does not exist.** What is *not* being claimed: that no useful work exists nearby. §5 names a real,
different, currently-live surface — and says why it is a different work item and why building it today would
reproduce exactly the defect the parent item was opened to remove.

***

## 1. What is actually in `src/Core.TypeScript/bayesian/`

Four modules, four test files, 1660 lines.

| module | what it computes | inbound importers |
|---|---|---|
| `bnn-persistence.ts` | serialize/deserialize `DimensionalBnn` to `docs/observe-events/bnn-state.json`; `tangleBreakObservation` | **1** (`planning/society-bnn.ts`) |
| `sensor-fusion-oracle.ts` | PLV between two series, inverse-variance fusion of two `OracleResult`s, tangle detection | **0** |
| `categorical-bayesian-planner.ts` | commutative log-factor combination, Shannon entropy, `BayesianHierarchicalSearch` over a grid | **0** |
| `shiva-weak-factor-graph.ts` | deterministic mark-sweep GC, `WeakRef` factor cache, Futamura-1 specialization, Student-t factor generator | **0** |

Reproduce:

```bash
rg --text -U -c 'from\s+"[^"]*bayesian/' -g '*.ts' src/
# src/Core.TypeScript/planning/society-bnn.test.ts:1
# src/Core.TypeScript/planning/society-bnn.ts:1
```

Two lines. That is the entire inbound edge set of the directory, and both point at the serializer.

### A correction to the work item's own text, and to my first pass

The item states the directory *"is consumed only by `planning/society-bnn.ts` and `planning/society-heat-readout.ts`."*
The second half is **wrong**: `society-heat-readout.ts` mentions `bayesian/bnn-persistence.ts` in a **prose comment**
(line 23) and imports nothing from it. Its actual `DimensionalBnn` import is from `./error-bnn-bridge`. Four other
files (`discovery/zeta-agent.ts`, `discovery/zeta-transport-cell.ts`, `ferry-throttler/four-corner-feedback.ts`,
`algebra/exact-weight.ts`) likewise **name** these modules in comments while importing nothing from them — which is
how a directory can look wired while being an orphan.

**And my own first measurement was wrong in the opposite direction.** I searched `^import .*bayesian` and reported
*zero* importers for the whole directory. That regex cannot see a multi-line import — `society-bnn.ts` opens its
import on line 25 and the specifier lands on line 31 — so I had produced a **check that could not find what it was
looking for, reported as a check that found nothing there.** Same vacuity class this thread keeps finding. The
corrected search matches on the module specifier itself and is the one quoted above; every count in this document
comes from that form.

***

## 2. No far shore: what TypeScript actually schedules

```bash
rg --text -c 'predictBranches|FutureBranch|BranchCost|SoftScheduler|PredictionScheduler|CandidateEstimator|IBranchForecaster|rankWithPriority' -g '*.ts' src/Core.TypeScript/
# (no output; rg exit status 1 = no matches)
```

Every file in TypeScript named for scheduling, and what it consumes:

| module | input | decides |
|---|---|---|
| `ferry-throttler/drain-scheduler.ts` | `LaneSnapshot { hasWork, queueDepth, bytesQueued, drainCount }` | which **lane** index to drain next (strict priority, or deficit round robin) |
| `ferry-throttler/heat-aware-scheduler.ts` | the same, plus a `TemperatureBand` | the same, with AIMD weight decay under heat |
| `zetadb/scheduled-node.ts` | a journal file and a checkpoint | **nothing** — it runs one tick when invoked |
| `service/adapters/task-scheduler.ts` | an XML template | Windows Task Scheduler installation |

None of these carries a prior, a likelihood, a cost, or more than one candidate future. `drain-scheduler` selects
among lanes **that already have queued work** — it is a fairness discipline over an existing multiset, which is not
even cost-bound pruning, let alone possibility-space pruning. Handing it a posterior would require inventing a
meaning for one.

**A scheduler that takes a distribution is exactly what the F# side has and the TypeScript side does not.** That is
the finding, and it is the whole reason the crossing has no destination.

***

## 3. The near shore destroys its own alternatives

`categorical-bayesian-planner.ts` is the module the work item points at as *"an actual candidate search"*, and it is.
But its signature ends the discussion:

```
BayesianHierarchicalSearch(...) -> {
  totalStatesExplored : number
  plan                : readonly string[] | null      // ONE plan
  jointLogLikelihood  : number
  finalUncertaintyEntropy : number
}
```

Inside, both levels keep only a running best (`bestCoarsePath` / `bestSubPlan`, replaced whenever `logP` improves)
and every rival is dropped on the floor. By the time the function returns, **the possibility space it searched no
longer exists.** A consumer receives a decision, not a distribution — so even if a TypeScript scheduler appeared
tomorrow, this function could not feed it without being rewritten to return its frontier.

This is worth stating plainly because it inverts the item's framing: the TypeScript planner is not a candidate
*generator* waiting for a consumer. It is a **complete pruner** that already made the choice, using entropy only to
size its own search budget (`maxStatesPerBlock = floor(500 * (1 + H))`). It is the cost-bound half again, in another
language.

Two further structural facts, for anyone tempted to compose the directory with itself:

- `CategoricalFactorTensor` appears in **exactly two files** — its own module and its own test. Nothing constructs
  one outside a test.
- `shiva-weak-factor-graph.ts`'s `FactorGenerator = (stateKey: string) => number` and the planner's
  `CategoricalFactorTensor { logProbabilities: ReadonlyMap<string, number> }` are **different types with no adapter**.
  The two "factor graph" modules in one directory do not compose with each other, and never have.

***

## 4. Redundant, not missing

`src/Bayesian/` is 43 F# modules. `FactorGraph.fs`, `Ep.fs`, `MinimalBnn.fs`, `MultilayerBnn.fs` cover what the
TypeScript directory sketches; `QuantumFusion.fs:421` is the one production `Vision.IBranchForecaster`; and after
PR #10845, `CandidateGeneration.estimator` supplies a `PredictionScheduler.CandidateEstimator` from an MDL-prior
generative model with an evidence-driven likelihood.

So the edge *"Bayesian layer → scheduler"* is not missing from the repo. It is present, in the language where both
endpoints live. What gap (2) actually describes is **a second, partial Bayesian layer in a second language, with no
scheduler in that language** — and the honest name for that is duplication with an unfinished half, not a missing
crossing.

Whether the TypeScript modules should be deleted, wired, or left as a sketch is a **separate decision that is not
made here.** Two of them are recent and may be someone's live direction; that call belongs to their author, not to
an audit passing through.

***

## 5. The one real surface nearby — and why it is a different item

There *is* a live TypeScript decision surface with a declared pluggable scorer and a production caller. Recording it
is the point of this section; **building it today is not**, for reasons given below.

```
service/loop-tick.ts:346   await choose(world, { composer: defaultComposer })
observe/chooser.ts:44      interface ComposerBackend { score(menu, world): Promise<readonly number[]> }
observe/composer.ts:66     heuristicComposer — five hand-set weights, no falsifier
```

`chooser.ts`'s own docstring calls the L2 tier *"Bayesian/heuristic scoring"* and its config comment offers
*"(Bayesian scorer / local LLM)"*. The port is real, it is called on every autonomous tick, and its only
implementation is `readiness 0.3 / priority 0.2 / modeCoherence 0.25 / forgeBoost 0.15 / operatorBoost 0.1` —
constants with nothing able to refute them.

**Why this is not the work item, and why backing it with the existing TypeScript BNN today would be a regression:**

- **It is a chooser, not a scheduler.** It picks one action from a menu and escalates on low confidence. It has no
  cost model, no budget, and no defer — so it performs neither of the two prunings the parent item distinguishes.
- **Its menu is supplied, not generated.** `buildMenu(world)` enumerates from the world; a scorer re-weights what is
  already there. Swapping the scorer changes the *ranking*, never the *possibility space* — Rodney's Razor is
  untouched by construction.
- **The TypeScript BNN's posterior is over the wrong thing.** `error-bnn-bridge.ts` maintains a Student-t posterior
  per **error dimension** (`schema`, `type`, `range`, `constraint`, `auth`, `transport`, …) — *"how badly calibrated
  is my teaching on dimension d."* It is not a posterior over actions or outcomes. To use it as a candidate
  estimator, the prior and likelihood for each menu action would have to be **hand-written by whoever wires it** —
  which is precisely the *"priors and likelihoods are hand-supplied at every call site"* defect the parent item was
  opened to remove, relocated to another language and called progress.
- **`confidence` there is a score gap, not a posterior.** `(max − secondMax) / max`. Renaming it would be the
  silent-promotion failure in one line.

If someone does take this up, the bar from PR #10845 applies unchanged and is the reason it is not trivial: the
scorer must produce alternatives that **differ**, and `costRatio = 1.000` on `occamSituation` is the reference for
what a generator looks like when a perfect cost model has nothing to decide with.

***

## 6. Why nothing was built

Three rules point the same way, and the precedent is one PR old.

- **`interfaces-free-classes-earned-under-rules.md`** — an implementation is a privilege earned under a rule. A
  `CandidateEstimator` in TypeScript would have no caller in TypeScript, so there is nothing to earn it.
- **`only-the-irreducible-is-primitive-generate-the-rest.md`** — the generator already exists at the irreducible
  end, in F#. A second one in a language with no consumer is not generation; it is a duplicate frozen special case.
- **`toy-is-free-metered-must-be-earned.md`** — an estimator with no workload and no falsifier is `unmetered` at
  best. Wiring an unmetered model into `loop-tick`'s live action selection would make agent behaviour depend on a
  model nothing can refute, which is strictly worse than the hand-set constants it replaced, because it would *look*
  principled.

PR #10844, asked to reprice a composition operator, answered *"do not build it — an operator with no caller is
speculative API design."* Same answer here, from the other end of the same razor: **a bridge with no far bank is
speculative infrastructure**, and the fact that a work item names it does not conjure the far bank into existence.

**What would change this answer**, stated so it is falsifiable rather than a permanent refusal: a TypeScript
consumer that takes **more than one** candidate and **defers** some of them under a budget. The moment such a
consumer exists, the crossing has a destination and this document is obsolete. Until then the honest state of gap
(2) is *closed as mis-specified*, not *open and waiting*.

***

## 7. Reproduction

```bash
git rev-parse --short HEAD                              # 71af4c447

# (1) every inbound module specifier into bayesian/  -> 2 lines, both bnn-persistence
rg --text -U -c 'from\s+"[^"]*bayesian/' -g '*.ts' src/

# (2) scheduler-side vocabulary in TypeScript        -> no matches, rg exit 1
rg --text -c 'predictBranches|FutureBranch|BranchCost|SoftScheduler|PredictionScheduler|CandidateEstimator|IBranchForecaster|rankWithPriority' -g '*.ts' src/Core.TypeScript/

# (3) CategoricalFactorTensor                        -> its own module + its own test only
rg --text -n 'CategoricalFactorTensor' -g '*.ts' src/

# (4) the live chooser call site
rg --text -n 'defaultComposer' -g '*.ts' src/Core.TypeScript/service/loop-tick.ts
```

Each is a single command whose output is quoted above. A single counter-example — one importer of
`shiva-weak-factor-graph.ts`, one TypeScript symbol named `predictBranches` — falsifies the section it appears in.
