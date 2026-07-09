# Multiboot USB — boot ours, boot others, carry flash payloads

A **GRUB2 multiboot** USB (Aaron 2026-06-10: *"change our USB to give a choice of our boot and the
chance to boot others too ... use grub2 for the usb"*). One stick that:

- **boots ours** — the Zeta NixOS installer (built locally from the sibling flake);
- **boots others** — any x86 ISO you declare (GRUB loopback, no extraction);
- **carries flash payloads** — appliance disk images (e.g. MyNode Model Two) to `dd` onto a device.

This replaces the single-ISO `dd` model (`nix build .#installer-iso` → `dd` to stick, which boots
only the installer) with a GRUB menu + a declarative payload list.

## Files

- [`images.manifest`](images.manifest) — the **declarative** payload list (name · kind · source ·
  SHA-256). **No binaries in the repo** (no-binary-in-proof-lineage): images are fetched + verified at
  build time, never committed.
- [`grub.cfg`](grub.cfg) — the GRUB2 menu template copied onto the USB ESP.
- Planner (landed): [`src/Core.TypeScript/installer/multiboot/`](../../../src/Core.TypeScript/installer/multiboot/)
  — parse manifest, plan `/boot/` vs `/payloads/` layout, resolve SHA256SUMS latest, fill
  `@KERNEL@`/`@INITRD@`. Hermetic: `bun …/build-multiboot-usb.ts --plan`.
- Fetch / assemble `zeta-multiboot.img` — **next slice** (network + large artifacts).

## What's declared today

| name | kind | notes |
|---|---|---|
| `zeta-installer` | `grub-iso-local` | built by `nix build .#installer-iso` (no download, always current); GRUB loopback-boots it |
| `mynode-model-two` | `flash-img-latest` | newest `mynode_amd64_*.img.gz` resolved each build; verified against MyNode's `SHA256SUMS`; a **flash payload**, not a boot entry |

### MyNode Model Two is a flash payload, not a boot entry — and always the LATEST

MyNode ships **raw disk images** (`.img.gz`), not bootable ISOs — even the amd64 build. So Model Two
rides the USB under `/payloads/` and is **flashed onto the node** (td5 / td6), not GRUB-booted:

```sh
gunzip -c /payloads/mynode-model-two.img.gz | sudo dd of=/dev/<node-disk> bs=4M status=progress conv=fsync
```

**Always latest, never hard-coded (Aaron 2026-06-10: "make sure that process pulls the latest mynode
every time and is not hard coded to one").** The builder resolves the newest `mynode_amd64_*.img.gz`
from MyNode's published `SHA256SUMS` on every build and verifies the download against that fresh
checksum — so we track upstream automatically *and* catch transit corruption. (As of 2026-06-10 this
resolves to `mynode_amd64_0-3-34.img.gz`, SHA-256 `03498d02…81dde` — recorded for reference only; the
version is **not** pinned in the manifest.)

*Tradeoff (named):* verifying against the freshly-fetched `SHA256SUMS` guards **transit**, not a
**compromised upstream** (a pinned `flash-img` entry would freeze the version to guard the source).
For a re-flashable node appliance, latest-always is the right call; flip the entry to pinned
`flash-img` if source-pinning ever matters more than freshness. Ties the home-crypto-mining blueprint:
`.claude/skills/home-crypto-mining/blueprint-mynode-nodes.md` — td5/td6.

## Combine at BUILD time, not flash time (Aaron 2026-06-10)

The builder combines everything into **one deterministic composite USB *image*** (`zeta-multiboot.img`:
GRUB + `/boot/iso/*.iso` + `/payloads/*.img.gz`), **SHA-256-locked and qemu-testable** (the
[`tools/zflash`](../../../tools/zflash) pattern) — and *then* flashing is a dumb, reproducible
`dd` of that image. Combining is **not** done at flash time.

Why build-time:

- **Reproducible + verifiable** — the composite is a single artifact you can SHA-256-lock and replay
  (DST); flash-time file-copy is stateful, per-device, and has no artifact to verify.
- **Testable before hardware** — boot the composite in qemu (zflash harness) before any USB is touched.
- **Declarative** — contents come entirely from `images.manifest`; changing the stick = re-run the
  build, not hand-copy files (the Ventoy-style flash-time model we explicitly did NOT pick).

Tradeoff (accepted): to add/change an image you re-build (cheap; manifest-driven), and the composite is
large (Zeta ISO + MyNode ≈ several GB). Verifiability wins.

## Build (once `build-multiboot-usb.ts` lands)

1. `nix build .#installer-iso` (the Zeta installer ISO).
2. `bun build-multiboot-usb.ts` — fetches + SHA-256-verifies the manifest payloads and **assembles the
   composite `zeta-multiboot.img`** (GRUB installed, `grub.cfg` written, ISOs + payloads laid out).
   Emits the image's SHA-256. (qemu-bootable for test — zflash sibling.)
3. `dd if=zeta-multiboot.img of=/dev/<usb> bs=4M status=progress conv=fsync` — dumb, reproducible flash.
4. Boot the target on the stick → GRUB menu → pick Zeta (or another ISO). Flash MyNode from
   `/payloads/` per above.

## Honest scope / status

The **declarative manifest + GRUB config + pure planner** are here and reviewable
(`parseImagesManifest` / `planMultibootUsb` / `resolveLatestFromSha256Sums`). The **fetch +
assemble** step (download MyNode, nix-build Zeta ISO, write `zeta-multiboot.img`, install GRUB)
is the next slice — large artifacts + network; keep the planner hermetic for unit CI. The Zeta-ISO
loopback `linux`/`initrd` lines in `grub.cfg` are **`@KERNEL@`/`@INITRD@` placeholders** —
`resolveIsoKernelInitrdPaths` fills them from ISO path listings (nixos-25.11 store-hashed paths;
same suffix contract as `audit-installer-iso-content.ts`). Identity namespace: Zeta under `/boot/`,
flash payloads under `/payloads/` only (see `docs/security/USB-IDENTITY-THREAT-MODEL.md`).

## Pointers

- [`../README.md`](../README.md) — the single-ISO installer (what this extends).
- [`../flake.nix`](../flake.nix) — `nix build .#installer-iso` (the local boot image).
- `tools/zflash/` — the existing USB-image builder + qemu test harness (the builder's sibling pattern).
- `.claude/skills/home-crypto-mining/blueprint-mynode-nodes.md` — MyNode td5/td6 + the flash recipe.
