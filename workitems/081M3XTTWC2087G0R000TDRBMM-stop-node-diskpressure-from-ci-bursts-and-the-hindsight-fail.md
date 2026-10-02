---
id: 081M3XTTWC2087G0R000TDRBMM
type: task
state: backlog
priority: P2
slug: stop-node-diskpressure-from-ci-bursts-and-the-hindsight-fail
title: "Stop node DiskPressure from CI bursts and the hindsight failed-pod storm (GitOps only)"
created: 2026-10-02T08:14:03.138Z
depends_on: []
composes_with: []
---

# Stop node DiskPressure from CI bursts and the hindsight failed-pod storm (GitOps only)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3XTTWC2087G0R000TDRBMM-*.md` glob. -->

The owner's single node (node-5b2dfa, ~119 GiB root) went into DiskPressure on 2026-10-02 and evicted ~150 pods.
GitOps half landed in the PR that carries this item: bounded CI job storage, hindsight held at zero replicas
without its LLM key Secret, and a Failed-pod janitor. Measurements, thresholds and what landed:
`docs/ops/NODE-DISK-HEADROOM.md`.

**Open, needs the owner (OS change or reinstall, deliberately not done here):** put containerd/kubelet data on a
dedicated partition, or enlarge root via `LONGHORN1_TAIL` -- the options and the recommendation are in that doc.
