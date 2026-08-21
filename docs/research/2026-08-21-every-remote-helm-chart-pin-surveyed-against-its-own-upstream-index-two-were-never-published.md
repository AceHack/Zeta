# Every remote Helm chart pin, surveyed against its own upstream index — two were never published, and a third repo is gone

**Date:** 2026-08-21 · **Register:** Beacon (outward-facing; every "latest" claim carries the index URL it was read from)
**Scope:** every ArgoCD `Application` under `full-ai-cluster/k8s/applications/*/Application.yaml` that sources a
**remote** Helm chart, plus the six-plus-one chart pins in `full-ai-cluster/k8s/bootstrap/`.
**Status:** SURVEY ONLY. Nothing is bumped here. The bumps are a separate, reviewable change and several of
them are the maintainer's call.

> **This document is a SNAPSHOT and it started rotting the day it landed.** The recurring version is
> [`docs/CHART-CURRENCY.md`](../CHART-CURRENCY.md), regenerated from the weekly refresh that already
> fetches these indexes (`report-chart-currency.ts`). Read that for the current state; read this for the
> method, the cross-verification against `helm search repo`, and the per-chart upgrade guidance in §4,
> none of which the generated report carries.

---

## 0. Headline

| | count |
|---|---|
| ArgoCD Applications sourcing a remote Helm chart | **35** |
| …plus `spire-crds`, pinned only in `bootstrap/` | 1 (**36** distinct remote chart pins) |
| Pins that are **behind** upstream | **34 of 35** (only `minio` is current) |
| Pins whose bump **crosses a strict major boundary** | **14** |
| Pins on a `0.x` line, where every *minor* is a potential break | **9** |
| Same major but upstream **forbids skipping minors** | **2** (`cilium`, `longhorn`) |
| **Pins upstream never published at all** | **2** — `oz`/`ziti-controller` `1.4.5`, `forgejo` `9.0.6` |
| **repoURLs that no longer resolve** | **2** — `sealed-secrets` (404), `forgejo` (index empty; moved to OCI) |
| Repos that could not be reached | **0** — every coordinate resolved to a decision |

Applications sourcing this repo by `path:` rather than a remote chart (`agent-memory`, `cdi`, `cilium-lb-ipam`,
`deepseek-coder`, `game-hosting/gmod`, `hat-system`, `kubevirt`, `orleans`, `platform`, `qwen-coder`, `vllm`)
are out of scope — they carry no chart version to bump.

---

## 1. Method, and what MEASURED means in this document

Every row below was produced by fetching the chart repository's own `index.yaml` **at the exact `repoURL` the
manifest pins**, parsing `entries.<chart>[].version`, and sorting by semver. No blog, no ArtifactHub summary,
no aggregator. All indexes were fetched **2026-08-21**.

- **MEASURED** — the upstream index (or OCI tag list) was fetched and the version list read directly. Every
  row in §2 is MEASURED.
- **RESEARCHED** — a docs page or release note says so. Used only in §4 for *upgrade guidance*, never for a
  version number.
- **UNRESOLVED** — a repo could not be reached. **There are none**; the two failures in §3 are findings, not
  gaps.

Two mechanical notes, because they bit during the survey and will bite the next reader:

1. **A naive line-based `version:` grep over `index.yaml` is wrong.** Helm indexes embed whole YAML documents
   inside `annotations.artifacthub.io/crds`, and those nested documents contain their own `version:` keys. A
   grep that ignores indentation reported cilium's latest chart as `v2` (a `CiliumNetworkPolicy` CRD version)
   instead of `1.20.1`. Entry fields sit at **exactly four spaces**; anything deeper belongs to an annotation.
2. **OCI registries have no `index.yaml`.** For `ghcr.io/...` and `oci://code.forgejo.org/...` the version
   list came from the registry's `/v2/<repo>/tags/list` endpoint using an anonymous pull token. Those rows say
   so in §2's source column.

### 1a. Cross-verified against a second oracle

The parser above is mine, so its output is cross-checked against `helm search repo --versions`
(helm v4.2.0), which reads the same indexes through upstream's own code path. Spot-checked on the
five rows where a parser bug would have been most costly — the two largest indexes, the one that
already broke a naive parser, and both broken coordinates:

