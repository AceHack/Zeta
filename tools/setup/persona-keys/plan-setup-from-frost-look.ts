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
 * Named-key joins parse `ZETA_FROST_LOOK_OS` /
 * `ZETA_FROST_LOOK_EFFECTS` (env / argv / conf body).
 * Does not import the frost-look CLI. Does not
 * change ISO bun `probe: null`.
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
import {
  consumeFrostLookFromArgv,
  consumeFrostLookFromConf,
  consumeFrostLookFromEnv,
  frostLookEffectsFromNamed,
  type FrostLookEnvError,
  type FrostLookEnvParse,
} from "./named-frost-look.ts";
import { namedProbeFromFrostLook } from "./named-probe-from-frost-look.ts";

export type FrostLookNamedJoin =
  | FirstBootBaoElfFromEnv
  | { readonly ok: false; readonly reason: FrostLookEnvError };

function namedLookJoin(
  parsed: FrostLookEnvParse,
  real: HardwareProbeEffects,
  then: (fx: HardwareProbeEffects | null, os: OsFamily) => FirstBootBaoElfFromEnv,
): FrostLookNamedJoin {
  if (!parsed.ok) return parsed;
  return then(frostLookEffectsFromNamed(parsed.effects, real), parsed.os);
}

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

/**
 * Env join from named frost-look keys in the same env.
 * Missing OS refuses. Missing effects is unmeasured.
 * Named `"real"` uses the injected effects. Does not
 * default to `realProbeEffects`.
 */
export function planSetupFromFrostLookNamedEnv(
  restore: RestoredPkcs11PointerCapture,
  env: { readonly [key: string]: string | undefined },
  read: BaoElfRead,
  real: HardwareProbeEffects,
): FrostLookNamedJoin {
  return namedLookJoin(consumeFrostLookFromEnv(env), real, (fx, os) =>
    planSetupFromFrostLookEnv(restore, env, read, fx, os),
  );
}

/**
 * Argv sibling. `--os` / `--effects` ride with bao flags.
 * Unseal request stays named from env.
 */
export function planSetupFromFrostLookNamedArgv(
  restore: RestoredPkcs11PointerCapture,
  argv: readonly string[],
  env: { readonly [key: string]: string | undefined },
  read: BaoElfRead,
  real: HardwareProbeEffects,
): FrostLookNamedJoin {
  return namedLookJoin(consumeFrostLookFromArgv(argv), real, (fx, os) =>
    planSetupFromFrostLookArgv(restore, argv, env, read, fx, os),
  );
}

/**
 * Conf sibling. Frost-look keys in the conf body. Unseal
 * request stays named from env. Does not write ESP.
 */
export function planSetupFromFrostLookNamedConf(
  restore: RestoredPkcs11PointerCapture,
  conf: string,
  env: { readonly [key: string]: string | undefined },
  read: BaoElfRead,
  real: HardwareProbeEffects,
): FrostLookNamedJoin {
  return namedLookJoin(consumeFrostLookFromConf(conf), real, (fx, os) =>
    planSetupFromFrostLookConf(restore, conf, env, read, fx, os),
  );
}
