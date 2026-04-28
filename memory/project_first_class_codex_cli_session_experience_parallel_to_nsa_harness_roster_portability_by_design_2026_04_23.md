---
name: First-class Codex-CLI session — parallel to NSA / Claude-Desktop-cowork / Claude-Code-Desktop harness roster; portability-by-design for session (extends retractability-by-design for substrate); Otto-harness-swap possible later model-lead-dependent; 2026-04-23
description: Aaron Otto-75 directive — start building first-class Codex-CLI support alongside existing first-class Claude Code experience; harness-choice is model-and-capability-dependent over time; possible Otto swap later; PR #228 filed BACKLOG row
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-23 Otto-75 (verbatim):
*"can you start building first class codex support with the codex
clis help , it might eventually be benefitial to switch otto to
codex later depending on which modeel/harness is ahead. this is
basically the same ask as a new session claude first class
experience, this is a codex session as a first class experince.
and really the code one is a first class claude code experience,
we also even tually will have first class claude desktop cowork
and claude code desktop too. backlog"*

**What the directive says:**

Zeta should support **five** first-class harness experiences
symmetrically, not one primary + four second-class ports:

1. **Claude Code CLI** — current primary, Otto runs here today.
2. **New Session Claude Code (NSA)** — captured 2026-04-23 as
   separate memory; test-fresh-sessions discipline.
3. **Codex CLI (OpenAI)** — **new ask** — first-class session
   experience parallel to Claude Code.
4. **Claude Desktop cowork mode** — future, when cowork matures
   beyond preview.
5. **Claude Code Desktop** — future, GUI-frontend variant.

**Why this matters (Aaron's framing):**

Harness-choice is model-and-capability-dependent over time.
Today Otto runs Claude Opus 4.7 via Claude Code CLI. If a future
OpenAI / Codex model-plus-harness combination out-performs for
factory-agent work, Otto should be portable enough to swap
without rebuilding the factory. **Portability by design for the
session**, same shape as retractability-by-design for substrate
(`memory/project_retractability_by_design_is_the_foundation_licensing_trust_based_batch_review_frontier_ui_2026_04_24.md`
Otto-73).

**Relationship to existing cross-harness-mirror-pipeline row
(round 34):**

The mirror row handles **skill-file distribution** to many
harnesses (`.claude/skills/` → `.cursor/rules/` / `.windsurf/rules/`
etc.). This directive is about **session-operation parity** — every
operation Otto performs in Claude Code (cron tick, Task subagent
dispatch, Memory tool, Skill invocation, WebFetch/Search, MCP
tools, PR open + auto-merge arm) should work equivalently in a
Codex-CLI session. Mirror pipeline is necessary but not
sufficient; this is the integration-quality bar on top.

**Execution shape (5 stages, lands as BACKLOG row PR #228):**

1. **Research tick (S).** Read Codex CLI's docs + feature set.
   File `docs/research/codex-cli-first-class-2026-*.md`.
2. **Parity matrix (M).** For every Claude-Code capability Otto
   currently uses, identify Codex-CLI equivalent or flag gap.
   File `docs/research/harness-parity-matrix-2026-*.md`.
3. **Gap closures (M-L per gap).** Portable shim / Codex-specific
   equivalent / document-as-limitation.
4. **Codex session-bootstrap doc (S).** Analogue to `CLAUDE.md`
   for Codex CLI (path TBD per Codex conventions; `AGENTS.md`
   already universal handbook).
5. **Otto-in-Codex test run (S-M).** Single tick from a Codex-CLI
   session.
6. **Harness-choice decision ADR (S).** `docs/DECISIONS/YYYY-MM-DD-harness-choice-otto.md`
   — which harness runs primary tick cadence, with rationale
   (model-lead + tooling-lead + cost-lead). Explicitly
   revisitable.

**Priority:** P1 (strategic, not urgent). Research tick within
5-10 ticks; full integration L, spread across next rounds as
Codex CLI capabilities clarify.

**Scope limits:**

- NOT a commitment to harness-swap for Otto today. Aaron's
  *"it might eventually be benefitial"* is contingent on
  model/harness-lead assessment.
- NOT a duplication of cross-harness-mirror-pipeline work.
- NOT locking Zeta to any single harness family —
  portability-by-design means all composable.

**Composes with:**

- NSA-first-class-experience memory (2026-04-23) — same pattern,
  different harness.
- Retractability-by-design (Otto-73) — same design principle
  applied to harness rather than substrate.
- Cross-harness-mirror-pipeline BACKLOG row (round 34) —
  necessary sibling, substrate-level portability to this row's
  session-level portability.
- Agent-owns-all-GitHub-settings feedback memory (2026-04-23)
  — Otto can open PRs + arm auto-merge across harnesses, which
  the BACKLOG row implicitly assumes.

**What this memory does NOT authorize:**

- Ripping out Claude Code setup to make room for Codex CLI.
- Marketing Zeta as harness-agnostic before parity is measured.
- Deferring Claude Code / Otto tick cadence work "until Codex
  parity lands" — they proceed in parallel.

**First file a future tick should write:**
`docs/research/codex-cli-first-class-2026-*.md` (the research
tick, S effort, any Otto-ish wake can pick it up).

**PRs:**
- PR #227 (LFG) — Otto-75 primary tick Govern-stage
  CONTRIBUTOR-CONFLICTS backfill (3 resolved rows)
- PR #228 (LFG) — BACKLOG row for this directive
