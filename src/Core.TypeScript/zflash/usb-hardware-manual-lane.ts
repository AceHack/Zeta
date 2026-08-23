// src/Core.TypeScript/zflash/usb-hardware-manual-lane.ts
//
// THE REGISTER OF WHAT NO AUTOMATED SUITE ON THIS REPO CAN CHECK.
//
// Zeta has two USB hardware paths, and both split the same way:
//
//   1. THE INSTALLER STICK -- zflash writes an ISO to a flash drive
//      (src/Core.TypeScript/zflash/). Its decision logic is now tested on every
//      host by flash-usb.test.ts + the linux/windows arms' test files.
//   2. THE SECURITY TOKEN -- a YubiKey / YubiHSM / SmartCard-HSM over PKCS#11
//      holds a FROST share (tools/setup/persona-keys/). Its wrapper logic and
//      roster refusals are tested by frost-share-adapter.test.ts and
//      frost-token-roster.test.ts; the on-chip behaviour is opted into via
//      ZETA_FROST_HARDWARE_LANE in frost-share-adapter.hardware.test.ts.
//
// What NEITHER can check without a device physically present is listed below.
// The list exists because the alternative -- an untested property that nobody
// has written down -- is indistinguishable from a tested one when you read a
// green suite. Aaron's standing formulation: a check that did not run must
// never look like a check that passed.
//
// This module is DATA. It executes nothing, touches no device, reads no
// credential. usb-hardware-manual-lane.test.ts prints every entry on every run
// of the suite, so the skip is loud by construction rather than by intention.

/** Which of the two USB paths an entry belongs to. */
export type UsbPath = "installer-stick" | "security-token";

export interface ManualCheck {
  /** Stable id. Quoted in the procedure doc and in any incident writeup. */
  readonly id: string;
  readonly path: UsbPath;
  /** What the check establishes, in one line. */
  readonly proves: string;
  /**
   * WHY no automated suite can establish it. This field is the honest half: an
   * entry whose reason is weak is an entry that should have been automated.
   */
  readonly needsHardwareBecause: string;
  /** Exact command(s) an operator runs. Copy-pasteable, no placeholders that
   *  are not marked with < >. */
  readonly command: string;
  /** What a PASS looks like, concretely enough to tell from a near-miss. */
  readonly expected: string;
  /** What the operator must do if it does not match. Never "investigate". */
  readonly onMismatch: string;
  /** True when the step destroys data on the target device. */
  readonly destructive: boolean;
}

/**
 * The installer-stick half.
 *
 * Note what is NOT here: device selection, the size bounds, the bus filter, the
 * boot-disk refusal, the flag allowlist and the consent-challenge comparison all
 * moved into flash-usb.test.ts and no longer need a stick. The residue below is
 * the part that is genuinely physical.
 */
