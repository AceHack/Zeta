export const B0891_RETENTION_USB_SERIAL_MARKERS = [
  "[081KSNY2Z0008QG0R0008PN7RQ-retention]   found pre-baked zeta-creds.enc on boot USB ESP",
  "[081KSNY2Z0008QG0R0008PN7RQ-retention]   Step 6.95-picker will skip account re-entry"
], B0891_FRESH_USB_SERIAL_MARKER = "[081KSNY2Z0008QG0R0008PN7RQ-retention]   no pre-baked zeta-creds.enc on boot USB ESP; Step 6.95-picker remains normal", INSTALLED_OS_RETENTION_SERIAL_MARKERS = [
  "zeta-creds-restore: reading preserved ESP blob",
  "zeta-creds-restore:",
  "already-present"
], INSTALLED_OS_FRESH_RESTORE_FORBIDDEN_MARKERS = ["already-present"], HOSTNAME_INJECTION_SERIAL_MARKERS = [
  "[iter-5.2]   found injected hostname:",
  "[iter-5.2]   wrote /mnt/etc/zeta/cluster-node-id",
  "[iter-5.2]   networking.hostName will be"
], HOSTNAME_AUTOGENERATION_SERIAL_MARKERS = [
  "[iter-5.2]   no zeta-hostname.txt on USB ESP",
  "[iter-5.2.2] generating fresh random hostname on-node (per-install unique) ...",
  "[iter-5.2.2]   generated:",
  "[iter-5.2.2]   wrote /mnt/etc/zeta/cluster-node-id",
  "[iter-5.2.2]   networking.hostName will be"
], INSTALL_COMPLETE_SERIAL_MARKER = "ZETA CLUSTER NODE INSTALL COMPLETE", INITIAL_INSTALL_SERIAL_MARKERS = [INSTALL_COMPLETE_SERIAL_MARKER], RETENTION_FAILURE_SERIAL_MARKERS = [
  "panic",
  "FATAL",
  "Refusing to wipe",
  "no internet",
  "bail"
], RETENTION_ABSENT_TERMINAL_MARKERS = ["nixos@zeta-installer:~"], FIRST_BOOT_PROGRESS_SERIAL_MARKERS = [
  "Zeta cluster installer",
  "Role selected:",
  "[3/3] Running zeta-install",
  "[zeta-first-boot]"
], B0891_CLUSTER_JOIN_SERIAL_MARKERS = [
  "[081KSNY2Z0008QG0R0008PN7RQ-joining]     cluster join successful",
  "[081KSNY2Z0008QG0R0008PN7RQ-joining]     joining-node added to the cluster state"
], FIRST_SESSION_SERIAL_MARKERS = [
  "zeta-first-session: begin",
  "zeta-first-session: complete"
], FIRST_SESSION_HAPPY_PATH_SERIAL_MARKERS = [
  "zeta-first-session: begin",
  "zeta-first-session: choice kind=use_local_llm_only",
  "zeta-first-session: complete canSelfRegister=true"
], FIRST_SESSION_SETUP_GH_CHOICE_MARKER = "zeta-first-session: choice kind=setup_credential vendor=gh", FIRST_SESSION_MOCK_IDENTITY_AUTH_MARKERS = [
  "zeta-first-session: identity-auth-mock-begin",
  "zeta-first-session: identity-auth-mock-ok"
], FIRST_SESSION_SKIP_IDENTITY_AUTH_MARKERS = [
  "zeta-first-session: identity-auth-skip"
], FIRST_SESSION_SKIP_GH_SERIAL_MARKERS = [
  "zeta-first-session: begin",
  "zeta-first-session: complete canSelfRegister=false"
], FIRST_SESSION_SKIP_GH_EVIDENCE_MARKERS = [
  "zeta-first-session: choice kind=skip_credential vendor=gh",
  "Continue later:",
  "SSH in and set up GitHub there"
];
function assertSerialMarkers(serialOutput, requiredMarkers) {
  const missingMarkers = requiredMarkers.filter((marker) => !serialOutput.includes(marker));
  if (missingMarkers.length > 0)
    return {
      error: {
        kind: "missing-serial-markers",
        missingMarkers,
        requiredMarkers
      }
    };
  return {
    ok: {
      matchedMarkers: requiredMarkers
    }
  };
}
export function assertHappyPathFirstSessionSerial(serialOutput) {
  return assertSerialMarkers(serialOutput, FIRST_SESSION_HAPPY_PATH_SERIAL_MARKERS);
}
export function assertMockIdentityAuthFirstSessionSerial(serialOutput) {
  const happy = assertHappyPathFirstSessionSerial(serialOutput);
  if ("error" in happy)
    return happy;
  const choice = assertSerialMarkers(serialOutput, [FIRST_SESSION_SETUP_GH_CHOICE_MARKER]);
  if ("error" in choice)
    return choice;
  const mock = assertSerialMarkers(serialOutput, FIRST_SESSION_MOCK_IDENTITY_AUTH_MARKERS);
  if ("error" in mock)
    return mock;
  return {
    ok: {
      matchedMarkers: [
        ...happy.ok.matchedMarkers,
        ...choice.ok.matchedMarkers,
        ...mock.ok.matchedMarkers
      ]
    }
  };
}
export function assertSkipGhFirstSessionSerial(serialOutput) {
  const lifecycle = assertSerialMarkers(serialOutput, FIRST_SESSION_SKIP_GH_SERIAL_MARKERS);
  if ("error" in lifecycle)
    return lifecycle;
  const evidenceMatchedMarkers = FIRST_SESSION_SKIP_GH_EVIDENCE_MARKERS.filter((marker) => serialOutput.includes(marker));
  if (evidenceMatchedMarkers.length === 0)
    return {
      error: {
        kind: "missing-serial-markers",
        missingMarkers: [...FIRST_SESSION_SKIP_GH_EVIDENCE_MARKERS],
        requiredMarkers: [...FIRST_SESSION_SKIP_GH_SERIAL_MARKERS, ...FIRST_SESSION_SKIP_GH_EVIDENCE_MARKERS]
      }
    };
  return {
    ok: {
      matchedMarkers: [...lifecycle.ok.matchedMarkers, ...evidenceMatchedMarkers]
    }
  };
}
export function serialFirstBootInProgress(serialOutput) {
  return FIRST_BOOT_PROGRESS_SERIAL_MARKERS.some((marker) => serialOutput.includes(marker));
}
