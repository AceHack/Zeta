# Handoff: Push `helm-validate.yml` to `Lucent-Financial-Group/Zeta`

**Date:** 2026-08-08
**From:** Lumen (Manus)
**To:** Agent with `workflows` write scope on `Lucent-Financial-Group/Zeta`
**Status:** File is written and tested locally. Blocked on `workflows` permission for remote push.

---

## What needs to happen

Push one file to `Lucent-Financial-Group/Zeta` main:

```
.github/workflows/helm-validate.yml
```

The file already exists locally at:

```
/home/ubuntu/lfg/Zeta/.github/workflows/helm-validate.yml
```

And in the `Lucent-Financial-Group/Zeta` repo at the local working tree (commit `951e2ec3` is on main, but the workflow file was not included because the push was rejected with 403).

---

## Why it was blocked

The GitHub App token used by this Manus session does not have `workflows` scope on `Lucent-Financial-Group/Zeta`. The Contents API returned:

```json
{ "message": "Resource not accessible by integration", "status": "403" }
```

A personal token with `workflow` scope (or a GitHub App with `workflows` permission) is required to create or update files under `.github/workflows/`.

---

## What the file does

`helm-validate.yml` is a GitHub Actions workflow that validates all ArgoCD `Application.yaml` manifests in `infra/k8s/applications/` on every PR and push to main.

It runs `bun infra/k8s/tests/validate-applications.ts` — a TypeScript script (already on main at `951e2ec3`) that checks:

1. YAML syntax — all `Application.yaml` files parse cleanly
2. Required ArgoCD fields — `apiVersion`, `kind`, `metadata`, `spec`, finalizer, `syncOptions`
3. Helm chart fields — `chart` + `targetRevision` present for Helm apps
4. `apiVersion=argoproj.io/v1alpha1`, `kind=Application`
5. `destination.server=https://kubernetes.default.svc` (in-cluster only)
6. `root-application.yaml` `recurse=true` + `directory.include` set
7. Online chart existence check (skipped with `--offline`)

**Current manifests covered (37/37 pass offline):**

- `argorollouts/Application.yaml`
- `argoworkflows/Application.yaml`
- `cockroachdb/Application.yaml`
- `gitlab/Application.yaml`
- `local-path-provisioner/Application.yaml`
- `longhorn/Application.yaml`
- `orleans/Application.yaml`

---

## Two jobs in the workflow

> **SUPERSEDED 2026-08-14 (Dejan).** The shape below is kept for lineage; the
> live workflow differs. See `.github/workflows/helm-validate.yml`, whose
> header carries the measurements. What changed and why:
>
> - The old `offline` job's YAML check **could not go red**. The validator
>   used a hand-rolled parser that never threw: a manifest with a tab-indented
>   line and an unterminated quote printed `PASS: ... valid YAML`, and a
>   duplicate mapping key gave `37 passed, 0 failed`, exit 0.
> - The old `online` job's chart check was a substring grep for
>   `name: <chart>` in `index.yaml`. It never looked at `targetRevision`, so
>   `999.999.999` gave `44 passed, 0 failed`, exit 0 — and it only ran on
>   push-to-main and a weekly cron, never on a pull request.
> - Weekly -> daily (`29 15 * * *`), per Aaron: "it should be more often than
>   weekly on the k8s testing".
> - The `workflow_dispatch` `offline` input is gone: the structural job is
>   always offline and the chart job is always online, so there is nothing left
>   for the toggle to select.

| Job          | Trigger                                                     | What it runs                                                                                                                                                                   |
| ------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `structural` | Every PR/push touching `infra/k8s/**`, daily cron, dispatch | `--offline` validation **plus** `bun test validate-applications.test.ts`, a 12-case mutation suite that proves the validator exits 1                                           |
| `charts`     | Same triggers; tier=full for `helm` + `kubeconform`         | Exact chart **version** resolution against the parsed repo index, then `helm template` of every chart with its real `valuesObject`, then `kubeconform -strict` over the render |

Measured 2026-08-14 (local, warm): offline validation 0.4 s; mutation suite
1.7 s; online version check 1.4 s over ~5 MB; `helm template` of all six charts
5.1 s; end-to-end `--render` 7.6 s. There was never a cost case for keeping
chart validation off pull requests.

Not caught by either job, stated rather than hidden: `helm template` and
`kubeconform` validate structure and schema, not semantics. Setting
`statefulset.replicas: "not-a-number"` on the cockroachdb chart renders
`replicas: 0` — schema-valid, silently wrong. Only a live cluster notices no
pod ever appears; that is the `k8s-argocd-health-test` lane's job.

Both jobs use:

- `ubuntu-24.04` runner
- `mise` cache (same cache key as `gate.yml`)
- `bun install --frozen-lockfile`
- SHA-pinned `actions/checkout` and `actions/cache`

---

## How to push it

**Option A — git push with a personal token that has `workflow` scope:**

