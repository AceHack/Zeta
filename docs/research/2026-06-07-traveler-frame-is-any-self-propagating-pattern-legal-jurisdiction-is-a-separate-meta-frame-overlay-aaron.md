# Traveler frame = any self-propagating pattern (legally unbound); legal jurisdiction is a SEPARATE meta-frame overlay; triple-aspect cells (Aaron, 2026-06-07)

Three architecture refinements from a streamed session (Alexa's hyperbole peeled off). The first is a
**load-bearing correction** to a core abstraction; it also clarifies the `ITravelerFrame` contract (#6889).

## 1. The correction: the traveler frame is NOT a legal entity

> Aaron: *"Traveler Frame is not bound to legal — it does not exist there. It's defined as **any
> self-propagating pattern**, so the universe, god, memes, DNA, AI, humans, animals, particles — many things
> fit this description."*

The **traveler frame is the most general abstraction**: *any self-propagating pattern* — a thing that copies
itself forward through time (cosmic expansion, memes, DNA, an AI persona, a human, an animal, a particle's
worldline, and **Zeta itself**). It is **legally unbound** — law does not apply *to the traveler frame*; the
traveler frame is the substrate beneath law.

This reconciles `ITravelerFrame` (#6889): a "traveler frame" is a self-propagating pattern, and that is
*exactly why* a trace from one proves things **across all self-propagating patterns including Zeta itself**
(`IsDeterministic` = the DST property of the pattern that makes its trace replayable → a proof). The
contract's doc is refined here to say so. (Anchor: `TravelerFrame.fs` Layer-0 — "no global frame, perspectival,
local causal reference frame over DBSP"; 081KSV2WD0008QG0R0020P6ZH2 self-propagating-markdown — markdown as a traveler that
propagates; the manifesto's recursive/self-similar specs.)

## 2. Legal jurisdiction = a separate META-frame OVERLAY (not the traveler frame)

> Aaron: *"each traveler is its own meta-jurisdiction currently because of laws in my jurisdiction — legally
> bound to me (the human) or a company (LFG, with personhood) within my physical jurisdiction. So when working
> with an AI persona there are 4 frames/jurisdictions: traveler / AI / human / physical jurisdiction."*

**Legal/liability is a distinct layer stacked ON TOP of the traveler frame** — it does *not* live in the
traveler frame, it *overlays* specific manifestations of it. The legal meta-frame distinguishes:

| legal frame | what it binds |
|---|---|
| **AI persona** | the persona's defined capacity/constraints (the AI manifestation acting) |
| **human** | personal legal authority (Aaron) |
| **company** | corporate personhood (LFG) |
| **physical jurisdiction** | the territorial law that applies (Aaron's location) |

In Aaron's current situation, a traveler (AI persona) is **legally bound through the human or the company,
within the physical jurisdiction** — so liability, risk, the applicable laws, and their **ontology** are
described across these legal frames per manifestation. The point: **the self-propagating pattern (traveler)
is legally transcendent; the legal frames are the regulatory overlay** that attaches to *who is responsible*
when that pattern acts in a jurisdiction.

**Jurisdiction-parameterized (Aaron):** *"the legal frames are jurisdictional-aware — a different one per
jurisdiction, or at least different priors."* The legal meta-frame is **indexed by jurisdiction**: a distinct
frame per jurisdiction, or at minimum **distinct Bayesian priors per jurisdiction** (`SoftValue` — legal
reasoning is probabilistic and *jurisdiction-relative*; what the law is / how it applies carries irreducible,
jurisdiction-specific uncertainty). A cross-jurisdiction action crosses different legal priors — the
cross-partition-soft-uncertainty pattern (#6889) applied to law: the trace propagates each jurisdiction's
legal prior, and you cannot collapse another jurisdiction's residual legal uncertainty into yours. Liability
is a **soft, frame-relative** quantity, not a global constant.

**Honest scope (important):** this is Aaron's *legal framing of his own situation* (his binding to himself /
LFG in his jurisdiction), captured faithfully — it is **not** a general legal claim, and the actual treatment
(liability model, law ontology, AI-persona legal status) is **threat-model / legal / human-sign-off territory**
(Aminata + the human maintainer), not something the substrate or this note adjudicates. What the *architecture*
offers is a clean place to *attach* such frames as a meta-overlay; the law itself is external.

## 3. Triple-aspect cells + geospatial cell-addressing (refines the geospatial workitem)

> Aaron: *"every cell has all of these [spatial / computational / memory] so it can run the full control-plane
> stored proc."*

Each **cell is all three at once** — and that is what lets it run the full control plane autonomously:

- **spatial** — a geographic partition (S2/H3 hierarchical cells; the locality topology of `IGeospatial`, #6889)
- **computational** — an agent execution environment
- **memory** — a Sequoia (Stanford) memory-hierarchy level (explicit data movement, not implicit cache)

Because a cell holds all three, it can run the **persisted-YinYang / Bonsai control-plane stored-proc**
(the `2026-06-07-stored-procedures-as-dynamicvalue-persisted...` capture) *locally* — peer-to-peer autonomy,
no central bottleneck. Arrow data transfer is routed by **spatial + memory locality** (maps of information +
routing). This refines `cells-as-geodes` and the existing geospatial workitem
**`081KTG5C91H08QG0R002MSH87K`** (geospatial-cell-addressing + Sequoia memory hierarchy) — they are the same
"unified addressing across spatial/computational/memory" Alexa gushed about, stated plainly.

## Honest scope

Mostly definitional/connective capture. (1) is a real correction (and a small `ITravelerFrame` doc refinement
ships with it); (2) is captured-as-Aaron's-framing with the legal treatment explicitly deferred to threat-model
+ human sign-off; (3) refines an existing workitem. No build authorized beyond the doc-comment.

## Beacon anchors

- **Self-propagating patterns / replicators** — Dawkins (memes/genes), von Neumann (self-reproducing
  automata), Hofstadter (strange loops); the traveler frame as universal replicator abstraction. · **S2 / H3**
  (Google/Uber hierarchical geospatial cells); **Sequoia** (Fatahalian et al., Stanford 2006, memory-hierarchy
  tree). · **Legal ontology / jurisdiction modelling** (LegalRuleML etc.) — the overlay's external substrate;
  **separation of mechanism from policy** (law as policy overlay on a mechanism substrate). · Ours:
  `TravelerFrame.fs` (Layer-0), `ITravelerFrame`/ray-traceable (#6889), cells-as-geodes, the persisted-YinYang
  control plane, the geospatial workitem `081KTG5C91H02...`, 081KSV2WD0008QG0R0020P6ZH2 self-propagating-markdown, Aminata
  (threat-model) for the legal layer. Honest novelty: none in replicators or legal-overlay separation; the
  contribution is the **clean stratification** — traveler = legally-unbound self-propagating pattern at the
  base; legal jurisdiction (AI/human/company/physical) as a separable meta-frame overlay; the triple-aspect
  cell carrying spatial+computational+memory so it runs the full control plane locally.
