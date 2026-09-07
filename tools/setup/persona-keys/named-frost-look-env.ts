#!/usr/bin/env bun
/**
 * tools/setup/persona-keys/named-frost-look-env.ts
 *
 * Print a frost look as JSON from named env, argv, or a
 * conf body. Parse lives in `named-frost-look.ts` so overlay
 * can consume the same keys without importing this CLI.
 * Missing effects is unmeasured (`probe` null), not a live
 * look. Does not default to `realProbeEffects`. OS family
 * is named, not read from `/etc/os-release`. `/dev/tpmrm0`
 * is not `real` and not an OS. Cluster does not import this
 * file. Does not call overlay join. Does not write ESP.
 * Does not import zflash conf-write. Does not change ISO
 * bun `probe: null`.
 *
 * Usage: bun tools/setup/persona-keys/named-frost-look-env.ts
 * Env: `ZETA_FROST_LOOK_OS`, `ZETA_FROST_LOOK_EFFECTS`
 * Argv: `--os <family> [--effects null|real]`
 * Conf: `--from-conf <body>` (same two keys). Do not mix
 * with `--os` / `--effects` or env.
 * Exit 0: JSON `{ ok: true, os, effects, probe }`
 * (effects and probe may be null).
 * Exit 2: JSON `{ ok: false, reason }`.
 */

import type { NamedHardwareProbe, OsFamily } from "../../../src/Core.TypeScript/cluster/host-seal-profile.ts";
import { realProbeEffects, type HardwareProbeEffects } from "./frost-hardware-probe.ts";
import {
  argvHasFromConfFlag,
  argvHasFrostLookFlag,
  consumeFrostLookFromArgv,
  consumeFrostLookFromCliArgv,
  consumeFrostLookFromConf,
  consumeFrostLookFromEnv,
  frostLookEffectsFromNamed,
  type FrostLookEnvParse,
  type NamedFrostLookEffects,
} from "./named-frost-look.ts";
import { namedProbeFromFrostLook } from "./named-probe-from-frost-look.ts";

export {
  FROST_LOOK_CONF_FLAG,
  FROST_LOOK_EFFECTS_FLAG,
  FROST_LOOK_EFFECTS_KEY,
  FROST_LOOK_OS_FLAG,
  FROST_LOOK_OS_KEY,
  argvHasFromConfFlag,
  argvHasFrostLookFlag,
  consumeFrostLookFromArgv,
  consumeFrostLookFromCliArgv,
  consumeFrostLookFromConf,
  consumeFrostLookFromEnv,
  consumeOptionalFrostLookFromArgv,
  consumeOptionalFrostLookFromBunJson,
  consumeOptionalFrostLookFromConf,
  consumeOptionalFrostLookFromEnv,
  frostLookEffectsFromNamed,
  parseFrostLookEffects,
  parseFrostLookOs,
  type FrostLookEnvError,
  type FrostLookEnvParse,
  type NamedFrostLook,
  type NamedFrostLookEffects,
  type OptionalFrostLookEnvParse,
} from "./named-frost-look.ts";

/**
 * Named `"real"` uses the injected effects. Missing /
 * `"null"` does not look. Does not default to
 * `realProbeEffects`. Lives here so parse does not load
 * `named-probe-from-frost-look.ts`.
 */
export function frostLookProbeFromNamed(
  os: OsFamily,
  named: NamedFrostLookEffects | null,
  real: HardwareProbeEffects,
): NamedHardwareProbe | null {
  return namedProbeFromFrostLook(os, frostLookEffectsFromNamed(named, real));
}

function writeFrostLookParse(
  parsed: FrostLookEnvParse,
  real: HardwareProbeEffects,
  write: (line: string) => void,
): number {
  if (!parsed.ok) {
    write(`${JSON.stringify(parsed)}\n`);
    return 2;
  }
  const probe = frostLookProbeFromNamed(parsed.os, parsed.effects, real);
  write(`${JSON.stringify({ ok: true, os: parsed.os, effects: parsed.effects, probe })}\n`);
  return 0;
}

export function runFrostLookEnvCli(
  env: { readonly [key: string]: string | undefined },
  real: HardwareProbeEffects,
  write: (line: string) => void = (line) => {
    process.stdout.write(line);
  },
): number {
  return writeFrostLookParse(consumeFrostLookFromEnv(env), real, write);
}

export function runFrostLookArgvCli(
  argv: readonly string[],
  real: HardwareProbeEffects,
  write: (line: string) => void = (line) => {
    process.stdout.write(line);
  },
): number {
  return writeFrostLookParse(consumeFrostLookFromArgv(argv), real, write);
}

export function runFrostLookConfCli(
  body: string,
  real: HardwareProbeEffects,
  write: (line: string) => void = (line) => {
    process.stdout.write(line);
  },
): number {
  return writeFrostLookParse(consumeFrostLookFromConf(body), real, write);
}

export function runFrostLookCliArgv(
  argv: readonly string[],
  real: HardwareProbeEffects,
  write: (line: string) => void = (line) => {
    process.stdout.write(line);
  },
): number {
  return writeFrostLookParse(consumeFrostLookFromCliArgv(argv), real, write);
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argvHasFromConfFlag(argv) || argvHasFrostLookFlag(argv)) {
    const parsed = consumeFrostLookFromCliArgv(argv);
    if (!parsed.ok) {
      process.stdout.write(`${JSON.stringify(parsed)}\n`);
      process.exit(2);
    }
    if (parsed.effects !== "real") {
      const probe = namedProbeFromFrostLook(parsed.os, null);
      process.stdout.write(
        `${JSON.stringify({ ok: true, os: parsed.os, effects: parsed.effects, probe })}\n`,
      );
      process.exit(0);
    }
    process.exit(runFrostLookCliArgv(argv, realProbeEffects()));
  }
  const parsed = consumeFrostLookFromEnv(process.env);
  if (!parsed.ok) {
    process.stdout.write(`${JSON.stringify(parsed)}\n`);
    process.exit(2);
  }
  if (parsed.effects !== "real") {
    const probe = namedProbeFromFrostLook(parsed.os, null);
    process.stdout.write(
      `${JSON.stringify({ ok: true, os: parsed.os, effects: parsed.effects, probe })}\n`,
    );
    process.exit(0);
  }
  process.exit(runFrostLookEnvCli(process.env, realProbeEffects()));
}

if (import.meta.main) {
  main();
}
