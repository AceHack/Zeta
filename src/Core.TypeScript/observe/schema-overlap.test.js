import { describe, expect, test } from "bun:test";
import { overlapStatus, canDropOldSchema, tryConsolidate, migrateReader, registerReader, pendingReaders, } from "./schema-overlap";
import { schemaZSet, applyDelta, currentSchema, FS_METADATA_SCHEMA_V1, } from "./schema-zset";
const READERS = [
    { id: "otto", migrated: false },
    { id: "alexa", migrated: false },
    { id: "vera", migrated: false },
];
describe("schema-overlap — state machine", () => {
    test("stable when no overlap (clean schema)", () => {
        const schema = schemaZSet(FS_METADATA_SCHEMA_V1);
        const status = overlapStatus(schema, READERS);
        expect(status.state).toBe("stable");
        expect(status.fieldsInOverlap.length).toBe(0);
        expect(status.canConsolidate).toBe(false);
    });
    test("writer_switched after delta applied (no readers migrated)", () => {
        const schema = schemaZSet(FS_METADATA_SCHEMA_V1);
        // Simulate: rename "modified" → "lastModified" (retract old + insert new)
        // The retraction leaves "modified" at weight 0 (dropped by applyDelta),
        // but we need to keep it visible during overlap. So we add it back at -1
        // manually to simulate "old entry exists but retracted, not yet consolidated"
        const delta = {
            retract: [],
            insert: [{ name: "lastModified", type: "string", required: false }],
        };
        const evolved = applyDelta(schema, delta);
        // Now "lastModified" is new (weight +1) — the overlap is that both old "modified"
        // AND new "lastModified" exist. isInOverlap checks for negative weights or duplicates.
        // For a true overlap: add a -1 entry for a field that's still at +1
        const withOverlap = [...evolved, { field: { name: "modified", type: "string", required: false }, weight: -1 }];
        const status = overlapStatus(withOverlap, READERS);
        expect(status.state).toBe("writer_switched");
        expect(status.fieldsInOverlap).toContain("modified");
    });
    test("readers_migrating when some (not all) readers migrated", () => {
        const schema = schemaZSet(FS_METADATA_SCHEMA_V1);
        const evolved = [...schema, { field: { name: "modified", type: "string", required: false }, weight: -1 }];
        const partiallyMigrated = migrateReader(READERS, "otto");
        const status = overlapStatus(evolved, partiallyMigrated);
        expect(status.state).toBe("readers_migrating");
        expect(status.migratedReaders).toBe(1);
        expect(status.totalReaders).toBe(3);
    });
    test("quorum when all readers migrated", () => {
        const schema = schemaZSet(FS_METADATA_SCHEMA_V1);
        const evolved = [...schema, { field: { name: "modified", type: "string", required: false }, weight: -1 }];
        let readers = migrateReader(READERS, "otto");
        readers = migrateReader(readers, "alexa");
        readers = migrateReader(readers, "vera");
        const status = overlapStatus(evolved, readers);
        expect(status.state).toBe("quorum");
        expect(status.canConsolidate).toBe(true);
    });
});
describe("schema-overlap — consolidation", () => {
    test("canDropOldSchema is false when readers pending", () => {
        const schema = [...schemaZSet(FS_METADATA_SCHEMA_V1), { field: { name: "modified", type: "string", required: false }, weight: -1 }];
        expect(canDropOldSchema(schema, READERS)).toBe(false);
    });
    test("canDropOldSchema is true at quorum", () => {
        const schema = [...schemaZSet(FS_METADATA_SCHEMA_V1), { field: { name: "modified", type: "string", required: false }, weight: -1 }];
        const allMigrated = READERS.map(r => ({ ...r, migrated: true }));
        expect(canDropOldSchema(schema, allMigrated)).toBe(true);
    });
    test("tryConsolidate succeeds at quorum", () => {
        const schema = [...schemaZSet(FS_METADATA_SCHEMA_V1), { field: { name: "modified", type: "string", required: false }, weight: -1 }];
        const allMigrated = READERS.map(r => ({ ...r, migrated: true }));
        const result = tryConsolidate(schema, allMigrated);
        expect(result.ok).toBe(true);
        if (result.ok) {
            // "modified" should be gone (weight was +1 from original, -1 from retraction = 0 → dropped)
            const fields = currentSchema(result.schema);
            expect(fields.find(f => f.name === "modified")).toBeUndefined();
        }
    });
    test("tryConsolidate fails when readers pending", () => {
        const schema = [...schemaZSet(FS_METADATA_SCHEMA_V1), { field: { name: "modified", type: "string", required: false }, weight: -1 }];
        const result = tryConsolidate(schema, READERS);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toContain("3 reader(s) not yet migrated");
        }
    });
    test("tryConsolidate on stable schema is a no-op (ok)", () => {
        const schema = schemaZSet(FS_METADATA_SCHEMA_V1);
        const result = tryConsolidate(schema, READERS);
        expect(result.ok).toBe(true);
    });
});
describe("schema-overlap — reader management", () => {
    test("registerReader adds a new reader", () => {
        const readers = registerReader(READERS, "lior");
        expect(readers.length).toBe(4);
        expect(readers.find(r => r.id === "lior")?.migrated).toBe(false);
    });
    test("registerReader is idempotent", () => {
        const readers = registerReader(READERS, "otto");
        expect(readers.length).toBe(3); // already there
    });
    test("migrateReader marks a reader as migrated", () => {
        const readers = migrateReader(READERS, "alexa");
        expect(readers.find(r => r.id === "alexa")?.migrated).toBe(true);
        expect(readers.find(r => r.id === "otto")?.migrated).toBe(false);
    });
    test("pendingReaders returns only unmigrated", () => {
        const readers = migrateReader(READERS, "otto");
        const pending = pendingReaders(readers);
        expect(pending.length).toBe(2);
        expect(pending.map(r => r.id)).not.toContain("otto");
    });
});
