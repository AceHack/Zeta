# One kind cluster per chart-set: the design, the measurements that refute the starvation premise, and the questions that need a human

Status: **DRAFT, awaiting maintainer sign-off.** No workflow change lands from this
document until the numbered questions in section 7 are answered. The one artifact
shipped alongside it is the coverage falsifier (section 5), which is worth having
whether or not the split happens.

Author: shadow-subagent, 2026-09-09. Work-item 081M23BVN6C087G0R000JEC15P.

## 1. What Aaron asked for

> "when i say lanes i was talking a different enabled chart per cluster bringup a
> different job, they can even be run in parallel if you do this since it will be
> on different runners."

and, on cost:

> "our runners are free we are open source."

So the target is **one kind bring-up per chart-set, in its own job, in parallel**,
chosen for ISOLATION and ATTRIBUTION rather than for saving minutes.

## 2. The premise that motivated it is REFUTED by measurement; the ask survives anyway

The reason offered for the split was that the single lane might be starved or
timing out, so later sync waves never ran. That is measurably not what happened.

| run | verdict | time to the verdict | cap | apps ok |
|---|---|---|---|---|
| `34338106811` | GREEN | **513 s** | 2400 s | 37/37 |
| `34323056405` | RED | 497 s to 35/37, then 1900 s of no movement | 2400 s | 35/37 |

The green run reached a full verdict with **4.7x headroom**. The red run reached
35 of 37 in the same 8 minutes and then sat for another 32 minutes on exactly two
Applications -- `headscale` and `orleans` -- both genuinely broken (a probe on the
metrics listener instead of the main one; a Secret minted into a namespace the
consuming pod does not run in). Neither was starved.

The apps that looked starved were not:

| app | reported | actual reason |
|---|---|---|
| `cdi`, `kubevirt` | `OutOfSync/Missing` | **`manualSync: true`** -- ArgoCD never auto-syncs them, by declaration. `Missing` is expected. Asserted under `manualSyncAssertion` plus a separate `live kind kubevirt+cdi emulation proof` job |
| `weaviate`, `hindsight` | `OutOfSync/Progressing` | **`excludedFromDev: true`** -- outside the asserted set |
| `cockroachdb`, `nats`, `opensearch`, `agent-memory` | `OutOfSync/Healthy` in the post-run dump | StatefulSet drift; all four were counted **ok** by the proof's own final poll 18 seconds earlier |
| `hat-system` | `OutOfSync/Healthy` | A REAL defect, and a different one: two ConstraintTemplates never compiled (081M23B24P5087G0R002BJWEN1) |

The post-run diagnostics dump is read AFTER the verdict, and ArgoCD re-syncs on a
~5-minute cycle, so that dump catches whatever reconcile is in flight. In the
GREEN run it lists **20** Applications as `OutOfSync` -- more than the red one.
Reading drift from it is reading a moment, not a state.

**The ask survives the refutation, on the other reason.** Isolation is about
ATTRIBUTION, not headroom: with 37 Applications in one cluster a failure is scoped
to "something in this cluster", and the two-app case above took a full log read to
narrow. With one bring-up per chart-set, the failing job names the chart-set.

## 3. Parallelism, measured rather than assumed

The question was whether a wide matrix serialises into queue time. It does not, at
the width we run today:

| run | `plan` finished | live jobs started | spread |
|---|---|---|---|
| `34338106811` | 10:09:31 | 10:09:32 - 10:09:36 | **4 s**, 6 jobs |
| `34367032579` | 15:01:06 | 15:01:07 - 15:01:12 | **5 s**, 6 jobs |

Six concurrent jobs start together with no measurable queueing. What DOES queue is
the front of the run: `34338106811` was created at 10:03:03 and `plan` started at
10:06:46 -- **3 m 43 s** before anything ran, a per-run cost the split neither
changes nor multiplies.

This is evidence for 6. It is NOT evidence for 15 or 30, and this document does
not claim it is. The honest test is to split, measure, and read the spread again.

## 4. The wall-clock arithmetic

From `34338106811`, the included-proof job decomposes as:

| phase | duration |
|---|---|
| checkout + toolchain install + bun deps | 3 m 34 s |
| kind create + Gateway CRDs + secrets + ArgoCD install + lane-tree serve | 2 m 00 s |
| **Synced+Healthy wait (37 apps)** | **8 m 33 s** |
| diagnostics + teardown | 0 m 36 s |
| total | 14 m 43 s |

So **~6 m 10 s is fixed per job** and is paid N times by an N-way split; only the
8 m 33 s divides, and it divides badly -- it is dominated by image pulls and by the
slowest single Application in each set, not by app count. `forgejo` alone held the
last 62 seconds of the green run.

Wall-clock floor for any split: **~6 m 10 s + the slowest chart-set's wait**.
Against 14 m 43 s today, a split plausibly lands near 9-10 minutes. Real, and not
the main reason to do it.

Runner-minutes rise from ~15 to roughly `N x 8`. Free, per Aaron. The resource that
is NOT free is named in section 6.

## 5. Most of the machinery already exists, and it is Aaron's own

`src/Core.TypeScript/cluster/lane-partition.ts` was written to Aaron's 2026-08-22
observation -- "if we have independent helm chart groups we can test those
independently" -- and already:

