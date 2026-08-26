# The k8s pre-hardware verification census — four depths, and what is genuinely irreducible

**Date:** 2026-08-26
**Author:** shadow (autonomous tick)
**Measured at:** `89c8a23c40` (worktree cut from `origin/main`)
**Register:** every number below is `metered` unless the row says otherwise. Claims about
what *would* happen on other hardware are marked `speculative` and are not counted.

---

## 0. Why this document exists, and the correction that shaped it

Aaron:

> *"we've done a ton of multi lane helm chart testing to make it where we can test all our
> helm charts on constrained runners, maybe we've not split this into lanes but we need to
> test every k8s yaml possible pre-hardware in workflows and CI and only leave the absolute
> minimal to real human intervention hardware testing"*

and, correcting an under-estimate of existing coverage:

> *"we have a bunch of workflows around qemu and other k8s / kind and other similar testing
> to test the actual charts work, we've been doing a lot of this"*

**The second quote is correct and the first framing was too pessimistic.** This census was
commissioned on the belief that ArgoCD `Application` CRs were largely unrendered — that the
highest-value missing check was "resolve every Application's chart and `helm template` it."
**That check already exists and already runs.** The honest finding is that pre-hardware
coverage is deep, and the residual is small and mostly *named with reasons already*.

What was actually missing was not a check. It was **a guarantee that the existing checks are
looking at anything at all** — and two ways they could silently stop were found, reproduced,
and closed.

---

## 1. The four depths (they get conflated, and they are not the same claim)

Any statement of the form "the manifests are validated" is ambiguous across four
strictly-increasing strengths. This census separates them throughout.

| # | depth | what it proves | what it CANNOT catch |
|---|---|---|---|
| **D1** | **parsed** | the file is syntactically YAML, no duplicate keys, no tab indentation | anything semantic |
| **D2** | **schema-validated as written** | each resource in the file matches its Kubernetes API schema | a chart that will not render; wrong values; anything about the *referenced* chart |
| **D3** | **rendered + schema-validated** | the pinned chart at its pinned version resolves, renders with *our actual values*, and the **output** is schema-valid | anything requiring a running control plane — admission, scheduling, health, ordering |
| **D4** | **applied to a live cluster and asserted** | ArgoCD actually syncs it and the workload reports Healthy | anything needing real hardware the runner lacks |

D2 is where most "we validate our YAML" claims quietly stop. D3 is the one that catches the
class Aaron cares about — *broken values that pass a YAML parse and fail at apply time.*

---

## 2. The inventory (verified, not trusted)

| tree | `.yaml`/`.yml` files | ArgoCD `Application` CRs |
|---|---|---|
| `full-ai-cluster/k8s` | **116** | **48** (47 × `Application.yaml` + 1 root) |
| `infra/k8s` | **15** | **8** (7 × `Application.yaml` + 1 root) |
| `agentic-organization/deploy` | **12** | 0 (raw manifests, `kubectl apply -f`) |

The brief's opening figure of "51 files containing `kind: Application`" is an artifact of an
**unanchored** grep: `kind: Application` also matches `kind: ApplicationSet`, and three of the
51 are prose — two Markdown docs and a comment inside
`full-ai-cluster/k8s/sync-wave-dependency-graph.yaml`. Anchored (`^kind: Application$`) the
count is **48**. Only **2** `Chart.yaml` exist in the tree, both under
`examples/helm-dependency-graph/` — so, correctly, most Applications point at remote charts.

**Application source split** (`full-ai-cluster/k8s`, measured): **36 Helm-source**,
**11 directory-source**, + the root App-of-Apps. Directory-source Applications have no chart
to render, so D3 does not apply to them — their content is raw manifests *in this repo*,
which D2 already covers.

---

## 3. Coverage census — what reaches each depth today

### D1 + D2 — `gate.yml` job `lint (yaml/k8s)` — **REQUIRED**

The only k8s validation inside the blocking floor. `yamllint -d relaxed` + `kubeconform
-strict -ignore-missing-schemas -kubernetes-version 1.33.0` over **all 143 files** across the
three trees. Plus three offline cross-document audits with their own mutation suites
(cluster-tree consumers, observability chain, agentic-org apply set).

**The gap inside the required lane, and it is structural:** kubeconform is invoked with

```
-skip "Application,Blueprint,CiliumL2AnnouncementPolicy,...,HelmChart,Policy"
```

`Application` is the **first entry**. So **the 48 ArgoCD Application CRs are excluded from
schema validation in the only required check.** This is a defensible choice — the Application
CRD is not in the default schema registry, and without the skip the step would error rather
than validate — but it means *the required floor validates the manifests the Applications
deploy, not the Applications themselves.* Everything that checks an Application's shape lives
in non-required workflows (D3 and D4 below).

