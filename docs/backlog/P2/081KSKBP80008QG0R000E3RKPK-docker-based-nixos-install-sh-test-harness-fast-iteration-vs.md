---
id: 081KSKBP80008QG0R000E3RKPK
priority: P2
status: open
title: docker-based NixOS install.sh test harness — fast iteration on tools/setup/install.sh + linux.sh changes; complements 081KSGS9H0008QG0R0011BC7T2 cascade #6 QEMU full-install-test (slow) with seconds-per-iteration loop; "easy dockerfile" per operator framing (Aaron 2026-05-27)
effort: S
ask: aaron 2026-05-27
created: 2026-05-27
last_updated: 2026-05-27
depends_on:
  - 081KSGS9H0008QG0R0011BC7T2
composes_with:
  - 081KSGS9H0008QG0R0031PBNGA
  - 081KSGS9H0008QG0R00120EEHM
  - 081KSGS9H0008QG0R001JNKBFD
tags: [ci-test-harness, docker, nixos, install-sh, fast-iteration, mise-bootstrap, runtime-version-validation, three-way-parity-extended-to-nixos, operator-iteration-cost, complements-qemu-full-install]
---

## Operator framing (Aaron 2026-05-27)

> *"we should add docker based nixos install.sh testing so we can iterate quick that's an easy dockerfile"*

Direct response after PR #5389 (the fix-fwd for PR #5388 which added NixOS detection to linux.sh) — operator named the iteration-cost problem: every change to install.sh / linux.sh / common/mise.sh on NixOS currently requires a full ISO build + USB flash + physical install cycle (081KSGS9H0008QG0R0011BC7T2 QEMU cascade #6 is the substrate-level fix, but it's a full-VM boot which takes minutes). Docker-based testing of JUST the install.sh script (not the full ISO/boot cycle) gives seconds-per-iteration.

## Why this is bounded + valuable

| Test surface | Validates | Cycle time | Today |
|---|---|---|---|
| Operator physical USB install | End-to-end (BIOS + disko + nixos-install + iter-5.x + reboot) | ~30+ min | only-after-full-PR-cascade |
| 081KSGS9H0008QG0R0011BC7T2 cascade #6 QEMU full-install | End-to-end virtualized | ~15 min | iter-5.2 STARTER landed; full slices pending |
| **081KSKBP80008QG0R000E3RKPK Docker install.sh harness** (this row) | Just `tools/setup/install.sh` on NixOS userspace | **~30-60 sec** | not yet exists |

