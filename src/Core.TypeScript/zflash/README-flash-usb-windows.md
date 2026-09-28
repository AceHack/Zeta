# flash-usb-windows.ts — Windows USB flasher

Windows counterpart of `flash-usb.ts` (macOS). Writes the AI-cluster
installer ISO to a USB stick with the **same safety rails**, and bakes the
operator's first-boot payloads onto the stick's EFI System Partition.

## Usage

Run from an **elevated** (Administrator) PowerShell — this is the Windows
equivalent of macOS `sudo` + Touch ID (the UAC / Administrator prompt is
the physical-presence gate; Windows Hello applies if configured):

```powershell
# Right-click PowerShell -> Run as administrator, then:
bun src/Core.TypeScript/zflash/flash-usb-windows.ts                       # auto-discovers newest %USERPROFILE%\Downloads\zeta-installer-*.iso
bun src/Core.TypeScript/zflash/flash-usb-windows.ts C:\path\to\zeta-installer-25.11.iso
bun src/Core.TypeScript/zflash/flash-usb-windows.ts --short              # shorter `yes <4-hex>` confirm
bun src/Core.TypeScript/zflash/flash-usb-windows.ts --dry-run            # print device + plan + ESP payloads, write NOTHING
bun src/Core.TypeScript/zflash/flash-usb-windows.ts --ssh-key C:\k\x.pub # bake a specific public key
bun src/Core.TypeScript/zflash/flash-usb-windows.ts --no-inject          # no key on the ESP (password-only login)
bun src/Core.TypeScript/zflash/flash-usb-windows.ts --host node-a --role first-control-plane
bun src/Core.TypeScript/zflash/flash-usb-windows.ts --role joiner --join-server-url https://10.0.0.10:6443 --join-token C:\t\node-token
bun src/Core.TypeScript/zflash/flash-usb-windows.ts --acme-email ops@yourdomain.net --public-domain yourdomain.net
bun src/Core.TypeScript/zflash/flash-usb-windows.ts --repo-pin <40-hex commit>
```

It prints the selected device + its volumes + a `*** WILL BE DESTROYED ***`
warning, then a random nonce you must type back before it writes.

## How a flash works (removable media)

Windows refuses `Set-Disk -IsOffline $true` for removable media
(`Removable media cannot be set to offline`), which is what this tool used to
run before writing — so it could not flash a USB stick at all (reproduced
2026-09-27, PNY USB 3.2.1 FD). #6981 had a working removable path; the #8076
refactor dropped it. The flow now, for every target:

1. **Verify** the ISO against its sha256 manifest (`establishIsoIntegrity`,
   fail-closed — no manifest is a refusal).
2. **Stage a copy** of the ISO in a fresh temp directory, hashing while
   copying; the copy's sha256 must equal the verified one, so the bytes baked
   and written are the bytes that were verified. Needs free space on the temp
   drive equal to the ISO size (~2.8 GB); removed on every exit path.
3. **Bake the ESP payloads into the copy** — pure TypeScript
   (`esp-fat-writer.ts`): the ESP is the MBR partition of type `0xEF` with a
   non-zero start (LBA 276, 6144 sectors, FAT12 `EFIBOOT` on the current ISO);
   each file gets an 8.3 alias with a numeric tail plus VFAT long-name entries,
   its clusters are chained in **both** FATs, and every file is **read back and
   compared** before anything touches the USB. Nothing is written to the device
   after the flash — Windows auto-mounts the isohybrid ESP read-only there.
4. **Confirm** — type the nonce phrase.
5. **Prepare the disk**: `Set-Disk -IsReadOnly $false`, then
   `Clear-Disk -RemoveData -RemoveOEM -Confirm:$false`. No offline; no
   `mountvol /N` (it disables automount machine-wide and persists).
6. **Raw write** to `\\.\PhysicalDriveN`: everything past the first 1 MiB,
   then the first 1 MiB (the partition table) **last**, so a cleared disk has
   nothing for Windows to auto-mount until the image is complete; fsync.
