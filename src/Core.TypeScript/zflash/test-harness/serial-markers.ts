/**
 * 081KSNY2Z0008QG0R0008PN7RQ shared serial-marker vocabulary for QEMU harness scenarios.
 *
 * Centralizes marker strings so scenario 3 retention restarts and scenario 4
 * path-fork forks agree on what zeta-install emits when a zflash-prepared boot
 * image carries (or omits) /zeta-creds.enc on the ESP.
 */

/** zeta-install.sh emits these when the boot USB ESP already has zeta-creds.enc. */
export const B0891_RETENTION_USB_SERIAL_MARKERS: readonly string[] = [
  "[081KSNY2Z0008QG0R0008PN7RQ-retention]   found pre-baked zeta-creds.enc on boot USB ESP",
  "[081KSNY2Z0008QG0R0008PN7RQ-retention]   Step 6.95-picker will skip account re-entry",
];

/** zeta-install.sh emits this when the boot USB has no retained cred blob. */
export const B0891_FRESH_USB_SERIAL_MARKER =
  "[081KSNY2Z0008QG0R0008PN7RQ-retention]   no pre-baked zeta-creds.enc on boot USB ESP; Step 6.95-picker remains normal";

/** Post-install first-boot cred restore idempotency markers (installed OS path). */
export const INSTALLED_OS_RETENTION_SERIAL_MARKERS: readonly string[] = ["zeta-creds-restore:", "already-present"];

/** zeta-install.sh emits these when /zeta-hostname.txt is injected from the boot USB ESP. */
export const HOSTNAME_INJECTION_SERIAL_MARKERS: readonly string[] = [
  "[iter-5.2]   found injected hostname:",
  "[iter-5.2]   wrote /mnt/etc/zeta/cluster-node-id",
  "[iter-5.2]   networking.hostName will be",
];

/** zeta-install.sh emits these when no hostname blob exists and it generates one on-node. */
export const HOSTNAME_AUTOGENERATION_SERIAL_MARKERS: readonly string[] = [
  "[iter-5.2]   no zeta-hostname.txt on USB ESP",
  "[iter-5.2.2] generating fresh random hostname on-node (per-install unique) ...",
  "[iter-5.2.2]   generated:",
  "[iter-5.2.2]   wrote /mnt/etc/zeta/cluster-node-id",
  "[iter-5.2.2]   networking.hostName will be",
];

/** zeta-install.sh success banner — full install finished (same boundary as scenario 2 phase 1). */
export const INSTALL_COMPLETE_SERIAL_MARKER = "ZETA CLUSTER NODE INSTALL COMPLETE";

/** Baseline snapshot boundary for scenarios 3/4 — must not stop at mid-install [iter-5.1]. */
export const INITIAL_INSTALL_SERIAL_MARKERS: readonly string[] = [INSTALL_COMPLETE_SERIAL_MARKER];

export const RETENTION_FAILURE_SERIAL_MARKERS: readonly string[] = [
  "panic",
  "FATAL",
  "Refusing to wipe",
  "no internet",
  "bail",
];

export const RETENTION_ABSENT_TERMINAL_MARKERS: readonly string[] = ["nixos@zeta-installer:~"];

/** Emitted on tty1 and mirrored to ttyS0 while zeta-first-boot.service runs. */
export const FIRST_BOOT_PROGRESS_SERIAL_MARKERS: readonly string[] = [
  "Zeta cluster installer",
  "Role selected:",
  "[3/3] Running zeta-install",
  "[zeta-first-boot]",
];

/** Scenario 5 cluster-joining success markers. */
export const B0891_CLUSTER_JOIN_SERIAL_MARKERS: readonly string[] = [
  "[081KSNY2Z0008QG0R0008PN7RQ-joining]     cluster join successful",
  "[081KSNY2Z0008QG0R0008PN7RQ-joining]     joining-node added to the cluster state",
];

/** 081KSNY2Z0008QG0R0008PN7RQ phase-3 (future): post-login first-session adventure on installed OS. */
export const FIRST_SESSION_SERIAL_MARKERS: readonly string[] = [
  "zeta-first-session: begin",
  "zeta-first-session: complete",
];

export const FIRST_SESSION_HAPPY_PATH_SERIAL_MARKERS: readonly string[] = [
  "zeta-first-session: begin",
  "zeta-first-session: choice kind=use_local_llm_only",
  "zeta-first-session: complete canSelfRegister=true",
];

export const FIRST_SESSION_SETUP_GH_CHOICE_MARKER = "zeta-first-session: choice kind=setup_credential vendor=gh";

export const FIRST_SESSION_SKIP_GH_SERIAL_MARKERS: readonly string[] = [
  "zeta-first-session: begin",
  "zeta-first-session: complete canSelfRegister=false",
];

export const FIRST_SESSION_SKIP_GH_EVIDENCE_MARKERS: readonly string[] = [
  "zeta-first-session: choice kind=skip_credential vendor=gh",
  "Continue later:",
  "SSH in and set up GitHub there",
];

export interface FirstSessionSerialMarkerAssertion {
  readonly matchedMarkers: readonly string[];
}

export type FirstSessionSerialMarkerFeedback = {
  readonly kind: "missing-serial-markers";
  readonly missingMarkers: readonly string[];
  readonly requiredMarkers: readonly string[];
};

export type FirstSessionSerialMarkerResult =
  | { readonly ok: FirstSessionSerialMarkerAssertion }
  | { readonly error: FirstSessionSerialMarkerFeedback };

function assertSerialMarkers(
  serialOutput: string,
  requiredMarkers: readonly string[],
): FirstSessionSerialMarkerResult {
  const missingMarkers = requiredMarkers.filter((marker) => !serialOutput.includes(marker));
  if (missingMarkers.length > 0) {
    return {
      error: {
        kind: "missing-serial-markers",
        missingMarkers,
        requiredMarkers,
      },
    };
  }

  return {
    ok: {
      matchedMarkers: requiredMarkers,
    },
  };
}

export function assertHappyPathFirstSessionSerial(serialOutput: string): FirstSessionSerialMarkerResult {
  return assertSerialMarkers(serialOutput, FIRST_SESSION_HAPPY_PATH_SERIAL_MARKERS);
}

export function assertSkipGhFirstSessionSerial(serialOutput: string): FirstSessionSerialMarkerResult {
  const lifecycle = assertSerialMarkers(serialOutput, FIRST_SESSION_SKIP_GH_SERIAL_MARKERS);
  if ("error" in lifecycle) {
    return lifecycle;
  }

  const evidenceMatchedMarkers = FIRST_SESSION_SKIP_GH_EVIDENCE_MARKERS.filter((marker) => serialOutput.includes(marker));
  if (evidenceMatchedMarkers.length === 0) {
    return {
      error: {
        kind: "missing-serial-markers",
        missingMarkers: [...FIRST_SESSION_SKIP_GH_EVIDENCE_MARKERS],
        requiredMarkers: [...FIRST_SESSION_SKIP_GH_SERIAL_MARKERS, ...FIRST_SESSION_SKIP_GH_EVIDENCE_MARKERS],
      },
    };
  }

  return {
    ok: {
      matchedMarkers: [...lifecycle.ok.matchedMarkers, ...evidenceMatchedMarkers],
    },
  };
}

/** serial-getty autologin on ttyS0 can appear before mirrored first-boot output. */
export function serialFirstBootInProgress(serialOutput: string): boolean {
  return FIRST_BOOT_PROGRESS_SERIAL_MARKERS.some((marker) => serialOutput.includes(marker));
}
