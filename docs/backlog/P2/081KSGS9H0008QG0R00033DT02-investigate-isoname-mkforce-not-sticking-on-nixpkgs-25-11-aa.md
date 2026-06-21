---
id: 081KSGS9H0008QG0R00033DT02
priority: P2
status: open
title: investigate why `isoImage.isoName = lib.mkForce "zeta-installer-..."` is no longer sticking on nixpkgs 25.11 — workflow audit fix-fwd accepts both names but the underlying mkForce-override regression should be diagnosed + fixed at the substrate layer (Aaron 2026-05-26)
effort: S
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R001EKTS5A
composes_with:
  - 081KSGS9H0008QG0R003A37Z65
tags: [nixos, iso-image, 25-11-regression, substrate-engineering, fix-fwd-of-fix-fwd]
---

## Problem

`full-ai-cluster/usb-nixos-installer/nixos/installer/configuration.nix` line 290 (within the `isoImage` block at line 289) sets:

```nix
isoImage = {
  isoName = lib.mkForce "zeta-installer-${config.system.nixos.release}.iso";
  ...
};
```

On nixpkgs 24.11 this produced `zeta-installer-24.11.iso`. On nixpkgs 25.11 (post-081KSGS9H0008QG0R001EKTS5A bump) the produced ISO is named `nixos-minimal-25.11.20260522.b77b3de-x86_64-linux.iso` — the nixpkgs DEFAULT name pattern, NOT our mkForce'd override.

Empirical evidence: PR #5222 build-iso job log (run 26462491804):

```
-r--r--r-- 1 root root 1624211456 Jan  1  1970 nixos-minimal-25.11.20260522.b77b3de-x86_64-linux.iso
##[error]Audit step: No installer ISO under result/iso/ (looked for zeta-installer-*.iso)
```

## Probable root cause

Nixpkgs 25.11 has the `image/images: Adapt remaining images to system.build.image & normalized filenames` refactor (PR [#359345](https://github.com/NixOS/nixpkgs/pull/359345)) + the follow-up `iso-image: include release and system info in iso filenames again` (PR [#372127](https://github.com/NixOS/nixpkgs/pull/372127)). The unified `image.baseName` option likely now drives the ISO filename via a new code path that bypasses (or has higher priority than) the legacy `isoImage.isoName` setting our `lib.mkForce` targets.

Candidate fixes to validate:

1. **Set `image.baseName` directly** (cleanest if available):

   ```nix
   image.baseName = lib.mkForce "zeta-installer";
   ```

2. **Combine `image.baseName` + `isoImage.isoName`** if both still wire through:

   ```nix
   image.baseName = lib.mkForce "zeta-installer";
   isoImage.isoName = lib.mkForce "zeta-installer-${config.system.nixos.release}.iso";
   ```

3. **Add `system.nixosLabel`** if that's now the driver:

   ```nix
   system.nixosLabel = "zeta-installer-${config.system.nixos.release}";
   ```

Test by running `nix build .#installer-iso --print-build-logs` locally in `full-ai-cluster/` AND `full-ai-cluster/usb-nixos-installer/` and inspecting the produced filename.

## Target

Re-establish `zeta-installer-<release>.iso` as the produced ISO name on 25.11. Once landed:

- The fix-fwd in `.github/workflows/build-ai-cluster-iso.yml` + `.github/workflows/build-installer-iso.yml` (this row's sibling PR — accepts EITHER `zeta-installer-*.iso` OR `nixos-minimal-*.iso`) can be tightened back to `zeta-installer-*.iso` only, OR left lenient as defense-in-depth.
- Updated artifact name flows to operator's USB-flash step (cleaner DX; matches the Zeta-branded substrate intent).

## Acceptance

- [ ] Root cause confirmed (which option in 25.11 actually drives the ISO filename)
- [ ] `configuration.nix` updated with the correct option override
- [ ] Local `nix build .#installer-iso` produces `zeta-installer-<release>.iso`
- [ ] CI build-iso jobs on both workflows produce the same name
- [ ] Optional: tighten workflow find globs back to `zeta-installer-*.iso` only (if defense-in-depth not needed)

## Composes with

- **[081KSGS9H0008QG0R001EKTS5A](../P1/081KSGS9H0008QG0R001EKTS5A-bump-nixpkgs-24-11-to-25-11-eol-recovery.md)** — the EOL recovery that triggered the regression
- **[081KSGS9H0008QG0R003A37Z65](../P1/081KSGS9H0008QG0R003A37Z65-architectural-principle-maximize-argocd-scope-minimize-nixos-native-lock-in-cross-cluster-portability-leverage-aaron-2026-05-26.md)** — cross-distro portability principle composes; ISO-substrate naming is a Zeta-branded substrate-honest detail
- Sibling fix-fwd PR (this row's PR): workflow audit-glob update that unblocks the ISO build immediately

## Substrate-inventory pass

Per [`.claude/rules/verify-existing-substrate-before-authoring.md`](../../../.claude/rules/verify-existing-substrate-before-authoring.md):

- `grep -rnE 'isoName|image\.baseName' full-ai-cluster/` (or equivalent `rg "isoName|image\\.baseName" full-ai-cluster/`; `-E` matters for BSD/macOS grep portability — bare `\|` alternation is GNU-only) → only the line-290 reference; no other override site
- `gh pr list --state all --search "081KSGS9H0008QG0R00033DT02"` → no in-flight collision
- `gh pr list --state all --search "isoName"` → no prior investigation row
- ID 081KSGS9H0008QG0R00033DT02 next-free per `git ls-tree origin/main` (highest = 081KSGS9H0008QG0R002QQNA79 from #5221)

## Out of scope

- Upstream nixpkgs fix (if the regression is in nixpkgs itself, file there separately)
- Renaming substrate beyond the ISO filename (image alt-text, packaging, etc. unaffected)

## Origin

Discovered empirically when PR #5222 (the glxinfo P0 fix-fwd) merged but the post-merge ISO build failed the `Audit installer ISO content` step because the produced filename no longer matched the expected `zeta-installer-*.iso` glob. Sibling fix-fwd PR (workflow audit-glob lenient match) unblocks the build immediately; this row tracks the proper substrate fix.

Filed as P2 because the workaround (lenient glob) eliminates operator-impact; the substrate-layer fix is cleanliness rather than urgency.
