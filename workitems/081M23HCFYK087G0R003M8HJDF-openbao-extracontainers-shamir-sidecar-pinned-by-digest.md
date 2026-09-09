---
id: 081M23HCFYK087G0R003M8HJDF
type: task
state: in-progress
priority: P1
slug: openbao-extracontainers-shamir-sidecar-pinned-by-digest
title: "OpenBao extraContainers Shamir sidecar pinned by digest"
created: 2026-09-09T16:52:57.427Z
depends_on: ["081M23BTKZX087G0R0034VN466"]
composes_with: []
---

# OpenBao extraContainers Shamir sidecar pinned by digest

B7 / R1 remaining half. Image recipe landed in `#17143`
(`full-ai-cluster/openbao-unseal/Dockerfile`, matrix
`zeta-bao-unseal`). Anonymous GHCR pull of
`ghcr.io/lucent-financial-group/zeta-bao-unseal@sha256:51f3008f68cdc3ca02debf7726522dbefbd7f7919b2b566655dfc5d54ccc0b82`
returned 200. Otto 2026-09-09: extraContainers may land now;
pin by digest; do not fork `openbao` 0.29.4; do not use
`zeta-ci-runtime` / `alpine:latest` / `apk add curl`.

Init stays gated. Post-init Shamir unseal on pod restart is
this extraContainer. Metal `seal "pkcs11"` is R3, not this
item. Missing share cache must wait, not crash-loop
(`optional: true` on the Secret; sidecar returns `[]`).

## Pre-start checklist

- Substrate-drift: `#17143` is on `main`; GHCR-200 is measured.
  Not drift.
- Prior-art: OpenBao chart 0.29.4 renders
  `tpl (toYaml .Values.server.extraContainers)` and
  `server.volumes` via toYaml. `server.extraVolumes` is
  deprecated and pre-processes to `/openbao/userconfig/<name>/`
  (wrong path for `DEFAULT_SHARE_DIR`).
- Do not mint Shamir shares into `DEV_BOOTSTRAP_SECRETS`.
  Do not ESO-copy shares into etcd. Threshold stays >= 2.

## Acceptance

- `full-ai-cluster/k8s/applications/openbao/Application.yaml`
  `server.extraContainers` is a YAML list; image is the digest
  pin above; `imagePullPolicy: IfNotPresent`.
- `server.volumes` mounts Secret `openbao-unseal-shares` at
  `/etc/openbao/unseal-shares` with `optional: true`.
- `full-ai-cluster/k8s/applications/openbao/TOPOLOGY.md` §5
  recast: init gated; post-init unseal is this sidecar. Rule
  names stay. PKCS#11 is not claimed live.
- Guard: `src/Core.TypeScript/cluster/zeta-bao-unseal-image.test.ts`
  asserts the digest pin, `optional: true`, and refuses
  `zeta-ci-runtime` / `alpine:latest` / `:latest`.
