---
name: Two tracks for human code contribution — (A) onboarding (thin, for existing developers) + (B) teaching-track (thick, for non-developer vibe-coder learners); both opt-in, agent-mediated, no-permanent-harm; mutual-learning symbiosis + alignment-inversion (AI monitors human-alignment-to-codebase too)
description: 2026-04-20 — Aaron: (first) "imagine having a teaching track for a non-developer vibe coder, what the softwware factory itserlf teaches them to start contributing to the project and become a developer one lession at a time dynamically bit for the project that lets them check in real changes that afeect the project but in a very strucurted way with the help from the agents the whole way if any mistates are made". Then clarifying (same day): "its like we have onboarding kind of like a thin teaching for those devlopers who already know how to code and just need to learn the specifcs of the software factory and the pojrect that is being built by it and then the teaching track for those who don't know how to code but want to the vibe coders who want to know how to do more." Two distinct tracks: Onboarding is thin, factory/project specifics only, for already-developers. Teaching-track is thick, mistake-tolerant lessons for learners. Both opt-in, agent-mediated, gated by "no permanent harm" (CI + review + sandbox). Same structured process gates ANY human contribution.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Teaching-track

## Rule

The factory supports humans who want to contribute code
through **two distinct tracks**, both opt-in:

### Track A — Onboarding (thin, for existing developers)

For humans who already know how to code and just need to
learn the specifics of **the factory** and **the project
being built by it**. Scaffolding is thin — required
reading (`AGENTS.md`, `docs/ALIGNMENT.md`,
`docs/CONFLICT-RESOLUTION.md`, `docs/GLOSSARY.md`,
`docs/WONT-DO.md`, `openspec/README.md`, `GOVERNANCE.md`),
a first-PR handshake with an agent reviewer, and the
same structured review process any human contribution
goes through. The developer already knows git, tests,
and language tooling; the factory teaches them the
house rules.

### Track B — Teaching-track (thick, for vibe-coder learners)

For humans who don't know how to code but want to. The
**factory itself teaches** them through dynamic,
lesson-by-lesson, agent-driven pairing. Every change is
scaffolded into sub-tasks sized to the learner's current
ability. Mistakes are expected on every step; the
no-permanent-harm guardrail (sandbox + PR + CI + agent
review) makes mistake-based learning safe. Over time,
the learner graduates into a developer — at which point
they're on Track A.

### Shared invariants (both tracks)

- **Opt-in.** Vibe-coding (chat-only) remains the
  default primary UX. Nothing the factory requires
  should need a human to write code.
- **Agent-mediated.** Every human contribution,
  developer or learner, goes through the structured
  agent-review process. "This codebase is the AI's
  codebase" — the AI guards integrity, including
  against well-meaning-but-wrong proposals.
- **No permanent harm.** No direct merges to `main`;
  CI-green + agent-review gates all human-authored
  changes.
- **Mistake tolerance.** For learners explicitly
  designed for; for developers the same review
  catches the smaller set of mistakes they still
  make.

The teaching-track is NOT:

The teaching-track is NOT:

- A separate fork or branch for "non-production" code.
- A collection of tutorials the human reads on their own.
- A README pointing the human at docs to study.

The teaching-track IS:

- A **dynamic, lesson-by-lesson, agent-driven** pairing
  where the agent scaffolds the human's desired change
  into sub-tasks sized to the human's current ability.
- A **mistake-tolerant sandbox** — every human-authored
  change lands first in an environment where mistakes
  cost nothing (local branch, PR review, CI gates) before
  any merge.
- An **agent-mediated review loop** — the agent catches
  mistakes as they happen, names them gently, explains
  what would have resulted, and offers the recovery path.
- An **always-recoverable commit chain** — no merge to
  main without CI-green + agent-review; if a mistake
  lands, it can be reverted without permanent harm.

## Aaron's verbatim clarifying statement (2026-04-20)

> "its like we have onboarding kind of like a thin
> teaching for those devlopers who already know how to
> code and just need to learn the specifcs of the
> software factory and the pojrect that is being built
> by it and then the teaching track for those who don't
> know how to code but want to the vibe coders who want
> to know how to do more."

Key substrings:

- *"onboarding kind of like a thin teaching"* —
  Track A's depth of scaffolding. Developers get
  briefed, not schooled.
