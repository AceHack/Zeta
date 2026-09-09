#!/usr/bin/env bun
/**
 * tools/setup/persona-keys/seal-path-detect.ts
 *
 * Join the LIVE hardware look to the unseal DECISION, in one
 * executable. This is the rung that was missing, not the
 * probe and not the decision — both of those were already
 * built and both are correct.
 *
 * ============================================================================
 * WHAT WAS ACTUALLY MISSING (081M22M7G8M087G0R003R1C8Z4)
 * ============================================================================
 *
 * Measured 2026-09-09, on a host with a YubiHSM 2 attached:
 *
 *  - `named-frost-look-env.ts --os darwin --effects real` returns a real
 *    probe: `yubiHsm2: "attached"`, `smartCardReaderAttached: true`,
 *    `pkcs11ModuleOnDisk: true`. The live look WORKS.
 *  - `integrateAtSetup({requested:"auto"}, hostCaptureFromNamedProbe(probe))`
 *    returns `{ok:true, path:"pkcs11-yubihsm", mechanism:"aes-gcm",
 *    autoUnseal:true}`. The decision WORKS.
 *  - **Nothing executable ran both.** `bao-elf-capture.ts` holds the join
 *    (`planSetupFromNamedBaoElfEnv`) and has no `import.meta.main`.
 *    `firstboot-bao-env.ts` is the one the installer DOES run, and it emits
 *    `probe: null` unconditionally — correctly, because zflash may not spawn.
 *  - `zeta-install.sh` exports neither `ZETA_UNSEAL_REQUEST` nor the frost
 *    look keys, and says so in a comment at each site.
 *
 * So on metal the seal path was never chosen from hardware — not because a
 * measurement was wrong, but because the two halves were never introduced.
 * Three rungs built, the fourth deferred at every step. This file is the
 * fourth, and it is deliberately the ONLY place the two halves meet.
 *
 * ============================================================================
 * WHY THE LAYERING PUTS IT HERE AND NOT IN cluster/ OR zflash/
 * ============================================================================
 *
 * `cluster/` does not import `frost-hardware-probe` (fs/spawn) and does not
 * open `/dev/tpmrm0`; `zflash/` does not spawn either. Both consume a NAMED
 * probe snapshot injected from outside. That separation is what keeps the
 * decision layer pure and DST-replayable, and it is not a defect to route
 * around. `tools/setup/persona-keys/` is the layer that is allowed to look at
 * the host, so the composition belongs here and travels DOWN into the pure
 * layers, never up.
 *
 * ============================================================================
 * THE REFUSALS THIS CLI KEEPS (each is a test)
 * ============================================================================
 *
 * A joiner is exactly where "unmeasured" gets quietly rounded to a value, so
 * every distinction the two halves keep is kept here too:
 *
 *  - **`--effects null` is unmeasured, not absent.** Probe stays `null`, the
 *    decision is `probe-did-not-run`. A look that did not happen never
 *    produces a path.
 *  - **A missing request is unmeasured, not `auto`.** `decision: null`. This
 *    CLI does not decide that you wanted the strongest path.
 *  - **A driver on disk is not a device.** `pkcs11ModuleOnDisk` alone yields
 *    `driver-is-not-a-device`; that refusal lives in `integrateAtSetup` and
 *    this CLI does not soften it.
 *  - **`smartcardHsm` stays `not-asked`.** The CardContact probe is not run by
 *    the frost look, and `not-asked` is never mapped to `absent` to make a
 *    capture look complete.
 *  - **Emulators are declared, never inferred.** `ci-softhsm` / `ci-swtpm` as
 *    a REQUEST refuse with `emulator-not-declared` — a CI cell asks for them
 *    through the install matrix, not by being detected.
 *  - **Exit code carries no verdict about the hardware.** 0 means the join
 *    ran and the JSON is the answer; 2 means the input could not be parsed.
 *    A refused decision exits 0, because "no path here" is a finding.
 *
 * Usage: bun tools/setup/persona-keys/seal-path-detect.ts
 * Env:   ZETA_FROST_LOOK_OS, ZETA_FROST_LOOK_EFFECTS, ZETA_UNSEAL_REQUEST
 * Argv:  --os <family> [--effects null|real] [--request <PathRequest>]
 * Exit 0: {"ok":true, os, effects, requested, probe, decision}
 * Exit 2: {"ok":false, reason}
 */

