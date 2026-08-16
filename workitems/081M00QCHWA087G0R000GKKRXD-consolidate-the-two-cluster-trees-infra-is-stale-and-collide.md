---
id: 081M00QCHWA087G0R000GKKRXD
type: task
state: backlog
priority: P1
slug: consolidate-the-two-cluster-trees-infra-is-stale-and-collide
title: "consolidate the two cluster trees: infra/ is stale and collides with full-ai-cluster/ on the argocd/zeta-root identity"
created: 2026-08-14T18:08:43.914Z
depends_on: []
composes_with: []
---

# consolidate the two cluster trees: infra/ is stale and collides with full-ai-cluster/ on the argocd/zeta-root identity

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00QCHWA087G0R000GKKRXD-*.md` glob. -->

## The finding

`infra/k8s/` + `infra/nixos/` and `full-ai-cluster/k8s/` + `full-ai-cluster/nixos/`
are two independent declarations of the same cluster. They are not
complementary and they cannot coexist in one cluster.

**Mechanical proof of the collision** — both trees declare the SAME Kubernetes
object identity with different sources:

```
$ bun src/Core.TypeScript/cluster/single-node-readiness.ts
[blocker] root-app-collision: 2 app-of-apps roots claim the single Kubernetes
identity Application/argocd/zeta-root but point at 2 different source paths.
    full-ai-cluster/k8s/bootstrap/root-application.yaml -> full-ai-cluster/k8s/applications
    infra/k8s/applications/root-application.yaml        -> infra/k8s/applications
