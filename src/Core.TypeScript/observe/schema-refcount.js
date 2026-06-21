/**
 * src/Core.TypeScript/observe/schema-refcount.ts — reference-counted schema quorum.
 *
 * The overlap window closes based on PROVABLE ZERO REFERENCES to old schema
 * fields. Every consumer (UI component, backend service, agent, materialized view)
 * declares which schema fields it references. Consolidation is blocked until
 * refCount(oldFields) = 0.
 *
 * This is the quorum condition that makes zero-downtime provable:
 *   canConsolidate iff ∀ f ∈ retractedFields: refCount(f) = 0
 *
 * Composes with:
 *   - src/Core.TypeScript/observe/schema-overlap.ts (the state machine this feeds)
 *   - src/Core.TypeScript/observe/schema-zset.ts (the schema Z-set)
 *   - src/Core.TypeScript/peer-call/summon.ts (adversarial review gate)
 *   - docs/specs/zero-downtime-schema-evolution/ (the spec)
 */
import { currentSchema } from "./schema-zset";
/**
 * Compute reference counts for a set of fields.
 * Returns one entry per field with the count of consumers that reference it.
 */
export function refCounts(fields, consumers) {
    return fields.map(fieldName => {
        const referencing = consumers.filter(c => c.referencedFields.includes(fieldName));
        return {
            fieldName,
            count: referencing.length,
            consumers: referencing.map(c => c.id),
        };
    });
}
/**
 * Get reference counts for RETRACTED fields only (the ones that matter for quorum).
 * These are fields that have been removed from the schema but may still be
 * referenced by consumers.
 */
export function retractedFieldRefCounts(schema, allKnownFields, consumers) {
    const activeFieldNames = new Set(currentSchema(schema).map(f => f.name));
    // Retracted = was known, no longer active
    const retractedFields = allKnownFields.filter(f => !activeFieldNames.has(f));
    return refCounts(retractedFields, consumers);
}
/**
 * Check if it's safe to consolidate (drop old schema entries).
 * Safe iff EVERY retracted field has zero references.
 *
 * This is the provable quorum condition:
 *   canConsolidate iff ∀ f ∈ retractedFields: refCount(f) = 0
 */
export function checkQuorum(schema, allKnownFields, consumers) {
    const counts = retractedFieldRefCounts(schema, allKnownFields, consumers);
    const blocking = counts.filter(c => c.count > 0);
    const totalRemainingRefs = blocking.reduce((sum, c) => sum + c.count, 0);
    return {
        safe: blocking.length === 0,
        blocking,
        totalRemainingRefs,
    };
}
// ─── Consumer management ─────────────────────────────────────────────────────
/** Register a consumer's field dependencies. */
export function registerConsumer(consumers, consumer) {
    // Replace if same id exists (updated declaration)
    const filtered = consumers.filter(c => c.id !== consumer.id);
    return [...filtered, consumer];
}
/** Remove a consumer (it no longer exists / was decommissioned). */
export function deregisterConsumer(consumers, consumerId) {
    return consumers.filter(c => c.id !== consumerId);
}
/**
 * Update a consumer's field references (e.g., after it migrates to new schema).
 * This is how a consumer "migrates": it updates its declaration to no longer
 * reference old fields.
 */
export function updateConsumerRefs(consumers, consumerId, newRefs) {
    return consumers.map(c => c.id === consumerId ? { ...c, referencedFields: newRefs } : c);
}
/**
 * List all consumers that still reference a specific field.
 * Useful for reporting: "these N consumers block consolidation of field X."
 */
export function consumersOfField(consumers, fieldName) {
    return consumers.filter(c => c.referencedFields.includes(fieldName));
}
/**
 * Build the adversarial review prompt for the critic persona.
 * This is what gets sent to the summon protocol.
 */
export function buildReviewPrompt(request) {
    const fieldList = request.claimedZeroRefFields.join(", ");
    const consumerList = request.knownConsumers.map(c => `  - ${c.id} (${c.kind}): references [${c.referencedFields.join(", ")}]`).join("\n");
    return [
        `ADVERSARIAL REVIEW: Schema migration proof verification`,
        ``,
        `Claim: The following retracted fields have ZERO remaining references`,
        `and are safe to consolidate (drop from the schema Z-set):`,
        `  Fields: ${fieldList}`,
        `  Schema source: ${request.schemaSource}`,
        ``,
        `Known consumers (declared field references):`,
        consumerList || "  (no consumers registered)",
        ``,
        `Your task: CHALLENGE this claim. Find ANY consumer — registered or not —`,
        `that might still reference these fields. Consider:`,
        `- UI components that render these fields`,
        `- Backend services that query these fields`,
        `- Materialized views that index on these fields`,
        `- Agent loops that read these fields from the workspace port`,
        `- Tests that assert on these fields`,
        `- Documentation that references these fields as live (not provenance)`,
        ``,
        `If you find a missed consumer: respond with its id, kind, and which`,
        `fields it references. If you cannot find one: confirm the claim.`,
        ``,
        `Respond in JSON: { "verdict": "confirmed"|"challenged", "reasoning": "..." }`,
        `If challenged, also include: { "missedConsumer": { "id": "...", "kind": "...", "referencedFields": [...] } }`,
    ].join("\n");
}
