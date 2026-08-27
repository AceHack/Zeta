#!/usr/bin/env bun
// zeta-creds-picker.ts — interactive picker at install/setup time.
//
// 081KSKBP80008QG0R003AX2A69.3a (operator 2026-05-27 device-flow-at-setup framing).
//
// For each cred in DEFAULT_MANIFEST, prompts operator:
//   [b]ake-in now / [d]efer to device-flow at runtime / [s]kip
// For bake-in: sub-prompts for value-source (literal / @file / env:VAR)
// per the per-cred handler's supportedSources.
//
// Then invokes zeta-creds-persist with the collected --bake-cred args.
//
// Composes:
//   - src/Core.TypeScript/installer/zeta-creds-manifest.ts (081KSKBP80008QG0R003AX2A69.5; iteration source)
//   - src/Core.TypeScript/installer/zeta-cred-handlers.ts (081KSKBP80008QG0R003AX2A69.10; per-cred source validation)
//   - src/Core.TypeScript/installer/zeta-creds-persist.ts (081KSKBP80008QG0R003AX2A69.2b; downstream consumer)
//
// Usage (called from zeta-install.sh Step 6.95-picker or operator terminal):
//   bun src/Core.TypeScript/installer/zeta-creds-picker.ts \
//     ( --usb-uuid <uuid> | --usb-iserial <serial> | --uefi-keyfile <path> ) \
//     --output /mnt/boot/zeta-creds.enc \
//     ( --passphrase-file <path> | --passphrase-env <VAR> ) \
//     [--persona <name>] \
//     [--verify]
//     [--dry-run]
//     [--defer-all]  (every cred defers; no TTY prompts; never bake.
//                    QEMU / non-TTY also take this path even without the flag,
//                    unless --bake-cred is given — 081M12178AR restore probe.)
//     [--bake-cred <id>=<value-source>] ...
//                    Explicit bake on a non-TTY (QEMU restore probe). Mutually
//                    exclusive with --defer-all. HC-8: this is the operator/CI
//                    opt-in, not a default-bake.
//
// Per .claude/rules/non-coercion-invariant.md HC-8: operator authority over
// own creds; no default-bake (operator must explicitly pick bake for each);
// passphrase NEVER logged; declined creds defer to device-flow at runtime.
//
// Exit codes:
//   0 success
//   2 arg parse error
//   3 picker abort (operator Ctrl+C)
//   4 persist invocation failure
//   5 verify failure (--verify ran post-persist + reported a problem with
//     the just-written blob; the install-time recovery is to re-run the
//     picker; the first-reboot recovery would otherwise be a full reflash)

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { DEFAULT_MANIFEST } from "./zeta-creds-manifest";
import { DEFAULT_HANDLERS } from "./zeta-cred-handlers";

interface PickerArgs {
  readonly usbUuid: string | null;
  readonly usbISerial: string | null;
  readonly uefiKeyfile: string | null;
  readonly output: string;
  readonly passphraseFile: string | null;
  readonly passphraseEnv: string | null;
  readonly persona: string | null;
  readonly dryRun: boolean;
  readonly verify: boolean;
  /** HC-8: every cred defers. No bake. QEMU / non-TTY path. */
  readonly deferAll: boolean;
  /**
   * Explicit `--bake-cred` args (081M12178AR). When non-empty, persist these
   * even on a non-TTY — the flag IS the opt-in. Incompatible with --defer-all.
   */
  readonly bakeCredArgs: readonly string[];
}

function hasPresent(value: string | null): value is string {
  return value !== null && value.length > 0;
}

/**
 * Forward the same binding flags the picker received. Persist and restore
 * already accept --usb-iserial / --uefi-keyfile; the picker was the hole
 * (it required --usb-uuid and dropped the extras). Do not trim: KDF input
 * is the operator's bytes, and boundary whitespace is persist's to refuse.
 */
function appendBindingFlags(args: string[], parsed: PickerArgs): void {
  if (hasPresent(parsed.usbUuid)) args.push("--usb-uuid", parsed.usbUuid);
  if (hasPresent(parsed.usbISerial)) args.push("--usb-iserial", parsed.usbISerial);
  if (hasPresent(parsed.uefiKeyfile)) args.push("--uefi-keyfile", parsed.uefiKeyfile);
}

