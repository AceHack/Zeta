import { describe, expect, test } from "bun:test";
import {
  emitSchemaEvent,
  parseSchemaEvent,
  addedFields,
  removedFields,
  changedFields,
} from "./schema-cdc";
import {
  deltaFromSchemas,
  FS_METADATA_SCHEMA_V1,
  FS_METADATA_SCHEMA_V2,
} from "./schema-zset";

const DETERMINISTIC_OPTS = {
  source: "zeta://schema/fs-metadata",
  subject: "fs-metadata",
  actor: "alexa",
  now: () => 1750000000000, // fixed timestamp for DST
  mint: () => "a".repeat(32), // fixed id for DST
};

describe("schema-cdc — emit CloudEvents envelope", () => {
  test("emits a valid CloudEvents 1.0 envelope", () => {
    const delta = deltaFromSchemas(FS_METADATA_SCHEMA_V1, FS_METADATA_SCHEMA_V2);
    const event = emitSchemaEvent(FS_METADATA_SCHEMA_V1, FS_METADATA_SCHEMA_V2, delta, DETERMINISTIC_OPTS);

    expect(event.specversion).toBe("1.0");
    expect(event.type).toBe("schema.evolved");
    expect(event.source).toBe("zeta://schema/fs-metadata");
    expect(event.id).toBe("a".repeat(32));
    expect(event.datacontenttype).toBe("application/json");
    expect(event.time).toContain("2025"); // from the fixed timestamp
  });

  test("data payload contains before/after/delta/actor", () => {
    const delta = deltaFromSchemas(FS_METADATA_SCHEMA_V1, FS_METADATA_SCHEMA_V2);
    const event = emitSchemaEvent(FS_METADATA_SCHEMA_V1, FS_METADATA_SCHEMA_V2, delta, DETERMINISTIC_OPTS);

    expect(event.data.before.length).toBe(6);
    expect(event.data.after.length).toBe(7);
    expect(event.data.delta.insert.length).toBe(1);
    expect(event.data.delta.insert[0]!.name).toBe("owner");
    expect(event.data.actor).toBe("alexa");
  });
});

describe("schema-cdc — parse + validate", () => {
  test("parse round-trips an emitted event", () => {
    const delta = deltaFromSchemas(FS_METADATA_SCHEMA_V1, FS_METADATA_SCHEMA_V2);
    const event = emitSchemaEvent(FS_METADATA_SCHEMA_V1, FS_METADATA_SCHEMA_V2, delta, DETERMINISTIC_OPTS);

    const parsed = parseSchemaEvent(event);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.event.id).toBe(event.id);
      expect(parsed.event.data.delta.insert[0]!.name).toBe("owner");
    }
  });

  test("rejects non-object input", () => {
    expect(parseSchemaEvent(null).ok).toBe(false);
    expect(parseSchemaEvent("string").ok).toBe(false);
    expect(parseSchemaEvent(42).ok).toBe(false);
  });

  test("rejects missing required fields", () => {
    expect(parseSchemaEvent({}).ok).toBe(false);
    expect(parseSchemaEvent({ id: "x" }).ok).toBe(false);
    expect(parseSchemaEvent({ id: "x", source: "y", type: "wrong" }).ok).toBe(false);
  });

  test("rejects missing data payload", () => {
    const result = parseSchemaEvent({
      id: "x", source: "y", type: "schema.evolved", specversion: "1.0", time: "t",
    });
    expect(result.ok).toBe(false);
  });
});

describe("schema-cdc — field extraction helpers", () => {
  test("addedFields extracts fields in after but not before", () => {
    const delta = deltaFromSchemas(FS_METADATA_SCHEMA_V1, FS_METADATA_SCHEMA_V2);
    const event = emitSchemaEvent(FS_METADATA_SCHEMA_V1, FS_METADATA_SCHEMA_V2, delta, DETERMINISTIC_OPTS);

    const added = addedFields(event);
    expect(added.length).toBe(1);
    expect(added[0]!.name).toBe("owner");
  });

  test("removedFields extracts fields in before but not after", () => {
    const before = [...FS_METADATA_SCHEMA_V1];
    const after = FS_METADATA_SCHEMA_V1.filter(f => f.name !== "modified");
    const delta = deltaFromSchemas(before, after);
    const event = emitSchemaEvent(before, after, delta, DETERMINISTIC_OPTS);

    const removed = removedFields(event);
    expect(removed.length).toBe(1);
    expect(removed[0]!.name).toBe("modified");
  });

  test("changedFields detects type changes", () => {
    const before = [{ name: "x", type: "string" as const, required: true }];
    const after = [{ name: "x", type: "number" as const, required: true }];
    const delta = deltaFromSchemas(before, after);
    const event = emitSchemaEvent(before, after, delta, DETERMINISTIC_OPTS);

    const changed = changedFields(event);
    expect(changed.length).toBe(1);
    expect(changed[0]!.before.type).toBe("string");
    expect(changed[0]!.after.type).toBe("number");
  });

  test("no changes when schemas are identical", () => {
    const delta = deltaFromSchemas(FS_METADATA_SCHEMA_V1, FS_METADATA_SCHEMA_V1);
    const event = emitSchemaEvent(FS_METADATA_SCHEMA_V1, FS_METADATA_SCHEMA_V1, delta, DETERMINISTIC_OPTS);

    expect(addedFields(event).length).toBe(0);
    expect(removedFields(event).length).toBe(0);
    expect(changedFields(event).length).toBe(0);
  });
});
