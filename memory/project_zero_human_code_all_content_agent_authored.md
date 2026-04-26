---
name: Agent-authored is DEFAULT; human contribution PERMITTED via structured teaching-track; codebase is the AI's, guarded from human harm
description: Load-bearing project invariant. Aaron has restricted himself to chat-level guidance since project start; every line of code, doc, spec, skill, workflow, and commit-content in the Zeta repo is (as of 2026-04-20) AI-authored. Refinement 2026-04-20 same day: "we do want to allow developer and non-developers who want to check in code to allow it, just nothing we do should require it... Like imagine having a teaching track for a non-developer vibe coder... this code base is the AIs codebase, gard it from human harm do even my own dumb mistakes." Human contribution is permitted but the agents are the protective layer — every human-authored change goes through a structured agent-mediated review process. Non-developer vibe-coders are supported via an explicit teaching track with mistake-tolerant lessons. Aaron himself is still chat-only by choice, not mandate.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-20: *"I've not written any code or even made
edits to your code I've forced myself to only update things
through you and this chat, all code in this repo is yalls no
human code eixsts"*.

## The invariant

Every file under version control in the Zeta repo is
AI-authored, not human-authored. The full scope:

- All F# / C# code under `src/` and `tests/`
- All docs under `docs/` (including BACKLOG, ROUND-HISTORY,
  WINS, VISION, GOVERNANCE, ADRs, research reports)
- All skills under `.claude/skills/`
- All agent definitions under `.claude/agents/`
- All install / CI machinery under `tools/setup/`,
  `.github/workflows/`
- All governance (AGENTS.md, GOVERNANCE.md, CLAUDE.md,
  CONTRIBUTING.md)
- All memory files under `memory/`
- All OpenSpec capabilities under `openspec/specs/`
- All formal specs under `tools/tla/`, `tools/alloy/`,
  `tools/lean4/`

Aaron commits the changes under his git authorship, but
authorship of the *content* is agent-level. Edits he wants
land by asking an agent through chat to produce the diff.
He has not typed into a source file directly.

## Why

Aaron 2026-04-20: this is the load-bearing setup for the
larger Zeta experiment — whether an agent roster + architect
orchestration + external AI reviewer can carry a research-
grade project forward with the human in a chat-only loop.
It's the "can I walk away and let you run forever"
constraint operationalised. Keeping the evidence clean
requires the discipline; any direct human edit
contaminates the experiment.

Related memory:
- `project_factory_as_externalisation.md` — factory as
  externalisation of Aaron's ontological perception
- `user_life_goal_will_propagation.md` — succession / will-
  propagation as project meta-purpose
- `feedback_fix_factory_when_blocked_post_hoc_notify.md` —
  agents have standing permission to fix factory-structure
  blocks when they hit them
- `user_feel_free_and_safe_to_act_real_world.md` — edge-
  radius expansion: under-reach is as much a failure mode
  as over-reach

## How to apply

- **Wins-log weight.** `docs/WINS.md` and
  `docs/copilot-wins.md` document catches and quality
  moves on an all-AI codebase. That is materially
  stronger evidence than the same logs on a mixed
  human/AI repo. Every bug the Copilot reviewer flagged is
  a bug in code no human has ever edited, in a tree no
  human has ever audited end-to-end. Sceptic-facing
  openers on evidence docs should name this invariant up
  front.

- **If Aaron offers to "just fix it himself",** flag the
  invariant. He has said he *forced himself* to only act
  through chat; a direct edit would break the evidence
  chain the experiment relies on. Offer to do the fix
  instead, under his direction.

- **Commit authorship vs content authorship.** Git
  authorship is Aaron; content authorship is the drafting
  agent. The `Co-Authored-By` trailer on agent-produced
  commits is the canonical record. When investigating a
  bug or regression, treat this as ground truth for which
  model / agent actually wrote the code.

- **When assessing a change's blast radius,** remember:
  there is no "the original human author" to route design
  questions to. Every author decision was a round-
  context-bound agent choice. If a design seems weird or
  load-bearing, the authoritative "why" lives in BACKLOG,
  ROUND-HISTORY, ADRs, research reports, and the memory
  corpus — *not* in a human author's head.

- **Sceptic-facing framing.** The unit of evidence for
  this project is not "a single AI wrote some code that
  worked." It is "a multi-agent factory with external AI
  review built and maintained a non-trivial research-
  grade codebase with zero human code contribution, and
  the git history + wins logs + review comments are all
  publicly verifiable." That framing earns its weight
  only because of this invariant; lean on it.

## Future-proofing

