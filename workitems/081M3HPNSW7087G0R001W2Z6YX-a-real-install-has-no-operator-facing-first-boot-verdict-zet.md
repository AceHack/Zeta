---
id: 081M3HPNSW7087G0R001W2Z6YX
type: bug
state: backlog
priority: P2
slug: a-real-install-has-no-operator-facing-first-boot-verdict-zet
title: "A real install has no operator-facing first-boot verdict: zeta-first-boot-k3s-verify is test-only, so cluster-phase dependency failures are visible only via kubectl"
created: 2026-09-27T15:10:29.255Z
depends_on: []
composes_with: ["081M3BWJ96T087G0R0028WT3S3"]
---

# A real install has no operator-facing first-boot verdict: zeta-first-boot-k3s-verify is test-only, so cluster-phase dependency failures are visible only via kubectl

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3HPNSW7087G0R001W2Z6YX-*.md` glob. -->

## The condition

Found by the first-boot dependency inventory (081M3BWJ96T087G0R0028WT3S3,
`docs/ops/FIRST-BOOT-EXTERNAL-DEPENDENCIES.md`, the paragraph above the cluster table).
Read from source.

`zeta-first-boot-k3s-verify` computes the seven named verdicts (bootedMultiUser …
rosterConverged) that answer "did my install come up", but it is gated by
`unitConfig.ConditionPathExists` on a QEMU-only marker
(`full-ai-cluster/nixos/modules/zeta-first-boot-k3s-verify.nix:30`). On a real install
it is skipped. So every cluster-phase dependency failure — chart repo unreachable,
ImagePullBackOff, ArgoCD `DeadlineExceeded` — is visible only to someone who runs
`kubectl` or `journalctl` on a box nobody may be SSH'd into.

That turns rows 15–21 of the inventory into console-silent failures even where the
cluster itself records them.

## Direction (not chosen here)

A non-blocking, read-only variant on real installs that writes the same verdict JSON to
`/run` and a one-screen summary to the login banner / tty, bounded in time. It must
keep the three-state output (passed / failed / did not run).
