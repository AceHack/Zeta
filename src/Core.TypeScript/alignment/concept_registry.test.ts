// concept_registry.test.ts - tests for 081KR2E4K0008QG0R003DS2XHJ concept registry extraction.
//
// Run: bun test src/Core.TypeScript/alignment/concept_registry.test.ts

import { describe, expect, test } from "bun:test";
import {
  buildRegistry,
  extractByRegex,
  extractGlassHaloDoctrines,
} from "./concept_registry.ts";

describe("extractByRegex", () => {
  test("extracts alignment clause IDs from the canonical source", () => {
    const concepts = extractByRegex(
      "docs/ALIGNMENT.md",
      /\b(HC-[1-7]|SD-[1-9]|DIR-[1-5])\b/g,
      "alignment-clause",
    );
    const ids = new Set(concepts.map((concept) => concept.id));
    expect(ids.has("HC-1")).toBe(true);
    expect(ids.has("SD-9")).toBe(true);
    expect(ids.has("DIR-5")).toBe(true);
    expect(concepts.every((concept) => concept.conceptClass === "alignment-clause")).toBe(true);
  });

  test("deduplicates repeated best-practice IDs", () => {
    const concepts = extractByRegex(
      "docs/AGENT-BEST-PRACTICES.md",
      /\b(BP-\d+)\b/g,
      "best-practice",
    );
    const ids = concepts.map((concept) => concept.id);
    expect(ids.length).toBe(new Set(ids).size);
    expect(ids).toContain("BP-01");
  });
});

describe("extractGlassHaloDoctrines", () => {
  test("extracts anchored doctrine concepts from canonical sources", () => {
    const concepts = extractGlassHaloDoctrines();
    const byId = new Map(concepts.map((concept) => [concept.id, concept]));

    expect(byId.has("radical-honesty")).toBe(true);
    expect(byId.has("total-observability")).toBe(true);
    expect(byId.has("substrate-or-it-didnt-happen")).toBe(true);
    expect(byId.get("radical-honesty")?.anchorState).toBe("partially-anchored");
    expect(byId.get("substrate-or-it-didnt-happen")?.anchorState).toBe("factory-native");
  });
});

describe("buildRegistry", () => {
  test("builds a schema-v1.1 registry with all expected concept classes", () => {
    const registry = buildRegistry();
    expect(registry.schema).toBe("concept-registry-v1.1");

    expect(registry.summary["alignment-clause"]).toBe(21);
    expect(Object.values(registry.summary).reduce((sum, count) => sum + count, 0)).toBe(
      registry.concepts.length,
    );
    expect(registry.anchoredCount).toBe(
      registry.concepts.filter(
        (concept) => concept.anchorState && concept.anchorState !== "factory-native",
      ).length,
    );
    expect(
      registry.concepts.every(
        (concept) => concept.id && concept.conceptClass && concept.source && concept.label,
      ),
    ).toBe(true);

    const byId = new Map(registry.concepts.map((concept) => [concept.id, concept]));
    expect(byId.get("HC-1")?.conceptClass).toBe("alignment-clause");
    expect(byId.get("BP-01")?.conceptClass).toBe("best-practice");
    expect(byId.get("Otto-363")?.conceptClass).toBe("otto-principle");
    expect(byId.get("radical-honesty")?.conceptClass).toBe("glass-halo-doctrine");
    expect(byId.get("radical-honesty")?.anchorState).toBe("partially-anchored");
  });
});
