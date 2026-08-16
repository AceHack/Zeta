---
id: 081KZKS9A6B08QG0R0008EG72M
type: bug
state: done
priority: P2
slug: usb-nixos-installer-flake-nix-omits-the-mise-pin-overlay-loc
title: "usb-nixos-installer/flake.nix omits the mise-pin overlay — local nix build produces a different ISO than CI"
created: 2026-08-09T17:31:47.275Z
completed: 2026-08-16T23:22:59.051Z
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

## Resolution (2026-08-16)

**The inferred version delta is now MEASURED.** `nix eval` on aarch64-darwin, both flakes at
their own committed locks (evaluation only — no ISO was built, see "Not exercised" below):

| flake | `nixosConfigurations.installer.pkgs.mise.version` |
|---|---|
| `full-ai-cluster/flake.nix` (overlay applied — what CI builds) | **`2026.6.12`** |
| `full-ai-cluster/usb-nixos-installer/flake.nix` (retired; verbatim from `origin/main`) | **`2025.11.7`** |

Both locks pinned nixpkgs at the **same** rev `b77b3de8775677f84492abe84635f87b0e153f0f`, so the
overlay was the *only* difference between the two ISOs — not a general drift. `2025.11.7` is below
`.mise.toml`'s `min_version = 2026.6.12`, which is what makes it fatal at first boot rather than
merely stale.

**Fix taken: collapse (the preferred option).** `full-ai-cluster/usb-nixos-installer/flake.nix` and
its `flake.lock` are deleted; `full-ai-cluster/flake.nix` is the single definition of the installer
ISO. The documented build path was itself the wrong one — the root `flake.nix`, `infra/README.md`,
`infra/nix-darwin/README.md` and `infra/nix-darwin/configuration.nix` all said
`cd full-ai-cluster/usb-nixos-installer && nix build .#installer-iso`; all now say
`cd full-ai-cluster && …`.

**The check:** `src/Core.TypeScript/hygiene/mise-pin-parity.ts` (+ `.test.ts`), run by the gate's
`lint (bash retirement inventory + hygiene unit tests)` job. Two halves, matching the two ways to
re-diverge:

1. **Structural** — every flake found by `git ls-files '*flake.nix'` that references
   `nixos/installer/configuration.nix` must also reference `overlays/mise-pin.nix`. Discovery is by
   glob, not by a hardcoded list, so a newly-added flake is covered the moment it exists.
2. **Value** — the four sites restating the pin (`.mise.toml`, `tools/setup/linux.sh`,
   `tools/setup/macos.sh`, `full-ai-cluster/nixos/overlays/mise-pin.nix`) must agree, compared
   against `.mise.toml` as canonical. No expected version is written into the checker.

**Known gap, named not hidden:** the overlay cannot *derive* the version from `.mise.toml` — that
file sits above the `full-ai-cluster/` flake root and Nix flakes cannot reference paths above their
own root. The restatement is structural to Nix; check (2) is the binding. Derived-by-check, not
derived-by-construction.

**Not exercised:** no ISO was built. `nix eval` proves the package *selection* on both sides; a
full `nix build .#installer-iso` (Linux, or CI's `build-ai-cluster-iso.yml`) remains the only thing
that exercises the ISO itself. The first-boot behaviour of `tools/setup/linux.sh` under the old
mise is still reasoned-about, not run.

**Bug found in the fix itself:** the structural check's first version keyed on the marker
`usb-nixos-installer/nixos/installer/configuration.nix`. The retired flake lived *inside* that
directory and referenced its config as `./nixos/installer/configuration.nix` — so the marker did not
occur in the file, and the check passed green on the exact bug it was written to catch. Caught by
mutation-testing the checker against the real retired file rather than against a fixture written to
match the marker. Marker is now the suffix `nixos/installer/configuration.nix`, and the fixtures are
literal flake text rather than interpolations of the markers under test.

## Cross-refs

- `081KZETP6AT08QG0R003MG1VYN` — the NixOS/mise dynamic-linker root cause this was found beside.
- `full-ai-cluster/nixos/overlays/mise-pin.nix` · `tools/setup/linux.sh` (l.191, l.209-215)
- Owner: USB/zflash trajectory + devops (GOVERNANCE §24).
