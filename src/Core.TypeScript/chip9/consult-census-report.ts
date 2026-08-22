/**
 * **The standing consult-path post-selection report.** `bun src/Core.TypeScript/chip9/consult-census-report.ts`
 *
 * Compares the verdict distribution of orbits **stored** in `db/emus/chip8/orbits/` against the verdict
 * distribution of orbits **read**, as recorded in the consult log. Matching distributions are consistent
 * with the "useful = the run continues" criterion measuring the world; over-representation of
 * non-fixed-point orbits among reads is the post-selection signature — the criterion measuring its own
 * filter. See `./consult-census.ts` for the statistic and its anchors, and register row R-1.
 *
 * **This measurement deliberately exists BEFORE the thing it measures.** As of 2026-08-17 no production
 * consult path is wired: `Chip8CrossRunStore.fastForward` has no non-test caller, because auto-consult is
 * a *metering* change (a memo hit is nearly free, so it silently changes what the tank pays for) and that
 * is a decision for the maintainer, not a caching tweak — work item 081M089ZPAY087G0R001MYXM7N §1. The
 * point of building the census first is to establish the property *before* consult is turned on, rather
 * than discover a bias afterwards when the read set is already skewed.
 *
 * **Exit code.** Non-zero only for a genuine failure — an unreadable/corrupt artifact, or a malformed
 * consult log. An ABSENT consult log is the expected state and exits 0 with the absence stated out loud:
 * failing there would train the fleet to ignore this check, and reporting "no skew detected" there would
 * be a check that never ran wearing the face of one that passed.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArtifact, type OrbitArtifact } from "./chip8-cross-run-store";
import {
  censusOf,
  eventsFromLog,
  nonFixedPointShares,
  parseConsultLog,
  report,
  total,
  type ReadEvent,
} from "./consult-census";

/** Walk up to the repo root (the directory holding `Zeta.sln`) — no hardcoded absolute path. */
function repoRoot(): string {
  let dir = import.meta.dir;
  for (;;) {
    if (existsSync(join(dir, "Zeta.sln"))) return dir;
    const up = dirname(dir);
    if (up === dir) throw new Error("could not locate repo root (Zeta.sln)");
    dir = up;
  }
}

const ROOT = repoRoot();
export const ORBITS_DIR = resolve(ROOT, "db/emus/chip8/orbits");
/**
 * Where a consult path must append. It lives OUTSIDE `orbits/` on purpose: the artifacts are immutable and
 * content-addressed, the log is append-only and fast-moving — different change rates, therefore different
 * storage shapes (DV2.0 / discipline #5).
 */
export const CONSULT_LOG = resolve(ROOT, "db/emus/chip8/consult-log.jsonl");

async function loadStored(): Promise<OrbitArtifact[]> {
  const names = readdirSync(ORBITS_DIR)
    .filter((n) => n.endsWith(".orbit.json"))
    .sort(); // codepoint order; no `localeCompare`
  const out: OrbitArtifact[] = [];
  for (const n of names) {
    const parsed = await parseArtifact(readFileSync(join(ORBITS_DIR, n), "utf-8"));
    if (!parsed.ok) {
      throw new Error(`${n}: ${parsed.feedback.code}: ${parsed.feedback.detail}`);
    }
    out.push(parsed.value);
  }
  return out;
}

function loadEvents(stored: readonly OrbitArtifact[]): { events: ReadEvent[]; wired: boolean } {
  if (!existsSync(CONSULT_LOG)) return { events: [], wired: false };
  const parsed = parseConsultLog(readFileSync(CONSULT_LOG, "utf-8"));
  if (!parsed.ok) throw new Error(`consult log malformed: ${parsed.detail}`);
  return { events: eventsFromLog(stored, parsed.value), wired: true };
}

async function main(): Promise<number> {
  const stored = await loadStored();
  const { events, wired } = loadEvents(stored);
  const c = censusOf(stored, events);

  console.log("CHIP-8 consult-path post-selection census (register row R-1)");
  console.log("");
  console.log(`stored artifacts: ${ORBITS_DIR} (${stored.length} verified)`);
  console.log(`consult log:      ${CONSULT_LOG}${wired ? "" : "  [ABSENT]"}`);
  console.log("");
  for (const line of report(c)) console.log(line);

  const g = nonFixedPointShares(c);
  console.log("");
  // `n/a`, never `0.000`, when nothing was read: a proportion of nothing is not a number, and printing
  // it as one turns an absence into an apparent skew away from continuation — the confusion this whole
  // census exists to prevent, committed by the census's own summary line.
  const readShare = total(c.read) === 0 ? "n/a" : g.read.toFixed(3);
  console.log(`non-fixed-point (cycle + open-at-bound) share: stored ${g.stored.toFixed(3)} | read ${readShare}`);

  if (!wired) {
    console.log("");
    console.log("NO CONSULT PATH IS WIRED. `Chip8CrossRunStore.fastForward` has no non-test caller, so no");
    console.log("orbit has ever been read in production and the read distribution is EMPTY, not unbiased.");
    console.log("This is an absence, not a pass: the census reports n/a rather than zero divergence, and it");
    console.log("will produce a real comparison the moment a consult path appends to the log above.");
    console.log("Enabling auto-consult is a METERING decision (a memo hit is nearly free) and is the");
    console.log("maintainer's — work item 081M089ZPAY087G0R001MYXM7N §1.");
  }
  return 0;
}

if (import.meta.main) {
  main()
    .then((code) => process.exit(code))
    .catch((e: unknown) => {
      console.error(`consult-census-report FAILED: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    });
}
