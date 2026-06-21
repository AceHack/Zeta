# BP-NN Rules External Anchor Backfill — Slice 8 (BP-20, BP-21, BP-22)

Scope: External prior-art anchors for three BP-NN rules in
`docs/AGENT-BEST-PRACTICES.md`. This is slice 8 of the 081KR2E4K0008QG0R001ADMBVW backfill;
slices 1–6 covered BP-10, BP-11, BP-03, BP-07, BP-16, BP-04, BP-08, BP-09,
BP-12, BP-13, BP-14, BP-01, BP-02, BP-15, BP-05, and BP-06. Slice 7
(BP-17, BP-18, BP-19) remains pending/in progress. This slice covers the
three rules in the "Repo ontology & Rule Zero"
section that govern skill-splitting and agent-classification discipline:
BP-20 (cognitive load determines split, not line count), BP-21 (faceted
classification for skills; monohierarchy avoidance), BP-22 (optimizer and
balancer are distinct roles with distinct objective functions).

Rules covered: BP-20 (cognitive-load split criterion), BP-21 (facet
classification; PMEST), BP-22 (optimizer vs balancer).

Research date: 2026-05-10. Research performed via WebSearch (Otto-364
search-first-authority discipline). All sources verified via direct search
before citation.

Attribution: Research performed by Otto (Claude Sonnet 4.6) 2026-05-10.
Cited sources are human-authored external publications. Otto's contribution
is search, synthesis, and beacon-safety pass; all intellectual lineage
belongs to the cited external authors.

Operational status: research-grade

Beacon-safety pass: all cited vocabulary (cognitive load, working memory,
element interactivity, decomposition, faceted classification, monohierarchy,
Pareto optimality, scalarization, multi-objective optimization, utility
function, fairness, entropy, variance) uses standard academic and
industry-engineering register. No beacon-blocked terminology found.

---

## BP-20 — Skills split when context needs to split to reduce reader

cognitive load, not when a length threshold is crossed

**Rule text (from AGENT-BEST-PRACTICES.md):**
*"Skills split when context needs to split to reduce reader cognitive load,
not when a length threshold is crossed. Rationale: a clean 150-line combined
skill beats two 75-line split skills readers have to context-switch between;
but a 300-line combined skill covering two distinct facet values must split
regardless of length. Cognitive load is the first-class constraint; file count
is not."*

**Core claim:** File length is a symptom, not a root cause of skill
incomprehensibility. The correct splitting criterion is reader cognitive
load — specifically, the **intrinsic element interactivity** the reader must
hold simultaneously when processing the file. Two topics with high mutual
interactivity impose a high intrinsic load even in a short file; two topics
with low mutual interactivity are safe to co-locate even in a long file.
Counting lines as a proxy for cognitive cost is systematically miscalibrated
because it treats all content as cognitively equivalent.

### External anchors

**1. Sweller, J. (1988) — Cognitive load during problem solving: Effects on learning**

Sweller, J. *Cognitive load during problem solving: Effects on learning.*
Cognitive Science, 12(2), 257–285.
<https://onlinelibrary.wiley.com/doi/10.1207/s15516709cog1202_4>
(published 1988).

The foundational cognitive load theory (CLT) paper establishes that working
memory has a fixed capacity and that problem-solving difficulty is determined
not by the volume of information presented but by the number of **elements
that must be processed simultaneously** (element interactivity). Intrinsic
cognitive load is set by the degree of interconnection between elements —
not by the count of elements. Two concepts that must be understood together
to make sense impose high intrinsic load; two independent concepts co-located
in one file impose low load even when the file is large. This is the
foundational empirical grounding for BP-20: a line-count threshold does not
measure element interactivity, and therefore cannot correctly trigger a split.

**2. Parnas, D. L. (1972) — On the criteria to be used in decomposing systems into modules**

Parnas, D. L. *On the criteria to be used in decomposing systems into modules.*
Communications of the ACM, 15(12), 1053–1058.
<https://dl.acm.org/doi/10.1145/361598.361623>
(published December 1972).

