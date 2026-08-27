#!/usr/bin/env bun
/**
 * check-healer-oscillation.ts — run the oscillation registry over the Tier-0 healers in CI.
 *
 * WHY. `oscillation-registry.ts` landed with 17 falsifiers and zero callers. A tested module
 * nobody runs proves its own properties and constrains nothing — the same shape as a check that
 * cannot fail, and the fourth instance of it I have shipped in a day. This is the caller.
 *
 * WHAT THE HARNESS ALREADY COVERS, so this does not duplicate it. `healer-harness.ts` certifies
 * idempotence, closure and convergence of the COMPOSITE, in the one order `composeHealers` folds.
 * That establishes the composite reaches *a* fixed point. It never establishes it reaches *the*
 * fixed point — so the hardcoded order in `run-tier0.ts` can be silently load-bearing. Five
 * healers admit 120 orders and exactly one is certified.
 *
 * WHAT THIS ADDS. The pairwise relation, and only the two genuinely-defective ones fail:
 *
 *   disjoint / commutes  -> fine. Order cannot matter, or demonstrably does not.
 *   override             -> order IS load-bearing. Legal, but only once declared with a reason.
 *   oscillate            -> the composite never settles. Always a defect; no declaration excuses it.
 *
 * THE VACUITY GUARD IS THE REASON THIS IS SAFE TO GATE ON. A pair can only disagree on inputs both
 * of them touch, so a corpus that fires neither healer reports `disjoint` for everything and means
 * nothing. Measured 2026-08-27: the three BUILT-IN harness fixtures fire NONE of the Tier-0
 * healers — a registry built from them alone would be a green check over an empty experiment. So
 * this refuses to pass on a corpus that fired nothing, and the refusal is the point.
 *
 * TODAY IT SHOULD BE ALL-DISJOINT, HEIGHT 1. That is a property of this ROSTER, not of the
 * harness: the five happen to act on `.js` siblings, workflow YAML, TS imports, TS spreads and doc
 * links. The first healer added whose write-set overlaps an existing one is where this earns its
 * keep — and the harness's own test file already proves order-dependence is reachable
 * ("composition order decides legality").
 */

import { readdirSync, readFileSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { BUILTIN_FIXTURES, type FileTree, type Healer } from "./healer-harness.ts";
import { buildRegistry, isClean, renderReport, type DeclaredEdge } from "./oscillation-registry.ts";
import { staleJsHealer } from "./healers/stale-js.ts";
import { unpinnedActionsHealer } from "./healers/unpinned-actions.ts";
import { unusedImportHealer } from "./healers/unused-import.ts";
import { exactOptionalHealer } from "./healers/exact-optional-spread.ts";
import { staleDocCrossRefHealer } from "./healers/stale-doc-cross-ref.ts";

/** The Tier-0 roster, in `run-tier0.ts`'s composition order. */
export const TIER0: readonly Healer[] = [
  staleJsHealer,
  unpinnedActionsHealer,
  unusedImportHealer,
  exactOptionalHealer,
  staleDocCrossRefHealer,
];

/**
 * Declared priority edges. EMPTY, and that is a measurement rather than an omission: every pair is
 * `disjoint` today, so there is no order to declare. An entry here must carry a reason — an
 * undocumented ordering is exactly what this check exists to surface.
 */
export const DECLARED_EDGES: readonly DeclaredEdge[] = [];

/** Real repo files across every surface the roster touches. Bounded so CI stays cheap. */
export function sampleRepo(root: string, caps: Readonly<Record<string, number>>): FileTree {
  const out = new Map<string, string>();
  // NO existsSync GATE and NO SECOND statSync -- both were here in the first draft and the repo's
  // own `lint-check-then-use-file-races` caught them, which is the linter working on its author.
  //
  // `existsSync(dir)` before `readdirSync(dir)` is a check-then-use race: the answer is already
  // stale when the use runs, and `readdirSync` reports absence perfectly well by throwing. And
  // `readdir` then `statSync` on each entry asks the filesystem a question the LISTING ALREADY
  // ANSWERED -- `withFileTypes` hands back the kind with the name, so there is no second syscall
  // to race against.
  const walk = (dir: string, exts: readonly string[], cap: number, taken: { n: number }): void => {
    if (taken.n >= cap) return;
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // absent or unreadable: one syscall, one answer.
    }
    for (const e of entries) {
      if (taken.n >= cap) return;
      if (e.name === "node_modules" || e.name === ".git" || e.name === "prior-art") continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full, exts, cap, taken);
      else if (e.isFile() && exts.some((x) => e.name.endsWith(x))) {
        try {
          out.set(full.slice(root.length + 1), readFileSync(full, "utf8"));
          taken.n += 1;
        } catch {
          /* unreadable file is not a finding here */
        }
      }
    }
  };
  walk(join(root, "src/Core.TypeScript/hygiene"), [".ts"], caps["ts"] ?? 120, { n: 0 });
  walk(join(root, ".github/workflows"), [".yml"], caps["yml"] ?? 60, { n: 0 });
  walk(join(root, "docs/DECISIONS"), [".md"], caps["md"] ?? 40, { n: 0 });
  return out;
}

