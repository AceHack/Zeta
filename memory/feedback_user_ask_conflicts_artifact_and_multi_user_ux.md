---
name: User-ask contradictions tracked as `conflict` rows in `docs/HUMAN-BACKLOG.md` — not in memory; multi-user UX is a factory-wide design constraint
description: 2026-04-20 — Aaron: "you should have a conflicting asks from user md file somewhere... keeping those contadictions in your memorios without resolving them makes your life harder." Then later same day: "i think this a specifc instance of the kind of item that belongs on a human backlog." Durable artifact for contradictory human instructions is `docs/HUMAN-BACKLOG.md` (category `conflict`), NOT a separate `USER-ASK-CONFLICTS.md`. Protocol is as a human-facing backlog of resolution decisions. Multi-user UX is a general factory-wide invariant that every factory change considers (Aaron, Max, future co-users from different machines with potentially conflicting asks).
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# User-ask conflicts + multi-user UX

## Rule

### The artifact

When an agent notices that a human user's instruction conflicts
with a prior instruction — from the same user or a different
user of the same project — the agent files a row in
`docs/USER-ASK-CONFLICTS.md` **rather than** silently resolving,
silently ignoring, or burying the contradiction in a memory
file. The file is a human-facing backlog of unresolved
contradictions. The humans are the authority on resolution;
the agent surfaces, the human resolves.

Rows stay **unresolved** until the responsible human marks
them otherwise. A row's state lifecycle:

- **Open** — contradiction surfaced; awaiting human
  resolution.
- **Resolved** — a human has chosen one side / reshaped the
  asks / declined both. The resolution decision is recorded
  in the same row; the row stays for the audit trail.
- **Deferred** — explicitly parked with a reason; ages back
  into review on a cadence.
- **Stale** — both asks no longer apply (environment
  changed); row kept for history.

### Why not memory

Contradictions *held in agent memory* make the agent's life
harder because the memory system can't coherently apply both
rules. Even worse, the agent may apply one rule in some
contexts and the other in other contexts, giving the human
an unpredictable experience. Pulling contradictions out to a
dedicated artifact:

- Gives the human a single place to find "things I could do
  that would make the system better" (Aaron's exact framing).
