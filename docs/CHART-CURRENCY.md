# Helm chart currency — how far behind every pin is, and whether upstream is still alive

<!-- GENERATED FILE. Do not hand-edit: `bun src/Core.TypeScript/hygiene/report-chart-currency.ts --write` overwrites it. -->

**As of:** 2026-08-22T01:41:57Z — the instant `published-chart-versions.json` was last refreshed. Every age below is measured against that instant, not against the moment you are reading this, so this file is byte-reproducible from committed data.

**This is a report, never a gate.** Being behind is a standing condition, not a regression: 33 of 36 pins are behind upstream right now. A CI check on that would be red from birth and learned-to-ignore within a week. The blocking question — *does this pin resolve at all?* — is a different one and is answered on every PR by `src/Core.TypeScript/hygiene/audit-chart-target-revisions.ts`.

**Behind is not unmaintained.** A pure versions-behind metric reports the most dangerous dependency in this tree as the healthiest one, which is exactly what happened with `minio`: it is the only pin that is not behind, and only because upstream archived the repository. So the gap and upstream's publishing record are two separate columns, and a chart nobody has published in over a year reads `DORMANT`, not `CURRENT`.

## Headline

| | count |
|---|---|
| chart coordinates under `full-ai-cluster/k8s/applications` | 36 |
| behind upstream | 33 |
| …of those, crossing a **major** boundary | 13 |
| …of those, a `0.x` minor (breaking by semver convention) | 10 |
| at the newest version and upstream still active | 2 |
| **`DORMANT`** — at the newest version because upstream stopped publishing | 1 |
| upstream silent for over a year (any gap) | 2 |
| **`UNREACHABLE`** — the refresh could not reach the repository | 0 |
| pin upstream never published | 1 |
| publish dates unavailable (OCI registries carry none) | 4 |

## Every remote chart pin

