# Chart assertion census — `Synced + Healthy` is reconciliation, not function

**Date:** 2026-09-09
**Workitem:** `081M241X64R087G0R0038NK0V3`
**Status:** measured. The table below is GENERATED, never hand-maintained —
`bun src/Core.TypeScript/cluster/chart-assertion-census.ts --markdown`.

## The question, and how it sharpened

Aaron, first pass:

> "with the starvation premise, and just our helm charts in general how many are
> fully tested green fully green and have some sort of test to make sure it's not
> vacuous?"

Then, sharpening it, which reordered the work:

> "why can't we attribute when it fails, can we not look at the logs or have some
> post deploy tests to tell what's working and what's not?"

The first half of that second question turned out to be **already solved, and I
had overstated the problem.** The live lane runs, on failure: *Name the drifting
resources (per-Application, failures only)*, *Logs from crash-looping pods,
including the PREVIOUS container*, and *Gatekeeper compiled every
ConstraintTemplate*. That is how `headscale` (probe on the wrong listener) and
`orleans` (`NOAUTH`) were both diagnosed on 2026-09-09. Attribution works for
**independent** failures. It works poorly only for **cascades** — `hat-system`'s
wait-job timeout correctly reported itself while the actual cause was two
ConstraintTemplates failing to compile.

The second half is the finding.

## The measurement

`src/Core.TypeScript/cluster/argocd-health-test.ts` carries **72 references to
`Synced`/`Healthy` and ZERO post-deploy functional assertions.**

The lane workflow is not silent about the running system — it contains `nc -z`
reachability probes against kube-dns and spire-server, and a `git ls-remote`
against the overlay tree. Every one of them prints `OPEN`/`FAIL` and then
`return 0`. They are **diagnostics**, which is the right shape for a diagnostic;
none of them gates.

So the entire lane asserts exactly one class of thing:

> **`Synced + Healthy` is ArgoCD's opinion about RECONCILIATION. It is not
> evidence that anything works.**

And the proof that the gap is real rather than theoretical arrived the same day:
**all seven Hat Constraints were unapplied in runs that reported green**
(`081M241X2YQ087G0R001K95PAB`). A gatekeeper holding zero policies is a
gatekeeper that reconciled perfectly. A post-deploy functional check — submit a
resource the policy should reject, and require the rejection — would have caught
that on the first run. No amount of lane-splitting would have caught it at all.

## What `Healthy` cannot see, structurally

ArgoCD assesses health **per resource kind**, and it has no health check for
most kinds. A Namespace, ConfigMap, Secret, ServiceAccount, RBAC object, CRD or
Gatekeeper Constraint contributes *nothing* to an Application's health verdict.
So an Application whose entire resource set is health-less reports `Healthy` with
identical confidence whether its resources were applied or not.

Measured over the committed manifests:

| chart | health-bearing | health-blind | tier |
|---|---:|---:|---|
| `deepseek-coder` | **0** | 2 | asserted `Synced+Healthy` |
| `qwen-coder` | **0** | 1 | asserted `Synced+Healthy` |
| `hat-system` | 2 | **30** | asserted `Synced+Healthy` |
| `platform` | 2 | **31** | never applied |
| `kubevirt` | 1 | 10 | manual-sync |
| `cdi` | 1 | 8 | manual-sync |
| `orleans` | 1 | 8 | asserted `Synced+Healthy` |

`deepseek-coder` and `qwen-coder` sit inside the lane's 37/37. They were lifted
into the asserted set on the reasoning that they "render exactly one Namespace +
one ConfigMap between them" — which is a correct reason to *apply* them and,
unremarked, the exact reason their `Healthy` verdict carries no information.

**Stated precisely, because the overclaim is tempting.** This does not say those
two are asserted by nothing. `Synced` is still a real signal, and
`failedSyncMessage` refuses an app carrying ArgoCD's own `SyncError` condition.
What it says is that the **health half of the contract is empty for them**, so
the whole assertion rests on the sync half plus a condition check that landed on
2026-09-09 and has one day of evidence behind it. Counting them beside
`cockroachdb` in a single "37/37" hides that difference, and hiding it is what
makes a number feel like proof.

## The census

```
49 charts, 35 asserted Synced+Healthy, 2 manual-sync, 3 applied-unasserted,
9 never applied, 3 healthy-by-vacuity, 0 of 49 with a POST-DEPLOY FUNCTIONAL assertion
```