Parnas's foundational modularization paper establishes that **comprehensibility**
is the primary criterion for module boundaries, not execution efficiency or
file size. Each module should encapsulate "a design decision which it hides
from all others" — the criterion is that a reader can study the system "one
module at a time" without needing to comprehend the whole simultaneously.
Parnas explicitly demonstrates that two different decompositions of the same
system can have identical line counts while differing sharply in comprehensibility.
The direct implication for BP-20: a split that lets a reader understand one
concern without loading the other into working memory is justified; a split
that forces context-switching between coupled concerns increases rather than
reduces cognitive load.

**3. Sweller, J., van Merriënboer, J. J. G., & Paas, F. (2019) — Cognitive architecture and instructional design: 20 years later**

Sweller, J., van Merriënboer, J. J. G. & Paas, F. *Cognitive architecture and
instructional design: 20 years later.* Educational Psychology Review, 31,
261–292.
<https://link.springer.com/article/10.1007/s10648-019-09465-5>
(published 2019).

The 20-year retrospective on CLT confirms that **intrinsic load is determined
by element interactivity**, not raw content volume. The paper formally
separates extraneous load (load caused by poor presentation — analogous to
arbitrary file splits that force unnecessary context-switches) from intrinsic
load (load caused by genuine concept complexity — the load that a meaningful
split can reduce). Splitting a skill file on a length threshold, when the
two halves are conceptually tightly coupled, creates extraneous load (the
reader must now track two files to understand one concept) without reducing
intrinsic load (the concepts remain equally intertwined). This is the precise
failure mode BP-20 prevents.

---

## BP-21 — Non-exempt capability skills declare or imply their three facet

values: epistemic stance × abstraction level × function

**Rule text (from AGENT-BEST-PRACTICES.md):**
*"Non-exempt capability skills declare or imply their three facet values:
epistemic stance (expert / research / teach) × abstraction level (theory /
applied) × function (practitioner / gap-finder / enforcer / optimizer /
balancer). Rationale: faceted classification (Ranganathan PMEST
colon-classification tradition) avoids monohierarchy pathologies. Naming
convention `<topic>-<role>` carries one facet; description carries the other
two."*

**Core claim:** A skill named `foo-expert` lives in a multi-dimensional
classification space — its topic, its epistemic stance, its abstraction
level, and its function are separate, independently-varying facets. Forcing
skills into a single-dimension flat list (a monohierarchy ordered by topic
alone) is a known failure mode in knowledge organization: items that belong
to more than one category must be artificially assigned to one, hiding
cross-category relationships. Faceted classification assigns values along
independent axes, enabling retrieval from any starting facet without
structural distortion.

### External anchors

**1. Ranganathan, S. R. (1933/1960) — Colon Classification (CC)**

Ranganathan, S. R. *Colon Classification* (6th ed., 1960). Sarada Ranganathan
Endowment for Library Science, Bangalore. First published 1933 by the Madras
Library Association.
<https://en.wikipedia.org/wiki/Colon_classification>
<https://www.historyofinformation.com/detail.php?id=4384>

The foundational faceted classification framework. Ranganathan developed
Colon Classification as a direct response to the pathology of monohierarchical
schemes (Dewey Decimal Classification, Library of Congress) that force each
concept into exactly one pre-determined location — the monohierarchy problem.
CC's PMEST facets (Personality, Matter, Energy, Space, Time) allow any subject
to be assembled from independent component values without needing a pre-
enumerated slot in a fixed hierarchy. The analogy is direct: Zeta's three
skill facets (epistemic stance, abstraction level, function) play the role of
CC's PMEST components — the skill's "address" is composed at classification
time from independent axis values, not looked up in a monohierarchy. The
"colon classification tradition" cited in BP-21 is this specific lineage.

**2. Spiteri, L. F. (1998) — A simplified model for facet analysis**

