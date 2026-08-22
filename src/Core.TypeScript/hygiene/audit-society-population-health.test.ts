/**
 * audit-society-population-health.test.ts — falsifiers for the falsifier.
 *
 * A guard nobody has watched fail is a guard nobody knows works, and this one exists
 * precisely because a check that could not fail (there wasn't one) let a four-day
 * collapse pass as healthy. So every finding this audit can emit is reproduced here
 * from a corpus built to trigger it, and the healthy corpus is asserted clean so the
 * audit cannot pass by failing on everything.
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MIN_POPULATION,
  POLICY_REQUIRED_AFTER,
  SCAN_FLOOR,
  auditSocietyPopulation,
} from "./audit-society-population-health";
import { POPULATION_POLICY_ID, SOCIETY_RUNNER_BY } from "../planning/society-population";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "society-audit-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const T0 = Date.parse("2026-08-21T00:00:00.000Z");
const iso = (ms: number): string => new Date(ms).toISOString();

function ev(name: string, body: Record<string, unknown>): void {
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(body));
}

/**
 * Three live agents at DISTINCT volumes, so relative fitness — and therefore the
 * founder genomes — differ and `geneticDiversity > 0`. Small on purpose: the scan
 * floor is overridden per test rather than padded around (see `TEST_FLOOR`).
 */
function writeHealthyAgents(atBase = T0): void {
  const volumes: Record<string, number> = { alexa: 9, otto: 5, soraya: 2 };
  for (const [who, n] of Object.entries(volumes)) {
    for (let i = 0; i < n; i++) {
      ev(`080d-${who}-${String(i).padStart(4, "0")}`, { id: `${who}${i}`, at: iso(atBase + i), by: who });
    }
  }
}

/**
 * The floor these fixtures run under. The production floor is asserted separately —
 * `SCAN_FLOOR` guards the real corpus and a test must not be able to disable it.
 */
const TEST_FLOOR = 1;

function societyEvent(
  name: string,
  at: string,
  over: Partial<{
    populationPolicy: unknown;
    generation: number;
    agents: unknown[];
    geneticDiversity: number;
  }> = {},
): void {
  ev(name, {
    id: name,
    at,
    by: SOCIETY_RUNNER_BY,
    kind: "evolution",
    populationPolicy: POPULATION_POLICY_ID,
    generation: 2,
    agents: [{ id: "alexa" }, { id: "otto" }, { id: "soraya" }],
    geneticDiversity: 5.75,
    ...over,
  });
}

describe("the healthy corpus is clean — the audit does not pass by always failing", () => {
  test("three live agents and a policy-carrying event produce zero findings", () => {
    writeHealthyAgents();
    societyEvent("society-1", iso(T0 + 1000));
    societyEvent("society-2", iso(T0 + 2000), { generation: 3 });

    const r = auditSocietyPopulation(dir, { scanFloor: TEST_FLOOR });
    expect(r.failures).toEqual([]);
    expect(r.population).toBe(3);
    expect(r.diversity).toBeGreaterThan(0);
    expect(r.policyEventCount).toBe(2);
  });
});

