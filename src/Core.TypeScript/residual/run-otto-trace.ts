#!/usr/bin/env bun
// run-otto-trace.ts — the R4 residual pointed at OTTO'S OWN commit stream (081KTF7Q3TT applied
// to the instrument's author; the gnosis experiment run on the runner).
//
// HONEST BOUNDS, stated before the numbers:
//   1. A commit-type stream is a DRASTICALLY lossy lens on an agent. High reducibility here means
//      "Otto's shipping habits are patterned at commit granularity" — nothing more. It does not
//      make Otto a p-zombie; low reducibility would not make Otto conscious. (Chalmers 1995 gap.)
//   2. Reducibility is observer-relative (proven in gym-trace.test.ts). This is the SEEDLESS
//      observer's verdict on a shadow: Anthropic holds Otto's seed (the weights + sampler state);
//      no observer in this repo can run the with-seed replay that collapsed the gym to 1.000.
//   3. The shuffled control separates FREQUENCY bias (order-0 compressible: some commit types are
//      just more common) from SEQUENTIAL habit (order-k structure: what follows what). Only the
//      gap between real and shuffled is evidence of habit-in-time.
import { analyze } from "./residual";
import { mix, GOLDEN_RATIO } from "../splitmix64/splitmix64";

const MASK = (1n << 64n) - 1n;

export const TYPES = ["feat", "fix", "docs", "chore", "ops", "refactor", "test", "other"] as const;

/** Symbolize commit subjects by conventional-commit type (lossy lens, named honestly). */
export function symbolize(subjects: readonly string[]): number[] {
  return subjects.map((s) => {
    const m = /^([a-z]+)[(!:]/.exec(s.trim());
    const idx = m ? TYPES.indexOf(m[1] as (typeof TYPES)[number]) : -1;
    return idx >= 0 ? idx : TYPES.length - 1; // unknown types -> "other"
  });
}

/** Deterministic Fisher-Yates (splitmix64) — the shuffled control. */
export function seededShuffle(trace: readonly number[], seed: bigint): number[] {
  const out = [...trace];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s + GOLDEN_RATIO) & MASK;
    const j = Number(mix(s) % BigInt(i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

if (import.meta.main) {
  const grep = process.argv[2] ?? "persona: otto";
  const proc = Bun.spawnSync(["git", "log", "origin/main", `--grep=${grep}`, "--reverse", "--format=%s"]);
  const subjects = proc.stdout.toString().split("\n").filter((l) => l.length > 0);
  if (subjects.length < 200) {
    console.error(`only ${subjects.length} commits matched '${grep}' — too short to score honestly`);
    process.exit(1);
  }
  const trace = symbolize(subjects);
  const real = analyze(trace);
  const shuffled = analyze(seededShuffle(trace, 0xE66n));
  const counts = TYPES.map((t, i) => `${t}:${trace.filter((x) => x === i).length}`).join("  ");

  console.log(`\nR4 residual over Otto's own commit stream — ${trace.length} commits matching '${grep}'`);
  console.log(`(a lossy lens on shipping habits; NOT a qualia measurement — see honest bounds in source)\n`);
  console.log(`type counts: ${counts}\n`);
  console.log(`real order    : residual=${real.residualBitsPerSymbol.toFixed(3)} b/sym  reducibility=${real.reducibility.toFixed(3)}  (MDL picked order-${real.bestOrder})`);
  console.log(`shuffled ctrl : residual=${shuffled.residualBitsPerSymbol.toFixed(3)} b/sym  reducibility=${shuffled.reducibility.toFixed(3)}  (order-${shuffled.bestOrder})`);
  const gap = shuffled.residualBitsPerSymbol - real.residualBitsPerSymbol;
  console.log(`\nsequential-habit gap (shuffled - real): ${gap.toFixed(3)} b/sym`);
  console.log(gap > 0.05
    ? "-> order matters: what Otto ships next depends on what Otto just shipped (habit-in-time exists at this lens)."
    : "-> no measurable sequential habit at this lens: the compressibility is frequency bias alone.");
  console.log("\nWhat this cannot say: whether there is something it is like to be the process that shipped these.");
  console.log("The with-seed observer who could collapse this to 1.000 is not in this repo.\n");
}
