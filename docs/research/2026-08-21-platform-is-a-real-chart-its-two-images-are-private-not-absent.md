# `platform` is a real chart — its two images are PRIVATE, not absent

> Aaron, reading the cluster application set: *"platform two ghcr.io images no
> registry serves — i'm not sure what this is, platform, is this a real chart?"*

Short answer: **yes, it is a real chart, and it is the most complete one in the
tree that has never run.** The two images exist, are rebuilt on every push to
`main`, and were last published at **2026-08-21T06:25** — the same morning the
question was asked. What is missing is not an image. It is a **credential**.

## 1. The claim under test, and where it came from

`src/Core.TypeScript/cluster/argocd-health-test.ts` deferred `platform` from the
CI lane with an inline comment ending:

> *"…and runs two images no registry serves:
> `ghcr.io/lucent-financial-group/zeta-platform-controller:latest` and
> `.../zeta-portal:latest`."*

That clause is where the reading came from, and **it is false**. It is the more
expensive kind of false, too: it points the next person at *building* an image
that has existed since June, so the work it invites is work already done.

## 2. What is actually there — measured, not inferred

| Question | Evidence | Answer |
|---|---|---|
| Is there controller source? | `full-ai-cluster/platform-controller/` — 20 committed files, `src/{controller,blueprint,policy,room,tenant,signals,k8s,types}.ts` with **six** `*.test.ts` beside them, plus `Dockerfile`, `package.json`, `tsconfig.json` | yes |
| Is there portal source? | `full-ai-cluster/portal/` + `DEPLOY.md` | yes |
| Does anything build them? | `.github/workflows/build-platform-images.yml` — matrix over both images; on push to `main` it pushes `:latest` **and** `:sha-<12>` to GHCR and `cosign sign`s the digest (keyless OIDC) | yes |
| Has that workflow ever run green? | run **32454324648**, `event: push`, `headBranch: main`, `conclusion: success`, `2026-08-21T06:25:22Z` (and ~20 green runs before it, back to the merge of #7409 on 2026-06-09) | yes |
| Do the packages exist? | `GET /orgs/Lucent-Financial-Group/packages/container/zeta-platform-controller` → `version_count: 36`, `updated_at: 2026-08-21T06:25:54Z`; `zeta-portal` → 36, `06:25:59Z` | yes |
| Is the tag list real? | `sha-3f0344776ac4` (the merge commit of #7409) … `sha-de510a3d8e3e`, `latest`, plus `sha256-*` cosign signature tags | yes |

So every step of `push → build → publish` is wired and working. The chain that
PR #7409 was opened to close **is closed**.

## 3. The actual blocker

Both GHCR packages are **`"visibility": "private"`**, and **no pod spec anywhere
in `full-ai-cluster/` declares `imagePullSecrets`** — the only occurrences of that
key in the whole directory are inside the KubeVirt and CDI operator *CRD schemas*,
i.e. field definitions, not usages.

Measured directly against the registry:

```
anonymous  GET ghcr.io/v2/lucent-financial-group/zeta-platform-controller/manifests/latest
           -> HTTP 401
           (the anonymous token endpoint returns no token at all for this scope)

credentialed GET (same URL)
           -> HTTP 200
           docker-content-digest: sha256:a4f3a81511b5eaec5c67761adb5f23121dfec472956bb3e37f2f18ce7c5fafaf
```

**The registry serves these images to a principal that can log in. The kubelet is
not one.** `controller.yaml` sets `replicas: 1` and `imagePullPolicy: Always`
against a private image with no pull secret, so the pod takes `ImagePullBackOff`.

Two consequences worth stating separately, because they are usually conflated:

1. **This is not a CI-lane gap.** It is substrate-independent. The metal cluster
   has no credential either, which is why the platform control plane has never
   started *there*. The CI deferral was hiding a live defect, not describing one.
2. **ArgoCD reports `ImagePullBackOff` as Progressing, never Degraded.** So if
   `platform` were simply un-deferred, it would sync, sit, burn the whole
   `--timeout-sec`, and be reported as `ApplicationUnhealthy` naming the symptom.
   The credential has to come first.

## 4. Is anything depending on it? — checked

- **Sync waves.** `full-ai-cluster/k8s/sync-wave-dependency-graph.yaml` has
  `platform` at Layer 5 depending on `cert-manager`, `cilium`, `cilium-lb-ipam`,
  `longhorn`. **Nothing declares a dependency ON `platform`** — it is a leaf.
- **Namespace consumers.** Two files outside `platform/` name the
  `zeta-platform` namespace: `open-policy-agent/Application.yaml` (an
  exempt-namespace list) and `ddns/cronjob.yaml` (the CronJob runs there).
  Neither needs the *controller*; the namespace is created by `platform`'s own
  `Application.yaml` (`CreateNamespace=true` + `namespace.yaml`), and that half
  syncs fine. The CRDs register too — Headlamp shows them, as the header claims.
- **Storage.** `platform` carries exactly one claim,
  `full-ai-cluster/platform/portal` (`rooms/portal`, 4–5 GiB on `longhorn`), and
  `bun src/Core.TypeScript/cluster/rendered-storage-claims.ts --offline` exits `0`
  with `platform` in **none** of the 17 acknowledged findings. **The claim
  renders.** It is not one of the two apps caught governing a path that does not
  exist.

So the absence is genuinely inert today — but it is inert because the *pod* is
what is missing, not the Application.

## 5. `:latest` — a real defect, already on the books

Both manifests pin `:latest`. Two syncs of the same commit can land different
bytes, which is exactly the DST/byte-lock problem: the manifest no longer
determines the artifact.

This is **already recorded**, at `full-ai-cluster/portal/DEPLOY.md:122`:

> *"Digest-pin the manifests + have CI bump them, instead of `:latest` + Always
> (immutable, audit-friendly GitOps). `:latest`+Always is the simple bootstrap."*

It is **not fixed here**, deliberately. Pinning replaces the documented
`push → rebuild → rollout restart` delivery model with one that needs a manifest
commit per build. That is a real trade with a real cost, and it is the
maintainer's to make — not something to slip in behind a question about whether
a chart is real. Naming it and leaving it is the honest move; the alternative is
freezing the platform at one digest as a side effect.

Two neighbours for contrast, both **honest** about the same class of gap:

- `orleans/statefulset.yaml` — `ghcr.io/lucent-financial-group/zeta-orleans-silo:latest`,
  an image that genuinely **does not exist** (the org has exactly two container
  packages). It ships `replicas: 0` and says so in its header: *"Replicas start
  at 0 until you publish a real silo image."*
- `hat-system/deployment.yaml` — tag literally `:placeholder`, `replicas: 0`.

`platform` is the one that asserts `replicas: 1` against an image it cannot pull.
That asymmetry is the finding.

## 6. What the investigation turned up on the way — the checker that could not fail

`platform`'s only recorded reason was a **source comment**, and it was wrong, and
nothing could tell. Chasing why produced the more general defect:

`DEV_EXCLUDED_REASONS` in `argocd-health-test.ts` is the registry whose own
header says it covers *"Applications the dev/CI lane neither applies nor
asserts"*, and that *"every value must contain a `LIFTS WHEN:` clause"*. The list
that decides what the lane applies is
`DEFAULT_ROOT_DEV_CATALOG.excludeGlob` in `ports.ts`. **`auditDevExclusionReasons`
never read it.** It compared the registry to the filesystem, and to itself:

- `unreasoned` — documented in the file as unfireable by construction
  (`DEV_EXCLUDED_DIRS` is derived from the map's own keys)
- `stale` — only "does this directory still exist"

Measured on `main` at `f332a61a`: the glob defers **nine** directories, the
registry reasoned about **five**. `agent-memory`, `gitlab`, `platform` and
`temporal` were excluded from every CI cluster with **no recorded why and no lift
condition** — and both audit directions reported green.

That is the vacuity class exactly: a registry built to make deferrals explicit,
checked against everything except the list that actually defers.

The fix in this change: `auditDevExclusionReasons` gains the two glob
directions — `globExcludedWithoutReason` and `reasonedButApplied` — and the four
missing reasons are written, each with a `LIFTS WHEN:`. The asserted roster is
**unchanged at 31 of 45**; all four were already excluded by other mechanisms, so
this adds no coverage and removes none. It adds the *why*.

## 6a. Postscript, same night: the fix reintroduced the defect it removed

The `temporal` reason written in #13472 said its chart *"has no persistence store
configured, so it does not render"*. That was measured true, and **false by the
time it merged** — **#13469** landed in the interval, wired temporal's datastore
to the CockroachDB already in the cluster, and re-measured the render as OK (6
Deployments, 8 Services, 2 ConfigMaps, 1 Job, **zero** PVCs), retiring the very
`helm-template-failed` acknowledgement the reason cited.

**Both audit directions stayed green through it**, and that is the finding worth
more than the fix: all four directions check that a reason is **present** and
names a lift condition. **None checks that it is true.** A false sentence with a
`LIFTS WHEN:` clause satisfies every mechanical property the registry has.

So the honest statement of what this machinery buys: a reason is **written down
and therefore refutable by a reader**. It cannot buy the reading. The mitigation
is a convention, not an enforcement — reasons that cite a render, a run id or an
HTTP status are cheap to re-check, which is why the `platform` reason is written
that way. Corrected in the follow-up, with the error kept rather than erased.

## 7. Disposition

**`platform` stays deferred, and stays applied on metal.** It is not a
placeholder, so removing it would delete a working chart; and it is not
runnable, so asserting it would hang. What it needed was a true reason, and it
now has one, in the registry that is checked rather than in a comment that was
not.

**What lifts it** (both halves, neither alone):

1. The pull path exists — **either** the two GHCR packages are made public,
   **or** the pod specs gain an `imagePullSecrets` bound to a token the lane can
   mint. *Making an org's container packages public is a disclosure decision and
   is not taken here.*
2. `platform/**` leaves `DEFAULT_ROOT_DEV_CATALOG.excludeGlob`.

## Pointers

- `full-ai-cluster/platform-controller/` — the controller source (20 files, 6 test files)
- `.github/workflows/build-platform-images.yml` — the build+publish that already works
- `full-ai-cluster/k8s/applications/platform/{Application,controller,portal}.yaml`
- `full-ai-cluster/portal/DEPLOY.md:120-124` — the known follow-ups, incl. the digest pin
- `src/Core.TypeScript/cluster/argocd-health-test.ts` — `DEV_EXCLUDED_REASONS` (the corrected reason) + `auditDevExclusionReasons` (the two new directions)
- `src/Core.TypeScript/cluster/ports.ts` — `DEFAULT_ROOT_DEV_CATALOG.excludeGlob`, the list that actually defers
- `docs/history/pr-reviews/PR-7409-*.md` — where the "no CI ever built them" gap was closed, and the sentence that outlived its truth
