---
id: 081M3BP768B087G0R0010C6GPR
type: bug
state: backlog
priority: P2
slug: verdict-7-never-emitted-a-bound-that-outlives-the-reader-a-p
title: "Verdict 7 never emitted: a bound that outlives the reader, a probe failure read as zero apps, and undecidable firing on ordinary nodeAffinity"
created: 2026-09-25T07:07:03.819Z
depends_on: []
composes_with: []
---

# Verdict 7 never emitted: a bound that outlives the reader, a probe failure read as zero apps, and undecidable firing on ordinary nodeAffinity

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3BP768B087G0R0010C6GPR-*.md` glob. -->

## Three defects, found by the first live run of the thing itself

Dispatch **36097310492** (`only_wp11=true`) on WP11 verdict 7
(081M3BEGSQR087G0R003610CGB). Verdicts 1-6 passed at t=152s. **Verdict 7
emitted nothing at all.** All three defects below are in the check, not in the
cluster; the cluster's own finding is 081M3BPJNRS087G0R0008WFXBZ.

### 1. A bound that outlives its reader is not a bound — the verdict never exists

The bound was 4200s, clamped to the unit's overall `DEADLINE_SECONDS`, on the
stated assumption that the harness's `K3S_VERIFY_TIMEOUT_SECONDS` (4500s) left
~300s of slack.

**It does not.** The harness counts from the **phase-3 login**; the unit counts
from its own **ExecStart**. MEASURED: the harness stopped reading serial while
the unit was still polling at its own `t=3730s` — the two clocks are **~770s
apart**. No JSON block was ever written, so the step failed with the verdict
**ABSENT**.

One thing worked exactly as designed: `summarizeK3sFirstBootVerifyVerdict`
treats an absent verdict 7 as a **FAILURE**, never a pass. That guard earned
its keep on the first run — without it this would have been a silent green.

**Fix:** bound reduced to 3000s, sized from the measured ~770s offset plus a
reporting budget. **This is not relaxing a bound to make a run pass — it is the
opposite.** And it costs nothing measurable: convergence peaked at 25/35 at
t=1214s and went *backwards* thereafter, so the extra wall clock was producing
silence, not convergence.

### 2. A failed probe was read as a negative result

`collect_roster_facts` piped `kubectl get applications -o json` straight into
jq under `|| true`. A kubectl that could not reach the API server produced an
**empty facts file**, which classified as a perfectly clean `0/0` roster.

**MEASURED: 17 of 59 samples** read `0/0 ... zeta-root sync=-` on a cluster
whose peak was 25/35 Synced+Healthy. Had the final sample been one of those 17,
the verdict would have reported `appCount=0` about a cluster it simply failed
to ask.

This is the **exact defect class this verdict was built to catch**, reproduced
one layer down inside the verdict's own collection — the same shape as
`api-unavailable) : ;` in
`.claude/rules/rest-is-the-default-transport-graphql-is-the-contested-budget.md`.

**Fix:** the probe's exit status is checked, and `jq -e 'has("items")'` catches
the empty/truncated body that arrives with exit code 0. A failed sample is
`unknown`: the previous counts **stand** rather than being overwritten with
zeros, it is loud on serial, and the count is carried into the verdict JSON as
`probeFailures` so a reader can tell a quiet cluster from an unreachable one.
Nodes and pods stay non-fatal — they only ever make the exclusion buckets
*smaller*, which is the conservative direction.

### 3. `undecidable` fired on ordinary, perfectly schedulable workloads

The rule was "Pending **and** carries required `nodeAffinity`". That is far too
broad: almost every chart's DaemonSet carries a `kubernetes.io/os: linux`
nodeAffinity, and **every** pod is Pending for a moment while its image pulls.

**MEASURED: it fired on `longhorn` and `node-feature-discovery`** — two
ordinary workloads — and because `undecidable` FAILS the verdict, that would
have made the lane permanently red for a reason about the **check** rather than
about the cluster. A permanently-red lane stops being read.

**Fix:** both conjuncts are now required — the pod must carry required
nodeAffinity **and** the **scheduler itself** must have refused to place it
(`PodScheduled=False`). A pod Pending while pulling an image is not a
scheduling question at all. Two new falsifiers pin each half:
nodeAffinity-without-refusal and refusal-without-nodeAffinity both stay
`unconverged`.

## Verification

All three are covered by `wp11-roster-shell-parity.test.ts` (26 tests, up from
24), which extracts the decision functions verbatim from the `.nix` and runs
them under real bash+awk. The jq changes were run against real jq 1.7.1,
including the `has("items")` guard: an empty Application **list** passes, an
empty or garbage **body** fails.

## Two things this run did NOT establish, said out loud

**The manual-sync exclusion path was never exercised on a cluster.** `excluded`
read **0 on every one of the 59 samples**, because `zeta-root` never completed
a comparison and so `cdi`, `kubevirt`, `ollama` and `vllm` were never created.
That path is covered by `wp11-roster-shell-parity.test.ts` and **not** by any
live cluster. An untested path that everyone believes is tested is how this
class of defect keeps recurring, so it is recorded here rather than assumed.

**The verdict's scope is narrower than its name.** The lane's guest is 4 vCPU /
12 GiB against registered ClusterNodes of 16-22 cores / 66 G — roughly a
quarter of the CPU and a fifth of the memory. That ceiling is hard (the
GitHub-hosted runner is itself 4 vCPU / 16 GiB), and it is now stated in the
module header so a green is not over-read. The cluster consequence is
081M3BPJNRS087G0R0008WFXBZ.

## Cross-lane agreement worth keeping

`cilium`'s `ExcludedResourceWarning: Resource discovery.k8s.io/EndpointSlice
cilium-ingress is excluded in the settings` appeared **here, on real metal**,
independently of the Docker replica that first measured it. Two substrates, two
independent derivations, the same defect named. WP26 owns that fix.
