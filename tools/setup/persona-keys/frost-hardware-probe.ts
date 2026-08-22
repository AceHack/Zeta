/**
 * frost-hardware-probe.ts — Hardware Security Device Probe Engine.
 *
 * Probes local system interfaces for physical YubiKey (PCSC/CCID), TPM 2.0
 * device nodes (/dev/tpmrm0, /sys/class/tpm), and PKCS#11 shared libraries.
 *
 * Supports seamless fallback to software simulation when physical hardware is unattached.
 */

import { existsSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";

export interface HardwareProbeResult {
  readonly timestamp: string;
  readonly tpm2Available: boolean;
  readonly tpmDeviceNode?: string | undefined;
  readonly yubikeyDetected: boolean;
  readonly yubikeySerial?: string | undefined;
  readonly pkcs11ModuleFound: boolean;
  readonly pkcs11LibraryPath?: string | undefined;
  readonly fallbackToSimulator: boolean;
}

/**
 * Standard PKCS#11 library locations across macOS and Linux systems.
 */
const PKCS11_LIBRARY_PATHS: readonly string[] = [
  "/usr/local/lib/ykcs11.dylib",
  "/opt/homebrew/lib/ykcs11.dylib",
  "/usr/lib/x86_64-linux-gnu/opensc-pkcs11.so",
  "/usr/lib/x86_64-linux-gnu/libykcs11.so",
  "/usr/lib/libykcs11.so",
];

/**
 * Probes for physical TPM 2.0 device nodes.
 */
export function probeTpm2(): { available: boolean; path?: string } {
  if (existsSync("/dev/tpmrm0")) {
    return { available: true, path: "/dev/tpmrm0" };
  }
  if (existsSync("/dev/tpm0")) {
    return { available: true, path: "/dev/tpm0" };
  }
  if (existsSync("/sys/class/tpm")) {
    try {
      const entries = readdirSync("/sys/class/tpm");
      if (entries.length > 0) {
        return { available: true, path: `/dev/${entries[0]}` };
      }
    } catch {
      // Ignore reading error
    }
  }
  return { available: false };
}

/**
 * Probes for physical YubiKey USB device attached via system USB / PCSC tools.
 */
export function probeYubikey(): { detected: boolean; serial?: string } {
  try {
    const output = execSync("ykman list --serials 2>/dev/null || ykman info 2>/dev/null", {
      encoding: "utf8",
      timeout: 1000,
    });
    const match = output.match(/\b\d{6,10}\b/);
    if (match) {
      return { detected: true, serial: match[0] };
    }
  } catch {
    // Command failed or ykman not present
  }
  return { detected: false };
}

/**
 * Probes for PKCS#11 shared library installation.
 */
export function probePkcs11(): { found: boolean; path?: string } {
  for (const libPath of PKCS11_LIBRARY_PATHS) {
    if (existsSync(libPath)) {
      return { found: true, path: libPath };
    }
  }
  return { found: false };
}

/**
 * Runs full hardware security probe and determines if simulator fallback is required.
 */
export function probeHardwareSecurity(): HardwareProbeResult {
  const tpm = probeTpm2();
  const yubi = probeYubikey();
  const pkcs11 = probePkcs11();

  const hardwareAvailable = tpm.available || yubi.detected || pkcs11.found;

  return {
    timestamp: new Date().toISOString(),
    tpm2Available: tpm.available,
    tpmDeviceNode: tpm.path,
    yubikeyDetected: yubi.detected,
    yubikeySerial: yubi.serial,
    pkcs11ModuleFound: pkcs11.found,
    pkcs11LibraryPath: pkcs11.path,
    fallbackToSimulator: !hardwareAvailable,
  };
}

if (import.meta.main) {
  const res = probeHardwareSecurity();
  console.log(`[Hardware Security Probe] Result:`);
  console.log(`  TPM 2.0:           ${res.tpm2Available ? res.tpmDeviceNode : "Not found"}`);
  console.log(`  YubiKey:           ${res.yubikeyDetected ? `Detected (S/N: ${res.yubikeySerial})` : "Not detected"}`);
  console.log(`  PKCS#11 Library:   ${res.pkcs11ModuleFound ? res.pkcs11LibraryPath : "Not found"}`);
  console.log(`  Simulator Fallback:${res.fallbackToSimulator ? " ACTIVE" : " INACTIVE (Hardware present)"}`);
}