| verdict | app | chart | pinned | pin published | newest stable | published | behind | bump | upstream |
|---|---|---|---|---|---|---|---|---|---|
| `PIN-UNPUBLISHED` | `openziti-controller` | `ziti-controller` | `1.4.5` | ? | `3.2.1` | 2026-07-20 | 13 | **MAJOR** | active 32d |
| `DORMANT` | `minio` | `minio` | `5.4.0` | 2025-01-02 | `5.4.0` | 2025-01-02 | 0 | -- | **DORMANT** 595d |
| `BEHIND-MAJOR` | `kube-prometheus-stack` | `kube-prometheus-stack` | `65.5.0` | 2024-10-25 | `88.5.3` | 2026-08-21 | 435 | **MAJOR** | active 0d |
| `BEHIND-MAJOR` | `argocd` | `argo-cd` | `7.7.10` | 2024-12-12 | `10.4.0` | 2026-08-17 | 195 | **MAJOR** | active 4d |
| `BEHIND-MAJOR` | `gitlab` | `gitlab` | `8.7.0` | 2024-12-19 | `10.3.0` | 2026-08-20 | 159 | **MAJOR** | active 1d |
| `BEHIND-MAJOR` | `redis` | `redis` | `20.5.0` | 2024-12-11 | `28.0.7` | 2026-08-18 | 119 | **MAJOR** | active 3d |
| `BEHIND-MAJOR` | `argo-workflows` | `argo-workflows` | `0.42.5` | 2024-10-02 | `2.0.2` | 2026-08-21 | 75 | **MAJOR** | active 0d |
| `BEHIND-MAJOR` | `cockroachdb` | `cockroachdb` | `14.0.5` | 2024-11-06 | `21.0.4` | 2026-08-05 | 53 | **MAJOR** | active 16d |
| `BEHIND-MAJOR` | `loki` | `loki` | `6.18.0` | 2024-10-16 | `7.3.0` | 2026-08-10 | 48 | **MAJOR** | active 11d |
| `BEHIND-MAJOR` | `external-secrets` | `external-secrets` | `0.10.7` | 2024-11-23 | `2.9.0` | 2026-08-08 | 43 | **MAJOR** | active 13d |
| `BEHIND-MAJOR` | `alloy` | `alloy` | `0.10.1` | 2024-12-03 | `1.11.1` | 2026-08-06 | 36 | **MAJOR** | active 15d |
| `BEHIND-MAJOR` | `nats` | `nats` | `1.2.7` | 2024-12-11 | `2.14.5` | 2026-08-19 | 33 | **MAJOR** | active 2d |
| `BEHIND-MAJOR` | `temporal` | `temporal` | `0.59.0` | 2025-03-28 | `1.6.0` | 2026-07-13 | 26 | **MAJOR** | active 39d |
| `BEHIND-MAJOR` | `mimir` | `mimir-distributed` | `5.5.1` | 2024-10-21 | `6.2.0` | 2026-08-20 | 13 | **MAJOR** | active 1d |
| `BEHIND` | `ollama` | `ollama` | `1.6.0` | 2025-02-17 | `1.77.0` | 2026-08-21 | 71 | minor | active 0d |
| `BEHIND` | `cilium` | `cilium` | `1.16.5` | 2024-12-17 | `1.20.1` | 2026-08-18 | 56 | minor | active 3d |
| `BEHIND` | `dapr` | `dapr` | `1.14.4` | 2026-08-20 | `1.18.3` | 2026-08-20 | 54 | minor | active 1d |
| `BEHIND` | `hindsight` | `hindsight` | `0.3.0` | ? | `0.9.1` | ? | 45 | minor (0.x) | unknown |
| `BEHIND` | `headscale` | `headscale` | `0.4.0` | 2023-01-14 | `0.16.0` | 2025-02-19 | 31 | minor (0.x) | **DORMANT** 548d |
| `BEHIND` | `cert-manager` | `cert-manager` | `v1.16.2` | 2024-11-20 | `v1.21.1` | 2026-07-29 | 28 | minor | active 23d |
| `BEHIND` | `headlamp` | `headlamp` | `0.30.1` | 2025-03-28 | `0.45.0` | 2026-08-20 | 17 | minor (0.x) | active 1d |
| `BEHIND` | `tempo` | `tempo` | `1.18.0` | 2025-01-15 | `1.24.4` | 2026-01-30 | 17 | minor | quiet 203d |
| `BEHIND` | `longhorn` | `longhorn` | `1.7.2` | 2024-10-18 | `1.12.1` | 2026-08-14 | 16 | minor | active 8d |
| `BEHIND` | `spire` | `spire` | `0.24.2` | 2025-02-27 | `0.30.0` | 2026-08-02 | 15 | minor (0.x) | active 19d |
| `BEHIND` | `trust-manager` | `trust-manager` | `v0.15.0` | 2025-01-13 | `v0.24.0` | 2026-07-01 | 15 | minor (0.x) | active 51d |
| `BEHIND` | `argo-rollouts` | `argo-rollouts` | `2.39.5` | 2025-04-01 | `2.41.1` | 2026-07-19 | 14 | minor | active 33d |
| `BEHIND` | `open-policy-agent` | `gatekeeper` | `3.18.1` | 2024-12-16 | `3.23.0` | 2026-07-09 | 13 | minor | active 43d |
| `BEHIND` | `seaweedfs` | `seaweedfs` | `4.33.0` | 2026-06-11 | `4.43.0` | 2026-08-21 | 10 | minor | active 0d |
| `BEHIND` | `node-feature-discovery` | `node-feature-discovery` | `0.17.1` | 2025-07-25 | `0.19.0` | 2026-07-10 | 8 | minor (0.x) | active 42d |
| `BEHIND` | `vault` | `vault` | `0.29.1` | 2024-11-20 | `0.34.1` | 2026-08-13 | 7 | minor (0.x) | active 8d |
| `BEHIND` | `weaviate` | `weaviate` | `17.6.0` | 2025-09-09 | `17.8.3` | 2026-07-01 | 7 | minor | active 51d |
| `BEHIND` | `arc-controller` | `gha-runner-scale-set-controller` | `0.12.1` | ? | `0.14.2` | ? | 5 | minor (0.x) | unknown |
| `BEHIND` | `arc-runner-set` | `gha-runner-scale-set` | `0.12.1` | ? | `0.14.2` | ? | 5 | minor (0.x) | unknown |
| `BEHIND` | `spire-crds` | `spire-crds` | `0.5.0` | 2024-10-28 | `0.6.0` | 2026-08-02 | 1 | minor (0.x) | active 19d |
| `CURRENT` | `forgejo` | `forgejo` | `17.1.5` | ? | `17.1.5` | ? | 0 | -- | unknown |
| `CURRENT` | `sealed-secrets` | `sealed-secrets` | `2.19.3` | 2026-08-20 | `2.19.3` | 2026-08-20 | 0 | -- | active 1d |