7. **Read back** exactly the written range from the device and compare its
   sha256 with the baked image. A mismatch is a hard failure (exit 1).

## ESP payloads — the same list every arm bakes

The payload list comes from the shared planner in `lib.ts`
(`planFileBackedZflashImage`), so a Windows stick carries byte-for-byte what
the other arms bake for the same flags. Flag validation is the same code the
device CLI runs (`firstbootRoleFromFlags`, `planPublicEndpoint`).

| Flag | ESP file |
|---|---|
| (default) / `--ssh-key <path>` | `/zeta-authorized-keys.pub` (LF, one trailing newline) |
| `--host <name>` | `/zeta-hostname.txt` |
| `--role …` (`--flake-host`, `--join-server-url`) | `/zeta-firstboot.conf` |
| `--join-token <path>` (joiner) | `/zeta-join-token` — secret on an unencrypted ESP; the injection rail prints a disclosure |
| `--acme-email` + `--public-domain` | appended to `/zeta-firstboot.conf` |
| `--repo-pin <40-hex>` | `/zeta-repo-pin` |

- **Key source**: `--ssh-key <path>`, else the first of `~\.ssh\id_ed25519.pub`,
  `id_ecdsa.pub`, `id_rsa.pub` that exists and validates — resolved **before**
  any disk is touched.
- **Private-key guard** — refuses anything that looks like a private key.
- **`--no-inject`** opts out of the key only; other payload flags still bake.

## Safety rails

| Rail | Enforced by |
|---|---|
| Unknown / near-miss flag refused before anything runs | `firstUnknownFlag()` / `parseWindowsFlasherArgs()` |
| Platform = Windows | `process.platform === "win32"` |
| Administrator (elevated) | `psIsAdminScript()` — refuses otherwise |
| ISO is `*.iso`, sane size | `validateIso()` |
| ISO matches its sha256 manifest | `establishIsoIntegrity()` |
| Staged copy equals the verified bytes | `stageVerifiedCopy()` |
| Target bus = USB, not boot/system disk, size in bounds, exactly one candidate | `selectUsbCandidate()` |
| Per-run random nonce, typed back | `makeNonce()` / `buildShortChallenge()` |
| Payloads baked + read back before the USB is touched | `bakeEspFiles()` |
| No offline / no mountvol; Clear-Disk | `diskPreparationScripts()` |
| Partition table written last | `copyImageToDevice()` |
| Device read-back sha256 == image | `verifyDeviceReadback()` |

## How it's tested without a Windows machine

`flash-usb-windows.test.ts`, `flash-usb-windows-removable.test.ts` and
`esp-fat-writer.test.ts` run under `bun test` on any OS, against temp files:

- device selection + rails against `Get-Disk` JSON fixtures;
- disk prep issues read-only-clear + Clear-Disk, **never** offline or mountvol,
  including against a fake runner that refuses offline exactly as Windows does;
- the write puts every byte past 1 MiB on the fake device before the first
  1 MiB is touched (checked on the file at the moment of the head write);
- read-back: a flipped byte, a dirty padding byte, or a short device are failures;
- the staged copy must hash to the verified sha256;
- the FAT writer, checked by an **independent** FAT parser
  (`test-harness/isohybrid-esp-fixture.ts`) against an image shaped like the
  real ISO: directory entries, checksum-verified long names, and the cluster
  chain in both FATs; multi-cluster files, alias collisions, FAT16, refusals;
- the ESP payload list equals the shared planner's for the same flags.

Cross-check done once by hand (2026-09-27): baking the pubkey into the real
`zeta-installer-26.05-x86_64-linux.iso` with `esp-fat-writer.ts` produced an
ESP byte-identical to the one mtools produced for the same key, except the
directory timestamps (this writer uses the FAT epoch, for reproducible images).

**Not covered by any test** (needs an elevated Windows host and a real stick):
opening `\\.\PhysicalDriveN`, the real `Clear-Disk`, whether Windows mounts
anything between the tail and head writes, the UAC prompt, and booting the
result. `--dry-run` exercises selection, integrity, key resolution and payload
planning without writing.