`helm-unknown` in the table below is the honest answer for a chart Application:
its resources are not in this tree, so nothing here can decide. Reporting `yes`
for them would be the move this census exists to refuse.

<!-- GENERATED: bun src/Core.TypeScript/cluster/chart-assertion-census.ts --markdown -->

| chart | assertion tier | health-bearing | health-blind | what could fail | functional assertion | covered by |
|---|---|---:|---:|---|---|---|
| agent-memory | full | 1 | 2 | reconciliation-only | NONE |  |
| alloy | full | 0 | 0 | helm-unknown | NONE |  |
| arc-controller | full | 0 | 0 | helm-unknown | NONE |  |
| arc-runner-set | applied-unasserted | 1 | 0 | reconciliation-only | NONE |  |
| argo-rollouts | full | 0 | 0 | helm-unknown | NONE |  |
| argo-workflows | full | 0 | 0 | helm-unknown | NONE |  |
| argocd | full | 0 | 0 | helm-unknown | NONE |  |
| cdi | manual-sync | 1 | 8 | reconciliation-only | NONE |  |
| cert-manager | full | 0 | 0 | helm-unknown | NONE |  |
| cilium | not-applied | 0 | 0 | n/a -- never applied | NONE | live kind Cilium CNI + live k3d ArgoCD health |
| cilium-lb-ipam | not-applied | 0 | 2 | n/a -- never applied | NONE | live kind Cilium CNI + live k3d ArgoCD health |
| cloudnativepg | full | 0 | 0 | helm-unknown | NONE |  |
| cockroachdb | full | 0 | 0 | helm-unknown | NONE |  |
| dapr | full | 0 | 0 | helm-unknown | NONE |  |
| deepseek-coder | full | 0 | 2 | healthy-by-vacuity -- nothing exists that could be unhealthy | NONE |  |
| external-secrets | full | 0 | 0 | helm-unknown | NONE |  |
| forgejo | full | 0 | 0 | helm-unknown | NONE |  |
| game-hosting/gmod | not-applied | 1 | 3 | n/a -- never applied | NONE |  |
| gitlab | not-applied | 0 | 0 | n/a -- never applied | NONE |  |
| hat-system | full | 2 | 30 | reconciliation-only | NONE |  |
| headlamp | full | 0 | 0 | helm-unknown | NONE |  |
| headscale | full | 1 | 3 | reconciliation-only | NONE |  |
| hindsight | applied-unasserted | 0 | 0 | helm-unknown | NONE |  |
| keda | full | 0 | 0 | helm-unknown | NONE |  |
| kube-prometheus-stack | full | 0 | 0 | helm-unknown | NONE |  |
| kubevirt | manual-sync | 1 | 10 | reconciliation-only | NONE |  |
| loki | full | 0 | 0 | helm-unknown | NONE |  |
| longhorn | not-applied | 0 | 0 | n/a -- never applied | NONE |  |
| mimir | full | 0 | 0 | helm-unknown | NONE |  |
| nats | full | 0 | 0 | helm-unknown | NONE |  |
| node-feature-discovery | full | 0 | 0 | helm-unknown | NONE |  |
| ollama | not-applied | 0 | 0 | n/a -- never applied | NONE |  |
| open-policy-agent | full | 0 | 0 | helm-unknown | NONE |  |
| openbao | full | 0 | 0 | helm-unknown | NONE |  |
| opensearch | full | 0 | 0 | helm-unknown | NONE |  |
| orleans | full | 1 | 8 | reconciliation-only | NONE |  |
| oz | full | 0 | 0 | helm-unknown | NONE |  |
| platform | not-applied | 2 | 31 | n/a -- never applied | NONE |  |
| qwen-coder | full | 0 | 1 | healthy-by-vacuity -- nothing exists that could be unhealthy | NONE |  |
| redis | full | 0 | 0 | helm-unknown | NONE |  |
| sealed-secrets | full | 0 | 0 | helm-unknown | NONE |  |
| seaweedfs | full | 0 | 0 | helm-unknown | NONE |  |
| spire | full | 0 | 0 | helm-unknown | NONE |  |
| spire-crds | full | 0 | 0 | helm-unknown | NONE |  |
| tempo | full | 0 | 0 | helm-unknown | NONE |  |
| temporal | not-applied | 0 | 0 | n/a -- never applied | NONE |  |
| trust-manager | full | 0 | 0 | helm-unknown | NONE |  |
| vllm | not-applied | 2 | 2 | n/a -- never applied | NONE |  |
| weaviate | applied-unasserted | 0 | 0 | helm-unknown | NONE |  |


