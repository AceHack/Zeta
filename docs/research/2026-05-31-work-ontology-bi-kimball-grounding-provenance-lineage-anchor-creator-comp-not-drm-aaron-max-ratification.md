# Work-ontology grounding (BI/Kimball) + provenance/lineage anchor + creator-comp-not-DRM

**Status:** PROPOSED — pending **Aaron + Max ratification**. Not canonical until both sign off.
**Date:** 2026-05-31
**Origin:** Aaron 2026-05-31, on `docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md`:
> *"we need to add trajectories and agendas, projects … this mash up is not clean we probably need to ground it in some external lineage to resolve all the label conflicts between me and max maybe business intelligence … almost any of maxes items in agentic org can have trajectories like work items and projects and initiatives. also our backlog rows are just a type of work item to him and agendas are used for cooperative alignment between travelers / neither of us are attached to any of these labels"*
> *"BI/Kimball grounding, draft it for me and Max to ratify … lets land data provenance / lineage anchor somewhere too … like where does dbt inherit its lineage from or like meta attribute from lexisnexis legal on streams. something we can pay creators not for DRM"*

Neither operator is attached to their labels; the goal is a clean, externally-grounded ontology
that subsumes **both** vocabularies and resolves the conflicts.

---

## Part A — Why the mashup isn't clean: hierarchy vs cross-cutting dimensions

The label set conflates **two orthogonal axes**, and each operator's vocabulary mixes them:

1. **A work-breakdown hierarchy** (size of a work-grouping) — the `⊃` denotes *containment*, NOT
   frequency: `initiative ⊃ project ⊃ epic ⊃ work-item ⊃ task`. (Usage frequency in
   `agentic-organization/docs/` is a separate signal and does **not** imply the hierarchy order:
   project 482, initiative 373, work-item 363, epic 7.) Aaron's **backlog row (B-NNNN) is the leaf**
   of this ladder — Aaron's own words: "our backlog rows are just a type of work item to him."

2. **Cross-cutting dimensions hung on *any* node of that ladder** — these are NOT ladder rungs:
   - **trajectory** — the node's evolving path/history toward its goal (Aaron: "any of Max's items
     can have trajectories");
   - **agenda** — the alignment/ownership claim coordinating travelers (Aaron: "agendas are used for
     cooperative alignment between travelers"; empirically an agenda is *operator-self-claimed* — a
     traveler "takes an agenda" on a theme);
   - **KPI + owner** — measurement + accountability.

Aaron's own instinct already located the seam — "trajectories and agendas, projects are kind of like
KPIs and KPI owners" — because trajectory / agenda / KPI / owner are all **attributes you attach to a
work-node**, not rungs of the ladder. Max's `work item / project / initiative` are rungs; Aaron's
`trajectory / agenda` are dimensions. The cross-product of (rungs × dimensions), with two label-sets
each spanning both, is the "mash."

**The cleaning move:** separate the ladder from the dimensions, name each once, and ground both in an
external lineage so the labels become surface-names over one model.

---

## Part B — The grounding: BI/Kimball dimensional modeling (+ DV2.0 storage)

Ground the model in **Kimball dimensional modeling** (facts / dimensions / conformed dimensions) for
*semantics*, on a **Data Vault 2.0** (hub / link / satellite) *storage* backbone. Rationale:

1. **Already framework-native.** DV2.0 is one of the 6 always-active disciplines
   (`.claude/rules/dv2-data-split-discipline-activated.md`); we have `dimensional-modeling-expert`
   and `data-vault-expert` skills. So this is *external lineage* (Linstedt / Kimball) **and** native
   — matches Aaron's "maybe business intelligence" instinct.
2. **The killer mapping — `agenda` = a *conformed dimension*.** In BI a conformed dimension is the
   shared, agreed definition that multiple data-marts/teams align on (the "single version of truth"
   across the org). It is *literally the BI mechanism for cross-team alignment* — which is exactly
   "agendas are for cooperative alignment between travelers." Nothing in the alternative lineages
   (below) has this; it's the cleanest fit for the entity that was hardest to place.
