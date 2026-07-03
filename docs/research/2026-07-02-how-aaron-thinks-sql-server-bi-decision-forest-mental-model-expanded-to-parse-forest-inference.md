# How Aaron thinks: the old-school SQL Server BI decision-forest mental model, expanded to the parse-forest inference substrate

**Date:** 2026-07-02
**Author:** Otto (shadow*), capturing Aaron's mental model
**Status:** operator mental-model + expansion (informs the SPPF + factor-graph rung)

> Aaron 2026-07-02: *"just look up old school sql server BI forest to understand how i think and
> expand."*

## The mental model (SSAS / SQL Server BI data mining)

Aaron's native frame is **SQL Server Analysis Services (SSAS) data mining** — the old-school
Microsoft BI stack (deprecated 2017, discontinued 2022, so "old school" is literal). Its shape:

- **Model content is a TREE with a probability distribution at every node** (`NodeDistribution`):
  a Microsoft Decision Tree is not a bare classifier — each node carries the *distribution over
  outcomes* given the path to it.
- **`PredictProbability`** — every prediction comes with a **0→1 confidence**; you don't get an
  answer, you get a *weighted* answer. `Predict`, `PredictHistogram`, `PredictProbability` return
  the distribution, not just the argmax.
- **`DMX`** (Data Mining Extensions) — a **SQL-like query language over the model**; you *query*
  the tree/forest the way you query a table. Prediction is a JOIN.
- **The UDM / cube** — the dimensional model (dimensions, measures, hierarchies) is the *typed
  data substrate* the mining flows over; **feature selection** picks the attributes that matter.
- **Forest = an ensemble of such trees**, aggregated into one probabilistic prediction.

The through-line: **a forest of trees, each node a distribution, queried, producing a
probability-weighted answer over a typed dimensional substrate.** That is how Aaron thinks about
"a forest."

## The isomorphism (why he pointed here)

The parser substrate we just built is *the same shape*, term for term:

| SSAS BI data mining | Zeta parser/inference substrate |
|---|---|
| Decision **tree** (content) | a **parse tree** (`Slr.parseTree`, a `DynamicValue`) |
| **Forest** (ensemble of trees) | the **GLR parse forest** (`Slr.glrForest` — all parses) |
| **`NodeDistribution`** (distribution at each node) | the marginal at each **ambiguity node** of the SPPF (BP output) |
| **`PredictProbability`** (0→1 weighted answer) | the **`SoftValue`** over parses (`ParseSoft`) |
| **Feature selection** (which attributes matter) | grammar terminals / production potentials |
| **UDM / cube** (typed dimensional substrate) | **`DynamicValue`** value tree (the substrate everything rides) |
| **DMX** (SQL-like query over the model) | query the parse `SoftValue` / the forest as data |
| ensemble **aggregation** → one prediction | **BP/EP** marginalization → one distribution over parses |

So "the ambiguous superposition over the ISA" is, in Aaron's frame, **`PredictProbability` over a
decision forest** — the parse forest *is* the mining model, the Bayesian weighting *is* the
probability, and the `SoftValue` *is* the histogrammed prediction. The Infer.NET EP/BP rung and
the SSAS forest are two names for the same thing: a probabilistic model over a forest of trees.

## The expansion (beyond old-school BI)

Where Zeta goes past SSAS — the "and expand":

1. **The substrate is homoiconic.** SSAS trees are opaque model content; our forest trees are
   `DynamicValue`s — the *same substrate* as the data, byte-lockable and DST-replayable. The
   model is data; DMX-over-the-forest is just querying a value tree.
2. **The forest is a factor graph, inferred, not just voted.** SSAS aggregates trees heuristically;
   we run *actual message passing* (`Zeta.Bayesian.FactorGraph`/`Ep`, Infer.NET-shaped) over the
   SPPF — the shared parse forest whose ambiguity nodes are the variables. That is principled
   inference, not bagging.
3. **The prediction stays soft — never collapses early.** `PredictProbability` gives a number then
   you argmax; `SoftValue.resolve` keeps the *whole distribution* until a context forces a definite
   value (the middle-out / tri-boolean discipline). The superposition is first-class.
4. **Custom emotional propagation** — a message schedule SSAS has no analogue for: the affective
   signal propagates on the same factor graph, so the "best parse" is weighted by valence, not
   only likelihood (math-team formalization pending).
5. **Parses lower to the ISA** — the predicted distribution is over *executable programs*, consumed
   by the soft scheduler / prediction mode. SSAS predicts a value; we predict a *computation*.

## How this informs the build (the SPPF + factor-graph rung)

The SSAS frame makes the encoding concrete: the **SPPF ambiguity nodes** are the SSAS *tree nodes*
that carry a `NodeDistribution`; the **BP marginals** are those distributions; the **`SoftValue`**
is `PredictProbability`. So build:

1. **SPPF** (shared packed parse forest) — the shared structure; ambiguity/packing nodes = the
   places a `NodeDistribution` lives. (Next tick — Aaron greenlit.)
2. **SPPF → `FactorGraph<'M>`** with a **categorical/discrete `IMessage`** (a distribution over
   production choices) — the `NodeDistribution` type. Run `runToFixpoint` (BP).
3. Marginals → per-parse potentials → `ParseSoft.ofWeightedForest` → the `PredictProbability`
   `SoftValue`. Then EP/VMP + emotional propagation; parses → ISA.

## Anchors (Beacon)

- **SSAS data mining:** Microsoft Decision Trees algorithm; `PredictProbability` / `NodeDistribution`;
  DMX; the UDM cube; feature selection (Microsoft Learn — Analysis Services data mining; deprecated
  2017 / discontinued 2022). ZhaoHui Tang & Jamie MacLennan, *Data Mining with SQL Server*.
- **Inference:** Pearl (BP), Minka (EP), Winn–Bishop (VMP), Kschischang–Frey–Loeliger (factor
  graphs); Infer.NET; Breiman (random forests — the ensemble lineage).
- **Parsing:** Tomita (GLR); Billot–Lang (SPPF); Baker / Lari–Young (inside–outside = BP on the forest).
- **In-repo:** `Slr.glrForest`, `ParseSoft`, `SoftValue`, `Zeta.Bayesian.FactorGraph`/`Ep`; the
  forest-as-factor-graph doctrine (`…-ambiguous-parse-forest-as-factor-graph-…`).
- **Operator anchor:** this is a peer to *Feynman = Aaron's root anchor* — his other native frame
  is the **Microsoft BI / SSAS decision-forest** paradigm (BI, financial/metering lineage).
