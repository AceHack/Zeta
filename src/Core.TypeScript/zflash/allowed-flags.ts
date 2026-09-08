/**
 * Flags the DEVICE-flashing CLI accepts. Exported so other surfaces can be checked
 * against it rather than guessing.
 *
 * B5: `zeta-first-boot.sh` printed `zflash --role ...` as the operator remedy when
 * discovery refuses, and `--role` is not here -- the strict allowlist below exits 2
 * on it. `--role` exists only on `file-backed.ts`, which writes an image rather than
 * a device. `first-boot-remedy-flags.test.ts` now pins that every `zflash --flag`
 * named in operator-facing text is a flag this CLI actually takes.
 */
export const ZFLASH_ALLOWED_FLAGS: ReadonlySet<string> = new Set([
  "-h",
  "--help",
  "--ssh-key",
  "--no-inject",
  "--skip-freshness-check",
  "--skip-iso-pull",
  "--iso-arch",
  "--host",
  "--agent",
  "--test",
  "--bake-cred",
  "--bake-passphrase-file",
  "--bake-passphrase-env",
  "--persona",
  "--expect-device",
  "--expect-size",
  "--expect-model",
  // Join material on the DEVICE path (B5). Validation, rendering and the
  // secret-on-ESP rail are all REUSED from `firstboot-role.ts` /
  // `injection-rail.ts` -- the same code the file-backed image path runs -- so
  // the two surfaces cannot drift into different rules for the same flags.
  "--role",
  "--flake-host",
  "--join-server-url",
  "--join-token",
]);
