/**
 * society-population.test.ts — the falsifiers for the population fix.
 *
 * Each test here is written so that it FAILS against the loader that shipped
 * before 2026-08-20. The old loader was:
 *
 *   readdirSync(eventDir).filter(json).sort().slice(-200)  →  every distinct `by`
 *
 * and it produced a population of exactly one for four days. The named defects, and
 * the test that refuses each:
 *
 *   self-consumption          → "the runner's own lane is never population"
 *   lexicographic filename    → "society-* filenames cannot crowd out the agents"
 *   global count window       → "one chatty writer cannot starve another out"
 *   local-clock filtering     → "the window anchor is the corpus, not Date.now()"
 *   saturated fitness proxy   → "fitness does not saturate, so diversity is > 0"
 *   generation never persists → "latestGeneration folds the runner's own lane"
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AGENT_ID_SHAPE,
  BOOTSTRAP_AGENT_IDS,
  DEFAULT_HORIZON_MS,
  POPULATION_POLICY_ID,
  SOCIETY_RUNNER_BY,
  activityFitness,
  agentsFromScan,
  latestGeneration,
  loadPopulation,
  scanPopulation,
} from "./society-population";
import { createSociety } from "./society-evolution";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "society-pop-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Write an event. `name` matters: filename order is part of the bug under test. */
function ev(name: string, body: Record<string, unknown>): void {
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(body, null, 2));
}

function iso(msFromEpoch: number): string {
  return new Date(msFromEpoch).toISOString();
}

const T0 = Date.parse("2026-08-20T00:00:00.000Z");

describe("scanPopulation — the runner is not its own society", () => {
  test("the runner's own lane is never population", () => {
    for (let i = 0; i < 50; i++) {
      ev(`society-${i}`, { id: `s${i}`, at: iso(T0 + i * 1000), by: SOCIETY_RUNNER_BY, kind: "evolution" });
    }
    ev("080d-a", { id: "a", at: iso(T0), by: "alexa" });
    ev("080d-b", { id: "b", at: iso(T0), by: "otto" });

    const scan = scanPopulation(dir);
    expect(scan.agents.map((a) => a.id)).toEqual(["alexa", "otto"]);
    expect(scan.excludedByLane[SOCIETY_RUNNER_BY]).toBe(50);
  });

  test("society-* filenames cannot crowd out the agents — the exact 2026-08-16 collapse", () => {
    // The real corpus names agent events `080d…json` (32-hex ZetaId) and runner
    // events `society-<base36>.json`. "0" < "s", so a name sort puts EVERY society
    // file after EVERY agent file. The old loader took the last 200 by name, so
    // once the runner had written 200 of its own it owned the tail permanently —
    // regardless of when anything was written. This reproduces that shape: the
    // agents' events are the NEWEST here and still sort first by name.
    for (let i = 0; i < 300; i++) {
      ev(`society-${String(i).padStart(4, "0")}`, {
        id: `s${i}`,
        at: iso(T0 - 10 * 86_400_000 + i * 1000), // ten days OLD
        by: SOCIETY_RUNNER_BY,
        kind: "evolution",
      });
    }
    for (const who of ["alexa", "otto", "soraya"]) {
      for (let i = 0; i < 5; i++) {
        ev(`080d-${who}-${i}`, { id: `${who}${i}`, at: iso(T0 + i * 1000), by: who }); // NEW
      }
    }

    const scan = scanPopulation(dir);
    expect(scan.agents.map((a) => a.id)).toEqual(["alexa", "otto", "soraya"]);
    expect(scan.agents.length).toBeGreaterThanOrEqual(2);
  });

  test("one chatty writer cannot starve another out — membership is per-agent", () => {
    // 600 events from `loud` (three times the old `slice(-200)`) against one from
    // `quiet`, every one of them well inside the time horizon and `quiet`'s the
    // NEWEST of the lot. A global count window is a shared budget: whoever loses
    // the ordering loses membership outright, no matter how recent or how alive
    // they are. Membership per-agent is a predicate on that agent alone, so there
    // is nothing for a louder writer to consume.
    ev("aaa-quiet", { id: "q", at: iso(T0 + 10_000), by: "quiet" });
    for (let i = 0; i < 600; i++) {
      ev(`bbb-loud-${String(i).padStart(5, "0")}`, { id: `l${i}`, at: iso(T0 + i), by: "loud" });
    }

    // Control: the old global-count window, executed. `quiet` is the newest event
    // in the corpus and is still gone from it.
    const oldWindow = readdirSync(dir).filter((f) => f.endsWith(".json")).sort().slice(-200);
    const oldPopulation = new Set(
      oldWindow.map((f) => (JSON.parse(readFileSync(join(dir, f), "utf-8")) as { by: string }).by),
    );
    expect([...oldPopulation]).toEqual(["loud"]);

    const scan = scanPopulation(dir);
    expect(scan.agents.map((a) => a.id)).toEqual(["loud", "quiet"]);
  });
});