| chart | this survey | `helm search repo` |
|---|---|---|
| `mimir-distributed` | `6.2.0` | `6.2.0` (app `3.2.0`) |
| `loki` | `7.3.0` | `7.3.0` (app `3.6.12`) |
| `cilium` | `1.20.1` | `1.20.1` (app `1.20.1`) — *not* the `v2` a naive grep reports |
| `ziti-controller` | `3.2.1`, **no `1.4.x` exists** | `3.2.1` (app `2.0.1`); `awk '$2 ~ /^1\.4/'` returns empty |
| `sealed-secrets` (new repo) | `2.19.3` | `2.19.3` (app `0.39.1`) |

Agreement between two readers of the same index is weaker evidence than it looks — they share the
input — but it does falsify the failure mode that actually occurred here, which was mine and not
upstream's.

---

## 2. The survey

`versions behind` = count of **published stable** chart versions strictly greater than the pin. Pre-releases
are excluded from the count and from "latest".

| ArgoCD app | chart | repoURL as pinned | pinned | latest published | behind | pin published? |
|---|---|---|---|---|---|---|
| `alloy` | `alloy` | `https://grafana.github.io/helm-charts` | `0.10.1` | `1.11.1` | 36 | yes |
| `arc-controller` | `gha-runner-scale-set-controller` | `ghcr.io/actions/actions-runner-controller-charts` | `0.12.1` | `0.14.2` | 5 | yes |
| `arc-runner-set` | `gha-runner-scale-set` | `ghcr.io/actions/actions-runner-controller-charts` | `0.12.1` | `0.14.2` | 5 | yes |
| `argo-rollouts` | `argo-rollouts` | `https://argoproj.github.io/argo-helm` | `2.39.5` | `2.41.1` | 14 | yes |
| `argo-workflows` | `argo-workflows` | `https://argoproj.github.io/argo-helm` | `0.42.5` | `2.0.2` | 75 | yes |
| `argocd` | `argo-cd` | `https://argoproj.github.io/argo-helm` | `7.7.10` | `10.4.0` | 195 | yes |
| `cert-manager` | `cert-manager` | `https://charts.jetstack.io` | `v1.16.2` | `v1.21.1` | 28 | yes |
| `cilium` | `cilium` | `https://helm.cilium.io/` | `1.16.5` | `1.20.1` | 56 | yes |
| `cockroachdb` | `cockroachdb` | `https://charts.cockroachdb.com/` | `14.0.5` | `21.0.4` | 53 | yes |
| `dapr` | `dapr` | `https://dapr.github.io/helm-charts/` | `1.14.4` | `1.18.3` | 54 | yes |
| `external-secrets` | `external-secrets` | `https://charts.external-secrets.io` | `0.10.7` | `2.9.0` | 43 | yes |
| `forgejo` | `forgejo` | `https://code.forgejo.org/forgejo-helm/` | `9.0.6` | `17.1.5` | n/a | **NO** — §3.2 |
| `gitlab` | `gitlab` | `https://charts.gitlab.io/` | `8.7.0` | `10.3.0` | 159 | yes |
| `headlamp` | `headlamp` | `https://kubernetes-sigs.github.io/headlamp/` | `0.30.1` | `0.45.0` | 17 | yes |
| `headscale` | `headscale` | `https://charts.gabe565.com` | `0.4.0` | `0.16.0` | 31 | yes |
| `hindsight` | `hindsight` | `ghcr.io/vectorize-io/charts` | `0.3.0` | `0.9.1` | 45 | yes |
| `kube-prometheus-stack` | `kube-prometheus-stack` | `https://prometheus-community.github.io/helm-charts` | `65.5.0` | `88.5.3` | 435 | yes |
| `loki` | `loki` | `https://grafana.github.io/helm-charts` | `6.18.0` | `7.3.0` | 48 | yes |
| `longhorn` | `longhorn` | `https://charts.longhorn.io` | `1.7.2` | `1.12.1` | 16 | yes |
| `mimir` | `mimir-distributed` | `https://grafana.github.io/helm-charts` | `5.5.1` | `6.2.0` | 13 | yes |
| `minio` | `minio` | `https://charts.min.io/` | `5.4.0` | `5.4.0` | **0** | yes |
| `nats` | `nats` | `https://nats-io.github.io/k8s/helm/charts/` | `1.2.7` | `2.14.5` | 33 | yes |
| `node-feature-discovery` | `node-feature-discovery` | `https://kubernetes-sigs.github.io/node-feature-discovery/charts` | `0.17.1` | `0.19.0` | 8 | yes |
| `ollama` | `ollama` | `https://otwld.github.io/ollama-helm/` | `1.6.0` | `1.76.0` | 70 | yes |
| `open-policy-agent` | `gatekeeper` | `https://open-policy-agent.github.io/gatekeeper/charts` | `3.18.1` | `3.23.0` | 13 | yes |
| `oz` | `ziti-controller` | `https://docs.openziti.io/helm-charts/` | `1.4.5` | `3.2.1` | n/a | **NO** — §3.1 |
| `redis` | `redis` | `https://charts.bitnami.com/bitnami` | `20.5.0` | `28.0.7` | 119 | yes |
| `sealed-secrets` | `sealed-secrets` | `https://bitnami-labs.github.io/sealed-secrets` | `2.16.2` | `2.19.3` | 20 | **repo 404s** — §3.3 |
| `seaweedfs` | `seaweedfs` | `https://seaweedfs.github.io/seaweedfs/helm` | `4.33.0` | `4.43.0` | 10 | yes |
| `spire` | `spire` | `https://spiffe.github.io/helm-charts-hardened/` | `0.24.2` | `0.30.0` | 15 | yes |
| `tempo` | `tempo` | `https://grafana.github.io/helm-charts` | `1.18.0` | `1.24.4` | 17 | yes |
| `temporal` | `temporal` | `https://go.temporal.io/helm-charts` | `0.59.0` | `1.6.0` | 26 | yes |
| `trust-manager` | `trust-manager` | `https://charts.jetstack.io` | `v0.15.0` | `v0.24.0` | 15 | yes |
| `vault` | `vault` | `https://helm.releases.hashicorp.com` | `0.29.1` | `0.34.1` | 7 | yes |
| `weaviate` | `weaviate` | `https://weaviate.github.io/weaviate-helm` | `17.6.0` | `17.8.3` | 7 | yes |
| *(bootstrap only)* | `spire-crds` | `https://spiffe.github.io/helm-charts-hardened/` | `0.5.0` | `0.6.0` | 1 | yes |

