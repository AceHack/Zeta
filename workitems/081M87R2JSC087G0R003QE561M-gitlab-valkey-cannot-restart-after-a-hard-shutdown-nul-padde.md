---
id: 081M87R2JSC087G0R003QE561M
type: bug
state: backlog
priority: P2
slug: gitlab-valkey-cannot-restart-after-a-hard-shutdown-nul-padde
title: "GitLab Valkey cannot restart after a hard shutdown: NUL-padded AOF tail, no self-repair in the pod"
created: 2026-11-24T21:41:01.356Z
depends_on: []
composes_with: []
---

# GitLab Valkey cannot restart after a hard shutdown: NUL-padded AOF tail, no self-repair in the pod

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M87R2JSC087G0R003QE561M-*.md` glob. -->

Measured 2026-11-24 on the owner's node after a hard power cut: `gitlab-valkey-0` crash-looped on
`Bad file format reading the append only file appendonly.aof.447.incr.aof` (the file ended in 682 NUL bytes), so all of
GitLab stayed down until `valkey-check-aof --fix` was run by hand.

Fixed in `full-ai-cluster/k8s/applications/gitlab/Application.yaml`: a repair step in the Valkey container's own startup command, run on every container start (level-triggered,
backup-then-fix, bounded backups), pinned durability flags, `terminationGracePeriodSeconds: 60`. Falsifier
`src/Core.TypeScript/cluster/gitlab-valkey-aof-self-heal.test.ts`; runbook `docs/ops/GITLAB-VALKEY-HARD-SHUTDOWN.md`.

Open follow-up (not this change): the shared `redis` Application (Valkey chart 0.12.0, namespace `redis`) has the same
exposure and no repair.
