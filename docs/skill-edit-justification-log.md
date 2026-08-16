# Skill-edit justification log

Log of manual edits to `.claude/skills/*/SKILL.md` files
that skipped the full `skill-creator` eval-loop workflow.
Required by
`memory/feedback_skill_edits_justification_log_and_tune_up_cadence.md`
Rule 1 for edits in the mechanical-edit row of the
`skill-tune-up` gate table — mechanical rename, broken-link
repair, BP-NN citation refresh, ASCII-lint cleanup, typo
fix, content extraction preserving protocol verbatim.

Edits that change triggering behaviour, output shape, or
instruction-following belong in the eval-loop path and do
NOT appear here — they land with a `benchmark.json` pass-
rate delta in the round-close ledger instead.

Newest-first per Zeta convention (`AGENTS.md §2`).

## Log

### 2026-04-20 — `round-management/SKILL.md` + `holistic-view/SKILL.md` — GOVERNANCE.md §11 citation refresh (debt-intentionality rewrite)

- **Skill:** `.claude/skills/workflows/blueprints/round-management.md`,
  `.claude/skills/governance/blueprints/holistic-view.md`
- **Round:** 43
- **Edit type:** BP-NN citation refresh (mechanical) — the
  cited rule GOVERNANCE.md §11 was rewritten this round
  from "architect reviews all agent-written code; nobody
  reviews the architect" to the debt-intentionality
  invariant per ADR `docs/DECISIONS/2026-04-20-intentional-
  debt-over-architect-gate.md`. The skills' citations
  needed to match the new §11 text to avoid contradicting
  governance.
- **Line delta:** round-management/SKILL.md — unchanged
  (one-line citation refresh); holistic-view/SKILL.md —
  unchanged (two-line citation refresh: frontmatter
  description + one body line).
- **Trigger:** ADR landing in round 43 renaming the §11
  invariant. Grep across `.claude/` surfaced two skill
  files + one persona file (`.claude/agents/architect.md`;
  non-skill, not logged here) with stale citations.
- **Why mechanical, not eval-loop:** Pure BP-NN citation
  refresh. Triggering behaviour unchanged — the skills
  still fire on the same conditions. Output shape
  unchanged — the skills still produce the same kinds
  of findings. Instruction-following unchanged — the
  skill body's operational content is preserved
  verbatim except for the wording of the governance
  cross-reference, which is the only thing that had to
  change.
- **Files touched:**
  - `.claude/skills/workflows/blueprints/round-management.md` — one
    line edit (§"What this skill does NOT do" bullet
    3): "Review gate per §11" → "Round-close synthesis
    per §11 (debt-intentionality invariant)".
  - `.claude/skills/governance/blueprints/holistic-view.md` — two
    edits: frontmatter `description` now names
    "synthesises at round-close per §11 (debt-
    intentionality invariant)" instead of "owns
    binding integration per §11"; body §"What
    wearing this hat does NOT grant" bullet 1 now
    explains the debt-ledger model instead of "nobody
    reviews the architect but the architect reviews
    everyone else".
- **Hand-off:** Aarav's portability/BP-drift audits on
  these two skills next invocation should see clean
  §11 citations. No follow-up work.
- **Related round-43 artifacts:**
  - `docs/DECISIONS/2026-04-20-intentional-debt-over-
    architect-gate.md` — the ADR
  - `docs/INTENTIONAL-DEBT.md` — the new ledger
  - GOVERNANCE.md §11 — the rewritten rule itself

### 2026-04-20 — `skill-tune-up/SKILL.md` — BP-03 self-breach cleanup via content extraction

- **Skill:** `.claude/skills/skill-lifecycle/blueprints/skill-tune-up.md`
- **Round:** 42/43 boundary
- **Edit type:** Content extraction (mechanical)
- **Line delta:** 436 → 282 (54 lines under the 300-line
  BP-03 cap; 154 lines extracted verbatim, 18 lines of
  pointer text added back)
- **Trigger:** Aarav round-42 ranking escalated self to
  P1 #4 after commit `baa423e` retune grew the file 303
  → 436 lines (1.45x BP-03 cap). Filed as P2 BACKLOG
  entry this same round.
- **Why mechanical, not eval-loop:** The extracted
  content (§"The eval-loop hand-off protocol" plus the
  Notebook format + Output format template blocks) is
  preserved verbatim. No change to triggering, output
  shape, or instruction-following — the ranker that
  reads the new SKILL.md + reference file produces the
  same ranking-round output as the ranker that read the
  pre-extract SKILL.md. Ranking behaviour is unchanged;
  only the progressive-disclosure shape is fixed.
- **Files touched:**
  - `.claude/skills/skill-lifecycle/blueprints/skill-tune-up.md` — replace
    inline §"The eval-loop hand-off protocol" (~130
    lines) with a 20-line pointer; replace inline
    template blocks (~55 lines) with a 6-line pointer.
  - `docs/references/skill-tune-up-eval-loop.md` —
    NEW. Receives the extracted content verbatim plus
    a 20-line rationale section explaining why the
    content lives there.
- **BP-03 self-check:** `wc -l .claude/skills/skill-
  tune-up/SKILL.md` → 282. Under cap. Self-breach
  closed.
- **Hand-off:** Aarav's notebook (`memory/<persona>/
  aarav/NOTEBOOK.md`) updates next invocation: self-
  rank drops off top-5 as resolved; top-5 rotates one
  up.
- **Related round-42 memory:** `memory/feedback_skill_
  tune_up_uses_eval_harness_not_static_line_count.md`
  (standing rule that "worst-performing" ranking
  claims require the harness — static signals alone
  are insufficient). This extraction is explicitly a
  static-signal (BP-03 line-count) fix via the
  mechanical-edit path; it does NOT rebut or pre-empt
  the harness rule, which applies to ranking-of-
  skills questions, not to fixing-my-own-size ones.

## Format for new entries

```markdown
### YYYY-MM-DD — `<skill-path>` — <one-line summary>

- **Skill:** <path>
- **Round:** N
- **Edit type:** <mechanical rename | broken-link |
  BP-NN refresh | ASCII-lint | typo | content-extract>
- **Line delta:** <before> → <after>
- **Trigger:** <what surfaced the need>
- **Why mechanical, not eval-loop:** <one paragraph
  naming what did NOT change — triggering, output
  shape, or instruction-following — and why>
- **Files touched:** <bulleted list>
- **Hand-off:** <what follow-up, if any>
```