const INSTALLER_STICK: readonly ManualCheck[] = [
  {
    id: "MAN-USB-01",
    path: "installer-stick",
    proves:
      "diskutil reports a real stick with BusProtocol USB or USB-C and Internal false, " +
      "so the bus filter has something true to filter.",
    needsHardwareBecause:
      "The values come from the USB controller via IOKit. A fixture proves the PARSE is " +
      "right and can say nothing about whether a real SanDisk reports 'USB' or 'USB-C' on " +
      "this Mac's controller -- and the filter accepts exactly those two strings.",
    command: "diskutil list -plist external physical | plutil -convert json -o - -",
    expected:
      "AllDisksAndPartitions contains the stick's DeviceIdentifier (diskN). " +
      "`diskutil info -plist /dev/diskN` shows BusProtocol USB or USB-C, Internal false, " +
      "RemovableMedia true, and a TotalSize between 4 GiB and 256 GiB.",
    onMismatch:
      "If BusProtocol is any third string, the bus filter in isUsbCandidate() is " +
      "incomplete for this controller: record the exact string and file it before flashing.",
    destructive: false,
  },
  {
    id: "MAN-USB-02",
    path: "installer-stick",
    proves:
      "The ambiguity refusal fires on genuinely two attached sticks, not just on a " +
      "two-element array in a test.",
    needsHardwareBecause:
      "selectUsbTarget() is proven on arrays. What is not proven without hardware is that " +
      "TWO plugged-in sticks actually produce two enumerated candidates -- a hub or a " +
      "card reader that presents one node for two devices would defeat the rail upstream " +
      "of the function the test covers.",
    command:
      "Plug in TWO USB sticks, then: bun src/Core.TypeScript/zflash/flash-usb.ts <iso-path>",
    expected:
      "Exit code 2, before any prompt. stderr lists BOTH devices with size and model, " +
      "then 'refusing to pick one. Unplug all but the target USB and re-run'.",
    onMismatch:
      "If it selects one and prompts, STOP -- do not answer the challenge. The " +
      "enumeration is collapsing two devices into one candidate; that is a P0.",
    destructive: false,
  },
  {
    id: "MAN-USB-03",
    path: "installer-stick",
    proves: "Touch ID fires at the sudo gate and a fingerprint, not a password, unlocks dd.",
    needsHardwareBecause:
      "pam_tid.so talks to the Secure Enclave and the physical sensor. analyzeSudoAuthChain() " +
      "can prove the PAM chain is CONFIGURED for it; only a finger on the trackpad proves " +
      "the biometric actually gates the destructive operation.",
    command:
      "grep -n pam_tid /etc/pam.d/sudo /etc/pam.d/sudo_local 2>/dev/null; " +
      "then run: bun src/Core.TypeScript/zflash/flash-usb.ts --short <iso-path>",
    expected:
      "After the `yes <4-hex>` challenge is answered, the macOS Touch ID sheet appears and " +
      "waits. Touching the sensor proceeds; pressing Escape aborts with a non-zero exit and " +
      "NO write. No password is typed at any point.",
    onMismatch:
      "If a password prompt appears instead, the biometric factor was NOT established: the " +
      "run is authorised by a shared secret an agent could hold. Treat any resulting flash " +
      "as unattributed and record the factor honestly (biometric.ts establishedFactor()).",
    destructive: true,
  },
  {
    id: "MAN-USB-04",
    path: "installer-stick",
    proves: "The post-write read-back verify compares real written media against the ISO.",
    needsHardwareBecause:
      "verifyReadBack() is tested against file-backed readers. Only a real device exercises " +
      "the privileged sudo-dd reader, the raw /dev/rdiskN path, block alignment on a real " +
      "sector size, and a controller that may short-read.",
    command: "bun src/Core.TypeScript/zflash/flash-usb.ts <iso-path>   (complete the challenge)",
    expected:
      "After dd, the read-back stage runs to completion and reports a match. Exit code 0 " +
      "and 'Flash complete.' The stick then mounts with the ZETA_INSTALL volume label.",
    onMismatch:
      "A read-back mismatch means the bytes on the stick are not the bytes verified. Do not " +
      "boot it. Re-flash; if it mismatches twice, the stick is failing -- discard it.",
    destructive: true,
  },
  {
    id: "MAN-USB-05",
    path: "installer-stick",
    proves: "The flashed stick actually boots the target machine via UEFI.",
    needsHardwareBecause:
      "This is firmware behaviour on the destination host. Nothing in this repository can " +
      "observe a UEFI boot; the whole chain being green up to here still permits a stick " +
      "that no firmware will select.",
    command: "Boot the target node from the stick (firmware boot menu).",
    expected: "The Zeta installer reaches its first serial marker.",
    onMismatch:
      "If firmware does not offer the stick, the ESP is not being recognised -- check the " +
      "partition type GUID before re-flashing (c12a7328-f81f-11d2-ba4b-00a0c93ec93b).",
    destructive: false,
  },
];

/**
 * The security-token half.
 *
 * These entries do NOT duplicate the frost hardware lane -- they point at it.
 * That lane is real, opts in through ZETA_FROST_HARDWARE_LANE, and fails rather
 * than skips when the hardware is absent. What this register adds is that the
 * lane's existence is announced on every ordinary suite run, so an operator who
 * never sets the variable still learns the checks exist.
 */
