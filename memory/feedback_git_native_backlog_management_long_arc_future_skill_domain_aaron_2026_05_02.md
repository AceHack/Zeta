---
name: Git-native backlog management + long-arc thesis as a future skill domain (Aaron 2026-05-02 forward-looking architectural observation)
description: 2026-05-02; Aaron-named forward-looking emergence: once the project's git-native backlog management discipline + long-arc thesis are "down pat," they should become a whole skill DOMAIN — a few skills + experts working together, not just one skill. Composes with Aarav's same-tick recommendation NOT to split decision-archaeology into 5 skills (BP-20: split on cognitive load, not length). The two principles interlock: don't split prematurely, but DO split when the domain matures. Captures the future-promotion-decision context so when the maturity signal fires (3+ worked examples per skill candidate; empirical judgment-disagreement evidence), the substrate is ready.
type: feedback
---

# Git-native backlog management + long-arc thesis as a future skill domain

## Origin

Aaron 2026-05-02, in the autonomous-loop maintainer channel mid-tick, sent the forward-looking observation:

> *"once we get it down pat our ver specific style of git native backlog managment and log arc theis should likey be it's whole skill domain with a few skills and experts and such"*

(Note: "log arc" parsed as "long arc" — composes with the largest-mechanizable-automatable-backlog-wins meta-thesis + scope-creep-is-feature + amortized-speed-Superfluid-phase-transition target.)

This message landed in the same tick that Aaron's STRONG-rule corrective ("invoke specialist whenever editing in their domain") was being applied via skill-expert (Aarav) review of 081KQJZR90008QG0R002D6XYHB (decision-archaeology). Aarav's review concluded decision-archaeology should be ONE skill with five named investigation modes, NOT five separate skills (per BP-20: split on cognitive load, not length).

Aaron's observation **composes with Aarav's recommendation**:

- **Now (decision-archaeology, single skill):** don't shatter the procedure into sub-skills; the cognitive load fits one body.
- **Later (whole domain):** when the git-native-backlog-management + long-arc thesis discipline matures, it becomes a domain — multiple skills + experts working together, not just one skill.

The two principles aren't in conflict. **Don't split prematurely, but DO split when the domain matures.** Decision-archaeology fits inside the future domain as one of its skills.

## What the future domain might contain (sketched, NOT committed)

The domain would have three classes of substrate:

### Procedure skills (action-shaped)

| Skill candidate | What it does | Status today |
|---|---|---|
| `decision-archaeology` | Reconstructs "why is it like this?" via layered evidence (081KQJZR90008QG0R002D6XYHB) | In flight; PR #1244 merged the row; SKILL.md authoring deferred to skill-creator after worked examples land |
| `backlog-row-creator-with-prereq-search` | Mechanizes at-creation-time discipline: search backlog for prerequisites, populate `depends_on:` at file-time | Substrate exists as memo (`feedback_depends_on_backlog_search_discipline_at_creation_and_at_pickup_*`); not yet skill-routed |
| `backlog-row-picker-with-prereq-search` | Mechanizes at-pickup-time discipline: when work feels like missing substrate, search backlog for the prereq | Same memo; not yet skill-routed |
| `depends_on-relationship-analyst` | Per-row analysis filling `depends_on:` with real prerequisites (not the empty `[]` schema-completion default) | The hard-work job that PR #1246 explicitly didn't do; ongoing per natural-trigger |
| `backlog-flywheel-mechanizer` | Runs the expand-from-closure analysis at PR-merge-time; produces N≥0 candidate-rows per closure context | Proposed in `feedback_skill_flywheel_expansion_flywheel_parallel_tracks_substrate_*`; `tools/backlog/expand-from-closure.ts` not yet built |
| `parallel-tracks-dispatcher` | Picks N rows from the backlog respecting `depends_on:`, dispatches each to a worktree-isolated subagent, gates merge order on the graph | Substrate (worktree isolation, Task subagent, depends_on graph) exists; orchestrator unbuilt; Aaron 2026-05-02 sequenced this AFTER 100% depends_on coverage |

### Judgment experts (named-persona-shaped)

| Expert candidate | What they decide | Currently owned by |
|---|---|---|
| **Backlog architect** | Priority shifts (P0↔P1 promotions/demotions); scope splits; row consolidation; row retirement | Currently part of the `architect` (Kenji) hat |
| **Long-arc strategist** | Judges which backlog rows feed the long-arc thesis vs. which are short-arc detours; resists premature optimization for short-arc velocity | Currently part of the `architect` hat + Aaron's direct judgment |
| **Relationship-analyst** | Per-row `depends_on:` filling judgment; surfaces missing-prereq rows that should be filed | Done ad-hoc by Otto today; the at-pickup discipline mechanizes part of this |
| **Closure-archaeologist** | Validates that closed rows' closure markers actually answer the original question (Aaron 2026-04-28: "bulk-resolve … does it actually answer the questions?") | Otto + Aaron via review; not formalized as a persona yet |

