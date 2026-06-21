---
pr_number: 5099
title: "fix(081KSGS9H0008QG0R002T3BJ2R iter-4.4 fixfwd): 0xEF MBR partition type + mount_msdos fallback (2 bugs surfaced by 2026-05-26 empirical zflash test)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T05:18:34Z"
merged_at: "2026-05-26T05:21:02Z"
closed_at: "2026-05-26T05:21:02Z"
head_ref: "otto-cli/iter44-fixfwd-0xef-fat12-esp-detection-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:43:04Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5099: fix(081KSGS9H0008QG0R002T3BJ2R iter-4.4 fixfwd): 0xEF MBR partition type + mount_msdos fallback (2 bugs surfaced by 2026-05-26 empirical zflash test)

## PR description

## Summary

2026-05-26 empirical test of iter-4.3 zflash (#5091 + fixfwd #5093) surfaced TWO bugs that the auto-diagnostic substrate caught loud + photo-friendly:

**(1) ESP detection regex missed MBR \`0xEF\`.** NixOS install ISOs use isohybrid layout; after dd to USB, macOS's diskutil reads the FDisk MBR partition table and reports the FAT ESP with TYPE=\`0xEF\` (MBR numeric code for EFI System Partition) rather than GPT-style \`EFI EFI\` / \`DOS_FAT_32\` labels. The existing regex \`\\b(DOS_FAT|EFI|MS-DOS|FAT16|FAT32|Windows_FAT)\\b\` matched GPT cases but not MBR.

**(2) \`diskutil mount\` fails on MBR \`0xEF\` partitions.** Even with detection fixed, \`diskutil mount /dev/disk6s2\` fails because macOS's diskutil auto-probe doesn't recognize the FAT12 filesystem-in-0xEF combination as mountable. \`diskutil info\` reports \`File System: None\` even though \`sudo file -s /dev/disk6s2\` clearly shows the FAT12 EFIBOOT volume is there + writable. Fix: explicit \`mount_msdos\` against mkdtemp mount point as fallback.

## Changes

- \`findFatPartition()\` regex extended to ALSO match MBR partition type codes \`0x(EF|0C|0E|06|0B|0F)\` covering EFI System Partition + FAT16 + FAT32 + FAT32-LBA + FAT16-LBA + Extended-LBA. \`\\b\` on both sides prevents accidental match inside longer hex strings
- New \`mountEsp(espPart)\` helper: tries \`diskutil mount\` first (GPT case), falls back to \`sudo mount_msdos -o nodev,nosuid <part> <mkdtemp>\` for MBR 0xEF case. Returns method tag so unmount matches
- New \`unmountEsp(espPart, result)\` helper: dispatches to \`diskutil unmount\` OR \`sudo umount + rmSync(tmpdir)\` based on method
- \`injectPubkeyToUsb()\` simplified: single \`mountEsp\` call replaces the diskutil-mount + getMountPoint + error-path-unmount duplication; single \`unmountEsp\` call at success + error paths
- Diagnostic message updated: \"mountEsp \${espPart} failed (both diskutil + mount_msdos paths)\" tells the operator BOTH paths were exhausted before bail

## Empirical validation 2026-05-26

Manually ran \`sudo mount_msdos -o nodev,nosuid /dev/disk6s2 /tmp/zeta-esp-mount\` on the post-dd USB (124GB PNY, 3.1MB 0xEF ESP labeled EFIBOOT) — mount succeeded; wrote \`zeta-authorized-keys.pub\` via \`sudo cp ~/.ssh/id_ed25519.pub /tmp/zeta-esp-mount/...\`; unmounted + ejected cleanly. The substrate the script now ships matches what worked empirically.

## Composes with

- #5091 iter-4.3 (stale-checkout detection + auto-download ISO)
- #5093 iter-4.3 fixfwd (4 Copilot findings)
- 081KSGS9H0008QG0R002T3BJ2R parent (cluster credentials substrate)
- 081KSGS9H0008QG0R00153CQ8B end-state (zero-typing SSH = load-bearing step toward zero-dev-machine homelab persona)

## Test plan

- [x] TS strict compile clean (\`bunx tsc --noEmit\`)
- [x] Empirical validation: manual \`mount_msdos\` on post-dd USB succeeded; write + unmount + eject clean
- [ ] Re-run zflash with iter-4.4 against fresh-flashed USB; verify auto-inject step succeeds end-to-end (next operator-driven step after merge)
- [ ] Plug USB into PC1 + power on via Comet Pro + finger bot; verify \`ssh zeta@<hostname>\` zero-typing from operator's Mac

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-26T05:18:40Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
