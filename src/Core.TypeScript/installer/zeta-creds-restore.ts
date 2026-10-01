#!/usr/bin/env bun
// zeta-creds-restore.ts — read encrypted cred-blob from ESP + restore to disk.
// 081KSKBP80008QG0R003AX2A69.2b CLI sibling to zeta-creds-persist.ts.
//
// Composes:
//   - src/Core.TypeScript/installer/zeta-creds-crypto.ts (081KSKBP80008QG0R003AX2A69.1; decrypt)
//   - src/Core.TypeScript/installer/zeta-creds-manifest.ts (081KSKBP80008QG0R003AX2A69.5; cred catalog → paths)
//   - src/Core.TypeScript/installer/zeta-creds-envelope.ts (081KSKBP80008QG0R003AX2A69.2a; wire format + bundle)
//
// Usage:
//   bun src/Core.TypeScript/installer/zeta-creds-restore.ts \
//     --usb-uuid <uuid> \
//     [--usb-iserial <serial>] \
//     [--uefi-keyfile <path>] \
//     --input /esp/zeta-creds.enc \
//     ( --passphrase-file <path> | --passphrase-env <VAR> ) \
//     [--persona <name>] \
//     [--target-root /  (default: filesystem root; for tests use tmp dir)] \
//     [--dry-run]  (print what would be written; don't write)
//
// Interactive passphrase prompts are NOT implemented in this CLI — caller
// must supply --passphrase-file or --passphrase-env. Interactive prompting
// is the wrapping NixOS module's responsibility (081KSKBP80008QG0R002XBRGN8).
//
// Exit codes:
//   0 success
//   2 arg parse error
//   3 file read failure
//   4 envelope parse failure
//   5 decrypt failure (wrong passphrase / wrong UUID / tampered blob)
//   6 bundle decode failure
//   7 manifest missing cred id present in blob (mismatch)
//
// Per .claude/rules/non-coercion-invariant.md HC-8: operator authority over
// own creds; passphrase NEVER logged; required-cred write failure surfaces
// the failure rather than silently degrading.

