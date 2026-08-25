# The layer graph already exists — three unwired seams between Rx, Soft, and Bayesian

**Date:** 2026-08-25
**Status:** a map with citations, not a proposal. Every claim below is a file:line
that exists today; the design questions are flagged as questions.
**Occasion:** Aaron described a click/drag input layer, object-recognition layers,
Rx joins for drag-and-drop, Bonsai representation, DynamicValue, a bridge to
Bayesian via soft values, and — the load-bearing part — *"a layer system where a
higher layer can reference multiple parallel lower layers, not just linear but
more like a graph, and different games have different input layers that higher
layers can optionally work with."*

The finding is that **most of that is built and none of it is connected.**

---

## 0. The short version

| what was asked for | what exists | state |
|---|---|---|
| layers as a graph, higher reads several lower | `FactorGraph.Factor<'M>` with `Neighbors: int list` — `src/Bayesian/FactorGraph.fs:33` | **built, generic, unused for agent layers** |
| a layer reading multiple lower layers | `MultilayerBnn.skipSourcesFor` — `src/Bayesian/MultilayerBnn.fs:156` | **built, with a stated approximation limit** |
| Rx joins for mouse drag-and-drop | `RxJoin.groupJoin` — `src/Core/Rx.fs:470` | **built; expresses down→move*→up today; nothing outside its own tests consumes it** |
| Bonsai representation | `Bonsai.Expr` + `BonsaiSoft.evalSoft` — `src/Core/Bonsai.fs:59`, `src/Core/BonsaiSoft.fs:85` | **built, four-oracle byte-locked** |
| DynamicValue underneath | `src/Core/DynamicValue.fs:82` | **built; references Rx nowhere** |
| soft values bridging to Bayesian | `SoftValue.observe` — `src/Core/SoftValue.fs:135` | **built as a Bayesian update over a DISCRETE distribution** |
| **soft → `Zeta.Bayesian`** | — | **THE GAP. No converter exists.** |
| optional per-game input layers | — | **not built; no `Layer` type exists at all** |

Two of the three seams are wiring. The third is a genuine design problem.

---

## 1. The graph-of-layers is already the factor graph

The request was for layers that form a graph rather than a stack. That type is in
the tree:

```fsharp
type Factor<'M> =                                    // src/Bayesian/FactorGraph.fs:33
    { Neighbors: int list
      ComputeMessages: Map<int, 'M> -> Map<int, 'M> }
```

**A "higher layer that reads N lower layers" is a `Factor` with N neighbours.**
There is no hierarchy to build — belief propagation over a factor graph *is* the
non-linear layer composition, and `runToFixpointDamped` (`FactorGraph.fs:211`)
already handles the loopy case that a graph (unlike a stack) creates.

`MultilayerBnn` is the worked instance:

```fsharp
type Topology = Sequential | SkipConnections of (int * int) list   // MultilayerBnn.fs:86
```

`skipSourcesFor` (`MultilayerBnn.fs:156`) returns *"the extra sources that layer
`i` receives from skip connections, in addition to the sequential feed from layer
i-1"*, combined by Gaussian `convolve` (`:161`). That is literally the requested
shape, and the file states its own limit (`MultilayerBnn.fs:62-66`): under
`SkipConnections` the graph is loopy, the backward sweep only travels sequential
links, so it is a **first-order approximation**, with `runToFixpointDamped` named
as the upgrade.

**So the graph question is not "how do we build this" but "do we adopt it".**

### The counter-position is also already in the tree

`src/Bayesian/ThousandBrains.fs:11` argues the opposite: *"intelligence is not
a single hierarchical model, but thousands of independent 'columns' that vote on
the identity of objects."* `Column` (`:29`), `Vote` (`:37`), lateral EP voting,
**no stack at all**.

This matters before committing. A hierarchy and a voting population are different
bets about where competence comes from, and both are represented here. The
factor-graph framing is arguably the reconciliation — a flat population *is* a
factor graph with no depth — but that should be said deliberately rather than
discovered later.

---

## 2. Drag-and-drop is `groupJoin`, and it is sitting unused

