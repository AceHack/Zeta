---
id: 081M38GCTFX087G0R003MMTXJE
type: task
state: backlog
priority: P2
slug: first-boot-replica-diagnose-fix-the-3-real-stage-6-fails-cil
title: "first-boot-replica: diagnose+fix the 3 real stage-6 FAILs (cilium restart, spire-server StatefulSet patch, weaviate stuck Progressing)"
created: 2026-09-24T01:27:33.629Z
depends_on: []
composes_with: []
---

# first-boot-replica: diagnose+fix the 3 real stage-6 FAILs (cilium restart, spire-server StatefulSet patch, weaviate stuck Progressing)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M38GCTFX087G0R003MMTXJE-*.md` glob. -->

## Status (2026-09-24, branch claude/replica-remaining-failures)

Two of three FIXED and live-verified; one remains genuinely unknown.

### spire — FIXED (two independent bugs, both confirmed live)

1. Bootstrap `helm-install-spire` job permanently CrashLoopBackOff'd (66
   retries / 97 min, run 35946414428): ArgoCD's own spire Application can
   apply `spiffe-csi-driver` ServiceAccount before the bootstrap Helm
   release ever completes, and Helm 3's ownership check then refuses that
   object forever (no `meta.helm.sh/*` annotations). Fixed with
   `takeOwnership: true` on `full-ai-cluster/k8s/bootstrap/spire-install.yaml`
   (k3s helm-controller's own field for exactly this). CONFIRMED: run
   35954645236 shows `spire=OK(0 retries)`.
2. `isKnownSpireAgentDnsCrashLoop` missed the SAME confirmed-non-metal
   hostNetwork-DNS artifact when sampled mid-`Running` between crashes
   (category UNKNOWN, not CRASHLOOP). Widened in
   `src/Core.TypeScript/cluster/first-boot-replica.ts`. CONFIRMED: run
   35954645236 reclassifies spire FAIL -> DIVERGENCE.

### cilium — ONE real bug FIXED and live-confirmed; app verdict still FAIL for a second, shared reason (see below)

`cilium-ca` / `hubble-relay-client-certs` / `hubble-server-certs` were
self-signed fresh on every `helm template` render (confirmed offline via a
two-render diff) — the same `randAlphaNum`-class drift weaviate's
Application.yaml already documents for its own Secret. LIVE-CONFIRMED via
the application-controller's own log (run 35965954133): repeated partial
self-heal syncs, `SelfHealAttemptsCount` climbing, touching exactly these 3
Secrets forever, each one rotating the live cert material. Fixed with the
same `ignoreDifferences` + `RespectIgnoreDifferences=true` remedy weaviate
already uses, in `full-ai-cluster/k8s/applications/cilium/Application.yaml`.

LIVE-CONFIRMED FIXED (run 35973241862, triggered after the fix landed): the
resync loop is GONE — the controller log now shows plain
"Skipping auto-sync: application status is Synced" every ~2-4 min with no
`Tasks (dry-run)` at all, same as weaviate's log shape. This is a real,
continuously-firing bug (unwanted credential rotation on a CNI's own mTLS
material) that is now fixed regardless of the app's overall verdict below.

**But cilium's app verdict is STILL FAIL** — same message
(`health=Progressing with no classified pod issue attributed to it`), same
run. Removing the resync loop did not flip it to Healthy; it just made
cilium's remaining symptom shape IDENTICAL to weaviate's.

### weaviate AND cilium (post-fix) — SAME unexplained symptom, STRONG shared-cause lead

Both apps, and ONLY these two apps out of the whole 42-app roster, now show:
`sync=Synced`, workload fully converged (StatefulSet/DaemonSet+Deployment
all Ready, `generation==observedGeneration`, weaviate's
`currentRevision==updateRevision`), zero pod restarts, zero Warning events,
`.status.health` carrying only `{lastTransitionTime, status}` (no message),
and an application-controller log that NEVER runs a sync task yet NEVER
reports Healthy either — `health_ms` near 0 on every reconcile, forever.

**THE LEAD**: `grep -rl RespectIgnoreDifferences full-ai-cluster/k8s/applications/*/Application.yaml`
returns EXACTLY these two files — weaviate (had it before this session) and
cilium (added by this session's fix). No other Application in the 42-app
roster uses `RespectIgnoreDifferences=true`, and no other Application shows
this symptom. 2-for-2 on the only apps carrying this sync option is a strong
correlation, not proof — but it is the single most promising lead: check
whether ArgoCD's `RespectIgnoreDifferences` pre-patching of the desired
object (sync.go, cited in weaviate's own Application.yaml comment) produces
a "predicted live state" that gitops-engine's health aggregator cannot
resolve to a definite status for certain resource kinds, defaulting to
Progressing instead of erroring or reading through to the real live state.

Do NOT simply drop `RespectIgnoreDifferences` from either app to test this
— weaviate's Application.yaml comment already measured that consequence:
"the ignored fields are still PUSHED on every sync, rotating the credential
for no reason." A fix here has to solve the interaction, not remove one
side of the trade-off blind.

Next steps for whoever picks this up:
1. Reproduce minimally: a throwaway ArgoCD instance + any chart with a
   `randAlphaNum`-style Secret and `ignoreDifferences` +
   `RespectIgnoreDifferences=true` — does the app ALSO stay stuck
   Progressing once the loop stops, independent of this repo's charts?
2. If reproduced: check the ArgoCD version this cluster runs (pinned in
   this Application's own bootstrap chart) against upstream ArgoCD issues
   for `RespectIgnoreDifferences` + health status interactions.
3. If NOT reproduced minimally: the shared cause is something else these
   two apps' full valuesObjects have in common that a wider roster scan
   would find — diff their rendered manifests' resource KIND sets against
   a few of the 35 Healthy apps and look for anything unique to these two.
4. An `argocd app get --hard-refresh` equivalent (force a full
   re-evaluation, bypassing the 2-minute comparison cache) would confirm or
   rule out a one-time caching artifact from early in the run.

Evidence for all of the above is in the job logs of the runs cited
(35936015368, 35946414428, 35954645236, 35960112028, 35965954133,
35973241862); the `collectAppFailureDiagnostics` function added to
`first-boot-replica.ts` this round captures describe/logs/events/
generation-fields/health/controller-log for any future FAIL automatically.

## Final confirmed steady state (PR #17607, runs 35989275840 x2 + seaweedfs fix)

Two more triggered runs after the seaweedfs fix landed and `main` was merged
in. One of them (job 107599378312) showed cilium FAIL with
`cilium-operator-...:UNKNOWN(not converged: phase=Running restartCount=1)`
-- a DIFFERENT symptom than the TLS-cert resync loop this workitem fixed.
`describe pod` traced it: `Failed to update lease ... context deadline
exceeded` -> `Leader election lost, shutting down` -- cilium-operator's OWN
leader-election lease renewal timed out against the k8s API under CI load
and it self-terminated cleanly, restarting once. Confirmed as one-off CI
resource contention, not a regression: the IMMEDIATELY FOLLOWING rerun (job
107620531835), same commit, same code, went back to the expected steady
state:

- **spire → DIVERGENCE** (correctly classified even at restartCount=11 this
  time -- the widened `isKnownSpireAgentDnsCrashLoop` held).
- **cilium → FAIL**, but back to `health=Progressing with no classified pod
  issue attributed to it` -- the resync-loop symptom is gone (no cert
  rotation reason cited); this is the SAME shared, still-unexplained mystery
  weaviate has, not the leader-election blip.
- **weaviate → FAIL**, unchanged.

This is the accurate, reproducible final state of this PR's fixes: two real
bugs fixed and live-confirmed (spire's bootstrap ownership collision, spire-
agent's classification gap, cilium's TLS-cert resync loop), one shared
mystery still open for cilium+weaviate with a concrete lead
(`RespectIgnoreDifferences=true` correlation), tracked in
081M39EMBRW087G0R001RHMEDJ alongside seaweedfs and gitlab.

`first-boot-replica.yml` is NOT a required check (by its own header:
"until it has run green a number of times on main, a flake here must not
block every PR") and is expected to stay red until the shared mystery is
solved -- that is not a reason to hold this PR's two confirmed, live-
verified fixes off `main`.
