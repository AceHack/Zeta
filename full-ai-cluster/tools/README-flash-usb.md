# `flash-usb.ts` — safety-railed USB flasher for the AI-cluster ISO

Replaces ad-hoc `dd if=... of=/dev/disk?` with a script that
refuses to do the wrong thing.

## Usage

```bash
bun full-ai-cluster/tools/flash-usb.ts <path-to-iso>
```

Walks through:

1. Verifies platform is macOS
2. Verifies the ISO path exists, is `.iso`, and has sane size
3. Enumerates external USB devices via `diskutil -plist`
4. Refuses if zero or 2+ USB devices found
5. Refuses if the candidate is internal, the boot disk, or outside
   sane USB size range
6. Prints device summary (model, size, protocol, boot-disk delta)
7. Requires the operator to type the FULL device path to confirm
   (typing `yes` is rejected — the typed path IS the verification)
8. Unmounts the disk
9. `sudo dd` to the raw device (`/dev/rdiskN`) — ~10x faster than
   the buffered `/dev/diskN` on macOS
10. Ejects the disk on success

## Why the safety rails

The default ad-hoc workflow is:

```bash
diskutil list                       # find the USB
sudo dd if=*.iso of=/dev/rdisk4     # flash
```

If step 1 picks the wrong number, step 2 destroys a hard drive.
This script refuses any device that:

- isn't on USB / USB-C bus protocol
- reports as Internal
- is the current boot disk
- has size outside [4 GiB, 256 GiB]

…and demands the operator type the device path back as the
visual-verification gate. Typing `yes`/`y` wouldn't prove the
operator looked at the device; typing the path does.

## Agent-execution authorization

The Claude Code classifier blocks ad-hoc `dd` and `diskutil list`
as composite high-blast-radius operations. To let an autonomous
agent run THIS script (which has its own gates baked in), add
to `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(bun full-ai-cluster/tools/flash-usb.ts *)"
    ]
  }
}
```

The script's hardcoded gates are what makes that permission grant
reasonable — every destructive action is still gated by checks
the maintainer audited once in code review.

## Linux support (TODO)

V1 is macOS-only. Linux equivalent is straightforward but distinct:

- `lsblk -J -d --output NAME,SIZE,MODEL,TRAN,RM,MOUNTPOINT` for
  enumeration
- `udevadm info --query=property` for the per-device safety
  checks
- `sudo dd if=<iso> of=/dev/sdX bs=4M conv=fsync status=progress`

Filing as a follow-up when a Linux workstation is in the mix.

## Implementation notes

- All subprocess calls use `execFileSync` (argv-array form) — no
  shell interpolation, no command-injection risk
- `assertSafeDevicePath` whitelists `/dev/disk\d+$` — belt-and-
  suspenders even though `diskutil` produces these strings itself
- Parses `diskutil`'s plist output via `plutil -convert json` for
  structured access vs string-scraping (much more stable across
  macOS versions)
- The `dd` is `spawn`'d with stdio inherited so the operator sees
  the live progress, and `sudo` can prompt for the password in
  the same terminal
- Uses `/dev/rdiskN` (raw character device) — faster than buffered
  `/dev/diskN` because it bypasses the buffer cache

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Flash completed successfully |
| 1 | User aborted (typed-path mismatch or interrupted) |
| 2 | Safety check failed (bad ISO, no USB, wrong device class) |
