# Lane audit under the metal-fidelity criterion

**Date:** 2026-09-09
**Workitem:** `081M24532FF087G0R002WBRZ4Z`
**Status:** DRAFT — a recommendation with numbered open questions. **No lane is
retired by this doc.** Lane changes need maintainer sign-off (round-29
discipline); what follows is the measurement and the argument.

## The criterion, from Aaron

> "with the different lanes, we don't necessarily need to test all the different
> environment types unless they are testing something for us one of the other
> specific environments cannot, like the goal is not to test with kind and k3s
> and all the modded versions, the goal is to test as much of a real metal run
> before we get to metal."

That replaces *environment coverage* with **metal fidelity**. Each lane must
justify itself by testing something metal-relevant that no other lane can. A
lane that establishes "kind still works" is testing the test rig, and retiring
it is a saving rather than a loss.

## What metal actually is — measured, not assumed

| axis | metal | source |
|---|---|---|
| distribution | **k3s** | `full-ai-cluster/k8s/kubernetes-version.json`: *"what k3s actually ships 1.35.6"*; the version is derived from `pkgs.k3s` via this repo's own flake lock |
| CNI | **Cilium** | `k8s/bootstrap/cilium-install.yaml`; `cluster-identity.json` derives the k3s `--cluster-cidr` **and** Cilium's ClusterMesh `cluster.name`/`cluster.id` from one `clusterName` |
| virtualisation | **kubevirt + CDI** | `cdi` / `kubevirt` are `manualSync: true` because both adopt operators installed by hand on `node-5b2dfa`, which runs three production Windows guests |

**This inverts the current emphasis.** `live-k3d` runs k3s in Docker with Cilium
— metal's distribution *and* metal's CNI. Every `kind` lane runs a distribution
metal does not use, and three of the four run a CNI metal does not use. The
deepest proof in the workflow, the 37/37 `included` run, is on the least
metal-like substrate in it.

## The seven jobs

| lane | substrate | CNI | what ONLY it tests | metal-relevant? | verdict |
|---|---|---|---|---|---|
| `dry-run` | none | — | manifests, rosters, unit tests, before any bring-up | yes — every defect it catches would otherwise cost a cluster | **KEEP** |
| `live-k3d` | **k3s** in Docker | **Cilium** | k3s + Cilium together — metal's own pair | **highest fidelity in the workflow** | **KEEP and promote** |
| `live-kind-virt` | kind | kindnetd | kubevirt + CDI emulation | yes — metal runs Windows guests under kubevirt, and nothing else covers it | **KEEP** |
| `live-kind-included` | kind | kindnetd | the deep 37/37 Synced+Healthy proof | the COVERAGE is; the SUBSTRATE is not | **KEEP the coverage, MOVE it to k3d** |
| `live-kind-cilium` | kind | Cilium | Cilium on kind | no — `live-k3d` already runs Cilium, on metal's distribution | **MERGE into `live-k3d`** |
| `live-kind` (amd64) | kind | kindnetd | kindnetd, which metal never runs | no | **RETIRE** |
| `live-kind` (arm64) | kind | kindnetd | image availability on **arm64** | **UNKNOWN — open question 1** | **HOLD** |
| `live-kind-cilium-included` | kind | Cilium | the `included` roster under Cilium, `workflow_dispatch` only, currently skipped | combinatorial: substrate × CNI × roster | **RETIRE or restate as a dated probe** |

## The single highest-value change

**Move the `included` proof from kind to k3d.** It is the deepest evidence the
repo has that the cluster comes up — and it currently establishes that on a
substrate metal does not use, with a CNI metal does not use. Running the same
roster on k3s + Cilium would make the strongest proof also the most
metal-faithful one, and would make three kind lanes redundant at a stroke.

It is also the change with the most unknown cost, which is why it is a
recommendation and not a diff.

## Open questions — the maintainer's to answer, with expected answer shapes

1. **Does metal have arm64 nodes?** If yes, the `live-kind` arm64 leg is the
   only lane proving the image set resolves on arm64 and it must be kept —
   ideally moved to k3d. If no, it is testing an architecture nothing will run.
   *Expected shape: yes/no plus the node inventory.*
2. **Will k3d host the `included` roster inside the budget?** The kind
   `included` run finished in **513 s against a 2400 s cap** (4.7× headroom), so
   there is room; k3d's own per-node overhead against that headroom is not
   measured. *Expected shape: a measured run, not an estimate.*
3. **Does anything in the `included` roster depend on kindnetd or on kind's
   node image?** The lane already substitutes a StorageClass and an LB-IPAM pool
   for kind; those substitutions may differ or disappear under k3d. *Expected
   shape: a list of substitutions and what each becomes on k3d.*
4. **Is `live-kind-cilium-included` answering a question anyone still has?** It
   is dispatch-only and skipped on every push. A probe with no standing question
   is a lane that costs nothing today and confuses every reader of this file.
   *Expected shape: the question, or retire.*
5. **What replaces kindnetd coverage, if anything?** The honest answer may be
   "nothing, because metal never runs it" — but it should be said out loud
   rather than assumed. *Expected shape: an explicit accept/decline.*

## What this does to the split

The per-chart-set split was sized at **six** concurrent jobs (six started within
a 4–5 s spread; thirty is not evidence-backed). That figure is about
**chart-sets**, and it is orthogonal to this audit, which is about
**environments**.

If the recommendation above is taken, the environment count falls from seven
jobs to **four** — `dry-run`, `live-k3d` (carrying the `included` roster),
`live-kind-virt`, and whatever open question 1 decides. **That is a better
outcome than the split**, because it removes lanes rather than adding them, and
because every lane removed is a lane that can no longer produce a cascade for
the split to isolate.

Priority stands as: the vacuity column and post-deploy assertions first
(`docs/research/2026-09-09-chart-assertion-census-*.md`), then this audit, then
the split.

## Pointers

- `.github/workflows/k8s-argocd-health-test.yml` — the seven jobs
- `full-ai-cluster/k8s/kubernetes-version.json` — the derived-from-`pkgs.k3s` version, and the three-literals-two-answers incident that made it a file
- `full-ai-cluster/cluster-identity.json` — one `clusterName` deriving both the k3s CIDRs and Cilium's ClusterMesh identity
- `docs/research/2026-09-09-chart-assertion-census-*.md` — the higher-priority finding: zero post-deploy functional assertions
- `docs/research/2026-09-09-one-kind-cluster-per-chart-set-*.md` — the split, and its five open questions