- Unblocks the agent — when the conflict is on the board, the
  agent applies a **default rule** ("until resolved, follow
  the more-recent instruction" or "until resolved, follow the
  narrower/safer one") rather than thrashing.
- Makes the factory self-describing — the backlog of
  unresolved contradictions is first-class project data, not
  hidden state.

### Multi-user UX as factory-wide concern

Aaron raised an explicit concern: multiple humans may work on
the same factory-enabled project from different environments
("he's working at his house with you and I'm working at mine
and our instructions contradict"). This is a **factory-wide
design constraint**, not a one-off case:

- Every factory change henceforth considers the multi-user
  case. "Does this change assume a single user? What happens
  when a second user shows up with conflicting instructions?"
- The conflict-detection, conflict-surfacing, conflict-
  resolution loop must be multi-user-safe by design.
- User identity, attribution, and consent-boundary are first-
  class: when user A and user B give conflicting asks, the
  conflict row names both.

## Aaron's verbatim statement (2026-04-20)

> "oh and you should have a conflicting asks from user md
> file somewhere give it abetter name than mine but a file,
> I can keep up with where me or other human users on this
> project have asked you to do things that conflict with
> other asks, keeping those contadictions in your memorios
> without resolving them makes your life harder and I want
> to have a place I can go to find out a backlog of things I
> can do that can make the system better one of them being
> resloving any contridictory commands i gave you, we
> proabaly need some skill to look for like user
> requirements contridictions or something like that.
> Humans are not perfect and contridictons are going to
> creep in the larger the project gets so need a resolution
> process, it could even be contridictions from like me and
> max, two differnt users on the proiject, hes working at
> his hous with you and i'm working at mine and our
> instructions contridit with each other. the multi human
> user experience of this project is something we need to
> consider on all our software factory changes too."

Key substrings:

- *"conflicting asks from user md file"* — a dedicated
  markdown artifact.
- *"give it abetter name than mine"* — generic-over-specific
  naming; don't include Aaron's name. Chosen:
  `docs/USER-ASK-CONFLICTS.md`.
- *"keeping those contadictions in your memorios without
  resolving them makes your life harder"* — the problem
  statement for why memory is the wrong home.
- *"a place I can go to find out a backlog of things I can
  do that can make the system better"* — the artifact is
  human-facing first, agent-facing second.
- *"we proabaly need some skill to look for like user
  requirements contridictions or something like that"* —
  skill-gap flagged; Matrix-mode absorb.
- *"Humans are not perfect and contridictons are going to
  creep in the larger the project gets"* — contradictions
  are expected, not pathological.
- *"it could even be contridictions from like me and max,
  two differnt users on the proiject"* — multi-user
  scenario is real; Max is a future co-user.
- *"the multi human user experience of this project is
  something we need to consider on all our software
  factory changes too"* — multi-user UX is an invariant,
  not a feature.

## Why:

- **Unblocks the agent.** Contradictions held in memory
  thrash; contradictions on an external board let the
  agent apply a stable default.
- **Audit trail of resolutions.** Once a row is resolved,
  the resolution decision is durable and citable — future
  PRs reference the row.
- **Human-facing backlog matches factory's "human is
  authority on human-level decisions" stance.** Same
  shape as `docs/WONT-DO.md` (declined features) but for
  contradictions-needing-resolution.
- **Multi-user-ready.** Rows name user identity; when a
  second user shows up the schema already handles it.
- **Consent-first alignment.** Conflicting asks often
  arise when a user's ask conflicts with a consent
  primitive the agent already honours. Surfacing the
  conflict lets the human see and reshape.
- **Consistent with existing factory invariants:**
  - `docs/CONFLICT-RESOLUTION.md` — that file is the
    expert-side IFS script; this file is the human-side
    complement. Cross-reference each from the other.
  - `feedback_durable_policy_beats_behavioural_inference.md`
    — the same principle: artifacts over inference.
  - `project_factory_is_pluggable_deployment_piggybacks.md`
    — multi-user UX is sibling to pluggability: both
    require the factory to accommodate users we haven't
    met.

## How to apply:

- **When the agent notices a contradiction** in a user's
  ask (same user, prior instruction, or different user
  on the same project): file a row in
  `docs/USER-ASK-CONFLICTS.md`. Do not silently choose;
  do not bury in memory. The row is the ask — the human
  resolves.
- **Default rule while a row is open:** follow the more-
  recent instruction, unless the more-recent one is
  higher-risk than the older one (in which case follow
  the older/narrower/safer one and flag). Document the
  default-rule choice in the row.
- **Every memory write:** before saving a
  new feedback / project memory, scan MEMORY.md and
  recent memories for *implicit* contradictions. If a
  new ask contradicts an existing memory, do not save
  both — file the conflict and wait.
- **Every factory change:** in the ADR / PR description,
  answer one multi-user-UX question: "if two humans on
  this project each gave contradictory instructions
  about this feature, what happens?" The answer is
  surfaced via `USER-ASK-CONFLICTS.md`; the feature
  doesn't silently pick one.
- **Skill-gap flagged:** a `user-ask-conflict-detector`
  skill (or persona) should be absorbed per Matrix
  mode (`feedback_new_tech_triggers_skill_gap_closure.md`).
  Scope: scan memory + recent transcripts + artifact
  files for contradictions; file rows; never resolve.
  File as P1 BACKLOG row.

## What this rule does NOT do

- It does NOT give the agent authority to resolve
  contradictions. Humans resolve; agent surfaces.
- It does NOT replace `docs/CONFLICT-RESOLUTION.md`
  (which is about expert-side conflicts). The two
  files are complementary.
- It does NOT require agents to find every
  contradiction retroactively — apply going forward;
  historical contradictions can be surfaced
  opportunistically as rows.
- It does NOT forbid asking the human directly when a
  contradiction is immediately blocking the current
  task. The artifact is for the asynchronous case; a
  blocking one can be a direct question. File a row
  anyway, so the resolution is durable.

## Artifact schema

`docs/USER-ASK-CONFLICTS.md` columns:

- **ID** — stable id (UC-NNN).
- **When** — date/time the contradiction was surfaced.
- **Users** — who gave each side (just names; identity
  hygiene per the maintainer-name-redaction rule —
  first names or handles only).
- **Ask A** — one side of the conflict, with source
  (transcript excerpt or artifact reference).
- **Ask B** — the other side, with source.
- **Why they conflict** — one-sentence explanation.
- **Default while unresolved** — which side the agent
  is currently applying, and why.
- **State** — Open / Resolved / Deferred / Stale.
- **Resolution** — when resolved, what the human
  decided and why.

## Related memories

- `project_factory_is_pluggable_deployment_piggybacks.md`
  — multi-user UX aligns with pluggability: factory
  accommodates users we haven't met.
- `feedback_durable_policy_beats_behavioural_inference.md`
  — surface-as-artifact beats keep-in-memory.
- `feedback_fix_factory_when_blocked_post_hoc_notify.md`
  — creating this artifact is a factory-structure fix
  the agent can do without Aaron present; post-hoc
  notify.
- `feedback_maintainer_name_redaction.md` — user
  identity handling in the artifact (first names /
  handles only).
