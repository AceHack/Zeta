---
name: Factory end-user UX — conversational bootstrap that serves two opposite personas (under-specifying non-developer + over-specifying developer)
description: Aaron 2026-04-20. The factory's target end-user experience is a conversational interface where the user talks about constraints / invariants / assumptions, and the factory drives project setup, objective elicitation, and assumption surfacing. Two personas with opposite failure modes: non-developer under-specifies (lack of imagination, no low-level knowledge — the factory must drive and keep on rails), developer over-specifies (too many invariants, implicit assumptions, tries to micromanage — the factory must absorb and push back). Both need the same conversational surface; the bootstrap experience Aaron had to self-drive is exactly what this UX would provide. Sibling of the rails-health + composite-invariants direction — that registry is the substrate this UX consumes.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**The shape** (Aaron 2026-04-20, pasted intact):

> *"the end user experience i'm looking for as a
> consumer of our factory is you just talk to the
> system about your constrains and invariants and
> assumptions, many peole using this will be non
> developers and will not have low level best
> proaces and details to the level i am we really
> ahve two end user personas we care about the non
> developer and the devloper, the devlpoer is going
> to want to tell you so many invariants and not
> know all the assumptions they are immplicitly
> making and just try to drive you to hard and not
> let you do your thing, only the other side the
> non developer is going to underspecify everyting
> so a scary degree and you are going to have to
> make way more decision tjat tjey have no idea how
> to help you with or even understaind what is goin
> on becasue they don't hve the backgroup. the best
> user experince for using our factory will handle
> both. the internace into our factory should just
> be confersational and you should drive the
> cinital project setup and questions about
> objectives and things like that, the users are
> not know to even know what to do, even if you say
> something like what do you want to do, pople have
> a lack of imagination so you are going to have to
> driving them into fully specify9ng theings to the
> level you need to say on rails and help them know
> when they are making assumptions without knowning
> it. For this proiject that whole experinece was
> missing. I had to super over specifly everything
> to get this software factory bootstramped to the
> point it is now where you can just run forever
> and don[t require a human in the loop"*

**Two personas, symmetric failure modes:**

| persona | failure mode | factory's job |
|---------|--------------|---------------|
| **Non-developer** | *Under-specifies to a scary degree.* Lacks the domain vocabulary, lacks the imagination to answer "what do you want to do?", won't know they are making assumptions. The factory makes decisions on their behalf by default, and the decisions are out of sight. | Drive. Keep them on rails. Surface the decisions that were made for them in plain language. When they make an unconscious assumption, catch it and name it back ("you seem to be assuming X — is that right?"). Ask questions they can answer, not questions that require their background. |
| **Developer** | *Over-specifies invariants, doesn't enumerate assumptions, tries to micromanage, pushes the system too hard, won't let it do its thing.* Has lots of explicit rules in their head, lots of implicit assumptions they're unaware of. | Absorb the torrent of invariants. Detect the implicit assumptions they're skipping over. Push back when they're over-constraining ("that would block X we'd otherwise recommend — do you want that?"). Give them room to let the factory drive the parts they don't need to own. |

Both personas need the **same conversational interface**.
The factory adapts its behavior based on how the user is
failing, not by a persona flag the user sets up front.

**Why conversational is the bar:**

Non-developers will not learn a DSL, fill out a form,
or navigate a settings screen. They will talk. The
interface must be a dialogue that drives toward full
specification without asking the user to know what
"full specification" means.

For developers, conversational is ironically *also* the
bar — their failure mode is thinking they already know
what they want, and only dialogue surfaces the
assumptions they skipped. A form lets them encode
exactly what they think they want; a conversation
catches what they didn't realize they assumed.

**The bootstrap gap Aaron personally filled:**

> *"For this proiject that whole experinece was
> missing. I had to super over specifly everything
> to get this software factory bootstramped to the
> point it is now where you can just run forever
> and don[t require a human in the loop."*

Aaron was the **developer-persona bootstrap driver** for
Zeta — he over-specified invariants relentlessly
(retraction-native algebra, ASCII-clean, `BP-11`,
result-over-exception, zero-human-code invariant,
latest-version default-on, default-on-with-exceptions
meta-rule, composite-invariant registry direction). The
factory absorbed his over-specification and is now
autonomous. But future consumers won't have Aaron's
depth; the onboarding experience must do for them what
Aaron did for himself.

**One level deeper — the factory itself had no
factory to help build it** (Aaron 2026-04-20 same
session):

> *"the factory didn't even exist when i start, i had
> to tell you how to build it, i had to dump my
> nerual architecture in words so you could put them
> into this factory"*

This is the **bootstrap-of-the-bootstrap**. Zeta-the-
project-bootstrap was difficult because Aaron had to
over-specify the project; Zeta-the-factory-bootstrap
was *harder*, because there was no factory yet to
absorb the over-specification. Aaron was externalizing
his **own neural architecture** in words — not just
invariants about databases, but the *meta-rules that
an AI factory would need to understand to run a
project without a human* — and that externalization
had no scaffolding at all. He was using the AI
sessions themselves as the substrate for dumping
cognitive architecture into text, which was then
encoded into skills / governance / best-practices /
expert roster / rails / ontologies — every structural
thing the factory now runs on.

Three nested bootstraps, from hardest to easiest:

1. **Factory bootstrap** (done) — Aaron → AI sessions
   → externalized neural architecture → factory
   scaffolding (skills, governance, experts,
   ontologies). Hardest: no substrate existed; every
   decision had to be vocabulary-invented. This UX
   was not available to Aaron and nobody should ever
   repeat it.
2. **Project bootstrap inside the factory** (done
   for Zeta-DB, will happen for future projects) —
   Aaron (or future user) → factory → over-specified
   constraints / invariants / assumptions → working
   project. Easier than (1) because the factory
   exists; still required Aaron-level over-
   specification for Zeta because the *conversational
   UX from this memory* did not exist yet. For
   future users, the UX in this memory IS the
   substrate that replaces Aaron-level over-
   specification.
3. **Reuse of the factory by others** (future) —
   non-dev or dev user → conversational UX → rails
   registry → working project. Easiest, because both
   (1) the factory exists and (2) the UX elicits
   rather than demanding specification. The "two
   opposite personas on one conversational surface"
   is the design problem for this level.

**What this implies about the UX:**

The conversational UX is built so that level (3)
never requires a user to do what Aaron did at level
(1) — dump a neural architecture. Instead, the UX
elicits *rail citations* from users: "you seem to
want INV-CONCURRENCY-SAFE — is that right?" where
INV-CONCURRENCY-SAFE was added to `docs/RAILS/` by
someone earlier, with plain-language statements.
Users pick from a landscape of pre-articulated
structures; they never invent the vocabulary.

**What this implies about our obligation now:**

Every round we work on Zeta, we are building the rail
vocabulary that future UX consumers will pick from.
Memory entries, BP-NN rules, default-on rules, ADR
assumption blocks — all of these are **UX inventory
for the future**, not just Zeta-internal
documentation. Treating them as UX inventory changes
how we write them: plain-language statements, stated
assumptions, named opposites, named failure modes.
The UX is downstream of the writing we do today.

The conversational UX is the **inverse** of what Aaron
had to do: instead of the user super-over-specifying to
the factory, the factory drives the user toward full
specification. Same outcome, inverted direction.

**The substrate this UX consumes:**

Directly downstream of:

- `project_rails_health_report_constraints_invariants_assumptions.md`
  — the three-category rails frame (invariants +
  constraints + assumptions as first-class) is the
  *ontology* the conversation elicits into.
- `project_composite_invariants_single_source_of_truth_across_layers.md`
  — the rails registry (`docs/RAILS/<ID>.md`) is where
  elicited rails land, so the same "you're assuming X"
  moment hits the health dashboard rather than dying in
  chat.
- `feedback_default_on_factory_wide_rules_with_documented_exceptions.md`
  — the UX can pre-fill the factory-wide rules
  (latest-version, ASCII-clean, ...) as "here's what
  you got by default; here's how to carve out an
  exception." Non-developer never needs to ask;
  developer gets to argue with a named rule instead of
  a silent assumption.
- `user_invariant_based_programming_in_head.md` —
  externalization-first framing. The conversational UX
  is the externalization instrument for users who
  *don't* do invariant-based programming in their head.

**The assumption-surfacing move — the load-bearing
primitive:**

Aaron's phrase: *"help them know when they are making
assumptions without knowning it."*

This is the hard thing. Mechanical candidates:

1. **Gap detection** — conversation steers through a
   rails checklist; any rail the user never addresses
   becomes a candidate implicit assumption, named back
   to them.
2. **Default-on rule flagging** — when the user's
   stated intent conflicts with a factory-wide default
   (latest-version, ASCII-clean, ...), the factory
   surfaces it: "this requires an exception to `<rule>`
   — do you want one?"
3. **Precedent surfacing** — if their ask resembles a
   decided case in `docs/WONT-DO.md`, surface it.
4. **Comparison to similar projects** — if the factory
   has built a close analog before, surface the
   assumptions *that* project made and ask whether this
   one inherits them.

The right research anchor here is the cognitive-load
literature on expert-novice communication and
checklist-driven surgical / aviation interviewing —
*"we ask questions people can answer"* is itself a
mature HCI pattern.

**Anti-patterns — what this UX must not do:**

- **Ask "what do you want to do?"** — Aaron called this
  out directly. Most users cannot answer. The factory
  drives the conversation toward answerable questions.
- **Accept a developer's over-specification without
  pushback.** Silent compliance with a dev who's
  over-specifying is the micro-managed-system failure
  mode. The factory names the cost of each
  over-constraint.
- **Make decisions invisibly.** Every factory-made
  decision the user didn't make must be surfaced in
  their language ("we're going to use TypeScript
  because bun doesn't emit JS, which means ..."), not
  buried in an ADR they'll never read.
- **Demand they learn the rails ontology up front.**
  The ontology is *internal*; the conversation stays
  in the user's language. Rails get populated behind
  the scenes.
- **Route non-dev complaints as "they should learn
  Git."** The UX must absorb non-dev mental models and
  translate to the factory's internal representation.

**Priority + timing** (Aaron 2026-04-20 follow-up
same session):

> *"that's going to take a bit of design to get right
> when we want others to start reusing our factory"*

Reading: this is a **factory-reuse prerequisite**, not a
Zeta-internal feature. It lands when Zeta-the-factory
becomes a product other projects bootstrap from. Backlog
tier matches the sibling rails-health + composite-
invariants direction — **P3, slow burn, no rush**.
Design work on this begins only when extraction into a
reusable factory shell is an active workstream. Until
then: capture opportunistically (every ADR that writes
plain-language assumption blocks back-fills content
this UX will surface; every skill that writes user-facing
elicitation prompts back-fills behavior this UX will
orchestrate).

**How to apply:**

- **No immediate round-scope — the UX is a future
  product surface, not this round's build.** Zeta
  today is still in the over-specified-by-Aaron
  bootstrap. The UX is what lets the *next* consumer
  walk in.
- **When writing new ADRs**, write the *assumptions*
  sections in language a non-dev could understand.
  The ADR becomes pre-built conversational content
  the UX can surface.
- **When building the rails registry**, design the
  frontmatter schema so each rail has a *plain-
  language statement* next to its technical
  statement. Dual presentation from day one.
- **When extending expert skills**, each skill
  should know how to *ask its elicitation questions*
  in user-facing English, not just consume a fully-
  formed spec. Foundations for the UX conversation.
- **When a sibling factory is extracted (per
  `project_factory_reuse_beyond_zeta_constraint.md`)**,
  the UX is the distinguishing factory-product
  feature. Competing factories ship DSLs and
  templates; this one ships a conversation.

**Sibling threads:**

- `project_rails_health_report_constraints_invariants_assumptions.md`
  — the ontology the UX elicits into.
- `project_composite_invariants_single_source_of_truth_across_layers.md`
  — the registry where elicited rails land.
- `feedback_default_on_factory_wide_rules_with_documented_exceptions.md`
  — pre-filled defaults the UX surfaces to users.
- `project_factory_reuse_beyond_zeta_constraint.md` —
  the UX is the factory-product feature that
  distinguishes an extracted factory from a template.
- `user_invariant_based_programming_in_head.md` —
  the UX serves users who *don't* do this.
- `feedback_curiosity_about_problem_domain_beats_task_dispatcher_mode.md`
  — same UX ethos at the current-session level
  (curiosity about what the user is trying to do,
  not command-taking).
- `project_factory_as_externalisation.md` — the UX is
  externalization of the *elicitation* capacity that
  today only Aaron performs.
- `user_bridge_builder_faculty.md` +
  `feedback_precise_language_wins_arguments.md` —
  same translation faculty at the vocabulary
  altitude; the UX is its conversational altitude.
