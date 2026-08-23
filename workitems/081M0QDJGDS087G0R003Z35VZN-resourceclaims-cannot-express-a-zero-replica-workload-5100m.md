---
id: 081M0QDJGDS087G0R003Z35VZN
type: task
state: backlog
priority: P2
slug: resourceclaims-cannot-express-a-zero-replica-workload-5100m
title: "resourceClaims cannot express a zero-replica workload — 5100m of latent hardcoded request is acknowledged rather than governed"
created: 2026-08-23T13:39:45.209Z
depends_on: []
composes_with: []
---

# resourceClaims cannot express a zero-replica workload — 5100m of latent hardcoded request is acknowledged rather than governed

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QDJGDS087G0R003Z35VZN-*.md` glob. -->

## What is unreachable, and why it is acknowledged instead of governed

`unreachableGitPathRequests` (added 2026-08-23 with the rung-reachable-raw-manifests
work) reports six coordinates that no rung reaches, in **two classes with different
refusals**. This item is about the first class — four coordinates on workloads
shipping `replicas: 0`:

| Application | manifest | request | replicas |
| --- | --- | --- | --- |
| `full-ai-cluster/vllm` | `full-ai-cluster/k8s/applications/vllm/deployment.yaml` doc 1 | **4000m / 16384Mi** | 0 |
| `full-ai-cluster/orleans` | `full-ai-cluster/k8s/applications/orleans/statefulset.yaml` doc 0 | 500m / 512Mi | 0 |
| `infra/orleans` | `infra/k8s/applications/orleans/deployment.yaml` doc 0 | 500m / 512Mi | 0 |
| `full-ai-cluster/hat-system` | `full-ai-cluster/k8s/applications/hat-system/deployment.yaml` doc 0 | 100m / 128Mi | 0 |

**Total latent: 5100m / 17536Mi.** They schedule nothing today, and that is a
reprieve rather than a fit — exactly the shape of gmod's gatekeeper-webhook
reprieve, which was priced and closed rather than waited out.

**The blocker is a schema rule, not a missing mechanism.** The manifest coordinate
class now exists and would address every one of these files. But
`loadResourceCatalogue` validates `pods` with `requireInt(raw.pods, ..., 1)` —
minimum 1 — and `declaredAppTotal` multiplies `cpuMillis * claim.pods`. A row for a
zero-replica workload would therefore add a whole pod's reservation to every rung
total: the budget would overstate by 4000m for vllm alone. That trades an
under-count for an over-count, which is not an improvement.

## Options (none taken; this is sized, not built)

1. **Allow `pods: 0`** with evidence naming the `replicas: 0` it reads from.
   Smallest change; needs care that `pods: 0` cannot become the way a real cost is
   zeroed out — the evidence requirement is what would carry that.
2. **Derive `pods` from the manifest** for manifest-coordinate rows instead of
   declaring it, so the count cannot drift from the file it prices. Better, and it
   touches `crossCheckClaims`.
3. **Leave it acknowledged.** Defensible while all four are placeholders awaiting
   unpublished images.

## Why nothing is silently missing meanwhile

All four are baselined in `rendered-resource-requests.baseline.json` with the
**replica count inside the finding key** (`...@x0`). Scaling any of them to 1 changes
the key, so the acknowledgement stops matching (a new OPEN finding) and
simultaneously matches nothing (the old entry goes STALE). Both halves exit 1, so
the 4000m cannot arrive quietly. `rendered-resource-requests.test.ts` §"unreachable
git-path requests" pins that.

## The second class is NOT this item

`cdi` (100m) and `kubevirt` (10m x 2) are **reachable and deliberately refused** —
their manifests are vendored byte-for-byte from upstream and `--apply` would rewrite
them. That is a standing decision recorded in `single-node-budget.json`, not a gap to
close here.