export function parseArgs(argv: readonly string[]): PickerArgs | { readonly error: string } {
  let usbUuid: string | null = null;
  let usbISerial: string | null = null;
  let uefiKeyfile: string | null = null;
  let output: string | null = null;
  let passphraseFile: string | null = null;
  let passphraseEnv: string | null = null;
  let persona: string | null = null;
  let dryRun = false;
  let verify = false;
  let deferAll = false;
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
      else if (arg === "--uefi-keyfile") uefiKeyfile = next();
      else if (arg === "--output") output = next();
      else if (arg === "--passphrase-file") passphraseFile = next();
      else if (arg === "--passphrase-env") passphraseEnv = next();
      else if (arg === "--persona") persona = next();
      else if (arg === "--dry-run") dryRun = true;
      else if (arg === "--verify") verify = true;
      else if (arg === "--defer-all") deferAll = true;
      else if (arg === "--bake-cred") bakeCredArgs.push(next());
      else return { error: `unknown flag: ${arg}` };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
  if (hasPresent(usbISerial) && hasPresent(uefiKeyfile)) {
    return { error: "--usb-iserial and --uefi-keyfile are mutually exclusive" };
  }
  if (!hasPresent(usbUuid) && !hasPresent(usbISerial) && !hasPresent(uefiKeyfile)) {
    return { error: "binding factor required: --usb-uuid, --usb-iserial, or --uefi-keyfile" };
  }
  if (!output) return { error: "--output required" };
  if (!passphraseFile && !passphraseEnv) {
    return { error: "passphrase source required: --passphrase-file <path> or --passphrase-env <VAR>" };
  }
  if (deferAll && bakeCredArgs.length > 0) {
    return { error: "--defer-all and --bake-cred are mutually exclusive" };
  }
  return {
    usbUuid,
    usbISerial,
    uefiKeyfile,
    output,
    passphraseFile,
    passphraseEnv,
    persona,
    dryRun,
    verify,
    deferAll,
    bakeCredArgs,
  };
}

/** Prompts hang with no TTY (QEMU serial). Empty bake is defer, never bake. */
export function shouldDeferAllPrompts(flag: boolean, stdinIsTTY: boolean): boolean {
  return flag || !stdinIsTTY;
}

/**
 * Build the argv list for the verify-mode invocation of
 * zeta-creds-restore.ts. Pure function for testability.
 *
 * The verify step decrypts the just-written blob using the same
 * passphrase source the picker used + invokes the restore CLI in
 * --dry-run mode against a tmpdir target-root. Success = blob is
 * cryptographically valid + manifest parses + at least one cred
 * entry round-tripped. Failure = exit non-zero; operator sees an
 * actionable error BEFORE rebooting into an unrecoverable state.
 *
 * Tmpdir use: --dry-run guarantees restore writes nothing, but
 * --target-root must be set to something to avoid the default `/`
 * (which would surface as suggested-write-target in dry-run output
 * + confuse operators reading the verify log).
 */
export function buildVerifyArgs(
  parsed: PickerArgs,
  tmpTargetRoot: string,
): readonly string[] {
  const args = [
    "src/Core.TypeScript/installer/zeta-creds-restore.ts",
  ];
  appendBindingFlags(args, parsed);
  args.push(
    "--input", parsed.output,
    "--target-root", tmpTargetRoot,
    "--dry-run",
  );
  if (parsed.passphraseFile) args.push("--passphrase-file", parsed.passphraseFile);
  if (parsed.passphraseEnv) args.push("--passphrase-env", parsed.passphraseEnv);
  if (parsed.persona) args.push("--persona", parsed.persona);
  return args;
}

/**
 * Build the argv list for zeta-creds-persist.ts. Pure, so tests can pin
 * that optional binding factors survive the picker rather than being
 * dropped because the spawn site only knew --usb-uuid.
 */
export function buildPersistArgs(
  parsed: PickerArgs,
  bakeArgs: readonly string[],
): readonly string[] {
  const args = [
    "src/Core.TypeScript/installer/zeta-creds-persist.ts",
  ];
  appendBindingFlags(args, parsed);
  args.push("--output", parsed.output);
  if (parsed.passphraseFile) args.push("--passphrase-file", parsed.passphraseFile);
  if (parsed.passphraseEnv) args.push("--passphrase-env", parsed.passphraseEnv);
  if (parsed.persona) args.push("--persona", parsed.persona);
  for (const a of bakeArgs) args.push("--bake-cred", a);
  return args;
}

