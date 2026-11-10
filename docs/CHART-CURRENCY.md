# Helm chart currency — how far behind every pin is, and whether upstream is still alive

<!-- GENERATED FILE. Do not hand-edit: `bun src/Core.TypeScript/hygiene/report-chart-currency.ts --write` overwrites it. -->

**As of:** 2026-11-09T23:37:38Z — the instant `published-chart-versions.json` was last refreshed. Every age below is measured against that instant, not against the moment you are reading this, so this file is byte-reproducible from committed data.

**This is a report, never a gate.** Being behind is a standing condition, not a regression: 35 of 38 pins are behind upstream right now. A CI check on that would be red from birth and learned-to-ignore within a week. The blocking question — *does this pin resolve at all?* — is a different one and is answered on every PR by `src/Core.TypeScript/hygiene/audit-chart-target-revisions.ts`.

**Behind is not unmaintained.** A pure versions-behind metric reports the most dangerous dependency in this tree as the healthiest one, which is exactly what happened with `minio`: it is the only pin that is not behind, and only because upstream archived the repository. So the gap and upstream's publishing record are two separate columns, and a chart nobody has published in over a year reads `DORMANT`, not `CURRENT`.

## Headline

| | count |
|---|---|
| chart coordinates under `full-ai-cluster/k8s/applications` | 38 |
| behind upstream | 35 |
| …of those, crossing a **major** boundary | 5 |
| …of those, a `0.x` minor (breaking by semver convention) | 8 |
| at the newest version and upstream still active | 3 |
| **`DORMANT`** — at the newest version because upstream stopped publishing | 0 |
| upstream silent for over a year (any gap) | 0 |
| **`UNREACHABLE`** — the refresh could not reach the repository | 0 |
| pin upstream never published | 0 |
| publish dates unavailable (OCI registries carry none) | 4 |

## Every remote chart pin

