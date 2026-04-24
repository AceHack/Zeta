# Contributor conflicts log

Durable log of differences of opinion / external requirement
between contributors (human maintainers + external AI
maintainers + factory-internal personas + external human
contributors once they arrive). Captures both the conflict
and its resolution over time so future decisions inherit
the resolved state rather than re-litigating it.

Per the human maintainer 2026-04-23: *"we should likely
keep a contribute conflits file somewhere so you can keep
a logs in the differences of options or external requirments
from contributors includeing external ai not just human,
this will help with bottlenecks in the hummans and ais
thinking by resolving conflicts over time. These are all
also things that can be expoed in the eventually, i'll keep
a check now manually just like i do on current memories."*

## What belongs in this log

### In scope

- **Differences of opinion between named contributors** on
  a specific question (architectural decision, scope
  boundary, naming, priority, tech choice, etc.).
- **External requirements** a contributor raises that
  differ from the factory's default posture (e.g., a human
  adopter requires something Zeta doesn't yet do).
- **Cross-agent disagreements** that couldn't be resolved
  at the individual conversation level (examples:
  Amara-vs-Kenji on Aurora priority ordering; Codex-vs-
  Claude on a specific code review finding; a human
  contributor-vs-agent on scope-of-change).

### Out of scope

- **Same-contributor evolution** over time — when Aaron
  later overrides his own earlier directive, that's the
  later-takes-precedence rule (`CURRENT-aaron.md` +
  per-user memory supersede markers). Not a conflict.
- **Reviewer findings on PRs** — those are
  per-PR-review-thread substrate (auto-resolved via
  `required_conversation_resolution: true` + the
  reply-or-fix pattern). Only escalate here if the
  finding opens a durable contributor-level disagreement
  the PR alone can't close.
- **Deep conflicts requiring the architect conference
  protocol** — those belong in
  `docs/CONFLICT-RESOLUTION.md`. This log is for
  differences that are recordable but don't yet need a
  full conference.

## Schema

Each entry is a row in the table below. Columns:

- **ID** — stable identifier (CC-NNN).
- **When** — date the conflict was observed
  (YYYY-MM-DD).
- **Topic** — one-line description of the disagreement.
- **Between** — named contributors (e.g., `Aaron` vs
  `Amara`; `Kenji` vs `Amara`; `Aaron` vs `Codex`;
  `external-human-X` vs `Aaron`).
- **Positions** — each contributor's position in one
  sentence.
- **Resolution-so-far** — current state of resolution
  (open / tentative-side / resolved; with rationale).
- **Scope** — what the resolution covers and what it
  doesn't (to prevent scope-creep in future
  re-litigation).
- **Source** — pointer to the conversation / PR / doc
  where the conflict surfaced.

## Rules

1. **Resolutions are additive.** When a conflict gets
   resolved, the row's `Resolution-so-far` gets updated
   with the new state; prior state stays in-row as
   history (inline markers like *(superseded YYYY-MM-DD
   by ...)*).
2. **Signal-preservation** applies (per
   `memory/feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`).
   Verbatim quotes stay verbatim; paraphrase only in the
   one-sentence position summary.
3. **Attribution discipline** applies (per
   `docs/AGENT-BEST-PRACTICES.md` no-name-attribution
   rule) — contributor names ARE appropriate here because
   this log is explicitly tracking who said what;
   equivalent carve-out to `docs/BACKLOG.md` and
   `memory/persona/`.
4. **Adding rows is free work** (per the 2026-04-23
   scheduling-authority rule); resolving a row requires
   maintainer engagement for contributor-level conflicts.

## Categories

- **architectural-preference** — design / algorithm /
  pattern disagreement.
- **priority-ordering** — which work item matters most;
  cf. the funding-priority rule (Aaron owns external-
  priority stack; Amara + Kenji own free-work).
- **scope-boundary** — where feature X ends vs feature
  Y begins.
- **naming** — term / persona / project-name
  disagreement.
- **tech-choice** — tool / language / framework pick.
- **external-requirement** — an external party's
  constraint that differs from factory default.
- **process** — workflow / cadence / hygiene
  disagreement.
- **other** — if none above fit; expand categories when
  "other" grows past a handful.

## Entries

### Open

| ID | When | Topic | Between | Positions | Resolution-so-far | Scope | Source |
|---|---|---|---|---|---|---|---|

*(No open entries at creation. Agents file rows when a
contributor-level conflict is observed that doesn't close
at the per-PR-review-thread or per-conversation level.
The maintainer checks manually for now per
2026-04-23 directive.)*

### Resolved

