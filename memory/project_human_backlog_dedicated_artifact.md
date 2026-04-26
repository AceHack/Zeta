---
name: Human backlog — dedicated artifact (`docs/HUMAN-BACKLOG.md`) for items that need a human to act; agents file rows, humans resolve; generalises the user-ask-conflicts case
description: 2026-04-20 — Aaron: "i think this a specifc instance of the kind of item that belongs on a human backlog a list of items that this project needs a human to do, that way i don't ahve to come ask, need anyting from me, i can just look at the human backlog". Generalises the user-ask-conflicts artifact to any kind of pending-human-action work. Single file `docs/HUMAN-BACKLOG.md` with categorised rows (conflict / approval / credential / external-comm / naming / physical / observation / other). Agents file; humans resolve. Companion to `docs/BACKLOG.md` (agent-facing).
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Human backlog as dedicated artifact

## Rule

Any work the factory identifies as **requiring a human to
act** goes into `docs/HUMAN-BACKLOG.md` as a row — not into
agent memory, not into silent wait state, not burning
context by re-surfacing every conversation.

The file is **git-native**, **free** (no SaaS), and
**pluggable** (future plugin to Jira / Linear / custom
board, but the git-native surface stays the default). It
is the *human-facing* companion to `docs/BACKLOG.md` (which
is agent-facing).

## Aaron's verbatim statement (2026-04-20)

> "i think this a specifc instance of the kind of item
> that belongs on a human backlog a list of items that
> this project needs a human to do, that way i don't ahve
> to come ask, need anyting from me, i can just look at
> the human backlog"

Key substrings:

- *"specifc instance"* — user-ask conflicts are one
  category; the general pattern is broader. The
  `docs/HUMAN-BACKLOG.md` artifact is the generalisation.
- *"human backlog"* — Aaron's chosen term. Adopt it as-is.
- *"a list of items that this project needs a human to
  do"* — the scope. Not a list of what the agent plans to
  do; a list of what the agent needs *from* the human.
- *"i don't ahve to come ask"* — the UX goal is
  pull-not-push. The human browses the backlog when they
  choose to; agents don't interrupt with individual asks.
- *"look at the human backlog"* — the artifact is
  expected to be a **place you go**, same UX shape as a
  GitHub Issues list or a Jira board.

## Why:

- **Pull > push UX for asks.** When agents interrupt the
  human with individual asks, the human cannot batch or
  prioritise. A backlog inverts control: the human
  decides when to look at the queue.
- **Generalisation of user-ask conflicts.** The
  conflicts-artifact pattern (`feedback_user_ask_conflicts_artifact_and_multi_user_ux.md`)
  is one category of human-backlog item. Approvals,
  credentials, external comms, naming decisions, and
  physical-world asks are others. One artifact covers
  all; category labels preserve distinction.
- **Agent unblocking.** When an agent blocks on a human
  action, filing the row removes the block from context:
  dependent work can proceed with a "blocked on HB-NNN"
  marker rather than the agent holding the block in
  active context.
- **Multi-user ready.** The `For` column names the
  human(s) expected to resolve. When two or more humans
  contribute to the same project, the backlog is a
  coordination surface.
- **Cheap to maintain.** Markdown rows in a git file.
  Readable on any GitHub-rendered page. No custom
  tooling required to get started; a `human-backlog-filer`
  skill can be added later if cadence demands.
- **Aligned with three factory invariants** —
  git-native persistence, free > cheap > expensive,
  pluggable architecture.
- **Reduces agent rumination.** Not knowing whether to
  ask vs. continue is a cognitive load on both the agent
  and the human. "File the row" is a deterministic move
  that resolves the indecision.

## How to apply:

- **On any kind of block that needs human action**: file
  a row in `docs/HUMAN-BACKLOG.md`. Pick the right
  category from the closed set. If no category fits, use
  `other` and, if the category starts growing, propose a
  new category in a follow-up ADR.
- **When filing a `conflict` row**: the row's `Ask`
  column expands to include the Ask A / Ask B / Why
  conflict / Default while unresolved fields from
  `feedback_user_ask_conflicts_artifact_and_multi_user_ux.md`.
  Same-shape schema, housed in the general backlog.
- **Do not self-resolve.** Agents never mark a row
  Resolved. Agents may update context (`Source`,
  dependent work) but the resolution is the human's
  action, recorded by the human.
- **Dependent work:** when a row blocks a BACKLOG item,
  add a `Blocked on HB-NNN` note to the dependent
  BACKLOG row. When resolved, the dependent row becomes
  actionable.
- **Row ids are stable (HB-NNN).** Numbering is
  monotonic; resolved/stale rows keep their ids so
  references don't rot.
- **Honest seeding only.** The backlog starts empty.
  Agents file rows as real blocks arise. Do not
  retrospectively invent rows to pad.
- **Cadence:** the invoking agent scans
  `docs/HUMAN-BACKLOG.md` at session-open in the same
  way it scans `docs/BACKLOG.md` — both inform
  "what can I do right now?". If all remaining work is
  human-blocked, the agent surfaces that fact rather
  than speculatively filling.