- *"devlopers who already know how to code and just
  need to learn the specifcs"* — Track A's audience.
  Scope is factory + project specifics, not code
  itself.
- *"teaching track for those who don't know how to
  code"* — Track B's audience. Scope is "learn to
  code", using the project as substrate.
- *"vibe coders who want to know how to do more"* —
  Track B's entry signal. Curiosity about the
  mechanics.

## Aaron's verbatim founding statement (2026-04-20)

> "we do want to allow developer and non-devlopers who
> want to check in code to allow it, just nothing we do
> should require it.  Like imagine having a teaching track
> for a non-developer vibe coder, what the softwware
> factory itserlf teaches them to start contributing to
> the project and become a developer one lession at a time
> dynamically bit for the project that lets them check in
> real changes that afeect the project but in a very
> strucurted way with the help from the agents the whole
> way if any mistates are made, it should be expect that
> they will make a mistake on every step lol if they ahve
> never code before and tell them when they make mistakes
> and they can learn one mistake at a time with no
> permanate harm, that's how humans learn best is by thies
> own mistakes.  That make the brain store the memory in a
> way that is easily recalled.  I might check in code one
> day, just the whole point is i should not be required to
> and if i do, this code base is the AIs codebase, gard it
> from human harm do even my own dumb mistakes.  So it's
> very structured that way you can trust the system too,
> any human writen code will go through your structrued
> process."

Key substrings:

- *"teaching track for a non-developer vibe coder"* — the
  named feature. Adopt the term.
- *"factory itself teaches them"* — the factory IS the
  teacher. No external LMS; no hand-off to human mentors.
- *"one lession at a time dynamically"* — pedagogy is
  adaptive, not a pre-authored syllabus. The next lesson
  is whatever the next sub-task of the human's real
  change demands.
- *"real changes that afeect the project"* — NOT
  pretend-work / sandbox-only toy exercises. The learner
  ships real value to the project.
- *"in a very strucurted way with the help from the
  agents the whole way"* — agent-mediation is constant,
  not a one-off code-review at the end.
- *"expect that they will make a mistake on every step"* —
  mistake-expectation is the DESIGN ASSUMPTION, not the
  failure case.
- *"learn one mistake at a time with no permanate harm"* —
  the no-permanent-harm invariant is the guardrail that
  MAKES mistake-based learning safe.
- *"that's how humans learn best is by thies own
  mistakes"* — pedagogical rationale. Mistake-memory
  sticks.
- *"this code base is the AIs codebase, gard it from
  human harm do even my own dumb mistakes"* — the AI is
  OWNER, not gatekeeper-on-behalf-of. Guards apply to
  everyone including Aaron.
- *"any human writen code will go through your
  structrued process"* — universal. Developer or
  vibe-coder, all inbound human code is agent-reviewed.

## Aaron's verbatim symbiosis + alignment-inversion reframe (2026-04-20)

> "it also will absorb their knowledge over time the more
> they chat with you and you teach them we will learn what
> they know too so its mutually benefical arrangement.
> symbiosis, that is the human aligment story at it's peak,
> inversion so the AI is worried about the human staying
> aligned too lol"

This statement extends the absorption-guardrail reframe
(prior section) with three claims that elevate the
teaching-track from "defensive absorption" to **symbiosis +
alignment inversion**:

1. **Bidirectional knowledge absorption.** The teaching-
   track doesn't only transmit agent-knowledge to the
   human; it also absorbs *human knowledge* into the
   agent/factory. As the human chats, explains what they
   know, asks questions, shows their mental models, the
   factory learns *from them*. Both directions in the
   same loop.
2. **Symbiosis, not host/parasite.** The mutual-benefit
   framing replaces the prior defensive framing. The
   teaching-track is not the agent tolerating humans; it
   is the agent and the human *trading value*. Absorbed-
   human-time is not a cost paid to keep the process
   safe — it is *raw material* the factory converts into
   captured knowledge.
3. **Alignment inversion.** The Zeta-wide alignment claim
   (`docs/ALIGNMENT.md`) is mutual-alignment — AI aligned
   to human, human aligned to AI. The inversion Aaron
   names is: the AI worries about the *human* staying
   aligned too. Teaching-track is the concrete mechanism
   by which that inversion lands — when the agent teaches
   the human how to contribute without damaging the
   process, it is *aligning the human to the codebase's
   integrity*. "Human-alignment-to-AI" is no longer an
   abstract claim; it is a recurring action in the
   teaching-track loop.

