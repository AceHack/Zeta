---
name: workflows
description: Factory workflows — git/PR, GitHub surfaces, OpenSpec lifecycle, round and backlog management, bug-fix, next-steps.
---

# workflows

Category skill (blueprint pack). The `description` above is the only thing the
router sees — broad and generic on purpose. The fat detail lives in the
blueprints below; open the one that matches and read it in full.

Governs its own form per `.claude/rules/rules-are-small-carved-sentences-pointing-to-docs.md`
and `.claude/rules/mirror-beacon-register-discipline.md` (carved sentence = hub /
Beacon; blueprint = satellite / Mirror). The directory is an independent shipping unit.

## Blueprints

- [`git-workflow-expert`](blueprints/git-workflow-expert.md) — Git workflow — branch-per-round, squash-merge to main, PR as round-close, Co-Authored-By, upstream contribution §23.
- [`fork-pr-workflow`](blueprints/fork-pr-workflow.md) — Fork-based PR workflow — three-remote setup, feature-branch loop, merge-queue compatibility, cross-repo PR patterns.
- [`github-surface-triage`](blueprints/github-surface-triage.md) — GitHub surface triage — PRs, Issues, Wiki, Discussions, Settings, Security, and other round-close surfaces.
- [`github-repo-transfer`](blueprints/github-repo-transfer.md) — GitHub repo transfer — pre-transfer scorecard, silent-drift healing, post-transfer verification, cartographer history.
- [`commit-message-shape`](blueprints/commit-message-shape.md) — "Commit-message conventions — imperative subject, WHY body, scope prefix, Co-Authored-By footer."
- [`openspec-expert`](blueprints/openspec-expert.md) — OpenSpec — behavioural spec discipline, WHEN/THEN/REQUIRES structure, overlays, formal-spec relationship.
- [`openspec-apply-change`](blueprints/openspec-apply-change.md) — Implement OpenSpec change tasks when starting, continuing, or working through implementation.
- [`openspec-archive-change`](blueprints/openspec-archive-change.md) — Archive a completed experimental workflow change after implementation is complete.
- [`openspec-explore`](blueprints/openspec-explore.md) — OpenSpec explore mode — thinking partner for idea exploration, problem investigation, requirements clarification.
- [`openspec-propose`](blueprints/openspec-propose.md) — Propose a new OpenSpec change — generates design, specs, and tasks in one step.
- [`round-management`](blueprints/round-management.md) — Round planning — parallel-agent dispatch, synthesis, close-out at round-open, mid-round, and round-close.
- [`round-open-checklist`](blueprints/round-open-checklist.md) — Round-open procedure — reset CURRENT-ROUND.md, carry DEBT/P1, name anchor, dispatch reviewer floor, confirm branch plan.
- [`backlog-decomposer`](blueprints/backlog-decomposer.md) — Backlog decomposition — split B-rows into dependency-ordered child rows, depends_on edges, buildable/blocked/research.
- [`backlog-scrum-master`](blueprints/backlog-scrum-master.md) — Backlog + roadmap grooming — BACKLOG.md/ROADMAP.md, in-flight view, velocity, priorities, scope boundaries.
- [`next-steps`](blueprints/next-steps.md) — Next-steps recommender — top 3-5 items ranked by value-per-effort from backlog, findings, and research.
- [`bug-fixer`](blueprints/bug-fixer.md) — "Bug-fix procedure — falsifying test, blast-radius walk, minimal correct fix, reviewer floor, spec update."
