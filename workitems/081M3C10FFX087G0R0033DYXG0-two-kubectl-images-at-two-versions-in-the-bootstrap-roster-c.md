---
id: 081M3C10FFX087G0R0033DYXG0
type: task
state: backlog
priority: P2
slug: two-kubectl-images-at-two-versions-in-the-bootstrap-roster-c
title: "Two kubectl images at two versions in the bootstrap roster cost 36.5 MB of the preload payload twice"
created: 2026-09-25T10:15:38.237Z
depends_on: []
composes_with: []
---

# Two kubectl images at two versions in the bootstrap roster cost 36.5 MB of the preload payload twice

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3C10FFX087G0R0033DYXG0-*.md` glob. -->

## The measurement

`bun src/Core.TypeScript/cluster/bootstrap-image-preload.ts --report` (WP34,
081M3BZ111D087G0R000YBMKRY, measured 2026-09-25) derives the 25 container images
a first boot needs before ArgoCD exists. Two of them are kubectl, at two
different versions, from two different registries:

| image | size | roster source |
|---|---|---|
| `registry.k8s.io/kubectl:v1.32.3` | 18.8 MB | `internal-secret-seeding` |
| `docker.io/rancher/kubectl:v1.35.6` | 17.7 MB | `spire-install` (chart hooks) |

36.5 MB combined — **3% of the 1.02 GB the ISO now carries, spent twice on the
same tool.** It had no price tag before the preload existed; it has one now,
which is the only reason this is worth anyone's attention.

Neither is wrong on its own. `internal-secret-seeding.yaml` is this repo's own
manifest and picked its image; `rancher/kubectl` arrives from the spire chart's
hooks. They simply never met.

## THE FIX IS NOT "pin them to the same string"

This tree has already made that mistake in a neighbouring form, and the record
is in `src/Core.TypeScript/cluster/image-resolvability.ts`: a chart derived a
hook image's TAG from the declared Kubernetes version and produced
`rancher/kubectl:v1.35.7` — a tag that was never published. `declaredKubeVersion`
carries the incident in its own docstring, and
`render-kube-version-image-drift.ts` exists because of it.

So the constraints are:

- **A kubectl tag must be one that EXISTS**, not one computed from
  `kubernetes-version.json`. Whatever lands has to be checked against the
  registry, not derived and hoped for.
- **A kubectl used against the API server should not be far from the server's
  version** (kubectl supports ±1 minor). `registry.k8s.io/kubectl:v1.32.3`
  against a 1.35.7 server is three minors back — worth confirming that is
  deliberate, independently of the byte saving.
- **The spire chart's hook image is upstream's choice.** Overriding it is a
  values change with its own risk, and may not be worth 17.7 MB.

## What would close this

1. Confirm whether `registry.k8s.io/kubectl:v1.32.3` in
   `full-ai-cluster/k8s/bootstrap/internal-secret-seeding.yaml` is a
   deliberate pin or an aged one. If aged, move it to a published tag nearer
   the server version — and check the tag resolves, e.g. through
   `bun src/Core.TypeScript/cluster/bootstrap-image-preload.ts --verify`.
2. Decide whether collapsing onto ONE of the two is worth the values override
   on the spire chart. A defensible answer here is **no** — 36.5 MB out of
   1.02 GB, against pinning a chart hook away from upstream's default.
3. Whichever way it goes, re-run
   `bun src/Core.TypeScript/cluster/bootstrap-image-preload.ts --refresh` so
   `full-ai-cluster/k8s/bootstrap-preload-images.json` follows the roster.

## Not blocking anything

WP34 ships with both images in the archive. This is a 3% saving and a
version-skew question, not a defect.
