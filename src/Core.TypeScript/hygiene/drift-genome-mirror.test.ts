import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

import { TRIGGER_OPEN_TICKS } from "./episode-protocol";
import { CURRENT_PHENOTYPE } from "./drift-genome";

// The genome mirror must tell the truth about the organism — LIVE-TREE law
// (the lint-a1-parent-key pattern: the test over the real checkout IS the CI
// enforcement). CURRENT_PHENOTYPE mirrors three surfaces that change through
// consent, and a silent desync would make the whole evolution loop measure a
// phantom genome:
//   1. registry/drift-slo.yaml — the four adaptive/default dials + BD001
//      (consented registry changes; adoption of #53000d 2026-08-12 is the
//      precedent this guard was minted from);
//   2. episode-protocol.ts TRIGGER_OPEN_TICKS — the retraction trigger;
//   3. drift-sweep.yml — the healer axes actually wired into the tick.
// Registry parsing is dependency-free by design (regex over the known shape;
// the hygiene lesson: no external static deps in hygiene modules/tests).

const ROOT = new URL("../../..", import.meta.url).pathname;
const REGISTRY = `${ROOT}registry/drift-slo.yaml`;
const SWEEP = `${ROOT}.github/workflows/drift-sweep.yml`;

const live = existsSync(REGISTRY) && existsSync(SWEEP);

function num(source: string, re: RegExp, what: string): number {
  const m = source.match(re);
  if (!m) throw new Error(`drift-slo.yaml: could not find ${what} (${String(re)})`);
  return Number(m[1]);
}

describe.if(live)("genome mirror ⇔ registry/drift-slo.yaml (consented dials)", () => {
  const yamlText = readFileSync(REGISTRY, "utf8");

  test("defaults.max_open_age_ticks matches defaultBudgetTicks", () => {
    // section-scoped: comments may sit between the key and its value line
    const section = yamlText.split("defaults:")[1]!.split("adaptive:")[0]!;
    expect(num(section, /max_open_age_ticks:\s*([\d.]+)/, "defaults budget")).toBe(
      CURRENT_PHENOTYPE.defaultBudgetTicks,
    );
  });

  test("adaptive multiplier / min_heals / floor_ticks match the mirror", () => {
    expect(num(yamlText, /multiplier:\s*([\d.]+)/, "multiplier")).toBe(CURRENT_PHENOTYPE.adaptiveMultiplier);
    expect(num(yamlText, /min_heals:\s*([\d.]+)/, "min_heals")).toBe(CURRENT_PHENOTYPE.adaptiveMinHeals);
    expect(num(yamlText, /floor_ticks:\s*([\d.]+)/, "floor_ticks")).toBe(CURRENT_PHENOTYPE.adaptiveFloorTicks);
  });

  test("BD001 explicit budget matches bd001BudgetTicks", () => {
    expect(num(yamlText, /BD001:\s*\n\s+max_open_age_ticks:\s*([\d.]+)/, "BD001 budget")).toBe(
      CURRENT_PHENOTYPE.bd001BudgetTicks,
    );
  });
});

describe("genome mirror ⇔ retraction trigger", () => {
  test("retractionTriggerTicks matches episode-protocol's TRIGGER_OPEN_TICKS", () => {
    expect(CURRENT_PHENOTYPE.retractionTriggerTicks).toBe(TRIGGER_OPEN_TICKS);
  });
});

describe.if(live)("genome mirror ⇔ healer axes wired in drift-sweep.yml", () => {
  const sweepText = readFileSync(SWEEP, "utf8");
  const AXES = [
    { bit: 0b001, name: "md fixer", marker: "healers/md-fixer-certified.ts" },
    { bit: 0b010, name: "memory reindex", marker: "healers/memory-reindex-certified.ts" },
    { bit: 0b100, name: "retraction actuator", marker: "hygiene/retraction-actuator.ts" },
  ] as const;

  for (const axis of AXES) {
    test(`axis bit ${String(axis.bit)} (${axis.name}) ⇔ step present in the sweep`, () => {
      const wired = sweepText.includes(axis.marker);
      const claimed = (CURRENT_PHENOTYPE.healerAxes & axis.bit) !== 0;
      expect(wired).toBe(claimed);
    });
  }

  test("no phantom axes beyond the three that exist", () => {
    expect(CURRENT_PHENOTYPE.healerAxes & ~0b111).toBe(0);
  });
});