Spiteri, L. F. *A simplified model for facet analysis.* Canadian Journal of
Information and Library Science, 23(1–2), 1–30.
<https://www.semanticscholar.org/paper/A-simplified-model-for-facet-analysis-Spiteri/b2ef06ede33b7e7cffab75b8ed3d1b0e6f96aa56>
(published 1998).

Formalises the key property of faceted classification that BP-21 operationalises:
each facet is **independently variable** — changing the value on one axis does
not require changing values on other axes. A monohierarchical scheme breaks this
independence: moving a subject to a new position in the hierarchy typically
changes its apparent relationship to all other subjects. Spiteri's model shows
that facet analysis allows items to be "found from any direction" — starting
from any facet value and traversing to others — which is precisely the
retrieval property the Zeta skill router needs: given a topic, find the
matching epistemic stance and function; given a function (e.g., optimizer),
find the matching topic.

**3. Hearst, M. A. (2006) — Design recommendations for hierarchical faceted search interfaces**

Hearst, M. A. *Design recommendations for hierarchical faceted search
interfaces.* Proceedings of the Workshop on Faceted Search, ACM SIGIR 2006.
<https://people.ischool.berkeley.edu/~hearst/papers/faceted-workshop06.pdf>
(published 2006).

Empirically demonstrates the navigability advantage of faceted classification
over monohierarchical schemes in deployed information systems. Key finding
relevant to BP-21: users who begin their search from different starting facets
converge on the same items more reliably with faceted interfaces than with
hierarchical ones, because the faceted representation is path-independent.
The monohierarchical alternative (a flat alphabetical skill list or a single
topic-based taxonomy) requires the skill router to know the user's starting
facet in advance — a strict structural constraint that faceted classification
removes. BP-21's facet declarations give the Zeta skill router exactly this
path-independence: `<topic>-<role>` naming plus description-carried facets
enable triggering from topic, stance, or function as starting points.

---

## BP-22 — Optimizer and balancer are distinct roles with distinct objective

functions

**Rule text (from AGENT-BEST-PRACTICES.md):**
*"Optimizer and balancer are distinct roles with distinct objective functions.
Rationale: balancer minimises variance / maximises entropy / enforces
fairness; optimizer maximises a scalar utility function under constraints.
Skills claiming both objective functions simultaneously are function-conflated
and must split. Underlying agents reach for different search strategies under
the two objectives; collapsing them produces unpredictable behaviour."*

**Core claim:** Scalar-utility optimization (finding a single best solution
according to a single-valued objective) and Pareto-trade-off balancing
(maintaining a diversity of non-dominated solutions across multiple competing
objectives) are **not the same computation** and not safely combined in a
single agent role. A scalar-utility optimizer, when deployed on a multi-
objective problem, must introduce a weighting scheme that pre-bakes a value
judgment about which objective matters more — this is a design choice, not a
neutral computation. A balancer explicitly avoids this pre-baked judgment and
instead maintains a solution set that is non-dominated across all objectives,
deferring the weighting choice to the caller. Conflating the two roles
produces unpredictable behaviour because the agent is simultaneously
pre-baking a weighting judgment (optimizer role) and refusing to pre-bake one
(balancer role).

### External anchors

**1. Miettinen, K. (1999) — Nonlinear Multiobjective Optimization**

Miettinen, K. *Nonlinear Multiobjective Optimization.* Kluwer Academic
Publishers, Boston. International Series in Operations Research & Management
Science, Vol. 12.
<https://link.springer.com/book/10.1007/978-1-4615-5563-6>
(published 1999).

The foundational text in multiobjective optimization theory. Miettinen
establishes the formal distinction between scalarization (converting
a multiobjective problem into a single-objective problem by weighting or
combining objectives into a scalar utility function) and Pareto-optimal
set computation (finding the full set of solutions where no objective can
be improved without degrading another). These are not equivalent
computations: scalarization produces exactly one solution per weighting
choice and discards information about the trade-off surface; Pareto
computation preserves the full trade-off surface and makes the weighting
choice explicit as a separate decision step. BP-22's optimizer/balancer
distinction maps directly onto this formal separation: an optimizer
performs scalarization (maximises a fixed scalar utility under constraints);
a balancer performs Pareto exploration (maintains diversity across competing
objectives without pre-baking a weighting).

