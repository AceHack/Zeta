---
id: 081KR2E4K0008QG0R000260AAZ
priority: P1
status: open
title: "Pages discoverability - frontend DORA metric definitions"
created: 2026-05-08
last_updated: 2026-05-08
parent: 081KQX9B50008QG0R001XQV4M5
depends_on: [081KQGDBJ0008QG0R0004ACHJJ, 081KR2E4K0008QG0R002QNGJVX]
classification: blocked-on-pages-validation
decomposition: atomic
owners: [observability, qa]
type: friction-reducer
---

# 081KR2E4K0008QG0R000260AAZ - Pages frontend DORA metrics

Define the DORA measurement layer for the GitHub Pages
deployment path without creating a second observability
substrate.

## Acceptance criteria

- Deployment frequency is defined for the Pages publishing lane.
- Lead time is measured from merged change to live Pages
  availability.
- MTTR and change failure rate definitions include Pages-specific
  rollback or repair events.
- The metrics path composes with the existing timeseries lane.
