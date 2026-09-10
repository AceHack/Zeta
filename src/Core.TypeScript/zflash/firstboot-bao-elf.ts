/**
 * src/Core.TypeScript/zflash/firstboot-bao-elf.ts
 *
 * Pure first-boot bao carrier + role-conf join + named-ask
 * argv parse. No filesystem. `lib.ts` writes the joined
 * conf onto the ESP. `file-backed.ts` parses `--bao-load-site`
 * and `--bao-path` here so it does not import installer `fs`.
 * `prepare-boot-image.ts` uses the same parse. Conf/env consume
 * also lives here so firstboot-bao-env.ts can read sourced
 * names without installer `fs`. Capture / overlay still live
 * in bao-elf-capture.ts (that module may read). Epoch is named
 * (`installer-iso` vs `installed-host`): the live ISO's
 * `/run/current-system/sw/bin/bao` is not option D. Env consume
 * with a named epoch applies that filter so bun JSON ask is
 * not option D on the ISO. `/mnt` existing does not pick the
 * epoch. Does not expand `ZetaFirstbootRole`. Bash export /
 * sed-parse live in `zeta-first-boot.sh` and `zeta-install.sh`;
 * this module stays pure and does not invoke bun.
 *
 * Cite: firstboot-role.ts, bao-load-site.ts,
 * docs/research/2026-08-21-hands-off-metal-*.md §1.4.
 */

import { baoElfOpenedPathIsBinary, type BaoLoadSite } from "../cluster/bao-load-site.ts";
import { USB_PKCS11_MODULE_POINTER } from "../cluster/pkcs11-hostpath-overlay.ts";
import {
  planFirstbootConfFileContent,
  SHELL_SAFE_CONF_VALUE_REGEX,
  type FirstbootConfFileContentResult,
  type ZetaFirstbootRole,
} from "./firstboot-role.ts";

/**
 * Named NixOS host `bao` path (option D). First-boot may pass
 * this. Existence of this path, of a `.so`, or of `/dev/tpmrm0`
 * does not pick the site.
 */
export const NIXOS_HOST_BAO = "/run/current-system/sw/bin/bao";

/**
 * First-boot names site and path together. Non-bao paths
 * (`/dev/tpmrm0`, `.so`, restore pointer) are not an ask.
 */
export interface NamedBaoElfAsk {
  readonly site: BaoLoadSite;
  readonly openedPath: string;
}

export function namedBaoElfAsk(
  site: BaoLoadSite,
  openedPath: string,
  restorePointer: string = USB_PKCS11_MODULE_POINTER,
): NamedBaoElfAsk | null {
  if (!baoElfOpenedPathIsBinary(openedPath, restorePointer)) return null;
  return { site, openedPath };
}

/** Option D contract path. Caller still names the site by invoking this. */
export function nixosHostBaoAsk(): NamedBaoElfAsk {
  return { site: "on-host", openedPath: NIXOS_HOST_BAO };
}

/**
 * When the overlay consume runs. Named, not inferred.
 * `zeta-install.sh` Step 6.95a is `installer-iso` (`ZETA_HOME`
 * is `/mnt/home/zeta`). First boot of the installed system is
 * `installed-host`. `/mnt` existing, `/dev/tpmrm0`, and a `.so`
 * do not pick this.
 */
export type BaoElfEpoch = "installer-iso" | "installed-host";

/**
 * Option D is the installed host's current-system bao. The live
 * ISO uses the same path string for a different binary. Exact
 * `NIXOS_HOST_BAO` match only — no wildcard under
 * `/run/current-system`. Does not fill a `/mnt/...` path.
 */
export function namedBaoElfAskAtEpoch(
  site: BaoLoadSite,
  openedPath: string,
  epoch: BaoElfEpoch,
  restorePointer: string = USB_PKCS11_MODULE_POINTER,
): NamedBaoElfAsk | null {
  if (epoch === "installer-iso" && openedPath === NIXOS_HOST_BAO) return null;
  return namedBaoElfAsk(site, openedPath, restorePointer);
}

/**
 * Named epoch from process env. Missing is unmeasured, not
 * `installed-host`. `/mnt` and `tpmrm0` are unknown, not
 * `installer-iso`.
 */
export function parseBaoElfEpoch(
  value: string | undefined,
):
  | { readonly ok: true; readonly epoch: BaoElfEpoch | null }
  | { readonly ok: false; readonly reason: NamedBaoElfArgError } {
  if (value === undefined) return { ok: true, epoch: null };
  if (value.length === 0) return { ok: false, reason: "empty-epoch" };
  if (!SHELL_SAFE_CONF_VALUE_REGEX.test(value)) return { ok: false, reason: "unsafe-conf-value" };
  if (value === "installer-iso" || value === "installed-host") return { ok: true, epoch: value };
  return { ok: false, reason: "unknown-epoch" };
}