## Rows that carry a caveat

- **`openziti-controller` / `ziti-controller`** (`full-ai-cluster/k8s/applications/oz/Application.yaml`) — upstream never published this exact version -- see audit-chart-target-revisions.ts
- **`minio` / `minio`** (`full-ai-cluster/k8s/applications/minio/Application.yaml`) — at the newest published version ONLY because upstream stopped publishing
- **`hindsight` / `hindsight`** (`full-ai-cluster/k8s/applications/hindsight/Application.yaml`) — OCI registries expose tags, not publish timestamps: /v2/<repo>/tags/list carries no `created` field, and reading one would cost a manifest fetch per tag. Publish dates for this coordinate are UNAVAILABLE, which is not the same fact as `published recently`.
- **`arc-controller` / `gha-runner-scale-set-controller`** (`full-ai-cluster/k8s/applications/arc-controller/Application.yaml`) — OCI registries expose tags, not publish timestamps: /v2/<repo>/tags/list carries no `created` field, and reading one would cost a manifest fetch per tag. Publish dates for this coordinate are UNAVAILABLE, which is not the same fact as `published recently`.
- **`arc-runner-set` / `gha-runner-scale-set`** (`full-ai-cluster/k8s/applications/arc-runner-set/Application.yaml`) — OCI registries expose tags, not publish timestamps: /v2/<repo>/tags/list carries no `created` field, and reading one would cost a manifest fetch per tag. Publish dates for this coordinate are UNAVAILABLE, which is not the same fact as `published recently`.
- **`forgejo` / `forgejo`** (`full-ai-cluster/k8s/applications/forgejo/Application.yaml`) — OCI registries expose tags, not publish timestamps: /v2/<repo>/tags/list carries no `created` field, and reading one would cost a manifest fetch per tag. Publish dates for this coordinate are UNAVAILABLE, which is not the same fact as `published recently`.

## Reading the columns

- **behind** — published **stable** versions strictly greater than the pin. Pre-releases are excluded from the count and from *newest stable*, because a pin sitting behind a release candidate is not behind anything an operator would deploy.
- **bump** — the compatibility boundary the newest version sits across. `**MAJOR**` and `patch` are not the same decision and deliberately do not share a column with the release count. `minor (0.x)` is called out separately because below `1.0.0` semver permits anything to change in a minor.
- **upstream** — days from upstream's most recent publish to the snapshot instant. `active` < 180d, `quiet` 180–365d, `**DORMANT**` ≥ 365d. The raw day count is printed beside the label so a reader who disagrees with the boundary can see the figure it came from.
- **`unknown`** — dates were never collected for that coordinate. OCI registries are the standing case: `/v2/<repo>/tags/list` returns tags with no timestamps, and reading one would cost a manifest fetch per tag. Unknown never renders as `active`.
- **`UNREACHABLE`** — the refresh could not reach the repository, so nothing here knows what upstream publishes. A check that did not run must never look like a check that passed.

## Scope, and where it stops

Every `spec.source` / `spec.sources[]` naming a remote chart under `full-ai-cluster/k8s/applications/**`, walked recursively. Deliberately out of scope, by name:

- **git-path sources** — `agent-memory`, `cdi`, `cilium-lb-ipam`, `deepseek-coder`, `gmod`, `hat-system`, `kubevirt`, `orleans`, `platform`, `qwen-coder`, `vllm`. These source a directory out of this repository and carry no chart version to be behind.
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
