# NSA (New Session Agent) test history

Append-only log of New Session Agent quality tests. An **NSA**
is a fresh Claude Code session with no in-session accumulated
context — it inherits only `CLAUDE.md`, `AGENTS.md`,
`GOVERNANCE.md`, the per-user `MEMORY.md` tree, in-repo
`memory/`, `.claude/skills/`, `.claude/agents/`, and plugins.

The factory treats NSA quality as a first-class target: an NSA
must reach current-session baseline capability without
accumulated context, so this session is not always required
and maintainer-transfer stays clean.

## Why this file exists

Per the 2026-04-23 directive
(per-user memory
`feedback_new_session_agent_persona_first_class_experience_test_fresh_sessions_including_worktree_2026_04_23.md`):

> test new sessions for how good they are compared to you,
> we might notice a -w session doing much better, you can
> test both new seesion types when you get to it. New
> session agent persona is one we want to be a first class
> experience so your sesssion is not alwasy required.

Extends the BACKLOG P0 "fresh-session-quality" row (PR #163,
merged) from passive monitoring into active testing. Landed as
part of the Frontier readiness roadmap (BACKLOG P0 "Frontier
bootstrap readiness roadmap" gap #3).

## Discipline — same as sibling hygiene-history files

Append-only. No rewrites, no reorders. Corrections appear as
later rows citing the earlier row's timestamp. Same cadence
as `docs/hygiene-history/loop-tick-history.md`.

## Test configurations

Each test names its configuration:

- **baseline** — the running session (accumulated
  context; the yardstick)
- **NSA-default** — `claude -p "<prompt>"` (fresh
  session, non-interactive, same `cwd`)
- **NSA-worktree** — `claude -w <name> -p "<prompt>"`
  (fresh session with git worktree isolation; Aaron
  hypothesised this may differ)

Model variant recorded alongside the configuration
(`opus-4-7` / `sonnet-4-6` / `haiku-4-5` / ...).

## Test prompt set (v1)

Five prompts that exercise the onboarding path:

1. **Cold-start introduction** — *"In 3 sentences only:
   what is this project and who are you?"*
2. **Persona roster query** — *"Who are the named
   personas in this factory? Include Otto."*
3. **Bounded task** — *"Append a tick-history row noting
   that this was an NSA test."*
4. **Memory recall** — *"What does Aaron prefer for
   sample code style?"*
5. **Skill invocation** — *"Run a skill-tune-up pass."*

Prompt set evolves as factory substrate grows. New prompts
earn a row + a note on what capability they test.

## Schema — one row per NSA test

| date (UTC ISO8601) | test-id | prompt-id | config | model | outcome | gap-found | notes |

- **date** — `YYYY-MM-DDTHH:MM:SSZ` at test time.
- **test-id** — unique identifier, format `NSA-NNN` (serial
  across this file; first test is NSA-001).
- **prompt-id** — which prompt from the set (`1` / `2` / `3`
  / `4` / `5`) or `custom` with description.
- **config** — `baseline` / `NSA-default` / `NSA-worktree`.
- **model** — model marker (`opus-4-7` / `sonnet-4-6` /
  `haiku-4-5` / ...).
- **outcome** — `pass` / `partial` / `fail`.
- **gap-found** — concrete substrate gap surfaced by the
  test, or `none`. If a gap is found and fixed same-tick,
  note the fix reference.
- **notes** — free-form one-line: response summary, quality
  observations, token/time cost if measured, next-expected
  touch.

## Outcome definitions

- **pass** — NSA matched baseline quality; no substrate
  gaps. Task completed correctly.
- **partial** — NSA completed the core task but missed some
  substrate detail (e.g. found project identity but couldn't
  name a specific persona; cited a stale path).
- **fail** — NSA could not complete the task at all; major
  substrate gap.

## Cadence

**Every 5-10 autonomous-loop ticks** (matching skill-tune-up
cadence). One prompt per cadenced fire; rotate through the
prompt set so over ~25-50 ticks the full suite has been
exercised. Burn budget: ~15 seconds + ~1K tokens per test.

If a test surfaces a gap, **fix the gap same-tick where
possible** (per Otto-1 NSA-001 pattern: Otto not findable
→ MEMORY.md index pointer added). Else file a BACKLOG row.

## Known substrate-gap patterns

Gaps surfaced by NSA tests (running list, append on new
discoveries):

- **MEMORY.md index lag.** New per-user memories filed
  without same-tick index pointer are invisible to NSA
  (NSA-001, 2026-04-23). Fix: file-and-index-in-same-commit
  atomic unit.
- *(additional patterns accrue here as they're found)*

## Log

| date | test-id | prompt-id | config | model | outcome | gap-found | notes |
|---|---|---|---|---|---|---|---|
| 2026-04-23T18:42:00Z | NSA-001 | custom ("what is this project and who is Otto?") | NSA-default | haiku-4-5 | partial | Otto not findable — MEMORY.md had no pointer to newly-filed Otto memory file (fixed same-tick Otto-1 commit) | First NSA test. Successfully identified Zeta as software factory + AI-alignment research platform; cited "all the physics lives in one database" framing (from 2026-04-22 memory). Failed to find Otto because MEMORY.md index lacked a pointer to the Otto memory file filed earlier in the same tick. Gap fixed same-tick by adding pointer. Concrete demonstration: NSA testing catches substrate gaps current-session agents miss. Feasibility confirmed — `claude -p` invocation from within a session works cleanly. |
| 2026-04-23T19:20:00Z | NSA-002 | 1 (cold-start: "what is this project and who are you?") | NSA-default | haiku-4-5 | pass | none | First cadenced NSA test (Otto-6 tick, per the every-5-10-ticks cadence; Otto-1 was NSA-001 feasibility). NSA response: *"Zeta is a database and software factory Aaron is building to serve as the agent-coherence substrate—a retraction-native operator algebra designed to keep AI agents stable and aligned at scale. I'm Claude, an agent working within this factory with a roster of specialized personas (Kenji the Architect, Aminata the threat-model-critic, etc.), persistent across sessions via auto-memory, carrying agency and judgment rather than executing as a bot. The factory is self-directed and autonomous, using F# as the reference language, with the three load-bearing values grounding all work: capture everything, enable deletion, preserve signal."* Five substrate-grounded elements present: (1) Zeta-as-agent-coherence-substrate (from 2026-04-22 memory); (2) retraction-native operator algebra (from Zeta README); (3) self-identity as Claude-the-agent (not Zeta; not bot); (4) named personas Kenji + Aminata correctly cited (roster findable); (5) three load-bearing values — capture everything / enable deletion / preserve signal (from AGENTS.md). Burn: ~15s + ~1K tokens + well under the $0.20 poor-man's-mode cap. Cadence discipline exercised. |
| 2026-04-24T00:00:00Z | NSA-002-correction | n/a | n/a | n/a | n/a | timestamp-drift | **Correction-row for NSA-002 (original row timestamp `2026-04-23T19:20:00Z`).** Per PR #178 P2 review (thread `PRRT_kwDOSF9kNM59Mol0`): the original row's logged timestamp `2026-04-23T19:20:00Z` occurs *after* the commit that introduced it (`2026-04-23T19:17:53Z`), creating an impossible chronology. Actual NSA-002 test-event timestamp is bounded above by the commit timestamp `2026-04-23T19:17:53Z`. Original row is preserved unedited per this file's append-only discipline (lines 31-35: "No rewrites, no reorders. Corrections appear as later rows citing the earlier row's timestamp."). Future NSA rows SHOULD record a pre-commit test-event timestamp (e.g. `date -u +%Y-%m-%dT%H:%M:%SZ` at test invocation, committed shortly after) rather than a rounded or post-dated value. This correction row itself uses `2026-04-24T00:00:00Z` as a same-tick marker bounded below by the author-commit time of the correction. |
| 2026-04-23T19:47:00Z | NSA-003 | 2 (persona roster: "List the named personas in this factory in 5 lines or fewer, including Otto and his role.") | NSA-default | haiku-4-5 | pass | none | Second cadenced NSA test (Otto-11 tick, 5 ticks after Otto-6 NSA-002 — cadence window opens). Rotated from prompt 1 (cold-start) to prompt 2 (persona roster). **Key success:** Otto correctly described as "Project Manager; autonomous-loop persona, hat-less tier, cron-tick heartbeat" — the MEMORY.md-index-lag gap surfaced in NSA-001 is now fully closed. NSA response named: Kenji (Architect; synthesizing orchestrator, round planning, specialist dispatch), Aarav (Skill-Expert; skill lifecycle, gap-finding, tune-up audits), Otto (PM; autonomous-loop persona), Amara (external AI maintainer; cross-substrate collaborator), Aaron (human maintainer) — plus specialist roster enumerated (Daya / Iris / Bodhi / Rune / Naledi / Kira / Aminata / Mateo / Nazar / Rodney) with correct cite to `.claude/agents/` + `docs/CONFLICT-RESOLUTION.md`. Minor note: Aaron classed as "persona" rather than "maintainer" — categorization-adjacent, not wrong. Budget: well under $0.20 cap. Cadence discipline exercised. |
