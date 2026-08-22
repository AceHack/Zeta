# One tree, two substrates — the resource-rung override trade

**Status:** decision input. **Not a recommendation.** Both options below are live; the
choice is the maintainer's, and this document exists so that it is made on numbers
rather than on whichever gate happened to be green.

**Measured 2026-08-22** in a clean checkout at `origin/main`, every exit code read
directly and never through a pipe.

---

## 0. What forces a choice at all

`full-ai-cluster/k8s/bootstrap/root-application.yaml` points the metal cluster at
`main` / `full-ai-cluster/k8s/applications`. The CI lane's root
(`buildRootDevCatalogManifest`, `DEFAULT_ROOT_DEV_CATALOG`) points at **the same path**
with an exclude glob. One committed tree, two substrates, **no override point**.

So a request written into an `Application.yaml` is written for both machines at once,
and the two machines are not close:

| substrate | CPU | memory | provenance |
|---|---|---|---|
| GitHub hosted `ubuntu-24.04` standard | **4000m** | 15360Mi | vendor spec, and `--measure-runner` convicts a smaller machine |
| smallest registered `ClusterNode` | **16000m** | 62942Mi | `maintainers/Addisons820/cluster-nodes/node-ad1efd/node.yaml`, written by a real metal boot |
| largest registered `ClusterNode` | 22000m | 62942Mi | `maintainers/maximdolphin/cluster-nodes/node-5b2dfa` (`nproc` on a 16-core / 22-thread part) |

**~4x**, and a number sized for one is wrong for the other in a way that is not
symmetric: an over-request on the runner is a Pending pod (loud, scheduler-attributed);
an under-request on metal is a pod the kubelet may evict under pressure (quiet, and it
looks like a crash).

## 1. The arithmetic

Cohorts: the **dev lane** is the 37 Applications the CI root applies; the **metal
cohort** is the 46 the bootstrap root applies (read off the root, not assumed).

| cohort | at `metal` | at `dev` |
|---|---|---|
| dev lane (37 apps) | **4231m / 11427Mi** | 1906m / 6207Mi |
| metal cohort (46 apps) | **8106m / 19752Mi** | 5016m / 13348Mi |

| comparator | value | verdict at `metal` | verdict at `dev` |
|---|---|---|---|
| runner budget (4000m − 1500m reserved) | 2500m / 9216Mi | **over by 1731m / 2211Mi** | fits, 594m / 3009Mi spare |
| smallest measured node (raw, ×1 node) | 16000m / 62942Mi | fits, 7894m / 43190Mi spare | fits, 10984m / 49594Mi spare |

Two facts fall out of that table and both matter to the decision:

1. **`dev` on metal is not a capacity failure — it is unused reservation.** The box has
   room for either rung. What the `metal` rung buys is *reserved* headroom, i.e. a
   scheduling guarantee, not throughput.
2. **No app-local fix closes the CI gap.** `mimir` is 1610m and `hindsight` 1000m of the
   4231m; removing hindsight entirely still leaves 3231m, over by 731m. The cut has to
   be lane-wide, or it has to not be a cut at all.

Full per-app breakdown of the dev lane at each rung (`metal` → `dev`): mimir 1610→635,
hindsight 1000→400, seaweedfs 500→200, redis 300→150, node-feature-discovery 200→100,
open-policy-agent 200→100, arc-controller 100→50, minio 100→50, cdi/forgejo/kubevirt/alloy
unchanged. **30 governed rows across 9 directories; 27 of the 30 differ between rungs.**

## 2. Option A — apply `dev` to the committed tree

```
bun src/Core.TypeScript/cluster/storage-profiles.ts --resource-profile dev --apply
# then: ledger.activeResourceProfile: "dev"
```

**Machinery cost: none.** The verb exists, the ladder exists, the check exists. It is
one command plus a one-word ledger edit, and `rung-coverage` goes from *carried debt* to
*no finding* because CI would then budget the rung the tree carries.

**What it costs on metal.** 27 of 30 governed rows drop. The metal cohort's reservation
falls 8106m → 5016m, so the 16-core box reserves 31% of its CPU instead of 51%. Nothing
becomes unschedulable; what changes is that **mimir, hindsight, seaweedfs, redis, OPA and
minio stop having a floor**. Under node pressure the kubelet evicts by QoS, and a pod
whose request is below its working set is the first one out. Aaron's own framing, from
the catalogue: *"cutting a request below the app's real working set does not make the app
smaller… it moves the failure from a Pending pod (loud, scheduler-attributed) to the
kernel OOM killer (quiet, arbitrary)."*

**The honest counterweight**, and it is real: **no `metal` number in the affected rows is
a measurement of the workload.** `metalSource: chart-default` on hindsight's three rows —
and across the ladder **21 of the 30 governed rows** are `chart-default`, covering six of the nine governed directories (hindsight, mimir, minio, open-policy-agent, redis, seaweedfs). So the thing being
given up is *the upstream chart author's guess*, not our measurement of the working set.
That does not make the cut free; it makes both sides of it reservations, and only one of
them is ours.

**Reversibility:** total. `--resource-profile metal --apply` puts it back, and both rungs
stay in the catalogue either way.

## 3. Option B — build a per-substrate override point

Four shapes, cheapest first. All four end the "one tree" property in some form; they
differ in how much.

### B1 — a second committed rendering (`applications-dev/`)

