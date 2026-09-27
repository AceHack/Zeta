---
id: 081M3HYPQCR087G0R003C2VPRS
type: bug
state: backlog
priority: P2
slug: spire-application-can-never-sync-on-a-rung-overlaid-first-bo
title: "spire Application can never sync on a rung-overlaid first-boot lane: dev override diverges an immutable StatefulSet field from the k3s bootstrap install"
created: 2026-09-27T17:30:48.088Z
depends_on: []
composes_with: []
---

# spire Application can never sync on a rung-overlaid first-boot lane: dev override diverges an immutable StatefulSet field from the k3s bootstrap install

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3HYPQCR087G0R003C2VPRS-*.md` glob. -->

## Evidence

First-boot replica, constrained lane, dispatch 36333824468 (job 108660739403), and the
scheduled run 36303440548 before it: `spire: OutOfSync/Progressing -- ... StatefulSet.apps
"spire-server" is invalid: spec: Forbidden: updates to statefulset spec for fields other
than ... are forbidden (retried 5 times)`.

## Root cause

Not chart/values drift between the committed twins: `helm template` of spire 0.24.2 with
`k8s/bootstrap/spire-install.yaml`'s values and with `k8s/applications/spire`'s values
renders a byte-identical StatefulSet. The replica serves ArgoCD a **dev-rung** tree, and
`rung-overrides.yaml` entry `spire/disk-dev` sets `spire-server.persistence.size: 512Mi`
there, while k3s installs the bootstrap HelmChart from the committed manifests at 5Gi. So
`spec.volumeClaimTemplates[spire-data].spec.resources.requests.storage` is 5Gi live and
512Mi desired -- immutable, so the patch is refused forever.

Scope: lanes that run the k3s bootstrap roster AND a rung-overlaid Application tree -- the
first-boot replica. The committed (metal) tree renders every adoption pair identically.

## Fix

- The replica skips rung overrides on Applications that adopt a bootstrap HelmChart
  (`overridesOnAdoptedApplications`, today exactly `spire/disk-dev`). kind/k3d lanes
  install no bootstrap charts and keep the override.
- `src/Core.TypeScript/cluster/adoption-immutable-fields.ts` renders all 7 adoption pairs
  against the committed tree and the dev tree the replica serves, comparing immutable
  fields; `--apply-all-overrides` is the negative control (red on spire). Wired into
  helm-validate.yml.

## Also in scope: the node container that died on its own

Same run: the constrained container stopped during stage 6 and nothing recorded why. The
harness now reads Docker's exit state (ExitCode, OOMKilled, log tail) when the node is not
running, fails stage 6 and marks stage 7 inconclusive instead of passing over a dead API.
The cause itself is still unmeasured -- the next constrained run will name it.
