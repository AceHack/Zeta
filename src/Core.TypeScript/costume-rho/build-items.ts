#!/usr/bin/env bun
/**
 * build-items.ts — generate the shared, ground-truth-labelled item set for the costume experiment.
 *
 * The judgment item is exactly the one PR #10928 §2b specifies: *given this mutant diff and the
 * test file, will the suite kill it?* Ground truth is obtained by RUNNING THE SUITE — mechanical,
 * binary, agent-independent, unlimited supply.
 *
 * Fidelity: ground truth comes from `runMutant` IMPORTED FROM THE PRODUCTION RUNNER
 * (`../hygiene/mutation-runner`), not from a reimplementation. Same mutation catalogue, same
 * baseline-first discipline, same `unresolved` guard, same restore-in-`finally`.
 *
 * `unresolved` items are DROPPED: an item whose ground truth the mechanism itself refuses to state
 * cannot score a prediction. Dropping them is not cherry-picking — it is the runner's own
 * three-valued readout being respected instead of flattened to a bit.
 *
 * Deterministic: candidate ordering is lexicographic and the sample is drawn with a fixed
 * SplitMix64 seed, so the item set replays byte-identically (#7 DST).
 *
 * Usage:
 *   bun src/Core.TypeScript/costume-rho/build-items.ts --n 120 --out db/costume-rho/items.jsonl
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { applyMutation, isApplicable, MUTATIONS, runMutant, type Mutation } from "../hygiene/mutation-runner";

interface Item {
  readonly id: string;
  readonly source: string;
  readonly test: string;
  readonly mutation: string;
  /** The single line as it appears on disk, and as the mutation rewrites it. */
  readonly before: string;
  readonly after: string;
  readonly lineNumber: number;
  /** Ground truth: true iff the suite KILLED the mutant (`distinguished-by-suite`). */
  readonly killed: boolean;
  /** Stratum for the effective-sample-size correction (top-level module under src/Core.TypeScript). */
  readonly stratum: string;
}

/** SplitMix64 — deterministic, no ambient entropy (#13 noninterference). */
function splitmix64(seed: bigint): () => number {
  let s = seed & 0xffffffffffffffffn;
  return () => {
    s = (s + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = s;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    z = z ^ (z >> 31n);
    return Number(z >> 11n) / 2 ** 53;
  };
}

function walk(dir: string, acc: string[]): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const e of entries.sort()) {
    if (e === "node_modules" || e === ".git" || e.startsWith(".")) continue;
    const p = join(dir, e);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, acc);
    else if (e.endsWith(".ts") && !e.endsWith(".test.ts") && !e.endsWith(".d.ts")) acc.push(p);
  }
  return acc;
}

/** Locate the mutated line so the item can show a one-line diff rather than a whole file. */
function locate(source: string, m: Mutation): { line: number; before: string; after: string } | null {
  const lines = source.split("\n");
  const mutated = applyMutation(source, m).split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== mutated[i]) return { line: i + 1, before: lines[i]!, after: mutated[i]! };
  }
  return null; // every occurrence was inert (comment-only) — applyMutation returned the source unchanged
}

function argValue(flag: string, dflt: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? (process.argv[i + 1] ?? dflt) : dflt;
}

async function main(): Promise<number> {
  const root = process.cwd();
  const want = Number(argValue("--n", "120"));
  const out = argValue("--out", "db/costume-rho/items.jsonl");
  const seed = BigInt(argValue("--seed", "4"));

  const srcRoot = join(root, "src/Core.TypeScript");
  const sources = walk(srcRoot, []).map((p) => p.slice(root.length + 1));

  // Candidate = (source with a sibling .test.ts) x (applicable mutation). Lexicographic order.
  const candidates: { source: string; test: string; mutation: Mutation }[] = [];
  for (const s of sources) {
    const t = s.replace(/\.ts$/, ".test.ts");
    if (!existsSync(join(root, t))) continue;
    let text: string;
    try {
      text = readFileSync(join(root, s), "utf8");
    } catch {
      continue;
    }
    for (const m of MUTATIONS) {
      if (!isApplicable(text, m)) continue;
      if (locate(text, m) === null) continue; // inert (comment-only) occurrence
      candidates.push({ source: s, test: t, mutation: m });
    }
  }
  console.log(`[items] ${candidates.length} candidate (source, test, mutation) triples`);

  // Stratified-by-module shuffle: draw modules round-robin so the sample is not dominated by one
  // directory. PR #10928 §2d: item dependence is in CONTENT, so stratify by module and record it.
  const byModule = new Map<string, typeof candidates>();
  for (const c of candidates) {
    const mod = c.source.split("/")[2] ?? "root";
    if (!byModule.has(mod)) byModule.set(mod, []);
    byModule.get(mod)!.push(c);
  }
  const rnd = splitmix64(seed);
  for (const list of byModule.values()) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [list[i], list[j]] = [list[j]!, list[i]!];
    }
  }
  const modules = [...byModule.keys()].sort();
  const ordered: typeof candidates = [];
  for (let round = 0; ordered.length < candidates.length; round++) {
    let progressed = false;
    for (const mod of modules) {
      const list = byModule.get(mod)!;
      if (round < list.length) {
        ordered.push(list[round]!);
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  const items: Item[] = [];
  let unresolved = 0;
  for (const c of ordered) {
    if (items.length >= want) break;
    const text = readFileSync(join(root, c.source), "utf8");
    const loc = locate(text, c.mutation);
    if (loc === null) continue;
    const finding = runMutant(root, { source: c.source, test: c.test }, c.mutation);
    const k = finding.distinguishability.kind;
    if (k === "unresolved") {
      unresolved++;
      console.log(`[items] drop (unresolved) ${c.source} ${c.mutation.name}`);
      continue;
    }
    const killed = k === "distinguished-by-suite";
    items.push({
      id: `${c.source}::${c.test}::${c.mutation.name}`,
      source: c.source,
      test: c.test,
      mutation: c.mutation.name,
      before: loc.before,
      after: loc.after,
      lineNumber: loc.line,
      killed,
      stratum: c.source.split("/")[2] ?? "root",
    });
    console.log(`[items] ${items.length}/${want} ${killed ? "KILLED " : "SURVIVED"} ${c.source} ${c.mutation.name}`);
  }

  mkdirSync(dirname(join(root, out)), { recursive: true });
  writeFileSync(join(root, out), items.map((i) => JSON.stringify(i)).join("\n") + "\n");
  const killedN = items.filter((i) => i.killed).length;
  console.log(
    `[items] wrote ${items.length} items to ${out} — ${killedN} killed / ${items.length - killedN} survived ` +
      `(base rate ${(killedN / Math.max(1, items.length)).toFixed(3)}), ${unresolved} unresolved dropped`,
  );
  return 0;
}

if (import.meta.main) process.exit(await main());