| verdict | app | chart | pinned | pin published | newest stable | published | behind | bump | upstream |
|---|---|---|---|---|---|---|---|---|---|
| `BEHIND-MAJOR` | `kube-prometheus-stack` | `kube-prometheus-stack` | `88.6.3` | 2026-09-02 | `93.1.1` | 2026-11-09 | 70 | **MAJOR** | active 0d |
| `BEHIND-MAJOR` | `loki` | `loki` | `18.12.1` | 2026-09-04 | `21.1.0` | 2026-11-09 | 41 | **MAJOR** | active 0d |
| `BEHIND-MAJOR` | `temporal` | `temporal` | `0.59.0` | 2025-03-28 | `1.8.0` | 2026-11-03 | 28 | **MAJOR** | active 6d |
| `BEHIND-MAJOR` | `hindsight` | `hindsight` | `0.9.2` | ? | `1.2.0` | ? | 7 | **MAJOR** | unknown |
| `BEHIND-MAJOR` | `tempo` | `tempo` | `2.3.0` | 2026-08-25 | `3.2.1` | 2026-10-21 | 5 | **MAJOR** | active 19d |
| `BEHIND` | `argocd` | `argo-cd` | `10.8.0` | 2026-09-04 | `10.17.1` | 2026-11-09 | 32 | minor | active 0d |
| `BEHIND` | `spire` | `spire` | `0.24.2` | 2025-02-27 | `0.30.4` | 2026-10-25 | 19 | minor (0.x) | active 15d |
| `BEHIND` | `ollama` | `ollama` | `1.79.0` | 2026-09-02 | `1.95.0` | 2026-11-04 | 16 | minor | active 5d |
| `BEHIND` | `argo-workflows` | `argo-workflows` | `2.0.4` | 2026-09-04 | `2.0.18` | 2026-11-06 | 13 | patch | active 3d |
| `BEHIND` | `argo-rollouts` | `argo-rollouts` | `2.43.0` | 2026-09-01 | `2.43.12` | 2026-11-09 | 10 | patch | active 0d |
| `BEHIND` | `openbao` | `openbao` | `0.29.4` | 2026-09-03 | `0.30.7` | 2026-11-06 | 10 | minor (0.x) | active 3d |
| `BEHIND` | `dapr` | `dapr` | `1.18.3` | 2026-10-31 | `1.19.1` | 2026-10-31 | 9 | minor | active 9d |
| `BEHIND` | `alloy` | `alloy` | `1.12.1` | 2026-08-27 | `1.15.0` | 2026-10-29 | 8 | minor | active 11d |
| `BEHIND` | `gitlab` | `gitlab` | `10.4.1` | 2026-09-23 | `10.5.4` | 2026-10-29 | 8 | minor | active 11d |
| `BEHIND` | `seaweedfs` | `seaweedfs` | `4.45.0` | 2026-09-01 | `4.53.0` | 2026-11-08 | 8 | minor | active 1d |
| `BEHIND` | `forgejo` | `forgejo` | `17.1.5` | ? | `17.3.2` | ? | 6 | minor | unknown |
| `BEHIND` | `external-secrets` | `external-secrets` | `2.10.0` | 2026-08-28 | `2.14.0` | 2026-10-23 | 4 | minor | active 17d |
| `BEHIND` | `openziti-controller` | `ziti-controller` | `3.3.1` | 2026-08-31 | `3.4.1` | 2026-10-29 | 4 | minor | active 11d |
| `BEHIND` | `cilium` | `cilium` | `1.20.1` | 2026-08-18 | `1.20.4` | 2026-10-23 | 3 | patch | active 17d |
| `BEHIND` | `cockroachdb` | `cockroachdb` | `22.0.3` | 2026-08-28 | `22.0.6` | 2026-10-29 | 3 | patch | active 11d |
| `BEHIND` | `nats` | `nats` | `2.14.6` | 2026-08-28 | `2.15.2` | 2026-10-29 | 3 | minor | active 11d |
| `BEHIND` | `sealed-secrets` | `sealed-secrets` | `2.19.3` | 2026-08-20 | `2.22.0` | 2026-10-26 | 3 | minor | active 14d |
| `BEHIND` | `arc-controller` | `gha-runner-scale-set-controller` | `0.14.2` | ? | `0.15.1` | ? | 2 | minor (0.x) | unknown |
| `BEHIND` | `arc-runner-set` | `gha-runner-scale-set` | `0.14.2` | ? | `0.15.1` | ? | 2 | minor (0.x) | unknown |
| `BEHIND` | `cert-manager` | `cert-manager` | `v1.21.1` | 2026-07-29 | `v1.21.3` | 2026-10-23 | 2 | patch | active 17d |
| `BEHIND` | `longhorn` | `longhorn` | `1.12.1` | 2026-08-14 | `1.13.0` | 2026-09-29 | 2 | minor | active 41d |
| `BEHIND` | `mimir` | `mimir-distributed` | `6.2.0` | 2026-08-20 | `6.2.2` | 2026-10-26 | 2 | patch | active 14d |
| `BEHIND` | `node-feature-discovery` | `node-feature-discovery` | `0.19.0` | 2026-07-10 | `0.20.1` | 2026-10-23 | 2 | minor (0.x) | active 17d |
| `BEHIND` | `trust-manager` | `trust-manager` | `v0.24.0` | 2026-07-01 | `v0.26.0` | 2026-10-27 | 2 | minor (0.x) | active 13d |
| `BEHIND` | `cloudnativepg` | `cloudnative-pg` | `0.29.0` | 2026-06-29 | `0.29.1` | 2026-09-23 | 1 | patch | active 47d |
| `BEHIND` | `cnpg-barman-cloud` | `plugin-barman-cloud` | `0.8.1` | 2026-09-30 | `0.9.0` | 2026-11-09 | 1 | minor (0.x) | active 0d |
| `BEHIND` | `headlamp` | `headlamp` | `0.45.0` | 2026-08-20 | `0.46.0` | 2026-10-16 | 1 | minor (0.x) | active 24d |
| `BEHIND` | `keda` | `keda` | `2.20.2` | 2026-07-31 | `2.21.0` | 2026-09-23 | 1 | minor | active 47d |
| `BEHIND` | `opensearch` | `opensearch` | `3.8.0` | 2026-08-05 | `3.9.0` | 2026-09-29 | 1 | minor | active 41d |
| `BEHIND` | `redis` | `valkey` | `0.12.0` | 2026-09-02 | `0.12.1` | 2026-10-27 | 1 | patch | active 13d |
| `CURRENT` | `open-policy-agent` | `gatekeeper` | `3.23.1` | 2026-08-27 | `3.23.1` | 2026-08-27 | 0 | -- | active 74d |
| `CURRENT` | `spire-crds` | `spire-crds` | `0.6.1` | 2026-08-23 | `0.6.1` | 2026-08-23 | 0 | -- | active 78d |
| `CURRENT` | `weaviate` | `weaviate` | `17.8.3` | 2026-07-01 | `17.8.3` | 2026-07-01 | 0 | -- | active 131d |