### 2a. Provenance — the index URL behind every "latest" above

All fetched **2026-08-21**. HTTP repos: append `/index.yaml` to the repoURL as written in the manifest.

| repo | index URL fetched | note |
|---|---|---|
| Grafana (`alloy`, `loki`, `mimir-distributed`, `tempo`) | `https://grafana.github.io/helm-charts/index.yaml` | one index, four charts |
| Argo (`argo-cd`, `argo-workflows`, `argo-rollouts`) | `https://argoproj.github.io/argo-helm/index.yaml` | one index, three charts |
| Jetstack (`cert-manager`, `trust-manager`) | `https://charts.jetstack.io/index.yaml` | one index, two charts |
| SPIFFE (`spire`, `spire-crds`) | `https://spiffe.github.io/helm-charts-hardened/index.yaml` | one index, two charts |
| Cilium | `https://helm.cilium.io/index.yaml` | |
| CockroachDB | `https://charts.cockroachdb.com/index.yaml` | |
| Dapr | `https://dapr.github.io/helm-charts/index.yaml` | |
| External Secrets | `https://charts.external-secrets.io/index.yaml` | |
| GitLab | `https://charts.gitlab.io/index.yaml` | |
| Headlamp | `https://kubernetes-sigs.github.io/headlamp/index.yaml` | |
| gabe565 (`headscale`) | `https://charts.gabe565.com/index.yaml` | |
| prometheus-community | `https://prometheus-community.github.io/helm-charts/index.yaml` | |
| Longhorn | `https://charts.longhorn.io/index.yaml` | |
| MinIO | `https://charts.min.io/index.yaml` | |
| NATS | `https://nats-io.github.io/k8s/helm/charts/index.yaml` | |
| node-feature-discovery | `https://kubernetes-sigs.github.io/node-feature-discovery/charts/index.yaml` | |
| otwld (`ollama`) | `https://otwld.github.io/ollama-helm/index.yaml` | |
| Gatekeeper | `https://open-policy-agent.github.io/gatekeeper/charts/index.yaml` | |
| OpenZiti | `https://docs.openziti.io/helm-charts/index.yaml` | |
| Bitnami (`redis`) | `https://charts.bitnami.com/bitnami/index.yaml` | 27 MB |
| sealed-secrets **(new home)** | `https://bitnami.github.io/sealed-secrets/index.yaml` | the pinned repo 404s — §3.3 |
| SeaweedFS | `https://seaweedfs.github.io/seaweedfs/helm/index.yaml` | |
| Temporal | `https://go.temporal.io/helm-charts/index.yaml` | |
| HashiCorp (`vault`) | `https://helm.releases.hashicorp.com/index.yaml` | |
| Weaviate | `https://weaviate.github.io/weaviate-helm/index.yaml` | |
| **OCI** `gha-runner-scale-set{,-controller}` | `https://ghcr.io/v2/actions/actions-runner-controller-charts/<chart>/tags/list` | anon pull token; corroborated against `actions/actions-runner-controller` GitHub releases (`gha-runner-scale-set-0.14.2`, 2026-05-22) |
| **OCI** `hindsight` | `https://ghcr.io/v2/vectorize-io/charts/hindsight/tags/list` | anon pull token; 61 tags |
| **OCI** `forgejo` | `https://code.forgejo.org/v2/forgejo-helm/forgejo/tags/list` | token required; 169 tags, unbroken history `0.0.1` → `17.1.5` |