`RxJoin` was added 2026-08-24 (PR #14836). Before it, `Rx.fs` had **no
combinators at all** (`Rx.fs:130-137`). It now carries `zip`, `combineLatest`,
`withLatestFrom`, `groupJoin`, `join`, `zipBounded`, `durationAfter`.

The relevant one:

```fsharp
groupJoin left right (leftDuration: 'L -> IObservable<'LD>)
                     (rightDuration: 'R -> IObservable<'RD>)
                     (selector: 'L -> IObservable<'R> -> 'O)    // Rx.fs:470
```

Its own header (`Rx.fs:458-469`) describes the semantics as *"for each LEFT
element emit `selector left window`, where `window` carries every RIGHT element
alive while that left element is alive."*

**That is down→move*→up.** `groupJoin downs moves (fun _ -> ups) (fun _ ->
Observable.Empty()) (fun down window -> gesture down window)` yields, per
mouse-down, a stream of the moves that occurred before the matching up. No
`switchMap` needed — and `switchMap` does not exist here (verified: no
`switchMap`, `selectMany`, `takeUntil`, `window`, `buffer`, `merge`, `scan`,
`sample`, `throttle`, or `debounce` anywhere in owned code).

**Nothing consumes `groupJoin` outside `RxJoin.Tests.fs`.** The first real
consumer being a click/drag gesture layer is a good fit, and it costs no new
operators.

One constraint to respect (`Rx.fs:36-49`): Core's composition is deliberately
pull/fold-based. `RxAdapter` and `RxJoin` are the *only* push surfaces, and every
inner subscription is owned by a `CompositeDisposable` returned to the caller. A
gesture layer must not smuggle a second push surface in beside them.

**Honest caveat:** `RxAdapter.Tests.fs` has 3 tests, **all skipped** (`:20,32,55`)
since 2026-06-12 — the circuit pump wedges the vstest host. The race they covered
is fixed at `Rx.fs:67-71`, but those falsifiers do not run. `RxJoin.Tests.fs` (622
lines) is live and does run, including a negative control at `:573` that scans
`Rx.fs`'s own source text asserting `RxJoin` names no wall-clock API.

---

## 3. The real gap: `SoftValue` and `Zeta.Bayesian` have no converter

This is the one that is not wiring.

`SoftValue` (`src/Core/SoftValue.fs:42`) is a **normalized probability
distribution over `DynamicValue` candidates** — discrete, categorical, backed by a
sparse `WeightedSet`. Its `observe` (`SoftValue.fs:135`) **is** a Bayesian update:
posterior ∝ prior · likelihood, renormalized, and independent observes commute
(`SoftValue.fs:13-17`).

`Zeta.Bayesian` is **continuous Gaussian message passing** — `Gaussian`,
`MinimalBnn`, `FactorGraph`, with `IMessage<'M>` (`src/Bayesian/Message.fs:55`)
defining product as natural-parameter addition and divide as the EP cavity.

`docs/VISION.md:3117-3123` names the three-layer certainty architecture with
*"**Soft (SoftValue): Bayesian uncertainty, weighted candidates, pre-measurement.
The live network**"* in the middle. `docs/specs/four-lane-seven-lang-matrix.md:14`
names "Soft-Bayesian" as a lane, implemented as `softBayesianMix`
(`src/Core.TypeScript/algebra/soft-mix.ts:139`).

**And there is no call path from `Zeta.Core.SoftValue` to `Zeta.Bayesian`.**
Grepping `bayes` across every `src/Core/Soft*.fs` returns only doc comments
(`SoftValue.fs:13,16,133,168,206,245`; `SoftIsr.fs:10,30`; `SoftController.fs:61`;
`SoftValueInfo.fs:9`). Nothing converts between a categorical distribution over
`DynamicValue` and a Gaussian.

### Why this is a design problem and not a missing function

Discrete→continuous is not a coercion. Candidate answers, each with a real cost:

1. **Moment-match** a `SoftValue` to a Gaussian when candidates are numeric —
   cheap, and *silently wrong* on multi-modal beliefs, which are exactly the ones
   worth having. `SoftValue.entropy` (`:127`) already measures how wrong.
2. **Implement `IMessage<SoftValue>`** and let the factor graph carry categorical
   messages directly. `FactorGraph.Factor<'M>` is generic over `'M`, so this
   requires no change to the graph — only product, divide, and uniform on
   distributions over `DynamicValue`. This is the option that makes the layer
   graph fall out for free.
3. **Keep them disjoint** and bridge only at `snap` — `SoftValue.resolve`
   (`:141`) already returns `DynamicValue option`, holding below threshold rather
   than fabricating. Honest, and gives up joint inference across the boundary.

(2) is the one that answers Aaron's request, because it makes "a higher layer
reads several lower layers of *different kinds*" a typing question the existing
`FactorGraph` already solves. It is also the most work, and `divide` (the EP
cavity) on a categorical distribution needs care where the denominator has near-zero
mass.

**Also disjoint and worth naming:** `SoftValue` appears nowhere in `Rx.fs`,
`StreamPolicy.fs`, `ReactiveSynth.fs`, or `TableStream.fs` — despite `SoftValue.fs`
compiling at `Core.fsproj:148`, well before `Rx.fs` at `:283`. The soft lane and
the reactive lane have never been wired together either. `SoftIsr.fs` is the
natural adapter: it is the soft **arrow**, `>=>`-composable, with `observeWith`
(`:32`) as a Bayesian update that is already a pipeline stage.

---

## 4. Bonsai is the representation, and `BonsaiSoft` is already the soft evaluator

`Bonsai.Expr` (`src/Core/Bonsai.fs:59`) is a small expression tree — `Const`,
`Param`, `Lambda`, `Binary`, `Call`, `Cond` — serialized to canonical compact JSON
so four language implementations agree byte-for-byte.

`BonsaiSoft` (`src/Core/BonsaiSoft.fs:25`) evaluates it **over soft values**:

```fsharp
type Env = Map<string, SoftValue.SoftValue>                        // BonsaiSoft.fs:29
evalSoft : Env -> Expr -> Result<SoftValue, string>                // BonsaiSoft.fs:85
snap : float -> Env -> Expr -> Result<DynamicValue option, string> // BonsaiSoft.fs:116
```

Soft `Cond` evaluates **both** branches and blends by the test's truth-confidence
(`BonsaiSoft.fs:96-108`) — branchless, no hard `if`. That is directly useful for a
gesture or policy layer that should not commit early.

**Two v1 limits, stated in the file** (`BonsaiSoft.fs:110-113`): `Lambda` and
`Call` return explicit `Error`. So a gesture expressed as a Bonsai `Call` does not
evaluate softly today. Whether that matters depends on whether gestures are
expressed as expressions or as Rx topology — an open question, not a blocker.

---

## 5. The 8-layer perception stack is real, and has no `Layer` type

`src/Core.TypeScript/bayesian/bnn-key-predictor.ts:15-24` documents eight layers:
raw display → objects → tracking → relations → symbols(OCR) → roles(which object
is me) → mode(hunt/flee) → policy. It calls them *"FORCED (engineered,
inspectable, individually testable) rather than hoped-for emergent structure"*
(`:25-29`).