## Rows that carry a caveat

- **`hindsight` / `hindsight`** (`full-ai-cluster/k8s/applications/hindsight/Application.yaml`) — OCI registries expose tags, not publish timestamps: /v2/<repo>/tags/list carries no `created` field, and reading one would cost a manifest fetch per tag. Publish dates for this coordinate are UNAVAILABLE, which is not the same fact as `published recently`.
- **`forgejo` / `forgejo`** (`full-ai-cluster/k8s/applications/forgejo/Application.yaml`) — OCI registries expose tags, not publish timestamps: /v2/<repo>/tags/list carries no `created` field, and reading one would cost a manifest fetch per tag. Publish dates for this coordinate are UNAVAILABLE, which is not the same fact as `published recently`.
- **`arc-controller` / `gha-runner-scale-set-controller`** (`full-ai-cluster/k8s/applications/arc-controller/Application.yaml`) — OCI registries expose tags, not publish timestamps: /v2/<repo>/tags/list carries no `created` field, and reading one would cost a manifest fetch per tag. Publish dates for this coordinate are UNAVAILABLE, which is not the same fact as `published recently`.
- **`arc-runner-set` / `gha-runner-scale-set`** (`full-ai-cluster/k8s/applications/arc-runner-set/Application.yaml`) — OCI registries expose tags, not publish timestamps: /v2/<repo>/tags/list carries no `created` field, and reading one would cost a manifest fetch per tag. Publish dates for this coordinate are UNAVAILABLE, which is not the same fact as `published recently`.

## Reading the columns

- **behind** — published **stable** versions strictly greater than the pin. Pre-releases are excluded from the count and from *newest stable*, because a pin sitting behind a release candidate is not behind anything an operator would deploy.
- **bump** — the compatibility boundary the newest version sits across. `**MAJOR**` and `patch` are not the same decision and deliberately do not share a column with the release count. `minor (0.x)` is called out separately because below `1.0.0` semver permits anything to change in a minor.
- **upstream** — days from upstream's most recent publish to the snapshot instant. `active` < 180d, `quiet` 180–365d, `**DORMANT**` ≥ 365d. The raw day count is printed beside the label so a reader who disagrees with the boundary can see the figure it came from.
- **`unknown`** — dates were never collected for that coordinate. OCI registries are the standing case: `/v2/<repo>/tags/list` returns tags with no timestamps, and reading one would cost a manifest fetch per tag. Unknown never renders as `active`.
- **`UNREACHABLE`** — the refresh could not reach the repository, so nothing here knows what upstream publishes. A check that did not run must never look like a check that passed.

## Scope, and where it stops

Every `spec.source` / `spec.sources[]` naming a remote chart under `full-ai-cluster/k8s/applications/**`, walked recursively. Deliberately out of scope, by name:

- **git-path sources** — `agent-memory`, `cdi`, `cilium-lb-ipam`, `cluster-hygiene`, `deepseek-coder`, `gmod`, `hat-system`, `headscale`, `kubevirt`, `orleans`, `platform`, `postgres-shared`, `qwen-coder`, `temporal-postgres`, `vllm`. These source a directory out of this repository and carry no chart version to be behind.
- **`full-ai-cluster/k8s/bootstrap/`** — the app-of-apps root and the bootstrap chart pins. The resolvability audit excludes them for the same reason and this report inherits its coordinate set unchanged, so the two always describe the same tree.

## How to regenerate, and what refreshes the data

```bash
# 1. Re-read every upstream index (network, weekly, chart-version-refresh.yml).
#    Writes BOTH snapshots from one pass -- versions and publish dates.
bun src/Core.TypeScript/hygiene/audit-chart-target-revisions.ts --refresh

# 2. Re-render this file from the committed snapshots (no network).
bun src/Core.TypeScript/hygiene/report-chart-currency.ts --write
```

Data: `src/Core.TypeScript/hygiene/published-chart-versions.json` · `src/Core.TypeScript/hygiene/published-chart-dates.json`.
Anchor (Beacon): this is dependency **currency** — the question `npm outdated` / `cargo outdated` / Dependabot answer for package manifests, and which ArgoCD answers for nothing, since an `Application` has no lockfile and no upgrade notion at all.
