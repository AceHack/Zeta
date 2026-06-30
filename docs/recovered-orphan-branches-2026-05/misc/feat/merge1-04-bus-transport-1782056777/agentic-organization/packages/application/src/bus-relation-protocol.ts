// bus-relation-protocol.ts — Merge1 §04: room federation handshake.
//
// Port of the donor `tools/bus/relation-protocol.ts` + `relation-graph.ts`
// (absent from this repo's bus slice; implemented from the §04 spec). Two rooms
// establish a durable relation via a three-step handshake:
//
//   1. relation-offer   — room A proposes a relation to room B
//   2. relation-accept  — room B accepts A's offer (matched by relationId)
//   3. relation-edge     — a durable, bidirectional edge certificate is emitted
//
// The edge graph is append-only / retraction-native (MP-4): re-emitting an
// identical edge is idempotent; an edge whose relationId already exists with
// different endpoints is a surfaced conflict, never a silent overwrite.

import type { Result } from "./bus-transport.ts";
import { err, ok } from "./bus-transport.ts";
import type { BusMessage, SenderRoomAgentId } from "./bus-types.ts";

/** A durable bidirectional relation between two rooms. */
export type RelationEdge = {
  readonly relationId: string;
  readonly from: SenderRoomAgentId; // the offerer
  readonly to: SenderRoomAgentId; // the acceptor
  readonly basis: "offer-accept";
  readonly acceptedBy: SenderRoomAgentId; // === to
};

/** A relation protocol command: the acting room sends `message` to `to`. */
export type RelationProtocolCommand = {
  readonly to: SenderRoomAgentId;
  readonly message: BusMessage;
};

export type RelationProtocolFeedback =
  | { readonly kind: "not_a_relation_topic"; readonly topic: BusMessage["topic"] }
  | { readonly kind: "edge_conflict"; readonly relationId: string; readonly reason: string };

/** Flattened projection for TLA+ formal verification — endpoints are order-normalized. */
export type RelationEdgeTlaProjection = {
  readonly relationId: string;
  readonly endpoints: readonly [SenderRoomAgentId, SenderRoomAgentId];
  readonly accepted: true;
};

export function toTlaProjection(edge: RelationEdge): RelationEdgeTlaProjection {
  const endpoints: [SenderRoomAgentId, SenderRoomAgentId] =
    edge.from <= edge.to ? [edge.from, edge.to] : [edge.to, edge.from];
  return { relationId: edge.relationId, endpoints, accepted: true };
}

function sameEndpoints(a: RelationEdge, b: RelationEdge): boolean {
  return (a.from === b.from && a.to === b.to) || (a.from === b.to && a.to === b.from);
}

/**
 * Append an edge to a graph under G-Set union semantics. Re-adding an edge whose
 * relationId already exists is idempotent when the endpoints match, and a
 * surfaced conflict when they differ (never a silent overwrite).
 */
export function addRelationEdge(
  edges: readonly RelationEdge[],
  edge: RelationEdge,
): Result<readonly RelationEdge[], RelationProtocolFeedback> {
  const existing = edges.find((e) => e.relationId === edge.relationId);
  if (existing !== undefined) {
    if (sameEndpoints(existing, edge)) return ok(edges); // idempotent
    return err({ kind: "edge_conflict", relationId: edge.relationId, reason: "relationId already bound to different endpoints" });
  }
  return ok([...edges, edge]);
}

/** All edges incident to `agent` (bidirectional). */
export function relationEdgesFor(edges: readonly RelationEdge[], agent: SenderRoomAgentId): readonly RelationEdge[] {
  return edges.filter((e) => e.from === agent || e.to === agent);
}

/**
 * Process one relation protocol command against the existing edge set.
 *
 * - `relation-offer`: a standalone proposal — emits no edge yet → ok(undefined).
 * - `relation-accept`: `self` accepts an offer (relationId) made by `command.to`,
 *   COMPLETING the handshake → ok(edge), or ok(undefined) if the edge already
 *   exists (idempotent), or edge_conflict if the relationId is bound elsewhere.
 * - `relation-edge`: a durable certificate to ratify — validated + deduped.
 * - any other topic → not_a_relation_topic feedback.
 */
export function processRelationCommand(
  self: SenderRoomAgentId,
  command: RelationProtocolCommand,
  existingEdges: readonly RelationEdge[],
): Result<RelationEdge | undefined, RelationProtocolFeedback> {
  const { message } = command;
  switch (message.topic) {
    case "relation-offer":
      return ok(undefined); // offer recorded; edge emitted on accept

    case "relation-accept": {
      const edge: RelationEdge = {
        relationId: message.payload.relationId,
        from: command.to, // the original offerer
        to: self, // the acceptor
        basis: "offer-accept",
        acceptedBy: self,
      };
      const merged = addRelationEdge(existingEdges, edge);
      if (!merged.ok) return merged;
      const exists = existingEdges.some((e) => e.relationId === edge.relationId);
      return ok(exists ? undefined : edge);
    }

    case "relation-edge": {
      const edge: RelationEdge = {
        relationId: message.payload.relationId,
        from: message.payload.from,
        to: message.payload.to,
        basis: message.payload.basis,
        acceptedBy: message.payload.acceptedBy,
      };
      const merged = addRelationEdge(existingEdges, edge);
      if (!merged.ok) return merged;
      const exists = existingEdges.some((e) => e.relationId === edge.relationId);
      return ok(exists ? undefined : edge);
    }

    default:
      return err({ kind: "not_a_relation_topic", topic: message.topic });
  }
}