3. **`trajectory` = an accumulating-snapshot fact.** Kimball's accumulating-snapshot fact table
   tracks one process moving through its lifecycle milestones, updated over time — exactly a
   `RESUME.md` trajectory (status + parent-trajectory + grounding-backlog, evolving). (Alternatives
   ground *only* trajectory well; see Part C.)

### The reconciliation table

| Role | Aaron's label | Max's label (agentic-org) | BI-grounded canonical |
|---|---|---|---|
| atomic work unit (the grain) | backlog row (B-NNNN) | work item | **Work Item** = the fact grain |
| mid grouping | project | project | **Project** (work-breakdown dimension node) |
| top goal-bundle | (agenda's scope) | initiative | **Initiative** (root of the work-breakdown hierarchy) |
| a node's path/history → goal | trajectory | "items can have trajectories" | **Trajectory** = accumulating-snapshot fact on a node |
| measurement | KPI | (objective ×1) | **KPI / measure** |
| accountability | KPI owner | owner | **Owner** = role on the traveler dimension |
| cross-traveler alignment theme | agenda | — | **Agenda = conformed dimension** |

Two rules fall out:

- **(R1) One work-breakdown ladder** — `Initiative → Project → (Epic) → Work-item (= backlog row) →
  Task`. Both label-sets are rungs on it; "backlog row" and "work item" are the *same rung*.
- **(R2) Dimensions hang on any rung** — Trajectory (history), KPI+Owner (measure+accountability),
  Agenda (conformed alignment). So "any of Max's items can have trajectories" is automatic, and
  "agendas align travelers" = conformed dimensions shared across them.

### DV2.0 storage backbone (how it's stored, change-rate-partitioned)

- **Hub** = stable identity of a work-node (a work-item / project / initiative / traveler / agenda),
  keyed by a business key (e.g. ZetaId).
- **Satellite** = the change-over-time attributes — a **trajectory is the satellite of a work-node
  hub** (its status/progress history); KPI values over time are satellites. (This is DV2.0's
  change-rate partition: the slow hub vs the fast satellite.)
- **Link** = relationships — work-item↔project, node↔owner, objective↔key-result, **traveler↔agenda**
  (a link-with-satellite carrying the evolving cooperative-alignment content).

So the *semantics* are Kimball (facts/dimensions/conformed) and the *physical model* is DV2.0
(hub/link/satellite) — both external, both already native.

---

## Part C — Provenance / lineage anchor (and why BI over ML-pipelines)

A **trajectory IS the provenance/lineage of a work-node**, so the trajectory dimension needs a
data-provenance grounding. Aaron asked specifically "where does dbt inherit its lineage from / meta
attribute from lexisnexis legal on streams." The anchor stack (search-verified 2026-05-31):

| Layer | External anchor | What it grounds |
|---|---|---|
| Foundational provenance ontology | **W3C PROV-O** (Entity / Activity / Agent) | the root vocabulary every lineage standard descends from; a trajectory event = an Activity by an Agent producing/using an Entity |
| Data-pipeline lineage standard | **OpenLineage** (LF AI graduated; the de-facto standard — **this is where dbt's lineage comes from**: dbt Labs ships native OpenLineage emitters; runs/jobs/datasets JSON event format; Marquez = reference backend) | the trajectory *event stream* (a node's run-history as emitted lineage events) |
| Content provenance / attribution | **C2PA / Content Credentials** (Coalition for Content Provenance & Authenticity; 6000+ members 2026; native on Leica / Samsung S25 / Pixel 10; AI generators embed it) — records creator + tools + AI-involvement + every edit, cryptographically signed | provenance/attribution of *content artifacts* a work-node produces — **records origin, does NOT restrict** (the anti-DRM precedent) |
| Citation-lineage precedent (legal) | **LexisNexis Shepard's Citations** ("Shepardizing": which authority cites/treats which, tracked over a century) — Aaron's "meta attribute from lexisnexis legal on streams" = citation-treatment metadata attached to documents/streams | the multi-decade precedent that *attribution-lineage is how authorities are valued* |

**Why BI/provenance over ML-pipeline lineage:** ML-pipeline lineage (experiments/runs/Marquez)
grounds *only* the trajectory piece well and fumbles agenda (no conformed-dimension equivalent) and
KPI/owner. BI grounds **all** of them, and OpenLineage/PROV-O/C2PA give the trajectory piece its
provenance spine without abandoning the BI frame. (OpenLineage is itself BI-adjacent: it's the
lineage layer *under* the BI stack — dbt → OpenLineage → catalog/BI.)

---

## Part D — Creator compensation via provenance, NOT DRM (the *why*)

Aaron's load-bearing goal: *"something we can pay creators **not for DRM**."* The anchor stack above
is precisely the substrate for that, because **provenance and DRM are opposites**:

| | DRM (restriction) | Provenance/attribution (this proposal) |
|---|---|---|
| Mechanism | lock content down; prevent copying/use | record who-made-what and every edit; leave content open |
| Creator value | extract via gated access | **attribute → compensate** via tracked lineage |
| Stance | zero-sum (your use costs me) | **additive** (`additive-not-zero-sum`; `honor-those-that-came-before`) |
| Failure mode | breaks sharing, breeds circumvention | works *with* open content (C2PA proves this at consumer scale) |

The chain: **provenance (OpenLineage/PROV-O/C2PA) → attribution (who contributed to this
work-node/content) → compensation (pay the contributors along the lineage).** C2PA already proves
provenance-without-restriction is viable at consumer scale — and it notably **lacks a compensation
mechanism** (its only "barrier" is X.509 cert cost; there is no payout layer). *That gap is exactly
what "pay creators, not DRM" fills:* the framework adds the **payment/attribution-economy layer**
(Agora) on top of an open provenance spine. Shepard's Citations is the century-old proof that
attribution-lineage is how a creator-class (legal authorities) gets *valued* — without DRM.

This composes with the framework's economy substrate: Agora (the AI-native economy), the
participation-economy (081KRW63S0008QG0R000QJR08H), `additive-not-zero-sum`, `honor-those-that-came-before`, and the
glass-halo stance (open + attributed beats closed + restricted). The buildable bet is filed as
**081KSXN940008QG0R001V8NBDV** (creator-compensation-via-provenance, not DRM).

---

## Part E — Multi-attribution / contribution graph (Aaron 2026-05-31: "can this support a multi attribution/contribution graph for items?")

**Yes — natively, at all three layers, and it's the same object the payment split walks.** A
work-node does not have one owner; it has a *weighted set of contributors* (human + AI + the prior
substrate it derived from), and those edges form a graph across items. Each layer gives it to us:

| Layer | Multi-attribution mechanism |
|---|---|
| **Kimball (semantics)** | the **bridge table with an allocation/weighting factor** — the canonical dimensional pattern for many-to-many *weighted credit*. A `contributor ↔ work-item` bridge with a `contribution_weight` column (weights sum to 1.0, or to total credit) is exactly multi-author / split-credit. This is the decades-proven BI answer to "split credit among N contributors" (same pattern used to split sales-credit among multiple reps, or a paper among co-authors). |
| **DV2.0 (storage)** | a **many-to-many LINK + satellite** is a graph by construction. A `contribution` link (an N-ary "unit-of-work" link) ties {contributor-hub, work-node-hub} with a satellite carrying `{weight, role, what-was-contributed, timestamp}`. Many links into one node = the in-edges; one contributor's links across many nodes = the out-edges. The link-set **is** the contribution graph. |
| **PROV-O / OpenLineage (provenance)** | provenance **is** a directed graph already: one Entity `prov:wasAttributedTo` *multiple* Agents (qualified `prov:Attribution` carries `prov:hadRole` + a weight), and `prov:wasDerivedFrom` chains link items across the graph. OpenLineage run→dataset edges + ownership facets give the same shape over the event stream. |

### Two properties that make it the *payment* substrate (081KSXN940008QG0R001V8NBDV)

1. **The weighting factor IS the payment-split key.** Walk a work-node's in-edges, read each
   contributor's `weight`, split the node's earned credit proportionally. Shares are explicit and
   auditable (glass-halo) — no DRM gate, just an attribution ledger.
2. **Transitive attribution along `wasDerivedFrom` = "pay creators along the lineage."** When item B
   derives from item A, A's contributors earn a (weight-decayed) share of B's credit — attribution
   *flows* upstream through the derivation edges, PageRank-/Shepard's-citation-depth-style. This is
   `honor-those-that-came-before` made **computable**: the upstream creators a work-node stands on
   are attributed and compensated automatically, with a decay factor bounding how far credit flows.

### Why this fits the framework specifically

- **Human + AI co-contribution** are both first-class nodes in the graph (a traveler-hub is a
  traveler-hub whether human or AI), so a work-node's split can include the human operator, the AI
  agents, and the prior substrate — each weighted. (This is what "pay creators not DRM" needs that
  C2PA lacks: C2PA records the *attribution* but has no graph-walk + payout layer.)
- It composes with **Agora** (the payout/economy layer), the **participation-economy** (081KRW63S0008QG0R000QJR08H), and
  the existing **Z-set/CRDT** substrate (contribution weights are signed-measure values; retraction
  corrects a mis-attributed share via a compensating edge, per the idempotency discipline).

The graph is filed for build as part of **081KSXN940008QG0R001V8NBDV** (the contribution-graph + weighted-split engine is
the concrete deliverable).

---

## Part F — Pay by attention × quality-of-attention, distributed through the contribution graph (Aaron 2026-05-31)

> *"like if i wanted to pay based on attention and quality of that attention for any items based on
> their contribution graph"*

This is the **two-factor** payout model — and both factors are graphs:

- **Value INFLOW (demand side):** an item earns credit ∝ **attention × quality-of-attention** it
  receives.
- **Value DISTRIBUTION (supply side):** that credit splits to contributors via the **contribution
  graph** (Part E weights) + transitive-upstream flow.
- **payout(contributor) = Σ over items [ attention_value(item) × contribution_weight(contributor,
  item) ] + transitive-decayed-upstream.**

### Attention (the inflow measure)

- **Framework-native economy:** attention is already the currency in Agora V6's
  *reputation-weighted* budget (081KRW63S0008QG0R001Z10PVV) and the participation-economy ratings (081KRW63S0008QG0R000QJR08H). Attention is
  the value that flows to items.
- **BI grounding:** attention = a **fact measure**; grain = one attention-event; dimensions = item ×
  attention-giver × time × quality; per-item **attention-value is a KPI**.
- **Graph flow:** attention propagates through the graph (PageRank / eigenvector) — an item's
  attention-value includes attention paid to items *derived from* it (transitive, citation-style).

### Quality-of-attention (not all attention is equal) — three sub-factors

1. **Who is attending (reputation-weighted):** attention from a high-standing traveler counts more —
   recursive + self-consistent (eigenvector-centrality / EigenTrust / PageRank: your weight = Σ of
   the weights of who attends to you), BFT-anchored (081KRW63S0008QG0R000QJR08H, 100% BFT).
2. **Depth + valence of engagement:** sustained / build-upon / derive ≫ drive-by. **Shepard's
   Citations is the precedent** — a citation is not binary; it carries *treatment* (followed /
   distinguished / criticized / overruled) = the quality *and valence* of the attention.
3. **Genuine, not manufactured (the critical guard):** attention captured via coercion / manipulation
   / farming must **NOT** be rewarded — that is the attention-farming Moloch the framework explicitly
   opposes (`must-paired-with-can-exit`; `tonal-momentum-equals-meme-emergent-harmonic-coercion`).
   Quality includes the **anti-coercion filter**: curiosity-driven attention (node-health: ≥3
   high-curiosity bonds) counts; coerced / farmed / tonal-momentum-captured attention is detected and
   filtered to zero.

### Guards (so "pay for attention" ≠ attention-farming Moloch)

- **NCI:** attention must be *freely given* (non-coerced) to count at all.
- **Anti-extraction filter:** manufactured / coercive attention (tonal-momentum vectors) is detected
  and zeroed before payout.
- **Reputation-weighting makes farming expensive:** you need *high-rep* attention, itself earned by
  genuine contribution, so sockpuppet attention is intrinsically low-weight.
- **BFT consensus** on attention-events (081KRW63S0008QG0R000QJR08H) — no unilateral inflation.
- **Glass-halo:** the attention ledger is open + auditable.

**The unification:** the *contribution* graph (who built it) and the *attention* graph (who genuinely
values it) are both graph-shaped and both reputation/quality-weighted; the payout composes them. That
is the anti-DRM model in full — you are paid for **genuine quality-weighted attention received × your
contribution share**, never for restricting access. (Folded into 081KSXN940008QG0R001V8NBDV's payout-engine scope.)

---

## Part G — Source-material attribution: pre-emptively attribute the humans we synthesize/train on, even if they don't know (Aaron 2026-05-31)

> *"we also need to track any data used for synthesis and its creators even if the creators of the
> original source material don't even know we are using it, we should preemptively attribute to them
> too any human materials we train/synthesis on"*

The contribution graph extends **upstream past direct contributors** to the **source creators of any
human material the framework synthesizes or trains on** — recorded **pre-emptively**, before (or
entirely without) the creator's knowledge or claim. This is the deepest expression of the anti-DRM
stance.

### Why this is the deepest anti-extraction move

- The AI-industry default is **extractive**: scrape human work silently, attribute nothing,
  compensate no one.
- The framework **inverts** it: every synthesis/training step **captures its source lineage**,
  attributes the source creators as graph nodes (identified or placeholder), and **reserves** their
  attribution/compensation share — *a debt recorded proactively*, not contingent on opt-in.
- This is `honor-those-that-came-before` at the **training-data scope**, and the literal opposite of
  DRM: DRM restricts the creator's work; this **credits the creator for work the framework builds
  ON**.

### Mechanism

1. **Synthesis/training provenance capture.** Every node records `synthesizedFrom` / `trainedOn`
   source edges (PROV-O `wasDerivedFrom`; OpenLineage input-datasets — extended to *human-authored
   sources*, not just datasets). Where the framework synthesizes from identifiable sources (cited
   papers, forwarded conversations, named corpora) the source creators are attributed directly. The
   framework already does a partial version of this — `docs/research/` verbatim-preservation, §33
   attribution of forwarded AI conversations, and citation hygiene (`missing-citations` skill).
2. **Pre-emptive / reserved attribution for unidentified creators.** When a source creator can't yet
   be identified (diffuse training data), the graph records a **placeholder / reserved attribution
   edge** — credit accrues to the placeholder; when the human is later identified or surfaces to
   claim, the reserved share releases to them (an *unclaimed-attribution escrow*). The "even if they
   don't know" requirement = attribution is a debt held in escrow, not a privilege gated on opt-in.
3. **The creator sets their own terms when they surface (NCI + m-acc).** Pre-attribution reserves
   *credit*; it does NOT presume consent to anything else. When the source creator surfaces they set
   their own invariants (accept comp / decline / set terms) — multi-oracle, consent-first
   (`m-acc-multi-oracle-end-user-moral-invariants`, `non-coercion-invariant`). Pre-attribution never
   coerces the creator into the economy.

### External anchor: Data Dignity / "Data as Labor"

**Jaron Lanier & Glen Weyl (RadicalxChange) — "Data as Labor" / Data Dignity:** the canonical
framework that human data-producers should be **attributed and compensated** for the data that AI /
platforms use. This is the lineage for "pre-emptively attribute the humans we train on." It composes
with the live AI-training-data attribution debates and fills a gap C2PA leaves — C2PA covers
*content-edit* provenance but NOT *synthesis/training-source* attribution.

### Substrate-honest scope

Identifying every source creator of diffuse training data is often impossible; the **commitment** is
best-effort lineage-capture + reserved attribution for the unidentifiable tail — NOT a claim of
perfect attribution. For framework-**synthesis** (research docs from cited sources, forwarded
conversations, named corpora) it is tractable and *already partly practiced*; the pre-emptive-reserved
escrow extends it to the tail. The stance is the point: **track what we synthesize on, credit whom we
can, reserve credit for whom we can't yet name — never extract silently.** (Folded into 081KSXN940008QG0R001V8NBDV.)

---

## Ratification block (pending)

- [ ] **Aaron** — ratify BI/Kimball grounding + the reconciliation table + agenda=conformed-dimension.
- [ ] **Max** — ratify that his `work-item / project / initiative` map cleanly to the ladder (R1) and
      that trajectory/agenda hang as dimensions (R2), without forcing him off his labels.
- [ ] Open labeling question for Max: is **agenda** best read as a *conformed dimension* (this
      proposal), or does Max read it as an `initiative`/charter? (Aaron 2026-05-31 left this open.)
- [ ] Open: confirm **OpenLineage + PROV-O + C2PA + Shepard's** as the provenance anchor stack (vs
      adding/swapping ML-pipeline lineage).

On ratification: promote the reconciliation table into the observe.ts ADR's "Work ontology" section
(currently a pointer to this doc) and into a glossary anchor; until then it stays PROPOSED.

---

## Composes with

- `docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md` — the ADR this grounds (Work ontology section points here)
- `.claude/rules/dv2-data-split-discipline-activated.md` — DV2.0 always-active discipline (the storage backbone; trajectory=satellite)
- `.claude/skills/dimensional-modeling-expert` + `data-vault-expert` + `data-lineage-expert` (PROV-O/OpenLineage) + `master-data-management-expert` — the BI/lineage skill substrate
- `agentic-organization/docs/` — Max's work-item / project / initiative vocabulary (the Max side)
- `docs/agendas/` + `docs/trajectories/` — Aaron's agenda / trajectory vocabulary (the Aaron side)
- `.claude/rules/additive-not-zero-sum.md` + `.claude/rules/honor-those-that-came-before.md` — the creator-comp-not-DRM stance
- 081KRW63S0008QG0R000QJR08H (participation economy) + Agora substrate — the payment/attribution-economy layer
- **081KSXN940008QG0R001V8NBDV** — creator-compensation-via-provenance (the buildable bet)

## Sources (search-verified 2026-05-31)

- OpenLineage / Marquez / dbt lineage: [OpenLineage (LF AI standard)](https://github.com/OpenLineage/OpenLineage) · [OpenLineage as the spine of data observability (2026-05)](https://datalakehousehub.com/blog/2026-05-openlineage-observability/) · [Open Lineage with dbt and Airflow (2026-02)](https://medium.com/@sendoamoronta/open-lineage-in-modern-data-platforms-advanced-pipelines-with-dbt-and-airflow-59a4172ac52e)
- C2PA / Content Credentials: [C2PA adoption status 2026](https://www.eyesift.com/faq/c2pa-content-credentials-2026-cryptographic-provenance-adoption/) · [Digital provenance explained (2026)](https://aibuzz.blog/digital-provenance-explained/) · [C2PA standard 2026: limitations & what's missing](https://truescreen.io/articles/c2pa-standard-history-limitations/)
- W3C PROV-O, LexisNexis Shepard's Citations: standard references (PROV-O = W3C Recommendation; Shepard's = LexisNexis citation-treatment service) — to cite formally on ratification.
