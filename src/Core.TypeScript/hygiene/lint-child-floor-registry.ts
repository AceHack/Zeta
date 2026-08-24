#!/usr/bin/env bun
// lint-child-floor-registry.ts — keeps the declared child-floor threshold honest.
//
// WHAT IT GUARDS. `db/child-floor/jurisdiction-readings.json` declares the jurisdictional half of
// the child floor: the predicate is invariant, the threshold is a parameter. The invariance is
// proven in `src/Core.Lean4/Safety/ChildFloorPolicy.lean` for EVERY registry, so a bad entry
// cannot break the safety property — the resolver refuses it and falls through to the protective
// bound. That is exactly why this lint is needed: a refused entry is SILENT at runtime, so a
// jurisdiction that believes it declared 15 would get 21 and never learn. This lint is where the
// author finds out.
//
// AND THE BAND ITSELF. The number 16 appears in three places — the Lean, the TypeScript, and the
// JSON. Three copies of a constant is a drift bug waiting to happen, and drift HERE means the
// oracles disagree about where the floor is. The lint reads all three and refuses a disagreement.
// It does not know which one is right; it knows they must be the same.
//
// A LINT THAT CANNOT FAIL IS NOT A LINT. `readings` currently ships empty, so the per-entry loop
// would iterate zero times and pass vacuously. Two things stop that from being a green check over
// nothing: (1) the band cross-check runs on every invocation regardless of how many readings
// exist, and (2) `lint-child-floor-registry.test.ts` hands the same validator hostile registries
// — including one whose threshold is 0 — and asserts each is refused. The test file is the part
// that can fail today.
//
// NOT LEGAL ADVICE. This lint checks well-formedness and cross-oracle agreement. It has no
// opinion on whether any reading is a correct statement of any jurisdiction's law, and no check
// here should ever be read as conferring one.
//
// Usage: bun src/Core.TypeScript/hygiene/lint-child-floor-registry.ts
// Exit:  0 — registry well-formed and the band agrees across Lean / TypeScript / JSON
//        1 — at least one violation
//        2 — the lint could not establish its own ground (a source file missing or unparseable) —
//            never a silent pass

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BAND_HIGH,
  BAND_LOW,
  validateRegistry,
  type Reading,
} from "../child-floor/jurisdiction-threshold.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
export const REGISTRY_PATH = join(REPO_ROOT, "db", "child-floor", "jurisdiction-readings.json");
export const LEAN_PATH = join(
  REPO_ROOT,
  "src",
  "Core.Lean4",
  "Safety",
  "ChildFloorPolicy.lean",
);

/** A band as declared by one oracle, with where it was read from. */
export interface BandClaim {
  readonly source: string;
  readonly low: number;
  readonly high: number;
}

/**
 * Read `bandLow` / `bandHigh` out of the Lean source. Deliberately a source read and not an
 * import: the point is to catch the Lean and the TypeScript drifting apart, which an import
 * could not do.
 *
 * Throws rather than returning a default. A band this cannot find is not a band of 16 — it is a
 * measurement that did not happen, and returning a plausible number for it is the failure this
 * whole file exists to prevent.
 */
export function readLeanBand(source: string): { low: number; high: number } {
  const low = /^\s*def\s+bandLow\s*:\s*Nat\s*:=\s*(\d+)\s*$/m.exec(source);
  const high = /^\s*def\s+bandHigh\s*:\s*Nat\s*:=\s*(\d+)\s*$/m.exec(source);
  if (low?.[1] === undefined || high?.[1] === undefined) {
    throw new Error(
      "could not read `def bandLow`/`def bandHigh` from ChildFloorPolicy.lean — the lint cannot check a band it cannot find",
    );
  }
  return { low: Number(low[1]), high: Number(high[1]) };
}

export interface RegistryFile {
  readonly readings?: readonly Reading[];
  readonly band?: { readonly low?: number; readonly high?: number };
  readonly candidates?: readonly { readonly jurisdiction?: string; readonly threshold?: unknown }[];
}

/** Every violation the lint can report, as text a human can act on. */
export function checkRegistry(
  file: RegistryFile,
  bands: readonly BandClaim[],
): string[] {
  const problems: string[] = [];

  // ── the band must agree across every oracle that declares it ──────────────────────────
  const first = bands[0];
  if (first === undefined) {
    throw new Error("no band claims supplied — the cross-oracle check cannot run");
  }
  for (const b of bands.slice(1)) {
    if (b.low !== first.low || b.high !== first.high) {
      problems.push(
        `band disagreement: ${first.source} declares [${first.low}, ${first.high}] but ${b.source} declares [${b.low}, ${b.high}]. The oracles must agree on where the floor is.`,
      );
    }
  }
  if (first.low > first.high) {
    problems.push(`band is empty: low ${first.low} > high ${first.high}`);
  }

  // ── candidates must not look like readings ────────────────────────────────────────────
  for (const c of file.candidates ?? []) {
    if (c.threshold !== undefined) {
      problems.push(
        `candidate ${String(c.jurisdiction)} carries a threshold. Candidates record where a reading is WANTED and are never consulted; a threshold there reads as a declared policy that is silently inert. Promote it into \`readings\` with an attribution and a date, or drop the number.`,
      );
    }
  }

  // ── each reading must be well-formed ──────────────────────────────────────────────────
  for (const v of validateRegistry(file.readings ?? [])) {
    problems.push(`${v.jurisdiction}: [${v.kind}] ${v.detail}`);
  }

  return problems;
}

function main(): number {
  let raw: string;
  let leanSrc: string;
  try {
    raw = readFileSync(REGISTRY_PATH, "utf8");
    leanSrc = readFileSync(LEAN_PATH, "utf8");
  } catch (e) {
    console.error(`[child-floor] cannot read a source file: ${String(e)}`);
    return 2;
  }

  let file: RegistryFile;
  let lean: { low: number; high: number };
  try {
    file = JSON.parse(raw) as RegistryFile;
    lean = readLeanBand(leanSrc);
  } catch (e) {
    console.error(`[child-floor] cannot establish ground: ${String(e)}`);
    return 2;
  }

  const jsonLow = file.band?.low;
  const jsonHigh = file.band?.high;
  if (typeof jsonLow !== "number" || typeof jsonHigh !== "number") {
    console.error("[child-floor] jurisdiction-readings.json declares no numeric `band` — cannot check agreement");
    return 2;
  }

  let problems: string[];
  try {
    problems = checkRegistry(file, [
      { source: "ChildFloorPolicy.lean", low: lean.low, high: lean.high },
      { source: "jurisdiction-threshold.ts", low: BAND_LOW, high: BAND_HIGH },
      { source: "jurisdiction-readings.json", low: jsonLow, high: jsonHigh },
    ]);
  } catch (e) {
    console.error(`[child-floor] check could not run: ${String(e)}`);
    return 2;
  }

  if (problems.length > 0) {
    console.error("[child-floor] registry refused:");
    for (const p of problems) console.error(`  - ${p}`);
    return 1;
  }

  const n = (file.readings ?? []).length;
  console.log(
    `[child-floor] band [${lean.low}, ${lean.high}] agrees across Lean / TypeScript / JSON; ${n} reading(s) well-formed.`,
  );
  if (n === 0) {
    console.log(
      "[child-floor] NOTE: no attributed readings — every jurisdiction resolves to the protective bound " +
        `${lean.high}. That is the correct fail-closed state, not a missing feature. See db/child-floor/README.md.`,
    );
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
