#!/usr/bin/env bun
/**
 * corporate/org.ts — the binary. `bun org.ts <command> [flags]`.
 *
 * Thin on purpose: it supplies the real filesystem, the real clock, the real environment and the
 * real streams to `org-cli.main`, and does nothing else. Every decision lives in `org-cli.ts`,
 * which is why the whole surface is testable without a store on disk.
 *
 * The registry defaults to `$ORG_REGISTRY`, else `~/.org/registry.json`. An env var rather than a
 * flag because it is the same for every command in a session, and a flag that must be repeated on
 * every invocation is a flag that eventually gets forgotten on one of them.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { main } from "./org-cli";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";

/**
 * The chart the raise-derivation reads. Built once, from the seed roster.
 *
 * A refusal here is fatal on purpose: a malformed chart would make every gate look unstaffable and
 * fill a person's inbox with a hundred raises about an organization that is actually fine.
 */
const built = buildOrgChart(SEED_HATS);
if (!built.ok) {
  process.stderr.write(`cannot build the org chart: ${built.reason}\n`);
  process.exit(5);
}

function registryPath(): string {
  const fromEnv = process.env["ORG_REGISTRY"];
  if (fromEnv !== undefined && fromEnv.trim() !== "") return fromEnv;
  return join(homedir(), ".org", "registry.json");
}

const code = await main(process.argv.slice(2), {
  // A MISSING file is `undefined`, not a throw: `loadRegistry` treats absent as empty, which is
  // what makes the first command something other than "initialise". Any other error propagates —
  // an unreadable registry is a real problem and must not read as an empty one.
  readFile: (path) => {
    try {
      return readFileSync(path, "utf-8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw err;
    }
  },
  writeFile: (path, content) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  },
  out: (line) => process.stdout.write(line.endsWith("\n") ? line : `${line}\n`),
  err: (line) => process.stderr.write(line.endsWith("\n") ? line : `${line}\n`),
  registryPath: registryPath(),
  nowMs: Date.now(),
  env: process.env,
  // Random rather than a counter: two `org approve` invocations in the same millisecond are two
  // separate processes, and a per-process counter would collide across them. The queue is a
  // directory keyed by this id, so a collision would silently drop one person's decision.
  newId: (prefix) => `${prefix}-${randomUUID()}`,
  chart: built.chart,
});

process.exit(code);
