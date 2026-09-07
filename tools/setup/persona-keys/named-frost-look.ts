/**
 * tools/setup/persona-keys/named-frost-look.ts
 *
 * Named frost-look parse. No CLI. No `realProbeEffects`.
 * Overlay and ISO bun may import this file; they must not
 * import `named-frost-look-env.ts`. Cluster does not import
 * this file. Missing effects is unmeasured, not a live
 * look. Missing OS is `missing-os`, not `nixos`, except
 * optional ISO bun consume: missing both keys is unmeasured
 * (`look` null). `/dev/tpmrm0` is not `real` and not an OS.
 * Does not write ESP. Does not import zflash conf-write.
 * Does not import the look mapper. Does not
 * change ISO bun `probe: null`.
 */

import type { OsFamily } from "../../../src/Core.TypeScript/cluster/host-seal-profile.ts";
import type { HardwareProbeEffects } from "./frost-hardware-probe.ts";

export const FROST_LOOK_OS_KEY = "ZETA_FROST_LOOK_OS";
export const FROST_LOOK_EFFECTS_KEY = "ZETA_FROST_LOOK_EFFECTS";
export const FROST_LOOK_OS_FLAG = "--os";
export const FROST_LOOK_EFFECTS_FLAG = "--effects";
export const FROST_LOOK_CONF_FLAG = "--from-conf";

export type NamedFrostLookEffects = "null" | "real";

export type FrostLookEnvError =
  | "missing-os"
  | "empty-os"
  | "unknown-os"
  | "empty-effects"
  | "unknown-effects"
  | "unsafe-conf-value"
  | "mixed-source";

export type FrostLookEnvParse =
  | {
      readonly ok: true;
      readonly os: OsFamily;
      readonly effects: NamedFrostLookEffects | null;
    }
  | { readonly ok: false; readonly reason: FrostLookEnvError };

export type NamedFrostLook = {
  readonly os: OsFamily;
  readonly effects: NamedFrostLookEffects | null;
};

export type OptionalFrostLookEnvParse =
  | { readonly ok: true; readonly look: NamedFrostLook | null }
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

/**
 * ISO bun consume. Missing both keys is unmeasured, not
 * `missing-os`. Overlay NamedEnv still requires OS. Named
 * `"real"` is reported; it does not fill `probe`.
 */
export function consumeOptionalFrostLookFromEnv(env: {
  readonly [key: string]: string | undefined;
}): OptionalFrostLookEnvParse {
  if (env[FROST_LOOK_OS_KEY] === undefined && env[FROST_LOOK_EFFECTS_KEY] === undefined) {
    return { ok: true, look: null };
  }
  const parsed = consumeFrostLookFromEnv(env);
  if (!parsed.ok) return parsed;
  return { ok: true, look: { os: parsed.os, effects: parsed.effects } };
}

/**
 * Same unquote as firstboot conf. Local copy so parse does
 * not import zflash conf-write.
 */
function unquoteFrostLookConfValue(raw: string): string | null {
  if (raw.startsWith("'")) {
    if (raw.length < 2 || !raw.endsWith("'")) return null;
    const inner = raw.slice(1, -1);
    if (inner.includes("'")) return null;
    return inner;
  }
  if (raw.includes("'") || raw.includes('"') || raw.includes("`")) return null;
  return raw;
}

/**
 * Parse `ZETA_FROST_LOOK_OS` / `ZETA_FROST_LOOK_EFFECTS`
 * from a conf body. Missing effects is unmeasured. Missing
 * OS is `missing-os`, not `nixos`. `/dev/tpmrm0` is unknown.
 * HOST / ZETA_ROLE / bao keys are ignored. Failed unquote
 * is `unsafe-conf-value`, not a silent unmeasure. Does not
 * write ESP.
 */
export function consumeFrostLookFromConf(body: string): FrostLookEnvParse {
  let os: string | undefined;
  let effects: string | undefined;
  for (const rawLine of body.split("\n")) {
    const line = rawLine.replace(/\r$/u, "").trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    if (line.startsWith(`${FROST_LOOK_OS_KEY}=`)) {
      const parsed = unquoteFrostLookConfValue(line.slice(FROST_LOOK_OS_KEY.length + 1));
      if (parsed === null) return { ok: false, reason: "unsafe-conf-value" };
      os = parsed;
      continue;
    }
    if (line.startsWith(`${FROST_LOOK_EFFECTS_KEY}=`)) {
      const parsed = unquoteFrostLookConfValue(line.slice(FROST_LOOK_EFFECTS_KEY.length + 1));
      if (parsed === null) return { ok: false, reason: "unsafe-conf-value" };
      effects = parsed;
    }
  }
  return consumeFrostLookFromEnv({
    ...(os === undefined ? {} : { [FROST_LOOK_OS_KEY]: os }),
    ...(effects === undefined ? {} : { [FROST_LOOK_EFFECTS_KEY]: effects }),
  });
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

export function argvHasFrostLookFlag(argv: readonly string[]): boolean {
  for (const arg of argv) {
    if (arg === FROST_LOOK_OS_FLAG || arg.startsWith(`${FROST_LOOK_OS_FLAG}=`)) return true;
    if (arg === FROST_LOOK_EFFECTS_FLAG || arg.startsWith(`${FROST_LOOK_EFFECTS_FLAG}=`)) {
      return true;
    }
  }
  return false;
}

function takeFromConfBody(argv: readonly string[]): { readonly present: boolean; readonly body: string } {
  let present = false;
  let body = "";
  for (let i = 0; i < argv.length; i++) {
    const confFlag = takeFlagValue(argv, i, FROST_LOOK_CONF_FLAG);
    if (confFlag.value !== undefined) {
      present = true;
      body = confFlag.value;
      i = confFlag.next;
    }
  }
  return { present, body };
}

export function argvHasFromConfFlag(argv: readonly string[]): boolean {
  return takeFromConfBody(argv).present;
}

/**
 * `--from-conf` is a conf body, not `--os` / `--effects`.
 * Mixing those sources refuses. Does not read env.
 */
export function consumeFrostLookFromCliArgv(argv: readonly string[]): FrostLookEnvParse {
  const conf = takeFromConfBody(argv);
  if (conf.present && argvHasFrostLookFlag(argv)) return { ok: false, reason: "mixed-source" };
  if (conf.present) return consumeFrostLookFromConf(conf.body);
  return consumeFrostLookFromArgv(argv);
}

/**
 * Named `"real"` uses the injected effects. Missing /
 * `"null"` does not look. Does not default to
 * `realProbeEffects`.
 */
export function frostLookEffectsFromNamed(
  named: NamedFrostLookEffects | null,
  real: HardwareProbeEffects,
): HardwareProbeEffects | null {
  return named === "real" ? real : null;
}