### D3 — `helm-validate.yml` job `chart pins + helm template + kubeconform` — **not required**

This is the check the brief proposed building. It exists, it covers both trees, and it was
run in full for this census:

| tree | charts rendered | documents rendered | resources kubeconform **validated** | resources **skipped** (no schema) |
|---|---|---|---|---|
| `infra/k8s` | **6 / 6** | 185 | **132** | 52 |
| `full-ai-cluster/k8s` | **36 / 36** | 865 | **695** | 152 |
| **total** | **42 / 42** | **1050** | **827** | **204** |

Zero `helm template` failures on either tree. `full-ai-cluster` carries **13** known
Application-contract failures held at an exact ceiling by
`infra/k8s/tests/ratchet-app-failures.ts` (`BASELINE_FAILURES: 13`), every one of them a
missing `syncPolicy.automated.prune` / `selfHeal` / `CreateNamespace=true` — **not** a render
failure. The ratchet fails if the count rises *or* falls without the baseline being edited.

Worth stating because it is easy to read past: **204 of 1031 rendered resources (19.8%) are
`Skipped` by kubeconform** for want of a schema — CRs belonging to CRDs the charts themselves
install. Those are rendered and parsed, never schema-checked. That is honest D3-minus, and it
is now *printed on every run* rather than hidden inside a summary line.

### D4 — `k8s-argocd-health-test.yml` — **not required**

Live **kind** clusters (the brief said k3d; `--provider kind` is what CI runs), real ArgoCD,
real sync, real health assertions, plus separate lanes for Cilium-as-CNI and a
kubevirt/CDI emulation proof. The `--scope included` plan, measured:

| | count |
|---|---|
| Applications in the plan | **46** |
| asserted **Synced + Healthy** on a live cluster | **28** |
| asserted at the weaker **manual-sync** contract (exists, compares cleanly, not Degraded) | **5** |
| excluded from live assertion | **13** |

Every exclusion carries a named blocker and a `LIFTS WHEN:` clause in
`DEV_INCLUDED_PROOF_DEFERRED_DIRS` / `APPLIED_BUT_UNASSERTED_REASONS`, and
`src/Core.TypeScript/cluster/reason-truth.ts` exists specifically to check that those reasons
are **true** and not merely present — the drift-checked-acknowledgement pattern applied to
prose. That machinery is better than what this census was asked to produce, and it already
runs.

### The lane work Aaron remembered — it exists, and it stops one step short

`k8s-lane-partition.yml` derives a lane matrix, and per lane: asserts the runner really has
the envelope's capacity, **renders every chart in the lane**, pulls the lane's images, and
measures real on-disk delta against a budget — failing if the lane does not fit or if any
image will not pull.

**Confirmed: it never creates a cluster and never applies anything.** It answers *"does this
lane fit on a constrained runner"*, which is the prerequisite for a per-lane deploy, and the
deploy step was never built on top of it. That is the single clearest place where existing
machinery is one step from more coverage — see § "what Aaron must decide".

### Summary table

| depth | mechanism | required? | full-ai-cluster coverage |
|---|---|---|---|
| D1 parsed | `gate.yml` yamllint | **yes** | 116 / 116 files |
| D2 schema (as written) | `gate.yml` kubeconform | **yes** | all files, **minus 20 skipped kinds incl. `Application`** |
| D3 rendered + schema | `helm-validate.yml` | no | **36 / 36** Helm-source Applications |
| D4 live cluster | `k8s-argocd-health-test.yml` | no | 28 Synced+Healthy, 5 manual-sync, 13 excluded |

**The honest headline: nothing in the 116 files is unverified. What varies is the depth, and
the deepest two lanes are not in the blocking floor.**

---

## 4. What was actually broken — two silent-coverage defects, reproduced and closed

Both are the same class: *the tool works perfectly and is pointed at less than it claims.*
Neither is catchable by testing the tool's logic, because the logic is not what fails.

### 4.1 The render lane could validate ZERO charts and report success — `metered`

`validate-applications.ts` builds a `charts` array from Applications carrying
`spec.source.chart`. Tests 7 and 8 iterate that array. **There was no guard on it being
non-empty**, in a file that *does* guard `apps.length === 0`.

Reproduced at `89c8a23c40` on a synthetic apps-dir holding one valid directory-source
Application:

```
=== Test 7: exact chart VERSION exists in repo index ===

=== Test 8: helm template + kubeconform on the rendered output ===

========================================
Results: 7 passed, 0 failed
All checks passed.
```

Exit **0**. `helm template` was never invoked. `kubeconform` was never invoked. Both tests
printed their headings and iterated zero times.

`full-ai-cluster` is accidentally protected because its ratchet compares to an *exact* count,
so a silent drop to zero renders moves the number and goes red. **`infra/k8s` has no ratchet**
— it is validated by a bare `--render`, and a silent drop to zero renders there is a clean
green.

