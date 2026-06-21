---
id: 081KRHWGX0008QG0R002NJP2BH
priority: P1
status: open
title: "Bump civsim .zeta-version from scaffold-template SHA to apply-time Zeta main SHA"
type: chore
origin: 081KRHWGX0008QG0R003S6KGGE apply completion — 1-commit drift between scaffold-template time and apply-time
created: 2026-05-14
last_updated: 2026-05-14
depends_on: [081KRHWGX0008QG0R003S6KGGE]
composes_with: []
---

# 081KRHWGX0008QG0R002NJP2BH — Bump civsim `.zeta-version` to apply-time Zeta main SHA

## Context

When `bun tools/scaffold/create-repo.ts --repo civsim --apply` ran (2026-05-14T10:52Z),
the scaffold template's `.zeta-version` file contained the SHA at PR #3125 merge time
(`eaea0682bd50344404c975e9d8eac4bb95e2c2bc`). The actual Zeta main at apply-time was
one commit ahead (`ce5c4101e9d3d78550215cc5ef8152cffb63b8cc`, PR #3126 merge).

Per the ADR: "Update .zeta-version pin file to the actual current Zeta main SHA after
repo creation."

## What this row does

Open a PR on `Lucent-Financial-Group/civsim` that bumps `.zeta-version`:

```
eaea0682bd50344404c975e9d8eac4bb95e2c2bc
```

→

```
ce5c4101e9d3d78550215cc5ef8152cffb63b8cc
```

## Done criteria

- PR opened on `Lucent-Financial-Group/civsim` with the 1-line `.zeta-version` bump
- PR merged (requires 1 review per branch protection)
- `.zeta-version` in civsim/main reflects Zeta HEAD at apply-time

## Notes

- Branch protection on civsim requires 1 approving review — this is a quick PR
- This is a low-urgency chore; the 1-commit difference has no functional impact
- The `.zeta-version` will next be bumped when the first Zeta release tag is emitted
  (glue mechanism Stage 1)

## Related

- [Product-repo glue mechanism ADR](../../DECISIONS/2026-05-14-product-repo-glue-mechanism.md)
- [Product-repo split decisions ADR](../../DECISIONS/2026-05-14-product-repo-split-decisions.md)

## Pre-start checklist

- Prior art: no existing `.zeta-version` bump row; this is the first one
- Dependency: 081KRHWGX0008QG0R003S6KGGE completed (civsim repo exists) ✓
- No blocking dependencies
