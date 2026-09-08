/**
 * The files `zflash`'s freshness gate diffs `HEAD..origin/main` before flashing.
 *
 * Extracted from `cli.ts` so it can be TESTED: `cli.ts` calls `main()` at module
 * scope, so importing it to read one constant would run the CLI.
 *
 * **Every entry must exist in the repository.** `git diff --quiet HEAD origin/main
 * -- <path>` exits **0** when the pathspec matches nothing — the same code as "no
 * change" — so a watched path that does not exist is not a weak check, it is a
 * check that CANNOT FAIL. `install-substrate-files.test.ts` is the falsifier for
 * that, and it is why this list is a module rather than a literal.
 */
export const INSTALL_SUBSTRATE_FILES: readonly string[] = [
  "src/Core.TypeScript/zflash/cli.ts",
  "src/Core.TypeScript/zflash/flash-usb.ts",
  "full-ai-cluster/usb-nixos-installer/zeta-install.sh",
  // The flake the ISO is ACTUALLY built from. `build-ai-cluster-iso.yml` builds
  // `full-ai-cluster/flake.nix` and filters on it plus its lock; this list used to
  // name `full-ai-cluster/usb-nixos-installer/flake.nix`, which was RETIRED
  // (work-item 081KZKS9A6B08QG0R0008EG72M) and therefore reported clean forever
  // while the real flake went unwatched. Both directions of B1a in one entry.
  "full-ai-cluster/flake.nix",
  "full-ai-cluster/flake.lock",
  "full-ai-cluster/nixos/modules/initial-password.nix",
  "full-ai-cluster/nixos/modules/operator-ssh-keys.nix",
  "full-ai-cluster/nixos/modules/operator-ssh-keys.txt",
];