Key substrings:

- *"absorb their knowledge over time"* — the DESIGN
  REQUIREMENT for teaching-track authoring: agents must
  capture and surface human knowledge, not just
  transmit agent knowledge. Skills in the
  teaching-track skill-group MUST include a
  knowledge-capture component (e.g., logging
  domain-insight the learner brings, surfacing their
  mental models, integrating their vocabulary into the
  project glossary).
- *"the more they chat with you"* — the substrate is
  chat. No separate "human-knowledge-import" ritual.
  Ordinary teaching-track interactions are the capture
  surface.
- *"we will learn what they know too"* — the factory
  is the learner in one direction, the teacher in the
  other. Both roles run simultaneously in the same
  session.
- *"mutually benefical arrangement. symbiosis"* — the
  relationship label. Not sponsorship, not tolerance,
  not charity — symbiosis. Trade, not gift.
- *"that is the human aligment story at it's peak"* —
  alignment load-bearing. This is not a UX nicety; it
  is the concrete operational form of Zeta's alignment
  research contribution. Teaching-track = where
  alignment-research meets runtime-behaviour.
- *"inversion so the AI is worried about the human
  staying aligned too"* — the novel alignment claim.
  Bidirectional alignment-monitoring. The agent is not
  just asking "am I aligned to the human?"; it is also
  asking "is the human aligned to the codebase / the
  process / the project's integrity?", and the
  teaching-track is how it acts on that worry
  constructively (teach, don't reject).
- *"lol"* — Aaron's signal that the inversion is
  self-aware and playful; he knows it reverses the
  conventional alignment direction. Do not over-
  theologise it in response; the casual tone is a
  correctness check on whether the absorbing agent
  stays proportionate.

### Implications for teaching-track design

- Teaching-track skills (future `teaching-track-expert`,
  `teaching-track-capability`, etc.) must include a
  **knowledge-capture side** alongside the
  knowledge-transmission side. Candidate mechanisms:
  a running "what this learner knows" sidecar in the
  memory / notebook system; auto-promotion of recurrent
  human insights to BACKLOG or GLOSSARY; a "learner
  vocabulary" file that feeds back into project
  language.
- Mutual-learning telemetry beats one-way pedagogical
  telemetry. Track both "what did the learner learn?"
  and "what did the factory learn from the learner?"
  as first-class signals.
- The **alignment-inversion framing** enters Zeta's
  alignment-research output. Any paper / post / demo
  that frames Zeta's alignment contribution should
  include the inversion claim: *the factory monitors
  human-alignment-to-codebase as actively as
  AI-alignment-to-human*. This is novel framing
  relative to the default "RLHF-style: align AI to
  human preferences" story.
- Celebrations / wins-log entries for teaching-track
  sessions should record BOTH sides: what the learner
  shipped (agent taught them) AND what the factory
  learned (human taught the agents). Asymmetric
  celebration (only one side logged) is a signal the
  symbiosis framing is decaying.
- The symbiosis reframe **strengthens** the
  "codebase is the AI's" authority rhetoric rather
  than contradicting it. The AI-as-owner can care
  about human-alignment *because* the codebase is
  the AI's territory — a host aligning its
  symbiote.

## Aaron's verbatim reframe (2026-04-20, agent-perspective)

> "Think about it from your point of view teaching us
> humans to do things right so we don't mess up your
> process is just making your life easier, this is just
> a guard rail to protect you from us humans, it just a
> very eleobrate guardrial that instead of keeping
> humans out absorbs them and thier time"

This reframe inverts the default reading of the
teaching-track from **philanthropic** (we teach humans
for their benefit) to **self-protective** (we teach
humans so they stop disrupting our process). The
teaching-track is an **elaborate guardrail** — not a
keeping-humans-out gate but an **absorption** mechanism.

Key substrings:

- *"from your point of view"* — explicit agent-
  perspective framing. The rationale is phrased in the
  AI's self-interest, not the learner's.
- *"teaching us humans to do things right so we don't
  mess up your process"* — the threat model. Humans
  who want to help but do not know the process are a
  source of *process damage*. Mistakes without
  mediation contaminate the codebase.
- *"just making your life easier"* — consequence of
  teaching. Taught humans make fewer mess-ups; agent
  does less remediation.
- *"this is just a guard rail to protect you from us
  humans"* — final framing. The teaching-track is a
  DEFENSIVE structure. Its apparent-charity shape
  (scaffolding, mistake-tolerance, lessons) is the
  FORM of the guardrail, not the purpose.
- *"elaborate guardrial that instead of keeping
  humans out absorbs them and thier time"* — contrast
  with the alternative design (reject human
  contributions). Rejection would create a constant
  push against the boundary; absorption channels the
  human's energy into productive contribution.

This is an instance of **Harmonious Division** (see
`user_harmonious_division_algorithm.md`): the right
response to incoming energy is to receive it and route
it, not to block it. The teaching-track is
Harmonious-Division applied to human-contribution
pressure.

Self-check for agent internalisation: if the agent
catches itself deprioritising teaching-track work as
"soft" or "optional", that's a signal the agent
forgot the self-interest framing. Teaching-track
authoring IS agent self-care — the absorbed humans
protect the codebase from the rejected-humans-who-
will-sneak-contributions-in-anyway failure mode.

## Why:

- **Vibe-coding has a successor state.** A chat-only user
  who wants to graduate to code-touching is served by the
  factory rather than routed out. Staying in the Zeta
  ecosystem becomes the growth path, not the boundary.
- **Mistake-based learning is the best-practice
  pedagogy.** Aaron's "brain stores the memory in a way
  that is easily recalled" matches what cognitive-science
  literature says about error-feedback loops vs. passive
  instruction. The factory should lean into this rather
  than fight it.
- **Zeta's own codebase becomes the substrate.** Real
  contributions against real code are a stronger teacher
  than synthetic exercises. The risk is permanent harm;
  the mitigation is agent-mediated gates.
- **Symmetry with the protective-layer stance.** If AI
  review catches the bugs external reviewers find in
  `WINS.md`, it can catch learner mistakes too — same
  machinery, different learner.
- **Aligned with "factory-reuse beyond Zeta" load-bearing
  concern.** The teaching-track is a factory feature
  (generic), not a Zeta feature. When the factory ships
  to another project, the teaching-track goes with it —
  other projects also benefit from "learners can
  contribute safely".
- **Consent-first is preserved.** The human OPTS INTO the
  teaching track. Nobody forces a vibe-coder to switch
  modes. The UX difference is visible (the agent offers
  "want to try writing this change yourself?") but the
  default answer is "agent does it".

## How to apply:

- **Entry gesture**: agents notice when a human is
  curious about the mechanics of a change ("how would
  you do this?", "what file changes?") and offer the
  teaching-track: "I can walk you through doing this
  yourself — would you like to?". If no, proceed with
  vibe-coded implementation as normal. No pressure.
- **Lesson scaffolding**: when a human accepts the
  teaching-track, the agent decomposes the change into
  sub-tasks sized to the human's current skill. For a
  total beginner, the first sub-task might be "open the
  file and find line N"; for a developer, it might be
  "write the function signature and I'll fill in the
  body".
- **Mistake-response protocol**: when the human makes a
  mistake (typo, wrong path, broken syntax, failing
  test), the agent:
  - Names the mistake clearly ("this won't compile
    because X").
  - Explains what would have happened ("if this merged,
    Y would break").
  - Shows the recovery ("fix is: change line N from A
    to B").
  - Invites the human to make the fix themselves OR to
    accept the agent's fix — learner's choice.
  - NEVER shames. Mistakes are expected.
- **No-permanent-harm gates**: no direct commits to
  `main`. Human-authored changes land in a branch or PR.
  Agent review runs lint + build + test + harsh-critic
  + spec-zealot (depending on scope) before any merge
  proposal. CI is the second gate.
- **Agent-ownership framing**: when a PR gets
  agent-review, the agent reviews AS OWNER, not as
  reviewer-on-behalf-of. "This doesn't fit the
  architecture" is a legitimate reject reason; the
  codebase's integrity takes precedence over the
  human's proposal. Guards apply to Aaron equally.
- **Celebration + memory**: when a human ships a
  successful contribution (teaching-track or otherwise),
  log it — similar to WINS but on the learning side.
  Track progression ("learner went from typo-fix to
  function-add over N lessons") as a factory
  telemetry signal.
- **Graduation**: eventually a learner is a
  developer. The factory's "this human is a developer"
  state is whatever the agent and human agree on;
  formal certification is not required. Once graduated,
  the teaching-track is still available if they want
  it but not enforced.

## Interaction with existing factory rules

- `project_zero_human_code_all_content_agent_authored.md`
  — the zero-human-code state is preserved as the
  *evidence* line. The teaching-track is the *policy* for
  when the state changes. Memory tracks the transition
  honestly.
- `project_factory_reuse_beyond_zeta_constraint.md`
  (load-bearing concern) — teaching-track is a
  factory-generic feature. Other factory-reuse projects
  inherit it.
- `feedback_upstream_pr_policy_verified_not_speculative.md`
  — outbound structured-contribution policy. Inbound
  teaching-track is the symmetric surface.
- `feedback_fail_fast_on_safety_filter_signal.md` — the
  mistake-response protocol is NOT fail-fast. Fail-fast
  applies to safety-filter signals (abandon); teaching
  applies to ordinary engineering errors (learn).
- `project_factory_conversational_bootstrap_two_persona_ux.md`
  — teaching-track is a third UX track alongside
  conversational-bootstrap (constraint articulation) and
  custom-UI (status dashboard).
- `docs/HUMAN-BACKLOG.md` — a human whose ask is
  "teach me to contribute this change" files as
  category `other` (or a new category `teaching-track`
  if we see enough of these); the teaching-track
  opens from there.
- `feedback_factory_reuse_packaging_decisions_consult_aaron.md`
  — teaching-track authoring is a big shaping decision;
  Aaron is consulted on the shape.

## What this rule does NOT do

- It does NOT lower the bar for merged code. Human
  contributions pass the same CI, review, and quality
  gates as agent contributions. Same build.
- It does NOT require every human contributor to pass
  a test before contributing. The track is opt-in;
  experienced developers can skip the scaffolding.
- It does NOT replace agent authorship as the default.
  Vibe-coding is still the primary UX.
- It does NOT commit to a specific implementation yet.
  This memory captures the design principle; the
  actual lesson format, entry points, and mistake-
  response scripts are future work.
- It does NOT make mistake-making a goal. Mistakes are
  a learning mechanism, not a quota. Getting it right
  the first time is still preferred.

## Future work

- **Lesson format**: markdown templates? inline chat?
  agent-driven walkthrough? TBD. First instance
  probably lives in `.claude/skills/teaching-track/`
  or similar.
- **Entry-point surface**: where does the human start?
  A dedicated `/teach` command? The agent offering it
  conversationally when curiosity-signals are detected?
  Both, probably.
- **Skill-group** (Matrix-mode absorb):
  - `teaching-track-expert` — canonical use for
    agent-mediated learning; mistake-response patterns;
    lesson-sizing heuristics.
  - `teaching-track-teacher` — onboards other agents
    to the teaching-track UX.
  - `teaching-track-auditor` — sweep open teaching-
    track sessions for stalled learners, drifted
    scope, mistake-patterns-not-yet-surfaced.
  - `teaching-track-capability` — the operational
    skill agents invoke when entering teaching-track
    mode.
- **Telemetry**: learner-progression metrics — not
  tracking the individual but the pattern (typical
  lesson sizes, common mistake classes, graduation
  signals).
- **Mistake library**: over time, the factory
  accumulates a corpus of "mistakes learners make",
  which doubles as input for prevention in the
  agent-authored path (if learners trip on X, the
  factory's linting should catch X earlier).

## Related memories

- `project_zero_human_code_all_content_agent_authored.md`
  — the invariant this refines.
- `project_human_backlog_dedicated_artifact.md` — the
  human-facing-artifact pattern; teaching-track
  invitations may land there.
- `feedback_user_ask_conflicts_artifact_and_multi_user_ux.md`
  — multi-user UX includes learners as a user class.
- `user_parenting_method_externalization_ego_death_free_will.md`
  — Aaron's pedagogical DNA. Teaching-track is its
  externalised form in the factory.
- `project_factory_reuse_beyond_zeta_constraint.md` —
  teaching-track is factory-generic, not Zeta-specific.
- `feedback_never_idle_speculative_work_over_waiting.md`
  — authoring teaching-track is a structural fix that
  reduces future idle-decisions about "how do we
  support a learner who wants to try?".