describe("scanPopulation — the window is deliberate", () => {
  test("the anchor is the corpus's own newest event, not Date.now()", () => {
    // Every event here is dated in 2019. Under a Date.now()-anchored window they
    // are all ancient and the population is empty; under a corpus-anchored window
    // they are all recent relative to each other. `.claude/rules/
    // local-time-never-enters-the-shared-fold.md` — the fold's inputs must be a
    // pure function of the evidence set.
    const ancient = Date.parse("2019-01-01T00:00:00.000Z");
    ev("a", { id: "a", at: iso(ancient), by: "alexa" });
    ev("b", { id: "b", at: iso(ancient + 60_000), by: "otto" });

    const scan = scanPopulation(dir);
    expect(scan.agents.map((a) => a.id)).toEqual(["alexa", "otto"]);
    expect(scan.horizonEnd).toBe(iso(ancient + 60_000));
    expect(scan.horizonStart).toBe(iso(ancient + 60_000 - DEFAULT_HORIZON_MS));
  });

  test("the same corpus yields the same population on any clock (DST replay)", () => {
    ev("a", { id: "a", at: iso(T0), by: "alexa" });
    ev("b", { id: "b", at: iso(T0 + 1000), by: "otto" });
    const first = scanPopulation(dir);
    const second = scanPopulation(dir);
    expect(second).toEqual(first);
  });

  test("an agent silent for longer than the horizon ages out, and is reported", () => {
    ev("old", { id: "o", at: iso(T0 - DEFAULT_HORIZON_MS - 60_000), by: "ghost" });
    ev("new1", { id: "n1", at: iso(T0), by: "alexa" });
    ev("new2", { id: "n2", at: iso(T0), by: "otto" });

    const scan = scanPopulation(dir);
    expect(scan.agents.map((a) => a.id)).toEqual(["alexa", "otto"]);
    expect(scan.agedOut).toEqual(["ghost"]);
  });

  test("an agent just inside the horizon stays — the edge is not off by a window", () => {
    ev("edge", { id: "e", at: iso(T0 - DEFAULT_HORIZON_MS + 1000), by: "ghost" });
    ev("new", { id: "n", at: iso(T0), by: "alexa" });

    const scan = scanPopulation(dir);
    expect(scan.agents.map((a) => a.id)).toEqual(["alexa", "ghost"]);
    expect(scan.agedOut).toEqual([]);
  });

  test("a shorter horizon is a knob, not a rewrite", () => {
    ev("old", { id: "o", at: iso(T0 - 2 * 86_400_000), by: "ghost" });
    ev("new", { id: "n", at: iso(T0), by: "alexa" });

    expect(scanPopulation(dir, { horizonMs: 86_400_000 }).agents.map((a) => a.id)).toEqual(["alexa"]);
    expect(scanPopulation(dir, { horizonMs: 3 * 86_400_000 }).agents.map((a) => a.id)).toEqual([
      "alexa",
      "ghost",
    ]);
  });
});

