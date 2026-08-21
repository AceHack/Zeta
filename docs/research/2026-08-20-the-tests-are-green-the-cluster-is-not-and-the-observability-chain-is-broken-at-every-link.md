# The tests are green, the cluster is not, and the observability chain is broken at every link

**Dejan / devops — analysis only. Nothing applied to any cluster, no PR, no device touched.**
**Date:** 2026-08-20/21 · **Register: measured** except where marked.

## 0. Two environment facts that shaped every number below

**`mise trust` was required.** Before it, `bun`/`helm`/`kubeconform` resolved to nothing with a
config-parse error — **the failure mode is empty output, not an error.** Every bun result below
carries its `Ran N tests` banner.

**Second, unwarned: another agent held load average 28** on this machine (ten deliberate spin-loops)
during the run. Single-path timing of one tool was **77 s wall against 3.7 s CPU — a 20× stretch.**
Everything timing-sensitive was **re-measured in isolation and cross-checked against CI** rather than
reported loaded. **That check is what turned most of the red list from regression into artifact.**

## 1. Failing tests

| suite | result |
|---|---|
| `dotnet build Zeta.sln -c Release` | **0 Warning(s), 0 Error(s)** |
| `dotnet test Zeta.sln -c Release` | **6335 passed, 0 failed, 6 skipped** |
| `bun test` | 13,746 across 1,096 files — **13,716 pass, 8 skip, 22 fail** |

### The decisive cross-check

CI gate run **32434946163** is at SHA `71ab1b8c…` — **the exact worktree HEAD** — and all **33/33 jobs
are green**, including `test (TS hermetic)`, which runs the same **bare, filter-less** whole suite.

> **So zero of the 22 bun failures is a genuine regression. Same commit, clean runner, green.**

**Classification:** 12 are contention timeouts (3.7 s CPU vs 77 s wall under load 28). 4 are
**pre-documented to the letter** — `registry/environment-dependent-test-files.json` predicts exactly
which four fail and why (`src/Core.Python/.venv/bin/python3` absent); the file **asserts rather than
skips on purpose** and is tier-split into two CI jobs, both green. **That is the mechanism working.**
5 hit the 5000 ms default cap. 1 is `concept-index`.

### Two things worth acting on anyway

**`concept-index.test.ts` — an entire file's coverage collapses into one hook.** `beforeAll` builds an
index over `memory`, `docs`, `.claude/*` — **30,309 files, of which `docs/` alone is 28,018** — against
a fixed 30 s budget on a set that grows daily. When it trips, bun reports **one** unnamed failing test
and **~20 real assertions never run.** Green in CI today; **the trend line is the finding.**

**Three whole-tree scans exceed the 5 s cap even in isolation** — 8364 ms, 13237 ms, and one at
**5058 ms, 58 ms over**. `bunfig.toml`'s own doctrine says *"A test that is slow BY NATURE carries its
own explicit timeout."* These carry none.

### Skips, correctly reported

**The TPM tripwire is armed and green, not firing** — it asserts `[] == []` today and flips red when a
real capture lands. **Compliance, not a bug.** The 6 .NET skips each carry a written reason and a
work-item; two carry real weight — three `RxAdapterTests` are **the falsifiers for a shipped race
fix**, disabled by a vstest-host wedge, so **the fix ships unverified in CI.**

## 2. Helm and k8s — there are TWO trees, and validation covers the smaller one

| | `infra/k8s/` | `full-ai-cluster/k8s/` |
|---|---|---|
| files | 12 manifests, 7 Applications | **122 files, ~60 Applications** |
| `helm template` in CI | **YES** (`helm-validate.yml`) | **NO** |
| chart-version-exists check | **YES** | **NO** |

`helm-validate.yml` filters on `infra/k8s/**` only. **The 60-Application tree is never rendered.**

### And the gate's kubeconform skips the payload

```
Summary: 175 resources found in 114 files - Valid: 62, Invalid: 0, Errors: 0, Skipped: 113
```

**113 of 175 (65%) skipped**, because `Application` and `HelmChart` are both in the `-skip` list —
**precisely the objects that name the chart and the version.** So `lint (yaml/k8s)` is green while
validating nothing about what any chart renders.

### What the gap hides — 29 failures, measured

Pointing the *validated* validator at the *unvalidated* tree (it already takes `--apps-dir`):
**exit 1, 305 passed, 29 failed.**