- derives **dependency closures** from `full-ai-cluster/k8s/sync-wave-dependency-graph.yaml`, so a chart-set contains what its members need, by construction;
- prices each closure against a measured runner envelope;
- emits a CI matrix (`--matrix`);
- computes `laneRootExclude(model, lane)` -- **the root App-of-Apps exclude glob that would bring up only that lane's Applications**;
- quarantines what it cannot place, naming the artifact that blocks it.

`.github/workflows/k8s-lane-partition.yml` already runs **a matrix job per lane**.
Those jobs pull the lane's images and measure real on-disk cost against the
budget. They do not create a cluster and they do not sync anything.

**So the gap is narrow and nameable:**

1. `argocd-health-test.ts` needs to accept a lane's root-exclude glob and restrict its expected set to that lane's `assigned` list. `laneRootExclude` already produces the glob; `--serve-tree` already rewrites a STAGED copy of the tree, never the committed one.
2. `k8s-lane-partition.yml`'s `lane` job gains the bring-up and proof steps.
3. The packer's objective changes. Today it packs to FIT and produces 2 lanes, one holding 39 of 47 apps -- which buys almost no attribution. Isolation wants more, smaller sets.

Point 3 is the actual design decision and it belongs to a human. Section 7.

### The coverage falsifier, which ships now regardless

`lane-partition.ts` PRINTS `covered by a lane: 47/49`. Nothing failed when that
ratio dropped, and `k8s-lane-partition.yml` fails only on a **zero-lane** matrix.
A single Application quietly leaving every lane -- a new chart, a changed
dependency edge, a footprint that grew past the budget -- was invisible. A split
built on that would be a quiet way to stop testing something.

The check now in `lane-partition.test.ts`: every Application the **included proof**
asserts is either assigned to **exactly one** lane, or quarantined **with a named
artifact**. Duplicate assignment fails too, because an app asserted in two lanes
hides which lane proved it. Mutation-tested: silently dropping an unpriced app
fails 3 tests; emptying a quarantine reason fails 2.

## 6. The resource that is genuinely scarce

Not minutes. **Registry pulls.** Each bring-up pulls its chart-set's images fresh,
and `k8s-lane-partition.yml` already carries a 3-attempt retry with the comment
"registry throttles are transient" -- so throttling has already been met at the
current width. An N-way split multiplies pulls of the shared hub images
(`cert-manager`, `cilium`, `longhorn` are replicated into every lane that needs
them, by design). Anonymous Docker Hub and ghcr limits are per-IP and per-hour,
and a hosted runner's IP is shared.

This is measurable before it bites: pull failures are already counted and already
fail the lane. It is named here so the first wide run's failures are read as
throttling rather than as broken charts.

## 7. Questions for the maintainer, with the shape of the answer each needs

**Q1. What is the isolation unit?**
Expected answer: a number, or a rule. "One job per dependency closure" gives ~47
jobs and maximum attribution. "Cap assigned-apps-per-lane at K" gives ceil(47/K)
jobs and is a one-line change to the packer. Today's packer answers neither: it
packs to fit and returns 2 lanes, one holding 39 apps.

**Q2. Does the split REPLACE `live kind included Synced+Healthy proof`, or run beside it?**
Expected answer: replace / beside. Replacing loses the only place that proves all
37 Applications coexist in ONE cluster -- cross-namespace Secrets, shared
StorageClasses, admission webhooks that see every namespace. That is exactly where
the `orleans` `redis-auth` defect lived. Running beside costs nothing but keeps a
14-minute job on the critical path.

**Q3. Which of the two currently-uncovered apps is allowed to stay uncovered?**
Expected answer: per app. `gitlab` is oversize (`cpu 2525m > 2125m`) and needs a
self-hosted runner or a smaller dev rung. `hat-system` is unpriced because
`ghcr.io/lucent-financial-group/hat-system-operator:placeholder` does not exist --
a DANGLING reference, fixed by publishing the image or pointing at a real one, not
by a bigger runner.

**Q4. Is `k8s-lane-partition` allowed into `gate (required)`?**
Expected answer: yes / no. It is path-filtered today, so a chart change triggers it
but a change elsewhere does not. If the split becomes the primary proof, the gate
must require it or a red split lane will not block a merge.

**Q5. What is the per-lane timeout?**
Expected answer: seconds. The 2400 s cap was sized for 37 Applications and was used
at 21% in the green run. A per-lane cap of 900 s would fail a stuck lane in 15
minutes instead of 40, which is most of the attribution benefit on its own.

## 8. What this document does NOT recommend

- Trimming coverage to make a split cheaper. There is nothing to save.
- Removing `cdi`/`kubevirt` from the roster. They are declared `manualSync`, are
  asserted under the weaker manual contract AND by a dedicated emulation job, so
  the roster is not over-claiming. The earlier reading that it was came from the
  raw `kubectl get applications` dump rather than from the proof's own verdict.
- Splitting inside the existing job. Aaron was explicit that a lane means its own
  cluster bring-up on its own runner.

## Pointers

- `src/Core.TypeScript/cluster/lane-partition.ts` -- closures, pricing, `laneRootExclude`, quarantine
- `.github/workflows/k8s-lane-partition.yml` -- the per-lane matrix job that exists today
- `src/Core.TypeScript/cluster/argocd-health-test.ts` -- `discoverExpectedApplications`, `applicationOutcome`, `--serve-tree`
- 081M23B24P5087G0R002BJWEN1 -- the hat-system Rego defect this investigation surfaced
- 081M23BCR90087G0R002GYP7TE -- the proof could not see a failed sync