---

## 3. The three coordinates that are broken, not merely stale

These are a different failure class from being behind. A stale pin still *resolves*; these do not. Fixing them
is not a version-bump decision — it is a correctness fix that has to happen whether or not anything is
upgraded.

### 3.1 `oz` pins `ziti-controller 1.4.5` — never published (CONFIRMED, already filed)

Confirmed against `https://docs.openziti.io/helm-charts/index.yaml`, fetched 2026-08-21:

- The `ziti-controller` **1.x chart line ends at `1.3.4`**. There is no `1.4.x` chart version at all.
- `1.4.2` exists in that index only as an **`appVersion`** — never as a chart version.
- The version immediately after `1.3.4` is `2.0.0`; latest is `3.2.1` (appVersion `2.0.1`).

Already filed as workitem `081M0JVD5YG087G0R002QDFR9H` / PR #13313. Recorded here for completeness, not
re-derived. **A bump is not a bump here** — `1.3.4` → `3.2.1` crosses two majors from the nearest *real*
version, and the current manifest has never synced.

### 3.2 `forgejo` pins `9.0.6` — also never published, and the repo protocol changed too

This is the second instance of the same class, found by this survey.

**Measured** (`https://code.forgejo.org/v2/forgejo-helm/forgejo/tags/list`, 2026-08-21 — 169 tags, complete
history from `0.0.1`, nothing pruned):

- The **`9.x` chart line contains exactly one release: `9.0.0`.** The next published version is `10.0.0`.
  **`9.0.6` has never existed as a chart version.**
- Unlike the `oz` case, `9.0.6` is not an appVersion either. The chart↔app mapping is offset by one major and
  the Forgejo `9.0.x` app line tops out at `9.0.3`, read straight from the OCI config blobs:

  | chart | appVersion |
  |---|---|
  | `8.2.3` | `8.0.3` |
  | `9.0.0` | `8.0.3` |
  | `10.0.0` | `9.0.0` |
  | `10.1.0` / `10.1.1` / `10.1.2` | `9.0.1` / `9.0.2` / `9.0.3` |
  | `11.0.0` | `10.0.0` |
  | `17.1.5` (latest) | `15.0.7` |

  So `9.0.6` is neither coordinate. It looks like an appVersion-shaped guess, which is the *same mistake as
  `oz` one step further along* — close enough to a real numbering scheme to survive review, corresponding to
  nothing.

**And the repoURL is dead as well.** `https://code.forgejo.org/forgejo-helm/index.yaml` returns **404**; the
Forgejo instance's package index at `https://code.forgejo.org/api/packages/forgejo-helm/helm/index.yaml`
returns `200` with **`entries: {}`** — an empty repo. The chart is OCI-only now:

```
helm install forgejo oci://code.forgejo.org/forgejo-helm/forgejo
```

