#!/usr/bin/env bun
/**
 * tools/setup/persona-keys/named-probe-from-frost-look.ts
 *
 * Run frost with named effects, then map to
 * `NamedHardwareProbe`. Null effects is unmeasured, not a
 * live look. Does not default to `realProbeEffects`.
 * Cluster does not import this file or frost-hardware-probe
 * (fs/spawn).
 *
 * `/dev/tpmrm0` does not upgrade `tpm2` to `present`.
 * A YubiKey / CCID reader does not set `smartcardHsm`.
 * A PKCS#11 driver on disk does not set `yubiHsm2` to
 * `attached`. OS family is named by the caller, not read
 * from `/etc/os-release`. Does not call overlay join.
 * Does not change ISO bun `probe: null`.
 */

import type { OsFamily, NamedHardwareProbe } from "../../../src/Core.TypeScript/cluster/host-seal-profile.ts";
import { probeHardwareSecurity, type HardwareProbeEffects } from "./frost-hardware-probe.ts";
import { namedProbeFromFrostResult } from "./named-probe-from-frost.ts";

/**
 * Null effects is unmeasured. CardContact is not inferred.
 */
export function namedProbeFromFrostLook(
  os: OsFamily,
  fx: HardwareProbeEffects | null,
): NamedHardwareProbe | null {
  if (fx === null) return namedProbeFromFrostResult(null, os);
  return namedProbeFromFrostResult(probeHardwareSecurity(fx), os);
}
