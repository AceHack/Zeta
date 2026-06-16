/**
 * schema-evolution-demo.test.ts — Task 6: worked example of FS metadata v1 → v2.
 *
 * This is the TEMPLATE for every future schema evolution. The full sequence:
 *   1. Define new schema (V2 = V1 + owner field)
 *   2. Compute delta automatically
 *   3. Emit CDC event
 *   4. Apply delta to schema Z-set
 *   5. Verify old entries still readable (overlap window)
 *   6. Migrate readers
 *   7. Consolidate (close overlap)
 *   8. Verify conformance suite passes at every step
 */

import { describe, expect, test } from "bun:test";
import {
  schemaZSet,
  applyDelta,
  deltaFromSchemas,
  currentSchema,
  resolveField,
  consolidate,
  FS_METADATA_SCHEMA_V1,
  FS_METADATA_SCHEMA_V2,
} from "./schema-zset";
import {
  emitSchemaEvent,
  parseSchemaEvent,
  addedFields,
} from "./schema-cdc";
import {
  overlapStatus,
  tryConsolidate,
  migrateReader,
  registerReader,
  type SchemaReader,
} from "./schema-overlap";

describe("schema evolution worked example: FS metadata v1 → v2", () => {
  // The full lifecycle in one test — the template for all future evolutions
  test("complete lifecycle: define → delta → emit → apply → overlap → migrate → consolidate", () => {
    // ── Step 1: Starting state (V1 schema, 3 readers) ──────────────
    let schema = schemaZSet(FS_METADATA_SCHEMA_V1);
    let readers: readonly SchemaReader[] = [
      { id: "otto", migrated: false },
      { id: "alexa", migrated: false },
      { id: "vera", migrated: false },
    ];

    // Verify: stable, 6 fields, no overlap
    expect(overlapStatus(schema, readers).state).toBe("stable");
    expect(currentSchema(schema).length).toBe(6);

    // ── Step 2: Compute delta automatically ────────────────────────
    const delta = deltaFromSchemas(FS_METADATA_SCHEMA_V1, FS_METADATA_SCHEMA_V2);
    expect(delta.retract.length).toBe(0);       // nothing removed
    expect(delta.insert.length).toBe(1);        // "owner" added
    expect(delta.insert[0]!.name).toBe("owner");

    // ── Step 3: Emit CDC event ─────────────────────────────────────
    const event = emitSchemaEvent(
      FS_METADATA_SCHEMA_V1,
      FS_METADATA_SCHEMA_V2,
      delta,
      { source: "zeta://schema/fs-metadata", actor: "alexa", mint: () => "b".repeat(32), now: () => Date.now() },
    );
    expect(event.type).toBe("schema.evolved");
    expect(addedFields(event)[0]!.name).toBe("owner");

    // Verify: event round-trips through parse
    const parsed = parseSchemaEvent(event);
    expect(parsed.ok).toBe(true);

    // ── Step 4: Apply delta to schema Z-set ────────────────────────
    schema = applyDelta(schema, delta);
    expect(currentSchema(schema).length).toBe(7);
    expect(resolveField(schema, "owner")?.type).toBe("zetaid");

    // ── Step 5: Verify old entries still work (overlap window) ─────
    // "owner" is optional (required: false) → old entries without it are valid
    // This is the backward-compat guarantee: no read fails
    expect(resolveField(schema, "contentHash")?.required).toBe(true);  // still there
    expect(resolveField(schema, "executable")?.default).toBe(true);    // still inverted default
    expect(resolveField(schema, "owner")?.required).toBe(false);       // new field is optional

    // Status: stable (no retractions, just an addition) — additions are trivially safe
    expect(overlapStatus(schema, readers).state).toBe("stable");

    // ── Step 6: Migrate readers ────────────────────────────────────
    readers = migrateReader(readers, "otto");
    readers = migrateReader(readers, "alexa");
    readers = migrateReader(readers, "vera");

    // ── Step 7: Consolidate (close overlap) ────────────────────────
    const result = tryConsolidate(schema, readers);
    expect(result.ok).toBe(true);
    // For a pure addition, consolidation is a no-op (nothing to drop)
    if (result.ok) {
      expect(currentSchema(result.schema).length).toBe(7);
    }
  });

  test("lifecycle with field REMOVAL (the harder case)", () => {
    // Remove "modified" field — this creates a real overlap window
    let schema = schemaZSet(FS_METADATA_SCHEMA_V1);
    let readers: SchemaReader[] = [
      { id: "otto", migrated: false },
      { id: "alexa", migrated: false },
    ];

    const v1WithoutModified = FS_METADATA_SCHEMA_V1.filter(f => f.name !== "modified");
    const delta = deltaFromSchemas(FS_METADATA_SCHEMA_V1, v1WithoutModified);
    expect(delta.retract.length).toBe(1);
    expect(delta.retract[0]!.name).toBe("modified");

    // Apply — "modified" is now at weight 0 (retracted)
    schema = applyDelta(schema, delta);
    // After applyDelta, weight is 0 → already dropped (Z-set consolidates internally)
    expect(resolveField(schema, "modified")).toBeUndefined();
    expect(currentSchema(schema).length).toBe(5);

    // But we can track the overlap externally via readers
    // Register that some readers still expect "modified"
    // (In practice, the overlap is about ENTRIES in the db, not the schema Z-set itself)
    readers = migrateReader(readers, "otto");
    readers = migrateReader(readers, "alexa");

    // All migrated → safe
    const result = tryConsolidate(schema, readers);
    expect(result.ok).toBe(true);
  });

  test("lifecycle with field TYPE CHANGE (retract old + insert new)", () => {
    // Change "created" from string to number (timestamp)
    const before = FS_METADATA_SCHEMA_V1;
    const after = FS_METADATA_SCHEMA_V1.map(f =>
      f.name === "created" ? { ...f, type: "number" as const } : f
    );

    const delta = deltaFromSchemas(before, after);
    expect(delta.retract.length).toBe(1);
    expect(delta.retract[0]!.name).toBe("created");
    expect(delta.retract[0]!.type).toBe("string");
    expect(delta.insert.length).toBe(1);
    expect(delta.insert[0]!.name).toBe("created");
    expect(delta.insert[0]!.type).toBe("number");

    let schema = schemaZSet(before);
    schema = applyDelta(schema, delta);

    // The new "created" is active with type "number"
    expect(resolveField(schema, "created")?.type).toBe("number");
  });
});