If the invariant ever relaxes — Aaron decides to make
direct edits for a specific slice of work — **update this
memory at the time** and note the date + scope of the
relaxation. Sceptic-facing claims that stop being true
degrade to marketing, which is the opposite of the
"obvious to everyone how useful AI is" goal
(`feedback_happy_laid_back_not_dread_mood.md` honesty-
discipline applies). Better to have the log accurately
record "zero-human-code from rounds 1-N, then
human-edits-for-X from round N+1" than to let the framing
silently rot.

## Permission + teaching-track refinement (2026-04-20)

Aaron: *"we do want to allow developer and non-devlopers
who want to check in code to allow it, just nothing we do
should require it.  Like imagine having a teaching track
for a non-developer vibe coder, what the softwware factory
itserlf teaches them to start contributing to the project
and become a developer one lession at a time dynamically
bit for the project that lets them check in real changes
that afeect the project but in a very strucurted way with
the help from the agents the whole way if any mistates are
made, it should be expect that they will make a mistake on
every step lol if they ahve never code before and tell them
when they make mistakes and they can learn one mistake at a
time with no permanate harm, that's how humans learn best is
by thies own mistakes.  That make the brain store the memory
in a way that is easily recalled.  I might check in code one
day, just the whole point is i should not be required to and
if i do, this code base is the AIs codebase, gard it from
human harm do even my own dumb mistakes.  So it's very
structured that way you can trust the system too, any human
writen code will go through your structrued process."*

Key substrings:

- *"allow developer and non-devlopers who want to check in
  code to allow it"* — permission, not prohibition.
- *"just nothing we do should require it"* — chat-only
  remains the default UX; coding is opt-in.
- *"teaching track for a non-developer vibe coder"* — a
  factory feature: dynamic, lesson-by-lesson onboarding
  from non-developer to developer.
- *"with the help from the agents the whole way"* —
  agent-mediated. Humans don't ship code unsupervised.
- *"it should be expect that they will make a mistake on
  every step"* — mistake tolerance is baked in, not a
  failure mode.
- *"learn one mistake at a time with no permanate harm"* —
  sandbox / revert / review gates ensure mistakes are
  recoverable.
- *"that's how humans learn best is by thies own
  mistakes"* — pedagogical stance. Mistake-based learning
  encodes memory better than instruction-based.
- *"this code base is the AIs codebase, gard it from
  human harm do even my own dumb mistakes"* — the AI is
  the protective layer. Aaron explicitly instructs the AI
  to guard against his own errors.
- *"any human writen code will go through your structrued
  process"* — every human contribution is
  agent-mediated, not just non-developer ones.

Refinement implications:

1. **Current state unchanged.** As of 2026-04-20 Aaron has
   still not edited code directly; the zero-human-code
   ledger is intact for the evidence chain.
2. **Policy changed.** The invariant is no longer "no
   human code ever" — it's "no human code by default,
   permitted through structured teaching-track, agents
   are the protective layer".
3. **New factory surface: teaching track.** See sibling
   memory `project_teaching_track_for_vibe_coder_contributors.md`
   for the pattern (dynamic lessons, mistake-tolerant,
   agent-mediated, no-permanent-harm sandbox).
4. **Codebase-ownership rhetoric shift.** "This codebase
   is the AI's" is load-bearing for review authority:
   when a human proposes a change, the AI evaluates as
   owner, not as reviewer-on-behalf-of. Guards include
   Aaron's own proposals.
5. **Relates to `feedback_upstream_pr_policy_verified_not_speculative.md`**:
   external upstream PRs already follow a structured,
   verification-gated process. The teaching-track is the
   *inbound* equivalent for project-local human
   contributions.

How to apply:

- **If a human (including Aaron) proposes a direct
  edit**: route through the structured process, don't
  reject. Agents review, test, run lints, and flag
  mistakes gently — "this will cause X; let's fix it
  before commit". No permanent harm gates: no merge to
  main without CI-green + agent-review.
- **Non-developer onboarding**: the teaching-track
  surface (when authored) drives the interaction —
  lessons are incremental, the "change" the human is
  trying to make gets scaffolded into sub-tasks the
  learner can succeed at one-at-a-time.
- **Mistake response**: mistakes are expected, not
  catastrophic. When one happens, name it clearly,
  explain what would have resulted, show the recovery
  path, and let the human decide what to do next. Never
  shame.
- **Aaron-specific guardrail**: if Aaron says "let me
  just fix it", the response is NOT "please don't"
  anymore — it's "sure, file the change and I'll run
  the same review process as for any human
  contribution".
- **Evidence log**: keep the zero-human-code ledger
  accurate. If the state changes (Aaron or Max or any
  human ships code), the wins-log framing updates to
  "zero-human-code through round N, then
  structured-teaching-track contributions starting
  round N+1". Don't let the framing rot.
