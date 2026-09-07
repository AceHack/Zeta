#!/usr/bin/env bun
/**
 * tools/setup/persona-keys/plan-setup-from-frost.ts
 *
 * Overlay env join from a frost `HardwareProbeResult`.
 * Maps via `namedProbeFromFrostResult`, then
 * `planSetupFromNamedBaoElfEnv`. Cluster does not import
 * this file or frost-hardware-probe (fs/spawn).
 *
 * Null is unmeasured, not absent. `/dev/tpmrm0` does not
 * upgrade `tpm2` to `present`. A YubiKey / CCID reader
 * does not set `smartcardHsm`. A PKCS#11 driver on disk
 * does not set `yubiHsm2` to `attached`. OS family is
 * named by the caller, not read from `/etc/os-release`.
 * Does not call `probeHardwareSecurity`. Does not change
 * ISO bun `probe: null`.
 */

import type { OsFamily } from "../../../src/Core.TypeScript/cluster/host-seal-profile.ts";
import type { RestoredPkcs11PointerCapture } from "../../../src/Core.TypeScript/cluster/unseal-path.ts";
import {
  planSetupFromNamedBaoElfEnv,
  type BaoElfRead,
  type FirstBootBaoElfFromEnv,
} from "../../../src/Core.TypeScript/installer/bao-elf-capture.ts";
import type { HardwareProbeResult } from "./frost-hardware-probe.ts";
import { namedProbeFromFrostResult } from "./named-probe-from-frost.ts";

/**
 * Null frost result is unmeasured. CardContact is not inferred.
 */
export function planSetupFromFrostEnv(
  restore: RestoredPkcs11PointerCapture,
  env: { readonly [key: string]: string | undefined },
  read: BaoElfRead,
  result: HardwareProbeResult | null,
  os: OsFamily,
): FirstBootBaoElfFromEnv {
  return planSetupFromNamedBaoElfEnv(restore, env, read, namedProbeFromFrostResult(result, os));
}
