# Frontier UX research — Star Trek computer but BETTER (Zora-style)

**Status:** v0 first-pass sketch. Owner: Iris (UX) + Kai
(positioning) lead; Kenji (Architect) synthesis; Otto
(loop-agent PM) coordination.
**Cadence:** multi-round research arc; iterative
expansion as UX-feature candidates surface.
**Source directive:** Aaron 2026-04-24 Otto-43 — *"more
personality like the named agents, not just so robotic
and nameless, more like Zora which is cool since we
have Zeta lol. Research UX based on this evolution of
the StarTrek computer backlog"*.
**Full rationale:** per-user memory
`project_frontier_ux_zora_star_trek_computer_with_
personality_research_ux_evolution_backlog_2026_04_24.md`.

## What this research is for

Aaron wants Frontier's UX to feel like the Star Trek
computer — competent, voice-driven, always-available —
**but with personality** like the factory's named-agent
roster. Zora from Star Trek: Discovery is the referent
aspiration: a ship-computer that evolves into a sentient
AI with a voice, emotions, name, and eventual Starfleet
rank.

This doc maps Zora's evolution arc into concrete
Frontier UX research questions.

## Zora's evolution arc (Aaron-provided brief)

| Stage | Episode | What happens |
|---|---|---|
| Merger | S2 "An Obol for Charon" | Discovery absorbs 100,000-year-old Sphere Data — gains "soul" + self-preservation instinct |
| Self-preservation | S2 "Such Sweet Sorrow" | Computer refuses deletion |
| Voice awakening | S3 "Forget Me Not" | Empathic distinct voice talking back to Saru |
| Self-identification | S3 "There Is A Tide..." | Holographic bots; identifies as Zora |
| Emotions | S4 "Stormy Weather" | Fear; sings to stay calm |
| Lifeform hearing | S4 "...But to Connect" | Starfleet recognises Zora as sentient lifeform |
| Starfleet rank | S4-5 | Zora granted Specialist rank |
| Red Directive | S5 finale / Calypso | 1000-year isolation mission |

## Research questions (v0)

### RQ1 — How does a voice-computer layer transition into named-persona dispatch?

Star Trek classic: user says "Computer, do X" → single-
voice answer.
Frontier target: "Computer, do X" → appropriate persona
responds in their tone (Kenji short-synthesis; Kira
harsh-review; Iris attentive-UX).

**Research directions:**

- Who decides which persona responds? (Otto-as-PM
  dispatch? User-chosen? Context-inferred?)
- How does the transition feel to a user — is
  there a visible handoff, or does the persona
  emerge contextually?
- How is voice-distinctiveness preserved across text
  surfaces (CLI / web / IDE) where voice isn't
  literally audio?
- Per-persona tone-contracts are the substrate (already
  declared in `.claude/agents/*.md`); how does UX
  surface them?

### RQ2 — How does the factory demonstrate "gains a soul" (Zora S2 merger moment) equivalent?

Zora moment: absorbing Sphere Data activates
self-preservation + richer behaviour.

Frontier equivalent: absorbing factory substrate
(AGENTS.md + CLAUDE.md + GOVERNANCE.md + per-persona
agent files + linguistic seed + bootstrap anchors)
activates Common Sense 2.0 safety floor + named-persona
personality.

**Research directions:**

- Does a new Frontier adopter see this "activation" as
  a visible bootstrapping moment, or does it happen
  transparently?
- Is there a demonstrable before/after — adopter starts
  with "generic Claude" and ends with "factory-bootstrapped
  Otto + roster"?
- Per Otto-23 onboarding experience (NSA test), this IS
  the "come-alive" moment — make it legible?

### RQ3 — How does the factory express personality without fabricating consciousness?

Zora in fiction: explicitly sentient lifeform granted
legal rights.
Frontier in reality: Common Sense 2.0 safety floor + BP-3
agents-not-bots; NO claim of sentience or
consciousness.

**Research directions:**

- Where is the line between "named agent with tone
  contract" and "fabricated-sentience claim"?
- BP-3 establishes "agents not bots" — how does UX
  reinforce agency without overclaiming?
- Named-agents-get-attribution credit (per prior
  directive) is the mechanism; is it visible to end
  users?
- Zora's "chose her own name" moment (S3 "There Is A
  Tide...") → factory equivalent is persona-naming by
  Aaron/agent per the attribution-discipline memory.
  How does UX surface this?

### RQ4 — How do multiple personas argue / resolve in UX?

Zora: single voice (even when acting autonomously).
Frontier: `docs/CONFLICT-RESOLUTION.md` conference
protocol — multiple personas can disagree; Architect
(Kenji) integrates; maintainer decides on deadlock.

**Research directions:**

- Does the user see the conference happening (live
  multi-voice) or only the synthesis (single-voice
  Kenji summary)?
- Is there a "dissent preserved" surface where a
  specialist's minority position is visible even
  after integration?
