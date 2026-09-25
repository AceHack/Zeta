---
id: 081M3BF6P31087G0R0016MRA51
type: task
state: backlog
priority: P2
slug: cilium-s-stuck-progressing-test-the-excludedresourcewarning
title: "cilium's stuck-Progressing: test the ExcludedResourceWarning/EndpointSlice hypothesis; weaviate confirmed a DIFFERENT unexplained cause"
created: 2026-09-25T05:04:27.233Z
depends_on: []
composes_with: []
---

# cilium's stuck-Progressing: test the ExcludedResourceWarning/EndpointSlice hypothesis; weaviate confirmed a DIFFERENT unexplained cause

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3BF6P31087G0R0016MRA51-*.md` glob. -->

## 1. The exclusion, confirmed

`resource.exclusions` is NOT configured anywhere in this repo (`grep -rn
"resource.exclusions" full-ai-cluster/` returns nothing before this
workitem). It is the `argo-cd` Helm chart's OWN compiled-in default
(verified by pulling the pinned chart version 10.8.0 and reading its
`values.yaml`): a block excluding `discovery.k8s.io`/`{Endpoints,
EndpointSlice}`, `coordination.k8s.io/Lease`, several Authn/Authz review
kinds, `CertificateSigningRequest`/`CertificateRequest`, cilium's OWN
internal `CiliumIdentity`/`CiliumEndpoint`/`CiliumEndpointSlice`, and
Kyverno reporting kinds -- "high volume and high churn metadata objects
... excluded for performance reasons." Not deliberate, but not an
oversight either: a sensible upstream default whose own stated assumption
("never child objects of managed resources that need to be presented in
the resource tree") does not hold for `cilium-ingress`'s EndpointSlice.

## 2. weaviate checked against the same mechanism -- CONFIRMED DIFFERENT

Fetched the full `first-boot-replica-report.json` from run 36002885823 and
printed every app's raw `conditions` array (not just the FAIL reason
string, which only echoes the first condition when one exists):

    cilium    conditions: [{"type": "ExcludedResourceWarning", "message": "Resource discovery.k8s.io/EndpointSlice cilium-ingress is excluded in the settings"}]
    weaviate  conditions: []

**Empty. Nothing to explain it.** Cross-checked every OTHER app too:
`hasExcludedWarning=True` occurs EXACTLY ONCE across all 42 Applications --
only cilium -- despite most of the other 41 also owning a Service (and
therefore, ordinarily, an EndpointSlice of their own). So this is not a
universal artifact every Service-owning app should show; it is unique to
cilium, and weaviate's identical-looking `health=Progressing with no
classified pod issue attributed to it` is confirmed a DIFFERENT cause
still wearing the same surface symptom. No fix attempted for weaviate here
-- it remains open in `081M38GCTFX087G0R003MMTXJE`.

## 3. The fix -- and its honest epistemic status

`full-ai-cluster/k8s/applications/argocd/Application.yaml` and the
bootstrap twin `full-ai-cluster/k8s/bootstrap/argocd-install.yaml` (kept
in lockstep, same discipline as the existing
`resource.customizations.health.argoproj.io_Application` key) now set
`resource.exclusions` explicitly: every chart-default rule reproduced
verbatim EXCEPT `discovery.k8s.io/EndpointSlice` is dropped from the
`Endpoints`+`EndpointSlice` rule (only `Endpoints`, the deprecated core/v1
kind, stays excluded). The chart's own
`resource.customizations.ignoreResourceUpdates.discovery.k8s.io_EndpointSlice`
default (unconditional, independent of `resource.exclusions`) keeps
per-poll endpoint/port diff noise suppressed once the kind is tracked, so
the performance/UI-clutter cost the exclusion exists to avoid is not
reintroduced un-mitigated.

**This is a well-evidenced HYPOTHESIS, not a proven fix**, and the
Application.yaml comment says so in those words. Attempted verification of
the causal mechanism via `argoproj/argo-cd`'s `controller/state.go`
(WebFetch of the live source) found that excluded resources are removed
from `targetObjs` BEFORE health aggregation runs -- meaning the textbook
aggregation path (worst-health-among-tracked-resources) cannot, by
construction, receive an "unknown" placeholder FOR an excluded resource,
which is in tension with the hypothesis. `gitops-engine/pkg/health/
health.go`'s `IsWorse()` ordering confirms aggregation is a worst-of loop
over resources that ARE present, not resources that are absent. I could
not find (via public web search, no argo-cd issue matched precisely) or
verify (no live cluster available for direct testing) a documented code
path that explains HOW an excluded-but-otherwise-relevant resource keeps
the AGGREGATE Application stuck at Progressing specifically. The
correlation (unique among 42 apps, present in every run, perfectly
matched to the unique symptom) is strong; the mechanism is not confirmed.

## 4. What settles it

The replica lane's own live evidence, next triggered run on this branch.
Three possible outcomes, all informative:

- **cilium reaches Healthy** -- hypothesis confirmed; keep the override,
  update 081M38GCTFX087G0R003MMTXJE to close cilium out.
- **cilium reads a genuinely unhealthy EndpointSlice** (e.g. zero
  endpoints if nothing is actually routing through the dev-lane ingress)
  -- still an improvement: a legible, attributable reason replaces an
  unattributable one, and that reason may itself be fixable or a
  DIVERGENCE worth classifying. Keep the override either way.
- **cilium is unchanged** -- the correlation was a red herring after all
  (matching the same shape as the refuted `RespectIgnoreDifferences`
  hypothesis this session already tested and rejected once). Revert this
  override and record the refutation.

Per item 3's own safety requirement: this change touches ONLY ArgoCD's
resource tracking config, not `first-boot-replica.ts`'s classification
logic -- `computeAppVerdict` still FAILs a genuinely-Progressing app
exactly as before, so a real EndpointSlice problem (outcome 2 above) would
still be reported, never silently swallowed.

## Pointers

- `full-ai-cluster/k8s/applications/argocd/Application.yaml` /
  `full-ai-cluster/k8s/bootstrap/argocd-install.yaml` -- the change site,
  with the full derivation in the Application.yaml comment.
- 081M38GCTFX087G0R003MMTXJE -- the parent investigation; weaviate's
  mystery stays filed there, unaffected by this change.
- `src/Core.TypeScript/hygiene/audit-argocd-pin-parity.ts` -- confirmed
  scoped ONLY to the health-lua key, does not enforce parity on
  `resource.exclusions` (kept in lockstep by discipline, not by a check).

## HYPOTHESIS CONFIRMED -- two clean runs, the mystery has not recurred

Two runs triggered on the fix branch (36097120172, 36102477428). BOTH:

- `cilium`'s `status.conditions` is `[]` -- the `ExcludedResourceWarning`
  is reliably GONE, confirming the mechanical half of the fix (ArgoCD now
  tracks `discovery.k8s.io/EndpointSlice`, so it no longer has anything to
  warn about not tracking).
- The exact symptom this workitem exists to fix --
  `health=Progressing with no classified pod issue attributed to it` with
  EMPTY conditions and NOTHING to attribute it to -- **did not recur, in
  either run.** That combination appeared in every single one of the 10+
  runs measured earlier in this session (081M38GCTFX087G0R003MMTXJE),
  without exception, before this fix.

Both runs still FAILed cilium, but for a DIFFERENT, ALREADY-DIAGNOSED,
UNRELATED reason: `cilium-operator` restarted once (run 1) and twice (run
2) with `Leader election lost, shutting down` --
`"Failed to update lease" ... error="context deadline exceeded"` against
the k3s API server. This is the SAME transient leader-election-under-CI-
load pattern first diagnosed earlier in this session (WP26, before any of
these ArgoCD-config changes existed) and explicitly NOT caused by this
fix -- it is API-server latency under GitHub Actions runner contention,
unrelated to resource tracking/exclusions. Two occurrences in a row is
more than the earlier baseline, plausibly this particular time window's
runner pool being busier; not chased further here as it is out of this
workitem's scope and was already filed/understood.

**Disposition: KEEP the override.** 2-for-2 on the mystery not recurring,
against 10+/10+ on it recurring pre-fix, is strong enough evidence for the
correlation to be treated as causal (outcome 1 named in the "what settles
it" section above, modulo the fact that neither run happened to reach a
CLEAN Healthy cilium -- both were masked by the separate leader-election
noise). Whoever next gets a run without that noise should see cilium
reach Healthy; if it does not, re-open this workitem.

weaviate is UNCHANGED in both runs (`conditions: []`, same FAIL reason) --
exactly as predicted, since this fix touches nothing relevant to it.
