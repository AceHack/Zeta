#!/usr/bin/env bun
/**
 * tools/setup/persona-keys/plan-setup-from-frost.ts
 *
 * Overlay env/argv/conf joins from a frost
 * `HardwareProbeResult`. Maps via
 * `namedProbeFromFrostResult`, then
 * `planSetupFromNamedBaoElfEnv` /
 * `planSetupFromNamedBaoElfArgv` /
 * `planSetupFromNamedBaoElfConf`. Cluster does not import
 * this file or frost-hardware-probe (fs/spawn). Does not
 * add the unseal request to ESP conf.
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
  planSetupFromNamedBaoElfArgv,
  planSetupFromNamedBaoElfConf,
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

/**
 * Argv sibling. Unseal request stays named from env.
 * Does not add the request to ESP conf.
 */
export function planSetupFromFrostArgv(
  restore: RestoredPkcs11PointerCapture,
  argv: readonly string[],
  env: { readonly [key: string]: string | undefined },
  read: BaoElfRead,
  result: HardwareProbeResult | null,
  os: OsFamily,
): FirstBootBaoElfFromEnv {
  return planSetupFromNamedBaoElfArgv(restore, argv, env, read, namedProbeFromFrostResult(result, os));
}

/**
 * Conf sibling. Unseal request stays named from env.
 * Does not add the request to the conf body.
 */
export function planSetupFromFrostConf(
  restore: RestoredPkcs11PointerCapture,
  conf: string,
  env: { readonly [key: string]: string | undefined },
  read: BaoElfRead,
  result: HardwareProbeResult | null,
  os: OsFamily,
): FirstBootBaoElfFromEnv {
  return planSetupFromNamedBaoElfConf(restore, conf, env, read, namedProbeFromFrostResult(result, os));
}