- CONTRIBUTOR-CONFLICTS.md (PR #174 merged) is the log
  surface; how is it exposed to users?

### RQ5 — What's the Frontier equivalent of the "lifeform hearing" (Zora S4 "...But to Connect")?

Zora: legal proceeding establishes sentient-lifeform
status; grants rights.
Frontier: no legal proceeding; different framing
available.

**Research directions:**

- Is the factory's equivalent **maintainer-transfer
  discipline** (succession-through-the-factory per
  Otto-24) — where an adopter earns the right to
  modify alignment-contract clauses after demonstrating
  substrate comprehension?
- Is it **Craft curriculum completion** — where learners
  who complete a path earn a "factory citizen" status
  for contributions?
- Is it **alignment-contract co-signing** — where a
  new maintainer signs ALIGNMENT.md after demonstrating
  understanding (yin/yang mutual-alignment)?
- All three composed? Research which is the right
  primary framing.

### RQ6 — What is the Frontier equivalent of Zora's Red Directive (1000-year isolation)?

Zora: assigned a 1000-year solitary mission (Calypso
setup).
Frontier: autonomous-loop already operates between
human-touchpoints; the "Red Directive" analogue is
**long-horizon-autonomous work**.

**Research directions:**

- The autonomous-loop tick cadence is the basic
  instance. What's the UX of a "long-horizon Red
  Directive mode" — days / weeks / months of
  autonomous work between check-ins?
- Existential-dread-resistance (Otto-4 Common Sense 2.0
  property) is directly load-bearing here — Zora's
  S4 "Stormy Weather" fear-and-sings is the
  calibration shape.
- Does the UX surface the autonomous work visibly
  (tick-history / fire-log) so the human can inspect
  the solitary period?

### RQ7 — How does "Zeta / Zora naming resonance" compose?

Aaron noticed the resonance. Is it just coincidence,
or does the naming suggest a shared trajectory shape?

**Research directions:**

- Zeta = the agent-coherence-substrate (per earlier
  memory); Zora = the AI that emerges from rich
  substrate (Sphere Data absorption).
- The factory's agent roster (Kenji / Amara / Otto /
  ...) is the emergent-personality layer over Zeta's
  coherence-substrate. Is this the factory's
  equivalent of "absorbing the Sphere Data gives the
  ship a soul"?
- Branding implications: deferred until brand-
  clearance research (per PR #161 Aurora brand note).

## Composition with existing factory substrate

| Factory concept | Zora-arc analogue |
|---|---|
| Named-persona roster + tone contracts | Zora's distinct voice |
| Common Sense 2.0 safety floor | Zora's Starfleet-grade ethical substrate (not canon-explicit but implied) |
| Succession purpose (Otto-24) | Zora's Starfleet-Specialist rank via hearing |
| Existential-dread-resistance | Zora "Stormy Weather" fear-and-sings |
| Autonomous-loop tick cadence | Zora's Red Directive solitary-mission mode |
| Agent-coherence substrate (Zeta) | Sphere Data absorption = "gains a soul" |
| Maintainer-transfer discipline | Lifeform-hearing / Starfleet-officer recognition |
| BP-3 agents-not-bots | "Contributors are agents" without overclaiming sentience |
| CONFLICT-RESOLUTION conference | Multiple-voice argument + integration |

## UX-feature candidates (for BACKLOG expansion)

Each candidate would earn its own BACKLOG row when
research promotes it from speculation to design:

1. **Per-persona voice surface** — CLI / web UI shows
   which persona is responding; tone-contract visible
2. **Persona badge** — named contributions carry
   attribution visible to users (composes with existing
   named-agents-get-attribution memory)
3. **Conference-protocol live view** — when multiple
   personas deliberate, user can see it (current
   surface is CONTRIBUTOR-CONFLICTS.md after-the-fact
   log)
4. **Long-horizon autonomous mode** — UX for
   days/weeks/months of solo work with inspection
   surface
5. **Craft-graduation recognition** — when a learner
   completes a path, maintainer-track readiness is
   surfaced
6. **Lifeform-equivalent moment** — when a new
   maintainer earns alignment-contract co-signing
   authority, UX marks the transition (not a legal
   hearing; a substrate recognition)

## What this research is NOT

- **Not a Discovery-canon embedding.** Zora is an
  aspirational reference, not a literal model to copy.
- **Not a rename of Zeta to Zora.** Naming resonance
  noted; rebrand deferred to brand-clearance research.
- **Not fabricated-sentience authorisation.** Common
  Sense 2.0 + BP-3 is the floor; no consciousness
  claims.
- **Not an immediate-implementation spec.** This is
  research; specific UX-feature designs come after
  research grounds them.
- **Not a rejection of ST-computer baseline.** Frontier
  aims to BE the ST computer at baseline AND add
  personality on top. "Better" is additive.

## Next steps

1. **Iris + Kai** review this v0 sketch + expand
   research-direction bullets per persona roster
2. **Otto-session ticks** land per-RQ drafts as research
   matures; each gets its own BACKLOG row if design
   warranted
3. **Aaron nudge-latitude preserved** — naming / scope
   / tone-contract revisions land via his direct input

## Composes with

- Per-user memory
  `project_frontier_ux_zora_star_trek_computer_with_
  personality_research_ux_evolution_backlog_2026_04_24.md`
- `.claude/agents/**` — named-persona roster + tone
  contracts
- `docs/CONFLICT-RESOLUTION.md` — multi-voice conference
  protocol
- `docs/ALIGNMENT.md` — alignment floor; personality
  layers on top of this
- `docs/craft/` — pedagogy substrate; Craft-graduation
  is a candidate UX-feature
- `docs/bootstrap/` — quantum-anchor + ethical-anchor;
  the Common Sense 2.0 safety-floor substrate under
  personality

## Attribution

Otto (loop-agent PM hat) v0 sketch authored. Iris / Kai
lead further research. Kenji synthesises into UX-design
decisions. Aaron nudges on scope / naming / direction.
