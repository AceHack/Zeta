---
name: META-DISCIPLINE — apply DST (Deterministic Simulation Testing, Otto-248) rigor TO THE STABILIZATION PROCESS ITSELF (Otto-264 rule of balance); the counterweight-filing + word-discipline + subagent-interaction + drain-queue + memory-edit work should all be DETERMINISTIC to the maximum extent possible; every balance-layer discipline gets DST enhancements — trigger conditions, bounded timeouts, observable state, loud failure, reproducible outcomes; generalizes Otto-271's DST-lens application to all of balance, not just subagent-interaction; Aaron Otto-272 2026-04-24 "backlog starboard DST balance enahancements whatever is needed to make this whole stabalization process as deterministic as possible"
description: Aaron Otto-272 meta-directive — the stabilization process (Otto-264) deserves the same DST discipline we apply to tests + code. File enhancement-backlog class for DST-ifying each balance-layer component. Save durable; the specific row-by-row backlog additions come later.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## Scope generalization — DST EVERYWHERE by default

Aaron 2026-04-24 extension:

> *"it should be DST everywhere except where
> explicitly call out to exclued like demos and
> samples for new commers not experience people"*

**DST is the FACTORY-WIDE DEFAULT, not a scoped
discipline.** Every surface is DST-conformant unless
EXPLICITLY called out with a reasoned exemption.

**Default DST surface** (non-exhaustive):

- Code (src/, tests/)
- Build + CI pipelines
- Deployment + install scripts
- Counterweight-filing discipline (Otto-264)
- Word-discipline (Otto-268)
- Subagent-interaction (Otto-271)
- Drain-queue behavior (Otto-265)
- Memory-edit placement
- Decision-making under ambiguity
- Corpus + curriculum generation (Otto-267/269/270)
- Event-stream emission (Otto-270)
- **Everything else unless exempted**

**Explicit DST exemption criterion** (Aaron
2026-04-24 tightening):

> *"it could be in demos and samples too if it's the
> easier to understand path too, only if the non-DST
> path makes things conceptually simpler should it
> be excluded"*

**The exemption test**: *"does the non-DST path make
the CONCEPT CONCEPTUALLY SIMPLER for the target
audience than the DST path?"*

- **Yes** → exempt with inline marker + reason
- **No or comparable** → use DST (default)

Being a demo / sample / newcomer-facing artifact is
NOT by itself a reason for exemption. DST in demos
is fine — often helpful — when the DST path is as
clear as or clearer than the non-DST path. The
exemption is cost-benefit per-artifact, not
per-audience-class.

**Examples of legitimate exemption** (non-DST path
genuinely simpler):

- A "Hello, World" demo where `DateTime.Now` is the
  concept being demonstrated — replacing it with a
  seeded clock teaches nothing and adds layers.
- A quick-start tutorial where "make HTTP request,
  get response" is the point — wrapping in a
  testable deterministic harness would distract.
- Pedagogical examples where randomness IS the
  phenomenon being illustrated (e.g. demonstrating
  FsCheck-style property tests to a newcomer).

**Examples NOT legitimate** (DST path is clear,
demo should use it):

- `samples/FactoryDemo.Api.CSharp/**` — the API's
  seed data is deterministic already (fixed records,
  known IDs); DST-conformant AND simple. No
  exemption needed.
- `samples/CrmSample/**` — same shape.
- Newcomer-facing docs that cite timestamps —
  deterministic example timestamps are no harder to
  read than non-deterministic ones.