import { realProbeEffects, type HardwareProbeEffects } from "./frost-hardware-probe.ts";
import {
  argvHasFrostLookFlag,
  consumeFrostLookFromArgv,
  consumeFrostLookFromEnv,
  type FrostLookEnvParse,
} from "./named-frost-look.ts";
import { frostLookProbeFromNamed } from "./named-frost-look-env.ts";
import { integrateAtSetupFromEnv } from "../../../src/Core.TypeScript/cluster/unseal-path.ts";

export const UNSEAL_REQUEST_FLAG = "--request";
export const UNSEAL_REQUEST_KEY = "ZETA_UNSEAL_REQUEST";

/**
 * Lift `--request` out of argv into the env shape the pure join already
 * consumes. Absent flag leaves env untouched: missing is unmeasured, and
 * `integrateAtSetupFromEnv` answers `decision: null` for it. An empty value
 * is NOT absent — it reaches the parser, which names it.
 */
export function requestEnvFromArgv(
  argv: readonly string[],
  env: { readonly [key: string]: string | undefined },
): { readonly [key: string]: string | undefined } {
  const at = argv.indexOf(UNSEAL_REQUEST_FLAG);
  if (at < 0) return env;
  const value = argv[at + 1];
  if (value === undefined) return { ...env, [UNSEAL_REQUEST_KEY]: "" };
  return { ...env, [UNSEAL_REQUEST_KEY]: value };
}

export interface SealPathDetectOk {
  readonly ok: true;
  readonly os: string;
  readonly effects: string | null;
  readonly requested: string | null;
  readonly probe: unknown;
  readonly decision: unknown;
}

/**
 * The join itself, over an already-parsed look. Pure apart from the injected
 * `real` effects, which is the only door to the host (manifesto §13).
 */
export function joinLookToDecision(
  parsed: FrostLookEnvParse,
  env: { readonly [key: string]: string | undefined },
  real: HardwareProbeEffects,
): { readonly json: string; readonly code: number } {
  if (!parsed.ok) return { json: JSON.stringify(parsed), code: 2 };
  const probe = frostLookProbeFromNamed(parsed.os, parsed.effects, real);
  const joined = integrateAtSetupFromEnv(env, probe);
  if (!joined.ok) return { json: JSON.stringify(joined), code: 2 };
  const body: SealPathDetectOk = {
    ok: true,
    os: parsed.os,
    effects: parsed.effects,
    requested: env[UNSEAL_REQUEST_KEY] ?? null,
    probe,
    decision: joined.decision,
  };
  return { json: JSON.stringify(body), code: 0 };
}

/**
 * Argv wins over env when `--os` is present, matching the look CLI. Mixing is
 * not silently merged: the look parser owns that refusal.
 */
export function runSealPathDetectCli(
  argv: readonly string[],
  env: { readonly [key: string]: string | undefined },
  real: HardwareProbeEffects,
  write: (line: string) => void = (line) => {
    process.stdout.write(line);
  },
): number {
  const parsed = argvHasFrostLookFlag(argv) ? consumeFrostLookFromArgv(argv) : consumeFrostLookFromEnv(env);
  const joinEnv = argvHasFrostLookFlag(argv) ? requestEnvFromArgv(argv, env) : env;
  const { json, code } = joinLookToDecision(parsed, joinEnv, real);
  write(`${json}\n`);
  return code;
}

function main(): void {
  process.exit(runSealPathDetectCli(process.argv.slice(2), process.env, realProbeEffects()));
}

if (import.meta.main) {
  main();
}