| app | real output |
|---|---|
| **oz** | `chart 'ziti-controller' has no version '1.4.5'` — **96 published versions, newest 3.2.1. The pin is fictional.** |
| sealed-secrets | index.yaml **404** |
| forgejo | index.yaml **404** |
| gitlab | `You must provide an email to associate with your TLS certificates` |
| headscale | `accessMode is required for PVC headscale-data` |
| temporal | `Please specify cassandra port for default store` |

**Validator-scope gap, not manifest defects:** three apps use bare OCI registries, where fetching
`/index.yaml` is meaningless. **Fix the validator, not the manifests.** **13 real ArgoCD-contract
gaps:** missing `syncPolicy.automated.{prune,selfHeal}` or `CreateNamespace=true`. **The other 25
charts render clean** — argocd, cert-manager, cilium, kube-prometheus-stack, loki, mimir, spire, vault.

### Dual ownership is SEVEN charts, not one — and four have divergent values

`k3s-server.nix` declares the bootstrap roster; `root-application.yaml` recurses
`full-ai-cluster/k8s/applications` with `recurse: true` and `selfHeal: true`. Enumerating both sets:
**8 bootstrap `HelmChart` CRs, 7 also owned by an ArgoCD Application with `selfHeal: true`** —
cilium, vault, spire, argo-cd, trust-manager, external-secrets, cert-manager. **Same chart, same
version, same release name, same namespace, two reconcilers.**

**The worst is Vault, and it is not latent:**

| | k3s helm-controller | ArgoCD |
|---|---|---|
| `server.ha` | `enabled: false`, `replicas: 1` | `enabled: true`, `replicas: 3`, `raft.enabled: true` |
| **rendered storage backend** | **`storage "file"`** | **`storage "raft"`** |

> **These are different storage backends on the same release name, and `selfHeal` will keep converting
> Vault between them. That is data loss on the cluster's secrets backend, on a loop.**

Also: **`argo-cd` is dual-owned** and the ArgoCD-side values drop to 4 top-level keys where the k3s
side has 9 — **ArgoCD's selfHeal would strip its own controller config.** And **`cilium` is the CNI**;
the ArgoCD side adds `l2announcements`, which `cilium-lb-ipam`'s policy depends on, **so that
capability toggles on and off.**

### The two lying comments — confirmed, and the Vault one is worse than stated

- **`spire-install.yaml:2`** claims *"SPIRE chains to Vault as upstream CA."* `upstreamAuthority`
  appears **zero times repo-wide**; in the ArgoCD twin it is **commented out**. Independently
  corroborated: `argocd-health-test.ts:272` already registers *"Vault upstream CA … not ready"*.
- **`vault-install.yaml:1-2`** claims cert-manager TLS. **Zero `kind: Certificate` resources exist.**
  And the render is **internally contradictory**: `tls_disable = 1` (plaintext listener) while
  `VAULT_ADDR = "https://127.0.0.1:8200"` and the readiness probe runs `vault status -tls-skip-verify`
  — **which skips *verification*, not the handshake.**

> **The readiness probe cannot pass, so Vault never goes Ready** — and SPIRE **and** External Secrets
> both declare a dependency on it.

**Placeholder ACME emails confirmed** at `clusterissuer.yaml:26,47`, and **independently corroborated
by the render**: gitlab's chart hard-fails on the missing email.

### Pinning

**CI supply chain is clean** — every `uses:` is a full 40-char SHA, zero mutable tags. Credit where
due. **Container images are not:** **zero `@sha256:` digest pins** across both trees, and **six
`:latest` in a GitOps path, four of them first-party.** **With `selfHeal: true`, a `:latest` is a
silent capability change on hardware, arriving with no commit.**

*Separately, flagged by location only:* `loki/Application.yaml` carries a plaintext S3 access key in a
GitOps path. Dev placeholder by its naming; the value is not restated here.

## 3. Observability — the chain is broken at every link

**EXISTS and is real:** the full Grafana/Prometheus/Loki/Mimir/Tempo/Alloy stack renders clean.
Rendering kube-prometheus-stack yields **13 ServiceMonitors, 35 PrometheusRules, 35 rule groups** —
kubelet/apiserver/etcd/coredns metrics genuinely collected. **`src/Core/Metrics.fs` and `Tracing.fs`
are first-class, well-designed instrumentation.** And **tick telemetry works end to end** —
`tick-metrics.yml` every 15 min, `data/tick-latest.json` current, 1131 shards, `ticks_24h: 539`,
served same-origin. **The portal also degrades honestly**, enumerating each degraded capability in its
own header rather than faking it.