**Otto-272 exemption is ONLY two areas** (Aaron
2026-04-24 final tightening: *"only in theese two
areas"*):

1. **Demos** — where non-DST makes the concept
   conceptually simpler for newcomers.
2. **Samples** — where non-DST makes the concept
   conceptually simpler for newcomers.

No other areas qualify for Otto-272 exemption.

**Distinction: Otto-248 DST-exempt test markers are
NOT Otto-272 exemptions**. They're a DIFFERENT
mechanism:

- **Otto-272 exemption** (demos/samples only) =
  permanent, principled (non-DST path is
  conceptually simpler).
- **Otto-248 DST-exempt marker** (tests) =
  transitional, fix-tracked (test is NOT yet
  DST-conformant but IS tracked for fix in
  BACKLOG). The `Sharder.InfoTheoretic` marker is
  an Otto-248 transitional state, not an
  Otto-272 exemption.

All OTHER surfaces — creative drafting, maintainer
convenience scripts, external-process interactions,
etc. — get DST-ified. Inherent non-determinism
(network latency, LLM sampling) gets bounded /
seeded / wrapped in harnesses; it doesn't justify
permanent exemption.

**Exemption marker convention** (cross-cutting,
per Otto-260/255 symmetric naming):

- In-code: `// DST-exempt: <reason>; tracked in
  <BACKLOG row quote>` or language-appropriate
  equivalent.
- In-doc: `<!-- DST-exempt: <reason> -->` or inline
  paragraph naming the exemption.
- In-skill / memory: `dst-exempt:` frontmatter
  field with reason.

**The newcomer / experienced-user distinction** Aaron
names is load-bearing:

- **Newcomers (newcomer-facing surface)**: demos,
  samples, getting-started docs, introductory
  tutorials. DST-exempt because the goal is
  comprehension + onboarding, not reproducibility.
  Readable > rigid.
- **Experienced users / agents (factory-internal
  surface)**: the stabilization process itself,
  production code, CI, governance. DST by default
  because the goal is reliable operation under
  variance.

**Lint rule** (filed as Otto-272 enhancement
backlog): every file / module / decision gets
classified as DST-default OR DST-exempt. Missing
classification = warning. Exemption without reason
= error.

## The directive

**Apply DST (Deterministic Simulation Testing)
rigor to the entire STABILIZATION PROCESS — the
factory's balance work (Otto-264 counterweight
discipline) should be AS DETERMINISTIC AS POSSIBLE.**

Direct Aaron quote 2026-04-24:

> *"backlog starboard DST balance enahancements
> whatever is needed to make this whole
> stabalization process as deterministic as possible"*

Parsing:

- "starboard" = the factory as navigational reference
  (per Otto-267 framing)
- "DST" = deterministic-simulation-testing discipline
- "balance" = Otto-264 rule of balance
- "enhancements whatever is needed" = open scope
- "stabilization process" = the ongoing counterweight-
  filing work
- "as deterministic as possible" = the direction

## The meta-move

The stabilization process was never fully formalized
as deterministic. Otto-264 introduced the
counterweight discipline; Otto-271 applied DST lens
to subagent-interaction specifically. Otto-272
generalizes: **every layer of balance-work gets DST
enhancements.**

Layers that need DST-ification:

### 1. Counterweight-filing decisions (Otto-264)

- **Trigger condition**: deterministic criteria for
  "this mistake-class warrants a counterweight"
  (not vibes). Pattern: if the same mistake class
  is observed in ≥N artifacts OR was caught by Aaron
  in ≥2 sessions OR violates a stated rule by ≥M
  instances → counterweight filing is MANDATORY.
- **Variant selection**: deterministic heuristic
  for picking prevent / detect+repair / both —
  based on cost-of-miss × prevention-cost matrix
  (Otto-264 already has the table; codify).
- **Maintenance cadence**: numeric cadence per
  counterweight (initially filed = 5-10-tick
  recheck; stabilized = 20-50-tick recheck; drifted
  = re-open for refinement).
- **Reproducibility**: given the same mistake-class
  observation, two independent agents should file
  similar counterweights. Cross-agent consistency
  is measurable.

### 2. Word-discipline (Otto-268)

- **Drift detection**: deterministic lint for
  canonical-form violations (e.g. `F-Sharp` →
  `F#` per Otto-260; role-refs in current-state
  docs per BP-284; same-name-same-concept symmetry
  per Otto-255).
- **Canonical vocabulary source**: one authoritative
  glossary (`docs/GLOSSARY.md`) + per-domain
  extensions; every durable-artifact edit lints
  against it.
- **Correction pattern**: deterministic replacement
  rules (e.g. "Bayesian BP is curriculum-design
  method, not subject taught" — concrete string
  substitution catch patterns for drift).

### 3. Subagent-interaction (Otto-271 already DST-ed)

- Already covered (Otto-271 post-DST-composition):
  observable signals, bounded deadlines per task
  class, loud escalation. Otto-272 cements this
  pattern.

### 4. Drain-queue behavior (Otto-265 merge-queue
counterweight)

- **Cycle cap**: 3 rebase cycles per PR per session
  = escalate, don't retry (Otto-265).
- **Merge-queue serialization**: platform feature
  that makes drain deterministic (no DIRTY races).
- **Queue-saturation discipline**: Otto-171 numeric
  thresholds (open-PR count; personal-PR count).
