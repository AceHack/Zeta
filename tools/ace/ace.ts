#!/usr/bin/env bun
// ace.ts -- Ace DLC package manager CLI. Smallest safe slice of B-0288.
//
// Usage:
//   bun tools/ace/ace.ts list [--store <path>] [--json]
//   bun tools/ace/ace.ts install <url-or-path>
//   bun tools/ace/ace.ts verify <hash>
//
// Future commands (not yet implemented): remove, inspect.

import { readFileSync } from "node:fs";
import { defaultStorePath, listInstalled, installPackage, type AcePackage } from "./store";

interface ListArgs {
  readonly command: "list";
  readonly storePath: string;
  readonly json: boolean;
}

interface HelpArgs {
  readonly command: "help";
}

interface InstallArgs {
  readonly command: "install";
  readonly source: string;
  readonly storePath: string;
}

interface VerifyArgs {
  readonly command: "verify";
  readonly hash: string;
  readonly storePath: string;
}

type ParsedArgs = ListArgs | HelpArgs | InstallArgs | VerifyArgs;

interface ArgError {
  readonly error: string;
}

export function parseArgs(argv: readonly string[]): ParsedArgs | ArgError {
  const command = argv[0];
  if (!command || command === "help" || command === "--help" || command === "-h") {
    return { command: "help" };
  }

  if (command === "install") {
    const source = argv[1];
    if (!source || source.startsWith("-")) return { error: "install requires a <url-or-path> argument" };
    return { command: "install", source, storePath: defaultStorePath() };
  }

  if (command === "verify") {
    const hash = argv[1];
    if (!hash || hash.startsWith("-")) return { error: "verify requires a <hash> argument" };
    return { command: "verify", hash, storePath: defaultStorePath() };
  }

  if (command === "list") {
    let storePath = defaultStorePath();
    let json = false;

    for (let i = 1; i < argv.length; i++) {
      const arg = argv[i];
      if (arg === "--store" || arg === "-s") {
        const next = argv[i + 1];
        if (!next || next.startsWith("-")) {
          return { error: "--store requires a path argument" };
        }
        storePath = next;
        i++;
      } else if (arg === "--json") {
        json = true;
      } else {
        return { error: `Unknown option for list: ${arg}` };
      }
    }

    return { command: "list", storePath, json };
  }

  const known = ["remove", "inspect"];
  if (known.includes(command)) {
    return { error: `'${command}' is not yet implemented` };
  }

  return { error: `Unknown command: ${command}` };
}

function printUsage(): void {
  const text = `Ace DLC Package Manager

Usage:
  ace list [--store <path>] [--json]             List installed DLC packages
  ace install <url-or-path>                      Download/read a package, verify integrity, install
  ace verify <hash>                              Confirm an installed package is present
  ace help                                       Show this help

Future commands (not yet implemented):
  ace remove <hash>                              Uninstall a DLC
  ace inspect <hash>                             Show manifest without installing`;
  console.log(text);
}

export async function main(argv: readonly string[]): Promise<number> {
  const parsed = parseArgs(argv);

  if ("error" in parsed) {
    console.error(`ace: ${parsed.error}`);
    return 64;
  }

  if (parsed.command === "help") {
    printUsage();
    return 0;
  }

  if (parsed.command === "list") {
    const packages = listInstalled(parsed.storePath);

    if (parsed.json) {
      console.log(JSON.stringify(packages, null, 2));
      return 0;
    }

    if (packages.length === 0) {
      console.log("No DLC packages installed.");
      return 0;
    }

    console.log(`Installed DLC packages (${packages.length}):\n`);
    for (const pkg of packages) {
      const desc = pkg.manifest.description ? ` — ${pkg.manifest.description}` : "";
      console.log(`  ${pkg.manifest.name}@${pkg.manifest.version}${desc}`);
      console.log(`    hash: ${pkg.hash}`);
    }
    return 0;
  }

  if (parsed.command === "install") {
    let raw: string;
    try {
      raw = parsed.source.startsWith("http")
        ? await (await fetch(parsed.source)).text()
        : readFileSync(parsed.source, "utf8");
    } catch (e) {
      console.error(`ace: download/read failed: ${(e as Error).message}`);
      return 1;
    }
    let pkg: AcePackage;
    try { pkg = JSON.parse(raw) as AcePackage; }
    catch { console.error("ace: package is not valid JSON"); return 65; }
    const result = installPackage(parsed.storePath, pkg);
    if (!result.ok) { console.error(`ace: install refused: ${result.error}`); return 1; }
    console.log(`ace: installed ${pkg.manifest.name}@${pkg.manifest.version} -> ${result.dir}`);
    console.log("ace: integrity-verified (content hash). NOT authenticity-verified (no signature check yet).");
    return 0;
  }

  if (parsed.command === "verify") {
    const pkgs = listInstalled(parsed.storePath);
    const found = pkgs.find((p) => p.hash === parsed.hash || p.manifest.content_hash === parsed.hash);
    if (!found) { console.error(`ace: no installed package with hash ${parsed.hash}`); return 1; }
    console.log(`ace: ${found.manifest.name}@${found.manifest.version} present (manifest hash ${found.manifest.content_hash})`);
    return 0;
  }

  return 1;
}

if (import.meta.main) {
  // .catch() closes the unhandled-promise surface from the async main(): an unexpected throw
  // inside an await exits 1 with a diagnostic instead of an UnhandledPromiseRejection.
  main(process.argv.slice(2))
    .then((c) => process.exit(c))
    .catch((e) => {
      console.error(`ace: fatal: ${(e as Error).message}`);
      process.exit(1);
    });
}
