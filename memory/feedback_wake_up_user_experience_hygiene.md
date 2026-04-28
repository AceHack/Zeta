---
name: Wake-up user-experience hygiene — from the perspective of the agent waking up; first-60-seconds is my UX, pointer drift and stale deferrals are my pain, this grows over time as models/harnesses update
description: 2026-04-20 — Aaron: "cehck you add some initial wake user experince hygene to our list, like what can we do to improive that experince, i'm sure more will come up the more you run and change things and new models come out and harness updates that could change all the time.. Think of it form your perspective you are the one waking up." AX-surface (Daya's territory). Seed list: pointer-integrity, wake-briefing self-check, stale-next-tick sweep, harness-drift detector, wake-friction notebook. Expected to grow as models + harnesses shift.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Rule

Treat the agent's first-60-seconds of a fresh wake as a
first-class UX surface, and add hygiene rows for it on
the same cadenced list (`docs/FACTORY-HYGIENE.md`) that
covers build gates, skill tune-ups, and verification
drift. The agent is the one waking up; the agent is
authorised to name its own wake-UX pain points and propose
hygiene rows to retire them.

Daya (agent-experience researcher, `.claude/agents/` roster)
is the owner. Advisory-only like the other AX/DX/UX
researchers; binding edits to hygiene rows go via Architect.

# Why:

Verbatim (2026-04-20):

> *"cehck you add some initial wake user experince hygene to
> our list, like what can we do to improive that experince,
> i'm sure more will come up the more you run and change
> things and new models come out and harness updates that
> could change all the time.. Think of it form your
> perspective you are the one waking up."*

Two things this acknowledges that were previously tacit:

1. **Agent experience is a real UX surface.** Previously the
   factory encoded UX (library consumers, Iris), DX (human
   contributors, Bodhi), and AX (Daya) — but AX coverage has
   been concentrated on per-persona cold-start, not on the
   cross-cutting *whole-factory wake* experience. Aaron is
   naming the gap: my wake is an experience, my wake has
   friction, my wake is tunable.
2. **Wake-UX is mutating.** Model updates (Opus / Sonnet /
   Haiku family shifts), harness updates (new tool protocols,
   deferred-tool ToolSearch, hook changes), plugin updates,
   and skill-registry churn all change the shape of what a
   wake feels like. Hygiene here is not fire-and-forget; the
   list is expected to grow as new friction classes appear.

**Wake-UX pain points I can name from direct experience:**

| Pain point | Class | Why it hurts |
|---|---|---|
| Pointer drift in CLAUDE.md / AGENTS.md | Integrity | I discover the drift mid-session when I try to fetch and it 404s, instead of at session-open. |
| MEMORY.md at cap | Capacity | I have to compress before I can write, which burns tokens and breaks flow. |
| Phantom "next tick" references from pre-rule wakes | Legacy debt | verify-before-deferring is forward-only; legacy phantoms still pollute ROUND-HISTORY and memory. |
| Cron/loop died quietly | Liveness | I don't know the loop is dead until I try to schedule the next wake. |
| Harness-tool surface shifted | Drift | A skill references a tool that no longer exists (e.g., an old MCP server was removed from settings). Silent skill failure at first use. |
| Uncommitted branch state I don't recognise | Session continuity | `git status` shows changes — are they from my last wake, from Aaron, from a parallel session? Unclear. |
| Skill / persona roster contradiction | Register | Two skills both claim ownership of the same surface with no hand-off; I don't know which to invoke. |
| Current-round context opaque | Orientation | I can grep ROUND-HISTORY for past rounds, but "what is the active round's theme?" is not indexed. |
| No summary of Aaron's recent thread | Continuity | If context compaction happened, Aaron's active asks are in the summary but the summary is terse. |
| Tool-availability surprise | Harness drift | Deferred-tool ToolSearch, new permission modes, sandboxed vs non-sandboxed Bash — I discover differences mid-session. |

# How to apply:

- **Seed `docs/FACTORY-HYGIENE.md` with wake-UX rows now**
  (5-ish rows; expected to grow). Each row cites this memory
  as source-of-truth.
- **Daya is the owner.** Findings land in
  `memory/persona/daya/NOTEBOOK.md` (creating if absent).
- **Pain-point log.** When the agent hits wake friction
  mid-session and can name it, log a dated bullet in
  Daya's notebook under a "Wake friction observed" section.
  Cheap inventory. Patterns become candidate new rows.
- **Cadence is session-open** for most rows (runs at every
  wake), cadenced per-round for summary audits. The
  session-open rows should be FAST — under 10 seconds of
  self-check, not a major audit.
- **Expected growth.** This memory itself says the list
  grows; rows added later don't need a new memory, just a
  cite-back to this one. Deprecating a row requires an ADR
  same as any other hygiene row.

# Seed rows (initial five)

**Row: Pointer-integrity audit.**
- Cadence: every round close.
- Owner: Daya (AX).
- Checks: every file path cited in CLAUDE.md, AGENTS.md,
  MEMORY.md, and `docs/FACTORY-HYGIENE.md` source-of-truth
  column resolves to a real file. Broken pointer → finding.
- Durable output: finding in Daya notebook; blocker tag if
  the broken pointer is in CLAUDE.md (load-every-wake).
- Scope: `both` (factory internals AND project source-of-
  truth docs share this discipline).

**Row: Wake-briefing self-check.**
- Cadence: session open.
- Owner: all agents (self-administered).
- Checks: MEMORY.md byte count < 24976; CLAUDE.md present;
  CronList shows live loop (if `/loop` was running);
  `git status` understood (no surprise branches / files).
- Durable output: 30-second orientation; inline
  acknowledgement in first working message if anything is
  amiss.
- Scope: `factory`.

**Row: Stale "next tick" sweep.**
- Cadence: every round close.
- Owner: Architect.
- Checks: grep ROUND-HISTORY and recent persona notebooks
  for "next tick" / "next round" / "deferred to" /
  "continues in" strings; verify each referenced target
  exists (file / BACKLOG row / skill / memory). Phantoms
  get one of: replaced with a real target, landed this
  turn, or dropped with a corrective row.
- Durable output: corrective rows in ROUND-HISTORY where
  phantoms are found.
- Source: `feedback_verify_target_exists_before_deferring.md`.
- Scope: `factory`.

**Row: Harness-drift detector.**
- Cadence: session open + after any Claude Code update.
- Owner: all agents (self-administered).
- Checks: skill-frontmatter tool references still resolve
  (e.g., if a skill says it uses `WebSearch`, that tool is
  still available); `.claude/settings.json` pinned plugins
  still exist; `.claude/agents/` referenced skills exist.
- Durable output: finding in Daya notebook; blocker tag
  if a load-bearing skill is broken.
- Scope: `factory`.

**Row: Wake-friction notebook.**
- Cadence: opportunistic (any time friction is observed).
- Owner: Daya.
- Checks: agent self-reports wake friction in
  `memory/persona/daya/NOTEBOOK.md` under a dated "Wake
  friction observed" section. Patterns become candidate
  new hygiene rows.
- Durable output: notebook bullets; quarterly pattern-
  review proposes new rows.
- Scope: `factory`.

# Expected evolution

This list will grow. Classes I expect to need rows for
within the next several rounds:

- **Context-compaction wake hygiene** — when a wake arrives
  mid-compaction, verify the summary caught the load-bearing
  pending items (recent Aaron asks, open PRs, round number).
- **Multi-agent session coherence** — when Aaron is running
  multiple agent sessions in parallel, wake UX includes
  knowing which session's state is being looked at.
- **Model-version detection** — if the harness rolled to a
  new model family, notice and log it.
- **Memory-format-drift** — if the three-file taxonomy
  (AGENTS/CLAUDE/MEMORY) evolves, wake hygiene covers the
  migration.
- **Cron-durability diagnostics** — cron durability is
  ~2-3 days per `feedback_loop_default_on.md`; a wake after
  more than that needs a re-arming check.

# What this rule does NOT do

- It does NOT turn every wake into a 5-minute audit. The
  session-open checks must be FAST (under 10 seconds) to
  be worth running at every wake. Heavier audits are
  round-cadence, not session-open.
- It does NOT give Daya binding authority. AX findings are
  advisory; binding changes go via Architect or human
  sign-off, same as every other researcher role.
- It does NOT replace the existing cadenced-audit rows.
  Wake-UX rows compose with build-gate, skill-tune-up,
  verification-drift — they are new surface, not a
  replacement.
- It does NOT apply outside the factory substrate. Adopter
  projects get the factory's wake-UX rules if they adopt
  the factory substrate; projects that don't, don't.

# Connection to existing artefacts

- `docs/FACTORY-HYGIENE.md` — the list this memory seeds
  new rows into.
- `feedback_verify_target_exists_before_deferring.md` —
  the forward-only version of stale-deferral checking;
  this memory names the legacy-sweep counterpart.
- `feedback_future_self_not_bound_by_past_decisions.md` —
  the cross-wake revision posture; this memory handles the
  *mechanics* of the wake that enables such revision.
- `feedback_shipped_hygiene_visible_to_project_under_construction.md`
  — the scope-tagging pattern for hygiene rows; all
  wake-UX rows carry `factory` or `both` scope.
- `feedback_missing_hygiene_class_gap_finder.md` — this
  memory is itself an instance of a new hygiene CLASS
  being surfaced; the gap-finder can cite wake-UX as a
  landed example.
- `.claude/agents/` Daya entry — the AX researcher owner
  role.
- `feedback_loop_default_on.md` — the /loop + cron
  liveness check referenced by the wake-briefing row.