## The model-info charts — Aaron's question, answered as a measurement

> *"for the deepseek-coder and the qwen-coder what's special about those charts
> rather than the way we have our multi harness summoner and our own custom
> harness both of which can use ollama and others and even call into other
> harnesses?"*

**Measured answer: nothing is special about them, and they are the two rows the
census marks `healthy-by-vacuity`.** Each is exactly two files — `Application.yaml`
and `configmap.yaml`. No Deployment, no StatefulSet, no Service, no image.
**Nothing runs.** Their own Application header says so: *"This Application is
structural — the model itself is pulled by whichever serving stack you chose."*

### 1. What consumes those ConfigMaps? Nothing.

Searched the whole tree for a consumer — `envFrom`, `configMapKeyRef`, a `volumes.configMap`,
any workload in any namespace. **There is none.** Every reference to the names is
**metadata *about* the charts**, never a reader:

| reference | what it is |
|---|---|
| `lane-footprints.json`, `storage-profiles.json`, `image-footprint.measured.json` | cost rosters |
| `sync-wave-dependency-graph.yaml`, `derive-sync-waves.ts` | wave ordering |
| `ports.ts`, `argocd-health-test.ts`, the test rosters | which lane asserts them |
| `ollama/Application.yaml` | **commented out** — `pull: [ ]` / `run: [ ]`, with `deepseek-coder:33b` and `qwen2.5-coder:32b` sitting in comments |

That last row matters most: **the serving stack these ConfigMaps describe does not
pull either model**, and `ollama`/`vllm` are themselves `excludeGlob`'d *and*
`manualSync`. So the endpoints the ConfigMaps name resolve to Services that exist
in no lane, for models nothing pulls, read by nobody.

### 2. What the harness layer already does — and it disagrees

The worker takes its model backend from the **environment**:

```
apps/workers/src/config.ts     LlmBaseUrl: "LLM_BASE_URL",  LlmModel: "LLM_MODEL"
```

set as **literals** in `agentic-organization/deploy/k8s/30-worker.yaml`:

```yaml
- { name: LLM_BASE_URL, value: "http://ollama:11434" }
- { name: LLM_MODEL,    value: "qwen2:0.5b" }
```

Those are the same two facts the ConfigMaps carry — endpoint and model. So this is
not merely redundancy:

> **Two declarations of one pair, and they disagree.** The worker uses
> `http://ollama:11434` with `qwen2:0.5b`; the ConfigMaps say
> `http://ollama.ollama.svc.cluster.local:11434` with `deepseek-coder:33b` /
> `qwen2.5-coder:32b`. **The one nothing reads is the one shipped as an ArgoCD
> Application.**

The agent-cli carries a third pair (`AGENTIC_ORG_LLM_BASE_URL` / `_MODEL`), also
from env. Nothing anywhere resolves a model endpoint through Kubernetes.

**Deliberately not "fixed" by editing one to match the other.** Which value is
intended is a question the tree does not answer, and picking a winner without
knowing is the single-version-of-the-truth collapse this repo already refuses
(`dv2-data-split-discipline-activated.md`, raw vault). Both are recorded; the
maintainer decides.

### 3. Disposition

| chart | disposition | reason |
|---|---|---|
| `deepseek-coder` | **RETIRE** (proposed) | nothing consumes it; the harness carries the same pair in env and disagrees with it; it contributes one uninformative green to the 37/37 |
| `qwen-coder` | **RETIRE, with `deepseek-coder`** | same measurement — **and a coupling**: `qwen-coder` ships no Namespace of its own. It targets `models`, which `deepseek-coder/configmap.yaml` creates. Retiring one alone breaks the other |

**Retiring removes charts rather than adding assertions**, which is the cheaper
direction and matches the preference stated for the lanes the same day. It also
*shrinks* the vacuity class rather than documenting it.

**Not executed here.** Deleting a chart is a catalogue decision; the census records
the measurement and the proposal, exactly as the lane audit does. If the answer is
keep, the honest alternative is to make the ConfigMap *load-bearing* — have the
worker read `LLM_BASE_URL`/`LLM_MODEL` from it via `envFrom` — which would end the
divergence, give the chart a consumer, and make its `Healthy` verdict mean
something for the first time.

### How big is the class?

**Three**, and the third costs nothing:

