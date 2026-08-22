import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadBnnState } from "../bayesian/bnn-persistence";
import { createDimensionalBnn } from "./error-bnn-bridge";
import { evidenceBackedPriorHints, transportHeatReadout } from "./society-heat-readout";
import {
  absorbGeneration,
  generationSeverity,
  loadSocietyBnn,
  saveSocietyBnn,
  societyBnnPath,
  SOCIETY_BNN_FILENAME,
} from "./society-bnn";

const EMITTED_AT = "2026-08-15T00:00:00.000Z";

function gen(meanFitness: number, generation = 1, diversity = 0.4) {
  return { generation, meanFitness, geneticDiversity: diversity };
}

describe("generationSeverity", () => {
  test("quartiles of the unit-interval fitness proxy, not heat-band cuts", () => {
    expect(generationSeverity(0)).toBe("error");
    expect(generationSeverity(0.24)).toBe("error");
    expect(generationSeverity(0.25)).toBe("warn");
    expect(generationSeverity(0.49)).toBe("warn");
    expect(generationSeverity(0.5)).toBe("info");
    expect(generationSeverity(Number.NaN)).toBe("error");
  });
});

describe("society BNN survives the tick boundary (081M005CGB7)", () => {
  test("a missing file is a prior, and is not written until something is absorbed", async () => {
    const dir = mkdtempSync(join(tmpdir(), "society-bnn-"));
    try {
      const loaded = await loadSocietyBnn(dir);
      expect(loaded.loaded).toBe(false);
      expect("previousTransport" in loaded).toBe(false);
      expect(evidenceBackedPriorHints(loaded.bnn, "society-runner")).toEqual([]);
      expect(await saveSocietyBnn(loaded.bnn, dir)).toBe(false);
      expect(await loadBnnState(societyBnnPath(dir))).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("one generation writes a file whose restored nu and obsCount match", async () => {
    const dir = mkdtempSync(join(tmpdir(), "society-bnn-"));
    try {
      const { bnn } = await loadSocietyBnn(dir);
      expect(absorbGeneration(bnn, gen(0.8), "society-tick-1", EMITTED_AT)).toBe(true);
      expect(await saveSocietyBnn(bnn, dir)).toBe(true);

      const cal = bnn.states.get("calibration")!;
      expect(cal.obsCount).toBe(1);
      const persisted = await loadBnnState(societyBnnPath(dir));
      expect(persisted).not.toBeNull();
      const saved = persisted!.dimensions.find((d) => d.dimension === "calibration")!;
      expect(saved.nu).toBe(cal.nu);
      expect(saved.observationCount).toBe(1);

      const again = await loadSocietyBnn(dir);
      expect(again.loaded).toBe(true);
      expect(again.bnn.states.get("calibration")!.obsCount).toBe(1);
      expect(again.bnn.states.get("calibration")!.nu).toBe(cal.nu);
      const hints = evidenceBackedPriorHints(again.bnn, "society-runner");
      expect(hints).toHaveLength(1);
      expect(hints[0]!.dimension).toBe("calibration");
      expect(hints[0]!.obsCount).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a second tick adds an observation rather than starting from the prior", async () => {
    const dir = mkdtempSync(join(tmpdir(), "society-bnn-"));
    try {
      const first = await loadSocietyBnn(dir);
      absorbGeneration(first.bnn, gen(0.8, 1), "society-tick-1", EMITTED_AT);
      await saveSocietyBnn(first.bnn, dir);

      const second = await loadSocietyBnn(dir);
      expect(absorbGeneration(second.bnn, gen(0.2, 2), "society-tick-2", EMITTED_AT)).toBe(true);
      await saveSocietyBnn(second.bnn, dir);
      expect(second.bnn.states.get("calibration")!.obsCount).toBe(2);
      expect(evidenceBackedPriorHints(second.bnn, "society-runner")[0]!.obsCount).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("replaying the same generation id does not double-count", async () => {
    const bnn = createDimensionalBnn();
    expect(absorbGeneration(bnn, gen(0.8), "society-tick-1", EMITTED_AT)).toBe(true);
    expect(absorbGeneration(bnn, gen(0.8), "society-tick-1", EMITTED_AT)).toBe(false);
    expect(bnn.states.get("calibration")!.obsCount).toBe(1);
  });

  test("transport trend stays local: no previous transport belief if that dimension is still a prior", async () => {
    const dir = mkdtempSync(join(tmpdir(), "society-bnn-"));
    try {
      const first = await loadSocietyBnn(dir);
      absorbGeneration(first.bnn, gen(0.8), "society-tick-1", EMITTED_AT);
      await saveSocietyBnn(first.bnn, dir);
      const second = await loadSocietyBnn(dir);
      expect("previousTransport" in second).toBe(false);
      expect(transportHeatReadout(second.bnn, second.previousTransport).trend).toBe("indeterminate");
      expect(transportHeatReadout(second.bnn, second.previousTransport).evidence).toBe("prior");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the file name is the one persistence already named", () => {
    expect(SOCIETY_BNN_FILENAME).toBe("bnn-state.json");
    expect(societyBnnPath("docs/observe-events")).toBe("docs/observe-events/bnn-state.json");
  });
});
