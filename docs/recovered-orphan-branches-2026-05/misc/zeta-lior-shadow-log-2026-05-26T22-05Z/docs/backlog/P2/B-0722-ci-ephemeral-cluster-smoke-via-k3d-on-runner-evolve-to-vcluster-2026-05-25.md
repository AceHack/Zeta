---
id: B-0722
priority: P2
status: open
title: "CI ephemeral cluster smoke — k3d-on-runner for every AI-cluster PR; evolve to vcluster-on-shared-host when persistent dev cluster exists"
created: 2026-05-25
last_updated: 2026-05-25
classification: buildable-now
decomposition: atomic
type: ci-substrate
discovered_by: aaron
owners: [aaron, maintainer]
composes_with:
  - full-ai-cluster/dev-cluster/
  - full-ai-cluster/dev-cluster/SYNC-WAVES.md
  - full-ai-cluster/dev-cluster/README.md
  - full-ai-cluster/k8s/applications/argocd/Application.yaml
---

# B-0722 — CI ephemeral cluster smoke (k3d-on-runner now, vcluster-on-shared-host later)

## Carved blade

> Every PR that touches the AI cluster's Application graph should spin up an ephemeral cluster, reconcile the root App-of-Apps, and assert sync waves resolve — BEFORE the change hits prod. k3d-on-runner is sufficient for v1; vcluster evolves the cycle from ~5 min to ~30 sec when the persistent dev cluster exists.

## Origin

