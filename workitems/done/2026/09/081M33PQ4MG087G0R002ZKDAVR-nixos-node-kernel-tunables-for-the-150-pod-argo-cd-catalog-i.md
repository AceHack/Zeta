---
id: 081M33PQ4MG087G0R002ZKDAVR
type: task
state: done
priority: P1
slug: nixos-node-kernel-tunables-for-the-150-pod-argo-cd-catalog-i
title: "NixOS node kernel tunables for the ~150-pod Argo CD catalog (inotify, vm.max_map_count) + CI sysctl parity"
created: 2026-09-22T04:41:50.992Z
completed: 2026-09-22T04:59:21.658Z
depends_on: []
composes_with: []
---

# NixOS node kernel tunables for the ~150-pod Argo CD catalog (inotify, vm.max_map_count) + CI sysctl parity

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M33PQ4MG087G0R002ZKDAVR-*.md` glob. -->

## Problem

grep found NO kernel tunables anywhere in `full-ai-cluster/nixos/modules/` — no
`fs.inotify.*`, `vm.max_map_count`, `fs.file-max`, or nofile overrides — while the
control-plane boots a single-node k3s cluster running ~150 pods from the Argo CD
catalog. Classic single-node crash-loop causes: `fs.inotify.max_user_instances`
default (128, host-wide) exhausted by kubelet + config-reloaders + log tailers;
OpenSearch needs `vm.max_map_count >= 262144` and its chart's own privileged
sysctl init container is off (`sysctlInit.enabled: false`). The Docker CI lanes
(kind/k3d in `k8s-argocd-health-test.yml`) inherit the GitHub runner's own kernel
sysctls, not NixOS's, so they could never catch this drift.

## Delivered

- `full-ai-cluster/k8s/node-tunables.json` — single source of truth (values +
  measured host defaults + citations) for `vm.max_map_count` (262144),
  `fs.inotify.max_user_instances` (512), `fs.inotify.max_user_watches` (524288).
- `full-ai-cluster/nixos/modules/k8s-node-tunables.nix` — applies the JSON via
  `boot.kernel.sysctl`, imported from `common.nix` (control-plane + worker-gpu +
  worker-template all inherit it).
- `full-ai-cluster/nixos/tests/k8s-node-tunables-eval-test.nix` — eval-only test
  against the real `nixosConfigurations.control-plane` / `.worker-gpu`, registered
  in `flake.nix` as `checks.<system>.k8s-node-tunables-model` and named in
  `build-ai-cluster-iso.yml`'s "checks this lane is the only evaluator of" list.
- `src/Core.TypeScript/cluster/node-tunables.ts` (+ `.test.ts`) — the TS twin;
  `--apply` runs `sudo sysctl -w` for every declared entry.
- `.github/actions/apply-node-tunables/` — composite action wired into all six
  `live-*` jobs in `k8s-argocd-health-test.yml`, right after `bun install`,
  before cluster creation.

LimitNOFILE was investigated and found ALREADY correct: nixpkgs' own k3s systemd
module (`mkRancherModule`) sets `LimitNOFILE=1048576` on the k3s unit already,
matching upstream k3s's `install.sh`; containerd and every pod process fork from
that same tree and inherit it. No change needed there.

`first-boot-replica.ts` (mentioned as possibly landing from a concurrent WP) was
not present on `main` as of this branch's `origin/main` merge — nothing to wire.
