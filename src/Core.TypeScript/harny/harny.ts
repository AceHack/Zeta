#!/usr/bin/env bun
// harny.ts — the custom agent harness CLI (Aaron 2026-08-26: "we can call our harness harny").
//
// Separate from Ace (package manager of package managers). Ace will install Harny
// once the repo split publishes it. Until then this is the in-tree dogfood surface:
// login + indexed search, not full-tree grep.

import { mkdirSync } from "node:fs";
import { homedir } from "node:os";

import { defaultStoreDir } from "../model-backend/login-runner.ts";
import { fileTokenStore } from "../model-backend/token-store.ts";
import { main as loginMain, nodeStoreFs, type CliIo } from "../model-backend/zeta-login-cli.ts";
import { main as searchMain } from "../search/inverted/query.ts";

/// Injected doors so tests never touch homedir, mkdir, git, or process.stderr.
/// Production omits them; the CLI path is the only one that opens those.
export type HarnyDoors = {
  readonly search?: (args: readonly string[]) => number | Promise<number>;
  readonly login?: (args: readonly string[], io: CliIo) => Promise<number>;
};

export function dispatch(argv: readonly string[], io: CliIo, doors: HarnyDoors = {}): Promise<number> | number {
  const [cmd = "", ...rest] = argv;
  if (cmd === "search") return (doors.search ?? searchMain)(rest);
  if (cmd === "help" || cmd === "--help" || cmd === "-h" || cmd === "") {
    io.out("harny — custom agent harness");
    io.out("  harny login|import|list|status|token   account login (device-code first)");
    io.out("  harny login manus --from-file <path>    account API key; remote-only agent");
    io.out("  harny search <term>...                 inverted index, not full-tree grep");
    return 0;
  }
  if (doors.login !== undefined) return doors.login(argv, io);
  const dir = defaultStoreDir(homedir());
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const store = fileTokenStore(dir, nodeStoreFs());
  return loginMain(argv, store, io);
}

const invokedDirectly = typeof process.argv[1] === "string" && /harny(?:\.ts|\.js)?$/.test(process.argv[1]);
if (invokedDirectly) {
  const io: CliIo = { out: (l) => console.log(l), err: (l) => console.error(l) };
  Promise.resolve(dispatch(process.argv.slice(2), io))
    .then((code) => process.exit(code))
    .catch((e: unknown) => {
      console.error(`harny failed: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    });
}
