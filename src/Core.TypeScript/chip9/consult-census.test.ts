/**
 * Falsifiers for the CHIP-8 consult-path post-selection census (register row R-1, Aaron 2026-08-17).
 *
 * The write path is already known not to post-select — `Verdict` keeps `open-at-bound` distinct from
 * `closed`, and `terminalKind` keeps `halt` / `awaiting-input` / `cycle` apart — so `CENSUS-0` pins that
 * rather than assuming it. The open question is the READ path, and the load-bearing test is `CENSUS-4`:
 * a census that cannot see a deliberately skewed read distribution is the vacuity class.
 *
 * Parity with `src/Core/Chip8ConsultCensus.fs` and `tests/Tests.FSharp/Chip8ConsultCensus.Tests.fs`.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseArtifact, type OrbitArtifact, type Verdict } from "./chip8-cross-run-store";
import {
  ALL_BUCKETS,
  bucketOf,
  censusOf,
  consultLogKey,
  eventsFromLog,
  isFixedPoint,
  nonFixedPointShares,
  parseConsultLog,
  report,
  shareDeltas,
  sharesIdentical,
  total,
  totalVariation,
  type ReadEvent,
} from "./consult-census";
import { ORBITS_DIR } from "./consult-census-report";

const HALT: Verdict = { kind: "closed", mu: 4, lambda: 1, terminal: "halt" };
const STALL: Verdict = { kind: "closed", mu: 16, lambda: 1, terminal: "awaiting-input" };
const CYCLE: Verdict = { kind: "closed", mu: 3, lambda: 5, terminal: "cycle" };
const OPEN: Verdict = { kind: "open-at-bound", maxSteps: 64 };

/** Only `key` and `verdict` are read by the census; the rest is deliberately minimal. */
function artifactWith(tag: string, verdict: Verdict): OrbitArtifact {
  return {
    schema: "zeta.chip8.cross-run-orbit.v1",
    key: {
      romSha256: tag.padEnd(64, "0"),
      seedHex: "0000000000000000",
      loadAddrHex: "0200",
      dialect: "chip8",
      stepMapVersion: "chip8cow-step-v1",
    },
    budget: { maxSteps: 64, attribution: "consult-census.test: fixture bound, not a claim about any ROM" },
    verdict,
    checkpoints: [],
    firstFaultStep: null,
    bodyDigest: "",
  };
}

const halted = artifactWith("aa", HALT);
const stalled = artifactWith("bb", STALL);
const cycling = artifactWith("cc", CYCLE);
const openOrbit = artifactWith("dd", OPEN);
const allFour = [halted, stalled, cycling, openOrbit];

const hit = (v: Verdict): ReadEvent => ({ kind: "hit", verdict: v });
const miss: ReadEvent = { kind: "miss" };

