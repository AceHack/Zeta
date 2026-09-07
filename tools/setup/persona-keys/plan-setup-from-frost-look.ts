#!/usr/bin/env bun
/**
 * tools/setup/persona-keys/plan-setup-from-frost-look.ts
 *
 * Overlay env/argv/conf joins from a frost look with named
 * effects. Maps via `namedProbeFromFrostLook`, then
 * `planSetupFromNamedBaoElfEnv` /
 * `planSetupFromNamedBaoElfArgv` /
 * `planSetupFromNamedBaoElfConf`. Cluster does not import
 * this file or frost-hardware-probe (fs/spawn). Does not
 * add the unseal request to ESP conf.
 *
 * Null effects is unmeasured, not a live look. Does not
 * default to `realProbeEffects`. `/dev/tpmrm0` does not
 * upgrade `tpm2` to `present`. A YubiKey / CCID reader
 * does not set `smartcardHsm`. A PKCS#11 driver on disk
 * does not set `yubiHsm2` to `attached`. OS family is
 * named by the caller, not read from `/etc/os-release`.
 * Does not change ISO bun `probe: null`.
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
import type { HardwareProbeEffects } from "./frost-hardware-probe.ts";
import { namedProbeFromFrostLook } from "./named-probe-from-frost-look.ts";

/**
 * Null effects is unmeasured. CardContact is not inferred.
 */
export function planSetupFromFrostLookEnv(
  restore: RestoredPkcs11PointerCapture,
  env: { readonly [key: string]: string | undefined },
  read: BaoElfRead,
  fx: HardwareProbeEffects | null,
  os: OsFamily,
): FirstBootBaoElfFromEnv {
  return planSetupFromNamedBaoElfEnv(restore, env, read, namedProbeFromFrostLook(os, fx));
}

/**
 * Argv sibling. Unseal request stays named from env.
 * Does not add the request to ESP conf.
 */
export function planSetupFromFrostLookArgv(
  restore: RestoredPkcs11PointerCapture,
  argv: readonly string[],
  env: { readonly [key: string]: string | undefined },
  read: BaoElfRead,
  fx: HardwareProbeEffects | null,
  os: OsFamily,
): FirstBootBaoElfFromEnv {
  return planSetupFromNamedBaoElfArgv(restore, argv, env, read, namedProbeFromFrostLook(os, fx));
}

/**
 * Conf sibling. Unseal request stays named from env.
 * Does not add the request to the conf body.
 */
export function planSetupFromFrostLookConf(
  restore: RestoredPkcs11PointerCapture,
  conf: string,
  env: { readonly [key: string]: string | undefined },
  read: BaoElfRead,
  fx: HardwareProbeEffects | null,
  os: OsFamily,
): FirstBootBaoElfFromEnv {
  return planSetupFromNamedBaoElfConf(restore, conf, env, read, namedProbeFromFrostLook(os, fx));
}