**CLAIMED BUT ABSENT:**

1. **Alloy is a DaemonSet on every node that moves zero bytes.** Its generated config contains exactly
   three components — `loki.write`, `otelcol.exporter.otlp`, `prometheus.remote_write`. **All three
   are sinks.** Repo-wide search for `discovery.kubernetes`, `prometheus.scrape`, `loki.source.*`,
   `otelcol.receiver.*`, `forward_to`: **zero hits.** **Three pipelines with an output and no input** —
   while its own header claims *"Ships logs to Loki, metrics to Mimir/Prometheus, traces to Tempo."*
2. **Alloy's Loki sink names a Service that does not exist.** It targets `loki.loki.svc…:3100`;
   rendering loki in the configured mode produces `loki-backend`, `-canary`, `-gateway`, `-memberlist`,
   `-read`, `-write` — **no Service named `loki`.** (Tempo and Mimir **do** resolve; both checked.)
3. **Alerting fires into `/dev/null`.** The rendered Alertmanager config has **one receiver, named
   `null`, and the default route sends everything to it.** **35 rule groups will fire and every alert
   terminates there.** Precisely: alerts stay visible in the Alertmanager UI *if someone opens it* —
   **there is no push path to any human.** No Slack, no PagerDuty, no webhook, anywhere.
4. **The DORA dashboard's data source has no writer.** The page states *"Every frame here is a JSON
   file committed by CI"* and fetches `data/metrics-history.json`. **That file does not exist and no
   workflow references it.** Mitigating: the page has an honest fallback and **does not fabricate** —
   **the "committed by CI" claim is the false part.**
5. **`Zeta.Core.Circuit` metrics reach nobody.** Zero OpenTelemetry packages, zero `AddOtlpExporter`,
   zero `OTEL_EXPORTER_OTLP_*`. **With no listener attached `StartActivity` returns null** — the test
   file says so in its own comment. **The counters increment into nothing.**

**MISSING:** no ServiceMonitor/PodMonitor/PrometheusRule authored in-repo — **every one of the 35 rules
is a chart default**, and **no Zeta workload is scraped at all.** No alert routing, no on-call. No
dashboard provisioning. And **15 Applications are applied to every CI cluster and asserted by
nothing** — `argocd-health-test.ts` is an explicit, reasoned registry of that shadow. **The deferral is
honest; the consequence is that the entire telemetry stack is unexercised.**

> **The chain: the F# emits with no exporter → Alloy has no receiver → Alloy has no source → its log
> sink names a nonexistent Service → alerts route to `null` → the DORA writer was never built. Any
> single fix leaves the chain broken.**

**The order that actually buys signal:** Alloy sources first (**values-only, unlocks logs+traces
immediately**) → the `loki` → `loki-gateway` endpoint → an Alertmanager receiver → only then the OTel
exporter on the .NET side.

## 4. What to do, in order

1. **Point `helm-validate.yml` at both trees.** The validator already takes `--apps-dir`; this is a
   paths filter plus one step, **not new code**, and the render lane measures **7.6 s**. **This is the
   single highest-value change here — it converts all 29 findings above into a red X.**
2. **Resolve dual ownership by deleting one owner per chart.** Bootstrap should carry only what must
   exist *before* ArgoCD; everything the app-of-apps reaches should be ArgoCD-only. `validate-bootstrap.ts`
   already parses the k3s roster, so the overlap check extends a validator that exists.
3. **Vault first** — dual-owned **and** file-vs-raft **and** unable to pass readiness: three
   independent blockers on the secrets backend.
4. **Delete the two lying comments in the same commit as whatever fixes them.**
5. Digest-pin the four first-party images; stop `-skip`ping `Application`/`HelmChart` once a real
   render lane covers them.

### Verification note (Otto, landing this)

Three load-bearing claims independently re-checked. **The Vault divergence confirmed:** bootstrap
`ha.enabled: false / replicas: 1` (its own comment: *"bump to 3 + raft later"*) against ArgoCD
`enabled: true / replicas: 3 / raft.enabled: true`. **Dual ownership confirmed:** `k3s-server.nix:118`
declares `vault-install.source`, while `root-application.yaml` recurses
`full-ai-cluster/k8s/applications` (`recurse: true`, `selfHeal: true`) and `vault/Application.yaml:50`
carries `selfHeal: true`. **Both reconcilers own the same release.** Nothing was applied to any
cluster; all rendering was local `helm template`.