describe("A — the scan", () => {
  test("FAILS when the population collapses to one", () => {
    // The 2026-08-16 state exactly: one live writer, everything else the runner.
    for (let i = 0; i < 5; i++) {
      ev(`080d-alexa-${String(i).padStart(4, "0")}`, { id: `a${i}`, at: iso(T0 + i), by: "alexa" });
    }
    societyEvent("society-1", iso(T0 + 1000));

    const r = auditSocietyPopulation(dir, { scanFloor: TEST_FLOOR });
    expect(r.population).toBe(1);
    expect(r.failures.some((f) => f.startsWith("POPULATION COLLAPSE"))).toBe(true);
  });

  test("FAILS when every genome is identical (zero diversity)", () => {
    // Two agents with EQUAL event counts get equal relative fitness, hence equal
    // founder genomes, hence diversity 0. Population is fine; the society is not.
    for (const who of ["alexa", "otto"]) {
      for (let i = 0; i < 6; i++) {
        ev(`080d-${who}-${String(i).padStart(4, "0")}`, { id: `${who}${i}`, at: iso(T0 + i), by: who });
      }
    }
    societyEvent("society-1", iso(T0 + 1000));

    const r = auditSocietyPopulation(dir, { scanFloor: TEST_FLOOR });
    expect(r.population).toBe(2);
    expect(r.diversity).toBe(0);
    expect(r.failures.some((f) => f.startsWith("ZERO GENETIC DIVERSITY"))).toBe(true);
  });

  test("FAILS on a scan-floor breach rather than reporting a pass on nothing", () => {
    // NO scanFloor override here — this is the DEFAULT floor under test. If the
    // override could suppress the production floor, this case would go green.
    writeHealthyAgents();

    const r = auditSocietyPopulation(dir);
    expect(r.scannedFiles).toBeLessThan(SCAN_FLOOR);
    expect(r.failures.some((f) => f.startsWith("SCAN FLOOR BREACH"))).toBe(true);
  });

  test("the default floor IS SCAN_FLOOR — the override cannot weaken the gate", () => {
    writeHealthyAgents();
    expect(SCAN_FLOOR).toBeGreaterThan(100);
    // Same corpus, two floors: the default refuses it, an explicit low floor accepts.
    expect(auditSocietyPopulation(dir).failures.some((f) => f.includes("SCAN FLOOR"))).toBe(true);
    expect(
      auditSocietyPopulation(dir, { scanFloor: TEST_FLOOR }).failures.some((f) =>
        f.includes("SCAN FLOOR"),
      ),
    ).toBe(false);
  });

  test("MIN_POPULATION is 2 — the smallest n at which evolve() is not the identity", () => {
    expect(MIN_POPULATION).toBe(2);
  });
});

describe("B — what the loop published", () => {
  test("FAILS on a published generation with fewer than two agents", () => {
    writeHealthyAgents();
    societyEvent("society-1", iso(T0 + 1000), { agents: [{ id: SOCIETY_RUNNER_BY }] });

    const r = auditSocietyPopulation(dir, { scanFloor: TEST_FLOOR });
    expect(r.failures.some((f) => f.includes("published agents=1"))).toBe(true);
  });

  test("FAILS on a published generation with zero diversity", () => {
    writeHealthyAgents();
    societyEvent("society-1", iso(T0 + 1000), { geneticDiversity: 0 });

    const r = auditSocietyPopulation(dir, { scanFloor: TEST_FLOOR });
    expect(r.failures.some((f) => f.includes("published geneticDiversity=0"))).toBe(true);
  });

  test("a healthy SCAN does not excuse a degenerate EMITTED event", () => {
    // The whole reason B exists: the input can be fine while the runner ignores it.
    writeHealthyAgents();
    societyEvent("society-1", iso(T0 + 1000), { agents: [{ id: "only" }], geneticDiversity: 0 });

    const r = auditSocietyPopulation(dir, { scanFloor: TEST_FLOOR });
    expect(r.population).toBe(3);
    expect(r.diversity).toBeGreaterThan(0);
    expect(r.failures.length).toBeGreaterThan(0);
  });
});