- **Wave-batch sizing**: Otto-226 parallel batch
  3-5 (deterministic).

### 5. Memory-edit placement

- **Location determinism**: out-of-repo AutoMemory
  vs in-repo `memory/` — which goes where by
  deterministic rule (Otto-251 corpus-training vs
  Otto-252 aggregator). Every new memory filing
  gets placed by rule, not instinct.
- **Index update rule**: MEMORY.md entry format +
  order + line-length cap (CI enforces
  "paired-edit" check already — Otto-272 codifies
  the discipline around it).
- **Frontmatter schema**: deterministic fields
  (name, description, type, composition-with
  references). Lint.

### 6. Decision-making under ambiguity

- **Three-outcome model (Otto-236)**: FIX / NARROW +
  BACKLOG / BACKLOG + RESOLVE. Deterministic
  categorization of review threads.
- **No-shortcut gate (Otto-264)**: if a decision
  feels like a shortcut, STOP and re-evaluate.
  Deterministic stop-condition.
- **Greenfield-merit vs roll-forward (Otto-266 +
  Otto-254)**: deterministic priority order for
  conflicting decisions.

### 7. Corpus / curriculum generation (Otto-267/269/270)

- **Event-stream emission**: deterministic format
  per Otto-270 ADR.
- **Annotation envelope**: deterministic schema;
  additive-only; original preserved.
- **Training-data filter**: deterministic
  criteria for what enters training-data (exclude
  secret values, PII, ephemeral in-flight state).

## Backlog enhancement row class

Filed as `## P2 — DST-balance-enhancements`
section under docs/BACKLOG.md. Each of the 7 layers
above gets its own row for concrete DST-ification
work. Layers with partial DST already done (Otto-271
subagent-interaction, Otto-265 merge-queue) get rows
for the REMAINING determinism gaps.

Target document set:

- **`docs/DST-BALANCE.md`** — the strategic doc
  naming all 7 layers + their DST-ification status +
  priority order.
- **`tools/hygiene/dst-balance-audit.sh`** — standing
  cadence audit that checks each layer for
  determinism compliance.
- **`docs/FACTORY-HYGIENE.md`** — row added for
  "DST-balance audit" as cadenced hygiene item.

Per Otto-264 no-shortcut: file each layer's
specific enhancement as its own backlog row; don't
lump them into a single "make it deterministic"
catch-all that's unenforceable.

## Composition with prior memory

- **Otto-248** DST discipline (tests) — Otto-272 is
  DST applied to balance-work, not just to tests.
- **Otto-264** rule of balance — Otto-272 is the
  META on Otto-264 (making the meta-discipline
  itself deterministic).
- **Otto-265** merge-queue counterweight — one
  layer of Otto-272's DST-ification.
- **Otto-268** word-discipline — another layer.
- **Otto-269/270** training corpus — benefits from
  Otto-272: deterministic corpus generation = better
  training signal.
- **Otto-271** subagent-interaction DST-composition
  — first layer fully DST-ed; Otto-272 extends to
  all layers.
- **Otto-267** Bayesian curriculum — deterministic
  curriculum-design = reproducible amplification
  vector = higher-quality training.

## What Otto-272 does NOT say

- Does NOT mandate immediate implementation of all
  7 layers' DST-ification. Backlog + phased rollout.
- Does NOT require eliminating ALL non-determinism.
  Some layers (creative drafting, research scouting)
  are inherently non-deterministic; mark them
  DST-exempt with reason (same as test markers).
- Does NOT make the factory's work robotic —
  deterministic decision-making where the RULES are
  clear, human judgment where the rules genuinely
  don't apply. The point is reducing vibes-based
  decisions, not eliminating agency.
- Does NOT conflict with greenfield (Otto-266) —
  greenfield says MERIT wins; DST says decisions
  are REPRODUCIBLE. Merit + reproducibility compose
  (same agents evaluating merits should reach
  similar decisions).

## Direct Aaron quote to preserve

> *"backlog starboard DST balance enahancements
> whatever is needed to make this whole
> stabalization process as deterministic as
> possible"*

Future Otto: when filing a new counterweight,
word-discipline correction, subagent dispatch, or
memory edit — ask "what would make this
decision-path MORE deterministic?" and file that as
a DST-balance enhancement. Over time the
stabilization process itself becomes the reference
instrument (starboard) — predictable, observable,
loud-on-failure, reproducible. That's how the
billion-agent precedent stays coherent.