describe("scanPopulation — junk cannot become a member", () => {
  test("a path-shaped `by` is rejected, not counted as an agent", () => {
    // Six real events on 2026-08-17 carry `by: "/tmp/attest-4EC3oi"` and siblings —
    // a test leaking its temp directory. They are inside the default horizon.
    ev("junk1", { id: "j1", at: iso(T0), by: "/tmp/attest-4EC3oi" });
    ev("junk2", { id: "j2", at: iso(T0), by: "/tmp/attest-0rHTQr" });
    ev("a", { id: "a", at: iso(T0), by: "alexa" });
    ev("b", { id: "b", at: iso(T0), by: "otto" });

    const scan = scanPopulation(dir);
    expect(scan.agents.map((a) => a.id)).toEqual(["alexa", "otto"]);
    expect(scan.rejectedIds).toEqual(["/tmp/attest-0rHTQr", "/tmp/attest-4EC3oi"]);
  });

  test("AGENT_ID_SHAPE admits the real ids and refuses the real junk", () => {
    for (const ok of ["alexa", "otto", "soraya", "gen1-0", "gen12-3", "a.b_c-1"]) {
      expect(AGENT_ID_SHAPE.test(ok)).toBe(true);
    }
    for (const bad of ["/tmp/attest-4EC3oi", "", ".hidden", "-leading", "has space", "a/b"]) {
      expect(AGENT_ID_SHAPE.test(bad)).toBe(false);
    }
  });

  test("malformed and non-event files are skipped without killing the scan", () => {
    writeFileSync(join(dir, "broken.json"), "{ not json");
    writeFileSync(join(dir, "no-by.json"), JSON.stringify({ id: "x", at: iso(T0) }));
    writeFileSync(join(dir, "array.json"), JSON.stringify([1, 2, 3]));
    ev("a", { id: "a", at: iso(T0), by: "alexa" });
    ev("b", { id: "b", at: iso(T0), by: "otto" });

    const scan = scanPopulation(dir);
    expect(scan.agents.map((a) => a.id)).toEqual(["alexa", "otto"]);
    expect(scan.scanned).toBe(5);
  });

  test("a missing directory is empty, not a crash", () => {
    const scan = scanPopulation(join(dir, "nope"));
    expect(scan.agents).toEqual([]);
    expect(scan.scanned).toBe(0);
  });
});

describe("fitness — the proxy no longer saturates", () => {
  test("activityFitness is relative to the window's busiest agent", () => {
    expect(activityFitness(100, 100)).toBe(1);
    expect(activityFitness(10, 100)).toBeLessThan(1);
    expect(activityFitness(10, 100)).toBeGreaterThan(0);
  });

  test("it is scale-free: the same ratios read the same at 3 events and at 3 million", () => {
    const small = activityFitness(2, 4);
    const large = activityFitness(2_000_000, 4_000_000);
    // Both are strictly inside (0,1) — the old log(n)/log(200) proxy returns
    // 1.28 and 2.75 respectively, i.e. it saturates the moment n > 200.
    expect(small).toBeGreaterThan(0);
    expect(small).toBeLessThan(1);
    expect(large).toBeGreaterThan(0);
    expect(large).toBeLessThan(1);
  });

  test("high-volume agents get DISTINCT genomes, so geneticDiversity > 0", () => {
    // This is the test the old proxy fails outright. With log(events+1)/log(200),
    // every agent above ~200 events lands at mu = min(0.95, >1) = 0.95 and gets the
    // identical founder genome — so `geneticDiversity === 0` and evolution cannot
    // tell anyone apart. All three agents below have hundreds of events, which is
    // the real corpus's situation (alexa 643, otto 618, soraya 537 in-window).
    const volumes: Record<string, number> = { alexa: 643, otto: 618, soraya: 537 };
    for (const [who, n] of Object.entries(volumes)) {
      for (let i = 0; i < n; i++) {
        ev(`080d-${who}-${String(i).padStart(4, "0")}`, { id: `${who}${i}`, at: iso(T0 + i), by: who });
      }
    }
    const agents = agentsFromScan(scanPopulation(dir));
    expect(agents.length).toBe(3);

    const genomes = new Set(agents.map((a) => `${a.genome.rgb.r},${a.genome.rgb.g},${a.genome.rgb.b}`));
    expect(genomes.size).toBe(3);
    expect(createSociety(agents, 0).geneticDiversity).toBeGreaterThan(0);
  });

  test("fitnessSpread is non-zero, so selection has something to select on", () => {
    ev("a1", { id: "a1", at: iso(T0), by: "alexa" });
    ev("a2", { id: "a2", at: iso(T0 + 1), by: "alexa" });
    ev("a3", { id: "a3", at: iso(T0 + 2), by: "alexa" });
    ev("b1", { id: "b1", at: iso(T0), by: "otto" });

    const society = createSociety(agentsFromScan(scanPopulation(dir)), 0);
    expect(society.fitnessSpread).toBeGreaterThan(0);
  });
});