export type NamedBaoElfArgError =
  | "site-without-path"
  | "path-without-site"
  | "unknown-site"
  | "empty-site"
  | "empty-path"
  | "unsafe-conf-value"
  | "unknown-epoch"
  | "empty-epoch";

export type NamedBaoElfArgResult =
  | { readonly ok: true; readonly ask: NamedBaoElfAsk | null }
  | { readonly ok: false; readonly reason: NamedBaoElfArgError };

function isBaoLoadSite(value: string): value is BaoLoadSite {
  return value === "on-host" || value === "in-chart-image";
}

function takeFlagValue(
  argv: readonly string[],
  i: number,
  prefix: string,
): { value: string | undefined; next: number } {
  const arg = argv[i]!;
  if (arg === prefix) {
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) return { value: "", next: i };
    return { value: next, next: i + 1 };
  }
  if (arg.startsWith(`${prefix}=`)) return { value: arg.slice(prefix.length + 1), next: i };
  return { value: undefined, next: i };
}

/**
 * Live-installer invoke: `--bao-load-site` and `--bao-path` together.
 * Neither flag is unmeasured, not `on-host`. One without the other
 * refuses — do not fill `NIXOS_HOST_BAO`, do not infer site from a
 * path or from `/dev/tpmrm0`. Other argv is ignored.
 */
export function parseNamedBaoElfArgs(argv: readonly string[]): NamedBaoElfArgResult {
  let site: string | undefined;
  let openedPath: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const siteFlag = takeFlagValue(argv, i, "--bao-load-site");
    if (siteFlag.value !== undefined) {
      site = siteFlag.value;
      i = siteFlag.next;
      continue;
    }
    const pathFlag = takeFlagValue(argv, i, "--bao-path");
    if (pathFlag.value !== undefined) {
      openedPath = pathFlag.value;
      i = pathFlag.next;
    }
  }
  const hasSite = site !== undefined;
  const hasPath = openedPath !== undefined;
  if (!hasSite && !hasPath) return { ok: true, ask: null };
  if (hasSite && !hasPath) return { ok: false, reason: "site-without-path" };
  if (!hasSite && hasPath) return { ok: false, reason: "path-without-site" };
  const namedSite = site;
  const namedPath = openedPath;
  if (namedSite === undefined || namedPath === undefined) return { ok: true, ask: null };
  if (namedSite.length === 0) return { ok: false, reason: "empty-site" };
  if (namedPath.length === 0) return { ok: false, reason: "empty-path" };
  if (!isBaoLoadSite(namedSite)) return { ok: false, reason: "unknown-site" };
  return { ok: true, ask: namedBaoElfAsk(namedSite, namedPath) };
}

/** Operator-facing refusal for a named-bao argv parse. Shared by file-backed and prepare-boot-image. */
export function namedBaoElfArgErrorMessage(reason: NamedBaoElfArgError): string {
  switch (reason) {
    case "site-without-path":
      return "--bao-load-site requires --bao-path";
    case "path-without-site":
      return "--bao-path requires --bao-load-site";
    case "unknown-site":
      return "--bao-load-site must be on-host or in-chart-image";
    case "empty-site":
      return "--bao-load-site requires a value";
    case "empty-path":
      return "--bao-path requires a value";
    case "unsafe-conf-value":
      return "--bao-load-site / --bao-path contains a value firstboot conf cannot carry";
    case "unknown-epoch":
      return "ZETA_BAO_ELF_EPOCH must be installer-iso or installed-host";
    case "empty-epoch":
      return "ZETA_BAO_ELF_EPOCH requires a value";
  }
}

/**
 * ESP / firstboot conf keys for a named bao. Both lines or
 * neither — the same all-or-none rule as cluster-segment
 * addressing. `/dev/tpmrm0` is shell-safe, so the bao-path
 * filter runs before the allowlist. Does not expand
 * `ZetaFirstbootRole`. Does not edit `zeta-first-boot.sh`.
 */
export const FIRSTBOOT_BAO_LOAD_SITE_KEY = "ZETA_BAO_LOAD_SITE";
export const FIRSTBOOT_BAO_PATH_KEY = "ZETA_BAO_PATH";
export const FIRSTBOOT_BAO_ELF_EPOCH_KEY = "ZETA_BAO_ELF_EPOCH";

export type FirstbootBaoElfCarrierRefuse = "unmeasured" | "not-bao-path" | "unsafe-conf-value";

