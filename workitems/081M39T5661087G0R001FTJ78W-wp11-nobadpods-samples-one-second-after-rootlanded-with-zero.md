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

## Implemented (branch claude/wp11-nobadpods-soak-fix)

All four items from this workitem, plus the diagnostics gap, landed:

1. **Soak, not snapshot.** `SOAK_SECONDS=180`, cited at the constant to
   081M343EM0R087G0R003C8ZHJ7 / run 35706939767, explicitly NOT a number
   chosen to pass any specific run. Polls every 15s (`POLL_SECONDS`,
   matching verdict 5's own cadence) up to the soak bound or the unit's
   overall `deadline_ts`, whichever is sooner.
2. **A genuine crash-loop still fails.** A pod counts as settled only once
   TWO CONSECUTIVE samples agree it is neither in the bad-phase set nor
   accumulating restarts (`zeta_wp11_unsettled_pods`) -- guards against the
   known ambiguity that a crash-looping container can read "Running" for
   one sample between crashes. Proven in
   `src/Core.TypeScript/ci/wp11-nobadpods-shell-parity.test.ts`, which
   extracts the two pure decision functions VERBATIM from the `.nix` module
   (same shell-parity discipline as
   `longhorn-capacity-preflight-shell-parity.test.ts`) and runs them under
   a real bash+awk: 8 tests, including "NEVER SETTLES" (restart count
   climbs across 5 simulated samples, unsettled at every one, including the
   last -- the load-bearing proof that the soak can still produce FAIL) and
   "SETTLES LATE" (bad on sample 1, clean with the same restart count on
   sample 2 -> settled, the PASS path this whole fix exists to reach
   honestly).
3. **One line, both outcomes distinguishable.** `noBadPods=true after 62s
   (5 sample(s), 42 pod(s) total, all settled)` vs `noBadPods=false after
   180s (12 sample(s), 42 pod(s) total, deadline reached): spire/spire-
   agent-jl9fg restartCount=7 still unsettled`.
4. **podCount + samples in the JSON**, cheap, reportable-only (does not
   change what `ok` means) -- distinguishes "no bad pods among N" from "no
   pods at all". Added as OPTIONAL fields to
   `K3sFirstBootVerifyVerdict.noBadPods` in `qemu-full-install-test.ts` so
   older verdict JSON still parses; the GH-step-summary line surfaces both
   when present.
5. **Diagnostics gap closed in the same PR** (it was small): `bad_pod_diag`
   mirrors the existing `k3s_diag` function's shape (same file) -- `kubectl
   describe pod` + `logs --previous` (falls back to current) for every
   still-unsettled pod at the end of the soak, mirrored to serial through
   the same `log()` channel everything else in this unit already uses.

Not yet verified end-to-end on a real QEMU boot (that costs a full ISO
build + boot cycle); verified by shell-parity (the actual decision logic,
proven against a real bash+awk) and `tsc`/`bun test` for the TS side. The
next triggered `build-ai-cluster-iso` run is what closes that gap.

## End-to-end verified (run 36020388280, `workflow_dispatch` with `only_wp11: true`, this branch)

The `build-iso-aarch64 + qemu-boot` job -- the one that runs the actual WP11
verify unit on a real QEMU boot of the actual installed disk -- **passed**.
Serial log, verdict 6/6 exactly as designed:

    [wp11-k3s-verify] verdict 6/6 noBadPods=true after 155s (2 sample(s), 38 pod(s) total, all settled)

Two samples (matching `POLL_SECONDS=15`), settled cleanly, the richer
report (sample count + pod count) present in both the log line and the
JSON (`"noBadPods": {"ok": true, "pods": [], "elapsedSeconds": 155,
"podCount": 38, "samples": 2}`). All six verdicts passed on this run.

**The overall workflow run still reported "failure"** -- from two OTHER
jobs (`build-iso`, `k3s HA cluster + replicated Longhorn (3 VMs)`),
unrelated to this fix: `build-iso`'s failure is a disk-floor refusal in a
completely different test scenario (`boot-cluster-up`, WP28's Longhorn-
capacity-preflight work, "BOOT disk /dev/vda is 40 GiB... need >= 122
GiB"), nothing to do with `zeta-first-boot-k3s-verify.nix`. CONFIRMED
pre-existing and branch-independent: the SAME overall "failure" status
occurs on `main` itself, on the SAME run the coordinator cited as WP11's
first clean green (36014672753) -- `gh run list --workflow=build-ai-
cluster-iso.yml --branch main` shows it as `failure` too. This fix's own
job is unaffected and green; the other failure is a separate, pre-existing
issue out of this workitem's scope.

The `k3sActive` addition (item 4 follow-up, commit after this dispatch was
triggered) was NOT covered by this specific QEMU run -- it landed
milliseconds after dispatch, so this run's verify unit predates it by one
commit. Covered by `tsc` + the unchanged 134 shell-parity/unit tests; a
fresh end-to-end run would need a second dispatch if that specific line's
live behavior needs its own proof.