### Tooling skill-routed access

| Tool | Purpose | Status |
|---|---|---|
| `tools/backlog/generate-index.sh` | Regenerates `docs/BACKLOG.md` from per-row files | Shipped |
| `tools/backlog/new-row.sh` | Scaffolds a new row file (auto-assigns NNNN, pre-fills frontmatter) | Phase 1b; planned, not yet shipped |
| `tools/backlog/backfill-depends-on.sh` | One-shot schema completion (used in PR #1246 from `/tmp/`; should harden) | One-shot used; should be moved into `tools/backlog/` and made re-runnable |
| `tools/backlog/expand-from-closure.ts` | PR-merge-time hook: scan closure context, emit candidate-rows for review | Proposed; not built |
| `tools/backlog/dispatch.ts` | Picks N independent rows + dispatches via Task subagents | Proposed; not built |

## Promotion-trigger criteria (the "down pat" signal)

Aaron's "once we get it down pat" framing implies a maturity signal. Aarav's BP-14 (every skill has a dry-run eval set) gives the criterion shape:

**For each skill candidate above, the promotion-from-memo-to-skill trigger fires when:**

1. **3+ worked examples** demonstrate the procedure works in different contexts (BP-14)
2. **Empirical evidence the procedure is being followed** (or actively missed and missed-with-cost), not just named in a memo
3. **The factory has hit the case that benefits** at least once with the memo + once without it, so the value is empirically measurable

**For each expert (named-persona) candidate above, the promotion-from-architect-overload trigger fires when:**

1. The judgment surface has produced **at least one decision-disagreement** that would have benefited from a specialist (e.g., two reasonable ticks differed on the long-arc-vs-short-arc call)
2. The architect is observably overloaded (single hat carrying too many distinct judgment classes)
3. There's a notebook of decisions that would compose into a persona's accumulated disposition

Until these triggers fire, the discipline lives in memos + Bash scripts + the architect hat. **Premature promotion fragments the router (Aarav's portability-drift criterion #7) without delivering proportional value.**

## What this memo PRESERVES so the future-promotion decision has substrate

When the maturity signal fires (some N future ticks, possibly months out):

1. **The skill candidates listed above are the canonical starting set.** Don't re-enumerate from scratch.
2. **The expert candidates listed above are the canonical starting set.** Backlog-architect + long-arc-strategist + relationship-analyst + closure-archaeologist as the per-judgment-surface specialization split. Architect (Kenji) keeps the integration hat.
3. **The promotion-trigger criteria above are the gate.** Don't promote without 3+ worked examples per skill or 1+ judgment-disagreement per expert.
4. **The composition with decision-archaeology is one-skill-per-investigation-class** (Aarav's BP-20 finding); the domain doesn't need to re-litigate that.
5. **The relationship to existing skills** (`data-lineage-expert`, `claude-md-steward`, `skill-creator`, `skill-tune-up`, `naming-expert`) was already mapped in Aarav's review of 081KQJZR90008QG0R002D6XYHB; consult that before authoring new skill bodies.

## Composes with

- `memory/feedback_depends_on_backlog_search_discipline_at_creation_and_at_pickup_aaron_2026_05_02.md` — the discipline is the substrate that becomes the skill bodies for `backlog-row-creator-with-prereq-search` + `backlog-row-picker-with-prereq-search`
- `memory/feedback_skill_flywheel_expansion_flywheel_parallel_tracks_substrate_aaron_2026_05_02.md` — the expansion-flywheel + parallel-tracks substrate is what `backlog-flywheel-mechanizer` + `parallel-tracks-dispatcher` mechanize
- `memory/feedback_largest_mechanizable_automatable_backlog_wins_in_AI_age_inverts_classical_PM_training_prior_aaron_2026_05_02.md` — the meta-thesis the long-arc strategist's judgment surface is anchored to
- `memory/feedback_amortized_speed_superfluid_phase_transition_inverts_per_action_optimization_aaron_2026_05_02.md` — the system-level optimization target the long-arc strategist optimizes for
- `docs/backlog/P1/081KQJZR90008QG0R002D6XYHB-decision-archaeology-skill-aaron-2026-05-02.md` — the row that triggered the just-tick skill-expert review whose findings compose into this memo
- `docs/VISION.md` — terminal purpose; long-arc thesis lives in service of the intellectual-backup-of-earth scope
- Aarav's review on PR #1244 (recorded in chat substrate; should be preserved per BP-09 ASCII rule when the SKILL.md eventually lands)

## Carved sentence

**"Git-native backlog management + long-arc thesis is a future skill domain — a few skills + experts working together — not a single skill. Don't split prematurely, but DO split when the discipline is down pat. Decision-archaeology lives inside the future domain as one of its skills (per BP-20 cognitive-packaging). The promotion trigger is 3+ worked examples per skill candidate + 1+ empirical judgment-disagreement per expert candidate. The substrate listed in this memo is the canonical starting set when the trigger fires; don't re-enumerate from scratch."**