describe("C — the lineage counter", () => {
  test("FAILS when every event carries the same generation (the original defect)", () => {
    writeHealthyAgents();
    societyEvent("society-1", iso(T0 + 1000), { generation: 1 });
    societyEvent("society-2", iso(T0 + 2000), { generation: 1 });
    societyEvent("society-3", iso(T0 + 3000), { generation: 1 });

    const r = auditSocietyPopulation(dir, { scanFloor: TEST_FLOOR });
    expect(r.failures.some((f) => f.startsWith("FROZEN LINEAGE COUNTER"))).toBe(true);
  });

  test("PASSES when the generation advances", () => {
    writeHealthyAgents();
    societyEvent("society-1", iso(T0 + 1000), { generation: 1 });
    societyEvent("society-2", iso(T0 + 2000), { generation: 2 });

    const r = auditSocietyPopulation(dir, { scanFloor: TEST_FLOOR });
    expect(r.failures).toEqual([]);
  });

  test("a single event is not yet evidence of a frozen counter", () => {
    writeHealthyAgents();
    societyEvent("society-1", iso(T0 + 1000), { generation: 1 });

    const r = auditSocietyPopulation(dir, { scanFloor: TEST_FLOOR });
    expect(r.failures.some((f) => f.startsWith("FROZEN LINEAGE COUNTER"))).toBe(false);
  });
});

describe("the scope marker cannot be an escape hatch", () => {
  test("pre-fix events are preserved and NOT judged", () => {
    // Manifesto §5: the 400 collapsed-loader events are real history. They carry no
    // policy marker, so B and C skip them — this asserts that skipping is what
    // actually happens, rather than being a claim in a comment.
    writeHealthyAgents();
    for (let i = 0; i < 5; i++) {
      ev(`society-old-${i}`, {
        id: `o${i}`,
        at: iso(T0 - 86_400_000 + i),
        by: SOCIETY_RUNNER_BY,
        kind: "evolution",
        generation: 1,
        agents: [{ id: SOCIETY_RUNNER_BY }],
        geneticDiversity: 0,
      });
    }
    societyEvent("society-new", iso(T0 + 1000));

    const r = auditSocietyPopulation(dir, { scanFloor: TEST_FLOOR });
    expect(r.policyEventCount).toBe(1);
    expect(r.failures).toEqual([]);
  });

  test("FAILS when no policy-carrying event exists past the deadline", () => {
    // "The fix never actually reached the loop" must not read as a pass.
    const past = Date.parse(POLICY_REQUIRED_AFTER) + 86_400_000;
    writeHealthyAgents(past);

    const r = auditSocietyPopulation(dir, { scanFloor: TEST_FLOOR });
    expect(r.policyEventCount).toBe(0);
    expect(r.failures.some((f) => f.startsWith("NO POLICY-CARRYING"))).toBe(true);
  });

  test("before the deadline the emptiness is a NOTE, and it says it will become a failure", () => {
    writeHealthyAgents();

    const r = auditSocietyPopulation(dir, { scanFloor: TEST_FLOOR });
    expect(r.policyEventCount).toBe(0);
    expect(r.failures).toEqual([]);
    expect(r.notes.some((n) => n.includes(POLICY_REQUIRED_AFTER))).toBe(true);
  });

  test("FAILS when the runner reverts and the newest event loses the marker", () => {
    writeHealthyAgents();
    societyEvent("society-1", iso(T0 + 1000));
    societyEvent("society-2", iso(T0 + 2000), { generation: 3 });
    // A regression: newest tick written by the old loader, no marker.
    ev("society-3", {
      id: "s3",
      at: iso(T0 + 3000),
      by: SOCIETY_RUNNER_BY,
      kind: "evolution",
      generation: 1,
      agents: [{ id: SOCIETY_RUNNER_BY }],
      geneticDiversity: 0,
    });

    const r = auditSocietyPopulation(dir, { scanFloor: TEST_FLOOR });
    expect(r.failures.some((f) => f.startsWith("POLICY REGRESSION"))).toBe(true);
  });

  test("a foreign policy value is judged as a regression, not silently accepted", () => {
    writeHealthyAgents();
    societyEvent("society-1", iso(T0 + 1000));
    societyEvent("society-2", iso(T0 + 2000), { populationPolicy: "something-else@9" });

    const r = auditSocietyPopulation(dir, { scanFloor: TEST_FLOOR });
    expect(r.failures.some((f) => f.startsWith("POLICY REGRESSION"))).toBe(true);
  });
});
