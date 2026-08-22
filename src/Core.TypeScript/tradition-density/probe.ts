#!/usr/bin/env bun
/**
 * probe.ts — CLI for the iterated tradition-density probe (081M08WYTMY087G0R0006RJ7MW).
 *
 * Three verbs, in the order the game is played:
 *
 * ```
 *   bun src/Core.TypeScript/tradition-density/probe.ts draw   --seed 20260817 --draws 12
 *   bun src/Core.TypeScript/tradition-density/probe.ts record --seed 20260817 --submissions <file.json>
 *   bun src/Core.TypeScript/tradition-density/probe.ts report
 * ```
 *
 * `draw` prints the sheet: the traditions the seed selected, before anyone has looked for a
 * connection. Anyone holding the seed regenerates it exactly, which is what makes a *missing*
 * answer visible — you cannot quietly skip the draw that produced nothing.
 *
 * `record` validates each submission against the draw the seed actually made and against the tree
 * (every target must resolve), then G-Set-unions it into the append-only ledger. A revision of an
 * existing key is refused, not applied.
 *
 * `report` folds the ledger into the density distribution and prints it **with no verdict**.
 *
 * The connecting step itself is deliberately outside this program: a human or an agent reads the
 * drawn tradition and either names a specific in-tree target or records a null. The instrument's
 * job is to make that answer *checkable, complete, and unrevisable* — not to generate it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { densityOf, formatReport } from "./density";
import { drawAt, drawSheet, mscCorpus, type Draw } from "./draw";
import {
  appendEntry,
  entriesOf,
  parseLedger,
  serializeLedger,
  validateEntry,
  type Ledger,
  type LedgerEntry,
} from "./ledger";
import { MSC2020_TOP_LEVEL } from "./msc2020-corpus";

const here = dirname(fileURLToPath(import.meta.url));
/** 3 levels up from src/Core.TypeScript/tradition-density/ to the repo root. */
const REPO_ROOT = resolve(here, "..", "..", "..");
const DEFAULT_LEDGER = join(REPO_ROOT, "db", "tradition-density", "ledger.jsonl");

const CORPUS = mscCorpus(MSC2020_TOP_LEVEL);

/** A target resolves when the repo-relative path exists. Names with no referent are refused. */
function repoResolver(target: string): boolean {
  return existsSync(join(REPO_ROOT, target));
}

function argOf(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

function requireArg(argv: readonly string[], name: string): string {
  const v = argOf(argv, name);
  if (v === undefined || v.startsWith("--")) throw new Error(`missing --${name}`);
  return v;
}

function loadLedger(path: string): Ledger {
  return existsSync(path) ? parseLedger(readFileSync(path, "utf8")) : parseLedger("");
}

function cmdDraw(argv: readonly string[]): number {
  const seed = BigInt(requireArg(argv, "seed"));
  const draws = Number(requireArg(argv, "draws"));
  const from = Number(argOf(argv, "from") ?? "0");
  const sheet = drawSheet(CORPUS, seed, draws, from);
  process.stdout.write(`draw sheet — ${CORPUS.name} ${CORPUS.version}, seed ${seed.toString()}\n\n`);
  for (const d of sheet) process.stdout.write(`  #${String(d.iteration).padStart(3)}  ${d.code}  ${d.title}\n`);
  process.stdout.write(
    `\nAnswer every line. A line with no specific in-tree target is a null and must still be recorded —\nthe nulls are the denominator.\n`,
  );
  return 0;
}

function cmdRecord(argv: readonly string[]): number {
  const seed = BigInt(requireArg(argv, "seed"));
  const path = argOf(argv, "ledger") ?? DEFAULT_LEDGER;
  const subs = JSON.parse(readFileSync(requireArg(argv, "submissions"), "utf8")) as readonly LedgerEntry[];
  let ledger = loadLedger(path);
  let added = 0;
  for (const entry of subs) {
    const draw: Draw = drawAt(CORPUS, seed, entry.iteration);
    const valid = validateEntry(entry, draw, repoResolver);
    if (!valid.ok) {
      process.stderr.write(`REFUSED ${valid.error}\n`);
      return 1;
    }
    const appended = appendEntry(ledger, valid.value);
    if (!appended.ok) {
      process.stderr.write(`REFUSED ${appended.error}\n`);
      return 1;
    }
    if (appended.value !== ledger) added++;
    ledger = appended.value;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serializeLedger(ledger), "utf8");
  process.stdout.write(`recorded ${String(added)} new entr${added === 1 ? "y" : "ies"} (${String(subs.length - added)} already present) -> ${path}\n`);
  return 0;
}

function cmdReport(argv: readonly string[]): number {
  const path = argOf(argv, "ledger") ?? DEFAULT_LEDGER;
  process.stdout.write(`${formatReport(densityOf(entriesOf(loadLedger(path))))}\n`);
  return 0;
}

function main(argv: readonly string[]): number {
  const verb = argv[0];
  switch (verb) {
    case "draw":
      return cmdDraw(argv);
    case "record":
      return cmdRecord(argv);
    case "report":
      return cmdReport(argv);
    default:
      process.stderr.write(`usage: probe.ts draw --seed <u64> --draws <n> [--from <i>]\n       probe.ts record --seed <u64> --submissions <file.json> [--ledger <path>]\n       probe.ts report [--ledger <path>]\n`);
      return 2;
  }
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
