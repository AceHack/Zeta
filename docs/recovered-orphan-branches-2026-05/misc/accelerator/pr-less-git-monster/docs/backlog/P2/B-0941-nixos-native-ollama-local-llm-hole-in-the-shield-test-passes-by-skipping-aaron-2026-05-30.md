---
id: B-0941
priority: P2
status: open
title: NixOS-native ollama for the local-LLM primitive — close the hole in the shield (NixOS test passes by SKIPPING, not validating)
tier: install-graph-correctness
ask: Aaron 2026-05-30
created: 2026-05-30
last_updated: 2026-05-30
decomposition: leaf
composes_with:
  - tools/setup/common/local-llm.sh
  - tools/setup/manifests/local-llm
  - .github/workflows/docker-nixos-install-sh-test.yml
  - tools/accelerator/validate-local-llm.ts
  - docs/backlog/P2/B-0940-evaluate-ubuntu-support-value-nixos-primary-community-reach-aaron-2026-05-30.md
tags: [install-sh, nixos, ollama, local-llm, ci, docker, false-green, entropy-shield]
type: bug
---

# B-0941 — NixOS-native ollama: close the hole in the shield

## Origin

Surfaced 2026-05-30 while validating the local-LLM core primitive (ollama +
qwen2.5:0.5b CPU model) across the Docker Ubuntu+NixOS install.sh test matrix.

Aaron 2026-05-30, on what actually holds back entropy: *"it's impossible to keep
all the install surfaces in your mind at once — only automation can be sure a
nixos change didn't break ubuntu or mac and vice versa. trying to manually make
sure everything is a losing game to entropy."* And the sharpening: the entropy
shield is not install.sh itself — *"the automated tests around install.sh
honestly — that's the shield."*

This row is a **hole in that shield.**

## The bug — false-green on the primary OS

`tools/setup/common/local-llm.sh` installs ollama on Linux by downloading the
**generic upstream binary** (`ollama-linux-<arch>.tar.zst`) into `~/.local/bin`.
That works on Ubuntu (FHS). It does **NOT** work on NixOS:

- NixOS is **non-FHS** — a generic dynamically-linked binary dropped into
  `~/.local/bin` won't find its loader/libs. The ollama binary won't run.
- `local-llm.sh` is intentionally **graceful** (warn + `exit 0` on any failure)
  so install.sh never hard-fails on the local-LLM step.

Compose those two facts and the result is a **false-green**: on NixOS,
`local-llm.sh` fails to produce a working ollama, skips gracefully, and the
`docker-nixos-install-sh-test` build **passes anyway** — because the NixOS test
validates that *install.sh runs clean*, NOT that *the local-LLM actually works*.

So the automated test (the shield) reports green on the **primary OS** while the
local-LLM primitive is non-functional there. A shield with a hole is worse than a
known gap, because it reads as covered.

NixOS is the primary (B-0940: declarative-by-construction; boots the real
hardware via USB/ISO). The local-LLM primitive being silently broken on the
primary — behind a green check — is the exact failure mode the test matrix exists
to prevent.

## Fix (two halves — both required to close the hole)

### Half 1 — NixOS-native ollama (declarative)

NixOS should get ollama the declarative-native way, not via the Ubuntu
generic-binary retrofit:

- Add `services.ollama.enable = true;` (or `environment.systemPackages = [ pkgs.ollama ];`
  + a oneshot model-pull unit) to the appropriate NixOS module
  (`full-ai-cluster/nixos/modules/common.nix` or a dedicated `local-llm.nix`).
- Pin the model to `manifests/local-llm` (`qwen2.5:0.5b`) so the declarative
  pin stays the single source of truth across all three OSes.
- `local-llm.sh` should **detect NixOS** (`/etc/NIXOS` or `$NIX_PATH`) and
  no-op there (ollama comes from the system closure, not the script) — the
  generic-binary path stays for Ubuntu only.

Note: existing `ollama` mentions in `full-ai-cluster/nixos/` are the **big-cluster
GPU-serving** path (worker-gpu via Ollama/vLLM, per control-plane README) — a
different concern from this small-CPU dev/CI/DST local-LLM primitive. This row is
the latter.

### Half 2 — make the NixOS test ASSERT, not skip

Turn the false-green into a true signal: the `docker-nixos-install-sh-test` (and
its Dockerfile) must run the same local-LLM validation the Ubuntu test does —
start the daemon, assert the pinned model is present, run the **real** `chooseIndex`
probe (`tools/accelerator/validate-local-llm.ts`), and **fail the build if the
local-LLM is absent**. Graceful-skip is correct for `install.sh` (don't brick a
machine over an optional probe), but the **test** must not inherit that grace —
the test's job is to catch exactly this.

## Acceptance

1. On a NixOS image, the local-LLM primitive (ollama + pinned model + working
   `chooseIndex`) is functional — installed the declarative-native way.
2. `docker-nixos-install-sh-test` ASSERTS the local-LLM works (real probe), and
   **fails** if it doesn't — no more graceful-skip-to-green for the primitive.
3. The `manifests/local-llm` model pin remains the single cross-OS source of
   truth (Ubuntu generic-binary, macOS brew, NixOS nixpkgs all read it).

## Why P2 (not P1)

The local-LLM primitive is a **testing/DST seam** (the move-next selector + the
planned observe.ts auto-classifier), not yet a production-serving path. The hole
is in test-fidelity on the primary OS, which matters before harvest-to-main but
doesn't block live behavior today. Raise to P1 if/when the local-LLM becomes
load-bearing for a shipped path on NixOS hardware.

## Composes

- **B-0940** (Ubuntu-value evaluation; NixOS primary) — this row is the concrete
  correctness counterpart: NixOS-primary means the NixOS local-LLM must actually
  work, not just pass-by-skip.
- The Docker Ubuntu+NixOS(+mac) install.sh test matrix — the shield; this row
  patches a hole in it.
- `.claude/rules/dep-pin-search-first-authority.md` — `manifests/local-llm` model
  pin as the single declarative source of truth across OSes.
