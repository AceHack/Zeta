---
pr_number: 5242
title: "feat(B-0825): time-modeled dependencies for Helm \u2014 temporal axis in chart-graph for long-running stateful clusters"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T17:33:14Z"
merged_at: "2026-05-26T17:35:43Z"
closed_at: "2026-05-26T17:35:43Z"
head_ref: "otto-cli/b0825-time-modeled-dependencies-helm-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:37:32Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5242: feat(B-0825): time-modeled dependencies for Helm — temporal axis in chart-graph for long-running stateful clusters

## PR description

## Summary

Files [B-0825](https://github.com/Lucent-Financial-Group/Zeta/blob/otto-cli/b0825-time-modeled-dependencies-helm-2026-05-26/docs/backlog/P1/B-0825-time-modeled-dependencies-for-helm-clusters-as-long-running-stateful-systems-require-temporal-axis-in-dependency-graph-aaron-2026-05-26.md) per Aaron 2026-05-26: *"helm needs time modeled in the depedencies like no others"*.

**Helm's UNIQUE requirement** — Maven/npm/apt/Cargo don't need time-axis because build-time PMs separate install from continuous-running. Helm CAN'T separate them: install IS deploy IS continuous-running on long-running stateful clusters.

**Missing primitives** at chart-graph layer:
- Multi-version overlap window (postgres v15 + v17 side-by-side during migration)
- Migration-phase modeling (preparing / cutting-over / dual-running / draining-old / cleanup)
- Time-aware diamond resolution (per B-0822 + B-0821)
- Long-running rollback windows
- Time-bounded dep-graph queries (\`ace deps query --as-of / --during / --rollback-window\`)
- Scheduled-upgrade evaluation

6 sub-targets defined. Composes with B-0824 (parent N-D meta-PM; time is ONE axis), B-0822 (per-tenant cutover scheduling), B-0821 (graph spec extended), B-0819 (migration runbooks ride AI-runbook substrate).

## Test plan

- [ ] Markdown lint clean
- [ ] BACKLOG.md drift check clean
- [ ] Cross-links resolve

🤖 Generated with [Claude Code](https://claude.com/claude-code)
