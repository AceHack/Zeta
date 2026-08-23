---
id: 081M0QHPF6Z087G0R0026RMZ6B
type: task
state: backlog
priority: P2
slug: cdi-kubevirt-s-120m-is-now-governable-the-divergence-objecti
title: "cdi/kubevirt's 120m is now governable — the divergence objection has a falsifier, and Kustomize is NOT the way to spend it"
created: 2026-08-23T14:51:49.343Z
depends_on: []
composes_with: []
---

# cdi/kubevirt's 120m is now governable — the divergence objection has a falsifier, and Kustomize is NOT the way to spend it

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QHPF6Z087G0R0026RMZ6B-*.md` glob. -->

## What changed, and what it unblocks

`cdi` (100m) and `kubevirt` (10m x 2 pods) sit in `unreachableGitPathRequests` as
**reachable and deliberately refused**. The refusal was correct and its stated reason
was: the manifests are vendored byte-for-byte from upstream, `--apply` would rewrite
them, and `single-node-budget.json` says an edit "would make the checked-in copy
diverge from the cluster it documents, which is a worse lie than this one."

That reason rested on a sentence in a YAML comment. It is now a check:
`src/Core.TypeScript/cluster/vendored-upstream-parity.ts` sha256s both copies against
the pinned upstream release digests on every CI run of the cluster plan job, and both
were **measured identical** 2026-08-23:

| file                                                               | sha256             | upstream                                            |
| ------------------------------------------------------------------ | ------------------ | --------------------------------------------------- |
| `full-ai-cluster/k8s/applications/cdi/cdi-operator.yaml`           | `e96d59ab…a222015` | `containerized-data-importer` v1.65.0 release asset |
| `full-ai-cluster/k8s/applications/kubevirt/kubevirt-operator.yaml` | `d1d8264e…3857eda` | `kubevirt` v1.8.4 release asset                     |

So the divergence fear now has a falsifier. **That does not by itself make governing
them right** — it makes the objection checkable instead of assumed, which is the
precondition.

## The shape a governed row would have to take

Same shape as the three git-path rows landed 2026-08-23 (`gmod`, `platform`,
`agent-memory`):

- `metal` reproduces the upstream literal **exactly** (cdi 100m/150Mi, kubevirt
  10m/450Mi x2), so `--resource-profile metal --check` stays 0 and the **committed**
  bytes stay byte-identical to upstream. The parity check above is what proves that,
  and it would go red the moment it stopped being true.
- `dev` carries the lower number, written only into a working tree.

**The remaining objection is real and is NOT closed by this PR.** `argocd-health-test.ts`
records it: `--apply` rewrites the working tree, ArgoCD syncs the committed tree, and
`full-ai-cluster/k8s/bootstrap/root-application.yaml` points the metal cluster at the same path — _"one
committed tree, two substrates, no override point."_ That is the general
`acknowledgedRungBudgetGap`, not something specific to these two files. Nothing here
resolves it; what is resolved is only "would this fork upstream", and the answer is
now measurable rather than feared.

## Kustomize was evaluated and is NOT the way — measured, not argued

The obvious "reference upstream + patch" migration is a Kustomize remote base plus a
strategic-merge patch. It renders correctly and costs too much elsewhere.

**The render is clean.** `kubectl kustomize` over an overlay carrying only the cpu
delta, semantic per-object diff against today's directory render:

- `cdi`: 9 objects in, 9 out, **one** field changed (`100m -> 25m`)
- `kubevirt`: 11 objects in, 11 out, **one** field changed (`10m -> 5m`)
- local base and remote pinned-URL base render **byte-identically**

**Four things break anyway.**

1. **`kubevirt-cdi-emulation-test.ts` refuses to build a plan.** It derives what to
   apply from `spec.source.directory.include` and throws `PlanRefusal` when the field
   is absent — deliberately, so it "cannot drift from what ArgoCD applies." That is the
   only lane proving these two Applications install at all, and both Applications'
   `zeta.io/sync-policy-reason` cites it as the reason manual-sync is not an
   untestability claim. Converting them silences it.
2. **`directory` and `kustomize` are mutually exclusive in ArgoCD, at the API level.**
   `ApplicationSource.ExplicitType()` (argo-cd v2.13.2, the appVersion of chart 7.7.10
   this cluster pins) appends a type per **non-nil** sub-block and errors on more than
   one: `multiple application sources defined: kustomize,directory`. And `ExplicitType`
   is consulted _before_ filesystem discovery in `GetAppSourceType`, so keeping
   `directory` means a `kustomization.yaml` in the path is **ignored**, not merged. The
   include set cannot be preserved; it has to be re-expressed as `resources:`.
3. **The repo's own renderer would then report the wrong bytes.** Measured on a scratch
   tree: with the `directory` block removed, `discoverApplications` yields
   `includeGlob: ""`, `includeMatcher("")` matches every `.yaml`, and `renderGitPath`
   returns **11 documents instead of 9** — including the `kind: Kustomization` file as
   if it were an API object — and reports the **unpatched** `cpu: 100m`. The checker and
   the cluster would disagree about the exact number the exercise exists to move.
4. **A remote base costs the offline property for nothing.** It needs egress from the
   ArgoCD repo-server and from any renderer, against `clone-at-tag-stays-sufficient` and
   against the "offline by default, because an unavailable gate reads like a passing
   one" doctrine in `rendered-storage-claims.ts` — and it buys nothing, because the
   local-base and remote-base renders are byte-identical.

Teaching `renderGitPath` and the emulation lane about Kustomize is the honest price of
(1)+(3), and it is a substantially larger change than the 120m is worth. Recorded so the
next person does not re-derive it.

## Not an option either: an upstream knob

There is none. Both `virt-operator` and `cdi-operator` are the deployments that _install_
the operators, so nothing they later manage can configure them. `KubeVirt`'s
`spec.customizeComponents.patches` reaches virt-api / virt-controller / virt-handler,
never virt-operator's own Deployment. Upstream ships no Helm chart for either project
(measured 2026-08-23 against the release asset lists of kubevirt v1.8.4 and CDI v1.65.0).

## Sizing

120m of 5191m — **2.3%**, and the dev lane already fits with 494m of spare. This is not
urgent. It is filed so the refusal stays a decision with a live reason rather than
becoming folklore.