**But there is no `Layer` type anywhere in the repo** — F#, C#, or TypeScript.
It is a class with fields `lastPerception` / `lastOcr` / `lastSelfId` / `lastMode`
/ `lastModeBucket` (`:188-227`) and hand-wired method calls. Layer 7 *does* read
layers 3, 4, 5 and 6 — **non-linear in practice, linear in type**. There is no
composition combinator and nothing you could add a ninth layer to without editing
the class.

That is the concrete meaning of "different games have different input layers":
today, a new input modality means editing `BnnSocietyPredictor`. The ARC roster
makes this urgent rather than theoretical — see §6.

---

## 6. Why this is now urgent: the ARC roster is mostly click

Measured on the live roster (run 32812742904), tags across 23 of 25 hosted
environments: `keyboard_click` ×11, `click` ×7, `keyboard` ×4, untagged ×1.

**~18 of 23 involve clicking** — a coordinate action, not the four directional
moves the pixel agent emits. `ACTION_VECTORS` in
`src/Arc.Python/zeta_arc/agent.py` maps four actions to cell deltas and assumes
each translates a body. That model does not apply to a click environment at all.

So "different games have different input layers" is not a nicety. It is the
difference between the existing agent covering ~4 of 25 environments and covering
25.

---

## 7. What is cheap, what is not

**Cheap, and unblocked today:**

- A gesture layer over `RxJoin.groupJoin`. The operator exists, its semantics are
  tested, and it needs no new Rx primitives. It would also be `groupJoin`'s first
  consumer outside its own test file.
- Extracting a `Layer` interface from the eight that already exist in
  `bnn-key-predictor.ts`. Mechanical, and it is the prerequisite for optional
  per-game input layers.

**Not cheap, and worth deciding before starting:**

- `IMessage<SoftValue>`. This is the piece that makes the layer *graph* real
  across kinds of belief, and it needs an answer on the EP cavity for categorical
  distributions.
- Committing to hierarchy over the flat `ThousandBrains` position. Both are in
  the tree; the choice should be explicit.

**A caution that applies to all of it.** The measured lesson from the discovery
curriculum this week is that a rung which *looks* like it tests something often
does not — three successive designs were cleared by a policy with no notion of
sequence, and only measurement caught it. The same applies here: a layer graph
that composes cleanly and is never asked a question no single layer could answer
is decoration. The falsifier for any of this is an environment where a layer
reading several lower layers **succeeds where a stack fails** — and that
environment should exist before the abstraction does.

---

## Pointers

- `src/Bayesian/FactorGraph.fs:33` — `Factor<'M>` with `Neighbors: int list`; the graph
- `src/Bayesian/MultilayerBnn.fs:156` — `skipSourcesFor`; a layer reading several lower ones
- `src/Bayesian/ThousandBrains.fs:11` — the flat counter-position
- `src/Core/Rx.fs:470` — `groupJoin`; down→move*→up, unconsumed
- `src/Core/SoftValue.fs:135` — `observe`, the discrete Bayesian update
- `src/Core/SoftIsr.fs:11` — `observeWith`, the soft arrow stage
- `src/Core/BonsaiSoft.fs:85` — `evalSoft`, Bonsai over soft values
- `src/Bayesian/Message.fs:55` — `IMessage<'M>`; what an `IMessage<SoftValue>` must satisfy
- `src/Core.TypeScript/bayesian/bnn-key-predictor.ts:15` — the eight layers, hand-wired
- `docs/VISION.md:3117` — the three-layer certainty architecture this would implement
- [`toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md)
  — everything proposed here is `toy` until an environment exists that discriminates it
