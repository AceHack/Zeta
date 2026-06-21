# flash-usb-windows.ts — Windows USB flasher

Windows counterpart of `flash-usb.ts` (macOS). Writes the AI-cluster
installer ISO to a USB stick with the **same safety rails**.

## Usage

Run from an **elevated** (Administrator) PowerShell — this is the Windows
equivalent of macOS `sudo` + Touch ID (the UAC / Administrator prompt is
the physical-presence gate; Windows Hello applies if configured):

```powershell
# Right-click PowerShell -> Run as administrator, then:
bun src/Core.TypeScript/zflash/flash-usb-windows.ts                       # auto-discovers newest %USERPROFILE%\Downloads\zeta-installer-*.iso
bun src/Core.TypeScript/zflash/flash-usb-windows.ts C:\path\to\zeta-installer-25.11.iso
bun src/Core.TypeScript/zflash/flash-usb-windows.ts --short              # shorter `yes <4-hex>` confirm
bun src/Core.TypeScript/zflash/flash-usb-windows.ts --dry-run            # print device + planned commands, write NOTHING
bun src/Core.TypeScript/zflash/flash-usb-windows.ts --ssh-key C:\k\x.pub # inject a specific public key
bun src/Core.TypeScript/zflash/flash-usb-windows.ts --no-inject          # skip key injection (password-only login)
```

It prints the selected device + its volumes + a `*** WILL BE DESTROYED ***`
warning, then a random nonce you must type back before it writes.

## SSH-key injection (on by default — zero-typing first boot)

Mirrors the macOS path (`zflash.ts` iter-4.2): after the raw write the tool
**mounts the freshly-flashed USB's EFI System Partition and drops your SSH
public key on it** as `zeta-authorized-keys.pub`. The on-node `zeta-install.sh`
reads that file off the boot media and injects it into `operator-ssh-keys.nix`
before `nixos-install`, so the installed node trusts your key with no typing.

- **Key source**: `--ssh-key <path>`, else the first of `~\.ssh\id_ed25519.pub`,
  `id_ecdsa.pub`, `id_rsa.pub` that exists and validates.
- **Resolved *before* the destructive write** — a missing/malformed key aborts
  the run **before** the USB is wiped, not after.
- **Private-key guard** — refuses anything that looks like a private key
  (you can never accidentally write `id_ed25519` instead of `id_ed25519.pub`).
- **Fail-loud + read-back verify** — the tool writes the key, **reads it back**,
  and treats any failure (couldn't mount the ESP, write failed, read-back
  mismatch) as a **hard error (exit 1)**. The macOS path was once burned by a
  *silent* inject failure (bootable USB, no key); this never green-by-skips.
- **`--no-inject`** opts out explicitly (password-only first boot).

### Mounting the ESP on Windows

An EFI System Partition is often hidden (no auto drive-letter), so the tool
mounts it via a fallback ladder, most-reliable first:

1. partition already has a drive letter (removable FAT auto-mount);
2. `diskpart assign letter=` (works on `System`-type partitions where the
   Storage cmdlets refuse) — the reliable path for a USB ESP;
3. `Add-PartitionAccessPath -AssignDriveLetter` (last resort).

It un-mounts the letter it assigned when done.

## Safety rails (identical to the macOS tool)

| Rail | Enforced by |
|---|---|
| Platform = Windows | `process.platform === "win32"` |
| Administrator (elevated) | `psIsAdminScript()` — refuses otherwise |
| ISO is `*.iso`, size 200 MiB – 8 GiB | `validateIso()` |
| Target bus = USB | `selectUsbCandidate()` |
| Target is **not** the boot/system disk | `IsBoot` / `IsSystem` must be false |
| Target size 4 GiB – 256 GiB | `selectUsbCandidate()` |
| Exactly one USB candidate (else refuse) | `selectUsbCandidate()` |
| Per-run random nonce, typed back | `makeNonce()` / `buildShortChallenge()` |
| SSH key resolved + validated **before** wipe | `resolveSshPubkey()` / `validatePubkeyContent()` |
| Refuses to inject a **private** key | `validatePubkeyContent()` |
| Inject failure is a **hard error**, read-back verified | `injectPubkeyIntoEsp()` |

macOS → Windows mapping: `diskutil list` → `Get-Disk`; `BusProtocol=USB` →
`BusType=USB`; `Internal` → `IsBoot`/`IsSystem`; `diskutil unmountDisk` →
`Set-Disk -IsOffline $true`; `sudo dd of=/dev/rdiskN` → raw write to
`\\.\PhysicalDriveN`; `diskutil eject` → `Set-Disk -IsOffline $false`.

## How it's tested *without* a Windows machine

The architecture puts every data-loss-critical decision in pure,
exported TypeScript so `flash-usb-windows.test.ts` validates it via
`bun test` on macOS/Linux/CI:

- **Device selection + rails** — `selectUsbCandidate()` is tested against
  realistic `Get-Disk` JSON fixtures: it picks the lone USB stick and
  **refuses** the system/boot disk, non-USB disks, an oversize external
  SSD, an undersize device, and the "more than one USB" case.
- **The actual byte-copy** — `copyImageToDevice()` is the real write loop.
  The test copies a fake ISO into a temp "device" file and asserts the
  result is **byte-identical** to the image and **zero-padded up to a
  sector boundary** (the `dd conv=sync` equivalent). This is the part
  that, if wrong, corrupts the stick — and it's the same code path that
  runs on Windows (node can open `\\.\PhysicalDriveN` after the disk is
  offline).
- **Command construction, nonce, ISO discovery** — all unit-tested.
- **SSH-key injection** — `validatePubkeyContent()` (accepts ed25519/rsa/ecdsa/sk,
  rejects empty/multi/unknown-type/non-base64 and, critically, **private keys**),
  `resolveSshPubkey()` (search order + explicit-path), `selectEspPartition()`
  (picks the tiny FAT ESP, **never** the 1.5 GiB ISO9660 data region, on both
  GPT and MBR layouts), and the **whole `injectPubkeyIntoEsp()` orchestration**
  driven by a fake runner that simulates `Get-Partition`, `diskpart assign`, and
  an in-memory ESP filesystem — including the **corrupt-write → read-back
  mismatch → `ok=false`** case (proves no silent green-by-skip).

What the unit tests *cannot* cover on macOS: opening the literal
`\\.\PhysicalDriveN` handle, `Set-Disk -IsOffline`, the real `diskpart`/ESP
mount, and the UAC prompt — those are thin wrappers around the tested logic and
require a Windows box (or a Windows VM with a virtual USB disk) for an
end-to-end run. `--dry-run` on a Windows machine exercises the full selection +
key-resolution + planning path without writing.

## Follow-ups

- A `zflash-windows.ts` short wrapper (mirroring `zflash.ts`: CI-ISO pull
  + ultra-short invocation).
- An `--agent` mode (auto-type the nonce) for agent-driven flashing.
- End-to-end CI via a Windows VM with a virtual USB disk (verify the
  written disk's first bytes match the ISO).

(Tracked under the Windows-extension backlog row, 081KSE6WT0008QG0R0025170CV.)
