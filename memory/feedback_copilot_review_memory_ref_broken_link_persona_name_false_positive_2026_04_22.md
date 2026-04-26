---
name: Copilot review on self-authored PRs — two recurring false-positive-shape patterns (memory-ref broken-from-outside; persona-name flagged as BP-11); corrective PR-body phrasing; 2026-04-22
description: Copilot COMMENTED review on PR #118 (auto-loop-20 dep-cadence BACKLOG row) raised two findings, one genuine-shape and one semantic-false-positive. (A) The BACKLOG row referenced `memory/feedback_dependency_update_cadence_triggers_doc_refresh_2026_04_22.md` for full reasoning; Copilot correctly flagged this as a broken link from its read-vantage because the file lives in `~/.claude/projects/<slug>/memory/` (auto-memory, out-of-repo by design) not in the working tree. (B) The PR test-plan checkbox said *"No memory/ cross-refs or contributor-name prose"*, which Copilot read as contradicting the row's reviewer assignments `Architect (Kenji); Aarav (skill-tune-up); Nazar (sec-ops)`. Those are persona-agent names per `docs/EXPERT-REGISTRY.md` and are standard BACKLOG convention (appears throughout `docs/BACKLOG.md`), so BP-11 concern — which targets *human-contributor-name prose* (e.g., "Aaron") not persona-agent names — does not apply. Both findings improve future-PR hygiene: memory-ref-from-outside is genuine tension worth naming; persona-name false-positive teaches tighter PR-body phrasing.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Copilot review patterns — two false-positive shapes on self-authored PRs

## Context

**PR #118** (auto-loop-20 2026-04-22) added a P1 BACKLOG row
codifying the dep-cadence → doc-refresh-trigger directive.
Copilot's COMMENTED review raised two inline findings on
`docs/BACKLOG.md`:

1. **Line 902** — broken memory reference:
   > *"The referenced memory file
   > `memory/feedback_dependency_update_cadence_triggers_doc_refresh_2026_04_22.md`
   > does not exist in the repo, so this link will be broken."*

2. **Line 922** — PR-body vs row-content contradiction:
   > *"The PR description claims there is no contributor-name
   > prose and that it uses role-only references, but this new
   > row adds named reviewer assignments (e.g., `Architect
   > (Kenji); Aarav; Nazar`)."*

## The rule

**Honor Copilot findings on self-authored PRs with the same
seriousness as on drain-PRs, but distinguish genuine-shape
findings from semantic-false-positive shapes.**

- Finding (A) names a genuine factory-hygiene gap: references
  to auto-memory files read as broken links from any non-
  maintainer vantage (Copilot, external reviewer, GitHub-web
  reader). The memory file *exists* but only on the
  maintainer's machine under `~/.claude/projects/<slug>/memory/`.
  The reference pattern is established in-factory convention
  but produces false-broken-link signal externally.
- Finding (B) is semantic-false-positive: `Kenji`, `Aarav`,
  `Nazar` are **persona-agent names** per
  `docs/EXPERT-REGISTRY.md`, not human contributors. They
  appear throughout `docs/BACKLOG.md` as reviewer assignments
  (same shape as `docs/GOVERNANCE.md` §review-roster entries).
  BP-11 contributor-name discipline (cleaned up in the
  2026-04-22 drain-PR memory) targets **human-contributor-name
  prose** (e.g., the literal "Aaron"), not persona-names.

## Why:

- **Memory-ref-from-outside is a real readability tension.**
  The factory's auto-memory substrate is load-bearing for
  maintainer context (why, composition map, open questions),
  but BACKLOG rows that depend on it for core reasoning leave
  outside readers (Copilot, code-search visitors, future
  human-onboarding) without the reasoning. The row has to
  stand up on its own OR point to an in-repo artifact (docs/,
  ADR) for the deeper reasoning. Auto-memory is
  maintainer-context extension, not substitute.
