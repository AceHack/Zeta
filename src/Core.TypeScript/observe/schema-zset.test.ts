import { describe, expect, test } from "bun:test";
import {
  schemaZSet,
  applyDelta,
  consolidate,
  currentSchema,
  resolveField,
  isInOverlap,
  deltaFromSchemas,
  FS_METADATA_SCHEMA_V1,
  FS_METADATA_SCHEMA_V2,
  type SchemaField,
  type SchemaEvolutionDelta,
} from "./schema-zset";

describe("schema-zset — schema as Z-set", () => {
  test("schemaZSet creates entries at weight +1", () => {
    const fields: SchemaField[] = [
      { name: "a", type: "string", required: true },
      { name: "b", type: "boolean", required: false },
    ];
    const zset = schemaZSet(fields);
    expect(zset.length).toBe(2);
    expect(zset[0]!.weight).toBe(1);
    expect(zset[1]!.weight).toBe(1);
  });

  test("currentSchema returns only active fields (weight > 0)", () => {
    const zset = schemaZSet(FS_METADATA_SCHEMA_V1);
    const current = currentSchema(zset);
    expect(current.length).toBe(6);
    expect(current.map(f => f.name)).toContain("contentHash");
    expect(current.map(f => f.name)).toContain("executable");
  });

  test("resolveField finds active fields, returns undefined for missing", () => {
    const zset = schemaZSet(FS_METADATA_SCHEMA_V1);
    expect(resolveField(zset, "contentHash")?.type).toBe("string");
    expect(resolveField(zset, "nonexistent")).toBeUndefined();
  });
});

describe("schema-zset — evolution (delta application)", () => {
  test("applyDelta adds a new field", () => {
    const zset = schemaZSet(FS_METADATA_SCHEMA_V1);
    const delta: SchemaEvolutionDelta = {
      retract: [],
      insert: [{ name: "owner", type: "zetaid", required: false }],
    };
    const evolved = applyDelta(zset, delta);
    expect(currentSchema(evolved).length).toBe(7);
    expect(resolveField(evolved, "owner")?.type).toBe("zetaid");
  });

  test("applyDelta removes a field (sets weight to 0 → dropped)", () => {
    const zset = schemaZSet(FS_METADATA_SCHEMA_V1);
    const delta: SchemaEvolutionDelta = {
      retract: [{ name: "modified", type: "string", required: false }],
      insert: [],
    };
    const evolved = applyDelta(zset, delta);
    expect(resolveField(evolved, "modified")).toBeUndefined();
    expect(currentSchema(evolved).length).toBe(5);
  });

  test("applyDelta changes a field type (retract old + insert new)", () => {
    const zset = schemaZSet([{ name: "count", type: "string", required: true }]);
    const delta: SchemaEvolutionDelta = {
      retract: [{ name: "count", type: "string", required: true }],
      insert: [{ name: "count", type: "number", required: true }],
    };
    const evolved = applyDelta(zset, delta);
    expect(resolveField(evolved, "count")?.type).toBe("number");
  });

  test("applyDelta is idempotent for add (applying same insert twice = weight 2, still active)", () => {
    const zset = schemaZSet(FS_METADATA_SCHEMA_V1);
    const delta: SchemaEvolutionDelta = {
      retract: [],
      insert: [{ name: "owner", type: "zetaid", required: false }],
    };
    const once = applyDelta(zset, delta);
    const twice = applyDelta(once, delta);
    // owner still resolves (weight 2 > 0)
    expect(resolveField(twice, "owner")?.type).toBe("zetaid");
  });

  test("consolidate drops zero-weight entries", () => {
    const zset = schemaZSet([
      { name: "a", type: "string", required: true },
      { name: "b", type: "boolean", required: false },
    ]);
    // Retract "b" → weight becomes 0
    const evolved = applyDelta(zset, { retract: [{ name: "b", type: "boolean", required: false }], insert: [] });
    const consolidated = consolidate(evolved);
    expect(consolidated.length).toBe(1);
    expect(consolidated[0]!.field.name).toBe("a");
  });
});

describe("schema-zset — deltaFromSchemas (automatic delta computation)", () => {
  test("detects added fields", () => {
    const delta = deltaFromSchemas(FS_METADATA_SCHEMA_V1, FS_METADATA_SCHEMA_V2);
    expect(delta.retract.length).toBe(0);
    expect(delta.insert.length).toBe(1);
    expect(delta.insert[0]!.name).toBe("owner");
  });

  test("detects removed fields", () => {
    const before = [{ name: "a", type: "string" as const, required: true }, { name: "b", type: "number" as const, required: false }];
    const after = [{ name: "a", type: "string" as const, required: true }];
    const delta = deltaFromSchemas(before, after);
    expect(delta.retract.length).toBe(1);
    expect(delta.retract[0]!.name).toBe("b");
    expect(delta.insert.length).toBe(0);
  });

  test("detects type changes (retract old + insert new)", () => {
    const before = [{ name: "x", type: "string" as const, required: true }];
    const after = [{ name: "x", type: "number" as const, required: true }];
    const delta = deltaFromSchemas(before, after);
    expect(delta.retract.length).toBe(1);
    expect(delta.retract[0]!.type).toBe("string");
    expect(delta.insert.length).toBe(1);
    expect(delta.insert[0]!.type).toBe("number");
  });

  test("no-op delta when schemas are identical", () => {
    const delta = deltaFromSchemas(FS_METADATA_SCHEMA_V1, FS_METADATA_SCHEMA_V1);
    expect(delta.retract.length).toBe(0);
    expect(delta.insert.length).toBe(0);
  });
});

describe("schema-zset — overlap window", () => {
  test("isInOverlap is false for a clean schema", () => {
    const zset = schemaZSet(FS_METADATA_SCHEMA_V1);
    expect(isInOverlap(zset, "contentHash")).toBe(false);
  });

  test("isInOverlap detects retracted-but-not-consolidated fields", () => {
    const zset = schemaZSet([{ name: "old", type: "string", required: true }]);
    // Add a retraction without consolidation (overlap window open)
    const withRetraction = [...zset, { field: { name: "old", type: "string" as const, required: true }, weight: -1 }];
    expect(isInOverlap(withRetraction, "old")).toBe(true);
  });
});

describe("schema-zset — FS_METADATA_SCHEMA instances", () => {
  test("V1 has 6 fields", () => {
    expect(FS_METADATA_SCHEMA_V1.length).toBe(6);
  });

  test("V2 has 7 fields (V1 + owner)", () => {
    expect(FS_METADATA_SCHEMA_V2.length).toBe(7);
    expect(FS_METADATA_SCHEMA_V2.find(f => f.name === "owner")?.type).toBe("zetaid");
  });

  test("executable defaults to true (Zeta inverted model)", () => {
    const exec = FS_METADATA_SCHEMA_V1.find(f => f.name === "executable");
    expect(exec?.default).toBe(true);
  });
});
