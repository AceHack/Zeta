---
name: Peer-harness progression (stepping-stone to future peer-mode); each harness owns its own named loop agent (Otto = Claude Code; Codex picks own); Otto DOES dispatch Codex async work; cross-harness review + questions yes, edits no; 2026-04-23
description: Aaron Otto-79 five-message directive burst refining the Codex-parallel harness-parity framing — corrects prior "Otto doesn't dispatch" error, names peer-harness as aspirational-future-state with stepping stones, authorises cross-harness review/questions (not edits), establishes named-loop-agent-per-harness convention (Otto = Claude Code, Codex picks own). Composes with agent-autonomy-envelope, named-agent-email-ownership, split-attention + composition-not-subsumption endorsements
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-23 Otto-79 five-message directive burst refining
the Codex-parallel first-class-harness framing. Each message
landed a substantive correction or extension.

## Message 1 — Otto DOES dispatch Codex async work (correction)

Verbatim:
*"you do dispatch codex work, i will just switch whenver i
feel like it once it's ready, i'll just go back and fourth
from time to time probably when new models come out, you guys
need to know when one is primary based on the harness im in
and just do the right things so it's not an issue when you
launch in tandem/async with you. I won't launch both of you
at the same unless i say, this is a future test to see if you
can run indenpendenty without interference, but for now one
of your will be the corrdinator at a time based on the
harness i'm in."*

**Corrects** the Otto-78 scope-limit line *"Otto doesn't
dispatch Codex work unilaterally"* (filed in the original
PR #236 body) which was incorrectly restrictive. The correct
framing: the **currently-primary** agent dispatches the
**other's** async work. Primary is determined by Aaron's
current harness-context, not by a configuration flag.

Tandem / simultaneous launch is **out-of-scope today**.
Explicit Aaron opt-in required for a future interference-test.

## Message 2 — cross-harness review + questions encouraged

Verbatim:
*"yall should review each other and ask questions to better
understand eachs others harness form the inside to improve
our cross harness support."*

**Extends** the cross-harness-no-edit rule: no direct edits
to other harness's substrate stands, BUT **cross-harness
review + question-asking is explicitly authorised and
encouraged**. Distinction is edit-not vs read-and-comment-yes
— same shape as peer code review between humans (reviewer
reads + comments + asks; author owns the edit).

## Message 3 — peer-harness is aspirational-future-state

Verbatim:
*"yeah i think we are building to this which is subtly
different from a peer-harness model. this mean i launch you
both at the same time right? that's peer harness. we will
get there slowly with experiments where one is in controll."*

**Names the progression** explicitly:

- **(a) Today** = single coordinator, primary-by-harness-
  context. Aaron is in one harness at a time; that harness's
  loop agent coordinates.
- **(b) Bounded experiment** = short parallel sessions with
  Aaron observing for interference.
- **(c) Peer-harness** = both running concurrently with
  handoff discipline, Aaron can walk away.

Progression via explicit Aaron opt-ins at each stage. Aim at
(c); don't assume (c).

## Message 4 — each harness owns its own named loop agent

Verbatim:
*"yeah i guess in peer mode each harness will need it's own
'Otto' might as well start it out like that so code designs
it's own named loop agent, you got the good name claude otto
:)"*

**Establishes convention**:

- **Otto** = the Claude Code loop agent. Aaron-affirmed as
  *"the good name"*.
- **The Codex CLI session picks its own loop-agent persona
  name** — not inherited from Otto, not pre-assigned by
  Otto.
- Consistent with existing persona-naming pattern (Kenji /
  Amara / Iris / Kai / Naledi / Soraya / Mateo / Aminata /
  Nadia / Nazar / Dejan / Bodhi / Samir / Ilyana / Rune /
  Hiroshi / Imani / Daya / Viktor / Kira / Aarav / Rodney /
  Yara — names chosen in conversation with Aaron, not
  imposed).
- The Codex session's first Stage-1b research doc (under the
  existing first-class-Codex 6-stage arc) is an appropriate
  place for the Codex loop agent to name itself.
- Composes with **named-agent-email-ownership** (Otto-76) —
  each loop agent owns its own reputation + eventually its
  own email.

## Message 5 — BACKLOG-split status check (Aaron's curiosity, no rush)

Verbatim:
*"how close are we to Update(docs/BACKLOG.md) split? just
curious no rush."*

Answer: PR #216 *research: BACKLOG per-swim-lane split design*
is still open as of Otto-79. Design research doc landed; split
execution not yet started. `docs/BACKLOG.md` is ~7369 lines.
Aaron explicitly said "no rush" — filed here as pending
status, not as a rule.

## Rule synthesis — how to apply

- **Primary dispatches async work** for the other harness.
  Determined by Aaron's current harness. Otto-in-Claude-Code
  dispatches Codex-async; Codex-loop-agent-in-Codex
  dispatches Claude-Code-async-work when Aaron switches.
- **Cross-harness review + questions = yes, cross-harness
  edits = no.** Read + comment + ask freely. Don't push
  commits that touch the other harness's own substrate;
  instead, raise findings via PR-review or question for the
  agent that owns that substrate to address.
- **Tandem launch = Aaron-opt-in only.** Do not assume two
  sessions running at once; if Aaron launches both, he says
  so.
- **Codex loop agent's name is Codex's call.** Otto does not
  pre-name or claim naming rights. When the Codex session
  exists and starts, the Codex agent picks its own persona
  name in conversation with Aaron.
- **Peer-harness is the direction, not today's state.**
  Design for it (progression (a) → (b) → (c)), implement
  for it incrementally, don't skip ahead.

## Sibling memories

- `feedback_agent_autonomy_envelope_use_logged_in_accounts_freely_switching_needs_signoff_email_is_exception_agents_own_reputation_2026_04_23.md`
  — Otto-76 autonomy envelope + email carve-out.
- `feedback_split_attention_pattern_plus_composition_not_subsumption_validated_2026_04_23.md`
  — Otto-76 patterns validated at Otto-75 close; this
  memory continues the pattern.
- `project_first_class_codex_cli_session_experience_parallel_to_nsa_harness_roster_portability_by_design_2026_04_23.md`
  — Otto-75 parent concept.
- `project_account_setup_snapshot_codex_servicetitan_playwright_personal_multi_account_p3_backlog_2026_04_23.md`
  — Otto-76 account configuration fact base that the
  progression is built on.

## Landed PRs (Otto-79)

- **PR #238** — drift-taxonomy promotion (Artifact A;
  Amara 5th ferry).
- **PR #236** — Codex-first-class row updated with these
  Otto-79 refinements as continuing amendments.
- **PR #239** — P3 agent-email password-storage design
  row.
