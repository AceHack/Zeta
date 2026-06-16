import { describe, expect, test } from "bun:test";
import {
  refCounts,
  retractedFieldRefCounts,
  checkQuorum,
  registerConsumer,
  deregisterConsumer,
  updateConsumerRefs,
  consumersOfField,
  buildReviewPrompt,
  type SchemaConsumer,
  type AdversarialReviewRequest,
} from "./schema-refcount";
import { schemaZSet, applyDelta, FS_METADATA_SCHEMA_V1 } from "./schema-zset";

const CONSUMERS: SchemaConsumer[] = [
  { id: "ui/dashboard", kind: "ui", referencedFields: ["contentHash", "paths", "modified"] },
  { id: "backend/search", kind: "backend", referencedFields: ["contentHash", "paths"] },
  { id: "agent/otto", kind: "agent", referencedFields: ["executable", "modified"] },
  { id: "view/recent-files", kind: "view", referencedFields: ["modified", "created"] },
];

describe("schema-refcount — reference counting", () => {
  test("refCounts computes per-field consumer counts", () => {
    const counts = refCounts(["modified", "contentHash", "nonexistent"], CONSUMERS);
    
    const modified = counts.find(c => c.fieldName === "modified")!;
    expect(modified.count).toBe(3); // ui/dashboard, agent/otto, view/recent-files
    expect(modified.consumers).toContain("ui/dashboard");
    expect(modified.consumers).toContain("agent/otto");
    
    const contentHash = counts.find(c => c.fieldName === "contentHash")!;
    expect(contentHash.count).toBe(2); // ui/dashboard, backend/search
    
    const nonexistent = counts.find(c => c.fieldName === "nonexistent")!;
    expect(nonexistent.count).toBe(0);
  });

  test("retractedFieldRefCounts only counts fields no longer in active schema", () => {
    // Retract "modified" from the schema
    const schema = applyDelta(
      schemaZSet(FS_METADATA_SCHEMA_V1),
      { retract: [{ name: "modified", type: "string", required: false }], insert: [] },
    );
    const allKnown = FS_METADATA_SCHEMA_V1.map(f => f.name);
    const counts = retractedFieldRefCounts(schema, allKnown, CONSUMERS);
    
    // Only "modified" is retracted (others still active)
    expect(counts.length).toBe(1);
    expect(counts[0]!.fieldName).toBe("modified");
    expect(counts[0]!.count).toBe(3); // 3 consumers still reference it
  });
});

describe("schema-refcount — quorum check", () => {
  test("quorum NOT safe when consumers still reference retracted fields", () => {
    const schema = applyDelta(
      schemaZSet(FS_METADATA_SCHEMA_V1),
      { retract: [{ name: "modified", type: "string", required: false }], insert: [] },
    );
    const allKnown = FS_METADATA_SCHEMA_V1.map(f => f.name);
    const status = checkQuorum(schema, allKnown, CONSUMERS);
    
    expect(status.safe).toBe(false);
    expect(status.blocking.length).toBe(1);
    expect(status.blocking[0]!.fieldName).toBe("modified");
    expect(status.totalRemainingRefs).toBe(3);
  });

  test("quorum IS safe when no consumers reference retracted fields", () => {
    const schema = applyDelta(
      schemaZSet(FS_METADATA_SCHEMA_V1),
      { retract: [{ name: "modified", type: "string", required: false }], insert: [] },
    );
    const allKnown = FS_METADATA_SCHEMA_V1.map(f => f.name);
    // Remove all consumers that reference "modified"
    const migratedConsumers = CONSUMERS.map(c => ({
      ...c,
      referencedFields: c.referencedFields.filter(f => f !== "modified"),
    }));
    const status = checkQuorum(schema, allKnown, migratedConsumers);
    
    expect(status.safe).toBe(true);
    expect(status.blocking.length).toBe(0);
    expect(status.totalRemainingRefs).toBe(0);
  });

  test("quorum is trivially safe when nothing is retracted", () => {
    const schema = schemaZSet(FS_METADATA_SCHEMA_V1);
    const allKnown = FS_METADATA_SCHEMA_V1.map(f => f.name);
    const status = checkQuorum(schema, allKnown, CONSUMERS);
    
    expect(status.safe).toBe(true); // nothing retracted → nothing to check
  });
});

describe("schema-refcount — consumer management", () => {
  test("registerConsumer adds a new consumer", () => {
    const newConsumer: SchemaConsumer = {
      id: "ui/settings", kind: "ui", referencedFields: ["owner"],
    };
    const updated = registerConsumer(CONSUMERS, newConsumer);
    expect(updated.length).toBe(5);
    expect(updated.find(c => c.id === "ui/settings")).toBeDefined();
  });

  test("registerConsumer replaces existing (same id)", () => {
    const replacement: SchemaConsumer = {
      id: "ui/dashboard", kind: "ui", referencedFields: ["contentHash"], // dropped "modified" + "paths"
    };
    const updated = registerConsumer(CONSUMERS, replacement);
    expect(updated.length).toBe(4); // same count (replaced, not added)
    const dashboard = updated.find(c => c.id === "ui/dashboard")!;
    expect(dashboard.referencedFields).toEqual(["contentHash"]);
  });

  test("deregisterConsumer removes a consumer", () => {
    const updated = deregisterConsumer(CONSUMERS, "agent/otto");
    expect(updated.length).toBe(3);
    expect(updated.find(c => c.id === "agent/otto")).toBeUndefined();
  });

  test("updateConsumerRefs changes field references (migration)", () => {
    // Dashboard migrates: stops referencing "modified", starts referencing "lastModified"
    const updated = updateConsumerRefs(CONSUMERS, "ui/dashboard", ["contentHash", "paths", "lastModified"]);
    const dashboard = updated.find(c => c.id === "ui/dashboard")!;
    expect(dashboard.referencedFields).not.toContain("modified");
    expect(dashboard.referencedFields).toContain("lastModified");
  });

  test("consumersOfField finds all consumers referencing a field", () => {
    const result = consumersOfField(CONSUMERS, "modified");
    expect(result.length).toBe(3);
    expect(result.map(c => c.id)).toContain("ui/dashboard");
    expect(result.map(c => c.id)).toContain("agent/otto");
    expect(result.map(c => c.id)).toContain("view/recent-files");
  });
});

describe("schema-refcount — adversarial review prompt", () => {
  test("buildReviewPrompt generates a structured challenge", () => {
    const request: AdversarialReviewRequest = {
      claimedZeroRefFields: ["modified"],
      knownConsumers: CONSUMERS,
      schemaSource: "zeta://schema/fs-metadata",
    };
    const prompt = buildReviewPrompt(request);
    
    expect(prompt).toContain("ADVERSARIAL REVIEW");
    expect(prompt).toContain("modified");
    expect(prompt).toContain("zeta://schema/fs-metadata");
    expect(prompt).toContain("ui/dashboard");
    expect(prompt).toContain("CHALLENGE this claim");
    expect(prompt).toContain("verdict");
  });

  test("prompt includes all known consumers with their refs", () => {
    const request: AdversarialReviewRequest = {
      claimedZeroRefFields: ["old-field"],
      knownConsumers: [
        { id: "svc/api", kind: "backend", referencedFields: ["x", "y"] },
      ],
      schemaSource: "test://schema",
    };
    const prompt = buildReviewPrompt(request);
    expect(prompt).toContain("svc/api (backend): references [x, y]");
  });
});