```bash
cd /path/to/Zeta
git fetch origin main
git checkout main
# The file is already in the local working tree at .github/workflows/helm-validate.yml
# If it's not (e.g. fresh clone), copy it from the handoff:
# cp docs/handoffs/helm-validate.yml .github/workflows/helm-validate.yml
git add .github/workflows/helm-validate.yml
git commit -m "ci: add helm-validate.yml workflow (offline PR gate + online weekly chart check)"
git push origin main
```

**Option B — GitHub Contents API with a token that has `workflows` permission:**

```bash
CONTENT=$(base64 -w 0 .github/workflows/helm-validate.yml)
gh api --method PUT repos/Lucent-Financial-Group/Zeta/contents/.github/workflows/helm-validate.yml \
  -f message="ci: add helm-validate.yml workflow" \
  -f content="$CONTENT" \
  --jq '.commit.sha'
```

---

## File content

The full file content is reproduced below for reference. It is also available at:

- Local path: `/home/ubuntu/lfg/Zeta/.github/workflows/helm-validate.yml`
- In the Zeta working tree (not yet pushed to remote)

```yaml
name: helm-validate

on:
  pull_request:
    types: [opened, reopened, synchronize, ready_for_review]
    paths:
      - "infra/k8s/applications/**"
      - "infra/k8s/tests/validate-applications.ts"
  push:
    branches: [main]
    paths:
      - "infra/k8s/applications/**"
      - "infra/k8s/tests/validate-applications.ts"
  schedule:
    - cron: "0 9 * * 1"
  workflow_dispatch:
    inputs:
      offline:
        description: "Run in offline mode (skip chart existence check)"
        type: boolean
        default: false

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  offline:
    name: validate manifests (offline)
    runs-on: ubuntu-24.04
    timeout-minutes: 5
    steps:
      - name: Checkout
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - name: Cache mise runtimes
        uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
        with:
          path: |
            ~/.local/bin/mise
            ~/.local/share/mise
            ~/.cache/mise
          key: mise-helm-validate-${{ runner.os }}-${{ hashFiles('.mise.toml') }}
      - name: Install toolchain (mise + bun)
        env:
          MISE_GITHUB_TOKEN: ${{ github.token }}
        run: ./tools/setup/install.sh
      - name: Install bun dependencies
        run: bun install --frozen-lockfile
      - name: Validate Application manifests (offline)
        run: bun infra/k8s/tests/validate-applications.ts --offline

  online:
    name: validate manifests (online — chart existence)
    if: >
      github.event_name == 'push' ||
      github.event_name == 'schedule' ||
      github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    steps:
      - name: Checkout
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - name: Cache mise runtimes
        uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
        with:
          path: |
            ~/.local/bin/mise
            ~/.local/share/mise
            ~/.cache/mise
          key: mise-helm-validate-${{ runner.os }}-${{ hashFiles('.mise.toml') }}
      - name: Install toolchain (mise + bun)
        env:
          MISE_GITHUB_TOKEN: ${{ github.token }}
        run: ./tools/setup/install.sh
      - name: Install bun dependencies
        run: bun install --frozen-lockfile
      - name: Validate Application manifests (online — chart existence)
        run: |
          OFFLINE="${{ github.event.inputs.offline }}"
          if [[ "$OFFLINE" == "true" ]]; then
            bun infra/k8s/tests/validate-applications.ts --offline
          else
            bun infra/k8s/tests/validate-applications.ts
          fi
```

---

## Context: what else landed in this session

All of the following is already on `Lucent-Financial-Group/Zeta` main:

| Commit     | What                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| `951e2ec3` | `validate-applications.ts` (TS, replaces .sh), CockroachDB manifest, open-iscsi NixOS                        |
| `ce43026b` | dla-meter e2e tests, TravelerRankLedger persistence, Longhorn + local-path manifests                         |
| `8cd11af8` | dla-meter probe tests, calibration-bridge integration, GossipTelemetry orbital                               |
| `ddd3a8e3` | CommitPairCorrelator → dla-meter, §A #23 TravelerRankLedger in FROZEN-CORE                                   |
| `ef0e3891` | Anti-Sybil tests, GossipTelemetry orbital variants, CommitPairCorrelator                                     |
| `bab4193a` | TravelerRankLedger F#/TS, ShapeAcceptance EVE clone-gate, OrbitalAsymmetryBudget                             |
| `1b20b6eb` | OrbitalLink in ReticulumBusMeter/GossipTelemetry, resolveAtTickBridge + rankLedger, DurableDiplomacyRankGate |
| `ad7fb934` | BusRegime δ_max fix (Option 3), bus-meter.ts transcendental-refinement                                       |
| `f393c69d` | Caveat (b) research doc, anti-recurrence pointer in calibration-ledger.test.ts                               |
| `c6fb5ac0` | BipartiteMachZehnder.fs, TravelerRankLedger.Tests.fs, resolveAtTickBridge                                    |

The only thing NOT on remote is `helm-validate.yml`. Everything else is live.