| chart | tier | why it is / is not a problem |
|---|---|---|
| `deepseek-coder` | asserted `full` | **counted as proof** |
| `qwen-coder` | asserted `full` | **counted as proof** |
| `cilium-lb-ipam` | never applied | blind, but asserted by nothing, so it claims nothing |

Plus `ddns` — the one directory the census cannot see, having no `Application.yaml`.
So: **a pair, not a large class.** The category is named anyway, because it is the
class that grows silently — every future "just a ConfigMap" Application lands in it
by default, and until now would have been counted beside `cockroachdb`.
## Charts that belong to no job

Nine directories are excluded from the dev root's glob, so no lane applies them.
Two are covered elsewhere; **seven are covered by nothing live**, and until now
that fact lived only in prose comments inside `ports.ts` — readable, not
checkable, and silent about whether another job picked them up.

| chart | covered by | note |
|---|---|---|
| `cilium` | live kind Cilium CNI + live k3d | bootstrapped directly, not through ArgoCD |
| `cilium-lb-ipam` | live kind Cilium CNI + live k3d | kind lane substitutes a manifest |
| `longhorn` | **nothing** | a kind node has no second disk; the lane substitutes a StorageClass *named* longhorn, so the consumers are asserted and the chart is not |
| `ollama` | **nothing** | GPU model-serving; no runner has a GPU |
| `vllm` | **nothing** | same |
| `gitlab` | **nothing** | 20 images, the largest footprint in the catalogue. Aaron retired the either/or posture with forgejo on 2026-09-06, so this is a COST deferral, not a design one |
| `temporal` | **nothing** | lane cost |
| `platform` | **nothing** | 33 resources, 31 of them health-blind — the largest unasserted surface in the tree |
| `game-hosting/gmod` | **nothing** | 2048Mi of a 9216Mi budget to prove a Source-engine server idles |

`NEVER_APPLIED_COVERAGE` now holds these, and the check reads **three ways** — an
excuse that outlives its defect is how a registry becomes a lie:

| direction | verdict |
|---|---|
| a new never-applied directory with **no entry** | **fails** — a chart that belongs to no job |
| an entry for a directory a lane **now applies** | fails as **stale** |
| an entry naming a directory the tree **no longer has** | fails as an **orphan** |

**The third one was written and falsified by nothing** until a review flagged
`NEVER_APPLIED_COVERAGE` as an unused import in the test file. The flag was
correct, and *deleting the import would have been the wrong fix*: the import was
not decoration, it was added for an assertion that never got written. So the
import is **used** and the branch got its falsifier — a small instance of exactly
what this census exists to find, caught inside the census itself.

The `FUNCTIONAL_ASSERTIONS` half of that refusal could not be reached at all,
because the map is empty by design. `censusFailures` now takes both registries as
**injectable parameters** — not for flexibility, but so a branch that cannot
execute stops being a branch that cannot fail.

**One stated limit.** The census keys on Application *directories*, so a
directory carrying manifests and no `Application.yaml` is invisible to it. There
is exactly one: `ddns`, a lone CronJob. No lane applies it, nothing asserts it,
and this census does not report it — recorded rather than quietly fixed, because
widening the key would change what every other row means.

## Proposal — post-deploy functional assertions

The count is **0 of 49** in this tree, and it is **derived**, not hand-set — see
*How the count stays true* below. Ranked by *what a silent failure costs*, not by
ease:

| # | chart | the assertion | why it is first |
|---|---|---|---|
| 1 | `open-policy-agent` / `hat-system` | submit a resource a Hat Constraint must REJECT; require the rejection | this is the failure that already happened. A policy engine holding zero policies reconciles perfectly, and only an attempted violation can tell the difference |
| 2 | `openbao` | `bao status` — require `Sealed: false` | a sealed store is `Healthy`. Every consumer that reads a secret then fails does so for a reason no per-app verdict names |
| 3 | `spire` | request an SVID for a known workload entry and require one back | identities nobody can obtain is the same shape: the server is up, the function is absent. The lane already *probes* spire-server's port and discards the result |
| 4 | `cockroachdb` / `redis` | a round-trip: write a key, read it back | membership and quorum are invisible to pod readiness. `cockroachdb` already needed one PostSync deadlock fixed to reach Healthy at all |
| 5 | `orleans` | require the silo to report cluster membership | 8 of its 9 resources are health-blind; its StatefulSet running says nothing about whether a silo joined |
| 6 | `seaweedfs` / `weaviate` | PUT then GET an object | storage that accepts writes and loses them is the canonical silent failure |