- **Skill-gap flag:** a `human-backlog-filer` capability
  skill (Matrix-mode absorb) would encode the "I'm
  blocked — file a row" pattern so no agent has to
  re-derive it. File as P2 BACKLOG row.
- **Companion to user-ask-conflict-detector skill:**
  the conflict-detector (proposed in
  `feedback_user_ask_conflicts_artifact_and_multi_user_ux.md`)
  files `conflict` rows; the `human-backlog-filer`
  files the other categories. Both land via Matrix mode.

## Vibe-coding guardrail

Aaron (2026-04-20, refinement): *"we should be careful
what ends up in the human backlog given the vibe coding
containt, being we don't want users of this software
factory to ever have to commit or write code or even
markdown or anything themselfs, the primay UX is
conversational and our cusotm UI"*.

This pins the scope: rows describe **what a human must
personally do at the human level** — decisions,
external-world actions, credential provision / consent,
judgement calls. Rows **do not** ask humans to edit
files, commit code, write markdown, or interact with
git. If the action can be "tell the agent what to do",
it is not a human-backlog row — the agent does the work
after the conversational instruction.

Resolutions arrive **conversationally**. The agent records
the resolution in the row; the human never touches the
file. `docs/HUMAN-BACKLOG.md` is an agent-maintained
read-only surface for humans, rendered via git / the
future custom UI.

Consequences for category use:

- **conflict** — legitimate. The decision is the human's;
  agent applies default, records resolution when human
  chooses conversationally.
- **approval** — legitimate if scoped to the decision,
  not to a file edit. "Decide whether to accept ADR-N"
  is a row; "edit ADR-N" is not.
- **credential** — legitimate. The act of revealing /
  provisioning is human-only.
- **external-comm** — legitimate. Only the human can
  pick up the phone, send the intro, sign the paper.
- **naming** — legitimate. The naming-expert gate is a
  human judgement.
- **physical** — legitimate. Physical-world actions are
  inherently human-only.
- **observation** — legitimate. Judgement calls the
  agent is not licensed to make.

Categories that *would* have required human file-work
are explicitly excluded — there are none. If a new
category tempts the agent toward "human writes X"
semantics, that's the signal to redesign the category.

## Interaction with existing factory rules

- `docs/CONFLICT-RESOLUTION.md` — expert-side (IFS)
  conflicts; the reviewer roster resolves internally.
  `docs/HUMAN-BACKLOG.md` category `conflict` — human-
  side conflicts; the human resolves. Each file
  cross-references the other.
- `docs/BACKLOG.md` — agent-facing. If a BACKLOG row
  becomes blocked on a human action, the BACKLOG row
  gets a pointer to the HB-NNN row; the work is
  still tracked in BACKLOG but the action moves to
  HUMAN-BACKLOG.
- `docs/WONT-DO.md` — declined features; a **different**
  shape (final decisions, not pending). If a human
  backlog row is resolved with "decline", the decision
  may graduate to `WONT-DO.md` at the human's
  discretion.

## What this rule does NOT do

- It does NOT replace `docs/BACKLOG.md`. The two
  co-exist — agent-facing vs. human-facing.
- It does NOT give agents authority to demand human
  action; filing a row is surfacing an ask, not an
  interrupt.
- It does NOT require the human to clear the backlog
  on any cadence; the human decides when to look.
- It does NOT permit filing rows for things the agent
  can self-resolve. Before filing, the agent asks: is
  there a factory-structure change, a policy, or a
  tool the agent could use to unblock itself? Only if
  the answer is no does a row get filed.
- It does NOT require a deployed UI. The backlog is
  plain markdown; any git-rendered view suffices.

## Examples mapped to categories (illustrative, not seeded)

- **conflict** — two instructions disagree; agent
  applied a default and awaits resolution.
- **approval** — an ADR draft awaiting sign-off before
  the code-change it authorises can land.
- **credential** — "agent needs DNS record X.Y.Z on
  `lucent.financial` before agent-sent email can be
  tested".
- **external-comm** — "agent drafted a Michael Best
  intro message; Aaron to send or decline".
- **naming** — "Aurora Network public-use naming
  decision: requires naming-expert gate before agent
  uses the name in any external surface".
- **physical** — "HSM enrolment requires a physical
  visit; schedule when convenient".
- **observation** — "this health signal needs a
  clinical team eye; agent cannot interpret".

## Related memories

- `feedback_user_ask_conflicts_artifact_and_multi_user_ux.md`
  — the specific pattern this generalises. Conflict
  rows are category = `conflict` in the general
  backlog.
- `project_factory_is_pluggable_deployment_piggybacks.md`
  — git-native + pluggable justification.
- `feedback_free_beats_cheap_beats_expensive.md` —
  cost ordering; markdown is free.
- `project_git_is_factory_persistence.md` — git as
  default plugin.
- `feedback_durable_policy_beats_behavioural_inference.md`
  — artifact > keeping-in-context.
- `feedback_fix_factory_when_blocked_post_hoc_notify.md`
  — creating this artifact itself falls under
  "fix-factory-when-blocked"; post-hoc notify.
- `feedback_maintainer_name_redaction.md` — identity
  handling in the `For` column.