| ID | When | Topic | Between | Positions | Resolution-so-far | Scope | Source |
|---|---|---|---|---|---|---|---|
| CC-001 | 2026-04-23 | No-name-attribution rule scope — does it apply to tick-history, MEMORY.md, BACKLOG attribution lines, and similar historical-record surfaces? | `Copilot` (PR reviewer) vs `Aaron` | `Copilot`: flagged direct "Aaron" references in tick-history row on PR #208 as violations of the `docs/AGENT-BEST-PRACTICES.md` no-name-attribution rule. `Aaron`: *"'No name attribution in code, docs, or skills' in history files are files like memory backlog and other things like that for historical purposes"* — history files are EXEMPT because they record who-said-what historical reality. | **Resolved 2026-04-23 in Aaron's favor.** History-file class (tick-history, `memory/**`, BACKLOG attribution lines, hygiene-history, ROUND-HISTORY, research logs) exempt from the rule; forward-looking surfaces (code, skills, governance docs, persona files outside `memory/persona/**`, user-facing docs, module bodies) still bound. Policy clarification BACKLOG row filed (PR #210) for documenting the exemption explicitly in `docs/AGENT-BEST-PRACTICES.md`. | **Scope:** distinguishes historical-record surfaces from forward-looking ones. Does NOT relax the rule for code / skills / governance. Does NOT authorize retroactive `Aaron → human maintainer` sweep of existing historical rows. | Aaron chat Otto-52 + PR #210 `docs/BACKLOG.md` row "Name-attribution policy clarification (history-file exemption)" + Copilot P1 finding on PR #208 |
| CC-002 | 2026-04-23 | Stabilize (operational closure) vs keep-opening new research/BACKLOG rows — where should Otto's next round of effort land? | `Amara` (external AI maintainer, via 4th ferry) vs `Otto` (pre-Otto-67 pattern) | `Amara`: *"The single best strategic fix is to stop using prose as both the storage layer and the control plane... Merge and mechanize the operating model you already have before you let the system grow another layer of meta-structure."* `Otto`: pre-Otto-67 pattern was filing new absorbs + BACKLOG rows + memory captures without corresponding mechanization pass. | **Resolved 2026-04-23 in Amara's favor.** Otto pivoted after Otto-67 absorb (PR #221) to Stabilize-stage items: decision-proxy-evidence schema (PR #222), snapshot-pinning (PR #223), live-state-before-policy rule (PR #224), memory-reference-existence lint (PR #225), memory reconciliation algorithm design (PR #226). 3/3 Stabilize + 3/5 Determinize landed. | **Scope:** covers the specific period Otto-59 → Otto-67 where new-substrate opens outpaced mechanization-of-existing. Does NOT rule out future absorbs or BACKLOG additions — those are legitimate when substrate warrants. Does rule out "keep opening new frames instead of closing on existing ones" as an ongoing posture. | `docs/aurora/2026-04-23-amara-memory-drift-alignment-claude-to-memories-drift.md` (PR #221 absorb — **PR #221 open, not yet on main**; file lands when that PR merges) + Otto-68..74 Amara-roadmap execution PRs (#222/#223/#224/#225/#226) |
| CC-003 | 2026-04-23 | PR citations of paths / PRs / artifacts that don't yet exist at the reviewed commit SHA — is the citation valid? | `Codex` (external PR reviewer) vs `Otto` (initial framing) | `Codex`: flagged on PRs #207, #208 that paths like `docs/craft/subjects/production-dotnet/module.md` cited as "landed" were not present in the reviewed commit's tree — "stop citing absent artifacts as merged sources." `Otto`: initial framing was that cross-PR citations are OK because the cited artifact "will exist once the sibling PR merges." | **Resolved 2026-04-23 in Codex's favor.** Otto's fix commits (29872af on PR #207, 1c7f97d on PR #208) rewrote citations to distinguish *merged-on-main* (citing commit SHA) from *proposed-in-PR-#N-open* (citing PR number + explicit "not yet on main" marker). Pattern now discipline: never cite as "landed" artifacts not in the reviewed commit's tree. | **Scope:** applies to PR descriptions, in-tree docs, BACKLOG rows. Does NOT prohibit cross-PR references — those are fine with explicit PR-pending annotation. Does NOT retroactively require fixing every prior session PR that assumed future state. | Codex P2 findings on PR #207 + PR #208; fix commits referenced above; Aaron `docs/aurora/2026-04-23-amara-decision-proxy-technical-review.md` PR #219 absorb (**PR #219 open, not yet on main**; file lands when that PR merges) reinforces ("live-state-before-policy" rule applies same discipline to settings changes) |

### Stale

| ID | When | Topic | Between | Positions | Resolution-so-far | Scope | Source |
|---|---|---|---|---|---|---|---|

*(Empty at creation. Stale = context died, neither
position is any longer relevant; row kept for history.)*

## Relation to adjacent surfaces

- `docs/HUMAN-BACKLOG.md` — individual-human-decision
  asks (including `conflict` category for user-ask
  conflicts the agent can't resolve). This log is
  complementary: broader contributor-level differences
  that may or may not block agent action.
- `docs/CONFLICT-RESOLUTION.md` — persona-conference
  protocol for specialist-persona disagreements. This
  log records contributor-level differences; persona
  conferences can be the resolution mechanism for
  some rows.
- `CURRENT-<maintainer>.md` (per-user) — per-maintainer
  currently-in-force state. This log is cross-contributor
  (pairs or triples).
- `docs/DECISIONS/` ADRs — formal decision records;
  conflicts resolved by ADR get a pointer from the
  row's `Resolution-so-far` to the ADR.
- `docs/protocols/cross-agent-communication.md` (PR #160)
  — courier protocol for external-AI communication. The
  protocol is how contributors communicate; this log
  is where their differences get tracked.

## Eventual UI exposure

Per the maintainer's 2026-04-23 framing, this log is one of
the things that can eventually be surfaced in the Pages-UI
(per the P2 BACKLOG row filed via PR #172). Initial
implementation is read-only (git-backed, no write flow
needed).

## Growth model

- Additive — entries accumulate over time
- Non-destructive — resolved / stale entries stay
- Bounded expected size — contributor-level conflicts
  should be rare; if the log grows past a few dozen open
  rows, revisit whether the scope is too wide