export type FirstbootBaoElfCarrier =
  | {
      readonly ok: true;
      readonly confLines: readonly [string, string];
      readonly argv: readonly [string, string];
    }
  | { readonly ok: false; readonly reason: FirstbootBaoElfCarrierRefuse };

function shellQuoteConfValue(value: string): string {
  return `'${value}'`;
}

/**
 * Turn a named bao ask into both conf lines and both argv
 * tokens, or neither. Null ask is unmeasured. tpmrm0 / `.so`
 * / restore pointer are not a bao path even when they match
 * the bash allowlist. A path with `;` `$` or whitespace
 * refuses both names.
 */
export function composeFirstbootBaoElfCarrier(
  named: NamedBaoElfAsk | null,
  restorePointer: string = USB_PKCS11_MODULE_POINTER,
): FirstbootBaoElfCarrier {
  if (named === null) return { ok: false, reason: "unmeasured" };
  const ask = namedBaoElfAsk(named.site, named.openedPath, restorePointer);
  if (ask === null) return { ok: false, reason: "not-bao-path" };
  if (!SHELL_SAFE_CONF_VALUE_REGEX.test(ask.site) || !SHELL_SAFE_CONF_VALUE_REGEX.test(ask.openedPath)) {
    return { ok: false, reason: "unsafe-conf-value" };
  }
  return {
    ok: true,
    confLines: [
      `${FIRSTBOOT_BAO_LOAD_SITE_KEY}=${shellQuoteConfValue(ask.site)}`,
      `${FIRSTBOOT_BAO_PATH_KEY}=${shellQuoteConfValue(ask.openedPath)}`,
    ],
    argv: [`--bao-load-site=${ask.site}`, `--bao-path=${ask.openedPath}`],
  };
}

/** Argv form for a later `zeta-first-boot.sh` / bun invoke. Empty when neither name may travel. */
export function firstbootBaoElfArgvFromAsk(
  named: NamedBaoElfAsk | null,
  restorePointer: string = USB_PKCS11_MODULE_POINTER,
): readonly string[] {
  const carrier = composeFirstbootBaoElfCarrier(named, restorePointer);
  if (!carrier.ok) return [];
  return carrier.argv;
}

/**
 * Append both bao names to an existing firstboot conf, or
 * leave the conf unchanged. Never one line. Does not rewrite
 * HOST / ZETA_ROLE.
 */
export function appendFirstbootBaoElfConf(
  conf: string,
  named: NamedBaoElfAsk | null,
  restorePointer: string = USB_PKCS11_MODULE_POINTER,
): string {
  const carrier = composeFirstbootBaoElfCarrier(named, restorePointer);
  if (!carrier.ok) return conf;
  const prefix = conf.length === 0 || conf.endsWith("\n") ? conf : `${conf}\n`;
  return `${prefix}${carrier.confLines[0]}\n${carrier.confLines[1]}\n`;
}

/**
 * Join a role conf with the bao carrier. Null / tpmrm0 / `.so`
 * leave the role conf byte-identical. Option D appends both
 * names. A refused role is unchanged — bao cannot paper over
 * it. Does not add bao fields to `ZetaFirstbootConfig`. Does
 * not edit `zeta-first-boot.sh`. `lib.ts` may import this
 * module; it must not import installer `fs`.
 */
export function planFirstbootConfWithNamedBaoElf(
  role: ZetaFirstbootRole,
  named: NamedBaoElfAsk | null,
  restorePointer: string = USB_PKCS11_MODULE_POINTER,
): FirstbootConfFileContentResult {
  const planned = planFirstbootConfFileContent(role);
  if (!planned.ok) return planned;
  return {
    ok: true,
    value: appendFirstbootBaoElfConf(planned.value, named, restorePointer),
    config: planned.config,
  };
}

export interface FirstbootBaoElfEnv {
  readonly ZETA_BAO_LOAD_SITE?: string;
  readonly ZETA_BAO_PATH?: string;
}

function unquoteFirstbootConfValue(raw: string): string | null {
  if (raw.startsWith("'")) {
    if (raw.length < 2 || !raw.endsWith("'")) return null;
    const inner = raw.slice(1, -1);
    if (inner.includes("'")) return null;
    return inner;
  }
  if (raw.includes("'") || raw.includes('"') || raw.includes("`")) return null;
  return raw;
}

function envValueOrUnsafe(value: string | undefined): { ok: true; value: string | undefined } | { ok: false } {
  if (value === undefined) return { ok: true, value: undefined };
  if (value.length > 0 && !SHELL_SAFE_CONF_VALUE_REGEX.test(value)) return { ok: false };
  return { ok: true, value };
}

/**
 * Env after a sourced firstboot conf. Values are unquoted.
 * Both keys or neither — same rule as argv. tpmrm0 is
 * shell-safe and still not an ask.
 */