(RESEARCHED: <https://code.forgejo.org/forgejo-helm/forgejo-helm> README, fetched 2026-08-21.)

Fixing `forgejo` therefore needs three separate decisions — protocol (`http` → `oci://`), a real version, and
an **eight-major** upgrade path (`9.x` → `17.x`). It is not a bump.

### 3.3 `sealed-secrets` — the repoURL 404s; the chart moved orgs

`https://bitnami-labs.github.io/sealed-secrets/index.yaml` returns **404** (so does the Pages root). The
project moved from the `bitnami-labs` org to `bitnami`:

- New repo: `https://bitnami.github.io/sealed-secrets` — **MEASURED**, `200`, 87 `sealed-secrets` entries.
- The pinned `2.16.2` **is** published there, so this one is a pure `repoURL` correction with no version
  change forced. Latest is `2.19.3` (appVersion `0.39.1`, 2026-08-20) — 20 behind, same major.
- RESEARCHED: <https://github.com/bitnami/sealed-secrets/issues/1982> — "ANNOUNCEMENT: Repository moving to
  bitnami/sealed-secrets – Action Required for Helm Users", which names the ArgoCD `repoURL` edit explicitly.

**This is the cheapest fix in the whole survey and it is not optional** — the Application cannot resolve today.

---

## 4. Major boundaries — where the count stops mattering

A patch bump and a major bump are not the same decision, so they are not in the same column. `versions behind`
in §2 is a *staleness* signal; it is not a difficulty signal. `kube-prometheus-stack` is 435 versions behind
and `nats` is 33 — but `nats` crosses `1.x → 2.x`, which is the harder change of the two to reason about.

### 4a. Crosses a strict major boundary — 14 charts, each a human decision

| chart | pinned → latest | majors crossed | upstream upgrade material |
|---|---|---|---|
| `alloy` | `0.10.1` → `1.11.1` | 1 (`0`→`1`) | [chart CHANGELOG](https://github.com/grafana/alloy/blob/main/operations/helm/charts/alloy/CHANGELOG.md) |
| `argo-workflows` | `0.42.5` → `2.0.2` | 2 (`1.0.0`, `2.0.0`) | [chart README](https://github.com/argoproj/argo-helm/blob/main/charts/argo-workflows/README.md) |
| `argo-cd` | `7.7.10` → `10.4.0` | 3 (`8`,`9`,`10`) | [chart README](https://github.com/argoproj/argo-helm/blob/main/charts/argo-cd/README.md) · [Argo CD upgrade overview](https://argo-cd.readthedocs.io/en/stable/operator-manual/upgrading/overview/) |
| `cockroachdb` | `14.0.5` → `21.0.4` | 7 | [chart CHANGELOG](https://github.com/cockroachdb/helm-charts/blob/master/CHANGELOG.md) |
| `external-secrets` | `0.10.7` → `2.9.0` | 2 (`1.0.0`, `2.0.0`) | [releases](https://github.com/external-secrets/external-secrets/releases) — **the load-bearing break is the CRD API: `v1beta1` was dropped in `v0.17.0`, so every `ExternalSecret`/`SecretStore` manifest must be on `external-secrets.io/v1` before this bump** ([stability & support](https://external-secrets.io/latest/introduction/stability-support/)) |
| `forgejo` | `9.0.6` *(unpublished)* → `17.1.5` | 8 | [chart repo README / `To v10`…`To v17` sections](https://code.forgejo.org/forgejo-helm/forgejo-helm) — plus the `oci://` protocol change (§3.2) |
| `gitlab` | `8.7.0` → `10.3.0` | 2 | [GitLab chart release/upgrade notes](https://docs.gitlab.com/charts/releases/) — GitLab forbids skipping *app* majors on upgrade |
| `kube-prometheus-stack` | `65.5.0` → `88.5.3` | 23 | [chart README "Upgrading Chart"](https://github.com/prometheus-community/helm-charts/blob/main/charts/kube-prometheus-stack/README.md) — nearly every major is a manual CRD `kubectl apply` step |
| `loki` | `6.18.0` → `7.3.0` | 1 | [chart CHANGELOG](https://github.com/grafana/loki/blob/main/production/helm/loki/CHANGELOG.md) |
| `mimir-distributed` | `5.5.1` → `6.2.0` | 1 | [Mimir Helm chart docs / migration guides](https://grafana.com/docs/helm-charts/mimir-distributed/latest/) |
| `nats` | `1.2.7` → `2.14.5` | 1 | [`UPGRADING.md`](https://github.com/nats-io/k8s/blob/main/helm/charts/nats/UPGRADING.md) — the `1.x`→`2.x` values schema is a rewrite |
| `ziti-controller` (`oz`) | `1.4.5` *(unpublished)*; real predecessor `1.3.4` → `3.2.1` | 2 | [openziti/helm-charts releases](https://github.com/openziti/helm-charts/releases) |
| `redis` | `20.5.0` → `28.0.7` | 8 | [bitnami/charts redis](https://github.com/bitnami/charts/tree/main/bitnami/redis) — **and read the catalog change first**: [bitnami/charts#35164, "Upcoming changes to the Bitnami catalog (effective August 28th, 2025)"](https://github.com/bitnami/charts/issues/35164). Most images moved to a commercial tier / `bitnamilegacy`; this affects the *pinned* version too, not just the bump. |
| `temporal` | `0.59.0` → `1.6.0` | 1 (`0`→`1`) | [temporalio/helm-charts releases](https://github.com/temporalio/helm-charts/releases) |

### 4b. On a `0.x` line — 9 charts, where the *minor* is the breaking axis

SemVer §4: below `1.0.0` nothing is guaranteed. These do not appear in 4a because the leading number does not
change, but each minor step may break, and they must not be batched with the §5 patch bumps.

`arc-controller` `0.12.1`→`0.14.2` · `arc-runner-set` `0.12.1`→`0.14.2` · `headlamp` `0.30.1`→`0.45.0` ·
`headscale` `0.4.0`→`0.16.0` · `hindsight` `0.3.0`→`0.9.1` · `node-feature-discovery` `0.17.1`→`0.19.0` ·
`spire` `0.24.2`→`0.30.0` (+ `spire-crds` `0.5.0`→`0.6.0`) · `trust-manager` `v0.15.0`→`v0.24.0` ·
`vault` `0.29.1`→`0.34.1`

Two notes worth carrying:

- **`headscale` upstream is itself stale.** Latest `0.16.0` was published **2025-02-19** — 18 months old. The
  gap here is mostly upstream's, not ours.
- **`vault` `0.29.1`→`0.34.1`** is only 7 behind and is the *smallest* remaining gap, but it interacts with
  the live OpenBao migration question — see `docs/research/2026-08-21-openbao-migration-path-for-the-deployed-vault-*.md`
  before spending the bump.

### 4c. Same major, but upstream forbids skipping minors — 2 charts

Neither of these can be done as a single edit even though the major does not change.

- **`cilium` `1.16.5` → `1.20.1`.** Cilium supports upgrade only from the immediately preceding minor, so this
  is four sequential steps (`1.17` → `1.18` → `1.19` → `1.20`), each with its own pre-flight.
  [Cilium upgrade guide](https://docs.cilium.io/en/stable/operations/upgrade/). Cilium is also pinned a second
  time in `bootstrap/cilium-install.yaml` (§6).
- **`longhorn` `1.7.2` → `1.12.1`.** Longhorn supports one-minor-at-a-time upgrades only — five sequential
  steps, on the storage layer, with data on it.
  [Longhorn upgrade docs](https://longhorn.io/docs/1.12.1/deploy/upgrade/).

### 4d. Same major, ordinary minor/patch — 9 charts

`argo-rollouts` · `cert-manager` · `dapr` · `gatekeeper` · `ollama` · `sealed-secrets` · `seaweedfs` ·
`tempo` · `weaviate`. These are the §5 material.

---

## 5. Recommended batches

Ordered by "can this land without a human deciding anything".

### Batch 0 — repoURL corrections. Land first, independent of any version decision.

| app | change | why now |
|---|---|---|
| `sealed-secrets` | `repoURL` → `https://bitnami.github.io/sealed-secrets`, keep `targetRevision: 2.16.2` | the pinned repo 404s; the pinned version exists at the new one, so this is a zero-risk correctness fix |

`oz` and `forgejo` also belong to this class in spirit, but neither has a "keep the version" option — both
pins are fictional. They are §5 "human decision" rows, below.

### Batch 1 — safe together: same major, no CRDs shipped by the chart, no sequential constraint

| app | bump |
|---|---|
| `tempo` | `1.18.0` → `1.24.4` |
| `weaviate` | `17.6.0` → `17.8.3` |
| `seaweedfs` | `4.33.0` → `4.43.0` |
| `ollama` | `1.6.0` → `1.76.0` |

One PR, one revert if it goes wrong. Nothing in this batch touches cluster-wide API surface.

### Batch 2 — same major, but the chart ships CRDs: one PR each, read the notes

| app | bump | why separate |
|---|---|---|
| `cert-manager` | `v1.16.2` → `v1.21.1` | CRDs; cert-manager's own upgrade notes per minor |
| `open-policy-agent` (`gatekeeper`) | `3.18.1` → `3.23.0` | CRDs; constraint templates are live policy |
| `argo-rollouts` | `2.39.5` → `2.41.1` | CRDs; `Rollout` objects are in-flight state |
| `dapr` | `1.14.4` → `1.18.3` | CRDs + sidecar injector; a bad bump breaks every annotated pod |

### Batch 3 — `0.x`, minor == breaking: one PR each, but mechanically simple

`vault` (7 behind, smallest gap — but see the OpenBao note) · `node-feature-discovery` (8 behind) ·
`arc-controller` + `arc-runner-set` (5 behind, **must move together** — the controller and the scale set are
version-coupled) · `trust-manager` (15) · `spire` + `spire-crds` (**must move together**) · `headlamp` (17) ·
`hindsight` (45) · `headscale` (31).

### Batch 4 — needs a human decision. Do not batch, do not automate.

- **The two fictional pins:** `oz` (`ziti-controller`) and `forgejo`. Both need a real target chosen, and
  `forgejo` needs an `oci://` protocol change on top.
- **The 12 remaining major crossings** in §4a.
- **The two sequential-only upgrades** in §4c (`cilium`, `longhorn`) — each is a multi-step plan, and
  `longhorn` carries live data.
- **`redis`** specifically: the Bitnami catalog change means this is a *supply* decision before it is a
  version decision. Staying on `20.5.0` is not neutral either.

### `minio` — no action

`5.4.0` is the latest published version. Note that MinIO's chart repo has published nothing since
**2025-01-02**, so "current" here means "upstream stopped", not "upstream is fresh".

---

## 6. The bootstrap manifests carry a second copy of six pins

`full-ai-cluster/k8s/bootstrap/` pins charts independently of `applications/`. **Measured today they are in
exact lockstep** — no drift:

| bootstrap file | chart | version | matches `applications/`? |
|---|---|---|---|
| `cilium-install.yaml` | `cilium` | `1.16.5` | yes |
| `cert-manager-install.yaml` | `cert-manager` | `v1.16.2` | yes |
| `trust-manager-install.yaml` | `trust-manager` | `v0.15.0` | yes |
| `external-secrets-install.yaml` | `external-secrets` | `0.10.7` | yes |
| `argocd-install.yaml` | `argo-cd` | `7.7.10` | yes |
| `spire-install.yaml` | `spire` | `0.24.2` | yes |
| `spire-install.yaml` | `spire-crds` | `0.5.0` | **no counterpart** — bootstrap-only |

The lockstep is the thing to preserve. **Any bump to those six must edit two files**, or the survey's cleanest
current property silently becomes a seventh finding.

---

## 7. What this survey is not

- **It is not a resolvability checker.** A separate machine check for these same coordinates is being built
  elsewhere; this document is the human-readable read of one point in time. Six weeks from now the version
  numbers here are historical and the *index URLs in §2a* are what still has value.
- **It does not bump anything.** Every table above is a claim about upstream, not a change to this repo.
- **"Latest" excludes pre-releases.** Several of these repos publish `-rc`/`-beta` entries; none are counted
  in "latest" or in "versions behind".
- **`versions behind` counts releases, not risk.** §4 exists because that column is actively misleading if
  read alone.

## Pointers

- `full-ai-cluster/k8s/applications/*/Application.yaml` — the 35 surveyed pins.
- `full-ai-cluster/k8s/bootstrap/*-install.yaml` — the second copy of six of them (§6).
- `workitems/081M0JVD5YG087G0R002QDFR9H-oz-pins-ziti-controller-1-4-5-*.md` — the `oz` finding (PR #13313);
  §3.2 is its second instance.
- `workitems/081M0JX5GQ8087G0R002TD5Z0Q-forgejo-pins-chart-9-0-6-*.md` — §3.2 filed (this PR).
- `workitems/081M0JX5KV3087G0R001DMWP1C-sealed-secrets-repourl-404s-*.md` — §3.3 filed (this PR).
- `docs/research/2026-08-21-what-each-helm-chart-actually-needs-on-day-zero-derived-from-chart-defaults-not-from-a-budget.md`
  — the resource side of the same chart roster.
- `docs/research/2026-08-21-openbao-migration-path-for-the-deployed-vault-*.md` — why the `vault` row is not
  a free bump.
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why every "latest" above carries the index URL it
  was read from. A version number with no provenance is unmetered.
- `.claude/rules/anchor-to-human-prior-art.md` — §4's upstream links are the checked anchors; a bump proposed
  without one is a coincidence of numbers.