import { writeFileSync, mkdirSync, readFileSync, existsSync, chmodSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { decrypt } from "./zeta-creds-crypto";
import { decodeBundle, parseEnvelope } from "./zeta-creds-envelope";
import { DEFAULT_MANIFEST, type CredentialEntry } from "./zeta-creds-manifest";
import { selectCliBindingMaterial } from "./installer-binding-cli.ts";
import { composeNmConnectionFromWifiEspJson } from "./wifi-esp-to-nm";

/**
 * Credential ids whose bytes are SECRETS and so are written 0600, never the process
 * umask default.
 *
 * The restore unit runs as root under systemd (umask 022), and `writeFileSync` with
 * no mode creates 0644. Measured consequences of that default, per id:
 *   gh-cli / claude / gemini / codex  API tokens readable by every local user.
 *   ssh-host-keys                     sshd REFUSES a private host key more open than
 *                                     0600 ("UNPROTECTED PRIVATE KEY FILE") and drops
 *                                     it, so the persisted key buys no known-hosts
 *                                     continuity at all.
 *   wifi                              NetworkManager IGNORES a keyfile under
 *                                     system-connections that is not 0600 root-owned.
 * Everything else the manifest carries (operator public keys, install answers, the
 * seal pointers) keeps the pre-existing default: tightening a file a non-root reader
 * needs would be a new defect, so the secret set is a named list, not "all of it".
 */
export const SECRET_CRED_IDS: ReadonlySet<string> = new Set(["gh-cli", "claude", "gemini", "codex", "ssh-host-keys", "wifi"]);

/** The mode a restored file must carry, or `undefined` to leave the creation default. */
export function restoreModeFor(id: string, path: string): number | undefined {
  if (!SECRET_CRED_IDS.has(id)) return undefined;
  // A public half of a key pair is not a secret, and ssh_config-style consumers read it.
  if (path.endsWith(".pub")) return 0o644;
  return 0o600;
}

/** The profile name a restored (non-ESP-baked) wifi blob is filed under. */
export const RESTORED_WIFI_PROFILE = "zeta-restored-wifi.nmconnection";

interface Args {
  readonly usbUuid: string | null;
  readonly usbISerial: string | null;
  readonly bindingMaterial: string;
  readonly input: string;
  readonly passphrase: string;
  readonly persona: string | null;
  readonly targetRoot: string;
  readonly dryRun: boolean;
}

/**
 * Parse CLI args. Reads filesystem ONLY for --passphrase-file. Returns
 * Args OR structured error message.
 *
 * SECURITY: Error messages NEVER include the passphrase value itself, AND
 * the env-var NAME passed as --passphrase-env value is not echoed back in
 * error strings (CodeQL clear-text-logging finding on PR #5422 — see
 * sibling note in zeta-creds-persist.ts).
 */
export function parseArgs(argv: readonly string[], env: NodeJS.ProcessEnv): Args | { readonly error: string } {
  let usbUuid: string | null = null;
  let usbISerial: string | null = null;
  let uefiKeyfilePath: string | null = null;
  let input: string | null = null;
  let passphraseFile: string | null = null;
  let passphraseEnv: string | null = null;
  let persona: string | null = null;
  let targetRoot = "/";
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const next = (): string => {
      if (i + 1 >= argv.length) throw new Error(`${arg} requires a value`);
      return argv[++i]!;
    };
    try {
      if (arg === "--usb-uuid") usbUuid = next();
      else if (arg === "--usb-iserial") usbISerial = next();
      else if (arg === "--uefi-keyfile") uefiKeyfilePath = next();
      else if (arg === "--input") input = next();
      else if (arg === "--passphrase-file") passphraseFile = next();
      else if (arg === "--passphrase-env") passphraseEnv = next();
      else if (arg === "--persona") persona = next();
      else if (arg === "--target-root") targetRoot = next();
      else if (arg === "--dry-run") dryRun = true;
      else return { error: `unknown flag: ${arg}` };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  if (!input) return { error: "--input required" };

  let uefiKeyfileBytes: Uint8Array | null = null;
  if (uefiKeyfilePath !== null) {
    if (!existsSync(uefiKeyfilePath)) return { error: "--uefi-keyfile not found" };
    try {
      uefiKeyfileBytes = readFileSync(uefiKeyfilePath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: `--uefi-keyfile read failed: ${msg}` };
    }
  }
  const binding = selectCliBindingMaterial({ usbUuid, usbISerial, uefiKeyfileBytes });
  if ("error" in binding) return { error: binding.error };

  let passphrase: string | null = null;
  if (passphraseFile) {
    if (!existsSync(passphraseFile)) return { error: `--passphrase-file not found: ${passphraseFile}` };
    try {
      passphrase = readFileSync(passphraseFile, "utf8").replace(/\r?\n$/, "");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: `--passphrase-file read failed: ${msg}` };
    }
    if (passphrase.length === 0) return { error: "--passphrase-file is empty" };
  } else if (passphraseEnv) {
    const v = env[passphraseEnv];
    if (v === undefined || v === null || v === "") {
      // SECURITY: omit env-var name from error (CodeQL taint via passphraseEnv)
      return { error: "--passphrase-env target var is not set or is empty" };
    }
    passphrase = v;
  }
  if (passphrase === null)
    return {
      error: "passphrase source required: pass --passphrase-file <path> or --passphrase-env <VAR>",
    };

  return { usbUuid, usbISerial, bindingMaterial: binding.material, input, passphrase, persona, targetRoot, dryRun };
}

/** Resolve manifest entry's paths relative to target-root + ~ expansion. */
export function resolveCredPaths(entry: CredentialEntry, targetRoot: string): readonly string[] {
  return entry.paths.map((p) => {
    if (p.startsWith("~/")) {
      // ~ refers to caller's home (root user during install); restore happens
      // pre-user-home so ~ resolution is best-effort here.
      return resolve(targetRoot, homedir().replace(/^\//, ""), p.slice(2));
    }
    if (p.startsWith("/")) {
      return resolve(targetRoot, p.slice(1));
    }
    return resolve(targetRoot, p);
  });
}

/** Plan + summarize what would be written (for dry-run + logging). */
export interface RestorePlan {
  readonly writes: readonly {
    readonly path: string;
    readonly bytes: number;
    readonly value: Buffer;
    /** Mode the file must end up with; absent = the creation default (see `restoreModeFor`). */
    readonly mode?: number;
  }[];
  readonly skipped: readonly { readonly id: string; readonly reason: string }[];
  readonly errors: readonly string[];
}

type PlannedWrite = { path: string; bytes: number; value: Buffer; mode?: number };

/**
 * Where, and as what bytes, a credential lands.
 *
 * Every manifest path is a FILE except `wifi`, whose path is the NetworkManager
 * `system-connections` DIRECTORY. Writing the blob "to" that path was EISDIR, and
 * because `applyPlan` writes in bundle order and the unit runs under `set -e`, one
 * such failure aborted the restore part-way and skipped the ownership pass that
 * follows it -- leaving every earlier write root-owned in the operator's home. A
 * JSON `{ssid, psk}` blob is converted to a keyfile; text is taken to already be one.
 */
function resolveTarget(
  id: string,
  path: string,
  value: Buffer,
): { readonly path: string; readonly value: Buffer } | { readonly skip: string } {
  if (id !== "wifi") return { path, value };
  let bytes: Buffer = value;
  try {
    JSON.parse(value.toString("utf8"));
    const composed = composeNmConnectionFromWifiEspJson(value.toString("utf8"));
    if (!composed.ok) return { skip: `wifi blob is JSON but not a usable ssid/psk pair (${composed.error})` };
    bytes = Buffer.from(composed.value, "utf8");
  } catch {
    // Not JSON: taken as keyfile text, which the persist-side handler already required to carry an ssid.
  }
  return { path: join(path, RESTORED_WIFI_PROFILE), value: bytes };
}

function modeMatches(path: string, mode: number | undefined): boolean {
  if (mode === undefined) return true;
  // NTFS has no POSIX mode bits: statSync reports 0o666 for everything, so a comparison there
  // could never be satisfied and would re-write every file on every run.
  if (process.platform === "win32") return true;
  try {
    return (statSync(path).mode & 0o777) === mode;
  } catch {
    return false;
  }
}

function pushWriteUnlessAlreadyPresent(
  writes: PlannedWrite[],
  skipped: { id: string; reason: string }[],
  id: string,
  rawPath: string,
  rawValue: Buffer,
): void {
  const target = resolveTarget(id, rawPath, rawValue);
  if ("skip" in target) {
    skipped.push({ id, reason: target.skip });
    return;
  }
  const { path, value } = target;
  const mode = restoreModeFor(id, path);
  if (existsSync(path)) {
    try {
      const current = readFileSync(path);
      // Right bytes at the WRONG mode is not "already present": a node restored by the
      // 0644-default code still holds its tokens world-readable, and skipping here would
      // leave them that way forever. Falling through rewrites them under the correct mode.
      if (current.equals(value) && modeMatches(path, mode)) {
        skipped.push({ id, reason: "already-present" });
        return;
      }
    } catch {
      // Fall through: applyPlan will attempt the restore write and surface
      // any persistent filesystem failure at the write boundary.
    }
  }
  writes.push(mode === undefined ? { path, bytes: value.length, value } : { path, bytes: value.length, value, mode });
}

/**
 * Decrypt + decode the blob + plan writes per manifest. Single decrypt
 * (scrypt is expensive — per Copilot review on PR #5422 the prior split
 * planRestore+applyPlan doubled scrypt cost). applyPlan() now takes a
 * RestorePlan rather than re-decrypting.
 */
export function planRestore(
  blob: Buffer,
  usbUuid: string,
  passphrase: string,
  persona: string | null,
  targetRoot: string,
): RestorePlan | { readonly error: string; readonly code: 4 | 5 | 6 | 7 } {
  const env = parseEnvelope(blob);
  if ("error" in env) return { error: `envelope parse: ${env.error}`, code: 4 };

  const plaintext = decrypt(env, usbUuid, passphrase);
  if ("error" in plaintext) return { error: `decrypt: ${plaintext.error}`, code: 5 };

  const bundle = decodeBundle(plaintext);
  if ("error" in bundle) return { error: `bundle decode: ${bundle.error}`, code: 6 };

  const writes: PlannedWrite[] = [];
  const skipped: { id: string; reason: string }[] = [];
  const errors: string[] = [];

  // Global creds
  for (const [id, value] of Object.entries(bundle.globalCreds)) {
    const entry = DEFAULT_MANIFEST.credentials.find((c) => c.id === id);
    if (!entry) {
      errors.push(`blob contains unknown cred id "${id}" (not in default manifest)`);
      continue;
    }
    if (entry.personaScoped) {
      skipped.push({ id, reason: `manifest declares personaScoped:true but blob put in globalCreds` });
      continue;
    }
    const paths = resolveCredPaths(entry, targetRoot);
    // Write to FIRST path only (canonical); other paths are alternates the caller may symlink
    pushWriteUnlessAlreadyPresent(writes, skipped, id, paths[0]!, value);
  }

  // Persona creds (only restore the requested persona's section)
  if (persona) {
    const personaSection = bundle.personaCreds[persona];
    if (personaSection) {
      for (const [id, value] of Object.entries(personaSection)) {
        const entry = DEFAULT_MANIFEST.credentials.find((c) => c.id === id);
        if (!entry) {
          errors.push(`blob persona ${persona} contains unknown cred id "${id}"`);
          continue;
        }
        if (!entry.personaScoped) {
          skipped.push({
            id,
            reason: `manifest declares personaScoped:false but blob put in personaCreds[${persona}]`,
          });
          continue;
        }
        const paths = resolveCredPaths(entry, targetRoot);
        pushWriteUnlessAlreadyPresent(writes, skipped, id, paths[0]!, value);
      }
    } else if (Object.keys(bundle.personaCreds).length > 0) {
      skipped.push({
        id: `(persona-section)`,
        reason: `requested persona "${persona}" not in blob; available: ${Object.keys(bundle.personaCreds).join(", ")}`,
      });
    }
  } else if (Object.keys(bundle.personaCreds).length > 0) {
    for (const personaName of Object.keys(bundle.personaCreds)) {
      for (const id of Object.keys(bundle.personaCreds[personaName]!)) {
        skipped.push({ id: `${personaName}/${id}`, reason: `persona-scoped cred; --persona not specified` });
      }
    }
  }

  if (errors.length > 0) return { error: errors.join("; "), code: 7 };
  return { writes, skipped, errors: [] };
}

/**
 * Apply a plan returned by planRestore. NO re-decrypt (per Copilot review
 * on PR #5422 — the prior implementation re-decrypted, doubling scrypt
 * cost + extending passphrase-derived-key lifetime in memory). Returns
 * the count of writes performed.
 */
export function applyPlan(plan: RestorePlan): number {
  let writeCount = 0;
  for (const w of plan.writes) {
    mkdirSync(dirname(w.path), { recursive: true });
    if (w.mode === undefined) {
      writeFileSync(w.path, w.value);
    } else {
      // `mode` on writeFileSync only applies when the file is CREATED, so an existing file
      // (the previous generation's 0644 copy) keeps its old bits unless chmod'd as well.
      // Create it already-restricted so there is no window where the bytes are readable.
      writeFileSync(w.path, w.value, { mode: w.mode });
      chmodSync(w.path, w.mode);
    }
    writeCount++;
  }
  return writeCount;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const parsed = parseArgs(argv, process.env);
  if ("error" in parsed) {
    console.error(`zeta-creds-restore: ${parsed.error}`);
    return 2;
  }
  if (!existsSync(parsed.input)) {
    console.error(`zeta-creds-restore: input file not found: ${parsed.input}`);
    return 3;
  }
  let blob: Buffer;
  try {
    blob = readFileSync(parsed.input);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`zeta-creds-restore: input file read failed: ${msg}`);
    return 3;
  }
  const plan = planRestore(blob, parsed.bindingMaterial, parsed.passphrase, parsed.persona, parsed.targetRoot);
  if ("error" in plan) {
    console.error(`zeta-creds-restore: ${plan.error}`);
    return plan.code;
  }
  if (parsed.dryRun) {
    console.log(`zeta-creds-restore (DRY RUN; ${plan.writes.length} writes would happen):`);
    for (const w of plan.writes) console.log(`  WRITE ${w.path} (${w.bytes} bytes)`);
    for (const s of plan.skipped) console.log(`  SKIP  ${s.id}: ${s.reason}`);
    return 0;
  }
  const written = applyPlan(plan);
  if (written === 0 && plan.skipped.some((entry) => entry.reason === "already-present")) {
    console.log("zeta-creds-restore: already-present, skipping credential rewrite");
  } else {
    console.log(`zeta-creds-restore: wrote ${written} creds (target-root: ${parsed.targetRoot})`);
  }
  for (const s of plan.skipped) console.log(`  SKIP ${s.id}: ${s.reason}`);
  return 0;
}

if (import.meta.main) {
  main().then((code) => process.exit(code));
}
