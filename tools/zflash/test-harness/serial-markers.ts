/**
 * B-0891 shared serial-marker vocabulary for QEMU harness scenarios.
 *
 * Centralizes marker strings so scenario 3 retention restarts and scenario 4
 * path-fork forks agree on what zeta-install emits when a zflash-prepared boot
 * image carries (or omits) /zeta-creds.enc on the ESP.
 */

/** zeta-install.sh emits these when the boot USB ESP already has zeta-creds.enc. */
export const B0891_RETENTION_USB_SERIAL_MARKERS: readonly string[] = [
  "[B-0891-retention]   found pre-baked zeta-creds.enc on boot USB ESP",
  "[B-0891-retention]   Step 6.95-picker will skip account re-entry",
];

/** zeta-install.sh emits this when the boot USB has no retained cred blob. */
export const B0891_FRESH_USB_SERIAL_MARKER =
  "[B-0891-retention]   no pre-baked zeta-creds.enc on boot USB ESP; Step 6.95-picker remains normal";

/** Post-install first-boot cred restore idempotency markers (installed OS path). */
export const INSTALLED_OS_RETENTION_SERIAL_MARKERS: readonly string[] = [
  "zeta-creds-restore:",
  "already-present",
];

/** Initial nixos-install completion boundary inside the installer environment. */
export const INITIAL_INSTALL_SERIAL_MARKERS: readonly string[] = ["[iter-5.1]"];

export const RETENTION_FAILURE_SERIAL_MARKERS: readonly string[] = [
  "panic",
  "FATAL",
  "Refusing to wipe",
  "no internet",
  "bail",
];

export const RETENTION_ABSENT_TERMINAL_MARKERS: readonly string[] = ["nixos@zeta-installer:~"];
