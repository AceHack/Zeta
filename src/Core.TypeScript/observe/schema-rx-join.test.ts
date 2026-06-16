import { describe, expect, test } from "bun:test";
import { SchemaAwareJoin, deltasCommute, type SchemaView } from "./schema-rx-join";
import { schemaZSet, FS_METADATA_SCHEMA_V1, type SchemaEvolutionDelta, type SchemaZSet as SchemaZSetType } from "./schema-zset";

// A simple view that projects specific fields from the schema
const fileInfoView: SchemaView<string[]> = {
  id: "view/file-info",
  dependsOn: ["contentHash", "paths", "modified"],
  compute(schema, _data) {
    const { currentSchema } = require("./schema-zset");
    const active = currentSchema(schema) as Array<{ name: string }>;
    return fileInfoView.dependsOn.filter(f => active.some((a: { name: string }) => a.name === f));
  },
};

const permissionsView: SchemaView<boolean> = {
  id: "view/permissions",
  dependsOn: ["executable"],
  compute(schema, _data) {
    const { resolveField } = require("./schema-zset");
    const field = resolveField(schema, "executable");
    return field !== undefined;
  },
};

describe("SchemaAwareJoin — propagation", () => {
  test("subscribe returns initial computed value", () => {
    const join = new SchemaAwareJoin(schemaZSet(FS_METADATA_SCHEMA_V1));
    const value = join.subscribe(fileInfoView);
    // All 3 fields are active in V1
    expect(value).toEqual(["contentHash", "paths", "modified"]);
  });

  test("applyAndPropagate recomputes affected views only", () => {
    const join = new SchemaAwareJoin(schemaZSet(FS_METADATA_SCHEMA_V1));
    join.subscribe(fileInfoView);
    join.subscribe(permissionsView);

    // Remove "modified" — affects fileInfoView but NOT permissionsView
    const delta: SchemaEvolutionDelta = {
      retract: [{ name: "modified", type: "string", required: false }],
      insert: [],
    };
    const results = join.applyAndPropagate(delta);

    expect(results.length).toBe(1); // only fileInfoView affected
    expect(results[0]!.viewId).toBe("view/file-info");
    expect(results[0]!.affected).toBe(true);
    // "modified" is gone from the projection
    expect(results[0]!.value).toEqual(["contentHash", "paths"]);
  });

  test("degraded fields reported when a view loses a dependency", () => {
    const join = new SchemaAwareJoin(schemaZSet(FS_METADATA_SCHEMA_V1));
    join.subscribe(fileInfoView);

    const delta: SchemaEvolutionDelta = {
      retract: [{ name: "modified", type: "string", required: false }],
      insert: [],
    };
    join.applyAndPropagate(delta);

    const degraded = join.getViewDegraded("view/file-info");
    expect(degraded).toContain("modified");
  });

  test("adding a field that a view depends on restores it", () => {
    const join = new SchemaAwareJoin(schemaZSet(FS_METADATA_SCHEMA_V1));
    join.subscribe(fileInfoView);

    // Remove then re-add "modified"
    join.applyAndPropagate({
      retract: [{ name: "modified", type: "string", required: false }],
      insert: [],
    });
    expect(join.getViewDegraded("view/file-info")).toContain("modified");

    join.applyAndPropagate({
      retract: [],
      insert: [{ name: "modified", type: "string", required: false }],
    });
    expect(join.getViewDegraded("view/file-info")).not.toContain("modified");
  });

  test("unaffected views are NOT recomputed (efficiency)", () => {
    const join = new SchemaAwareJoin(schemaZSet(FS_METADATA_SCHEMA_V1));
    join.subscribe(fileInfoView);
    join.subscribe(permissionsView);

    // Add "owner" — neither view depends on it
    const delta: SchemaEvolutionDelta = {
      retract: [],
      insert: [{ name: "owner", type: "zetaid", required: false }],
    };
    const results = join.applyAndPropagate(delta);
    expect(results.length).toBe(0); // no views affected
  });
});

describe("SchemaAwareJoin — braided-free-monoid commutativity", () => {
  test("disjoint deltas commute (same final schema regardless of order)", () => {
    const schema = schemaZSet(FS_METADATA_SCHEMA_V1);

    const d1: SchemaEvolutionDelta = {
      retract: [],
      insert: [{ name: "owner", type: "zetaid", required: false }],
    };
    const d2: SchemaEvolutionDelta = {
      retract: [],
      insert: [{ name: "checksum", type: "string", required: false }],
    };

    expect(deltasCommute(schema, d1, d2)).toBe(true);
  });

  test("disjoint retract + insert commute", () => {
    const schema = schemaZSet(FS_METADATA_SCHEMA_V1);

    const d1: SchemaEvolutionDelta = {
      retract: [{ name: "modified", type: "string", required: false }],
      insert: [],
    };
    const d2: SchemaEvolutionDelta = {
      retract: [],
      insert: [{ name: "owner", type: "zetaid", required: false }],
    };

    expect(deltasCommute(schema, d1, d2)).toBe(true);
  });

  test("overlapping deltas may NOT commute (same field, different ops)", () => {
    const schema = schemaZSet(FS_METADATA_SCHEMA_V1);

    // Both touch "modified" — this is NOT guaranteed to commute
    const d1: SchemaEvolutionDelta = {
      retract: [{ name: "modified", type: "string", required: false }],
      insert: [],
    };
    const d2: SchemaEvolutionDelta = {
      retract: [{ name: "modified", type: "string", required: false }],
      insert: [{ name: "modified", type: "number", required: false }],
    };

    // This may or may not commute — the test documents the behavior
    const commutes = deltasCommute(schema, d1, d2);
    // We just verify it doesn't crash; the property is documented
    expect(typeof commutes).toBe("boolean");
  });
});
