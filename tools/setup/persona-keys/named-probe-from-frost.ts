#!/usr/bin/env bun
/**
 * tools/setup/persona-keys/named-probe-from-frost.ts
 *
 * Map a frost `HardwareProbeResult` to `NamedHardwareProbe`.
 * Cluster consumes the named probe; it does not import this
 * file or frost-hardware-probe (fs/spawn).
 *
 * Null is unmeasured, not absent. `/dev/tpmrm0` does not
 * upgrade `tpm2` to `present` — `tpm2State` is copied.
 * A YubiKey / CCID reader does not set `smartcardHsm`.
 * A PKCS#11 driver on disk does not set `yubiHsm2` to
 * `attached`. OS family is named by the caller, not read
 * from `/etc/os-release`. Does not call `probeHardwareSecurity`.
 * Does not call `integrateAtSetup`.
 */

import type { OsFamily, NamedHardwareProbe } from "../../../src/Core.TypeScript/cluster/host-seal-profile.ts";
import type { HardwareProbeResult } from "./frost-hardware-probe.ts";

/**
 * Null frost result is unmeasured. CardContact is not inferred.
 */
export function namedProbeFromFrostResult(
  result: HardwareProbeResult | null,
  os: OsFamily,
): NamedHardwareProbe | null {
  if (result === null) return null;
  return {
    os,
    tpm2: result.tpm2State,
    tpmDeviceNode: result.tpmDeviceNode ?? null,
    yubiHsm2: result.yubiHsm2State,
    smartCardReaderAttached: result.smartCardReaderAttached,
    yubikeyDetected: result.yubikeyDetected,
    pkcs11ModuleOnDisk: result.pkcs11ModuleFound || result.yubiHsm2Pkcs11ModuleFound,
    smartcardHsm: "not-asked",
  };
}