Docker testing is the FASTEST iteration loop for the linux.sh + mise.sh + common/* substrate. Aaron's catch ("we've drifted for nixos for some reason for bun") is exactly the class of bug Docker-fast-iteration would catch BEFORE it ships to a real install.

## Proposed mitigation

### Phase 1 — Minimal Dockerfile (operator's "easy dockerfile")

```dockerfile
# tools/ci/dockerfiles/nixos-install-sh-test/Dockerfile
FROM nixos/nix:latest

# /etc/NIXOS marker file — what linux.sh's NixOS detection branch
# (per PR #5389) uses to skip the apt step.
RUN touch /etc/NIXOS

WORKDIR /workspace
COPY . .

# Run the canonical install entry — same script dev laptops + CI
# runners + devcontainers + NixOS cluster nodes all use.
RUN tools/setup/install.sh

# Verify mise installed bun = 1.3 (from .mise.toml)
RUN bash -lc 'eval "$(mise activate bash)"; bun --version'

# Verify claude-code installable via mise-managed bun
RUN bash -lc 'eval "$(mise activate bash)"; bun install --global @anthropic-ai/claude-code 2>&1 | tail -3; test -x ~/.bun/bin/claude'
```

Build + run via `docker build` (or via the substrate-honest `tools/ci/`
TS test wrapper per Rule 0 — `bun tools/ci/docker-nixos-install-sh-test.ts`).

### Phase 2 — GitHub Actions integration

Add a workflow step gated to runs that touch `tools/setup/**` or `full-ai-cluster/nixos/modules/common.nix`:

```yaml
- name: Docker NixOS install.sh test
  if: |
    contains(github.event.head_commit.modified, 'tools/setup/') ||
    contains(github.event.head_commit.modified, 'full-ai-cluster/nixos/modules/common.nix')
  run: bun tools/ci/docker-nixos-install-sh-test.ts
```

### Phase 3 — Compose with 081KSGS9H0008QG0R0011BC7T2 QEMU cascade

Docker harness validates `install.sh` on NixOS userspace; QEMU validates the full ISO/boot/install/post-reboot chain. Two complementary surfaces:

- Docker test catches: linux.sh bugs, mise.sh bugs, .mise.toml version pin issues, install.sh dispatch bugs
- QEMU test catches: ISO build bugs, disko config issues, nixos-install flake-eval bugs, post-reboot bootloader issues, iter-5.4 self-registration end-to-end

Both run on CI; Docker fires more often (faster), QEMU runs on every PR that touches the install substrate.

## Acceptance

### Phase 1 (Docker harness exists)

- [ ] `tools/ci/dockerfiles/nixos-install-sh-test/Dockerfile` exists
- [ ] `tools/ci/docker-nixos-install-sh-test.ts` TS wrapper (per Rule 0)
- [ ] Local invocation succeeds: `bun tools/ci/docker-nixos-install-sh-test.ts` exits 0 in <60 sec
- [ ] Validates `install.sh` runs cleanly + mise installs bun = 1.3 + claude-code installable

### Phase 2 (CI integration)

- [ ] GitHub Actions workflow runs the Docker test on PRs that touch install substrate
- [ ] Path-filter scoped to `tools/setup/**` + `full-ai-cluster/nixos/modules/common.nix`
- [ ] Workflow uploads logs as artifact for diagnostic
- [ ] Pre-existing PR (#5389 alignment fix-fwd) re-evaluable in this harness

### Phase 3 (compose with 081KSGS9H0008QG0R0011BC7T2)

- [ ] Both Docker (Phase 1+2 above) AND QEMU (081KSGS9H0008QG0R0011BC7T2 cascade #6) run on PRs that touch install
- [ ] Phase tier-table documents which catches which bug class
- [ ] Tick shard documents an empirical-iteration session using Docker harness for fast loop

## Composes with

- 081KSGS9H0008QG0R0011BC7T2 cascade #6 (QEMU full-install CI test) — complementary; Docker = fast-iteration; QEMU = end-to-end
- 081KSGS9H0008QG0R00120EEHM (install bug cluster — Bug 4+5+6+7+8 + future Bug N+) — Docker harness catches Bug-N at write-time vs reboot-time
- 081KSGS9H0008QG0R001JNKBFD (node-local Claude agent) — Phase 1 of 081KSGS9H0008QG0R001JNKBFD includes claude-code install validation; Docker harness validates the install-side of that work
- 081KSGS9H0008QG0R0031PBNGA (Ace package-manager-of-package-managers) — Docker NixOS install.sh test is one slice of three-way-parity validation; Ace's substrate inherits these test patterns
- PR #5389 (iter-5.5.1 alignment fix-fwd) — the FIRST install.sh change that needs Docker-fast iteration to validate without full ISO cycle
- `.claude/rules/rule-0-no-sh-files.md` — TS wrapper for the Docker invocation (NOT a `.sh` script)
- `.mise.toml` (canonical pinned runtimes) — Docker test verifies mise reads them correctly on NixOS
- GOVERNANCE §24 (three-way parity — dev/CI/devcontainer; this row extends to NixOS-via-Docker validation surface)

## Why P2

- Aaron's "easy dockerfile" framing + immediate operator-value (iter-5.x install bugs caught in seconds vs minutes)
- BUT: needs Docker available in CI runners + Docker daemon socket access pattern (operational concerns)
- BUT: needs the substrate work (Phase 1 dockerfile + TS wrapper) before CI integration
- P2 reflects "operator-named, bounded, immediate-iteration-value" — not gating any current shipped work but high-leverage for future install-substrate iteration

## Sub-rows likely needed

- 081KSKBP80008QG0R000E3RKPK.1: Phase 1 Dockerfile + TS wrapper
- 081KSKBP80008QG0R000E3RKPK.2: Phase 2 GitHub Actions integration
- 081KSKBP80008QG0R000E3RKPK.3: Phase 3 documentation of Docker-vs-QEMU coverage matrix

## Full reasoning

Aaron 2026-05-27 immediately after seeing PR #5389 ship the linux.sh NixOS-detection branch + zeta-install.sh delegation to tools/setup/install.sh. The substrate-engineering target: "we should add docker based nixos install.sh testing so we can iterate quick that's an easy dockerfile" + "nixos*" (correcting typo from "mixos").

The empirical case for fast-iteration is strong:

- iter-5.4 cascade has produced 8 distinct empirical bugs (Bug 1 through Bug 8) across multiple PRs
- Each was caught only after the operator did a USB flash + physical install
- Cycle time ~30+ min per iteration; Aaron has paid this many times today
- Docker harness would have caught Bug 5 (gh not in systemPackages), Bug 7 (NetBIOS conflict with smbd), Bug 8 (credential persistence gap) AT WRITE TIME

This row is the substrate-engineering investment to convert that 30-min cycle into a 30-sec cycle for the install.sh / linux.sh / mise.sh substrate scope. Composes with 081KSGS9H0008QG0R0011BC7T2 cascade #6 (which handles the full-VM scope at minutes-per-cycle).

Phasing is small (Phase 1 dockerfile is literally ~10 lines + a ~50-line TS wrapper); Aaron's "easy dockerfile" was substrate-honest about the scope.
