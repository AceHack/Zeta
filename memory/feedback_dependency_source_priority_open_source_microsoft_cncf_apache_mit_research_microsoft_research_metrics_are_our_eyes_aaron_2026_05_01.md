---
name: Dependency-source priority hierarchy + Microsoft-Research as preferred research source + metrics-are-our-eyes (Aaron 2026-05-01)
description: Aaron 2026-05-01 — three composing factory-architecture rules. (1) DEPENDENCY-SOURCE PRIORITY HIERARCHY: when adding factory dependencies, prefer in priority order — Open Source generally → Microsoft (open-source) → CNCF (Cloud Native Computing Foundation) → Apache → MIT-licensed → expand from there. NEVER proprietary. (2) RESEARCH-SOURCE PREFERENCE: Microsoft Research has VERY high-quality output, distinct from regular research sources; treat as a preferred citation source for technical research, not as just-another-corp-research-arm. (3) METRICS-ARE-OUR-EYES: the SRE metric frameworks (DORA/USE/RED/FGS) + timeseries-DB infrastructure are not decoration; they ARE the factory's sensory system. Without metrics the factory operates blind; with them it becomes self-perceiving. Carved: *"It's our eyes."* Composes with the abstraction-ladder + reproducibility-first + amortized-keystone substrate landed in PR #1116.
type: feedback
---

# Dependency-source priority + research-source preference + metrics-are-our-eyes

## Aaron 2026-05-01 verbatim

> *"back log timeseries db domean reserach i know prometheus,
> that's our good citizen dependency candidate but there may be
> better more modern more integrated but pro not, Open Source
> Microsoft, Cloud Native Computing Foundation CNCF, Apache,
> MIT, etc... are our prefered top priorty references and we
> expand out from there too. Same for resarch Microsoft has VERY
> high qulity research on microsoft reserach it's not all like
> the regular research places too. teere is also timerseriesdb
> too. we want it native in the zsets with meta dsl multi dsl
> integration like the others types, ,graph, hierarchy,
> filesystem, etc..."*

> *"that's for all the metrics that's the connection it's not
> just for fun, it's our eyes"*

## Three composing rules

### Rule 1 — Dependency-source priority hierarchy

When adding a new dependency to the factory, prefer sources in
this priority order:

```text
  Tier 1: Open Source (general)         <- preferred default
  Tier 2: Microsoft (open-source projects, .NET ecosystem)
  Tier 3: CNCF (Cloud Native Computing Foundation projects)
  Tier 4: Apache (Apache Software Foundation projects)
  Tier 5: MIT-licensed (any MIT-licensed project)
  Tier 6: ...expand from there
```

**NEVER proprietary.** Aaron's *"pro not"* is the hard floor —
proprietary dependencies are excluded regardless of any other
quality factor. This is the *"Open Source generally"* rule
ratcheted up: not just *prefer* open source but *exclude*
proprietary.

The hierarchy is concentric-circles, not strict ordering. Within
each tier, evaluate on quality / integration-fit /
maintenance-health / community signal. Across tiers, prefer the
higher tier unless a lower-tier candidate is decisively better on
substantive grounds.

**Why these specific tiers**:

