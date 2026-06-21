---
id: 081KSGS9H0008QG0R003SWZF9J
priority: P2
status: open
title: investigate nixpkgs 25.11 ISO kernel + initrd path layout (boot/bzImage + boot/initrd no longer at top-level) — audit fix-fwd accepts any-of family + diagnostic dump on failure; tighten back once empirical paths confirmed (Aaron 2026-05-26)
effort: S
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R001EKTS5A
composes_with:
  - 081KSGS9H0008QG0R003A37Z65
  - 081KSGS9H0008QG0R00033DT02
tags: [nixos, iso-image, 25-11-regression, ci-audit, fix-fwd-of-fix-fwd, kernel-path, initrd-path]
---

## Problem

`tools/ci/audit-installer-iso-content.ts` REQUIRED_ISO_PATHS asserted `boot/bzImage` + `boot/initrd` as top-level files in the produced ISO. On nixpkgs 24.11 this passed; on nixpkgs 25.11 (post-081KSGS9H0008QG0R001EKTS5A bump), both assertions fail:

```text
audit-installer-iso-content: FAIL — 2 assertion(s) failed
  [missing-path] boot/bzImage
    Linux kernel image; bootable ISO must include it
  [missing-path] boot/initrd
    initramfs; bootable ISO must include it
```

