#!/usr/bin/env bun
// zeta-creds-picker.ts — interactive picker at install/setup time.
//
// B-0852.3a (operator 2026-05-27 device-flow-at-setup framing).
//
// For each cred in DEFAULT_MANIFEST, prompts operator:
//   [b]ake-in now / [d]efer to device-flow at runtime / [s]kip
// For bake-in: sub-prompts for value-source (literal / @file / env:VAR)
// per the per-cred handler's supportedSources.
//
// Then invokes zeta-creds-persist with the collected --bake-cred args.
//
// Composes:
//   - tools/installer/zeta-creds-manifest.ts (B-0852.5; iteration source)
//   - tools/installer/zeta-cred-handlers.ts (B-0852.10; per-cred source validation)
//   - tools/installer/zeta-creds-persist.ts (B-0852.2b; downstream consumer)
//
// Usage (called from zeta-install.sh Step 6.95-picker or operator terminal):
//   bun tools/installer/zeta-creds-picker.ts \
//     --usb-uuid <uuid> \
//     --output /esp/zeta-creds.enc \
//     ( --passphrase-file <path> | --passphrase-env <VAR> ) \
//     [--persona <name>] \
//     [--dry-run]  (print persist invocation; don't exec)
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

import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { DEFAULT_MANIFEST } from "./zeta-creds-manifest";
import { DEFAULT_HANDLERS } from "./zeta-cred-handlers";

interface PickerArgs {
  readonly usbUuid: string;
  readonly output: string;
  readonly passphraseFile: string | null;
  readonly passphraseEnv: string | null;
  readonly persona: string | null;
  readonly dryRun: boolean;
}

export function parseArgs(argv: readonly string[]): PickerArgs | { readonly error: string } {
  let usbUuid: string | null = null;
  let output: string | null = null;
  let passphraseFile: string | null = null;
  let passphraseEnv: string | null = null;
  let persona: string | null = null;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const next = (): string => {
      if (i + 1 >= argv.length) throw new Error(`${arg} requires a value`);
      return argv[++i]!;
    };
    try {
      if (arg === "--usb-uuid") usbUuid = next();
      else if (arg === "--output") output = next();
      else if (arg === "--passphrase-file") passphraseFile = next();
      else if (arg === "--passphrase-env") passphraseEnv = next();
      else if (arg === "--persona") persona = next();
      else if (arg === "--dry-run") dryRun = true;
      else return { error: `unknown flag: ${arg}` };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
  if (!usbUuid) return { error: "--usb-uuid required" };
  if (!output) return { error: "--output required" };
  if (!passphraseFile && !passphraseEnv) {
    return { error: "passphrase source required: --passphrase-file <path> or --passphrase-env <VAR>" };
  }
  return { usbUuid, output, passphraseFile, passphraseEnv, persona, dryRun };
}

/**
 * Prompt operator per-cred and return the --bake-cred args list.
 * Pure function over a readline interface (testable with mock).
 */
export async function runPicker(
  rl: ReturnType<typeof createInterface>,
  persona: string | null,
): Promise<string[]> {
  const bakeArgs: string[] = [];
  console.log("\n=== Credential picker (B-0852.3a setup-time integration) ===");
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
  const rl = createInterface({ input, output });
  let bakeArgs: string[] = [];
  try {
    bakeArgs = await runPicker(rl, parsed.persona);
  } catch (err) {
    rl.close();
    console.error(`zeta-creds-picker: aborted: ${err instanceof Error ? err.message : String(err)}`);
    return 3;
  } finally {
    rl.close();
  }
  console.log(`\n=== Picker complete: ${bakeArgs.length} cred(s) selected for bake-in ===`);
  for (const a of bakeArgs) {
    const id = a.split("=", 1)[0];
    console.log(`  --bake-cred ${id}=<redacted>`);
  }
  const persistArgs = [
    "tools/installer/zeta-creds-persist.ts",
    "--usb-uuid", parsed.usbUuid,
    "--output", parsed.output,
  ];
  if (parsed.passphraseFile) persistArgs.push("--passphrase-file", parsed.passphraseFile);
  if (parsed.passphraseEnv) persistArgs.push("--passphrase-env", parsed.passphraseEnv);
  if (parsed.persona) persistArgs.push("--persona", parsed.persona);
  for (const a of bakeArgs) persistArgs.push("--bake-cred", a);
  if (parsed.dryRun) {
    // SECURITY: build display string from KNOWN-SAFE pieces only.
    // Earlier map-based redaction kept persistArgs (tainted) in the
    // dataflow; CodeQL doesn't recognize runtime ternary as breaking
    // taint, so it kept flagging. Construct from primitives instead;
    // NEVER reference parsed.passphraseEnv or parsed.passphraseFile in
    // the logged string. Sibling discipline to zeta-creds-persist.ts
    // + zeta-creds-restore.ts P0 fix on PR #5422.
    console.log(`\n=== DRY RUN — would invoke: ===`);
    let displayCmd = `  bun tools/installer/zeta-creds-persist.ts --usb-uuid <set> --output <set>`;
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
  return 0;
}

if (import.meta.main) {
  main().then((code) => process.exit(code));
}