```

Both roots carry `prune: true` + `selfHeal: true`. Kubernetes has exactly one
object at `argocd/zeta-root`, so whichever is applied last owns the name and
ArgoCD prunes the other tree's entire child Application graph. This is why
"point the live health test at both trees" is not a cheap option: it needs two
separate clusters, doubling the most expensive job in
`k8s-argocd-health-test.yml`.

## Which tree is live — evidence, not preference

| signal                          | `infra/`                               | `full-ai-cluster/`                                        |
| ------------------------------- | -------------------------------------- | --------------------------------------------------------- |
| last commit                     | 2026-08-08 `951e2ec370` (no PR number) | 2026-08-14 `2943971f0b` (#10503)                          |
| installed by `zeta-install.sh`  | no                                     | yes                                                       |
| referenced outside its own tree | only `infra/README.md` + docs          | `tools/setup/linux.sh`, installer, NixOS tests            |
| ArgoCD Applications             | 7                                      | 43                                                        |
| NixOS modules                   | 4                                      | 24 (disko shapes, join observer, GPU passthrough, SSH CA) |
| NixOS VM tests                  | 0                                      | 4 (`k3s-agent-join`, `k3s-cluster-init`, …)               |

`full-ai-cluster/nixos/modules/k3s-server.nix` also carries four fixes that were
each earned empirically, with the node id and date in the comment: the
`tokenFile` crash-loop on `--cluster-init` (node-115f93, 2026-06-05), the
duplicate default StorageClass (node-09485d, 2026-06-07), the Cilium rpfilter
DNS blackhole (node-09485d, 2026-06-07), and the Longhorn `preUpgradeChecker`
fresh-install deadlock. `infra/nixos/modules/k3s-server.nix` has none of them.

## `infra/` is not merely stale — it cannot run on the PoC box

- `infra/k8s/applications/longhorn`: `defaultReplicaCount: 2` on one node leaves
  every volume permanently Degraded, and `persistence.defaultClass: true`
  collides with the `zeta-local-path` default class that
  `full-ai-cluster/nixos/modules/local-storage.nix` declares — two StorageClasses
  both marked default is an invalid config in which a class-less PVC binds
  non-deterministically. It also omits the `preUpgradeChecker.jobEnabled: false`
  that `full-ai-cluster` needs to avoid a fresh-install deadlock.
- `infra/k8s/applications/cockroachdb`: `statefulset.podAntiAffinity.type: hard`
  with `replicas: 3` on one node leaves 2 of 3 pods Pending forever.

Making CI green for `infra/` would mean making CI accept a configuration that
cannot come up on the target hardware.

## Recommendation

Delete `infra/k8s/` and `infra/nixos/` in one commit (super-greenfield rule), and
in the same commit fix the surfaces that cite them:

- `infra/README.md` — the bootstrap order it documents is `full-ai-cluster`'s.
- `docs/ZETA-CORE-TECHNOLOGY-FOR-MAX.md` lines ~160-167 — a PARTNER-FACING doc
  that lists `infra/k8s/applications/cilium/` and `infra/k8s/applications/argocd/`
  as "Deployed". Neither directory exists in `infra/`; both exist under
  `full-ai-cluster/`. This is wrong today, independent of the deletion.
- `infra/nixos/hosts/control-plane/README.md`.

Then delete the `acknowledgedRootAppDuplicates` entry from
`full-ai-cluster/k8s/single-node-budget.json`, which turns the collision check
back into a live gate.

## Why this is not done in the PR that filed it

Deleting ~20 files across two trees is a maintainer decision, and PR #10652
deliberately surfaced the duplication without deleting either tree. GOVERNANCE
round-29 discipline: a CI/infrastructure decision of this size lands after human
sign-off, not before. The collision is recorded in the ledger with this
work-item id so it is visible and diffable in the meantime.

## Done when

- [ ] Maintainer confirms `full-ai-cluster/` is the surviving tree.
- [ ] `infra/k8s/` and `infra/nixos/` deleted; citing docs corrected in the same commit.
- [ ] `acknowledgedRootAppDuplicates` is empty and the auditor still exits 0.
- [ ] **The two CODE consumers below are migrated in the same commit** (added by
      verification 2026-08-16 — the original consumer list was docs-only and
      incomplete).

---

## Verification pass (shadow, 2026-08-16) — one row of the evidence table is FALSE

Re-measured against the tree at `ab2d4acb96`. The finding's core holds; one
supporting row does not, and it is the row the deletion plan rests on.

**Held, re-measured directly:**

| claim                                                                                                           | verdict                                                                                       |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| two `Application/argocd/zeta-root` objects, different `spec.source.path`, both `prune: true` + `selfHeal: true` | **held** — read both manifests                                                                |
| `infra/` ArgoCD Applications = 7                                                                                | **held** — 7                                                                                  |
| `infra/` NixOS modules = 4, VM tests = 0                                                                        | **held** — 4 / 0                                                                              |
| `full-ai-cluster/` is far larger and carries the empirically-earned k3s fixes                                   | **held** — 45 Applications, 23 modules, 4 VM tests (counts drifted from 43/24/4 since filing) |

**FALSE — "referenced outside its own tree: only `infra/README.md` + docs":**

`infra/` has **two live CODE consumers** the evidence table misses, and deleting
the tree without migrating them breaks the repo:

1. **`flake.nix` (repo root)** — `nixosConfigurations.control-plane`,
   `.worker-gpu-01`, `.worker-gpu-02` import
   `./infra/nixos/hosts/*/configuration.nix`, and `nixosModules.{common,
k3s-server, k3s-agent, gpu}` ARE `./infra/nixos/modules/*.nix`. Deleting
   `infra/nixos/` breaks `nix flake check` and every documented
   `nixos-rebuild switch --flake .#control-plane`. Note the root flake and
   `full-ai-cluster/flake.nix` are two separate flakes — the same two-trees
   split, one level up.
2. **`src/Core.TypeScript/ace/deps.ts:429`** — `generateArgoCD()` emits
   Applications whose `spec.source.path` is
   `` `infra/k8s/applications/${chart}` ``. It ships in the `ace` CLI
   (`ace.ts:2011`) and is exercised by `deps.test.ts:348`. After the deletion
   this generator emits manifests pointing at a path that no longer exists — and
   the test does not assert the path, so **nothing goes red**. It fails silently,
   in generated output, at deploy time.

So the deletion is a **migration, not a sweep**. Consolidation still looks
right; the _plan_ was under-scoped.

**Could not enumerate** (stated rather than glossed): whether any machine
outside this repo — the PoC box, an operator laptop, a flashed USB image —
already tracks `.#control-plane` from the root flake. That is off-repo state,
not knowable from here, and it is why the flake row matters beyond CI.

**Not done here, deliberately.** Deletion is gated on the maintainer sign-off
this item already names, and the tree is now _proven referenced by code_ rather
than merely suspected — so the ambiguity is recorded and the tree stays in
place. Nothing was deleted.

**Separately confirmed while measuring:** `single-node-readiness.ts` exits 1 on
`main` today — a `false-redundancy` blocker for `full-ai-cluster/kubevirt`
(`replicas: 2`, no anti-affinity), introduced by #11089 after the ledger was
written. Already being fixed on `fix/ledger-ack-kubevirt-false-redundancy`;
noted here only so the next reader knows the auditor's red is that, not this.
