---
id: 081M39T5661087G0R001FTJ78W
type: bug
state: backlog
priority: P2
slug: wp11-nobadpods-samples-one-second-after-rootlanded-with-zero
title: "WP11 noBadPods samples ONE second after rootLanded with zero soak -- measures startup ordering churn as a crash"
created: 2026-09-24T13:37:23.649Z
depends_on: []
composes_with: []
---

# WP11 noBadPods samples ONE second after rootLanded with zero soak -- measures startup ordering churn as a crash

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M39T5661087G0R001FTJ78W-*.md` glob. -->

## The finding (run 35996447262, main, first-ever WP11 green attempt)

`noBadPods=FALSE` at elapsed=141s, one pod: `spire/spire-agent-jl9fg`,
`CrashLoopBackOff`, `restarts=1`. `rootLanded=true` at elapsed=140s -- **the
bad-pods snapshot is taken ONE SECOND after ArgoCD's root Application first
appears**, with no wait, no poll, no soak. Confirmed by reading
`full-ai-cluster/nixos/modules/zeta-first-boot-k3s-verify.nix` verdict 6/6:
it runs `kubectl get pods -A --no-headers | grep -E
'ErrImagePull|ImagePullBackOff|CrashLoopBackOff'` exactly once, immediately
after verdict 5 (rootLanded) resolves. No `sleep`, no retry loop -- every
other verdict in this module (`k3sServiceActive`, `nodeReady`, `helmJobs`,
`rootLanded`) polls in a `while ... sleep N` loop; `noBadPods` is the one
exception, and it is the only one that fires on a first-boot cluster that
has JUST started converging.

## Judgement: ordinary startup-ordering churn, not a new defect

**NOT the confirmed-non-metal DNS/hostNetwork race**
(`isKnownSpireAgentDnsCrashLoop` / `spire-agent-hostnetwork-dns-in-nested-
container`). That DIVERGENCE is specifically about Cilium's socket-LB not
covering hostNetwork sockets when k3s runs NESTED INSIDE A DOCKER CONTAINER
(the first-boot-replica.ts lane). WP11 boots the ACTUAL INSTALLED DISK
inside QEMU -- a real VM, not a nested container -- which is exactly the
configuration the existing VM oracle (`nixos/tests/k3s-first-boot-
roster.nix`, run 35706939767) already proved CLEAN of that specific race.
So this is not that bug reappearing; it is a structurally different
instant of the same general phenomenon: **spire-agent (a DaemonSet with no
readiness dependency on spire-server) starting and attempting attestation
before spire-server (a StatefulSet, independently scheduled, its own image
pull and startup time) is ready.** The bootstrap `helm-install-spire` Job
completing (`complete=true failedAttempts=0`, verdict 4/6, same elapsed
window) means the chart's objects were only JUST created moments before
verdict 6 samples -- both spire-server and spire-agent are freshly starting
at that instant, and nothing orders one ahead of the other at the
Kubernetes level.

**And the WP11 lane's own sibling test already established the expected
shape of this exact churn.** The confirmed-clean VM oracle
(081M343EM0R087G0R003C8ZHJ7, run 35706939767, cited in
`first-boot-replica.ts` lines ~642-654) measured spire-agent's
restartCount "held flat (3, settled during ordinary startup churn, then
stable) across a 180s sampling window" on the SAME class of clean VM boot.
`restarts=1` at the earliest possible sampling instant is WEAKER evidence
of a problem than the already-accepted baseline of 3 on the same class of
target -- it is consistent with, not contrary to, what a healthy VM boot
looks like.

**Verdict: the same GENERAL RACE CLASS the repo already understands
(startup-ordering churn during first boot), not the SAME NAMED DIVERGENCE
(that one is proven absent from VMs), and not a genuine cluster defect.**
The defect is in what `noBadPods` measures and when.

## What the verdict should measure instead, with the bound

`noBadPods` should stop being a single snapshot taken at the earliest
possible instant and become a **bounded soak**, the same shape every other
verdict in this module already uses (a `while now<deadline; sleep N` loop)
and the same shape `first-boot-replica.ts` stage 6 already uses for the
identical problem in the Docker-replica lane (`restartCountRegressions` +
`classifySoakRegressions`, 300s soak, "FAIL if any container restartCount
increases while otherwise steady" -- see `dv2-data-split-discipline-
activated.md`'s DST discipline: a converged snapshot that then crash-loops
is not convergence, but neither is a NOT-YET-CONVERGED snapshot a crash).

**Proposed shape**, grounded in the numbers already measured in this repo
(not invented for this run):

1. After `rootLanded`, poll `kubectl get pods -A` on a cadence (15s,
   matching verdict 5's own poll interval) for a bounded window.
2. **Window bound: 180s**, matching the VM-oracle's own already-measured
   settle time (081M343EM0R087G0R003C8ZHJ7) -- not a number picked to make
   today's run pass, a number this repo already spent a run proving is
   where ordinary startup churn on a clean VM settles.
3. A pod counts as bad **only if it is STILL in
   ErrImagePull/ImagePullBackOff/CrashLoopBackOff at the end of the 180s
   window**, OR (stronger signal, matching `restartCountRegressions`) its
   restart count is STILL INCREASING between the second-to-last and last
   sample -- i.e. it has not settled, not merely that it once restarted.
4. Overall unit budget (`DEADLINE_SECONDS=4200`) has ample room: rootLanded
   at 140s + a 180s soak is 320s, under 8% of the total budget.

This is not "raise the tolerance until it passes" -- a pod that never
recovers, or is still climbing restarts at 320s, still fails the check,
loudly, with its restart count reported exactly as today. It changes WHEN
the check looks, using a bound this repo already measured rather than one
invented to clear a specific run.

## `collectAppFailureDiagnostics` does not reach this lane (asked for explicitly)

The diagnostics collector built in `first-boot-replica.ts`
(081M38GCTFX087G0R003MMTXJE) — `describe pod` / `logs --previous` / events
/ generation fields / Application health / controller log — is TypeScript,
wired into the Docker-replica harness only. WP11 is a NixOS systemd module
(`zeta-first-boot-k3s-verify.nix`) running natively on the installed disk;
it shares no code path with `first-boot-replica.ts` and gets none of that
instrumentation. Confirmed by grepping the serial log artifact
(`qemu-k3s-first-boot-verify-serial.log`, run 35996447262): the ONLY
mention of `spire-agent` anywhere in 213KB of serial output is the bare
verdict-6 JSON line itself -- no `describe pod`, no container logs, no
events. If this lane's `noBadPods` fires again after the soak fix above, it
will have nothing beyond namespace/name/status/restarts to diagnose with.
**This is its own finding**: the module should grow the SAME kind of
on-failure diagnostic dump `collectFailureDiagnostics` /
`collectAppFailureDiagnostics` already established as the pattern for this
repo's other cluster-boot lanes -- `kubectl describe pod` + `kubectl logs
--previous` for whatever is still bad at the end of the soak window,
printed to the same serial log everything else already goes to.

## Pointers

- `full-ai-cluster/nixos/modules/zeta-first-boot-k3s-verify.nix` — verdict
  6/6 (`noBadPods`), the fix site.
- `src/Core.TypeScript/ci/qemu-full-install-test.ts` — parses/summarizes
  the verdict JSON; shape must stay byte-identical if the JSON schema
  changes (it currently does not need to for the soak fix above — only the
  TIMING of when the existing `noBadPods` block is computed changes).
- `src/Core.TypeScript/cluster/first-boot-replica.ts` `restartCountRegressions`
  / `classifySoakRegressions` / `rosterHasStabilized` — the three sibling
  soak/settle disciplines this fix should read as precedent, including the
  general lesson `rosterHasStabilized`'s own carved comment states: "a
  single poll's 'nothing wrong' is vacuous while the thing being measured
  is still being created."
- 081M343EM0R087G0R003C8ZHJ7 / run 35706939767 — the VM-oracle measurement
  this fix's 180s bound is grounded in.
- 081M38GCTFX087G0R003MMTXJE — the diagnostics-collector precedent this
  workitem's last section asks WP11 to grow its own version of.
