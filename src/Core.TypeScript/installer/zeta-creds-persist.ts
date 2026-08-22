#!/usr/bin/env bun
// zeta-creds-persist.ts — write encrypted cred-blob to ESP. 081KSKBP80008QG0R003AX2A69.2b CLI.
//
// Reads --bake-cred args + per-cred handler validation + crypto encrypt +
// envelope serialize → writes to --output (e.g., /esp/zeta-creds.enc).
//
// Composes:
//   - src/Core.TypeScript/installer/zeta-creds-crypto.ts (081KSKBP80008QG0R003AX2A69.1; encrypt)
//   - src/Core.TypeScript/installer/zeta-creds-manifest.ts (081KSKBP80008QG0R003AX2A69.5; cred catalog)
//   - src/Core.TypeScript/installer/zeta-cred-handlers.ts (081KSKBP80008QG0R003AX2A69.10; parse + validate args)
//   - src/Core.TypeScript/installer/zeta-creds-envelope.ts (081KSKBP80008QG0R003AX2A69.2a; wire format + bundle)
//
// Usage:
//   bun src/Core.TypeScript/installer/zeta-creds-persist.ts \
//     --usb-uuid <uuid> \
//     [--usb-iserial <serial>] \
//     [--uefi-keyfile <path>] \
//     --output /esp/zeta-creds.enc \
//     ( --passphrase-file <path> | --passphrase-env <VAR> ) \
//     [--persona <name>] \
//     [--bake-cred <id>=<value-source>] ...
//
// Interactive passphrase prompts are NOT implemented in this CLI — caller
// must supply --passphrase-file or --passphrase-env. Interactive prompting
// is the wrapping NixOS module's responsibility (081KSKBP80008QG0R002XBRGN8).
//
// Per .claude/rules/non-coercion-invariant.md HC-8: operator authority over
// own creds; passphrase NEVER logged; --bake-cred error messages redact
// value-source contents per 081KSKBP80008QG0R003AX2A69.10 P0 security discipline.

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { encrypt } from "./zeta-creds-crypto";
import { DEFAULT_HANDLERS, resolveBakeCred } from "./zeta-cred-handlers";
import { encodeBundle, serializeEnvelope, type CredBundle } from "./zeta-creds-envelope";
import { DEFAULT_MANIFEST } from "./zeta-creds-manifest";
import {
  selectCliBindingMaterial,
  bindingFactorSidecarPath,
  type PersistBindingFactorKind,
} from "./installer-binding-cli.ts";

interface Args {
  readonly usbUuid: string | null;
  readonly usbISerial: string | null;
  readonly bindingFactor: PersistBindingFactorKind;
  readonly bindingMaterial: string;
  readonly output: string;
  readonly passphrase: string;
  readonly persona: string | null;
  readonly bakeCredArgs: readonly string[];
}

/**
 * Parse CLI args. Reads filesystem ONLY for --passphrase-file (existence
 * check + read). Returns Args OR structured error message.
 *
 * SECURITY: Error messages NEVER include the passphrase value itself, AND
 * the env-var NAME passed as --passphrase-env value is not echoed back in
 * error strings (CodeQL clear-text-logging finding on PR #5422: the
 * var-name was tainted by env-access flow; omitting it avoids the false-
 * positive AND avoids the genuine "operator might paste a long secret in
 * argv if they confuse env-var-name with literal-secret" footgun).
 */