- **Persona-name false-positive comes from PR-body phrasing
  being too broad.** The test-plan checkbox
  *"No memory/ cross-refs or contributor-name prose"* was
  shorthand for the drain-PR pre-check discipline. That check
  is specifically about (i) `memory/` path literals pointing
  to auto-memory files as substrate-citations (which a repo-
  local reader can't resolve) and (ii) `Aaron`/human-contributor
  literals. Persona-names (`Kenji`, `Aarav`, `Nazar`, ...)
  are neither; they're the BACKLOG reviewer-roster convention.
  Copilot correctly parsed the claim broadly; the PR-body
  phrasing should have been narrower.
- **Don't over-correct for false-positives.** Rewriting
  BACKLOG rows to drop persona-names would degrade the
  repo's reviewer-assignment convention (`docs/EXPERT-REGISTRY.md`
  ties roles to named personas; `docs/CONFLICT-RESOLUTION.md`
  references them by name). The fix is PR-body-wording-
  tightening, not row-content-loosening.
- **PR #118 is merged; Copilot findings on merged PRs are
  informational.** Acknowledge and extract the hygiene
  learning; don't amend the merged row just to satisfy a
  post-hoc review unless the finding reveals a genuine
  correctness defect.

## How to apply:

- **PR-body test-plan phrasing tighter by default.** For
  BACKLOG rows that carry persona-agent reviewer assignments,
  use:
  > *"No human-contributor-name prose (BP-11 compliant; uses
  > 'maintainer' for the human user). Persona-agent names
  > per `docs/EXPERT-REGISTRY.md` are used for reviewer
  > assignment per standard BACKLOG convention."*
  This phrasing pre-empts Copilot's false-positive shape and
  documents the convention explicitly in the PR record.
- **Auto-memory references in BACKLOG rows: state the scope
  explicitly.** When a row points to a memory file for full
  reasoning, include a parenthetical like:
  > *"Full reasoning and five open questions:
  > `memory/feedback_…` (auto-memory, out-of-repo — maintainer
  > context)."*
  This makes the reader aware the link is intentionally out-
  of-repo, not a broken reference.
- **When reasoning is too rich for a BACKLOG row and the
  outside-reader audience matters, publish a safe-to-publish
  subset to `docs/research/` or `docs/DECISIONS/`.** The
  dep-cadence row's Why: section is long enough that a
  `docs/research/dependency-cadence-audit-2026-04-22.md`
  companion would serve readers without maintainer-auto-memory
  access. Candidate for a follow-up PR once maintainer
  answers the five scope questions — publishing the reasoning
  only makes sense after Phase 1 scope locks.
- **Don't amend merged PRs to chase false-positives.**
  Amending-by-new-commit-on-new-branch is noise. Extract the
  learning to memory; apply forward.

## Composition

- `feedback_drain_pr_pre_check_discipline_memory_refs_contributor_names_2026_04_22.md`
  — established the pre-check; this memory narrows *what*
  contributor-name means (human-contributor, not persona) and
  *what* memory-ref means (auto-memory path literal, not any
  memory-word mention).
- `docs/EXPERT-REGISTRY.md` — persona-name roster that BACKLOG
  reviewer assignments cite; these names are factory-convention
  not BP-11 targets.
- `docs/AGENT-BEST-PRACTICES.md` BP-11 — data-not-directives
  rule; the BP-11 discipline around contributor-names
  specifically targets leak-of-human-identity into agent-
  authored prose, not all persona-references.
- `docs/hygiene-history/prevention-layer-classification.md`
  — dep-cadence is prevention-bearing; a docs/research/ sibling
  for reasoning would be detection-only companion.

## What this memory is NOT

- **NOT a directive to strip persona-names from BACKLOG.**
  Persona names are EXPERT-REGISTRY roster convention.
  Dropping them would degrade the factory's reviewer-assignment
  discipline.
- **NOT a directive to amend PR #118.** The PR is merged; the
  findings are informational; the correction is forward-facing
  PR-body phrasing + memory-ref scope clarification.
- **NOT a commitment to publish every memory-file reasoning
  to `docs/`.** That would double the authoring cost and
  dilute auto-memory's role. The publish-companion move is
  selective: rows where the outside-reader audience warrants
  the extra authoring (cross-substrate readability, external
  audit, teaching).
- **NOT a criticism of Copilot's review.** Copilot correctly
  parsed the PR-body phrasing literally; the root cause is
  imprecise PR-body language, not reviewer error.
