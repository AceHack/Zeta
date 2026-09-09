---
id: 081M23BTKZX087G0R0034VN466
type: task
state: in-progress
priority: P1
slug: zeta-bao-unseal-image-in-build-platform-images-matrix
title: "zeta-bao-unseal image in build-platform-images matrix"
created: 2026-09-09T15:10:00.000Z
depends_on: ["081M1RYF7YF087G0R003FTCZ5K"]
composes_with: []
---

# zeta-bao-unseal image in build-platform-images matrix

B7 packaging. Adapters landed in `#17003`
(`src/Core.TypeScript/cluster/openbao-unseal-sidecar.ts`). Otto
2026-09-09: one matrix entry in
`.github/workflows/build-platform-images.yml`, pin the published
image by digest, do not fork the 0.29.4 chart, do not use
`zeta-ci-runtime`, do not `alpine:latest` + `apk add curl`, do not
commit a compiled binary. Missing share cache must wait, not
crash-loop.

## Pre-start checklist

- Substrate-drift: sidecar CLI exists; `full-ai-cluster/k8s/applications/openbao/Application.yaml`
  still has no `server.extraContainers`. CI green is
  `--ephemeral-vault-init`. Not drift.
- Prior-art: same workflow already publishes
  `ghcr.io/lucent-financial-group/zeta-orleans-silo` from a context
  directory. This is one more matrix row.
- extraContainers must NOT land until the image is anonymously
  pullable (GHCR 200). An unpullable sidecar makes `openbao-0`
  NotReady and turns Otto's included-catalog health red.

## Acceptance

- Dockerfile at `full-ai-cluster/openbao-unseal/Dockerfile` builds
  `openbao-unseal-sidecar.ts` with bun; runtime ENTRYPOINT is that
  bundle. No compiled JS in git.
- Matrix entry `image: zeta-bao-unseal`.
- `Application.yaml` still has no `extraContainers`.
- Missing share cache: sidecar already returns `[]` and stays up
  (`src/Core.TypeScript/cluster/openbao-unseal-sidecar.test.ts`).
- Follow-up (not this item): digest-pin extraContainers after
  first anonymous GHCR 200.