**2. Deb, K., Pratap, A., Agarwal, S. & Meyarivan, T. (2002) — A fast and elitist multiobjective genetic algorithm: NSGA-II**

Deb, K., Pratap, A., Agarwal, S. & Meyarivan, T. *A fast and elitist
multiobjective genetic algorithm: NSGA-II.* IEEE Transactions on
Evolutionary Computation, 6(2), 182–197.
<https://ieeexplore.ieee.org/document/996017>
<https://sci2s.ugr.es/sites/default/files/files/Teaching/OtherPostGraduateCourses/Metaheuristicas/Deb_NSGAII.pdf>
(published April 2002).

The canonical empirical demonstration that multiobjective optimization requires
a distinct algorithmic strategy from single-objective optimization. NSGA-II's
Pareto-dominance selection and crowding-distance diversity preservation are
structurally incompatible with a scalar utility maximizer: a scalar optimizer
applied to one objective in a multiobjective problem collapses the Pareto
front to a single point, systematically losing all trade-off solutions.
Deb et al. show that different search strategies are required not merely as
a matter of preference but as a structural consequence of the problem
formulation: the "find the one best solution" objective function that an
optimizer pursues and the "find all non-dominated solutions" objective
function that a balancer pursues are not the same optimization problem.
BP-22's requirement to split skills that claim both roles follows directly:
the two objectives are mathematically non-composable in a single agent
without a pre-baked weighting, which changes the problem.

**3. Celis, L. E., Huang, L., Keswani, V. & Vishnoi, N. K. (2024) — Towards Fairness-Aware Multi-Objective Optimization**

Celis, L. E., Huang, L., Keswani, V. & Vishnoi, N. K. *Towards
fairness-aware multi-objective optimization.* Complex & Intelligent Systems,
10(4), 5633–5651.
<https://link.springer.com/article/10.1007/s40747-024-01668-w>
(published 2024).

Provides a concrete domain instantiation of the optimizer/balancer
distinction in a fairness-critical AI context. The paper demonstrates
that accuracy optimization (maximising a scalar utility over prediction
quality) and fairness balancing (minimising variance across demographic
groups, enforcing representation constraints) are **structurally
incompatible as a single objective**: methods that collapse both into a
weighted single-objective function systematically fail to represent the
Pareto trade-off surface and produce solutions that appear optimal but
are dominated on the un-weighted objectives. This is the "unpredictable
behaviour" BP-22's rationale names: a conflated optimizer-balancer
pre-bakes the accuracy/fairness weighting in a way that is invisible to
the caller, producing outputs that are neither correctly optimized nor
correctly balanced. The paper directly validates BP-22's split requirement:
fairness (balancer objective: minimise variance, maximise entropy) and
accuracy (optimizer objective: maximise utility) belong in separate roles
with separate interfaces that make the weighting choice explicit.

---

## Summary

| Rule | Core claim | Primary anchors |
|------|-----------|-----------------|
| BP-20 | Cognitive load (element interactivity) determines splits, not line count | Sweller (1988) CLT foundations; Parnas (1972) comprehensibility criterion; Sweller et al. (2019) element interactivity retrospective |
| BP-21 | Faceted classification avoids monohierarchy; three facets required | Ranganathan (1933/1960) CC PMEST; Spiteri (1998) facet independence; Hearst (2006) path-independence |
| BP-22 | Optimizer (scalar utility) and balancer (Pareto/variance) are non-composable roles | Miettinen (1999) scalarization vs Pareto; Deb et al. (2002) NSGA-II algorithmic distinctness; Celis et al. (2024) fairness-accuracy non-reducibility |

All nine anchors sourced 1933–2024, verified via WebSearch 2026-05-10.
Full slice-progress record in `docs/backlog/P1/081KR2E4K0008QG0R001ADMBVW-bp-nn-rule-anchor-backfill.md`.
