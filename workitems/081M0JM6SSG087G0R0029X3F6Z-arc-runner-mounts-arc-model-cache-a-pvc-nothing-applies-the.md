---
id: 081M0JM6SSG087G0R0029X3F6Z
type: bug
state: backlog
priority: P2
slug: arc-runner-mounts-arc-model-cache-a-pvc-nothing-applies-the
title: "arc runner mounts arc-model-cache, a PVC nothing applies -- the Application sources a remote chart, not its sibling manifest"
created: 2026-08-21T16:59:29.456Z
depends_on: []
composes_with: []
---

# arc runner mounts arc-model-cache, a PVC nothing applies -- the Application sources a remote chart, not its sibling manifest

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0JM6SSG087G0R0029X3F6Z-*.md` glob. -->

## Measured on origin/main

`full-ai-cluster/k8s/applications/arc-runner-set/Application.yaml`:

    :33   repoURL: ghcr.io/actions/actions-runner-controller-charts
    :34   chart: gha-runner-scale-set
    :35   targetRevision: 0.12.1
    :51   minRunners: 1
    :72   claimName: arc-model-cache

and the PVC it names lives at `arc-runner-set/model-cache-pvc.yaml:8`, a
**sibling file in the same directory**.

The Application sources a REMOTE Helm chart, not this git path, so it cannot
apply its own sibling. Nothing else does either: the root app-of-apps
(`full-ai-cluster/k8s/bootstrap/root-application.yaml`) includes only
`{*/Application.yaml,Application.yaml}`, which does not match a bare
`model-cache-pvc.yaml`.

## Why it is live rather than latent

`minRunners: 1` keeps a warm runner, and that runner's pod spec mounts
`arc-model-cache`. A pod mounting a PVC that does not exist does not start. This
is not a future risk; it is the current state whenever the runner set is synced.

The file's own header comment asserts it is applied. It is not — the same
comment-asserts-a-guarantee-the-code-does-not-provide shape this repo keeps
finding.

## The 100 GiB is also phantom capacity

`model-cache-pvc.yaml` requests 100Gi RWX against `longhorn`. Because nothing
applies it, that 100 GiB is counted in the DECLARED planning total while
consuming nothing at bring-up. Recorded here so a future capacity change does
not "reclaim" it and think it found headroom that was never occupied.

## Fix directions, deliberately not chosen here

1. Apply the PVC from something that actually reaches it — e.g. give it its own
   `Application.yaml`, which the root glob does match.
2. Drop the mount and the PVC together if the model cache is not wanted.
3. Move the PVC into the Helm release via `extraVolumes`/chart values, if
   `gha-runner-scale-set` supports declaring it.

Choosing between these is a product call about whether the runner should have a
model cache at all, and (1) versus (3) changes who owns the volume's lifecycle.

## Provenance

Found by the storage-profile measurement (PR #13271) while establishing which
declared PVCs are actually provisioned at bring-up; independently re-checked
against `origin/main` before filing. Note the ArgoCD reach audit added in
PR #13265 targets the sibling class (an `Application.yaml` no root can discover)
but would NOT catch this one, since here it is a non-Application manifest that
is unreachable.

---

## Re-measured 2026-08-26 (origin/main 695f20afab) — confirmed, with two corrections

The **central claim is confirmed and is now machine-enforced.** Two secondary
claims around it need correcting, and one of them matters more than the bug.

### Confirmed: nothing applies the PVC

Checked against all 13 git-directory sources declared anywhere in
`full-ai-cluster/k8s`. No root glob matches `arc-runner-set/model-cache-pvc.yaml`,
and no Application's git source covers it, because `arc-runner-set` declares no
git source at all — its only source is a remote OCI chart, which can reconcile
nothing out of this repository.

This is no longer a prose claim. Direction C of
`src/Core.TypeScript/cluster/app-of-apps-discovery.ts` now audits all **57**
non-Application manifests under the applications tree for exactly this. It found
**3** orphans; this is one. The file's own false header comment
("Reconciled by the arc-runner-set Application") has been corrected in place.

### Correction 1 — LATENT, not live

The section above says: *"This is not a future risk; it is the current state
whenever the runner set is synced."* The conditional is right and the framing is
wrong: **the runner set has never been synced anywhere**, so the missing PVC has
never blocked a pod.

- Metal: the k8s layer has never been reconciled. `applications/vault/TOPOLOGY.md`
  is categorical — *"Nothing has been applied to any cluster."* (NixOS itself did
  provision four physical nodes in June 2026; the layer above them did not come up.)
- CI: `argocd-health-test.ts` excludes `arc-runner-set` from the kind lane
  outright, for two independently sufficient reasons — no GitHub App credential
  CI can bind, and `ReadWriteMany` is unservable by `rancher.io/local-path`.

So the PVC is one of **at least three** blockers, and not the binding one. The
others are: no reconciled cluster, and no `arc-github-app` credential (it is
materialised by external-secrets from a Vault that has never been initialised).
Fixing the render path alone would not register a runner.

### Correction 2 — `GET /orgs/{org}/actions/runners` CANNOT SEE THIS RUNNER SET

This one generalises past this work-item, and it invalidates the obvious check.

`gh api orgs/Lucent-Financial-Group/actions/runners` returns `total_count: 0`,
and that zero is **not evidence of anything**. ARC v2 (`gha-runner-scale-set`,
`AutoscalingRunnerSet`) runners are **invisible to that endpoint** — it returns
traditional self-hosted runners only. Scale sets appear in the org settings UI
and have no documented REST equivalent; `actions/actions-runner-controller#2990`
is the standing request for one, and
`GET /orgs/Lucent-Financial-Group/actions/runner-scale-sets` returns **404**
(measured 2026-08-26).

The available control does not rescue it either: `runner-groups` returning
`total_count: 2` proves the *token* works, not that the *endpoint* can see scale
sets. Both groups report `runners: 0`, for the same reason.

**Consequence: do not build a registration monitor on that endpoint.** It would
be red on a perfectly healthy runner and could never go green — a check whose
result carries no information about its subject, which is the same vacuity class
as a check that cannot fail, inverted. Any real monitor has to read the
listener's state in-cluster, which needs the cluster that does not yet exist.

(The conclusion "no runner has ever registered" is still true — it is
established by the three blockers above, not by that API call.)

### Fix directions: still not chosen, and now with the cost named

Direction (1) *separate Application* is the 12-app idiom already used in this
tree and lands in the existing depth-1 roster automatically. Direction (3)
*multi-source* (`spec.sources`) keeps volume lifecycle with the runner set and
is the more faithful reading of "the Application should reconcile its own
manifests" — but **no Application in this tree uses `spec.sources`**, and about
ten tests in `arc-runner-manifests.test.ts` read `spec.source.*` and would need
rewriting. Neither can be confirmed off-cluster.

Registered in `ORPHANED_SUPPORTING_REASONS` meanwhile, so the defect is visible
and drifts in neither direction: if anything ever reconciles this file, the
audit reports STALE-ORPHAN and the entry must go.
