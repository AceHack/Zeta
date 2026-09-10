/**
 * cross-verify.ts — the TypeScript and F# oracles for the H3 rank-3 geometry, judged against
 * one committed canonical document.
 *
 * Two independent constructions of the same mathematics emit the SAME text, and the falsifier
 * is byte equality — no parser on either side, because a lenient comparison is a check that can
 * fail to fail. The committed `h3-rank3-geometry.golden.json` is the treaty;
 * `emit-golden.ts --write` regenerates it.
 *
 * The F# side is `#load`ed from the shipped modules by `h3-rank3-geometry-oracle.fsx`, so this
 * harness compares two implementations rather than comparing one implementation to a copy of
 * itself.
 *
 * Three assertions, and the third is the one that matters:
 *   1. TypeScript reproduces the committed document byte for byte;
 *   2. F# reproduces the committed document byte for byte;
 *   3. the two oracles agree with each other.
 *
 * The independence being measured, stated so a reader can judge how much (3) is worth:
 * facets come from an exhaustive supporting-plane search over every vertex triple in F# and
 * from an argmax over the 62 derived weight-orbit directions in TypeScript; `zSqrt` searches
 * `p` and solves for `q` in F# and searches `q` and solves for `p` in TypeScript; facet cyclic
 * order is an angular comparator in F# and a gift-wrap in TypeScript; the orbit closure is a
 * worklist stack in F# and breadth-first rounds in TypeScript. Everything else is shared
 * mathematics, so agreement is evidence in proportion to those four and no more.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { emitGolden } from "./emit-golden.ts";

const REPOSITORY_ROOT = resolve(import.meta.dir, "../../..");
const GOLDEN_PATH = join(import.meta.dir, "h3-rank3-geometry.golden.json");
const F_SHARP_ORACLE = join(import.meta.dir, "h3-rank3-geometry-oracle.fsx");

/** The declared dotnet: the one on PATH if it runs, else the one mise declares. */
function resolveDotnet(): string {
  const direct = spawnSync("dotnet", ["--version"], { cwd: REPOSITORY_ROOT, encoding: "utf8" });
  if (direct.status === 0) return "dotnet";
  const declared = spawnSync("mise", ["which", "dotnet"], { cwd: REPOSITORY_ROOT, encoding: "utf8" });
  if (declared.status !== 0) throw new Error("declared dotnet is unavailable");
  return declared.stdout.trim();
}

function runFSharp(): string {
  const child = spawnSync(resolveDotnet(), ["fsi", "--nologo", F_SHARP_ORACLE], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    timeout: 600_000,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: "1" },
  });
  if (child.error !== undefined || child.status !== 0) {
    throw new Error(
      `h3-rank3-geometry F# oracle failed: ${child.error?.message ?? (child.stderr || child.stdout)}`,
    );
  }
  return child.stdout.replace(/\r\n/g, "\n");
}

/** First differing line, so a failure names the quantity rather than dumping the document. */
function firstDifference(left: string, right: string): string {
  const a = left.split("\n");
  const b = right.split("\n");
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) return `line ${i + 1}:\n  expected: ${a[i] ?? "<end>"}\n  actual:   ${b[i] ?? "<end>"}`;
  }
  return "documents differ only in length";
}

const committed = readFileSync(GOLDEN_PATH, "utf8").replace(/\r\n/g, "\n");
const typescript = emitGolden();
const fsharp = runFSharp();

let failures = 0;

if (typescript !== committed) {
  process.stderr.write(
    `TypeScript oracle disagrees with the committed golden vector\n${firstDifference(committed, typescript)}\n`,
  );
  failures++;
}

if (fsharp !== committed) {
  process.stderr.write(
    `F# oracle disagrees with the committed golden vector\n${firstDifference(committed, fsharp)}\n`,
  );
  failures++;
}

if (typescript !== fsharp) {
  process.stderr.write(`the two oracles disagree with each other\n${firstDifference(typescript, fsharp)}\n`);
  failures++;
}

const lines = committed.split("\n").length;
process.stdout.write(
  `h3-rank3-geometry cross-verification:\n` +
    `  committed document: ${String(lines)} lines, ${String(committed.length)} bytes\n` +
    `  TypeScript oracle: ${typescript === committed ? "byte-identical" : "MISMATCH"}\n` +
    `  F# oracle:         ${fsharp === committed ? "byte-identical" : "MISMATCH"}\n` +
    `  oracle vs oracle:  ${typescript === fsharp ? "byte-identical" : "MISMATCH"}\n` +
    `failures ${String(failures)}\n`,
);

if (failures > 0) process.exit(1);
