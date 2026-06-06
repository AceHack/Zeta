---
id: B-0343
zetaid: 081KR2E4K0008QG0R002JW751Y
priority: P1
status: closed
title: Test-repo seeding script (TS) — create + seed the recreation experiment repo
tier: foundation
effort: M
ask: B-0193 decomposition — AC 1 (test repo created and seeded)
created: 2026-05-08
last_updated: 2026-05-29
closed_at: 2026-05-29
parent: B-0193
depends_on: [B-0341]
composes_with: [B-0193, B-0344]
tags: [bootstrap-razor, tooling, typescript, seeding, trajectory-child]
type: friction-reducer
---

# B-0343 — Test-repo seeding script (TS)

## Parent

B-0193 (bootstrap razor + 23-hour recreation test).

## What

Build a TypeScript script (Rule 0 — no .sh) that:

1. Creates a new repo in LFG or AceHack org via `gh api`.
2. Seeds it with exactly the files listed in the seed
   manifest (B-0341's `SEED-MANIFEST.md`).
3. Commits the seed with a clear provenance message
   linking back to B-0193.
4. Outputs the repo URL for the experiment runner.

**Authorization scope**: LFG or AceHack org only. NOT
ServiceTitan (per Aaron 2026-05-05 explicit).

## Acceptance criteria

1. Script at `tools/bootstrap-razor/seed-test-repo.ts`.
2. Reads seed manifest from
   `docs/bootstrap-razor/SEED-MANIFEST.md`.
3. Idempotent — re-running against an existing repo
   reports status, does not duplicate.
4. Includes `--dry-run` flag that shows what would be
   seeded without creating.

## Effort

M — GitHub API integration + file copying logic.

## Pre-start checklist (start-gate 2026-05-10 riven)

**Prior-art search (surfaces + queries):**

- `tools/**/*.ts` grep for `"gh api"`, `"dry-run"`, `"seed"`, `"bootstrap"` → hits in create-branch-safety-ruleset.ts (dry-run gh), migrations/b0267*.ts (gh child_process), hygiene/*.ts (gh api error handling). Rule 0 TS confirmed.
- docs/backlog/P1/B-034* → sibling B-0341 closed, B-0342 recent.
- No pre-existing tools/bootstrap-razor/ or seed-test-repo.ts.

**Dependency-restructure:**

- depends_on [B-0341] verified closed; manifest at docs/bootstrap-razor/SEED-MANIFEST.md is yaml include/exclude, machine-readable.
- composes_with [B-0193, B-0344] — reciprocal pointers intact in parent/sibling rows.
- No broken links; supersession via decision-archaeology not needed (new row).

**Re-decomposition (assumed original mistake):** Original "create + seed" + 4 ACs = M broad for atomic step. Bounded slice: minimal TS stub (dry-run + manifest reader, no gh, no create). Follow-up: gh api, idempotency, commit logic.

**Proof logged:** start-gate complete before code; see claim commit + this update.

## Resolution

Closed by the merged B-0343 seed-test-repo implementation on
`origin/main`:

- `96e82b191cfecc966dbfd6c36f8c0b6298563aa0` —
  `feat(B-0343): add gh api execution bridge`
- `tools/bootstrap-razor/seed-test-repo.ts`
- `tools/bootstrap-razor/seed-test-repo.test.ts`

The merged tool now covers the seed manifest read path, dry-run output,
authorized LFG/AceHack repo creation via `gh api`, idempotent existing-repo
handling, seed tree/blob/commit/ref request construction, and provenance
commit text linking B-0193/B-0343.
