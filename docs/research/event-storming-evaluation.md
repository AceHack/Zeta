# Event Storming — applicability evaluation for Zeta

**Round:** 44
**Date:** 2026-04-20
**Author:** main-agent Claude (autonomous-loop)
**Status:** research report; recommendations pending Architect sign-off
**Request origin:** Aaron verbatim — "At some point can you do some
reserach on event storming ... First see if it's useful to us on
this porject. if it is, lets retoractifly adapot it to everything
so our project feels like we started with it in the first place."

---

## TL;DR

Event Storming (ES) is a workshop technique for *discovering*
event-driven domains, authored by Alberto Brandolini (≈ 2013,
popularised by his 2019 Leanpub book *Introducing EventStorming*).
It is not a technology, has no runtime artefact, and is not
tied to a programming paradigm. Its primitives are coloured
sticky notes on a wall representing **domain events**,
**commands**, **aggregates**, **policies**, **read models**,
and **bounded contexts**.

**Verdict:** *strong fit*, and the primary customer is the
**software-factory part of Zeta** (the generic, reusable part
— not Zeta the DBSP database). ES's vocabulary is deliberately
**more generic than Zeta's operator algebra**, which is
currently biased toward the database domain. That generic
vocabulary is exactly what the factory needs to be cleanly
separable from Zeta-the-product.

A secondary (and still strong) fit — Zeta itself is **already
event-sourced by construction**. The DBSP paper's delta semantics
are isomorphic to Event Sourcing's event log; Z-set `+k` / `-k`
entries *are* domain events + retractions; operators *are*
commands; state-carrying operators (`IntegrateOp`, `FeedbackOp`)
*are* aggregates; `Nest` sub-circuits *are* bounded contexts.

What Event Storming gives the **software factory** (primary
customer) that it does not already have:

1. **A domain-generic vocabulary** (events / commands /
   aggregates / policies / bounded contexts / read models)
   that lives at a higher level of abstraction than Zeta's
   operator algebra. The factory is supposed to be reusable
   across projects (per
   `memory/project_factory_reuse_beyond_zeta_constraint.md`);
   ES's vocabulary is the cleanest ready-made abstraction
   that maps onto any event-driven system — not just databases.
2. **A greenfield-onboarding protocol.** ES's Big-Picture
   workshop is explicitly designed for the "we have an idea,
   now what?" moment — it ships with playbooks of
   *questions to ask when you don't know what questions to
   ask*. That is exactly the gap new-project bootstrap
   currently has: Aaron and a factory agent can describe a
   domain vaguely, but the factory has no structured prompt
   ladder to turn vague-intent into a spec. ES provides it.
3. **A potentially excellent automated UX.** Brandolini's
   technique is already beloved as a paper-and-whiteboard
   experience; **an automated variant — stickies that
   appear as events emerge from chat, colour-coded,
   timeline-ordered, with the facilitator-agent asking
   the next question in the playbook — would be "one
   hell of a UI"** (Aaron, 2026-04-20 late). This is a
   differentiator for the factory-as-product.
4. **Factory-skill / Zeta-skill separation leverage.** ES
   vocabulary reads *zero* like Zeta. Adopting it inside
   factory skills makes the seam between "factory
   (portable)" and "Zeta (database-specific)" obvious in
   the text — every skill that uses the word "event" or
   "command" is factory-generic; every skill that uses
   "Z-set" or "operator" or "z⁻¹" is Zeta-specific.
5. **A retroactive teaching surface for Zeta.** Secondary
   but real — once the factory speaks ES, Zeta can be
   described in ES terms to outsiders. For Zeta's own docs
   rewrite ("feels like we started with it in the first
   place"), ES gives us an ordering: events → commands →
   aggregates → bounded contexts → read models.

**Recommendation:** adopt as a *strategy* (per Aaron's Matrix-
mode framing), absorb via an expert / teacher / auditor
skill-group at the **factory level** (not Zeta level), and
then layer a Zeta-vocabulary bridge on top. Factory skills
get the ES vocabulary first; Zeta docs get the ES-bridge
pass second. This sequencing preserves the factory's
portability.

---

## 1. What Event Storming is — canonical summary

Sources cited below in §4. This section is the synthesis.

### 1.1 Origin + author

- **Author:** Alberto Brandolini, Italian consultant, DDD
  community, early collaborator with Eric Evans, Vaughn Vernon,
  Greg Young.
- **First named:** ≈ 2013 (blog posts). Book-length treatment:
  *Introducing EventStorming* (Leanpub, 2019 — self-published,
  still in continuous revision).
- **License / IP:** book is copyrighted but the technique itself
  is open and has been taught under many licenses. Brandolini
  explicitly encourages adaptation.

### 1.2 The three levels

ES is not one workshop — it is a family of three.

| Level              | Audience                          | Duration | Deliverable                                     |
|--------------------|-----------------------------------|----------|-------------------------------------------------|
| **Big Picture**    | Whole org; business + technical   | 2-4 h    | Shared map of the domain's events over time     |
| **Process-Level**  | Single process team + stakeholder | 1 day    | Process decomposed into commands + policies     |
| **Software Design**| Engineering team                  | 1-3 d    | Aggregates + bounded contexts + read models     |

### 1.3 The sticky-note colour palette

Brandolini's canonical colours. (Any legible colour set works;
these are just widely recognised.)