export function parseArgs(argv: readonly string[], env: NodeJS.ProcessEnv): Args | { readonly error: string } {
  let usbUuid: string | null = null;
  let usbISerial: string | null = null;
  let uefiKeyfilePath: string | null = null;
  let output: string | null = null;
  let passphraseFile: string | null = null;
  let passphraseEnv: string | null = null;
  let persona: string | null = null;
  const bakeCredArgs: string[] = [];

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
      else if (arg === "--output") output = next();
      else if (arg === "--passphrase-file") passphraseFile = next();
      else if (arg === "--passphrase-env") passphraseEnv = next();
      else if (arg === "--persona") persona = next();
      else if (arg === "--bake-cred") bakeCredArgs.push(next());
      else return { error: `unknown flag: ${arg}` };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  if (!output) return { error: "--output required" };

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

  // Resolve passphrase source. Interactive prompt is NOT implemented in this
  // entry-point — caller must supply --passphrase-file or --passphrase-env.
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

  return {
    usbUuid,
    usbISerial,
    bindingFactor: binding.factor,
    bindingMaterial: binding.material,
    output,
    passphrase,
    persona,
    bakeCredArgs,
  };
}

/** Compose a CredBundle from --bake-cred args + manifest. Pure (in test mode). */
export function composeBundle(args: {
  readonly persona: string | null;
  readonly bakeCredArgs: readonly string[];
}): CredBundle | { readonly error: string } {
  const globalCreds: Record<string, Buffer> = {};
  const personaCreds: Record<string, Record<string, Buffer>> = {};

  for (const arg of args.bakeCredArgs) {
    const result = resolveBakeCred(arg, DEFAULT_HANDLERS);
    if ("error" in result) return { error: `bake-cred parse failed: ${result.error}` };

    // Look up manifest entry to determine personaScoped
    const manifestEntry = DEFAULT_MANIFEST.credentials.find((c) => c.id === result.ok.id);
    if (!manifestEntry) return { error: `cred id "${result.ok.id}" not declared in manifest` };

    if (manifestEntry.personaScoped) {
      if (!args.persona) return { error: `cred "${result.ok.id}" is personaScoped; --persona required` };
      personaCreds[args.persona] ??= {};
      personaCreds[args.persona]![result.ok.id] = result.ok.value;
    } else {
      globalCreds[result.ok.id] = result.ok.value;
    }
  }

  return { schemaVersion: 1, globalCreds, personaCreds };
}

/** Pure pipeline (no FS write): bundle → encrypt → serialize. */
export function buildBlob(bundle: CredBundle, bindingMaterial: string, passphrase: string): Buffer {
  const plaintext = encodeBundle(bundle);
  const env = encrypt(plaintext, bindingMaterial, passphrase);
  return serializeEnvelope(env);
}

/** Blob + factor sidecar. Sidecar is kind only; restore must not guess UUID. */
export function writePersistOutputs(output: string, blob: Buffer, bindingFactor: string): void {
  writeFileSync(output, blob);
  writeFileSync(bindingFactorSidecarPath(output), `${bindingFactor}\n`);
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const parsed = parseArgs(argv, process.env);
  if ("error" in parsed) {
    console.error(`zeta-creds-persist: ${parsed.error}`);
    return 2;
  }
  const bundle = composeBundle(parsed);
  if ("error" in bundle) {
    console.error(`zeta-creds-persist: ${bundle.error}`);
    return 3;
  }
  const blob = buildBlob(bundle, parsed.bindingMaterial, parsed.passphrase);
  const factorPath = bindingFactorSidecarPath(parsed.output);
  try {
    writePersistOutputs(parsed.output, blob, parsed.bindingFactor);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`zeta-creds-persist: write to ${parsed.output} failed: ${msg}`);
    return 4;
  }
  console.log(`zeta-creds-persist: wrote ${blob.length} bytes to ${parsed.output}`);
  console.log(`zeta-creds-persist: binding-factor ${parsed.bindingFactor} -> ${factorPath}`);
  console.log(`  globalCreds: ${Object.keys(bundle.globalCreds).join(", ") || "(none)"}`);
  for (const [persona, creds] of Object.entries(bundle.personaCreds)) {
    console.log(`  personaCreds[${persona}]: ${Object.keys(creds).join(", ")}`);
  }
  return 0;
}

if (import.meta.main) {
  main().then((code) => process.exit(code));
}