/**
 * A tree built to trigger every healer, including ones the repo happens not to exercise today.
 *
 * Needed because the real sample cannot be relied on to contain, say, a stale `.js` sibling — and
 * a pair that never fires yields a verdict that means nothing. This is a FIXTURE, not a claim
 * about the repo.
 */
export function triggerTree(): FileTree {
  return new Map<string, string>([
    ["src/a.ts", 'import { unused } from "./b.ts";\nimport { used } from "./c.ts";\nexport const x = used;\n'],
    ["src/a.js", "// stale sibling of a.ts\n"],
    [".github/workflows/w.yml", "jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n"],
    ["src/opt.ts", "const o: { a?: string } = {};\nexport const p = { ...o, a: undefined };\n"],
    ["docs/d.md", "See [gone](../src/removed.ts) and [a](../src/a.ts).\n"],
  ]);
}

export function main(root: string, log: (s: string) => void): number {
  const corpus = [
    ...BUILTIN_FIXTURES.map((f) => ({ name: f.name, tree: f.tree })),
    { name: "real-repo-sample", tree: sampleRepo(root, {}) },
    { name: "trigger-fixture", tree: triggerTree() },
  ];
  const report = buildRegistry(TIER0, corpus, DECLARED_EDGES);
  log(renderReport(report));

  // VACUITY FIRST. A registry whose pairs never fired is a green check over an empty experiment,
  // and it would pass every other assertion below. Refusing here is what stops this becoming the
  // thing it was written to prevent.
  const everyPairVacuous = report.vacuousPairs.length === report.verdicts.length;
  if (everyPairVacuous) {
    log("");
    log("REFUSED: no pair fired on any corpus entry. Every verdict is vacuous, so this check");
    log("constrains nothing. Fix the corpus, not this message.");
    return 2;
  }

  if (!isClean(report)) {
    log("");
    if (report.oscillating.length > 0) {
      log("An oscillating pair never reaches a fixed point. It cannot be declared away — the two");
      log("healers must be merged, or one of them narrowed so they stop contending.");
    }
    if (report.undeclaredOverrides.length > 0) {
      log("An undeclared override means the order in run-tier0.ts is load-bearing and undocumented.");
      log("Add a DeclaredEdge with a reason in check-healer-oscillation.ts, or make the pair commute.");
    }
    return 1;
  }

  log("");
  log(`OK — ${String(report.verdicts.length)} pair(s), DAG height ${String(report.dagHeight)}.`);
  if (report.dagHeight === 1) {
    log("Height 1 is an antichain: the roster composes as a SET, and run-tier0's order is not");
    log("load-bearing today. That is a property of THIS roster, not a guarantee of the harness.");
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main(join(import.meta.dir, "..", "..", ".."), (s) => console.log(s)));
}