| Colour        | Primitive           | Semantics                                                           |
|---------------|---------------------|---------------------------------------------------------------------|
| **Orange**    | Domain Event        | Something that happened. Past tense. Immutable. The primary artefact.|
| **Blue**      | Command             | Intent to cause an event. Present tense.                            |
| **Yellow**    | Actor / User        | Who issued the command.                                             |
| **Lilac/Pink**| External System     | Upstream / downstream actor outside our bounded context.            |
| **Pink (dark)**| Aggregate          | State-holder that commands act on and events emerge from.           |
| **Purple**    | Policy              | Reactive rule: "when event X, then command Y."                      |
| **Green**     | Read Model / View   | Projected state a user reads.                                       |
| **Red**       | Hot-spot / Problem  | Question, contradiction, pain-point, assumption to verify.          |

### 1.4 Facilitation practices (2026 best-practice synthesis)

- **Unlimited modelling surface** — whiteboard or Miro/Mural
  board the size of the room. Constraints pollute discovery.
- **Past-tense domain events, always.** "Order was placed,"
  not "place order." The grammar is load-bearing: commands and
  events look identical in bad workshops.
- **Chronological ordering** — left-to-right timeline. Events
  that are concurrent stack vertically.
- **Facilitator-led, not facilitator-driven.** The facilitator
  owns tempo and coverage, not content. Content comes from
  domain experts.
- **Hot-spots are first-class.** When nobody knows the answer,
  a red sticky goes up. The workshop output is allowed to have
  unknowns; it is *better* when it does.
- **Progressive refinement.** Big Picture first; resist drilling
  into implementation until the timeline is complete.
- **Avoid rushing to technical solutions.** A recurring failure
  mode in 2025-2026 coverage: teams jump to CQRS schema design
  before the domain is mapped.

---

## 2. Zeta ↔ Event Storming — primitive mapping

This is where the research pays off. Zeta's DBSP substrate is
isomorphic to event-sourcing-in-the-small; the table below
shows the mapping formally.

| ES primitive        | Zeta primitive                                                                  | Notes                                                                                          |
|---------------------|---------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| Domain Event        | `ZSet<K>` delta entry with weight `+k` (`k > 0`)                                | Past-tense, immutable, append-only within a tick. The canonical ES citizen.                    |
| **Retraction event**| `ZSet<K>` delta entry with weight `-k` (`k > 0`)                                | **Zeta-native extension ES does not name.** A first-class un-event. Ordinary ES has no vocabulary for this; Zeta does. |
| Command             | Operator invocation (`StepAsync`) that produces a delta downstream               | Imperative in conventional ES; in Zeta, commands are the operators themselves.                 |
| Aggregate           | State-carrying operator: `IntegrateOp`, `DelayOp`, `FeedbackOp`                  | The state-holder whose invariants the aggregate enforces.                                      |
| Policy              | Composite operator reacting to an input delta by emitting another delta         | E.g. `circuit.Map(f, s)` producing a new stream is a policy in ES terms.                       |
| Read Model / View   | Integrated stream (`Integrate` at a graph sink)                                  | The "materialised" side; ES calls this a projection.                                           |
| Bounded Context     | `Nest` sub-circuit (inner-clock scope)                                           | Inner-clock tick-0 reset = bounded-context lifecycle boundary.                                 |
| External System     | External input stream registered at the circuit root                             | `ScalarInput<T>.Set` or upstream-fed sources.                                                  |
| Hot-spot (red)      | OpenSpec spec gap, BUGS.md row, harsh-critic finding, `red-flag` tag             | Zeta has many; ES just gives them a single colour.                                             |
| Actor / User        | Agent persona, human maintainer, or external caller                              | Zeta's `docs/EXPERT-REGISTRY.md` is effectively the actor list.                                |
| Workshop artefact   | `openspec/specs/*/spec.md` + `docs/GLOSSARY.md` + `docs/CONFLICT-RESOLUTION.md` | Zeta's post-hoc output already matches the *artefacts* ES produces — we just did not call them that. |