const SECURITY_TOKEN: readonly ManualCheck[] = [
  {
    id: "MAN-TOK-01",
    path: "security-token",
    proves: "A PKCS#11 token is attached and reports a stable label#serial identity.",
    needsHardwareBecause:
      "describeAttachedPkcs11Tokens() enumerates through the vendor's PKCS#11 module against " +
      "a real chip. A driver .dylib present on disk is not an attached token -- that exact " +
      "confusion was a shipped bug (PR-10644).",
    command:
      "bun tools/setup/persona-keys/frost-token-roster.ts tokens <path-to-pkcs11-module>",
    expected:
      "One line per attached token, each as label#serial. The serial matches the number " +
      "printed on the outside of the device. NO key material is printed.",
    onMismatch:
      "An empty list with the device plugged in means the module path is wrong or the token " +
      "is claimed by another process. Do not fall back to a software adapter.",
    destructive: false,
  },
  {
    id: "MAN-TOK-02",
    path: "security-token",
    proves:
      "Each token opens ONLY its own share -- one compromised token yields one share, " +
      "which is below threshold.",
    needsHardwareBecause:
      "The failure mode is silent and physical: provisioning the same wrapping key on every " +
      "token (one PIN, plus a spare) makes any token open any share, with nothing in the " +
      "artifact to show it. Only real chips with real distinct keys can falsify that.",
    // The --config flag is REQUIRED and must precede `test`; without it bun's
    // pathIgnorePatterns swallow the file and the lane silently does not run.
    // See bunfig.hardware-lane.toml for the measurement.
    command:
      "ZETA_FROST_HARDWARE_LANE=pkcs11-multi ZETA_FROST_PKCS11_LIB=<module> " +
      "ZETA_FROST_PKCS11_PIN=<pin> ZETA_FROST_PKCS11_TOKENS='<a#serial>,<b#serial>' " +
      "bun --config=bunfig.hardware-lane.toml test " +
      "./tools/setup/persona-keys/frost-share-adapter.hardware.test.ts",
    expected:
      "HW-6 through HW-11 pass. HW-9 in particular shows every cross-token load throwing " +
      "'wrong token for share x='.",
    onMismatch:
      "If HW-9 fails, the roster has silently collapsed to 1-of-N: the threshold you believe " +
      "you have is not the threshold you have. Stop and re-provision distinct wrapping keys.",
    destructive: false,
  },
  {
    id: "MAN-TOK-03",
    path: "security-token",
    proves: "Touch presence is required for a signing operation on a token that supports it.",
    needsHardwareBecause:
      "Touch presence is a physical capacitive event. No software observation distinguishes " +
      "'the token required a touch' from 'the token signed unattended' after the fact.",
    command:
      "Perform one signing operation with the token attached and DO NOT touch it; observe " +
      "that it blocks. Repeat and touch it; observe that it proceeds.",
    expected:
      "Untouched: the operation blocks until timeout. Touched: it completes. The difference " +
      "is what proves the policy is on.",
    onMismatch:
      "If the untouched attempt SUCCEEDS, touch policy is not enabled on that key. An " +
      "unattended signer is a different threat model from the one the custody design assumes " +
      "-- record it before relying on the key.",
    destructive: false,
  },
  {
    id: "MAN-TOK-04",
    path: "security-token",
    proves: "The attestation certificate chain for an on-device generated key verifies.",
    needsHardwareBecause:
      "The attestation statement is signed by a per-device key injected at manufacture. There " +
      "is no way to produce a genuine one in software, and a fixture proves only that the " +
      "PARSER works -- never that the device this repo will trust is genuine.",
    command:
      "Export the attestation certificate and its intermediate from the token, then verify " +
      "the chain to the vendor root with `openssl verify -CAfile <vendor-root> -untrusted " +
      "<intermediate> <attestation-cert>`.",
    expected:
      "openssl reports OK, and the attestation extension states the key was generated ON the " +
      "device rather than imported.",
    onMismatch:
      "A chain that does not verify, or an attestation saying the key was IMPORTED, means the " +
      "private key may have existed off-device. Do not enrol it as a custody share.",
    destructive: false,
  },
  {
    id: "MAN-TOK-05",
    path: "security-token",
    proves: "Key generation happened ON the device and the private half never crossed the host.",
    needsHardwareBecause:
      "This is a claim about what did NOT happen on a bus. Only the device's own attestation, " +
      "read from the device, can support it.",
    command:
      "Generate the key with the vendor tool's on-device generate operation, then re-run " +
      "MAN-TOK-04 against the resulting attestation.",
    expected: "Attestation confirms on-device origin for the newly generated key handle.",
    onMismatch:
      "If the tool silently generated in software and imported, every downstream custody " +
      "claim about that share is overstated. Treat the share as compromised-by-provenance.",
    destructive: false,
  },
];

/** Every hardware-only check, both USB paths. */
export const MANUAL_CHECKS: readonly ManualCheck[] = [...INSTALLER_STICK, ...SECURITY_TOKEN];

/** The document that carries the long-form procedure for these ids. */
export const PROCEDURE_DOC = "docs/security/USB-HARDWARE-SETUP-TEST-PROCEDURE.md";

/**
 * The banner the automated suite prints. Named and exported so its exact shape
 * is assertable -- a loud skip whose loudness is not itself checked is one
 * refactor away from being a quiet one.
 */
export function renderNotTestedBanner(checks: readonly ManualCheck[] = MANUAL_CHECKS): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("=".repeat(78));
  lines.push("NOT TESTED BY THIS SUITE -- USB HARDWARE REQUIRED");
  lines.push("=".repeat(78));
  lines.push(
    `${String(checks.length)} checks below need a device physically attached. They did NOT run.`,
  );
  lines.push(`Procedure with expected outputs: ${PROCEDURE_DOC}`);
  lines.push("");
  for (const c of checks) {
    lines.push(`  ${c.id}  [${c.path}]${c.destructive ? "  *DESTRUCTIVE*" : ""}`);
    lines.push(`     proves : ${c.proves}`);
    lines.push(`     needs hardware because : ${c.needsHardwareBecause}`);
  }
  lines.push("");
  lines.push("A green run of this suite says NOTHING about the lines above.");
  lines.push("=".repeat(78));
  lines.push("");
  return lines.join("\n");
}
