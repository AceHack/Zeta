// bus-claim-coordinator.ts — Merge1 §04: room work-item claim coordination.
//
// Port of the donor `src/Core.TypeScript/bus/claim.ts` claim/release semantics,
// re-shaped over the `TransportPort` seam. Rooms coordinate ownership of work
// items without split-brain: a room acquires a claim before working an item;
// other rooms see the claim via `check` and back off.
//
// The donor's latest-action-wins reducer is ported verbatim (claim vs release
// per (from, itemId), newest publishedAt then id wins; a release cancels the
// claim). The donor's filesystem advisory lock is a transport-adapter concern
// (file lock for the folder bus, CAS for NATS) and is out of this pure port.

import type { TransportPort } from "./bus-transport.ts";
import type { BusMessageEnvelope, ClaimPayload, SenderRoomAgentId } from "./bus-types.ts";
import { ROOM_TOPIC_TTL_MS } from "./bus-types.ts";

export type ClaimStatus =
  | { readonly outcome: "unclaimed" }
  | { readonly outcome: "claimed"; readonly by: SenderRoomAgentId; readonly worktree?: string };

export type ClaimResult =
  | { readonly outcome: "acquired"; readonly itemId: string }
  | { readonly outcome: "released"; readonly itemId: string }
  | { readonly outcome: "feedback"; readonly reason: string };

export interface ClaimCoordinator {
  check(itemId: string): Promise<ClaimStatus>;
  acquire(itemId: string, branch?: string, worktree?: string): Promise<ClaimResult>;
  release(itemId: string): Promise<ClaimResult>;
}

export type ClaimRecord = {
  readonly from: SenderRoomAgentId;
  readonly itemId: string;
  readonly branch?: string;
  readonly worktree?: string;
  readonly publishedAt: string;
  readonly id: string;
};

/**
 * Compute the active (un-released) claims for an item from a list of claim-topic
 * envelopes. Latest action per (from, itemId) wins (newest publishedAt, then id
 * as a stable tiebreaker); a release cancels the claim. Pure — ported from the
 * donor `activeClaims`.
 */
export function computeActiveClaims(envelopes: readonly BusMessageEnvelope[], itemId: string): ClaimRecord[] {
  type Entry = { env: BusMessageEnvelope; payload: ClaimPayload };
  const byFrom = new Map<string, Entry>();
  for (const env of envelopes) {
    if (env.topic !== "claim") continue;
    const p = env.payload;
    if (p.itemId !== itemId) continue;
    if (p.action !== "claim" && p.action !== "release") continue;
    const existing = byFrom.get(env.from);
    if (
      existing === undefined ||
      env.publishedAt > existing.env.publishedAt ||
      (env.publishedAt === existing.env.publishedAt && env.id > existing.env.id)
    ) {
      byFrom.set(env.from, { env, payload: p });
    }
  }
  const records: ClaimRecord[] = [];
  for (const { env, payload } of byFrom.values()) {
    if (payload.action !== "claim") continue; // release → no active claim
    records.push({
      from: env.from,
      itemId: payload.itemId,
      ...(payload.branch !== undefined ? { branch: payload.branch } : {}),
      ...(payload.worktree !== undefined ? { worktree: payload.worktree } : {}),
      publishedAt: env.publishedAt,
      id: env.id,
    });
  }
  return records;
}

export type ClaimCoordinatorOptions = {
  readonly self: SenderRoomAgentId;
  readonly transport: TransportPort;
  /** Mint a fresh envelope id. Inject a deterministic one in tests. */
  readonly mint: () => string;
  /** Clock (default `Date.now`). Inject in tests. */
  readonly now?: () => number;
};

/**
 * A claim coordinator backed by a `TransportPort`. `check` reads the active
 * claims; `acquire` publishes a claim iff no OTHER agent holds one (preventing
 * split-brain); `release` publishes a release tombstone. Self-re-acquire is
 * idempotent-acquired (the same agent re-claiming its own item).
 */
export function createClaimCoordinator(opts: ClaimCoordinatorOptions): ClaimCoordinator {
  const now = opts.now ?? (() => Date.now());

  async function activeClaims(itemId: string): Promise<ClaimRecord[]> {
    const listed = await opts.transport.list({ topic: "claim" });
    if (!listed.ok) return [];
    return computeActiveClaims(listed.value, itemId);
  }

  function publishClaim(payload: ClaimPayload): Promise<{ outcome: "published"; messageId: string } | { outcome: "feedback"; reason: string }> {
    const envelope: BusMessageEnvelope = {
      topic: "claim",
      payload,
      id: opts.mint(),
      from: opts.self,
      to: "*",
      publishedAt: new Date(now()).toISOString(),
      ttlMs: ROOM_TOPIC_TTL_MS.claim,
    };
    return opts.transport.publish(envelope);
  }

  return {
    check: async (itemId) => {
      const claims = await activeClaims(itemId);
      const first = claims[0];
      if (first === undefined) return { outcome: "unclaimed" };
      return { outcome: "claimed", by: first.from, ...(first.worktree !== undefined ? { worktree: first.worktree } : {}) };
    },

    acquire: async (itemId, branch, worktree) => {
      const heldByOthers = (await activeClaims(itemId)).filter((c) => c.from !== opts.self);
      if (heldByOthers.length > 0) {
        return { outcome: "feedback", reason: `already claimed by ${heldByOthers.map((c) => c.from).join(", ")}` };
      }
      const published = await publishClaim({
        action: "claim",
        itemId,
        ...(branch !== undefined ? { branch } : {}),
        ...(worktree !== undefined ? { worktree } : {}),
      });
      if (published.outcome === "feedback") return { outcome: "feedback", reason: published.reason };
      return { outcome: "acquired", itemId };
    },

    release: async (itemId) => {
      const published = await publishClaim({ action: "release", itemId });
      if (published.outcome === "feedback") return { outcome: "feedback", reason: published.reason };
      return { outcome: "released", itemId };
    },
  };
}