**Shape, so the first one sets the pattern rather than a precedent to argue
with:** a `Job` in the lane cluster, running the check as a normal workload,
whose completion the step waits on. Not a `kubectl exec` from the runner — the
runner is outside the mesh, and a check that has to reach in is a check that
tests the reaching. Each one is a `zeta.io/functional-test` labelled Job, and
its failure names the chart.

**Cost.** Each Job is seconds and reuses an image already pulled for the chart
it tests. The green run finished in **513 s against a 2400 s cap** (4.7×
headroom), so there is room for all six without touching the cap. That headroom
is also what refuted the starvation premise — see below.


## How the count stays true — the registry is DERIVED

The first version of `FUNCTIONAL_ASSERTIONS` was a **hand-written map** with a
docstring promising *"an entry must name a path that EXISTS"*. **That refusal was
never implemented.** It went unnoticed because the map was empty, so the promise
was never load-bearing — *unmetered by virtue of being unused*, which is the
vacuity class in the file whose whole job is naming it.

It was also the drift shape refused two files over: `hat-constraint-roster.ts`
exists precisely so a list of seven policy names is derived rather than restated,
and then this registry was hardcoded anyway.

**And a hand-written map made the number depend on merge order.** The first real
functional assertion (the live gatekeeper-sync step) and this census live in two
different pull requests. Whichever landed second owed a hand-edit — at an
**unattended** moment, since auto-merge is armed — or `main` would carry a census
reporting a count that had stopped being true. The census, of all things,
reporting a stale number.

Deriving it removes all three at once:

| before | after |
|---|---|
| a promised refusal with no implementation | a derived entry names a step that exists **by construction** — the refusal is unnecessary rather than unimplemented |
| a restated list that can drift | nothing is restated |
| a count that depended on merge order | a count that is a **function of the tree it is read in**, true in every order, owed to nobody |

### The convention

A workflow step that is a post-deploy functional assertion **declares itself**:

```yaml
      - name: Gatekeeper syncs the kinds the Hat policies read
        env:
          ZETA_FUNCTIONAL_ASSERTION_FOR: hat-system
```

Declared on the **step**, so it cannot drift from the thing it describes, and
machine-readable, so *"does a functional assertion exist for this chart"* stops
being a question anyone answers from memory.

Parsed as **YAML, never grepped**. This repo's workflows carry long `#` comment
blocks that quote their own mechanisms, and a marker inside a comment is not a
declaration — a grep would count it and report coverage that does not exist. That
is the same trap `parseMisePin` documents for the .NET pin, and there is a test for
it here.

**Stated limit:** this finds steps that *declare themselves*. A gating functional
check written without the marker is invisible, which **under-reports** rather than
over-reports — the safe direction, and what makes the number a floor rather than a
claim. The complementary risk, a marker on a step that gates nothing, is not
machine-checkable from YAML, which is why the marker is a declaration a reviewer
can see rather than a heuristic.

### Report the ratio, never the bare count

`0 of 49`, not `0`; and when the first one lands, **`1 of 49`, not "we have
post-deploy testing"**. A single entry is a foothold. The ratio answers what is
*actually* tested; a non-zero flag would answer a question nobody asked.
## What this DEMOTES: the per-chart-set split

The hypothesis that the lane was resource-starved is **refuted**: the green run
reached 37/37 in 513 s against a 2400 s cap. The split's remaining value is
**cascade isolation** — a failure naming its own cause — which is real but
narrow, since attribution already works for independent failures (the three
diagnostic steps above).

So the split drops to second priority behind the functional-assertion gap. Its
design doc (`docs/research/2026-09-09-one-kind-cluster-per-chart-set-*.md`) keeps
its five open questions. The one piece of it worth landing regardless was
Aaron's own: *a check that fails when a chart belongs to no job* — which is in
this census, and which is worth more than the split.

## Pointers

- `src/Core.TypeScript/cluster/chart-assertion-census.ts` — the census and its refusals
- `src/Core.TypeScript/cluster/hat-constraint-roster.ts` — the first crack in the
  reconciliation-only wall: the seven Hat Constraints must EXIST, not merely compile
- `src/Core.TypeScript/cluster/argocd-health-test.ts` — the 72 `Synced`/`Healthy`
  references, and `failedSyncMessage`, the guard that catches a failed sync ArgoCD admits to
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — an assertion with no falsifier is
  `unmetered`, never "real by default"