### 2.1 Two places where the mapping is stronger in Zeta than in vanilla ES

1. **Retractions.** Ordinary ES has no first-class retraction
   primitive; deletions are either a compensating event ("Order
   was cancelled") or event-log rewriting (which is a smell).
   Zeta's Z-set `-k` weight is a typed retraction. The ES
   community has proposed "event compensation" patterns; Zeta
   has the algebra.
2. **Inner-clock scopes.** ES's Bounded Context is a social
   boundary (team + ubiquitous language). Zeta's `Nest` sub-
   circuit is the *same idea made executable*: an inner clock,
   a cross-scope reset obligation (Viktor P0-2, just landed),
   and a typed integration boundary. Zeta could contribute this
   back to the ES / DDD community as "executable bounded
   contexts."

### 2.2 One place where ES is stronger than Zeta currently

**Discovery-phase vocabulary.** Zeta's spec + glossary workflow
kicks in *after* a feature exists. Aaron and a factory agent
working on a new capability currently have no *named protocol*
for the Big-Picture → Process → Software-Design transition. ES
gives us that protocol. The conversational-bootstrap UX
(`memory/project_factory_conversational_bootstrap_two_persona_ux.md`)
is the natural host.

---

## 3. Usefulness verdict + retroactive-adoption proposal

### 3.1 Verdict: **adopt as a strategy, not a tool.**

ES has no runtime footprint. Adopting it costs:

- One skill-group authoring pass (expert / teacher / auditor).
- Vocabulary edits across `docs/VISION.md`,
  `docs/ALIGNMENT.md`, `docs/GLOSSARY.md`, and
  `openspec/specs/operator-algebra/spec.md`.
- One session-bootstrap pointer in `AGENTS.md` or `CLAUDE.md`.

And pays:

- Immediate communicability to the DDD / CQRS-ES audience
  (Greg Young, Vaughn Vernon, Alberto Brandolini himself are
  all reachable).
- A named discovery protocol to pair with conversational
  bootstrap.
- A retroactive narrative that strengthens Aurora Network's
  DAO event-sourcing framing (events + consent-primitives =
  governance-grade event log).

### 3.2 Proposed Matrix-mode skill-group

Following
`memory/feedback_new_tech_triggers_skill_gap_closure.md` —
strategies (not just technologies) trigger skill-group
absorption (Aaron's explicit framing from this ask).

| Role                       | Responsibility                                                                                      | Notebook                                  |
|----------------------------|-----------------------------------------------------------------------------------------------------|-------------------------------------------|
| `event-storming-expert`    | Runs or advises on Big-Picture / Process / Software-Design workshops; maps outputs to Zeta primitives. | `memory/<persona>/<name>/NOTEBOOK.md`       |
| `event-storming-teacher`   | Onboarding explainer: ES vocabulary, colour palette, facilitation patterns, common failure modes. | Shared skill file; no per-round notebook. |
| `event-storming-auditor`   | Reviews specs + glossary for ES-vocabulary misuse (present-tense events, confused aggregates, hidden policies). | `memory/<persona>/<name>/NOTEBOOK.md`       |
| `event-storming` capability| Procedure-body skill: how to actually run a workshop in this factory's one-human-plus-agents setting. | `.claude/skills/event-storming/SKILL.md`  |

Persona names deferred to the naming-expert per GOVERNANCE.md.

### 3.3 Retroactive adoption plan — factory-first, Zeta-second

Aaron (2026-04-20 late): *"The factory-vs-Zeta separation
becomes the load-bearing concern."* Adoption sequencing
must honour this. ES vocabulary lands **first in factory
surfaces**, then bridges into Zeta surfaces — never the
other way around.

**Phase A — Factory (portable) surfaces.** Every skill /
doc / persona in this list is factory-generic; ES
vocabulary is native here.

1. **Factory skills with no Zeta lean** — audit
   `.claude/skills/*/SKILL.md` frontmatter. Skills
   without `project: zeta` declared should already be
   portable; confirm they use ES-compatible vocabulary
   where relevant (domain events, commands, bounded
   contexts).
2. **Conversational-bootstrap UX skill** (memory-only
   today) — authored with ES as the explicit discovery
   protocol. Big-Picture → Process → Software-Design
   becomes the default question-ladder.
3. **`docs/AGENTS.md`** — add ES to the universal
   onboarding handbook as factory-vocabulary; keep
   Zeta-specific vocabulary cleanly separate.
4. **`docs/EXPERT-REGISTRY.md`** — new personas
   (event-storming-expert / -teacher / -auditor)
   declared at the factory level.
5. **New "factory-generic" marker skill** (candidate:
   SKILL authored via `skill-creator`) that audits the
   Zeta↔factory seam and flags leakage in either
   direction.

**Phase B — Bridge surfaces.** Docs that serve *both*
factory consumers and Zeta consumers. ES vocabulary
goes here as a *bridge layer* — named explicitly as such.

1. **`docs/GLOSSARY.md`** — ES primitives listed as
   factory-generic vocabulary; Zeta-specific terms
   (Z-set, operator, retraction, z⁻¹) listed as
   Zeta-specific vocabulary; the §2 mapping table
   goes in the glossary as the bridge.
2. **`docs/ALIGNMENT.md`** — alignment contract framed
   as a governance event log using ES vocabulary;
   consent-primitive instances = domain events; the
   *factory* is the bounded context, Zeta is one of
   its aggregates.

**Phase C — Zeta-specific surfaces.** ES vocabulary
only where it adds precision *on top of* the existing
operator-algebra vocabulary. Zeta's native vocabulary
wins by default here.

1. **`openspec/specs/operator-algebra/spec.md`** — add
   an "ES vocabulary bridge" aside near the top so
   downstream specs can use "domain event," "aggregate,"
   "bounded context" without redefining — but the spec
   body continues to speak operator algebra.
2. **`docs/VISION.md`** — note that Zeta *is* an
   event-sourcing-with-retractions engine (ES vocabulary
   used deliberately as a one-line bridge).

Nothing is rewritten wholesale. ES vocabulary is
additive; where current prose is precise, it stays.
The factory-vs-Zeta separation is preserved by the
*phasing*, not by vocabulary gymnastics.

### 3.4 BACKLOG items

Proposed P1 rows for Round 45 or 46 (ordered by phase):

- **ES-factory-skill-group-001 (Phase A)** — Author
  `event-storming-expert` / `event-storming-teacher` /
  `event-storming-auditor` personas + `event-storming`
  capability skill via `skill-creator`. **All four
  declared factory-generic (no `project: zeta`)** —
  this is Zeta's first deliberate use of factory-skill
  portability. Effort: M.
- **ES-factory-separation-audit-001 (Phase A)** — Audit
  every skill under `.claude/skills/*/SKILL.md` for
  Zeta-leakage: skills without `project: zeta` must not
  hard-code Zeta paths / types / vocabulary unless they
  are bridging documentation. Flag violators. Effort:
  S-M depending on findings.
- **ES-conversational-bootstrap-001 (Phase A)** — Extend
  conversational-bootstrap UX design
  (`memory/project_factory_conversational_bootstrap_two_persona_ux.md`)
  to adopt ES Big-Picture → Process → Software-Design as
  the default onboarding protocol. The question-ladder
  ("what happens?" → "who does what?" → "what state
  holds?") becomes the factory's greenfield-onboarding
  script. Effort: M.
- **ES-automated-ui-001 (Phase A, speculative)** —
  Prototype an automated Event-Storming UI: as a
  conversation progresses, chat content emits coloured
  stickies (orange-event, blue-command, pink-aggregate,
  purple-policy) in a timeline view; facilitator agent
  asks the next-playbook question. This is the
  "one-hell-of-a-UI" differentiator. Effort: L;
  separate research spike first.
  **Git-native render only.** Per the factory's
  persistence invariant
  (`memory/project_git_is_factory_persistence.md`,
  Aaron 2026-04-20), stickies are markdown rows in
  `docs/contexts/<ctx>/{events,commands,aggregates}.md`;
  the UI is a browser-rendered view over those files
  and re-renders on each git-commit. External-storage
  boards (Miro, EventModeler proprietary storage) are
  explicitly disfavoured — a candidate tool is
  acceptable only if it reads git-native markdown as
  its source of truth, and even then it is a pluggable
  alternative (opt-in), not the default.
  **Deployment model** (per
  `memory/project_factory_is_pluggable_deployment_piggybacks.md`):
  the UI is **local-first** — it runs in the
  developer's browser, reads the local git repo, and
  needs no deployed URL. For consumer projects that
  have their own UI deployment pipeline, the factory
  UI **piggy-backs** on that pipeline and ships with
  the product's release flow. When standalone static
  hosting is genuinely needed, **GitHub Pages** is
  the free default substrate (see
  `feedback_free_beats_cheap_beats_expensive.md`).
  The factory does not maintain its own dedicated
  deployment infrastructure for its UI.
- **ES-bridge-glossary-001 (Phase B)** — Update
  `docs/GLOSSARY.md` with ES primitives as factory-
  generic vocabulary and the §2 bridge mapping; update
  `docs/ALIGNMENT.md` to use ES framing for the
  governance event log. Effort: S.
- **ES-zeta-bridge-001 (Phase C)** — Add ES-vocabulary
  bridge aside to `openspec/specs/operator-algebra/spec.md`
  and the one-line bridge in `docs/VISION.md`. Effort: S.

---

## 4. Sources

Three WebSearch passes run on 2026-04-20, summarised here
(not quoted verbatim; search results are ephemeral).

- **Pass 1 — "Event Storming Alberto Brandolini 2026 best practices":**
  - Brandolini's own site (eventstorming.com) as canonical.
  - Leanpub book *Introducing EventStorming* continuous-revision
    notes through 2024.
  - 2025-2026 practitioner articles emphasising past-tense
    events, hot-spot discipline, facilitator-led-not-driven
    tempo, scope clarification, avoiding premature technical
    solutions.
- **Pass 2 — "Event Storming CQRS event sourcing 2026":**
  - ES + CQRS + Event Sourcing as the canonical trio in DDD-
    adjacent shops.
  - Recommended ordering (event → command → aggregate →
    boundary → view) matches Zeta's natural circuit-build
    order.
  - Materialised views as replay-from-event-store — direct
    parallel to Zeta's `Integrate` at graph sinks.
- **Pass 3 — "Event Storming legacy system retroactive adoption":**
  - Multiple sources endorse retroactive application to legacy
    systems for domain reverse-engineering, bottleneck
    discovery, and cross-team alignment.
  - 2023-2025 case studies (insurance, logistics, banking)
    showing retroactive ES producing refactor roadmaps.
  - Key caveat: retroactive ES surfaces undocumented invariants
    faster than it surfaces missing features — Zeta should
    expect the same (invariant surfacing is actually Zeta's
    home turf per `project_composite_invariants_single_source_of_truth_across_layers.md`).

Detailed raw-result archival is intentionally skipped — search
results decay; the synthesis above is the durable artefact.

---

## 5. Open questions / hot-spots (red stickies, in ES spirit)

- Does ES-expert belong in `docs/EXPERT-REGISTRY.md` with
  scope "strategy" rather than a technology? Per
  `memory/feedback_new_tech_triggers_skill_gap_closure.md`
  this is the first *strategy* absorption — schema generalisation
  pending.
- Can we contribute "executable bounded contexts" back to
  Brandolini's community, or does that require a paper first?
- Does the retraction-event primitive need a new ES colour?
  ("Un-event" — inverted-orange? Dark-orange?) Community
  decision — defer.
- Should the factory's own event log (`docs/ROUND-HISTORY.md`)
  be retroactively re-framed as an ES Big-Picture output?

---

## 6. Meta-note

This research task itself is a candidate meta-win if it
results in the Matrix-mode memory generalising from
"technology triggers skill-group absorption" to
"technology OR strategy triggers skill-group absorption."
That generalisation is the structural factory delta; the
skill-group authoring would otherwise have been speculative
work next round.

If the generalisation lands, log row candidate:

- Speculative surface: Event Storming skill-group authoring.
- Structural fix: generalise Matrix-mode to strategies.
- Depth: 2 — the generalisation *itself* predicts that future
  strategy absorptions (e.g. Wardley mapping, Domain Storytelling,
  OKRs-as-strategy) will follow the same pattern, converting
  them to directed work in turn.
- Next-round effect: every strategy adoption from this point
  forward is a directed skill-group authoring task, not a
  freeform reinvention.
- Retrospective: TBD at Architect review.
