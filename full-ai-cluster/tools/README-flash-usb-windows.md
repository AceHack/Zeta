# flash-usb-windows.ts — Windows USB flasher

Windows counterpart of `flash-usb.ts` (macOS). Writes the AI-cluster
installer ISO to a USB stick with the **same safety rails**.

## Usage

Run from an **elevated** (Administrator) PowerShell — this is the Windows
equivalent of macOS `sudo` + Touch ID (the UAC / Administrator prompt is
the physical-presence gate; Windows Hello applies if configured):

```powershell
# Right-click PowerShell -> Run as administrator, then:
bun full-ai-cluster\tools\flash-usb-windows.ts            # auto-discovers newest %USERPROFILE%\Downloads\zeta-installer-*.iso
bun full-ai-cluster\tools\flash-usb-windows.ts C:\path\to\zeta-installer-25.11.iso
bun full-ai-cluster\tools\flash-usb-windows.ts --short    # shorter `yes <4-hex>` confirm
bun full-ai-cluster\tools\flash-usb-windows.ts --dry-run  # print device + planned commands, write NOTHING
```

It prints the selected device + its volumes + a `*** WILL BE DESTROYED ***`
warning, then a random nonce you must type back before it writes.

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

What the unit tests *cannot* cover on macOS: opening the literal
`\\.\PhysicalDriveN` handle, `Set-Disk -IsOffline`, and the UAC prompt —
those are thin wrappers around the tested logic and require a Windows
box (or a Windows VM with a virtual USB disk) for an end-to-end run.
`--dry-run` on a Windows machine exercises the full selection + planning
path without writing.

## Follow-ups

- A `zflash-windows.ts` short wrapper (mirroring `zflash.ts`: CI-ISO pull
  + ultra-short invocation).
- An `--agent` mode (auto-type the nonce) for agent-driven flashing.
- End-to-end CI via a Windows VM with a virtual USB disk (verify the
  written disk's first bytes match the ISO).

(Tracked under the Windows-extension backlog row, B-0739.)
