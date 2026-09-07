#!/usr/bin/env bun
/**
 * tools/setup/persona-keys/named-frost-look-env.ts
 *
 * Print a frost look as JSON from named env or argv. Missing
 * effects is unmeasured (`probe` null), not a live look. Does
 * not default to `realProbeEffects`. OS family is named, not
 * read from `/etc/os-release`. `/dev/tpmrm0` is not `real`
 * and not an OS. Cluster does not import this file.
 * Does not call overlay join. Does not change ISO bun
 * `probe: null`.
 *
 * Usage: bun tools/setup/persona-keys/named-frost-look-env.ts
 * Env: `ZETA_FROST_LOOK_OS`, `ZETA_FROST_LOOK_EFFECTS`
 * Argv: `--os <family> [--effects null|real]`
 * Exit 0: JSON `{ ok: true, os, effects, probe }`
 * (effects and probe may be null).
 * Exit 2: JSON `{ ok: false, reason }`.
 */

import type { NamedHardwareProbe, OsFamily } from "../../../src/Core.TypeScript/cluster/host-seal-profile.ts";
import { realProbeEffects, type HardwareProbeEffects } from "./frost-hardware-probe.ts";
import { namedProbeFromFrostLook } from "./named-probe-from-frost-look.ts";

export const FROST_LOOK_OS_KEY = "ZETA_FROST_LOOK_OS";
export const FROST_LOOK_EFFECTS_KEY = "ZETA_FROST_LOOK_EFFECTS";
export const FROST_LOOK_OS_FLAG = "--os";
export const FROST_LOOK_EFFECTS_FLAG = "--effects";

export type NamedFrostLookEffects = "null" | "real";

export type FrostLookEnvError =
  | "missing-os"
  | "empty-os"
  | "unknown-os"
  | "empty-effects"
  | "unknown-effects";

export type FrostLookEnvParse =
  | {
      readonly ok: true;
      readonly os: OsFamily;
      readonly effects: NamedFrostLookEffects | null;
    }
  | { readonly ok: false; readonly reason: FrostLookEnvError };

const OS_FAMILIES: readonly OsFamily[] = ["nixos", "darwin", "linux-other", "unknown"];

function isOsFamily(value: string): value is OsFamily {
  return (OS_FAMILIES as readonly string[]).includes(value);
}

function isNamedEffects(value: string): value is NamedFrostLookEffects {
  return value === "null" || value === "real";
}

/**
 * Missing effects is unmeasured. `/dev/tpmrm0` is unknown.
 */
export function parseFrostLookEffects(
  value: string | undefined,
):
  | { readonly ok: true; readonly effects: NamedFrostLookEffects | null }
  | { readonly ok: false; readonly reason: "empty-effects" | "unknown-effects" } {
  if (value === undefined) return { ok: true, effects: null };
  if (value.length === 0) return { ok: false, reason: "empty-effects" };
  if (isNamedEffects(value)) return { ok: true, effects: value };
  return { ok: false, reason: "unknown-effects" };
}

/**
 * OS must be named. Does not read `/etc/os-release`.
 * `/dev/tpmrm0` is unknown.
 */
export function parseFrostLookOs(
  value: string | undefined,
):
  | { readonly ok: true; readonly os: OsFamily }
  | { readonly ok: false; readonly reason: "missing-os" | "empty-os" | "unknown-os" } {
  if (value === undefined) return { ok: false, reason: "missing-os" };
  if (value.length === 0) return { ok: false, reason: "empty-os" };
  if (isOsFamily(value)) return { ok: true, os: value };
  return { ok: false, reason: "unknown-os" };
}

export function consumeFrostLookFromEnv(env: {
  readonly [key: string]: string | undefined;
}): FrostLookEnvParse {
  const os = parseFrostLookOs(env[FROST_LOOK_OS_KEY]);
  if (!os.ok) return os;
  const effects = parseFrostLookEffects(env[FROST_LOOK_EFFECTS_KEY]);
  if (!effects.ok) return effects;
  return { ok: true, os: os.os, effects: effects.effects };
}

function takeFlagValue(
  argv: readonly string[],
  i: number,
  prefix: string,
): { readonly value: string | undefined; readonly next: number } {
  const arg = argv[i];
  if (arg === undefined) return { value: undefined, next: i };
  if (arg === prefix) {
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) return { value: "", next: i };
    return { value: next, next: i + 1 };
  }
  if (arg.startsWith(`${prefix}=`)) return { value: arg.slice(prefix.length + 1), next: i };
  return { value: undefined, next: i };
}

/**
 * `--os` is required. Missing `--effects` is unmeasured.
 * Does not read env. `/dev/tpmrm0` is unknown.
 */
export function consumeFrostLookFromArgv(argv: readonly string[]): FrostLookEnvParse {
  let os: string | undefined;
  let effects: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const osFlag = takeFlagValue(argv, i, FROST_LOOK_OS_FLAG);
    if (osFlag.value !== undefined) {
      os = osFlag.value;
      i = osFlag.next;
      continue;
    }
    const effectsFlag = takeFlagValue(argv, i, FROST_LOOK_EFFECTS_FLAG);
    if (effectsFlag.value !== undefined) {
      effects = effectsFlag.value;
      i = effectsFlag.next;
    }
  }
  const namedOs = parseFrostLookOs(os);
  if (!namedOs.ok) return namedOs;
  const namedEffects = parseFrostLookEffects(effects);
  if (!namedEffects.ok) return namedEffects;
  return { ok: true, os: namedOs.os, effects: namedEffects.effects };
}

/**
 * Named `"real"` uses the injected effects. Missing / `"null"`
 * does not look. Does not default to `realProbeEffects`.
 */
export function frostLookProbeFromNamed(
  os: OsFamily,
  named: NamedFrostLookEffects | null,
  real: HardwareProbeEffects,
): NamedHardwareProbe | null {
  if (named !== "real") return namedProbeFromFrostLook(os, null);
  return namedProbeFromFrostLook(os, real);
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

function argvHasFrostLookFlag(argv: readonly string[]): boolean {
  for (const arg of argv) {
    if (arg === FROST_LOOK_OS_FLAG || arg.startsWith(`${FROST_LOOK_OS_FLAG}=`)) return true;
    if (arg === FROST_LOOK_EFFECTS_FLAG || arg.startsWith(`${FROST_LOOK_EFFECTS_FLAG}=`)) {
      return true;
    }
  }
  return false;
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argvHasFrostLookFlag(argv)) {
    const parsed = consumeFrostLookFromArgv(argv);
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
    process.exit(runFrostLookArgvCli(argv, realProbeEffects()));
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
