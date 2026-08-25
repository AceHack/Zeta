---
id: 081M0W8DF0F087G0R0037NBDHZ
type: bug
state: done
priority: P2
slug: agencysignature-commit-audit-header-reports-head-instead-of
title: "AgencySignature commit audit header reports HEAD instead of the audited commit"
created: 2026-08-25T10:45:49.199Z
depends_on: []
composes_with: []
---

# AgencySignature commit audit header reports HEAD instead of the audited commit

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0W8DF0F087G0R0037NBDHZ-*.md` glob. -->

## Measured

After PR #15335 merged, this command correctly classified squash
`b0bded9329d31f6aabb38532842ff8866acd1e76` but printed the local branch tip in its header:

```text
bun src/Core.TypeScript/hygiene/audit-agencysignature-main-tip.ts \
  --commit b0bded9329d31f6aabb38532842ff8866acd1e76

target_rev: HEAD (3d820e0e4ab6714ca98387260b742f375916b911)
mode:       commit
[CORRECT]   b0bded9329d3
```

`buildCommitList` honors `--commit`, but `emitHeader` always receives the separately selected
branch target (`HEAD` unless `--branch` is present). The result is operationally correct and
diagnostically self-contradictory: it names one object while checking another.

## Acceptance

- In commit mode, `target_rev` names the exact requested revision and its resolved object ID.
- Head, max, since, and explicit-branch modes retain their current target semantics.
- A regression test audits a non-HEAD commit and rejects a header that still names `HEAD`.

## Resolution 2026-08-25

Commit mode now derives the displayed and resolved target from `args.commitSha`; every other mode
continues to use the selected branch target. The existing real-git fixture captures a second audit
of `HEAD~1` and requires both the requested revision and its resolved object ID in `target_rev`.

Measured verification: 52 focused audit tests pass, including the non-HEAD falsifier, and the root
TypeScript project passes `tsc --noEmit`.