describe("agentsFromScan — the bootstrap is a named fork, not a silent one", () => {
  test("an empty corpus bootstraps, and the scan still reports zero", () => {
    const scan = scanPopulation(dir);
    expect(scan.agents).toEqual([]);
    const agents = agentsFromScan(scan);
    expect(agents.map((a) => a.id)).toEqual([...BOOTSTRAP_AGENT_IDS]);
  });

  test("a corpus of nothing but runner events bootstraps rather than electing the runner", () => {
    for (let i = 0; i < 10; i++) {
      ev(`society-${i}`, { id: `s${i}`, at: iso(T0 + i), by: SOCIETY_RUNNER_BY, kind: "evolution" });
    }
    const scan = scanPopulation(dir);
    expect(scan.agents).toEqual([]);
    expect(agentsFromScan(scan).map((a) => a.id)).not.toContain(SOCIETY_RUNNER_BY);
  });
});

describe("latestGeneration — the lineage counter actually counts", () => {
  test("folds the maximum generation from the runner's own lane", () => {
    ev("society-1", { id: "s1", at: iso(T0), by: SOCIETY_RUNNER_BY, kind: "evolution", generation: 1 });
    ev("society-2", { id: "s2", at: iso(T0 + 1), by: SOCIETY_RUNNER_BY, kind: "evolution", generation: 7 });
    ev("society-3", { id: "s3", at: iso(T0 + 2), by: SOCIETY_RUNNER_BY, kind: "evolution", generation: 4 });
    expect(latestGeneration(dir)).toBe(7);
  });

  test("an agent event claiming a generation cannot move the runner's lineage", () => {
    ev("society-1", { id: "s1", at: iso(T0), by: SOCIETY_RUNNER_BY, kind: "evolution", generation: 2 });
    ev("080d-a", { id: "a", at: iso(T0), by: "alexa", kind: "evolution", generation: 9999 });
    expect(latestGeneration(dir)).toBe(2);
  });

  test("a non-evolution event in the runner's lane cannot move it either", () => {
    ev("society-1", { id: "s1", at: iso(T0), by: SOCIETY_RUNNER_BY, kind: "evolution", generation: 3 });
    ev("society-2", { id: "s2", at: iso(T0 + 1), by: SOCIETY_RUNNER_BY, kind: "heartbeat", generation: 500 });
    expect(latestGeneration(dir)).toBe(3);
  });

  test("an empty corpus starts at 0, so the first tick emits generation 1", () => {
    expect(latestGeneration(dir)).toBe(0);
  });

  test("it is idempotent — re-folding the same corpus gives the same number", () => {
    ev("society-1", { id: "s1", at: iso(T0), by: SOCIETY_RUNNER_BY, kind: "evolution", generation: 5 });
    expect(latestGeneration(dir)).toBe(latestGeneration(dir));
  });
});