Aaron 2026-05-25, during the dev-cluster scaffolding session (PR #4953): *"also tests should be able to use kind/k3d to do ephemeral clusters on prs"*. Then: *"we will do k8s in k8s later k8s in docker if fine for ci now"*.

The dev-cluster substrate landed in PR #4953 is CI-ready by design — `up.sh` accepts a `--config <profile>` flag (after the local refactor in this row's PR) and a git-ref argument. CI just needs to call it with a single-node profile and run sync-wave assertions.

## What lands (when this row is picked up)

### Phase 1 — k3d-on-runner (the v1 ask)

1. **`full-ai-cluster/dev-cluster/profiles/ci.k3d-config.yaml`** — minimal single-node k3d profile sized for GitHub-hosted runners (2 CPU / 7 GB). No agents, no local registry, same Cilium-takeover K3S flags.

2. **`full-ai-cluster/tools/ci/cluster-smoke.sh`** — wraps `dev-cluster/up.sh --config profiles/ci.k3d-config.yaml`, then:
   - Builds the sync-wave plan by parsing every `Application.yaml`'s `argocd.argoproj.io/sync-wave` annotation
   - Polls each app per wave, asserting Healthy/Synced OR Healthy/OutOfSync (acceptable for placeholder Deployments at `replicas: 0`)
   - Captures `argocd-applications.json`, `nodes.txt`, `pods.txt`, `recent-events.txt` to `ARTIFACT_DIR`
   - Tears down on EXIT trap (skip with `SKIP_TEARDOWN=1`)
   - Exit codes: 0 = pass; 1 = converge timeout; 2 = pre-flight fail

3. **`.github/workflows/ai-cluster-smoke.yml`** — triggers on `pull_request` with path filter (`full-ai-cluster/k8s/applications/**`, `dev-cluster/**`, `tools/ci/**`, this workflow file). Concurrency group cancels in-flight runs on new commits. Installs k3d + kubectl + helm + jq, runs `cluster-smoke.sh`, uploads artifacts, posts PR comment on failure with sync-wave plan + recent events.
   - **Security**: every github-context value (head SHA, etc.) reaches `run:` via `env:` block — never inlined — per the security-reminder hook. Use `${{ github.event.pull_request.head.sha }}` only inside `env:`, then reference as `$GIT_REF` in `run:`.

4. **Small `up.sh` refactor** — add `--config <path>` flag; read `metadata.name` from the chosen config so `down.sh` + smoke script stay in sync regardless of cluster name. (Default behavior preserved: no flag = current `k3d-config.yaml`.)

### Phase 2 — vcluster-on-shared-host (the "later" path)

When the bare-metal cluster comes up and is reachable from CI:

- Replace the k3d-on-runner spin-up with `vcluster create pr-${{ github.event.pull_request.number }}` on a long-running host cluster
- Each PR gets its own isolated vcluster on shared infrastructure
- Spin-up drops from ~3-5 min (k3d full cluster) to ~30 sec (vcluster pod-on-existing-cluster)
- Tear-down is `vcluster delete pr-<num>`; one command, instant
- Same `cluster-smoke.sh` runs against vcluster's kubeconfig — no other code changes

References for the Phase 2 design:

- **vcluster (Loft)** — https://www.vcluster.com/ — virtual K8s clusters as pods
- **Cluster API (CAPI)** — https://cluster-api.sigs.k8s.io/ — declarative cluster management via CRDs
- **Kamaji** / **k0smotron** — managed control planes inside a host cluster (lighter alternatives to CAPI)

## Why P2 not P1

The dev-cluster substrate (PR #4953) already lets a maintainer manually run `./up.sh feat/my-branch` to test a PR locally. Automating that in CI is a clear win but not blocking — substrate exists for manual dev-test today, and the prod cluster doesn't exist yet so there's no urgent "block bad changes from reaching prod" pressure.

Becomes P1 when:

- Prod cluster bootstrap completes (bare-metal install finished)
- Multiple maintainers / agents are landing AI-cluster PRs in parallel (manual dev-test stops scaling)

## Acceptance

- [ ] `up.sh --config profiles/ci.k3d-config.yaml` works locally and brings up a single-node cluster
- [ ] `tools/ci/cluster-smoke.sh` runs end-to-end against a fresh checkout and exits 0 on a clean main
- [ ] `.github/workflows/ai-cluster-smoke.yml` triggers on a PR touching `full-ai-cluster/k8s/applications/**`, completes within 45 min, posts artifacts
- [ ] A deliberately broken PR (e.g., sync-wave annotation missing on a new app, or chart-values typo) is caught by the workflow before merge
- [ ] Workflow concurrency cancels in-flight runs on new commits to the same PR
- [ ] Every github-context value reaches `run:` via `env:` (no inline interpolation — per the security-reminder hook's workflow-injection guidance)

## Estimated scope

- Phase 1: ~1 day of dedicated work; ~500 lines (1 yaml profile, 1 shell script, 1 workflow, small up.sh refactor)
- Phase 2: separate row, depends on Phase 1 + persistent shared cluster existing

## References

- PR #4953 — dev-cluster substrate this row builds on (k3d, ArgoCD bootstrap, sync-wave annotations across 34 Applications, SYNC-WAVES.md)
- PR #4950 — disko cookie-cutter (bare-metal install path; complements but doesn't block this)
- PR #4951 — NFD + lstopo + zeta-install (compose with smoke test for hardware-feature assertions)
- PR #4930 — hat-system operator (one of the apps the smoke test must reconcile)
- `full-ai-cluster/dev-cluster/SYNC-WAVES.md` — dependency graph the smoke test asserts against
- `full-ai-cluster/dev-cluster/DOCKER-DESKTOP.md` — resource sizing context relevant to CI runner constraints

## Composes with substrate

- The dev/prod parity model from PR #4953 (same workloads from same git ref via ArgoCD)
- The sync-wave annotations on all 34 Applications (PR #4953) — smoke test asserts the graph reconciles in order
- `dev-cluster/README.md` "Multi-cluster ArgoCD pattern (future)" section — Phase 2 evolution path

## Not in scope

- GPU-dependent workloads (ollama / vllm / deepseek-coder / qwen-coder) — these stay excluded from CI per the dev-cluster root App-of-Apps `exclude:` glob
- Longhorn — single-node CI has nothing to replicate; local-path-provisioner handles PVCs
- Real model serving — no GPUs on GitHub-hosted runners
- Production cluster smoke — separate row; production reconciliation runs continuously via ArgoCD on the bare-metal cluster, not via CI
