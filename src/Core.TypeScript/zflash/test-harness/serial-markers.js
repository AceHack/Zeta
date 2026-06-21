/**
 * 081KSNY2Z0008QG0R0008PN7RQ shared serial-marker vocabulary for QEMU harness scenarios.
 *
 * Centralizes marker strings so scenario 3 retention restarts and scenario 4
 * path-fork forks agree on what zeta-install emits when a zflash-prepared boot
 * image carries (or omits) /zeta-creds.enc on the ESP.
 */
/** zeta-install.sh emits these when the boot USB ESP already has zeta-creds.enc. */
export const B0891_RETENTION_USB_SERIAL_MARKERS = [
    "[081KSNY2Z0008QG0R0008PN7RQ-retention]   found pre-baked zeta-creds.enc on boot USB ESP",
    "[081KSNY2Z0008QG0R0008PN7RQ-retention]   Step 6.95-picker will skip account re-entry",
];
/** zeta-install.sh emits this when the boot USB has no retained cred blob. */
export const B0891_FRESH_USB_SERIAL_MARKER = "[081KSNY2Z0008QG0R0008PN7RQ-retention]   no pre-baked zeta-creds.enc on boot USB ESP; Step 6.95-picker remains normal";
/** Post-install first-boot cred restore idempotency markers (installed OS path). */
export const INSTALLED_OS_RETENTION_SERIAL_MARKERS = ["zeta-creds-restore:", "already-present"];
/** zeta-install.sh success banner — full install finished (same boundary as scenario 2 phase 1). */
export const INSTALL_COMPLETE_SERIAL_MARKER = "ZETA CLUSTER NODE INSTALL COMPLETE";
/** Baseline snapshot boundary for scenarios 3/4 — must not stop at mid-install [iter-5.1]. */
export const INITIAL_INSTALL_SERIAL_MARKERS = [INSTALL_COMPLETE_SERIAL_MARKER];
export const RETENTION_FAILURE_SERIAL_MARKERS = [
    "panic",
    "FATAL",
    "Refusing to wipe",
    "no internet",
    "bail",
];
export const RETENTION_ABSENT_TERMINAL_MARKERS = ["nixos@zeta-installer:~"];
/** Emitted on tty1 and mirrored to ttyS0 while zeta-first-boot.service runs. */
export const FIRST_BOOT_PROGRESS_SERIAL_MARKERS = [
    "Zeta cluster installer",
    "Role selected:",
    "[3/3] Running zeta-install",
    "[zeta-first-boot]",
];
/** Scenario 5 cluster-joining success markers. */
export const B0891_CLUSTER_JOIN_SERIAL_MARKERS = [
    "[081KSNY2Z0008QG0R0008PN7RQ-joining]     cluster join successful",
    "[081KSNY2Z0008QG0R0008PN7RQ-joining]     joining-node added to the cluster state",
];
/** 081KSNY2Z0008QG0R0008PN7RQ phase-3 (future): post-login first-session adventure on installed OS. */
export const FIRST_SESSION_SERIAL_MARKERS = [
    "zeta-first-session: begin",
    "zeta-first-session: complete",
];
/** serial-getty autologin on ttyS0 can appear before mirrored first-boot output. */
export function serialFirstBootInProgress(serialOutput) {
    return FIRST_BOOT_PROGRESS_SERIAL_MARKERS.some((marker) => serialOutput.includes(marker));
}