**Closed by Test 9**, which asserts three separate things because they are three different
questions: were there charts to render; did helm succeed at least once; did kubeconform
*schema-validate* (as opposed to *skip*) a non-zero number of resources. That third one is
what `-ignore-missing-schemas` can quietly zero out. The real tree now prints, and asserts:

```
PASS: rendered 36/36 charts into 865 documents;
      kubeconform schema-validated 695 resources (152 skipped for want of a schema)
```

### 4.2 An Application in a differently-named file was invisible to every check — `metered`

`findApplicationYamls` matches the **exact filename** `Application.yaml`. That convention was
enforced nowhere. Measured: renaming `orleans/Application.yaml` to `orleans/orleans-app.yaml`
and re-running the pre-fix validator gives

```
Results: 32 passed, 0 failed
All checks passed.
```

exit **0**, with the string `orleans` appearing **zero times** in the output. Coverage fell
from 38 passes to 32 — one entire Application silently left the input set — and nothing
said so.

**Closed by Test 0**, which walks every `*.yaml`/`*.yml` under the apps-dir, and fails on any
file containing an anchored `kind: Application` + `apiVersion: argoproj.io/` that the
discovery rule cannot reach. The declared root app is exempt **by path, not by name**, since
the two trees legitimately place it differently. Green on both real trees today (47 + root,
7 + root), so it lands as a ratchet, not a debt.

### 4.3 A defect in the fix itself, recorded because it is the more instructive one

The first version of Test 9's kubeconform-summary parser matched `Valid 14`. kubeconform
v0.7.0 emits `Valid: 14`. The parser fell through to `{0, 0}` and Test 9 reported
*"schema-validated ZERO resources"* against a render where kubeconform had validated **132**.
A check built to stop false reports produced one on its first contact with the real tree.

Fixed twice over: the regex accepts both forms, **and** an unparseable summary now returns
`null` and is **refused with a named failure** rather than silently counted as zero. A parser
that returns zero on no-match is itself a false-report generator.

### 4.4 A vacuous falsifier, caught by mutating the falsifier

The first zero-charts test case mutated the seven real manifests to strip their Helm sources.
The edit broke YAML indentation in four of them, so the run exited 1 with **five** failures —
and the case passed *whether or not Test 9 existed*. A falsifier satisfied by an earlier
guard.

Caught by stubbing Test 9's refusal to a pass and observing the case stay green. Rewritten
against a **synthetic** tree whose only defect is having nothing to render, and it now asserts
the exact failure count (`Results: 8 passed, 1 failed`) so a second failure cannot satisfy it.

**Verification of both new falsifiers**, by stubbing each refusal in turn:

| state | result |
|---|---|
| both refusals stubbed to passes | **2 fail**, 12 pass — both new cases red |
| restored | **14 pass**, 0 fail, 28 assertions |

Existing suite: 12 → 14 cases, all green. Ratchet: **exactly 13**, unchanged (the change adds
two passes and zero failures).

---

## 5. The irreducible-requires-hardware list, with a per-item reason

This is the list Aaron asked for. **The important column is the last one** — most items are
*capacity* or *credential* limits, not physics. Only the first group is genuinely
hardware-bound.

### Genuinely irreducible — no CI runner can do this

