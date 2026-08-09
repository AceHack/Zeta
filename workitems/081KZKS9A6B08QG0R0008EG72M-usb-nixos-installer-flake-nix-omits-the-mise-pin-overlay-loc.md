---
id: 081KZKS9A6B08QG0R0008EG72M
type: bug
state: backlog
priority: P2
slug: usb-nixos-installer-flake-nix-omits-the-mise-pin-overlay-loc
title: "usb-nixos-installer/flake.nix omits the mise-pin overlay — local nix build produces a different ISO than CI"
created: 2026-08-09T17:31:47.275Z
depends_on: []
composes_with: []
---

# usb-nixos-installer/flake.nix omits the mise-pin overlay — local nix build produces a different ISO than CI

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZKS9A6B08QG0R0008EG72M-*.md` glob. -->

## Two flakes claim to describe "the installer ISO"; they build different ISOs

Found by **Dejan** (devops-engineer) while analysing 081KZETP6AT, 2026-08-09; verified by Otto.

- `full-ai-cluster/flake.nix:81` applies the mise pin:
  `({ nixpkgs.overlays = [ (import ./nixos/overlays/mise-pin.nix) ]; })` — via `mkSystem`, to
  **every** configuration including the installer ISO. **This is what CI builds**
  (`.github/workflows/build-ai-cluster-iso.yml` → `full-ai-cluster/flake.nix#installer-iso`).
- `full-ai-cluster/usb-nixos-installer/flake.nix` builds `nixosConfigurations.installer` from the
  **same** `full-ai-cluster/usb-nixos-installer/nixos/installer/configuration.nix` (l.28) but applies **no overlay** — verified: no
  `overlays` / `mise-pin` reference anywhere in that flake.

So `nix build` run *inside* `usb-nixos-installer/` produces an ISO carrying an **unpinned**
nixpkgs-25.11 mise (~2025.11.x), while CI produces one carrying the pinned, `autoPatchelfHook`-ed
`mise-2026.6.12`. Same declared artifact, two different results depending on which flake you
invoke.

## Why it matters

The unpinned mise fails the version check at `tools/setup/linux.sh:191` (`MISE_PIN_VERSION`) and
falls into the tarball branch at `linux.sh:209-215`, which is deliberately **fatal** on NixOS. So a
developer building the ISO the "obvious" way (from the installer directory) gets an ISO that
behaves differently from every ISO CI has ever validated — and the divergence surfaces only at
first boot.

This is a **parity/DEBT** issue independent of the 081KZETP6AT toolchain decision (nix-ld vs
nix-native): whichever way that goes, two flakes describing one artifact with different results is
wrong on its own.

## Fix (sketch)

Apply the same overlay in `full-ai-cluster/usb-nixos-installer/flake.nix`, **or** collapse the duplicate flake so
there is exactly one definition of the installer ISO (preferred — DV2.0: one hub, not two).
Either way, add a check that the two flakes' installer configurations agree, so this cannot
silently re-diverge.

Not validated locally: needs a `nix build` on Linux (or CI) to confirm the version delta —
the *config* divergence is confirmed by reading, the *resulting* mise versions are inferred.

## Cross-refs

- `081KZETP6AT08QG0R003MG1VYN` — the NixOS/mise dynamic-linker root cause this was found beside.
- `full-ai-cluster/nixos/overlays/mise-pin.nix` · `tools/setup/linux.sh` (l.191, l.209-215)
- Owner: USB/zflash trajectory + devops (GOVERNANCE §24).
