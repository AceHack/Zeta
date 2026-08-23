---
id: 081M0QNFBZ0087G0R000N3RXGF
type: task
state: backlog
priority: P2
slug: publish-the-two-ghcr-packages-zeta-manifests-name-but-nothi
title: "publish the two ghcr packages Zeta manifests name but nothing builds — zeta-orleans-silo and hat-system-operator"
created: 2026-08-23T15:57:50.944Z
depends_on: []
composes_with: []
---

# publish the two ghcr packages Zeta manifests name but nothing builds — zeta-orleans-silo and hat-system-operator

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QNFBZ0087G0R000N3RXGF-*.md` glob. -->

## What this is

`src/Core.TypeScript/cluster/image-source-provenance.ts` refuses any manifest in
the public tree that names an image an anonymous outsider cannot pull. Three
references in this tree fail that today, all OURS, and all for the same reason:
**the package does not exist.**

| reference | manifests | measured 2026-08-23 |
|---|---|---|
| `ghcr.io/lucent-financial-group/zeta-orleans-silo:latest` | `full-ai-cluster/k8s/applications/orleans/statefulset.yaml`, `infra/k8s/applications/orleans/deployment.yaml` | anonymous manifest 401; `gh api /orgs/Lucent-Financial-Group/packages/container/zeta-orleans-silo` → `Package not found` |
| `ghcr.io/lucent-financial-group/zeta-orleans-silo:bootstrap` | `infra/k8s/bootstrap/initial-orleans.yaml` | same |
| `ghcr.io/lucent-financial-group/hat-system-operator:placeholder` | `full-ai-cluster/k8s/applications/hat-system/deployment.yaml` | same. The tag says `placeholder` in the manifest itself. |

No workflow in this tree builds either image. `.github/workflows/build-platform-images.yml`
builds `zeta-portal` and `zeta-platform-controller` and nothing else.

## Why it is ACKNOWLEDGED rather than red

Pre-existing, not introduced by the check. `orleans` and `hat-system` are already
in `lane-partition.ts`'s unpriced quarantine for exactly this reason, and
`docs/research/2026-08-21-what-each-deferred-argocd-application-needs-to-boot.md`
records it. A check that is red from birth is a check that gets ignored within a
week. The acknowledgements live in `ACKNOWLEDGED_PRIVATE` in the module and are
drift-checked in both directions.

## Either fix closes it

1. **Build and push** — a workflow shaped like `build-platform-images.yml`,
   including the `org.opencontainers.image.source` label, and publish the package; or
2. **Remove the manifests** — if these Applications are not going to boot, a
   reference to an image nobody will ever build is a dangling pin.

**LIFT:** run `bun src/Core.TypeScript/cluster/image-source-provenance.ts --refresh`.
When it records `artifact: public`, the acknowledgement goes STALE and the gate
goes red until the entry is deleted from `ACKNOWLEDGED_PRIVATE`. That is the
mechanism, not an oversight.

## What already lifted, recorded because it is the mechanism working

This item was minted at 15:57 UTC 2026-08-23 for a DIFFERENT pair:
`zeta-portal` and `zeta-platform-controller`, both measured 401 with the packages
API reporting `visibility: private`, both needing the UI-only Danger Zone
visibility flip Aaron had authorised. Re-measured at 16:14 the same afternoon:
both `200`, both `public`. Aaron performed the clicks while the check was being
written, so those two never needed an acknowledgement and none was shipped.