export function parseFirstbootBaoElfEnv(env: FirstbootBaoElfEnv): NamedBaoElfArgResult {
  const siteGot = envValueOrUnsafe(env[FIRSTBOOT_BAO_LOAD_SITE_KEY]);
  const pathGot = envValueOrUnsafe(env[FIRSTBOOT_BAO_PATH_KEY]);
  if (!siteGot.ok || !pathGot.ok) return { ok: false, reason: "unsafe-conf-value" };
  const argv: string[] = [];
  if (siteGot.value !== undefined) argv.push(`--bao-load-site=${siteGot.value}`);
  if (pathGot.value !== undefined) argv.push(`--bao-path=${pathGot.value}`);
  return parseNamedBaoElfArgs(argv);
}

/**
 * Process env after bash sources the ESP conf. Missing keys
 * are unmeasured. Does not open files. Does not infer
 * `on-host` from `/dev/tpmrm0`.
 */
export function consumeFirstbootBaoElfProcessEnv(env: {
  readonly [key: string]: string | undefined;
}): NamedBaoElfArgResult {
  return parseFirstbootBaoElfEnv({
    ...(env[FIRSTBOOT_BAO_LOAD_SITE_KEY] === undefined
      ? {}
      : { [FIRSTBOOT_BAO_LOAD_SITE_KEY]: env[FIRSTBOOT_BAO_LOAD_SITE_KEY] }),
    ...(env[FIRSTBOOT_BAO_PATH_KEY] === undefined ? {} : { [FIRSTBOOT_BAO_PATH_KEY]: env[FIRSTBOOT_BAO_PATH_KEY] }),
  });
}

export type FirstbootBaoElfEnvConsume =
  | { readonly ok: true; readonly ask: NamedBaoElfAsk | null; readonly epoch: BaoElfEpoch | null }
  | { readonly ok: false; readonly reason: NamedBaoElfArgError };

/**
 * Site+path plus named epoch. When epoch is named, ISO
 * current-system bao is not an ask (`namedBaoElfAskAtEpoch`).
 * Missing epoch is unmeasured, not `installed-host` — the
 * sourced ask is still reported (overlay join refuses
 * `empty-epoch`). Does not open files. Does not infer epoch
 * from `/mnt` or `/dev/tpmrm0`.
 */
export function consumeFirstbootBaoElfEnvWithEpoch(env: {
  readonly [key: string]: string | undefined;
}): FirstbootBaoElfEnvConsume {
  const parsed = consumeFirstbootBaoElfProcessEnv(env);
  if (!parsed.ok) return parsed;
  const epochGot = parseBaoElfEpoch(env[FIRSTBOOT_BAO_ELF_EPOCH_KEY]);
  if (!epochGot.ok) return epochGot;
  if (epochGot.epoch === null) {
    return { ok: true, ask: parsed.ask, epoch: null };
  }
  const ask =
    parsed.ask === null
      ? null
      : namedBaoElfAskAtEpoch(parsed.ask.site, parsed.ask.openedPath, epochGot.epoch);
  return { ok: true, ask, epoch: epochGot.epoch };
}

/**
 * Parse ESP / ISO firstboot conf content. HOST / ZETA_ROLE
 * are ignored. One bao key without the other refuses. Does
 * not open files. Does not edit `zeta-first-boot.sh`.
 */
export function parseFirstbootBaoElfConf(conf: string): NamedBaoElfArgResult {
  let site: string | undefined;
  let openedPath: string | undefined;
  for (const rawLine of conf.split("\n")) {
    const line = rawLine.replace(/\r$/u, "").trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    if (line.startsWith(`${FIRSTBOOT_BAO_LOAD_SITE_KEY}=`)) {
      const parsed = unquoteFirstbootConfValue(line.slice(FIRSTBOOT_BAO_LOAD_SITE_KEY.length + 1));
      if (parsed === null) return { ok: false, reason: "unsafe-conf-value" };
      site = parsed;
      continue;
    }
    if (line.startsWith(`${FIRSTBOOT_BAO_PATH_KEY}=`)) {
      const parsed = unquoteFirstbootConfValue(line.slice(FIRSTBOOT_BAO_PATH_KEY.length + 1));
      if (parsed === null) return { ok: false, reason: "unsafe-conf-value" };
      openedPath = parsed;
    }
  }
  return parseFirstbootBaoElfEnv({
    ...(site === undefined ? {} : { [FIRSTBOOT_BAO_LOAD_SITE_KEY]: site }),
    ...(openedPath === undefined ? {} : { [FIRSTBOOT_BAO_PATH_KEY]: openedPath }),
  });
}
