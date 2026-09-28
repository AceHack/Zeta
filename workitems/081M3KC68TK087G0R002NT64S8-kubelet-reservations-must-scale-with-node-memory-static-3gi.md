---
id: 081M3KC68TK087G0R002NT64S8
type: bug
state: backlog
priority: P2
slug: kubelet-reservations-must-scale-with-node-memory-static-3gi
title: "kubelet reservations must scale with node memory: static 3Gi reservation refuses to start k3s on small nodes"
created: 2026-09-28T06:45:43.379Z
depends_on: []
composes_with: []
---

# kubelet reservations must scale with node memory: static 3Gi reservation refuses to start k3s on small nodes

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3KC68TK087G0R002NT64S8-*.md` glob. -->

## Defect

PR #17728 raised the server's static kubelet reservation to kube-reserved 2Gi +
system-reserved 512Mi + eviction-hard 500Mi = 3060Mi. The kubelet refuses to
start when reservations exceed node memory capacity ("Failed to start
ContainerManager ... invalid Node Allocatable configuration"), so k3s.service
exited 1 on the 2560 MB NixOS test VMs (build-ai-cluster-iso run 36379743833:
cluster-init, platform-fixes, agent-join, server-join, datastore-sentinel) and
would on any real node under ~3 GiB.

## Fix

`k3s-kubelet-reservations.sh` (oneshot before k3s.service, wanted not required)
sizes kube-reserved / system-reserved / eviction-hard / eviction-soft to the
booted node: role targets unchanged when they fit in 25% of MemTotal (every
node >= ~12 GiB keeps #17728's values), scaled proportionally otherwise (25% is
GKE's first-tier rate); hard eviction 5% (100Mi floor, 500Mi cap), soft 10%
(>= 2x hard, 1Gi cap); CPU clamped to 25% of cores. Written to a k3s config
file via K3S_CONFIG_FILE; MemoryLow re-set at runtime to the granted
kube-reserved. Falsifiers: `full-ai-cluster/nixos/modules/k3s-process-protection.test.ts`.
