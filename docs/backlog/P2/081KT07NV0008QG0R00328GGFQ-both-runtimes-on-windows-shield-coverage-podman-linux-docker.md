---
id: 081KT07NV0008QG0R00328GGFQ
priority: P2
status: open
title: "Both-runtimes-on-Windows shield coverage — podman (Linux-container path via WSL2) alongside docker (Windows-container install.ps1 shield)"
created: 2026-06-01
last_updated: 2026-06-01
depends_on: [081KT07NV0008QG0R001CBQ2X2, 081KSKBP80008QG0R002J03WGA]
classification: buildable-now
decomposition: atomic
owners: [devops-engineer]
type: chore
---

# 081KT07NV0008QG0R00328GGFQ — Both-runtimes-on-Windows shield coverage

## Origin (the operator 2026-06-01)

> *"we can default to podman for linux stuff but we do have some windows containers
> stuff we use for testing install.ps1 we can still default to docker for that. can we
> setup tests that both work on windows in our shields?"*

## The capability reality (WebSearch 2026-06-01, dep-pin-search-first)

- **Docker on Windows** runs **both** Windows containers (Server Core base images on the
  Windows kernel) **and** Linux containers (via WSL2 / Docker Desktop).
- **Podman on Windows** runs **Linux containers ONLY** — via a WSL2/Hyper-V Linux VM
  (the podman machine). It has **no native Windows-container support**
  ([podman-desktop.io/docs/installation/windows-install](https://podman-desktop.io/docs/installation/windows-install)).

So "both work on Windows" cannot mean "both run Windows containers" (podman can't). It
means **each runtime verified on Windows in its supported container mode**:

| Container mode on Windows | Docker | Podman |
|---|---|---|
| **Windows containers** (install.ps1 Server-Core shield) | ✅ (only option) | ❌ impossible |
| **Linux containers** (WSL2) | ✅ | ✅ |

## Current shield state

- `docker-windows-install-ps1-test` — install.ps1 on Windows Server Core (a **Windows
  container**, Docker). Stays Docker-only by necessity (podman can't do Windows containers).
- `wsl-install-sh-test` — install.sh in real WSL2 Ubuntu on a windows-2025 host (081KSKBP80008QG0R002J03WGA).
- **Gap:** no shield verifies **podman functions on Windows** (its Linux-container path
  via WSL2). The runtime the manifest now installs (`RedHat.Podman`) is unshielded on
  Windows.

## Acceptance

- [ ] New `podman-windows-linux-container-test` shield on `runs-on: windows-2025`,
      mirroring the `wsl-install-sh-test` pattern (WSL2 provisioned via the proven
      `Vampire/setup-wsl` action — SHA-pinned with trailing `# vX.Y.Z`).
- [ ] It installs podman (manifest pin `RedHat.Podman`), `podman machine init` +
      `podman machine start`, and **asserts** a real Linux container runs
      (`podman run --rm <small-linux-image>` → expected output). **Assert, don't skip**
      (per `automated-tests-are-the-shield-assert-dont-skip.md`).
- [ ] **Spike first** — verify on a hosted `windows-2025` runner that `podman machine`
      (WSL2 backend) actually works in CI: nested-virt/WSL2 availability, and whether
      rootless brings up the user `podman.socket` or CI needs **rootful** (empirically,
      rootless failed to bring up the user socket on a real Windows laptop 2026-06-01 —
      `ssh: rejected: connect failed`; rootful worked). Pin the chosen mode in the shield.
- [ ] The existing `docker-windows-install-ps1-test` (Windows-container path) stays as-is
      — Docker is the declared Windows default for Windows-container workloads (081KT07NV0008QG0R001CBQ2X2).
- [ ] Optional follow-on (only once the executor's `ZETA_CONTAINER_RUNTIME → auto-detect
      [podman, docker]` selection code exists — not built yet): a test that auto-detect
      picks the right runtime on Windows. Out of scope until that code lands.
- [ ] Follows the install-shield security pattern: runner pinned (`windows-2025`, not
      `-latest`); third-party actions SHA-pinned; `permissions: contents: read`;
      concurrency cancel-in-progress for PRs; no `github.event.*` in `run:`.

## Feasibility note (substrate-honest)

`podman machine` in hosted-Windows CI is the risk. WSL2 IS available on `windows-2025`
runners (the `wsl-install-sh-test` shield proves it), but `podman machine init` + a Linux
container is heavier and may hit the rootless user-socket brittleness Gemini flagged in
081KT07NV0008QG0R001CBQ2X2 ("Podman on Windows… brittle… an autonomous agent will hallucinate fixes until it
spirals"). The spike de-risks this before committing the shield. If hosted-runner podman
machine proves unworkable, fall back to **podman-in-WSL2-directly** (install podman inside
the WSL2 Ubuntu distro and run a Linux container there — no podman-machine layer), which
sidesteps the machine/VM-nesting entirely.

## Why P2

The runtime is installed + functional (manual verification 2026-06-01: podman 5.8.2
machine running rootful, `podman run` works, OCI bridge live alongside Docker Desktop),
but it's **unshielded** on Windows — a regression in the podman-on-Windows path wouldn't
be caught. Per the shield rule an unshielded-but-shipped surface reads as covered. Not
blocking (docker is the Windows default), so P2.

## Composes with

- 081KT07NV0008QG0R001CBQ2X2 (docker-vs-podman OCI-runtime decision; docker = Mac/Win default, podman preferred on Linux cluster)
- 081KSKBP80008QG0R002J03WGA (Windows parity lane; `wsl-install-sh-test` is the windows-2025 + WSL2 template to mirror)
- 081KT07NV0008QG0R002ZFN79J (git-bash routing shield — sibling Windows shield-coverage gap)
- `.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md` (assert, don't skip-to-green)
- `tools/setup/manifests/windows` (the `podman` entry + the Windows-container caveat note this row is cross-linked from)
- `.github/workflows/wsl-install-sh-test.yml` + `.github/workflows/docker-windows-install-ps1-test.yml` (the two existing Windows shields)