Keep `applications/` at `metal`; commit a generated `applications-dev/` at `dev` and
point the CI root at it.

- **Machinery:** extend `applyResourceProfile` to write to a target directory; a CI check
  that regenerates and diffs (drift is then a red build, not a surprise). Perhaps 150–250
  lines and one workflow step.
- **What breaks:** the tree is duplicated — 46 Application CRs exist twice. Every future
  edit to an Application must land in a generator or in both copies; that is exactly the
  second-source-of-truth failure the catalogue's own `crossCheckResourceCoverage` exists
  to refuse elsewhere. It is *containable* by generation, and containable is not free.
- **Also:** `acknowledgedRootAppDuplicates` already records that two roots claiming
  `argocd/zeta-root` prune each other. A third committed tree is a third chance at that.

### B2 — Helm parameter overrides from the root, per cluster

- **Machinery:** the roots apply *directories of Application CRs*, not charts, so there is
  no `spec.source.helm.parameters` seam at the root to use. Getting one means converting
  the App-of-Apps into an **ApplicationSet** with a cluster generator.
- **What breaks:** the App-of-Apps pattern that the whole bootstrap is written around,
  plus `app-of-apps-discovery.ts`, the depth-1 cohort assumption in the catalogue, and the
  `include`/`exclude` glob reasoning both roots depend on. This is the largest change and
  the one least compatible with a near-term hardware bring-up.

### B3 — a Kustomize overlay per substrate

- **Machinery:** an overlay directory with resource patches per Application; the metal
  root keeps the base, the CI root takes the overlay.
- **What breaks:** less than B1 (patches are small, not whole CRs) but the catalogue's
  verifier reads *dotted paths in the Application's own `valuesObject`* — so
  `verifyResourceProfileApplied` would have to learn to read a patched tree, or stop being
  able to check the dev rung at all. The check is the asset; teaching it a second shape is
  where the cost lands.

### B4 — make the substrates match instead (bigger runner)

The dev lane at `metal` needs **5.731 vCPU** (4231m + 1500m reserved) and 17571Mi. An
8-vCPU / 32 GB runner absorbs it with room, and the whole question disappears: one tree,
one rung, both gates about the same thing.

- **Machinery:** none in this repo — a runner label and an envelope edit
  (`runnerEnvelope` in `storage-profiles.json`, which `--measure-runner` then checks
  against the real machine).
- **What it costs:** money per minute, on every PR, forever; and it makes the CI lane
  stop being a proxy for a small machine, which is the thing that has been surfacing
  these numbers at all. Note this does **not** make `metal` fit — the 46-app cohort at
  `metal` is 8106m — it makes the *dev lane* fit.

## 4. What is decided either way

Nothing in this document is blocked on the choice, and that is deliberate:

- `compute-provenance` compares the active rung against measured hardware today, under
  either option. It is green now (8106m against 16000m) and it will convict if the
  catalogue outgrows the box or a smaller box registers.
- `rung-coverage` carries the CI/tree disagreement as **stated debt** with all four
  numbers pinned (`metal@dev-lane=4231m/11427Mi>>2500m/9216Mi`). Option A deletes that
  entry. Option B deletes it too, by making the two rungs no longer a disagreement.
- `activeResourceProfile` is now required in the ledger. Whichever option is taken, the
  tree has to say which substrate its numbers are for.

## 5. Two measured asides that are not part of the decision

**The unit trap, found while building the comparator.** Both registration scripts capture
storage with `lsblk` (**binary** human sizes) and memory with `free -h --si` (**decimal**),
one line apart in the same function. `931.5G` of disk is 931.5 GiB; `66G` of RAM is
62942 MiB, not 67584 MiB. Reading memory as binary would have inflated the bound by
4642 MiB per node — the **acquitting** direction, which is the one that hurts. Separately,
`hardware.cores` is `$(nproc)`, i.e. **logical CPUs**: `cores: 22` on a 16-core /
22-thread Ultra 9 185H. The thread count is the right number for a Kubernetes comparison
(it is what the kubelet reports as `capacity.cpu`); the field's *name* is what is wrong.
Both are recorded at the parsers in `single-node-readiness.ts`.

**Two registrations, one MAC.** `maintainers/maximdolphin/cluster-nodes/node-5b2dfa` and
`node-f82aa6` record the same `network.mac` (`b0:41:6f:17:87:cc`) and identical hardware.
That is consistent with one physical machine registered twice, four hours apart. It does
not affect any number above — `nodeCount` is 1 and the comparator uses the *smallest*
node — but if `nodeCount` is ever raised from the registration count, it would double-count
a box that does not exist. Recorded as an observation, not fixed here, and not inferred
into a cause.

## Pointers

- `src/Core.TypeScript/cluster/single-node-readiness.ts` — `findComputeProvenance`,
  `findRungCoverage`, `findResourceProfileDrift`, `siMemoryToMib`, `coresToMillis`
- `src/Core.TypeScript/cluster/storage-profiles.ts` — `metalAppliedDirs`, `ciBudgetedProfile`
- `full-ai-cluster/k8s/single-node-budget.json` — `activeResourceProfile`,
  `acknowledgedComputeShortfall`, `acknowledgedRungBudgetGap`
- PR #13663 — where both findings were named and left as maintainer calls
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — a reservation with no falsifier
  behind it is `unmetered`; that is what the 21 `chart-default` rows are