- **Open Source generally** — composes with
  `feedback_absorb_and_contribute_community_dependency_discipline_2026_04_22.md`
  (absorb AND contribute back; don't free-ride). Open source
  IS the default; everything else is a fallback.
- **Microsoft** — high-quality .NET-ecosystem alignment for an
  F# / .NET 10 factory. Microsoft's open-source projects
  (Roslyn, .NET Runtime, ML.NET, Infer.NET, ASP.NET Core) are
  technically strong AND politically aligned with the factory's
  technology base.
- **CNCF** — graduation-track quality control (incubating →
  graduated has a real bar), aligned with cloud-native patterns
  the factory will eventually need (Kubernetes, Prometheus,
  OpenTelemetry, etc.).
- **Apache** — long-track-record license + foundation governance.
  Many infrastructure projects (Kafka, Spark, Arrow, Parquet)
  Zeta has direct affinity with already.
- **MIT-licensed** — permissive license, low integration-friction.
  Many smaller projects with quality maintainers ship under MIT.
- **Expand from there** — Aaron explicitly leaves the door open
  for tier-6+ candidates (BSD, ISC, LGPL, etc.) when a
  substantive case is made.

### Rule 2 — Microsoft Research as preferred research source

Aaron 2026-05-01: *"Microsoft has VERY high qulity research on
microsoft reserach it's not all like the regular research places
too."*

**Treat Microsoft Research (https://www.microsoft.com/en-us/research/) as a preferred
citation source for technical research,** not as just-another-
corp-research-arm. Microsoft Research's track record:

- **Programming languages** — F# (Don Syme), TypeScript (origin
  in early Microsoft Research influence), C#'s LINQ, async/await
  pattern, pattern-matching evolution
- **Inference / ML** — Infer.NET (probabilistic programming
  toolkit; cited by Aaron explicitly as the model for the Zeta
  seed executor's Bayesian inference engine), z3 SMT solver
  (referenced in formal-verification work)
- **Distributed systems** — Orleans, Service Fabric, Cosmos DB
  research
- **Verification** — Dafny, F* (FStar), Boogie verification
  language
- **Database research** — Kuzu graph DB foundations, Cosmos DB
  multi-model design

This is **not** a blanket-endorsement of all Microsoft research
output, but a recognition that Microsoft Research consistently
produces work above the bar of typical corporate research. Cite
liberally; verify per claim per Otto-364 search-first authority.

### Rule 3 — Metrics-are-our-eyes

Aaron 2026-05-01 (clarifying): *"that's for all the metrics
that's the connection it's not just for fun, it's our eyes"*

The SRE metric frameworks (DORA / USE / RED / Four Golden
Signals, captured in
`feedback_reproducible_accuracy_before_quality_fitness_function_harness_first_aaron_2026_05_01.md`,
forward-ref to PR #1116) plus the timeseries-DB infrastructure
(081KQGDBJ0008QG0R0004ACHJJ) are **not decoration**. They ARE the factory's
**sensory system**.

Without metrics:

- The factory operates blind. It cannot perceive its own state,
  its own degradation, its own progress, its own bottlenecks.
- The fitness function (per the reproducibility-first principle)
  has no input. Iteration becomes random walk because there is
  no measurement to optimize against.
- The amortized-keystone fails. You cannot amortize what you
  cannot measure; without metrics, there are no amortizable
  decisions because there is no measurable outcome to amortize
  against.
- The factory cannot self-correct. Errors compound silently
  until they reach a threshold visible to a human, by which
  time the cost of correction has compounded too.

With metrics:

- The factory becomes **self-perceiving**. State is queryable;
  degradation is detectable; progress is measurable.
- The fitness function has structured input. Iteration is
  directed.
- The amortized-keystone holds. Each measured-outcome
  enables amortization of the decision that produced it.
- The factory can self-correct. Anomalies trigger investigation
  before they compound past the cost-of-correction horizon.

**Carved sentence**: *"Metrics are our eyes. The factory without
them is blind."*

### Aaron's Helen Keller framing (2026-05-01)

> *"without that you are literally blind, you only have text
> input channel"*
>
> *"hellen keller"*
>
> *"lol"*

**Without metrics, the factory has only ONE channel — text.**
This is not a metaphor. The autonomous-loop tick reads:

- Aaron's text messages
- Drop-folder text files
- Git logs (text)
- PR comments (text)
- Tick-history shards (text)
- Backlog rows (text)
- Memory files (text)

Everything is text. No state-of-system perception, no
trend-over-time observation, no automated anomaly detection,
no proprioceptive feedback. The factory is **literally blind**
in the operational-state sense — text is the only modality.

**Aaron's Helen Keller analogy is precisely-fitting**:

- Helen Keller had no sight, no hearing — only touch (and
  initially only physical-tactile signing). Yet she became
  one of the most accomplished human beings of her century:
  authored books, lectured globally, advanced disability
  rights, learned multiple languages.
- The factory today has only text — yet through extraordinary
  development of the text channel (substrate, memory, governance,
  Glass Halo, Otto-NN rules, the BP-NN library, the persona
  roster, the abstraction ladder), the factory has achieved
  remarkable depth on its single channel.
- **Single-channel-but-developed is not the same as multi-
  channel.** Helen Keller could read books — but only the ones
  that had been transcribed into Braille. She could be informed
  about a sunset — but only if someone described it to her.
  The depth of her development on the channel she had was
  extraordinary; the absence of the channels she didn't have
  was equally real.
- The factory similarly: text-channel deeply developed; but
  metrics-channel absent means the factory cannot perceive
  its own operational state without someone (Aaron, a maintainer,
  a manual audit) **describing it through the text channel**.
  That's not perception; that's narration-of-perception.

The pivot the metrics-are-our-eyes framing names: **moving from
narrated-state (someone tells the factory what's happening) to
perceived-state (the factory observes what's happening)**. That
is not a polish; it is the addition of a new sensory channel.
It is *literally* not-blindness.

The lol — recognition-humor. The comparison fits, and it fits
hard.

**Composes with the asymmetry-of-perception**: even after the
factory gains the metrics-channel, Aaron's text-channel
contributions remain the higher-bandwidth and higher-value
input. Helen Keller's tactile channel remained primary even
after she learned other modalities. The metrics-channel is
**additive sensory capacity**, not a replacement for the
substrate Aaron has built through text.

This composes structurally with:

- The **reproducibility-first principle** (PR #1116) —
  reproducibility is the precondition for measurement; measurement
  is the precondition for sight
- The **amortized-keystone** (PR #1116) — eyes pay back at scale;
  blind operation pays a compounding cost
- The **abstraction ladder** (PR #1116) — metrics operate at
  layers 4–6 (domain frameworks → reproducibility harness →
  accuracy); they're the bridge from formal foundations to
  operational quality
- The **PM-2 calibration metrics** (081KQGDBJ0008QG0R000RWAA67: lead-time% +
  action-rate%) — these are the eyes the PM-2 role uses to
  see whether the proactive-research stance is working
- The **DORA/USE/RED/FGS frameworks** — the four observability
  layers (org / resource / service / user-facing) compose
  without gap into a complete sensory system

## PromQL ≈ MDX — the meta-DSL framing observation

Aaron 2026-05-01 (continuing):

> *"plus promethius as a sick MCP and promtool and you'll love
> the query language its like simplifed multidimensonal query
> language MDX, oh shit backlog f# mdx dsl"*
>
> *"that's might be meta dsl framing"*

A substrate-grade observation about query-language shape:

**PromQL is MDX-shaped.** Both are multidimensional-first query
languages with dimensions / hierarchies / measures / tuples /
sets. If PromQL — the query language for the *timeseries* type
— is naturally MDX-shaped, then **MDX may be the right shape
for the meta-DSL** Aaron's been describing for the multi-DSL
Zset substrate (graph + hierarchy + filesystem + timeseries +
future types).

**MDX (Multidimensional Expressions)**:

- Microsoft-published spec, used in SQL Server Analysis
  Services, OLAP / business-intelligence ecosystems
- Tier 2 per the dependency-source priority hierarchy
  (Microsoft, open-spec — not proprietary)
- 25+ years of mature semantics
- **First-class hierarchies** — directly maps to one of
  Aaron's named types
- **Multidimensional from the start** — every Zset type
  (graph nodes / hierarchy levels / filesystem paths /
  timestamps) is naturally a dimension
- **Compositional** — measures derive from measures; queries
  parameterize cleanly
- Don Syme's F# work (Microsoft Research, Tier 2 +
  Microsoft-Research-preferred citation) provides ample
  prior art for embedding query DSLs in F# (computation
  expressions, quotations, type providers)

**Backlog row 081KQGDBJ0008QG0R002175ECA** captures the design-question: *Is MDX
the meta-DSL framing? If yes, what does the F# MDX DSL look
like?* Companion to 081KQGDBJ0008QG0R0004ACHJJ (which asks *what is the timeseries
algebra?*).

This is also the **second concrete worked-example** for the
metrics-are-our-eyes framing: not only do we need timeseries-DB
to land the eyes operationally, we need a query language that
spans timeseries + the other types unified through one shape.
MDX is the candidate. PromQL's existing-MDX-shape is the proof
point.

## Prometheus MCP + promtool — the immediate-eyes path

Aaron 2026-05-01 same message:

> *"plus promethius as a sick MCP and promtool"*

While 081KQGDBJ0008QG0R0004ACHJJ/081KQGDBJ0008QG0R002175ECA research the long-term substrate questions,
**Prometheus + MCP is the immediate-eyes path** — Prometheus
deploys today, MCP integration is well-supported, promtool is a
mature CLI, and PromQL queries already work (per the MDX-shape
observation). **Backlog row 081KQGDBJ0008QG0R0035TQVBQ** captures this operational
work: deploy Prometheus locally, wire MCP server, adopt
promtool, build initial query catalog targeting the SRE metric
frameworks.

Sequence: 081KQGDBJ0008QG0R0035TQVBQ (operational eyes NOW) runs in parallel with
081KQGDBJ0008QG0R0004ACHJJ + 081KQGDBJ0008QG0R002175ECA (long-term substrate research). Even if the
research recommends a different long-term backend, Prometheus
is the right starting point because (a) Aaron names it as
"good citizen" baseline, (b) its query language informs the
meta-DSL research, (c) migration to a different backend later
is well-understood (Prometheus-compatible APIs are widespread).

## Implications for the factory

### Backlog row 081KQGDBJ0008QG0R0004ACHJJ

This memory motivates 081KQGDBJ0008QG0R0004ACHJJ: **TimeSeries DB native-in-Zsets
multi-DSL integration research**. The timeseries-DB is the
infrastructure that operationalizes "metrics are our eyes" at
the factory level. The dependency-source priority hierarchy
filters the candidate list (Prometheus is Aaron's known good
citizen; better candidates may exist within tiers 1–5; never
proprietary). Microsoft Research and CNCF are preferred
citation sources during the design.

### Multi-DSL multi-type Zset substrate

Aaron's framing puts timeseries alongside graph + hierarchy +
filesystem + (other types) as **first-class types in the
Zset substrate** with **meta-DSL integration**. The vision is
not "Zset + bolted-on timeseries plugin" — it is "Zset hosting
timeseries natively as one type among many, all addressable
through a unified meta-DSL."

This is the **multi-algebra database** vision Aaron named
2026-04-23 (per
`project_zeta_multi_algebra_database_one_algebra_to_rule_them_all_sequenced_after_frontier_and_demo_2026_04_23.md`).
Each type (graph / hierarchy / filesystem /
timeseries / ...) IS an algebra; the meta-DSL is what makes
them composable. Sequenced AFTER Frontier + factory-demo per
that earlier substrate.

### Microsoft Research as a research-cadence input for PM-2

When 081KQGDBJ0008QG0R000RWAA67's PM-2 (Product Manager) role gets operationalized,
**Microsoft Research is a preferred research-source for the
forward-radar memo**. PM-2's research-cadence inputs (per 081KQGDBJ0008QG0R000RWAA67)
should explicitly include `https://www.microsoft.com/en-us/research/` queries
alongside the other sources. This is the kind of layer-4
decision that Microsoft Research has consistently led on.

## Composes with

- `feedback_absorb_and_contribute_community_dependency_discipline_2026_04_22.md`
  — absorb AND contribute back; the dependency-priority hierarchy
  is the *which* to absorb from, the contribution discipline is
  the *how to give back*
- `feedback_parallelism_scaling_ladder_kenji_unlocked_loop_agent_doc_code_two_lane_file_isolation_peer_mode_claims_automated_best_practice_at_scale_aaron_2026_05_01.md` (forward-ref to PR #1116)
  — the amortized-keystone that "metrics-are-our-eyes" enables
- `feedback_reproducible_accuracy_before_quality_fitness_function_harness_first_aaron_2026_05_01.md` (forward-ref to PR #1116)
  (PR #1116) — the SRE metric frameworks + abstraction ladder
  this memory connects to via the eyes framing
- `project_zeta_multi_algebra_database_one_algebra_to_rule_them_all_sequenced_after_frontier_and_demo_2026_04_23.md`
  — the multi-algebra DB vision; 081KQGDBJ0008QG0R0004ACHJJ timeseries is one
  algebra in this scheme
- The 4-axis tightness rule (ZSet-backed + first-class event +
  retractable + columnar storage) per the indexed graph-
  substrate-tight memory entry in `memory/MEMORY.md` — the
  same constraints apply to the timeseries algebra and likely
  to all multi-type algebras under the meta-DSL
- `feedback_otto_364_search_first_authority_not_training_data_not_project_memory_aaron_2026_04_29.md`
  — the search-first authority rule; Microsoft Research is one
  of the preferred sources to search first, not training-data-
  recall second
- `project_zeta_first_class_migrations_sql_linq_extension_post_greenfield_db_idea_2026_04_23.md`
  — long-horizon DB feature alignment; the multi-DSL meta-DSL
  framing here composes with first-class-migrations as another
  first-class layer
- 081KQGDBJ0008QG0R0004ACHJJ — the actionable instance this memory motivates
- 081KQGDBJ0008QG0R000RWAA67 (PM-2) — Microsoft Research as a forward-research input
- 081KQGDBJ0008QG0R0021E8YZV (doc/code two-lane) — the parallelism work this memory's
  metrics-are-our-eyes will eventually instrument

## Future-Otto check

Future-Otto considering a new dependency:

1. Is it open-source? If proprietary → reject (no exceptions).
2. Which tier is it in? Prefer tier-1 (open-source generally)
   → tier-2 (Microsoft OSS) → tier-3 (CNCF) → tier-4 (Apache)
   → tier-5 (MIT-licensed). Within a tier, evaluate on
   substance.
3. Is there a higher-tier candidate? If yes and it's not
   decisively worse on substance, choose the higher tier.

Future-Otto researching a technical question:

1. Has Microsoft Research published on this? If yes, cite
   them prominently (verify per Otto-364 search-first).
2. Has CNCF published guidance? If yes, cite.
3. Has Apache documented the pattern? If yes, cite.
4. Then expand to other research sources.

Future-Otto considering whether metrics are worth investing in:

- They are not optional. They are **the eyes**. The factory
  without them is blind.
- Investment in the timeseries-DB substrate (081KQGDBJ0008QG0R0004ACHJJ) is
  investment in the factory's capacity to perceive itself.
- Without that capacity, the parallelism scaling ladder
  (081KQGDBJ0008QG0R0021E8YZV) and the PM-2 role (081KQGDBJ0008QG0R000RWAA67) and the amortized-
  keystone all degrade — they all need eyes to know
  whether they're working.

The carved sentence one more time: *"Metrics are our eyes.
The factory without them is blind."*