describe("consult-path post-selection census", () => {
  it("CENSUS-0: the WRITE path keeps endings and budget exhaustion in DISTINCT buckets", () => {
    // If `open-at-bound` and `closed` collapsed, or the three terminal kinds did, the stored set would
    // already be post-selected and no read-side census could recover the difference.
    expect(allFour.map((a) => bucketOf(a.verdict))).toEqual([...ALL_BUCKETS]);
    expect(new Set(allFour.map((a) => bucketOf(a.verdict))).size).toBe(4);
    expect(ALL_BUCKETS.filter(isFixedPoint)).toEqual(["halt", "awaiting-input"]);
  });

  it("CENSUS-2: reading every stored orbit once reports zero divergence", () => {
    const c = censusOf(allFour, allFour.map((a) => hit(a.verdict)));
    expect(sharesIdentical(c)).toBe(true);
    expect(totalVariation(c)).toBe(0);
    expect(c.misses).toBe(0);
  });

  it("CENSUS-2b: a read set that is a SCALED copy of the stored set is also identical", () => {
    const c = censusOf(allFour, allFour.flatMap((a) => [hit(a.verdict), hit(a.verdict), hit(a.verdict)]));
    expect(sharesIdentical(c)).toBe(true);
    expect(totalVariation(c)).toBe(0);
  });

  it("CENSUS-3: an empty read set reports n/a, NOT agreement", () => {
    // The check-that-did-not-run masquerading as one that passed. With no consult path wired this is the
    // case that actually occurs, so it must not read as "no post-selection detected".
    const c = censusOf(allFour, []);
    expect(Number.isNaN(totalVariation(c))).toBe(true);
    expect(sharesIdentical(c)).toBe(false);
    expect(total(c.read)).toBe(0);
  });

  it("CENSUS-3b: misses are counted but contribute to NO bucket", () => {
    const c = censusOf(allFour, [hit(CYCLE), miss, miss]);
    expect(c.misses).toBe(2);
    expect(total(c.read)).toBe(1);
  });

  it("CENSUS-3c: an empty read set prints n/a in the delta column, not a fabricated skew", () => {
    // `share` of an empty tally is 0, so a naive report renders "delta -0.400" for a read set that does
    // not exist — an ABSENCE dressed as a measured skew away from endings. Caught live on the first run
    // of consult-census-report.ts against the committed artifacts.
    const joined = report(censusOf(allFour, [])).join("\n");
    expect(joined).toContain("delta   n/a");
    expect(joined).not.toContain("delta -0.");
    expect(joined).toContain("total variation = n/a (one side empty)");
  });

  it("CENSUS-4: a read set post-selected for NON-terminating orbits is detected", () => {
    // The deliberate skew: the store holds all four verdicts, but the reader only ever asks for orbits
    // that keep going. If this cannot be separated from CENSUS-2, "useful = the run continues" would be
    // measuring its own filter and nothing would say so.
    const c = censusOf(allFour, [hit(CYCLE), hit(OPEN), hit(CYCLE), hit(OPEN)]);
    expect(sharesIdentical(c)).toBe(false);
    // stored (0.25, 0.25, 0.25, 0.25) vs read (0, 0, 0.5, 0.5) -> d_TV = 0.5
    expect(totalVariation(c)).toBeCloseTo(0.5, 12);

    const d = new Map(shareDeltas(c));
    expect(d.get("halt")!).toBeLessThan(0);
    expect(d.get("awaiting-input")!).toBeLessThan(0);
    expect(d.get("cycle")!).toBeGreaterThan(0);
    expect(d.get("open-at-bound")!).toBeGreaterThan(0);

    const g = nonFixedPointShares(c);
    expect(g.stored).toBeCloseTo(0.5, 12);
    expect(g.read).toBeCloseTo(1.0, 12);
  });

  it("CENSUS-4b: the OPPOSITE skew is detected too — the instrument is not one-sided", () => {
    // Dual-use: the census reports the neutral fact "these differ", never the verdict "someone
    // post-selected for continuation". A read set skewed toward endings must register equally.
    const c = censusOf(allFour, [hit(HALT), hit(STALL)]);
    expect(sharesIdentical(c)).toBe(false);
    expect(totalVariation(c)).toBeCloseTo(0.5, 12);
    expect(nonFixedPointShares(c).read).toBe(0);
  });

  it("CENSUS-4c: a skew WITHIN the fixed-point group is invisible to the two-bucket view, visible to the four", () => {
    // Why the four-bucket distribution is primary and the fixed-point grouping is derived.
    const c = censusOf([halted, stalled], [hit(HALT), hit(HALT), hit(HALT), hit(HALT)]);
    const g = nonFixedPointShares(c);
    expect(g.read).toBe(g.stored); // coarse view: identical
    expect(sharesIdentical(c)).toBe(false); // fine view: not identical
    expect(totalVariation(c)).toBeCloseTo(0.5, 12);
  });

  it("CENSUS-5: the smallest possible skew is still reported — there is no tolerance band", () => {
    // An audit merged 2026-08-17 (#11534) found 112 unattributed gating constants. This module answers by
    // having none: exact integer cross-multiplication, so one count out of 101 is reported, not absorbed.
    const stored = [...Array(100).fill(cycling), halted] as OrbitArtifact[];
    const events = Array(101).fill(hit(CYCLE)) as ReadEvent[];
    const c = censusOf(stored, events);
    expect(sharesIdentical(c)).toBe(false);
    expect(totalVariation(c)).toBeGreaterThan(0);
  });

  it("CENSUS-6: the consult log carries only the KEY, so it cannot lie about a verdict", () => {
    const log = [{ key: consultLogKey(cycling.key) }, { key: consultLogKey(halted.key) }, { key: "a-key-nobody-stored" }];
    const events = eventsFromLog(allFour, log);
    expect(events.map((e) => e.kind)).toEqual(["hit", "hit", "miss"]);
    const c = censusOf(allFour, events);
    expect(c.read.cycle).toBe(1);
    expect(c.read.halt).toBe(1);
    expect(c.misses).toBe(1);
  });

  it("CENSUS-6b: a malformed consult log is REFUSED, never silently skipped", () => {
    expect(parseConsultLog('{"key":"k1"}\n\n{"key":"k2"}\n').ok).toBe(true);
    const bad = parseConsultLog('{"key":"k1"}\nnot json\n');
    expect(bad.ok).toBe(false);
    const noKey = parseConsultLog('{"notkey":1}\n');
    expect(noKey.ok).toBe(false);
  });
});

describe("the census over the REAL committed artifacts", () => {
  it("CENSUS-7: reports the stored distribution of db/emus/chip8/orbits, and an ABSENT read side", async () => {
    const names = readdirSync(ORBITS_DIR)
      .filter((n) => n.endsWith(".orbit.json"))
      .sort();
    const stored: OrbitArtifact[] = [];
    for (const n of names) {
      const parsed = await parseArtifact(readFileSync(join(ORBITS_DIR, n), "utf-8"));
      expect(parsed.ok).toBe(true);
      if (parsed.ok) stored.push(parsed.value);
    }

    const c = censusOf(stored, []);
    // The measured stored distribution as of 2026-08-17. Asserted, so a future artifact that changes it
    // shows up here rather than silently moving the baseline this measurement is compared against.
    expect(total(c.stored)).toBe(5);
    expect(c.stored.halt).toBe(2);
    expect(c.stored["awaiting-input"]).toBe(2);
    expect(c.stored.cycle).toBe(1);
    expect(c.stored["open-at-bound"]).toBe(0);

    // No consult path is wired, so there is no read side. This is an absence, not a pass.
    expect(total(c.read)).toBe(0);
    expect(Number.isNaN(totalVariation(c))).toBe(true);
  });
});