Empirical evidence: build-iso run [26463680640](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/26463680640) on commit 75eff94d (post-#5226 merge). The bootloader-any-of check passed (isolinux/refind present) — only the kernel + initrd path assertions failed.

## Probable root cause

Same class as [081KSGS9H0008QG0R00033DT02](081KSGS9H0008QG0R00033DT02-investigate-isoname-mkforce-not-sticking-on-nixpkgs-25-11-aaron-2026-05-26.md): nixpkgs 25.11's image/images refactor changed where kernel + initrd land in the ISO. Per the [iso-image module source on the nixos-25.11 branch](https://github.com/NixOS/nixpkgs/blob/nixos-25.11/nixos/modules/installer/cd-dvd/iso-image.nix) (branch-pinned per Copilot finding on #5235 — `master` drifts; `nixos-25.11` matches the channel this row investigates) the path includes `cfg.boot.kernelPackages.kernel` + `cfg.system.boot.loader.kernelFile` — historically resolved to `boot/bzImage` at top-level but may now include per-arch / store-hash variations.

WebSearch 2026-05-26 surfaced the legacy `/boot/bzImage` + `/boot/initrd` paths via [NixOS wiki](https://wiki.nixos.org/wiki/NixOS_Installation_Guide/Manual_USB_Creation) docs but these are 24.11-era. The 25.11 ISO at top-level shows the bootloader configs (isolinux + refind) which reference paths internally — the actual kernel + initrd files may now be at variant locations not at `boot/` directly.

## Two-layer fix (this row + sibling PR)

**Sibling fix-fwd PR (this row's PR)**:

1. Convert kernel + initrd checks to `REQUIRED_KERNEL_ANY` + `REQUIRED_INITRD_ANY` any-of-family pattern (mirroring the existing `REQUIRED_BOOTLOADER_ANY` discipline that survived the 24.11→25.11 channel bump cleanly).
2. Add diagnostic dump (`dumpIsoEntriesForDiagnostic`) on audit failure — prints first 80 sorted entries from the ISO so future regressions self-debug. Without this, the failure log shows only `[missing-path] X` with no indication of what IS present.

Candidate paths in the kernel/initrd any-of family (initial guesses; can be tightened once the diagnostic dump confirms):

```typescript
const REQUIRED_KERNEL_ANY = [
  { path: "boot/bzImage" },              // 24.11 legacy
  { path: "boot/x86_64-linux/bzImage" }, // per-arch
  { path: "boot/kernel" },               // generic
  { path: "boot/vmlinuz" },              // vmlinuz convention
  { path: "boot/vmlinuz-linux" },        // alt vmlinuz convention
];

const REQUIRED_INITRD_ANY = [
  { path: "boot/initrd" },               // 24.11 legacy
  { path: "boot/x86_64-linux/initrd" },  // per-arch
  { path: "boot/initrd.img" },           // .img convention
];
```

**081KSGS9H0008QG0R003SWZF9J substrate-layer follow-up (this row)**:

1. Run a successful ISO build with the fix-fwd above + capture the diagnostic dump's path listing
2. Identify the exact paths nixpkgs 25.11 uses for kernel + initrd
3. Optionally tighten the any-of families to the empirically-confirmed paths only
4. OR keep the lenient any-of as defense-in-depth (preferred — same discipline as 081KSGS9H0008QG0R00033DT02's audit-glob relaxation)

## Target

Re-establish a green ISO build on nixpkgs 25.11 + improve the audit's self-debugging surface so future nixpkgs channel bumps don't require log-archaeology to diagnose path shifts.

## Acceptance

- [ ] Sibling fix-fwd PR (this row's PR) merges + ISO build CI goes green
- [ ] Diagnostic dump appears in failure logs (verified by deliberately triggering an audit failure in test)
- [ ] Empirical kernel + initrd paths in nixpkgs 25.11 ISO confirmed from diagnostic dump
- [ ] Decision recorded: tighten any-of families back, OR keep lenient as defense-in-depth

## Composes with

- **[081KSGS9H0008QG0R001EKTS5A](../P1/081KSGS9H0008QG0R001EKTS5A-bump-nixpkgs-24-11-to-25-11-eol-recovery.md)** — nixpkgs 25.11 EOL recovery that triggered this regression
- **[081KSGS9H0008QG0R00033DT02](081KSGS9H0008QG0R00033DT02-investigate-isoname-mkforce-not-sticking-on-nixpkgs-25-11-aaron-2026-05-26.md)** — sibling 25.11 ISO regression (`isoName` mkForce not sticking); both are downstream of 081KSGS9H0008QG0R001EKTS5A; both use the same audit-glob-relaxation + diagnostic-dump pattern
- **[081KSGS9H0008QG0R003A37Z65](../P1/081KSGS9H0008QG0R003A37Z65-architectural-principle-maximize-argocd-scope-minimize-nixos-native-lock-in-cross-cluster-portability-leverage-aaron-2026-05-26.md)** — cross-distro portability principle; ISO substrate naming + audit are Zeta-internal not portable to non-NixOS distros
- `.claude/rules/dep-pin-search-first-authority.md` — the discipline this row reinforces (don't default to training-data paths; verify empirically; surface uncertainty when can't)

## Out of scope

- Upstream nixpkgs fix (if the regression is in nixpkgs itself, file there separately)
- Adapting audit for non-NixOS installer ISOs (different layout entirely; 081KSGS9H0008QG0R003A37Z65 says ISO substrate is Zeta-internal not portable)

## Origin

Discovered empirically when build-iso run 26463680640 on commit 75eff94d (post-#5226 merge) failed `Audit installer ISO content (cascade #4)` with 2 missing-path failures on `boot/bzImage` + `boot/initrd`. Sibling fix-fwd PR (lenient any-of + diagnostic dump) unblocks the build immediately; this row tracks the substrate-layer investigation + optional tightening.

Filed P2 — same as 081KSGS9H0008QG0R00033DT02; workaround (lenient any-of) eliminates operator-impact; tighter substrate is cleanliness rather than urgency.

## Substrate-inventory pass

Per [`.claude/rules/verify-existing-substrate-before-authoring.md`](../../../.claude/rules/verify-existing-substrate-before-authoring.md):

- `grep -rn "boot/bzImage\|boot/initrd" tools/` → only the audit script's REQUIRED_ISO_PATHS (the only override site)
- `gh pr list --state all --search "081KSGS9H0008QG0R003SWZF9J"` → no in-flight collision
- ID 081KSGS9H0008QG0R003SWZF9J next-free per `git ls-tree origin/main` (highest = 081KSGS9H0008QG0R0018ES3R4 in flight via this batch's other PR)