| item | reason | class |
|---|---|---|
| **`ollama`, `vllm`** (GPU model-serving) | Inference requires a physical GPU. Hosted runners have none. The Applications are applied and their *manifests* asserted; the **serving** is not. | hardware |
| **`longhorn`** (the chart itself) | Distributed block storage wants real devices and >1 node. Dev substitutes a `longhorn`-named StorageClass over `rancher.io/local-path` so *dependent* PVCs bind — the chart itself cannot be proven this way. | hardware |
| **`agent-memory`** (ReadWriteMany) | No single-node dev provisioner serves RWX. Excluded by a rule (`yamlTreeRequestsReadWriteMany`), not by name. | hardware |
| **`cilium`, `cilium-lb-ipam`** | L2 announcement / LoadBalancer IPAM need a real L2 segment. `kind` uses its default CNI. A **separate lane** brings kind up *with* Cilium as CNI and asserts it — so this is partially reduced already. | hardware (partial) |
| **USB-provisioned node reformat retention** (`081KSNY2Z0008QG0R0008PN7RQ`) | Tests whether data survives a physical reprovision. Explicitly out of scope of the ArgoCD harness, by its own note. | hardware |
| **Secure boot / real firmware / zflash** | QEMU+UEFI lanes cover the pre-hardware half; attestation against real silicon cannot be emulated. *(YubiHSM lane is another agent's — PR #15564, untouched here.)* | hardware |

### NOT irreducible — capacity or credential, reducible with a decision

| item | reason | what would close it |
|---|---|---|
| **`gitlab`** | ~40 subcharts, multi-GB images, several PVCs — will not schedule inside the lane's budget on a standard runner. | a larger runner, or a lane of its own. **Capacity, not hardware.** |
| **`arc-runner-set`** | Needs a GitHub App credential + live runner registration CI has no secret for. | a scoped credential decision. |
| **`hindsight`** | Three independent blockers; the first is `FailedScheduling: Insufficient cpu` on a 1-node runner. Its `valuesObject` is also written against a chart schema `hindsight 0.3.0` does not have. | capacity + a manifest fix. |
| **`platform`, `temporal`, `weaviate`** | Named blockers in the deferral registry, each with a `LIFTS WHEN:` clause. `weaviate` has two `type: LoadBalancer` Services that cannot be Healthy on a kind node. | per-item; several are one manifest change. |
| **`forgejo`** | Standby half of an either/or Git-host pair; ships manual-sync **by design**. Proving it means running both Git hosts at once, which its own header forbids. | a design decision, not a capability. |
| **The 20 kubeconform-skipped kinds in the required lane** | No schemas in the default registry — including `Application` itself. | extract CRD schemas from the charts and feed `-schema-location`. **Reducible, unbuilt.** |
| **204 skipped resources at D3 (19.8%)** | Same cause, one layer out: CRs of CRDs the charts install. | same fix. |

**The distinction matters because "requires hardware" is being used for both groups today,
and only the first group earns it.**

---

## 6. What Aaron must decide

Five decisions. None is taken here; nothing was added to `gate (required)`'s `needs`.

1. **Should D3 (`helm-validate`) join the blocking floor?** It renders 42/42 charts, has a
   mutation suite, and now asserts a non-zero validated-document count. Its cost is a network
   dependency on third-party Helm repos — which is exactly why it was kept advisory, and that
   reasoning is still sound. *Recommendation: promote the `structural` (offline) job, which
   has no network dependency; leave the `charts` job advisory.*

2. **Should `Application` come off the required lane's kubeconform `-skip` list?** The CRD
   schema can be extracted and pinned. Today the only required check does not schema-validate
   the 48 CRs that drive the entire GitOps tree.

3. **Is 19.8% skipped-for-no-schema acceptable at D3?** Feeding chart-installed CRDs into
   `-schema-location` is a known, unbuilt piece of work. It converts ~204 resources from
   "rendered" to "schema-validated".

4. **Should `k8s-lane-partition` grow a deploy step?** It already proves each lane *fits* on a
   constrained runner and pulls its images. Adding cluster-create + apply per lane is the
   single largest available increase in D4 coverage, and the capacity question it exists to
   answer is already answered. *This is the direct answer to "maybe we've not split this into
   lanes" — the split exists; the deploy does not.*

5. **`gitlab` and `hindsight` are capacity, not hardware.** If a larger runner is authorized
   they leave the hardware list. If not, they should be *relabelled* as capacity-deferred so
   the hardware list stays honest.

---

## 7. What this change ships

- `infra/k8s/tests/validate-applications.ts` — **Test 0** (discovery completeness) and
  **Test 9** (non-zero rendered/validated assertion), plus a kubeconform summary parser that
  refuses what it cannot read.
- `infra/k8s/tests/validate-applications.test.ts` — two falsifiers, both verified red under a
  stubbed fix, one of them rewritten after it was found vacuous.
- No workflow edits. **`gate (required)`'s `needs:` is untouched.** Both new tests ride the
  lanes that already run `validate-applications.ts`.
- Nothing deployed to any real cluster.

**Register:** §2–§4 are `metered` (reproduced locally, commands and outputs above). §5's
hardware/capacity split is `metered` where it cites a measured blocker from the deferral
registry and `consistent with` where it infers that a larger runner would suffice — that has
not been run. §6 is a set of open questions, not claims.

---

## Pointers

- `infra/k8s/tests/validate-applications.ts` · `.test.ts` — the validator and its falsifiers
- `infra/k8s/tests/ratchet-app-failures.ts` · `FULL-AI-CLUSTER-FAILURE-BASELINE.md` — the exact-count ceiling
- `src/Core.TypeScript/cluster/argocd-health-test.ts` — D4, the deferral registry, `LIFTS WHEN:` clauses
- `src/Core.TypeScript/cluster/reason-truth.ts` — checks that a deferral reason is *true*, not merely present
- `src/Core.TypeScript/cluster/lane-partition.ts` — the constrained-runner lane machinery that stops before deploy
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the register discipline used above
- `.claude/rules/never-assume-malice-where-mistake-is-possible.md` — every defect here is ordinary error, several of them mine, made in the same session that found them