describe("loadPopulation — the whole loader, as the runner calls it", () => {
  test("population excludes the runner and generation resumes from it", () => {
    ev("society-1", {
      id: "s1",
      at: iso(T0),
      by: SOCIETY_RUNNER_BY,
      kind: "evolution",
      generation: 11,
      populationPolicy: POPULATION_POLICY_ID,
    });
    ev("080d-a", { id: "a", at: iso(T0 + 1), by: "alexa" });
    ev("080d-b", { id: "b", at: iso(T0 + 2), by: "otto" });
    ev("080d-b2", { id: "b2", at: iso(T0 + 3), by: "otto" });

    const { scan, agents, generation } = loadPopulation(dir);
    expect(scan.agents.map((a) => a.id)).toEqual(["alexa", "otto"]);
    expect(agents.map((a) => a.id)).toEqual(["alexa", "otto"]);
    expect(generation).toBe(11);
  });

  test("a new writer joins with no code change — 'more than one schedule per agent'", () => {
    // Aaron 2026-08-20: "we were supposed to have like 4 agents i think, also we
    // can have more than one schedule per agent if we want." Adding a writer is an
    // ops change; the loader must pick it up on its own.
    for (const who of ["alexa", "otto", "soraya"]) ev(`080d-${who}`, { id: who, at: iso(T0), by: who });
    expect(scanPopulation(dir).agents.length).toBe(3);

    ev("080d-otto-night", { id: "on", at: iso(T0 + 1), by: "otto-night" });
    expect(scanPopulation(dir).agents.map((a) => a.id)).toEqual([
      "alexa",
      "otto",
      "otto-night",
      "soraya",
    ]);
  });
});

describe("the collapse itself, replayed end to end", () => {
  test("the fixed loader survives a corpus the old one collapsed on", () => {
    // Faithful miniature of `docs/observe-events` on 2026-08-20: three live agents
    // writing hex-named files, plus 403 runner events named `society-*`. The old
    // loader reports 1 (all of the name-sorted tail is `society-*`); this one
    // reports 3 and the society is capable of evolving.
    mkdirSync(dir, { recursive: true });
    for (let i = 0; i < 403; i++) {
      ev(`society-${String(i).padStart(4, "0")}`, {
        id: `s${i}`,
        at: iso(T0 + i * 60_000),
        by: SOCIETY_RUNNER_BY,
        kind: "evolution",
        generation: 1,
      });
    }
    const volumes: Record<string, number> = { alexa: 60, otto: 55, soraya: 50 };
    for (const [who, n] of Object.entries(volumes)) {
      for (let i = 0; i < n; i++) {
        ev(`080d-${who}-${String(i).padStart(4, "0")}`, {
          id: `${who}-${i}`,
          at: iso(T0 + i * 60_000),
          by: who,
        });
      }
    }

    // THE CONTROL. The old loader's window, reproduced literally — executed, not
    // asserted. If this ever stops reporting a population of one, the fixture has
    // drifted away from the corpus it models and the comparison below means
    // nothing. This is the line that makes the rest of the test a measurement.
    const oldWindow = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .slice(-200);
    const oldPopulation = new Set(
      oldWindow.map((f) => (JSON.parse(readFileSync(join(dir, f), "utf-8")) as { by: string }).by),
    );
    expect([...oldPopulation]).toEqual([SOCIETY_RUNNER_BY]);

    const { scan, agents, generation } = loadPopulation(dir);
    expect(scan.agents.length).toBe(3);
    expect(scan.excludedByLane[SOCIETY_RUNNER_BY]).toBe(403);
    expect(generation).toBe(1);

    const society = createSociety(agents, generation);
    expect(society.agents.length).toBeGreaterThanOrEqual(2);
    expect(society.geneticDiversity).toBeGreaterThan(0);
    expect(society.meanFitness).not.toBe(0.6505648066545648); // the pinned value
  });
});