/**
 * Prompt operator per-cred and return the --bake-cred args list.
 * Pure function over a readline interface (testable with mock).
 */
export async function runPicker(
  rl: ReturnType<typeof createInterface>,
  persona: string | null,
  deferAll = false,
): Promise<string[]> {
  if (deferAll) {
    console.log("\n=== Credential picker: --defer-all (every cred defers to device-flow; no bake) ===");
    return [];
  }
  const bakeArgs: string[] = [];
  console.log("\n=== Credential picker (081KSKBP80008QG0R003AX2A69.3a setup-time integration) ===");
  console.log("For each declared credential: bake-in NOW, defer to device-flow at runtime, or skip.");
  if (persona) console.log(`Persona: ${persona} (persona-scoped creds will use this slot).\n`);
  else console.log("No --persona; only global creds will accept bake.\n");

  for (const cred of DEFAULT_MANIFEST.credentials) {
    const handler = DEFAULT_HANDLERS[cred.id];
    if (!handler) {
      console.log(`-- ${cred.id}: no handler registered; skipping`);
      continue;
    }
    if (cred.personaScoped && !persona) {
      console.log(`-- ${cred.id}: persona-scoped + no --persona given; auto-skip`);
      continue;
    }
    console.log(`\n-- ${cred.id} (${cred.personaScoped ? "persona-scoped" : "global"}; ${cred.required ? "required" : "optional"})`);
    if (cred.notes) console.log(`   ${cred.notes}`);
    console.log(`   paths: ${cred.paths.join(", ")}`);
    if (handler.supportedSources.length === 0) {
      console.log(`   handler has NO supported sources (Phase 1 deferred); auto-defer`);
      continue;
    }
    console.log(`   supported sources: ${handler.supportedSources.join(", ")}`);
    const choice = (await rl.question("   [b]ake-in / [d]efer to device-flow / [s]kip? ")).toLowerCase().trim();
    if (choice === "s" || choice === "skip") {
      console.log(`   → skip`);
      continue;
    }
    if (choice === "d" || choice === "defer" || choice === "") {
      console.log(`   → defer (device-flow at runtime)`);
      continue;
    }
    if (choice !== "b" && choice !== "bake") {
      console.log(`   → unrecognized "${choice}"; treating as defer`);
      continue;
    }
    const sources = handler.supportedSources;
    const sourceHint = sources.map((s) => `[${s[0]}]${s.slice(1)}`).join(" / ");
    const sourceChoice = (await rl.question(`   source ${sourceHint}? `)).toLowerCase().trim();
    let valueSpec: string;
    if (sourceChoice.startsWith("l") && sources.includes("literal")) {
      const v = await rl.question(`   literal value (will NOT be logged): `);
      if (v.length === 0) {
        console.log(`   → empty value; skip`);
        continue;
      }
      valueSpec = v;
    } else if (sourceChoice.startsWith("f") && sources.includes("file")) {
      const p = await rl.question(`   file path: `);
      if (p.length === 0) {
        console.log(`   → empty path; skip`);
        continue;
      }
      valueSpec = `@${p}`;
    } else if (sourceChoice.startsWith("e") && sources.includes("env")) {
      const v = await rl.question(`   env var name: `);
      if (v.length === 0) {
        console.log(`   → empty env var name; skip`);
        continue;
      }
      valueSpec = `env:${v}`;
    } else {
      console.log(`   → unrecognized or unsupported source; skip`);
      continue;
    }
    bakeArgs.push(`${cred.id}=${valueSpec}`);
    // SECURITY: source label computed from operator's choice letter, NOT
    // from valueSpec (which contains the actual value/path/var-name).
    // Avoids any chance of the value/path/var-name reaching console output
    // through ternary-on-valueSpec inspection.
    const sourceLabel = sourceChoice.startsWith("l") ? "literal" : sourceChoice.startsWith("f") ? "@file" : "env";
    console.log(`   → baked (source: ${sourceLabel})`);
  }
  return bakeArgs;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const parsed = parseArgs(argv);
  if ("error" in parsed) {
    console.error(`zeta-creds-picker: ${parsed.error}`);
    return 2;
  }
  const skipPrompts = shouldDeferAllPrompts(parsed.deferAll, Boolean(input.isTTY));
  let bakeArgs: string[] = [];
  if (parsed.bakeCredArgs.length > 0) {
    // 081M12178AR: explicit --bake-cred is the opt-in. Do not empty it on
    // non-TTY — that was the vacuous wrote-0 path.
    console.log(
      `zeta-creds-picker: --bake-cred x${parsed.bakeCredArgs.length} (explicit; no TTY prompts)`,
    );
    bakeArgs = [...parsed.bakeCredArgs];
  } else if (skipPrompts) {
    console.log("zeta-creds-picker: non-TTY or --defer-all; every cred defers (HC-8: no default-bake)");
    bakeArgs = [];
  } else {
    const rl = createInterface({ input, output });
    try {
      bakeArgs = await runPicker(rl, parsed.persona);
    } catch (err) {
      rl.close();
      console.error(`zeta-creds-picker: aborted: ${err instanceof Error ? err.message : String(err)}`);
      return 3;
    } finally {
      rl.close();
    }
  }
  console.log(`\n=== Picker complete: ${bakeArgs.length} cred(s) selected for bake-in ===`);
  for (const a of bakeArgs) {
    const id = a.split("=", 1)[0];
    console.log(`  --bake-cred ${id}=<redacted>`);
  }
  const persistArgs = [...buildPersistArgs(parsed, bakeArgs)];
  if (parsed.dryRun) {
    // SECURITY: build display string from KNOWN-SAFE pieces only.
    // Earlier map-based redaction kept persistArgs (tainted) in the
    // dataflow; CodeQL doesn't recognize runtime ternary as breaking
    // taint, so it kept flagging. Construct from primitives instead;
    // NEVER reference parsed.passphraseEnv or parsed.passphraseFile in
    // the logged string. Sibling discipline to zeta-creds-persist.ts
    // + zeta-creds-restore.ts P0 fix on PR #5422.
    console.log(`\n=== DRY RUN — would invoke: ===`);
    let displayCmd = `  bun src/Core.TypeScript/installer/zeta-creds-persist.ts`;
    if (hasPresent(parsed.usbUuid)) displayCmd += ` --usb-uuid <set>`;
    if (hasPresent(parsed.usbISerial)) displayCmd += ` --usb-iserial <set>`;
    if (hasPresent(parsed.uefiKeyfile)) displayCmd += ` --uefi-keyfile <set>`;
    displayCmd += ` --output <set>`;
    if (parsed.passphraseFile) displayCmd += ` --passphrase-file <REDACTED>`;
    if (parsed.passphraseEnv) displayCmd += ` --passphrase-env <REDACTED>`;
    if (parsed.persona) displayCmd += ` --persona <set>`;
    for (const a of bakeArgs) {
      const id = a.split("=", 1)[0];
      displayCmd += ` --bake-cred ${id}=<REDACTED>`;
    }
    console.log(displayCmd);
    return 0;
  }
  console.log(`\n=== Invoking zeta-creds-persist... ===`);
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("bun", persistArgs, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`zeta-creds-picker: persist failed (exit ${result.status})`);
    return 4;
  }
  if (parsed.verify) {
    console.log(`\n=== Verifying just-written blob (--verify) ===`);
    console.log(`  Re-decrypting ${parsed.output} with the same passphrase + dry-run-restoring to`);
    console.log(`  a tmpdir to confirm the blob is cryptographically valid + manifest-parseable.`);
    console.log(`  Any failure here is recoverable AT INSTALL TIME by re-running the picker;`);
    console.log(`  if discovered post-reboot, recovery would require full reflash.`);
    const tmpTargetRoot = mkdtempSync(join(tmpdir(), "zeta-picker-verify-"));
    const verifyArgs = buildVerifyArgs(parsed, tmpTargetRoot);
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const verifyResult = spawnSync("bun", [...verifyArgs], { stdio: "inherit" });
    // Best-effort cleanup of tmpdir (dry-run wrote nothing, so it's empty).
    try {
      rmSync(tmpTargetRoot, { recursive: true, force: true });
    } catch {
      // ignore — empty dir cleanup failure shouldn't affect verify verdict
    }
    if (verifyResult.status !== 0) {
      console.error(`zeta-creds-picker: verify FAILED (restore --dry-run exit ${verifyResult.status})`);
      console.error(`  The blob at ${parsed.output} was written but cannot be decrypted/parsed.`);
      console.error(`  Re-run the picker with the same passphrase to overwrite + retry.`);
      return 5;
    }
    console.log(`=== Verify PASS: blob decrypts cleanly + manifest parses ===`);
  }
  return 0;
}

if (import.meta.main) {
  main().then((code) => process.exit(code));
}
